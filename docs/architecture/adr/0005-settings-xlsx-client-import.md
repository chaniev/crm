# ADR-0005: Импорт XLSX из настроек с явным названием группы

- **Статус:** Proposed
- **Дата:** 2026-11-15
- **Автор / владелец:** Codex / пользователь, владелец проекта

## Связанные требования

- [REQ-CLI-010](/docs/requirements/01-клиенты.md) — implements.
- [REQ-BRN-002](/docs/requirements/09-филиалы-и-настройки.md) — changes.
- REQ-CLI-001, REQ-CLI-003, REQ-CLI-005, REQ-CLI-006 — constrains, реестр клиентов.
- REQ-BRN-001, [REQ-AUD-001](/docs/requirements/06-аудит.md) — constrains.
- [REQ-USR-001](/docs/requirements/05-пользователи-и-роли.md) — changes.
- [TASK-196](/backlog/needs-clarification/TASK-196-xlsx-client-import.md),
  [план](/backlog/implementation-plans/TASK-196-xlsx-client-import.plan.md).

## Контекст

Владелец заменил CLI вкладкой «Настройки → Импорт»: пользователь выбирает
XLSX и указывает название группы. Имя файла больше не выбирает группу.
Последующим решением импорт ограничен SuperAdministrator с обязательным
выбором филиала и Administrator только своего филиала; HeadCoach исключён.
Это принятые продуктовые решения; новый технический контракт ниже Proposed.
[ADR-0004](0004-atomic-xlsx-client-import.md) сохраняется как история принятой
CLI-архитектуры, заменяется этим ADR. Приложение по нему ещё не реализовано.

Текущие executable sources:
- `frontend/src/features/settings/SettingsScreen.tsx` и `.test.tsx`: вкладки
  с `keepMounted={false}`, существующие capability gates и текущая сессия.
- `frontend/src/lib/appRoutes.ts`, `appRoutes.test.ts`: Settings использует
  backend allowedSections/canManageSettings; новый AppSection не требуется.
- `frontend/src/lib/api/auth.ts`, `types.ts`: текущий canManageClients шире
  нового разрешения импорта; нельзя использовать его как import gate.
- `frontend/src/lib/api/transport.ts`: FormData, cookie/CSRF и один fetch;
  import extensions требуют additive error mapping, не отдельного HTTP-клиента.
- `backend/tests/GymCrm.Tests/AuthorizationFlowTests.cs`, текущая role policy:
  Administrator/HeadCoach/SuperAdministrator имеют ManageClients; Coach нет.
  Новый запрет HeadCoach требует отдельного backend capability для импорта.
- ClientLifecycleEndpoints, ClientAccessTransaction и PostgreSQL tests:
  общий create, scope locks и обязательный audit остаются границей записи.
Подробности проверки: [review](/backlog/logs/TASK-196-technical-review-2026-11-15.md).

## Критерии выбора

- Весь файл и его аудит фиксируются одной backend-транзакцией.
- Название группы передаётся явно; переименование файла ничего не меняет.
- Права и validation принадлежат backend; отдельный import capability в
  существующей policy, без новой системы авторизации или входа.
- Существующий settings/API-client используется без CLI, очереди и новой БД-схемы.
- Сетевой сбой и уход со страницы не превращаются в повтор или ложный rollback.

## Рассмотренные варианты

### A: Браузер разбирает XLSX и создаёт клиентов по строкам

Не выполняет атомарность файла: поздний отказ оставляет ранние записи.
Дублирует mapping и CRM-validation во frontend; компенсационное удаление
не восстанавливает историю. Отклонён по REQ-CLI-010.

### B: Settings-форма передаёт XLSX и groupName backend batch — рекомендуется

Минимально меняет согласованную backend-модель ADR-0004: новый consumer вместо
CLI, явное имя группы вместо basename. Отдельное разрешение ограничивает
импорт двумя ролями без сужения обычного создания клиентов. Требует UI,
typed multipart/error mapping, session scope и регрессий browser recovery;
не требует новых login flow, schema или сервисов.

### C: Веб-форма запускает CLI или отдельную фоновую задачу

Добавляет процесс/очередь, отдельное состояние задания и deployment boundary
без потребности в пределах 1000 строк. Существующий endpoint обеспечивает
нужный атомарный сценарий. Отклонён как избыточный для текущих требований.

## Решение

Предлагается B. Утверждённые пользователем изменения продукта не считаются
автоматическим approval всех деталей этого технического предложения.

### Frontend и доступ

- Добавить `CrmCapability.ImportClients` и HTTP policy `gym-crm.import-clients`
  в существующую backend authorization policy. Доступ только активным
  SuperAdministrator/Administrator, HeadCoach/Coach запрещены. ManageClients
  продолжает обслуживать обычные операции и не используется как import gate.
- Auth/session возвращает additive `clientImportScope`:
  `{ kind: 'None' | 'SelectBranch' | 'OwnBranch', branchId: UUID | null }`.
  Backend отдаёт SelectBranch для SuperAdministrator, OwnBranch с текущим
  branchId для Administrator, None для запрещённых ролей/неактивного пользователя. OwnBranch/null
  означает отсутствие назначения и недоступный импорт, не глобальный охват.
  Не добавлять дублирующий canImportClients в PermissionSet.
- Вкладка «Импорт» внутри Settings использует backend scope; отсутствующий,
  неизвестный или некорректный scope безопасно трактуется как None.
  Нет локальных role switches. Existing Settings route gate сохраняется.
- SelectBranch: обязательный выбор филиала до отправки, список из существующего
  branch lookup. OwnBranch: текущий филиал отображается как фиксированный,
  чужой выбрать нельзя; без назначения показана причина недоступности.
- Остальная форма: один XLSX, обязательное «Название группы», запуск.
  Имя файла не заполняет группу. Браузер не разбирает строки или бизнес-правила.
- Существующие cookie/CSRF и password-change gate сохраняются. Нового входа,
  CLI-проекта, AppSection или API для создания группы нет.

### Transport и поиск группы

- `POST /clients/import-xlsx`, multipart: `file`, обязательный `groupName`,
  обязательные UUID `branchId` и `operationId`.
- SuperAdministrator обязан передать branchId: без него 400, backend не
  угадывает филиал даже для уникального названия группы. UI Administrator
  автоматически передаёт branchId из backend OwnBranch scope; изменить его
  в форме нельзя. Backend проверяет соответствие текущему назначению:
  чужой branchId — 403 до раскрытия существования; без назначения — 403.
  Отсутствующий branchId — 400 для обеих ролей, целевой филиал не угадывается.
  Существующая валидация активного филиала сохраняется для обеих ролей.
- `groupName` очищается от внешних пробелов, затем точно сопоставляется
  с существующим названием; пустое значение — 400. Внутренние пробелы,
  регистр и содержание не исправлять эвристически. Поиск всегда ограничен
  выбранным/собственным филиалом. Одинаковые имена в других филиалах не
  влияют на выбор; ноль/несколько совпадений внутри целевого — отказ.
- filename используется только как атрибут загрузки/формата XLSX, не как
  доменное поле или источник названия группы. Нет fallback к basename.
- Браузер создаёт operationId для каждого осознанного запуска и сохраняет
  до отправки. Это корреляция, не idempotency key и не гарантия exactly-once.
- Успех после commit: `200 { operationId, createdCount }`.
  Подтверждать успех только при валидных совпадающем operationId и целочисленном
  createdCount в диапазоне профиля; malformed/non-JSON 2xx — неопределённый исход.
  Import handler после чтения корректного operationId возвращает существующий
  ProblemDetails с `operationId`, `code`, `issues: [{ row, field, code, message }]`;
  row/field могут быть null, номера строк включают заголовок Excel.
  `field: groupName` адресует поле формы, ошибки файла — файл/строки.
- 400 — данные/выбор группы; 401/403 — текущие отказы доступа; 409 — смена
  выбранной группы; 413 — лимит; 5xx — внутренняя ошибка. Штатные CSRF/auth/
  framework/proxy ответы могут не иметь extensions или JSON; не менять
  общий middleware ради import. Сообщения не содержат значения ячеек.
- Расширить typed API error mapping для optional operationId/issues, сохранив
  прежнее поведение других consumers. Использовать общий FormData transport,
  не выставлять JSON Content-Type и не вводить retry POST.

### Чтение, транзакция и аудит

- Сохраняется профиль ADR-0004: Infrastructure reader через закреплённый
  DocumentFormat.OpenXml; лист «Клиенты», A:J, shared/inline strings,
  числовой баланс, ДР текст ДД.ММ.ГГГГ/пусто. Пустые строки пропускаются
  с исходной нумерацией; формулы и неподдерживаемые данные дают отказ.
- Лимиты прежние: 512 KiB XLSX, 768 KiB body, 8 MiB фактически распакованных
  частей, 1000 непустых строк. Не загружать external links, не сохранять
  workbook постоянно; штатные временные buffers освобождаются после запроса.
- Parser/normalization выполняются до locks, все диагностируемые ошибки
  собираются до записи. Общий create use case используется batch и обычным
  созданием; CLI и frontend не дублируют доменные правила.
- Одна ClientAccessTransaction, locks Branches → actor → TrainingGroups;
  после ожидания повторно проверить actor active/ImportClients capability,
  scope/текущий филиал Administrator и обязательный выбор SuperAdministrator, groupName,
  филиал и валидность всех строк. Смена Administrator филиала не переносит
  уже отправленный файл молча в новый филиал: отклонить stale selection.
  Смена разрешённой роли на HeadCoach блокирует запись, хотя ManageClients остаётся.
  Не вводить active-group запрет: текущий
  create требует активный филиал, не активную группу. Scope/lock drift — отказ.
- Clients, ClientGroups, периоды назначений, note metadata, ClientCreated и
  ClientNoteChanged сохраняются в одном scoped DbContext/transaction.
  Итоговый `ClientImportCompleted`, entity `ClientImport`, EntityId=operationId,
  NewValueJson={operationId,createdCount,clientIds}, source=Web — в ней же.
  Ошибка записи или любого аудита откатывает весь файл. Обычный клиентский
  audit сохраняется; summary не копирует workbook/телефоны/комментарии.
- Глобальная уникальность названия при конкурентном создании группы и новые
  глобальные locks не добавляются; применяется существующий ADR-0003 boundary.

### Состояние операции и восстановление

- Пока запрос выполняется, повторная отправка и изменение его параметров
  заблокированы. Состояние pending/result/operationId хранится выше
  размонтируемой Tabs.Panel; переключение вкладки не запускает второй запрос
  и не теряет результат в пределах живой страницы Settings.
- Сетевой обрыв, timeout или 5xx после отправки — «Результат импорта не
  подтверждён», с номером операции и инструкцией сверки. Не показывать
  «ничего не записано» и не предлагать автоматический повтор.
- Уход со страницы/перезагрузка не являются отменой серверной транзакции.
  Файл и клиентские данные не записываются в localStorage/sessionStorage;
  постоянного browser ledger не вводится. Перед уходом из pending/unknown
  состояния UI предупреждает о необходимости сохранить номер операции;
  точная навигация/feedback фиксируется выбранным UX-контрактом до readiness.
- HeadCoach/SuperAdministrator сверяет actor/action/time/operationId в текущем
  журнале. Administrator получает понятную инструкцию обратиться к такой роли,
  не новое право аудита. Потерянный при reload номер ищется по actor/time/action;
  отсутствие summary до завершения запроса не доказывает rollback.
- Успех сообщает createdCount; новый осознанный запуск создаёт новые карточки.
  Проверка исхода и запрет слепого повтора сохраняют семантику ADR-0004.

## Последствия

Сохраняются atomicity и аудит; отдельное разрешение реализует новые роли импорта; сотрудник работает в CRM без локальной
установки CLI и переименования файлов. Цена: полноценный UI workflow, typed
ошибки и навигационное состояние, mobile/desktop тесты. Browser reload может
потерять локальный ID, поэтому восстановление остаётся ручным через аудит;
exactly-once и автоматическое возобновление не обещаются.

## Cross-layer impact

- Backend: ImportClients policy, auth/session scope, groupName request,
  branch resolution и повторная проверка группы/доступа, reader, общий
  create, batch handler, audit и HTTP/PostgreSQL coverage.
- Frontend: Settings tab/panel/state, API DTO/facade/transport error mapping,
  локализация, отображение audit event и Playwright; выбранный дизайн обязателен.
- Bot: отдельный BotUserContext не потребляет Staff auth scope; его contract
  не меняется, импортированные клиенты обычные. Нового bot import endpoint нет.
- Deploy/runtime: без новых env/services/schema. Frontend и backend доставляются
  согласованно; deployment и импорт реальных данных отдельно от планирования.
- Public contracts: новый multipart Staff API, additive auth/session
  clientImportScope и optional import error extensions;
  Application DTO path при необходимости добавить в harness contract selector.

## Migration and rollback

Миграций БД нет. Прежний CLI/import endpoint ещё не реализован, поддерживать
legacy filename-based request не требуется. Успешный импорт сохраняется при
откате версии приложения; удаления клиентов/аудита не выполнять. До commit
ошибка откатывает файл. После неизвестного commit сначала сверка итогового
аудита после завершения запроса, затем решение о новой независимой операции.

## Validation

- HTTP + PostgreSQL: явный groupName побеждает произвольное имя файла;
  ambiguous/no group/scope drift, late write/audit failure → нулевой прирост.
- Mapping всех 114 обезличенных профилей и текущие create regressions сохранены.
- Frontend: FormData/cookie/CSRF, полные issues/non-JSON, один POST на двойной
  клик, pending через переключение вкладок, uncertain после обрыва/ухода.
- Authorization matrix: SuperAdministrator с выбранным/без/архивным филиалом;
  Administrator свой/чужой/нет назначения; HeadCoach/Coach 403, anonymous 401.
  Login/session mirror: scope, fail-closed отсутствующее/невалидное значение;
  revoked access/SA→HeadCoach/Admin смена филиала после locks.
- Settings backend scope gate и неизменность соседних вкладок;
  Playwright основного/ошибочного/restricted путей mobile/desktop, новый audit.
- Runtime comparison с выбранным UI-контрактом после реализации; сейчас
  приложение и browser runtime не запускались.

## Open questions

- Владелец принимает либо уточняет предложенный веб-контракт ADR-0005.
- Владелец выбирает rendered направление и interaction/recovery контракт
  вкладки. Это planning blocker, не шаг будущей реализации.

## Approval

Pending. Пользователь 15.11.2026 явно принял Settings/XLSX/название группы
и последующее ограничение ролей/филиала
в [Product revision TASK-196](/backlog/needs-clarification/TASK-196-xlsx-client-import.md#product-revision--2026-11-15).
Это основание изменения требований; отдельного принятия ADR-0005 и визуального
контракта пока нет. Исторический approval ADR-0004 не переносится автоматически.
