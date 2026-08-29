"""Load and validate task-specific CRM verification contracts."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
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
    "manual_evidence",
    "runtime_stack",
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
class RuntimeProbeSpec:
    identifier: str
    command: tuple[str, ...]
    timeout_seconds: float


@dataclass(frozen=True)
class RuntimeStackSpec:
    compose_file: str
    env_file: str
    services: tuple[str, ...]
    startup_timeout_seconds: float
    cleanup_timeout_seconds: float
    readiness: tuple[RuntimeProbeSpec, ...]
    smoke: tuple[RuntimeProbeSpec, ...]


@dataclass(frozen=True)
class ManualCheckSpec:
    identifier: str
    description: str


@dataclass(frozen=True)
class ManualConfirmation:
    identifier: str
    actor: str
    performed_at: str
    note: str
    artifacts: tuple[str, ...]


@dataclass(frozen=True)
class ManualEvidence:
    path: Path
    relative_path: str
    task_id: str
    confirmations: tuple[ManualConfirmation, ...]
    sha256: str


@dataclass(frozen=True)
class TaskContract:
    path: Path
    relative_path: str
    task_id: str
    expected_branch: str
    areas: frozenset[str]
    playwright: tuple[PlaywrightSpec, ...]
    runtime_smoke: tuple[RuntimeSmokeSpec, ...]
    runtime_stack: RuntimeStackSpec | None
    manual_checks: tuple[ManualCheckSpec, ...]
    manual_evidence: str | None
    content: str
    data: dict[str, Any]
    sha256: str

    @property
    def required_areas(self) -> set[str]:
        areas = set(self.areas)
        if self.playwright:
            areas.add("frontend")
        areas.update(check.area for check in self.runtime_smoke)
        if self.runtime_stack is not None:
            areas.add("deploy")
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


def _artifact_paths(value: Any, location: str) -> tuple[str, ...]:
    paths = _string_list(value, location)
    if not paths:
        raise _fail(location, "must contain at least one artifact")
    return tuple(
        _relative_path(path, f"{location}[]") for path in paths
    )


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


def discover_task_contract(task_id: str, *, root: Path) -> Path:
    if not TASK_ID_PATTERN.fullmatch(task_id):
        raise ContractError("task ID must match TASK-NNN")
    candidates: list[Path] = []
    for directory in (root / "backlog" / "implementation", root / "backlog" / "done"):
        if directory.is_dir():
            candidates.extend(
                path
                for path in directory.glob(f"{task_id}-*verification-contract.json")
                if path.is_file()
            )
    candidates = sorted({path.resolve() for path in candidates})
    if not candidates:
        raise ContractError(f"no verification contract found for {task_id}")
    if len(candidates) > 1:
        rendered = ", ".join(
            path.relative_to(root.resolve()).as_posix() for path in candidates
        )
        raise ContractError(
            f"multiple verification contracts found for {task_id}: {rendered}"
        )
    return candidates[0]


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
    for index, raw in enumerate(
        _objects(data.get("playwright"), f"{relative}.playwright")
    ):
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

    runtime_stack: RuntimeStackSpec | None = None
    if data.get("runtime_stack") is not None:
        location = f"{relative}.runtime_stack"
        raw_stack = _mapping(
            data["runtime_stack"],
            location,
            {
                "compose_file",
                "env_file",
                "services",
                "startup_timeout_seconds",
                "cleanup_timeout_seconds",
                "readiness",
                "smoke",
            },
        )
        compose_file = _relative_path(
            raw_stack.get("compose_file"), f"{location}.compose_file"
        )
        env_file = _relative_path(
            raw_stack.get("env_file"), f"{location}.env_file"
        )
        for field_name, file_path in (
            ("compose_file", compose_file),
            ("env_file", env_file),
        ):
            if not (root / file_path).is_file():
                raise _fail(
                    f"{location}.{field_name}", f"does not exist: {file_path}"
                )
        services = _string_list(
            raw_stack.get("services"), f"{location}.services"
        )
        if not services:
            raise _fail(f"{location}.services", "must not be empty")
        for service in services:
            if not PROJECT_PATTERN.fullmatch(service):
                raise _fail(
                    f"{location}.services", f"invalid service {service!r}"
                )

        def probes(field_name: str) -> tuple[RuntimeProbeSpec, ...]:
            result: list[RuntimeProbeSpec] = []
            for index, raw_probe in enumerate(
                _objects(raw_stack.get(field_name), f"{location}.{field_name}")
            ):
                probe_location = f"{location}.{field_name}[{index}]"
                raw_probe = _mapping(
                    raw_probe,
                    probe_location,
                    {"id", "command", "timeout_seconds"},
                )
                command = _string_list(
                    raw_probe.get("command"),
                    f"{probe_location}.command",
                    unique=False,
                )
                if not command:
                    raise _fail(f"{probe_location}.command", "must not be empty")
                result.append(
                    RuntimeProbeSpec(
                        identifier=_identifier(
                            raw_probe.get("id"), f"{probe_location}.id"
                        ),
                        command=command,
                        timeout_seconds=_timeout(
                            raw_probe.get("timeout_seconds"),
                            f"{probe_location}.timeout_seconds",
                            120,
                        ),
                    )
                )
            return tuple(result)

        readiness = probes("readiness")
        smoke = probes("smoke")
        if not readiness or not smoke:
            raise _fail(location, "readiness and smoke must both contain checks")
        runtime_stack = RuntimeStackSpec(
            compose_file=compose_file,
            env_file=env_file,
            services=services,
            startup_timeout_seconds=_timeout(
                raw_stack.get("startup_timeout_seconds"),
                f"{location}.startup_timeout_seconds",
                1800,
            ),
            cleanup_timeout_seconds=_timeout(
                raw_stack.get("cleanup_timeout_seconds"),
                f"{location}.cleanup_timeout_seconds",
                180,
            ),
            readiness=readiness,
            smoke=smoke,
        )

    identifiers = [
        *(item.identifier for item in playwright_specs),
        *(item.identifier for item in runtime_specs),
        *(item.identifier for item in manual_specs),
        *(item.identifier for item in (runtime_stack.readiness if runtime_stack else ())),
        *(item.identifier for item in (runtime_stack.smoke if runtime_stack else ())),
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
        runtime_stack=runtime_stack,
        manual_checks=tuple(manual_specs),
        manual_evidence=(
            _relative_path(data.get("manual_evidence"), f"{relative}.manual_evidence")
            if data.get("manual_evidence") is not None
            else None
        ),
        content=content,
        data=data,
        sha256=hashlib.sha256(content.encode("utf-8")).hexdigest(),
    )


def validate_contract_ref(
    contract: TaskContract, *, branch: str, source_ref: str | None
) -> None:
    if branch == contract.expected_branch:
        if source_ref is not None and source_ref != contract.expected_branch:
            raise ContractError(
                f"stale task contract {contract.relative_path}: source ref "
                f"{source_ref!r} does not match {contract.expected_branch!r}"
            )
        return
    if branch == "DETACHED" and source_ref == contract.expected_branch:
        return
    if branch == "DETACHED":
        raise ContractError(
            f"stale task contract {contract.relative_path}: source ref "
            f"{source_ref!r} does not match {contract.expected_branch!r}"
        )
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
    checks: list[CheckSpec] = []
    if contract.playwright:
        checks.append(
            CheckSpec(
                "frontend.playwright.install",
                "frontend",
                ("npm", "run", "test:e2e:install"),
                "frontend",
                1200,
            )
        )
    checks.extend(
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
    )
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
    if contract.runtime_stack is not None:
        total_timeout = (
            contract.runtime_stack.startup_timeout_seconds
            + contract.runtime_stack.cleanup_timeout_seconds
            + sum(item.timeout_seconds for item in contract.runtime_stack.readiness)
            + sum(item.timeout_seconds for item in contract.runtime_stack.smoke)
            + 60
        )
        checks.append(
            CheckSpec(
                "runtime.stack",
                "deploy",
                (
                    "python3",
                    "scripts/harness/runtime_stack.py",
                    "--task-contract",
                    contract.relative_path,
                    "--report",
                    f".artifacts/verification/{contract.task_id}-runtime.json",
                ),
                ".",
                total_timeout,
            )
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


def load_manual_evidence(
    path: Path, *, contract: TaskContract, root: Path
) -> ManualEvidence:
    resolved, relative = _resolve_contract_path(path, root)
    content = resolved.read_text(encoding="utf-8")
    try:
        parsed = json.loads(content, object_pairs_hook=_unique_object)
    except json.JSONDecodeError as error:
        raise ContractError(
            f"invalid JSON in manual evidence {relative}: {error.msg}"
        ) from error
    data = _mapping(parsed, relative, {"version", "task_id", "confirmations"})
    if data.get("version") != 1:
        raise _fail(relative, "version must be 1")
    task_id = _string(data.get("task_id"), f"{relative}.task_id")
    if task_id != contract.task_id:
        raise _fail(relative, f"task_id must be {contract.task_id}")
    confirmations: list[ManualConfirmation] = []
    known = {item.identifier for item in contract.manual_checks}
    for index, raw in enumerate(
        _objects(data.get("confirmations"), f"{relative}.confirmations")
    ):
        location = f"{relative}.confirmations[{index}]"
        raw = _mapping(
            raw, location, {"id", "actor", "performed_at", "note", "artifacts"}
        )
        identifier = _identifier(raw.get("id"), f"{location}.id")
        if identifier not in known:
            raise _fail(location, f"unknown manual check {identifier}")
        performed_at = _string(raw.get("performed_at"), f"{location}.performed_at")
        try:
            parsed_time = datetime.fromisoformat(performed_at.replace("Z", "+00:00"))
        except ValueError as error:
            raise _fail(
                f"{location}.performed_at", "must be an ISO-8601 timestamp"
            ) from error
        if parsed_time.tzinfo is None:
            raise _fail(f"{location}.performed_at", "must include a timezone")
        confirmations.append(
            ManualConfirmation(
                identifier=identifier,
                actor=_string(raw.get("actor"), f"{location}.actor"),
                performed_at=performed_at,
                note=_string(raw.get("note"), f"{location}.note"),
                artifacts=_artifact_paths(
                    raw.get("artifacts", []), f"{location}.artifacts"
                ),
            )
        )
    identifiers = [item.identifier for item in confirmations]
    if len(identifiers) != len(set(identifiers)):
        raise _fail(relative, "contains duplicate manual confirmations")
    return ManualEvidence(
        path=resolved,
        relative_path=relative,
        task_id=task_id,
        confirmations=tuple(confirmations),
        sha256=hashlib.sha256(content.encode("utf-8")).hexdigest(),
    )


def manual_evidence_from_cli(
    *,
    contract: TaskContract,
    confirmed: list[str],
    actor: str,
    note: str,
    artifacts: list[str],
) -> ManualEvidence:
    known = {item.identifier for item in contract.manual_checks}
    unknown = set(confirmed).difference(known)
    if unknown:
        raise ContractError(
            f"unknown manual check confirmations: {', '.join(sorted(unknown))}"
        )
    performed_at = datetime.now(timezone.utc).isoformat()
    confirmations = tuple(
        ManualConfirmation(
            identifier=identifier,
            actor=_string(actor, "manual actor"),
            performed_at=performed_at,
            note=_string(note, "manual note"),
            artifacts=_artifact_paths(artifacts, "manual artifacts"),
        )
        for identifier in confirmed
    )
    serialized = json.dumps(
        {
            "task_id": contract.task_id,
            "confirmations": [
                {
                    "id": item.identifier,
                    "actor": item.actor,
                    "performed_at": item.performed_at,
                    "note": item.note,
                    "artifacts": list(item.artifacts),
                }
                for item in confirmations
            ],
        },
        sort_keys=True,
    )
    return ManualEvidence(
        path=Path("<cli>"),
        relative_path="<cli>",
        task_id=contract.task_id,
        confirmations=confirmations,
        sha256=hashlib.sha256(serialized.encode("utf-8")).hexdigest(),
    )


def manual_check_entries(
    contract: TaskContract,
    evidence: ManualEvidence | None,
    *,
    dry_run: bool,
) -> list[dict[str, Any]]:
    confirmed = {
        item.identifier: item for item in evidence.confirmations
    } if evidence is not None else {}
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
            **(
                {
                    "actor": confirmed[item.identifier].actor,
                    "performed_at": confirmed[item.identifier].performed_at,
                    "note": confirmed[item.identifier].note,
                    "artifacts": list(confirmed[item.identifier].artifacts),
                    "evidence_path": evidence.relative_path,
                    "evidence_sha256": evidence.sha256,
                }
                if item.identifier in confirmed and evidence is not None
                else {}
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
