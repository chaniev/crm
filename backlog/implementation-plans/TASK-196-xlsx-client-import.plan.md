# Implementation Plan: TASK-196 Импорт клиентов из XLSX через настройки

## Metadata
- source_task: /backlog/implementation/TASK-196-xlsx-client-import.md
- requirements: REQ-CLI-010 (implements); REQ-BRN-002 (changes); REQ-USR-001 (changes); REQ-CLI-001 (constrains); REQ-CLI-003 (constrains); REQ-CLI-005 (constrains); REQ-CLI-006 (constrains); REQ-BRN-001 (constrains); REQ-AUD-001 (constrains)
- branch: codex/TASK-196-xlsx-client-import
- revision: 2026-11-15 — новый веб-план после изменения точки входа и ролей
- readiness: yes
- product_decisions: accepted
- technical_decisions: accepted
- architecture_decisions: ADR-0003; ADR-0005
- open_questions: none
- dependencies: none — client scope и audit transaction уже интегрированы
- risk: high — массовая запись, отдельное import-разрешение, неизвестный исход после потери ответа

## Goal
Из «Настройки → Импорт» создать всех клиентов XLSX в указанной существующей
группе либо не создать ни одного при ошибке. Файл не переименовывается.
SA выбирает филиал, Admin работает в своём, HeadCoach/Coach не импортируют.
Исходные профили 48/66 строк отклоняются целиком; исправленные synthetic
аналоги создают ровно 48/66 клиентов. Никакой реальный импорт этим планом
не выполняется.

## Decisions and contracts
- Mapping десяти столбцов, телефоны, V/Д/(Д)/(д), заметка и неоднозначные ФИО:
  [TASK-196, Field mapping](/backlog/implementation/TASK-196-xlsx-client-import.md#field-mapping)
  и [REQ-CLI-010](/docs/requirements/01-клиенты.md). Эти решения не открываются заново.
- Один backend import use case; браузер передаёт файл и параметры, не разбирает
  строки и не дублирует CRM-validation. Создаются новые карточки без dedup/merge;
  баланс остаётся заметкой, контакты/финансы не создаются.
- [ADR-0005](/docs/architecture/adr/0005-settings-xlsx-client-import.md) владеет
  принятым multipart/session/scope/transaction/recovery контрактом.
  Его профиль XLSX и лимиты перенесены из прежнего решения; CLI, filename-based
  поиск и доступ HeadCoach из старого ADR не возвращаются.
- Расширение существующего create/use case достаточно: общий writer не открывает
  и не фиксирует транзакцию, не выполняет response reload. Import orchestrator
  владеет одним commit, обычный create сохраняет прежний HTTP/read-access контракт.
- [UI brief и три rendered направления](/backlog/mockups/TASK-196-settings-import/README.md)
  содержат UX-анализ, состояния и responsive/focus/navigation/recovery контракт A.
  Владелец выбрал A — единую форму; B/C сохранены только как история сравнения.
- Новые schema, очередь, status service, audit permission и runtime variables
  не нужны. Откат приложения сохраняет уже импортированных клиентов и аудит.

## Decision evidence
- product: [Product revision и Access revision TASK-196](/backlog/implementation/TASK-196-xlsx-client-import.md#product-revision--2026-11-15) — owner: пользователь, владелец продукта; decision: Settings → Import, XLSX и отдельное название группы; SA выбирает филиал, Admin только своего филиала, HeadCoach/Coach запрещены; mapping и атомарность сохранены.
- technical-review: [повторный review](/backlog/logs/TASK-196-technical-review-2026-11-15.md#повторный-review-нового-плана--2026-11-15) — owner: Codex и отдельный read-only reviewer; outcome: общий writer без commit, повторная проверка group identity под locks, runtime-валидация ответа и точный путь сверки аудита; не является approval.
- technical: [ADR-0005, Approval](/docs/architecture/adr/0005-settings-xlsx-client-import.md#approval) — owner: пользователь, владелец проекта; decision: «принимаю предложенное техническое решение», 2026-11-15; приняты backend batch/ImportClients/session scope, multipart, профиль XLSX, общий writer и одна транзакция с audit, group identity, runtime-валидация ответа и recovery без replay с описанными ограничениями навигации.
- visual: [Выбор владельца](/backlog/mockups/TASK-196-settings-import/README.md#выбор-владельца) — owner: пользователь, владелец продукта; decision: «выбираю вариант А», 2026-11-15; выбрана единая форма и зафиксирован её UI-контракт без изменений. Выбор не является принятием ADR-0005.

## Readiness closure
Вся подготовка ниже выполнена до реализации: сверены текущие contracts/tests,
получен producer/consumer review, подготовлены три rendered направления и
точный interaction contract A, выбранный владельцем 2026-11-15.
ADR-0005 отдельно принят владельцем 2026-11-15. Все in-scope решения закрыты;
approval provenance записан в task/ADR/UI evidence. Подготовка плана не означает,
что реализация уже началась; task branch/worktree и production code ещё не менялись.

## Scope
### In
- Backend capability/session scope, XLSX reader, mapping и атомарный import API.
- Общий create writer без изменения edit/transfer/archive; стандартный и итоговый audit.
- Settings form, typed multipart/errors/success, navigation/recovery, audit labels.
- Synthetic fixtures, authorization/HTTP/PG/component/Playwright regressions,
  операторская инструкция и evidence требований.

### Out
- CLI, бот-команда, автосоздание групп, финансовые операции, dedup/merge.
- Новая БД-схема, очередь, импорт-история/status endpoint, автоматический replay.
- Исправление реальных XLSX, импорт персональных данных и deployment.

## Implementation slices
Исполняются после readiness. В каждом slice перечисленные regression tests
предшествуют функциональному коду; выбор поведения или согласование в них отсутствует.

1. **Backend import contract и доступ.** Добавить tests permission/session/HTTP
   guards, затем ImportClients policy, backend clientImportScope и DTO/endpoint
   composition. Закрыть auth, CSRF/password-change и branch envelope до parser.
   Результат: импорт доступен только разрешённому актуальному actor/scope.
2. **Reader и нормализация.** На synthetic XLSX подтвердить missing behavior,
   затем реализовать Infrastructure OpenXML reader и Application mapping.
   Результат: полная коллекция row/field issues до persistence, ограниченное
   чтение архива, точные преобразования десяти столбцов и исходные Excel-номера.
3. **Единый create и file transaction.** Green characterization обычного create
   до выделения общего validate/build/assignments/audit. Затем red PG rollback
   и lock-interleaving tests → import orchestration с одним commit и summary audit.
   Связать с endpoint: успех возвращается после commit, ошибка любого audit
   откатывает весь граф. Не вызывать старый endpoint N раз.
4. **Typed consumer и интерфейс.** Сначала multipart/error/success runtime
   validation, auth mirror и settings tests; затем API facade, форма и состояния
   по выбранному UI-контракту. State owner — Settings выше Tabs.Panel; narrow
   navigation callback передаёт pending/unknown уход на существующий route boundary.
   CRM-логика и ledger в App.tsx не добавляются. Audit label/детали синхронизировать.
5. **Сквозной сценарий и передача.** Playwright с backend/PG synthetic файлами,
   runtime comparison с принятым макетом, инструкция исправления ошибок и сверки
   unknown. Обновить REQ-CLI-010/BRN-002/USR-001 и CHANGELOG по фактическому покрытию;
   не объявлять широкие BRN/USR полностью реализованными без проверки остальных пунктов.

## Likely files and layers
Новые пути отмечены явно; их имена могут уточняться в рамках контрактов.
- `backend/src/GymCrm.Application/Authorization/` и API auth response/mapper/policy —
  ImportClients и clientImportScope; существующие backend auth/session tests.
- `backend/src/GymCrm.Application/Clients/`, `Infrastructure/Clients/` — новые
  reader/normalization/import orchestration и общий create writer/interfaces.
- `backend/src/GymCrm.Api/Auth/ClientLifecycleEndpoints.cs`, validation/helpers,
  ClientEndpoints — общий create; новый import endpoint/request/response, resources.
- Infrastructure csproj и lockfiles — закреплённый OpenXML без CLI-проекта.
- `frontend/src/features/settings/SettingsScreen.tsx`, новый ClientImportPanel,
  state hook/tests/resources — вкладка, форма, результат; route boundary только
  для согласованного предупреждения ухода, без общей перестройки навигации.
- `frontend/src/App.tsx`, `frontend/src/app/RouteViewport.tsx` — узкий callback
  для section/password/logout. `frontend/src/app/useAppRoute.ts` сохраняет текущий
  popstate: Back/Forward без гарантированного диалога, новый history blocker вне scope.
- `frontend/src/lib/api/{auth,clients,types,transport,errors,endpoints}.ts`,
  `frontend/src/lib/api.ts` — mirror/facade; существующий FormData/cookie/CSRF.
- `frontend/src/features/audit/AuditLogScreen.tsx` и audit resources/tests —
  человекочитаемое действие и count, существующий доступ к деталям операции.
- `backend/tests/GymCrm.Tests/`, `frontend/e2e/` — новые регрессии ниже.
- `backend/AGENTS.md`, `scripts/harness/change_impact.py` и selector tests —
  синхронизировать Staff boundary, если публичные DTO появятся в Application/Clients.
- `docs/operations/client-xlsx-import.md` — новая операторская инструкция;
  task verification contract/evidence создать рядом с активной задачей.

## Regression specification
### Automated tests to add or update
**R1 — reader/mapping:** `ClientXlsxReaderTests`/mapping tests (новые).
- Sheet `Клиенты`, A1:J1, shared/inline strings, числовой баланс, пустые строки
  с сохранением нумерации. Формулы/повреждённый архив/unsupported values безопасно
  отклонены. File/body/uncompressed/row пределы из ADR на границе и +1.
- 114 обезличенных профилей из [source review](/backlog/logs/TASK-196-source-review-2026-11-15.md):
  1/9 ошибочных строк, 47/57 корректных; после synthetic исправлений — 48/66.
  Не копировать реальные ФИО/телефоны/ДР/комментарии в fixtures.
- Все десять полей проверяются assertions: 2/3 части ФИО, V/Д/(Д)/(д) на исходных
  местах/с регистром и не в заметке; отдельные `8` и `год` дают row issue.
  Основной/2–3 дополнительных телефонов, 11-значные 7/8 и десять цифр с первой 8;
  отсутствие телефона не заменяется заглушкой. ДР текст/пусто/невалидная дата.
  Notes ровно 2000 / 2001 без обрезки; нулевой/отрицательный баланс остаются
  справкой; контакты пусты, существующие клиенты и финансы не изменяются.

**R2 — API/access:** `ClientImportApiTests` и AuthorizationFlow/session tests.
- Anonymous 401, HeadCoach/Coach 403; inactive/password-change/CSRF отказы;
  Admin свой/чужой/без филиала, SA выбранный/пропущенный/архивный филиал.
  Нет раскрытия чужих данных, client/import audit при отказе не возникает.
- clientImportScope None/SelectBranch/OwnBranch/null, при смене scope вкладка
  теряет доступ; canManageClients не используется для import gate.
- groupName trim + точное сравнение в целевом филиале; пустое/нет/несколько
  совпадений — 0 записей. Переименование файла не меняет цель; другой groupName
  меняет цель; одинаковое имя чужого филиала не влияет. Неактивная группа не
  получает нового запрета, активность филиала сохраняется.
- Ошибки первой/средней/последней строки возвращаются вместе до записи;
  field/row/code/operationId соответствуют envelope, сообщения без cell values.

**R3 — атомарность и конкурентный доступ:** `ClientImportPostgreSqlTests` (новый).
- После позднего SaveChanges/ClientCreated/ClientNoteChanged/summary audit failure
  новый DbContext видит нулевой delta Clients, ClientGroups, ClientBranchAssignments,
  ClientGroupAssignments, AuditLogs; существующие данные неизменны.
- Success даёт N клиентов, назначения/notes metadata, обычный audit и один
  ClientImportCompleted. Два осознанных запуска дают 2N, телефон не unique key.
- Barrier tests: actor деактивирован/сменил филиал/SA→HeadCoach до locks;
  группа переименована, удалена, перенесена либо заменена другой с тем же именем
  между lookup и locks. Повторная проверка свежего actor/capability и того же
  group ID/name/branch исключает молчаливое перенаправление файла.
  Новая глобальная уникальность названий/новые mutation retry loops не вводятся.
- Обычные create tests сохраняют response/read-scope и rollback semantics после
  выделения writer; commit/response reload не становятся частью общего writer.

**R4 — browser boundary:** api/auth/settings/audit component tests.
- FormData + cookie/CSRF без JSON Content-Type; optional issues/operationId
  не меняют остальные ApiError consumers. Missing/unknown/malformed scope → None.
- Только валидный 2xx с совпадающим operationId и допустимым целым count
  подтверждает успех. Non-JSON/malformed 2xx, другой ID, сетевой обрыв/5xx → unknown.
- Двойной клик, remount/tab switch не создают второй POST. Fields disabled во
  время запроса; поздний ответ сохраняется без focus steal в неактивную вкладку.
- Известные ошибки сохраняют контекст, полный список issues; новый импорт после
  success очищает файл. Pending/unknown уход предупреждает, не сообщает rollback.
  Scope revoked скрывает форму; forced redirect не задерживается guard, потерянный
  локальный номер восстанавливают по actor/time/action, а не browser ledger.
- Новый audit event отображается по текущим правам; фильтры actor/time/action и
  детали с полным EntityId позволяют сверку, поиска по UUID не обещать.

**R5 — E2E:** новый `frontend/e2e/settings-client-import.spec.ts`.
- SA выбирает филиал/группу/файл и видит N; Admin фиксированный свой филиал;
  HeadCoach/Coach restricted. Ошибочный synthetic файл → 0 → исправленный → N.
- Потеря ответа после commit → unknown, один POST, сверка summary в аудите
  разрешённой ролью; у Admin инструкция обращения, без доступа к журналу.
- Длинные имена, все вкладки SA, полный отчёт, file picker, keyboard/focus,
  tab switch; shell section/password/logout → dialog до действия/logout API;
  browser Back/Forward → без replay и без обещания диалога; forced redirect
  не блокируется, reload не утверждает rollback. Отсутствие page overflow, сохранение контекста
  в пределах живого Settings согласно выбранному контракту.

### Expected red evidence
R1 — reader/normalization отсутствуют; R2 — ImportClients/session scope/endpoint
отсутствуют (HTTP route сначала 404); R3 — file orchestration и summary audit
отсутствуют; R4/R5 — вкладки, typed import client и recovery ещё нет.
Существующие ordinary-create characterizations должны быть green до извлечения
writer; искусственный red для поведения, которое сохраняется, не требуется.
Новый suite сначала довести до исполнимого failing assertion через минимальные
contract seams; ошибки компиляции сами по себе не доказывают ожидаемый red.

### Required validation and evidence
Task contract добавляет R5 и affected audit/settings flows на Chromium и
`iphone-air-webkit` / `iphone-17-pro-max-webkit` из текущей Playwright config.
Viewport/keyboard/compact-height и rendered runtime comparison — по выбранному
[UI-контракту](/backlog/mockups/TASK-196-settings-import/README.md), без дублирования матрицы.
PG evidence подтверждает фактическое выполнение rollback/interleaving cases:
skip из-за отсутствия Docker не является проверкой атомарности. Проверки
реального Safari chrome/keyboard/safe-area требуют device/Simulator evidence.

### Regression barrier
Публичный import API + PostgreSQL: ошибка поздней записи/аудита → нулевой
прирост всего графа; success/repeated run → N/2N. Доступ проверяется после locks,
браузер отправляет один запрос и честно показывает неподтверждённый исход.

## Risks and stop conditions
- Новые материальные решения возвращаются в planning до изменения зависимого кода;
  согласованный контракт не расширяется во время исполнения.
- Не переносить прежний ManageClients gate: он разрешает запрещённому HeadCoach.
- Пустой журнал не доказывает rollback; новый запуск до установления исхода
  может создать дубли. Номер — корреляция, не ключ идемпотентности.
- Формат вне принятого профиля/неоднозначность — явная ошибка без угадывания.
- Separate commits, best-effort audit, частичный импорт и удаление записей
  при откате версии нарушают принятые контракты.
