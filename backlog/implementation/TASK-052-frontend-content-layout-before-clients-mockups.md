# TASK-052: Content-layout prerequisite before clients mockups

## Status
implementation

## Implementation lifecycle
- created_at: 2026-05-23
- moved_to_implementation_at: 2026-05-23 12:57
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-052-frontend-content-layout-before-clients-mockups.plan.md
- implementation_branch: feature/TASK-052-content-layout-before-clients
- blocks: `/backlog/implementation-plans/TASK-050-clients-screen-mockups.plan.md`
- related_task: `/backlog/implementation/TASK-048-frontend-content-layout-contract.md`
- related_plan: `/backlog/implementation-plans/TASK-048-frontend-content-layout-contract.plan.md`
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

## Validation
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && npm run test:e2e -- responsive-main-screens.spec.ts`
- Manual/browser visual check at `390x844`, `393x852`, `402x874`, `420x912`, `440x956`, `768x1024`, `1440x1200`, `1920x1080`.
