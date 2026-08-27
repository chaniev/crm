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


def checks_for(areas: set[str], *, base: str | None = None) -> list[CheckSpec]:
    unknown = areas.difference(ALL_AREAS)
    if unknown:
        raise ValueError(f"unknown verification areas: {', '.join(sorted(unknown))}")

    checks: list[CheckSpec] = []

    if "requirements" in areas:
        command = ["python3", "scripts/validate_requirements.py"]
        if base:
            command.extend(("--base", base))
        checks.append(CheckSpec("requirements.registry", "requirements", tuple(command)))

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
            )
        )

    if "backend" in areas:
        checks.extend(
            (
                CheckSpec(
                    "backend.restore",
                    "backend",
                    ("dotnet", "restore", "backend/GymCrm.slnx"),
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
                ),
            )
        )

    if "frontend" in areas:
        checks.extend(
            (
                CheckSpec("frontend.install", "frontend", ("npm", "ci"), "frontend"),
                CheckSpec(
                    "frontend.audit",
                    "frontend",
                    ("npm", "run", "audit"),
                    "frontend",
                ),
                CheckSpec(
                    "frontend.check",
                    "frontend",
                    ("npm", "run", "check"),
                    "frontend",
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
                ),
                CheckSpec(
                    "bot.lint",
                    "bot",
                    ("uv", "run", "--locked", "--extra", "dev", "ruff", "check", "."),
                    "bot",
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
                ),
                CheckSpec(
                    "bot.types",
                    "bot",
                    ("uv", "run", "--locked", "--extra", "dev", "mypy"),
                    "bot",
                ),
                CheckSpec(
                    "bot.test",
                    "bot",
                    ("uv", "run", "--locked", "--extra", "dev", "pytest"),
                    "bot",
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
                ),
            )
        )

    return checks
