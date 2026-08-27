from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from io import StringIO
from pathlib import Path

from scripts.harness.commands import CheckSpec
from scripts.harness.verify_change import changed_paths, execute


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

    def test_failed_check_returns_nonzero_and_marks_remaining_not_run(self) -> None:
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
        self.assertEqual("not_run", report["checks"][1]["status"])


if __name__ == "__main__":
    unittest.main()
