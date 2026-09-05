# Repository Agent Rules

## Scope and routing

This file always applies. A nested `AGENTS.md` adds scoped rules and overrides
this file only when the two conflict.

- Work affecting `backend/` -> read `backend/AGENTS.md`
- Work affecting `frontend/` -> read `frontend/AGENTS.md`
- Work affecting `bot/` -> read `bot/AGENTS.md`
- Work affecting `deploy/` -> read `deploy/AGENTS.md`
- Work affecting `backlog/` -> read `backlog/AGENTS.md`

Read every nested file applicable to affected producers and consumers, not
only the directory where editing starts. A shared-contract change applies to
the owning backend scope and every affected consumer scope. Paths without a
nested file use these repository-wide rules.

---

## Terminology and task scope

- **User request**: the current conversational request; it is not automatically
  a backlog artifact.
- **Backlog task/card**: a `TASK-NNN` Markdown artifact under `backlog/`.
- **Implementation task**: authorized project changes performed on a dedicated
  task branch and worktree, normally linked to a backlog card.
- **Implementation plan**: a reviewable plan artifact; it does not authorize or
  imply implementation by itself.

---

## Product requirements registry

`docs/requirements/**` is the source of truth for desired product behavior.
Every behavior-changing backlog task references an existing requirement ID
(`REQ-*`) or adds a requirement card in the same task. Updating affected cards
and `docs/requirements/CHANGELOG.md` is part of its definition of done.

Every active backlog card and unfinished implementation plan contains
requirements metadata. Behavior-preserving work may use `none` with a concrete
reason. An unresolved product decision may use `pending` only in
`backlog/needs-clarification`. Behavior-changing work is not ready for
implementation until every referenced requirement has decision `принято`;
`предложено` never authorizes implementation. Registry format, status model,
and change process are defined in `docs/requirements/README.md`.

---

## Evidence and instruction precedence

For desired behavior and product decisions, use this order:

1. An explicit user decision in the current request. Record behavior changes
   in the requirements registry in the same task.
2. Accepted `REQ-*` cards and the accepted backlog task or implementation plan
   that relates the work to them.
3. Approved UX or architecture contracts consistent with accepted requirements.
4. Applicable root and nested `AGENTS.md` process and engineering invariants.

For current behavior, prefer executable evidence:

1. Tests and public types/contracts
2. Runtime and build configuration
3. Source code
4. `docs/*` as supporting context

If sources at the same level conflict, or the requested outcome conflicts with
an architecture, security, data-retention, or deployment invariant, surface
the conflict before changing it. Documentation does not override executable
current behavior unless the task explicitly updates that behavior and its
validation.

---

## Plan decision readiness

Finish all in-scope product and material technical decisions during planning,
including UX direction selection, required reviews, contracts, migration and
rollback strategy. An executable plan contains only agreed decisions with
approval provenance; accepted requirements alone do not prove plan readiness.
Use the readiness contract and preflight in `docs/HARNESS.md` before changing
project code. Planning drafts use `readiness: no` and never authorize execution.

If new evidence requires a product or material technical choice during execution,
stop the affected plan, mark it non-ready and return it to planning. Record the
owner's decision and update the plan/REQ/ADR before repeating preflight. Do not
choose a default, silently expand scope, or request approval only after coding
the dependent behavior. Independent ready plans may continue. Routine local
implementation details within agreed contracts remain executor-owned.

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

## Architecture decision workflow

Use `.agents/skills/architecture-decision/SKILL.md` before implementing a
significant, costly-to-reverse technical choice involving layer ownership,
shared contracts, data or migration strategy, security boundaries, deployment
topology, foundational technology, or a broad structural refactor. Routine
local choices that follow existing contracts do not require an ADR.

Product behavior is decided through accepted `REQ-*` cards, not ADRs. An agent
may draft a `Proposed` ADR, but only an explicit user decision or named human
owner may mark it `Accepted`. Record decisions under `docs/architecture/adr/`
and link an applicable ADR from the implementation plan rather than duplicating
its contents.

For a cross-layer decision, obtain evidence from every affected producer and
consumer scope. Broad structural refactors also require an explicit
refactoring review; use `refactoring-specialist` when that capability is
available.

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

## Capability and skill routing

- New screens or materially changed workflows follow `frontend/AGENTS.md` and
  `.agents/skills/crm-mobile-first-ui/SKILL.md`. They must produce UX analysis,
  an implementation-ready UI specification, React implementation, and
  regression coverage in that order.
- Broad structural refactors require an explicit refactoring review; use
  `refactoring-specialist` when that capability is available.
- Layer-specific preferred capabilities and skills are defined in every
  applicable nested `AGENTS.md`.
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
- one running stack -> one isolated Docker Compose project

Before starting, resuming, or cleaning up implementation work, read and follow
`.agents/skills/task-worktree/SKILL.md`.

Keep the primary repository on `main` for coordination only. Use the
plan-declared branch verbatim; otherwise start from current `origin/main`. Stop
on ambiguous branch, worktree, base, change ownership, or dependency. The
coordinating agent owns workspace, integration, and cleanup lifecycle.

---

## Validation policy

Run verification from the repository root. `scripts/harness/commands.py` is the
single source of canonical command definitions; `.github/workflows/quality.yml`
invokes that matrix through the harness. Scoped `AGENTS.md` files define
required outcomes and additional scenario coverage, not duplicate shell
commands.

Descriptive documentation, requirements, backlog, and Markdown agent/skill
instructions use the knowledge checks selected by the harness, without installing
or testing unchanged applications. Mixed changes take the union of affected
areas. Executable resources, runtime configuration, shared contracts, explicit
task-contract additions, and unknown paths retain their required checks.
Changes to selectors or knowledge validators also run harness regression tests.

Use `python3 scripts/harness/verify_change.py --base origin/main --task-id
TASK-NNN` as the default local entry point when the task has a verification
contract; otherwise omit `--task-id`. Use `--dry-run` to inspect the selected
areas and commands. `docs/HARNESS.md` defines contract discovery, evidence,
managed runtime lifecycle, and the safe full-baseline fallback.

`--task-id` discovers the task contract. `--task-contract` is an explicit-path
diagnostic alternative; the two options are mutually exclusive. A contract may
add task-specific Playwright, runtime smoke, and manual checks but never reduce
the diff-selected baseline. Confirm a manual check only after it was performed.

- Backend changes -> formatting, Release build, dependency audit, and tests
- Frontend changes -> install/audit/check baseline plus affected Playwright flows
- Bot changes -> locked dependency sync, lint/format, typing, and tests
- Deploy/runtime changes -> both Compose configurations and affected behavior
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
