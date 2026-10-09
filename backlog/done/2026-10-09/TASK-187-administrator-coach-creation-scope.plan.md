# Implementation Plan: TASK-187 Управление тренерами клуба администратором

## Metadata
- source_task: /backlog/done/2026-10-09/TASK-187-administrator-coach-creation-scope.md
- requirements: REQ-USR-001 (changes), REQ-USR-002 (changes), REQ-USR-004 (changes), REQ-GRP-001 (verifies), REQ-GRP-002 (verifies), REQ-BRN-001 (constrains), REQ-NFR-003 (constrains)
- branch: codex/TASK-187-administrator-coach-creation-scope
- readiness: yes
- product_decisions: accepted
- technical_decisions: none — сохраняются существующие policy, staff transports, DTO, auth/audit lifecycle и модель User; локальные guards реализуют принятую actor/target matrix
- architecture_decisions: none — расширяется существующая policy в принятых продуктовых границах без нового транспорта, auth-механизма, схемы данных или структурного рефакторинга
- open_questions: none
- dependencies: none — сброс пароля исключён решением пользователя; TASK-173 не блокирует эту задачу
- risk: high — глобальное изменение аккаунта Coach влияет на все филиалы; широкая staff capability не должна разрешить другие target roles

## Goal
Administrator создаёт без групп, находит и редактирует любого Coach клуба
через «Тренеры»; доступ сохраняется после изменения назначений. Управление
назначениями остаётся ограничено группами своего филиала.

## Decisions and contracts
- Источник полномочий — `UserRoleAuthorizationPolicy`; для Administrator
  допустимы read/create Coach и update только Coach → Coach. Другие staff
  roles, self-mutation и управление attendance grants новых прав не получают.
- Для обычного Coach ответ содержит `createRoleOptions: ["Coach"]`,
  `roleOptions: ["Coach"]` и разрешённые `Edit`, `Deactivate`, `Reactivate`.
  Сброс пароля существующего сотрудника исключён из требований к Administrator
  прямым решением пользователя; reset action/API/UI не добавляются. Начальный
  пароль при создании Coach и самостоятельная смена собственного сохраняются.
- Session Administrator получает `Users` в `allowedSections`,
  `canManageUsers: true` и `createRoleOptions: ["Coach"]`.
  `ManageUsers` допускает вход в staff-сценарий, но не заменяет target/family
  authorization. Capability probe `/access/user-management` становится `200`.
  Operational scope остаётся Branch, attendance — AdministratorGrants;
  остальные permissions, landing screen и запрет Audit/Finance сохраняются.
- `/coaches` остаётся единственным CRUD-транспортом тренеров. List/get
  возвращают всех Coach независимо от активности, групп, филиалов и автора.
  У Coach `BranchId = null`; таблица владения тренером и миграция для CRUD
  не нужны. Логин неизменяем; сохраняются проверки логина и messenger identity.
- Существующий `POST /coaches` возвращает `201`, GET/PUT — `200`.
  Успешные create/update и обязательная audit запись сохраняются атомарно;
  пароль и hash не попадают в response/audit. Отказ не меняет данные и аудит.
- Для Administrator чужая role-family `/settings/administrators` остаётся
  закрыта `403 staff_management_forbidden`, включая malformed writes до
  раскрытия target/validation. В `/coaches/{id}` чужая роль/отсутствующий ID
  дают `404 staff_not_found`; HeadCoach self-update exception не расширяется.
  Валидное имя запрещённой роли в payload — `403 staff_role_transition_forbidden`;
  invalid/numeric role — существующий field-level `400`; non-null branchId
  для Coach — field-level `400`. Coach по-прежнему получает staff `403`.
- Group create и assignments используют действующие preview/execute,
  confirmation token, revision и branch guards. Глобальное редактирование
  аккаунта не даёт доступа к чужим группам или клиентам.
- Сохраняется существующий auth lifecycle CRUD: изменение `UpdatedAt` или
  отключение Coach делает его старую cookie недействительной при следующем
  запросе.

## Decision evidence
- product: [TASK-187, Product decisions](/backlog/done/2026-10-09/TASK-187-administrator-coach-creation-scope.md) — owner: пользователь, владелец продукта; decision: ответы от 08.10.2026 разрешают глобальное создание и редактирование Coach через существующий раздел «Тренеры», назначения только в своём филиале; последующий прямой запрос исключает сброс пароля Администратором из требований.
- Принятый target уже записан в [REQ-USR-001/002/004](/docs/requirements/05-пользователи-и-роли.md); повторное одобрение этих прав не требуется.
- Техническое evidence: [planning security review с дополнением для актуального scope](/backlog/logs/TASK-187-security-review-2026-10-08.md), автор — Codex. Существующие boundaries покрывают принятую matrix; новый материальный технический выбор не требуется. Статическое review не является runtime evidence.
- UI baseline: [TASK-105](/backlog/done/2026-08-23/TASK-105-trainer-access-registry-contract.md) фиксирует существующий trainer-only реестр и backend-owned действия. Те же экраны открываются новой роли; layout и последовательность операций сохраняются, новый design direction не требуется.

## UX contract
- Использовать текущие navigation/direct URLs, trainer list/create/edit и
  group assignment flow. Права приходят из session/options/actions backend.
- Сохраняются search/filters, один row edit target, возврат к списку с query,
  filters/focus, скрытые role/branch selectors и неизменяемый login.
- Loading/empty/error/stale/retry и field-level validation используют
  существующие компоненты; отсутствующие create option/actions закрывают
  операцию. Изменение доступа не добавляет нового визуального сценария.
- Визуальное сравнение существующего UI до/после входит в validation;
  появление нового workflow или изменения композиции возвращает план в planning.

## Scope
### In
- Backend policy, staff family/target guards, session sections/options;
  существующие trainer list/create/edit и их frontend consumers.
- Авторизованные изменения аккаунта, cross-admin видимость и audit/session regression.
- Проверка group creation/assignments своего филиала и запрета чужого через UI/API.

### Out
- Новые права на другие staff roles, clients, finance, audit и attendance grants.
- Смена роли Coach, смена его логина, собственный филиал Coach, удаление аккаунтов.
- Сброс пароля сотрудника Администратором и реализация восстановления из TASK-173.
- Новая password complexity policy из TASK-172, общий RBAC, переработка
  расписания/назначений, redesign существующего реестра, deployment.

## Implementation slices
1. **Backend authorization и DTO semantics.** После red matrix добавить
   Administrator → Coach в центральную policy; синхронизировать session/probe.
   Сделать admission shared mutation service зависимым от endpoint role-family,
   чтобы административная family оставалась закрыта до чтения/validation.
   Сохранить target authorization до записи и после reload под lock.
   Проверить list/get/create/edit/deactivate/reactivate без branch join к Coach.
2. **Frontend consumption.** После consumer red обновить session fixtures,
   routes/navigation и backend-owned create/edit actions; использовать текущие
   `UsersListScreen`, `UserCreateScreen`, `UserEditScreen` и API facade.
   Устранить permissive edit fallback при отсутствующем `allowedActions`:
   пустой/отсутствующий набор не разрешает submit. В settings нет admin-tab
   без backend create option Administrator; не добавлять проверки роли в UI.
3. **Cross-scope regression и handoff.** Выполнить сценарий двух администраторов
   и двух филиалов, подтвердить действующие group flows. Добавить task-specific
   verification contract после появления всех specs.
   При завершении обновить затронутые REQ и CHANGELOG по фактическому evidence;
   не помечать весь REQ-USR-002 реализованным без проверки его остальных условий.

## Likely files and layers
- `backend/src/GymCrm.Application/Authorization/UserRoleAuthorizationPolicy.cs`
  — actor/target matrix и существующая capability; `PermissionSet.cs`
  и `CrmCapability.cs` проверяются, новый CRUD-флаг не требуется.
- `backend/src/GymCrm.Api/Auth/StaffManagementBoundary.cs`,
  `StaffManagementMutationService.cs`, `UserEndpoints.cs`, `AdministratorEndpoints.cs`
  — family admission, action/options projection и сохранение denial order.
- `backend/src/GymCrm.Infrastructure/Authorization/AccessScopeService.cs`,
  `backend/src/GymCrm.Api/Auth/AuthEndpoints.cs`, `AccessEndpoints.cs`
  — section/capability/session; формы существующих DTO не меняются ради CRUD.
- `backend/tests/GymCrm.Tests/UserRoleAuthorizationPolicyTests.cs`,
  `UsersApiTests.cs`, `AuthorizationFlowTests.cs`, `GroupsApiTests.cs`,
  `AuthFlowTests.cs` — matrix, HTTP, scope, аудит и cookie lifecycle.
- `frontend/src/lib/api/auth.ts`, `users.ts`, `types.ts`,
  `frontend/src/lib/api.ts` и соответствующие tests — согласованность consumers;
  менять production mapping/exports только при реальной необходимости.
- `frontend/src/lib/appRoutes.ts`, `.test.ts`,
  `frontend/src/features/users/UserEditScreen.tsx`, `UserManagement.test.tsx`,
  `frontend/src/features/settings/SettingsScreen.test.tsx`, `frontend/src/App.test.tsx`
  — доступ, actions и navigation. Остальные user components сохраняются.
- `frontend/e2e/users.spec.ts`, `administrator-role-flow.spec.ts`,
  `group-schedule.spec.ts`, `iphone-target-devices.spec.ts` — затронутые flows.

## Regression specification
### Automated tests to add or update
- `UserRoleAuthorizationPolicyTests`: исчерпывающая actor/current/requested-role
  matrix для четырёх ролей, self-target и target actions; Administrator получает
  только Coach. Старые Administrator-deny ожидания заменить адресно, Coach-deny
  и права глобальных ролей сохранить.
- `AuthorizationFlowTests`: session + probe для Administrator согласованы с
  контрактом выше; branch/attendance scope, Audit/Finance, settings capabilities
  не расширены. Проверить актуальную session существующей cookie без нового входа.
- `UsersApiTests`: два Administrator разных филиалов; Coach без групп, своего,
  чужого и двух филиалов, отключённый и созданный другим сотрудником.
  Все list/detail одинаково доступны; create без групп → новое чтение другим
  администратором; изменение ФИО/messenger/активности видно в другой сессии.
- Матрица прямых обходов: non-Coach ID, privileged/numeric/unknown role,
  non-null branchId, malformed payload в запрещённой family, оба staff endpoints,
  self-target, anonymous/Coach, CSRF. Проверять exact status/code/field errors,
  отсутствие изменения записи и audit events; attendance-grants denial отдельно.
- Неизменность login, case-only duplicate при обычном и конкурентном create,
  duplicate messenger; actor ID и old/new Coach + null branch в обязательном
  аудите. Расширить relational audit-insert-failure test на Administrator:
  create/update откатываются полностью. Не заменять relational evidence InMemory.
- Cookie regression реального HTTP client: edit/deactivate Coach аннулирует
  ранее выданную cookie при следующем запросе; reactivation не оживляет старую
  cookie; данные Coach и история назначений сохраняются.
- `GroupsApiTests`: creation и assignments preview/execute в своём филиале;
  чужой branchId/groupId и execute после утраты scope запрещены.
  Завершение последнего назначения не убирает Coach из list/detail/edit.
  Не переписывать уже реализованный алгоритм групп ради этой проверки.
- Frontend unit: backend fixtures всех ролей; отсутствие create option/action
  закрывает соответствующую операцию; прямые `/coaches/new` и edit routes,
  отсутствующие actions, `401/403`, field-level ошибки и сохранение list filters.
  Settings не показывает управление администраторами при options `["Coach"]`.
- Browser: Administrator через navigation создаёт Coach без групп, возвращается
  в список/перезагружает его, редактирует, фильтрует отключённых; второй
  Administrator видит результат. Отдельно failure/retry и restricted Coach,
  отсутствие role/branch selectors, запрещённый административный URL.
- Browser group flow: создание группы и назначение нового Coach в своём
  филиале; запрет чужого. Для end-to-end evidence нужен реальный backend в
  изолированном runtime: route-mocked `users.spec.ts` доказывает UI contract,
  но не выдаётся за проверку persistence/authorization всей системы.

### Expected red evidence
- CRUD matrix и HTTP Administrator-positive cases сейчас падают на запрете
  policy/`403`; session не содержит Users/Coach create option и permission false.
- Test отсутствующего `allowedActions` в edit падает на текущем fallback `true`.
- Group scope, uniqueness и audit rollback могут уже быть green: это
  сохраняемые barriers, искусственный red не нужен.

### Required validation
- Будущий verification contract добавляет desktop `users.spec.ts`,
  `administrator-role-flow.spec.ts`, `group-schedule.spec.ts` на `chromium`;
  Administrator scenario в `iphone-target-devices.spec.ts` на
  `iphone-air-webkit` и `iphone-17-pro-max-webkit`.
- Не назначать `users.spec.ts` мобильным projects: текущий `testMatch` их
  исключает. Использовать existing target-device spec и общий сценарий.
- Зафиксировать реальные browser + backend evidence двух филиалов отдельно
  от mocked tests.

### Manual evidence
- Зафиксировать существующий rendered CRUD UI перед изменениями и сравнить с
  runtime после реализации по mobile acceptance skill; явно назвать непроверенные
  physical-device/Safari chrome/keyboard состояния. Новый дизайн не выбирается.

### Regression barrier
Единая Administrator → Coach matrix через настоящие HTTP endpoints доказывает
глобальный CRUD, отсутствие доступа к другим staff roles и неизменный branch
scope групп; consumer tests доказывают соответствие backend options/actions.

## Risks and stop conditions
- Новая возможность в broad capability без family/target guards — возврат в
  planning, не компенсировать запрет только скрытием UI.
- Обнаружение новой schema/security стратегии — остановка зависимого
  scope до решения и ADR по применимости; не менять retained data автоматически.
- Сохранить актуальные ограничения Audit из TASK-186 при правке общей policy;
  исторические fixtures до её интеграции не возвращают старые права.

## Completion
- status: done
- completed_at: 2026-10-09
- completion_date_evidence: проверенный candidate `3074f71a9d8c4d487dd56c5573ed4ed9f90207f2` локально интегрирован в main без изменения tree.
- Все implementation slices и обязательный verification contract выполнены.
- [Итоговые проверки и ограничения](TASK-187-evidence/verification.md).
