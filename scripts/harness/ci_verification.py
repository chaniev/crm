#!/usr/bin/env python3
"""Prepare one diff-aware CI run; canonical and task checks execute once."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.harness.change_impact import analyze_paths
from scripts.harness.git_changes import collect_changes, flatten_paths
from scripts.harness.task_contract import ContractError, discover_task_contract

STATE = Path(".artifacts/ci/arguments.json")
PLAN = Path(".artifacts/ci/plan.json")
REPORT = Path(".artifacts/verification/verification.json")
LIGHTWEIGHT_AREAS = {"requirements", "harness"}


def resolve_arguments(
    event: dict[str, Any], event_name: str, *, root: Path
) -> list[str]:
    if event_name == "push":
        base = event.get("before", "")
        # New branch or unavailable force-push history: fail safe, never empty diff.
        exists = bool(re.fullmatch(r"[0-9a-f]{40,64}", base)) and set(base) != {"0"}
        if exists:
            exists = (
                subprocess.run(
                    ("git", "merge-base", "--is-ancestor", base, "HEAD"),
                    cwd=root,
                    capture_output=True,
                ).returncode
                == 0
            )
        if not exists:
            print("Push baseline unavailable; selecting the full baseline.")
            return ["--profile", "full", "--base", "HEAD"]
        return ["--base", base]
    if event_name != "pull_request":
        raise ValueError(f"unsupported CI event: {event_name}")
    pull_request = event["pull_request"]
    base = pull_request["base"]["sha"]
    source_ref = pull_request["head"]["ref"]
    paths = flatten_paths(collect_changes(base, root=root))
    lightweight = analyze_paths(paths).areas <= LIGHTWEIGHT_AREAS
    task_ids = set(re.findall(r"TASK-\d{3,}", source_ref))
    if len(task_ids) > 1:
        raise ValueError("pull request branch contains ambiguous TASK IDs")
    if not task_ids:
        if not lightweight or any(
            path.endswith("verification-contract.json") for path in paths
        ):
            raise ValueError(
                "application/infrastructure pull request branch must contain TASK-NNN"
            )
        return ["--base", base]
    task_id = next(iter(task_ids))
    candidates = [
        path
        for directory in ("implementation", "done")
        for path in (root / "backlog" / directory).rglob(
            f"{task_id}-*verification-contract.json"
        )
    ]
    if not candidates:
        if not lightweight or any(
            path.endswith("verification-contract.json") for path in paths
        ):
            raise ContractError(f"no verification contract found for {task_id}")
        return ["--base", base]
    # Ambiguous contracts fail here; malformed/stale ones fail in the canonical runner.
    discover_task_contract(task_id, root=root)
    return ["--base", base, "--task-id", task_id, "--source-ref", source_ref]


def setup_outputs(plan: dict[str, Any]) -> dict[str, str]:
    areas = set(plan["selected_areas"])
    executables = {Path(check["command"][0]).name for check in plan["checks"]}
    return {
        "backend": str("backend" in areas or "dotnet" in executables).lower(),
        "frontend": str(
            "frontend" in areas or bool({"npm", "node", "npx"} & executables)
        ).lower(),
        "bot": str("bot" in areas or "uv" in executables).lower(),
        "task_id": plan.get("task_id") or "",
    }


def prepare(event: dict[str, Any], event_name: str, *, root: Path = ROOT) -> int:
    arguments = resolve_arguments(event, event_name, root=root)
    plan_path = root / PLAN
    result = subprocess.run(
        [
            sys.executable,
            "scripts/harness/verify_change.py",
            *arguments,
            "--dry-run",
            "--report",
            str(PLAN),
        ],
        cwd=root,
    )
    if result.returncode:
        return result.returncode
    plan = json.loads(plan_path.read_text(encoding="utf-8"))
    state = {"arguments": arguments, "head_sha": plan["git"]["head_sha"]}
    (root / STATE).write_text(json.dumps(state) + "\n", encoding="utf-8")
    outputs = setup_outputs(plan)
    output_path = os.environ.get("GITHUB_OUTPUT")
    if output_path:
        with Path(output_path).open("a", encoding="utf-8") as output:
            output.write("".join(f"{key}={value}\n" for key, value in outputs.items()))
    print("Required runtime setup:", json.dumps(outputs))
    return 0


def run(*, root: Path = ROOT) -> int:
    state = json.loads((root / STATE).read_text(encoding="utf-8"))
    head = subprocess.check_output(
        ("git", "rev-parse", "HEAD"), cwd=root, text=True
    ).strip()
    if head != state["head_sha"]:
        raise ValueError("checkout changed after CI preparation; prepare again")
    # Recompute selection rather than executing a cached list of commands.
    return subprocess.run(
        [
            sys.executable,
            "scripts/harness/verify_change.py",
            *state["arguments"],
            "--report",
            str(REPORT),
        ],
        cwd=root,
    ).returncode


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("prepare", "run"))
    args = parser.parse_args()
    try:
        if args.mode == "run":
            return run()
        event = json.loads(
            Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8")
        )
        return prepare(event, os.environ["GITHUB_EVENT_NAME"])
    except (
        KeyError,
        ValueError,
        OSError,
        RuntimeError,
        subprocess.CalledProcessError,
    ) as error:
        print(f"CI verification failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
