# Implementation Plan: TASK-091 Перенести создание суперадминистратора в раздел администраторов

## Source task
/backlog/done/TASK-091-administrator-role-creation-flow.md

Source status is `done`: risky execution was explicitly approved by the user,
implemented on the dedicated branch and completed after all required
authorization, frontend, responsive and clean-deployment barriers passed.

## Git branch
feature/TASK-091-administrator-role-creation-flow

Branch rules:
- before project-code changes, explicitly approve this risky plan and move the
  source task from `/backlog/risky` to `/backlog/implementation`;
- start from a clean, current `main`: `git checkout main`,
  `git pull --ff-only`, `git status --short --branch`;
- create `feature/TASK-091-administrator-role-creation-flow` from `main` and
  confirm that it is active before the first project-code edit;
- do not implement TASK-092 or unrelated staff/authorization refactoring in
  this branch;
- stop if the worktree is dirty, the branch/base is unclear, or the branch was
  not created from `main`.

## Goal
Главный тренер создаёт и редактирует `Administrator` и
`SuperAdministrator` в разделе `Настройки → Администраторы`, а раздел
`Тренеры` читает, создаёт и редактирует только `Coach`. Backend остаётся
единственным источником истины для actor/target matrix, role options, scope,
allowed actions, validation, ProblemDetails и audit.

## Current understanding
- TASK-082 уже реализовала `SuperAdministrator`, глобальный scope, staff
  authorization matrix, стабильные ProblemDetails и backend-owned
  `createRoleOptions`, `roleOptions` и `allowedActions`. TASK-091 не меняет
  полномочия ролей.
- `backend/src/GymCrm.Api/Auth/UserEndpoints.cs` сейчас является generic staff
  transport: список возвращает все роли, create принимает любую разрешённую
  actor-у роль, get/update не ограничены тренерами.
- `backend/src/GymCrm.Api/Auth/AdministratorEndpoints.cs` сейчас, наоборот,
  жёстко фильтрует и создаёт только `Administrator`; лишний `Role` в JSON
  игнорируется transport binding и не может создать `SuperAdministrator`.
- Оба endpoint family используют общие `StaffManagementBoundary` и
  `StaffManagementMutationService`. Это правильная security foundation; её
  нужно дополнить endpoint-scoped role family, а не копировать permission rules
  в endpoints или frontend.
- `SettingsScreen.tsx` жёстко задаёт роль `Administrator`, скрывает role field,
  хранит branch вне Mantine form и всегда показывает badge
  `Администратор`. Такая state model допускает stale branch payload при
  переключении роли.
- `UserCreateScreen` получает session-wide `createRoleOptions`, поэтому
  административные роли появляются в create-flow тренера.
  `UserEditScreen` и `/users/{id}` также остаются generic staff flow.
- Текущая policy отдельно разрешает `HeadCoach` обновлять собственную
  учётную запись через `PUT /users/{currentHeadCoachId}` и синхронизирует
  session после успеха. Сужение trainer transport не должно молча удалить
  этот compatibility contract.
- `SettingsScreen.tsx` превышает 1000 строк. Затронутый administrators panel
  следует вынести в focused feature component; это локальная часть TASK-091,
  а не общий settings refactor.
- `bot/` не вызывает `/users` или `/settings/administrators` и не потребляет
  `UserListResponse`. Bot code changes не ожидаются; это нужно повторно
  проверить до реализации и после contract diff.
- Изменения DB/schema не ожидаются. Role и branch invariants уже поддерживают
  `Administrator` с активным `branchId` и `SuperAdministrator` с
  `branchId = null`.
- TASK-092 отдельно удаляет три `MetricCard` из administrators panel. TASK-091
  не должна выполнять это удаление. Если TASK-092 будет merged раньше,
  TASK-091 не возвращает widgets; если позже — TASK-091 не зависит от них и
  оставляет removal отдельной ветке.
- Текущие `UserRoleAuthorizationPolicy` и `AccessScopeService` задают
  `SuperAdministrator` как capability superset роли `Administrator` с
  `Global` operational/attendance scope. TASK-091 не изменяет эту модель, но
  обязана подтвердить её отдельным регрессионным барьером на данных нескольких
  филиалов.

## Resolved review decisions

- `PUT /users/{currentHeadCoachId}` сохраняется как документированное
  compatibility-исключение для self-update `HeadCoach`; trainer list/get и
  обычные trainer updates остаются Coach-only.
- Когда административный create contract возвращает несколько вариантов,
  начальная роль — `Administrator`. Создание `SuperAdministrator` требует
  явного переключения роли пользователем.
- При отсутствии активных филиалов `Сохранить` блокируется только для
  выбранного `Administrator`; `SuperAdministrator` по-прежнему можно создать.
  Ошибка загрузки филиалов не считается пустым списком. Recovery ведёт к
  управлению филиалами, если эта операция доступна текущему пользователю, либо
  объясняет необходимость обратиться к главному тренеру.
- Missing, `null`, empty и unknown `role` возвращают `400 ValidationProblem`
  с ошибкой поля `role`; известная роль вне endpoint family возвращает
  `403 staff_role_transition_forbidden`; wrong-family target возвращает
  `404 staff_not_found` до проверки destination payload.
- Дополнительный invariant review должен доказать, что
  `SuperAdministrator` имеет все возможности `Administrator` во всех филиалах.
  Обнаруженное расхождение является stop condition для TASK-091, а не
  разрешением незаметно расширить её до изменения role matrix.

## Approved UX contract

### User and context
- Users: `HeadCoach` and `SuperAdministrator`.
- Context: mobile-first staff management inside
  `Настройки → Администраторы`.
- Primary stress baseline: `390 x 844`.
- Target portraits: `420 x 912` and `440 x 956`.
- Compact-height smoke: `912 x 420` and `956 x 440`.

### Primary path
1. Open `Настройки`.
2. Select `Администраторы`.
3. Activate `Добавить администратора`.
4. Keep the default `Administrator` or explicitly select another
   administrative role when backend returned more than one
   `createRoleOptions`.
5. Enter credentials.
6. For `Administrator`, explicitly select an active branch.
7. For `SuperAdministrator`, do not show a branch field and submit
   `branchId: null`.
8. Save and receive a role-specific success notification.
9. See the new row with the actual role, scope and backend-provided actions.

Completion is a role-specific notification plus a created/updated row. Closing
the modal or removing a loader is not sufficient.

### Action hierarchy
- Primary: `Добавить администратора` in the administrators tab; `Сохранить`
  inside create/edit.
- Frequent: `Редактировать`, `Обновить`.
- Secondary: `Группы посещений`, messenger fields, active/password switches.
- Exceptional: forbidden role transition, branch validation, stale target and
  `attendance_grants_must_be_revoked` recovery.
- Do not add separate deactivate/reactivate row buttons; current activation
  control remains inside permitted edit flow.

## Fixed backend contract

### Administrative endpoint family
`/settings/administrators` becomes the only web transport for administrative
accounts:

- list/get expose only `Administrator | SuperAdministrator` targets allowed for
  the actor to read;
- HeadCoach list `createRoleOptions`:
  `["Administrator", "SuperAdministrator"]`;
- SuperAdministrator list `createRoleOptions`: `["Administrator"]`;
- item/detail `roleOptions` are the intersection of existing backend
  transition policy and the administrative role family;
- list rows keep generic backend `allowedActions`;
- attendance grant count/action is applicable only to `Administrator`;
- create/update requests contain an explicit `role` and nullable `branchId`;
- `Administrator` requires an existing active branch;
- `SuperAdministrator` requires `branchId: null`;
- a valid but non-administrative requested role is rejected with stable
  `staff_role_transition_forbidden`, not ignored and not coerced;
- denied create/update writes no user mutation and no success audit.

The existing transition matrix remains unchanged:
- HeadCoach can create `Administrator` and `SuperAdministrator`;
- HeadCoach may promote an existing `Administrator` to
  `SuperAdministrator` only when the existing backend policy allows it and
  attendance grants do not block the transition;
- an existing `SuperAdministrator` remains role-immutable;
- SuperAdministrator creates/updates only allowed `Administrator` targets and
  sees protected administrative targets with empty mutation actions.

### Trainer endpoint family
`/users` remains the route for compatibility but becomes trainer-scoped:

- list/get expose only `Coach`;
- create options are `["Coach"]` for an actor allowed to create Coach and empty
  otherwise;
- create accepts only requested role `Coach`;
- update targets only an existing `Coach` and accepts only role `Coach`;
- requesting an administrative destination role for a Coach returns stable
  `staff_role_transition_forbidden`;
- addressing a non-Coach id through trainer get returns stable
  `staff_not_found`; update does the same except for the exact HeadCoach
  self-update compatibility case below;
- documented compatibility exception: `HeadCoach` may update only its own
  existing `HeadCoach` record through `PUT /users/{currentHeadCoachId}` with
  requested role `HeadCoach`, preserving the current authorization,
  validation, audit and session-sync semantics;
- the self-update exception does not add `HeadCoach` to trainer list/get, does
  not expose other HeadCoach targets and does not permit
  `SuperAdministrator` to mutate a HeadCoach;
- the target is rechecked after the locked reload for both the Coach family
  and the exact HeadCoach self-update exception;
- frontend does not filter generic staff rows into trainers and does not infer
  permissions from actor role names.

### Endpoint role-family enforcement
Keep the global actor/target policy in
`UserRoleAuthorizationPolicy`. Add a backend-owned endpoint role-family
constraint that:

- projects create/update options by intersecting global authorization with the
  endpoint role family;
- constrains list/get queries;
- validates requested destination role before mutation;
- constrains target role both before and after the locked reload in update
  flow so a concurrent role change cannot cross endpoint boundaries;
- returns existing stable ProblemDetails and preserves no-mutation/no-success-
  audit semantics.

Do not authorize by frontend field visibility or by a duplicated role matrix in
HTTP handlers.

Request/target validation order is fixed:
- missing, `null`, empty or unknown `role` returns `400 ValidationProblem`
  with a `role` field error;
- a known role outside the selected endpoint family returns
  `403 staff_role_transition_forbidden`;
- get/update of a target outside the selected endpoint family returns
  `404 staff_not_found` before destination-role validation, except for the
  exact documented HeadCoach self-update compatibility case;
- the same target-family decision is repeated after locked reload.

### SuperAdministrator capability and global-scope invariant

TASK-091 must verify without changing the role matrix that:
- for every `CrmCapability`, anything granted to `Administrator` is also
  granted to `SuperAdministrator`;
- `SuperAdministrator` receives `AccessScopeKind.Global` and global attendance
  scope, not branch- or administrator-grant-limited scope;
- administrator-visible client, client messenger, group, settings, membership,
  attendance and audit operations remain available to `SuperAdministrator`;
- for each Administrator capability, a multi-branch integration matrix covers
  at least one read and, when the capability permits mutation, one mutation
  against seeded records in two different branches;
- frontend navigation and actions consume backend permissions, sections,
  scopes and action contracts and do not re-restrict `SuperAdministrator` by
  role-name checks.

This is a regression assertion for the already approved TASK-082 model. If any
capability or cross-branch operation fails, stop TASK-091 and return the
authorization discrepancy for separate scope/security review.

## Fixed UI specification

### Administrators list
Each row renders:
- `fullName`;
- actual role badge: `Администратор` or `Суперадминистратор`;
- `Активен` or `Отключен`;
- login;
- `Филиал: <branchName>` only for `Administrator`;
- `Доступ: все филиалы` for `SuperAdministrator`;
- attendance summary only for `Administrator`;
- Telegram ID only when present.

Actions:
- `Редактировать` only from `Edit`/`Update` in `allowedActions`;
- `Группы посещений` only from `ManageAttendanceScope`;
- `Только просмотр` when no target action is available.

The frontend may use target role for presentation of scope fields, but never to
derive permission or action availability.

### Create form
Visible order:
1. `ФИО`;
2. `Роль` only when `createRoleOptions.length > 1`;
3. `Логин`;
4. `Стартовый пароль`;
5. `Филиал администратора` only for `Administrator`;
6. `Мессенджер`;
7. `Telegram ID`;
8. role-appropriate active-account label;
9. `Потребовать смену пароля`;
10. `Отменить`, `Сохранить`.

Role transition behavior:
- one backend option is stored in controlled form state without a visible
  selector;
- when backend returns more than one administrative option, initialize the
  controlled role to `Administrator`; never initialize a create form to
  `SuperAdministrator`;
- selecting `SuperAdministrator` immediately clears `branchId` and hides the
  branch field;
- selecting `Administrator` with one active branch preselects that branch;
- with multiple active branches, no branch is silently selected;
- with no active branch and selected role `Administrator`, show
  `Нет активных филиалов`, explain the available recovery, and disable
  `Сохранить`;
- if current backend-driven navigation/actions allow branch management, the
  recovery opens `Филиалы и залы`; otherwise it explains that the main coach
  must create or restore an active branch;
- selecting `SuperAdministrator` removes the no-active-branch blocker and
  keeps `Сохранить` available because that role has global scope;
- a failed branch request is a distinct error with retry and never renders as
  `Нет активных филиалов`; it blocks Administrator submission but does not
  block SuperAdministrator submission;
- backend validation remains authoritative even when the UI disables an
  impossible submit.

Payload:
- Administrator: `{ role: "Administrator", branchId: "<active-id>" }`;
- SuperAdministrator:
  `{ role: "SuperAdministrator", branchId: null }`.

### Edit form
- Title is target-specific:
  `Редактирование администратора` or
  `Редактирование суперадминистратора`.
- Use backend `roleOptions`; show selector only when more than one
  administrative destination is allowed.
- Preserve an assigned archived branch only for an unchanged existing
  Administrator; do not allow a new archived destination.
- SuperAdministrator never shows branch or attendance-scope fields and submits
  `branchId: null`.
- Preserve the existing inline
  `attendance_grants_must_be_revoked → Открыть группы посещений` recovery.
- On recoverable API errors preserve form values and focus/scroll to the first
  invalid field.
- If update returns `staff_not_found` because the target left this endpoint
  family, close the edit surface, reload the list and notify that the record
  changed; do not present the stale form as recoverable field input.

### Trainer flow
- Titles/actions remain trainer-specific.
- Create/edit never render a role selector or branch selector.
- Payload is always `role: "Coach", branchId: null`.
- List/create/edit rely on trainer-scoped backend contracts and do not hide
  administrative records with a frontend filter.

### Responsive and accessibility behavior
- `360 x 780`, `390 x 844`, `420 x 912`, `440 x 956`: one-column form and
  rows; mobile temporary surface is full-screen; actions remain at least
  `44 x 44px` with at least `8px` separation; no horizontal page scroll.
- `768 x 1024`: bounded modal up to approximately 640 px, with existing
  two-column field grouping only where labels and validation remain clear.
- `1440 x 1200`: compact list rows with actions aligned to the right; no table
  conversion and no new summary widgets.
- `912 x 420`, `956 x 440`: use dynamic viewport height, one scrollable modal
  body and a sticky `TemporarySurfaceFooter`; no nested scroll trap.
- Sticky footer adds normal spacing plus
  `env(safe-area-inset-bottom, 0px)`.
- With Safari chrome/software keyboard reducing the visual viewport, focused
  field, validation and `Сохранить` remain reachable with one intentional
  scroll.
- Initial focus is `ФИО`; close/Escape returns focus to the opening action when
  the action still exists; pending prevents duplicate submit.

## Safe decomposition
1. Backend endpoint role-family projection and focused pure tests.
2. Backend trainer/admin list/get/create/update contract integration tests.
3. Administrative request/payload types and frontend API mapper tests.
4. Focused administrators panel extraction and controlled form state.
5. Trainer create/edit cleanup without frontend role filtering.
6. SuperAdministrator capability-superset and multi-branch scope regression
   barrier.
7. Mobile/full-stack Playwright and permission/audit regression barrier.

All slices stay in the one TASK-091 branch because they form one contract
change. Use small reviewable commits; do not split permissions or UI behavior
into separately deployable states that leave a bypass or broken consumer.

## Execution steps
1. Obtain explicit approval for risky execution, move the source task into
   `/backlog/implementation`, update lifecycle metadata, and create the required
   branch from clean current `main`.
2. Read root, backend and frontend `AGENTS.md`, this plan, the approved UX
   contract, `.agents/skills/crm-mobile-first-ui/SKILL.md`,
   `.agents/skills/react-best-practices/SKILL.md` and, before xUnit changes,
   `.agents/skills/csharp-xunit/SKILL.md`.
3. Confirm the fixed contract above and inspect whether TASK-092 has already
   merged. Preserve its state; do not implement or undo it.
4. **Before production code**, add/update backend unit tests for endpoint role-
   family projection, complete HeadCoach/SuperAdministrator create/update
   option intersections, the exact HeadCoach self-update compatibility case
   and the exhaustive
   `Administrator capability => SuperAdministrator capability` invariant.
5. **Before production code**, add backend integration tests for both endpoint
   families, actor × requested role × target role, branch invariants,
   ProblemDetails, concurrency-safe target recheck, exact audit behavior and
   SuperAdministrator global access to representative records from at least
   two branches.
6. **Before production code**, add frontend API mapper/request tests for mixed
   administrative roles, role options, allowed actions, nullable branch and
   explicit create/update role payloads.
7. **Before production code**, add frontend component tests for one/two create
   options, role-driven branch clearing, no-active-branch recovery, edit
   roleOptions/actions, actual row roles and Coach-only trainer forms.
8. **Before production code**, add/update focused Playwright scenarios for the
   primary mobile administrative workflow, SuperAdministrator restriction,
   trainer isolation, SuperAdministrator access to all Administrator-visible
   operations, multi-branch scope, failure recovery and responsive geometry.
9. Run the new focused backend, frontend unit/component and Playwright tests.
   Record that they fail for the intended missing TASK-091 behavior. Failures
   from fixtures, environment setup or unrelated baseline regressions do not
   satisfy the red phase.
10. Implement the smallest backend changes required to enforce the two endpoint
    role families while preserving the existing global authorization policy,
    validation, locks, ProblemDetails and audit transaction.
11. Update frontend API request/response types and mappers. Do not add
    frontend role filtering or permission derivation.
12. Extract the affected administrators panel from `SettingsScreen.tsx` into a
    focused feature component. Keep async list/branch loading cancellable,
    prevent stale responses and keep form/modal state local.
13. Implement the approved create/edit/list specification using Mantine,
    Onest, existing semantic tokens and shared mobile primitives, including
    `TemporarySurfaceFooter`.
14. Simplify the trainer list/create/edit components to the Coach-only contract,
    remove branch loading from trainer forms and stop passing session-wide role
    options into trainer create.
15. Rerun the new tests, then affected regression suites. Fix only TASK-091
    regressions; do not absorb TASK-092 or unrelated settings cleanup.
16. Validate all required viewports, WebKit mobile projects, compact-height,
    focus return, keyboard reachability, long Russian names/roles and no
    horizontal overflow.
17. Run full required backend/frontend validation and confirm through repository
    search that `bot/` still does not consume the changed staff transports.
    Run bot validation only if an actual bot contract/code change is discovered.

## Preferred implementation strategy
- Contract-first and red/green by slice.
- Keep `UserRoleAuthorizationPolicy` unchanged unless a test proves an actual
  permission defect; TASK-091 relocates workflows, not permissions.
- Represent endpoint role families once in backend and reuse them for query
  filters, request validation and option projection.
- Model the legacy HeadCoach self-update as one explicit, exact compatibility
  predicate shared by pre-lock and post-lock update checks; do not broaden the
  Coach role family or list/get results.
- Keep role and branch in one controlled form state. Derive visible fields from
  selected backend option and clear invalid dependent state in the role-change
  event handler.
- Reuse current mutation/audit service and shared UI primitives; add focused
  helpers instead of a new generic RBAC system or global frontend state.
- Recommended specialist handoff during execution:
  `dotnet-backend-specialist` for backend contract,
  `react-specialist` for the approved UI/data flow, and
  `test-automator` for regression coverage. `ui-designer` reviews any material
  interaction conflict before implementation changes the approved workflow.

## Files likely to change

### Backend tests first
- `backend/tests/GymCrm.Tests/UserRoleAuthorizationPolicyTests.cs` or a new
  focused endpoint-role-family unit test file
- a focused `SuperAdministratorScopeInvariantTests.cs` integration matrix, or
  equivalent focused additions to the existing authorization suites
- `backend/tests/GymCrm.Tests/UsersApiTests.cs`
- `backend/tests/GymCrm.Tests/AdministratorAttendanceGrantApiTests.cs` only for
  the existing grants-before-role-change recovery regression

### Backend production after red phase
- `backend/src/GymCrm.Api/Auth/UserEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/AdministratorEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/CreateAdministratorRequest.cs`
- `backend/src/GymCrm.Api/Auth/UpdateAdministratorRequest.cs`
- `backend/src/GymCrm.Api/Auth/StaffManagementBoundary.cs`
- `backend/src/GymCrm.Api/Auth/StaffCreateCommand.cs`
- `backend/src/GymCrm.Api/Auth/StaffUpdateCommand.cs`
- `backend/src/GymCrm.Api/Auth/StaffManagementMutationService.cs`
- a focused endpoint role-family contract under
  `backend/src/GymCrm.Api/Auth/` if needed

`UserListResponse` and `UserResponse` should remain shape-compatible if the
fixed contract can be expressed by narrowing item/options semantics. No DB
migration is expected.

### Frontend tests first
- `frontend/src/lib/api/administrators.test.ts`
- `frontend/src/lib/api/users.test.ts`
- `frontend/src/features/settings/SettingsScreen.test.tsx`
- `frontend/src/features/users/UserManagement.test.tsx`
- `frontend/e2e/users.spec.ts`
- `frontend/e2e/stage12.spec.ts`
- `frontend/e2e/administrator-role-flow.spec.ts` as the preferred focused new
  spec
- affected fixtures in `frontend/e2e/responsive-main-screens.spec.ts`

### Frontend production after red phase
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/administrators.ts`
- `frontend/src/lib/api/users.ts`
- `frontend/src/App.tsx`
- `frontend/src/lib/resources.ts`
- `frontend/src/features/settings/SettingsScreen.tsx`
- a focused extracted component such as
  `frontend/src/features/settings/AdministratorsSettingsPanel.tsx`
- `frontend/src/features/users/UserCreateScreen.tsx`
- `frontend/src/features/users/UserEditScreen.tsx`
- `frontend/src/features/users/UsersListScreen.tsx`
- `frontend/src/features/users/UserFormFields.tsx`
- `frontend/src/features/users/UserManagement.mappers.ts`
- `frontend/src/features/users/UserManagement.constants.ts`
- `frontend/src/App.css` only for approved temporary-surface/list responsive
  behavior not already covered by shared classes

### Bot
- No bot production files are currently expected to change.
- If repository inspection finds a new/hidden public staff consumer, update its
  typed contract/tests and run the bot validation commands before completion.

## Constraints
- Backend remains the sole source of truth for role transitions, scope,
  allowed actions, validation and audit.
- Do not change the existing authorization powers of HeadCoach,
  SuperAdministrator, Administrator or Coach.
- Do not accept a valid role outside an endpoint family by ignoring, coercing
  or frontend-filtering it.
- Direct API bypass attempts must be denied without mutation and without a
  false success audit.
- Preserve CSRF, password hashing, login immutability, messenger identity
  uniqueness, active/archived branch behavior and attendance-grant conflict.
- Preserve the existing immutable role of an established
  `SuperAdministrator`.
- Preserve `PUT /users/{currentHeadCoachId}` for exact HeadCoach self-update
  compatibility without exposing HeadCoach in trainer list/get.
- `Administrator` has an active branch for new assignment;
  `SuperAdministrator` and `Coach` have `branchId: null`.
- `SuperAdministrator` remains a capability superset of `Administrator` with
  global operational and attendance scope across all branches.
- No new frontend role-name permission checks or global state.
- Preserve React 19, TypeScript, Vite, Mantine, Onest, semantic tokens and
  shared mobile UI contracts.
- Do not add another component library, Tailwind or Next.js assumptions.
- Do not implement TASK-092 MetricCard removal in this branch.
- Do not create an incremental migration. No schema change is expected; if one
  becomes necessary, stop for scope review before editing database state.

## Out of scope
- Changes to role capabilities or the actor/target authorization matrix.
- Allowing SuperAdministrator to create another SuperAdministrator or
  HeadCoach.
- Changing global/branch/group scope semantics.
- Combining all staff into one registry.
- Renaming `/users` or introducing a broad routing migration unless the
  existing path cannot safely express the trainer-scoped compatibility
  contract.
- Dedicated deactivate/reactivate quick actions.
- Redesign of other settings tabs.
- TASK-092 administrator widget removal.
- Bot workflow changes when the bot remains unaffected by the web staff
  contract.
- Database/schema changes, production data transformation or repair.

## Required test coverage

All unit and integration tests below are written or updated before functional
code. The first focused run must fail for the expected missing behavior.

### Unit tests
- Backend endpoint role-family projection:
  - HeadCoach admin create options are Administrator + SuperAdministrator;
  - SuperAdministrator admin create options contain only Administrator;
  - trainer create options contain only Coach for permitted actors;
  - update role options are intersected with the target endpoint family;
  - protected/immutable SuperAdministrator options remain unchanged.
- Every capability granted to Administrator is granted to SuperAdministrator,
  while SuperAdministrator operational and attendance scopes remain global.
- Frontend mappers preserve actual administrative role, nullable branch,
  backend `allowedActions` and endpoint-scoped `roleOptions`.
- Frontend payload mapping clears branch for SuperAdministrator and Coach and
  preserves selected active branch only for Administrator.
- Controlled form transitions clear stale branch when role changes and do not
  restore an archived/previous branch as a new destination.

### Integration tests
- `/settings/administrators` list/get contains administrative roles only and
  `/users` list/get contains Coach only.
- HeadCoach creates Administrator with active branch and SuperAdministrator
  with null branch through the administrative endpoint.
- SuperAdministrator creates Administrator and is denied
  SuperAdministrator/HeadCoach.
- HeadCoach/SuperAdministrator create Coach through the trainer endpoint.
- Administrative roles submitted to trainer create/update and Coach submitted
  to administrative create/update return stable ProblemDetails.
- Missing, `null`, empty and unknown roles return `400 ValidationProblem` with
  a `role` field error; known roles outside the endpoint family return
  `403 staff_role_transition_forbidden`.
- Cross-family target ids do not leak through the wrong get/update endpoint and
  return the fixed stable not-found contract before payload validation.
- Exact HeadCoach self-update through
  `PUT /users/{currentHeadCoachId}` still succeeds, syncs the current session
  and writes the existing audit; other HeadCoach targets remain hidden and
  forbidden through the trainer transport.
- Missing, empty, unknown and archived Administrator branch destinations fail
  with `branchId` field errors.
- Non-null branch for SuperAdministrator/Coach fails and leaves data unchanged.
- HeadCoach administrative edit respects backend `roleOptions`, immutable
  SuperAdministrator rules and attendance-grant conflict.
- SuperAdministrator receives empty mutation actions for protected
  administrative targets and cannot bypass them by direct PUT.
- Every success records exact actor, target role and branch/global scope.
- Every denial leaves user rows, target state and success-audit count unchanged.
- Target endpoint role family is rechecked after locked reload.
- SuperAdministrator can perform every Administrator capability and sees or
  mutates allowed records from at least two branches without Administrator
  branch/grant restrictions; each capability has a read assertion and, where
  it permits mutation, a mutation assertion.

### UI/component tests
- HeadCoach sees two administrative role options; SuperAdministrator sees no
  role selector and submits Administrator.
- Role selector contains only backend-provided administrative options.
- Administrator branch is required; one active branch is preselected, multiple
  branches require explicit selection, and no active branches shows recovery
  and disables submit.
- A multi-option administrative create form initially selects Administrator.
- No-active-branch disables only Administrator submission; switching to
  SuperAdministrator restores submit availability, while branch-load failure
  remains a retryable error distinct from an empty branch list.
- Switching to SuperAdministrator hides/clears branch and sends null.
- Switching back to Administrator requires a valid active branch.
- Actual Administrator/SuperAdministrator badge, scope metadata and
  backend-driven actions render correctly.
- Attendance-scope action/recovery remains Administrator-only through backend
  `allowedActions`.
- API errors preserve values and expose field validation; duplicate submit is
  blocked.
- Trainer list/create/edit has no administrative role selector or branch field
  and sends Coach/null.
- Empty, loading, error, stale/restricted and success states remain distinct.
- A stale wrong-family edit closes, reloads the administrative list and
  reports that the record changed.

### UI/e2e tests
- HeadCoach creates both administrative roles from the administrators tab.
- SuperAdministrator creates only Administrator and cannot submit/request
  SuperAdministrator.
- SuperAdministrator navigation/actions retain every Administrator operation
  and multi-branch coverage proves global visibility/scope for every
  Administrator-visible operation.
- Trainer create/edit remains Coach-only.
- One forbidden direct API request produces the stable ProblemDetails and no
  success row/notification.
- One branch-validation failure preserves form values and supports recovery.
- Modal open/close, Escape/back and focus return.
- No unintended horizontal overflow at `360`, `390`, `420`, `440`.
- Primary flow passes at `390 x 844`, `420 x 912`, `440 x 956`.
- Compact-height passes at `912 x 420` and `956 x 440` with reachable form and
  footer.
- Tablet `768 x 1024` and desktop `1440 x 1200` preserve hierarchy and actions.
- WebKit mobile projects use touch, iPhone user agent and target logical sizes;
  desktop Chromium viewport-only checks do not count as Safari acceptance.

### Expected initial failure
- Backend tests fail because administrative endpoints hardcode Administrator,
  `/users` returns generic staff, and endpoint role-family checks do not exist.
- Frontend tests fail because admin forms hardcode Administrator, rows hardcode
  the badge, and trainer create consumes generic session role options.
- UI tests fail because the current modal has no role-dependent branch
  transition or full mobile temporary-surface contract.
- Fixture/setup failures or unrelated baseline regressions do not count as red.

### Manual-only validation
- iOS Simulator or physical-device checks for Safari chrome, software keyboard,
  safe-area/home indicator and one-handed reach.
- Human security review of the final endpoint role-family matrix and
  ProblemDetails.
- Russian copy review for long names and both administrative role labels.

## Test plan
- [x] Backend unit/integration tests are added first and fail for the intended
      missing endpoint-role-family behavior.
- [x] Frontend API/component/Playwright tests are added first and fail for the
      intended missing UI/contract behavior.
- [x] HeadCoach administrative and trainer create matrix passes.
- [x] SuperAdministrator administrative and trainer create matrix passes.
- [x] Exact HeadCoach self-update compatibility remains covered without
      reintroducing HeadCoach into trainer list/get.
- [x] Wrong-section roles are denied without mutation or success audit.
- [x] Administrator active-branch and SuperAdministrator/Coach null-branch
      invariants pass.
- [x] Existing SuperAdministrator immutability and attendance-grant recovery
      pass.
- [x] Administrative list/actions and trainer-only list are backend-owned.
- [x] SuperAdministrator capability-superset and multi-branch global-scope
      barrier passes.
- [x] `dotnet test backend/GymCrm.slnx` passes.
- [x] `cd frontend && npm run test:unit` passes.
- [x] `cd frontend && npm run lint` passes.
- [x] `cd frontend && npm run build` passes.
- [x] `cd frontend && npm run test:e2e -- administrator-role-flow.spec.ts users.spec.ts`
      passes, with exact CLI adjusted to the final focused spec names.
- [x] `cd frontend && npm run test:e2e:iphone` passes for the affected flow.
- [x] Required portrait, compact-height, tablet and desktop checks are recorded.
- [x] Bot consumer search is clean; bot did not change, so `ruff check .` and `pytest`
      pass from `bot/`.

## Regression barrier
Completion is blocked until one automated backend matrix proves that both staff
endpoint families enforce their own role sets while using the same global
authorization policy. It must cover HeadCoach and SuperAdministrator, allowed
and forbidden destination roles, cross-family target ids, branch/null scope,
locked target recheck, stable ProblemDetails, exact audit actor/target/scope and
no mutation/success audit after denial. The same barrier preserves the exact
HeadCoach self-update compatibility exception without adding HeadCoach to
trainer list/get.

A separate authorization barrier must prove that every capability granted to
Administrator is also granted to SuperAdministrator and that
SuperAdministrator exercises Administrator-capability operations over records
from at least two branches with global operational and attendance scope.
Existing audit scope continues to mean the audited target `role` plus
`branchId` or `null`; TASK-091 does not add a new audit `scopeKind` field.

The frontend barrier is a component plus Playwright matrix proving that
administrative options/actions come from backend contracts, branch state cannot
leak into SuperAdministrator payloads, and trainer flow remains Coach-only
without frontend filtering. Target iPhone WebKit checks and compact-height
geometry are mandatory for completion.

## Risks
- **Privilege relocation bypass:** changing only UI leaves `/users` able to
  create administrative roles or `/settings/administrators` able to ignore an
  overposted role.
- **Role-family drift:** list, create, update and returned role options can use
  different filters unless one backend contract owns all projections.
- **Concurrent cross-family mutation:** a target role can change between load
  and save unless the endpoint family is rechecked after the locked reload.
- **Stale branch payload:** separate local branch state can submit a branch
  after selecting SuperAdministrator.
- **Incorrect administrative edit:** exposing global Coach transition options
  in the administrators tab would reintroduce mixed staff workflows.
- **Action leakage:** inferring edit or attendance actions from role badge can
  expose unusable or unauthorized controls.
- **Audit false success:** denied privileged requests must not write a success
  audit or partially mutate a user.
- **TASK-092 conflict:** both tasks touch the administrators panel. Branches
  must stay separate, and TASK-091 must preserve whichever widget state exists
  on current `main`.
- **Large component regression:** editing the 1000+ line `SettingsScreen.tsx`
  in place increases state coupling; extract only the affected panel.
- **Mobile temporary surface:** centered modal and non-sticky actions can become
  unreachable under Safari chrome, keyboard or compact-height landscape.
- **Strict fixture drift:** narrowing endpoint semantics will require existing
  backend/frontend fixtures to stop expecting generic staff without weakening
  unrelated TASK-082 security assertions.
- **Compatibility regression:** a blanket Coach target filter can silently
  remove the existing HeadCoach self-update and session-sync contract.
- **SuperAdministrator scope regression:** endpoint- or frontend-specific role
  checks can accidentally make SuperAdministrator weaker than Administrator
  or restrict global data to one branch despite the global backend scope.

## Stop conditions
Остановиться и не писать production code, если:
- source task не approved/moved to implementation или task branch не создана
  от clean current `main`;
- implementation требует изменить полномочия ролей, а не только разделить
  transports/workflows;
- endpoint role-family contract нельзя применить одинаково к list/get/create/
  update и recheck после lock;
- существующие role transitions, immutable SuperAdministrator или
  attendance-grant recovery конфликтуют с зафиксированным контрактом;
- exact HeadCoach self-update compatibility нельзя сохранить без расширения
  trainer list/get или ослабления endpoint-family boundary;
- SuperAdministrator не является capability superset роли Administrator либо
  не получает глобальный доступ к разрешённым операциям во всех филиалах;
- direct bypass нельзя отклонить стабильным ProblemDetails без мутации и
  success audit;
- требуется DB/schema change, production data rewrite или coordinated
  incompatible rollout;
- bot оказывается строгим consumer изменяемого contract, но совместимое
  cross-layer обновление нельзя локализовать;
- UX implementation требует скрыть primary action, вывести permission из role
  name или нарушить safe-area/keyboard contract;
- scope расширяется до общего RBAC redesign, объединения staff registries,
  TASK-092 или unrelated settings refactor.

Full-stack scope, shared staff service, roles/permissions domain and high-risk
classification сами по себе не являются stop condition.

## Ready for Codex execution
yes

Execution completed on 2026-07-26 after explicit approval. The source task was
moved through `/backlog/implementation` to `/backlog/done`, the fixed security
contract and UX specification were implemented, and all required validation
and clean-deployment barriers passed.
