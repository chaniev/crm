# ADR-0002: Backend-контракт действий и scope филиалов и залов

- **Статус:** Accepted (пользователь, владелец продукта, 2026-10-23)
- **Дата:** 2026-10-23
- **Автор / владелец:** Codex / пользователь, владелец продукта

## Связанные требования

- [REQ-BRN-001/002](/docs/requirements/09-филиалы-и-настройки.md) — changes в TASK-190, создание SuperAdministrator уже принято.
- [REQ-USR-001/003](/docs/requirements/05-пользователи-и-роли.md) — changes / constrains.
- [REQ-CLI-007](/docs/requirements/01-клиенты.md) — constrains, существующий перевод клиента.
- [TASK-190, Product decisions](/backlog/done/2026-10-23/TASK-190-super-admin-branch-hall-creation.md).

## Контекст

UI скрывает branch settings по staff createRoleOptions SuperAdministrator.
Общий ManageSettings разрешает HeadCoach, SuperAdministrator и Administrator
все branch/hall HTTP операции без собственного scope. Это не позволяет
безопасно открыть существующую панель со всеми controls новой роли.

Владелец включил исправление HTTP-доступа Administrator в TASK-190. При этом
GET /branches и /halls — shared dictionaries: их читают settings, формы групп,
клиентов, перевод клиента и финансовые отчёты. Ограничить GET без решения по
lookup consumers означало бы побочно поменять их сценарии. Подробнее —
[producer/consumer review](/backlog/logs/TASK-190-security-review-2026-10-23.md).

## Критерии выбора

- Application владеет role/target authorization, frontend только отображает решения.
- Administrator не создаёт глобальный branch и не меняет чужие branch/hall.
- HeadCoach и существующий HTTP-доступ SuperAdministrator сохраняются.
- В UI SuperAdministrator открываются только просмотр и два create.
- Shared reference visibility и mutation permission различаются явно.
- Совместимость auth/CSRF, validation, audit и потребителей проверяется отдельно.

## Рассмотренные варианты

### Вариант A: Только session actions, старый HTTP scope сохраняется

Локальный additive контракт быстро открывает SA UI, но оставляет Administrator
с глобальными mutations. Владелец отверг эту границу: исправление API включено
в TASK-190. Вариант не используется.

### Вариант B: Application policy для HTTP mutations и поверхности настроек

Policy проверяет actor/action/target в каждом mutation, а session публикует
доступные действия конкретной UI поверхности. UI может предлагать подмножество
реально допустимых HTTP operations, но не дополнительное право. Общие reads
рассматриваются отдельно от управления сущностями.

- Преимущества: устраняет принятый scope defect, сохраняет HTTP права SA и
  не открывает его destructive controls; существующий lookup contract совместим.
- Цена: проверка каждого handler и payload target; отдельные surface и HTTP
  методы одной policy; новые отрицательные HTTP tests и session consumers.
- Риск: ошибочно принять global lookup за mutation grant либо session subset
  за полный набор HTTP permissions. Названия и тесты фиксируют разницу.

### Вариант C: Ограничить также все GET и добавить transfer-options API

Снижает видимость чужих данных, но меняет контракты client/group consumers и
требует отдельного решения по доступным целям перевода. Не является локальным
исправлением mutations. Владелец выбрал сохранение shared reads; вариант C не используется.

## Решение

Владелец принял технический вариант **B** целиком 23.10.2026: Application policy
ограничивает HTTP mutations Administrator своим филиалом, shared reads
сохраняются для существующих consumers. Session surface содержит согласованное
подмножество доступных действий. Решение разрешает execution после preflight.

### HTTP matrix

| Actor | GET branch/hall list/get | Branch create | Branch update/archive/restore | Hall create/update/archive/restore/delete |
|---|---|---|---|---|
| HeadCoach | Прежний общий справочник | Да | Любой | Любой, прежняя entity validation |
| SuperAdministrator | Прежний общий справочник | Да | Любой | Любой, прежняя entity validation |
| Administrator | Прежний общий справочник | 403 | Только собственный branchId | Только hall собственного branchId |
| Coach / anonymous | Прежние 403 / 401 | 403 / 401 | 403 / 401 | 403 / 401 |

Branch delete отсутствует и не добавляется. IncludeArchived/filter/sort/DTO/counts
для reads остаются прежними. GET halls includeArchived
фильтрует состояние hall, не parent; неизвестный branch filter → [], by-ID →
прежний 404 для отсутствующего target. Administrator с null BranchId
не может выполнять mutations. Archived own branch не даёт глобального scope:
сохраняются текущие entity rules, включая возможность восстановить собственный
branch; CreateHall требует активный parent для всех ролей.

### Guards и ошибки

- Транспорт сохраняет framework binding, outer ManageSettings и CSRF порядок.
  Для корректно bound mutations порядок: CSRF → current actor/basic eligibility
  (Administrator без own branch и Administrator POST branch → 403) → target
  lookup (missing → 404) → persisted target scope (foreign → 403) → payload/domain
  validation → запись. Для create нет lookup by ID, scope parent проверяется
  до его domain validation. Malformed JSON остаётся framework 400.
- Administrator POST /branches → 403 независимо от name. Свой branch определяется
  текущим authenticated user из БД, не payload/query/session projection.
- By-ID mutation загружает target: отсутствующий → прежний 404, существующий
  чужой → 403 до payload/domain validation. Это lookup-first pattern catalog update.
- Administrator hall create: request BranchId != own, включая null/empty, →
  403 до проверки target existence/archive, по scope-first pattern catalog create.
  Null/empty actor BranchId → 403 для всех mutations. HeadCoach/SA сохраняют
  field 400 для null/empty/nonexistent/archived parent; Administrator own archived
  parent → прежний 400. Существование actor BranchId штатно защищено FK.
- Hall update авторизуется по persisted hall.BranchId, не body. Чужой hall с
  подставленным own branchId → 403; свой hall с foreign body branchId → прежний
  immutable 400. Перенос hall запрещён. Query/userId/role не расширяют scope;
  общую политику неизвестных полей эта задача не меняет.
- Scope denial использует существующий StaffProblemDetails:
  403, type `/problems/branch-scope-forbidden`, code `branch_scope_forbidden`.
  Нельзя возвращать field details чужой сущности. Отказы не меняют entity/audit.
- HeadCoach/SA validation и статусы сохраняются. Allowed operation не отменяет
  запрет archive/delete hall со связанными группами и прочие entity guards.

### Session surface contract

Общее additive поле `user.branchSettingsActions: string[]` в user projection
login/session/change-password, вычисляемое Application policy:

| Actor | Действия поверхности |
|---|---|
| HeadCoach | View, CreateBranch, UpdateBranch, ArchiveBranch, RestoreBranch, CreateHall, UpdateHall, ArchiveHall, RestoreHall, DeleteHall |
| SuperAdministrator | View, CreateBranch, CreateHall |
| Administrator / Coach | Пустой набор |
| Anonymous | Нет authenticated user |

View открывает вкладку; каждый control/submit требует своего action.
Unknown/missing/null/empty не дают разрешение. Это подмножество HTTP полномочий
для этой панели, а не новая система permissions и не правило показа по роли в React.

## Последствия

- Положительные: закрыты direct foreign mutations Administrator; SA UI больше
  не зависит от права создавать других SuperAdministrator.
- Отрицательные: legacy вызовы Administrator создания branch/чужих mutations
  начнут получать 403; frontend обязан показывать backend error без потери ввода.
- Общие GET сохраняют нынешнюю видимость в том числе counts:
  задача не обещает изоляцию чтения или новый transfer contract.
- Атомарность двух create исправляется локальной транзакцией существующего
  DbContext вокруг entity + audit. Схема и остальной audit lifecycle не меняются.

## Cross-layer impact

- Backend: Application actor/action/target policy, AuthEndpoints projection,
  guards всех BranchEndpoints mutations и транзакции двух create.
- Frontend: auth types/mapper/facade, settings tab/controls/forms, branch client
  error coverage; regression shared group/client/catalog/finance consumers.
- Bot: Staff API branch/hall не используется; internal API не меняется.
- Deploy/runtime: нет новых variables/services/migrations; PostgreSQL runtime
  доказывает denial/no-write и create/audit consistency.
- Public contracts: additive session field, новые 403 для запрещённых
  Administrator mutations; payloads, successful DTO и GET неизменны.

## Migration and rollback

DB migration не нужна, существующие данные не удаляются. Сначала backend,
затем frontend с новым field; новый frontend со старым backend закрывает panel
без fallback на роль. Старый frontend с новым backend продолжает HC flow и
получает честный 403 на запрещённых legacy mutations. Для получения actions
обновляется session. Откат frontend не должен откатывать authorization fix;
откат backend вновь откроет overpermission и не является безопасным recovery.
Предпочтителен forward fix, данные созданных branch/hall/audit сохраняются.

## Validation

Полная HTTP actor/action/own/foreign/missing/archived/payload matrix, auth/CSRF,
no-write/audit на отказ, существующие HC/SA positive operations; session subset
и frontend missing/revoked actions. Shared-read consumers и перевод клиента
проверяются на совместимость. Relational audit failure проверяет rollback
двух create. Playwright защищает SA branch → hall → reload, modal error и
Administrator negative path. Конкретные specs — в implementation plan.

## Open questions

Нет.

## Approval

Accepted (пользователь, владелец продукта, 2026-10-23).
В текущем диалоге на вопрос о принятии варианта B с сохранением общего чтения
и описанного backend-контракта пользователь ответил: «Принять вариант B и
сохранить общее чтение (рекомендуется)». Решение относится ко всему варианту B,
включая HTTP matrix, guards, session surface, совместимость и rollback.
