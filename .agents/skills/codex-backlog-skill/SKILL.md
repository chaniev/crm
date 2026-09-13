---
name: codex-backlog-skill
description: Create or update backlog cards from inbox notes, or reconcile task statuses against integrated code. Use for requested triage or status reconciliation within the selected scope.
---

# Backlog triage and status reconciliation

Turn source notes into traceable tasks or reconcile existing task statuses.
Read the root and `backlog/AGENTS.md`; use `backlog/README.md` for status,
completion-date, and archive conventions. These operations do not authorize
project-code changes, implementation, or deployment.

## Select the requested mode

| Request | Mode and reference |
|---|---|
| Process selected notes, process inbox, or invoke this skill without a status-audit request | **Triage** — [triage workflow](references/triage.md) |
| Reconcile statuses, check which tasks are complete, or actualize backlog state | **Status reconciliation** — [status workflow](references/status-reconciliation.md) |
| Explicitly request both operations or a full backlog pass | **Full pass** — status reconciliation, then triage, using both references |

State the selected mode and scope briefly. Respect explicit file or TASK-ID
selection. Triage checks duplicates and related tasks; it does not require a
repository-wide status audit. Status reconciliation does not process inbox
unless requested. An empty inbox ends triage after a short log entry; it does
not trigger another mode. For a full pass, perform the requested status audit
even if the inbox is empty.

Load only the selected workflow reference. Read the
[task template](references/task-template.md) when creating a card; do not load
it merely to reconcile statuses. The root capture trigger handles raw note
capture separately and does not imply triage.

## Classify the actual change

Evaluate the proposed behavior and failure consequences, not just the names of
the affected modules:

- `needs-clarification`: the desired result, scope, or a material product or
  architecture decision remains unresolved after inspecting available evidence.
- `risky`: a concrete change to authorization, money, data, compatibility,
  critical domain behavior, or recovery requires explicit human review. Record the
  failure mechanism, affected users/data, required review, and stop conditions.
- `tasks-ready`: the result is clear, accepted requirements are present when
  behavior changes, and the bounded change needs no unresolved special review.

Permissions, memberships, billing, migrations, scheduling, jobs, caching, and
import/export are prompts for impact analysis, not automatic risk labels. A
permission-description typo or a test of an existing access denial can remain
behavior-preserving work; changing who may access a client record requires
security review. If material risk cannot be established without a missing
decision, record that question rather than assuming safety.

## Requirements and source integrity

Every created or updated active card must satisfy the requirements metadata
contract in `backlog/AGENTS.md`. Read `docs/requirements/README.md` when mapping
or changing requirements. Use accepted `REQ-*` for product behavior, `none`
with a concrete behavior-preserving reason, or `pending` only in
`needs-clarification`. Proposed requirements do not authorize ready/risky
implementation preparation. Do not invent approvals or product rules.

Preserve original notes and append-only historical logs. Search active cards,
unfinished plans, and all dated `backlog/done/` directories for duplicates and
TASK-ID allocation. Check related code and accepted decisions as needed to
distinguish an existing task from a new regression; do not rewrite unrelated
statuses during this check.

## Validate and report

Use the root verification harness for changed artifacts. Verify affected
links, IDs, status/directory consistency, source traceability, requirements,
and colocated completed task/plan/evidence sets. Report unresolved blockers
without guessing and finish independent in-scope items when possible.

Append a concise entry to `backlog/logs/triage-log.md` identifying mode, scope,
evidence, changed paths, counts within that scope, validation, and unresolved
items. Record a zero-change result when applicable. Report outcomes and links
to changed artifacts; omit the full backlog tree and unchanged-card inventory
unless the user requests them. Do not claim a global audit after scoped triage.
