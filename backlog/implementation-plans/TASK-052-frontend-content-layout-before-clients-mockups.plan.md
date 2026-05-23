# Implementation Plan: TASK-052 Content-layout prerequisite before clients mockups

## Source task
/backlog/implementation/TASK-052-frontend-content-layout-before-clients-mockups.md

## Implementation branch
feature/TASK-052-content-layout-before-clients

Branch rules:
- create this branch before writing project code;
- create it from updated `main`;
- run `git pull` and verify clean `git status` before branch creation;
- if the branch already exists, verify that it belongs only to `TASK-052`;
- do not implement `TASK-050` clients mockups, `TASK-051` mobile bottom navigation, or unrelated visual cleanup in this branch;
- confirm the branch is active before making frontend changes.

## Goal
Before `TASK-050` starts, make the shared authenticated content-layout boundary explicit and validated across all main CRM screens, so the clients mockup work can change only clients-specific row/card/preview/mobile-list styling and not silently redefine the global page shell.

## Current understanding
- This is a frontend-only prerequisite/gate for `TASK-050`.
- Backend contracts, roles, permissions, validation, membership logic, attendance logic and audit semantics are out of scope.
- Nearest frontend rules are in `frontend/AGENTS.md`; preserve Mantine and Onest.
- `TASK-048` already defines the shared layout direction and is the related all-screen task.
- Current source already contains shared primitives in `frontend/src/features/shared/ux.tsx`: `PageLayout`, `PageSection`, `PageCard` as compatibility alias, `FilterToolbar` and `PageTabsPanel`.
- Current global layout tokens live in `frontend/src/App.css`, including `--page-max-width`, `--page-section-gap`, `--page-card-padding`, `--page-card-radius`, `--dense-surface-radius` and shared `filter-toolbar` classes.
- Shared content width decision is fixed: use `--page-max-width: 100%` as the all-screen authenticated content-layout baseline.
- The older `TASK-048` `65rem` proposal is superseded for this baseline; clients mockup fitting must not reintroduce a clients-only page-width override.
- Current responsive coverage already includes `frontend/e2e/responsive-main-screens.spec.ts` with shared edge, page-title, filter-toolbar, schedule overflow and no-horizontal-scroll checks over the required mobile/tablet/desktop viewports.
- The `TASK-050` mockups can pressure shared decisions around content width, shell/content padding, route-level title placement, shared section radius, filter toolbar density and desktop preview geometry.
- The preferred CSS boundary is fixed by the source task:
  - shared width, shell/content padding, route header typography, shared card geometry, section rhythm and filter toolbar defaults belong to all-screen layout work;
  - clients-only row/card/preview/mobile-list styling stays under scoped `clients-*` selectors in `frontend/src/App.css`;
  - do not split clients CSS into a new file for `TASK-050`.

## Execution steps
1. Prepare the implementation branch from updated `main`: checkout `main`, pull, verify clean status, then create or switch to `feature/TASK-052-content-layout-before-clients`.
2. Re-read:
   - `/backlog/implementation/TASK-048-frontend-content-layout-contract.md`;
   - `/backlog/implementation-plans/TASK-048-frontend-content-layout-contract.plan.md`;
   - `/backlog/implementation-plans/TASK-050-clients-screen-mockups.plan.md`;
   - `frontend/AGENTS.md`.
3. Review the desktop and mobile `TASK-050` mockups in `docs/mockups/task-050/` and extract only shared-layout pressures:
   - route-level content width;
   - shell/content padding;
   - page title hierarchy and position;
   - section/card geometry;
   - filter toolbar defaults;
   - desktop list/preview containment;
   - mobile section rhythm and horizontal overflow behavior.
4. Run a `ui-designer` checkpoint before code changes if the audit proposes any visible shared layout decision that is not already covered by `TASK-048`.
5. Audit current implementation with `rg` and browser/manual inspection:
   - `PageLayout`, `PageSection`, `PageCard`, `PageTabsPanel`, `FilterToolbar`;
   - `--page-max-width`, `--content-width`, `--page-section-gap`, `--page-card-radius`, `--dense-surface-radius`;
   - `clients-*`, `schedule-*`, `surface-card--wide`, `page-card--wide`, `page-card--full`, `page-title-row`, raw route-level `Paper`.
6. Record the exact shared baseline required before `TASK-050` in the TASK-052 source task:
   - which values/classes/components are all-screen;
   - which clients mockup details are feature-scoped;
   - confirm the effective shared width remains `--page-max-width: 100%`;
   - whether the current `FilterToolbar` defaults are accepted or need a shared adjustment;
   - how desktop clients preview should be contained inside the shared page section.
7. If the audit confirms the existing `TASK-048` implementation already satisfies the baseline, make no frontend code changes; update only backlog notes and `TASK-050` blocker wording after validation passes.
8. If the audit finds missing all-screen baseline pieces, implement them only in shared layout surfaces:
   - `frontend/src/features/shared/ux.tsx`;
   - `frontend/src/App.css`;
   - route-level screens that need to adopt shared primitives consistently;
   - responsive Playwright coverage.
9. Keep clients-specific mockup work out of this branch:
   - no new mobile preview route;
   - no quick filter count/action-hint backend work;
   - no row/card visual overhaul for clients;
   - no fake `Уведомления` route;
   - no bottom navigation.
10. Validate all authenticated route-level screens listed in `TASK-048`:
    - `HomeDashboard`;
    - `GroupScheduleScreen`;
    - `AttendanceScreen`;
    - `ClientsListScreen` and client create/edit/detail screens;
    - `GroupManagement`;
    - `UsersListScreen`, `UserCreateScreen`, `UserEditScreen`;
    - `AuditLogScreen`;
    - `FinanceReportsScreen`;
    - `SettingsScreen` and `BranchSettingsScreen`;
    - route placeholders in `App.tsx`.
11. Update `frontend/e2e/responsive-main-screens.spec.ts` only if the accepted shared baseline needs stronger assertions:
    - default content edges for representative management screens;
    - one visible route-level H1 outside cards;
    - no page-level horizontal scroll;
    - schedule board overflow contained internally;
    - clients screen uses shared `PageLayout`/`PageSection` while `clients-*` owns only inner list/preview/mobile details.
12. After validation passes, update `/backlog/implementation-plans/TASK-050-clients-screen-mockups.plan.md` to state that `TASK-052` is completed and to preserve the CSS boundary for the `TASK-050` implementer.
13. Do not mark `TASK-050` ready if any all-screen layout decision remains unresolved or unvalidated at required viewport sizes.

## Preferred implementation strategy
1. Audit-first: compare the current `TASK-048` baseline and `TASK-050` mockups before touching code.
2. Decision log before implementation: write the all-screen vs `clients-*` boundary into the TASK-052 source file.
3. Shared-first if changes are needed: adjust `PageLayout`, `PageSection`, `FilterToolbar`, page tokens and responsive tests rather than clients selectors.
4. Minimal product-code change: if current `TASK-048` implementation is already sufficient, avoid frontend churn and finish this as a documented gate plus validation.
5. Keep `TASK-050` unblocked only by evidence: lint, build, responsive e2e and manual/browser visual checks must pass first.

Avoid:
- changing backend contracts or CRM business rules;
- changing route access, permissions, validation or audit behavior;
- adding bottom navigation or notifications;
- implementing clients mockup row/card/preview styling in this branch;
- creating new route-level `wide`/`full` exceptions only for clients;
- moving clients CSS out of `frontend/src/App.css`;
- mixing `TASK-046`, `TASK-047`, `TASK-050` or `TASK-051` work into this branch.

## Files likely to change
Backlog and planning:
- `backlog/implementation/TASK-052-frontend-content-layout-before-clients-mockups.md`
- `backlog/implementation-plans/TASK-050-clients-screen-mockups.plan.md`
- `backlog/implementation-plans/TASK-048-frontend-content-layout-contract.plan.md` if the documented baseline conflicts with implementation

Frontend, only if audit finds missing shared baseline work:
- `frontend/src/features/shared/ux.tsx`
- `frontend/src/features/shared/ux.test.tsx`
- `frontend/src/App.css`
- `frontend/src/App.tsx`
- `frontend/src/features/home/HomeDashboard.tsx`
- `frontend/src/features/schedule/GroupScheduleScreen.tsx`
- `frontend/src/features/clients/list/ClientsListScreen.tsx`
- `frontend/src/features/clients/ClientManagement.tsx`
- `frontend/src/features/attendance/AttendanceScreen.tsx`
- `frontend/src/features/audit/AuditLogScreen.tsx`
- `frontend/src/features/finance/FinanceReportsScreen.tsx`
- `frontend/src/features/users/UsersListScreen.tsx`
- `frontend/src/features/users/UserCreateScreen.tsx`
- `frontend/src/features/users/UserEditScreen.tsx`
- `frontend/src/features/groups/GroupManagement.tsx`
- `frontend/src/features/settings/SettingsScreen.tsx`
- `frontend/src/features/settings/BranchSettingsScreen.tsx`
- `frontend/e2e/responsive-main-screens.spec.ts`

## Constraints
- Preserve Mantine and Onest.
- Frontend must not duplicate backend-owned CRM rules.
- Keep backend contracts unchanged.
- Shared width, shell/content padding, route header typography, section geometry, section rhythm and filter toolbar defaults must be all-screen decisions.
- Clients-only row/card/preview/mobile-list styling belongs to scoped `clients-*` selectors in `frontend/src/App.css`.
- Do not split clients CSS into a new file for `TASK-050`.
- Do not introduce fake bottom navigation or a notifications route; that belongs to `TASK-051`.
- Do not widen or reshape only `/clients` at page-layout level.
- Loading, empty and error states must preserve the route-level page title and stable shared section geometry.

## Out of scope
- Implementing `TASK-050` mockups.
- Backend quick filter counts or action hint contracts from `TASK-050`.
- Mobile bottom navigation and notifications from `TASK-051`.
- General visual-style unification from `TASK-046`.
- Shell navigation changes from `TASK-047`.
- Backend, bot or deployment changes.
- New domain semantics for clients, memberships, attendance, payments, roles or permissions.

## Required test coverage

### Unit tests
Add or update `frontend/src/features/shared/ux.test.tsx` if implementation changes shared primitives:
- `PageLayout` route-level title/actions/description behavior;
- `PageSection` card/plain/density classes;
- `PageCard` compatibility alias;
- `FilterToolbar` layout defaults;
- `PageTabsPanel` spacing contract.

No unit-test changes are required if this task only records the accepted baseline and updates backlog docs.

### Integration tests
No backend integration tests are expected. If implementation discovers a necessary backend contract or domain behavior change, stop and create a separate task.

Frontend integration is protected by TypeScript build and route-level Playwright mocks.

### UI tests
`frontend/e2e/responsive-main-screens.spec.ts` is mandatory for any frontend layout change and should protect:
- no page-level horizontal scroll at all required viewport sizes;
- consistent content edges for representative authenticated management routes;
- one route-level H1 outside cards;
- schedule filter and board sharing the same default content column;
- clients page using shared page sections without clients-only page-width overrides.

### Regression priority
High. This task is intentionally a regression gate for all authenticated route-level screens before clients mockup implementation starts.

### Minimum expectation
- If frontend code changes: `npm run lint`, `npm run build` and responsive e2e pass.
- If only backlog/docs change: the implementation branch still must run or record the responsive verification evidence before `TASK-050` is unblocked.
- Manual/browser visual review covers every required viewport from the source task.

## Test plan
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:unit` if shared primitives or pure layout helpers change
- [ ] `cd frontend && npm run test:e2e -- responsive-main-screens.spec.ts`
- [ ] Manual/browser visual check at `390x844`
- [ ] Manual/browser visual check at `393x852`
- [ ] Manual/browser visual check at `402x874`
- [ ] Manual/browser visual check at `420x912`
- [ ] Manual/browser visual check at `440x956`
- [ ] Manual/browser visual check at `768x1024`
- [ ] Manual/browser visual check at `1440x1200`
- [ ] Manual/browser visual check at `1920x1080`

## Regression barrier
Primary barrier: `frontend/e2e/responsive-main-screens.spec.ts` must keep shared route title, shared content edges, filter toolbar count, contained schedule overflow and no-horizontal-scroll checks across the required viewports.

Secondary barrier: `frontend/src/features/shared/ux.test.tsx` should lock any changed shared layout primitive behavior.

Manual barrier: browser visual checks must confirm that `/clients` can fit the upcoming mockup work inside the accepted shared page baseline without requiring clients-only page width, shell padding, route title or section geometry changes.

## Risks
- Future changes can accidentally drift back toward the older `65rem` proposal; keep `--page-max-width: 100%` as the explicit shared baseline unless a new task changes it for all screens.
- The desktop clients preview may tempt a clients-only page-width exception; keep preview geometry inside shared sections unless an all-screen decision changes the baseline.
- Filter toolbar density might need tuning for clients mockups; if changed, it must be validated on Schedule, Attendance, Audit and Finance too.
- Over-documenting the boundary without running responsive checks could falsely unblock `TASK-050`.
- Active visual/layout tasks can overlap in CSS; implementation must start from clean updated `main`.

## Stop conditions
Stop before product-code changes if:
- the branch is not created from clean updated `main`;
- `TASK-048` implementation status is ambiguous or conflicts with current `main`;
- the `--page-max-width: 100%` baseline cannot satisfy `TASK-050` without a broader all-screen layout decision;
- satisfying the clients mockups requires changing app shell navigation or adding bottom navigation;
- implementation requires backend contracts, roles, permissions, validation, audit or membership semantics;
- the visual baseline requires a broader product/design decision not captured by `TASK-048` or `TASK-052`.

## Ready for Codex execution
yes
