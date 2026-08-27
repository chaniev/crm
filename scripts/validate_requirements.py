#!/usr/bin/env python3
"""Validate the product requirements registry and active backlog traceability."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REQUIREMENTS_DIR = ROOT / "docs" / "requirements"
ACTIVE_TASK_DIRS = {
    "tasks-ready": ROOT / "backlog" / "tasks-ready",
    "risky": ROOT / "backlog" / "risky",
    "needs-clarification": ROOT / "backlog" / "needs-clarification",
    "implementation": ROOT / "backlog" / "implementation",
}
ALLOWED_DOMAINS = {
    "CLI",
    "GRP",
    "SUB",
    "ATT",
    "USR",
    "AUD",
    "BOT",
    "BRN",
    "ATTN",
    "CHAT",
    "NFR",
}
ALLOWED_DECISIONS = {"предложено", "принято", "отклонено"}
ALLOWED_IMPLEMENTATION_STATES = {"не начато", "частично", "реализовано"}
ALLOWED_RELATIONS = {"implements", "changes", "constrains", "verifies"}
CARD_HEADING = re.compile(r"^### (REQ-([A-Z]+)-(\d{3}))\. .+$", re.MULTILINE)
REQ_TOKEN = re.compile(r"REQ-[A-Z]+-\d{3}")
TASK_REQUIREMENT = re.compile(
    r"^- (REQ-[A-Z]+-\d{3}) — (implements|changes|constrains|verifies)$"
)


@dataclass(frozen=True)
class Requirement:
    identifier: str
    decision: str
    implementation: str
    path: Path
    body: str


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def field_values(body: str, label: str) -> list[str]:
    return re.findall(rf"^\*\*{re.escape(label)}:\*\* (.+)$", body, re.MULTILINE)


def section_body(text: str, heading: str) -> str | None:
    match = re.search(
        rf"^## {re.escape(heading)}\s*$\n(.*?)(?=^## |\Z)",
        text,
        re.MULTILINE | re.DOTALL,
    )
    return match.group(1).strip() if match else None


def parse_registry(errors: list[str]) -> dict[str, Requirement]:
    requirements: dict[str, Requirement] = {}

    for path in sorted(REQUIREMENTS_DIR.glob("[0-9][0-9]-*.md")):
        text = path.read_text(encoding="utf-8")
        matches = list(CARD_HEADING.finditer(text))
        for index, match in enumerate(matches):
            identifier, domain, number = match.groups()
            end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
            body = text[match.start() : end]
            location = f"{relative(path)}:{text[: match.start()].count(chr(10)) + 1}"

            if identifier in requirements:
                errors.append(f"{location}: duplicate requirement ID {identifier}")
                continue
            if domain not in ALLOWED_DOMAINS:
                errors.append(f"{location}: unknown requirement domain {domain}")
            if len(number) != 3:
                errors.append(f"{location}: requirement number must have three digits")

            decisions = field_values(body, "Решение")
            implementations = field_values(body, "Реализация")
            if len(decisions) != 1 or decisions[0] not in ALLOWED_DECISIONS:
                errors.append(f"{location}: expected one valid **Решение:** field")
            if (
                len(implementations) != 1
                or implementations[0] not in ALLOWED_IMPLEMENTATION_STATES
            ):
                errors.append(f"{location}: expected one valid **Реализация:** field")
            for required_label in (
                "**Границы и ограничения:**",
                "**Связанные требования:**",
                "**Изменения:**",
            ):
                if body.count(required_label) != 1:
                    errors.append(f"{location}: expected one {required_label} section")
            if "**Статус:**" in body:
                errors.append(f"{location}: legacy **Статус:** field is not allowed")

            change_section = body.split("**Изменения:**", 1)[-1]
            linked_change = False
            for change_line in re.findall(r"^- \d{2}\.\d{2}\.\d{4}.+$", change_section, re.MULTILINE):
                link_match = re.search(r"\[[^\]]+\]\(([^)]+)\)", change_line)
                if link_match:
                    linked_change = True
                    link_target = link_match.group(1).split("#", 1)[0]
                    if (
                        link_target
                        and not re.match(r"^[a-z]+://", link_target)
                        and not (path.parent / link_target).resolve().exists()
                    ):
                        errors.append(
                            f"{location}: change link target does not exist: {link_target}"
                        )
                    continue
                if change_line.startswith("- 27.08.2026") and "источник:" in change_line:
                    continue
                errors.append(f"{location}: change entry must contain a Markdown task/plan link: {change_line}")
            if not linked_change:
                errors.append(f"{location}: no linked post-migration change evidence")

            requirements[identifier] = Requirement(
                identifier=identifier,
                decision=decisions[0] if len(decisions) == 1 else "",
                implementation=implementations[0] if len(implementations) == 1 else "",
                path=path,
                body=body,
            )

    if not requirements:
        errors.append("docs/requirements: no requirement cards found")
    return requirements


def validate_requirement_references(
    requirements: dict[str, Requirement], errors: list[str]
) -> None:
    known = set(requirements)
    for requirement in requirements.values():
        for referenced in REQ_TOKEN.findall(requirement.body):
            if referenced != requirement.identifier and referenced not in known:
                errors.append(
                    f"{relative(requirement.path)}: {requirement.identifier} references unknown {referenced}"
                )

    for path in (
        ROOT / "docs" / "MOBILE_UI_CONTRACT.md",
        ROOT / "docs" / "ui-concept" / "README.md",
    ):
        for referenced in REQ_TOKEN.findall(path.read_text(encoding="utf-8")):
            if referenced not in known:
                errors.append(f"{relative(path)}: references unknown {referenced}")


def validate_task_requirements(
    path: Path,
    status_dir: str,
    requirements: dict[str, Requirement],
    errors: list[str],
) -> None:
    text = path.read_text(encoding="utf-8")
    section = section_body(text, "Requirements")
    label = relative(path)
    if section is None:
        errors.append(f"{label}: missing ## Requirements")
        return

    entries = [line.strip() for line in section.splitlines() if line.strip()]
    if not entries:
        errors.append(f"{label}: empty ## Requirements")
        return

    has_none = any(line.startswith("- none — ") for line in entries)
    has_pending = any(line.startswith("- pending — ") for line in entries)
    req_entries = [line for line in entries if line.startswith("- REQ-")]
    if sum((has_none, has_pending, bool(req_entries))) != 1:
        errors.append(f"{label}: do not mix REQ-*, none, and pending metadata")

    if has_none:
        if len(entries) != 1 or len(entries[0].partition(" — ")[2].strip()) < 12:
            errors.append(f"{label}: none requires one concrete behavior-preserving reason")
        return

    if has_pending:
        if status_dir != "needs-clarification":
            errors.append(f"{label}: pending is allowed only in needs-clarification")
        if len(entries) != 1 or len(entries[0].partition(" — ")[2].strip()) < 12:
            errors.append(f"{label}: pending requires one concrete missing decision")
        return

    for entry in entries:
        match = TASK_REQUIREMENT.fullmatch(entry)
        if not match:
            errors.append(
                f"{label}: invalid requirement entry; expected 'REQ-ID — implements|changes|constrains|verifies': {entry}"
            )
            continue
        identifier, relation = match.groups()
        if relation not in ALLOWED_RELATIONS:
            errors.append(f"{label}: invalid relation {relation}")
        requirement = requirements.get(identifier)
        if requirement is None:
            errors.append(f"{label}: references unknown {identifier}")
        elif status_dir in {"tasks-ready", "risky", "implementation"} and requirement.decision != "принято":
            errors.append(
                f"{label}: {identifier} decision is {requirement.decision!r}, expected 'принято'"
            )
        elif relation == "implements" and requirement.implementation == "реализовано":
            errors.append(
                f"{label}: {identifier} is already marked implemented; use verifies/changes or correct the card"
            )
        elif (
            status_dir == "implementation"
            and relation == "changes"
            and requirement.implementation == "реализовано"
        ):
            errors.append(
                f"{label}: {identifier} target revision must be recorded as not started/partial before implementation"
            )


def validate_active_backlog(
    requirements: dict[str, Requirement], errors: list[str]
) -> tuple[int, int]:
    task_count = 0
    for status_dir, directory in ACTIVE_TASK_DIRS.items():
        for path in sorted(directory.glob("*.md")):
            task_count += 1
            validate_task_requirements(path, status_dir, requirements, errors)

    plan_count = 0
    for path in sorted((ROOT / "backlog" / "implementation-plans").glob("*.plan.md")):
        plan_count += 1
        text = path.read_text(encoding="utf-8")
        match = re.search(r"^- requirements: (.+)$", text, re.MULTILINE)
        label = relative(path)
        if not match:
            errors.append(f"{label}: missing '- requirements:' metadata")
            continue
        value = match.group(1).strip()
        if value.startswith("pending"):
            errors.append(f"{label}: pending is not allowed in an executable plan")
        if value.startswith("none") and len(value.partition("—")[2].strip()) < 12:
            errors.append(f"{label}: none requires a concrete behavior-preserving reason")
        for identifier in REQ_TOKEN.findall(value):
            requirement = requirements.get(identifier)
            if requirement is None:
                errors.append(f"{label}: references unknown {identifier}")
            elif requirement.decision != "принято":
                errors.append(f"{label}: {identifier} is not accepted")

    return task_count, plan_count


def validate_legacy_source(errors: list[str]) -> None:
    path = ROOT / "docs" / "описание требований. txt"
    if not path.read_text(encoding="utf-8").startswith("АРХИВНЫЙ ДОКУМЕНТ"):
        errors.append(f"{relative(path)}: legacy source must be marked as archived")


def validate_diff(base: str | None, errors: list[str]) -> None:
    if not base:
        return
    result = subprocess.run(
        ["git", "diff", "--name-only", base, "--"],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        errors.append(f"git diff against {base} failed: {result.stderr.strip()}")
        return
    changed = {line.strip() for line in result.stdout.splitlines() if line.strip()}
    domain_change = any(
        re.fullmatch(r"docs/requirements/\d{2}-.+\.md", path) for path in changed
    )
    if domain_change and "docs/requirements/CHANGELOG.md" not in changed:
        errors.append(
            "docs/requirements/CHANGELOG.md must change with requirement domain files"
        )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--base",
        help="optional Git base SHA/ref used to enforce requirements/CHANGELOG co-change",
    )
    args = parser.parse_args()

    errors: list[str] = []
    requirements = parse_registry(errors)
    validate_requirement_references(requirements, errors)
    task_count, plan_count = validate_active_backlog(requirements, errors)
    validate_legacy_source(errors)
    validate_diff(args.base, errors)

    if errors:
        print("Requirements validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        f"Requirements validation passed: {len(requirements)} cards, "
        f"{task_count} active tasks, {plan_count} active plans."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
