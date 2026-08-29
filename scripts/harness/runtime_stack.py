#!/usr/bin/env python3
"""Execute a disposable task Compose stack with guaranteed scoped cleanup."""

from __future__ import annotations

import argparse
import json
import os
import secrets
import signal
import socket
import string
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.harness.task_contract import RuntimeStackSpec, load_task_contract


RunCommand = Callable[
    [tuple[str, ...], dict[str, str], float], subprocess.CompletedProcess[Any]
]


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _write_report(path: Path, report: dict[str, Any]) -> None:
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


def allocate_local_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        listener.bind(("127.0.0.1", 0))
        return int(listener.getsockname()[1])


def _default_run(
    command: tuple[str, ...], env: dict[str, str], timeout: float
) -> subprocess.CompletedProcess[Any]:
    return subprocess.run(
        command,
        cwd=ROOT,
        env=env,
        timeout=timeout,
        check=False,
    )


def _expand(command: tuple[str, ...], values: dict[str, str]) -> tuple[str, ...]:
    formatter = string.Formatter()
    expanded: list[str] = []
    for argument in command:
        for _, field_name, format_spec, conversion in formatter.parse(argument):
            if field_name is None:
                continue
            if field_name not in values or format_spec or conversion:
                raise ValueError(f"invalid runtime placeholder: {field_name}")
        expanded.append(argument.format_map(values))
    return tuple(expanded)


def _compose_prefix(
    spec: RuntimeStackSpec, project_name: str
) -> tuple[str, ...]:
    return (
        "docker",
        "compose",
        "--project-name",
        project_name,
        "--project-directory",
        ".",
        "--env-file",
        spec.env_file,
        "-f",
        spec.compose_file,
    )


def execute_runtime_stack(
    spec: RuntimeStackSpec,
    *,
    task_id: str,
    root: Path,
    report_path: Path,
    run: RunCommand | None = None,
    allocate_port: Callable[[], int] = allocate_local_port,
    project_name: str | None = None,
) -> int:
    run_command = run or _default_run
    project = project_name or (
        f"crm-{task_id.lower()}-{os.getpid()}-{secrets.token_hex(2)}"
    )
    backend_port = allocate_port()
    frontend_port = allocate_port()
    if backend_port == frontend_port:
        frontend_port = allocate_port()
    values = {
        "project_name": project,
        "backend_port": str(backend_port),
        "frontend_port": str(frontend_port),
    }
    environment = os.environ.copy()
    environment.update(
        {
            "COMPOSE_PROJECT_NAME": project,
            "BACKEND_PORT": str(backend_port),
            "FRONTEND_PORT": str(frontend_port),
            "BOT_ENABLED": "false",
            "ClientTelegram__Enabled": "false",
        }
    )
    report: dict[str, Any] = {
        "schema_version": 1,
        "task_id": task_id,
        "started_at": _utc_now(),
        "status": "running",
        "project_name": project,
        "ports": {"backend": backend_port, "frontend": frontend_port},
        "bot_enabled": False,
        "checks": [],
        "cleanup": {"status": "planned"},
    }
    _write_report(report_path, report)
    prefix = _compose_prefix(spec, project)
    started = False
    interrupted = False

    def record(identifier: str, command: tuple[str, ...], result: int, attempts: int = 1):
        report["checks"].append(
            {
                "id": identifier,
                "command": list(command),
                "status": "passed" if result == 0 else "failed",
                "exit_code": result,
                "attempts": attempts,
                "completed_at": _utc_now(),
            }
        )
        _write_report(report_path, report)

    try:
        start_command = (*prefix, "up", "--build", "-d", *spec.services)
        started = True
        start_result = run_command(
            start_command, environment, spec.startup_timeout_seconds
        )
        record("runtime.compose.up", start_command, start_result.returncode)
        if start_result.returncode != 0:
            report["status"] = "failed"
        else:
            for probe in spec.readiness:
                command = _expand(probe.command, values)
                deadline = time.monotonic() + probe.timeout_seconds
                attempts = 0
                result_code = 1
                while time.monotonic() < deadline:
                    attempts += 1
                    remaining = max(0.1, deadline - time.monotonic())
                    result = run_command(command, environment, min(10.0, remaining))
                    result_code = result.returncode
                    if result_code == 0:
                        break
                    time.sleep(min(2.0, max(0.0, deadline - time.monotonic())))
                record(probe.identifier, command, result_code, attempts)
                if result_code != 0:
                    report["status"] = "failed"
                    break

            if report["status"] == "running":
                for probe in spec.smoke:
                    command = _expand(probe.command, values)
                    result = run_command(command, environment, probe.timeout_seconds)
                    record(probe.identifier, command, result.returncode)
                    if result.returncode != 0:
                        report["status"] = "failed"
                        break
            if report["status"] == "running":
                report["status"] = "passed"
    except KeyboardInterrupt:
        interrupted = True
        report["status"] = "interrupted"
    except (OSError, subprocess.TimeoutExpired, ValueError) as error:
        report["status"] = "failed"
        report["error"] = str(error)
    finally:
        if started:
            down_command = (*prefix, "down", "--remove-orphans")
            try:
                down_result = run_command(
                    down_command, environment, spec.cleanup_timeout_seconds
                )
                report["cleanup"] = {
                    "command": list(down_command),
                    "status": "passed" if down_result.returncode == 0 else "failed",
                    "exit_code": down_result.returncode,
                    "completed_at": _utc_now(),
                }
                if down_result.returncode != 0 and report["status"] == "passed":
                    report["status"] = "failed"
            except (OSError, subprocess.TimeoutExpired) as error:
                report["cleanup"] = {"status": "failed", "error": str(error)}
                if report["status"] == "passed":
                    report["status"] = "failed"
        report["completed_at"] = _utc_now()
        _write_report(report_path, report)

    if interrupted:
        return 130
    return 0 if report["status"] == "passed" else 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--task-contract", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    contract = load_task_contract(Path(args.task_contract), root=ROOT)
    if contract.runtime_stack is None:
        print("task contract has no runtime_stack", file=sys.stderr)
        return 2
    previous = signal.getsignal(signal.SIGTERM)

    def interrupt(_signum: int, _frame: Any) -> None:
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, interrupt)
    try:
        report_path = Path(args.report)
        if not report_path.is_absolute():
            report_path = ROOT / report_path
        return execute_runtime_stack(
            contract.runtime_stack,
            task_id=contract.task_id,
            root=ROOT,
            report_path=report_path,
        )
    finally:
        signal.signal(signal.SIGTERM, previous)


if __name__ == "__main__":
    raise SystemExit(main())
