# CRM verification harness

## Purpose

`scripts/harness/verify_change.py` is the canonical entry point for local and
CI verification. It translates repository changes into existing layer checks,
explains the selection, executes the checks, and writes JSON evidence.

The runner does not replace the nearest `AGENTS.md`. It makes the existing
validation baseline executable and uses a full fallback when it cannot classify
an infrastructure path safely.

## Local use

Run from the repository root inside the task worktree:

```bash
python3 scripts/harness/verify_change.py --base origin/main --dry-run
python3 scripts/harness/verify_change.py --base origin/main
```

The local profile includes committed changes since the base plus staged,
unstaged, and untracked files. The default base is `origin/main`; pass the
declared task dependency when an approved implementation plan uses another
base.

`--dry-run` selects and prints checks without executing them. It still writes
the evidence report so the selection can be inspected mechanically.

## Full and scoped use

Run the complete repository baseline:

```bash
python3 scripts/harness/verify_change.py --profile full
```

Run one or more canonical areas, primarily for isolated CI jobs:

```bash
python3 scripts/harness/verify_change.py --profile full --area backend
python3 scripts/harness/verify_change.py \
  --profile full \
  --area requirements \
  --base '<pull-request-base-sha>'
```

Supported areas are `requirements`, `harness`, `backend`, `frontend`, `bot`,
and `deploy`. `--area` is intentionally accepted only with `--profile full`;
local validation must not override the impact selected from the diff.

## Change-impact rules

| Changed boundary | Selected areas |
|---|---|
| Repository knowledge or backlog | requirements |
| Harness implementation | requirements, harness |
| Backend implementation | requirements, backend |
| Staff API request/response/endpoint contract | requirements, backend, frontend |
| Internal Bot API contract | requirements, backend, bot |
| Frontend | requirements, frontend |
| Bot | requirements, bot |
| Deploy or Compose | requirements, deploy |
| Service Dockerfile | owning layer plus deploy |
| AGENTS, skills, CI, unknown script or unclassified path | full baseline |

The mapping is conservative. Add or change a rule only with a focused unit test
under `scripts/harness/tests/`.

The first increment intentionally does not infer individual Playwright specs.
For a changed user workflow, run the affected Playwright and target-iPhone
checks required by `frontend/AGENTS.md` in addition to the selected frontend
baseline, and report remaining physical-device checks explicitly.

## Evidence and failure behavior

The default report is:

```text
.artifacts/verification/report.json
```

Override it with `--report`. The report contains the profile, base, changed
paths, selected areas and reasons, commands, statuses, exit codes, and
durations. `.artifacts/` is untracked and must not contain secrets.

Execution is fail-fast, matching the existing CI job behavior. A failed check
returns a non-zero exit code, records remaining checks as `not_run`, and does
not suppress dependency or security audit failures.
