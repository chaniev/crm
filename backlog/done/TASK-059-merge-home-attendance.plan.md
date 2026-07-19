# Implementation Plan: TASK-059 Объединить Главную и Посещения

## Source task
/backlog/done/TASK-059-merge-home-attendance.md

## Implementation branch
feature/TASK-059-merge-home-attendance

Branch rules:
- create this branch from `main` before writing code;
- before branch creation, run `git status`, switch to `main`, pull latest changes, and verify the worktree is clean;
- do not implement other unrelated TASKs in this branch;
- confirm the branch is active before making project code changes.

## Goal
Сделать `Главную` единым рабочим экраном для истекающих абонементов и отметки посещений, убрать отдельный раздел `Посещения` и удалить рабочий маршрут `/attendance`.

## Current understanding
- `Главная` остается единственным пунктом навигации для объединенного сценария.
- Отметка посещений переезжает на `Главную`; отдельная вкладка `Посещения` удаляется.
- Тренер после входа попадает на `Главную` и сразу видит отметку посещений без дополнительных переходов.
- Для тренера на `Главной` доступна только отметка посещений.
- Администратор и главный тренер сохраняют блок истекающих абонементов, а отметка посещений добавляется на тот же экран.
- Backend больше не должен возвращать `Attendance` в `allowedSections`; доступ к действиям посещений остается backend-driven через существующие permissions/contracts.
- Ошибки и загрузка блока истекающих абонементов не должны блокировать отметку посещений, и наоборот.

## Execution steps
1. Подготовить ветку `feature/TASK-059-merge-home-attendance` от актуального `main` после проверки чистого git status.
2. Прочитать актуальные backend/frontend contracts для session/access scope: где формируются `allowedSections`, `landingScreen`, permissions и role-specific доступ.
3. Обновить backend session/access scope так, чтобы `Attendance` больше не возвращался в `allowedSections`, а роли с правом отметки посещений продолжали получать нужный доступ через существующие permissions.
4. Обновить backend tests на session/access scope для администратора, главного тренера и тренера.
5. Обновить frontend API types/resources/routes: убрать `Attendance` как секцию навигации и рабочий путь `/attendance`.
6. Переработать routing fallback/landing логику так, чтобы тренер с доступом к отметке посещений попадал на `Home`.
7. Выделить UI отметки посещений из `AttendanceScreen` в переиспользуемый компонент или встроить его в `HomeDashboard` без переноса доменных правил во frontend.
8. Собрать `HomeDashboard` из независимых секций: истекающие абонементы для администратора/главного тренера и attendance-секция для ролей с правом отметки.
9. Убедиться, что для тренера `HomeDashboard` не показывает блок истекающих абонементов/access denied, а сразу показывает attendance-сценарий.
10. Обновить desktop/mobile navigation tests и e2e: пункт `Посещения` отсутствует, `Главная` остается, отметка посещений выполняется с `/`.
11. Проверить поведение `/attendance`: маршрут больше не должен быть рабочим; ожидаемое поведение уточнить по текущему router-паттерну во время реализации и покрыть тестом.
12. Запустить required validation и исправить регрессии.

## Preferred implementation strategy
1. Contract-first: сначала backend session/access-scope contract и тесты.
2. Compatibility-aware frontend: затем типы и маршруты, чтобы frontend не ожидал `Attendance`.
3. Incremental UI integration: вынести attendance UI в локальный компонент и подключить к `HomeDashboard`.
4. Role-based rendering только от backend-provided user/permissions, без дублирования CRM-правил.
5. Tests вместе с изменениями: unit для route/access mapping, e2e для landing/navigation/attendance flow.

## Files likely to change
- `backend/**/AGENTS.md` must be followed before backend edits.
- `backend/**` files that build session/access scope and tests for authenticated user context.
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/appRoutes.ts`
- `frontend/src/lib/appRoutes.test.ts`
- `frontend/src/App.tsx`
- `frontend/src/features/home/HomeDashboard.tsx`
- `frontend/src/features/home/HomeDashboard.test.tsx`
- `frontend/src/features/attendance/AttendanceScreen.tsx`
- `frontend/e2e/attendance.spec.ts`
- `frontend/e2e/home-dashboard.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`
- `frontend/e2e/auth.spec.ts`
- `frontend/e2e/stage12.spec.ts`

If exact backend files are unclear, discover them before editing with `rg "allowedSections|landingScreen|Attendance" backend`.

## Constraints
- Backend remains the source of truth for roles, permissions, attendance and access scope.
- Frontend must not infer CRM domain permissions independently.
- Do not change attendance save semantics, audit semantics or membership validation semantics.
- Preserve fast attendance marking for coaches and administrators.
- Preserve Mantine/Onest and existing shared UX patterns.
- Keep loading/error states independent between expiring memberships and attendance.
- Do not leave stale `/attendance` navigation links or tests that still treat it as the primary route.

## Out of scope
- Redesigning attendance business rules.
- Introducing a new permissions model.
- Changing payment/membership expiration domain semantics.
- Reworking unrelated navigation sections.
- Broad refactoring of `App.tsx` beyond what is needed to remove `Attendance` and mount attendance on `Home`.

## Required test coverage

### Unit tests
- Update backend unit/integration-style contract tests that assert `allowedSections`/session payloads by role.
- Update `frontend/src/lib/appRoutes.test.ts` for removed `Attendance`, mobile primary sections and landing behavior.
- Update `HomeDashboard` tests for role-specific rendering: coach sees attendance only; administrator/head coach see expiring memberships plus attendance when allowed.

### Integration tests
- Backend session/access tests must cover administrator, head coach and coach contracts after removing `Attendance`.
- If route normalization/redirect behavior changes in frontend, add or update integration-level component tests around unknown or removed paths.

### UI tests
- Update Playwright attendance flow to start from `/` or the login landing route instead of `/attendance`.
- Update navigation assertions so `Посещения` is absent on desktop and mobile.
- Update trainer landing e2e: trainer lands on `Главная` and attendance controls are visible immediately.
- Update responsive main screens coverage for the merged home screen.

### Manual-only checks
- Visual scan of desktop/mobile merged `Главная` after automated tests pass.
- Confirm no unexpected overlap between the expiring memberships block and attendance controls in narrow viewports.

## Test plan
- [ ] Run `dotnet test backend/GymCrm.slnx`.
- [ ] Run `cd frontend && npm run lint`.
- [ ] Run `cd frontend && npm run build`.
- [ ] Run affected frontend unit tests for app routes and home dashboard.
- [ ] Run affected Playwright tests for auth landing, home dashboard, attendance flow and responsive main screens.
- [ ] Verify `/attendance` is not a working product route and no nav item links to it.

## Regression barrier
Automated regression barrier must include:
- backend tests proving `Attendance` is no longer emitted in `allowedSections`;
- frontend route/navigation unit tests proving `Attendance` is not a nav section and mobile nav keeps only `Главная`;
- Playwright coverage proving trainer lands on `Главная`, sees attendance controls immediately and can save attendance from the merged screen;
- Playwright or component coverage proving independent error states between expiring memberships and attendance.

## Risks
- Removing `Attendance` from shared route types may break many existing tests and fixtures that hard-code `allowedSections`.
- Backend and frontend may currently rely on `Attendance` both as navigation scope and attendance permission signal; implementation must preserve action permission through existing permission fields.
- `/attendance` removal behavior may need alignment with the current router fallback pattern to avoid confusing blank/error pages.
- Merging two screens can create loading/error coupling if state is lifted too broadly.
- Mobile bottom navigation ordering may regress if `Attendance` remains in candidate lists or fixtures.

## Stop conditions
Остановиться и не писать код, если:
- обнаружится, что `Attendance` is also the only backend authorization gate for attendance API calls, not just a frontend section;
- backend contract cannot represent "Home with attendance permission" without a broader permissions redesign;
- `/attendance` removal conflicts with an externally required deep-link/backward-compatibility requirement not captured in the task;
- implementation requires changing attendance domain rules, audit semantics or membership validation semantics;
- scope expands into unrelated navigation redesign.

Do not stop only because both backend and frontend must change.

## Ready for Codex execution
yes
