# Implementation Plan: TASK-043 Календарный вид расписания

## Source task
/backlog/implementation/TASK-043-schedule-calendar-like-view.md

## Implementation branch
feature/TASK-043-schedule-calendar-like-view

Branch rules:
- create this branch before writing project code;
- create it from `main` after `git pull` and clean `git status`;
- if the branch already exists, verify that it belongs only to `TASK-043`;
- do not implement other unrelated TASKs in this branch;
- confirm the branch is active before making backend/frontend changes.

## Goal
Пользователь открывает `Расписание` и видит read-only недельный календарь групповых занятий: desktop/tablet показывают временную сетку `Пн...Вс`, mobile показывает список выбранного дня. Все authenticated CRM users видят полный schedule dataset через новый backend endpoint, включая coach без доступа к management `/groups`.

## Current understanding
- Текущий frontend `/schedule` находится в `frontend/src/features/schedule/GroupScheduleScreen.tsx` и строит недельный список через `getGroups`.
- `getGroups` ходит в management endpoint `/groups`, который закрыт политикой `ManageGroups`; поэтому coach не может корректно получить полный schedule dataset.
- Backend уже хранит нужные schedule fields у `TrainingGroup` и отдает их через `GroupListItemResponse`.
- Нужно добавить read-only `GET /schedule/groups`, доступный любому authenticated CRM user через обычную `.RequireAuthorization()`, без ослабления management `/groups`.
- Frontend должен заменить list layout на calendar-like view и перейти на новый endpoint.
- Schedule grouping, filtering, time-grid range and overlap lanes являются presentation mapping; backend остается source of truth для CRM rules, permissions and validation semantics.
- Значимое UX-изменение: перед реализацией нужен короткий `ui-designer` review структуры календаря, плотности карточек, фильтров и mobile selected-day list.

## Execution steps
1. Подготовить ветку: перейти на `main`, выполнить `git pull`, убедиться в чистом статусе, создать или проверить `feature/TASK-043-schedule-calendar-like-view`.
2. Провести `ui-designer` review календарного экрана: desktop/tablet time grid, mobile day switcher, filters, empty states, read-only affordances and no horizontal page scroll.
3. На backend добавить отдельный read-only schedule endpoint, предпочтительно `ScheduleEndpoints.cs` и `ScheduleApiConstants.cs`, с route group `/schedule` и `GET /groups`.
4. Для `/schedule/groups` использовать paging validation/shape, совместимые с текущим frontend consumer: `items`, `totalCount`, `skip`, `take`; поддержать `skip/take` и при необходимости `page/pageSize`.
5. В backend query вернуть все groups без coach-only filtering, с `Branch`, `Hall`, `GroupType`, `Trainers`, `Clients`, сортировкой по start time/name/id или другой стабильной сортировкой, и `AsNoTracking`.
6. Избежать дублирования mapping: вынести общий mapper из `GroupEndpoints` или создать небольшой shared mapper для `TrainingGroup -> GroupListItemResponse`, чтобы `/groups` и `/schedule/groups` отдавали совместимый contract.
7. Добавить backend integration coverage: authenticated HeadCoach, Administrator and Coach получают `GET /schedule/groups`; anonymous получает unauthorized; Coach видит все seeded groups; Coach по-прежнему получает forbidden на management `/groups`.
8. Во frontend API добавить endpoint `API_ENDPOINTS.schedule.groups`, тип schedule response при необходимости и функцию `getScheduleGroups`, сохранив совместимость payload shape.
9. В `GroupScheduleScreen` заменить загрузку через `getGroups` на `getScheduleGroups`; сохранить loading/error/stale-data/refresh states и счетчик показанных/полных items.
10. Расширить `frontend/src/lib/groupSchedule.ts` или выделить schedule view-model helpers: build week entries, parse `HH:mm` as local clock minutes, compute visible hour range rounded to full hours, produce non-overlapping lanes for overlapping entries in one day.
11. Реализовать filters по branch, hall, trainer and group на основе загруженного schedule dataset: options derive from loaded groups, filters apply together, reset clears all filters.
12. Перестроить desktop/tablet UI на weekly calendar grid: columns `Пн...Вс`, vertical time axis, cards positioned by `trainingStartTime` and `durationMinutes`, overlap lanes side-by-side, headers without dates/navigation.
13. Реализовать mobile UI as selected-day list: weekday segmented control/tabs, only selected day's filtered entries, same read-only card data, no edit buttons or links.
14. Обновить schedule cards: показать time, group name, group type, duration, branch, hall, trainer/trainer names, inactive group status, client count if already shown/useful; убрать edit CTA and navigation for every role.
15. Обновить CSS в `frontend/src/App.css` or feature CSS section with stable dimensions, responsive constraints, no page-level horizontal scroll and no nested card-in-card composition beyond actual class cards.
16. Обновить Playwright mocks to handle `/api/schedule/groups`, keep `/api/groups` forbidden/unused for coach schedule tests, and add responsive assertions for calendar grid/mobile day list.
17. Запустить required validations and affected tests; iterate on failures without expanding scope into edit/drag/drop/conflict features.

## Preferred implementation strategy
1. contract-first backend endpoint;
2. backend compatibility through shared group schedule response mapping;
3. incremental frontend integration: API client, view-model helpers, filters, layout;
4. automated regression coverage alongside each risky behavior;
5. small verifiable commits within the single task branch.

Avoid:
- weakening `/groups` or `ManageGroups`;
- frontend-only CRM permission or access-scope rules;
- `Date` parsing/timezone conversion for `trainingStartTime`;
- drag-and-drop, move/cancel/substitute/conflict-resolution UI;
- loading full dictionaries only for filters.

## Files likely to change
- `backend/src/GymCrm.Api/Program.cs`
- `backend/src/GymCrm.Api/Auth/ScheduleEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/ScheduleApiConstants.cs`
- `backend/src/GymCrm.Api/Auth/GroupEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/GroupListItemResponse.cs`
- possible `backend/src/GymCrm.Api/Auth/TrainingGroupResponseMapper.cs`
- `backend/tests/GymCrm.Tests/GroupsApiTests.cs`
- possible new `backend/tests/GymCrm.Tests/ScheduleApiTests.cs`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/api/endpoints.ts`
- `frontend/src/lib/api/groups.ts`
- possible `frontend/src/lib/api/schedule.ts`
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/groupSchedule.ts`
- `frontend/src/lib/groupSchedule.test.ts`
- `frontend/src/features/schedule/GroupScheduleScreen.tsx`
- `frontend/src/App.css`
- `frontend/e2e/group-schedule.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`
- possible `frontend/e2e/stage12.spec.ts`

## Constraints
- Backend owns CRM business logic, permissions, access scope, validation semantics and ProblemDetails contracts.
- Frontend must consume backend contract and must not duplicate domain rules.
- Management `/groups` remains closed for users without `CanManageGroups`.
- `/schedule/groups` is read-only and available to all authenticated CRM users.
- `trainingStartTime` is displayed as local `HH:mm` string without `Date` parsing or timezone conversion.
- Weekdays remain ISO `1..7`; headers show only `Пн...Вс`, without dates and week navigation.
- Filters use only loaded schedule groups, not separate dictionary requests.
- Mantine and Onest are preserved.
- Project code changes start only after branch confirmation.

## Out of scope
- Editing from calendar.
- Drag-and-drop.
- Moving lessons.
- Cancellations.
- Trainer substitutions.
- Conflict checks or hall occupancy rules.
- Backend schedule validation changes.
- Attendance flow changes.
- Bot changes.
- Personal training and dated event calendar.

## Required test coverage

### Unit tests
Add/update frontend unit tests for schedule helpers:
- `formatTrainingStartTime` keeps local `HH:mm` and does not timezone-convert;
- visible time range is computed from filtered visible entries and rounded to full hours;
- overlap layout assigns side-by-side lanes without visual overlap;
- weekly schedule still includes all weekdays `1..7`;
- filters combine branch, hall, trainer and group predicates and reset to full dataset if helper logic is extracted.

### Integration tests
Add/update backend integration tests:
- HeadCoach, Administrator and Coach receive `GET /schedule/groups`;
- anonymous user receives unauthorized for `GET /schedule/groups`;
- Coach sees all groups through `GET /schedule/groups`;
- Coach still receives forbidden for `/groups`;
- response includes paging fields and required group schedule fields.

Frontend/backend contract integration is protected by TypeScript compile plus Playwright mocks using `/api/schedule/groups`.

### UI tests
Update Playwright coverage:
- `/schedule` renders weekly calendar grid on desktop/tablet;
- day headers are `Пн...Вс` without dates/navigation;
- cards are positioned by time/duration and overlapping entries are visually separate;
- mobile viewport renders selected-day list and day switcher;
- schedule cards are read-only for all roles and contain no edit buttons/links;
- branch, hall, trainer and group filters apply together and reset;
- coach can open schedule and sees full mocked group set while `/api/groups` is not used for schedule;
- layout has no page-level horizontal scroll across mobile/tablet/desktop.

### Regression priority
High. This task changes an endpoint contract, access behavior for coaches, and a shared navigation screen visible to all CRM users.

### Minimum expectation
- Backend endpoint tests must be added before considering the backend part complete.
- Frontend helper tests must cover time formatting and overlap lanes.
- Playwright must cover responsive schedule behavior and read-only role behavior.
- Manual QA is limited to visual polish after automated barriers pass.

## Test plan
- [ ] `dotnet test backend/GymCrm.slnx`
- [ ] `cd frontend && npm run test:unit -- groupSchedule.test.ts`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:e2e -- group-schedule.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- responsive-main-screens.spec.ts`
- [ ] Manually inspect desktop, tablet and mobile schedule layouts after automated tests pass.

## Regression barrier
Primary barrier: backend integration tests lock the new authenticated read-only `/schedule/groups` behavior while preserving `/groups` forbidden for Coach.

Secondary barrier: frontend unit tests lock schedule time math and overlap lane calculation.

UI barrier: Playwright verifies `/schedule` role behavior, filters, desktop/tablet grid, mobile selected-day list and absence of edit affordances.

## Risks
- Accidentally weakening management `/groups` instead of adding a separate read-only endpoint.
- Duplicating group response mapping and letting `/groups` and `/schedule/groups` drift.
- Calendar layout can introduce text overlap or horizontal scroll on dense schedules.
- Time calculations can accidentally use `Date`, causing timezone bugs.
- Large all-groups schedule load may need paging loop to avoid incomplete data.
- Existing Playwright mocks may hide that coach schedule must use `/schedule/groups`, not `/groups`.

## Stop conditions
Остановиться и не писать код, если:
- API contract for `/schedule/groups` cannot be kept compatible with current schedule group fields;
- implementation requires redesigning roles, permissions or access-scope architecture;
- scope expands into editing, drag-and-drop, cancellations, substitutions, conflict checks or dated event calendar;
- calendar layout cannot satisfy no-horizontal-scroll without reducing v1 scope;
- backend changes require destructive production data operations, which are not expected for this task;
- acceptance criteria become impossible without new product clarification.

Do NOT stop only because the task touches both backend and frontend or because `Schedule` is a shared CRM section.

## Ready for Codex execution
yes
