# Reconcile backlog statuses

Use when status reconciliation is requested, or as the first stage of a full
pass. Do not read or move inbox files merely to audit task statuses.

## Establish scope and baseline

Use the current coordination workspace; do not create or switch a branch or
worktree solely for status reconciliation. Identify the integrated baseline,
preferably `origin/main`, and state the evidence and any freshness limitation.

For selected TASK IDs, inspect those cards and their directly related plans,
requirements, and completion artifacts. For a backlog-wide request, inspect
`tasks-ready/`, `risky/`, `needs-clarification/`, and `implementation/`. Search
dated `done/` folders recursively for duplicates and completion evidence.

## Reconcile from evidence

- Compare the task's goal and acceptance criteria with integrated code, tests,
  Git history, plans, and explicit product decisions. A branch, worktree,
  commit title, or existing plan is not proof of completion.
- Check status/directory consistency, duplicate active TASK IDs, plan links,
  requirements approval, and unresolved mandatory questions.
- Move a task to done only when its full result is demonstrated. Use
  `backlog/README.md` for the completion date and record `completed_at` and
  `completion_date_evidence`. Never substitute today's audit date for an
  unknown historical completion date.
- Move the completed card, plan, verification contract, and task-owned evidence
  together into the same dated directory. Update current links, including
  relative links inside moved files. Keep shared assets in place.
- Preserve historical logs; append old-to-new path mappings and corrections.
- If completion, ownership, or date remains ambiguous, record the missing
  evidence and leave the dependent move pending. Continue independent cards.

Use only necessary read-only code/runtime inspection and required validation
for changed knowledge artifacts; status reconciliation does not authorize
application fixes or remote mutations.

## Log and report

Append a `status audit` entry to `backlog/logs/triage-log.md`: baseline, scope,
completion evidence, status/path changes, scoped counts, consistency checks,
validation, and unresolved items. Record a zero-change result when applicable.

The user-facing result lists changes and blockers. Keep evidence for unchanged
cards concise in the log; do not print an unchanged-card inventory or full tree
unless requested. For a full pass, continue with triage after reconciliation.
