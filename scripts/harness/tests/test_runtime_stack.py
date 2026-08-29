from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from scripts.harness.runtime_stack import _expand, execute_runtime_stack
from scripts.harness.task_contract import RuntimeProbeSpec, RuntimeStackSpec


class RuntimeStackTests(unittest.TestCase):
    def spec(self) -> RuntimeStackSpec:
        return RuntimeStackSpec(
            compose_file="deploy/docker-compose.yml",
            env_file="deploy/.env.example",
            services=("frontend",),
            startup_timeout_seconds=30,
            cleanup_timeout_seconds=20,
            readiness=(
                RuntimeProbeSpec(
                    "runtime.backend-ready",
                    ("curl", "http://127.0.0.1:{backend_port}/health/ready"),
                    10,
                ),
            ),
            smoke=(
                RuntimeProbeSpec(
                    "runtime.frontend-smoke",
                    ("curl", "http://127.0.0.1:{frontend_port}/"),
                    10,
                ),
            ),
        )

    def test_uses_unique_project_ports_and_cleans_up_after_success(self) -> None:
        calls: list[tuple[tuple[str, ...], dict[str, str], float]] = []

        def run(command: tuple[str, ...], env: dict[str, str], timeout: float):
            calls.append((command, env, timeout))
            return subprocess.CompletedProcess(command, 0)

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "deploy").mkdir()
            (root / "deploy" / "docker-compose.yml").write_text("services: {}\n")
            (root / "deploy" / ".env.example").write_text("BOT_ENABLED=true\n")
            report_path = root / "runtime.json"
            exit_code = execute_runtime_stack(
                self.spec(),
                task_id="TASK-999",
                root=root,
                report_path=report_path,
                run=run,
                allocate_port=iter((31001, 31002)).__next__,
                project_name="crm-task-999-test",
            )
            report = json.loads(report_path.read_text())

        self.assertEqual(0, exit_code)
        self.assertEqual("passed", report["status"])
        self.assertEqual("crm-task-999-test", report["project_name"])
        self.assertEqual(31001, report["ports"]["backend"])
        self.assertEqual(31002, report["ports"]["frontend"])
        self.assertTrue(any("up" in command for command, _, _ in calls))
        down = [command for command, _, _ in calls if "down" in command]
        self.assertEqual(1, len(down))
        self.assertNotIn("-v", down[0])
        for _, env, _ in calls:
            self.assertEqual("false", env["BOT_ENABLED"])

    def test_smoke_failure_still_cleans_up(self) -> None:
        calls: list[tuple[str, ...]] = []

        def run(command: tuple[str, ...], env: dict[str, str], timeout: float):
            calls.append(command)
            failed = "http://127.0.0.1:31002/" in command
            return subprocess.CompletedProcess(command, 1 if failed else 0)

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "deploy").mkdir()
            (root / "deploy" / "docker-compose.yml").write_text("services: {}\n")
            (root / "deploy" / ".env.example").write_text("BOT_ENABLED=true\n")
            exit_code = execute_runtime_stack(
                self.spec(),
                task_id="TASK-999",
                root=root,
                report_path=root / "runtime.json",
                run=run,
                allocate_port=iter((31001, 31002)).__next__,
                project_name="crm-task-999-test",
            )

        self.assertEqual(1, exit_code)
        self.assertTrue(any("down" in command for command in calls))

    def test_rejects_placeholder_attribute_access(self) -> None:
        with self.assertRaisesRegex(ValueError, "invalid runtime placeholder"):
            _expand(
                ("{project_name.__class__}",),
                {"project_name": "safe-project"},
            )


if __name__ == "__main__":
    unittest.main()
