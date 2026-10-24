#!/usr/bin/env python3
"""Select and execute the canonical checks for a CRM repository change."""

from __future__ import annotations

import argparse
import json
import os
import shlex
import signal
import socket
import subprocess
import sys
import tempfile
import time
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.harness.change_impact import ALL_AREAS, ChangeImpact, analyze_paths
from scripts.harness.commands import CheckSpec, checks_for
from scripts.harness.git_changes import collect_changes, collect_git_context, flatten_paths
from scripts.harness.task_contract import (
    ContractError,
    TaskContract,
    combine_checks,
    contract_evidence,
    discover_task_contract,
    extend_impact,
    load_manual_evidence,
    load_task_contract,
    manual_check_entries,
    manual_evidence_from_cli,
    task_checks,
    validate_contract_ref,
)


SCHEMA_VERSION = 5
RUNNER_VERSION = "5.0"
GITHUB_ENVIRONMENT_KEYS = (
    "GITHUB_ACTIONS",
    "GITHUB_JOB",
    "GITHUB_REF",
    "GITHUB_REPOSITORY",
    "GITHUB_RUN_ATTEMPT",
    "GITHUB_RUN_ID",
    "GITHUB_SERVER_URL",
    "GITHUB_SHA",
    "GITHUB_WORKFLOW",
)
VERSION_ARGUMENTS = {
    "bash": ("--version",),
    "docker": ("--version",),
    "dotnet": ("--version",),
    "git": ("--version",),
    "npm": ("--version",),
    "python3": ("--version",),
    "uv": ("--version",),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Select and execute required CRM verification checks."
    )
    parser.add_argument(
        "--profile",
        choices=("local", "full"),
        default="local",
        help="local selects checks from the diff; full selects every area unless --area is used",
    )
    parser.add_argument(
        "--base",
        default="origin/main",
        help="Git revision used by the local diff and requirements changelog validation",
    )
    parser.add_argument(
        "--area",
        action="append",
        choices=ALL_AREAS,
        help="restrict a full profile to one or more areas; repeat for multiple areas",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="print the selected checks without executing them",
    )
    parser.add_argument(
        "--report",
        help="JSON evidence path; defaults to report.json (final) or iteration.json (--check) under .artifacts/verification",
    )
    parser.add_argument(
        "--check",
        action="append",
        default=[],
        metavar="CHECK_ID",
        help="debug selected check and prerequisites; repeat as needed; never produces merge evidence",
    )
    parser.add_argument(
        "--timeout-scale",
        type=float,
        default=1.0,
        help="multiply every check timeout by this positive value",
    )
    parser.add_argument(
        "--task-contract",
        help="repository-relative JSON verification contract for the implementation task",
    )
    parser.add_argument(
        "--task-id",
        help="discover exactly one repository contract for TASK-NNN",
    )
    parser.add_argument(
        "--source-ref",
        help="task source ref used to validate a detached CI checkout",
    )
    parser.add_argument(
        "--manual-evidence",
        help="repository-relative JSON provenance for required manual checks",
    )
    parser.add_argument(
        "--confirm-manual",
        action="append",
        default=[],
        metavar="CHECK_ID",
        help="confirm one required manual check from --task-contract; repeat as needed",
    )
    parser.add_argument("--manual-actor", help="actor for CLI manual confirmations")
    parser.add_argument("--manual-note", help="note for CLI manual confirmations")
    parser.add_argument(
        "--manual-artifact",
        action="append",
        default=[],
        help="artifact reference for CLI manual confirmations; repeat as needed",
    )
    return parser.parse_args()


def reserve_local_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        listener.bind(("127.0.0.1", 0))
        return int(listener.getsockname()[1])


def changed_paths(base: str, *, root: Path = ROOT) -> list[str]:
    """Include committed, staged, unstaged, and untracked task changes."""
    return flatten_paths(collect_changes(base, root=root))


def collect_tool_versions(checks: list[CheckSpec]) -> dict[str, str]:
    executables = {"git", "python3"}
    executables.update(
        check.command[0]
        for check in checks
        if check.command[0] in VERSION_ARGUMENTS
    )
    versions: dict[str, str] = {}
    for executable in sorted(executables):
        arguments = VERSION_ARGUMENTS.get(executable, ("--version",))
        try:
            result = subprocess.run(
                (executable, *arguments),
                check=False,
                capture_output=True,
                text=True,
                timeout=5,
            )
            output = (result.stdout or result.stderr).strip().splitlines()
            versions[executable] = output[0] if output else f"exit {result.returncode}"
        except (OSError, subprocess.TimeoutExpired) as error:
            versions[executable] = f"unavailable: {error}"
    return versions


def github_environment() -> dict[str, str]:
    return {
        key: os.environ[key]
        for key in GITHUB_ENVIRONMENT_KEYS
        if key in os.environ
    }


def _command_text(check: CheckSpec) -> str:
    command = shlex.join(check.command)
    if check.working_directory == ".":
        return command
    return f"cd {check.working_directory} && {command}"


def _report_path(value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else ROOT / path


def write_report(path: Path, report: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary:
            temporary_path = Path(temporary.name)
            temporary.write(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
            temporary.flush()
            os.fsync(temporary.fileno())
        os.replace(temporary_path, path)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()


def display_path(path: Path) -> str:
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def print_plan(
    paths: list[str],
    impact: ChangeImpact,
    checks: list[CheckSpec],
    *,
    profile: str,
    contract: TaskContract | None = None,
    manual_checks: list[dict[str, str]] | None = None,
) -> None:
    print("Changed paths:")
    if paths:
        for path in paths:
            print(f"  {path}")
    elif profile == "local":
        print("  (no changed paths)")
    else:
        print("  (not inspected for full profile)")

    if contract is not None:
        print(f"Task contract: {contract.task_id} ({contract.relative_path})")

    print("Selected areas:")
    for area in ALL_AREAS:
        if area not in impact.areas:
            continue
        print(f"  {area}")
        for reason in impact.reasons.get(area, []):
            print(f"    - {reason}")

    print("Checks:")
    for check in checks:
        print(f"  [{check.identifier}] {_command_text(check)}")

    if manual_checks:
        print("Manual checks:")
        for check in manual_checks:
            print(f"  [{check['id']}] {check['status']}: {check['description']}")


def write_github_summary(report: dict[str, Any]) -> None:
    summary_path_value = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path_value:
        return

    git_context = report.get("git", {})
    lines = [
        "## CRM verification",
        "",
        f"**Status:** `{report['status']}`  ",
        f"**HEAD:** `{git_context.get('head_sha', 'unknown')}`",
        "",
        "| Check | Area | Status | Duration |",
        "|---|---|---|---:|",
    ]
    for check in report["checks"]:
        duration = check.get("duration_seconds")
        duration_text = f"{duration:.3f}s" if duration is not None else "—"
        lines.append(
            f"| `{check['id']}` | {check['area']} | `{check['status']}` | {duration_text} |"
        )
    lines.append("")
    if report.get("manual_checks"):
        lines.extend(
            (
                "| Manual check | Status |",
                "|---|---|",
            )
        )
        for check in report["manual_checks"]:
            lines.append(f"| `{check['id']}` | `{check['status']}` |")
        lines.append("")
    try:
        with Path(summary_path_value).open("a", encoding="utf-8") as summary:
            summary.write("\n".join(lines))
    except OSError as error:
        print(f"unable to write GitHub job summary: {error}", file=sys.stderr)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _terminate_process_group(process: subprocess.Popen[Any]) -> None:
    if process.poll() is not None:
        return

    try:
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    except ProcessLookupError:
        return
    except OSError:
        try:
            process.terminate()
        except OSError:
            return

    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(os.getpgid(process.pid), signal.SIGKILL)
        except ProcessLookupError:
            return
        except OSError:
            try:
                process.kill()
            except OSError:
                return
        process.wait()


def _finish_report(
    report: dict[str, Any], report_path: Path, *, status: str
) -> None:
    report["status"] = status
    report["completed_at"] = _utc_now()
    write_report(report_path, report)
    write_github_summary(report)


def execute(
    checks: list[CheckSpec],
    report: dict[str, Any],
    report_path: Path,
    *,
    timeout_scale: float = 1.0,
) -> int:
    statuses: dict[str, str] = {}
    for index, check in enumerate(checks):
        entry = report["checks"][index]
        blocked_by = [
            dependency for dependency in check.depends_on
            if statuses.get(dependency) != "passed"
        ]
        if blocked_by:
            entry["status"] = "not_run"
            entry["blocked_by"] = blocked_by
            statuses[check.identifier] = "not_run"
            print(f"\n==> {check.identifier}: blocked by {', '.join(blocked_by)}", flush=True)
            write_report(report_path, report)
            continue
        print(f"\n==> {check.identifier}: {_command_text(check)}", flush=True)
        started = time.monotonic()
        entry["started_at"] = _utc_now()
        entry["timeout_seconds"] = check.timeout_seconds * timeout_scale
        try:
            process = subprocess.Popen(
                check.command,
                cwd=ROOT / check.working_directory,
                start_new_session=True,
            )
            try:
                return_code = process.wait(timeout=entry["timeout_seconds"])
                entry["exit_code"] = return_code
                entry["status"] = "passed" if return_code == 0 else "failed"
            except subprocess.TimeoutExpired:
                _terminate_process_group(process)
                entry["exit_code"] = process.returncode
                entry["status"] = "timed_out"
                entry["error"] = (
                    f"check exceeded timeout of {entry['timeout_seconds']:.3f} seconds"
                )
                print(entry["error"], file=sys.stderr)
            except KeyboardInterrupt:
                _terminate_process_group(process)
                entry["exit_code"] = process.returncode
                entry["status"] = "interrupted"
                entry["error"] = "verification interrupted by user"
        except OSError as error:
            entry["exit_code"] = 127 if isinstance(error, FileNotFoundError) else None
            entry["status"] = "spawn_failed"
            entry["error"] = f"unable to start {check.command[0]}: {error}"
            print(entry["error"], file=sys.stderr)

        entry["duration_seconds"] = round(time.monotonic() - started, 3)
        entry["completed_at"] = _utc_now()
        statuses[check.identifier] = entry["status"]
        write_report(report_path, report)

        if entry["status"] == "interrupted":
            for remaining in report["checks"][index + 1 :]:
                remaining["status"] = "not_run"
            _finish_report(report, report_path, status="interrupted")
            return 130

    if any(status != "passed" for status in statuses.values()):
        _finish_report(report, report_path, status="failed")
        return 1

    if report.get("verification_mode") == "iteration":
        _finish_report(report, report_path, status="partial")
        return 0

    if any(
        check.get("status") == "not_confirmed"
        for check in report.get("manual_checks", [])
    ):
        _finish_report(report, report_path, status="manual_required")
        return 1

    _finish_report(report, report_path, status="passed")
    return 0


def select_checks(checks: list[CheckSpec], requested: list[str]) -> list[CheckSpec]:
    """Select prerequisites from an already validated, ordered check matrix."""
    selected = set(requested)
    unknown = selected.difference(check.identifier for check in checks)
    if unknown:
        raise ContractError(f"unknown check ID: {', '.join(sorted(unknown))}")
    for check in reversed(checks):
        if check.identifier in selected:
            selected.update(check.depends_on)
    return [check for check in checks if check.identifier in selected]


def main() -> int:
    args = parse_args()
    if args.check and os.environ.get("GITHUB_ACTIONS") == "true":
        print("--check is for local iteration and is not allowed in CI", file=sys.stderr)
        return 2
    if args.check and (args.confirm_manual or args.manual_evidence):
        print("--check cannot confirm manual evidence", file=sys.stderr)
        return 2
    if args.timeout_scale <= 0:
        print("--timeout-scale must be greater than zero", file=sys.stderr)
        return 2
    if args.area and args.profile != "full":
        print("--area is supported only with --profile full", file=sys.stderr)
        return 2
    if args.task_id and args.task_contract:
        print("--task-id and --task-contract are mutually exclusive", file=sys.stderr)
        return 2
    if args.confirm_manual and not (args.task_id or args.task_contract):
        print("--confirm-manual requires a task contract", file=sys.stderr)
        return 2
    if args.confirm_manual and (not args.manual_actor or not args.manual_note):
        print(
            "--confirm-manual requires --manual-actor and --manual-note",
            file=sys.stderr,
        )
        return 2
    if args.confirm_manual and args.manual_evidence:
        print("CLI confirmations and --manual-evidence are mutually exclusive", file=sys.stderr)
        return 2

    try:
        changes = [] if args.profile == "full" else collect_changes(args.base, root=ROOT)
        paths = flatten_paths(changes)
    except RuntimeError as error:
        print(error, file=sys.stderr)
        return 2

    git_context = collect_git_context(args.base, root=ROOT)
    contract: TaskContract | None = None
    manual_evidence = None
    try:
        contract_path: Path | None = None
        if args.task_id:
            contract_path = discover_task_contract(args.task_id, root=ROOT)
        elif args.task_contract:
            contract_path = Path(args.task_contract)
        if contract_path is not None:
            contract = load_task_contract(contract_path, root=ROOT)
            if args.task_id and contract.task_id != args.task_id:
                raise ContractError(
                    f"discovered contract task_id {contract.task_id} does not match {args.task_id}"
                )
            validate_contract_ref(
                contract,
                branch=git_context.branch,
                source_ref=args.source_ref,
            )
            evidence_path = None if args.check else args.manual_evidence or contract.manual_evidence
            if evidence_path:
                manual_evidence = load_manual_evidence(
                    Path(evidence_path), contract=contract, root=ROOT
                )
            elif args.confirm_manual:
                manual_evidence = manual_evidence_from_cli(
                    contract=contract,
                    confirmed=args.confirm_manual,
                    actor=args.manual_actor,
                    note=args.manual_note,
                    artifacts=args.manual_artifact,
                )
    except (ContractError, OSError, UnicodeError) as error:
        print(error, file=sys.stderr)
        return 2

    if args.profile == "full":
        impact = analyze_paths([], full=True)
        if args.area:
            selected = set(args.area)
            impact = ChangeImpact(
                areas=selected,
                reasons={area: ["explicit full-profile area"] for area in selected},
            )
    else:
        impact = analyze_paths(paths)

    if contract is not None:
        impact = extend_impact(impact, contract)

    requirements_base = args.base if "requirements" in impact.areas else None
    try:
        canonical_checks = checks_for(impact.areas, base=requirements_base)
        extra_checks = task_checks(contract) if contract is not None else []
        checks = combine_checks(canonical_checks, extra_checks)
        required_check_ids = [check.identifier for check in checks]
        if args.check:
            checks = select_checks(checks, args.check)
        manual_entries = (
            manual_check_entries(contract, manual_evidence, dry_run=args.dry_run or bool(args.check))
            if contract is not None
            else []
        )
    except ContractError as error:
        print(error, file=sys.stderr)
        return 2
    print_plan(
        paths,
        impact,
        checks,
        profile=args.profile,
        contract=contract,
        manual_checks=manual_entries,
    )

    if args.check:
        print("Iteration only: this partial run cannot satisfy the merge gate.")
    report_path = _report_path(args.report or (
        ".artifacts/verification/iteration.json" if args.check
        else ".artifacts/verification/report.json"
    ))
    e2e_port = None
    playwright_ids = {item.identifier for item in contract.playwright} if contract else set()
    if any(check.identifier in playwright_ids for check in checks) and not args.dry_run:
        configured_e2e_port = os.environ.get("E2E_PORT")
        e2e_port = (
            int(configured_e2e_port)
            if configured_e2e_port is not None
            else reserve_local_port()
        )
        os.environ["E2E_PORT"] = str(e2e_port)
    task_check_ids = {check.identifier for check in extra_checks}
    report: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "runner_version": RUNNER_VERSION,
        "started_at": _utc_now(),
        "repository": os.environ.get("GITHUB_REPOSITORY", ROOT.name),
        "profile": args.profile,
        "verification_mode": "iteration" if args.check else "final",
        "requested_check_ids": args.check,
        "required_check_ids": required_check_ids,
        "base": args.base,
        "dry_run": args.dry_run,
        "status": "dry_run" if args.dry_run else "running",
        "git": asdict(git_context),
        "task_contract": (
            contract_evidence(
                contract,
                head_sha=git_context.head_sha,
                head_tree_sha=git_context.head_tree_sha,
            )
            if contract is not None
            else None
        ),
        "task_id": contract.task_id if contract is not None else None,
        "source_ref": args.source_ref,
        "e2e_port": e2e_port,
        "github": github_environment(),
        "tool_versions": collect_tool_versions(checks),
        "changes": [asdict(change) for change in changes],
        "changed_paths": paths,
        "selected_areas": [area for area in ALL_AREAS if area in impact.areas],
        "reasons": impact.reasons,
        "manual_checks": manual_entries,
        "checks": [
            {
                "id": check.identifier,
                "area": check.area,
                "working_directory": check.working_directory,
                "command": list(check.command),
                "depends_on": list(check.depends_on),
                "timeout_seconds": check.timeout_seconds * args.timeout_scale,
                "selection_reasons": [
                    *impact.reasons.get(check.area, []),
                    *(
                        [f"task contract {contract.task_id} defines this check"]
                        if contract is not None and check.identifier in task_check_ids
                        else []
                    ),
                ],
                "status": "planned",
            }
            for check in checks
        ],
    }
    write_report(report_path, report)

    if args.dry_run:
        report["completed_at"] = _utc_now()
        write_report(report_path, report)
        write_github_summary(report)
        print(f"\nDry run complete. Evidence: {display_path(report_path)}")
        return 0

    exit_code = execute(
        checks, report, report_path, timeout_scale=args.timeout_scale
    )
    print(f"\nEvidence: {display_path(report_path)}")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
