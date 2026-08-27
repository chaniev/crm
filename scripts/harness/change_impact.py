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
    if not path.startswith("backend/src/GymCrm.Api/"):
        return False
    name = PurePosixPath(path).name
    return name.endswith(("Request.cs", "Response.cs", "Endpoints.cs")) or any(
        marker in name for marker in ("Contracts", "ProblemDetails", "ValidationProblems")
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

        if path.startswith("scripts/harness/"):
            impact.add("harness", f"verification harness changed: {path}")
            continue

        if path == "scripts/validate_requirements.py":
            impact.add("requirements", f"requirements validator changed: {path}")
            continue

        if path.startswith("backend/") or path == "global.json":
            impact.add("backend", f"backend-owned path changed: {path}")
            if path.startswith("backend/src/GymCrm.Application/Bot/") or (
                path.startswith("backend/src/GymCrm.Api/Auth/BotInternal")
            ):
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
            path == "AGENTS.md"
            or path.endswith("/AGENTS.md")
            or path.startswith(".agents/")
            or path.startswith(".github/")
            or path.startswith("scripts/")
        ):
            impact.add_full_baseline(f"cross-cutting infrastructure changed: {path}")
            continue

        impact.add_full_baseline(f"unclassified path uses safe full fallback: {path}")

    return impact
