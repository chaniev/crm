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

    def test_scoped_agent_file_selects_owning_layer(self) -> None:
        self.assert_areas(
            ["frontend/AGENTS.md"],
            {"requirements", "frontend"},
        )

    def test_backlog_agent_file_selects_requirements(self) -> None:
        self.assert_areas(
            ["backlog/AGENTS.md"],
            {"requirements"},
        )

    def test_scoped_frontend_skill_selects_frontend(self) -> None:
        self.assert_areas(
            [".agents/skills/react-best-practices/SKILL.md"],
            {"requirements", "frontend"},
        )

    def test_cross_cutting_skill_keeps_full_baseline(self) -> None:
        self.assert_areas(
            [".agents/skills/task-worktree/SKILL.md"],
            set(ALL_AREAS),
        )

    def test_architecture_decision_skill_keeps_full_baseline(self) -> None:
        self.assert_areas(
            [".agents/skills/architecture-decision/SKILL.md"],
            set(ALL_AREAS),
        )

    def test_root_agent_file_keeps_full_baseline(self) -> None:
        self.assert_areas(["AGENTS.md"], set(ALL_AREAS))

    def test_documentation_only_change_stays_lightweight(self) -> None:
        self.assert_areas(["docs/HARNESS.md"], {"requirements"})

    def test_unknown_infrastructure_change_falls_back_to_full_baseline(self) -> None:
        self.assert_areas([".github/workflows/quality.yml"], set(ALL_AREAS))

    def test_full_profile_uses_every_area(self) -> None:
        impact = analyze_paths([], full=True)
        self.assertEqual(set(ALL_AREAS), impact.areas)


if __name__ == "__main__":
    unittest.main()
