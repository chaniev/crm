# Implementation Plan: TASK-051 Mobile bottom navigation

## Source task
/backlog/implementation/TASK-051-mobile-bottom-navigation.md

## Implementation branch
feature/TASK-051-mobile-bottom-navigation

Branch rules:
- create this branch before writing project code;
- create it from updated `main`;
- run `git pull` and verify clean `git status` before branch creation;
- if the branch already exists, verify that it belongs only to `TASK-051`;
- do not implement `TASK-050` clients mockups, `TASK-052` content-layout gate, notifications backend/frontend routes, or desktop navigation redesign in this branch;
- confirm the branch is active before making frontend changes.

## Goal
Mobile users should get a persistent bottom navigation across authenticated CRM screens, driven by the same backend-derived allowed sections and permissions as the current shell, without adding a fake `Уведомления` route or changing desktop navigation.

## Current understanding
- This is a frontend-only authenticated shell task.
- Nearest frontend rules are in `frontend/AGENTS.md`; preserve Mantine and Onest.
- Current authenticated shell lives mostly in `frontend/src/App.tsx` through `AuthenticatedShell`.
- Current layout shell is `frontend/src/features/shared/AppLayout.tsx`.
- Current navigation rendering is centralized in `frontend/src/features/shared/NavigationTabs.tsx`.
- Current route/permission source is `frontend/src/lib/appRoutes.ts`:
  - `getAccessibleNavigationSections(user)` derives navigation from backend/session `allowedSections` and permissions;
  - `APP_SECTION_LABELS` and `APP_SECTION_PATHS` already define section labels and paths;
  - `Schedule` is currently always included by navigation rules.
- Current mobile behavior uses a burger button plus Mantine `Drawer` with vertical `NavigationTabs`.
- Current e2e tests assert mobile drawer behavior in `home-dashboard.spec.ts`, `attendance.spec.ts`, `responsive-main-screens.spec.ts`, `stage12.spec.ts` and `finance-reports.spec.ts`.
- `TASK-050` mockups show bottom navigation and an `Уведомления` tab, but this task must not create a notifications section unless a real route/backend contract exists.

## Execution steps
1. Prepare the implementation branch from updated `main`: checkout `main`, pull, verify clean status, then create or switch to `feature/TASK-051-mobile-bottom-navigation`.
2. Re-read `frontend/AGENTS.md`, `TASK-050` and `TASK-052` plans so bottom navigation stays separate from clients mockups and content-layout baseline work.
3. Run a short `ui-designer` checkpoint before code because this changes all mobile authenticated screens:
   - confirm bottom bar height, item count, labels, icon-only vs icon+label behavior, active state, safe-area handling and the secondary menu pattern;
   - confirm the bottom navigation should be hidden on desktop/tablet at the same breakpoint as the current mobile drawer (`48em` / 768px).
4. Define a mobile navigation model in frontend code, derived only from existing accessible sections:
   - keep using `getAccessibleNavigationSections(user)` as the source of truth;
   - do not add `Notifications` or any section not present in `AppSection`;
   - choose primary bottom items from accessible high-frequency sections;
   - place overflow/less frequent authorized sections behind a `Еще`/menu action if more sections are available than fit comfortably.
5. Recommended primary item policy:
   - show up to four direct route items plus an optional `Еще` action;
   - direct candidates, in order: `Home`, `Schedule`, `Attendance`, `Clients`;
   - if one of those is not accessible, fill from the remaining accessible sections in existing navigation order;
   - for coach sessions with `Schedule`, `Attendance`, `Clients`, show those directly and omit `Еще`;
   - for manager/headcoach sessions, put remaining authorized sections such as `Groups`, `Users`, `Audit`, `Finance`, `Settings` in the secondary menu.
6. Implement shared shell pieces rather than screen-specific layout:
   - add a mobile bottom navigation component near existing shared navigation primitives, or extend `NavigationTabs` only if the API stays clean;
   - keep desktop side navigation unchanged;
   - keep the existing drawer or replace its mobile usage with a menu/sheet for overflow authorized sections only after confirming the UX checkpoint.
7. Update `AuthenticatedShell` in `frontend/src/App.tsx`:
   - render bottom navigation only for authenticated mobile screens;
   - use `currentSection` for active state;
   - close any overflow menu on navigation;
   - keep profile/password/logout flows available from the header/profile menu;
   - avoid showing duplicate mobile nav affordances if the overflow menu fully replaces the old burger drawer.
8. Update `AppLayout`/CSS spacing:
   - reserve bottom safe space in `.app-shell__main` on mobile so page actions, pagination, cards, toasts and form controls are not covered by the fixed bottom bar;
   - include `env(safe-area-inset-bottom)`;
   - keep no page-level horizontal scroll;
   - preserve the shared `--page-max-width: 100%` baseline from `TASK-052`.
9. Add accessible semantics:
   - bottom nav is a `nav` with a distinct label such as `Мобильная навигация`;
   - route items use `aria-current="page"`;
   - overflow button has a clear accessible name;
   - secondary menu/drawer traps focus only while open and closes with Escape.
10. Update affected e2e tests:
    - replace mobile drawer-only expectations where bottom navigation is now expected;
    - keep desktop side navigation assertions unchanged;
    - assert coach mobile sees only authorized sections;
    - assert manager/headcoach mobile sees primary bottom items plus authorized overflow items, without `Уведомления`;
    - assert active route state changes after tapping bottom nav items;
    - assert no horizontal scroll and no bottom overlap on required responsive viewports.
11. Update unit tests if route/navigation helpers are added:
    - primary/overflow split respects `allowedSections` and permission gates;
    - `Finance`, `Settings`, `Users`, `Audit` still require their existing permission checks;
    - no unknown/fake section is produced.
12. Run validation and perform browser/manual checks on mobile, tablet and desktop.

## Preferred implementation strategy
1. Contract-first inside frontend: derive a mobile navigation model from existing `AppSection` and `getAccessibleNavigationSections`.
2. Shared shell implementation: put bottom navigation in shared shell/navigation code, not in route screens.
3. Preserve desktop behavior: desktop side nav and desktop responsive assertions should remain stable.
4. Keep authorization passive: frontend renders only sections already allowed by backend/session and existing permission gates.
5. Test before polish: update Playwright coverage for mobile navigation behavior and overflow before relying on manual visual QA.

Avoid:
- adding fake `Уведомления`;
- adding backend notifications, new permissions or new route contracts;
- changing CRM domain rules or permission semantics;
- changing desktop navigation;
- implementing clients mockups from `TASK-050`;
- reworking global content layout from `TASK-052`;
- placing bottom-nav CSS under clients-specific selectors.

## Files likely to change
- `frontend/src/App.tsx`
- `frontend/src/App.css`
- `frontend/src/features/shared/AppLayout.tsx`
- `frontend/src/features/shared/NavigationTabs.tsx`
- `frontend/src/features/shared/BottomNavigation.tsx` if implemented as a new shared component
- `frontend/src/features/shared/BottomNavigation.test.tsx` if component-level tests are added
- `frontend/src/lib/appRoutes.ts` if a reusable mobile primary/overflow helper is added
- `frontend/src/lib/appRoutes.test.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`
- `frontend/e2e/home-dashboard.spec.ts`
- `frontend/e2e/attendance.spec.ts`
- `frontend/e2e/finance-reports.spec.ts`
- `frontend/e2e/stage12.spec.ts` if its broad mobile navigation assertions are affected

## Constraints
- Preserve Mantine and Onest.
- Frontend must not duplicate backend-owned CRM rules.
- Use existing backend/session `allowedSections` and permissions as the only access source.
- Do not create a fake `Уведомления` route or navigation item.
- Do not introduce backend notifications in this task.
- Do not change desktop navigation.
- Do not change `TASK-050` clients screen layout or mockup implementation.
- Do not change `TASK-052` shared content-layout baseline; keep `--page-max-width: 100%`.
- Bottom navigation must apply consistently to all authenticated mobile screens, not only `/clients`.

## Out of scope
- Backend changes.
- Bot changes.
- Notifications product feature, route or contract.
- Desktop navigation redesign.
- Clients mockup implementation from `TASK-050`.
- Content-layout unification/gate work from `TASK-052`.
- CRM role, permission, membership, attendance, audit or validation semantics.

## Required test coverage

### Unit tests
Add or update tests if helper/component logic is introduced:
- mobile navigation model splits primary and overflow items deterministically;
- direct primary items are derived only from accessible sections;
- overflow contains only authorized remaining sections;
- `Finance`, `Settings`, `Users` and `Audit` keep existing permission gates;
- no `Notifications` or unknown section can be produced.

### Integration tests
No backend integration tests are expected. If implementation discovers a required backend route/permission/notifications contract, stop and create a separate task.

Frontend integration is covered by TypeScript build and shell e2e flows.

### UI tests
Update Playwright coverage for:
- mobile manager/headcoach session shows bottom navigation at `390x844`, `393x852`, `402x874`, `420x912`, `440x956`;
- mobile coach session shows only authorized sections such as `Schedule`, `Attendance`, `Clients`;
- tapping bottom nav items navigates and updates `aria-current`;
- overflow menu/sheet shows authorized secondary sections and excludes `Уведомления`;
- desktop/tablet side navigation remains unchanged at `768x1024`, `1440x1200`, `1920x1080`;
- no page-level horizontal scroll;
- bottom nav does not cover pagination, primary action buttons, forms or page content.

### Regression priority
High. This changes authenticated shell navigation across all mobile screens.

### Minimum expectation
- `npm run lint` passes.
- `npm run build` passes.
- Navigation helper/component unit tests pass if added.
- Affected Playwright specs are updated from drawer-only mobile assumptions to the accepted bottom-navigation behavior.
- Manual/browser visual checks cover mobile, tablet and desktop responsive viewports.

## Test plan
- [ ] `cd frontend && npm run test:unit`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:e2e -- responsive-main-screens.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- home-dashboard.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- attendance.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- finance-reports.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- stage12.spec.ts` if broad navigation assertions are affected
- [ ] Manual/browser visual check at `390x844`
- [ ] Manual/browser visual check at `393x852`
- [ ] Manual/browser visual check at `402x874`
- [ ] Manual/browser visual check at `420x912`
- [ ] Manual/browser visual check at `440x956`
- [ ] Manual/browser visual check at `768x1024`
- [ ] Manual/browser visual check at `1440x1200`
- [ ] Manual/browser visual check at `1920x1080`

## Regression barrier
Primary barrier: `frontend/e2e/responsive-main-screens.spec.ts` must assert mobile bottom navigation visibility, active state, authorized section behavior and no-horizontal-scroll across the mobile viewport matrix while preserving desktop side navigation behavior.

Secondary barrier: focused route/helper unit tests should lock the primary/overflow split and ensure no fake notifications item can appear.

Tertiary barrier: existing route-specific e2e specs should confirm that Home, Attendance, Finance and broad stage flows still work with the new mobile shell spacing and navigation.

## Risks
- Bottom navigation can hide page actions, pagination or form controls if mobile bottom padding is not reserved globally.
- A fixed bottom bar can fight mobile browser safe areas; use `env(safe-area-inset-bottom)`.
- Replacing drawer expectations will require several e2e updates.
- Too many manager sections cannot fit in a bottom bar; use an overflow action instead of shrinking labels until unreadable.
- Adding `Уведомления` from the mockup would create a fake product surface; keep it out and create a separate notifications task if needed.
- Touching `App.tsx` can grow shell complexity; prefer small shared helpers/components.

## Stop conditions
Stop before implementation if:
- the branch is not created from clean updated `main`;
- the desired bottom-nav item policy cannot be resolved without product/design clarification;
- implementation requires adding a real notifications route or backend notifications contract;
- implementation requires changing backend roles, permissions, access scope or `allowedSections` semantics;
- desktop navigation must be redesigned to satisfy the mobile task;
- bottom navigation cannot be made all-screen without route-specific hacks.

## Ready for Codex execution
yes
