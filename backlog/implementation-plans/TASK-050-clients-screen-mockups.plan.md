# Implementation Plan: TASK-050 Экран Клиенты по макетам

## Source task
User request in Codex thread, 2026-05-23.

No source backlog task file was moved into `/backlog/implementation`.

## Implementation branch
feature/TASK-050-clients-screen-mockups

Branch rules:
- create this branch before writing project code;
- create it from updated `main`;
- run `git pull` and verify clean `git status` before branch creation;
- if the branch already exists, verify that it belongs only to `TASK-050`;
- do not implement unrelated mobile shell, notifications, or global layout work in this branch;
- confirm the branch is active before making project code changes.

## Goal
Bring the `Клиенты` screen close to the provided desktop and mobile mockups:
- desktop: page title, search/filter row, client table/list, selected row, right preview panel with short information and action tiles;
- mobile list: compact top bar, search, status chips, quick filter cards, client cards, pagination and page-size control;
- mobile client preview: compact profile header, required action block, action tiles, short information, recent history, full-card CTA.

## Current understanding
- Nearest frontend rules are in `/frontend/AGENTS.md`; preserve Mantine and Onest.
- Backend remains the source of truth for CRM rules: membership state, groups, attendance, permissions and access scope.
- The current frontend already has a split list/preview foundation:
  - `frontend/src/features/clients/list/ClientsListScreen.tsx`;
  - `frontend/src/features/clients/list/ClientsToolbar.tsx`;
  - `frontend/src/features/clients/list/ClientsQuickFilters.tsx`;
  - `frontend/src/features/clients/list/ClientsResults.tsx`;
  - `frontend/src/features/clients/list/ClientPreviewPanel.tsx`;
  - `frontend/src/features/clients/list/clientListViewModel.ts`;
  - `frontend/src/features/clients/list/useClientsListState.ts`.
- Full client details already live in `frontend/src/features/clients/ClientManagement.tsx`.
- Routes already support `/clients`, `/clients/new`, `/clients/:id`, `/clients/:id/edit`.
- Current backend list response already exposes total/active/archive counts, list items, current membership summary, membership state, groups and last visit date.
- Exact quick filter count badges from the mockup cannot be computed correctly from the current page-only frontend data.

## Content-layout impact
The user explicitly requested that any `content-layout` changes be planned across all screens, not only `Клиенты`.

### Preferred boundary for TASK-050
Keep global content-layout changes out of this task unless implementation proves they are required.

Implement the mockup fit mostly through `clients-*` feature classes and existing shared components:
- `PageLayout`;
- `PageSection`;
- `FilterToolbar`;
- shared buttons/icons;
- client-specific desktop/mobile layout classes.

### Existing related task
Global content-layout work already exists as:
- `/backlog/implementation/TASK-048-frontend-content-layout-contract.md`;
- `/backlog/implementation-plans/TASK-048-frontend-content-layout-contract.plan.md`.

If the clients mockup requires changing shared width, shell padding, page title typography, route-level card radius, filter toolbar defaults or responsive page spacing, do not hide that inside TASK-050. Either:
1. implement it under `TASK-048`, then rebase TASK-050; or
2. create a follow-up task that explicitly covers all authenticated screens.

### Screens affected by any shared content-layout change
If shared `PageLayout`, `PageSection`, `FilterToolbar`, `AppLayout`, header spacing, content width, text scale or route-level padding changes, the plan must cover and validate:
- `Главная` / `HomeDashboard`;
- `Расписание` / `GroupScheduleScreen`;
- `Посещения` / `AttendanceScreen`;
- `Клиенты` / `ClientsListScreen` and client create/edit/detail screens;
- `Группы` / `GroupManagement`;
- `Тренеры` / users list/create/edit screens;
- `Журнал` / `AuditLogScreen`;
- `Финансы` / `FinanceReportsScreen`;
- `Настройки` / `SettingsScreen` and `BranchSettingsScreen`;
- route placeholders in `App.tsx`.

### Mobile shell note
The mobile mockup shows bottom navigation and an `Уведомления` tab. The current app uses a mobile drawer and does not have a notifications section route. Literal bottom navigation should be a separate task, for example:

`feature/TASK-051-mobile-bottom-navigation`

That task must cover every mobile screen and routing/permissions behavior. TASK-050 should not create fake notification navigation or silently replace the app shell.

## Execution steps
1. Prepare branch:
   - checkout `main`;
   - pull latest changes;
   - verify clean `git status`;
   - create `feature/TASK-050-clients-screen-mockups`.
2. Re-read current frontend rules in `frontend/AGENTS.md`.
3. Run a design checkpoint before code because this is a significant UX change:
   - confirm desktop table density;
   - confirm mobile list/card hierarchy;
   - confirm whether quick filter count badges are required for MVP;
   - confirm whether bottom navigation is intentionally out of scope for this task.
4. Decide backend contract for quick filter counts:
   - if badge counts are required, add backend-provided aggregate counts;
   - if not required, render badges only where current API can provide truthful values or omit them.
5. If quick filter counts are required, update backend:
   - extend `ClientListResponse`;
   - compute counts from the same access-scoped base query;
   - keep membership/group/attendance semantics in backend.
6. Update frontend API types/mappers if backend response changes:
   - `frontend/src/lib/api/types.ts`;
   - `frontend/src/lib/api/clients.ts`;
   - `frontend/src/lib/api/endpoints.ts` only if endpoint shape changes.
7. Update client list state:
   - expose quick filter counts;
   - keep selected-client behavior;
   - preserve pagination, debounced search, role-limited phone visibility and coach scope behavior.
8. Update view models:
   - add mockup-specific labels for next action and urgency;
   - build row facts: status, membership, next step, group, visit;
   - build preview facts and short history;
   - avoid frontend-only domain decisions beyond rendering backend data.
9. Rework desktop layout:
   - title `Клиенты` with total count badge;
   - top-right `Новый клиент` action for managers;
   - search and filters in one row;
   - status chips: `Активные`, `Архив`, `Без абонемента`, `Скоро закончится`, `Без группы`, filter button;
   - table-like client rows matching the mockup columns;
   - selected row border state;
   - right preview panel with profile header, required action block, short information and action tiles.
10. Rework mobile list layout:
    - compact top bar and create button;
    - search input;
    - horizontal status chips;
    - quick filter cards with icons;
    - client cards with avatar initials, phone, status, urgency, membership/group state and open affordance;
    - pagination and page-size select.
11. Add mobile quick-preview route or mode:
    - preferred route: `/clients/:id/preview`;
    - keep existing `/clients/:id` as the full card;
    - wire list-card tap/open behavior deliberately for mobile vs desktop;
    - CTA `Открыть полную карточку` navigates to `/clients/:id`.
12. Wire action tiles:
    - `Оформить абонемент` opens existing full card membership flow or navigates to the full card with membership intent if supported;
    - `Сообщение` links to existing client messenger section/full card;
    - `Посещение` links to attendance;
    - `Открыть карточку`/`Вся информация` opens the existing full card.
13. Preserve read-only coach behavior:
    - phone remains hidden if backend hides it;
    - create/edit/manage actions are hidden when `canManageClients` is false;
    - no frontend permission inference beyond session permissions and backend response.
14. Update CSS in `App.css` or split feature CSS if the project adopts that pattern:
    - keep new selectors scoped to `clients-*`;
    - avoid changing shared `content-layout` tokens unless doing the coordinated work described above;
    - ensure no page-level horizontal scroll at required responsive widths.
15. Update tests and run validation.

## Preferred implementation strategy
1. Contract-first only for data counts: backend aggregates before frontend badges if counts are mandatory.
2. Frontend-first for visual structure that uses existing data.
3. Keep shell/global layout unchanged in TASK-050 unless explicitly coordinated with TASK-048.
4. Preserve current domain behavior and routes; add a preview route only as a presentation/navigation layer.
5. Use small components:
   - desktop table/list;
   - mobile cards;
   - preview profile header;
   - required-action card;
   - action tiles;
   - info facts;
   - short history.

## Files likely to change
Frontend:
- `frontend/src/features/clients/list/ClientsListScreen.tsx`
- `frontend/src/features/clients/list/ClientsToolbar.tsx`
- `frontend/src/features/clients/list/ClientsQuickFilters.tsx`
- `frontend/src/features/clients/list/ClientsResults.tsx`
- `frontend/src/features/clients/list/ClientPreviewPanel.tsx`
- `frontend/src/features/clients/list/clientListViewModel.ts`
- `frontend/src/features/clients/list/useClientsListState.ts`
- `frontend/src/features/clients/list/clientListFilters.ts`
- `frontend/src/features/clients/ClientManagement.tsx`
- `frontend/src/lib/appRoutes.ts`
- `frontend/src/App.tsx`
- `frontend/src/App.css`
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/clients.ts`
- `frontend/src/lib/resources.ts`

Backend, only if quick filter counts are required:
- `backend/src/GymCrm.Api/Auth/ClientListResponse.cs`
- `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs`
- `backend/tests/GymCrm.Tests/ClientsApiTests.cs`

Tests:
- `frontend/src/features/shared/ux.test.tsx` only if shared layout primitives change;
- `frontend/e2e/stage12.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`

## Constraints
- Do not duplicate CRM business rules in frontend.
- Do not compute global quick filter counts from only the visible page.
- Do not change backend validation, audit, roles, permissions or access scope unless a separate backend task is created.
- Preserve Mantine and Onest.
- Preserve existing client CRUD and membership workflows.
- Keep manager and coach behavior distinct according to backend contracts and session permissions.
- Do not add a fake `Уведомления` route just because it appears in the mobile mockup.
- Do not combine this with unrelated global shell/bottom-nav work.

## Out of scope
- Full redesign of `ClientDetailScreen` beyond navigation/CTA integration.
- New notifications feature.
- Global mobile bottom navigation.
- Global content-layout unification already covered by TASK-048.
- New backend membership semantics.
- New attendance workflow.
- New messenger backend features.

## Required test coverage

### Unit tests
Add or update if implementation changes pure logic:
- `clientListViewModel` tests for urgency labels, membership labels, group labels, history/fact mapping;
- `clientListFilters` tests if quick filter query behavior changes;
- API mapper tests if `ClientListResponse` gains `quickFilterCounts`.

### Backend integration tests
Required only if backend counts are added:
- list response includes quick filter counts;
- counts respect status/search/group/payment filters according to the chosen product rule;
- counts respect coach access scope;
- counts do not expose phone/manager-only data to coach users;
- existing pagination and active/archive counts remain intact.

### UI/e2e tests
Update or add:
- desktop `/clients` renders title, count, create action, filters, selected row and preview panel;
- mobile `/clients` renders search, chips, quick filter cards, client cards and pagination without horizontal scroll;
- selecting/opening a client reaches preview/full card as designed;
- manager sees create/manage actions;
- coach does not see manager-only actions;
- filter requests still include expected query params;
- pagination still works after filtering.

## Test plan
- [ ] `dotnet test backend/GymCrm.slnx` if backend contract/counts change.
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:unit` if unit tests are added/changed and script exists.
- [ ] `cd frontend && npm run test:e2e -- stage12.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- responsive-main-screens.spec.ts`
- [ ] Manual/browser visual check at:
  - `390x844`;
  - `393x852`;
  - `402x874`;
  - `420x912`;
  - `440x956`;
  - `768x1024`;
  - `1440x1200`;
  - `1920x1080`.

## Regression barrier
Primary barrier:
- Playwright responsive coverage for `/clients` on mobile/tablet/desktop with no page-level horizontal scroll and visible key controls.

Secondary barrier:
- `stage12.spec.ts` protects filtering, pagination and client navigation behavior.

If backend quick counts are implemented:
- `ClientsApiTests` must lock count semantics and access scope.

## Risks
- Quick filter counts can be wrong if implemented in frontend; keep them backend-owned.
- Mobile bottom navigation in the mockup overlaps with a broader app-shell decision.
- Desktop right preview may fight the shared content width from TASK-048; keep it feature-scoped unless shared layout task is active.
- Existing `ClientDetailScreen` is large; avoid opportunistic redesign while adding preview CTA.
- Coach read-only behavior can regress if action tiles are not permission-gated.

## Stop conditions
Stop before implementation if:
- branch is not created from clean updated `main`;
- quick filter count semantics are unclear and badge counts are mandatory;
- implementation requires changing global `content-layout` without coordinating all screens listed above;
- implementation requires adding real notifications navigation;
- implementation requires backend role/permission/access-scope changes.

## Ready for Codex execution
yes
