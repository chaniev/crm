from __future__ import annotations

import ast
import hashlib
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

CYRILLIC = re.compile(r"[А-Яа-яЁё]")


@dataclass(frozen=True)
class Finding:
    path: str
    line: int
    value: str
    fingerprint: str


@dataclass(frozen=True)
class ScanResult:
    violations: tuple[Finding, ...]
    stale_allowlist: tuple[dict[str, object], ...]
    seen_exceptions: int


def scan_user_facing_text(
    source_root: Path,
    repository_root: Path,
    exceptions_path: Path,
    allowlist_path: Path,
) -> ScanResult:
    exceptions = _entries(exceptions_path)
    allowlist = _entries(allowlist_path)
    accepted_exceptions = {
        _entry_key(entry): entry for entry in exceptions if str(entry["path"]).startswith("bot/")
    }
    accepted_allowlist = {
        _entry_key(entry): entry for entry in allowlist if str(entry["path"]).startswith("bot/")
    }
    seen_exceptions: set[str] = set()
    seen_allowlist: set[str] = set()
    violations: list[Finding] = []
    repository_source = source_root.resolve() == (repository_root / "bot/src/gym_crm_bot").resolve()

    for file in sorted(source_root.rglob("*.py")):
        relative_source = file.relative_to(source_root).as_posix()
        path = (
            file.relative_to(repository_root).as_posix()
            if repository_source
            else f"bot/src/gym_crm_bot/{relative_source}"
        )
        if "/resources/" in f"/{path}" or "/tests/" in f"/{path}":
            continue
        source = file.read_text()
        tree = ast.parse(source, filename=str(file))
        parents = {
            child: parent for parent in ast.walk(tree) for child in ast.iter_child_nodes(parent)
        }
        for node in ast.walk(tree):
            if isinstance(node, ast.Constant) and isinstance(node.value, str):
                if isinstance(parents.get(node), ast.JoinedStr):
                    continue
                value = node.value
            elif isinstance(node, ast.JoinedStr):
                value = _joined_value(node)
            else:
                continue
            if not CYRILLIC.search(value):
                continue
            fingerprint = _fingerprint(value)
            key = f"{path}\0{fingerprint}"
            if key in accepted_exceptions:
                seen_exceptions.add(key)
            elif key in accepted_allowlist:
                seen_allowlist.add(key)
            elif not _is_machine_contract(node, parents, value) and not _is_telemetry(
                node, parents
            ):
                violations.append(Finding(path, node.lineno, value, fingerprint))

    stale = tuple(entry for key, entry in accepted_allowlist.items() if key not in seen_allowlist)
    return ScanResult(tuple(violations), stale, len(seen_exceptions))


def _joined_value(node: ast.JoinedStr) -> str:
    parts: list[str] = []
    for part in node.values:
        if isinstance(part, ast.Constant):
            parts.append(str(part.value))
        elif isinstance(part, ast.FormattedValue):
            placeholder = "{" + ast.unparse(part.value)
            if part.conversion != -1:
                placeholder += "!" + chr(part.conversion)
            if part.format_spec is not None:
                placeholder += ":" + ast.unparse(part.format_spec).removeprefix("f").strip("'\"")
            parts.append(placeholder + "}")
    return "".join(parts)


def _is_machine_contract(node: ast.AST, parents: dict[ast.AST, ast.AST], value: str) -> bool:
    if value.startswith("/"):
        return True
    current: ast.AST | None = node
    while current is not None:
        if isinstance(current, ast.Assign | ast.AnnAssign):
            targets = current.targets if isinstance(current, ast.Assign) else [current.target]
            names = " ".join(ast.unparse(target).lower() for target in targets)
            return any(token in names for token in ("code", "route", "path", "callback", "command"))
        if isinstance(current, ast.keyword) and current.arg:
            return any(
                token in current.arg.lower()
                for token in ("code", "route", "path", "callback", "command")
            )
        current = parents.get(current)
    return False


def _is_telemetry(node: ast.AST, parents: dict[ast.AST, ast.AST]) -> bool:
    current: ast.AST | None = node
    while current is not None:
        if isinstance(current, ast.Call):
            target = ast.unparse(current.func).lower()
            return target == "print" or "logger." in target or "logging." in target
        current = parents.get(current)
    return False


def _entries(path: Path) -> list[dict[str, object]]:
    return list(json.loads(path.read_text())["entries"])


def _entry_key(entry: dict[str, object]) -> str:
    return f"{entry['path']}\0{entry['fingerprint']}"


def _fingerprint(value: str) -> str:
    return "sha256:" + hashlib.sha256(value.encode()).hexdigest()


def main() -> int:
    repository_root = Path(sys.argv[1]).resolve() if len(sys.argv) == 2 else Path.cwd().parent
    result = scan_user_facing_text(
        repository_root / "bot/src/gym_crm_bot",
        repository_root,
        repository_root
        / "scripts/harness/config/user-facing-text-inventory-index/scanner-exceptions.json",
        repository_root / "scripts/harness/config/user-facing-text-allowlist.json",
    )
    for finding in result.violations:
        print(
            f"{finding.path}:{finding.line}: user-facing Cyrillic literal: {finding.value}",
            file=sys.stderr,
        )
    for entry in result.stale_allowlist:
        print(
            f"{entry['path']}: stale user-facing-text allowlist entry {entry['fingerprint']}",
            file=sys.stderr,
        )
    if result.violations or result.stale_allowlist:
        return 1
    print(f"Bot user-facing literal guard passed; {result.seen_exceptions} classified fixtures.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
