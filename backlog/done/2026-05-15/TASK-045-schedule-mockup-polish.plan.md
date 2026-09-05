# Implementation Plan: TASK-045 Привести окно расписания к новому макету

## Source task
/backlog/implementation/TASK-045-schedule-mockup-polish.md

## Implementation branch
feature/TASK-045-schedule-mockup-polish

Branch rules:
- create this branch before writing project code;
- create it from `main` after `git pull` and clean `git status`;
- if the branch already exists, verify that it belongs only to `TASK-045`;
- do not implement `TASK-046` or unrelated CRM-wide visual changes in this branch;
- confirm the branch is active before making frontend changes.

## Goal
Пользователь открывает `/schedule` и видит read-only недельный шаблон расписания в новом рабочем стиле CRM: дни недели без календарной навигации, текущий weekday выделен, занятия читаются по цветам типов, фильтры и компактные агрегаты помогают быстро оценить неделю и текущий день.

## Current understanding
- Текущий экран расписания уже реализован во frontend после `TASK-043`: `frontend/src/features/schedule/GroupScheduleScreen.tsx`.
- Schedule data загружается через `getScheduleGroups` из read-only endpoint `/api/schedule/groups`; backend contract менять не планируется.
- Presentation helpers живут в `frontend/src/lib/groupSchedule.ts`, покрыты `frontend/src/lib/groupSchedule.test.ts`.
- Desktop сейчас показывает weekly grid, mobile показывает список выбранного дня; e2e coverage уже есть в `frontend/e2e/group-schedule.spec.ts` и responsive smoke в `frontend/e2e/responsive-main-screens.spec.ts`.
- Макет содержит календарный диапазон и навигацию, но task constraints требуют сохранить недельный шаблон без дат, стрелок, `Сегодня` и выбора недели.
- Значимое UX-изменение: перед кодом нужен короткий `ui-designer` review именно для адаптации макета под constraints задачи.

## Execution steps
1. Подготовить ветку: перейти на `main`, выполнить `git pull`, проверить чистый `git status`, создать или проверить `feature/TASK-045-schedule-mockup-polish`.
2. Провести `ui-designer` review макета `/Users/muradchaniev/Downloads/ChatGPT Image 15 мая 2026 г., 14_07_44.png`: зафиксировать, какие элементы переносим, а какие не переносим из-за weekly-template constraints.
3. Осмотреть текущие `GroupScheduleScreen.tsx`, `groupSchedule.ts`, `App.css`, `theme.ts`, `features/shared/ux.tsx`, `Button`, `IconButton`, чтобы выбрать минимальные reusable visual primitives без design-system rewrite.
4. Вынести нейтральные visual baseline pieces только там, где это пригодится для `TASK-046`: page spacing, filter toolbar, compact summary block, surface/list card sizing, focus/hover states. Не использовать schedule-specific имена для reusable primitives.
5. Переработать верхнюю область `/schedule`: title, короткое описание при необходимости, правый блок реального автообновления и manual refresh. Если показывается текст про автообновление, добавить фактический safe polling для read-only endpoint с отменой запросов.
6. Убедиться, что в верхней области нет диапазона дат, стрелок недели, кнопки `Сегодня`, date picker или любого намека на dated event calendar.
7. Добавить helper для текущего weekday (`1..7`) с инъекцией даты/clock для тестов; использовать его только для highlight и сегодняшних presentation агрегатов.
8. Обновить day headers: день недели, счетчик занятий за weekday, текущий weekday выделен по макету, календарные даты не отображаются.
9. Если реализуется current-time line, ограничить ее колонкой текущего weekday и показывать только когда текущее локальное время попадает в visible hour range; не добавлять date navigation semantics.
10. Улучшить filter toolbar: филиал, зал, тренер, группа, совместная фильтрация, сброс фильтров, стабильные размеры контролов и мобильное поведение без page-level horizontal scroll.
11. Добавить presentation-only mapping для цветов типов занятий: стабильный цвет по `groupTypeSystemIdentifier`/`groupTypeId`, карточки и легенда используют одну функцию. Не кодировать бизнес-смысл типов во frontend.
12. Привести event cards к макету: время, название группы, зал, заполненность/участники из `clientCount` и уже доступных полей, компактная мета, readable truncation для длинных русских названий.
13. Добавить легенду типов занятий на основе реально видимых schedule entries после фильтров.
14. Добавить компактный блок "сегодня" только из текущего payload: количество занятий текущего weekday, группировка по типам, возможно доля от общего числа visible entries. Не показывать числа, для которых нет достоверной базы.
15. Добавить компактный блок загрузки залов только как transparent presentation aggregate из schedule payload. Если нужен процент без достоверного denominator, не показывать процент и создать отдельную backend/contract follow-up вместо frontend-выдумки.
16. Проверить mobile/tablet/desktop: desktop/tablet остаются grid, mobile остается selected-day list или эквивалентный компактный вид; не допустить text overlap и горизонтальный scroll страницы.
17. Добавить handoff notes для `TASK-046`: какие shared styles/components появились, какие локальные schedule-паттерны надо распространить, какие screen-specific элементы не стоит обобщать.
18. Обновить unit/e2e tests вместе с изменениями, затем запустить validation commands.

## Preferred implementation strategy
1. UX/design review against mockup and task constraints.
2. Presentation helpers first: weekday, counts, type palette, legend, safe aggregates.
3. Reusable visual primitives second, only if they reduce obvious future duplication.
4. Schedule screen markup/CSS polish third.
5. Focused tests and Playwright responsive verification last.

Avoid:
- backend contract changes unless a required aggregate cannot be computed honestly;
- frontend-only schedule rules for conflicts, hall capacity, transfers or cancellations;
- date/week navigation copied from the mockup;
- CRM-wide route restyling in this branch.

## Files likely to change
- `frontend/src/features/schedule/GroupScheduleScreen.tsx`
- `frontend/src/lib/groupSchedule.ts`
- `frontend/src/lib/groupSchedule.test.ts`
- `frontend/src/features/shared/ux.tsx`
- `frontend/src/features/shared/ux.test.tsx`
- `frontend/src/features/shared/Button.tsx`
- `frontend/src/features/shared/IconButton.tsx`
- `frontend/src/theme.ts`
- `frontend/src/App.css`
- `frontend/e2e/group-schedule.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`
- possible backlog handoff note or a `## TASK-046 handoff notes` section in the implementation summary

## Constraints
- Backend remains the source of truth for CRM business logic, permissions, access scope and validation semantics.
- Frontend consumes existing read-only schedule data and must not invent conflict, transfer, cancellation, replacement or hall-occupancy rules.
- Keep weekly template semantics: `Пн...Вс`, no dates, no week navigation, no `Сегодня` button.
- `trainingStartTime` stays local `HH:mm` string handling, without `Date` parsing or timezone conversion.
- Mantine and Onest are preserved.
- Shared visual styles must be domain-neutral and suitable for `TASK-046`.
- Do not bring back technical intro/service labels removed in `TASK-044`.

## Out of scope
- Drag-and-drop.
- Editing lessons from schedule.
- Lesson transfers, cancellations and trainer substitutions.
- Conflict checks and hall availability rules.
- Personal training and dated event calendar.
- Backend schedule validation changes.
- Roles, permissions, access scope or attendance flow changes.
- Direct restyling of all other CRM screens; that belongs to `TASK-046`.
- Bot changes.

## Required test coverage

### Unit tests
Add/update frontend unit tests for:
- current weekday mapping to ISO `1..7` without using it as a displayed calendar date;
- day counters derived from visible schedule entries;
- combined filters and reset behavior if helper shape changes;
- stable type-color/legend mapping from visible group types;
- today summary and hall-load helpers, if implemented, using only schedule payload fields;
- `trainingStartTime` still formats as local `HH:mm`.

### Integration tests
No backend integration tests are expected unless implementation discovers a necessary backend contract change. If that happens, stop and create a separate backend/contract task before changing contracts.

Frontend contract integration is protected by TypeScript compile and Playwright mocks using `/api/schedule/groups`.

### UI tests
Update Playwright coverage:
- `/schedule` renders polished desktop layout with weekly headers, counters, legend and summary blocks;
- no previous/next week, `Сегодня`, date range or date picker exists;
- current weekday header/column is highlighted;
- current-time line, if present, appears only in current weekday column;
- filters apply together and reset;
- mobile viewport remains readable and has no page-level horizontal scroll;
- schedule remains read-only for HeadCoach/Admin/Coach.

### Regression priority
High for visual/responsive behavior on a shared CRM screen; medium for helper logic because it is presentation-only but visible to all users.

### Minimum expectation
- Automated unit tests must protect new helper logic.
- Playwright must protect absence of date navigation and responsive schedule readability.
- Manual visual review is allowed only after automated barriers pass.

## Test plan
- [ ] `cd frontend && npm run test:unit -- groupSchedule.test.ts`
- [ ] `cd frontend && npm run test:unit -- ux.test.tsx` if shared UX components change
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:e2e -- group-schedule.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- responsive-main-screens.spec.ts`
- [ ] Make Playwright screenshots for `/schedule` at mobile, tablet and desktop and visually compare with the mockup constraints.

## Regression barrier
Primary barrier: Playwright schedule specs lock the weekly-template UI, absence of date navigation, filters, read-only behavior and responsive no-scroll behavior.

Secondary barrier: frontend unit tests lock weekday/count/color/aggregate helpers so future visual edits do not silently break schedule semantics.

## Risks
- Copying date navigation from the mockup would violate the task constraints.
- Auto-refresh indicator can become misleading if it is not backed by actual polling.
- Hall utilization percentages can be false if frontend invents a denominator.
- Over-polishing reusable styles in `TASK-045` can accidentally become a CRM-wide refactor.
- Dense event cards can overlap or truncate poorly on tablet widths.

## Stop conditions
Остановиться и не писать код, если:
- accurate schedule polish requires backend fields or business aggregates not present in `/api/schedule/groups`;
- hall utilization cannot be represented truthfully from existing payload;
- implementation starts requiring roles/permissions/access-scope changes;
- scope expands into editing, drag-and-drop, cancellations, substitutions, conflict checks or dated calendar behavior;
- shared visual extraction becomes a broad design-system rewrite instead of a small baseline for `TASK-046`;
- acceptance criteria cannot be met without product clarification.

## Ready for Codex execution
yes
