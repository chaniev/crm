# Implementation Plan: TASK-190 Создание филиалов и залов суперадминистратором

## Metadata
- source_task: /backlog/implementation/TASK-190-super-admin-branch-hall-creation.md
- requirements: REQ-BRN-001 (changes), REQ-BRN-002 (changes), REQ-USR-001 (changes), REQ-USR-003 (constrains), REQ-CLI-007 (constrains)
- branch: codex/TASK-190-super-admin-branch-hall-creation
- readiness: yes
- product_decisions: accepted
- technical_decisions: accepted
- architecture_decisions: ADR-0002
- open_questions: none
- dependencies: none — TASK-180 onboarding вне scope; TASK-188/189 не являются prerequisite
- risk: medium — скрытая панель содержит destructive controls; широкое ManageSettings не различает глобальные и филиальные операции

## Goal
SuperAdministrator без собственного филиала открывает «Настройки → Филиалы
и залы», создаёт филиал и зал в выбранном активном филиале, видит записи после
reload. Ошибка сохранения видна внутри формы и не уничтожает введённые значения.

## Decisions and contracts
- Принятое поведение и ограничения — в [TASK-190](/backlog/implementation/TASK-190-super-admin-branch-hall-creation.md)
  и REQ-BRN-001/002; HeadCoach сохраняет текущий сценарий, UI остальных ролей
  не получает новых branch/hall операций.
- Расширенный технический контракт, включая имена actions, матрицу,
  Staff API compatibility и rollback, — [ADR-0002, вариант B](/docs/architecture/adr/0002-branch-settings-action-contract.md).
  Владелец принял HTTP mutations и сохранение reads 23.10.2026.
- Review evidence — [authorization review](/backlog/logs/TASK-190-security-review-2026-10-23.md):
  shared dictionaries используются ClientDetailScreen при переводе клиента;
  ограничить reads без решения владельца нельзя. Скрытый control не заменяет
  HTTP guard: Administrator mutations проверяются на каждом запросе.
- Create payloads и success contracts сохраняются: POST /branches и /halls →
  201 с прежним DTO; missing/archived branch → существующий validation 400.
  Administrator запрос parent вне own scope, включая null/empty, → 403 по ADR;
  его собственный archived parent → 400. Отсутствующий/невалидный CSRF → 400;
  Coach → 403; anonymous → 401.
- Для двух create операций entity и обязательный audit должны коммититься
  вместе. Использовать существующий DbContext/transaction pattern; failure
  audit write откатывает создание. Новая схема/миграция не нужна.

## Decision evidence
- product: [TASK-190, Source notes](/backlog/implementation/TASK-190-super-admin-branch-hall-creation.md) — owner: пользователь, владелец продукта; decision: 23.10.2026 разрешено создание филиала и зала SuperAdministrator; goal повторно не согласовывается.
- Принятая редакция [REQ-BRN-001/002](/docs/requirements/09-филиалы-и-настройки.md)
  уже записана при triage, реализация «частично»; planning не меняет её смысл.
- technical: [Принятый ADR-0002](/docs/architecture/adr/0002-branch-settings-action-contract.md) — owner: пользователь, владелец продукта; decision: 23.10.2026 принят вариант B целиком с сохранением shared GET; ответ «Принять вариант B и сохранить общее чтение (рекомендуется)».
- Existing UI baseline и применимость локальной коррекции зафиксированы в review;
  браузерные fixtures не считаются backend/runtime evidence.

## Planning exit criteria
Владелец принял shared reads и ADR; source card, plan, requirements и review
синхронизированы до implementation. HTTP matrix,
CSRF/guard/lookup ordering и ProblemDetails определены в ADR, не выбираются
executor. Эти решения не являются implementation slices/manual checks.

## UX contract
- Сохраняются путь /settings, порядок вкладок, shared toolbar, список филиалов,
  детали выбранного филиала, список залов, Mantine Modal и текущая адаптация.
  Открытие branches из AdministratorsSettingsPanel использует тот же View action.
- Refresh и выбор филиала доступны при View. Создание branch — основное
  действие панели; создание hall — действие выбранного активного филиала.
  На пустом списке branch доступен первый create; hall не предлагается до
  появления выбранного активного филиала. Сервер остаётся окончательной проверкой.
- Branch form: name, address, description; hall form: readonly название
  выбранного филиала, name, description. Обязательность/длины/ошибки — текущий API.
  После успеха branch выбран; после hall success обновлены список/счётчики;
  модальное окно закрывается с текущим success feedback и возвратом focus.
- Только индивидуальный action показывает control и разрешает submit.
  Staff options и role не используются как fallback. Missing/unknown/empty
  actions закрывают доступ. Потеря View возвращает вкладку на «Абонементы»;
  потеря create при открытой форме запрещает отправку и показывает restricted
  state с сохранением значений, пока View остаётся. Закрытие остаётся доступным.
- Сохраняются loading, empty, load error/retry. Field-level и общая create
  ошибка показываются внутри соответствующего Modal, включая branchId error
  для hall без editable branch field. Не дублировать тот же Alert за Modal.
  Во время submit повторное сохранение запрещено; после 400/403 — данные
  остаются, повторный submit только при актуальном action.
- HeadCoach сохраняет edit/archive/restore/delete по соответствующим actions;
  SuperAdministrator видит только согласованные create. При archived target
  сохраняются текущие state restrictions, restore rules не изобретаются в UI.
- Визуальная работа локальная: новых композиций и дизайн-системы нет. Сравнить
  runtime до/после по baseline и mobile acceptance skill; новый workflow
  возвращает план в planning до production edits.

## Scope
### In
- Application action/target policy, guards всех branch/hall mutations Administrator,
  additive session projection и frontend mapping.
- Индивидуальные guards панели, открытие SA create flow и ошибка внутри формы.
- Branch/hall create audit atomicity, security characterization и consumer/browser coverage.
- Requirements implementation evidence и CHANGELOG после проверенной интеграции.

### Out
- Сохранены shared GET dictionaries и существующий перевод клиента по решению
  владельца. Новые правила client/group authorization
  и transfer-options API автоматически в эту задачу не включаются.
- Новые UI права Administrator/Coach, SA edit/archive/restore/delete,
  создание других SuperAdministrator, onboarding TASK-180, изменение restore semantics.
- Новые endpoints CRUD, branch delete, general RBAC, редизайн настроек,
  refactor всех BranchEndpoints, DB migration и deployment.

## Implementation slices
1. **Backend policy и scope guards.** После red actor/target/payload matrix
   реализовать Application policy и проверки всех branch/hall mutations:
   Administrator не создаёт branch и не меняет foreign target; собственные
   операции, HeadCoach/SA и entity validation сохранены. Session projection
   использует ту же policy с отдельным subset для settings surface.
2. **Безопасное создание.** После relational audit failure red обеспечить
   transaction вокруг branch/hall create + audit без общей переработки CRUD.
3. **Typed consumer и панель.** После red consumer cases добавить распознавание
   actions и exports, передать решения в BranchSettingsScreen; разделить gates
   tab, shortcut, controls и submit, обработать отзыв actions. Использовать
   существующие поля/формы; разместить form-level ошибки внутри Modal.
4. **Сквозное подтверждение.** Проверить SA branch → hall → reload, отказ/retry
   и HC/Administrator/Coach matrix, сохранность shared lookup consumers.
   Добавить task verification contract с
   перечисленными ниже specs после их создания. Обновить REQ-BRN evidence и
   CHANGELOG; другие непроверенные условия карточек не объявлять реализованными.

## Likely files and layers
- `backend/src/GymCrm.Application/Authorization/BranchSettingsActionContracts.cs`
  и `BranchSettingsActionPolicy.cs` — surface и actor/action/target decisions.
- `backend/src/GymCrm.Api/Auth/AuthEndpoints.cs` — общий user response/projection;
  `BranchEndpoints.cs` — все mutation guards и create transaction boundary;
  `StaffProblemDetails.cs` — переиспользовать существующий scope denial.
- `backend/tests/GymCrm.Tests/AuthorizationFlowTests.cs`, `BranchesApiTests.cs`,
  `CsrfProtectionTests.cs`; новые policy/relational create tests при необходимости.
- `frontend/src/lib/api/auth.ts`, `types.ts`, `frontend/src/lib/api.ts` — mapping/types/facade;
  `auth.test.ts` — unknown/missing и response compatibility.
- `frontend/src/features/settings/SettingsScreen.tsx`, `BranchSettingsScreen.tsx`
  и одноимённые тесты — доступ, отзыв, формы и ошибки;
  `AdministratorsSettingsPanel.tsx` — проверить передаваемый shortcut, без staff redesign.
- `frontend/e2e/branch-hall-creation.spec.ts` — новый сценарий;
  `settings-tab-title-duplication.spec.ts`, `settings-group-types.spec.ts`,
  `membership-catalog-settings.spec.ts`, `iphone-target-devices.spec.ts` — fixtures/regressions;
  `frontend/playwright.config.ts` — включить новый spec в оба WebKit testMatch.
- `frontend/src/features/clients/ClientDetailScreen.tsx`, `ClientCreateScreen.tsx`,
  `ClientEditScreen.tsx`; `groups/GroupCreateScreen.tsx`, `GroupEditScreen.tsx`;
  settings catalog и finance — consumers для regression, без перепроектирования.
- `frontend/src/lib/api/branches.test.ts` — новый API error/DTO regression.
- `docs/requirements/09-филиалы-и-настройки.md`, `05-пользователи-и-роли.md`,
  `docs/requirements/CHANGELOG.md` — актуальный target и evidence завершения.

## Regression specification
### Automated tests to add or update
- Application/session: четыре роли, anonymous session, все перечисленные
  actions; login/session/change-password согласованы. HC полный набор, SA
  только View + два create, Administrator/Coach пусто. Staff options не меняются.
- HTTP create: SA без branchId создаёт два филиала и залы в каждом; reload GET
  возвращает их, audit содержит actor, event, entityId/type и правильный snapshot.
  HeadCoach прежний flow; direct Coach/anonymous отказ без новых entity/audit.
- Validation: missing/несуществующий/архивный parent, пустое имя; missing/invalid
  CSRF на обоих create; точные status/ProblemDetails. После отказа нет записи
  и success audit. Administrator × все mutations: own positive, existing foreign
  target 403, missing by-ID 404, global branch create deny, null actor branch,
  payload tampering; hall create foreign/null/empty parent 403, own nonexistent
  parent 400;
  exact 403 ProblemDetails и 404/400 distinction по ADR, no entity/audit changes.
  HeadCoach/SA direct update/archive/restore/delete остаются positive.
- Shared reads: с accepted чтением сохранить global branch/hall list/get,
  includeArchived, фильтры и DTO; group/client create/edit и membership catalog
  сохраняют lookup, client transfer не получает новый API/поведение.
- Relational create: воспроизводимый audit insert failure после entity insert
  для branch и hall; новый DbContext не видит entity или частичный audit.
  Использовать PostgreSQL fixture; audit injector пропускает login events и
  падает только на BranchCreated/HallCreated. Не использовать EF InMemory
  как доказательство rollback; patterns — AttendanceApiTests и
  AdministratorAttendanceGrantPostgreSqlTests.
- Frontend mapping: missing/null/пустое поле, неизвестные actions, обычная и
  PascalCase форма payload по текущему auth mapper; никаких permissive defaults.
- SettingsScreen: SA tab появляется без option SuperAdministrator; даже при
  staff options/CanManageSettings отсутствующий View скрывает tab/shortcut;
  Administrator/Coach не получают operations. Изменение props снимает доступ.
- BranchSettingsScreen: каждый control проверяется независимо, forbidden
  action не вызывает API, create/revoke запрещает stale submit; HC старые
  controls сохранены. 400 branchId/general error видна внутри dialog, значения
  сохранены, retry успешен, duplicate submit заблокирован.
- Playwright: SA settings → branch create → selected branch → hall create →
  reload; две active branches; archived-between-load-and-save failure + recovery;
  запрещённые controls отсутствуют, HC flow и прочие settings сохранены.
  Fixture reload проверяет UI; persistence/audit отдельно подтверждает реальный API.

### Expected red evidence
- Administrator foreign/global mutation tests должны падать: сейчас API пишет
  данные вместо 403. Это новый security regression barrier.
- Session contract отсутствует; policy/session tests падают по отсутствующему
  field/action. SettingsScreen сейчас явно ожидает отсутствие SA branches tab.
- При новой matrix экран показывает лишние actions и не умеет отзыв permission;
  form-error test падает, так как Alert вне dialog. Red должен отражать эти
  симптомы, а не ошибку импорта или неполный fixture.
- Audit failure rollback test обнаруживает раздельное сохранение. Existing SA
  branch/hall create, validation/auth cases могут быть сразу green — сохранить
  это как characterization, не ломать код ради искусственного red.

### Required validation
- Task contract: новый `branch-hall-creation.spec.ts` на chromium и обоих target
  iPhone WebKit projects; обновить testMatch, иначе spec не запускается на них.
- Существующие settings-tab-title, settings-group-types, membership-catalog
  specs на chromium; settings cases `iphone-target-devices.spec.ts` на обоих
  iPhone projects. Добавить покрытие shared lookup и client transfer в
  `membership-sale-pricing.spec.ts`, group lookup в `group-schedule-workflow.spec.ts`.
  На desktop нельзя оставлять безусловный mobile test.use.
- Task-specific runtime: изолированный backend с PostgreSQL, cookie/CSRF SA,
  две create операции, Administrator foreign mutation rejection, повторное
  чтение независимым запросом и audit assertion;
  compatibility старого response без field проверяется consumer tests.

### Manual evidence
- Сравнение runtime с baseline для сохранённых HC controls и SA create forms,
  включая modal error/focus, narrow и compact-height, browser chrome/keyboard
  по mobile acceptance. Проверки Simulator/physical Safari отмечать выполненными
  только при доступном устройстве; fixture Chromium их не заменяет.

### Regression barrier
Связка HTTP scope matrix (включая no-write foreign denial), session/consumer
action tests + SA Playwright
create/reload защищает цель и отсутствие новых UI прав. Relational failure test
отдельно защищает неразрывность create и обязательного audit.

## Risks and stop conditions
- Нельзя выдать surface-action matrix за HTTP enforcement. Выбор новых API
  запретов сверх ADR, ограничение shared reads или новые роли после acceptance
  возвращают план в planning/ADR.
- Старый backend скрывает панель нового UI; не обходить это fallback из role,
  staff options или ManageSettings, соблюдать compatibility из ADR.
- Две create транзакции не должны превратиться в общий refactor CRUD/audit.
  Невозможность сохранить create+audit в существующем DbContext — новый
  material technical blocker до изменения dependent code.
- Ошибка parent branch между load/save не должна терять ввод или показывать
  success. Моки не заменяют реальные authorization/persistence доказательства.
