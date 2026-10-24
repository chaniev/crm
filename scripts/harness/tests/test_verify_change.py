from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import Mock, patch

from scripts.harness.commands import CheckSpec
from scripts.harness.git_changes import GitContext, parse_name_status
from scripts.harness.verify_change import (
    changed_paths,
    collect_tool_versions,
    execute,
    github_environment,
    main,
    print_plan,
    write_github_summary,
)
from scripts.harness.change_impact import analyze_paths


class ChangedPathsTests(unittest.TestCase):
    def git(self, root: Path, *args: str) -> str:
        result = subprocess.run(
            ("git", *args),
            cwd=root,
            check=True,
            capture_output=True,
            text=True,
        )
        return result.stdout.strip()

    def test_includes_committed_staged_unstaged_and_untracked_paths(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.git(root, "init")
            self.git(root, "config", "user.email", "harness@example.invalid")
            self.git(root, "config", "user.name", "Harness Test")

            (root / "base.txt").write_text("base\n", encoding="utf-8")
            self.git(root, "add", "base.txt")
            self.git(root, "commit", "-m", "base")
            base = self.git(root, "rev-parse", "HEAD")

            (root / "committed.txt").write_text("committed\n", encoding="utf-8")
            self.git(root, "add", "committed.txt")
            self.git(root, "commit", "-m", "committed change")

            (root / "staged.txt").write_text("staged\n", encoding="utf-8")
            self.git(root, "add", "staged.txt")
            (root / "base.txt").write_text("unstaged\n", encoding="utf-8")
            (root / "untracked.txt").write_text("untracked\n", encoding="utf-8")

            self.assertEqual(
                ["base.txt", "committed.txt", "staged.txt", "untracked.txt"],
                changed_paths(base, root=root),
            )

    def test_includes_deleted_path(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.git(root, "init")
            self.git(root, "config", "user.email", "harness@example.invalid")
            self.git(root, "config", "user.name", "Harness Test")

            deleted = root / "backend" / "src" / "Deleted.cs"
            deleted.parent.mkdir(parents=True)
            deleted.write_text("before\n", encoding="utf-8")
            self.git(root, "add", ".")
            self.git(root, "commit", "-m", "base")
            base = self.git(root, "rev-parse", "HEAD")

            deleted.unlink()

            self.assertEqual(
                ["backend/src/Deleted.cs"],
                changed_paths(base, root=root),
            )

    def test_includes_both_paths_for_cross_layer_rename(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.git(root, "init")
            self.git(root, "config", "user.email", "harness@example.invalid")
            self.git(root, "config", "user.name", "Harness Test")

            old_path = root / "backend" / "src" / "Moved.cs"
            old_path.parent.mkdir(parents=True)
            old_path.write_text("content\n", encoding="utf-8")
            self.git(root, "add", ".")
            self.git(root, "commit", "-m", "base")
            base = self.git(root, "rev-parse", "HEAD")

            new_path = root / "frontend" / "src" / "Moved.cs"
            new_path.parent.mkdir(parents=True)
            old_path.rename(new_path)
            self.git(root, "add", "-A")

            self.assertEqual(
                ["backend/src/Moved.cs", "frontend/src/Moved.cs"],
                changed_paths(base, root=root),
            )

    def test_failed_check_returns_nonzero_but_runs_independent_check(self) -> None:
        checks = [
            CheckSpec("test.fail", "harness", (sys.executable, "-c", "raise SystemExit(3)")),
            CheckSpec("test.skip", "harness", (sys.executable, "-c", "raise SystemExit(0)")),
        ]
        report = {
            "checks": [
                {"id": check.identifier, "status": "planned"} for check in checks
            ]
        }

        with tempfile.TemporaryDirectory() as directory:
            report_path = Path(directory) / "report.json"
            with redirect_stdout(StringIO()), redirect_stderr(StringIO()):
                exit_code = execute(checks, report, report_path)

        self.assertEqual(1, exit_code)
        self.assertEqual("failed", report["checks"][0]["status"])
        self.assertEqual(3, report["checks"][0]["exit_code"])
        self.assertEqual("passed", report["checks"][1]["status"])
        self.assertEqual("failed", report["status"])
        self.assertIn("completed_at", report)

    def test_failure_blocks_transitive_dependents_without_starting_them(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            marker = Path(directory) / "must-not-exist"
            checks = [
                CheckSpec("restore", "harness", (sys.executable, "-c", "exit(3)")),
                CheckSpec("build", "harness", (sys.executable, "-c", f"open({str(marker)!r}, 'w').close()"), depends_on=("restore",)),
                CheckSpec("test", "harness", (sys.executable, "-c", "exit(0)"), depends_on=("build",)),
                CheckSpec("independent", "harness", (sys.executable, "-c", "exit(0)")),
            ]
            report = {"checks": [{"status": "planned"} for _ in checks]}
            with redirect_stdout(StringIO()), redirect_stderr(StringIO()):
                code = execute(checks, report, Path(directory) / "report.json")
            self.assertFalse(marker.exists())
        self.assertEqual(1, code)
        self.assertEqual(["failed", "not_run", "not_run", "passed"], [c["status"] for c in report["checks"]])
        self.assertEqual(["restore"], report["checks"][1]["blocked_by"])
        self.assertEqual(["build"], report["checks"][2]["blocked_by"])

    def test_timeout_terminates_check_and_writes_final_report(self) -> None:
        checks = [
            CheckSpec(
                "test.timeout",
                "harness",
                (sys.executable, "-c", "import time; time.sleep(10)"),
                timeout_seconds=0.05,
            ),
            CheckSpec("independent", "harness", (sys.executable, "-c", "exit(0)")),
        ]
        report = {"status": "running", "checks": [{"status": "planned"} for _ in checks]}

        with tempfile.TemporaryDirectory() as directory:
            report_path = Path(directory) / "report.json"
            with redirect_stdout(StringIO()), redirect_stderr(StringIO()):
                exit_code = execute(checks, report, report_path)
            persisted = json.loads(report_path.read_text(encoding="utf-8"))

        self.assertEqual(1, exit_code)
        self.assertEqual("timed_out", persisted["checks"][0]["status"])
        self.assertEqual("passed", persisted["checks"][1]["status"])
        self.assertEqual("failed", persisted["status"])
        self.assertIn("completed_at", persisted)

    def test_missing_executable_is_reported_as_spawn_failure(self) -> None:
        checks = [
            CheckSpec(
                "test.missing",
                "harness",
                ("executable-that-does-not-exist-for-harness-test",),
            )
        ]
        report = {"status": "running", "checks": [{"status": "planned"}]}

        with tempfile.TemporaryDirectory() as directory:
            report_path = Path(directory) / "report.json"
            with redirect_stdout(StringIO()), redirect_stderr(StringIO()):
                exit_code = execute(checks, report, report_path)
            persisted = json.loads(report_path.read_text(encoding="utf-8"))

        self.assertEqual(1, exit_code)
        self.assertEqual("spawn_failed", persisted["checks"][0]["status"])
        self.assertEqual(127, persisted["checks"][0]["exit_code"])
        self.assertEqual("failed", persisted["status"])

    def test_interrupt_terminates_process_group_and_writes_final_report(self) -> None:
        checks = [CheckSpec("test.interrupt", "harness", (sys.executable,)), CheckSpec("independent", "harness", (sys.executable,))]
        report = {"status": "running", "checks": [{"status": "planned"} for _ in checks]}
        process = Mock()
        process.wait.side_effect = KeyboardInterrupt
        process.returncode = -2

        with tempfile.TemporaryDirectory() as directory:
            report_path = Path(directory) / "report.json"
            with (
                patch("scripts.harness.verify_change.subprocess.Popen", return_value=process),
                patch("scripts.harness.verify_change._terminate_process_group") as terminate,
                redirect_stdout(StringIO()),
                redirect_stderr(StringIO()),
            ):
                exit_code = execute(checks, report, report_path)
            persisted = json.loads(report_path.read_text(encoding="utf-8"))

        self.assertEqual(130, exit_code)
        terminate.assert_called_once_with(process)
        self.assertEqual("interrupted", persisted["checks"][0]["status"])
        self.assertEqual("interrupted", persisted["status"])
        self.assertEqual("not_run", persisted["checks"][1]["status"])


class IterationCliTests(unittest.TestCase):
    def run_cli(self, root: Path, *args: str) -> int:
        checks = [
            CheckSpec("restore", "harness", (sys.executable, "-c", "exit(0)")),
            CheckSpec("build", "harness", (sys.executable, "-c", "exit(0); # build"), depends_on=("restore",)),
            CheckSpec("test", "harness", (sys.executable, "-c", "exit(0); # test"), depends_on=("build",)),
            CheckSpec("unrelated", "harness", (sys.executable, "-c", "exit(9)")),
        ]
        with (
            patch("scripts.harness.verify_change.ROOT", root),
            patch("scripts.harness.verify_change.checks_for", return_value=checks),
            patch("scripts.harness.verify_change.collect_git_context", return_value=GitContext("head", "tree", "base", "base", "branch", False)),
            patch("scripts.harness.verify_change.collect_tool_versions", return_value={}),
            patch.object(sys, "argv", ["verify_change.py", "--profile", "full", "--area", "harness", *args]),
            redirect_stdout(StringIO()), redirect_stderr(StringIO()),
        ):
            return main()

    def test_iteration_runs_prerequisites_and_preserves_final_report(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            final = root / ".artifacts/verification/report.json"
            final.parent.mkdir(parents=True)
            final.write_text("existing final evidence")
            with patch.dict(os.environ, {}, clear=True):
                self.assertEqual(0, self.run_cli(root, "--check", "test", "--check", "build"))
            report = json.loads((final.parent / "iteration.json").read_text())
            self.assertEqual("existing final evidence", final.read_text())
        self.assertEqual("partial", report["status"])
        self.assertEqual("iteration", report["verification_mode"])
        self.assertEqual(["restore", "build", "test"], [c["id"] for c in report["checks"]])
        self.assertIn("unrelated", report["required_check_ids"])

    def test_unknown_check_and_ci_iteration_are_rejected_before_execution(self) -> None:
        for env, args in (({}, ("--check", "missing")), ({"GITHUB_ACTIONS": "true"}, ("--check", "test"))):
            with self.subTest(env=env), tempfile.TemporaryDirectory() as directory:
                with patch.dict(os.environ, env, clear=True), patch("scripts.harness.verify_change.execute") as execute_mock:
                    self.assertEqual(2, self.run_cli(Path(directory), *args))
                execute_mock.assert_not_called()

    def test_final_mode_still_runs_all_checks_and_fails(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.dict(os.environ, {}, clear=True):
                self.assertEqual(1, self.run_cli(root))
            report = json.loads((root / ".artifacts/verification/report.json").read_text())
        self.assertEqual("final", report["verification_mode"])
        self.assertEqual("failed", report["status"])
        self.assertEqual(4, len(report["checks"]))

    def test_iteration_failure_is_nonzero_and_manual_confirmation_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.dict(os.environ, {}, clear=True):
                self.assertEqual(1, self.run_cli(root, "--check", "unrelated"))
                self.assertEqual(2, self.run_cli(root, "--check", "test", "--confirm-manual", "manual.device"))
            report = json.loads((root / ".artifacts/verification/iteration.json").read_text())
        self.assertEqual("failed", report["status"])


class GitStatusParsingTests(unittest.TestCase):
    def test_parses_supported_statuses_and_both_rename_copy_paths(self) -> None:
        changes = parse_name_status(
            b"A\0added\0C91\0copy-old\0copy-new\0D\0deleted\0"
            b"M\0modified\0R100\0rename-old\0rename-new\0T\0type-changed\0",
            source="test",
        )

        self.assertEqual(
            ["A", "C91", "D", "M", "R100", "T"],
            [change.status for change in changes],
        )
        self.assertEqual(("copy-old", "copy-new"), changes[1].paths)
        self.assertEqual(("rename-old", "rename-new"), changes[4].paths)


class EvidenceTests(unittest.TestCase):
    def test_custom_task_command_is_not_executed_as_a_version_probe(self) -> None:
        check = CheckSpec("task.custom", "harness", ("custom-smoke-command",))
        completed = subprocess.CompletedProcess(
            args=(), returncode=0, stdout="tool 1.0\n", stderr=""
        )
        with patch(
            "scripts.harness.verify_change.subprocess.run", return_value=completed
        ) as run:
            collect_tool_versions([check])

        probed = [call.args[0][0] for call in run.call_args_list]
        self.assertNotIn("custom-smoke-command", probed)

    def test_clean_local_plan_reports_no_changed_paths(self) -> None:
        with redirect_stdout(StringIO()) as output:
            print_plan([], analyze_paths([]), [], profile="local")

        self.assertIn("(no changed paths)", output.getvalue())
        self.assertNotIn("full profile", output.getvalue())

    def test_full_plan_does_not_claim_that_diff_was_inspected(self) -> None:
        with redirect_stdout(StringIO()) as output:
            print_plan([], analyze_paths([], full=True), [], profile="full")

        self.assertIn("(not inspected for full profile)", output.getvalue())

    def test_unconfirmed_manual_check_keeps_report_incomplete(self) -> None:
        report = {
            "status": "running",
            "checks": [],
            "manual_checks": [
                {"id": "manual.device", "status": "not_confirmed"}
            ],
        }

        with tempfile.TemporaryDirectory() as directory:
            report_path = Path(directory) / "report.json"
            with redirect_stdout(StringIO()), redirect_stderr(StringIO()):
                exit_code = execute([], report, report_path)

        self.assertEqual(1, exit_code)
        self.assertEqual("manual_required", report["status"])

    def test_successful_iteration_never_confirms_manual_checks(self) -> None:
        report = {
            "verification_mode": "iteration",
            "checks": [],
            "manual_checks": [{"id": "manual.device", "status": "not_confirmed"}],
        }
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(0, execute([], report, Path(directory) / "iteration.json"))
        self.assertEqual("partial", report["status"])
        self.assertEqual("not_confirmed", report["manual_checks"][0]["status"])

    def test_github_metadata_uses_strict_allowlist(self) -> None:
        with patch.dict(
            os.environ,
            {
                "GITHUB_JOB": "harness",
                "GITHUB_TOKEN": "must-not-leak",
                "UNRELATED_SECRET": "must-not-leak",
            },
            clear=True,
        ):
            metadata = github_environment()

        self.assertEqual({"GITHUB_JOB": "harness"}, metadata)

    def test_github_summary_contains_status_checks_and_durations(self) -> None:
        report = {
            "status": "passed",
            "git": {"head_sha": "abc123"},
            "checks": [
                {
                    "id": "harness.unit",
                    "area": "harness",
                    "status": "passed",
                    "duration_seconds": 1.25,
                }
            ],
        }

        with tempfile.TemporaryDirectory() as directory:
            summary_path = Path(directory) / "summary.md"
            with patch.dict(
                os.environ, {"GITHUB_STEP_SUMMARY": str(summary_path)}, clear=True
            ):
                write_github_summary(report)
            summary = summary_path.read_text(encoding="utf-8")

        self.assertIn("**Status:** `passed`", summary)
        self.assertIn("`harness.unit`", summary)
        self.assertIn("1.250s", summary)


if __name__ == "__main__":
    unittest.main()
