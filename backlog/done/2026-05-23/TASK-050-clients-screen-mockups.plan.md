# Implementation Plan: TASK-050 Экран Клиенты по макетам

## Source task
User request in Codex thread, 2026-05-23.

No source backlog task file was moved into `/backlog/implementation`.

## Mockups
Use these mockups:
- desktop `/clients`: `docs/mockups/task-050/ChatGPT Image 23 мая 2026 г., 12_11_10.png`;
- mobile `/clients` and mobile `/clients/:id/preview`: `docs/mockups/task-050/ChatGPT Image 23 мая 2026 г., 12_09_07.png`.

The implementation must compare the finished `/clients` and `/clients/:id/preview` screens against these files during the manual/browser visual check. Visual acceptance targets pixel-level closeness to the mockups, while still preserving the current application shell and already accepted shared layout constraints.

## Implementation status
Done as of the 2026-05-27 status audit. Implementation is present in `main`
via `feature/TASK-050-clients-screen-mockups`.

Unblocked by completed `TASK-052` on 2026-05-23:
- `/backlog/done/2026-05-23/TASK-052-frontend-content-layout-before-clients-mockups.md`.

The `TASK-052` shared content-layout baseline was already in `main` before
implementation. TASK-050 then adjusted the clients list/preview experience and
backend list contract in its dedicated branch; broader client-detail follow-ups
remain tracked separately by TASK-016..TASK-021 where applicable.

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
- mobile client preview: compact profile header, required action block, action tiles, short information based on existing client data, full-card CTA.

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
- Required action / urgency semantics must be backend-owned through an ordered action-hints list; backend returns a ready-to-render action result, and frontend must not decide CRM action priority, labels, descriptions or urgency.

## Clarified product decisions
- Backend contracts are allowed to change in `TASK-050`.
- Shared layout is allowed to change in `TASK-050` when needed, but affected screens must be covered and validated.
- The title count badge shows the active clients total across the user's accessible client base.
- Quick filters filter the list with `OR` semantics.
- Quick filter counts use a faceted approach: each badge shows the count for its own quick filter, counts respect search, active/archive status, group, payment and access-scope filters, but are computed without applying the currently selected quick filters.
- Unknown `quickFilters` values must return `400 ProblemDetails`.
- Action hints are returned as a backend-ordered list of ready-to-render results: backend provides final labels, descriptions, urgency/tone and any lightweight UI keys/data required for rendering.
- The `/clients/:id/preview` route is a mobile-focused presentation route. Desktop `/clients/:id` behavior remains unchanged, and direct desktop navigation to `/clients/:id/preview` renders the same preview presentation rather than redirecting or showing a separate desktop screen.
- Mobile client cards open `/clients/:id/preview`; the preview CTA opens the full `/clients/:id` card.
- Desktop row clicks select the client in the right preview panel; opening the full card happens through an explicit CTA/action tile.
- Selected-client behavior remains as it works in the current implementation.
- Action tiles in this task navigate to `/clients/:id`; do not add new deep-link or messenger/attendance intents.
- For coach/read-only users, preview actions show only general client information / full-card access; manager-only action tiles such as membership, message or attendance actions are hidden.
- `TASK-051` mobile bottom navigation is already in `main`; `TASK-050` must adapt to the current shell and must not create fake notifications navigation.
- Full recent-history/domain timeline is out of scope. The preview may show only already available client facts such as last visit, current membership and group state.
- Filter UI model:
  - status chips: `Активные`, `Архив`;
  - quick filters: `Без абонемента`, `Скоро закончится`, `Без группы`, `Пробный`;
  - filter button: remaining structural filters such as group, payment and other existing list filters.

## Content-layout impact
The user explicitly requested that any `content-layout` changes be planned across all screens, not only `Клиенты`.

### Preferred boundary for TASK-050
Start with `clients-*` feature classes and existing shared components:
- `PageLayout`;
- `PageSection`;
- `FilterToolbar`;
- shared buttons/icons;
- client-specific desktop/mobile layout classes.

If shared page width, shell padding, page title typography, route-level card radius, filter toolbar defaults or responsive page spacing must change, make the change intentionally in shared layout code and validate every affected screen listed below. Do not make hidden all-screen layout changes as a clients-only CSS side effect.

### Existing related task
Global content-layout work already exists as:
- `/backlog/done/2026-05-21/TASK-048-frontend-content-layout-contract.md`;
- `/backlog/done/2026-05-21/TASK-048-frontend-content-layout-contract.plan.md`.
- `/backlog/done/2026-05-23/TASK-052-frontend-content-layout-before-clients-mockups.md`.

`TASK-052` confirmed the current global layout baseline through the completed `TASK-048` implementation and strengthened the responsive regression gate. `TASK-050` may evolve that baseline only with explicit all-screen coverage.

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
The mobile mockup shows bottom navigation and an `Уведомления` tab. `TASK-051` mobile bottom navigation is already in `main`; `TASK-050` must adapt to the current shell instead of recreating shell behavior.

- `/backlog/done/2026-05-23/TASK-051-mobile-bottom-navigation.md`;
- branch: `feature/TASK-051-mobile-bottom-navigation`.

Do not add a fake `Уведомления` route or new notifications section in `TASK-050`.

## Execution steps
1. Verify blocker status:
   - confirm `TASK-052` is completed in `/backlog/done`;
   - use the accepted shared layout baseline from `TASK-052` as the starting point.
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
5. Adapt to the current `TASK-051` mobile shell:
   - do not add a fake `Уведомления` route;
   - do not replace the app shell;
   - fit the clients screen into the shell that is already in `main`.
6. Update backend list contract for quick filters:
   - add `ClientQuickFilterCountsResponse`;
   - extend `ClientListResponse` with `QuickFilterCounts`;
   - add backend parsing for a comma-separated `quickFilters` query parameter;
   - support these quick filter keys: `WithoutMembership`, `ExpiringSoon`, `WithoutGroup`, `Trial`;
   - apply selected quick filters to the list with `OR` semantics;
   - reject unknown quick filter values with `400 ProblemDetails`;
   - compute counts from the same access-scoped base query, excluding pagination and excluding all currently selected quick filters from the count base;
   - make counts respect search, status/archive, group, payment and access-scope filters;
   - keep membership/group/attendance semantics in backend.
7. Define backend quick filter semantics:
   - `WithoutMembership`: non-professional clients with no current membership;
   - `ExpiringSoon`: clients whose current membership is expired or whose expiration is inside `ClientMembershipQueryConstants.ExpiringMembershipWindowDays`;
   - `WithoutGroup`: clients without active group assignments visible in the current user's access scope; frontend hides this quick filter for roles other than administrators and head coaches;
   - `Trial`: clients whose current membership type is `SingleVisit`, including used or expired single-visit memberships.
8. Move required action / urgency semantics to backend:
   - add `ClientActionHintResponse`;
   - return an ordered `ActionHints` list in both `ClientListItemResponse` and `ClientDetailsResponse`;
   - include ready-to-render fields such as `Title`, `Description`, `Tone`, `IconKey` and nullable `DaysUntilExpiration` where useful;
   - return final Russian labels/reasons/descriptions from backend;
   - compute hint priority/order in backend from membership, payment, group and professional status;
   - keep frontend responsible only for rendering backend-provided action hint fields and binding local icon components to backend-provided `IconKey` values if needed.
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
   - render backend-provided action hint titles, descriptions, tones and icon keys without recomputing labels or urgency;
   - build row facts: status, membership, next step, group, visit;
   - build preview facts and short information from existing client fields;
   - do not introduce a new recent-history domain model in this task;
   - avoid frontend-only domain decisions beyond rendering backend data.
12. Rework desktop layout:
   - title `Клиенты` with active total count badge;
   - top-right `Новый клиент` action for managers;
   - search and filters in one row;
   - status chips: `Активные`, `Архив`;
   - quick filter chips: `Без абонемента`, `Скоро закончится`, `Без группы`, `Пробный`;
   - filter button for remaining structural filters;
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
   - treat it as a mobile-focused presentation route;
   - direct desktop navigation to `/clients/:id/preview` renders the same preview presentation;
   - keep existing `/clients/:id` as the full card;
   - on mobile list-card tap navigates to `/clients/:id/preview`;
   - on desktop row click selects the row and updates the right preview panel;
   - do not introduce a separate desktop-specific presentation for `/clients/:id/preview`;
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
    - coach/read-only preview actions show only general client information / full-card access;
    - membership, message and attendance action tiles are hidden when they would imply manager-only operations;
    - no frontend permission inference beyond session permissions and backend response.
17. Update CSS in `App.css`:
   - keep new selectors scoped to `clients-*`;
   - keep client-only visual work in clients-scoped selectors;
   - if shared/all-screen content-layout CSS must change, update shared selectors/primitives deliberately and validate the affected screens listed in this plan;
   - do not override shared `FilterToolbar` container padding/radius/background/border from `clients-*` as a hidden workaround;
   - use `TASK-052`/`TASK-048` as the current baseline for all-screen layout tokens and shared primitives;
   - ensure no page-level horizontal scroll at required responsive widths.
18. Update tests and run validation.

## Preferred implementation strategy
1. Backend-contract first for `quickFilterCounts`, selected quick filters and backend-owned action hints.
2. Frontend-first only for visual structure that renders backend-owned data.
3. Prefer clients-scoped visual work first; make shared layout changes only when required and validate affected screens.
4. Preserve current domain behavior and routes; add `/clients/:id/preview` only as a presentation/navigation layer.
5. Use small components:
   - desktop table/list;
   - mobile cards;
   - preview profile header;
   - required-action card;
   - action tiles;
   - info facts;
   - short information from existing client data.

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
- shared layout/component files if coordinated content-layout changes are required

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
- Do not compute required action priority, urgency, labels/descriptions, expiring-soon windows or membership issue semantics in frontend.
- Do not change unrelated backend validation, audit, roles, permissions or access scope unless a separate backend task is created.
- Return `400 ProblemDetails` for unknown `quickFilters` values.
- Preserve Mantine and Onest.
- Preserve existing client CRUD and membership workflows.
- Keep manager and coach behavior distinct according to backend contracts and session permissions.
- Do not add a fake `Уведомления` route just because it appears in the mobile mockup.
- Do not combine this with unrelated global shell/bottom-nav work.

## Out of scope
- Full redesign of `ClientDetailScreen` beyond navigation/CTA integration.
- New notifications feature.
- New mobile shell or bottom navigation work beyond adapting to the current `TASK-051` shell.
- Unrelated global content-layout redesign beyond changes needed to fit the clients mockups and validate affected screens.
- New backend membership semantics.
- New full recent-history/timeline backend feature.
- New attendance workflow.
- New messenger backend features.

## Required test coverage

### Unit tests
Add or update if implementation changes pure logic:
- `clientListViewModel` tests for rendering backend-provided action hint labels/tones, membership labels, group labels and preview fact mapping;
- `clientListFilters` tests for selected quick filter query behavior;
- API mapper tests for `quickFilterCounts` and action hint ready-result fields.

### Backend integration tests
- list response includes quick filter counts;
- list and details responses include ordered action hint lists;
- counts respect status/search/group/payment filters and exclude selected quick filters from the count base;
- selected quick filters filter the list with `OR` semantics;
- unknown quick filter values return `400 ProblemDetails`;
- selected quick filters apply the backend-owned semantics for `WithoutMembership`, `ExpiringSoon`, `WithoutGroup` and `Trial`;
- `ExpiringSoon` includes expired memberships and uses `ClientMembershipQueryConstants.ExpiringMembershipWindowDays` for the soon-expiring window;
- `Trial` includes used or expired `SingleVisit` memberships;
- `WithoutGroup` semantics respects the current user's access scope when the filter is available;
- action hint priority/order is computed by backend and covers professional, no membership, unpaid, expired, used single visit, expiring soon, no group and normal cases;
- counts respect coach access scope;
- counts do not expose phone/manager-only data to coach users;
- existing pagination and active/archive counts remain intact.

### UI/e2e tests
Update or add:
- desktop `/clients` renders title, count, create action, filters, selected row and preview panel;
- mobile `/clients` renders search, chips, quick filter cards, client cards and pagination without horizontal scroll;
- desktop row selection updates the right preview and full-card CTA opens `/clients/:id`;
- mobile card tap opens `/clients/:id/preview` and preview CTA opens `/clients/:id`;
- direct desktop navigation to `/clients/:id/preview` renders the same preview presentation;
- manager sees create/manage actions;
- coach does not see manager-only actions;
- roles other than administrators and head coaches do not see the `Без группы` quick filter;
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
- If shared layout is changed, responsive coverage must include every affected screen listed in the content-layout section.

Secondary barrier:
- `stage12.spec.ts` protects filtering, pagination and client navigation behavior.

Backend barrier:
- `ClientsApiTests` must lock quick count semantics, ready action hint result semantics and access scope.

## Risks
- Quick filter counts can be wrong if implemented in frontend; keep them backend-owned.
- Mobile bottom navigation in the mockup must be reconciled with the already-merged `TASK-051` shell, not recreated.
- Desktop right preview may require shared content width/layout adjustments; validate affected screens if shared layout changes.
- Existing `ClientDetailScreen` is large; avoid opportunistic redesign while adding preview CTA.
- Coach read-only behavior can regress if action tiles are not permission-gated.

## Stop conditions
Stop before implementation if:
- branch is not created from clean updated `main`;
- implementation requires unplanned global `content-layout` changes without coordinating all screens listed above;
- implementation requires adding real notifications navigation;
- implementation requires backend role/permission/access-scope changes beyond hiding `WithoutGroup` on the frontend for unsupported roles and preserving backend access-scope semantics.

## Ready for Codex execution
yes
