# Implementation Plan: TASK-030 Реализовать раздел `Настройки` в CRM

## Source task
/backlog/done/2026-05-13/TASK-030-crm-settings-section.md

## Implementation branch
feature/TASK-030-crm-settings-section

Branch rules:
- create this branch from `main` before writing project code;
- do not implement other unrelated TASKs in this branch;
- confirm that the branch is active before making backend/frontend changes;
- if TASK-031/TASK-032 changes are already present in the worktree, inspect them first and do not duplicate their scope.

## Goal
В CRM есть глобальный раздел `Настройки`, доступный главному тренеру и администратору, где можно управлять типами групп, филиалами/залами и администраторами. Backend остается источником истины для ролей, прав, validation semantics и ProblemDetails.

## Implementation status
Completed on 2026-05-13 in branch `feature/TASK-030-crm-settings-section`.

Implemented scope:
- backend settings access contract: `Settings` section, `ManageSettings` capability, session permissions and settings-scoped policies;
- settings-scoped administrator endpoints; generic user management no longer creates or updates `Administrator` users;
- global group type domain/API with validation, audit state, EF configuration and migration;
- training groups now require a valid `groupTypeId` and return group type data in list/details responses;
- frontend `/settings` IA with tabs `Типы групп`, `Филиалы и залы`, `Администраторы`;
- frontend API contracts, route visibility and group create/edit UI now consume backend settings/group-type contracts;
- affected backend, frontend and Playwright regression coverage has been updated.

## Current understanding
Задача full-stack и high-risk, но уточнения закрыты: пункт меню называется `Настройки`; доступ на просмотр и редактирование есть у `HeadCoach` и `Administrator`; добавление администраторов должно быть только через `Настройки`; поля администратора совпадают с текущими полями пользователя; тип группы содержит название, описание и системный идентификатор; настройки глобальные для всей CRM.

В текущем коде уже видны частичные изменения вокруг филиалов/залов и `/settings`: есть frontend `Settings` route, `BranchSettingsScreen`, `frontend/src/lib/api/branches.ts`, backend `BranchEndpoints`, `Branch/Hall` доменные сущности и tests. Перед реализацией нужно сверить фактическое состояние ветки с TASK-031/TASK-032 и не переносить branch/hall domain rules во frontend. Если эти изменения не являются стабильной базой, филиалы/залы в TASK-030 считать зависимостью от TASK-031/TASK-032.

Сейчас backend `AppSection` не содержит `Settings`, а frontend допускает настройки через `canManageGroups`. Это временный признак: итоговое решение должно быть permission-driven от backend/session, а не frontend workaround.

## Execution steps
1. Подготовить ветку: `git checkout main`, `git pull`, убедиться в чистом статусе, создать `feature/TASK-030-crm-settings-section`.
2. Провести короткий contract audit текущих TASK-031/TASK-032 изменений: branch/hall DTO, endpoints, permissions, UI route. Зафиксировать, что остается в TASK-030: settings IA, типы групп, администраторы, backend permission contract.
3. Добавить backend settings contract: `AppSection.Settings`, session `allowedSections`, отдельное право/политику для настроек, например `CanManageSettings` / `ManageSettings`, доступную `HeadCoach` и `Administrator`.
4. Не расширять `Administrator` до полного `ManageUsers`, если это не требуется. Для администраторов сделать settings-scoped backend путь: создать/list/edit administrators через отдельные endpoints или строго ограниченный use case, где роль фиксируется/валидируется как `Administrator`.
5. Закрыть обход "добавить администратора вне настроек" на backend: общий user management flow не должен создавать нового пользователя с ролью `Administrator`, если запрос не идет через settings-scoped administrator use case.
6. Добавить backend справочник типов групп: доменная сущность, EF configuration, migration, DTO/request/response, endpoints, validation, audit entries and ProblemDetails. Поля: `name`, `description`, `systemIdentifier`.
7. Связать группу с типом группы: добавить `GroupTypeId` в `TrainingGroup`, обновить `UpsertTrainingGroupRequest`, group list/details responses, validators, audit state and tests. Если для чистого dev deploy нужен initial/default group type, сделать его детерминированным в migration/test fixtures.
8. Обновить frontend API contracts: session permissions, group type types/functions, updated group request/response, administrator settings API, settings route visibility from backend permissions.
9. Сформировать settings IA на frontend: один раздел `Настройки` с подразделами/tabs `Типы групп`, `Филиалы и залы`, `Администраторы`. Существующий branch/hall экран переиспользовать как вкладку, если TASK-031/TASK-032 contracts доступны.
10. Добавить UI для типов групп: list/create/edit, uniqueness/validation errors from backend, disabled/loading/error states.
11. Добавить UI для администраторов в `Настройках`: list/create/edit с текущими user fields; role не выбирать вручную или жестко ограничить `Administrator`; показывать backend field errors.
12. Обновить существующий `Users` flow так, чтобы добавление администратора там было недоступно. Если раздел `Users` остается для тренеров/пользователей, исключить `Administrator` из create flow and protect route/API behavior.
13. Обновить group create/edit UI: выбирать тип группы из backend data, отправлять `groupTypeId`, показывать тип в списке/деталях только где это помогает сканированию.
14. Обновить e2e fixtures/session mocks: включить `Settings` и новые permission fields для главного тренера/администратора, оставить тренера без доступа.
15. Запустить backend, frontend and affected e2e validation.

## Preferred implementation strategy
1. Backend contract-first: settings permission, administrator use case, group type entity/API.
2. Backend regression tests before frontend integration.
3. Frontend typed API update.
4. Settings shell/tabs using existing Mantine/shared UX patterns.
5. Incremental UI: group types, administrators, then branch/hall tab reuse.
6. Group form integration with backend group types.
7. E2E/responsive checks for settings and existing users/groups flows.

## Files likely to change
- backend/src/GymCrm.Application/Authorization/AppSection.cs
- backend/src/GymCrm.Application/Authorization/PermissionSet.cs
- backend/src/GymCrm.Infrastructure/Authorization/AccessScopeService.cs
- backend/src/GymCrm.Api/Auth/GymCrmAuthorizationPolicies.cs
- backend/src/GymCrm.Api/Auth/AuthEndpoints.cs
- backend/src/GymCrm.Api/Auth/UserEndpoints.cs
- backend/src/GymCrm.Api/Auth/UserRequestValidator.cs
- backend/src/GymCrm.Api/Auth/CreateUserRequest.cs
- backend/src/GymCrm.Api/Auth/UpdateUserRequest.cs
- backend/src/GymCrm.Api/Auth/UserResponse.cs
- backend/src/GymCrm.Domain/Groups/TrainingGroup.cs
- backend/src/GymCrm.Domain/Groups/GroupType.cs
- backend/src/GymCrm.Infrastructure/Persistence/GymCrmDbContext.cs
- backend/src/GymCrm.Infrastructure/Persistence/Configurations/TrainingGroupConfiguration.cs
- backend/src/GymCrm.Infrastructure/Persistence/Configurations/GroupTypeConfiguration.cs
- backend/src/GymCrm.Infrastructure/Persistence/Migrations/*
- backend/src/GymCrm.Api/Auth/GroupEndpoints.cs
- backend/src/GymCrm.Api/Auth/GroupRequestValidator.cs
- backend/src/GymCrm.Api/Auth/UpsertTrainingGroupRequest.cs
- backend/src/GymCrm.Api/Auth/GroupDetailsResponse.cs
- backend/src/GymCrm.Api/Auth/GroupListItemResponse.cs
- backend/src/GymCrm.Api/Auth/GroupTypeEndpoints.cs
- backend/src/GymCrm.Api/Auth/GroupTypeResources.cs
- backend/src/GymCrm.Api/Auth/Resources/GroupTypeResources.resx
- backend/tests/GymCrm.Tests/AuthorizationFlowTests.cs
- backend/tests/GymCrm.Tests/UsersApiTests.cs
- backend/tests/GymCrm.Tests/GroupsApiTests.cs
- backend/tests/GymCrm.Tests/BranchesApiTests.cs
- frontend/src/lib/api/types.ts
- frontend/src/lib/api/endpoints.ts
- frontend/src/lib/api/users.ts
- frontend/src/lib/api/groups.ts
- frontend/src/lib/api/branches.ts
- frontend/src/lib/api/groupTypes.ts
- frontend/src/lib/appRoutes.ts
- frontend/src/App.tsx
- frontend/src/features/settings/*
- frontend/src/features/users/*
- frontend/src/features/groups/GroupManagement.tsx
- frontend/src/features/groups/groupManagement.constants.ts
- frontend/src/features/shared/NavigationTabs.tsx
- frontend/e2e/users.spec.ts
- frontend/e2e/stage12.spec.ts
- frontend/e2e/responsive-main-screens.spec.ts
- frontend/e2e/home-dashboard.spec.ts

## Constraints
- Backend owns roles, permissions, access scope, audit semantics, validation semantics and ProblemDetails.
- Frontend must not infer settings permissions or duplicate CRM validation rules.
- `Administrator` should get settings/admin-management capability without accidentally getting all `ManageUsers` capabilities unless backend policy explicitly says so.
- Добавление администраторов должно быть доступно только через `Настройки`.
- Типы групп и филиалы/залы являются глобальными CRM settings, not branch-scoped local settings.
- Branch/hall domain rules belong to TASK-031 backend contracts and TASK-032 frontend consumption; TASK-030 may compose them in settings UI but must not reimplement their rules.
- Preserve Mantine and existing shared UX patterns.

## Out of scope
- Полная переработка ролей CRM.
- Bot consumer changes for branch/hall contracts.
- Финансовая отчетность по филиалам.
- Полная реализация расписания.
- Новые поля администратора beyond current user fields.
- Direct trainer-branch relationship.

## Required test coverage

### Unit tests
Add or update unit tests for extracted pure helpers if they exist:
1. group type payload/form mapping;
2. administrator settings payload mapping;
3. settings tab state helpers;
4. user role option filtering so `Administrator` is not available outside settings create flow.

### Integration tests
Backend integration/regression tests are required:
1. Session for `HeadCoach` and `Administrator` exposes settings access; `Coach` does not.
2. Settings/admin endpoints allow `HeadCoach` and `Administrator` to create/edit administrators with current user fields.
3. General users endpoint cannot create an `Administrator` outside the settings-scoped administrator flow.
4. Coach receives 403/redirect-equivalent API denial for settings/admin/group-type mutations.
5. Group type CRUD validates required name, required system identifier and uniqueness.
6. Group create/update requires a valid `groupTypeId` and returns group type data in list/details.
7. ProblemDetails/validation payloads are stable for group type and administrator settings failures.
8. Branch/hall settings endpoints remain covered by existing or updated `BranchesApiTests` if their permissions move from `ManageGroups` to `ManageSettings`.

### UI tests
Add/update Playwright coverage:
1. Head coach can open `Настройки`, switch between `Типы групп`, `Филиалы и залы`, `Администраторы`.
2. Administrator can open and edit settings; coach cannot see/open settings.
3. Admin can be created from `Настройки` with the same fields as current user creation.
4. Existing `Users` create flow does not offer administrator creation.
5. Group type can be created/edited and selected in group create/edit form.
6. Settings screen remains usable on narrow viewport without text overlap.

## Test plan
- [x] Запустить `dotnet test backend/GymCrm.slnx --no-restore` - passed, 87 tests.
- [x] Запустить `cd frontend && npm run lint` - passed.
- [x] Запустить `cd frontend && npm run build` - passed.
- [x] Запустить affected Playwright tests: `stage12.spec.ts`, `users.spec.ts`, `responsive-main-screens.spec.ts` - passed, 25 tests.
- [x] Проверить доступ к `Настройкам` под главным тренером, администратором и тренером - covered by updated session mocks and Playwright route/navigation checks.
- [x] Проверить, что создание администратора доступно только через `Настройки` - covered by backend integration tests and Playwright users/settings flow.
- [x] Проверить создание/редактирование типа группы и создание/редактирование группы с выбранным типом - covered by backend integration tests and affected Playwright settings/groups flow.

## Regression barrier
Primary regression barrier is backend integration coverage for settings permissions, administrator-only settings use case, group type CRUD, and group type usage by groups. Frontend Playwright tests then prove the user-facing flows consume those backend contracts without duplicating permission or validation semantics.

## Risks
- Granting `Administrator` broad `ManageUsers` could unintentionally allow managing coaches/head coach. Prefer a settings-scoped administrator use case.
- Current frontend settings visibility appears tied to `canManageGroups`; leaving this as-is would duplicate permission semantics outside backend.
- Group type migration can break existing group fixtures if no deterministic default/backfill is provided.
- Refactoring `Users` and adding `Administrators` inside settings can create duplicate screens unless ownership is clearly split.
- Branch/hall work overlaps TASK-031/TASK-032; implementation must reuse stable contracts rather than fork the model.

## Stop conditions
Остановиться и не писать код, если:
- текущая ветка не `feature/TASK-030-crm-settings-section` или она создана не от актуального `main`;
- worktree грязный неизвестными изменениями в backend/frontend files;
- TASK-031/TASK-032 branch/hall contracts conflict with the settings IA;
- невозможно реализовать "администратор только через Настройки" without backend permission changes;
- changing admin permissions would require a global auth/RBAC redesign instead of a localized policy/use case;
- group type semantics require product choices beyond name, description and system identifier.

## Ready for Codex execution
yes, after explicit review of this high-risk plan and after the executor confirms the correct branch and the actual TASK-031/TASK-032 branch/hall baseline.
