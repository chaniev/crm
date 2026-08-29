#!/usr/bin/env python3
"""Validate repository AGENTS.md routing, references, and command ownership."""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ROOT_AGENT = "AGENTS.md"
SCOPED_AGENTS = (
    "backend/AGENTS.md",
    "frontend/AGENTS.md",
    "bot/AGENTS.md",
    "deploy/AGENTS.md",
    "backlog/AGENTS.md",
)
MAX_INSTRUCTION_CHAIN_BYTES = 24 * 1024
BACKTICK_TOKEN = re.compile(r"`([^`\n]+)`")
FORBIDDEN_COMMANDS = {
    "dotnet restore": re.compile(r"`[^`]*\bdotnet\s+restore\b[^`]*`"),
    "dotnet format": re.compile(r"`[^`]*\bdotnet\s+format\b[^`]*`"),
    "dotnet build": re.compile(r"`[^`]*\bdotnet\s+build\b[^`]*`"),
    "dotnet test": re.compile(r"`[^`]*\bdotnet\s+test\b[^`]*`"),
    "dotnet audit": re.compile(r"`[^`]*\bdotnet\s+list\b[^`]*`"),
    "npm install/check": re.compile(r"`[^`]*\bnpm\s+(?:ci|run)\b[^`]*`"),
    "uv sync/run": re.compile(r"`[^`]*\buv\s+(?:sync|run)\b[^`]*`"),
    "compose config": re.compile(r"`[^`]*\bdocker\s+compose\b[^`]*\bconfig\b[^`]*`"),
    "shell syntax": re.compile(r"`[^`]*\bbash\s+-n\b[^`]*`"),
}


def _instruction_files(root: Path) -> list[Path]:
    return [root / ROOT_AGENT, *(root / path for path in SCOPED_AGENTS)]


def _looks_like_repository_path(token: str) -> bool:
    if "/" not in token or any(marker in token for marker in ("*", "<", ">", "TASK-NNN", "YYYY")):
        return False
    if any(character.isspace() for character in token):
        return False
    return not token.startswith(("http://", "https://", "origin/"))


def _reference_exists(root: Path, instruction: Path, token: str) -> bool:
    candidates = (root / token, instruction.parent / token)
    return any(candidate.exists() for candidate in candidates)


def validate_repository(root: Path = ROOT) -> list[str]:
    errors: list[str] = []
    files = _instruction_files(root)

    for path in files:
        if not path.is_file():
            errors.append(f"missing required instruction file: {path.relative_to(root)}")

    if errors:
        return errors

    root_text = (root / ROOT_AGENT).read_text(encoding="utf-8")
    for scoped in SCOPED_AGENTS:
        if f"`{scoped}`" not in root_text:
            errors.append(f"{ROOT_AGENT}: missing routing reference to {scoped}")

    if not all(
        phrase in root_text
        for phrase in ("--task-id", "--task-contract", "mutually exclusive")
    ):
        errors.append(
            f"{ROOT_AGENT}: task contract options must be documented as mutually exclusive"
        )

    for path in files:
        text = path.read_text(encoding="utf-8")
        relative = path.relative_to(root).as_posix()

        for label, pattern in FORBIDDEN_COMMANDS.items():
            if pattern.search(text):
                errors.append(
                    f"{relative}: duplicates canonical {label} command from scripts/harness/commands.py"
                )

        for token in BACKTICK_TOKEN.findall(text):
            if _looks_like_repository_path(token) and not _reference_exists(
                root, path, token
            ):
                errors.append(f"{relative}: referenced path does not exist: {token}")

    root_size = (root / ROOT_AGENT).stat().st_size
    for scoped in SCOPED_AGENTS:
        chain_size = root_size + (root / scoped).stat().st_size
        if chain_size > MAX_INSTRUCTION_CHAIN_BYTES:
            errors.append(
                f"{scoped}: root+scoped instruction chain is {chain_size} bytes; "
                f"budget is {MAX_INSTRUCTION_CHAIN_BYTES}"
            )

    return errors


def main() -> int:
    errors = validate_repository()
    if errors:
        print("Agent instruction validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print("Agent instruction validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
