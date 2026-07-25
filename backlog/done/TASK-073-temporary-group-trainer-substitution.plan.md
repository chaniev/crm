# Implementation Plan: TASK-073 Назначать замещающего тренера группы на период

## Implementation status
Done. Implemented in `feature/TASK-073-temporary-group-trainer-substitution`, final implementation commit `69ac88f`, and merged to `main` by PR #94 (`0646218`) on 2026-07-25.

## Source task
/backlog/done/TASK-073-temporary-group-trainer-substitution.md

Source status is `done`: the security-sensitive effective-scope change was reviewed, implemented in its dedicated branch and merged with backend, PostgreSQL, frontend and cross-consumer regression coverage.

## Git branch
feature/TASK-073-temporary-group-trainer-substitution

Branch rules:
- before implementation, verify a clean worktree, switch to `main`, pull the latest changes and create this branch from `main`;
- confirm this branch is active before changing project code;
- do not implement unrelated TASKs in this branch;
- stop if the worktree is dirty or the branch/base is unclear.

## Goal
Дать администратору и главному тренеру безопасный способ назначить группе временного замещающего тренера, автоматически включать его в backend-owned access scope на выбранные календарные дни и немедленно отзывать временное основание после отмены или окончания периода, не меняя основных тренеров группы.

## Current understanding
- Постоянные назначения сейчас хранятся в `GroupTrainers`; именно их напрямую проверяют `AccessScopeService`, client/attendance endpoints, `ClientPhotoService` и `BotApiService`.
- `GroupTrainerAssignments` — историческая модель постоянных назначений с полуоткрытым периодом `[ValidFrom, ValidTo)`; `FinancialReportService` использует её для финансовой атрибуции. Временное замещение нельзя добавлять в эту таблицу без нарушения out-of-scope финансовой семантики.
- `GroupEndpoints` и `GroupRequestValidator` управляют основными тренерами. `GroupTrainerEligibility` уже определяет допустимые роли `Coach | HeadCoach`.
- Управление группами защищено существующей policy `ManageGroups`, доступной `HeadCoach`, `SuperAdministrator` и `Administrator`; обычному `Coach` отдельное локальное role-условие добавлять не требуется. TASK-073 сохраняет текущую область действия этой policy и не вводит отдельное branch-local ограничение.
- Проект уже имеет `IBusinessDateProvider`, вычисляющий business date в `BusinessTime:TimeZoneId` (`Europe/Moscow` по текущей конфигурации). Он должен быть единственным источником текущей даты для активности замещения.
- Список основных тренеров и метрики `trainerIds`, `trainerCount`, `trainerNames` нельзя расширять замещающими: последующее сохранение формы иначе превратит временное назначение в постоянное.
- Экран редактирования группы — подходящее место для отдельной секции замещений. Ошибка этой секции не должна блокировать основную форму группы и read-only список клиентов.
- `/schedule/groups` сейчас возвращает общее расписание всем аутентифицированным пользователям. TASK-073 не меняет этот контракт и не вводит фильтрацию расписания по effective assignment.
- Python-бот не вычисляет scope: он потребляет internal backend API. Shape bot-контракта менять не требуется, но `BotApiService` обязан использовать то же effective assignment, а internal bot integration tests должны защитить поведение.

## Fixed domain and API decisions

### Separate persistence model
- Добавить отдельную сущность `GroupTrainerSubstitution`; не использовать `GroupTrainer` и `GroupTrainerAssignment` как хранилище замещения.
- Минимальные persisted fields: `Id`, `GroupId`, `SubstituteTrainerId`, `StartsOn`, `EndsOn`, `CreatedByUserId`, `CreatedAt`, `UpdatedAt`, nullable `CancelledAt`.
- `Cancelled` — сохранённое состояние, `Upcoming | Active | Expired` — вычисляемые backend-состояния; статус в БД отдельно не хранить.
- Audit log остаётся источником actor для create/update/cancel. Физически не удалять записи при отмене.

### Calendar and boundary semantics
- Публичный контракт использует `startsOn` и `endsOn` в ISO `yyyy-MM-dd`.
- Обе границы включительны: замещение эффективно тогда и только тогда, когда `CancelledAt == null` и `StartsOn <= businessDate <= EndsOn`.
- Однодневное замещение допустимо (`StartsOn == EndsOn`). DB check constraint запрещает `EndsOn < StartsOn`.
- Создание разрешено только для текущего или будущего периода: `StartsOn >= businessDate`.
- Для будущего замещения можно менять тренера и обе даты. Для уже активного — только продлевать/сокращать `EndsOn`, но не раньше `businessDate`; смена тренера или старта оформляется как cancel + create, сохраняя понятный audit trail.
- `Expired` и `Cancelled` записи immutable. Cancel доступен для `Upcoming` и `Active` и отзывает временное основание сразу, независимо от календарной границы.
- Effective access определяется business date в момент запроса, а не датой предметной операции. Поэтому активный сегодня заместитель может работать с посещением за разрешённый `AttendanceDatePolicy` прошлый день, даже если `trainingDate < StartsOn`; после окончания/cancel он не может исправлять посещения даже за день, входивший в период замещения.

### Conflict semantics
- Несколько разных замещающих тренеров могут иметь пересекающиеся периоды для одной группы: группа уже поддерживает несколько основных тренеров, а TASK не связывает substitute с конкретным заменяемым trainer id.
- Для одной пары `(GroupId, SubstituteTrainerId)` пересекающиеся незавершённые периоды запрещены; точный duplicate является частным случаем конфликта.
- Приложение делает pre-check ради понятного `ValidationProblem`, а PostgreSQL обязан иметь concurrency-safe constraint для той же пары и пересечения диапазонов. Предпочтительно exclusion constraint по inclusive `daterange` с partial predicate `CancelledAt IS NULL` и `btree_gist`.
- DB race переводится в стабильный `409 ProblemDetails` с общим `detail` и field errors для `startsOn`/`endsOn`; необработанный `DbUpdateException` наружу не выходит.

### Eligibility and lifecycle
- Допустимые роли заместителя: `Coach | HeadCoach`. Назначение `HeadCoach` разрешено как операционное назначение, хотя не расширяет его уже глобальный access scope.
- Create/update отклоняют inactive group, inactive substitute, неподдерживаемую роль, `Guid.Empty`, отсутствующие entities и выбор текущего основного тренера этой же группы.
- Если замещающий позднее стал основным тренером, запись не отменяется автоматически: effective scope является union оснований, а окончание/cancel временного основания не отзывает постоянное. Такая запись больше не редактируется, но её можно отменить.
- Если заместителя, ставшего основным тренером, позднее снимают с постоянного назначения до окончания периода, незавершённое и неотменённое замещение снова становится самостоятельным основанием доступа до `EndsOn`.
- Деактивация пользователя блокирует его аутентификацию существующими правилами. Историческая запись и audit сохраняются.
- Деактивация группы запрещает create и обычные edits замещения, но cancel остаётся доступным. Само временное основание сохраняется до cancel/окончания и следует существующей семантике постоянных назначений; доступность конкретных операций для inactive group продолжают определять их текущие backend-правила.

### Effective access contract
- Ввести один backend-owned сервис effective group assignment, возвращающий distinct union постоянных `GroupTrainers` и активных `GroupTrainerSubstitutions` на `IBusinessDateProvider.Today`.
- Все coach-scoped consumers используют полученные effective group ids; endpoints/mappers не повторяют date predicates.
- `HeadCoach` и `SuperAdministrator` сохраняют текущий global scope, существующие administrator attendance grants не меняются, а `Coach` получает только effective group ids.
- Подстановка расширяет только те операции, которые уже доступны постоянному назначенному Coach: список/карточка клиентов, допустимая client photo, список/roster/save посещаемости и те же internal bot flows. Она не добавляет `ManageGroups`, `ManageClients`, finance или другие ролевые permissions.
- Общее расписание `/schedule/groups` остаётся вне effective assignment: любой аутентифицированный пользователь продолжает получать его по существующему контракту.
- `FinancialReportService` продолжает использовать только `GroupTrainerAssignments`; временный substitute не получает финансовую атрибуцию в рамках TASK-073.

### Management HTTP contract
- `GET /groups/{groupId}/trainer-substitutions?historySkip=0&historyTake=20` возвращает:
  - `current`: все `Active`, затем все `Upcoming`; внутри статуса — `startsOn`, `endsOn`, `id` по возрастанию;
  - `history`: `{ items, totalCount, skip, take }` для `Expired | Cancelled`, отсортированных по `startsOn`, `endsOn`, `id` по убыванию;
  - `canCreate` и nullable `createUnavailableReason: { code, message }`.
- `historySkip` неотрицателен; `historyTake` по умолчанию равен `20`, допустимый диапазон — `1..100`; некорректная пагинация даёт стабильный `ValidationProblem`.
- Каждый item содержит `id`, `groupId`, `substituteTrainer: { id, fullName, login, isActive }`, `startsOn`, `endsOn`, backend-owned `status`, nullable `cancelledAt`, `createdAt`, `updatedAt` и `allowedActions: { canEdit, canCancel }`.
- `allowedActions` вычисляется backend: `Expired | Cancelled` не имеют действий; ставшее основным назначение нельзя редактировать, но до expiry/cancel можно отменить; inactive group блокирует edit, но не cancel.
- `POST /groups/{groupId}/trainer-substitutions` создаёт запись из `{ substituteTrainerId, startsOn, endsOn }`.
- `PUT /groups/{groupId}/trainer-substitutions/{substitutionId}` изменяет допустимые поля по backend lifecycle rules.
- `POST /groups/{groupId}/trainer-substitutions/{substitutionId}/cancel` выполняет отдельную audit-friendly отмену; `DELETE` не использовать.
- Успешный create возвращает `201 Created` и item, update/cancel — `200 OK` и item.
- Повторный cancel, lifecycle-immutable update и update без фактических изменений возвращают стабильный `409 ProblemDetails` с machine-readable `code`, не меняют запись и не создают audit event.
- Validation/entity/range errors используют текущие `ValidationProblem` conventions; missing group/substitution возвращает `404`; overlap/pre-check и DB race возвращают одинаковый `409 ProblemDetails` с `code` и field errors для `startsOn`/`endsOn`.
- Все routes наследуют `ManageGroups`, поэтому доступны `HeadCoach | SuperAdministrator | Administrator`; `Coach` получает `403`. Write routes также сохраняют существующую CSRF-защиту.
- Create/update/cancel выполняются транзакционно вместе с audit write: успешная мутация без обязательного audit event недопустима.

## Safe decomposition
1. **Period and persistence:** чистая семантика inclusive dates/status/overlap, отдельная таблица и DB constraints.
2. **Management contract:** authorized CRUD-like endpoints, stable ProblemDetails, capabilities и atomic audit.
3. **Effective assignment:** один query/service и перевод web authorization/client/attendance/photo consumers.
4. **Internal bot compatibility:** тот же effective assignment без изменения Python contract shape.
5. **Frontend management UX:** независимая секция в edit screen, backend statuses/actions, create/edit/cancel dialogs.
6. **Cross-layer regression:** fixed-date access matrix, financial non-attribution, concurrency conflict, responsive UI.

Каждый этап должен оставлять основной trainer assignment совместимым и проходить свои автоматизированные проверки до следующего этапа.

## Execution steps
1. Создать `feature/TASK-073-temporary-group-trainer-substitution` от актуального чистого `main`; перечитать root/backend/frontend/bot `AGENTS.md`, source TASK и этот план.
2. До кода зафиксировать DTO/ProblemDetails contract из раздела выше, имена audit actions и точные lifecycle rules. Не начинать schema/API реализацию, если команда не принимает inclusive boundaries или правило конфликтов для одной пары group+substitute.
3. **До production-кода** добавить backend unit tests для чистой period policy:
   - inclusive start/end и однодневный период;
   - `Upcoming`, `Active`, `Expired`, `Cancelled` на фиксированной business date;
   - inclusive overlap/adjacency для одного trainer и допустимое пересечение разных trainers;
   - разрешённые transitions/edit/cancel по статусам.
4. **До production-кода** добавить management integration tests в `GroupsApiTests` или отдельный focused test file:
   - HeadCoach, SuperAdministrator и Administrator могут list/create/update/cancel; Coach получает `403`; anonymous — текущий auth result; write без CSRF отклоняется;
   - inactive/missing group, inactive/missing/invalid-role substitute, основной trainer, empty id, invalid/reversed/past dates возвращают стабильные field errors;
   - exact duplicate и inclusive overlap той же пары отклоняются, соседний непересекающийся период и overlap другого substitute разрешаются;
   - конкурентные create/update не обходят DB constraint и дают один success плюс один `409`;
   - response current/history order, pagination, status/actions/canCreate вычислены backend на фиксированной business date;
   - create/update/cancel создают ровно по одному audit event с actor, group, substitute и old/new period state; audit failure откатывает mutation;
   - cancel сохраняет строку, немедленно исключает её из effective scope; повторный cancel и no-op update дают `409` и не создают event;
   - назначение `HeadCoach` допустимо и не меняет его global scope;
   - ставший основным substitute не редактируется, может быть отменён и снова получает временное основание после снятия постоянного назначения до `EndsOn`;
   - inactive group блокирует create/edit, разрешает cancel и не удаляет существующее временное основание.
5. **До production-кода** добавить fixed-date backend access integration tests:
   - `AuthorizationFlowTests`: session `assignedGroupIds` и group access probe до, на первой границе, на последней границе, после периода и после cancel;
   - `ClientsApiTests`: list/details/search/quick filters/attendance history видят только клиентов effective groups, не раскрывают phone/contacts вне существующих coach rules и сохраняют другое основание доступа;
   - client photo tests: substitute может читать только фото клиента effective group;
   - `AttendanceApiTests`: groups, roster и save доступны на активном периоде и запрещены вне него; business date, а не `trainingDate`, управляет временным scope; основной trainer не теряет доступ;
   - `InternalBotApiTests`: list groups, roster/save, client search/card используют тот же scope до/во время/после/cancel;
   - schedule API regression подтверждает, что `/schedule/groups` остаётся общим для всех аутентифицированных ролей и не фильтруется по замещениям;
   - `FinancialReportsApiTests`: активное замещение не добавляет substitute в trainer attribution и не меняет основного trainer attribution.
6. **До production-кода** добавить frontend API tests для list/create/update/cancel, exact ISO payload, CSRF through shared transport, abort, backend order/status/actions и сохранение ProblemDetails field errors.
7. **До production-кода** добавить component tests новой секции:
   - loading/error/retry/empty и независимость ошибки секции от основной формы;
   - все четыре backend statuses и текст `по ... включительно` без вычисления статуса из браузерной даты;
   - create/edit/cancel, refresh после success и сохранение открытой формы/значений при `400/409/422`;
   - действия зависят только от `allowedActions`, а не от client-side role/status/date rules;
   - основной `trainerIds` не меняется после любой substitution mutation;
   - деактивированный/исчезнувший из options substitute остаётся читаемым из самой записи.
8. **До production-кода** добавить Playwright flow: HeadCoach создаёт, меняет и отменяет substitution; overlap показывает backend field errors; основной trainer остаётся выбранным. Добавить Coach direct-route/management denial и responsive checks на `320/390/440/1440` без horizontal scroll или перекрытия mobile navigation.
9. Запустить все новые targeted tests и подтвердить красную фазу именно из-за отсутствующих entity/schema/contract/effective scope/UI. Ошибки test setup, timezone leakage, неподнятая БД или baseline regression не считаются ожидаемым падением.
10. Реализовать минимальную domain/persistence модель:
    - добавить `GroupTrainerSubstitution`, navigations, EF configuration и `DbSet`;
    - добавить required FK/indexes с `DeleteBehavior.Restrict` для users и `Cascade` только от group согласно существующей group ownership policy;
    - добавить period check и concurrency-safe overlap constraint для non-cancelled одной пары;
    - изменить только `20260513165936_InitialCreate`, его designer и snapshot; новую migration не добавлять;
    - считать пересоздание базы обязательным условием rollout: уже применённая `InitialCreate` не является поддерживаемым upgrade path для TASK-073;
    - проверить воспроизводимое создание чистой PostgreSQL database и наличие требуемого extension/constraint.
11. Реализовать чистую period/lifecycle policy и backend-owned status/action mapper. Использовать `IBusinessDateProvider.Today`; не вызывать `DateTime.UtcNow.Date` для определения активности.
12. Реализовать `IEffectiveGroupAssignmentService` в application authorization boundary и infrastructure query implementation:
    - один distinct query для permanent + effective temporary ids;
    - методы list/contains используют одинаковую семантику;
    - никаких background jobs для истечения доступа: отзыв обеспечивается query-time evaluation;
    - добавить DI registration и focused query tests.
13. Реализовать management endpoints отдельным focused module, не увеличивая уже крупный `GroupEndpoints`:
    - typed request/response records по правилу one top-level type per file;
    - normalization/validation и user-friendly ValidationProblem;
    - pre-check overlap плюс стабильное отображение DB race в `409`;
    - transaction around mutation + audit create/update/cancel;
    - локализованные resources, audit constants/state и отсутствие технического exception detail в response.
14. Перевести `AccessScopeService` на effective service и затем заменить прямые security-sensitive проверки `GroupTrainers` в `ClientEndpoints`, `AttendanceEndpoints`, `ClientPhotoService` и `BotApiService`:
    - получать effective ids один раз на request/use case и передавать их в query/mappers;
    - не делать N+1 и не вычислять period в endpoint/mapping code;
    - не менять role permissions, global scope HeadCoach/SuperAdministrator или administrator attendance grants;
    - оставить permanent trainer display, group summary и financial attribution отдельными от substitution.
15. Реализовать frontend typed API в отдельном `groupTrainerSubstitutions.ts` и независимо загружаемую `GroupTrainerSubstitutionsSection` между основной формой edit screen и списком клиентов:
    - переименовать label постоянного поля в `Основные тренеры группы` и пояснить, что замещение его не меняет;
    - `current` показывать сразу, `history` — в доступной раскрываемой пагинируемой истории, используя только backend order/status;
    - create/edit — Mantine modal с single trainer select и двумя date inputs; frontend проверяет только required/ISO shape, доменные ошибки приходят от backend;
    - cancel — существующий `ConfirmActionModal`, отдельный endpoint, понятный текст о немедленном отзыве временного основания;
    - использовать backend `allowedActions`/`canCreate`; не выводить permissions или lifecycle из дат/ролей;
    - при узком viewport modal full-screen, actions не меньше 44x44, `section/aria-labelledby`, `role=list`, `aria-expanded`, `role=alert`, `aria-live`, `<time dateTime>` и доступные имена повторяющихся действий;
    - после каждой мутации refetch только секции и success notification; ошибка/refetch замещений не ломает edit формы группы.
16. Запустить targeted tests, затем полный regression suite и clean-database check. Провести финальный `rg` всех прямых `GroupTrainers` access predicates и классифицировать оставшиеся как display/persistence/finance semantics, а не coach authorization bypass.

## Preferred implementation strategy
1. Test-first contract and period semantics.
2. Separate persistence from permanent/historical trainer assignments.
3. Central effective-assignment service before touching individual consumers.
4. Contract-first backend management API with backend statuses/capabilities.
5. Incremental consumer conversion with fixed-date regression tests after each layer.
6. Independent frontend section and small verifiable commits for schema, authorization, API/audit, consumers, UI and regression.

Feature flag не требуется для локального early-stage rollout при атомарной поставке backend/frontend. Поскольку TASK-073 меняет только `InitialCreate`, rollout требует воспроизводимого пересоздания PostgreSQL database; обновление существующей базы новой additive migration в эту задачу не входит.

## Files likely to change
- `backend/src/GymCrm.Domain/Groups/GroupTrainerSubstitution.cs` (new)
- `backend/src/GymCrm.Domain/Groups/TrainingGroup.cs`
- `backend/src/GymCrm.Domain/Users/User.cs`
- `backend/src/GymCrm.Application/Authorization/IEffectiveGroupAssignmentService.cs` (new)
- `backend/src/GymCrm.Infrastructure/Authorization/EffectiveGroupAssignmentService.cs` (new)
- `backend/src/GymCrm.Infrastructure/Authorization/AccessScopeService.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/GroupTrainerSubstitutionConfiguration.cs` (new)
- `backend/src/GymCrm.Infrastructure/Persistence/GymCrmDbContext.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.Designer.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/GymCrmDbContextModelSnapshot.cs`
- `backend/src/GymCrm.Infrastructure/DependencyInjection.cs`
- `backend/src/GymCrm.Api/Auth/GroupTrainerSubstitutionEndpoints.cs` (new)
- new focused request/response/status/audit-state files under `backend/src/GymCrm.Api/Auth/`
- `backend/src/GymCrm.Api/Auth/GroupApiConstants.cs`
- `backend/src/GymCrm.Api/Auth/GroupAuditConstants.cs`
- `backend/src/GymCrm.Api/Auth/GroupResources.cs`
- `backend/src/GymCrm.Api/Auth/Resources/GroupResources.resx`
- matching localized group resource file if one exists at implementation time
- `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/AttendanceEndpoints.cs`
- `backend/src/GymCrm.Infrastructure/Clients/ClientPhotoService.cs`
- `backend/src/GymCrm.Infrastructure/Bot/BotApiService.cs`
- `backend/tests/GymCrm.Tests/GroupTrainerSubstitutionPolicyTests.cs` (new)
- `backend/tests/GymCrm.Tests/GroupsApiTests.cs` or a new focused substitutions API test file
- `backend/tests/GymCrm.Tests/AuthorizationFlowTests.cs`
- `backend/tests/GymCrm.Tests/ClientsApiTests.cs`
- `backend/tests/GymCrm.Tests/AttendanceApiTests.cs`
- `backend/tests/GymCrm.Tests/InternalBotApiTests.cs`
- `backend/tests/GymCrm.Tests/FinancialReportsApiTests.cs`
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/endpoints.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/api/groupTrainerSubstitutions.ts` (new)
- `frontend/src/lib/api/groupTrainerSubstitutions.test.ts` (new)
- `frontend/src/features/groups/GroupManagement.tsx`
- `frontend/src/features/groups/GroupManagement.test.tsx`
- `frontend/src/features/groups/GroupTrainerSubstitutionsSection.tsx` (new)
- `frontend/src/features/groups/GroupTrainerSubstitutionsSection.test.tsx` (new)
- `frontend/e2e/group-trainer-substitutions.spec.ts` (preferred new focused spec) or `frontend/e2e/stage12.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`
- the existing stylesheet that owns group edit responsive styles, to be discovered before editing

No Python bot production file is expected to change because the internal API shape remains stable. If implementation discovers a bot contract change, stop and update typed Python models/client/tests explicitly rather than adding local access logic.

## Constraints
- Backend owns roles, permissions, effective access, time, validation, conflicts, status/actions and audit semantics.
- Frontend and Python bot never compare current date to substitution dates to decide access or allowed actions.
- Substitute records never enter permanent `trainerIds`/`GroupTrainers` or financial `GroupTrainerAssignments`.
- Preserve existing permanent trainer and all of that trainer's access.
- Effective scope is the union of independent grounds; expiry/cancel revokes only the temporary ground.
- Do not grant Coach `ManageGroups`, `ManageClients`, finance, audit or access to unrelated groups/branches/clients.
- История замещений всегда ограничена pagination; `current` намеренно возвращается полностью. Избегать N+1, effective ids загружать один раз на request/use case.
- All write operations require existing authorization, CSRF and atomic audit.
- Error responses follow existing ProblemDetails/ValidationProblem conventions and do not expose SQL/constraint details.
- Use Mantine and Onest; preserve narrow-screen usability and existing navigation.

## Out of scope
- Автопоиск или рекомендация substitute.
- Связь замещения с конкретным основным trainer id или автоматическое снятие основного trainer.
- Зарплата, финансовая атрибуция, выплаты и перерасчёт отчетов по substitute.
- Изменение расписания, перенос занятий или клиентские уведомления.
- Новые global roles/permissions или RBAC redesign.
- Исторический/ретроактивный ввод уже завершившихся замещений.
- Background scheduler/cleanup job для окончания периода.
- Изменение Python bot UX/contract shape, если backend internal API остаётся совместимым.
- Массовый backfill существующих group assignments.

## Required test coverage

Все новые/обновлённые unit и integration tests пишутся до functional code и сначала должны упасть по ожидаемой причине.

### Unit tests
- Inclusive period boundaries, one-day period, invalid range and pairwise overlap.
- Backend status and allowed transition matrix on deterministic business dates.
- HeadCoach eligibility, inactive group and substitute-became-permanent transition/action rules.
- Effective-assignment union/deduplication semantics where a user has permanent and temporary grounds.
- Frontend API mapping preserves backend current/history pagination, status/order/actions.
- Frontend section renders status/actions without browser-date access decisions and never mutates main `trainerIds`.

### Integration tests
- PostgreSQL schema/check/exclusion constraint and clean database recreation.
- Full HeadCoach/SuperAdministrator/Administrator management authorization + Coach/anonymous/CSRF-negative matrix.
- Validation and stable ProblemDetails for all entity/range/conflict cases.
- Concurrent overlap race cannot create two conflicting rows.
- Exact create/update/cancel audit cardinality/state and rollback on audit failure.
- Session/access probe, clients, attendance, client photo and internal bot before/start/end/after/cancel matrix.
- Attendance authorization uses current business date independently from the requested `trainingDate`.
- Schedule remains globally readable for authenticated roles and is not filtered by effective assignment.
- Inactive group and substitute-became-permanent lifecycle semantics.
- Preservation of permanent/other grounds after temporary expiry/cancel.
- HeadCoach/SuperAdministrator global behavior, administrator grants and Coach permissions remain unchanged.
- Financial report non-attribution for substitute.

### UI/e2e tests
- Independent section loading/error/retry and backend-driven four-status rendering.
- Backend-ordered complete current list and paginated history loading/navigation.
- Create/edit/cancel success flows with CSRF, refetch and notifications.
- `400/409/422` field errors keep dialog/data; `403/404` follow stable stale/permission handling.
- Main trainers stay unchanged in form and group display.
- Coach cannot use management routes/controls; backend remains enforcement point.
- Responsive modal/history/actions on 320/390/440/1440, keyboard/focus/accessibility and no horizontal scroll.

### Existing tests to update
- Strict group/client/attendance/internal bot fixtures that assume access is only `GroupTrainers`.
- Session `assignedGroupIds` assertions in authorization tests.
- Group edit fixtures in `GroupManagement.test.tsx` and relevant Playwright mocks.
- Do not weaken existing permanent trainer or finance attribution assertions.

### Expected initial failure
- Backend policy/schema/API tests fail because no substitution entity, constraints, endpoints, statuses, audit actions or effective service exist.
- Access tests fail because current consumers query only `GroupTrainers`.
- Frontend tests fail because endpoints/types/section do not exist and current edit form exposes only permanent trainers.
- A failure caused by missing PostgreSQL test runtime, uncontrolled wall clock, broken fixture or unrelated baseline regression does not satisfy the red phase.

### Manual-only validation
- Human review of Russian copy, long names/login wrapping, focus return and mobile bottom-navigation overlap.
- Security review of audit payload/ProblemDetails and final classification of remaining direct `GroupTrainers` queries.
- Manual QA supplements but never replaces automated barriers.

## Test plan
- [x] Unit and integration tests are committed before production code and fail for the intended missing behavior.
- [x] Inclusive start/end, one-day period, status and overlap semantics pass on a fixed club date.
- [x] HeadCoach/SuperAdministrator/Administrator management succeeds; Coach/anonymous/CSRF-negative cases fail correctly.
- [x] Invalid group/trainer/role/range/main-trainer and duplicate/overlap cases return stable field errors.
- [x] DB constraint protects a concurrent overlap race and maps it to `409 ProblemDetails`.
- [x] Create/update/cancel each write exactly one atomic audit event with required state.
- [x] Repeat cancel, immutable/no-op update return stable `409` and write no audit event.
- [x] Access is absent before, present on both boundaries, absent after and revoked immediately after cancel.
- [x] Attendance scope follows current business date rather than the selected `trainingDate`.
- [x] Inactive group preserves the temporary ground while blocking create/edit and allowing cancel.
- [x] HeadCoach can be selected; becoming/removing a permanent trainer follows the fixed union lifecycle.
- [x] Permanent or other valid grounds preserve access after temporary ground ends.
- [x] Client list/details/photo, attendance and internal bot use the same effective scope.
- [x] Schedule remains globally readable for authenticated users and is unaffected by substitution.
- [x] Substitute is absent from financial trainer attribution.
- [x] Frontend renders backend current/history pagination and status/actions, handles mutation errors and keeps permanent trainer ids unchanged.
- [x] `dotnet test backend/GymCrm.slnx` passes.
- [x] `cd frontend && npm run test:unit`, `npm run lint`, `npm run build` pass.
- [x] Focused Playwright substitution and responsive specs pass.
- [x] `cd bot && ruff check .` and `pytest` pass as unchanged-contract compatibility checks.
- [x] Clean PostgreSQL schema setup and final direct-access query audit pass.

## Regression barrier
Completion is blocked unless a deterministic backend integration matrix proves the same effective group ids across session, access probe, client, photo, attendance and internal bot flows before/on/after the inclusive period and after cancel, while an automated financial test proves the substitute never enters trainer attribution. This is paired with a PostgreSQL overlap-concurrency test, exact atomic audit assertions and frontend component/Playwright coverage proving backend-owned statuses/actions and strict separation from permanent `trainerIds`.

## Risks
- **Access leak:** one missed direct `GroupTrainers` predicate can make one endpoint disagree with session or attendance scope. Mandatory final source audit and cross-consumer matrix mitigate this.
- **Stale access at the boundary:** using UTC date or browser date instead of `IBusinessDateProvider.Today` shifts start/end behavior around midnight.
- **Concurrent duplicate access:** application-only overlap checks race; a DB constraint is required.
- **Permanent assignment corruption:** mixing substitute into existing group response/form fields can persist it as a main trainer.
- **Financial drift:** reusing `GroupTrainerAssignments` or broadening `FinancialReportService` would attribute sales to substitute contrary to scope.
- **Audit gap:** saving mutation before a failing audit write would leave an untraceable access grant/revocation; transaction tests must prevent this.
- **Large consumer surface:** `ClientEndpoints` and `BotApiService` have multiple mapping/query paths; effective ids must be passed consistently without N+1 or broad refactoring.
- **Inactive option UX:** a trainer deactivated after assignment disappears from active options; the record must retain its display summary and remain cancellable.
- **PostgreSQL portability:** an exclusion constraint may require `btree_gist` provisioning and Postgres-backed tests; silent fallback to non-concurrency-safe validation is forbidden.
- **No in-place database upgrade:** changing only `InitialCreate` means an already migrated database will not receive the new table; rollout must recreate the database and verify the full clean-schema path.

## Stop conditions
Остановиться и не писать production-код, если:
- task-specific branch не создана от чистого актуального `main`;
- product review не принимает inclusive boundaries или правило overlap только для одной пары group+substitute;
- невозможно реализовать один backend-owned effective assignment source без дублирования date logic по endpoints;
- clean database/runtime не может безопасно provision concurrency-safe overlap constraint и эквивалентная locking/constraint strategy не согласована;
- изменение требует использовать substitute в финансовой атрибуции, зарплате или заменять основного trainer;
- audit create/update/cancel нельзя сделать атомарным с access mutation без системного redesign;
- backend contract не может стабильно определить status/allowedActions/canCreate;
- scope расширяется до RBAC redesign, notifications, schedule mutation или system-wide client access rewrite;
- автоматические fixed-date tests не могут доказать отзыв доступа после end/cancel для всех затронутых consumers.

Backend + frontend scope, shared group/client modules, schema change, bot compatibility, roles/permissions и высокая риск-классификация сами по себе не являются stop condition.

## Ready for Codex execution
no — implementation completed

Причина: задача уже реализована и влита в `main`; повторное исполнение плана не требуется.
