from __future__ import annotations

from contextlib import redirect_stderr, redirect_stdout
from io import StringIO
from unittest.mock import patch
import tempfile
import unittest
from pathlib import Path

from scripts.harness import validate_plan_readiness as validator
from scripts.harness.validate_plan_readiness import validate_plan, validate_repository


class PlanReadinessTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.write('backlog/implementation/TASK-999-example.md', '# Task\n')
        self.write('docs/approval.md', 'User approved the exact preservation of existing behavior.')
        self.plan = self.write('backlog/implementation-plans/TASK-999-example.plan.md', '''# Plan
## Metadata
- source_task: /backlog/implementation/TASK-999-example.md
- branch: fix/TASK-999-example
- readiness: yes
- requirements: none — Only changes the development workflow.
- product_decisions: none — Existing product behavior is preserved.
- technical_decisions: accepted
- architecture_decisions: none — Local validation follows the existing harness.
- open_questions: none
## Decisions and contracts
Use the canonical requirements checks for the readiness gate.
## Decision evidence
- technical: [Approval](/docs/approval.md) — owner: user; decision: canonical readiness gate.
''')

    def write(self, name: str, text: str) -> Path:
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding='utf-8')
        return path

    def replace(self, old: str, new: str) -> None:
        self.plan.write_text(self.plan.read_text().replace(old, new))

    def errors(self) -> str:
        return '\n'.join(validate_plan(self.plan, root=self.root, executable=True))

    def test_accepted_plan_passes_repository_and_execution(self) -> None:
        self.assertEqual([], validate_repository(self.root))
        self.assertEqual('', self.errors())

    def test_missing_duplicate_or_pending_metadata_fails_closed(self) -> None:
        original = self.plan.read_text()
        for replacement in ('', '- technical_decisions: pending',
                            '- technical_decisions: accepted\n- technical_decisions: accepted'):
            with self.subTest(replacement=replacement):
                self.plan.write_text(original.replace('- technical_decisions: accepted', replacement))
                self.assertIn('technical_decisions', self.errors())

    def test_duplicate_metadata_sections_cannot_hide_conflicting_readiness(self) -> None:
        self.plan.write_text(self.plan.read_text() + '\n## Metadata\n- readiness: no — approval required\n')
        self.assertIn('readiness must be', self.errors())

    def test_unresolved_question_blocks_ready_plan(self) -> None:
        self.replace('- open_questions: none', '- open_questions: choose persistence during implementation')
        self.assertIn('open_questions', self.errors())

    def test_draft_is_preserved_but_never_executable(self) -> None:
        self.replace('- readiness: yes', '- readiness: no — waiting for architecture review')
        self.assertIn('non-ready task must leave implementation', self.errors())
        task = self.root / 'backlog/implementation/TASK-999-example.md'
        self.write('backlog/risky/TASK-999-example.md', task.read_text())
        task.unlink()
        self.replace('/backlog/implementation/', '/backlog/risky/')
        self.assertEqual([], validate_repository(self.root))
        self.assertIn('not executable', self.errors())

    def test_missing_or_escaped_evidence_is_rejected(self) -> None:
        for target in ('docs/missing.md', '../outside.md'):
            with self.subTest(target=target):
                original = self.plan.read_text()
                self.replace('/docs/approval.md', target)
                self.assertIn('evidence does not exist', self.errors())
                self.plan.write_text(original)

    def test_accepted_requirements_are_required(self) -> None:
        self.replace('none — Only changes the development workflow.', 'REQ-NFR-999 (implements)')
        self.assertIn('REQ-NFR-999', self.errors())
        card = self.write('docs/requirements/99-test.md', '### REQ-NFR-999. Example\n**Решение:** предложено\n')
        self.assertIn('REQ-NFR-999', self.errors())
        card.write_text(card.read_text().replace('предложено', 'принято'))
        self.assertEqual('', self.errors())

    def test_adrs_must_be_accepted_not_merely_linked(self) -> None:
        self.replace('none — Local validation follows the existing harness.', 'ADR-0001')
        self.assertIn('ADR-0001', self.errors())
        adr = self.write('docs/architecture/adr/0001-test.md', '- **Статус:** Proposed\n')
        for status in ('Proposed', 'Deprecated', 'Superseded by ADR-0002'):
            adr.write_text(f'- **Статус:** {status}\n')
            self.assertIn('Accepted approval', self.errors())
        adr.write_text('- **Статус:** Accepted (Owner, Product owner, 2026-09-05)\n')
        self.assertEqual('', self.errors())

    def test_undeclared_linked_adr_cannot_bypass_gate(self) -> None:
        self.replace('Use the canonical', '[Decision](/docs/architecture/adr/0001-test.md)\nUse the canonical')
        self.assertIn('all referenced ADRs', self.errors())
        self.assertIn('Accepted approval', self.errors())

    def test_missing_or_duplicate_plan_blocks_implementation(self) -> None:
        self.write('backlog/implementation-plans/TASK-999-duplicate.plan.md', self.plan.read_text())
        self.assertIn('exactly one', '\n'.join(validate_repository(self.root)))
        self.plan.unlink()
        (self.root / 'backlog/implementation-plans/TASK-999-duplicate.plan.md').unlink()
        self.assertIn('exactly one', '\n'.join(validate_repository(self.root)))

    def test_evidence_requires_owner_and_exact_decision(self) -> None:
        self.replace(' — owner: user; decision: canonical readiness gate.', '')
        self.assertIn('approval source, owner and exact decision', self.errors())

    def test_ready_plan_cannot_reference_risky_task(self) -> None:
        self.write('backlog/risky/TASK-999-example.md', '# Risky task')
        self.replace('/backlog/implementation/', '/backlog/risky/')
        self.assertIn('not risky or needs-clarification', self.errors())

    def test_cli_blocks_draft_and_accepts_absolute_ready_plan(self) -> None:
        with patch.object(validator, 'ROOT', self.root.resolve()), \
             patch('sys.argv', ['validate', '--plan', str(self.plan.resolve())]), \
             redirect_stderr(StringIO()), redirect_stdout(StringIO()):
            self.assertEqual(0, validator.main())
            self.replace('- readiness: yes', '- readiness: no — review required')
            self.assertEqual(1, validator.main())

    def test_done_plans_are_historical(self) -> None:
        self.write('backlog/done/2026-09-01/TASK-998-old.plan.md', '# Legacy plan\n')
        self.assertEqual([], validate_repository(self.root))


if __name__ == '__main__':
    unittest.main()
