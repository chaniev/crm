# Implementation Plan: TASK-056 Привести области фильтров к единому компактному виду

## Source task
/backlog/implementation/TASK-056-filter-panel-requirements.md

## Implementation branch
feature/TASK-056-filter-panel-requirements

Branch rules:
- create this branch from `main` before writing code;
- do not implement other unrelated TASKs in this branch;
- confirm the branch is active before making project code changes;
- required preflight: `git checkout main`, `git pull`, `git status --short --branch`, `git checkout -b feature/TASK-056-filter-panel-requirements`.

## Goal
Все экраны CRM с фильтрами должны получить компактную единую панель фильтров непосредственно над таблицей, доской, календарной доской или ростером основного контента: одна строка на desktop/tablet, secondary-фильтры в `Ещё фильтры`, при нехватке ширины фильтры уходят в `Ещё фильтры` справа налево только на экранах с secondary-фильтрами, на mobile все фильтры открываются только в fullscreen bottom sheet без inline filter controls, автоматическое применение без submit/reload. Панель без заголовка секции, без card wrapper, без shadow, без nested cards, высота на desktop/tablet <=64 px.

## Current understanding
Требование frontend-only. Backend contracts, роли, permissions, validation semantics и CRM-домен не меняются.

Текущий shared-компонент `FilterToolbar` есть в `frontend/src/features/shared/ux.tsx`, но он сейчас является простым контейнером, а стили в `frontend/src/App.css` допускают крупные карточки, заголовки, `SimpleGrid`, wrap и разные высоты. Нужно поднять общий фильтр-паттерн до reusable UI-компонента и мигрировать существующие экраны.

Документ `docs/mockups/требования к области фильтра/filter_requirements.docx` задает: панель 56 px, максимум 64 px; padding 8/12 px; gap 8 px; controls/buttons 36 px; dropdown 140-220 px; icons 16 px; white background, border `#E5E7EB`, radius 10 px, no shadow; control border `#D1D5DB`, radius 8 px; hover `#9CA3AF`, active/focus `#2563EB`; no wrap; ellipsis; desktop >=1280, tablet 768-1279, mobile <=767.

Typography decision: `frontend/AGENTS.md` requires preserving Mantine and Onest. The doc mentions Inter, but implementation must keep the existing project font family `Onest, ui-sans-serif, system-ui, sans-serif` and apply only the required filter text sizes/weights/line-heights. Do not switch the frontend to Inter in this task.

Required specialists during implementation:
- `ui-designer`: validate the final compact visual style against the DOCX/PNG and confirm the filter panel has no section header, no card wrapper, no shadow, no nested cards, and desktop/tablet height <=64 px.
- `react-specialist`: own the shared React structure and screen migrations.
- `test-automator` is recommended for Playwright geometry/mobile regression checks.

## Screen inventory
Screens with filter areas that must be updated:
- `/clients`: `ClientsListScreen` via `ClientsToolbar`, `ClientsQuickFilters`, `useClientsListState`. Current state: custom filter panel, quick filter cards on mobile, right Drawer for more filters.
- `/schedule`: `GroupScheduleScreen`. Current state: separate schedule filters section, desktop oversized selects, mobile inline expand/collapse.
- `/attendance`: `AttendanceScreen`. Current state: section titled `Фильтры посещений` with group/date controls.
- `/audit`: `AuditLogScreen`. Current state: filter card with section header, form submit button `Применить фильтры`, 7 controls in grid.
- `/finance`: `FinanceReportsScreen`. Current state: filter card with period button grid, form submit button `Показать`, branch/trainer/date controls.

Screens explicitly excluded because they do not have a filter area:
- `/`: `HomeDashboard` has dashboard data and refresh, but no filter panel.
- `/groups`: `GroupsListScreen` has CRUD list/metrics, but no user-facing filters.
- `/users`: `UsersListScreen` has list/metrics, but no user-facing filters.
- `/settings`: settings tabs and CRUD forms are not filter panels.
- Auth/password screens, client create/edit/detail, group create/edit, user create/edit and placeholders are forms or route states, not filter areas.

## Current filters and priority
Primary/secondary filter assignments are fixed by this section. Do not choose or re-rank primary filters during implementation.

Desktop/tablet fit is determined from the real rendered width of the full panel after layout, including primary controls, the `Ещё фильтры` action when present, `Сбросить`, gaps and paddings. On screens with secondary filters, if the primary row does not fit, move primary controls to `Ещё фильтры` from right to left, starting with the rightmost filter in the current row order. Inside `Ещё фильтры`, overflowed primary filters must render before fixed secondary filters. On screens where `Secondary filters: none`, do not render `Ещё фильтры`; the implementation must keep the primary row fitting through compact widths, ellipsis and responsive constraints.

Desktop/tablet right action order is fixed: `Ещё фильтры` first when it exists, then `Сбросить`. Do not render a visible active-count area or badge for the number of set filters.

Mobile behavior is fixed: render only a compact filter launcher above the table/board/roster, with no inline filter controls, no inline reset control and no active-count area. The launcher opens a Mantine fullscreen bottom `Drawer`/sheet (`position="bottom"` with fullscreen sizing) that contains all filters for the screen, a close icon in the header and `Сбросить` inside the sheet. Filter changes still auto-apply; there is no submit/apply button.

### `/audit`
Current filters:
- `userId` Пользователь
- `source` Источник
- `messengerPlatform` Мессенджер
- `actionType` Тип действия
- `entityType` Тип объекта
- `dateFrom` Период с
- `dateTo` Период по

Primary filters:
- `userId` Пользователь
- `actionType` Тип действия
- `dateFrom` Период с
- `dateTo` Период по

Secondary filters:
- `source` Источник
- `messengerPlatform` Мессенджер
- `entityType` Тип объекта

### `/finance`
Current filters:
- `periodPreset` Месяц/Квартал/Год/Период
- `anchorDate` Дата в периоде
- `from` С
- `to` По
- `branchId` Филиал
- `trainerId` Тренер

Primary filters:
- `periodPreset` Быстрый период: Месяц/Квартал/Год/Период
- `branchId` Филиал
- `trainerId` Тренер

Secondary filters:
- `anchorDate` Дата в периоде
- `from` С, shown/enabled for quick period `Период`
- `to` По, shown/enabled for quick period `Период`

### `/clients`
Current filters:
- `query` Поиск
- `status` Статус
- `groupId` Группа
- `paymentStatus` Оплата
- `membershipExpiresFrom` Истекает с
- `membershipExpiresTo` Истекает по
- `withoutPhoto` Без фото
- `withoutMembership` Без абонемента
- `expiringSoon` Скоро закончится
- `withoutGroup` Без группы
- `trial` Пробные
- `pageSize` Размер страницы

Primary filters:
- `query` Поиск
- `groupId` Группа
- `paymentStatus` Оплата
- `membershipExpiresFrom` Истекает с
- `withoutMembership` Без абонемента
- `expiringSoon` Скоро закончится
- `withoutGroup` Без группы
- `trial` Пробные

Secondary filters:
- `status` Статус
- `membershipExpiresTo` Истекает по
- `withoutPhoto` Без фото
- `pageSize` Размер страницы

### `/schedule`
Current filters:
- `branchId` Филиал
- `hallId` Зал
- `trainerId` Тренер
- `groupId` Группа

Primary filters:
- `branchId` Филиал
- `hallId` Зал
- `trainerId` Тренер
- `groupId` Группа

Secondary filters:
- none

### `/attendance`
Current filters:
- `selectedGroupId` Группа
- `trainingDate` Дата тренировки

Primary filters:
- `selectedGroupId` Группа
- `trainingDate` Дата тренировки

Secondary filters:
- none

## Execution steps
1. Branch and preflight
   - Switch to `main`, pull latest changes and verify clean status.
   - Create `feature/TASK-056-filter-panel-requirements`.
   - Read `AGENTS.md` and `frontend/AGENTS.md` before frontend edits.

2. Create the shared compact filter API
   - Replace or extend `FilterToolbar` with a reusable compact filter panel in `frontend/src/features/shared/ux.tsx` or a focused sibling module under `frontend/src/features/shared/`.
   - Support primary controls, secondary controls, right-side actions in the fixed order `Ещё фильтры` then `Сбросить`, accessible labels and controlled open state when needed.
   - Do not render an active-count area/badge for the number of set filters.
   - `Сбросить` always clears all filters on the screen on every migrated route, rather than restoring previously selected defaults.
   - Render desktop/tablet secondary filters through Mantine `Popover`/dropdown with 320 px target width, acceptable test range 300-340 px, and max 480 px height.
   - Render mobile filters through a fullscreen bottom sheet using Mantine `Drawer` configured as bottom/fullscreen; no filter controls, reset control or active-count area should remain inline on the mobile page, only the launcher/action to open the sheet.
   - Keep a single-row desktop/tablet layout with CSS grid/flex constraints, no wrap, text ellipsis and stable 36 px controls.
   - If the desktop/tablet primary row does not fit on screens with secondary filters, move controls to `Ещё фильтры` from right to left, based on real rendered width after including actions and gaps.
   - Do not render `Ещё фильтры` on screens whose fixed secondary filter list is empty.

3. Migrate `/audit`
   - Use the fixed primary/secondary filters from `Current filters and priority`.
   - Remove submit button and make filter changes auto-apply: select/date controls apply immediately; text inputs, if any are added later, apply after a debounce <=300 ms.
   - Keep stable backend request values for action/entity types.
   - Keep existing ProblemDetails/error display behavior.

4. Migrate `/finance`
   - Convert period selection to the same shared compact control pattern used by other screens; `periodPreset` is a primary quick-period filter with Месяц/Квартал/Год/Период options, not a large bespoke period grid.
   - Use the fixed primary/secondary filters from `Current filters and priority`.
   - Remove `Показать`; apply select/date/period changes immediately and preserve backend field-error display.
   - Do not change report API params or financial semantics.

5. Migrate `/clients`
   - Keep search/status/key grouping behavior without backend rule duplication.
   - Use the fixed primary/secondary filters from `Current filters and priority`.
   - Search/query changes apply after a debounce <=300 ms; select/switch/date/button changes apply immediately.
   - Replace the current right Drawer on desktop/tablet with the shared popover and use fullscreen bottom sheet on mobile.
   - Move `query` into the primary filter set.
   - Merge all existing quick filters from `ClientsQuickFilters` into the primary filter set; do not keep them as a separate second filter level.

6. Migrate `/schedule`
   - Keep existing local schedule filtering only; do not change schedule API or calendar grouping rules.
   - Use the fixed primary/secondary filters from `Current filters and priority`.
   - Replace oversized desktop selects and separate card treatment with the shared compact panel.
   - Replace mobile inline expanded section with fullscreen bottom sheet.
   - Place the filter panel above the schedule board, with no section header, no card wrapper, no shadow, no nested cards, and desktop/tablet height <=64 px.

7. Migrate `/attendance`
   - Use compact panel with group and training date directly above the roster.
   - Use the fixed primary/secondary filters from `Current filters and priority`.
   - Remove the extra filter section header/card treatment.
   - Keep group loading/error/empty states unchanged.

8. Clean CSS and visual consistency
   - Consolidate `.filter-toolbar` styling around the requirements.
   - Remove or override screen-specific filter styles that force large controls, section headers, card wrappers, nested cards, shadows, wrap, oversized icons or extra vertical levels.
   - Keep the broader app theme intact; only filter panel/control styling should change.

9. Regression tests and manual visual QA
   - Update component tests for the shared filter panel.
   - Add Playwright checks for `/audit`, `/finance`, `/clients`, `/schedule`, and `/attendance` across desktop/tablet/mobile.
   - Compare the final audit/journal-like panel manually with `docs/mockups/требования к области фильтра/фильтры в журналах.png`.

## Preferred implementation strategy
This is frontend-only and should be implemented through a shared UI pattern first, then screen-by-screen migration.

Preferred sequence:
1. shared filter panel contract and CSS;
2. audit screen as the reference because it matches the provided journal mockup most closely;
3. finance and attendance because they are smaller form-like filter panels;
4. schedule and clients because they have the highest layout/regression risk;
5. regression tests and responsive visual QA.

Avoid changing backend APIs, adding new domain filters, moving table/list/calendar behavior, or reinterpreting permissions in frontend code.

## Files likely to change
- `frontend/src/features/shared/ux.tsx`
- `frontend/src/features/shared/ux.test.tsx`
- `frontend/src/App.css`
- `frontend/src/features/audit/AuditLogScreen.tsx`
- `frontend/src/features/finance/FinanceReportsScreen.tsx`
- `frontend/src/features/attendance/AttendanceScreen.tsx`
- `frontend/src/features/schedule/GroupScheduleScreen.tsx`
- `frontend/src/features/clients/list/ClientsToolbar.tsx`
- `frontend/src/features/clients/list/ClientsQuickFilters.tsx`
- `frontend/src/features/clients/list/useClientsListState.ts`
- `frontend/src/features/clients/list/clientListFilters.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`
- `frontend/e2e/group-schedule.spec.ts`
- `frontend/e2e/finance-reports.spec.ts`
- `frontend/e2e/stage12.spec.ts`
- `frontend/e2e/filter-panel.spec.ts` if a dedicated regression spec is clearer than expanding existing files.

If the shared component is split out, add a focused file such as:
- `frontend/src/features/shared/FilterPanel.tsx`

## Constraints
- Preserve Mantine and Onest.
- Do not duplicate CRM business logic, permissions, validation or backend filtering semantics in frontend.
- Do not change backend contracts.
- Do not add new filters beyond existing screen scenarios.
- Do not add saved filter behavior, saved filter templates, or a saved-filter panel.
- Desktop/tablet filter panels must not wrap to a second row.
- Filter panel must have no section header, no card wrapper, no shadow, no nested cards, and desktop/tablet height <=64 px.
- On screens with secondary filters, if the desktop/tablet primary row does not fit by real rendered width, controls move to `Ещё фильтры` from right to left and render before secondary filters inside the popover.
- On screens with `Secondary filters: none`, do not render the `Ещё фильтры` button.
- Desktop/tablet right action order is `Ещё фильтры`, then `Сбросить`; no active-count area/badge is rendered.
- On mobile, all filters must be inside the fullscreen bottom sheet; no filter controls, reset control or active-count area remain inline on the page.
- `Сбросить` clears all filters on the screen.
- Text inside controls must use nowrap, overflow hidden and ellipsis.
- No service text like `Фильтры применяются автоматически`.

## Out of scope
- Backend filtering behavior or API params beyond preserving existing frontend calls.
- Role/permission changes.
- Table/list/calendar redesign outside the spacing needed to place the compact panel.
- New analytics, new report dimensions or new client/schedule filter semantics.
- Global typography migration from Onest to Inter.

## Required test coverage

### Unit tests
Add/update tests for the shared filter panel:
- renders primary controls, secondary trigger when applicable and actions accessibly;
- hides secondary/overflow content by default and opens it through `Ещё фильтры`;
- does not render `Ещё фильтры` when fixed secondary filters are empty and no overflow popover is allowed for that screen;
- exposes reset labels/accessibility and verifies reset triggers an all-filters clear callback;
- respects mobile/desktop branching if the component has behavior beyond CSS.

Update screen-level tests only where local filtering helpers change.

### Integration tests
No backend integration tests are required because contracts do not change.

Frontend integration/e2e network assertions are required for:
- audit stable `actionType`/`entityType` request values after auto-apply;
- finance period/custom date/branch/trainer params after auto-apply;
- clients list query/group/status/quick filter params after auto-apply and reset;
- schedule filtering remains local and does not start calling unrelated group collection endpoints;
- attendance roster loads by selected group/date after filter changes.

### UI tests
Add or update Playwright coverage for:
- required routes: `/audit`, `/finance`, `/clients`, `/schedule`, `/attendance`;
- required viewports for each route: desktop 1440 px, tablet 768 px, mobile 390 px;
- desktop >=1280 px: each filter panel height <=64 px, one row, max five visible primary controls before overflow, `Сбросить` after `Ещё фильтры` when both exist, no horizontal page scroll;
- tablet 768-1279 px: no wrapping; secondary controls and overflowed primary controls are reachable through `Ещё фильтры` only on screens with secondary filters;
- desktop/tablet: no section header, no card wrapper, no shadow, no nested cards in filter panels;
- desktop/tablet: screens with `Secondary filters: none` do not render `Ещё фильтры`;
- mobile <=767 px: no inline filter controls, inline reset control or active-count area are visible on the page and all filters open in fullscreen bottom sheet;
- popup dimensions: target width 320 px, acceptable test range 300-340 px, max height <=480 px;
- no visible `Фильтры применяются автоматически`;
- filter changes update results without page reload.

### Manual validation
Manual visual QA is still required because the task is visual:
- compare the audit/journal filter panel against `docs/mockups/требования к области фильтра/фильтры в журналах.png`;
- inspect long option labels for ellipsis;
- check hover/focus/active states for controls and icon-buttons.

## Test plan
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:unit`
- [ ] `cd frontend && npm run test:e2e -- filter-panel.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- responsive-main-screens.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- group-schedule.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- finance-reports.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- stage12.spec.ts`
- [ ] Manually inspect `/audit`, `/finance`, `/clients`, `/schedule`, `/attendance` at 1440, 768 and 390 px.

## Regression barrier
The main regression barrier is automated Playwright geometry and behavior coverage around the shared filter panel plus route-specific request assertions. A task implementation is not complete until tests prove: one-row desktop/tablet panels, no section header/card wrapper/shadow/nested cards, mobile fullscreen bottom sheet with no inline filter controls/reset/active count, no page reload on filter changes, no visible auto-apply helper text, reset clears all filters, screens with empty secondary filters do not render `Ещё фильтры`, and unchanged backend request semantics for audit/finance/clients.

## Risk notes
- Medium risk due to broad frontend surface and existing screen-specific CSS.
- Highest risk screens are `/clients` and `/schedule` because they already contain custom responsive filter behavior.
- Auto-apply on audit/finance changes existing submit-driven behavior; request cancellation or stale-response guards must avoid stale UI updates.
- Search/query inputs should debounce by <=300 ms; select/date/switch/button controls should apply immediately.
