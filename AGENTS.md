# Repository Agent Rules

## Scope and routing

This file always applies. A nested `AGENTS.md` adds scoped rules and overrides
this file only when the two conflict.

- Tasks in `backend/` -> read `backend/AGENTS.md`
- Tasks in `frontend/` -> read `frontend/AGENTS.md`
- Tasks in `bot/` -> read `bot/AGENTS.md`
- Tasks in `deploy/` -> read `deploy/AGENTS.md`
- Tasks in `backlog/` -> read `backlog/AGENTS.md`

Paths without a nested file use these repository-wide rules.

---

## Product requirements registry

`docs/requirements/**` is the source of truth for desired product behavior.
Every task that adds or changes system behavior must reference an existing
requirement ID (`REQ-*`) from the registry, or add a new requirement card as
part of the same task. Updating the affected `REQ-*` cards and
`docs/requirements/CHANGELOG.md` is part of the task's definition of done.
A task or implementation plan must contain requirements metadata. A task that
does not change product behavior may use `none` with a concrete reason. A task
with an unresolved product decision may use `pending` only while it remains in
`backlog/needs-clarification`. A behavior-changing task is not ready for
implementation until every referenced requirement has product decision
`принято`; `предложено` never authorizes implementation. Registry format,
status model, and change process are defined in `docs/requirements/README.md`.

---

## Evidence and instruction precedence

For desired behavior, use this order:

1. Explicit user request and the accepted task or implementation plan
2. Applicable root and nested `AGENTS.md` files
3. Approved UX or architecture contracts

For current behavior, prefer executable evidence:

1. Tests and public types/contracts
2. Runtime and build configuration
3. Source code
4. `docs/*` as supporting context

If the requested outcome conflicts materially with an architecture, security,
data-retention, or deployment invariant, surface the conflict before changing
the invariant. Documentation does not override executable behavior unless the
task explicitly updates that behavior and its validation.

---

## Architecture invariants

Backend owns CRM business logic, including:

- roles, permissions, and access scope
- memberships and attendance
- audit and validation semantics
- persistence consistency
- public and internal API contracts
- ProblemDetails contracts

Frontend and bot consume backend decisions. They must not independently derive
or duplicate CRM domain rules.

---

## Cross-layer change impact

| Change | Required synchronization |
|---|---|
| Staff API contract | Update `frontend/src/lib/api/**`, its facade exports, affected UI, and consumer tests |
| Internal Bot API contract | Update `bot/src/gym_crm_bot/crm/**` and backend/bot contract tests |
| Permission or domain semantics | Add backend authorization/domain coverage; consumers render backend decisions |
| ProblemDetails or validation contract | Update backend contract tests and affected frontend/bot error mapping |
| Runtime variable | Update service binding, both Compose files, `deploy/.env.example`, and operational docs |
| Database schema | Follow `backend/AGENTS.md`; validate clean bootstrap and every retained-database upgrade path |

Runtime or infrastructure changes must validate every affected service. Do not
change a shared contract without updating and validating all consumers in the
same task or an explicitly approved coordinated dependency.

---

## Specialist and skill routing

- New screens or materially changed workflows follow `frontend/AGENTS.md` and
  `.agents/skills/crm-mobile-first-ui/SKILL.md`: UX analysis, UI specification,
  React implementation, and regression coverage are required in that order.
- Broad structural refactors involve `refactoring-specialist`.
- Layer-specific specialists and skills are defined in the nearest
  `AGENTS.md`.
- Generic skill guidance never overrides applicable repository instructions,
  executable contracts, or backend-owned CRM rules.

---

## Backlog capture

When the user writes `зафиксируй`, create
`backlog/inbox/YYYY-MM-DD.md` for the current date if it does not exist, then
append everything after the first `зафиксируй`. Treat `зафикчируй` as the same
trigger. Follow `backlog/AGENTS.md` for all other backlog workflow rules.

---

## Git task workspace policy

Every implementation task uses an isolated task workspace:

- one task -> one dedicated branch
- one task -> one dedicated Git worktree
- one worktree -> one coding-agent session
- one running stack -> one isolated Docker Compose project

Before starting, resuming, or cleaning up implementation work, read and follow
`.agents/skills/task-worktree/SKILL.md`.

Non-negotiable boundaries:

- The primary repository directory remains on `main` and is used only for
  coordination and repository administration.
- Task branches start from current `origin/main` unless an implementation plan
  declares and the user approves another dependency.
- A plan-declared branch must be used verbatim.
- Stop when the branch, worktree, base, ownership of existing changes, or
  inter-task dependency is ambiguous.
- Do not mix unrelated fixes, experiments, or refactors into the task.
- The coordinating agent owns branch, worktree, integration, and cleanup
  lifecycle. Specialists do not create or remove worktrees unless assigned.

---

## Validation policy

Run commands from the repository root unless the nearest `AGENTS.md` says
otherwise. The commands in `.github/workflows/quality.yml` are the CI baseline;
keep scoped validation instructions synchronized with them.

Use `python3 scripts/harness/verify_change.py --base origin/main` as the default
local entry point for change-aware validation. Use `--dry-run` to inspect the
selected areas and commands. `docs/HARNESS.md` defines the runner contract and
safe full-baseline fallback.

- Backend changes -> backend format, Release build, dependency audit, and tests
- Frontend changes -> the canonical frontend check, plus affected Playwright flows
- Bot changes -> locked dependency sync, lint/format, typing, and tests
- Deploy/runtime changes -> both Compose configurations and affected service behavior
- Contract changes -> all affected producers and consumers
- Instruction or CI changes -> verify paths, command syntax, and the affected validation entry points

Report checks that could not run and the exact environment dependency that
remains unverified. Do not suppress security or dependency audit failures to
make validation green.

---

## Code review rules

Prioritize behavior, security, data, authorization, audit, contract, and
operability defects. Leave formatting and mechanical lint enforcement to CI.

Flag:

- CRM rules duplicated outside backend
- transport, UI, persistence, and domain responsibilities mixed together
- hidden cross-layer coupling or unsynchronized contract changes
- validation, authorization, idempotency, or audit semantics bypassed
- destructive data/runtime changes without an explicit migration or rollback path
- unrelated refactoring included in a scoped feature or fix
