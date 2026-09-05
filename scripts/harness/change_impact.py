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

# Only descriptive paths are exempt; arbitrary Markdown in runtime resources
# and executable skill files retain their owning area or the safe fallback.
DOCUMENT_NAMES = {"README.md", "README.rst", "README.txt", "AGENTS.md"}
ROOT_DOCUMENTS = {
    "README.md",
    "README.rst",
    "README.txt",
    "AGENTS.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "CODE_OF_CONDUCT.md",
    "LICENSE",
    "LICENSE.md",
}
LAYER_DOCUMENTS = {"frontend/DESIGN.md", "deploy/SERVER_INSTALL.md"}
KNOWLEDGE_HARNESS_MODULES = {
    "scripts/validate_requirements.py",
    "scripts/harness/change_impact.py",
    "scripts/harness/ci_verification.py",
    "scripts/harness/validate_agent_instructions.py",
    "scripts/harness/validate_architecture_decisions.py",
    "scripts/harness/validate_plan_readiness.py",
}

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


def _is_documentation(path: str) -> bool:
    parts = PurePosixPath(path)
    if path in ROOT_DOCUMENTS or path in LAYER_DOCUMENTS:
        return True
    if (
        len(parts.parts) == 2
        and parts.parts[0] in {"backend", "frontend", "bot", "deploy"}
        and parts.suffix == ".md"
    ):
        return True
    if parts.name in DOCUMENT_NAMES:
        return True
    if path.startswith(("docs/", "backlog/")):
        return True
    if path.startswith(".agents/skills/") and parts.suffix == ".md":
        return True
    if path.startswith(".github/") and parts.suffix == ".md":
        return True
    return path.startswith(
        ("backend/docs/", "frontend/docs/", "bot/docs/", "deploy/docs/")
    )


def analyze_paths(paths: list[str], *, full: bool = False) -> ChangeImpact:
    """Return the verification areas required for the supplied repository paths."""

    impact = ChangeImpact()
    if full:
        impact.add_full_baseline("full profile requested")
        return impact

    impact.add("requirements", "repository traceability is validated for every change")

    for raw_path in paths:
        path = _normalize(raw_path)

        if _is_documentation(path):
            impact.add("requirements", f"documentation or instructions changed: {path}")
            continue

        if path in KNOWLEDGE_HARNESS_MODULES or path.startswith(
            "scripts/harness/tests/"
        ):
            impact.add(
                "harness",
                f"selector, knowledge validator or harness tests changed: {path}",
            )
            continue

        if path.startswith("scripts/harness/config/user-facing-text"):
            for area in ("harness", "backend", "frontend", "bot"):
                impact.add(area, f"shared user-facing text guard data changed: {path}")
            continue

        if path.startswith("scripts/harness/"):
            impact.add_full_baseline(
                f"verification execution infrastructure changed: {path}"
            )
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

        if path == ".gitignore":
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
