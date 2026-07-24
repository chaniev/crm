# Implementation Plan: TASK-080 Разрешить администратору отмечать посещения в назначенных группах

## Source task
/backlog/risky/TASK-080-administrator-authorized-group-attendance.md

Source status remains `risky`: задача меняет authorization scope критического attendance write-flow и требует отдельного security/architecture review. План создан без перемещения задачи в active implementation и без изменений project code.

## Accepted review resolutions
Accepted by the product owner on 2026-07-25:
- TrainingGroup cannot move to another branch; TASK-080 preserves the existing immutable group branch.
- Archived branch retains stored grants but makes them ineffective until the same branch is restored.
- PostgreSQL mutations use the canonical lock order fixed below; locked attendance authorization precedes client reads/validation.
- One backend date-policy applies to web and internal bot: HeadCoach/SuperAdministrator/Administrator may use any non-future date, Coach may use today and the previous two calendar days.
- Management items expose backend-owned `canGrant`, `canRevoke` and `disabledReason`; PUT uses the deterministic validation/CAS order fixed below.
- All runtime databases may be recreated, so updating the reproducible initial schema without a forward data-preserving migration is accepted.
- The modal requires `ui-designer` review before implementation and after rendering, including mandatory 320×568 and 390×844 mobile-touch validation.

These resolutions close the plan-review questions but do not by themselves replace the separate risky security/architecture approval or move the source task into implementation.

## Git branch
feature/TASK-080-administrator-authorized-group-attendance

Branch rules:
- до реализации получить явное одобрение risky-плана и переместить source task из `/backlog/risky` в `/backlog/implementation`;
- проверить чистый worktree, перейти на `main`, выполнить `git pull --ff-only` и создать `feature/TASK-080-administrator-authorized-group-attendance` от актуального `main`;
- подтвердить активную task branch до первого изменения project code;
- не включать в эту ветку TASK-075, общий RBAC refactoring, attendance date/membership redesign сверх зафиксированного ниже общего date-policy или несвязанный redesign настроек;
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
- Смена филиала Administrator проходит через `StaffManagementMutationService`. Филиал существующей TrainingGroup уже неизменяем по текущему group contract; TASK-080 сохраняет эту инварианту и не вводит перенос групп между филиалами.
- PostgreSQL schema не содержит отдельной модели Administrator attendance grants. Текущие `GroupTrainer` нельзя переиспользовать: trainer assignment и право Administrator на attendance имеют разные роли, lifecycle и audit semantics.
- Audit хранит actor в `AuditLog.UserId`, время в `AuditLog.CreatedAt`, target/entity и typed old/new JSON. Grant/revoke должны сохраняться атомарно с изменением scope, а denied/no-op операции не должны писать audit.
- Web и internal bot сейчас не используют полностью единое role-aware правило дат: общий attendance write запрещает future date, а bot дополнительно ограничивает Coach текущим и двумя предыдущими календарными днями. TASK-080 фиксирует один backend-owned date-policy для roster/save обоих transport.
- Frontend attendance получает список групп только с backend и уже способен показать ограниченный набор. Нужны отдельный management modal, корректный zero-scope state и восстановление после revoke открытой группы.
- Python bot является thin adapter, но сейчас сам строит role-based date keyboard от UTC date. TASK-080 должен передать authoritative business `today`/date window через internal bot menu/context contract и заменить Python-side role/timezone calculation простым rendering backend limits.

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
  - target branch exists and is not archived;
  - `User.BranchId == Grant.BranchId`;
  - `TrainingGroup.BranchId == Grant.BranchId`;
  - the grant row exists.
- Current effective access is fail-closed even if an invalid row appears through an out-of-band database write.
- Update the reproducible initial database state, migration designer(s) and model snapshot. Do not add a new historical migration while the accepted early-stage policy remains “recreate environments from clean schema”; stop if persisted database preservation requirements have changed.

### Grant management API
- Add:
  - `GET /settings/administrators/{administratorId}/attendance-groups`;
  - `PUT /settings/administrators/{administratorId}/attendance-groups`.
- GET returns target summary, branch summary, exact current granted ids and only assignable group options of the target Administrator branch.
- The Administrator summary count is the number of stored grants, including grants retained for inactive resources or an archived branch; it is not the current effective-scope count.
- Each normal group item includes group id/name, schedule metadata, active state, current grant state and backend-owned `canGrant`, `canRevoke` and nullable stable `disabledReason`.
- Existing inactive granted groups return `canGrant = false`, `canRevoke = true`; inactive unassigned groups return `canGrant = false`, `canRevoke = false`.
- If an invalid cross-branch/stale grant exists only because of an out-of-band database write, GET exposes it separately as an unavailable stored grant without foreign group details, with `canGrant = false`, `canRevoke = true` and `disabledReason = "grant_scope_invalid"`. This permits explicit audited cleanup without making the row effective or exposing foreign-branch data.
- PUT replaces the complete set with:
  - `expectedGroupIds`: set loaded by the editor;
  - `groupIds`: desired set.
- Both arrays are sets: empty is allowed, duplicate or empty GUID values return `400 ValidationProblem` on `groupIds`/`expectedGroupIds`.
- After CSRF, actor authorization and target resolution, PUT applies this deterministic validation/CAS order:
  1. reject malformed arrays, duplicate ids and empty GUID values;
  2. begin the transaction, acquire the canonical locks and load the exact current stored set;
  3. validate existence of every id in `groupIds` and `expectedGroupIds`; unknown ids return field `400` even for an otherwise no-op request;
  4. if current set already equals desired set, return `200` without duplicate audit even when `expectedGroupIds` is stale;
  5. otherwise current set must equal `expectedGroupIds`;
  6. mismatch returns stable concurrency conflict and forces UI reload;
  7. validate branch/activity only for additions; retaining or removing an existing inactive/archived grant remains allowed;
  8. stage all grants, revokes and audit entries and commit them once.
- This makes identical retries idempotent, prevents lost updates between two managers and leaves the unique key as the final duplicate barrier.

### Active/inactive resources
- New grants require an active Administrator, an active target group and a non-archived target branch.
- Existing grants remain readable and revocable when the Administrator, branch or group becomes inactive/archived.
- An inactive Administrator cannot authenticate, but its stored grants are not silently deleted and become effective again only after normal reactivation in the same branch.
- Archiving the target branch immediately makes all of its stored Administrator grants ineffective without deleting them. Restoring the same branch makes otherwise valid grants effective again.
- A group that becomes inactive after grant keeps its grant and remains available for historical attendance exactly as current Coach/global attendance semantics allow; inactive unassigned groups cannot be newly granted.
- UI must show inactive assigned groups and unavailable stale grants and allow revoke according to backend `canRevoke`. It must not infer activity rules independently from `canGrant`, `canRevoke` or `disabledReason`.

### Branch, role and lock lifecycle
- Changing an Administrator branch while any grant exists is rejected atomically. The manager must explicitly revoke all grants first.
- Changing an Administrator to another role while any grant exists is rejected by the same barrier.
- TrainingGroup branch remains immutable under the existing group contract. TASK-080 adds no group-move endpoint, validation exception or grant-specific group-move behavior.
- Use stable `409 attendance_grants_must_be_revoked`; do not silently clear grants during staff update. Explicit revoke preserves understandable UX and per-group audit.
- Canonical PostgreSQL lock order is: involved `Branch` rows ordered by id, then the actor/target `User` row, then involved `TrainingGroup` rows ordered by id, then `AdministratorAttendanceGroupGrant` rows ordered by `(AdministratorId, GroupId)`.
- If an initial unlocked lookup is needed to discover ids, every role, active-state, branch and relationship predicate is reloaded and revalidated after the canonical locks are held.
- Administrator branch change locks current and destination branches in id order before the target User row. Grant replacement locks the target branch, target Administrator, affected groups and grant rows in canonical order.
- Administrator attendance save locks the group branch, actor User, group and grant in canonical order before final authorization. Branch archive/update obtains the branch row lock before changing archive state.
- If save locks first, revoke/archive may wait and save may commit before them. If revoke/archive commits first, the waiting save reloads the committed state and fails. No save may commit after observing a committed revoke or archived branch.

### Stable denial contract
- Actor cannot manage grant scopes: existing `403 /problems/staff-management-forbidden`, code `staff_management_forbidden`.
- Target is missing or is not Administrator: existing `404 /problems/staff-not-found`, code `staff_not_found`.
- Duplicate/empty/unknown group ids: `400 ValidationProblem`, stable `groupIds` or `expectedGroupIds` field errors, zero writes.
- Requested addition belongs to another branch: `403 /problems/attendance-grant-branch-forbidden`, code `attendance_grant_branch_forbidden`.
- Requested addition has inactive Administrator/group or archived branch: `409 /problems/attendance-grant-inactive-resource`, code `attendance_grant_inactive_resource`.
- Compare-and-swap mismatch: `409 /problems/attendance-grant-concurrency-conflict`, code `attendance_grant_concurrency_conflict`.
- Staff role/branch mutation conflicts with stored grants: `409 /problems/attendance-grants-must-be-revoked`, code `attendance_grants_must_be_revoked`.
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
  - perform only request-shape parsing and the shared date-policy check before its owned transaction;
  - begin its owned transaction before group/client persistence reads and final actor/group authorization;
  - reload and lock the actor/group and, for Administrator, the grant row;
  - perform final locked authorization before loading/validating group clients, so a revoked or archived scope cannot leak client validation results;
  - return a typed forbidden error before client validation, attendance, membership write-off/restore or audit mutation;
  - keep existing attendance, membership and audit writes in the same transaction.
- If save acquires its authorization lock first, save may commit before a waiting revoke; if revoke commits first, the save must fail. A save must never commit after observing an already committed revoke.
- Endpoint checks may remain as early UX checks but cannot be the only write authorization.

### Unified attendance date policy
- Add one backend-owned attendance date policy consumed by web endpoints, internal bot and the authoritative attendance service.
- `IBusinessDateProvider.Today` in the configured business timezone is the only source of `today`.
- HeadCoach, SuperAdministrator and Administrator may read/save attendance for any `trainingDate <= today`; there is no lower bound.
- Coach may read/save attendance only for `today - 2 calendar days <= trainingDate <= today`.
- Future dates are rejected for every role. Coach dates older than the lower bound are rejected by the same stable `trainingDate` validation contract in web and internal bot.
- Attendance group/roster/save responses expose authoritative nullable `minTrainingDate` and `maxTrainingDate`: `minTrainingDate = null` for HeadCoach/SuperAdministrator/Administrator, `today - 2 calendar days` for Coach, and `maxTrainingDate = today` for every role.
- Internal bot menu/context exposes the same `today`, nullable `minTrainingDate` and `maxTrainingDate` before Python renders the attendance date keyboard.
- Frontend and Python bot render the backend limits and do not recalculate role or timezone rules.

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
- Existing inactive and unavailable stale grants are visible and revocable according to backend `canRevoke`; inactive unassigned groups remain visible but disabled with the backend reason.
- If a staff edit attempts branch/role change while grants exist, show the backend `attendance_grants_must_be_revoked` guidance and an action to open scope management.
- Before frontend production code, a `ui-designer` must review the modal states, action hierarchy, revoke confirmation and responsive behavior. After implementation, a second visual review must verify the rendered result.
- At 320×568 and 390×844 mobile viewports use a full-screen modal, one-column rows with at least 44 px targets, usable touch scrolling and full-width responsive actions; desktop uses a readable single-column modal around 720 px.
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
- Add explicit session attendance scope, centralize web/internal-bot filtering, implement the unified date-policy and put final authorization inside `AttendanceService` transaction.
- Review gate: two-branch direct API, revoke/archive versus save ordering, cross-transport date windows and HeadCoach/SuperAdministrator/Coach regressions are green.

### Slice D — Frontend management and runtime revoke UX
- Obtain the required pre-implementation `ui-designer` review, then add API contracts, focused modal/summary and attendance recovery behavior. Keep `SettingsScreen.tsx` from growing further by extracting focused components.
- Review gate: component tests, desktop plus 320×568/390×844 mobile-touch Playwright scenarios and the post-implementation `ui-designer` visual review are green.

### Slice E — Bot and cross-layer regression
- Keep Python as a thin renderer. Replace its current role/UTC date calculation with rendering of the accepted backend menu/context date window.
- Verify Administrator menu, backend-driven date keyboard, empty scope, granted scope, revoke and direct bypass through backend internal-bot tests plus Python contract/UI tests.
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
   - archived-branch suspension/restoration behavior;
   - explicit revoke before Administrator branch or role changes;
   - unchanged TrainingGroup branch immutability;
   - unified role-aware attendance date-policy;
   - canonical PostgreSQL lock order;
   - exact ProblemDetails and audit action names.
4. **Before production code**, add unit tests for:
   - Administrator route eligibility without treating `CanMarkAttendance` as group authorization;
   - scope kinds for all four roles;
   - deterministic set equality/diff, duplicate detection and no-op behavior;
   - target action matrix: only HeadCoach/SuperAdministrator can manage Administrator attendance scope;
   - date windows: unrestricted past for HeadCoach/SuperAdministrator/Administrator, two calendar days back for Coach, future denied for all.
5. Run the new unit tests and record the expected red caused by missing TASK-080 policy/scope/diff behavior.
6. **Before production code**, add backend integration tests for GET/PUT grant management:
   - HeadCoach and SuperAdministrator success;
   - Administrator/Coach direct denial;
   - CSRF;
   - only target-branch groups returned;
   - stored-grant summary count, `canGrant`, `canRevoke`, stable `disabledReason` and safe unavailable-stale-grant cleanup;
   - multi-grant, full revoke and idempotent retry;
   - duplicate, empty GUID, unknown, foreign-branch and inactive additions;
   - exact validation/no-op/CAS/addition-error precedence;
   - inactive target/branch/group read and revoke behavior;
   - exact grant/revoke audit actor/target/group/branch/time;
   - no audit or partial rows on denial.
7. **Before production code**, add real-PostgreSQL tests for schema, unique `(AdministratorId, GroupId)`, compare-and-swap, concurrent identical grants, divergent manager updates, canonical lock ordering, grant/revoke races, branch archive/save ordering and atomic rollback when audit/save fails.
8. Run focused grant/schema tests and record expected red. Missing Docker/PostgreSQL, broken fixtures or an unrelated baseline regression do not satisfy red.
9. **Before production code**, extend authorization/attendance tests:
   - session scope for every role and empty/multiple Administrator grants;
   - Administrator list/read/save only for granted same-branch groups;
   - direct same-branch ungranted and foreign-branch `attendance_group_forbidden`;
   - revoke reflected by list/roster/access probe immediately;
   - save-versus-revoke ordering proves no post-revoke commit;
   - archived branch removes grants from effective scope, blocks direct/save access and restores otherwise-valid scope after unarchive;
   - web and internal bot enforce the same accepted date window for every role;
   - denied save leaves attendance, membership version/write-off and audit unchanged;
   - HeadCoach/SuperAdministrator global and Coach trainer-assigned behavior unchanged.
10. **Before production code**, add staff mutation tests proving Administrator branch/role changes conflict until grants are explicitly revoked, plus concurrent PostgreSQL tests for staff/grant locks and branch archive/save locks. Preserve the existing TrainingGroup branch-immutable tests without adding a group-move scenario.
11. **Before production code**, extend internal bot integration tests for Administrator menu/context date window, zero scope, granted list/roster/save, ungranted denial, revoke and accepted Administrator/Coach date windows. Add mandatory Python contract/UI tests proving the date keyboard uses backend business dates/limits and no role/timezone authorization rule remains in Python.
12. Run the new backend/bot tests and record expected red.
13. **Before frontend production code**, add frontend API/component/Playwright tests:
   - map explicit `attendanceScope`, management items, summaries, allowed action and stable errors;
   - modal loading/empty/error/search/multiple select/no-op/concurrency reload;
   - `canGrant`/`canRevoke`/`disabledReason`, unavailable stale grant cleanup, revoke confirmation and preserved state on failure;
   - inactive target/group and branch-change conflict guidance;
   - Administrator zero-scope copy;
   - revoked roster/save clears context and reloads groups;
   - backend-provided nullable min/max attendance dates without frontend role inference;
   - desktop assignment/revoke and full-screen mobile modal at 320×568 and 390×844 with touch/scroll/action checks;
   - Administrator sees only backend-returned groups in attendance.
14. Run focused frontend tests and Playwright specs and record expected red.
15. Review all red evidence. Stop if the write flow cannot re-authorize before client validation inside the existing transaction or if grant/staff/branch-archive mutations cannot follow the canonical lock order.
16. Implement the minimal grant domain/persistence model, relationships, DbSet and configuration with composite uniqueness and restrictive foreign keys.
17. Update `InitialCreate`, applicable designer(s) and model snapshot under the current clean-schema policy; add schema/model smoke assertions and recreate a clean PostgreSQL database.
18. Implement focused grant contracts, deterministic validation/set-diff/compare-and-swap service, audit serializer/constants and stable problems. Use the canonical locks, validate in the accepted order, stage grants/revokes/audits and commit once.
19. Expose GET/PUT under the existing Administrator settings resource. Reuse staff management authorization and add backend-owned target `ManageAttendanceScope`, stored-grant count, `canGrant`, `canRevoke`, `disabledReason` and safe unavailable-grant cleanup data.
20. Add the stored-grant barriers to Administrator branch/role update. Use the canonical lock order and return `attendance_grants_must_be_revoked` before user/audit writes. Preserve the existing TrainingGroup branch-immutable validation unchanged.
21. Introduce explicit effective attendance scope in Application/Infrastructure:
   - global ids are not enumerated;
   - Coach ids come only from trainer assignments;
   - Administrator ids come only from valid matching grants in a non-archived branch;
   - list/direct decisions use the same representation.
22. Expand the route-level attendance policy to Administrator and project `attendanceScope` through session/profile. Keep compatibility `assignedGroupIds` Coach-only for this release.
23. Refactor web attendance list/roster/access probe to consume the effective scope. Filter attendance roster group summaries by that same scope for Administrator/Coach.
24. Implement the shared date-policy, then move final write authorization before client reads inside the owned `AttendanceService.SaveAsync` transaction; add typed forbidden/date mapping to stable web ProblemDetails and internal bot errors without changing membership semantics.
25. Refactor internal `BotApiService` menu/context/list/roster/save to consume the same effective attendance scope and date-policy. Return the authoritative date window before attendance date selection and remove Python-side role/timezone date calculation; do not add Python-side branch/group/date authorization rules.
26. Obtain the pre-implementation `ui-designer` review, then implement extracted frontend management components and API contracts. Keep the existing Administrator settings flow, consume backend actions/capabilities/reasons and implement revoke confirmation/concurrency reload.
27. Implement Administrator zero-scope and runtime revoke recovery in `AttendanceScreen`; do not cache or infer grant authority on frontend.
28. Run targeted green suites after every slice, then:
   - `dotnet test backend/GymCrm.slnx`;
   - `cd frontend && npm run test:unit`;
   - `cd frontend && npm run lint`;
   - `cd frontend && npm run build`;
   - focused Playwright settings/attendance scenarios at desktop, 320×568 and 390×844 mobile-touch viewports;
   - `cd bot && ruff check .`;
   - `cd bot && pytest`.
29. Complete the post-implementation `ui-designer` visual review and resolve every blocking responsive/usability finding.
30. Recreate the local PostgreSQL/stand from empty volumes; verify migrations/model drift, seed, health and a two-branch smoke: grant, session refresh, accepted web/bot date boundaries, web save, bot save, revoke, denied replay, branch archive/restore and explicit revoke followed by Administrator branch move.
31. Perform a final security/source audit:
   - no Administrator attendance decision depends only on UI visibility or `CanMarkAttendance`;
   - no role-specific grant query is duplicated between web and bot;
   - every save re-authorizes inside transaction;
   - no cross-branch/stale grant can become effective;
   - no archived-branch grant becomes effective and no transport computes its own attendance date window;
   - no denied/no-op request writes grant, attendance, membership or audit;
   - TASK-075 and unrelated role/membership semantics are absent from the diff.

## Preferred implementation strategy
1. Contract and security matrix first.
2. Unit, integration, PostgreSQL, frontend and bot tests before functional code, with recorded expected failures.
3. Dedicated grant model plus one effective attendance scope service; never overload trainer assignment.
4. Compare-and-swap full replacement for usable multi-select UX without lost manager updates.
5. Authoritative authorization at the transaction-owning attendance service, with endpoint checks only as early feedback.
6. Explicit revoke before branch/role movement; no silent privilege cleanup.
7. One role-aware backend date-policy for web and internal bot.
8. Required `ui-designer` review before frontend implementation and after rendered mobile/desktop validation.
9. Small reviewable commits: red contracts, schema/grant boundary, lifecycle locks, effective attendance/save boundary, frontend, bot/cross-layer regression.

## Files likely to change

### Backend tests first
- `backend/tests/GymCrm.Tests/AdministratorAttendanceGrantApiTests.cs` (new)
- `backend/tests/GymCrm.Tests/AdministratorAttendanceGrantPostgreSqlTests.cs` (new)
- `backend/tests/GymCrm.Tests/UserRoleAuthorizationPolicyTests.cs`
- `backend/tests/GymCrm.Tests/AuthorizationFlowTests.cs`
- `backend/tests/GymCrm.Tests/AttendanceApiTests.cs`
- `backend/tests/GymCrm.Tests/InternalBotApiTests.cs`
- `backend/tests/GymCrm.Tests/UsersApiTests.cs`
- `backend/tests/GymCrm.Tests/BranchesApiTests.cs`
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
- focused shared attendance date-policy/window types in `backend/src/GymCrm.Application/Attendance/`
- `backend/src/GymCrm.Application/Bot/IBotApiService.cs` and focused internal-bot date-window contracts
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
- `backend/src/GymCrm.Api/Auth/GymCrmAuthorizationPolicies.cs`
- `backend/src/GymCrm.Api/Auth/AuthEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/AccessEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/AttendanceEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/BotInternalEndpoints.cs`
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
- focused bot menu/context client, service and keyboard files required to render the backend-provided attendance date window

## Constraints
- Backend remains the only source of truth for role, branch, group, attendance and audit decisions.
- Every direct web/internal-bot read and write must enforce current scope; frontend visibility is only presentation.
- No grant may widen normal client/group/staff/settings scope.
- Grant change and its audit are atomic.
- Attendance save and its final authorization, membership side effects and audit are atomic.
- Preserve CSRF, service-token, request-id and bot idempotency behavior.
- Preserve existing Coach trainer scope and HeadCoach/SuperAdministrator global scope.
- Apply only the accepted cross-transport date windows; preserve all other attendance date, client membership, single-visit and TASK-075 semantics.
- Preserve the existing TrainingGroup branch-immutable contract.
- Do not grow already large endpoint/UI files with unrelated helpers; introduce focused types/services/components.

## Out of scope
- All-branch or whole-branch attendance access for Administrator.
- Automatic grants from group management, trainer assignment or staff role.
- Silent grant deletion during branch/role changes.
- Moving an existing TrainingGroup to another branch or changing the current group branch-immutable contract.
- TASK-075 `Held`/`NotHeld`.
- Attendance date-policy redesign beyond the accepted role-aware windows, membership eligibility/write-off redesign or financial attribution.
- General RBAC redesign, group ownership redesign or merging Coach/Administrator scopes.
- Production data backfill while the accepted clean-schema policy remains active.

## Required test coverage

### Unit tests
- Exhaustive role/capability/target-action matrix.
- Attendance scope kind and fail-closed decisions.
- Set normalization, comparison, delta, no-op and concurrency precondition behavior.
- Role-aware min/max attendance date windows and business-date boundaries.
- Stable ProblemDetails mapping where implemented as pure helpers.

### Integration tests
- GET/PUT management contract, CSRF, actor/target matrix and two-branch validation.
- Session/profile scope projection and direct access probe.
- Web list/roster/save and internal bot list/roster/save use identical effective group ids.
- Web and internal bot enforce identical role-aware attendance date windows.
- Staff branch/role lifecycle conflict, explicit revoke path and unchanged TrainingGroup branch immutability.
- Archived branch suspends effective Administrator scope and restoration re-enables otherwise-valid stored grants.
- Exact atomic audit cardinality and typed state.
- Attendance denial causes zero attendance/membership/audit mutation.

### PostgreSQL tests
- Clean schema and model snapshot contain the grant table, keys, indexes and restrictive relationships.
- Duplicate grant cannot persist.
- Compare-and-swap prevents lost updates.
- Concurrent identical requests are idempotent.
- Save/revoke, grant/staff-update and save/branch-archive ordering follows the canonical locks and is fail-closed.
- Audit/save failure rolls back the complete grant or attendance operation.

### UI tests
- Backend-driven Administrator scope summary/action.
- Modal loading, empty, multiple assignment, inactive/unavailable state, capability/reason rendering, revoke confirmation, field/global errors and concurrency reload.
- 320×568 and 390×844 mobile-touch focus/scroll/action usability plus desktop behavior.
- Pre-implementation and post-implementation `ui-designer` reviews are completed with no blocking findings.
- Administrator empty attendance scope.
- Runtime revoke clears selected context and reloads backend scope.

### Bot tests
- Backend Administrator menu and exact group scope.
- Empty scope, multi-grant, ungranted direct request, revoke, archived branch and save denial.
- Accepted Administrator and Coach date boundaries match web behavior.
- Python remains a thin renderer and does not infer branch/group/date access.

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
Completion is blocked unless real-PostgreSQL concurrency tests prove that an Administrator attendance save cannot commit after an already committed revoke or branch archive, while the same suite proves compare-and-swap scope updates cannot lose a concurrent manager change. This is paired with a two-branch automated matrix showing identical effective group ids and accepted date windows in session, web list/roster/save, access probe and internal bot, exact atomic grant/revoke audit, and non-regression for HeadCoach, SuperAdministrator and Coach. Both required `ui-designer` reviews and the 320×568/390×844 mobile-touch checks must also be complete.

## Risks
- **Privilege escalation:** enabling route-level attendance for Administrator without resource checks would expose every group.
- **TOCTOU after revoke:** endpoint-only checks permit a stale authorized save; final authorization must live inside the transaction-owning service.
- **Lost manager updates:** a naïve full replacement can overwrite a concurrent grant/revoke; compare-and-swap and locking are mandatory.
- **Cross-branch resurrection:** stale grants can become active after branch changes unless lifecycle mutations are blocked and effective joins are fail-closed.
- **Archived-branch race:** checking archive state without the canonical branch lock can allow a save to commit after an already committed archive.
- **Duplicate scope rules:** independent web/bot/session filters will drift; one effective scope service is required.
- **Date-policy drift:** independent web/bot limits can grant different historical write windows; all transport must consume the shared backend policy.
- **Audit inconsistency:** using post-commit `IAuditLogService` without the grant transaction can leave grant-without-audit or audit-without-grant.
- **Schema policy drift:** editing initial state is safe only while environments are explicitly recreatable; persisted database requirements require a revised migration plan.
- **UI stale state:** revoke, branch archive or Administrator branch change while attendance is open must clear the roster instead of leaving only a failed row.
- **Inactive semantics:** existing inactive group behavior must remain consistent with current attendance history rules; do not silently broaden or remove it.

## Stop conditions
Stop and do not write production code if:
- explicit risky/security review has not approved this plan;
- TASK-082 role/staff boundary is absent or materially different on the execution branch;
- `AttendanceService` cannot perform final authorization inside its atomic transaction;
- grant, staff update, attendance save and branch archive cannot follow the accepted canonical lock order;
- the accepted ProblemDetails, inactive-resource or explicit-revoke rules are disputed;
- the accepted role-aware date windows or archived-branch suspension rule are disputed;
- runtime databases must preserve data and the clean-schema plan is no longer valid;
- implementation requires a system-wide RBAC or attendance/membership redesign;
- scope expands into TASK-075 or unrelated project refactoring.

Backend + frontend work, shared settings/attendance modules, permissions, schema and bot consumers are not by themselves stop conditions.

## Ready for Codex execution
no — detailed planning and decomposition are complete, but high-risk authorization execution requires explicit human security/architecture approval and movement from `/backlog/risky` to `/backlog/implementation`.
