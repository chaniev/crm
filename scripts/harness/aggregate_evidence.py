#!/usr/bin/env python3
"""Aggregate verification reports into one deterministic merge-gate status."""

from __future__ import annotations

import argparse
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


FAILURE_STATUSES = {"failed", "interrupted", "timed_out", "spawn_failed"}
INCOMPLETE_STATUSES = {"dry_run", "running", "planned", "not_run", "incomplete"}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def aggregate_reports(
    paths: Iterable[Path],
    *,
    required_task_id: str | None = None,
    required_report_names: Iterable[str] = (),
) -> dict[str, Any]:
    inputs: list[dict[str, Any]] = []
    heads: set[str] = set()
    trees: set[str] = set()
    contract_digests: set[str] = set()
    task_ids: set[str] = set()
    statuses: list[str] = []
    report_names: set[str] = set()
    dirty_reports: list[str] = []

    for path in sorted({item.resolve() for item in paths}):
        data = json.loads(path.read_text(encoding="utf-8"))
        report_names.add(path.name)
        status = str(data.get("status", "incomplete"))
        statuses.append(status)
        git = data.get("git") if isinstance(data.get("git"), dict) else {}
        head = git.get("head_sha")
        tree = git.get("head_tree_sha")
        if git.get("working_tree_dirty") is True:
            dirty_reports.append(str(path))
        if head:
            heads.add(str(head))
        if tree:
            trees.add(str(tree))
        contract = (
            data.get("task_contract")
            if isinstance(data.get("task_contract"), dict)
            else {}
        )
        digest = contract.get("sha256")
        task_id = data.get("task_id") or contract.get("task_id")
        if digest:
            contract_digests.add(str(digest))
        if task_id:
            task_ids.add(str(task_id))
        inputs.append(
            {
                "path": str(path),
                "status": status,
                "head_sha": head,
                "head_tree_sha": tree,
                "task_id": task_id,
                "task_contract_sha256": digest,
            }
        )

    stale = (
        len(heads) > 1
        or len(trees) > 1
        or len(contract_digests) > 1
        or bool(dirty_reports)
    )
    task_missing = required_task_id is not None and required_task_id not in task_ids
    missing_reports = sorted(set(required_report_names).difference(report_names))
    if stale:
        status = "stale"
    elif any(item in FAILURE_STATUSES for item in statuses):
        status = "failed"
    elif "manual_required" in statuses:
        status = "manual_required"
    elif not inputs or task_missing or missing_reports or any(
        item in INCOMPLETE_STATUSES or item not in {"passed"}
        for item in statuses
    ):
        status = "incomplete"
    else:
        status = "passed"

    return {
        "schema_version": 1,
        "created_at": _utc_now(),
        "status": status,
        "required_task_id": required_task_id,
        "missing_reports": missing_reports,
        "dirty_reports": dirty_reports,
        "head_sha": next(iter(heads)) if len(heads) == 1 else None,
        "head_tree_sha": next(iter(trees)) if len(trees) == 1 else None,
        "task_contract_sha256": (
            next(iter(contract_digests)) if len(contract_digests) == 1 else None
        ),
        "task_ids": sorted(task_ids),
        "inputs": inputs,
    }


def write_report(path: Path, report: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
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


def write_github_summary(report: dict[str, Any]) -> None:
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary_path:
        return
    lines = [
        "## CRM verification gate",
        "",
        f"**Status:** `{report['status']}`  ",
        f"**HEAD:** `{report.get('head_sha') or 'mixed/unknown'}`  ",
        f"**Tree:** `{report.get('head_tree_sha') or 'mixed/unknown'}`",
        "",
        "| Evidence | Status | Task |",
        "|---|---|---|",
    ]
    for item in report["inputs"]:
        lines.append(
            f"| `{Path(item['path']).name}` | `{item['status']}` | "
            f"`{item.get('task_id') or '—'}` |"
        )
    with Path(summary_path).open("a", encoding="utf-8") as summary:
        summary.write("\n".join(lines) + "\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--require-task-id")
    parser.add_argument(
        "--require-report",
        action="append",
        default=[],
        help="required evidence filename; repeat for every mandatory CI job",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    input_dir = Path(args.input_dir)
    report_path = Path(args.report)
    paths = [
        path
        for path in input_dir.rglob("*.json")
        if path.resolve() != report_path.resolve()
    ]
    try:
        report = aggregate_reports(
            paths,
            required_task_id=args.require_task_id,
            required_report_names=args.require_report,
        )
    except (OSError, json.JSONDecodeError) as error:
        report = {
            "schema_version": 1,
            "created_at": _utc_now(),
            "status": "incomplete",
            "error": str(error),
            "inputs": [],
        }
    write_report(report_path, report)
    write_github_summary(report)
    print(f"Verification gate: {report['status']}")
    return 0 if report["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
