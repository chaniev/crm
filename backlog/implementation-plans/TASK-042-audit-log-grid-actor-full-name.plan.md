# Implementation Plan: TASK-042 Grid журнала событий с ФИО автора

## Source task
/backlog/implementation/TASK-042-audit-log-grid-actor-full-name.md

## Implementation branch
feature/TASK-042-audit-log-grid-actor-full-name

Branch rules:
- create this branch before writing project code;
- create it from `main` after `git pull` and clean `git status`;
- if the branch already exists, verify that it belongs only to `TASK-042`;
- do not implement other unrelated TASKs in this branch;
- confirm the branch is active before making frontend/backend changes.

## Goal
Журнал действий должен стать сканируемым table/grid вместо accordion-only списка. Пользователь сразу видит дату, действие, объект, описание, источник и отдельную колонку с ФИО автора изменения, а старые/новые значения открывает через действие деталей без потери текущих фильтров и страницы.

## Current understanding
- Задача локализована в frontend audit screen.
- Текущий экран `frontend/src/features/audit/AuditLogScreen.tsx` сохраняет фильтры, пагинацию, loading/error/empty states, но записи отображает через Mantine `Accordion`.
- Frontend API mapper `frontend/src/lib/api/audit.ts` уже читает `userName`, `userFullName`, `actorName` и nested `user.fullName`/`User.FullName`.
- Тип `AuditLogEntry` уже содержит `userName`, `userLogin`, `userRole`, `source`, `messengerPlatform`, `oldValueJson`, `newValueJson`.
- Backend response по задаче уже содержит `User`; backend contract менять не планируется.
- Если при реализации окажется, что ФИО автора не приходит для части записей, frontend не должен вычислять автора из `description`; нужно зафиксировать отдельную backend follow-up задачу.
- Значимое UX-изменение: перед написанием проектного кода нужен короткий `ui-designer` review плотности таблицы, details action и mobile layout.

## Execution steps
1. Подготовить ветку: перейти на `main`, выполнить `git pull`, убедиться в чистом `git status`, создать или проверить `feature/TASK-042-audit-log-grid-actor-full-name`.
2. Провести короткий `ui-designer` review для audit grid: набор колонок, плотность строк, details action, mobile/tablet поведение, no page-level horizontal scroll.
3. Проверить текущий backend-derived actor mapping через `frontend/src/lib/api/audit.ts`; менять backend только если обнаружится contract mismatch, иначе оставить backend нетронутым.
4. В `AuditLogScreen.tsx` заменить блок `Accordion` на grid/table presentation, сохранив все существующие состояния загрузки, ошибки, пустого списка и пагинации.
5. Использовать Mantine `Table`/grid-compatible layout с колонками минимум: дата/время, действие, объект, описание, автор, источник, действие деталей.
6. В колонке автора показывать `formatUserLabel(entry)`, чтобы ФИО было основным текстом, а login оставался вспомогательным, если он есть и не дублирует имя.
7. Для source/messenger platform сохранить доступность текущих значений через отдельную колонку, бейджи внутри строки или компактный secondary text, не теряя информацию из accordion.
8. Реализовать просмотр старых/новых значений через details action, предпочтительно modal на выбранную запись: action не меняет page/filter state и закрывается без перезагрузки списка.
9. Переиспользовать или адаптировать `JsonPanel` для modal details; сохранить pretty-print JSON и empty labels для отсутствующих old/new values.
10. Добавить стабильные test hooks/selectors: например `audit-log-grid`, `audit-log-row`, `audit-log-actor-cell`, `audit-log-details-action`.
11. Обновить CSS в `frontend/src/App.css`: убрать accordion-specific styling из audit list, добавить table/grid классы с `min-width: 0`, `word-break`, responsive constraints and internal scroll/stacking where needed.
12. Проверить, что длинные descriptions, entity IDs, ФИО и JSON не перекрывают соседние элементы на mobile/tablet/desktop.
13. Добавить или обновить frontend unit/component coverage для `AuditLogScreen`: grid renders, actor column shows ФИО, details action opens old/new values, denied permission state не грузит журнал.
14. Обновить Playwright coverage в audit сценариях: тест больше не кликает accordion control by description, а открывает details action в grid row и проверяет ФИО автора.
15. Обновить responsive smoke mocks/assertions при необходимости, чтобы `/audit` имел запись с длинными значениями и продолжал проходить no-horizontal-scroll проверку.
16. Запустить required frontend validation and affected tests; исправлять только TASK-042 scope.

## Preferred implementation strategy
1. Frontend-first and contract-preserving implementation.
2. Keep backend as source of truth for actor identity; no frontend heuristics from audit description.
3. Replace presentation layer incrementally: table rows first, modal details second, CSS/responsive polish third.
4. Add regression coverage alongside UI changes.
5. Keep selectors explicit and stable for e2e tests.

Avoid:
- backend contract changes unless discovery proves the existing response cannot satisfy the task;
- duplicating audit semantics or permission checks in frontend;
- hiding old/new values behind route changes that reset filters/page;
- page-level horizontal scroll on narrow screens;
- broad visual refactors outside audit screen.

## Files likely to change
- `frontend/src/features/audit/AuditLogScreen.tsx`
- `frontend/src/App.css`
- `frontend/e2e/stage12.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`
- possible new `frontend/src/features/audit/AuditLogScreen.test.tsx`
- possible `frontend/src/lib/api/audit.ts` only if mapping discovery finds a missing backend-supported actor field

## Constraints
- Backend owns audit semantics, permissions, access scope and validation semantics.
- Frontend must consume backend-provided actor data and must not infer the author from free-text descriptions.
- Do not change audit permissions or available audit events.
- Keep filters, pagination, loading, error and empty states behavior.
- Details for old/new values must open without losing current page and filters.
- Preserve Mantine and Onest.
- Project code changes start only after branch confirmation.

## Out of scope
- Backend audit domain changes.
- New audit event types.
- Audit permission changes.
- Audit search/filter contract changes.
- Data backfill for old audit rows.
- Reworking global page layout or unrelated CRM sections.

## Required test coverage

Determine automated tests before implementation starts and add regression coverage together with the UI change.

### Unit tests
Add a focused component test, preferably `frontend/src/features/audit/AuditLogScreen.test.tsx`, covering:
- successful render of `audit-log-grid`;
- visible actor column/cell with ФИО from `AuditLogEntry.userName`;
- details action opens old and new JSON values;
- permission-denied user does not call audit loaders and sees the existing denied state;
- error/empty states remain reachable if implementation refactors the render branches.

No new backend unit tests are expected because backend contract is unchanged.

### Integration tests
Backend integration tests are not required for the happy path because no backend contract change is planned.

If implementation discovers that current backend response does not reliably return actor ФИО, stop frontend-only implementation for that gap and create a separate backend follow-up task instead of adding frontend heuristics.

Frontend/backend contract is protected by existing API mapping plus Playwright network mocks returning backend-shaped audit payloads with actor names.

### UI tests
Update Playwright coverage:
- `/audit` renders entries as grid/table, not accordion-only list;
- grid row shows ФИО автора in a dedicated actor column;
- date/time, action, entity, description and source remain visible or accessible;
- details action opens old/new values without navigation and without resetting filters/page;
- filters still send stable action/entity values;
- responsive smoke confirms no page-level horizontal scroll on mobile/tablet/desktop.

### Regression priority
Medium. The change is localized to the audit screen, but it replaces the main presentation model and can break scanability, details access or e2e selectors.

### Minimum expectation
- At least one automated regression test must fail on the old accordion-only UI and pass on the new grid.
- Playwright must verify the actor ФИО in the visible audit grid.
- Manual QA is only a final visual check after lint/build/tests pass.

## Test plan
- [ ] `cd frontend && npm run test:unit -- AuditLogScreen.test.tsx`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:e2e -- stage12.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- responsive-main-screens.spec.ts`
- [ ] Manually check `/audit` as HeadCoach and Administrator on desktop, tablet and mobile widths.

## Regression barrier
Primary barrier: Playwright audit scenario verifies that entries render as a grid/table with a dedicated actor ФИО column and that details open from the row without route/page/filter loss.

Secondary barrier: component test verifies the render contract around `AuditLogEntry.userName`, details JSON and permission-denied behavior.

Responsive barrier: existing responsive smoke plus updated audit payload protects against page-level horizontal scroll and overlapping actions.

## Risks
- Replacing accordion with table may accidentally hide old/new JSON details.
- Long descriptions, entity IDs or actor names can break row layout on mobile.
- Internal table scroll can turn into page-level horizontal scroll if CSS constraints are loose.
- E2E selectors currently depend on accordion button behavior and must be updated deliberately.
- Backend data may include system-generated rows where actor is `Система`; this should remain visible, not guessed.
- Mapper support for nested `User` appears present, but implementation should still verify payload variants before changing UI.

## Stop conditions
Остановиться и не писать код, если:
- current backend response cannot provide actor ФИО and the gap cannot be represented as existing `AuditLogEntry.userName`;
- implementation would require changing audit permissions, audit semantics or backend validation contracts;
- scope expands into new audit filters, new events or audit data backfill;
- responsive grid cannot satisfy no-overlap/no-page-horizontal-scroll without a smaller v1 layout decision;
- acceptance criteria become impossible without product clarification.

Do NOT stop only because the audit screen is shared by HeadCoach and Administrator; this is an expected shared CRM section.

## Ready for Codex execution
yes
