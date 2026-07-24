# Implementation Plan: TASK-080 Разрешить администратору отмечать посещения в назначенных группах

## Source task
/backlog/risky/TASK-080-administrator-authorized-group-attendance.md

Source status remains `risky`: задача меняет authorization scope критического attendance write-flow и требует отдельного security/architecture review. План создан без перемещения задачи в active implementation и без изменений project code.

## Git branch
feature/TASK-080-administrator-authorized-group-attendance

Branch rules:
- до реализации получить явное одобрение risky-плана и переместить source task из `/backlog/risky` в `/backlog/implementation`;
- проверить чистый worktree, перейти на `main`, выполнить `git pull --ff-only` и создать `feature/TASK-080-administrator-authorized-group-attendance` от актуального `main`;
- подтвердить активную task branch до первого изменения project code;
- не включать в эту ветку TASK-075, общий RBAC refactoring, изменение attendance date/membership semantics или несвязанный redesign настроек;
- остановиться, если worktree dirty, branch/base неясны либо ветка создана не от `main`.

## Goal
HeadCoach и SuperAdministrator могут выдать Administrator точный набор групп его филиала для attendance. Administrator видит, читает и изменяет посещаемость только этих групп, а отзыв разрешения немедленно закрывает web и bot write-access без изменения прав Coach, HeadCoach и SuperAdministrator.

## Current understanding
- TASK-082 уже завершена и находится в `/backlog/done`: `SuperAdministrator` существует, имеет global operational scope, управляет Administrator/Coach и отмечает attendance во всех группах.
- `UserRoleAuthorizationPolicy` сейчас возвращает `CanMarkAttendance = false` для Administrator; route policy `/attendance` поэтому отклоняет Administrator до resource-scope проверки.
- `AccessScopeService` вычисляет assigned group ids только для Coach. `EvaluateGroupAccessAsync` разрешает все группы HeadCoach/SuperAdministrator, назначенные trainer-группы Coach и всегда запрещает Administrator.
- Session возвращает `permissions` и coach-oriented `assignedGroupIds`, но не возвращает явный attendance scope. Пустой список сейчас нельзя отличить от global scope без знания роли.
- Web `AttendanceEndpoints.ListGroupsAsync` и internal `BotApiService.ListAttendanceGroupsAsync` независимо фильтруют только Coach. Direct roster/save access также проверяется в разных местах.
- `AttendanceService.SaveAsync` владеет своей transaction, но authorization проверяется в endpoint до входа в неё. Для Administrator это создаст TOCTOU: grant может быть отозван после endpoint-check и до commit attendance/audit.
- Settings уже содержит отдельный сценарий `Настройки → Администраторы`; list/update transport использует backend-owned `StaffManagementBoundary`, а SuperAdministrator и HeadCoach получают target `allowedActions`.
- Смена филиала Administrator проходит через `StaffManagementMutationService`. Группа также может сменить филиал через group update. Без явного lifecycle rule обе операции способны оставить скрытый cross-branch grant.
- PostgreSQL schema не содержит отдельной модели Administrator attendance grants. Текущие `GroupTrainer` нельзя переиспользовать: trainer assignment и право Administrator на attendance имеют разные роли, lifecycle и audit semantics.
- Audit хранит actor в `AuditLog.UserId`, время в `AuditLog.CreatedAt`, target/entity и typed old/new JSON. Grant/revoke должны сохраняться атомарно с изменением scope, а denied/no-op операции не должны писать audit.
- Frontend attendance получает список групп только с backend и уже способен показать ограниченный набор. Нужны отдельный management modal, корректный zero-scope state и восстановление после revoke открытой группы.
- Python bot является thin adapter и уже принимает backend menu/groups. Если internal bot response shape не меняется, production Python logic менять не требуется; обязательны contract/regression tests.

## Fixed authorization and lifecycle decisions

### Actor and target matrix

| Actor | Read Administrator attendance scope | Replace scope | Mark attendance |
|---|---:|---:|---:|
| HeadCoach | yes | yes | all groups |
| SuperAdministrator | yes | yes | all groups |
| Administrator | no | no | granted groups only |
| Coach | no | no | trainer-assigned groups only |

- Grant management is authorized by the existing backend staff-management boundary plus an explicit target action/capability. `ManageSettings` and frontend role checks are not sufficient.
- Administrator receives route-level attendance eligibility so `/attendance/groups` can return an empty effective scope. `CanMarkAttendance` is not an authorization substitute for a group grant.
- Direct access to every roster, access probe and save operation re-evaluates the effective backend group scope.
- A grant gives no client/group/settings/staff permission outside the attendance scenario.

### Effective attendance scope contract
- Add an explicit session `attendanceScope`:
  - HeadCoach/SuperAdministrator: `{ kind: "Global", groupIds: [] }`;
  - Coach: `{ kind: "TrainerAssignments", groupIds: [...] }`;
  - Administrator: `{ kind: "AdministratorGrants", groupIds: [...] }`.
- Keep existing `assignedGroupIds` for Coach as a one-release compatibility field; do not repurpose it for Administrator. Frontend moves attendance-specific understanding to `attendanceScope`.
- `CanMarkAttendance` becomes `true` for Administrator after TASK-080 so the empty-scope screen is reachable. All resource operations still require `attendanceScope`.
- Add stable access-probe sources: global policy, `coach-group-assignment`, and `administrator-attendance-grant`.
- Empty Administrator scope returns `200` with an empty group list; direct access to any existing group returns the accepted attendance `403`.

### Grant model
- Add a dedicated `AdministratorAttendanceGroupGrant`, not a synthetic `GroupTrainer`.
- Persist at least `AdministratorId`, `GroupId`, `BranchId`, `GrantedByUserId`, `GrantedAt`.
- Composite primary/unique key `(AdministratorId, GroupId)` is the database duplicate barrier. Add query indexes for `GroupId` and `BranchId`.
- `BranchId` is the immutable branch snapshot of the grant. Effective access requires all of:
  - target user still has role `Administrator`;
  - target is active for authenticated use;
  - `User.BranchId == Grant.BranchId`;
  - `TrainingGroup.BranchId == Grant.BranchId`;
  - the grant row exists.
- Current effective access is fail-closed even if an invalid row appears through an out-of-band database write.
- Update the reproducible initial database state, migration designer(s) and model snapshot. Do not add a new historical migration while the accepted early-stage policy remains “recreate environments from clean schema”; stop if persisted database preservation requirements have changed.

### Grant management API
- Add:
  - `GET /settings/administrators/{administratorId}/attendance-groups`;
  - `PUT /settings/administrators/{administratorId}/attendance-groups`.
- GET returns target summary, branch summary, exact current granted ids and only groups of the target Administrator branch. Each item includes group id/name, schedule metadata, active state, current grant state and backend-owned `canGrant`.
- PUT replaces the complete set with:
  - `expectedGroupIds`: set loaded by the editor;
  - `groupIds`: desired set.
- Both arrays are sets: empty is allowed, duplicate or empty GUID values return `400 ValidationProblem` on `groupIds`/`expectedGroupIds`.
- Compare-and-swap rules under a locked Administrator row:
  1. if current set already equals desired set, return `200` without duplicate audit;
  2. otherwise current set must equal `expectedGroupIds`;
  3. mismatch returns stable concurrency conflict and forces UI reload;
  4. all additions are validated before any write;
  5. grants, revokes and all audit entries commit in one transaction.
- This makes identical retries idempotent, prevents lost updates between two managers and leaves the unique key as the final duplicate barrier.

### Active/inactive resources
- New grants require an active Administrator, an active target group and a non-archived target branch.
- Existing grants remain readable and revocable when the Administrator, branch or group becomes inactive/archived.
- An inactive Administrator cannot authenticate, but its stored grants are not silently deleted and become effective again only after normal reactivation in the same branch.
- A group that becomes inactive after grant keeps its grant and remains available for historical attendance exactly as current Coach/global attendance semantics allow; inactive unassigned groups cannot be newly granted.
- UI must show inactive assigned groups and allow revoke. It must not infer activity rules independently from backend `canGrant`.

### Branch, role and group changes
- Changing an Administrator branch while any grant exists is rejected atomically. The manager must explicitly revoke all grants first.
- Changing an Administrator to another role while any grant exists is rejected by the same barrier.
- Moving a TrainingGroup to another branch while any Administrator grant references it is rejected until all such grants are revoked.
- Use stable `409 attendance_grants_must_be_revoked`; do not silently clear grants during staff/group update. Explicit revoke preserves understandable UX and per-group audit.
- Staff branch/role update, group branch update and grant replacement must use compatible PostgreSQL row-lock ordering so a concurrent operation cannot bypass the precondition.

### Stable denial contract
- Actor cannot manage grant scopes: existing `403 /problems/staff-management-forbidden`, code `staff_management_forbidden`.
- Target is missing or is not Administrator: existing `404 /problems/staff-not-found`, code `staff_not_found`.
- Duplicate/empty/unknown group ids: `400 ValidationProblem`, stable `groupIds` or `expectedGroupIds` field errors, zero writes.
- Requested addition belongs to another branch: `403 /problems/attendance-grant-branch-forbidden`, code `attendance_grant_branch_forbidden`.
- Requested addition has inactive Administrator/group or archived branch: `409 /problems/attendance-grant-inactive-resource`, code `attendance_grant_inactive_resource`.
- Compare-and-swap mismatch: `409 /problems/attendance-grant-concurrency-conflict`, code `attendance_grant_concurrency_conflict`.
- Staff role/branch or group branch mutation conflicts with stored grants: `409 /problems/attendance-grants-must-be-revoked`, code `attendance_grants_must_be_revoked`.
- Existing attendance group is outside the actor effective scope: `403 /problems/attendance-group-forbidden`, code `attendance_group_forbidden`.
- Missing attendance group remains `404`. None of these failures mutate grants, attendance, membership state or audit.

### Audit contract
- Use actions `AdministratorAttendanceGroupGranted` and `AdministratorAttendanceGroupRevoked`.
- Use entity type `AdministratorAttendanceGroupGrant` and stable entity id `{administratorId}:{groupId}`.
- Typed state contains `AdministratorId`, `GroupId`, `BranchId`, `GrantedByUserId`, `GrantedAt`.
- Actor is `AuditLog.UserId`; operation time is `AuditLog.CreatedAt`.
- One batch that adds N and removes M groups writes exactly N grant and M revoke audit rows with one operation timestamp.
- Repeated no-op PUT and every denial write zero audit rows.

### Attendance transaction boundary
- List/roster/access probe use one backend-owned effective attendance scope service shared by web and internal bot.
- `AttendanceService.SaveAsync` becomes the authoritative write boundary:
  - begin its owned transaction before final actor/group authorization;
  - reload and lock the actor/group and, for Administrator, the grant row;
  - return a typed forbidden error before attendance, membership write-off/restore or audit mutation;
  - keep existing attendance, membership and audit writes in the same transaction.
- If save acquires its authorization lock first, save may commit before a waiting revoke; if revoke commits first, the save must fail. A save must never commit after observing an already committed revoke.
- Endpoint checks may remain as early UX checks but cannot be the only write authorization.

## UX contract
- Keep management inside `Настройки → Администраторы`; do not add a new top-level section.
- Add a backend-driven summary on each Administrator card: `Посещения: N групп` or `Посещения: не назначены`.
- Show `Группы посещений` only when target `allowedActions` contains the new attendance-scope action.
- Open a focused `AdministratorAttendanceScopeModal`, separate from the general staff form:
  - target name and branch;
  - selected count;
  - group search;
  - one-column checkbox/card list with name, schedule and active status;
  - staged revoke summary;
  - explicit confirmation before revoke;
  - preserved selection on API error.
- Frontend displays only backend-returned branch groups and never performs its own security filtering.
- Existing inactive grants are visible and revocable; inactive unassigned groups are disabled/omitted according to backend response.
- If a staff edit attempts branch/role change while grants exist, show the backend `attendance_grants_must_be_revoked` guidance and an action to open scope management.
- At 390 px use a full-screen modal, one-column rows with at least 44 px targets and full-width responsive actions; desktop uses a readable single-column modal around 720 px.
- A11y: visible checkbox-group/search labels, accessible group names, polite live selected-count/save status, no hover-only state and non-destructive initial focus in revoke confirmation.
- Administrator zero-scope attendance state:
  - title `Нет групп для отметки посещений`;
  - description `Главный тренер или суперадминистратор назначит группы, после этого они появятся здесь.`
- If an open roster/save receives `attendance_group_forbidden`, clear the selected roster, show `Доступ к группе изменился`, reload `/attendance/groups` and fall back to the zero-scope state when needed.

## Safe decomposition and review gates

### Slice A — Red authorization, grant and schema tests
- Add pure set-diff/authorization unit tests and API/PostgreSQL tests for actor matrix, branch boundary, lifecycle, audit, compare-and-swap and concurrency.
- Review gate: the grant model, explicit-revoke rule and ProblemDetails matrix above are accepted.

### Slice B — Grant persistence and management boundary
- Add entity/configuration/schema, dedicated grant application/service boundary and GET/PUT endpoints.
- Integrate target allowed action and summary without widening `ManageSettings`.
- Review gate: PostgreSQL uniqueness, atomic audit and manager concurrency suites are green.

### Slice C — Effective attendance scope and authoritative save authorization
- Add explicit session attendance scope, centralize web/internal-bot filtering and put final authorization inside `AttendanceService` transaction.
- Review gate: two-branch direct API, revoke/save ordering and HeadCoach/SuperAdministrator/Coach regressions are green.

### Slice D — Frontend management and runtime revoke UX
- Add API contracts, focused modal/summary and attendance recovery behavior. Keep `SettingsScreen.tsx` from growing further by extracting focused components.
- Review gate: component tests and desktop/390 px Playwright scenarios are green.

### Slice E — Bot and cross-layer regression
- Keep Python as a thin renderer. Change production Python only if the accepted internal contract actually requires it.
- Verify Administrator menu, empty scope, granted scope, revoke and direct bypass through backend internal-bot tests plus Python contract/UI tests.
- Review gate: all required backend/frontend/bot validation and clean PostgreSQL stand smoke are green.

These slices are phases of one security-sensitive contract and should remain in the single TASK-080 branch. If product ownership later splits them into separate backlog tasks, each task needs its own branch and an explicit compatibility/deployment order.

## Execution steps
1. Obtain explicit risky-task approval, move TASK-080 into implementation, verify clean current `main`, pull with fast-forward only and create `feature/TASK-080-administrator-authorized-group-attendance`.
2. Reread root/backend/frontend/bot `AGENTS.md`, source task, this plan and completed TASK-082 contract. Confirm TASK-082 remains present on the branch.
3. Before production code, review and freeze:
   - actor/target matrix;
   - explicit `attendanceScope` session contract;
   - full-replacement compare-and-swap request;
   - inactive group/history behavior;
   - explicit revoke before Administrator/group branch or role changes;
   - exact ProblemDetails and audit action names.
4. **Before production code**, add unit tests for:
   - Administrator route eligibility without treating `CanMarkAttendance` as group authorization;
   - scope kinds for all four roles;
   - deterministic set equality/diff, duplicate detection and no-op behavior;
   - target action matrix: only HeadCoach/SuperAdministrator can manage Administrator attendance scope.
5. Run the new unit tests and record the expected red caused by missing TASK-080 policy/scope/diff behavior.
6. **Before production code**, add backend integration tests for GET/PUT grant management:
   - HeadCoach and SuperAdministrator success;
   - Administrator/Coach direct denial;
   - CSRF;
   - only target-branch groups returned;
   - multi-grant, full revoke and idempotent retry;
   - duplicate, empty GUID, unknown, foreign-branch and inactive additions;
   - inactive target/branch/group read and revoke behavior;
   - exact grant/revoke audit actor/target/group/branch/time;
   - no audit or partial rows on denial.
7. **Before production code**, add real-PostgreSQL tests for schema, unique `(AdministratorId, GroupId)`, compare-and-swap, concurrent identical grants, divergent manager updates, grant/revoke races and atomic rollback when audit/save fails.
8. Run focused grant/schema tests and record expected red. Missing Docker/PostgreSQL, broken fixtures or an unrelated baseline regression do not satisfy red.
9. **Before production code**, extend authorization/attendance tests:
   - session scope for every role and empty/multiple Administrator grants;
   - Administrator list/read/save only for granted same-branch groups;
   - direct same-branch ungranted and foreign-branch `attendance_group_forbidden`;
   - revoke reflected by list/roster/access probe immediately;
   - save-versus-revoke ordering proves no post-revoke commit;
   - denied save leaves attendance, membership version/write-off and audit unchanged;
   - HeadCoach/SuperAdministrator global and Coach trainer-assigned behavior unchanged.
10. **Before production code**, add staff/group mutation tests proving branch/role/group move conflicts until grants are explicitly revoked, including concurrent PostgreSQL cases.
11. **Before production code**, extend internal bot integration tests for Administrator menu, zero scope, granted list/roster/save, ungranted denial and revoke. Add Python tests for backend-driven menu/empty behavior only where existing generic rendering is insufficient.
12. Run the new backend/bot tests and record expected red.
13. **Before frontend production code**, add frontend API/component/Playwright tests:
   - map explicit `attendanceScope`, management items, summaries, allowed action and stable errors;
   - modal loading/empty/error/search/multiple select/no-op/concurrency reload;
   - revoke confirmation and preserved state on failure;
   - inactive target/group and branch-change conflict guidance;
   - Administrator zero-scope copy;
   - revoked roster/save clears context and reloads groups;
   - desktop assignment/revoke and 390 px full-screen modal;
   - Administrator sees only backend-returned groups in attendance.
14. Run focused frontend tests and Playwright specs and record expected red.
15. Review all red evidence. Stop if the write flow cannot re-authorize inside the existing transaction or if staff/group mutations cannot share a safe lock order.
16. Implement the minimal grant domain/persistence model, relationships, DbSet and configuration with composite uniqueness and restrictive foreign keys.
17. Update `InitialCreate`, applicable designer(s) and model snapshot under the current clean-schema policy; add schema/model smoke assertions and recreate a clean PostgreSQL database.
18. Implement focused grant contracts, set-diff/compare-and-swap service, audit serializer/constants and stable problems. Lock the target Administrator, validate the complete desired set, stage grants/revokes/audits and commit once.
19. Expose GET/PUT under the existing Administrator settings resource. Reuse staff management authorization and add backend-owned target `ManageAttendanceScope` action/count.
20. Add the stored-grant barriers to staff branch/role update and group branch update. Use the documented lock order and return `attendance_grants_must_be_revoked` before user/group/audit writes.
21. Introduce explicit effective attendance scope in Application/Infrastructure:
   - global ids are not enumerated;
   - Coach ids come only from trainer assignments;
   - Administrator ids come only from valid matching grants;
   - list/direct decisions use the same representation.
22. Expand the route-level attendance policy to Administrator and project `attendanceScope` through session/profile. Keep compatibility `assignedGroupIds` Coach-only for this release.
23. Refactor web attendance list/roster/access probe to consume the effective scope. Filter attendance roster group summaries by that same scope for Administrator/Coach.
24. Move final write authorization into `AttendanceService.SaveAsync` under its owned transaction; add typed forbidden mapping to stable web ProblemDetails and internal bot error without changing date/membership semantics.
25. Refactor internal `BotApiService` menu/list/roster/save to consume the same effective attendance scope. Do not add Python-side branch/group rules.
26. Implement extracted frontend management components and API contracts. Keep the existing Administrator settings flow, use backend action/canGrant data and implement revoke confirmation/concurrency reload.
27. Implement Administrator zero-scope and runtime revoke recovery in `AttendanceScreen`; do not cache or infer grant authority on frontend.
28. Run targeted green suites after every slice, then:
   - `dotnet test backend/GymCrm.slnx`;
   - `cd frontend && npm run test:unit`;
   - `cd frontend && npm run lint`;
   - `cd frontend && npm run build`;
   - focused Playwright settings/attendance scenarios at desktop and 390 px;
   - `cd bot && ruff check .`;
   - `cd bot && pytest`.
29. Recreate the local PostgreSQL/stand from empty volumes; verify migrations/model drift, seed, health and a two-branch smoke: grant, session refresh, web save, bot save, revoke, denied replay, explicit revoke then branch move.
30. Perform a final security/source audit:
   - no Administrator attendance decision depends only on UI visibility or `CanMarkAttendance`;
   - no role-specific grant query is duplicated between web and bot;
   - every save re-authorizes inside transaction;
   - no cross-branch/stale grant can become effective;
   - no denied/no-op request writes grant, attendance, membership or audit;
   - TASK-075 and unrelated role/membership semantics are absent from the diff.

## Preferred implementation strategy
1. Contract and security matrix first.
2. Unit, integration, PostgreSQL, frontend and bot tests before functional code, with recorded expected failures.
3. Dedicated grant model plus one effective attendance scope service; never overload trainer assignment.
4. Compare-and-swap full replacement for usable multi-select UX without lost manager updates.
5. Authoritative authorization at the transaction-owning attendance service, with endpoint checks only as early feedback.
6. Explicit revoke before branch/role movement; no silent privilege cleanup.
7. Small reviewable commits: red contracts, schema/grant boundary, lifecycle locks, effective attendance/save boundary, frontend, bot/cross-layer regression.

## Files likely to change

### Backend tests first
- `backend/tests/GymCrm.Tests/AdministratorAttendanceGrantApiTests.cs` (new)
- `backend/tests/GymCrm.Tests/AdministratorAttendanceGrantPostgreSqlTests.cs` (new)
- `backend/tests/GymCrm.Tests/UserRoleAuthorizationPolicyTests.cs`
- `backend/tests/GymCrm.Tests/AuthorizationFlowTests.cs`
- `backend/tests/GymCrm.Tests/AttendanceApiTests.cs`
- `backend/tests/GymCrm.Tests/InternalBotApiTests.cs`
- `backend/tests/GymCrm.Tests/UsersApiTests.cs`
- `backend/tests/GymCrm.Tests/GroupsApiTests.cs`
- `backend/tests/GymCrm.Tests/BootstrapSmokeTests.cs`

### Backend production after red phase
- `backend/src/GymCrm.Domain/Groups/AdministratorAttendanceGroupGrant.cs` (new; exact namespace/name may vary)
- `backend/src/GymCrm.Domain/Users/User.cs`
- `backend/src/GymCrm.Domain/Groups/TrainingGroup.cs`
- `backend/src/GymCrm.Application/Authorization/AttendanceScope.cs` (new)
- `backend/src/GymCrm.Application/Authorization/AttendanceScopeKind.cs` (new)
- `backend/src/GymCrm.Application/Authorization/IAccessScopeService.cs`
- `backend/src/GymCrm.Application/Authorization/AccessScope.cs`
- `backend/src/GymCrm.Application/Authorization/PermissionSet.cs`
- `backend/src/GymCrm.Application/Authorization/UserRoleAuthorizationPolicy.cs`
- `backend/src/GymCrm.Application/Attendance/IAttendanceService.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/GymCrmDbContext.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/AdministratorAttendanceGroupGrantConfiguration.cs` (new)
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.Designer.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260721210111_FixClientMembershipVersionConstraints.Designer.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/GymCrmDbContextModelSnapshot.cs`
- `backend/src/GymCrm.Infrastructure/Authorization/AccessScopeService.cs`
- `backend/src/GymCrm.Infrastructure/Attendance/AttendanceService.cs`
- `backend/src/GymCrm.Infrastructure/Bot/BotApiService.cs`
- `backend/src/GymCrm.Api/Auth/AdministratorAttendanceGroupEndpoints.cs` (new)
- focused request/response, audit state/constants and ProblemDetails files beside that endpoint
- `backend/src/GymCrm.Api/Auth/AdministratorEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/UserEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/UserResponse.cs`
- `backend/src/GymCrm.Api/Auth/StaffManagementBoundary.cs`
- `backend/src/GymCrm.Api/Auth/StaffManagementMutationService.cs`
- `backend/src/GymCrm.Api/Auth/GroupEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/GymCrmAuthorizationPolicies.cs`
- `backend/src/GymCrm.Api/Auth/AuthEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/AccessEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/AttendanceEndpoints.cs`
- `backend/src/GymCrm.Api/Program.cs`

### Frontend tests first
- `frontend/src/lib/api/auth.test.ts`
- `frontend/src/lib/api/administrators.test.ts` (new if absent)
- `frontend/src/features/settings/SettingsScreen.test.tsx`
- `frontend/src/features/settings/AdministratorAttendanceScopeModal.test.tsx` (new)
- `frontend/src/features/attendance/AttendanceScreen.test.tsx`
- `frontend/e2e/settings-administrator-attendance-scope.spec.ts` (new)
- `frontend/e2e/attendance.spec.ts`

### Frontend production after red phase
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/auth.ts`
- `frontend/src/lib/api/administrators.ts`
- `frontend/src/lib/api/endpoints.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/features/settings/SettingsScreen.tsx`
- `frontend/src/features/settings/AdministratorAttendanceScopeModal.tsx` (new)
- `frontend/src/features/settings/AdministratorAttendanceScopeSummary.tsx` (new)
- `frontend/src/features/attendance/AttendanceScreen.tsx`
- `frontend/src/lib/resources.ts`
- focused styles only if existing modal/list utilities are insufficient

### Bot
- `backend/tests/GymCrm.Tests/InternalBotApiTests.cs`
- `bot/tests/test_bot_service.py`
- `bot/tests/test_crm_client.py`
- `bot/src/gym_crm_bot/*` only if an accepted internal-bot contract change cannot be consumed by existing generic menu/attendance code

## Constraints
- Backend remains the only source of truth for role, branch, group, attendance and audit decisions.
- Every direct web/internal-bot read and write must enforce current scope; frontend visibility is only presentation.
- No grant may widen normal client/group/staff/settings scope.
- Grant change and its audit are atomic.
- Attendance save and its final authorization, membership side effects and audit are atomic.
- Preserve CSRF, service-token, request-id and bot idempotency behavior.
- Preserve existing Coach trainer scope and HeadCoach/SuperAdministrator global scope.
- Preserve current attendance date, client membership, single-visit and TASK-075 semantics.
- Do not grow already large endpoint/UI files with unrelated helpers; introduce focused types/services/components.

## Out of scope
- All-branch or whole-branch attendance access for Administrator.
- Automatic grants from group management, trainer assignment or staff role.
- Silent grant deletion during branch/role/group changes.
- TASK-075 `Held`/`NotHeld`.
- Attendance date policy, membership eligibility/write-off redesign or financial attribution.
- General RBAC redesign, group ownership redesign or merging Coach/Administrator scopes.
- Production data backfill while the accepted clean-schema policy remains active.

## Required test coverage

### Unit tests
- Exhaustive role/capability/target-action matrix.
- Attendance scope kind and fail-closed decisions.
- Set normalization, comparison, delta, no-op and concurrency precondition behavior.
- Stable ProblemDetails mapping where implemented as pure helpers.

### Integration tests
- GET/PUT management contract, CSRF, actor/target matrix and two-branch validation.
- Session/profile scope projection and direct access probe.
- Web list/roster/save and internal bot list/roster/save use identical effective group ids.
- Staff/group lifecycle conflict and explicit revoke path.
- Exact atomic audit cardinality and typed state.
- Attendance denial causes zero attendance/membership/audit mutation.

### PostgreSQL tests
- Clean schema and model snapshot contain the grant table, keys, indexes and restrictive relationships.
- Duplicate grant cannot persist.
- Compare-and-swap prevents lost updates.
- Concurrent identical requests are idempotent.
- Save/revoke and grant/branch-move ordering is serializable and fail-closed.
- Audit/save failure rolls back the complete grant or attendance operation.

### UI tests
- Backend-driven Administrator scope summary/action.
- Modal loading, empty, multiple assignment, inactive state, revoke confirmation, field/global errors and concurrency reload.
- 390 px focus/scroll/action usability.
- Administrator empty attendance scope.
- Runtime revoke clears selected context and reloads backend scope.

### Bot tests
- Backend Administrator menu and exact group scope.
- Empty scope, multi-grant, ungranted direct request, revoke and save denial.
- Python remains a thin renderer and does not infer branch/group access.

### Expected red phase
- Backend unit/integration/PostgreSQL tests fail because no grant entity, API, explicit scope, policy, lifecycle barrier or in-transaction authorization exists.
- Frontend tests fail because no scope contract/modal/summary/revoke recovery exists.
- Bot integration tests fail because Administrator lacks attendance menu/capability and backend filtering.
- Infrastructure failures, wrong test seed, unavailable Docker/PostgreSQL or unrelated baseline regressions are not accepted as red evidence.

## Test plan
- [ ] Unit policy/scope/set-diff tests are written first and fail for expected TASK-080 gaps.
- [ ] Grant API and real-PostgreSQL concurrency/audit tests are written first and fail for expected gaps.
- [ ] Attendance/session/access/web/internal-bot integration tests are written first and fail for expected gaps.
- [ ] Frontend API/component/Playwright tests are written first and fail for expected gaps.
- [ ] All focused tests pass after minimal implementation.
- [ ] `dotnet test backend/GymCrm.slnx` passes.
- [ ] Frontend unit tests, lint, build and focused Playwright pass.
- [ ] Bot ruff and pytest pass.
- [ ] Clean PostgreSQL schema/model/seed and two-branch local stand smoke pass.
- [ ] Final source audit finds no frontend-only or pre-transaction-only Administrator attendance authorization.

## Regression barrier
Completion is blocked unless a real-PostgreSQL concurrency test proves that an Administrator attendance save cannot commit after an already committed revoke, while the same suite proves compare-and-swap scope updates cannot lose a concurrent manager change. This is paired with a two-branch automated matrix showing identical effective group ids in session, web list/roster/save, access probe and internal bot, exact atomic grant/revoke audit, and non-regression for HeadCoach, SuperAdministrator and Coach.

## Risks
- **Privilege escalation:** enabling route-level attendance for Administrator without resource checks would expose every group.
- **TOCTOU after revoke:** endpoint-only checks permit a stale authorized save; final authorization must live inside the transaction-owning service.
- **Lost manager updates:** a naïve full replacement can overwrite a concurrent grant/revoke; compare-and-swap and locking are mandatory.
- **Cross-branch resurrection:** stale grants can become active after branch changes unless lifecycle mutations are blocked and effective joins are fail-closed.
- **Duplicate scope rules:** independent web/bot/session filters will drift; one effective scope service is required.
- **Audit inconsistency:** using post-commit `IAuditLogService` without the grant transaction can leave grant-without-audit or audit-without-grant.
- **Schema policy drift:** editing initial state is safe only while environments are explicitly recreatable; persisted database requirements require a revised migration plan.
- **UI stale state:** revoke or branch change while attendance is open must clear the roster instead of leaving only a failed row.
- **Inactive semantics:** existing inactive group behavior must remain consistent with current attendance history rules; do not silently broaden or remove it.

## Stop conditions
Stop and do not write production code if:
- explicit risky/security review has not approved this plan;
- TASK-082 role/staff boundary is absent or materially different on the execution branch;
- `AttendanceService` cannot perform final authorization inside its atomic transaction;
- a safe shared lock order for grant, staff and group mutations cannot be established;
- the accepted ProblemDetails, inactive-resource or explicit-revoke rules are disputed;
- runtime databases must preserve data and the clean-schema plan is no longer valid;
- implementation requires a system-wide RBAC or attendance/membership redesign;
- scope expands into TASK-075 or unrelated project refactoring.

Backend + frontend work, shared settings/attendance modules, permissions, schema and bot consumers are not by themselves stop conditions.

## Ready for Codex execution
no — detailed planning and decomposition are complete, but high-risk authorization execution requires explicit human security/architecture approval and movement from `/backlog/risky` to `/backlog/implementation`.
