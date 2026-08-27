#!/usr/bin/env python3
"""Select and execute the canonical checks for a CRM repository change."""

from __future__ import annotations

import argparse
import json
import shlex
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.harness.change_impact import ALL_AREAS, ChangeImpact, analyze_paths
from scripts.harness.commands import CheckSpec, checks_for


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
        default=".artifacts/verification/report.json",
        help="JSON evidence path, relative to the repository root unless absolute",
    )
    return parser.parse_args()


def _git_lines(*args: str, root: Path = ROOT) -> list[str]:
    result = subprocess.run(
        ("git", *args),
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
    )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def changed_paths(base: str, *, root: Path = ROOT) -> list[str]:
    """Include committed, staged, unstaged, and untracked task changes."""

    try:
        _git_lines("rev-parse", "--verify", base, root=root)
        path_sets = (
            _git_lines(
                "diff", "--name-only", "--diff-filter=ACMR", f"{base}...HEAD", root=root
            ),
            _git_lines(
                "diff", "--name-only", "--diff-filter=ACMR", "--cached", root=root
            ),
            _git_lines("diff", "--name-only", "--diff-filter=ACMR", root=root),
            _git_lines("ls-files", "--others", "--exclude-standard", root=root),
        )
    except subprocess.CalledProcessError as error:
        raise RuntimeError(
            f"cannot resolve change set from base {base!r}; fetch the revision or pass --base"
        ) from error
    return sorted({path for paths in path_sets for path in paths})


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
    path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def display_path(path: Path) -> str:
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def print_plan(paths: list[str], impact: ChangeImpact, checks: list[CheckSpec]) -> None:
    print("Changed paths:")
    if paths:
        for path in paths:
            print(f"  {path}")
    else:
        print("  (not inspected for full profile)")

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


def execute(checks: list[CheckSpec], report: dict[str, Any], report_path: Path) -> int:
    failed = False
    for index, check in enumerate(checks):
        entry = report["checks"][index]
        print(f"\n==> {check.identifier}: {_command_text(check)}", flush=True)
        started = time.monotonic()
        try:
            completed = subprocess.run(
                check.command,
                cwd=ROOT / check.working_directory,
                check=False,
            )
            return_code = completed.returncode
        except FileNotFoundError:
            return_code = 127
            print(f"required executable not found: {check.command[0]}", file=sys.stderr)

        entry["duration_seconds"] = round(time.monotonic() - started, 3)
        entry["exit_code"] = return_code
        entry["status"] = "passed" if return_code == 0 else "failed"
        write_report(report_path, report)

        if return_code != 0:
            failed = True
            for remaining in report["checks"][index + 1 :]:
                remaining["status"] = "not_run"
            break

    return 1 if failed else 0


def main() -> int:
    args = parse_args()
    if args.area and args.profile != "full":
        print("--area is supported only with --profile full", file=sys.stderr)
        return 2

    try:
        paths = [] if args.profile == "full" else changed_paths(args.base)
    except RuntimeError as error:
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

    requirements_base = args.base if "requirements" in impact.areas else None
    checks = checks_for(impact.areas, base=requirements_base)
    print_plan(paths, impact, checks)

    report_path = _report_path(args.report)
    report: dict[str, Any] = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "repository": str(ROOT),
        "profile": args.profile,
        "base": args.base,
        "dry_run": args.dry_run,
        "status": "dry_run" if args.dry_run else "running",
        "changed_paths": paths,
        "selected_areas": [area for area in ALL_AREAS if area in impact.areas],
        "reasons": impact.reasons,
        "checks": [
            {
                "id": check.identifier,
                "area": check.area,
                "working_directory": check.working_directory,
                "command": list(check.command),
                "status": "planned",
            }
            for check in checks
        ],
    }
    write_report(report_path, report)

    if args.dry_run:
        print(f"\nDry run complete. Evidence: {display_path(report_path)}")
        return 0

    exit_code = execute(checks, report, report_path)
    report["status"] = "passed" if exit_code == 0 else "failed"
    write_report(report_path, report)
    print(f"\nEvidence: {display_path(report_path)}")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
