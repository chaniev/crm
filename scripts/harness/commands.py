"""Canonical commands executed by the CRM verification harness."""

from __future__ import annotations

from dataclasses import dataclass

from scripts.harness.change_impact import ALL_AREAS


@dataclass(frozen=True)
class CheckSpec:
    identifier: str
    area: str
    command: tuple[str, ...]
    working_directory: str = "."
    timeout_seconds: float = 300


def checks_for(areas: set[str], *, base: str | None = None) -> list[CheckSpec]:
    unknown = areas.difference(ALL_AREAS)
    if unknown:
        raise ValueError(f"unknown verification areas: {', '.join(sorted(unknown))}")

    checks: list[CheckSpec] = []

    if "requirements" in areas:
        checks.append(
            CheckSpec(
                "requirements.agent-instructions",
                "requirements",
                ("python3", "scripts/harness/validate_agent_instructions.py"),
                timeout_seconds=60,
            )
        )
        checks.append(
            CheckSpec(
                "requirements.architecture-decisions",
                "requirements",
                ("python3", "scripts/harness/validate_architecture_decisions.py"),
                timeout_seconds=60,
            )
        )
        command = ["python3", "scripts/validate_requirements.py"]
        if base:
            command.extend(("--base", base))
        checks.append(
            CheckSpec(
                "requirements.registry",
                "requirements",
                tuple(command),
                timeout_seconds=120,
            )
        )

    if "harness" in areas:
        checks.append(
            CheckSpec(
                "harness.unit",
                "harness",
                (
                    "python3",
                    "-m",
                    "unittest",
                    "discover",
                    "-s",
                    "scripts/harness/tests",
                    "-p",
                    "test_*.py",
                    "-v",
                ),
                timeout_seconds=120,
            )
        )

    if "backend" in areas:
        checks.extend(
            (
                CheckSpec(
                    "backend.restore",
                    "backend",
                    ("dotnet", "restore", "backend/GymCrm.slnx"),
                    timeout_seconds=600,
                ),
                CheckSpec(
                    "backend.format",
                    "backend",
                    (
                        "dotnet",
                        "format",
                        "backend/GymCrm.slnx",
                        "--no-restore",
                        "--verify-no-changes",
                    ),
                    timeout_seconds=600,
                ),
                CheckSpec(
                    "backend.build",
                    "backend",
                    (
                        "dotnet",
                        "build",
                        "backend/GymCrm.slnx",
                        "--configuration",
                        "Release",
                        "--no-restore",
                        "-warnaserror",
                    ),
                    timeout_seconds=900,
                ),
                CheckSpec(
                    "backend.test",
                    "backend",
                    (
                        "dotnet",
                        "test",
                        "backend/GymCrm.slnx",
                        "--configuration",
                        "Release",
                        "--no-build",
                    ),
                    timeout_seconds=3600,
                ),
                CheckSpec(
                    "backend.audit",
                    "backend",
                    (
                        "dotnet",
                        "list",
                        "backend/GymCrm.slnx",
                        "package",
                        "--vulnerable",
                        "--include-transitive",
                    ),
                    timeout_seconds=600,
                ),
            )
        )

    if "frontend" in areas:
        checks.extend(
            (
                CheckSpec(
                    "frontend.install",
                    "frontend",
                    ("npm", "ci"),
                    "frontend",
                    600,
                ),
                CheckSpec(
                    "frontend.audit",
                    "frontend",
                    ("npm", "run", "audit"),
                    "frontend",
                    300,
                ),
                CheckSpec(
                    "frontend.check",
                    "frontend",
                    ("npm", "run", "check"),
                    "frontend",
                    1800,
                ),
            )
        )

    if "bot" in areas:
        checks.extend(
            (
                CheckSpec(
                    "bot.sync",
                    "bot",
                    ("uv", "sync", "--locked", "--extra", "dev"),
                    "bot",
                    600,
                ),
                CheckSpec(
                    "bot.lint",
                    "bot",
                    ("uv", "run", "--locked", "--extra", "dev", "ruff", "check", "."),
                    "bot",
                    300,
                ),
                CheckSpec(
                    "bot.format",
                    "bot",
                    (
                        "uv",
                        "run",
                        "--locked",
                        "--extra",
                        "dev",
                        "ruff",
                        "format",
                        "--check",
                        ".",
                    ),
                    "bot",
                    300,
                ),
                CheckSpec(
                    "bot.types",
                    "bot",
                    ("uv", "run", "--locked", "--extra", "dev", "mypy"),
                    "bot",
                    300,
                ),
                CheckSpec(
                    "bot.test",
                    "bot",
                    ("uv", "run", "--locked", "--extra", "dev", "pytest"),
                    "bot",
                    900,
                ),
            )
        )

    if "deploy" in areas:
        checks.extend(
            (
                CheckSpec(
                    "deploy.compose.local",
                    "deploy",
                    (
                        "docker",
                        "compose",
                        "--project-directory",
                        ".",
                        "--env-file",
                        "deploy/.env.example",
                        "-f",
                        "deploy/docker-compose.yml",
                        "config",
                        "--quiet",
                    ),
                    timeout_seconds=120,
                ),
                CheckSpec(
                    "deploy.compose.server",
                    "deploy",
                    (
                        "docker",
                        "compose",
                        "--project-directory",
                        ".",
                        "--env-file",
                        "deploy/.env.example",
                        "-f",
                        "deploy/docker-compose.server.yml",
                        "config",
                        "--quiet",
                    ),
                    timeout_seconds=120,
                ),
                CheckSpec(
                    "deploy.shell",
                    "deploy",
                    (
                        "bash",
                        "-n",
                        "deploy/build-images.sh",
                        "deploy/export-images.sh",
                        "deploy/load-images.sh",
                        "deploy/lib/images.sh",
                    ),
                    timeout_seconds=120,
                ),
            )
        )

    return checks
