# CRM verification harness

## Purpose

`scripts/harness/verify_change.py` is the canonical entry point for local and
CI verification. It translates repository changes into existing layer checks,
explains the selection, executes the checks, and writes JSON evidence.

The runner does not replace the nearest `AGENTS.md`. It makes the existing
validation baseline executable and uses a full fallback when it cannot classify
an infrastructure path safely.

`scripts/harness/commands.py` is the single source of canonical command
definitions. `AGENTS.md` files describe required outcomes and additional
scenario coverage without duplicating those commands. The requirements area
runs `scripts/harness/validate_agent_instructions.py` for every change to
validate instruction routing, repository references, command ownership,
task-contract guidance, and instruction-chain size.
It also runs `scripts/harness/validate_architecture_decisions.py` to validate
ADR naming, required sections, status and approval syntax, supersession
targets, and links to known `REQ-*` cards.

## Local use

Run from the repository root inside the task worktree:

```bash
python3 scripts/harness/verify_change.py --base origin/main --task-id TASK-123 --dry-run
python3 scripts/harness/verify_change.py --base origin/main --task-id TASK-123
```

`--task-id` discovers exactly one matching
`TASK-NNN-*verification-contract.json` in `backlog/implementation/` or
`backlog/done/YYYY-MM-DD/`. For a change with no task contract, omit the option and the
runner uses diff-aware canonical verification only.

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
to `backlog/done/YYYY-MM-DD/` when the task is completed.

Prefer discovery by task ID. An explicit path remains available for debugging:

```bash
python3 scripts/harness/verify_change.py \
  --base origin/main \
  --task-id TASK-123
```

The contract can only add areas and checks. It cannot remove anything selected
by the diff or canonical contract-boundary rules. Its filename must contain the
declared task ID, and `expected_branch` must match the current branch. A
detached CI checkout is accepted only when `--source-ref` names that expected
branch. A missing, ambiguous, malformed, misplaced or stale contract exits
before any check is executed.

Schema version 1 supports:

```json
{
  "version": 1,
  "task_id": "TASK-123",
  "expected_branch": "feature/TASK-123-client-flow",
  "areas": ["frontend"],
  "manual_evidence": "backlog/implementation/TASK-123-manual-evidence.json",
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
  "runtime_stack": {
    "compose_file": "deploy/docker-compose.yml",
    "env_file": "deploy/.env.example",
    "services": ["frontend"],
    "startup_timeout_seconds": 1800,
    "cleanup_timeout_seconds": 180,
    "readiness": [
      {
        "id": "runtime.backend-ready",
        "command": ["curl", "-fsS", "http://127.0.0.1:{backend_port}/health/ready"],
        "timeout_seconds": 180
      }
    ],
    "smoke": [
      {
        "id": "runtime.frontend-root",
        "command": ["curl", "-fsS", "http://127.0.0.1:{frontend_port}/"],
        "timeout_seconds": 30
      }
    ]
  },
  "manual_checks": [
    {
      "id": "manual.physical-iphone",
      "description": "Confirm the affected flow on a physical target iPhone."
    }
  ]
}
```

An entry may set `"config": "playwright.catalog.config.ts"` for the isolated
design-system catalog. The harness still installs the pinned browsers and runs
the spec through the same evidence collection; arbitrary Playwright config
paths are rejected. Visual failures retain Playwright's expected, actual and
diff images under `frontend/test-results/`, which the task-verification CI job
uploads as browser diagnostics.

Playwright specs must exist below `frontend/e2e`. The runner installs the
pinned Playwright browsers first, reserves a task-local E2E port, and invokes
the declared desktop/mobile projects as
`npm run test:e2e -- <spec> --project=<project>`. Traces are retained on
failure and screenshots are captured only on failure.

`runtime_stack` owns a disposable Compose lifecycle. It allocates local backend
and frontend ports, creates a unique project name, starts only the declared
service graph, retries readiness probes, runs smoke probes, and always calls
`down --remove-orphans` on success, failure, timeout or interruption. It never
uses `down -v`; retained data volumes therefore remain recoverable. Probe
commands are argv arrays executed directly without a shell and may use
`{backend_port}`, `{frontend_port}`, and `{project_name}` placeholders. The
nested runtime report records the exact project, ports, probes and cleanup
outcome. Identifiers and command signatures must be unique across canonical and
task-specific checks.

Manual checks are never inferred as completed. A dry run records them as
`required`; an execution without evidence records `not_confirmed`, finishes
automated checks, returns non-zero and gives the report status
`manual_required`. Check in agent-neutral provenance beside the task:

```json
{
  "version": 1,
  "task_id": "TASK-123",
  "actor": "coding-agent:TASK-123",
  "performed_at": "2026-08-29T12:00:00+03:00",
  "confirmations": [
    {
      "id": "manual.physical-iphone",
      "note": "Validated the affected flow on the target device.",
      "artifacts": ["docs/validation/TASK-123.md"]
    }
  ]
}
```

Every confirmation requires an actor, timestamp, note and at least one
repository-relative artifact reference. The CLI options `--confirm-manual`,
`--manual-actor`, `--manual-note`, and `--manual-artifact` are available for
local one-off evidence, but CI consumes the checked-in provenance named by
`manual_evidence` and never invents a confirmation.

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
  --task-id TASK-123 \
  --source-ref "$PULL_REQUEST_SOURCE_BRANCH" \
  --report .artifacts/verification/TASK-123.json
```

## Change-impact rules

| Changed boundary | Selected areas |
|---|---|
| Repository knowledge or backlog | requirements |
| Harness tests | requirements, harness |
| Harness implementation or command matrix | full baseline |
| Backend implementation | requirements, backend |
| Staff API request/response/endpoint contract | requirements, backend, frontend |
| Internal Bot API contract | requirements, backend, bot |
| Frontend | requirements, frontend |
| Bot | requirements, bot |
| Deploy or Compose | requirements, deploy |
| Service Dockerfile | owning layer plus deploy |
| Root `AGENTS.md`, cross-cutting skill, CI, unknown script or unclassified path | full baseline |
| Scoped `AGENTS.md` | requirements, owning layer |
| Backlog-only `AGENTS.md` or skill | requirements |
| Scoped backend/frontend skill | requirements, owning layer |

Staff API detection includes transport contracts under `GymCrm.Api` plus the
application contract locations listed in `backend/AGENTS.md`. Internal Bot API
paths are evaluated first so Bot contracts do not select frontend checks.

The mapping is conservative. Add or change a path or rule only with a focused
unit test under `scripts/harness/tests/` and keep the owning scoped
`AGENTS.md` synchronized.

The cross-cutting skill set includes
`.agents/skills/architecture-decision/`. Changes to that workflow select the
full baseline because they can alter decisions across every producer and
consumer layer. ADR documents themselves are repository knowledge and select
the requirements area, which includes ADR validation.

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
fails. Pull requests additionally run the discovered task contract from the
detached checkout and upload Playwright diagnostics.

`scripts/harness/aggregate_evidence.py` is the final merge gate. It downloads
and combines all required reports, rejects missing evidence, failures,
unconfirmed manual checks, mixed HEAD/tree identities, mixed contract digests,
or a missing task ID, and writes one immutable aggregate JSON result. A pull
request branch must contain `TASK-NNN`; this keeps task discovery portable for
Claude Code, Codex, OpenCode, Zed and other coding agents without relying on a
vendor-specific runtime or metadata format.

## Plan decision readiness

Planning must resolve every in-scope product and material technical choice,
including rendered UX selection, required reviews, API/data contracts and
migration/rollback. Execution verifies and implements those decisions. It must
not contain a step to choose behavior, approve a design or settle architecture.
Routine local code details that preserve agreed contracts remain executor-owned.

The canonical `requirements.plan-readiness` check runs for every locally selected
requirements baseline and the requirements CI job, without a task verification
contract. It scans unfinished `*.plan.md` files and requires exactly one ready
plan for each task in `backlog/implementation`. Historical `backlog/done` plans
are not retroactively rewritten or treated as active approvals.

Before changing project code, run the explicit preflight from the repository root:

```bash
python3 scripts/harness/validate_plan_readiness.py \
  --plan backlog/implementation-plans/TASK-123-example.plan.md
```

A dry run of `verify_change.py` only selects checks; it does not replace this
preflight. `--plan` requires `readiness: yes`; the repository-wide validator also
allows planning drafts with `readiness: no — concrete blocker`, outside active
implementation. Missing metadata never implies acceptance. Existing drafts must
be reviewed and receive real approval evidence before becoming executable.

Ready plans use exactly one of each field inside `## Metadata`:

- `source_task`: matching existing repository-local task path.
- `branch`: the declared implementation branch.
- `readiness: yes`.
- `requirements`: accepted `REQ-*` references, or `none — concrete reason`.
- `product_decisions` and `technical_decisions`: `accepted`, or
  `none — concrete reason` when no such decision is needed.
- `architecture_decisions`: applicable `ADR-NNNN` IDs, or `none — concrete reason`.
- `open_questions: none`.

`## Decisions and contracts` states the agreed outcome. `## Decision evidence`
links repository-local approval records; paths resolve from the repository root.
Each category marked `accepted` requires a line in this format:

```markdown
- product: [Approval record](/path/to/record.md) — owner: actual owner; decision: exact agreed behavior.
- technical: [Accepted ADR](/docs/architecture/adr/0001-example.md) — owner: actual owner; decision: exact agreed contract.
```

Use actual sources and owners, never generated approval claims. An existing user
decision or accepted requirement is sufficient provenance for its exact scope;
do not request the same approval again. If both categories are `none`, link the
source task explaining why behavior/contracts are preserved. The validator checks
source existence, required evidence fields, accepted requirements, and Accepted
status for every referenced ADR, including ADR paths omitted from metadata.

This is a structural gate, not a natural-language proof of approval. The planner
must review the full plan for undeclared choices, incompatible alternatives and
approval deferred into slices or manual checks. Writing `accepted` cannot create
owner authorization. UX approval is a planning input; comparing implemented UI
against that already selected direction remains execution validation.

If execution reveals a new decision, mark the plan non-ready, record the blocker
and return the task to planning (`needs-clarification`, or `risky` for review-only
work). Stop the affected plan until the owner resolves it, update plan/REQ/ADR and
approval evidence, then rerun preflight. Other independently ready plans may run.
