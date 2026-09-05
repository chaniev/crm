# Implementation Plan: TASK-144 Добавить reduced-motion contract

## Metadata
- source_task: /backlog/done/2026-08-29/TASK-144-reduced-motion-contract.md
- completion: implemented and locally integrated into main on 2026-08-29
- requirements: REQ-NFR-001 (changes)
- branch: feature/TASK-144-reduced-motion-contract
- readiness: yes
- dependencies: none
- risk: low — broad CSS override can accidentally suppress required feedback or change layout timing

## Goal
With `prefers-reduced-motion: reduce`, continuous and nonessential CRM motion stops or becomes effectively instant while loading, pending, completion, focus and temporary-surface feedback remain perceivable and geometrically stable.

## Decisions and contracts
- Define named fast/standard durations and functional easing for custom CRM transitions; continuous decorative animation is never required state evidence.
- Reduced mode sets nonessential transitions to an effectively instant duration and disables repeating animation, but preserves static skeleton/progress and explicit copy/icons/live regions.
- Mantine internals are configured through supported theme/component props or scoped CSS, not forked.

## Scope
### In
- Motion tokens and reduced override for custom skeletons, navigation, filters, temporary surfaces and notifications.
- One skeleton and one temporary-surface browser contract, including keyboard/focus return.

### Out
- Decorative redesign, workflow/navigation changes, library patches.

## Implementation slices
1. Inventory custom transitions/animations and add failing token/static-policy tests plus Playwright reduced-motion scenarios.
2. Add semantic motion variables and migrate the bounded custom CSS inventory.
3. Add the global reduced-motion override and static state cues for continuous/loading/completion cases.
4. Verify no layout/focus regression in a skeleton and temporary surface.

## Likely files and layers
- `frontend/src/theme/semanticVariables.ts` or `frontend/src/theme/foundations.ts` — duration/easing variables.
- `frontend/src/App.css` — token adoption and `prefers-reduced-motion` override.
- `frontend/src/features/shared/ux.tsx`, `frontend/src/features/shared/notifications.ts`, temporary-surface components — static feedback where needed.
- `frontend/src/test/uxAuditRegressionMatrix.test.ts` — motion policy/static checks.
- `frontend/e2e/reduced-motion.spec.ts` (new) — emulation, skeleton and surface focus behavior.
- `frontend/DESIGN.md` — motion and reduced-mode contract.

## Regression specification
### Automated tests to add or update
- Custom CSS uses declared motion variables and contains one scoped reduced-motion policy.
- In reduced emulation, skeleton has no repeating animation but retains a named/loading-visible state.
- Opening/closing a representative Drawer/Modal is effectively instant, causes no layout shift, and Escape returns focus to the trigger.
- Notification completion remains available through copy/live-region semantics without animation.

### Expected red evidence
- Static policy test fails on raw local durations; browser test observes the current skeleton pulse and no shared reduced-motion override.

### Required validation
- Run focused CSS/unit tests and the reduced-motion Playwright spec in Chromium plus a target-iPhone WebKit project.

### Regression barrier
- Reduced-motion Playwright skeleton + temporary-surface scenario is the primary barrier.

## Risks and stop conditions
- Stop if disabling a transition changes mount/unmount or focus timing; fix through supported component lifecycle props, not arbitrary test delays.
- Do not hide progress or completion feedback when removing motion.
