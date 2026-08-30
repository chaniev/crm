#!/usr/bin/env python3
"""Validate CRM Architecture Decision Record structure and traceability."""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ADR_DIR = Path("docs/architecture/adr")
REQUIREMENTS_DIR = Path("docs/requirements")
ADR_FILE = re.compile(r"^(?P<number>\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$")
ADR_TITLE = re.compile(r"^# ADR-(?P<number>\d{4}): .+$", re.MULTILINE)
REQUIREMENT_ID = re.compile(r"\bREQ-[A-Z]+-\d{3}\b")
REQUIREMENT_CARD = re.compile(r"^### (REQ-[A-Z]+-\d{3})\b", re.MULTILINE)
STATUS = re.compile(r"^- \*\*Статус:\*\* (.+)$", re.MULTILINE)
ACCEPTED = re.compile(r"^Accepted \([^,\n]+, [^,\n]+, \d{4}-\d{2}-\d{2}\)$")
SUPERSEDED = re.compile(r"^Superseded by ADR-(\d{4})$")
REQUIRED_FILES = ("README.md", "_template.md")
REQUIRED_HEADINGS = (
    "## Связанные требования",
    "## Контекст",
    "## Критерии выбора",
    "## Рассмотренные варианты",
    "## Решение",
    "## Последствия",
    "## Cross-layer impact",
    "## Migration and rollback",
    "## Validation",
    "## Approval",
)


def _known_requirements(root: Path) -> set[str]:
    requirement_root = root / REQUIREMENTS_DIR
    known: set[str] = set()
    if not requirement_root.is_dir():
        return known
    for path in requirement_root.glob("[0-9][0-9]-*.md"):
        known.update(REQUIREMENT_CARD.findall(path.read_text(encoding="utf-8")))
    return known


def validate_repository(root: Path = ROOT) -> list[str]:
    errors: list[str] = []
    adr_root = root / ADR_DIR

    for required in REQUIRED_FILES:
        path = adr_root / required
        if not path.is_file():
            errors.append(f"missing architecture decision file: {path.relative_to(root)}")

    if not adr_root.is_dir() or errors:
        return errors

    known_requirements = _known_requirements(root)
    index_text = (adr_root / "README.md").read_text(encoding="utf-8")
    decisions: dict[str, Path] = {}
    statuses: dict[str, str] = {}

    for path in sorted(adr_root.glob("*.md")):
        if path.name in REQUIRED_FILES:
            continue

        file_match = ADR_FILE.fullmatch(path.name)
        if not file_match:
            errors.append(f"{path.relative_to(root)}: invalid ADR filename")
            continue

        number = file_match.group("number")
        text = path.read_text(encoding="utf-8")
        title_match = ADR_TITLE.search(text)
        if not title_match or title_match.group("number") != number:
            errors.append(
                f"{path.relative_to(root)}: title must use matching ADR-{number}"
            )

        if number in decisions:
            errors.append(
                f"duplicate ADR-{number}: {decisions[number].relative_to(root)} and "
                f"{path.relative_to(root)}"
            )
        decisions[number] = path

        if f"ADR-{number}" not in index_text:
            errors.append(
                f"{path.relative_to(root)}: missing ADR-{number} from README index"
            )

        for heading in REQUIRED_HEADINGS:
            if heading not in text:
                errors.append(f"{path.relative_to(root)}: missing section {heading}")

        status_match = STATUS.search(text)
        if not status_match:
            errors.append(f"{path.relative_to(root)}: missing ADR status")
        else:
            status = status_match.group(1).strip()
            statuses[number] = status
            if (
                status not in {"Proposed", "Deprecated"}
                and not ACCEPTED.fullmatch(status)
                and not SUPERSEDED.fullmatch(status)
            ):
                errors.append(f"{path.relative_to(root)}: invalid ADR status {status!r}")

        referenced = set(REQUIREMENT_ID.findall(text))
        requirements_section = text.split("## Связанные требования", 1)[-1].split(
            "\n## ", 1
        )[0]
        has_none_reason = bool(
            re.search(r"^- none [—-] \S.+$", requirements_section, re.MULTILINE)
        )
        if not referenced and not has_none_reason:
            errors.append(
                f"{path.relative_to(root)}: link a REQ-* or provide a specific none reason"
            )
        for identifier in sorted(referenced.difference(known_requirements)):
            errors.append(f"{path.relative_to(root)}: unknown requirement {identifier}")

    for number, status in statuses.items():
        superseded = SUPERSEDED.fullmatch(status)
        if superseded and superseded.group(1) not in decisions:
            errors.append(
                f"{decisions[number].relative_to(root)}: superseding ADR-"
                f"{superseded.group(1)} does not exist"
            )

    return errors


def main() -> int:
    errors = validate_repository()
    if errors:
        print("Architecture decision validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print("Architecture decision validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
