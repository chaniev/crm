# Implementation Plan: TASK-035 Реализовать frontend-расписание групповых занятий

## Source task
/backlog/done/2026-05-13/TASK-035-group-schedule-frontend-experience.md

## Implementation branch
feature/TASK-035-group-schedule-frontend-experience

Branch rules:
- create this branch before writing code;
- do not implement other unrelated TASKs in this branch;
- confirm the branch is active before making project code changes;
- create the branch from `main` after `git pull` and clean `git status`.

## Goal
Пользователь видит отдельный раздел `Расписание` со всеми днями недели и занятиями групп, а администратор в форме группы заполняет обязательные schedule-поля backend-контракта: тип группы, филиал, зал, время начала, длительность и дни недели.

## Current understanding
- Задача frontend-only, но зависит от backend-контракта `TASK-034`.
- Backend source of truth: `durationMinutes`, `weekdays`, `trainingStartTime`, group type, branch, hall, trainers and access scope.
- Текущий frontend уже содержит часть контракта: `durationMinutes`, `weekdays`, `frontend/src/lib/groupSchedule.ts`, поля формы группы и маппинг в `frontend/src/lib/api/groups.ts`.
- Не хватает отдельного раздела `Расписание`, маршрута `/schedule`, недельного read-only списка, доступного всем CRM-пользователям.
- `trainingStartTime` нужно показывать как локальное расписание `HH:mm` без `Date` parsing и timezone conversion.
- Карточка расписания открывает редактирование группы только при `user.permissions.canManageGroups`; для остальных пользователей это read-only карточка.
- Significant UX change: перед реализацией нужен короткий `ui-designer` review недельного списка и narrow-screen поведения.

## Execution steps
1. Подготовить ветку: перейти на `main`, подтянуть latest, убедиться в чистом статусе, создать `feature/TASK-035-group-schedule-frontend-experience`.
2. Проверить, что `TASK-034` контракт доступен в текущей базе кода или явно ожидается backend deploy с полями `durationMinutes` и `weekdays`; не менять backend в этой задаче.
3. Провести `ui-designer` review для структуры раздела: заголовок, список `Пн...Вс`, компактные empty states, read-only vs editable card states, desktop/tablet/mobile.
4. Уточнить frontend route model: добавить `/schedule` как отдельный authenticated route/section; если backend session contract не содержит `Schedule` в `allowedSections`, сделать frontend navigation item доступным всем authenticated CRM users без изменения backend access scope.
5. Обновить навигацию и labels: добавить `Расписание` в app routing/navigation with suitable calendar icon, сохранить existing access checks for `Users`, `Audit`, `Settings`, group edit/create.
6. Добавить feature `frontend/src/features/schedule/GroupScheduleScreen.tsx`: загрузка accessible groups через `getGroups`, loading/error/empty states, refresh action.
7. Реализовать schedule view-model/helper: разложить groups по `weekdays` `1..7`, всегда вернуть все дни `Пн...Вс`, внутри дня отсортировать по `trainingStartTime`, форматировать start time как `HH:mm` без timezone conversion.
8. В карточке занятия показать группу, тип группы, филиал, зал, тренера/тренеров, время начала и `durationMinutes`; не показывать переносы, отмены, замены или conflict-resolution UI.
9. Подключить переход в редактирование: если `canManageGroups`, card/button ведет на `groupEdit`; если нет, карточка не интерактивна и не ведет на закрытый route.
10. Проверить и при необходимости поправить форму группы: `durationMinutes`, `weekdays`, `branchId`, `hallId`, `groupTypeId`, `trainingStartTime`; не отправлять `scheduleText`; backend ProblemDetails fields `durationMinutes`, `weekdays` должны отображаться через existing `applyFieldErrors`.
11. Обновить e2e mocks и regression coverage для schedule route, role visibility, group card click permissions, sorting and empty weekdays.
12. Проверить responsive layout на desktop/tablet/mobile, чтобы день, карточки и действия не перекрывались.

## Preferred implementation strategy
1. contract-first implementation;
2. keep backend access scope as source of truth for returned group data;
3. keep frontend schedule grouping as presentation mapping only;
4. incremental frontend integration through routing, then screen, then tests;
5. small verifiable commits.

Avoid:
- frontend validation that duplicates backend validation semantics for `durationMinutes` or `weekdays`;
- client-side role/access inference for group data;
- `Date` parsing for `trainingStartTime`;
- adding attendance, cancellations, trainer substitutions or conflict checks.

## Files likely to change
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/groups.ts`
- `frontend/src/lib/groupSchedule.ts`
- `frontend/src/lib/appRoutes.ts`
- `frontend/src/App.tsx`
- `frontend/src/features/shared/NavigationTabs.tsx`
- `frontend/src/features/groups/GroupManagement.tsx`
- `frontend/src/features/groups/groupManagement.constants.ts`
- `frontend/src/features/schedule/GroupScheduleScreen.tsx`
- `frontend/src/App.css`
- `frontend/e2e/stage12.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`
- possible new `frontend/e2e/group-schedule.spec.ts`
- possible focused unit tests for schedule helpers

## Constraints
- Frontend не должен дублировать CRM domain rules; validation source of truth остается в backend.
- Backend access scope определяет, какие groups приходят пользователю.
- Branch/hall filtering follows backend contracts from `TASK-031` and `TASK-034`.
- `trainingStartTime` отображается как local `HH:mm`, без timezone conversion.
- `scheduleText` нельзя отправлять или использовать как источник дней недели.
- UI stack: Mantine and Onest.
- Код проекта менять только после создания dedicated branch.

## Out of scope
- Backend domain rules and validation changes.
- Bot changes.
- Attendance flows.
- Personal training schedule.
- Переносы, отмены, замены тренера.
- Проверка занятости зала, conflict resolution.
- Notifications.

## Required test coverage

### Unit tests
Add focused unit tests if schedule helper/view-model is extracted:
- all weekdays `1..7` are always present;
- groups are included in every selected weekday;
- entries are sorted by raw `trainingStartTime`;
- time formatter renders `HH:mm` without `Date` parsing.

### Integration tests
No backend integration tests in this frontend task. Contract integration is covered by:
- TypeScript compile against `TrainingGroupListItem`, `TrainingGroupDetails`, `GroupResponsePayload`;
- e2e API mocks reflecting `TASK-034` response shape.

If implementation discovers frontend API types still include `scheduleText`, update contract consumers and add regression coverage that group create/update payloads contain `durationMinutes` and `weekdays` only.

### UI tests
Add or update Playwright coverage:
- `Расписание` navigation is visible for management users and coach users;
- `/schedule` loads groups from backend mock and displays all weekdays `Пн...Вс`;
- empty weekdays show compact empty state;
- entries within one day are sorted by `trainingStartTime`;
- `trainingStartTime` is displayed as `HH:mm` without timezone conversion;
- schedule cards show group, group type, branch, hall, trainer names, start time and duration;
- management user can open group edit from a schedule card;
- coach/non-manager sees read-only schedule card and does not get edit navigation;
- group form sends `durationMinutes` and `weekdays`, not `scheduleText`;
- backend validation errors for `durationMinutes` and `weekdays` appear in the form.

### Regression priority
High. This task adds navigation plus a shared read-only workflow visible to all CRM users and touches group form contract consumption.

### Minimum expectation
- Add automated Playwright regression for the schedule section.
- Keep existing group form e2e coverage passing and extend it for validation fields if missing.
- Manual QA remains required only for visual polish across desktop/tablet/mobile.

## Test plan
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:e2e -- group-schedule.spec.ts` or equivalent affected Playwright spec
- [ ] `cd frontend && npm run test:e2e -- responsive-main-screens.spec.ts`
- [ ] Manually verify desktop, tablet and mobile layout.

## Regression barrier
Primary barrier: Playwright coverage for `/schedule` across roles plus group form payload/validation assertions.

Secondary barrier: TypeScript build verifies that frontend consumes the `TASK-034` group contract and no stale `scheduleText` contract remains in typed group create/update paths.

## Risks
- `TASK-034` may not be merged into `main` when this task starts; implementation must not silently invent a different frontend/backend contract.
- Existing `AppSection` is backend-session-shaped and currently has no `Schedule`; adding schedule access must not break backend-owned `allowedSections`.
- Fetching only one page of groups could produce incomplete schedule if the gym has more groups than current page size.
- Making a whole card clickable can create accessibility or accidental navigation issues on mobile.
- Sorting `trainingStartTime` through `Date` would introduce timezone bugs.

## Stop conditions
Остановиться и не писать код, если:
- `TASK-034` contract cannot be determined from code or accepted task files;
- schedule visibility requires backend auth/session contract changes instead of frontend-only route/navigation work;
- implementation requires changing roles, permissions or access scope semantics;
- groups endpoint cannot provide schedule data with backend access scope;
- scope expands to attendance, cancellations, substitutions, hall conflict checks or notifications;
- acceptance criteria cannot be met without clarification.

Do NOT stop only because the schedule is a shared CRM section or because both admins and coaches can see it.

## Ready for Codex execution
yes
