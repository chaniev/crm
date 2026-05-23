# Implementation Plan: TASK-050 Экран Клиенты по макетам

## Source task
User request in Codex thread, 2026-05-23.

No source backlog task file was moved into `/backlog/implementation`.

## Mockups
Use the desktop and mobile mockups from:
- `docs/mockups/task-050/ChatGPT Image 23 мая 2026 г., 12_09_07.png`;
- `docs/mockups/task-050/ChatGPT Image 23 мая 2026 г., 12_11_10.png`.

The implementation must compare the finished `/clients` and `/clients/:id/preview` screens against these files during the manual/browser visual check.

## Implementation status
Unblocked by completed `TASK-052` on 2026-05-23:
- `/backlog/implementation/TASK-052-frontend-content-layout-before-clients-mockups.md`.

`TASK-050` may start after rebasing from updated `main`, but must preserve the `TASK-052` shared content-layout boundary. The clients mockup fit must not change shared page width, spacing, shell padding, route-level header behavior, shared section geometry or `FilterToolbar` container defaults as clients-only work.

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
- Quick filter count badges must be backend-provided through `quickFilterCounts`; frontend must not compute global counts from the visible page.
- Required action / urgency semantics must be backend-owned through action hint fields; frontend may map backend semantic codes to labels, icons and colors, but must not decide CRM action priority.

## Content-layout impact
The user explicitly requested that any `content-layout` changes be planned across all screens, not only `Клиенты`.

### Preferred boundary for TASK-050
Keep global content-layout changes out of this task.

Implement the mockup fit mostly through `clients-*` feature classes and existing shared components:
- `PageLayout`;
- `PageSection`;
- `FilterToolbar`;
- shared buttons/icons;
- client-specific desktop/mobile layout classes.

If implementation proves that shared page width, shell padding, page title typography, route-level card radius, filter toolbar defaults or responsive page spacing must change, stop `TASK-050` and finish the blocking all-screen layout task first.

### Existing related task
Global content-layout work already exists as:
- `/backlog/done/TASK-048-frontend-content-layout-contract.md`;
- `/backlog/done/TASK-048-frontend-content-layout-contract.plan.md`.
- `/backlog/implementation/TASK-052-frontend-content-layout-before-clients-mockups.md`.

`TASK-052` confirmed the needed global layout baseline through the completed `TASK-048` implementation and strengthened the responsive regression gate. `TASK-050` must not silently make all-screen layout changes.

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
The mobile mockup shows bottom navigation and an `Уведомления` tab. The current app uses a mobile drawer and does not have a notifications section route. Literal bottom navigation belongs to the separate task:

- `/backlog/implementation/TASK-051-mobile-bottom-navigation.md`;
- branch: `feature/TASK-051-mobile-bottom-navigation`.

That task must cover every mobile screen and routing/permissions behavior. TASK-050 should not create fake notification navigation or silently replace the app shell.

## Execution steps
1. Verify blocker status:
   - confirm `TASK-052` is completed or explicitly cancelled;
   - if `TASK-052` is still active, stop and do not implement `TASK-050`.
2. Prepare branch:
   - checkout `main`;
   - pull latest changes;
   - verify clean `git status`;
   - create `feature/TASK-050-clients-screen-mockups`.
3. Re-read current frontend rules in `frontend/AGENTS.md`.
4. Review the mockups in `docs/mockups/task-050` and capture the concrete UI checklist for:
   - desktop `/clients`;
   - mobile `/clients`;
   - mobile `/clients/:id/preview`.
5. Keep bottom navigation out of `TASK-050`:
   - do not add a fake `Уведомления` route;
   - do not replace the mobile drawer/app shell;
   - leave the work to `TASK-051`.
6. Update backend list contract for quick filters:
   - add `ClientQuickFilterCountsResponse`;
   - extend `ClientListResponse` with `QuickFilterCounts`;
   - add backend parsing for a comma-separated `quickFilters` query parameter;
   - support these quick filter keys: `WithoutMembership`, `ExpiringSoon`, `WithoutGroup`, `Trial`;
   - compute counts from the same access-scoped base query, excluding pagination and excluding the currently selected quick filters from the count base;
   - make counts respect search, status/archive, group, payment and access-scope filters;
   - keep membership/group/attendance semantics in backend.
7. Define backend quick filter semantics:
   - `WithoutMembership`: non-professional clients with no current membership;
   - `ExpiringSoon`: clients whose current membership expiration is inside `ClientMembershipQueryConstants.ExpiringMembershipWindowDays`;
   - `WithoutGroup`: clients without active group assignments visible in the current user's access scope;
   - `Trial`: clients whose current membership type is `SingleVisit`.
8. Move required action / urgency semantics to backend:
   - add `ClientActionHintResponse`;
   - return it in both `ClientListItemResponse` and `ClientDetailsResponse`;
   - include semantic fields `Kind`, `Urgency`, `Reason` and nullable `DaysUntilExpiration`;
   - compute priority in backend from membership, payment, group and professional status;
   - keep frontend responsible only for mapping semantic codes to text, icons and colors.
9. Update frontend API types/mappers for the backend contract:
   - `frontend/src/lib/api/types.ts`;
   - `frontend/src/lib/api/clients.ts`;
   - `frontend/src/lib/api/endpoints.ts`;
   - add mapper tests if the project already has nearby API mapper tests.
10. Update client list state:
   - expose quick filter counts;
   - keep selected-client behavior;
   - preserve pagination, debounced search, role-limited phone visibility and coach scope behavior.
11. Update view models:
   - remove frontend-owned CRM priority decisions from `resolveNextAction`;
   - map backend action hint codes to mockup-specific labels, icons, tones and short descriptions;
   - build row facts: status, membership, next step, group, visit;
   - build preview facts and short history;
   - avoid frontend-only domain decisions beyond rendering backend data.
12. Rework desktop layout:
   - title `Клиенты` with total count badge;
   - top-right `Новый клиент` action for managers;
   - search and filters in one row;
   - status chips: `Активные`, `Архив`, `Без абонемента`, `Скоро закончится`, `Без группы`, filter button;
   - table-like client rows matching the mockup columns;
   - selected row border state;
   - right preview panel with profile header, required action block, short information and action tiles.
13. Rework mobile list layout:
    - compact top bar and create button;
    - search input;
    - horizontal status chips;
    - quick filter cards with icons;
    - client cards with avatar initials, phone, status, urgency, membership/group state and open affordance;
    - pagination and page-size select.
14. Add mobile quick-preview route:
    - add route `/clients/:id/preview`;
    - keep existing `/clients/:id` as the full card;
    - wire list-card tap/open behavior deliberately for mobile vs desktop;
    - CTA `Открыть полную карточку` navigates to `/clients/:id`.
15. Wire action tiles as simple full-card transitions:
    - `Оформить абонемент` navigates to `/clients/:id`;
    - `Сообщение` navigates to `/clients/:id`;
    - `Посещение` navigates to `/clients/:id`;
    - `Открыть карточку`/`Вся информация` navigates to `/clients/:id`;
    - do not add new intent/deep-link behavior in this task.
16. Preserve read-only coach behavior:
    - phone remains hidden if backend hides it;
    - create/edit/manage actions are hidden when `canManageClients` is false;
    - no frontend permission inference beyond session permissions and backend response.
17. Update CSS in `App.css`:
    - keep new selectors scoped to `clients-*`;
    - keep shared/all-screen content-layout CSS out of `TASK-050`;
    - do not override the shared `FilterToolbar` container padding/radius/background/border from `clients-*`; only inner controls/list/preview/mobile details are clients-scoped;
    - use `TASK-052`/`TASK-048` for all-screen layout tokens and shared primitives;
    - ensure no page-level horizontal scroll at required responsive widths.
18. Update tests and run validation.

## Preferred implementation strategy
1. Backend-contract first for `quickFilterCounts`, selected quick filters and backend-owned action hints.
2. Frontend-first only for visual structure that renders backend-owned data.
3. Keep shell/global layout unchanged in TASK-050; all-screen layout work belongs to `TASK-052`/`TASK-048`.
4. Preserve current domain behavior and routes; add `/clients/:id/preview` only as a presentation/navigation layer.
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
- `frontend/src/features/clients/list/ClientMobilePreviewScreen.tsx`
- `frontend/src/features/clients/list/clientListViewModel.ts`
- `frontend/src/features/clients/list/useClientsListState.ts`
- `frontend/src/features/clients/list/clientListFilters.ts`
- `frontend/src/features/clients/ClientManagement.tsx`
- `frontend/src/lib/appRoutes.ts`
- `frontend/src/App.tsx`
- `frontend/src/App.css`
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/clients.ts`
- `frontend/src/lib/api/endpoints.ts`
- `frontend/src/lib/resources.ts`

Backend:
- `backend/src/GymCrm.Api/Auth/ClientListResponse.cs`
- `backend/src/GymCrm.Api/Auth/ClientQuickFilterCountsResponse.cs`
- `backend/src/GymCrm.Api/Auth/ClientActionHintResponse.cs`
- `backend/src/GymCrm.Api/Auth/ClientListItemResponse.cs`
- `backend/src/GymCrm.Api/Auth/ClientDetailsResponse.cs`
- `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs`
- `backend/tests/GymCrm.Tests/ClientsApiTests.cs`

Tests:
- `frontend/src/lib/api/clients.test.ts`
- `frontend/src/features/clients/list/clientListViewModel.test.ts`
- `frontend/e2e/stage12.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`

## Constraints
- Do not duplicate CRM business rules in frontend.
- Do not compute global quick filter counts from only the visible page.
- Do not compute required action priority, urgency, expiring-soon windows or membership issue semantics in frontend.
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
- `clientListViewModel` tests for rendering backend action hint labels/tones, membership labels, group labels, history/fact mapping;
- `clientListFilters` tests for selected quick filter query behavior;
- API mapper tests for `quickFilterCounts` and action hint mapping.

### Backend integration tests
- list response includes quick filter counts;
- list and details responses include action hint fields;
- counts respect status/search/group/payment filters and exclude selected quick filters from the count base;
- selected quick filters apply the backend-owned semantics for `WithoutMembership`, `ExpiringSoon`, `WithoutGroup` and `Trial`;
- `ExpiringSoon` uses `ClientMembershipQueryConstants.ExpiringMembershipWindowDays`;
- action hint priority is computed by backend and covers professional, no membership, unpaid, expired, used single visit, expiring soon, no group and normal cases;
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
- [ ] `dotnet test backend/GymCrm.slnx`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:unit`
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

Backend barrier:
- `ClientsApiTests` must lock quick count semantics, action hint semantics and access scope.

## Risks
- Quick filter counts can be wrong if implemented in frontend; keep them backend-owned.
- Mobile bottom navigation in the mockup overlaps with a broader app-shell decision.
- Desktop right preview may fight the shared content width from TASK-048; keep it feature-scoped unless shared layout task is active.
- Existing `ClientDetailScreen` is large; avoid opportunistic redesign while adding preview CTA.
- Coach read-only behavior can regress if action tiles are not permission-gated.

## Stop conditions
Stop before implementation if:
- branch is not created from clean updated `main`;
- `TASK-052` is still active;
- implementation requires changing global `content-layout` without coordinating all screens listed above;
- implementation requires adding real notifications navigation;
- implementation requires backend role/permission/access-scope changes.

## Ready for Codex execution
no, blocked by `TASK-052`
