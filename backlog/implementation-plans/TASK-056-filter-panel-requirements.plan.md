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
Все экраны CRM с фильтрами должны получить компактную единую панель фильтров прямо над основным контентом: одна строка на desktop/tablet, secondary-фильтры в `Ещё фильтры`, mobile через fullscreen bottom sheet, автоматическое применение без submit/reload и без лишнего визуального веса.

## Current understanding
Требование frontend-only. Backend contracts, роли, permissions, validation semantics и CRM-домен не меняются.

Текущий shared-компонент `FilterToolbar` есть в `frontend/src/features/shared/ux.tsx`, но он сейчас является простым контейнером, а стили в `frontend/src/App.css` допускают крупные карточки, заголовки, `SimpleGrid`, wrap и разные высоты. Нужно поднять общий фильтр-паттерн до reusable UI-компонента и мигрировать существующие экраны.

Документ `docs/mockups/требования к области фильтра/filter_requirements.docx` задает: панель 56 px, максимум 64 px; padding 8/12 px; gap 8 px; controls/buttons 36 px; dropdown 140-220 px; icons 16 px; white background, border `#E5E7EB`, radius 10 px, no shadow; control border `#D1D5DB`, radius 8 px; hover `#9CA3AF`, active/focus `#2563EB`; no wrap; ellipsis; desktop >=1280, tablet 768-1279, mobile <=767.

Typography decision: `frontend/AGENTS.md` requires preserving Mantine and Onest. The doc mentions Inter, but implementation must keep the existing project font family `Onest, ui-sans-serif, system-ui, sans-serif` and apply only the required filter text sizes/weights/line-heights. Do not switch the frontend to Inter in this task.

Required specialists during implementation:
- `ui-designer`: validate the final compact visual style against the DOCX/PNG and keep filters visually secondary.
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

## Execution steps
1. Branch and preflight
   - Switch to `main`, pull latest changes and verify clean status.
   - Create `feature/TASK-056-filter-panel-requirements`.
   - Read `AGENTS.md` and `frontend/AGENTS.md` before frontend edits.

2. Create the shared compact filter API
   - Replace or extend `FilterToolbar` with a reusable compact filter panel in `frontend/src/features/shared/ux.tsx` or a focused sibling module under `frontend/src/features/shared/`.
   - Support primary controls, secondary controls, right-side `Сбросить`, save icon-button, `Ещё фильтры`, active count, accessible labels and controlled open state when needed.
   - Render desktop/tablet secondary filters through Mantine `Popover`/dropdown with about 320 px width and max 480 px height.
   - Render mobile filters through fullscreen bottom sheet, preferably Mantine `Drawer` configured as a bottom/fullscreen sheet.
   - Keep a single-row desktop/tablet layout with CSS grid/flex constraints, no wrap, text ellipsis and stable 36 px controls.

3. Add frontend-only saved filter behavior
   - Implement a small reusable filter preference helper/hook if needed, scoped by screen key.
   - Save current filter values through a 36x36 icon-button only.
   - Restore saved filters on screen load without backend contract changes.
   - Do not add a saved-filter templates list or separate saved-filter panel.

4. Migrate `/audit`
   - Primary filters: user, action, date range, key object/entity type.
   - Secondary filters in `Ещё фильтры`: source and messenger platform.
   - Remove submit button and make filter changes auto-apply with <=300 ms debounce where needed.
   - Keep stable backend request values for action/entity types.
   - Keep existing ProblemDetails/error display behavior.

5. Migrate `/finance`
   - Convert period selection to a compact one-row control.
   - Primary filters: period/date, branch, trainer.
   - Put custom date range details into the main row only when it still fits; otherwise use `Ещё фильтры`.
   - Remove `Показать`; apply changes automatically with debounce and preserve backend field-error display.
   - Do not change report API params or financial semantics.

6. Migrate `/clients`
   - Keep search/status/key grouping behavior without backend rule duplication.
   - Primary row should contain search, status and the most important key filter(s), plus `Ещё фильтры`, reset and save.
   - Move lower-priority filters to `Ещё фильтры`: payment status, membership date range, without photo, page size and quick flags that do not fit.
   - Replace the current right Drawer on desktop/tablet with the shared popover and use fullscreen bottom sheet on mobile.
   - Remove/merge `ClientsQuickFilters` if it becomes a second filter level.

7. Migrate `/schedule`
   - Keep existing local schedule filtering only; do not change schedule API or calendar grouping rules.
   - Primary row can keep branch, hall, trainer and group because there are four filters.
   - Replace oversized desktop selects and separate card treatment with the shared compact panel.
   - Replace mobile inline expanded section with fullscreen bottom sheet.
   - Preserve the schedule board as the dominant visual element.

8. Migrate `/attendance`
   - Use compact panel with group and training date directly above the roster.
   - Remove the extra filter section header/card treatment when the filter panel itself is enough.
   - Keep group loading/error/empty states unchanged.

9. Clean CSS and visual consistency
   - Consolidate `.filter-toolbar` styling around the requirements.
   - Remove or override screen-specific filter styles that force large controls, nested cards, wrap, oversized icons or extra vertical levels.
   - Keep the broader app theme intact; only filter panel/control styling should change.

10. Regression tests and manual visual QA
   - Update component tests for the shared filter panel.
   - Add Playwright checks for all filter screens across desktop/tablet/mobile.
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
- Desktop/tablet filter panels must not wrap to a second row.
- Main content must remain visually dominant.
- Text inside controls must use nowrap, overflow hidden and ellipsis.
- No service text like `Фильтры применяются автоматически`.
- No separate saved-filter templates panel.

## Out of scope
- Backend filtering behavior or API params beyond preserving existing frontend calls.
- Role/permission changes.
- Table/list/calendar redesign outside the spacing needed to place the compact panel.
- New analytics, new report dimensions or new client/schedule filter semantics.
- Global typography migration from Onest to Inter.

## Required test coverage

### Unit tests
Add/update tests for the shared filter panel:
- renders primary controls, secondary trigger and actions accessibly;
- hides secondary content by default and opens it through `Ещё фильтры`;
- exposes reset and save icon-button labels;
- respects mobile/desktop branching if the component has behavior beyond CSS.

Update screen-level tests only where local filtering helpers or persistence helpers change.

### Integration tests
No backend integration tests are required because contracts do not change.

Frontend integration/e2e network assertions are required for:
- audit stable `actionType`/`entityType` request values after auto-apply;
- finance period/custom date/branch/trainer params after auto-apply;
- clients list query/group/status/quick filter params after auto-apply and reset;
- schedule filtering remains local and does not start calling unrelated group collection endpoints.

### UI tests
Add or update Playwright coverage for:
- desktop >=1280 px: each filter panel height <=64 px, one row, max five primary filters, `Сбросить` right aligned, no horizontal page scroll;
- tablet 768-1279 px: no wrapping; secondary controls are reachable through `Ещё фильтры`;
- mobile <=767 px: compact launcher row is stable and secondary/full filter controls open in fullscreen bottom sheet;
- popup dimensions: width about 320 px, max height <=480 px;
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
- [ ] `cd frontend && npm run test:e2e -- responsive-main-screens.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- group-schedule.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- finance-reports.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- stage12.spec.ts`
- [ ] Run the new dedicated filter panel Playwright spec if created.
- [ ] Manually inspect `/audit`, `/finance`, `/clients`, `/schedule`, `/attendance` at 1440, 768 and 390 px.

## Regression barrier
The main regression barrier is automated Playwright geometry and behavior coverage around the shared filter panel plus route-specific request assertions. A task implementation is not complete until tests prove: one-row desktop/tablet panels, mobile bottom sheet behavior, no page reload on filter changes, no visible auto-apply helper text, and unchanged backend request semantics for audit/finance/clients.

## Risk notes
- Medium risk due to broad frontend surface and existing screen-specific CSS.
- Highest risk screens are `/clients` and `/schedule` because they already contain custom responsive filter behavior.
- Auto-apply on audit/finance changes existing submit-driven behavior; debounce and request cancellation must avoid noisy or stale UI updates.
- Saved filter behavior should stay frontend-only and reversible.
