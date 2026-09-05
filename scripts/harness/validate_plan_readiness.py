#!/usr/bin/env python3
"""Fail closed on executable plans with unresolved product/technical decisions."""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.harness.validate_architecture_decisions import ACCEPTED, STATUS
from scripts.validate_requirements import CARD_HEADING, REQ_TOKEN, field_values, section_body


def metadata(text: str, key: str) -> str:
    if len(re.findall(r"^## Metadata\s*$", text, re.MULTILINE)) != 1:
        return ""
    body = section_body(text, "Metadata") or ""
    values = re.findall(rf"^- {re.escape(key)}: (.+)$", body, re.MULTILINE)
    return values[0].strip() if len(values) == 1 else ""


def local_file(root: Path, value: str) -> Path | None:
    # Leading slash is the repository-link convention, never a host path.
    candidate = (root / value.lstrip("/").split("#", 1)[0]).resolve()
    if not candidate.is_relative_to(root.resolve()) or not candidate.is_file():
        return None
    return candidate


def accepted_requirements(root: Path) -> set[str]:
    accepted: set[str] = set()
    for path in (root / "docs/requirements").glob("[0-9][0-9]-*.md"):
        text = path.read_text(encoding="utf-8")
        matches = list(CARD_HEADING.finditer(text))
        for index, match in enumerate(matches):
            end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
            if field_values(text[match.end():end], "Решение") == ["принято"]:
                accepted.add(match.group(1))
    return accepted


def validate_plan(path: Path, *, root: Path = ROOT, executable: bool = False) -> list[str]:
    root, path = root.resolve(), path.resolve()
    errors: list[str] = []
    text = path.read_text(encoding="utf-8")
    label = path.relative_to(root).as_posix()

    def fail(message: str) -> None:
        errors.append(f"{label}: {message}")

    readiness = metadata(text, "readiness")
    ready = readiness == "yes"
    if not ready and not re.fullmatch(r"no — \S.+", readiness):
        fail("readiness must be yes or no — concrete blocker (exactly once)")
    if executable and not ready:
        fail("plan is not executable; return to planning before changing project code")
    source = local_file(root, metadata(text, "source_task"))
    task_id = re.match(r"TASK-\d{3,}(?=-)", path.name)
    if source is None or not task_id or not source.name.startswith(task_id.group() + "-"):
        fail("source_task must reference the existing matching task")
    elif source.parent == root / "backlog/implementation" and not ready:
        fail("non-ready task must leave implementation before execution")
    elif ready and source.parent not in {
        root / "backlog/implementation", root / "backlog/tasks-ready",
    }:
        fail("ready plan source must be ready/implementation, not risky or needs-clarification")
    if not metadata(text, "branch") or any(c.isspace() for c in metadata(text, "branch")):
        fail("branch must be a single declared branch")
    if not ready:
        # Drafts retain unresolved alternatives honestly; they never pass --plan.
        return errors

    for key in ("product_decisions", "technical_decisions"):
        value = metadata(text, key)
        if value != "accepted" and not re.fullmatch(r"none — .{12,}", value):
            fail(f"{key} must be accepted or none — concrete reason")
    if metadata(text, "open_questions") != "none":
        fail("open_questions must be none; resolve decisions during planning")
    decisions = section_body(text, "Decisions and contracts")
    if not decisions:
        fail("missing Decisions and contracts")
    evidence = section_body(text, "Decision evidence") or ""
    links = re.findall(r"\[[^\]]+\]\(([^)]+)\)", evidence)
    if not links:
        fail("Decision evidence must link approval provenance for the exact decisions")
    for kind in ("product", "technical"):
        if metadata(text, f"{kind}_decisions") == "accepted" and not re.search(
            rf"^- {kind}: \[[^\]]+\]\([^)]+\) — owner: \S.+; decision: \S.+$",
            evidence, re.MULTILINE,
        ):
            fail(f"Decision evidence requires {kind} approval source, owner and exact decision")
    for link in links:
        if local_file(root, link) is None:
            fail(f"decision evidence does not exist inside repository: {link}")
    requirements = metadata(text, "requirements")
    ids = set(REQ_TOKEN.findall(requirements))
    if not ids and not re.fullmatch(r"none — .{12,}", requirements):
        fail("requirements must reference accepted REQ-* or none — concrete reason")
    if ids and ("pending" in requirements or requirements.startswith("none")):
        fail("requirements must not mix REQ-* with pending/none")
    for identifier in sorted(ids - accepted_requirements(root)):
        fail(f"{identifier} is unknown or not accepted")

    architecture = metadata(text, "architecture_decisions")
    declared = set(re.findall(r"\bADR-\d{4}\b", architecture))
    if not declared and not re.fullmatch(r"none — .{12,}", architecture):
        fail("architecture_decisions must list ADR-NNNN or none — concrete reason")
    # Inspect all references, including ones omitted from the declaration.
    referenced = set(re.findall(r"\bADR-\d{4}\b", text))
    linked_adrs = re.findall(r"(?:/|\b)docs/architecture/adr/(\d{4})-[^\s)]+\.md", text)
    referenced.update(f"ADR-{number}" for number in linked_adrs)
    if referenced - declared:
        fail("all referenced ADRs must be listed in architecture_decisions")
    for identifier in sorted(declared | referenced):
        candidates = list((root / "docs/architecture/adr").glob(f"{identifier[4:]}-*.md"))
        statuses = STATUS.findall(candidates[0].read_text(encoding="utf-8")) if len(candidates) == 1 else []
        if len(statuses) != 1 or not ACCEPTED.fullmatch(statuses[0]):
            fail(f"{identifier} must exist uniquely and have Accepted approval")
    return errors


def validate_repository(root: Path = ROOT) -> list[str]:
    root = root.resolve()
    errors: list[str] = []
    plans = sorted((root / "backlog/implementation-plans").rglob("*.plan.md"))
    sources: dict[Path, list[Path]] = {}
    for path in plans:
        errors.extend(validate_plan(path, root=root))
        source = local_file(root, metadata(path.read_text(encoding="utf-8"), "source_task"))
        if source:
            sources.setdefault(source, []).append(path)
    for task in (root / "backlog/implementation").glob("TASK-*.md"):
        if len(sources.get(task.resolve(), [])) != 1:
            errors.append(f"{task.relative_to(root)}: implementation requires exactly one active ready plan")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", help="Require this repository-local plan to be executable")
    args = parser.parse_args()
    try:
        if args.plan:
            requested = Path(args.plan)
            if requested.is_absolute() and requested.resolve().is_relative_to(ROOT):
                path = requested.resolve() if requested.is_file() else None
            else:
                path = local_file(ROOT, args.plan)
            if path is None or path.suffixes[-2:] != [".plan", ".md"]:
                errors = ["--plan must reference an existing repository-local *.plan.md"]
            else:
                errors = validate_plan(path, root=ROOT, executable=True)
        else:
            errors = validate_repository(ROOT)
    except (OSError, UnicodeError) as error:
        errors = [str(error)]
    if errors:
        print("Plan readiness validation failed:\n" + "\n".join(f"- {e}" for e in errors), file=sys.stderr)
        return 1
    print("Plan readiness validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
