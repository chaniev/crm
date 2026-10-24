# TASK-191: authorization review, 24.10.2026

- Scope: Staff API, Internal Bot API, frontend и Telegram consumers.
- Baseline: локальная main `607af4d`; дерево project code не менялось.
- Метод: статический разбор public routes, тестов и реализаций. Воспроизведение
  на стенде и новые tests не выполнялись; это planning evidence.
- [Task](/backlog/needs-clarification/TASK-191-administrator-client-branch-access.md),
  [plan](/backlog/implementation-plans/TASK-191-administrator-client-branch-access.plan.md),
  [ADR proposal](/docs/architecture/adr/0003-administrator-client-branch-scope.md).

## Actor/action/client matrix

| Actor | Client read | Client write | Transfer | Дополнительные условия |
|---|---|---|---|---|
| HeadCoach | Global | Действующие полномочия | Прежние domain constraints | Финансы и Professional не расширяются другим ролям |
| SuperAdministrator | Global | Действующие полномочия | Прежние domain constraints | Global не равен разрешению любой операции |
| Administrator A | Только current Client.BranchId=A | Action permission + source A; create target A | Source A, разрешённый target; post-commit scope заново | Attendance требует отдельного grant; null branch не даёт доступа |
| Coach | Effective assigned groups и active substitutions | Только ранее разрешённые действия | Прежний запрет | Срез PII, суммы и membership details не расширяются |
| Anonymous/inactive | Прежние отказы | Прежние отказы | Прежние отказы | Cookie/CSRF и Bot service-token/identity gates сохраняются |

Точное различение 403/404 и успешный ответ перевода пока Proposed в ADR-0003.
Принятое правило ограничения клиентов уже существует независимо от этого выбора.

## Surface inventory

Пути ниже относительно `backend/src/`; привязки к строкам относятся к baseline.
«Gap» означает найденную недостающую проверку; «control» — существующий guard,
который необходимо сохранить и покрыть regression, а не переписать по догадке.

| Поверхность | Evidence | Вывод и необходимая проверка |
|---|---|---|
| Staff list/search/card | `GymCrm.Api/Auth/ClientQueryEndpoints.cs:103,115,549` | Gap: elevated включает Administrator; query сужается только для Coach, карточка не проверяет own branch |
| Pagination/counts/quick filters | тот же `ClientQueryEndpoints.cs` | Scope нужен на исходном IQueryable до любого Count/Skip/Take и projections; разные query aliases не должны менять охват |
| Expiring/attention lists | `ClientQueryEndpoints.cs`, `ClientAttentionEndpoints.cs:233,396` | Expiring проверить отдельно; attention уже фильтрует Administrator по BranchId (control), включая contacted action |
| Lifecycle create/update/archive/restore | `ClientLifecycleEndpoints.cs:60,150`; `ClientLifecycleRequestValidation.cs:153`; `ClientEndpointSharedHelpers.cs` | Gap: client lookup по ID, target validation сравнивает с филиалом клиента, а не actor; guard нужен до validation и side effects |
| Client transfer | `ClientLifecycleEndpoints.cs:242,272,302` | Source guard отсутствует; после lock нужна повторная проверка актуального client/actor; успешный ответ не должен раскрывать новый foreign DTO |
| Membership writes/preview | `ClientMembershipEndpoints.cs:30-46,1010-1180` и `GymCrm.Infrastructure/Clients/` | Все purchase/renew/correct/target preview+transfer/refund/comment/cancel пути включить, не только общий helper; clientId должен владеть addressed sale/refund/membership |
| Membership replay | `ClientMembershipEndpoints.cs:1043,1100` | Gap: перед replay загружается полная свежая карточка. Идемпотентность не является разрешением доступа; после transfer или reassignment нужна reauthorization |
| Photo GET/upload | `GymCrm.Infrastructure/Clients/ClientPhotoService.cs:57,186`; `GymCrm.Api/Auth/ClientPhotoEndpoints.cs:164` | Gap: role-only upload/read, Administrator явно разрешён. Проверить до чтения/сохранения файла; private,no-store уже есть и сохраняется |
| Messenger summary/history/unread/latest | `GymCrm.Infrastructure/Messenger/ClientMessengerService.cs:21,40,702` | Gap: роль + существование client, нет BranchId guard; summary раскрывает connection и preview |
| Messenger link/send/read | тот же service `:91,185,318` | Gap: guard до token, external send/outbox и read-state; persisted caller/client scope, не параметры клиента |
| Messenger replay и внешние эффекты | `ClientMessengerService.cs:217-233`; `ClientPhotoService.cs` | Replay возвращает сохранённое сообщение; reauthorization нужна до replay. Линеаризация send/file operation с transfer требует явного технического решения, одного раннего guard недостаточно |
| Bot search/card/expiring | `GymCrm.Infrastructure/Bot/BotApiService.cs:574,663,741` | Gap: Coach ограничен, Administrator не ограничен собственным филиалом; paging/hasNext после scope |
| Staff group list/detail/summary/clients | `GymCrm.Api/Auth/GroupEndpoints.cs:129,139,162,886,937` | Group scope проверяется, затем clients загружаются без независимого current-client branch guard. Scope нужен для roster/counts; lookup для transfer сохраняется |
| Group mutation conflict details | `GroupEndpoints.cs:720-760` | Деактивация/изменение группы может вернуть ClientId, ФИО, sale/membership и targets из blockers. Сохранить domain запрет, скрыть данные чужих клиентов даже в ошибке |
| Staff/Bot attendance groups/lessons/roster/worklist/save | `AttendanceEndpoints.cs`; `GymCrm.Infrastructure/Attendance/AttendanceService.cs`; `BotApiService.cs:227,368` | Group/grant guards существуют; client queries/counts не имеют отдельного branch predicate. AttendanceService:87-141 проверяет marks до client locks — повторить current scope check после lock; history/replay также защищаются |
| Shared branch lookup counts | `GymCrm.Api/Auth/BranchEndpoints.cs:65,787`, `BranchResponse.cs` | `ClientCount` раскрывает число чужих клиентов; пользователь 24.10 принял скрытие counts при сохранении справочников |
| Audit/financial APIs | `AuditLogEndpoints.cs`; `GymCrm.Application/Authorization/UserRoleAuthorizationPolicy.cs:61` | Administrator не имеет ViewAuditLog; финансовая роль не расширяется. Контроль direct unauthorized requests; новый путь клиентских данных не вводится |
| Deprecated Bot unpaid/mark-payment routes | `BotInternalEndpoints.cs:28,30` | Сохранить прежние deprecated/removed responses, не восстанавливать их как новую функцию |

Отдельный notification endpoint/service в просмотренных Auth/Bot модулях не
обнаружен: в scope входят существующие expiring/attention/worklist и messenger
previews. Это не утверждение о защите неизвестного будущего канала; появившуюся
при реализации client-bearing projection добавить в matrix до завершения.

## Consumer evidence

- `frontend/src/lib/api/clients.ts:329` возвращает card либо null;
  `ClientDetailScreen.tsx:236-244` на null выполняет fallback GET, а полный
  ответ сохраняет в state. Без отдельной обработки 204 успешный перевод после
  закрытия backend-доступа будет выглядеть как ошибка либо оставит чужую карточку.
- `ClientDetailScreen.tsx:116-125` при ошибке не очищает предыдущий client;
  header/actions зависят от сохранённого client (`:371-411`). Нужно очистить
  stale title/photo/forms/chat и отменить/игнорировать поздние responses.
  Аналогично проверить edit и list preview, а не только detail route.
- `frontend/src/lib/api/transport.ts` уже сохраняет status/code/field errors.
  Не требуется новый transport; нужен точный client unavailable mapping.
- `frontend/src/lib/api/branches.ts:190` нормализует missing/null clientCount
  в 0. Это несовместимо со скрытым агрегатом; typed mapping и consumers меняются.
- `bot/src/gym_crm_bot/core/client_flow.py:116` заново читает card на callback.
  `crm/client.py:387` выделяет 403, обычный 404 — CrmClientError;
  `core/crm_error_mapping.py` для callback заменяет сообщение. Проверить
  безопасный текст 404 без body и отсутствие старой keyboard; не перепутать
  отсутствие клиента и TelegramUserNotConfigured.
- `frontend/playwright.config.ts` имеет explicit testMatch для iPhone проектов:
  новый spec нужно включить явно, иначе выбранный проект ничего не проверит.

## Найденные конфликты и решения

1. **P1, открыт:** REQ-CLI-007 требует прекращения membership/новой продажи,
   тогда как `ClientLifecycleEndpoints.cs:283-311` сохраняет no-sale branch
   assignment transfer и отклоняет затронутые active/future targets.
   Это согласуется с [TASK-115, Membership target transfer](/backlog/done/2026-08-23/TASK-115-membership-target-and-overlap-model.plan.md)
   и актуальным `backend/tests/GymCrm.Tests/ClientMembershipWriteRegressionApiTests.cs:563`,
   а также `frontend/e2e/membership-sale-pricing.spec.ts:106`. Старый тест с именем
   `Client_transfer_changes_branch_requires_target_groups_preserves_membership...`
   сам по себе не доказывает актуальную семантику для всех типов membership.
   Владелец должен выбрать редакцию до executable plan; ADR не подменяет REQ.
2. **P2, решён пользователем 24.10.2026:** «Скрывать чужие клиентские счётчики;
   общий справочник сохранить (рекомендуется)». REQ-USR-001 актуализирована.
   Это уточняет ранее принятые counts shared reads ADR-0002; способ nullable
   serialization/mapping остаётся частью Proposed ADR-0003.
3. **T1, открыт:** принять client denial/transfer/replay contract. Нельзя просто
   переиспользовать 403 всех branch mutations ADR-0002 для всех client paths:
   attention уже скрывает чужой client как 404, photo/Bot имеют другие mappings.
   В T1 также входит явная граница синхронизации file/send с переводом: когда
   операция считается авторизованной и как обрабатывается уже разрешённый
   внешний эффект. Нельзя оставлять выбор момента проверки исполнителю.
4. **UX1, открыт:** rendered подтверждение локальной адаптации существующих
   error/success/return states после выбора T1. Из исходников нельзя заявлять
   визуальную готовность или придумывать approval.

## Результат review

Backend evidence дополнительно проверено отдельным read-only агентом;
подтверждены separate membership pipelines, messenger replay и гонки I/O.

Изоляция клиентов Administrator сейчас не обеспечена всеми путями. Для
реализации нужны общая backend scope semantics и полный regression barrier,
включая secondary reads, транзакционные guards и replay. Одного исправления
ClientQueryEndpoints недостаточно. Plan остаётся `readiness: no`, source task
перенесена в needs-clarification; это не начало implementation.

## Закрытие planning review — 24.10.2026

Прямой ответ владельца «1. сохранить текущую модель; 2. согласно рекомендации;
3. согласно рекомендации» закрывает P1, API/UX части T1 и UX1. REQ-CLI-007
актуализирована; P2 принят ранее. ADR-0003 получает Accepted и заменяет ADR-0002
с сохранением исходного branch/hall контракта, кроме foreign client counts.
Предыдущие выводы выше сохранены как evidence состояния на момент review.

Дополнительный backend review определил порядок Branches → Users → Groups →
grants → Clients → memberships и повторную загрузку после locks. Ранний client
lock перед Group/Branch недопустим: он создаёт обратный порядок с существующими
staff/attendance mutations. Изменившиеся branch/group IDs требуют нового прохода
подготовки до эффектов; role/activity/BranchId не берутся из старого EF tracking.

Для photo upload определены commit/rollback cleanup и проверка persisted
PhotoPath при неопределённом commit; для GET — независимый snapshot под read
locks. Для messenger отдельный DbContext держит FOR SHARE actor/client lease,
основной сохраняет Sending до transport. SHARE совместим с FK KEY SHARE;
FOR UPDATE lease создал бы самоблокировку вставки сообщения. Durable Sending
не откатывается вместе с сетевым вызовом, replay не повторяет dispatch.
Цена — дополнительное соединение и locks на время существующего конечного
network timeout; cancellation/finally освобождают lease. Схема не меняется.

После этой конкретизации материальных blockers review не осталось. Порядок
и доказуемые PostgreSQL interleavings включены в ADR и regression specification;
сам runtime этих изменений ещё не реализован и не проверен.

UI contract проверен на [rendered existing components](/backlog/mockups/TASK-191-client-scope/README.md).
Новая схема/финансовая модель/production UI не создавались. Принятые решения
и технический review позволяют выполнить readiness preflight.

Актуальная карточка после preflight: [TASK-191](/backlog/implementation/TASK-191-administrator-client-branch-access.md).
Историческая ссылка `/backlog/needs-clarification/TASK-191-administrator-client-branch-access.md`
в начале review соответствует этой карточке; прежнее состояние сохранено.
