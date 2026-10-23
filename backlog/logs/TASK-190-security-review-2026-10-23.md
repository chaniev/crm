# TASK-190: review authorization, contracts и UI, 23.10.2026

- Reviewer: Codex; отдельное read-only backend review агентом `backend_review`.
- Scope: [карточка](/backlog/needs-clarification/TASK-190-super-admin-branch-hall-creation.md), Application policy, Staff API/session, settings consumers.
- Evidence: статическое чтение main `37ac687`; браузерный frontend baseline с
  изолированными fixtures. Backend tests и реальная БД в planning не запускались.
- Outcome: цель принята, но `readiness: no`: требуется выбрать границу между
  UI surface actions и устранением существующего HTTP scope mismatch.
  Review не является human approval или подтверждением runtime security.

## Фактическая матрица

| Операция | HeadCoach | SuperAdministrator | Administrator | Coach / anonymous |
|---|---|---|---|---|
| Branch list/get, hall list/get | Все | Все | Все, без own-branch filter | 403 / 401 |
| Branch create/update/archive/restore | Все | Все | Все, без own-branch guard | 403 / 401 |
| Hall create | Любой активный филиал | Любой активный филиал | Любой активный филиал | 403 / 401 |
| Hall update/archive/restore/delete | По entity validation | То же | То же, включая чужой филиал | 403 / 401 |
| Branch delete | Нет такого endpoint | Нет | Нет | Нет |

Основания: `UserRoleAuthorizationPolicy.cs` GetPermissions,
`GymCrmAuthorizationPolicies.cs` ManageSettings и весь `BranchEndpoints.cs`.
`branchId` у GET halls — пользовательский query filter, не security boundary.
В соседнем `MembershipCatalogEndpoints.cs` есть own-branch guard; распространять
его на все branch/hall операции без согласованного контракта нельзя.

## Findings и влияние

1. **Существующий конфликт scope.** REQ-USR-001 ограничивает Administrator
   собственным филиалом/залом; HTTP matrix этого не соблюдает. Общий
   CanManageSettings не подходит как gate нового UI. Findings затрагивает stop
   condition TASK-190; карточка перенесена в needs-clarification.
2. **Несвязанные полномочия.** SettingsScreen показывает branches по staff
   createRoleOptions SuperAdministrator. BranchSettingsScreen не принимает
   permission props и показывает все controls. Замена только tab gate откроет
   SA edit/archive/restore/delete; нужна отдельная матрица каждого действия.
3. **Auth/CSRF.** Cookie lifecycle проверяет active и UpdatedAt версию через
   AuthenticatedUserMiddleware. AuthCsrfValidation используется mutations;
   отсутствующий/неверный токен даёт 400 ProblemDetails. В CsrfProtectionTests
   нет отдельного branch/hall create barrier — его следует добавить.
4. **Validation.** CreateHall отвергает пустой/неизвестный/архивный branchId;
   UpdateHall запрещает перенос в другой филиал. Связанные группы блокируют
   archive/delete hall. RestoreHall не проверяет active parent; новые правила
   restore этой задачей не вводятся.
5. **Аудит.** BranchCreated/HallCreated содержат actor/entity/snapshot, но
   entity SaveChanges (BranchEndpoints) предшествует отдельному audit SaveChanges
   (AuditLogService) без общей транзакции. Атомарность при audit failure не
   доказана; planned create tests должны обнаружить и закрыть этот дефект
   ограниченной транзакцией, не переустройством всего audit слоя.
6. **Ошибка формы.** React review и browser fixture показывают: значения после
   400 сохраняются, общий actionError выводится в панели позади Modal.
   Field error `branchId` не привязан к input в hall dialog. Нужен видимый
   form-level Alert в открытой форме; это часть исходного acceptance, не redesign.

## Existing green и expected red

- `BranchesApiTests.SuperAdministrator_can_manage_membership_catalog_in_two_branches`
  уже создаёт два branch с 201. `Branch_and_hall_admin_flow_validates_archive_and_delete_guards`
  авторизован как HeadCoach, несмотря на слово admin в имени.
- Отдельные SA hall create, actor/entity audit и CSRF/invalid branch cases
  ожидаются green как characterization, не требуют искусственного red.
- Session actions, SA tab, isolated controls, missing/revoked action и ошибка
  внутри Modal отсутствуют: эти regressions должны дать настоящий red.
- Relational audit-write failure должен выявить partial create до исправления.
- Administrator foreign-scope denial сейчас не обеспечен. Такой тест нельзя
  называть существующим barrier; он входит только в вариант B после полного
  согласования матрицы.

## Rendered baseline и UX applicability

Использованы текущий Vite frontend и полностью перехваченные `/api/*` ответы;
CRM database/сессии не менялись. Chromium 390×844, full-page captures:

- [HeadCoach: существующая панель](/backlog/mockups/TASK-190-existing-settings/headcoach-390.png).
- [SuperAdministrator: вкладки нет](/backlog/mockups/TASK-190-existing-settings/superadmin-390.png).
- [Hall 400: ошибка вне открытого dialog](/backlog/mockups/TASK-190-existing-settings/hall-error-390.png).

После simulated archive error dialog открыт, имя «Новый зал» сохранено,
внутри dialog отсутствует текст ошибки. Это UI evidence, не доказательство
backend validation или реального concurrent archive.

Режим `crm-mobile-first-ui`: локальная коррекция доступа и feedback; текущие
порядок панели, поля, modal и responsive composition переиспользуются.
Три новых направления не требуются: нового экрана/материального redesign нет.
Наиболее слабое место baseline — общий Alert вне формы; оно имеет отдельный
regression scenario. Target iPhones, Safari, keyboard и after comparison
остаются проверками будущей реализации, сейчас не объявлены выполненными.

## Предложение и решение владельца

[ADR-0002](/docs/architecture/adr/0002-branch-settings-action-contract.md)
сравнивает session surface actions с общей enforcement policy. Для исходного
узкого scope предложен первый вариант; он честно сохраняет legacy HTTP доступ.
Владелец должен согласовать границу или выбрать расширение и повторное planning.
Принятие review не исправляет обнаруженное нарушение и не разрешает новые роли.

## Дополнение: владелец включил HTTP fix в TASK-190

Пользователь выбрал «Включить исправление API-доступа в TASK-190 и расширить
план». Первоначальное предложение UI-only выше — исторический результат,
оно больше не является актуальным scope. В ADR описана Application policy
с guards каждой mutation; HC/SA direct HTTP права сохраняются, Administrator
создавать branch не может, управляет только own branch/hall.

Отдельное follow-up review проверило consumers и точный guard ordering:

- ClientDetailScreen.openTransferModal использует общий getBranches; endpoint
  ClientLifecycleEndpoints.TransferClientBranchAsync и shared
  ClientMembershipEndpoints.ExecuteMembershipActionAsync не проверяют actor
  branch. Положительный ClientsApiTests transfer работает как HeadCoach.
- GroupManagementScope уже ограничивает Administrator группы своим филиалом.
  Поэтому review не заявляет, что текущий crossbranch transfer Administrator
  полностью рабочий; TASK-190 не должна молча переделывать этот workflow.
- Рекомендовано сохранить справочные GET, ограничив mutations. IncludeArchived
  hall проверяет hall state, не parent; unknown branch filter возвращает [],
  unknown by-ID — 404. На выбор владельца вынесена граница чтения.
- Следовать existing catalog order: by-ID lookup → 404/foreign 403; hall create
  scope-first → 403 при request parent != own, включая null; own hall + foreign
  body → прежний immutable 400. Scope error — existing branch_scope_forbidden.
  Null actor branch закрывает mutations; нельзя брать scope из payload/query.
- Для audit failure — selective injector по create action с пропуском login
  audit и PostgreSQL fixture. BranchesAppFactory InMemory не доказывает rollback.
  Образцы — AttendanceApiTests и AdministratorAttendanceGrantPostgreSqlTests.

Если чтение сохранено, новых продуктовых решений для mutation matrix нет;
read isolation потребует отдельного transfer/options design и нового review.

## Дополнение: acceptance варианта B

23.10.2026 владелец в текущем диалоге выбрал «Принять вариант B и сохранить общее чтение (рекомендуется)». Принят полный описанный контракт ADR-0002; shared GET остаются прежними, read isolation и новый transfer-options API не вводятся. Блокер закрыт, карточка перемещена в /backlog/implementation/TASK-190-super-admin-branch-hall-creation.md.

## 2026-10-23 — TASK-190: завершение и архив

- main fast-forward: `6b5e39c8bb7fd0e739418d650dc6335a6cf1f2d5`; полный harness passed.
- [Актуальная карточка](/backlog/done/2026-10-23/TASK-190-super-admin-branch-hall-creation.md), [verification](/backlog/done/2026-10-23/TASK-190-evidence/verification.md).
- Завершённые card/plan/contract/manual evidence/baseline перемещены вместе. Исторические ссылки выше сохраняют путь на дату записи; актуальное соответствие:
  - `/backlog/implementation/TASK-190-super-admin-branch-hall-creation.md` → `/backlog/done/2026-10-23/TASK-190-super-admin-branch-hall-creation.md`
  - `/backlog/implementation-plans/TASK-190-super-admin-branch-hall-creation.plan.md` → `/backlog/done/2026-10-23/TASK-190-super-admin-branch-hall-creation.plan.md`
  - `/backlog/implementation/TASK-190-super-admin-branch-hall-creation.verification-contract.json` → `/backlog/done/2026-10-23/TASK-190-super-admin-branch-hall-creation.verification-contract.json`
  - `/backlog/implementation/TASK-190-manual-evidence.json` → `/backlog/done/2026-10-23/TASK-190-manual-evidence.json`
  - `/backlog/implementation/TASK-190-evidence` → `/backlog/done/2026-10-23/TASK-190-evidence`
  - `/backlog/mockups/TASK-190-existing-settings` → `/backlog/done/2026-10-23/TASK-190-existing-settings`
