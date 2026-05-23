# TASK-052: Content-layout prerequisite before clients mockups

## Status
done

## Implementation lifecycle
- created_at: 2026-05-23
- moved_to_implementation_at: 2026-05-23 12:57
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-052-frontend-content-layout-before-clients-mockups.plan.md
- implementation_branch: feature/TASK-052-content-layout-before-clients
- blocks: `/backlog/implementation-plans/TASK-050-clients-screen-mockups.plan.md`
- related_task: `/backlog/done/TASK-048-frontend-content-layout-contract.md`
- related_plan: `/backlog/done/TASK-048-frontend-content-layout-contract.plan.md`
- recommended_branch: `feature/TASK-052-content-layout-before-clients`

## Goal
Before implementing `TASK-050`, resolve the shared content-layout baseline for all authenticated CRM screens so the clients mockup work does not silently change page width, shell padding, route-level headers, shared section geometry or responsive spacing only for `Клиенты`.

## Problem
`TASK-050` is a screen-specific mockup task, but its desktop and mobile mockups can pressure shared layout decisions. If those shared decisions are implemented inside `TASK-050`, the app can end up with clients-specific layout rules that should apply to every authenticated screen.

## Scope
- Audit `TASK-048` against the `TASK-050` mockups and record the exact shared layout baseline required before clients work starts.
- Complete or update `TASK-048` so it covers that required baseline before unblocking `TASK-050`.
- Cover all authenticated route-level screens listed in `TASK-048`, not only `Клиенты`.
- Keep shared layout decisions in shared primitives/tokens such as `PageLayout`, `PageSection`, `FilterToolbar` and global content CSS.
- Define which parts of the clients mockups are screen-specific and may remain under `clients-*` selectors.

## Required decision
Shared content width:
- use `--page-max-width: 100%` as the all-screen authenticated content-layout baseline;
- do not return to the earlier `65rem` max-width proposal for this baseline;
- any clients mockup fit must work inside this shared `100%` page baseline, not through a clients-only page-width override.

Preferred CSS boundary:
- all-screen width, shell/content padding, route header typography, shared card geometry, section rhythm and filter toolbar defaults must be changed in the all-screen content-layout task;
- clients-only row/card/preview/mobile-list styling stays in `App.css` under scoped `clients-*` selectors for `TASK-050`;
- do not split clients CSS into a new file for `TASK-050`.

## Acceptance criteria
- `TASK-050` starts only after there is a clear rule for what may change inside `clients-*` CSS and what must remain shared.
- Any needed all-screen layout changes are implemented and validated across all authenticated screens before `TASK-050`.
- Responsive checks cover mobile, tablet and desktop viewports from the `TASK-048`/`TASK-050` plans.
- No fake bottom navigation or notifications route is introduced here; that belongs to `TASK-051`.

## Resolution
- Date: 2026-05-23.
- Branch: `feature/TASK-052-content-layout-before-clients`.
- `TASK-048` is already completed in `/backlog/done/` and its current implementation satisfies the page-level baseline required before `TASK-050`.
- No backend, database or migration change is required for this task. The user instruction to prefer the initial deployment point over a DB migration is therefore not applicable here.

### Accepted shared baseline
- All authenticated route-level screens keep `PageLayout` as the shared owner of content width, route-level H1/header, outer rhythm and page actions.
- `--page-max-width: 100%` remains the all-screen authenticated content width baseline. Do not reintroduce the older `65rem` max-width proposal.
- `PageSection` owns shared section/card geometry, including shared padding, radius, border and shadow tokens.
- `FilterToolbar` defaults are accepted as shared all-screen behavior. Screen-specific CSS must not override the toolbar container's page-level padding, radius, background or border as a clients-only mockup fit.
- `PageTabsPanel` remains the shared wrapper for settings tab content.
- Schedule horizontal overflow must stay inside `.schedule-board__viewport`; it must not widen the page shell.

### TASK-050 CSS boundary
- `TASK-050` may change clients-specific row/card/preview/mobile-list geometry under scoped `clients-*` selectors.
- The desktop clients preview is a feature-specific inner layout inside the shared clients page section, not a new shared layout primitive.
- `/clients` must continue to use the shared `PageLayout` and `PageSection` boundaries. Do not add clients-only page width, shell padding, route title or section geometry overrides.
- If clients mockup work needs different shared page width, shell padding, route header typography, shared section radius or shared `FilterToolbar` defaults, stop `TASK-050` and create a separate all-screen layout task.
- Bottom navigation and a real notifications route remain out of scope and belong to `TASK-051`.

## Validation
- Passed: `cd frontend && npm run lint`.
- Passed: `cd frontend && npm run build`.
- Passed: `cd frontend && env E2E_PORT=3100 npm run test:e2e -- responsive-main-screens.spec.ts`.
- Responsive browser coverage passed at `390x844`, `393x852`, `402x874`, `420x912`, `440x956`, `768x1024`, `1440x1200`, `1920x1080` through `responsive-main-screens.spec.ts`.
- In-app browser smoke check passed for `/clients` with temporary mock API: route-level H1 stayed outside sections, the two clients `PageSection` edges matched the `PageLayout`, desktop preview stayed inside the shared section, and there was no page-level horizontal scroll.
