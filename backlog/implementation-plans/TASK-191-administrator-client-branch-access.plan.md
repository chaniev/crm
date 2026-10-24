# Implementation Plan: TASK-191 Доступ администратора к клиентам своего филиала

## Metadata
- source_task: /backlog/implementation/TASK-191-administrator-client-branch-access.md
- requirements: REQ-USR-001 (changes), REQ-CLI-007 (changes), REQ-CLI-009 (constrains), REQ-BRN-001 (constrains)
- branch: codex/TASK-191-administrator-client-branch-access
- readiness: yes
- product_decisions: accepted
- technical_decisions: accepted
- architecture_decisions: ADR-0003
- open_questions: none
- dependencies: TASK-190 и TASK-192 завершены; TASK-132 не блокирует, но при параллельной декомпозиции BotApiService требуется согласовать владение файлами
- risk: high — пропуск вторичного списка, файла, повторного запроса или гонки перевода раскрывает PII либо разрешает чужую mutation

## Goal
Администратор видит и изменяет только клиентов текущего собственного филиала
через Staff и Internal Bot API, включая связанные данные и производные
списки. Разрешённый перевод завершает операцию без раскрытия карточки после
утраты доступа; другие роли сохраняют действующие полномочия.

## Decisions and contracts
- Ограничение чтения и действий Administrator уже принято в REQ-USR-001.
  Права на действие и scope конкретного клиента проверяются независимо.
- Coach остаётся в scope effective assigned groups, включая активные замещения;
  HeadCoach/SuperAdministrator сохраняют глобальный доступ в рамках своих прав.
- Backend — владелец решения. Клиентские branchId/userId, справочники целей,
  grant на attendance и сохранённая session не расширяют client scope.
- Foreign client counts скрываются при сохранении общих lookup филиалов/залов
  (прямой ответ пользователя 24.10.2026); это применимо и к secondary lists.
- Принят точный HTTP/SQL/transaction/replay/consumer contract из
  [ADR-0003](/docs/architecture/adr/0003-administrator-client-branch-scope.md),
  включая lock ordering, photo snapshots и messenger read lease.
- REQ-CLI-007 приведена к подтверждённой no-sale модели: перевод назначений
  без продажи/возврата/переоформления, optional target groups, прежний conflict
  при затрагивании active/future membership targets. Финансовая модель сохраняется.
- Общие lookup филиалов/залов сохраняются. Foreign clientCount — null;
  frontend скрывает показатель, не превращая его в ноль.

## Decision evidence
- product: [REQ-USR-001](/docs/requirements/05-пользователи-и-роли.md) — owner: пользователь, владелец продукта; decision: 24.10.2026 ограничить просмотр и действия Administrator клиентами своего филиала в CRM и Telegram.
- product: [TASK-192](/backlog/done/2026-10-24/TASK-192-coach-client-branch-scope.md) — owner: пользователь, владелец продукта; decision: тренеру доступны только клиенты своих групп; совпадение филиала не даёт дополнительного доступа.
- technical: [ADR-0003](/docs/architecture/adr/0003-administrator-client-branch-scope.md) — owner: пользователь, владелец продукта; decision: ответ «2. согласно рекомендации» 24.10.2026 принимает вариант B с 404/204/safe replay; Codex завершил техническую детализацию locks/lease в пределах этой границы.
- product: [TASK-191, Product decisions](/backlog/implementation/TASK-191-administrator-client-branch-access.md) — owner: пользователь, владелец продукта; decision: 24.10.2026 скрывать чужие клиентские счётчики, сохранив общий справочник.
- product: [TASK-191, Product decisions](/backlog/implementation/TASK-191-administrator-client-branch-access.md) — owner: пользователь, владелец продукта; decision: ответ «1. сохранить текущую модель; 3. согласно рекомендации» принимает no-sale transfer и очистку карточки/уведомление/возврат при утрате доступа.
- review: [Authorization matrix](/backlog/logs/TASK-191-authorization-review-2026-10-24.md) — статическое evidence текущего кода; runtime и новые regression tests при планировании не выполнялись.

## UX contract
Подтверждена локальная адаптация существующих компонентов; направление и
interaction specification закреплены в [UI evidence](/backlog/mockups/TASK-191-client-scope/README.md).
Rendered fixture states осмотрены на 390, 420, 440 и 1440 px; это planning
preview, не доказательство реализованного перехода по 204. Новых экранов и
редизайна нет. Во время реализации проверяется соответствие этому контракту.

## Scope
### In
- Все client-bearing поверхности матрицы review: основные и вторичные чтения,
  lifecycle, фото, membership operations, messenger, attention и attendance.
- Проверка current actor/client, фильтрация до paging/counts, source/target
  guards, no-side-effects на отказ и reauthorization перед replay/ответом.
- Frontend и bot mapping отказов, очистка stale data и разрешённый перевод;
  task-specific verification contract и evidence при реализации.

### Out
- Расширение доступа Coach, новые attendance grants, изменение доступа к Coach accounts.
- Переписывание BotApiService по TASK-132, новые CRM-функции, schema/env/topology.
- Deployment, массовое изменение данных, ретроспективное удаление уже показанных
  пользователю данных или отправленных Telegram-сообщений.

## Implementation slices
Каждый функциональный slice начинается с перечисленного regression test и
соответствующего expected red.

1. **Application policy и основные чтения.** Общая scope semantics с использованием
   existing role/effective-group boundaries; Staff list/card/expiring и Bot
   search/card/expiring; SQL scope до counts/quick filters/paging и projections.
   Собственный scope без групп работает; null BranchId закрывает доступ.
2. **Остальные read/write поверхности.** Применить guards ко всем строкам matrix:
   lifecycle create/update/archive/restore, photo read/upload, membership
   preview/purchase/renew/correct/target-transfer/refund/comment/cancel,
   messenger summary/history/link/send/read, attention, group/attendance
   client projections, group mutation conflict details и клиентские агрегаты. Сохранить outer
   permissions, domain validation и grants; не ограничивать shared lookups
   простым исключением чужих филиалов.
3. **Перевод, конкурентные записи, replay.** Реализовать согласованный source/target
   и response contract; recheck в транзакции; безопасный original/replay ответ.
   Закрыть Staff membership replay и Bot attendance replay после смены филиала
   или actor assignment. Доказать no-write/no-file/no-outbox на отказ,
   отсутствие дублей audit и сохранение истории при успешном переводе.
4. **Consumers.** Синхронизировать API types/mappers/facade, card/edit/list preview,
   photo/chat/membership actions и transfer handler с утверждённым ответом.
   Отменять/игнорировать старые responses после потери доступа. Bot различает
   client unavailable и unconfigured Telegram user; старые callback-кнопки
   заменяются безопасным результатом. Права не вычисляются в TS/Python.
5. **Интеграционное подтверждение и registry.** Выполнить task-specific runtime
   и consumer scenarios, сверить реализацию с matrix и выбранными rendered
   состояниями. Актуализировать evidence затронутых REQ и CHANGELOG;
   широкую REQ-USR-001 не объявлять полностью реализованной по одной задаче.

## Likely files and layers
- `backend/src/GymCrm.Application/Authorization/` — новая focused policy рядом
  с `UserRoleAuthorizationPolicy`; переиспользование effective group contracts.
- `backend/src/GymCrm.Infrastructure/Authorization/` — применение scope к queries
  и операциям; registration в существующем composition root.
- `backend/src/GymCrm.Api/Auth/ClientQueryEndpoints.cs`, `ClientLifecycleEndpoints.cs`,
  `ClientLifecycleRequestValidation.cs`, `ClientEndpointSharedHelpers.cs`,
  `ClientMembershipEndpoints.cs`, `ClientPhotoEndpoints.cs`, `ClientAttentionEndpoints.cs`,
  `ClientMessengerEndpoints.cs` — guards, typed results, projection и replay.
- `backend/src/GymCrm.Infrastructure/Clients/ClientPhotoService.cs`, membership services;
  `backend/src/GymCrm.Infrastructure/Messenger/ClientMessengerService.cs` — проверки
  до file/CRM/message side effects; без дублирования role matrix.
- `backend/src/GymCrm.Infrastructure/Bot/BotApiService.cs`, `BotIdempotencyService.cs`,
  `backend/src/GymCrm.Api/Auth/BotInternalEndpoints.cs` — reads, roster и replay.
- Group/Attendance/Branch endpoints, Application/Infrastructure Attendance и
  schedule projections из matrix — вторичные списки, historical roster и counts.
- `frontend/src/lib/api/clients.ts`, `types.ts`, `branches.ts`, `groups.ts`,
  `frontend/src/lib/api.ts`; client detail/edit/preview/chat/photo components —
  backend response handling; nullable counts по принятому запрету раскрывать foreign aggregates.
- `bot/src/gym_crm_bot/crm/client.py`, `crm/errors.py`, `core/crm_error_mapping.py`,
  `core/client_flow.py`, `core/attendance_flow.py` — безопасные callbacks/errors.
- `frontend/playwright.config.ts` — включить новый spec в explicit testMatch
  target-iPhone проектов; одного имени проекта в contract недостаточно.
- Новые task-specific tests/verification artifacts и docs/requirements — evidence;
  список точных текущих test files приведён ниже.

## Regression specification
### Automated tests to add or update
- Новый `AdministratorClientScopeApiTests.cs`: две ветки, A/B administrators,
  null-branch actor, grouped/ungrouped, active/archived clients. ФИО/телефон,
  прямой ID, photo, totals/status counts/quick filters, page/skip/take,
  foreign group/query filters. Никаких чужих IDs, PII или counts в body/headers.
- `ClientsApiTests.cs`: create foreign target; чужие update/archive/restore;
  own client с попыткой менять BranchId обычным PUT; own target validation;
  membership endpoints со смешанными client/membership/sale/refund IDs,
  preview и expired idempotency records. Проверять DB state и audit до/после.
- `InternalBotApiTests.cs`: search/card/expiring/roster own/foreign/null-branch;
  те же Telegram identity после смены BranchId; запрещённый attendance batch
  и повтор сохранённого результата после изменения доступа. Старые removed
  payment endpoints сохраняют прежний отказ и не превращаются в новый write API.
- `ClientMessengerApiTests.cs`: summary/messages/unread/latest preview/token/send/read
  чужого клиента закрыты; replay ранее отправленного сообщения после утраты
  scope не возвращает текст. Ни token, ни read-state, ни outbox/message не создаются;
  гонка send/file против transfer проверяет согласованную границу авторизации.
- Фото: own success, foreign read/upload, прямая photo URL и multipart request;
  storage не читается/не изменяется на отказ; `private, no-store` сохраняется.
- `GroupsApiTests.cs`, `AttendanceApiTests.cs`, `AdministratorAttendanceGrantApiTests.cs`:
  secondary rosters/counts/history после перевода, current и historical dates;
  подмена clientId в batch; group deactivation/update conflict не раскрывает
  чужие ФИО/ID/sale/target details, сохраняя domain запрет; grant не разрешает
  чужого клиента, отсутствие
  grant не компенсируется своим филиалом. Контроль schedule/worklist projections.
- Новые PostgreSQL сценарии в focused scope suite: transfer A→B против write A;
  actor reassignment против write/replay; reloaded client state перед commit;
  original/replay same key → один audit и assignment transition, new key → denial;
  отказ audit/persistence → полный rollback обычной CRM mutation, отсутствие
  оставшейся reservation. Для messenger Sending остаётся durable: paused fake
  transport доказывает его видимость из второго соединения; отмена/ошибка и
  совпадающие keys не дают повторного dispatch. Transfer/reassignment ждут send
  либо выигрывают раньше и запрещают эффект. Cross-branch lock order не deadlock.
  Фото: rollback cleanup, неопределённый commit без удаления сохранённого файла,
  независимый snapshot и read до/после перевода. Проверки используют barriers,
  а не предположение о последовательности по задержкам.
- `ClientMembershipWriteRegressionApiTests.cs` сохраняет выбранную владельцем
  семантику перевода; текущий no-sale test — evidence для решения P1.
- `ClientsApiTests.cs` и `InternalBotApiTests.cs`: HC/SA global positive controls,
  Coach own group/active substitute/expired substitute и sensitive-field redaction.
- `frontend/src/features/clients/ClientManagement.test.tsx`, preview/chat tests,
  API client tests: 200/204, initial 404, action 403/404 после загрузки, поздний
  200 после denial, сохранение обычных validation errors, очистка title/photo/forms
  и безопасный возврат без повторного GET после успешного transfer 204.
  Missing photo/sale не закрывает доступную parent card: неоднозначный nested
  отказ подтверждается parent GET; собственный клиент остаётся доступен.
- Новый `frontend/e2e/administrator-client-branch-access.spec.ts`: own client,
  foreign deep link, transfer с уходом из scope, failure/recovery; возврат
  из clients/group/attention без старой строки; narrow-screen states и target iPhone.
  PostgreSQL runtime counterpart использует реальную auth/API, не только mocks.
- `bot/tests/test_crm_client.py`, `test_client_flow.py`, `test_bot_service.py`,
  `test_attendance_flow.py`: 404 без тела не превращается в Telegram-not-configured,
  устаревший callback заменяет карточку/keyboard; 403 и audit mapping сохранены.

### Expected red evidence
- Сейчас list/card/photo/Bot search Administrator A раскрывают клиента B;
  новые branch-isolation assertions должны упасть именно на этом поведении.
- Current transfer и membership replay возвращают полный `ClientDetailsResponse`
  вне нового scope; ожидаемый безопасный response test должен стать red.
- Frontend при null transfer response выполняет fallback GET; 204 success test
  обнаружит ложную ошибку, а stale-card test — сохранённые title/actions.
- Existing attention branch guard, outer action/grants и legacy endpoint denials
  могут быть green. Для них сохранить characterization evidence без искусственного red.

### Required validation
- Verification contract добавляет focused PostgreSQL concurrency/no-side-effects
  suite и реальные HTTP запросы обеих API к двум филиалам.
- Consumer flow включается в `chromium`, `iphone-air-webkit`,
  `iphone-17-pro-max-webkit`; сверить фактическое число найденных и выполненных tests.
- Отдельно проверить compatibility transfer, shared branch/hall/group lookups
  и принятую no-sale семантику перевода. Служебный service token не выводить в evidence.

### Manual evidence
- Сравнение narrow rendered denied/transfer states с согласованным UI evidence;
  focus/back recovery и отсутствие старых данных после закрытия overlays.
  Device-only limitations отмечаются честно по crm-mobile-first-ui.

### Regression barrier
Главный barrier — backend matrix с двумя филиалами для всех client-bearing
routes плюс transfer/replay/no-side-effects tests. Consumer tests дополняют
его, но не заменяют доказательство отсутствия утечки на backend.

## Risks and stop conditions
- Не найден guard в новой client-bearing route — добавить её в matrix и coverage
  до завершения; нельзя считать отсутствие UI-ссылки защитой API.
- Нужен новый product target, schema или изменение финансовой истории — вернуть
  план в planning; не расширять scope под видом исправления авторизации.
- Отличается состав/семантика replay или нельзя сериализовать scope-check с
  competing write существующими механизмами — повторный technical review до кода.
- Расхождение TASK-132 с изменяемыми BotApiService участками — согласовать
  интеграцию; отдельный behavior-preserving рефакторинг в TASK-191 не включать.
- Утверждённые текущие client/Coach/grant contracts не покрываются предлагаемой
  policy либо runtime расходится с evidence — вернуть readiness no до решения.
