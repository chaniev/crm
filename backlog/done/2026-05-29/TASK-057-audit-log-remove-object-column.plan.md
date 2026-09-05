# Implementation Plan: TASK-057 Убрать лишний заголовок и колонку Объект из журнала

## Source task
/backlog/done/2026-05-29/TASK-057-audit-log-remove-object-column.md

## Implementation branch
feature/TASK-057-audit-log-remove-object-column

Branch rules:
- create this branch from `main` before writing code;
- do not implement other unrelated TASKs in this branch;
- confirm the branch is active before making project code changes;
- required preflight: `git checkout main`, `git pull`, `git status --short --branch`, `git checkout -b feature/TASK-057-audit-log-remove-object-column`.

## Goal
Экран журнала должен стать визуально чище: без видимого заголовка `Записи журнала` над таблицей и без пользовательской колонки `Объект`, при этом события, фильтры, пагинация, доступность журнала и просмотр деталей продолжают работать как раньше.

## Current understanding
Задача frontend-only и локальна для экрана `/audit`. Backend audit contract, audit persistence, роли, permissions, audit/domain semantics и API-параметры не меняются.

В текущем коде `AuditLogScreen` уже использует `CompactFilterPanel`. Лишний заголовок выводится через `SectionHeader title="Записи журнала"` внутри `PageSection`. Колонка объекта выводится в desktop-header как `Объект` и в строке через `.audit-log-cell--entity`, где показываются `entityType` и `entityId`; на tablet/mobile эта же ячейка видна через grid-area `entity`. Детальная модалка уже показывает технические данные объекта, и ее не нужно упрощать в этой задаче.

## Execution steps
1. Branch and preflight
   - Switch to `main`, pull latest changes and verify clean status.
   - Create `feature/TASK-057-audit-log-remove-object-column`.
   - Read `AGENTS.md` and `frontend/AGENTS.md` before frontend edits.

2. Remove the visible journal subsection title
   - In `frontend/src/features/audit/AuditLogScreen.tsx`, remove the `SectionHeader title="Записи журнала"` from the journal content section.
   - Keep the page title `Журнал`, refresh action, filter panel, loading/error/empty states and pagination intact.
   - If needed, rename table `aria-label` from `Записи журнала действий` to a neutral accessible label such as `Журнал действий`, so tests and accessibility do not depend on the removed wording.

3. Remove the Object column from the displayed grid
   - Remove the `Объект` column header from the audit table header.
   - Remove the `.audit-log-cell--entity` cell from `AuditLogGridRow`, including the visible mobile label `Объект`, `formatEntityType(entry.entityType)` and visible `ID: ...` line in the grid row.
   - Keep row data for date/time, action, description, author, source and the details action.
   - Keep `entry.entityType` and `entry.entityId` available in the details modal and backend response mapping; do not delete API fields or formatting helpers if they remain used by details/filter behavior.

4. Adjust layout CSS
   - Update `frontend/src/App.css` audit grid columns from 7 visible columns to 6 visible columns.
   - Remove the `entity` grid-area from tablet/mobile audit row layouts and rebalance areas so date/action/description/actor/source/details remain readable.
   - Remove dead `.audit-log-cell--entity` CSS if it has no remaining use.
   - Verify narrow screens do not leave empty grid slots or awkward spacing.

5. Update frontend regression tests
   - Update `frontend/src/features/audit/AuditLogScreen.test.tsx` to assert the grid still renders useful columns/data and no longer renders visible `Записи журнала` or visible `Объект` column/cell text.
   - Keep or extend the existing details-modal test to confirm details still open and diagnostic object data remains available there if currently expected.
   - Update affected Playwright checks in `frontend/e2e/stage12.spec.ts` and/or `frontend/e2e/responsive-main-screens.spec.ts` if they rely on the old column count, old heading text or row layout.

## Preferred implementation strategy
Implement this as a small local frontend cleanup: remove visible render points first, then adjust audit-specific CSS, then update tests. Do not touch backend audit models, API clients, filters, permissions or domain labels beyond what is required to remove the visible grid column.

## Files likely to change
- `frontend/src/features/audit/AuditLogScreen.tsx`
- `frontend/src/App.css`
- `frontend/src/features/audit/AuditLogScreen.test.tsx`
- `frontend/e2e/stage12.spec.ts` if its audit smoke assertions need explicit negative coverage
- `frontend/e2e/responsive-main-screens.spec.ts` if responsive audit checks depend on the old layout

## Constraints
- Backend remains the source of truth for audit data, roles and access.
- Do not change backend audit contract, audit persistence, audit semantics or response fields.
- Do not change journal permissions or route access.
- Do not duplicate audit/domain rules in frontend.
- Preserve filters, pagination, loading/error/empty states and details modal behavior.
- Do not hide technical object data from details if it is still part of the existing diagnostic UX.
- Preserve Mantine and Onest.

## Out of scope
- Removing `entityType`/`entityId` from API payloads or TypeScript API types.
- Changing audit filters, including the existing `entityType` filter.
- Reworking audit details modal content outside the minimal checks needed to preserve it.
- Redesigning the whole audit table or shared filter panel.
- Changing roles, permissions, navigation or backend validation.

## Required test coverage

### Unit tests
Add or update `AuditLogScreen` tests to cover:
- visible subsection title `Записи журнала` is absent after data loads;
- visible column/cell label `Объект` is absent from the audit grid;
- grid still renders description, actor, source and details action;
- details modal still opens from the row action.

### Integration tests
No backend/frontend contract integration tests are required because API contracts and request params must not change.

### UI tests
Update affected Playwright audit coverage if existing smoke/responsive tests assert old markup. Prefer adding a small negative assertion around the audit grid so the removed column cannot silently return.

### Manual validation
Manual validation is still useful for visual spacing on desktop/tablet/mobile, but it is not the primary regression barrier.

## Test plan
- [ ] Run targeted frontend unit tests for `AuditLogScreen`.
- [ ] Run affected Playwright audit/responsive checks if they are updated.
- [ ] Run `npm run lint` in `frontend/`.
- [ ] Run `npm run build` in `frontend/`.
- [ ] Manually check `/audit` as administrator.
- [ ] Manually check `/audit` as head coach.

## Regression barrier
Automated regression barrier: a focused `AuditLogScreen` test must fail if the visible `Записи журнала` title or visible `Объект` grid label returns, while also confirming the grid and details action still render. If Playwright audit smoke is touched, add/keep an e2e assertion that the journal remains usable after the cleanup.

## Risks
- CSS grid areas may leave hidden tablet/mobile gaps if the `entity` area is removed only from JSX but not from CSS.
- A broad negative text assertion for `Объект` may conflict with details-modal content; scope negative assertions to the grid/initial screen.
- Removing unused helpers too aggressively could break details, filters or labels that still depend on `entityType`.

## Stop conditions
Остановиться и не писать код, если:
- обнаружится, что колонка `Объект` нужна для обязательного audit/compliance UX и нет согласованной замены;
- выполнение acceptance criteria потребует backend contract или permission changes;
- scope расширится до переработки audit filters/details/shared table architecture;
- existing tests reveal that another active task already owns the same audit layout changes and branch ownership is unclear;
- acceptance criteria невозможно выполнить без уточнений.

## Ready for Codex execution
yes
