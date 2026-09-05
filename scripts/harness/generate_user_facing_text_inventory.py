#!/usr/bin/env python3
"""Generate the proposed TASK-165 review inventory; this is not the enforcement scanner."""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import re
import subprocess
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path
from typing import Any, Iterable


CYRILLIC = re.compile(r"[А-Яа-яЁё]")
WORD = re.compile(r"[A-Za-zА-Яа-яЁё]")
MACHINE_VALUE = re.compile(
    r"^(?:/|https?://|[A-Za-z]+(?:\.[A-Za-z0-9_-]+)+$|[A-Za-z][A-Za-z0-9_-]{0,31}$)"
)
CATEGORIES = (
    "resource",
    "backend-owned propagated text",
    "dynamic user/domain value",
    "machine contract",
    "telemetry-only",
    "test fixture",
    "persisted historical description",
)


def digest(value: str) -> str:
    return "sha256:" + hashlib.sha256(value.encode()).hexdigest()


def owner_and_slice(path: str) -> tuple[str, str]:
    if path.startswith(("frontend/src/lib/resources", "frontend/src/resources/")):
        return "frontend/shared-resources", "existing-resources"
    if path.endswith(".resx") or (path.startswith("backend/") and (
        Path(path).stem.endswith("Resources") or "/UserFacingText/" in path
    )):
        return "backend/api-resources", "existing-resources"
    if path.startswith("frontend/src/app/") or path.endswith("frontend/src/App.tsx") or "/bootstrap/" in path:
        return "frontend/app-shell-auth", "FE-1-app-shell-auth"
    if "/features/schedule/" in path:
        if any(part in path for part in ("Drawer", "Disclosure", "Deferred", "MoreActions")):
            return "frontend/schedule-mutations", "FE-3-schedule-mutations"
        return "frontend/schedule", "FE-2-schedule-core"
    if "/features/attendance/" in path:
        return "frontend/attendance", "FE-4-attendance"
    if "/features/clients/list/" in path:
        return "frontend/client-list", "FE-5-client-list"
    if "/features/settings/" in path and "MembershipCatalog" in path:
        return "frontend/settings-membership", "FE-12-settings-membership"
    if path.startswith("frontend/") and (
        "/features/clients/membership/" in path or "Membership" in Path(path).name
    ):
        return "frontend/client-membership", "FE-7-client-membership"
    if path.startswith("frontend/") and any(
        part in path for part in ("ClientMessenger", "ClientPhoto", "ClientNote")
    ):
        return "frontend/client-messenger-media", "FE-8-client-messenger-media"
    if "/features/clients/" in path:
        return "frontend/client-profile", "FE-6-client-profile"
    if "/features/attention/" in path:
        return "frontend/attention", "FE-9-attention"
    if "/features/settings/" in path:
        if any(part in path for part in ("Administrator", "User")):
            return "frontend/settings-users", "FE-11-settings-users"
        return "frontend/settings-branches", "FE-10-settings-branches-shell"
    if "/features/users/" in path:
        return "frontend/users", "FE-11-settings-users"
    if "/features/groups/" in path:
        if any(part in path for part in ("TrainerAssignment", "TrainerSubstitution")):
            return "frontend/group-staffing", "FE-14-group-staffing"
        return "frontend/groups", "FE-13-groups-core"
    if "/features/finance/" in path:
        return "frontend/finance", "FE-15-finance"
    if "/features/audit/" in path:
        return "frontend/audit", "FE-16-audit"
    if path.startswith("frontend/src/catalog/"):
        return "frontend/component-catalog", "scanner-exceptions"
    if path.startswith("frontend/"):
        return "frontend/shared", "FE-17-shared-routing-theme"
    if "/Auth/BotInternal" in path:
        return "backend/bot-internal-api", "BE-7-bot-internal-api"
    if "/Auth/" in path and "Membership" in path:
        return "backend/client-membership", "BE-3-client-membership"
    if "/Auth/" in path and "Attendance" in path:
        return "backend/attendance", "BE-4-attendance"
    if "/Auth/" in path and "Client" in path:
        return "backend/clients", "BE-2-clients"
    if "/Auth/" in path and any(part in path for part in ("Schedule", "LessonSeries")):
        return "backend/schedule", "BE-6-schedule"
    if "/Auth/" in path and any(part in path for part in ("Group", "Trainer")):
        return "backend/groups", "BE-5-groups"
    if "/Auth/" in path:
        return "backend/auth-users-access", "BE-1-auth-users-access"
    if "/SeedData/" in path:
        return "backend/seed-data", "scanner-exceptions"
    if path.startswith("backend/"):
        return "backend/startup-api", "BE-8-startup-reports-audit"
    if path.startswith("bot/src/gym_crm_bot/resources/"):
        return "bot/resources", "existing-resources"
    if "/attendance" in path:
        return "bot/attendance", "BOT-2-attendance"
    if "/client" in path or path.endswith("rendering.py"):
        return "bot/clients", "BOT-3-clients-rendering"
    if path.startswith("bot/"):
        return "bot/service-access", "BOT-1-service-access"
    return "repository", "scanner-exceptions"


def category_reason(finding: dict[str, Any]) -> tuple[str, str]:
    path = finding["path"]
    value = finding["value"]
    context = json.dumps(finding.get("context", {}), ensure_ascii=False)
    if path.endswith(".resx") or path == "frontend/src/lib/resources.ts" or path.startswith(
        "frontend/src/resources/"
    ):
        return "resource", "Already stored in the owning layer resource boundary."
    if path.startswith("bot/src/gym_crm_bot/resources/"):
        if path.endswith("callbacks.py"):
            return "machine contract", "Telegram callback payload/protocol identifier."
        return "resource", "Already stored in gym_crm_bot.resources."
    if path.startswith("backend/") and (
        Path(path).stem.endswith("Resources") or "/UserFacingText/" in path
    ):
        return "machine contract", "Typed resource helper/key, not rendered copy by itself."
    if "/Persistence/Migrations/" in path:
        return "persisted historical description", "Generated migration snapshot preserves retained database history."
    if path.endswith("MembershipCatalogItemConfiguration.cs") and CYRILLIC.search(value):
        return "dynamic user/domain value", "Persisted system catalog name is domain data, not presentation copy."
    if "/Persistence/Configurations/" in path:
        return "machine contract", "Database constraint, SQL, or persisted mapping value."
    if path.startswith("frontend/src/catalog/"):
        return "test fixture", "Component-catalog demonstration copy is excluded from the production bundle."
    if "/SeedData/Test" in path or path.endswith("TestDataSeeder.cs"):
        return "test fixture", "Deterministic development/test seed fixture."
    if "/SeedData/" in path:
        return "dynamic user/domain value", "Seeded entity data becomes a domain value, not presentation copy."
    if path.endswith("BootstrapUserOptions.cs"):
        return "dynamic user/domain value", "Configurable bootstrap identity becomes persisted user/domain data."
    if re.search(r"logger|console\.|Log(?:Information|Warning|Error|Debug)", context, re.I):
        return "telemetry-only", "Operational diagnostic text is not rendered to the user."
    if "StableError(" in context or path.endswith("TechnicalLoggingStartupExtensions.cs"):
        return "telemetry-only", "Stable command or logging diagnostic is not rendered as CRM copy."
    if path.endswith("ClientMembershipEntitlementResolver.cs") and value.startswith(
        "Multiple membership entitlements matched"
    ):
        return "telemetry-only", "Structured invariant diagnostic is emitted only through ILogger."
    if finding.get("context", {}).get("kind") == "module-specifier":
        return "machine contract", "Module import/export specifier."
    without_placeholders = re.sub(r"\{[^{}]*\}", "", value)
    if not CYRILLIC.search(value) and (
        MACHINE_VALUE.match(value)
        or (not any(character.isspace() for character in value))
        or re.fullmatch(r"[A-Za-z0-9_.\[\]/:%=\"'<>+-]+", without_placeholders)
    ):
        return "machine contract", "Identifier, route, code, enum, format, or protocol value."
    return "resource", "Conservative visible-copy candidate; extraction requires exact characterization."


def extract_csharp(path: Path, root: Path) -> Iterable[dict[str, Any]]:
    source = path.read_text()
    index = 0
    line = 1
    while index < len(source):
        if source.startswith("//", index):
            end = source.find("\n", index)
            index = len(source) if end < 0 else end
            continue
        if source.startswith("/*", index):
            end = source.find("*/", index + 2)
            segment = source[index:] if end < 0 else source[index : end + 2]
            line += segment.count("\n")
            index += len(segment)
            continue
        if source[index] == "\n":
            line += 1
            index += 1
            continue
        start = index
        prefix = ""
        while index < len(source) and source[index] in "$@":
            prefix += source[index]
            index += 1
        if index >= len(source) or source[index] != '"':
            index = start + 1
            continue
        quote_count = 1
        while index + quote_count < len(source) and source[index + quote_count] == '"':
            quote_count += 1
        raw = quote_count >= 3
        cursor = index + quote_count
        if quote_count == 2:
            end = index + 2
        elif raw:
            closing = '"' * quote_count
            end = source.find(closing, cursor)
            end = len(source) if end < 0 else end + quote_count
        else:
            escaped = False
            while cursor < len(source):
                character = source[cursor]
                if character == '"' and not escaped:
                    if "@" in prefix and cursor + 1 < len(source) and source[cursor + 1] == '"':
                        cursor += 2
                        continue
                    cursor += 1
                    break
                escaped = character == "\\" and not escaped and "@" not in prefix
                if character != "\\":
                    escaped = False
                cursor += 1
            end = cursor
        token = source[start:end]
        value = token[len(prefix) + quote_count : -quote_count] if end <= len(source) else token
        context_line = source[source.rfind("\n", 0, start) + 1 : source.find("\n", end)]
        if WORD.search(value) and (CYRILLIC.search(value) or re.search(
            r"Problem|Validation|errors?\[|title|detail|description|Display|message", context_line, re.I
        )):
            relative_path = path.relative_to(root).as_posix()
            yield {
                "path": relative_path,
                "line": line,
                "language": "csharp",
                "literal_kind": "interpolated" if "$" in prefix else "string",
                "source_text": token,
                "value": value,
                "fingerprint": digest(value),
                "context": {"kind": "source-line", "name": context_line.strip()},
                "has_cyrillic": bool(CYRILLIC.search(value)),
            }
        line += token.count("\n")
        index = end


def extract_resx(path: Path, root: Path) -> Iterable[dict[str, Any]]:
    tree = ET.parse(path)
    for data in tree.findall(".//data"):
        value = data.findtext("value") or ""
        if not WORD.search(value):
            continue
        yield {
            "path": path.relative_to(root).as_posix(),
            "line": None,
            "language": "resx",
            "literal_kind": "resource-value",
            "source_text": value,
            "value": value,
            "fingerprint": digest(value),
            "context": {"kind": "resource-key", "name": data.attrib.get("name", "")},
            "has_cyrillic": bool(CYRILLIC.search(value)),
        }


def extract_python(path: Path, root: Path) -> Iterable[dict[str, Any]]:
    source = path.read_text()
    tree = ast.parse(source)
    docstrings = set()
    for node in ast.walk(tree):
        body = getattr(node, "body", None)
        if (
            isinstance(body, list)
            and body
            and isinstance(body[0], ast.Expr)
            and isinstance(body[0].value, ast.Constant)
        ):
            if isinstance(body[0].value.value, str):
                docstrings.add(id(body[0].value))
    for node in ast.walk(tree):
        if id(node) in docstrings:
            continue
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            value = node.value
            kind = "string"
        elif isinstance(node, ast.JoinedStr):
            value = ast.get_source_segment(source, node) or ""
            kind = "f-string"
        else:
            continue
        if not WORD.search(value):
            continue
        source_text = ast.get_source_segment(source, node) or repr(value)
        if not (CYRILLIC.search(value) or "resources" in path.parts):
            continue
        yield {
            "path": path.relative_to(root).as_posix(),
            "line": node.lineno,
            "language": "python",
            "literal_kind": kind,
            "source_text": source_text,
            "value": value,
            "fingerprint": digest(value),
            "context": {"kind": type(getattr(node, "parent", None)).__name__, "name": ""},
            "has_cyrillic": bool(CYRILLIC.search(value)),
        }


def collapse(findings: list[dict[str, Any]], review_status: str) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str, str], dict[str, Any]] = {}
    for finding in findings:
        category, reason = category_reason(finding)
        owner, slice_id = owner_and_slice(finding["path"])
        key = finding["path"], finding["fingerprint"], category
        if key not in grouped:
            grouped[key] = {
                **finding,
                "lines": [],
                "occurrences": 0,
                "category": category,
                "reason": reason,
                "owner": owner,
                "slice": slice_id,
                "review_status": review_status,
            }
            grouped[key].pop("line", None)
        entry = grouped[key]
        entry["occurrences"] += 1
        if finding.get("line") is not None:
            entry["lines"].append(finding["line"])
    for entry in grouped.values():
        entry["lines"] = sorted(set(entry["lines"]))
    return sorted(grouped.values(), key=lambda item: (item["slice"], item["path"], item["lines"], item["fingerprint"]))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--output", type=Path, required=True, help="Inventory index JSON path")
    parser.add_argument("--allowlist-output", type=Path, required=True)
    parser.add_argument("--duplicates-output", type=Path, required=True)
    parser.add_argument("--source-commit")
    parser.add_argument("--review-status", choices=("proposed", "accepted"), default="proposed")
    args = parser.parse_args()
    root = args.root.resolve()
    args.output = (root / args.output).resolve() if not args.output.is_absolute() else args.output
    args.allowlist_output = (
        (root / args.allowlist_output).resolve()
        if not args.allowlist_output.is_absolute()
        else args.allowlist_output
    )
    args.duplicates_output = (
        (root / args.duplicates_output).resolve()
        if not args.duplicates_output.is_absolute()
        else args.duplicates_output
    )
    source_commit = args.source_commit or subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=root, text=True
    ).strip()
    node = subprocess.run(
        ["node", "scripts/harness/extract_typescript_text_inventory.mjs", str(root)],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
    )
    findings: list[dict[str, Any]] = json.loads(node.stdout)
    for path in sorted((root / "backend/src").rglob("*")):
        if path.suffix == ".cs" and not any(part in {"bin", "obj"} for part in path.parts):
            findings.extend(extract_csharp(path, root))
        elif path.suffix == ".resx":
            findings.extend(extract_resx(path, root))
    for path in sorted((root / "bot/src/gym_crm_bot").rglob("*.py")):
        findings.extend(extract_python(path, root))
    entries = collapse(findings, args.review_status)
    category_counts = Counter(entry["category"] for entry in entries)
    slice_counts = Counter(entry["slice"] for entry in entries)
    inventory_directory = args.output.with_suffix("")
    inventory_directory.mkdir(parents=True, exist_ok=True)
    for stale_path in inventory_directory.glob("*.json"):
        stale_path.unlink()
    inventory_files = []
    for slice_id in sorted(slice_counts):
        slice_entries = [entry for entry in entries if entry["slice"] == slice_id]
        slice_path = inventory_directory / f"{slice_id.lower()}.json"
        slice_path.write_text(json.dumps({
            "version": 1,
            "task": "TASK-165",
            "source_commit": source_commit,
            "review_status": args.review_status,
            "slice": slice_id,
            "entry_count": len(slice_entries),
            "entries": slice_entries,
        }, ensure_ascii=False, indent=2) + "\n")
        inventory_files.append({
            "slice": slice_id,
            "path": slice_path.relative_to(root).as_posix(),
            "entry_count": len(slice_entries),
            "occurrence_count": sum(entry["occurrences"] for entry in slice_entries),
            "by_category": dict(sorted(Counter(entry["category"] for entry in slice_entries).items())),
            "resource_candidate_entries": sum(
                entry["category"] == "resource" and slice_id != "existing-resources"
                for entry in slice_entries
            ),
            "resource_candidate_occurrences": sum(
                entry["occurrences"]
                for entry in slice_entries
                if entry["category"] == "resource" and slice_id != "existing-resources"
            ),
        })

    duplicate_groups = []
    by_fingerprint: dict[str, list[dict[str, Any]]] = {}
    for entry in entries:
        if entry["category"] == "resource":
            by_fingerprint.setdefault(entry["fingerprint"], []).append(entry)
    for fingerprint_value, candidates in sorted(by_fingerprint.items()):
        owners = sorted({candidate["owner"] for candidate in candidates})
        if len(owners) > 1:
            duplicate_groups.append({
                "fingerprint": fingerprint_value,
                "value": candidates[0]["value"],
                "owners": owners,
                "locations": [
                    {"path": candidate["path"], "lines": candidate["lines"], "slice": candidate["slice"]}
                    for candidate in candidates
                ],
                "review_status": args.review_status,
                "decision": "keep feature-owned unless review proves two consumers share one meaning",
            })
    args.duplicates_output.parent.mkdir(parents=True, exist_ok=True)
    args.duplicates_output.write_text(json.dumps({
        "version": 1,
        "task": "TASK-165",
        "review_status": args.review_status,
        "group_count": len(duplicate_groups),
        "groups": duplicate_groups,
    }, ensure_ascii=False, indent=2) + "\n")

    exception_candidates = [
        entry
        for entry in entries
        if entry["has_cyrillic"]
        and entry["category"] not in {"resource", "backend-owned propagated text"}
        and entry["slice"] != "existing-resources"
    ]
    # A classified non-copy literal is not an allowlist entry. The enforcement
    # scanner must understand source context first; only irreducible false
    # positives may be promoted here after review.
    allowlist_entries: list[dict[str, Any]] = []
    args.allowlist_output.parent.mkdir(parents=True, exist_ok=True)
    args.allowlist_output.write_text(json.dumps({
        "version": 1,
        "task": "TASK-165",
        "review_status": args.review_status,
        "identity": "exact path plus SHA-256 of decoded literal value; line numbers are not identity",
        "policy": "Empty baseline: syntax/category classification must handle known exceptions before allowlisting.",
        "required_entry_fields": ["path", "fingerprint", "category", "reason", "owner_task"],
        "entry_count": len(allowlist_entries),
        "entries": allowlist_entries,
    }, ensure_ascii=False, indent=2) + "\n")

    document = {
        "version": 1,
        "task": "TASK-165",
        "source_commit": source_commit,
        "review_status": args.review_status,
        "valid_categories": list(CATEGORIES),
        "generation_scope": {
            "frontend": "TypeScript AST: Cyrillic literals, visible-context literals in any language, and existing resources; tests excluded.",
            "backend": "All backend assemblies: comment-aware C# lexical candidate extraction plus every .resx value; enforcement uses Roslyn syntax parsing.",
            "bot": "Python AST: Cyrillic literals and existing resource-module literals; docstrings/tests excluded.",
        },
        "safety": "Ambiguous static literals are classified as resource candidates and never auto-allowlisted.",
        "summary": {
            "entry_count": len(entries),
            "occurrence_count": sum(entry["occurrences"] for entry in entries),
            "by_category": {category: category_counts[category] for category in CATEGORIES},
            "by_slice": dict(sorted(slice_counts.items())),
            "cross_owner_duplicate_groups": len(duplicate_groups),
            "classified_exception_candidates": len(exception_candidates),
            "proposed_allowlist_entries": len(allowlist_entries),
            "cyrillic_resource_candidates": sum(
                entry["occurrences"]
                for entry in entries
                if entry["category"] == "resource"
                and entry["has_cyrillic"]
                and entry["slice"] != "existing-resources"
            ),
            "non_cyrillic_resource_candidates": sum(
                entry["occurrences"]
                for entry in entries
                if entry["category"] == "resource"
                and not entry["has_cyrillic"]
                and entry["slice"] != "existing-resources"
            ),
        },
        "inventory_files": inventory_files,
        "allowlist_file": args.allowlist_output.relative_to(root).as_posix(),
        "duplicates_file": args.duplicates_output.relative_to(root).as_posix(),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
