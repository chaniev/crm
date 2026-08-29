"""Map changed repository paths to required CRM verification areas."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import PurePosixPath


ALL_AREAS = (
    "requirements",
    "harness",
    "backend",
    "frontend",
    "bot",
    "deploy",
)

SCOPED_AGENT_AREAS = {
    "backend/AGENTS.md": ("backend",),
    "frontend/AGENTS.md": ("frontend",),
    "bot/AGENTS.md": ("bot",),
    "deploy/AGENTS.md": ("deploy",),
    "backlog/AGENTS.md": (),
}

SCOPED_SKILL_AREAS = {
    ".agents/skills/codex-backlog-skill/": (),
    ".agents/skills/tasks-ready-to-implementation/": (),
    ".agents/skills/csharp-xunit/": ("backend",),
    ".agents/skills/crm-mobile-first-ui/": ("frontend",),
    ".agents/skills/design-first-ui-prompting/": ("frontend",),
    ".agents/skills/react-best-practices/": ("frontend",),
    ".agents/skills/web-design-guidelines/": ("frontend",),
}

CROSS_CUTTING_SKILL_PREFIXES = (
    ".agents/skills/deploy-project/",
    ".agents/skills/implement-release-plan/",
    ".agents/skills/task-worktree/",
)

STAFF_APPLICATION_CONTRACT_PREFIXES = (
    "backend/src/GymCrm.Application/Authorization/",
    "backend/src/GymCrm.Application/Messenger/",
    "backend/src/GymCrm.Application/Reports/",
)


@dataclass
class ChangeImpact:
    areas: set[str] = field(default_factory=set)
    reasons: dict[str, list[str]] = field(default_factory=dict)

    def add(self, area: str, reason: str) -> None:
        self.areas.add(area)
        area_reasons = self.reasons.setdefault(area, [])
        if reason not in area_reasons:
            area_reasons.append(reason)

    def add_full_baseline(self, reason: str) -> None:
        for area in ALL_AREAS:
            self.add(area, reason)


def _normalize(path: str) -> str:
    normalized = PurePosixPath(path.replace("\\", "/")).as_posix()
    return normalized.removeprefix("./")


def _is_dockerfile(path: str) -> bool:
    return PurePosixPath(path).name == "Dockerfile"


def _is_staff_api_boundary(path: str) -> bool:
    name = PurePosixPath(path).name
    if path.startswith("backend/src/GymCrm.Api/"):
        return name.endswith(("Request.cs", "Response.cs", "Endpoints.cs")) or any(
            marker in name
            for marker in ("Contracts", "ProblemDetails", "ValidationProblems")
        )
    return path.startswith(STAFF_APPLICATION_CONTRACT_PREFIXES) and name.endswith(
        "Contracts.cs"
    )


def _is_internal_bot_api_boundary(path: str) -> bool:
    return path.startswith("backend/src/GymCrm.Application/Bot/") or path.startswith(
        "backend/src/GymCrm.Api/Auth/BotInternal"
    )


def _add_scoped_infrastructure(
    impact: ChangeImpact, path: str, areas: tuple[str, ...]
) -> None:
    for area in areas:
        impact.add(area, f"scoped agent infrastructure changed: {path}")


def analyze_paths(paths: list[str], *, full: bool = False) -> ChangeImpact:
    """Return the verification areas required for the supplied repository paths."""

    impact = ChangeImpact()
    if full:
        impact.add_full_baseline("full profile requested")
        return impact

    impact.add("requirements", "repository traceability is validated for every change")

    for raw_path in paths:
        path = _normalize(raw_path)

        if path == "AGENTS.md":
            impact.add_full_baseline(f"root agent instructions changed: {path}")
            continue

        if path in SCOPED_AGENT_AREAS:
            _add_scoped_infrastructure(impact, path, SCOPED_AGENT_AREAS[path])
            continue

        if path.startswith(CROSS_CUTTING_SKILL_PREFIXES):
            impact.add_full_baseline(f"cross-cutting skill changed: {path}")
            continue

        matched_skill = next(
            (prefix for prefix in SCOPED_SKILL_AREAS if path.startswith(prefix)),
            None,
        )
        if matched_skill is not None:
            _add_scoped_infrastructure(impact, path, SCOPED_SKILL_AREAS[matched_skill])
            continue

        if path.startswith("scripts/harness/tests/"):
            impact.add("harness", f"verification harness tests changed: {path}")
            continue

        if path.startswith("scripts/harness/"):
            impact.add_full_baseline(f"verification harness changed: {path}")
            continue

        if path == "scripts/validate_requirements.py":
            impact.add("requirements", f"requirements validator changed: {path}")
            continue

        if path.startswith("backend/") or path == "global.json":
            impact.add("backend", f"backend-owned path changed: {path}")
            if _is_internal_bot_api_boundary(path):
                impact.add("bot", f"Internal Bot API boundary changed: {path}")
            elif _is_staff_api_boundary(path):
                impact.add("frontend", f"Staff API boundary changed: {path}")
            if _is_dockerfile(path):
                impact.add("deploy", f"service image contract changed: {path}")
            continue

        if path.startswith("frontend/"):
            impact.add("frontend", f"frontend-owned path changed: {path}")
            if _is_dockerfile(path):
                impact.add("deploy", f"service image contract changed: {path}")
            continue

        if path.startswith("bot/"):
            impact.add("bot", f"bot-owned path changed: {path}")
            if _is_dockerfile(path):
                impact.add("deploy", f"service image contract changed: {path}")
            continue

        if path.startswith("deploy/"):
            impact.add("deploy", f"deployment contract changed: {path}")
            continue

        if path.startswith("docs/") or path.startswith("backlog/"):
            impact.add("requirements", f"repository knowledge changed: {path}")
            continue

        if path == ".gitignore" or path.endswith("/README.md"):
            impact.add("requirements", f"repository metadata changed: {path}")
            continue

        if (
            path.endswith("/AGENTS.md")
            or path.startswith(".agents/")
            or path.startswith(".github/")
            or path.startswith("scripts/")
        ):
            impact.add_full_baseline(f"cross-cutting infrastructure changed: {path}")
            continue

        impact.add_full_baseline(f"unclassified path uses safe full fallback: {path}")

    return impact
