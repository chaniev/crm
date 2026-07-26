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

Repository workflow skill:
- `.agents/skills/task-worktree/SKILL.md` before starting, resuming, or cleaning
  up any implementation task workspace.

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

## Git task workspace policy

Every implementation task MUST use an isolated task workspace:

- one task -> one dedicated branch;
- one task -> one dedicated Git worktree;
- one worktree -> one Codex session;
- one running task stack -> one isolated Docker Compose project.

Use `.agents/skills/task-worktree/SKILL.md` to create, resume, verify, or clean
up a task workspace.

The primary repository directory is a coordination workspace. It MUST:

- remain on `main`;
- stay free of implementation changes;
- never switch to a feature, fix, or refactor branch;
- be used only for fetch, worktree management, integration checks, and
  repository administration.

Task branches MUST:

- be created directly from the current `origin/main`;
- use a unique task-specific name;
- never be based on another unmerged task branch unless the implementation
  plan explicitly declares and the user approves that dependency;
- match the branch declared by the implementation plan when one exists.

Recommended branch naming:

```text
feature/TASK-XXX-short-name
fix/TASK-XXX-short-name
refactor/TASK-XXX-short-name
```

Before any project-code change, the coordinating agent MUST verify:

```text
git rev-parse --show-toplevel
git branch --show-current
git status --short --branch
git worktree list
git merge-base --is-ancestor origin/main HEAD
```

Implementation MUST stop if:

- the current directory is the primary repository directory;
- the task branch or worktree is ambiguous;
- the branch does not match the implementation plan;
- the task worktree contains unexplained changes;
- another worktree is already assigned to the intended branch;
- the task branch base or an inter-task dependency is unclear.

Do not mix risky experiments, unrelated fixes, independent backlog tasks, or
unrequested refactoring in one task workspace.

The coordinating agent owns branch/worktree lifecycle and cleanup.
Specialist agents work only inside the workspace delegated by the coordinator
and MUST NOT create or remove worktrees unless explicitly assigned that
responsibility.

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
