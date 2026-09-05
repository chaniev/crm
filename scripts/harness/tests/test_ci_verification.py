from __future__ import annotations

import json
import os
import shutil
import sys
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.harness.ci_verification import resolve_arguments, run, setup_outputs, STATE
from scripts.harness.task_contract import ContractError


class CiVerificationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.git("init")
        self.git("config", "user.email", "test@example.invalid")
        self.git("config", "user.name", "Harness test")
        self.write("README.md", "# Repository\n")
        self.git("add", ".")
        self.git("commit", "-m", "base")
        self.base = self.git("rev-parse", "HEAD")

    def git(self, *args: str) -> str:
        return subprocess.check_output(
            ("git", *args), cwd=self.root, stderr=subprocess.DEVNULL, text=True
        ).strip()

    def write(self, path: str, text: str = "test") -> None:
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)

    def pull_request(self, branch: str = "docs/update") -> dict:
        return {"pull_request": {"base": {"sha": self.base}, "head": {"ref": branch}}}

    def test_documentation_pr_does_not_require_artificial_task_contract(self) -> None:
        self.write("docs/HARNESS.md")
        self.assertEqual(
            ["--base", self.base],
            resolve_arguments(self.pull_request(), "pull_request", root=self.root),
        )

    def test_harness_validator_pr_is_lightweight(self) -> None:
        self.write("scripts/harness/validate_plan_readiness.py")
        self.assertEqual(
            ["--base", self.base],
            resolve_arguments(self.pull_request(), "pull_request", root=self.root),
        )

    def test_application_pr_keeps_required_task_identity_and_contract(self) -> None:
        self.write("frontend/src/App.tsx")
        with self.assertRaisesRegex(ValueError, "TASK-NNN"):
            resolve_arguments(self.pull_request(), "pull_request", root=self.root)
        with self.assertRaisesRegex(ContractError, "no verification contract"):
            resolve_arguments(
                self.pull_request("fix/TASK-999-example"),
                "pull_request",
                root=self.root,
            )

    def test_existing_contract_is_preserved_even_for_documentation(self) -> None:
        self.write("backlog/implementation/TASK-999-verification-contract.json", "{}")
        self.assertEqual(
            [
                "--base",
                self.base,
                "--task-id",
                "TASK-999",
                "--source-ref",
                "fix/TASK-999-example",
            ],
            resolve_arguments(
                self.pull_request("fix/TASK-999-example"),
                "pull_request",
                root=self.root,
            ),
        )

    def test_ambiguous_task_and_contract_are_not_silently_ignored(self) -> None:
        with self.assertRaisesRegex(ValueError, "ambiguous"):
            resolve_arguments(
                self.pull_request("fix/TASK-999-TASK-998"),
                "pull_request",
                root=self.root,
            )
        self.write("backlog/implementation/TASK-999-a-verification-contract.json", "{}")
        self.write("backlog/implementation/TASK-999-b-verification-contract.json", "{}")
        with self.assertRaisesRegex(ContractError, "multiple verification contracts"):
            resolve_arguments(
                self.pull_request("fix/TASK-999-example"),
                "pull_request",
                root=self.root,
            )

    def test_removing_contract_cannot_convert_pr_to_lightweight(self) -> None:
        path = "backlog/implementation/TASK-999-verification-contract.json"
        self.write(path, "{}")
        self.git("add", ".")
        self.git("commit", "-m", "contract")
        self.base = self.git("rev-parse", "HEAD")
        (self.root / path).unlink()
        for branch in ("fix/TASK-999-example", "docs/update"):
            with (
                self.subTest(branch=branch),
                self.assertRaises((ContractError, ValueError)),
            ):
                resolve_arguments(
                    self.pull_request(branch), "pull_request", root=self.root
                )

    def test_push_uses_event_before_not_origin_main_at_head(self) -> None:
        self.assertEqual(
            ["--base", self.base],
            resolve_arguments({"before": self.base}, "push", root=self.root),
        )

    def test_missing_push_history_falls_back_to_full(self) -> None:
        for before in ("0" * 40, "a" * 40, ""):
            with self.subTest(before=before):
                self.assertEqual(
                    ["--profile", "full", "--base", "HEAD"],
                    resolve_arguments({"before": before}, "push", root=self.root),
                )

    def test_documentation_setup_does_not_install_sdks(self) -> None:
        outputs = setup_outputs(
            {
                "selected_areas": ["requirements"],
                "checks": [{"command": ["python3", "validator.py"]}],
            }
        )
        self.assertEqual(
            {"backend": "false", "frontend": "false", "bot": "false", "task_id": ""},
            outputs,
        )

    def test_contract_additions_select_their_runtime(self) -> None:
        outputs = setup_outputs(
            {
                "selected_areas": ["requirements", "frontend"],
                "task_id": "TASK-999",
                "checks": [{"command": ["dotnet", "--version"]}],
            }
        )
        self.assertEqual("true", outputs["frontend"])
        self.assertEqual("true", outputs["backend"])
        self.assertEqual("TASK-999", outputs["task_id"])

    def test_run_recomputes_one_baseline_instead_of_executing_cached_checks(
        self,
    ) -> None:
        self.write(
            str(STATE),
            json.dumps({"arguments": ["--base", self.base], "head_sha": self.base}),
        )
        with (
            patch(
                "scripts.harness.ci_verification.subprocess.check_output",
                return_value=self.base,
            ),
            patch("scripts.harness.ci_verification.subprocess.run") as execution,
        ):
            execution.return_value.returncode = 0
            self.assertEqual(0, run(root=self.root))
            execution.assert_called_once()
            command = execution.call_args.args[0]
            self.assertIn("scripts/harness/verify_change.py", command)
            self.assertNotIn("--profile", command)
            self.assertNotIn("--dry-run", command)

    def test_real_ci_preparation_for_docs_selects_no_application_setup(self) -> None:
        repository = Path(__file__).resolve().parents[3]
        destination = self.root / "scripts/harness"
        destination.mkdir(parents=True)
        for script in (repository / "scripts/harness").glob("*.py"):
            shutil.copy2(script, destination / script.name)
        shutil.copy2(
            repository / "scripts/validate_requirements.py",
            self.root / "scripts/validate_requirements.py",
        )
        self.write(".gitignore", ".artifacts/\n")
        self.git("add", ".")
        self.git("commit", "-m", "harness fixture")
        self.base = self.git("rev-parse", "HEAD")
        self.write("docs/HARNESS.md", "# Documentation change\n")
        self.write(".artifacts/event.json", json.dumps(self.pull_request()))
        environment = dict(os.environ)
        environment.pop("GITHUB_STEP_SUMMARY", None)
        environment.update(
            {
                "GITHUB_EVENT_NAME": "pull_request",
                "GITHUB_EVENT_PATH": str(self.root / ".artifacts/event.json"),
                "GITHUB_OUTPUT": str(self.root / ".artifacts/outputs"),
            }
        )
        result = subprocess.run(
            [sys.executable, "scripts/harness/ci_verification.py", "prepare"],
            cwd=self.root,
            env=environment,
            capture_output=True,
            text=True,
        )
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)
        plan = json.loads((self.root / ".artifacts/ci/plan.json").read_text())
        self.assertEqual(["requirements"], plan["selected_areas"])
        self.assertEqual("dry_run", plan["status"])
        self.assertEqual(
            "backend=false\nfrontend=false\nbot=false\ntask_id=\n",
            (self.root / ".artifacts/outputs").read_text(),
        )
        self.assertFalse(
            (self.root / ".artifacts/verification/verification.json").exists()
        )

    def test_changed_checkout_cannot_reuse_setup_plan(self) -> None:
        self.write(
            str(STATE),
            json.dumps({"arguments": ["--base", self.base], "head_sha": "a" * 40}),
        )
        with self.assertRaisesRegex(ValueError, "checkout changed"):
            run(root=self.root)


if __name__ == "__main__":
    unittest.main()
