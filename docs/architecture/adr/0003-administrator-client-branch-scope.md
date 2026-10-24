# ADR-0003: Авторизация клиентских данных по текущему филиалу администратора

- **Статус:** Accepted (пользователь, владелец продукта, 2026-10-24)
- **Дата:** 2026-10-24
- **Автор / владелец:** Codex / пользователь, владелец продукта

## Связанные требования

- [REQ-USR-001](/docs/requirements/05-пользователи-и-роли.md) — changes в TASK-191; ограничение уже принято.
- [REQ-CLI-007/009](/docs/requirements/01-клиенты.md) — changes / constrains; текущая no-sale модель перевода подтверждена владельцем.
- [REQ-BRN-001](/docs/requirements/09-филиалы-и-настройки.md) — constrains.
- [TASK-191](/backlog/implementation/TASK-191-administrator-client-branch-access.md).

## Контекст

Право роли на действие сейчас не всегда дополняется проверкой конкретного
клиента. Общий список, карточка, фото, mutations и Bot API используют разные
guards. После перевода ответ и идемпотентный replay могут вернуть полную
карточку клиента, который уже находится вне охвата инициатора.
[Review](/backlog/logs/TASK-191-authorization-review-2026-10-24.md) фиксирует
producer/consumer evidence и историю закрытия вопросов. Владелец 24.10.2026
подтвердил текущую no-sale модель перевода и скрытие чужих клиентских счётчиков
при сохранении справочников (Product decisions TASK-191).

## Критерии выбора

- Backend проверяет право на действие и охват текущего клиента отдельно.
- Client scope не равен attendance grants; права Coach и глобальных ролей сохраняются.
- Скрытые клиентские данные не попадают в DTO, счётчики, ошибки, файлы и replay.
- Перевод авторизуется по исходному клиенту; новый филиал не делает перевод невозможным.
- Проверки применимы к Staff и Bot API без новой схемы БД и глобального EF query filter.

## Рассмотренные варианты

### Вариант A: Локальные guards с сохранением разных отказов

Минимальная правка каждого handler: часть endpoints возвращает 403, часть —
404. Меньше изменений transport types, но дублируются правила и остаётся
риск расхождения SQL-фильтра, прямого обращения и replay. При полном покрытии
вариант допустим, однако сопровождение матрицы сложнее.

### Вариант B: Общая Application policy и скрытие чужого клиента через 404

Application задаёт решение actor/action/client и описание scope;
Infrastructure применяет его к запросам и загрузкам; API отображает результат.
Фильтрация до pagination/aggregation, проверка перед mutation и перед выдачей
ответа используют одну семантику. Неавторизованный объект неотличим от
отсутствующего для Administrator. Цена — согласованное изменение отказов,
transfer response и consumer regression. **Принято владельцем 24.10.2026.**

### Вариант C: Общая policy, но 403 для существующего чужого клиента

Сохраняет различение missing/forbidden, знакомое по части существующих API;
ошибки проще диагностировать. Раскрывает факт существования переданного ID.
Это допустимая альтернатива только при явном принятии такой границы владельцем.
Не снимает необходимости защитить transfer/replay и вторичные списки.

## Решение

Принят вариант B по ответу владельца «2. согласно рекомендации» от 24.10.2026.
Пункт 1 сохраняет текущую модель перевода, пункт 3 принимает описанный UX.
Этот ADR заменяет ADR-0002: весь его контракт branch/hall actions, outer guards,
shared lookup availability, session surface, audit и rollback сохраняется по
[исходной записи](/docs/architecture/adr/0002-branch-settings-action-contract.md),
кроме видимости foreign client counts — они скрываются согласно REQ-USR-001.
TASK-190 не переоткрывается; изменяемые client-bearing projections входят в TASK-191.

### Policy и порядок проверок

- Источник actor — текущая запись пользователя, а не body/query/устаревшая
  frontend session. Administrator с null/empty BranchId не получает глобальный scope.
- Клиентская выборка Administrator: только `Client.BranchId == actor.BranchId`;
  без филиала — пустая выборка. HeadCoach/SA — прежний global, Coach — прежние
  effective groups и замещения; прежний ролевой срез чувствительных полей сохраняется.
- SQL-фильтр применяется до counts, quick filters, paging и формирования
  membership/attendance/group/messenger projections; собственная проверка
  action/grant остаётся обязательной. Историческая связь со старым филиалом
  не разрешает читать клиента после перевода. Ошибка изменения/деактивации
  группы сохраняет domain запрет, но не раскрывает чужие client/sale/membership
  blocker details; скрытие blocker не делает mutation разрешённой.
- Существующие outer auth, CSRF, binding и action permissions сохраняются.
  Затем — текущий actor/scope, адресуемый клиент, payload/domain validation,
  изменения и audit. Чужой body branchId не может легализовать чужой clientId.
- Для by-ID Administrator чужой и отсутствующий клиент дают одинаковый 404
  без идентификаторов, имён и field details. Staff — существующий NotFound;
  Bot — существующий BotApiError.NotFound. Coach/global отказы не унифицируются.
- Create Administrator: только свой target BranchId; без actor branch или с
  чужим/пустым target — 403 `branch_scope_forbidden` через StaffProblemDetails
  до проверки существования чужого филиала. Own target сохраняет domain validation.
  Update сначала проверяет persisted client, затем неизменность BranchId;
  смена филиала через обычный PUT остаётся ошибкой validation.
- Перед записью повторить scope check на актуальном actor/client в границе
  транзакции, согласованной с конкурентным переводом и сменой назначения.
  Никаких entity/audit/file/outbox side effects при отказе; служебный access-denied
  audit бота сохраняется. External dispatch не выполняется до разрешённой записи.

### Transfer и replay

- Новый перевод доступен только для исходного клиента в текущем scope.
  Справочники целей не считаются правом на клиента; target validation сохраняется
  в принятой no-sale модели REQ-CLI-007: assignment transfer с optional groups;
  затрагивание active/future targets → прежний conflict без записи.
- После commit заново проверить право на выдаваемый объект. При сохранении
  доступа — прежний 200 с карточкой; при утрате доступа инициатором — 204
  без DTO. Это успешный перевод, а не ошибка последующего GET.
- Только завершённый transfer record того же actor, client, action и payload
  допускает безопасное подтверждение повторного запроса без нового перевода.
  При утраченном scope replay даёт 204; при сохранённом — авторизованный DTO.
  Новый ключ не обходит запрет на уже чужого клиента. Повтор не возвращает
  ранее сохранённую PII и не добавляет audit/assignment/sale.
- Для остальных mutations, messenger send replay и Bot attendance replay проверять текущие action/scope
  до выдачи результата; потеря доступа не разрешает вернуть старый response.
  Pending/conflict/TTL остаются существующими, содержимое отказов не раскрывает клиента.

### Сериализация доступа и внешних эффектов

Эта детализация подготовлена Codex и проверена отдельным backend review в
рамках принятой границы доступа; новых ролей, разрешений, schema или
продуктовых вариантов она не вводит.

- Порядок PostgreSQL locks: затрагиваемые Branches по ID → Users по ID →
  TrainingGroups по ID → существующие grants → Clients по ID → связанные
  membership/target записи. Пропуск неиспользуемых категорий допустим;
  брать более раннюю категорию после поздней нельзя. Учитываются существующие
  порядки StaffManagementMutationService, AttendanceService и grant service.
- Actor read использует FOR SHARE, изменение client — FOR UPDATE. После locks
  загружать актуальные данные без старого EF tracking; повторно проверить
  role/activity/BranchId и client.BranchId, а для attendance ещё grant.
  Изменившийся набор branch/group locks требует rollback и повторной подготовки
  до любых эффектов. Request cancellation и существующие конечные DB/network
  timeouts сохраняются; ошибки ожидания не превращаются в разрешение.
- Фото upload: подготовить байты, получить actor/client locks, проверить доступ,
  записать новый файл, сохранить metadata и commit. Старый файл удаляется после
  подтверждённого commit. При подтверждённом rollback удалить новый файл;
  при неопределённом commit сначала проверить persisted PhotoPath. Отказ
  доступа не создаёт файлов. Существующие size/format contracts сохраняются.
- Фото GET: под read locks actor/client получить независимый снимок текущего
  файла в рамках существующего storage size contract. Не оставлять отложенное
  чтение исходного пути после освобождения locks. Момент допуска — получение
  снимка; завершившийся раньше transfer/reassignment исключает доступ. Уже
  допущенные байты и ранее отправленные сообщения не отзываются ретроспективно.
- Messenger send: отдельный scoped DbContext держит read transaction с
  Users FOR SHARE → Clients FOR SHARE через проверку, transport call и
  построение response. Основной DbContext независимо сохраняет существующий
  Sending до Telegram и фиксирует результат. SHARE совместим с FK KEY SHARE;
  FOR UPDATE в отдельном lease на этих строках использовать нельзя.
  Перевод/reassignment ждёт завершения допуска к отправке, либо завершается
  раньше и новый guard запрещает send. Scope после commit не берётся из cache.
- Lease всегда освобождается в finally. Существующий конечный HttpClient timeout
  и cancellation ограничивают ожидание; дополнительное соединение живёт только
  внутри send. Sending не откатывается при сетевой ошибке/отмене; replay с тем же
  ключом не повторяет Telegram call. Rollback БД не отменяет внешнюю отправку.
  Совпадающие keys используют существующий unique barrier и результат winner.
- Replay получает актуальный read scope до возврата сохранённых данных.
  Обычные reads строят scoped snapshot, а финальный DTO mutation/transfer
  повторно авторизуется; уже допущенный snapshot не переопределяет права
  последующего запроса. In-memory тестовый provider не считается доказательством
  сериализации: для этого обязательны PostgreSQL barriers из плана.

### Consumers

- Frontend различает 200 и 204 по backend response. На 204 закрывает перевод,
  очищает карточку и вложенные данные, показывает существующее уведомление об
  успехе и возвращает в исходный список с перезагрузкой. Не делает fallback GET.
- На client-scoped 403/404 после загрузки или mutation очищает ФИО в заголовке,
  фото, формы, membership/chat, закрывает overlays и показывает существующий
  error state с возвратом. Ошибки валидации и сетевые сбои не выдают за утрату scope.
  Отсутствие отдельного фото, sale или chat resource не тождественно утрате
  доступа к клиенту: при неоднозначном nested 403/404 повторно запросить parent
  card и очищать всю карточку лишь при её отказе; 204 transfer не вызывает GET.
  Поздние ответы старого запроса не восстанавливают данные после отказа.
- Bot использует текущий backend read на callback, отображает безопасный 404
  и заменяет старое сообщение без прежних кнопок. 403 сохраняет существующий
  FORBIDDEN_MESSAGE и access-denied audit. Уже отправленные Telegram сообщения
  не обещается удалять ретроспективно.

## Последствия

Закрываются direct-ID и replay обходы, правила централизуются без переноса
бизнес-логики в consumers. Отрицательная сторона — изменение статусов ответов
для существовавших обходов; старый frontend может воспринять успешный 204 как
ошибку своего fallback GET. Требуется совместное обновление frontend.
Пользователь изменил продуктовую часть shared-read contract ADR-0002:
чужие клиентские агрегаты скрываются. Используется nullable `clientCount`
для shared branch/group lookup DTO; frontend не нормализует null в ноль
и не рисует скрытый показатель. Own/global counts сохраняются. ADR-0002 заменён этой записью с сохранением остальных ограничений, session
actions и shared lookups TASK-190. Цена messenger serialization — дополнительное
соединение и read locks на время ограниченного transport timeout.

## Cross-layer impact

- Backend: Application policy, Infrastructure queries/services, Staff/Bot result mapping,
  idempotency, транзакционные guards; без общей декомпозиции BotApiService.
- Frontend: clients API return type/facade и все card/edit/preview/chat consumers;
  nullable aggregate mapping без подмены скрытого значения нулём.
- Bot: 404 mapping, callbacks, error rendering и tests; CRM-фильтров в Python нет.
- Deploy/runtime: схема, env и topology не меняются; deployment не входит в TASK-191.
- Shared contracts: ограниченные выборки, 404/403, transfer 204, safe replay;
  общий справочник филиалов/залов сохраняется как источник вариантов.

## Migration and rollback

Миграция не предполагается. Если existing idempotency records недостаточны для
safe replay, требуется новый review до изменения schema. Старые records читаются
без выдачи чужих данных. Consumer update синхронизирован с backend contract.
Предпочтителен forward fix: откат backend guards вновь откроет доступ к PII.
Данные клиентов, продаж, audit и истории назначений сохраняются.

## Validation

HTTP matrix всех поверхностей из review; DB/file/outbox no-side-effects на отказ;
PostgreSQL interleavings transfer/write и actor reassignment; original/replay
transfer с новым и прежним ключом; реальные Staff/Bot requests с двумя филиалами;
frontend и bot stale-card tests. Конкретные сценарии — в
[плане](/backlog/implementation-plans/TASK-191-administrator-client-branch-access.plan.md).

## Open questions

Нет. Материальные новые факты возвращают affected plan в planning.

## Approval

Accepted (пользователь, владелец продукта, 2026-10-24).
Ответ владельца на три вопроса: «1. сохранить текущую модель; 2. согласно
рекомендации; 3. согласно рекомендации». Приняты no-sale transfer, вариант B
с 404/204/safe replay и existing error/success/back UX; ранее отдельно принято
скрытие foreign client counts при сохранении общего справочника.
[Точная запись решения](/backlog/implementation/TASK-191-administrator-client-branch-access.md).
Lock ordering/read lease — техническая детализация Codex в рамках этого
контракта, проверенная [backend review](/backlog/logs/TASK-191-authorization-review-2026-10-24.md).
