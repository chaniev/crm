"""Git change and identity collection for the CRM verification harness."""

from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class GitChange:
    status: str
    paths: tuple[str, ...]
    source: str


@dataclass(frozen=True)
class GitContext:
    head_sha: str
    base_sha: str | None
    merge_base_sha: str | None
    branch: str
    working_tree_dirty: bool
    base_error: str | None = None


def _git_bytes(root: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(
        ("git", *args),
        cwd=root,
        check=check,
        capture_output=True,
    )


def _git_text(root: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ("git", *args),
        cwd=root,
        check=check,
        capture_output=True,
        text=True,
    )


def parse_name_status(data: bytes, *, source: str) -> list[GitChange]:
    fields = data.split(b"\0")
    if fields and not fields[-1]:
        fields.pop()

    changes: list[GitChange] = []
    index = 0
    while index < len(fields):
        status = fields[index].decode("utf-8", errors="surrogateescape")
        index += 1
        path_count = 2 if status.startswith(("R", "C")) else 1
        if index + path_count > len(fields):
            raise ValueError(f"incomplete git --name-status record for {status!r}")
        paths = tuple(
            field.decode("utf-8", errors="surrogateescape")
            for field in fields[index : index + path_count]
        )
        changes.append(GitChange(status=status, paths=paths, source=source))
        index += path_count

    return changes


def collect_changes(base: str, *, root: Path) -> list[GitChange]:
    try:
        _git_text(root, "rev-parse", "--verify", f"{base}^{{commit}}")
        diff_args = (
            "--name-status",
            "-z",
            "--find-renames",
            "--find-copies",
            "--diff-filter=ACDMRT",
        )
        groups = (
            parse_name_status(
                _git_bytes(root, "diff", *diff_args, f"{base}...HEAD").stdout,
                source="committed",
            ),
            parse_name_status(
                _git_bytes(root, "diff", "--cached", *diff_args).stdout,
                source="staged",
            ),
            parse_name_status(
                _git_bytes(root, "diff", *diff_args).stdout,
                source="unstaged",
            ),
        )
        untracked = [
            GitChange(
                status="??",
                paths=(path.decode("utf-8", errors="surrogateescape"),),
                source="untracked",
            )
            for path in _git_bytes(
                root, "ls-files", "--others", "--exclude-standard", "-z"
            ).stdout.split(b"\0")
            if path
        ]
    except subprocess.CalledProcessError as error:
        stderr = error.stderr.decode("utf-8", errors="replace") if error.stderr else ""
        detail = stderr.strip() or str(error)
        raise RuntimeError(
            f"cannot resolve change set from base {base!r}: {detail}"
        ) from error

    seen: set[tuple[str, tuple[str, ...], str]] = set()
    changes: list[GitChange] = []
    for change in (*groups[0], *groups[1], *groups[2], *untracked):
        key = (change.status, change.paths, change.source)
        if key not in seen:
            seen.add(key)
            changes.append(change)
    return changes


def flatten_paths(changes: list[GitChange]) -> list[str]:
    return sorted({path for change in changes for path in change.paths})


def collect_git_context(base: str, *, root: Path) -> GitContext:
    head_sha = _git_text(root, "rev-parse", "HEAD").stdout.strip()
    branch_result = _git_text(root, "symbolic-ref", "--short", "-q", "HEAD", check=False)
    branch = branch_result.stdout.strip() or "DETACHED"
    dirty = bool(_git_bytes(root, "status", "--porcelain", "-z").stdout)

    try:
        base_sha = _git_text(root, "rev-parse", "--verify", f"{base}^{{commit}}").stdout.strip()
        merge_base_sha = _git_text(root, "merge-base", base_sha, head_sha).stdout.strip()
        base_error = None
    except subprocess.CalledProcessError as error:
        base_sha = None
        merge_base_sha = None
        base_error = error.stderr.strip() if error.stderr else str(error)

    return GitContext(
        head_sha=head_sha,
        base_sha=base_sha,
        merge_base_sha=merge_base_sha,
        branch=branch,
        working_tree_dirty=dirty,
        base_error=base_error,
    )
