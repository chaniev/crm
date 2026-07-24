# Implementation Plan: TASK-082 Добавить роль суперадминистратора

## Source task
/backlog/risky/TASK-082-super-administrator-role.md

Source status remains `risky`: этот план локализует security-sensitive изменение, test-first порядок и regression barriers для отдельного review. Задача не перемещается в active implementation и project code в рамках подготовки плана не меняется.

## Git branch
feature/TASK-082-super-administrator-role

Branch rules:
- до реализации получить явное одобрение risky-плана и перевести source task из `/backlog/risky` в `/backlog/implementation`;
- проверить чистый worktree, перейти на `main`, выполнить `git pull --ff-only` и создать `feature/TASK-082-super-administrator-role` от актуального `main`;
- подтвердить активную task branch до первого изменения project code;
- не реализовывать в этой ветке TASK-080, TASK-081 или несвязанный authorization refactoring;
- остановиться, если worktree dirty, branch/base неясны или ветка создана не от `main`.

## Goal
Главный тренер может создать глобального SuperAdministrator без филиала. SuperAdministrator получает явно перечисленные возможности Administrator во всех филиалах, управляет Administrator и Coach в разрешённых пределах и отмечает посещения любой группы, но не получает bootstrap, HeadCoach-only, financial или self-escalation полномочия.

## Current understanding
- Роли определены строково сохраняемым enum `UserRole` со значениями `HeadCoach`, `Administrator`, `Coach`. Новое значение нужно добавлять без перенумерации существующих значений, предпочтительно `SuperAdministrator = 4`.
- PostgreSQL хранит role как строку длиной до 32 символов. Текущий `CK_Users_AdministratorBranch` уже требует `BranchId != null` только для `Administrator` и `BranchId == null` для всех остальных ролей, поэтому `SuperAdministrator` укладывается в текущую схему без новой колонки или migration.
- Auth/session сейчас не возвращает `branchId`, хотя frontend тип допускает optional `branchId`. Для TASK-082 контракт должен сделать поле явным и возвращать `null` для HeadCoach, SuperAdministrator и Coach, а для Administrator — обязательный id его филиала.
- `AccessScopeService` и `GymCrmAuthorizationPolicies` содержат разрозненные role-switch/`RequireRole` проверки. Отдельной actor/target role matrix для управления персоналом нет.
- `/users` защищён `ManageUsers` и сейчас доступен только HeadCoach; он исключает Administrator из list/get/update и создаёт в основном Coach.
- `/settings/administrators` защищён общим `ManageSettings`. Поскольку `ManageSettings` доступен Administrator, обычный Administrator сейчас может list/create/update других Administrator прямым API. Это прямое расхождение с TASK-082 и должно быть закрыто отдельной staff-management policy.
- `UserRequestValidator` имеет локальные флаги `allowAdministratorRole` и запреты HeadCoach. Расширять эту схему ещё несколькими boolean-флагами нельзя: actor/target/action rules должны перейти в один backend-owned policy/matrix.
- User audit уже хранит actor в `AuditLog.UserId` и target в `EntityId`, но `UserAuditState` не включает `BranchId`. Для требуемого actor/target/old-new-role/branch scope достаточно расширить typed audit snapshot и обеспечить атомарность mutation + audit.
- `PermissionSet` описывает семь общих UI-capabilities. SuperAdministrator должен получить `CanManageUsers`, текущие Administrator permissions и `CanMarkAttendance`, но не `CanViewFinancialReports`. HeadCoach-only professional-membership/bootstrap действия нельзя выдавать только из-за нового глобального scope.
- Browser attendance policy запрещает Administrator attendance, но internal `BotApiService` сейчас включает Administrator в attendance menu и не ограничивает ему группы. TASK-082 должен привести web/internal bot к одной backend-owned матрице: SuperAdministrator — все группы; Administrator — без attendance до TASK-080; Coach — только назначенные группы.
- Coach остаётся без `BranchId`; его scope определяется `GroupTrainers`. SuperAdministrator управляет назначениями Coach через существующие group contracts, но сам не становится assignable trainer.
- Frontend знает только три роли в API types/mappers/resources/presentation и содержит role-name checks в `App`, `SettingsScreen`, `MembershipCatalogSettings`, user forms и attendance empty state.
- Settings UX разделён: Coach управляется через `/users`, Administrator — через вкладку настроек. TASK-082 не требует объединять эти экраны, но оба transport path должны использовать одну backend role matrix. Вкладка Administrator должна зависеть от staff-management capability, а не от общего `canManageSettings`.
- Python bot содержит закрытый `BotRole` literal из трёх ролей; он должен распознавать новую строку, но не вычислять permissions или branch scope локально.
- TASK-080 остаётся отдельной задачей про явные group grants для Administrator. TASK-082 даёт SuperAdministrator global attendance сейчас, но не создаёт модель разрешений TASK-080. После реализации TASK-080 её grant/revoke matrix должна включить HeadCoach и SuperAdministrator.
- TASK-081 пересекается с permission-driven видимостью settings tabs. Если она будет реализована раньше, TASK-082 обязан сохранить её contract/tests; если позже — не считать общий `SettingsScreen` role-check доказательством доступа.

## Fixed authorization decisions

### Capability matrix

| Capability | HeadCoach | SuperAdministrator | Administrator | Coach |
|---|---:|---:|---:|---:|
| Bootstrap/replace HeadCoach | yes | no | no | no |
| Create/assign SuperAdministrator | yes | no | no | no |
| Manage Administrator | yes | yes | no | no |
| Manage Coach | yes | yes | no | no |
| Manage clients/groups | global | global | own branch for branch-owned data | no |
| Manage settings allowed to Administrator | global | global | existing allowed scope | no |
| View audit | global | global | existing allowed scope | no |
| Mark attendance | all groups | all groups | no until TASK-080 grants | assigned groups |
| View financial reports | yes | no | no | no |
| HeadCoach-only professional privileges | yes | no | no | no |

The table is backend-owned. Session permissions, endpoint policies, resource access, frontend action visibility and internal bot menu/access must be projections of the same decisions, not independent role-name lists.

### Staff actor/target matrix
- HeadCoach can create SuperAdministrator, Administrator and Coach. Existing HeadCoach immutability/deactivation/bootstrap protections remain unchanged.
- Only HeadCoach can assign `SuperAdministrator` to an existing non-HeadCoach target. Such a transition must atomically clear `BranchId`.
- SuperAdministrator can create Administrator for any active branch and Coach without a branch.
- SuperAdministrator can edit/deactivate existing Administrator and Coach within the fields already supported by their flows.
- SuperAdministrator cannot create, assign, edit, deactivate or otherwise mutate HeadCoach or any SuperAdministrator, including itself.
- Administrator and Coach cannot list/manage staff through protected management endpoints. Existing self-service password/session flows remain available and are not staff management.
- Coach↔Administrator role conversion is not introduced for SuperAdministrator. If product later needs it, it requires a separately accepted contract for branch assignment/removal.
- HeadCoach demotion/reassignment of an existing SuperAdministrator must be fixed before code: either allow only `SuperAdministrator -> Coach`, or allow `-> Administrator` only with an explicit active `branchId`. No implicit/default branch is permitted.
- List/get responses must not be treated as authorization. Every write re-evaluates actor, target, requested role, self-target and current persisted state immediately before mutation.

### Branch and role invariants
- `Administrator` always has a non-null active `BranchId`.
- `HeadCoach`, `SuperAdministrator` and `Coach` always have `BranchId = null`.
- Creating/updating Administrator with missing, empty, unknown or archived branch returns stable field errors and does not save user/audit state.
- Any accepted role transition validates the destination invariant and writes role/branch atomically.
- Branch-owned client/group/catalog operations use one resolved backend scope: global for HeadCoach/SuperAdministrator, own branch for Administrator, assigned groups for Coach where that operation is already allowed.
- Global dictionaries/settings keep their existing product semantics. TASK-082 must not silently reinterpret TASK-030/TASK-031 or add HeadCoach-only capabilities to SuperAdministrator.

### Stable denial and audit contract
- Before writing tests, fix exact ProblemDetails types/codes for:
  - actor cannot manage staff;
  - actor cannot target protected role;
  - self-escalation/protected self mutation;
  - forbidden requested role transition;
  - forbidden branch scope.
- Policy-level `403`, resource-level `403`, validation `400` and missing target `404` must be deterministic and must not reveal protected-user details beyond the existing authenticated management contract.
- Denied attempts do not mutate data and do not write success audit events. If denied-attempt audit is required by the existing audit contract, it must use a separate explicit action and tests; do not mix it with `UserUpdated`.
- Successful sensitive create/update/role/active/branch changes write exactly one audit event in the same transaction as the user mutation.
- Audit state includes actor id through `AuditLog.UserId`, target id through `EntityId`, plus old/new `Role` and `BranchId` in typed snapshots. Password hashes and raw secrets never enter audit.

## Safe decomposition
1. **Role and matrix foundation:** append enum value, define explicit capabilities and actor/target/action policy with pure unit tests.
2. **Session and persistence invariants:** branch-null contract, role parsing, DB model assertion, session projection and bootstrap/seed non-regression.
3. **Staff management:** protect both `/users` and `/settings/administrators` with staff policy, centralize validation/mutation/audit and expose backend-owned allowed actions/options.
4. **Global operational scope:** project SuperAdministrator into client, membership, group, settings, audit, messenger and branch-aware access without granting HeadCoach-only operations.
5. **Attendance and internal bot:** all-group SuperAdministrator access, Coach assigned scope, Administrator denial until TASK-080, identical web/internal bot decisions.
6. **Frontend consumers:** role parsing/labels/navigation, permission-driven settings/staff UI, HeadCoach-only SuperAdministrator creation and SuperAdministrator Administrator/Coach flows.
7. **Cross-layer regression:** full role/action/scope matrix, direct API bypass attempts, atomic audit, two-branch data checks and bot compatibility.

Each slice begins with focused unit/integration tests and a recorded expected red phase. Functional code for that slice starts only after the new tests fail for missing TASK-082 behavior.

## Execution steps
1. Obtain risky-task approval, move TASK-082 into implementation and create `feature/TASK-082-super-administrator-role` from clean current `main`; reread root/backend/frontend/bot `AGENTS.md`, the source task and this plan.
2. Before production code, review and freeze:
   - the capability and staff actor/target tables above;
   - exact HeadCoach transitions away from SuperAdministrator;
   - stable ProblemDetails type/code/status values;
   - whether denied sensitive operations are audited in the current product contract;
   - TASK-080/TASK-081 merge order.
3. **Before production code**, add backend unit tests for a new focused role/capability policy:
   - all actor/action/target pairs for create, edit, deactivate and role assignment;
   - self-target rules;
   - global/branch/assigned-group scope kind per role;
   - HeadCoach-only finance/bootstrap/professional privileges;
   - SuperAdministrator cannot acquire HeadCoach/SuperAdministrator target permissions through any alternate action.
4. **Before production code**, extend `AuthorizationFlowTests` with exact session/access-probe assertions:
   - role string `SuperAdministrator`, explicit `branchId: null`, allowed sections and permissions;
   - HeadCoach and Coach `branchId: null`, Administrator exact non-null branch id;
   - SuperAdministrator access to staff/client/group/settings/audit/attendance probes and denial for finance;
   - Administrator denial for staff and attendance; Coach retains assigned-group-only attendance;
   - two groups in different branches prove SuperAdministrator all-group attendance.
5. **Before production code**, add a focused staff-management integration matrix in `UsersApiTests` or a new `StaffAuthorizationApiTests`:
   - HeadCoach creates SuperAdministrator, Administrator and Coach;
   - SuperAdministrator creates Administrator in each of two active branches and Coach without branch;
   - SuperAdministrator cannot create/assign HeadCoach or SuperAdministrator;
   - Administrator and Coach cannot use `/users` or `/settings/administrators`, including direct POST/PUT with valid CSRF;
   - protected target, self-target, overposted role and stale target cases;
   - missing/empty/unknown/archived branch cases;
   - accepted transitions preserve destination branch invariant;
   - failures leave user count, target row, session version and audit count unchanged.
6. **Before production code**, add audit integration tests:
   - exact actor and target ids;
   - old/new role and `branchId`;
   - create/update/deactivate/role-transition cardinality;
   - no password hash/secret in snapshots;
   - forced audit write failure rolls back the user mutation, or implementation stops for explicit architecture review if current audit infrastructure cannot provide atomicity locally.
7. **Before production code**, add two-branch operational integration tests:
   - SuperAdministrator can list/create/update clients, memberships and groups in both branches;
   - Administrator is constrained to its allowed branch for branch-owned operations and cannot escape through query/body ids;
   - SuperAdministrator manages Coach assignments in groups of both branches;
   - global settings/audit behavior matches the frozen existing Administrator contract;
   - financial reports and HeadCoach-only professional actions remain forbidden;
   - client photos and messenger operations follow the same manager/global scope without data leakage.
8. **Before production code**, extend web attendance tests:
   - SuperAdministrator list contains groups from at least two branches;
   - roster/read/save succeeds for both branches;
   - missing group is `404`, while a role-denied group/action follows the stable denial contract;
   - Administrator remains denied before TASK-080;
   - Coach and HeadCoach behavior remains unchanged.
9. **Before production code**, extend backend internal bot tests:
   - context/menu recognizes SuperAdministrator and includes manager/attendance scenarios permitted by backend;
   - all-branch list/roster/save and client scenarios work for SuperAdministrator;
   - Administrator does not receive or execute attendance before TASK-080;
   - Coach remains assigned-group scoped;
   - direct internal API calls cannot bypass the same capability/scope matrix.
10. **Before production code**, add frontend API/mapper tests:
    - exact role union and strict rejection/fallback behavior for unknown role;
    - explicit nullable `branchId` in session and user payloads;
    - new permission/capability or `allowedActions` fields;
    - staff create/update payloads preserve role/branch invariants supplied by backend options;
    - ProblemDetails field/general errors survive mapping.
11. **Before production code**, add frontend component tests:
    - role label/presentation/navigation for SuperAdministrator;
    - HeadCoach can select SuperAdministrator only when backend capability/options allow it;
    - SuperAdministrator sees Coach management and Administrator settings action, but no SuperAdministrator/HeadCoach target action;
    - ordinary Administrator retains allowed settings but never sees Administrator-management controls;
    - forms render active branches returned by backend and preserve backend validation errors;
    - no component infers target permissions solely from role strings when backend `allowedActions` are available.
12. **Before production code**, add Playwright flows:
    - HeadCoach creates SuperAdministrator and a fresh session has `branchId: null`;
    - SuperAdministrator creates Administrator for branch B and Coach, then assigns Coach to a branch-B group;
    - SuperAdministrator marks attendance in branch A and B;
    - direct SuperAdministrator escalation and direct Administrator staff-management requests are denied without mutation;
    - desktop and 390 px staff/settings flows remain usable.
13. Run all new focused tests and confirm the red phase:
    - failures must be caused by the missing enum/matrix/session/staff/scope/UI/bot behavior;
    - baseline regressions, broken fixtures, EF InMemory limitations or unavailable PostgreSQL do not satisfy the expected red phase.
14. Implement the backend foundation:
    - append `SuperAdministrator = 4` to `UserRole`;
    - introduce one focused role capability/target policy in Domain/Application without HTTP dependencies;
    - make `AccessScopeService`, authorization policies and staff validators consume that policy;
    - do not add scattered `or UserRole.SuperAdministrator` conditions as the primary design.
15. Implement auth/session and persistence invariants:
    - add explicit nullable `BranchId` to authenticated user response;
    - project exact permissions/sections from the capability matrix;
    - keep current user DB constraint and assert it supports SuperAdministrator; do not create a migration when the EF model/schema does not change;
    - keep bootstrap strictly HeadCoach and do not auto-seed a privileged SuperAdministrator;
    - update seed/test helpers and startup tests so counts/role parsing remain deterministic.
16. Implement one staff-management application boundary used by both endpoint modules:
    - centralize actor/target/action decision, destination role/branch validation and mutation;
    - protect `/users` and `/settings/administrators` with `ManageUsers`/dedicated staff policy, never `ManageSettings`;
    - keep Administrator creation route compatibility if needed, but delegate to the same service;
    - expose backend-owned create-role options and target `allowedActions` so frontend does not reproduce the matrix;
    - wrap mutation and required audit write in one transaction;
    - return stable ProblemDetails without exception/SQL detail.
17. Implement global operational scope:
    - make HeadCoach/SuperAdministrator global and Administrator branch-scoped for branch-owned data through one resolved scope abstraction;
    - update client/group/attention/photo/membership/catalog/messenger consumers that currently compare roles directly;
    - preserve global dictionary/settings semantics from accepted tasks;
    - keep professional privilege and financial report capability HeadCoach-only;
    - perform a final source audit for direct role and `BranchId` checks and either route each security-sensitive check through the matrix/scope service or document why it is presentation-only.
18. Implement attendance:
    - include SuperAdministrator in `MarkAttendance`;
    - return all groups and allow access decisions for every existing group;
    - keep Coach assignment checks;
    - explicitly deny Administrator until TASK-080 adds backend-owned grants;
    - update access probe `grantedBy` to a stable backend capability/scope value instead of HeadCoach-vs-Coach branching.
19. Update internal bot backend and Python consumer:
    - backend menu, group/client queries and attendance checks consume the same capability/scope policy;
    - add `SuperAdministrator` to Python `BotRole`;
    - render only backend-returned menu/data and keep branch/permission rules out of Python;
    - preserve request id, idempotency and existing attendance date semantics.
20. Update frontend contracts and UI:
    - add role label/presentation and explicit session `branchId`;
    - pass backend capabilities/options into user create/edit and Administrator settings flows;
    - show staff-management actions only from permissions/allowed actions;
    - keep settings visibility compatible with TASK-081 and separate Administrator management from general settings;
    - preserve Mantine/Onest, current navigation patterns and narrow-screen behavior.
21. Run targeted green tests after every slice, then required full validation:
    - `dotnet test backend/GymCrm.slnx`;
    - `cd frontend && npm run test:unit`;
    - `cd frontend && npm run lint`;
    - `cd frontend && npm run build`;
    - focused Playwright staff/attendance/settings scenarios;
    - `cd bot && ruff check .`;
    - `cd bot && pytest`;
    - clean PostgreSQL schema/model drift check and local multi-service smoke if runtime contracts changed.
22. Perform final security review:
    - enumerate every production reference to all four roles;
    - prove no endpoint protected only by frontend visibility;
    - prove ordinary Administrator cannot manage staff;
    - prove SuperAdministrator cannot target HeadCoach/SuperAdministrator or access finance/professional/bootstrap operations;
    - prove role/branch mutation and audit are atomic;
    - prove web and internal bot return the same effective scope.

## Preferred implementation strategy
1. Contract and authorization-matrix first.
2. Tests before functional code for every slice, with recorded expected failure.
3. One backend-owned capability/target/scope source projected to HTTP, session, frontend and bot.
4. Preserve existing endpoint shapes where practical, but route both staff transports through one service to eliminate bypasses.
5. Small reviewable commits: red matrix tests, policy/session, staff management/audit, operational scope, attendance/bot, frontend, final regression.
6. No feature flag is required for the enum itself; deployment must remain blocked until all strict consumers recognize the role and the full matrix is green.

## Files likely to change

### Backend tests first
- `backend/tests/GymCrm.Tests/UserRoleAuthorizationPolicyTests.cs` (new)
- `backend/tests/GymCrm.Tests/AuthorizationFlowTests.cs`
- `backend/tests/GymCrm.Tests/UsersApiTests.cs`
- `backend/tests/GymCrm.Tests/AttendanceApiTests.cs`
- `backend/tests/GymCrm.Tests/ClientsApiTests.cs`
- `backend/tests/GymCrm.Tests/GroupsApiTests.cs`
- `backend/tests/GymCrm.Tests/AuditLogApiTests.cs`
- `backend/tests/GymCrm.Tests/InternalBotApiTests.cs`
- `backend/tests/GymCrm.Tests/BootstrapSmokeTests.cs`
- `backend/tests/GymCrm.Tests/TestDataSeederTests.cs`
- focused client photo/membership/messenger tests where current direct role checks are covered

### Backend production after red phase
- `backend/src/GymCrm.Domain/Users/UserRole.cs`
- `backend/src/GymCrm.Application/Authorization/PermissionSet.cs`
- `backend/src/GymCrm.Application/Authorization/AccessScope.cs`
- `backend/src/GymCrm.Application/Authorization/UserRoleAuthorizationPolicy.cs` (new, exact name may vary)
- `backend/src/GymCrm.Infrastructure/Authorization/AccessScopeService.cs`
- `backend/src/GymCrm.Api/Auth/GymCrmAuthorizationPolicies.cs`
- `backend/src/GymCrm.Api/Auth/AuthEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/AccessEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/UserEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/AdministratorEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/UserRequestValidator.cs` or replacement focused validators
- `backend/src/GymCrm.Api/Auth/UserResponse.cs`
- `backend/src/GymCrm.Api/Auth/UserAuditState.cs`
- `backend/src/GymCrm.Api/Auth/UserAuditSerializer.cs`
- `backend/src/GymCrm.Api/Auth/AttendanceEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/ClientAttentionEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/GroupEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/MembershipCatalogEndpoints.cs`
- `backend/src/GymCrm.Infrastructure/Clients/ClientPhotoService.cs`
- `backend/src/GymCrm.Infrastructure/Clients/ClientMembershipService.cs`
- `backend/src/GymCrm.Infrastructure/Messenger/ClientMessengerService.cs`
- `backend/src/GymCrm.Infrastructure/Bot/BotApiService.cs`
- seed/startup helpers only where strict role/count assumptions exist

### Frontend tests first
- `frontend/src/lib/api/mappers.test.ts` or nearest API contract test
- `frontend/src/lib/appRoutes.test.ts`
- focused tests for `UserCreateScreen`, `UserEditScreen`, `UsersListScreen` and `SettingsScreen` (new if absent)
- `frontend/src/features/attendance/AttendanceScreen.test.tsx`
- `frontend/e2e/users.spec.ts`
- `frontend/e2e/attendance.spec.ts`
- focused settings/role-matrix Playwright spec

### Frontend production after red phase
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/mappers.ts`
- `frontend/src/lib/api/users.ts`
- `frontend/src/lib/api/administrators.ts`
- `frontend/src/lib/appRoutes.ts`
- `frontend/src/App.tsx`
- `frontend/src/lib/resources.ts`
- `frontend/src/features/users/UserManagement.constants.ts`
- `frontend/src/features/users/UserManagement.mappers.ts`
- `frontend/src/features/users/UsersListScreen.tsx`
- `frontend/src/features/users/UserCreateScreen.tsx`
- `frontend/src/features/users/UserEditScreen.tsx`
- `frontend/src/features/users/UserFormFields.tsx`
- `frontend/src/features/settings/SettingsScreen.tsx`
- `frontend/src/features/settings/MembershipCatalogSettings.tsx`
- `frontend/src/features/attendance/AttendanceScreen.tsx`

### Bot tests first
- `bot/tests/test_crm_client.py`
- `bot/tests/test_bot_service.py`
- `bot/tests/test_callbacks_and_menu.py`

### Bot production after red phase
- `bot/src/gym_crm_bot/crm/models.py`
- bot rendering/service files only if the new backend-returned role/menu data requires passive presentation changes

No new database migration is expected: the role uses existing string storage and current branch constraint already enforces `BranchId = null` for every non-Administrator. If implementation discovers a real model/schema change, update the repository’s accepted initial database state and model snapshot only after the corresponding clean-schema tests are red and after confirming current migration policy.

## Constraints
- Backend remains the sole source of truth for role capabilities, actor/target matrix, branch/group scope, validation, attendance and audit.
- Do not authorize with frontend role-name checks or Python bot literals.
- Do not grant SuperAdministrator bootstrap, HeadCoach creation/replacement, financial reports, professional membership privilege or other HeadCoach-only behavior.
- Do not make SuperAdministrator an assignable group trainer.
- Do not give Administrator staff management through `ManageSettings`, UI visibility or direct API.
- Do not implement TASK-080 group-grant persistence or Administrator attendance in this task.
- Keep role and branch invariant changes atomic and concurrency-safe.
- Successful sensitive mutations require exact actor/target old/new audit data; failure must not leave unaudited privileged state.
- Preserve existing CSRF, session versioning, password hashing, messenger identity uniqueness and login immutability.
- Stable ProblemDetails must not expose whether a protected HeadCoach/SuperAdministrator target exists to an unauthorized actor beyond the accepted management boundary.
- Use bounded queries and avoid N+1 when resolving global/branch/assigned-group scope.
- Preserve Mantine/Onest and narrow-screen usability.

## Out of scope
- Реализация Administrator attendance grants из TASK-080.
- Несвязанный возврат group-type UI из TASK-081, кроме сохранения совместимости/необходимой permission separation.
- Новый универсальный RBAC/ACL designer, custom roles или runtime permission editor.
- Передача SuperAdministrator финансовых отчётов, bootstrap или professional-client привилегий.
- Назначение SuperAdministrator тренером группы.
- Автоматическое создание/seed SuperAdministrator в runtime.
- Массовое изменение существующих пользователей или production data repair.
- Объединение всех staff screens, полный redesign разделов `Тренеры`/`Настройки` или несвязанный UX refactor.
- Изменение membership, attendance date/write-off и schedule business semantics.
- Уведомления о создании/смене роли.

## Required test coverage

Все новые и обновлённые unit/integration tests пишутся до functional code. Первый focused run обязан упасть по ожидаемой причине.

### Unit tests
- Полная pure actor/action/target matrix для четырёх ролей.
- Capability matrix, включая явные HeadCoach-only отрицательные проверки для SuperAdministrator.
- Role/branch invariant и допустимые destination states.
- Scope kind: global, branch, assigned groups.
- Frontend strict role/session/capability mapping.
- UI form mapping does not invent a role/branch combination absent from backend options.
- Python Pydantic parsing accepts SuperAdministrator and rejects unknown roles according to the existing strict contract.

### Integration tests
- Session role, nullable branch and permission/section contract for all roles.
- Both staff endpoint families use the same matrix; alternate endpoint/overposting cannot bypass it.
- All actor/target create/update/deactivate/assignment pairs and direct API denial.
- Active/missing/archived branch validation and DB invariant.
- Atomic mutation/audit with exact actor, target, old/new role and branch.
- Two-branch clients/groups/memberships/settings/audit access.
- All-group web attendance for SuperAdministrator and unchanged HeadCoach/Coach behavior.
- Administrator attendance denial until TASK-080.
- Internal bot context/menu/client/attendance scope parity.
- Bootstrap remains exactly HeadCoach and seed routines do not create an unintended privileged account.
- Existing role capabilities do not widen as an enum side effect.

### UI/e2e tests
- Role label, navigation and session refresh for SuperAdministrator.
- HeadCoach-only creation/assignment of SuperAdministrator through backend-provided capabilities.
- SuperAdministrator creates/edits Administrator and Coach but cannot act on protected roles.
- Administrator has settings access permitted by backend but no staff-management action/tab/direct API success.
- Active branch selection and backend field errors.
- Two-branch attendance flow.
- Forced direct-request denial without UI controls.
- Desktop and 390 px layout, keyboard labels/focus and no horizontal overflow.

### Existing tests to update
- Strict three-role session fixtures across frontend unit/e2e files.
- `AuthorizationFlowTests`, `UsersApiTests`, `AttendanceApiTests` and `InternalBotApiTests` role assertions.
- Seed summaries/count assumptions only when affected.
- Settings tests overlapping TASK-081 must be preserved, not weakened.
- Bot menu tests that currently expect Administrator attendance must be updated to the accepted TASK-082/TASK-080 boundary.

### Expected initial failure
- Backend unit/integration tests fail because enum, central matrix, session `branchId`, staff policy, SuperAdministrator scope and audit branch state do not exist.
- Existing bypass tests expose that Administrator can currently manage `/settings/administrators`.
- Web/internal bot parity tests expose current Administrator attendance disagreement.
- Frontend tests fail because role union, labels, presentation, capabilities and forms know only three roles.
- Bot tests fail because `BotRole` rejects `SuperAdministrator`.
- A failure caused by invalid fixtures, unrelated baseline regressions, missing PostgreSQL or test setup does not count as the red phase.

### Manual-only validation
- Human security review of the final actor/target table and denial ProblemDetails.
- Russian wording for `Суперадминистратор`, protected-action explanations and branch selector.
- Visual review of long role/name/login combinations and 390 px forms.
- Manual QA supplements but never replaces automated role/scope/audit barriers.

## Test plan
- [ ] Unit and integration tests are written first and fail for the intended missing behavior.
- [ ] `SuperAdministrator = 4` round-trips through EF, auth/session, public API, internal bot and Python DTO.
- [ ] Session returns explicit correct `branchId` for all four roles.
- [ ] Only HeadCoach can create/assign SuperAdministrator.
- [ ] SuperAdministrator cannot create, assign, edit or deactivate HeadCoach/SuperAdministrator, including itself.
- [ ] SuperAdministrator creates Administrator only with an active branch and Coach only without branch.
- [ ] Administrator/Coach cannot manage staff through either endpoint family or overposted payload.
- [ ] HeadCoach-only finance/bootstrap/professional actions remain forbidden to SuperAdministrator.
- [ ] SuperAdministrator operates on branch-owned clients/groups/memberships in two branches.
- [ ] Administrator cannot escape accepted branch scope for branch-owned data.
- [ ] SuperAdministrator lists/reads/saves attendance in two branches.
- [ ] Administrator attendance remains denied until TASK-080; Coach stays assigned-group scoped.
- [ ] Web and internal bot effective access agree.
- [ ] Successful sensitive writes have one atomic audit event with actor/target/old-new role/branch.
- [ ] Denials leave data and success-audit count unchanged.
- [ ] Frontend uses backend permissions/options/allowed actions and recognizes the new role.
- [ ] Python bot remains a thin consumer and recognizes the new role.
- [ ] `dotnet test backend/GymCrm.slnx` passes.
- [ ] `cd frontend && npm run test:unit`, `npm run lint`, `npm run build` pass.
- [ ] Focused Playwright user/settings/attendance flows pass.
- [ ] `cd bot && ruff check .` and `pytest` pass.
- [ ] Clean PostgreSQL/model drift and local runtime smoke pass when affected.

## Regression barrier
Completion is blocked unless one automated four-role matrix proves capability, actor/target action and data scope decisions across session, both staff endpoint families, clients/groups/memberships, attendance and internal bot. The matrix must include two branches, direct bypass requests, self/protected targets, HeadCoach-only negative cases and exact role/branch invariants. A second mandatory barrier must prove sensitive user mutation and its actor/target old/new role/branch audit are atomic. Frontend capability/action tests and Python strict-contract tests must prove consumers recognize the role without becoming permission sources.

## Risks
- **Privilege escalation:** adding SuperAdministrator to broad role lists without target checks could let it create or mutate HeadCoach/another SuperAdministrator.
- **Existing Administrator bypass:** `/settings/administrators` currently uses `ManageSettings`; changing only UI would leave direct API privilege escalation.
- **Scope leakage:** current manager checks are spread across clients, membership, photo, messenger, attendance and bot code. Missing one consumer can make session and actual data access disagree.
- **Bot/web divergence:** internal bot currently treats Administrator more broadly than web attendance. Copying current logic would preserve an unauthorized path.
- **Accidental HeadCoach inheritance:** global scope must not imply finance, professional membership or bootstrap rights.
- **Branch invariant corruption:** role change involving Administrator can leave illegal/null/stale `BranchId` if role and branch are not validated/written atomically.
- **Unaudited privileged state:** current endpoint pattern can save user before audit write. Security-sensitive mutation requires a transaction and rollback test.
- **Consumer outage:** strict frontend/Python role unions can reject the session immediately after backend rollout unless all consumers deploy compatibly.
- **TASK overlap:** TASK-080 and TASK-081 touch the same attendance/settings decisions; parallel branches can silently reintroduce role checks or permissions.
- **Over-broad refactor:** replacing every role check at once can mix unrelated domain changes. Limit changes to security-sensitive capability/scope consumers and document presentation-only checks.

## Stop conditions
Остановиться и не писать production code, если:
- source task не переведён из risky в implementation или task-specific branch не создана от чистого актуального `main`;
- capability/staff matrix выше не прошла explicit security/product review;
- не зафиксировано допустимое HeadCoach действие при изменении существующего SuperAdministrator на другую роль;
- TASK-080/TASK-081 уже изменили затронутые contracts, но merge/rebase strategy не определена;
- невозможно отделить staff management от `ManageSettings` без временного direct API bypass;
- role/branch mutation и обязательный audit нельзя сделать атомарными локально без system-wide audit redesign;
- один backend-owned access scope нельзя применить к web и internal bot без дублирующихся contradictory rules;
- SuperAdministrator требует HeadCoach-only finance/bootstrap/professional полномочий вопреки source task;
- branch scope существующих ролей невозможно определить из текущих contracts/accepted tasks;
- реализация требует uncontrolled production data rewrite, irreversible migration или coordinated rollout без совместимости consumers;
- автоматические tests не могут доказать protected-target denial, two-branch scope и отсутствие мутации после отказа.

Full-stack scope, role/permission domain, shared modules, enum/contract change и high-risk classification сами по себе не являются stop condition.

## Ready for Codex execution
no

Причина: TASK-082 остаётся high-risk (`Safe for Codex: no`) и меняет привилегированную actor/target matrix, branch scope, attendance и все strict role consumers. План готовит локализованную test-first реализацию, но до active implementation требуется явный risky-task review, перевод source task в implementation и подтверждение HeadCoach transition semantics для уже существующего SuperAdministrator.
