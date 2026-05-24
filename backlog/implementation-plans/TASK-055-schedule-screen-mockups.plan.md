# Implementation Plan: TASK-055 Обновить окно расписания по макетам из docs/mockups

## Source task
/backlog/implementation/TASK-055-schedule-screen-mockups.md

## Implementation branch
feature/TASK-055-schedule-screen-mockups

Branch rules:
- create this branch before writing project code;
- create it from `main` after `git pull` and clean `git status`;
- if the branch already exists, verify that it belongs only to `TASK-055`;
- do not implement other unrelated TASKs in this branch;
- confirm the branch is active before making frontend changes.

## Goal
Пользователь открывает `/schedule` и видит read-only экран расписания, визуально приведенный к новым desktop и mobile PNG-макетам из `docs/mockups/расписание`, без изменения backend schedule contract, ролей, permissions, attendance flows или бизнес-правил расписания.

## Current understanding
- Задача явно выбрана из `/backlog/tasks-ready`, clarification questions отсутствуют.
- Область реализации локализована во frontend: текущий экран находится в `frontend/src/features/schedule/GroupScheduleScreen.tsx`, schedule helpers - в `frontend/src/lib/groupSchedule.ts`, стили - в `frontend/src/App.css`.
- Текущий `/schedule` уже использует `getScheduleGroups` и read-only `/api/schedule/groups`, созданный в `TASK-043`; backend contract менять не планируется.
- `TASK-045` уже добавил недельную сетку, mobile selected-day/list view, фильтры, auto refresh, цветовую легенду и Playwright coverage. `TASK-055` является visual follow-up под новые mockups от 2026-05-23.
- Desktop mockup показывает левый shell, верхнюю статусную панель, кнопки фильтров, недельную таблицу с колонками `Пн...Вс`, временем `09:00...21:00`, цветные карточки занятий, empty day state and legend.
- Mobile mockup показывает top shell/status, title/action row, горизонтальные дни, дневную временную сетку, карточки занятий, legend and bottom navigation.
- В макетах есть даты в day headers. Для TASK-055 их нужно реализовать как обязательные presentation-only labels текущей недели, вычисляемые от injected `now`; это не dated event calendar, не week navigation, не persisted state и не backend contract change.
- Значимое UX-изменение: перед кодом нужен короткий `ui-designer` checkpoint, а реализацию должен вести `react-specialist`; e2e/visual regression лучше подключить через `test-automator`.

## Execution steps
1. Подготовить ветку: перейти на `main`, выполнить `git pull`, убедиться в чистом `git status`, создать или проверить `feature/TASK-055-schedule-screen-mockups`.
2. Провести `ui-designer` checkpoint по двум PNG: `docs/mockups/расписание/ChatGPT Image 23 мая 2026 г., 19_28_48.png` и `docs/mockups/расписание/ChatGPT Image 23 мая 2026 г., 19_28_59.png`. Зафиксировать переносимые visual details: shell spacing, header/status, filter buttons, grid borders, day headers, card colors, empty state, legend, mobile bottom-nav coexistence.
3. Сравнить текущий `/schedule` с макетами через локальный dev server and browser screenshots на desktop and mobile. Не менять backend и не начинать redesign других экранов.
4. Добавить presentation-only helper для date labels текущей недели на основе injected `now`; helper должен возвращать weekday + `dd.MM` labels для day headers и не менять API filtering или schedule semantics.
5. Перестроить верхнюю часть schedule page под mockup: title row, auto-refresh status, refresh icon button, `Фильтры` button with funnel icon and the adjacent square sliders icon button from the mockup. Both filter action buttons open/close the same existing filter toolbar and do not introduce separate settings logic.
6. Перенастроить filters presentation: `Фильтры` button раскрывает/сворачивает существующий filter toolbar на desktop и mobile; toolbar keeps current branch/hall/trainer/group filters, reset action, loading/error compatibility and no page-level horizontal scroll.
7. Обновить desktop weekly grid markup/CSS: единая таблица-like surface, time axis column, 7 day columns, consistent borders, header heights, visible hour range, stable column widths and no accidental nested cards.
8. Обновить day headers: weekday label + date label are mandatory, dates are computed presentation-only from current week, current day highlight matches mockup. Header data must not affect API filtering or schedule semantics.
9. Обновить event card visual style: softer tinted backgrounds by type, border colors, tighter typography, time/title/hall/trainer hierarchy, card padding and minimum sizes so Russian labels fit without overlap.
10. Preserve existing lane/overlap behavior from `buildScheduleCalendarWeek`; adjust positioning only at presentation level. Do not add drag, resize, move or conflict UI.
11. Update mobile view to the mockup's single-day time-grid: horizontal weekday/date strip, left time axis, positioned event cards, same read-only card content, no page-level horizontal scroll, and bottom navigation remains provided by app shell.
12. Reuse existing lane positioning for overlapping events on mobile and constrain lane widths inside the available grid width. Add a test case if current e2e fixture does not cover mobile overlaps.
13. Update legend placement and styling to match desktop/mobile mockups while deriving items only from visible schedule entries after filters.
14. Preserve loading, stale refresh, error and empty states; restyle them only as needed to fit the new surfaces.
15. Review shared shell interactions: do not create fake side navigation or fake bottom navigation inside `GroupScheduleScreen`; rely on `AppLayout` and existing backend-derived allowed sections.
16. Update unit tests for date-label helpers, visible hour marks and mobile positioning/lane helpers.
17. Update Playwright schedule tests to assert desktop grid, mobile day time-grid, filters, refresh, read-only roles, no edit/drag/drop controls, no page-level horizontal scroll and no unexpected `/api/groups` usage.
18. Capture desktop and mobile screenshots after implementation and compare them manually with the PNG mockups. Iterate only within the TASK-055 visual scope.

## Preferred implementation strategy
1. Design checkpoint against both PNG mockups and existing shell constraints.
2. Helper-first for purely presentational data: date labels, day header view model and mobile grid lane layout.
3. Markup/CSS refactor inside `GroupScheduleScreen.tsx` and the schedule section of `App.css`.
4. Keep API and domain contracts unchanged; stop rather than inventing missing schedule semantics.
5. Add automated regression coverage before final visual QA.

Avoid:
- backend contract changes;
- frontend-only conflict, cancellation, transfer, occupancy or permission rules;
- fake navigation inside `/schedule`;
- broad CRM-wide visual refactoring;
- copying mockup dates as hard-coded static values;
- page-level horizontal scroll on mobile.

## Files likely to change
- `frontend/src/features/schedule/GroupScheduleScreen.tsx`
- `frontend/src/lib/groupSchedule.ts`
- `frontend/src/lib/groupSchedule.test.ts`
- `frontend/src/App.css`
- `frontend/e2e/group-schedule.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`
- possible `frontend/src/features/shared/ux.tsx` only if existing shared primitives need a small, domain-neutral extension
- possible `frontend/src/features/shared/ux.test.tsx` if shared UX primitives change

## Constraints
- Backend remains the source of truth for schedule data, access scope, validation semantics and ProblemDetails.
- Frontend must not add CRM business rules, conflict detection, hall occupancy rules, transfers, cancellations, replacements or permission inference.
- Use existing read-only schedule contract from `TASK-043`; no backend fields unless a separate backend/contract task is created.
- Preserve `TASK-045` decisions unless directly superseded by the new mockups: weekly schedule, read-only cards, filters, color legend and no schedule editing.
- Dates in headers are mandatory presentation-only labels for the visible week and must not become dated event calendar semantics.
- Keep Mantine and Onest.
- Preserve current loading, refresh, stale-data, error and empty-state behavior.
- Keep mobile shell/bottom navigation owned by shared app layout, not schedule-local markup.

## Out of scope
- Backend schedule contract changes.
- New business rules for schedule.
- Drag-and-drop, resizing, moving, cancellation, trainer substitution and conflict resolution.
- Editing lessons from calendar.
- Personal trainings or dated event calendar.
- Roles, permissions, access scope and attendance flow changes.
- Redesign of CRM screens other than `/schedule`.
- Bot changes.

## Required test coverage

### Unit tests
Add or update frontend unit tests for:
- presentation-only week/date header labels with injected date/clock;
- existing local `HH:mm` time parsing and formatting remains timezone-free;
- visible hour range and hour marks still cover the displayed cards;
- overlap lane behavior remains stable after visual changes;
- legend/type-color mapping remains stable and derived from visible entries;
- mobile day grid/view-model helper for left time axis, positioned cards and constrained lane widths.

### Integration tests
No backend integration tests are expected because backend contracts are out of scope.

Frontend contract integration is protected by TypeScript build and Playwright mocks for `/api/schedule/groups`. If implementation requires new backend data, stop and create a separate backend/contract task instead of changing backend in this branch.

### UI tests
Add or update Playwright coverage:
- desktop `/schedule` renders the weekly table/grid with time axis, 7 day columns, visible cards and legend;
- desktop day headers include weekday + presentation-only `dd.MM` date labels, with current day highlight;
- filter button/filter controls and refresh remain usable;
- schedule remains read-only for HeadCoach, Administrator and Coach;
- mobile viewport renders day strip plus single-day time-grid matching the mockup;
- mobile has no page-level horizontal scroll and text/cards do not overlap;
- no edit, drag-and-drop, transfer, cancellation or conflict-resolution controls appear;
- `/schedule` still calls `/api/schedule/groups`, not management `/api/groups`.

### Regression priority
High for responsive layout and read-only behavior because `/schedule` is a shared CRM screen visible to all roles.

### Minimum expectation
- Automated e2e coverage must protect desktop and mobile schedule layout before the task is complete.
- Unit tests must cover any new helper logic, especially date labels or mobile grid mapping.
- Manual visual QA is required against both PNGs after lint/build/e2e pass.

## Test plan
- [ ] `cd frontend && npm run test:unit -- groupSchedule.test.ts`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:e2e -- group-schedule.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- responsive-main-screens.spec.ts`
- [ ] Capture desktop `/schedule` screenshot and compare with `docs/mockups/расписание/ChatGPT Image 23 мая 2026 г., 19_28_48.png`.
- [ ] Capture mobile `/schedule` screenshot and compare with `docs/mockups/расписание/ChatGPT Image 23 мая 2026 г., 19_28_59.png`.

## Regression barrier
Primary barrier: Playwright schedule specs lock the desktop weekly grid, mobile single-day schedule view, filter/refresh behavior, read-only role behavior and no-horizontal-scroll requirement.

Secondary barrier: frontend unit tests lock presentational schedule helpers, so visual edits do not silently break time ranges, date labels, type legend or overlap lane behavior.

Manual barrier: screenshot comparison with both PNG mockups after automated validation passes.

## Risks
- Date labels in mockups can be misread as a requirement for dated events or week navigation.
- Mobile time-grid can introduce overlap or horizontal scroll if card widths are not constrained.
- Restyling the shell inside `/schedule` can duplicate shared AppLayout/bottom navigation behavior.
- Tinted card palettes can drift from stable type mapping if colors are hard-coded per visible name.
- Collapsible filters can accidentally hide required filter/reset behavior or break e2e selectors.
- Over-polishing can expand into a CRM-wide redesign beyond this task.

## Stop conditions
Остановиться и не писать код, если:
- visual match requires backend fields, dated events, week navigation state or domain aggregates not available in `/api/schedule/groups`;
- implementation requires changes to roles, permissions, access scope, validation semantics or attendance flows;
- scope expands into editing, drag-and-drop, transfers, cancellations, trainer substitutions or conflict resolution;
- shell or bottom navigation cannot be represented by existing shared layout and would require fake schedule-local navigation;
- acceptance criteria cannot be met without product clarification;
- branch is not `feature/TASK-055-schedule-screen-mockups` or current git status is dirty before implementation starts.

Do not stop only because `Schedule` is a shared CRM section; this task remains implementation-ready if behavior stays localized and read-only.

## Ready for Codex execution
yes
