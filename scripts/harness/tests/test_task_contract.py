from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts.harness.change_impact import analyze_paths
from scripts.harness.commands import CheckSpec, checks_for
from scripts.harness.task_contract import (
    ContractError,
    combine_checks,
    contract_evidence,
    extend_impact,
    load_task_contract,
    manual_check_entries,
    task_checks,
    validate_contract_branch,
)


VALID_CONTRACT = """{
  "version": 1,
  "task_id": "TASK-999",
  "expected_branch": "feature/TASK-999-contract-test",
  "areas": ["harness"],
  "playwright": [
    {
      "id": "frontend.e2e.contract-test",
      "spec": "e2e/contract-test.spec.ts",
      "projects": ["chromium", "iphone-air-webkit"],
      "timeout_seconds": 900
    }
  ],
  "runtime_smoke": [
    {
      "id": "deploy.smoke.contract-test",
      "area": "deploy",
      "working_directory": ".",
      "command": ["python3", "-c", "raise SystemExit(0)"],
      "timeout_seconds": 60
    }
  ],
  "manual_checks": [
    {
      "id": "manual.physical-device",
      "description": "Confirm the flow on a physical target device."
    }
  ]
}
"""


class TaskContractTests(unittest.TestCase):
    def make_contract(self, root: Path, content: str = VALID_CONTRACT) -> Path:
        spec = root / "frontend" / "e2e" / "contract-test.spec.ts"
        spec.parent.mkdir(parents=True)
        spec.write_text("// fixture\n", encoding="utf-8")
        path = root / "TASK-999-verification.json"
        path.write_text(content, encoding="utf-8")
        return path

    def test_loads_contract_and_builds_constrained_checks(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            contract = load_task_contract(self.make_contract(root), root=root)

        self.assertEqual("TASK-999", contract.task_id)
        self.assertEqual({"harness", "frontend", "deploy"}, contract.required_areas)
        checks = task_checks(contract)
        self.assertEqual(
            ["frontend.e2e.contract-test", "deploy.smoke.contract-test"],
            [check.identifier for check in checks],
        )
        self.assertEqual(
            (
                "npm",
                "run",
                "test:e2e",
                "--",
                "e2e/contract-test.spec.ts",
                "--project=chromium",
                "--project=iphone-air-webkit",
            ),
            checks[0].command,
        )
        self.assertEqual("frontend", checks[0].working_directory)
        self.assertEqual(("python3", "-c", "raise SystemExit(0)"), checks[1].command)

    def test_contract_only_extends_diff_selected_baseline(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            contract = load_task_contract(self.make_contract(root), root=root)

        impact = analyze_paths(["backend/src/GymCrm.Domain/Client.cs"])
        extended = extend_impact(impact, contract)

        self.assertTrue({"requirements", "backend"}.issubset(extended.areas))
        self.assertTrue(contract.required_areas.issubset(extended.areas))
        self.assertIn("task contract TASK-999", " ".join(extended.reasons["frontend"]))

    def test_rejects_duplicate_identifier_with_canonical_check(self) -> None:
        canonical = checks_for({"harness"})
        duplicate = CheckSpec("harness.unit", "harness", ("python3", "-V"))

        with self.assertRaisesRegex(ContractError, "duplicate check identifier"):
            combine_checks(canonical, [duplicate])

    def test_rejects_duplicate_command_even_with_another_identifier(self) -> None:
        first = CheckSpec("harness.smoke.first", "harness", ("python3", "-V"))
        second = CheckSpec("harness.smoke.second", "harness", ("python3", "-V"))

        with self.assertRaisesRegex(ContractError, "duplicate check command"):
            combine_checks([first], [second])

    def test_missing_malformed_and_filename_mismatch_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaisesRegex(ContractError, "does not exist"):
                load_task_contract(root / "TASK-999-missing.json", root=root)

            malformed = root / "TASK-999-broken.json"
            malformed.write_text('{"version": ', encoding="utf-8")
            with self.assertRaisesRegex(ContractError, "invalid JSON"):
                load_task_contract(malformed, root=root)

            mismatch = root / "TASK-998-verification.json"
            mismatch.write_text(VALID_CONTRACT, encoding="utf-8")
            with self.assertRaisesRegex(ContractError, "must contain task_id"):
                load_task_contract(mismatch, root=root)

            duplicate = root / "TASK-999-duplicate.json"
            duplicate.write_text(
                '{"version": 1, "version": 1, "task_id": "TASK-999"}',
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ContractError, "duplicate JSON field"):
                load_task_contract(duplicate, root=root)

    def test_rejects_stale_contract_for_another_branch(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            contract = load_task_contract(self.make_contract(root), root=root)

        with self.assertRaisesRegex(ContractError, "expects branch"):
            validate_contract_branch(contract, "main")

    def test_rejects_playwright_path_outside_frontend_e2e(self) -> None:
        content = VALID_CONTRACT.replace(
            '"e2e/contract-test.spec.ts"', '"../package.json"'
        )
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaisesRegex(ContractError, "must stay inside"):
                load_task_contract(self.make_contract(root, content), root=root)

    def test_manual_statuses_and_evidence_are_explicit(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            contract = load_task_contract(self.make_contract(root), root=root)

        self.assertEqual(
            "required", manual_check_entries(contract, set(), dry_run=True)[0]["status"]
        )
        self.assertEqual(
            "not_confirmed",
            manual_check_entries(contract, set(), dry_run=False)[0]["status"],
        )
        self.assertEqual(
            "confirmed",
            manual_check_entries(
                contract, {"manual.physical-device"}, dry_run=False
            )[0]["status"],
        )
        evidence = contract_evidence(
            contract, head_sha="abc", head_tree_sha="tree123"
        )
        self.assertEqual("TASK-999", evidence["task_id"])
        self.assertEqual("abc", evidence["verified_head_sha"])
        self.assertEqual("tree123", evidence["verified_head_tree_sha"])
        self.assertEqual(64, len(evidence["sha256"]))
        self.assertEqual(VALID_CONTRACT, evidence["content"])

        with self.assertRaisesRegex(ContractError, "unknown manual check"):
            manual_check_entries(contract, {"manual.unknown"}, dry_run=False)


if __name__ == "__main__":
    unittest.main()
