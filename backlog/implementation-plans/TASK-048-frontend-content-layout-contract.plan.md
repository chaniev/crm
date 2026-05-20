# Implementation Plan: TASK-048 Унифицировать content-layout контракт для всех разделов CRM

## Source task
/backlog/implementation/TASK-048-frontend-content-layout-contract.md

## Implementation branch
feature/TASK-048-frontend-content-layout-contract

Branch rules:
- create this branch before writing project code;
- create it from updated `main`;
- run `git pull` and verify clean `git status` before branch creation;
- if the branch already exists, verify that it belongs only to `TASK-048`;
- do not implement `TASK-045`, `TASK-046`, `TASK-047` or unrelated visual cleanup in this branch;
- confirm the branch is active before making frontend changes.

## Goal
All authenticated CRM route screens must use one shared frontend content-layout contract: one default page width, one outer alignment/rhythm system, one route-level page header outside cards, shared card/section geometry, and explicit sanctioned variants for dense inner widgets.

## Current understanding
- This is a frontend-only visual architecture task. Backend contracts, roles, permissions, audit semantics and validation semantics are out of scope.
- The nearest repo rules are `frontend/AGENTS.md`; Mantine and Onest must be preserved.
- The task requires a design pass with `ui-designer` before code migration. In execution, ask for that checkpoint before modifying layout code.
- Current shared UX primitives live in `frontend/src/features/shared/ux.tsx`.
- Current global content styles live mainly in `frontend/src/App.css`.
- `PageCard` currently accepts `width="default" | "wide" | "full"` and always includes both `surface-card--wide` and `page-card--${width}` classes.
- `App.css` currently defines `--content-width: 65rem`, `--content-width-wide: 92rem`, `.page-card--wide`, `.page-card--full`, `.page-title-row`, `.dashboard-stack > .mantine-SimpleGrid-root`, and schedule-specific `92rem` overrides.
- `HomeDashboard`, `AttendanceScreen`, `AuditLogScreen`, `FinanceReportsScreen`, `UsersListScreen`, `UserCreateScreen`, `UserEditScreen`, `GroupManagement`, `SettingsScreen`, and `GroupScheduleScreen` mostly use `dashboard-stack` plus `PageCard`/`PageHeader`, but page title semantics differ by screen.
- `GroupScheduleScreen` uses local `92rem` width for filters and board. It must move to the shared default column; any overflow must be inside the board widget.
- `ClientsListScreen` uses a custom top-level layout with `ClientsToolbar`, `ClientsQuickFilters`, and `.clients-v7-layout` instead of shared page wrappers.
- `ClientManagement` create/edit/detail has the highest local surface debt: raw `Paper className="surface-card surface-card--wide"`, mixed `radius="28px"` and `radius="8px"`, duplicate heading patterns and nested detail cards.
- `SettingsScreen` renders `Tabs.Panel` directly; `BranchSettingsScreen embedded` currently needs a shared panel-content wrapper contract.
- Existing Playwright coverage includes `frontend/e2e/responsive-main-screens.spec.ts`, `home-dashboard.spec.ts`, `group-schedule.spec.ts`, `attendance.spec.ts`, `finance-reports.spec.ts`, `users.spec.ts`, and broad `stage12.spec.ts`.

## Execution steps
1. Prepare the implementation branch from updated `main`: checkout `main`, pull, verify clean status, create or switch to `feature/TASK-048-frontend-content-layout-contract`.
2. Run a mandatory `ui-designer` checkpoint before code: confirm the final shared contract for page width, outer padding, card padding, page header hierarchy, dense item variants, schedule overflow behavior and settings tab panel spacing.
3. Audit current route-level layout usage with `rg`: `dashboard-stack`, `PageCard`, `PageHeader`, `surface-card--wide`, `page-title-row`, `92rem`, `page-card--wide`, `page-card--full`, `Tabs.Panel`, raw route-level `Paper`.
4. Define shared layout API in `frontend/src/features/shared/ux.tsx`:
   - `PageLayout` as the only route-level width/alignment/rhythm owner;
   - `PageSection` for card/plain route sections;
   - `SectionHeader` for in-section headings;
   - `TabContent` or `PageTabsPanel` for settings tab panel content;
   - keep `PageCard` as a temporary compatibility alias over `PageSection variant="card"`.
5. Centralize content-layout tokens in `frontend/src/App.css`:
   - `--page-max-width: 65rem`;
   - page gaps, section gaps, card padding, compact padding;
   - `--page-card-radius: 24px`;
   - shared shadow, background, border and semantic text variables.
6. Update `PageCard` compatibility behavior:
   - preserve existing imports during migration;
   - remove public route-level reliance on `wide` and `full`;
   - stop injecting `surface-card--wide` as a default class;
   - keep any temporary `width` prop deprecated/internal until all usages are migrated.
7. Migrate simple screens first:
   - `HomeDashboard`: external page header in `PageLayout`, expiring memberships inside `PageSection`;
   - `AttendanceScreen`, `AuditLogScreen`, `FinanceReportsScreen`: external page header, filters/results as sections, no route-level title inside cards.
8. Migrate list/form screens next:
   - `UsersListScreen`, `UserCreateScreen`, `UserEditScreen`;
   - `GroupManagement` list/create/edit/detail flows;
   - replace action-only `PageHeader` with `PageLayout` actions and use `SectionHeader` inside cards.
9. Migrate high-risk screens separately:
   - `GroupScheduleScreen`: remove `92rem` filter/board widths, wrap board in default `PageSection density="compact"`, keep board overflow internal;
   - `ClientsListScreen`: introduce `PageLayout title="Клиенты"`, place toolbar/quick filters/results/preview inside shared sections while preserving list state and role behavior;
   - `ClientManagement`: replace route-level raw `Paper surface-card--wide` with `PageSection`, normalize route surfaces to `24px`, explicitly classify compact inner row/item surfaces;
   - `SettingsScreen` and `BranchSettingsScreen`: add external page title, wrap tabs and panels in shared layout components, remove embedded top-margin/heading hacks.
10. Migrate placeholders in `frontend/src/App.tsx` so new/redirect/read-only route placeholders demonstrate the shared content-layout contract.
11. Replace local page-level CSS with shared classes:
    - remove or quarantine `.page-title-row`;
    - remove route-level `92rem` width exceptions;
    - remove `.page-card--wide`, `.page-card--full`, `.surface-card--wide` after usages are gone;
    - keep feature-specific CSS only for inner widgets such as schedule grid, client rows, forms and dense data sections.
12. Add or update shared tests for `PageLayout`, `PageSection`, `SectionHeader`, `TabContent`/`PageTabsPanel`, and the `PageCard` compatibility alias.
13. Update Playwright expectations:
    - page title outside cards is present on every route-level screen;
    - `Home`, `Schedule`, `Clients`, `Users`, `Groups`, `Settings` share left/right content edges within allowed tolerance;
    - schedule board uses internal horizontal overflow rather than widening the page;
    - responsive viewports do not produce page-level horizontal scroll.
14. Run required frontend validation and visual checks across all mandated viewport sizes.

## Preferred implementation strategy
1. Contract-first: add shared primitives and tokens before migrating screens.
2. Compatibility-first: keep `PageCard` working as an alias while route screens are migrated incrementally.
3. Simple-to-risky migration: validate the contract on Home/Attendance/Audit/Finance before touching Schedule, Clients, ClientManagement and Settings.
4. Preserve domain behavior: keep API calls, role checks, permissions, list state, filters and form validation untouched unless layout wiring requires pure presentation changes.
5. Automated regression first where practical: update shared unit tests and responsive Playwright assertions before relying on manual visual QA.

Avoid:
- duplicating backend-owned CRM rules in frontend;
- changing route access, role behavior, API contracts or validation semantics;
- adding new `wide`/`full` route-level layout variants;
- solving dense screens by widening the page shell;
- doing broad visual redesign beyond shared layout geometry;
- folding unrelated `TASK-046` visual-style work or `TASK-047` shell-navigation work into this branch.

## Files likely to change
- `frontend/src/features/shared/ux.tsx`
- `frontend/src/features/shared/ux.test.tsx`
- `frontend/src/App.css`
- `frontend/src/App.tsx`
- `frontend/src/features/home/HomeDashboard.tsx`
- `frontend/src/features/schedule/GroupScheduleScreen.tsx`
- `frontend/src/features/clients/list/ClientsListScreen.tsx`
- `frontend/src/features/clients/list/ClientsToolbar.tsx`
- `frontend/src/features/clients/list/ClientsQuickFilters.tsx`
- `frontend/src/features/clients/list/ClientsResults.tsx`
- `frontend/src/features/clients/list/ClientPreviewPanel.tsx`
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
- `frontend/e2e/home-dashboard.spec.ts`
- `frontend/e2e/group-schedule.spec.ts`
- `frontend/e2e/attendance.spec.ts`
- `frontend/e2e/finance-reports.spec.ts`
- `frontend/e2e/users.spec.ts`
- `frontend/e2e/stage12.spec.ts` if its route layout assertions are affected

## Constraints
- Preserve Mantine and Onest.
- Frontend must not duplicate backend-owned CRM business rules: roles, permissions, access scope, memberships, attendance, audit semantics or validation semantics.
- All authorized route-level screens use the same `default` page width.
- `wide` and `full` are not sanctioned for authenticated route-level content layout.
- Page-level width, alignment, outer padding and rhythm must come from shared API/classes, not screen-specific CSS.
- One route-level page title/header must live outside cards on every main screen.
- `SectionHeader` is for card/section headings, not route-level page titles.
- Route-level raw `Paper surface-card surface-card--wide` must not own page geometry.
- Content-layout card/section surfaces use `24px` radius.
- Dense row/item/table surfaces need an explicit sanctioned shared variant if they do not use `24px`.
- Schedule and Clients stay in the same default width as the rest of the app.
- Loading/error/empty states stay inside stable shared sections and must not remove the route-level title.

## Out of scope
- Backend changes.
- Bot changes.
- API contract changes.
- Role, permission, membership, attendance, finance or audit rule changes.
- Rewriting schedule grid logic, client list state, client form behavior or settings CRUD logic.
- Redesigning shell navigation or mobile left menu behavior from `TASK-047`.
- General visual-style unification from `TASK-046` beyond the content-layout contract needed here.

## Required test coverage

### Unit tests
Add or update shared component tests:
- `PageLayout` renders title, description, actions, data attributes and route-level wrapper classes;
- `PageSection` renders card/plain variants and density classes;
- `SectionHeader` renders section title/description/actions without producing route-level H1 semantics;
- `TabContent` / `PageTabsPanel` applies stable panel spacing and wrapper classes;
- `PageCard` remains a compatibility alias and renders the shared card section classes.

Update route tests only if component contracts or accessible heading structure require it.

### Integration tests
No backend integration tests are expected. If implementation discovers a required API or domain contract change, stop and create a separate task.

Frontend integration is protected by TypeScript build and mocked route-level e2e flows.

### UI tests
Update Playwright coverage:
- `responsive-main-screens.spec.ts` asserts default content edges for Home, Schedule, Clients, Users, Groups and Settings on mobile/tablet/desktop;
- route-level page titles remain visible above the first section;
- no page-level horizontal scroll at `390x844`, `393x852`, `402x874`, `420x912`, `440x956`, `768x1024`, `1440x1200`, `1920x1080`;
- Schedule filters and board share the same default column, with board overflow contained internally;
- Clients uses shared page header and sections while count/quick filters are not treated as page title;
- Settings tabs and tab panels use shared wrappers.

### Regression priority
High. This task touches shared route layout and all authenticated screens. Automated responsive regression is mandatory.

### Minimum expectation
- Shared unit tests cover new layout primitives.
- `npm run lint` and `npm run build` pass.
- Affected Playwright specs pass or are intentionally updated for the new external page heading contract.
- Manual visual review covers all required viewport sizes from the source task.

## Test plan
- [ ] `cd frontend && npm run test:unit`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:e2e -- responsive-main-screens.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- home-dashboard.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- group-schedule.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- attendance.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- finance-reports.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- users.spec.ts`
- [ ] Run `stage12.spec.ts` if changed screens still depend on its broad regression coverage.
- [ ] Visual check: `390x844`, `393x852`, `402x874`, `420x912`, `440x956`, `768x1024`, `1440x1200`, `1920x1080`.

## Regression barrier
Primary barrier: `frontend/e2e/responsive-main-screens.spec.ts` should measure or otherwise assert consistent left/right content edges for representative authenticated routes, absence of page-level horizontal scroll, and visible route-level page titles outside cards.

Secondary barrier: shared `ux.test.tsx` should lock the new content-layout primitives and the temporary `PageCard` compatibility path.

Tertiary barrier: route-specific Playwright specs should catch regressions in Schedule board overflow, Clients layout, Settings tabs and core action availability.

## Risks
- The shared default width may make Schedule and Clients feel dense on desktop; the mitigation is compact inner widgets and contained overflow, not page-level widening.
- Literal `24px` radius on every nested row/item could reduce scanability in dense operational lists; use explicit shared compact/item variants where needed.
- Removing `PageHeader` from cards changes accessible heading order and may require test updates.
- `ClientManagement` has many raw surfaces and mixed radii, making it the highest risk migration area.
- `Settings` embedded mode can accidentally duplicate headings or spacing if `TabContent` and parent layout responsibilities are unclear.
- Open visual/shell tasks (`TASK-045`, `TASK-046`, `TASK-047`) may touch overlapping CSS; implementation must start from updated `main` and avoid mixing branches.

## Stop conditions
Остановиться и не писать код, если:
- implementation requires backend contracts, roles, permissions, validation or audit changes;
- `ui-designer` checkpoint changes the required layout contract materially and needs task clarification;
- Schedule or Clients cannot satisfy default-width requirements without a broader product decision;
- the branch is not created from clean updated `main`;
- active unmerged `TASK-045`, `TASK-046` or `TASK-047` changes make the target CSS/component baseline ambiguous;
- acceptance criteria require changing business workflows rather than presentation layout.

## Ready for Codex execution
yes
