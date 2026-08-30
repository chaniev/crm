from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts.harness.validate_architecture_decisions import validate_repository


class ArchitectureDecisionValidationTests(unittest.TestCase):
    def create_repository(self, root: Path) -> Path:
        adr_root = root / "docs/architecture/adr"
        adr_root.mkdir(parents=True)
        (adr_root / "README.md").write_text("# ADR\n\n- ADR-0001\n", encoding="utf-8")
        (adr_root / "_template.md").write_text("# Template\n", encoding="utf-8")
        requirement_root = root / "docs/requirements"
        requirement_root.mkdir(parents=True)
        (requirement_root / "01-clients.md").write_text(
            "### REQ-CLI-001: Client contract\n", encoding="utf-8"
        )
        return adr_root

    def valid_adr(self) -> str:
        headings = (
            "## Связанные требования\n\n- REQ-CLI-001 — constrains",
            "## Контекст",
            "## Критерии выбора",
            "## Рассмотренные варианты",
            "## Решение",
            "## Последствия",
            "## Cross-layer impact",
            "## Migration and rollback",
            "## Validation",
            "## Approval",
        )
        return (
            "# ADR-0001: Client boundary\n\n"
            "- **Статус:** Proposed\n\n"
            + "\n\n".join(headings)
            + "\n"
        )

    def test_valid_proposed_adr_passes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            adr_root = self.create_repository(root)
            (adr_root / "0001-client-boundary.md").write_text(
                self.valid_adr(), encoding="utf-8"
            )
            self.assertEqual([], validate_repository(root))

    def test_unknown_requirement_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            adr_root = self.create_repository(root)
            text = self.valid_adr().replace("REQ-CLI-001", "REQ-CLI-999")
            (adr_root / "0001-client-boundary.md").write_text(text, encoding="utf-8")
            errors = validate_repository(root)
            self.assertTrue(
                any("unknown requirement REQ-CLI-999" in error for error in errors)
            )

    def test_accepted_status_requires_named_owner_role_and_date(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            adr_root = self.create_repository(root)
            text = self.valid_adr().replace(
                "- **Статус:** Proposed", "- **Статус:** Accepted"
            )
            (adr_root / "0001-client-boundary.md").write_text(text, encoding="utf-8")
            errors = validate_repository(root)
            self.assertTrue(any("invalid ADR status" in error for error in errors))

    def test_missing_required_section_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            adr_root = self.create_repository(root)
            text = self.valid_adr().replace("## Validation", "## Evidence")
            (adr_root / "0001-client-boundary.md").write_text(text, encoding="utf-8")
            errors = validate_repository(root)
            self.assertTrue(
                any("missing section ## Validation" in error for error in errors)
            )

    def test_missing_readme_index_entry_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            adr_root = self.create_repository(root)
            (adr_root / "README.md").write_text("# ADR\n", encoding="utf-8")
            (adr_root / "0001-client-boundary.md").write_text(
                self.valid_adr(), encoding="utf-8"
            )
            errors = validate_repository(root)
            self.assertTrue(
                any("missing ADR-0001 from README index" in error for error in errors)
            )


if __name__ == "__main__":
    unittest.main()
