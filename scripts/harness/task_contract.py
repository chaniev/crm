"""Load and validate task-specific CRM verification contracts."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any, Iterable

from scripts.harness.change_impact import ALL_AREAS, ChangeImpact
from scripts.harness.commands import CheckSpec


CONTRACT_VERSION = 1
TASK_ID_PATTERN = re.compile(r"^TASK-[0-9]{3,}$")
CHECK_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:[._-][a-z0-9]+)*$")
PROJECT_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
TOP_LEVEL_KEYS = {
    "version",
    "task_id",
    "expected_branch",
    "areas",
    "playwright",
    "runtime_smoke",
    "manual_checks",
}
MAX_CONTRACT_BYTES = 256 * 1024


class ContractError(ValueError):
    """A task verification contract is missing, invalid, or stale."""


@dataclass(frozen=True)
class PlaywrightSpec:
    identifier: str
    spec: str
    projects: tuple[str, ...]
    timeout_seconds: float


@dataclass(frozen=True)
class RuntimeSmokeSpec:
    identifier: str
    area: str
    command: tuple[str, ...]
    working_directory: str
    timeout_seconds: float


@dataclass(frozen=True)
class ManualCheckSpec:
    identifier: str
    description: str


@dataclass(frozen=True)
class TaskContract:
    path: Path
    relative_path: str
    task_id: str
    expected_branch: str
    areas: frozenset[str]
    playwright: tuple[PlaywrightSpec, ...]
    runtime_smoke: tuple[RuntimeSmokeSpec, ...]
    manual_checks: tuple[ManualCheckSpec, ...]
    content: str
    data: dict[str, Any]
    sha256: str

    @property
    def required_areas(self) -> set[str]:
        areas = set(self.areas)
        if self.playwright:
            areas.add("frontend")
        areas.update(check.area for check in self.runtime_smoke)
        return areas


def _fail(location: str, message: str) -> ContractError:
    return ContractError(f"task contract {location}: {message}")


def _mapping(value: Any, location: str, allowed: set[str]) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise _fail(location, "must be an object")
    unknown = set(value).difference(allowed)
    if unknown:
        raise _fail(location, f"unknown fields: {', '.join(sorted(unknown))}")
    return value


def _string(value: Any, location: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise _fail(location, "must be a non-empty string")
    return value


def _string_list(
    value: Any, location: str, *, unique: bool = True
) -> tuple[str, ...]:
    if not isinstance(value, list):
        raise _fail(location, "must be an array of strings")
    items = tuple(_string(item, f"{location}[]") for item in value)
    if unique and len(items) != len(set(items)):
        raise _fail(location, "must not contain duplicates")
    return items


def _objects(value: Any, location: str) -> list[dict[str, Any]]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise _fail(location, "must be an array of objects")
    return [
        _mapping(item, f"{location}[{index}]", set(item) if isinstance(item, dict) else set())
        for index, item in enumerate(value)
    ]


def _timeout(value: Any, location: str, default: float) -> float:
    if value is None:
        return default
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise _fail(location, "must be a positive number")
    timeout = float(value)
    if timeout <= 0 or timeout > 7200:
        raise _fail(location, "must be greater than zero and at most 7200")
    return timeout


def _identifier(value: Any, location: str) -> str:
    identifier = _string(value, location)
    if not CHECK_ID_PATTERN.fullmatch(identifier):
        raise _fail(location, "must use lowercase dot/dash/underscore segments")
    return identifier


def _relative_path(value: Any, location: str) -> str:
    path = _string(value, location)
    if "\\" in path:
        raise _fail(location, "must use POSIX separators")
    pure = PurePosixPath(path)
    if pure.is_absolute() or ".." in pure.parts:
        raise _fail(location, "must stay inside the repository")
    return pure.as_posix()


def _resolve_contract_path(path: Path, root: Path) -> tuple[Path, str]:
    root = root.resolve()
    resolved = path if path.is_absolute() else root / path
    resolved = resolved.resolve()
    try:
        relative = resolved.relative_to(root).as_posix()
    except ValueError as error:
        raise ContractError("task contract must be inside the repository") from error
    if not resolved.exists():
        raise ContractError(f"task contract does not exist: {relative}")
    if not resolved.is_file():
        raise ContractError(f"task contract is not a file: {relative}")
    if resolved.suffix != ".json":
        raise ContractError("task contract must use the .json extension")
    return resolved, relative


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ContractError(f"duplicate JSON field: {key}")
        result[key] = value
    return result


def load_task_contract(path: Path, *, root: Path) -> TaskContract:
    resolved, relative = _resolve_contract_path(path, root)
    if resolved.stat().st_size > MAX_CONTRACT_BYTES:
        raise ContractError(
            f"task contract is larger than {MAX_CONTRACT_BYTES} bytes: {relative}"
        )
    content = resolved.read_text(encoding="utf-8")
    try:
        parsed = json.loads(content, object_pairs_hook=_unique_object)
    except json.JSONDecodeError as error:
        raise ContractError(
            f"invalid JSON in task contract {relative}: {error.msg} "
            f"at line {error.lineno}, column {error.colno}"
        ) from error

    data = _mapping(parsed, relative, TOP_LEVEL_KEYS)
    version = data.get("version")
    if isinstance(version, bool) or version != CONTRACT_VERSION:
        raise _fail(relative, f"version must be {CONTRACT_VERSION}")

    task_id = _string(data.get("task_id"), f"{relative}.task_id")
    if not TASK_ID_PATTERN.fullmatch(task_id):
        raise _fail(f"{relative}.task_id", "must match TASK-NNN")
    if task_id not in resolved.name:
        raise _fail(relative, f"filename must contain task_id {task_id}")

    expected_branch = _string(
        data.get("expected_branch"), f"{relative}.expected_branch"
    )
    if any(character.isspace() for character in expected_branch):
        raise _fail(f"{relative}.expected_branch", "must not contain whitespace")

    area_values = _string_list(data.get("areas", []), f"{relative}.areas")
    unknown_areas = set(area_values).difference(ALL_AREAS)
    if unknown_areas:
        raise _fail(relative, f"unknown areas: {', '.join(sorted(unknown_areas))}")

    playwright_specs: list[PlaywrightSpec] = []
    for index, raw in enumerate(_objects(data.get("playwright"), f"{relative}.playwright")):
        location = f"{relative}.playwright[{index}]"
        raw = _mapping(
            raw,
            location,
            {"id", "spec", "projects", "timeout_seconds"},
        )
        spec = _relative_path(raw.get("spec"), f"{location}.spec")
        if not spec.startswith("e2e/") or not spec.endswith(".spec.ts"):
            raise _fail(f"{location}.spec", "must reference e2e/*.spec.ts")
        spec_path = (root / "frontend" / spec).resolve()
        try:
            spec_path.relative_to((root / "frontend" / "e2e").resolve())
        except ValueError as error:
            raise _fail(f"{location}.spec", "must stay inside frontend/e2e") from error
        if not spec_path.is_file():
            raise _fail(f"{location}.spec", f"does not exist: frontend/{spec}")
        projects = _string_list(raw.get("projects", []), f"{location}.projects")
        for project in projects:
            if not PROJECT_PATTERN.fullmatch(project):
                raise _fail(f"{location}.projects", f"invalid project {project!r}")
        playwright_specs.append(
            PlaywrightSpec(
                identifier=_identifier(raw.get("id"), f"{location}.id"),
                spec=spec,
                projects=projects,
                timeout_seconds=_timeout(
                    raw.get("timeout_seconds"), f"{location}.timeout_seconds", 1800
                ),
            )
        )

    runtime_specs: list[RuntimeSmokeSpec] = []
    for index, raw in enumerate(
        _objects(data.get("runtime_smoke"), f"{relative}.runtime_smoke")
    ):
        location = f"{relative}.runtime_smoke[{index}]"
        raw = _mapping(
            raw,
            location,
            {"id", "area", "command", "working_directory", "timeout_seconds"},
        )
        area = _string(raw.get("area"), f"{location}.area")
        if area not in ALL_AREAS:
            raise _fail(f"{location}.area", f"unknown area {area!r}")
        command = _string_list(
            raw.get("command"), f"{location}.command", unique=False
        )
        if not command:
            raise _fail(f"{location}.command", "must not be empty")
        working_directory = _relative_path(
            raw.get("working_directory", "."), f"{location}.working_directory"
        )
        working_path = (root / working_directory).resolve()
        try:
            working_path.relative_to(root.resolve())
        except ValueError as error:
            raise _fail(
                f"{location}.working_directory", "must stay inside the repository"
            ) from error
        if not working_path.is_dir():
            raise _fail(
                f"{location}.working_directory",
                f"directory does not exist: {working_directory}",
            )
        runtime_specs.append(
            RuntimeSmokeSpec(
                identifier=_identifier(raw.get("id"), f"{location}.id"),
                area=area,
                command=command,
                working_directory=working_directory,
                timeout_seconds=_timeout(
                    raw.get("timeout_seconds"), f"{location}.timeout_seconds", 600
                ),
            )
        )

    manual_specs: list[ManualCheckSpec] = []
    for index, raw in enumerate(
        _objects(data.get("manual_checks"), f"{relative}.manual_checks")
    ):
        location = f"{relative}.manual_checks[{index}]"
        raw = _mapping(raw, location, {"id", "description"})
        manual_specs.append(
            ManualCheckSpec(
                identifier=_identifier(raw.get("id"), f"{location}.id"),
                description=_string(raw.get("description"), f"{location}.description"),
            )
        )

    identifiers = [
        *(item.identifier for item in playwright_specs),
        *(item.identifier for item in runtime_specs),
        *(item.identifier for item in manual_specs),
    ]
    duplicates = sorted(
        identifier for identifier in set(identifiers) if identifiers.count(identifier) > 1
    )
    if duplicates:
        raise _fail(relative, f"duplicate identifiers: {', '.join(duplicates)}")

    return TaskContract(
        path=resolved,
        relative_path=relative,
        task_id=task_id,
        expected_branch=expected_branch,
        areas=frozenset(area_values),
        playwright=tuple(playwright_specs),
        runtime_smoke=tuple(runtime_specs),
        manual_checks=tuple(manual_specs),
        content=content,
        data=data,
        sha256=hashlib.sha256(content.encode("utf-8")).hexdigest(),
    )


def validate_contract_branch(contract: TaskContract, branch: str) -> None:
    if branch != contract.expected_branch:
        raise ContractError(
            f"stale task contract {contract.relative_path}: expects branch "
            f"{contract.expected_branch!r}, current branch is {branch!r}"
        )


def extend_impact(impact: ChangeImpact, contract: TaskContract) -> ChangeImpact:
    extended = ChangeImpact(
        areas=set(impact.areas),
        reasons={area: list(reasons) for area, reasons in impact.reasons.items()},
    )
    for area in sorted(contract.required_areas):
        extended.add(area, f"task contract {contract.task_id} requires {area}")
    return extended


def task_checks(contract: TaskContract) -> list[CheckSpec]:
    checks = [
        CheckSpec(
            item.identifier,
            "frontend",
            (
                "npm",
                "run",
                "test:e2e",
                "--",
                item.spec,
                *(f"--project={project}" for project in item.projects),
            ),
            "frontend",
            item.timeout_seconds,
        )
        for item in contract.playwright
    ]
    checks.extend(
        CheckSpec(
            item.identifier,
            item.area,
            item.command,
            item.working_directory,
            item.timeout_seconds,
        )
        for item in contract.runtime_smoke
    )
    return checks


def combine_checks(
    canonical: Iterable[CheckSpec], task_specific: Iterable[CheckSpec]
) -> list[CheckSpec]:
    combined: list[CheckSpec] = []
    identifiers: set[str] = set()
    commands: set[tuple[str, tuple[str, ...]]] = set()
    for check in (*tuple(canonical), *tuple(task_specific)):
        if check.identifier in identifiers:
            raise ContractError(f"duplicate check identifier: {check.identifier}")
        signature = (check.working_directory, check.command)
        if signature in commands:
            raise ContractError(
                f"duplicate check command for task contract check {check.identifier}"
            )
        identifiers.add(check.identifier)
        commands.add(signature)
        combined.append(check)
    return combined


def manual_check_entries(
    contract: TaskContract, confirmed: set[str], *, dry_run: bool
) -> list[dict[str, str]]:
    known = {item.identifier for item in contract.manual_checks}
    unknown = confirmed.difference(known)
    if unknown:
        raise ContractError(
            f"unknown manual check confirmations: {', '.join(sorted(unknown))}"
        )
    return [
        {
            "id": item.identifier,
            "description": item.description,
            "status": (
                "required"
                if dry_run
                else "confirmed"
                if item.identifier in confirmed
                else "not_confirmed"
            ),
        }
        for item in contract.manual_checks
    ]


def contract_evidence(
    contract: TaskContract, *, head_sha: str, head_tree_sha: str
) -> dict[str, Any]:
    return {
        "path": contract.relative_path,
        "task_id": contract.task_id,
        "expected_branch": contract.expected_branch,
        "sha256": contract.sha256,
        "verified_head_sha": head_sha,
        "verified_head_tree_sha": head_tree_sha,
        "content": contract.content,
        "parsed": contract.data,
    }
