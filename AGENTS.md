# Repository Agent Rules

## Routing

- Tasks in `backend/` -> read `backend/AGENTS.md`
- Tasks in `frontend/` -> read `frontend/AGENTS.md`
- Tasks in `bot/` -> read `bot/AGENTS.md`
- Tasks in `deploy/` -> read `deploy/AGENTS.md`

Root file defines repository-wide architecture and coordination rules only.

---

## Source of truth priority

1. User request
2. Nearest `AGENTS.md`
3. Source code, types, tests, configs
4. Runtime/build configs
5. `docs/*` as additional context only

---

## Architecture invariants

Backend owns CRM business logic:
- roles
- permissions
- access scope
- memberships
- attendance
- audit semantics
- validation semantics
- ProblemDetails contracts

Frontend and bot must not duplicate domain rules.

---

## Cross-layer rules

If backend contract changes:
- update all consumers
- validate both sides

If runtime/infrastructure changes:
- validate affected services

If UX changes significantly:
- involve `ui-designer`

If workflow or usability is unclear:
- involve `ux-researcher`

If refactoring changes structure broadly:
- involve `refactoring-specialist`

---

## UI design and implementation workflow

For every new screen or substantial interface redesign:

1. `ux-researcher` analyzes the user task and produces a UX contract.
2. `ui-designer` converts the UX contract into an implementation-ready mobile-first specification.
3. Product uncertainties that affect the workflow are resolved before implementation.
4. `react-specialist` implements the approved specification with React, Mantine, and Onest.
5. `test-automator` adds regression coverage for the primary mobile workflow.
6. The coordinating agent verifies the result against the UX contract and acceptance criteria.

Required project skill:
- `.agents/skills/crm-mobile-first-ui/SKILL.md`

Optional visual-generation skill:
- `.agents/skills/design-first-ui-prompting/SKILL.md` only when the deliverable includes a prompt for an external UI generator, a static visual concept, a demo, or a landing page;
- it is not the source of truth for CRM product workflows, responsive behavior, accessibility, or implementation acceptance.

Complementary implementation and audit skills:
- `.agents/skills/react-best-practices/SKILL.md` for React implementation,
  review, performance, state flow, data loading, effects, and refactoring;
- `.agents/skills/web-design-guidelines/SKILL.md` only for an explicitly
  requested independent accessibility or interface-compliance audit;
- `.agents/skills/csharp-xunit/SKILL.md` when creating or substantially
  restructuring backend xUnit tests.

Generic skill guidance never overrides the nearest `AGENTS.md`, existing
project contracts and tests, the approved UX contract, Mantine/Onest patterns,
or the CRM business rules owned by backend.

Rules:
- design at 390 x 844 first as the narrow mobile stress baseline;
- before tablet and desktop sign-off, validate the target iPhone Air 420 x 912 and iPhone 17 Pro Max 440 x 956 screen sizes;
- define compact-height behavior for 912 x 420 and 956 x 440 landscape layouts;
- every visible control must support a defined user operation;
- primary operations must not be hidden in overflow menus;
- rare or exceptional operations must not compete visually with the primary action;
- a small local visual correction may start with `ui-designer`;
- do not skip UX analysis for a new or materially changed workflow;
- do not treat horizontal scrolling of desktop content as mobile adaptation.
- fixed and sticky mobile controls must respect safe areas and remain reachable when Safari chrome or the software keyboard reduces the visible viewport.

---

## Backlog capture

`backlog/` stores improvement intake and follow-up work:
flowchart TD
    I["inbox"] --> P["processing"]
    P --> C["needs-clarification"]
    P --> R["risky"]
    P --> T["tasks-ready"]
    T --> IP["implementation-plans"]
    IP --> IM["implementation"]
    IM --> D["done"]
    P --> PR["processed"]

When the user writes `зафиксируй`, create `backlog/inbox/YYYY-MM-DD.md` for the current date if it does not exist, then append everything written after the first `зафиксируй` into that file. Treat the typo `зафикчируй` as the same trigger if the user writes it.


---

## Git branch policy

Every implementation task MUST be executed in a dedicated git branch.

Rules:
- one implementation task -> one separate branch;
- never implement multiple unrelated tasks in the same branch;
- branch creation is mandatory before any code changes;
- implementation plans must explicitly mention the branch name;
- implementation execution must stop if the current branch is unclear or dirty.


Additional branch constraints:
- all task branches MUST be created from the main branch;
- do not create branches from other feature/fix/refactor branches;
- before creating a task branch:
  - checkout main;
  - pull latest changes;
  - verify clean git status.

Recommended flow:

```text
git checkout main
git pull
git checkout -b feature/TASK-XXX-short-name
```

Recommended branch naming:

```text
feature/TASK-XXX-short-name
fix/TASK-XXX-short-name
refactor/TASK-XXX-short-name
```

If multiple subtasks are implemented independently, each subtask should receive its own branch.

Implementation plans should include:

```md
## Git branch
feature/TASK-XXX-short-name
```

Before implementation starts:
1. verify current git status;
2. create a dedicated branch;
3. ensure branch matches the task being implemented.

Do not mix:
- risky experiments;
- refactoring;
- unrelated fixes;
- multiple backlog tasks

inside one branch.

---

## Required validation

Backend changes:
- run backend tests

Frontend changes:
- run lint + build

Bot changes:
- run ruff + pytest

Contract/runtime changes:
- validate all affected layers

---

## Forbidden patterns

- Duplicating CRM rules outside backend
- Mixing transport and domain logic
- Hidden cross-layer coupling
- Large unstructured files
- Bypassing validation/audit semantics
- Adding unrelated refactoring to feature tasks
