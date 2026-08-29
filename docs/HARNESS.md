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
unstaged, and untracked files. Deleted paths are retained, and both the old and
new path of a rename or copy participate in impact selection. The default base
is `origin/main`; pass the declared task dependency when an approved
implementation plan uses another base.

`--dry-run` selects and prints checks without executing them. It still writes
the evidence report so the selection can be inspected mechanically.

Each canonical check has an explicit timeout. For unusually slow local or CI
environments, multiply all configured limits by a positive value:

```bash
python3 scripts/harness/verify_change.py --timeout-scale 1.5
```

When the local diff is empty, the runner reports `(no changed paths)` and runs
requirements traceability only. The full profile continues to state that its
diff was intentionally not inspected.

## Task verification contracts

An implementation task may add a repository-local JSON contract when its
verification cannot be derived from changed paths alone. Keep the active
contract beside the task in `backlog/implementation/` and move both artifacts
to `backlog/done/` when the task is completed.

Run it explicitly from the declared task branch:

```bash
python3 scripts/harness/verify_change.py \
  --base origin/main \
  --task-contract backlog/implementation/TASK-123-verification.json
```

The contract can only add areas and checks. It cannot remove anything selected
by the diff or canonical contract-boundary rules. Its filename must contain the
declared task ID, and `expected_branch` must match the current branch; a missing,
malformed, misplaced or stale contract exits before any check is executed.

Schema version 1 supports:

```json
{
  "version": 1,
  "task_id": "TASK-123",
  "expected_branch": "feature/TASK-123-client-flow",
  "areas": ["frontend"],
  "playwright": [
    {
      "id": "frontend.e2e.client-flow",
      "spec": "e2e/client-profile-context-navigation.spec.ts",
      "projects": ["chromium"],
      "timeout_seconds": 1800
    },
    {
      "id": "frontend.e2e.client-flow-iphone",
      "spec": "e2e/iphone-target-devices.spec.ts",
      "projects": ["iphone-air-webkit", "iphone-17-pro-max-webkit"],
      "timeout_seconds": 1800
    }
  ],
  "runtime_smoke": [
    {
      "id": "deploy.smoke.readiness",
      "area": "deploy",
      "working_directory": ".",
      "command": ["curl", "-fsS", "http://127.0.0.1:8080/health/ready"],
      "timeout_seconds": 600
    }
  ],
  "manual_checks": [
    {
      "id": "manual.physical-iphone",
      "description": "Confirm the affected flow on a physical target iPhone."
    }
  ]
}
```

Playwright specs must exist below `frontend/e2e`, and the runner invokes them as
`npm run test:e2e -- <spec> --project=<project>`. Runtime smoke commands are
argv arrays executed directly without a shell; their working directory must
remain inside the repository. Identifiers and command signatures must be unique
across canonical and task-specific checks.

Manual checks are never inferred as completed. A dry run records them as
`required`; an execution without confirmation records `not_confirmed`, finishes
automated checks, returns non-zero and gives the report status
`manual_required`. Confirm completed checks explicitly:

```bash
python3 scripts/harness/verify_change.py \
  --task-contract backlog/implementation/TASK-123-verification.json \
  --confirm-manual manual.physical-iphone
```

Do not put secrets, tokens or personal data in a contract. The validated JSON
content and its SHA-256 digest are intentionally copied into evidence.

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

A task-aware CI job uses the pull-request base together with the checked-in
contract, for example:

```bash
python3 scripts/harness/verify_change.py \
  --base "$PULL_REQUEST_BASE_SHA" \
  --task-contract backlog/implementation/TASK-123-verification.json \
  --report .artifacts/verification/TASK-123.json
```

CI must not synthesize `--confirm-manual` values. Manual confirmations belong
to evidence from the person or agent that actually performed the check.

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

Impact analysis intentionally does not guess individual Playwright specs. For a
changed user workflow, enumerate the affected desktop and target-iPhone specs
in its task contract. Continue to report physical-device checks explicitly.

## Evidence and failure behavior

The default report is:

```text
.artifacts/verification/report.json
```

Override it with `--report`. The report contains the profile, base, changed
paths and Git statuses, selected areas and reasons, commands, statuses, exit
codes, and durations. It also records the runner version, HEAD, resolved base,
merge base, branch, dirty state, relevant tool versions, timestamps, and a
strict allowlist of non-secret `GITHUB_*` metadata. `.artifacts/` is untracked
and must not contain secrets.

Report writes are atomic. Execution is fail-fast, matching the existing CI job
behavior. A failed check returns a non-zero exit code, records remaining checks
as `not_run`, and does not suppress dependency or security audit failures.
Controlled failures use distinct statuses: `timed_out`, `interrupted`, and
`spawn_failed`. The runner terminates the complete process group on timeout or
interruption and still finalizes the JSON evidence.

With a task contract, evidence also contains its task ID, repository path,
validated content, SHA-256 digest, expected branch, verified HEAD/tree, manual
statuses and selection reasons for every automated check. This lets any coding
agent or CI job prove which diff rules and task requirements produced the run.

Every Quality workflow job writes a unique report, appends its outcome to the
GitHub job summary, and uploads the JSON as a 14-day artifact even when a check
fails.
