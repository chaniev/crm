from __future__ import annotations

import unittest

from scripts.harness.change_impact import ALL_AREAS, analyze_paths


class ChangeImpactTests(unittest.TestCase):
    def assert_areas(self, paths: list[str], expected: set[str]) -> None:
        impact = analyze_paths(paths)
        self.assertEqual(expected, impact.areas)
        for area in expected:
            self.assertTrue(impact.reasons[area])

    def test_frontend_change_selects_frontend_and_requirements(self) -> None:
        self.assert_areas(
            ["frontend/src/features/clients/ClientsPage.tsx"],
            {"requirements", "frontend"},
        )

    def test_staff_api_boundary_adds_frontend_consumer(self) -> None:
        self.assert_areas(
            ["backend/src/GymCrm.Api/Auth/ClientDetailsResponse.cs"],
            {"requirements", "backend", "frontend"},
        )

    def test_startup_response_is_also_a_staff_api_boundary(self) -> None:
        self.assert_areas(
            ["backend/src/GymCrm.Api/Startup/AppConfigResponse.cs"],
            {"requirements", "backend", "frontend"},
        )

    def test_application_authorization_contract_adds_frontend_consumer(self) -> None:
        self.assert_areas(
            [
                "backend/src/GymCrm.Application/Authorization/"
                "AdministratorAttendanceGroupGrantContracts.cs"
            ],
            {"requirements", "backend", "frontend"},
        )

    def test_application_messenger_contract_adds_frontend_consumer(self) -> None:
        self.assert_areas(
            ["backend/src/GymCrm.Application/Messenger/ClientMessengerContracts.cs"],
            {"requirements", "backend", "frontend"},
        )

    def test_application_report_contract_adds_frontend_consumer(self) -> None:
        self.assert_areas(
            ["backend/src/GymCrm.Application/Reports/FinancialReportContracts.cs"],
            {"requirements", "backend", "frontend"},
        )

    def test_bot_api_boundary_adds_bot_consumer_only(self) -> None:
        self.assert_areas(
            ["backend/src/GymCrm.Api/Auth/BotInternalEndpoints.cs"],
            {"requirements", "backend", "bot"},
        )

    def test_application_bot_contract_adds_bot_consumer(self) -> None:
        self.assert_areas(
            ["backend/src/GymCrm.Application/Bot/BotApiContracts.cs"],
            {"requirements", "backend", "bot"},
        )

    def test_deploy_change_selects_deploy(self) -> None:
        self.assert_areas(
            ["deploy/docker-compose.yml"],
            {"requirements", "deploy"},
        )

    def test_harness_implementation_change_runs_full_baseline(self) -> None:
        self.assert_areas(
            ["scripts/harness/verify_change.py"],
            set(ALL_AREAS),
        )

    def test_scoped_agent_file_selects_knowledge_checks(self) -> None:
        self.assert_areas(
            ["frontend/AGENTS.md"],
            {"requirements"},
        )

    def test_backlog_agent_file_selects_requirements(self) -> None:
        self.assert_areas(
            ["backlog/AGENTS.md"],
            {"requirements"},
        )

    def test_scoped_frontend_skill_selects_knowledge_checks(self) -> None:
        self.assert_areas(
            [".agents/skills/react-best-practices/SKILL.md"],
            {"requirements"},
        )

    def test_cross_cutting_skill_prose_selects_knowledge_checks(self) -> None:
        self.assert_areas(
            [".agents/skills/task-worktree/SKILL.md"],
            {"requirements"},
        )

    def test_architecture_decision_skill_prose_selects_knowledge_checks(self) -> None:
        self.assert_areas(
            [".agents/skills/architecture-decision/SKILL.md"],
            {"requirements"},
        )

    def test_root_agent_file_selects_knowledge_checks(self) -> None:
        self.assert_areas(["AGENTS.md"], {"requirements"})

    def test_documentation_only_change_stays_lightweight(self) -> None:
        self.assert_areas(["docs/HARNESS.md"], {"requirements"})

    def test_unknown_infrastructure_change_falls_back_to_full_baseline(self) -> None:
        self.assert_areas([".github/workflows/quality.yml"], set(ALL_AREAS))

    def test_documentation_locations_do_not_install_application_dependencies(
        self,
    ) -> None:
        for path in (
            "README.md",
            "CONTRIBUTING.md",
            "CHANGELOG.md",
            "backend/README.md",
            "frontend/DESIGN.md",
            "bot/README.md",
            "backend/TASK-078-membership-write-regressions.diagnostics.md",
            "deploy/SERVER_INSTALL.md",
            "frontend/docs/testing.md",
            ".github/PULL_REQUEST_TEMPLATE.md",
            ".github/ISSUE_TEMPLATE/bug.md",
            ".agents/skills/product-plan-clarification/SKILL.md",
            ".agents/skills/implement-release-plan/references/runtime-release.md",
            "frontend/src/features/AGENTS.md",
            "docs/requirements/01-clients.md",
            "backlog/implementation-plans/TASK-999-example.plan.md",
        ):
            with self.subTest(path=path):
                self.assert_areas([path], {"requirements"})

    def test_knowledge_does_not_mask_code_or_deleted_contracts(self) -> None:
        self.assert_areas(
            [
                "AGENTS.md",
                "docs/HARNESS.md",
                "backend/src/GymCrm.Api/Auth/ClientResponse.cs",
            ],
            {"requirements", "backend", "frontend"},
        )

    def test_markdown_runtime_assets_are_not_treated_as_prose(self) -> None:
        for path, area in (
            ("frontend/public/help.md", "frontend"),
            ("bot/src/gym_crm_bot/resources/message.md", "bot"),
            ("backend/src/GymCrm.Api/Templates/email.md", "backend"),
        ):
            with self.subTest(path=path):
                self.assert_areas([path], {"requirements", area})

    def test_selector_and_knowledge_validators_run_harness_tests(self) -> None:
        for path in (
            "scripts/harness/change_impact.py",
            "scripts/harness/validate_plan_readiness.py",
            "scripts/harness/validate_architecture_decisions.py",
            "scripts/harness/validate_agent_instructions.py",
            "scripts/validate_requirements.py",
            "scripts/harness/ci_verification.py",
        ):
            with self.subTest(path=path):
                self.assert_areas([path], {"requirements", "harness"})

    def test_executable_skill_and_unknown_script_keep_full_fallback(self) -> None:
        for path in (
            ".agents/skills/react-best-practices/scripts/check.py",
            ".agents/skills/new-skill/agents/openai.yaml",
            "scripts/unknown.py",
            "scripts/harness/commands.py",
            "scripts/harness/runtime_stack.py",
        ):
            with self.subTest(path=path):
                self.assert_areas([path], set(ALL_AREAS))

    def test_shared_text_guard_config_checks_consumers_without_deploy(self) -> None:
        self.assert_areas(
            ["scripts/harness/config/user-facing-text-allowlist.json"],
            {"requirements", "harness", "backend", "frontend", "bot"},
        )

    def test_full_profile_uses_every_area(self) -> None:
        impact = analyze_paths([], full=True)
        self.assertEqual(set(ALL_AREAS), impact.areas)


if __name__ == "__main__":
    unittest.main()
