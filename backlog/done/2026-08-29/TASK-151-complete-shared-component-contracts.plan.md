# Implementation Plan: TASK-151 Завершить контракты прикладных shared components

## Metadata
- source_task: /backlog/done/2026-08-29/TASK-151-complete-shared-component-contracts.md
- completion: implemented and locally integrated into main on 2026-08-29
- requirements: none — domain-neutral component APIs and presentation consistency preserve product behavior
- branch: feature/TASK-151-complete-shared-component-contracts
- readiness: yes
- dependencies: TASK-144 reduced-motion contract and TASK-149 applicable recipes must be complete; avoid files owned by concurrent feature tasks
- risk: medium — consumer migration can alter focus, live-region urgency, pagination reachability and form feedback

## Goal
Proven repeated pagination, avatar, field-feedback, loading/progress and notification patterns use focused typed shared contracts with documented responsive and accessibility behavior in at least two real consumers each.

## Decisions and contracts
- Create/extend a shared contract only after inventory proves two consumers or an explicit cross-screen requirement; otherwise document the local pattern and skip extraction.
- APIs remain domain-neutral and accept backend-owned copy/status without interpreting them.
- Field label stays persistent; error and decision-changing helper remain associated and visible. Notifications distinguish polite/assertive, timed/persistent and contextual-action cases.
- Loading/progress follows TASK-144 and never uses motion as the only state cue.

## Scope
### In
- Justified Pagination, Avatar fallback, FieldFeedback, Loading/Skeleton/Progress and notification contracts with two-consumer migrations.

### Out
- Unused checklist components, domain validation/status semantics, replacement of Mantine internals, broad TASK-150 migration.

## Implementation slices
1. Inventory duplicate consumers and record the two-consumer evidence/API anatomy for each candidate; drop unjustified candidates.
2. Add failing semantic, keyboard, responsive and state-transition tests before implementing each bounded contract.
3. Implement one contract at a time using TASK-149 recipes and migrate exactly two low-conflict consumers.
4. Verify notification urgency/action persistence and reduced-motion loading/temporary feedback end to end.

## Likely files and layers
- `frontend/src/features/shared/Pagination.tsx`, `Avatar.tsx`, `FieldFeedback.tsx`, `ProgressState.tsx` (new only when inventory justifies each) — focused contracts.
- `frontend/src/features/shared/ux.tsx`, `frontend/src/features/shared/notifications.ts` — loading and notification extensions.
- Two consumers per contract selected after checking active implementation ownership.
- `frontend/src/features/shared/ux.test.tsx`, `frontend/src/features/shared/notifications.test.ts` and focused new component tests.
- `frontend/e2e/responsive-main-screens.spec.ts`, `frontend/e2e/notifications-auto-dismiss.spec.ts` — responsive/live-region behavior.
- `frontend/DESIGN.md` — anatomy, composition limits and states.

## Regression specification
### Automated tests to add or update
- Pagination exposes current page, disabled previous/next, accessible labels and compact/full responsive modes without page overflow.
- Avatar falls back deterministically from failed image to sanitized initials and retains an accessible name.
- Field feedback maintains label/control/error/helper associations and never substitutes placeholder for required label.
- Loading/progress remains distinguishable in reduced mode and does not shift layout.
- Notifications enforce polite/assertive live region, timeout/persistence and keyboard-reachable contextual action contracts.
- Each retained shared API is exercised by two production consumers.

### Expected red evidence
- Shared contract tests fail because the APIs do not exist; consumer inventory should remain baseline-green and is evidence for extraction rather than an artificial failure.

### Required validation
- Run focused shared/consumer tests, reduced-motion browser scenario and affected responsive/notification Playwright flows.

### Manual evidence
- Render migrated consumers at target mobile/desktop widths and inspect long labels, error wrapping and notification actions.

### Regression barrier
- Shared semantic/keyboard tests plus the two-consumer contract assertion are the primary barrier.

## Risks and stop conditions
- Stop and omit a component when two consumers or an explicit cross-screen contract cannot be shown.
- Stop if migration touches files owned by another active task; choose other consumers or coordinate dependency order.
