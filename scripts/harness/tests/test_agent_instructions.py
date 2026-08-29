from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts.harness.validate_agent_instructions import (
    MAX_INSTRUCTION_CHAIN_BYTES,
    SCOPED_AGENTS,
    validate_repository,
)


class AgentInstructionValidationTests(unittest.TestCase):
    def create_repository(self, root: Path) -> None:
        routes = "\n".join(f"- `{path}`" for path in SCOPED_AGENTS)
        (root / "AGENTS.md").write_text(
            "# Agent rules\n"
            f"{routes}\n"
            "Use `--task-id` or `--task-contract`; they are mutually exclusive.\n",
            encoding="utf-8",
        )
        for relative in SCOPED_AGENTS:
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("# Scoped rules\n", encoding="utf-8")

    def test_minimal_valid_repository_passes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.create_repository(root)
            self.assertEqual([], validate_repository(root))

    def test_missing_scoped_instruction_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.create_repository(root)
            (root / "frontend/AGENTS.md").unlink()
            errors = validate_repository(root)
            self.assertTrue(any("missing required instruction file" in error for error in errors))

    def test_canonical_command_duplication_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.create_repository(root)
            (root / "backend/AGENTS.md").write_text(
                "Run `dotnet test backend/GymCrm.slnx`.\n", encoding="utf-8"
            )
            errors = validate_repository(root)
            self.assertTrue(any("duplicates canonical dotnet test" in error for error in errors))

    def test_missing_backticked_path_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.create_repository(root)
            (root / "backend/AGENTS.md").write_text(
                "Read `.agents/skills/missing/SKILL.md`.\n", encoding="utf-8"
            )
            errors = validate_repository(root)
            self.assertTrue(any("referenced path does not exist" in error for error in errors))

    def test_instruction_chain_budget_is_enforced(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.create_repository(root)
            (root / "frontend/AGENTS.md").write_text(
                "x" * MAX_INSTRUCTION_CHAIN_BYTES, encoding="utf-8"
            )
            errors = validate_repository(root)
            self.assertTrue(any("instruction chain" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
