from __future__ import annotations

import unittest

from scripts.harness.commands import checks_for


class CommandMatrixTests(unittest.TestCase):
    def test_backend_preserves_complete_ci_baseline(self) -> None:
        checks = checks_for({"backend"})
        self.assertEqual(
            [
                "backend.restore",
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
            ["frontend.install", "frontend.audit", "frontend.check"],
            [check.identifier for check in checks],
        )

    def test_requirements_base_is_forwarded_to_validator(self) -> None:
        [check] = checks_for({"requirements"}, base="base-sha")
        self.assertEqual(
            ("python3", "scripts/validate_requirements.py", "--base", "base-sha"),
            check.command,
        )


if __name__ == "__main__":
    unittest.main()
