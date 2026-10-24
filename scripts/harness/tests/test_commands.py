from __future__ import annotations

import unittest

from scripts.harness.commands import checks_for


class CommandMatrixTests(unittest.TestCase):
    def test_backend_preserves_complete_ci_baseline(self) -> None:
        checks = checks_for({"backend"})
        self.assertEqual(
            [
                "backend.restore",
                "backend.user-facing-text",
                "backend.format",
                "backend.build",
                "backend.test",
                "backend.audit",
            ],
            [check.identifier for check in checks],
        )

    def test_frontend_preserves_install_audit_and_check(self) -> None:
        checks = checks_for({"frontend"})
        self.assertEqual(
            [
                "frontend.install",
                "frontend.audit",
                "frontend.check",
            ],
            [check.identifier for check in checks],
        )

    def test_prerequisites_preserve_build_and_install_order(self) -> None:
        checks = {c.identifier: c for c in checks_for({"backend", "frontend", "bot"})}
        self.assertEqual(("backend.build",), checks["backend.test"].depends_on)
        for name in ("backend.build", "backend.format", "backend.user-facing-text", "backend.audit"):
            self.assertEqual(("backend.restore",), checks[name].depends_on)
        for name in ("frontend.audit", "frontend.check"):
            self.assertEqual(("frontend.install",), checks[name].depends_on)
        for name in ("bot.lint", "bot.user-facing-text", "bot.format", "bot.types", "bot.test"):
            self.assertEqual(("bot.sync",), checks[name].depends_on)

    def test_bot_runs_user_facing_text_guard_after_locked_sync(self) -> None:
        checks = checks_for({"bot"})
        self.assertEqual("bot.sync", checks[0].identifier)
        self.assertIn("bot.user-facing-text", [check.identifier for check in checks])

    def test_requirements_base_is_forwarded_to_validator(self) -> None:
        checks = checks_for({"requirements"}, base="base-sha")
        check = next(
            item for item in checks if item.identifier == "requirements.registry"
        )
        self.assertEqual(
            ("python3", "scripts/validate_requirements.py", "--base", "base-sha"),
            check.command,
        )

    def test_requirements_validate_agent_instructions_before_registry(self) -> None:
        checks = checks_for({"requirements"})
        self.assertEqual(
            [
                "requirements.agent-instructions",
                "requirements.architecture-decisions",
                "requirements.plan-readiness",
                "requirements.registry",
            ],
            [check.identifier for check in checks],
        )


if __name__ == "__main__":
    unittest.main()
