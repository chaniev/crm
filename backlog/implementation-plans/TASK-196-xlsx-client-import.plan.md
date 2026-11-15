# Implementation Plan: TASK-196 Импорт клиентов из XLSX через настройки

## Metadata
- source_task: /backlog/needs-clarification/TASK-196-xlsx-client-import.md
- requirements: REQ-CLI-010 (implements); REQ-BRN-002 (changes); REQ-USR-001 (changes); REQ-CLI-001 (constrains); REQ-CLI-003 (constrains); REQ-CLI-005 (constrains); REQ-CLI-006 (constrains); REQ-BRN-001 (constrains); REQ-AUD-001 (constrains)
- branch: codex/TASK-196-xlsx-client-import
- readiness: no — требуется принятие ADR-0005 и выбранный rendered UI/interaction contract новой вкладки
- product_decisions: accepted — Settings/XLSX/явная группа, только SuperAdministrator с выбором филиала и Administrator своего филиала; visual direction ещё не выбран
- technical_decisions: proposed — ADR-0005 заменяет CLI-контракт ADR-0004
- architecture_decisions: ADR-0003; ADR-0005 (Proposed)
- open_questions: принятие веб-контракта ADR-0005; выбор визуального направления и interaction/recovery contract
- dependencies: none — существующие client scope и audit transaction интегрированы
- risk: high — массовая запись клиентов, отдельное import-разрешение и неопределённый сетевой результат

## Goal
В «Настройки → Импорт» выбрать XLSX и указать группу внутри целевого филиала,
создать все корректные строки с согласованными данными либо ни одной.
SuperAdministrator предварительно выбирает филиал; Administrator работает
только в своём. Главный тренер и Тренер не импортируют. Исходные примеры
отклоняются целиком; исправленные synthetic аналоги создают 48/66 клиентов.

## Decisions and contracts
- Текущий product mapping нормативен в
  [TASK-196](/backlog/needs-clarification/TASK-196-xlsx-client-import.md#field-mapping)
  и [REQ-CLI-010](/docs/requirements/01-клиенты.md#req-cli-010-импорт-новых-клиентов-из-xlsx-через-настройки).
  Новая точка входа — Settings tab «Импорт»; имя файла произвольное.
- [REQ-BRN-002](/docs/requirements/09-филиалы-и-настройки.md) задаёт вкладку,
  [REQ-USR-001](/docs/requirements/05-пользователи-и-роли.md) — специальное
  право импорта двух ролей. Это исключение из общих прав HeadCoach.
- Backend ищет введённое название существующей группы в целевом филиале;
  одноимённые группы других филиалов не влияют. Группы не создаются.
- Повторный осознанный импорт создаёт новых клиентов, баланс остаётся заметкой.
  V/Д/(Д)/(д) сохраняются на исходных местах и с исходным регистром; маркеры
  не считаются частями ФИО. Префикс V остаётся у фамилии, суффикс у своей части.
- [Source review](/backlog/logs/TASK-196-source-review-2026-11-15.md) сохраняет
  mapping 114 строк: исправляются B7 первого файла, B7/B9/B26/B41/B62
  и A6/A32/A37/A46 второго. Реальные данные не угадывать и не менять.
- [ADR-0003](/docs/architecture/adr/0003-administrator-client-branch-scope.md)
  сохраняет scope/lock ordering; import добавляет проверку нового разрешения.
  Не вводить active-group запрет: создание требует активный филиал.

## Proposed technical contract
[ADR-0005](/docs/architecture/adr/0005-settings-xlsx-client-import.md) — единый
источник предложенного auth/session/multipart/transaction/recovery контракта.
Вместо CLI браузер отправляет файл, groupName, branchId и operationId одной
операцией. Отдельный backend ImportClients capability разрешает SA/Admin;
clientImportScope управляет вкладкой и выбором/фиксацией филиала в UI.
Обычный create, parser и audit остаются на backend. Пока ADR Proposed,
описанные ниже slices не разрешают менять project code.

## Decision evidence
- product: [Product revision и Access revision TASK-196](/backlog/needs-clarification/TASK-196-xlsx-client-import.md#product-revision--2026-11-15) — owner: пользователь, владелец продукта; decision: вкладка импорта в настройках, XLSX и отдельное название существующей группы; только SuperAdministrator с обязательным выбором филиала и Administrator в свой текущий филиал, HeadCoach/Coach запрещены; прежний mapping и atomicity сохранены.
- technical-review: [Review TASK-196](/backlog/logs/TASK-196-technical-review-2026-11-15.md) — owner: Codex и отдельный reviewer; outcome: предложены backend batch, отдельный import capability и backend scope, общий transport и состояние выше размонтируемой панели; review не заменяет approval.
- technical: [ADR-0005](/docs/architecture/adr/0005-settings-xlsx-client-import.md#approval) — owner: пользователь, владелец проекта; decision: Pending, новый ADR не принят. Старый approval ADR-0004 относится к CLI и прежней матрице доступа.
- visual: направление и rendered evidence пока отсутствуют; текстовый UX draft ниже не является утверждённым визуальным дизайном.

## Planning blockers
1. Подготовить rendered варианты новой вкладки в контексте существующих
   настроек и получить выбор владельца; на его основе завершить точный
   UI/interaction contract, включая pending/unknown и уход со страницы.
2. Принять или уточнить ADR-0005 после review producer/consumer. Повторного
   утверждения уже принятых ролей, полей и точки входа не требуется.
Это работа планирования, не implementation slices. До её завершения задача
остаётся needs-clarification. После решений синхронизировать evidence и
выполнить readiness preflight; не переносить согласование на этап реализации.

## UX contract draft
Принятый сценарий: Settings → Import; SA выбирает филиал, Administrator видит
фиксированный свой филиал; пользователь выбирает XLSX, вводит название группы,
нажимает «Импортировать», получает число созданных клиентов или причины ошибок.
HeadCoach/Coach вкладку не видят; сервер также запрещает операцию.

Предложение для design gate, не финальный макет:
- Primary: выбор файла, название группы, выбор филиала для SelectBranch,
  отправка. Secondary: заменить файл, исправить параметры после отказа.
  Exceptional: сверка неизвестного исхода по номеру операции через аудит.
- Форма без дублирующего заголовка активной вкладки; обычные поля с постоянными
  подписями. Пользователю не нужны base URL, login CLI или technical operationId
  как поле ввода. Номер операции показывается в статусе для восстановления.
- Состояния: empty, branch lookup loading/failed, ready, pending, field/row
  validation errors, no group/ambiguous within branch, scope changed/restricted,
  success и unconfirmed. Errors сохраняют введённый контекст и объясняют исправление.
- Backend clientImportScope, а не role switch, определяет выбор/фиксацию филиала;
  OwnBranch без назначения даёт недоступное состояние, не глобальный выбор.
- Pending блокирует повторную отправку; tab switching сохраняет состояние
  выше Tabs.Panel. Закрытие страницы не означает rollback. Место предупреждения,
  focus, возврат и способ сохранения номера согласуются в visual/interaction contract.
- Двойной клик отправляет один POST. Намеренный новый запуск после известного
  исхода остаётся независимым импортом. При неизвестном исходе нет автоматического retry.

Visual brief: React/Mantine/Onest и текущие shared form/status компоненты;
спокойная компактная форма, одна основная операция. Проверить длинное название
группы/файла и полный список ошибок без горизонтального скролла. Сравнить
варианты композиции полей и отчёта на mobile/desktop; критерий выбора — легко
увидеть целевой филиал/группу и понять исход без риска повторной отправки.
Rendered current UI и варианты в этой правке документации не создавались.

## Scope
### In
- Settings import tab, browser workflow, backend-derived import scope/auth.
- XLSX reader/mapping, единый create use case, file transaction и аудит.
- Typed API request/result/errors, audit labels, инструкция пользователя.
- Synthetic fixtures, authorization/HTTP/PostgreSQL/component/Playwright tests.

### Out
- CLI, bot import, создание групп, schema/очередь/status service.
- Дедупликация, обновление/слияние клиентов, финансовые операции.
- Реальные импорты, исправление персональных XLSX и deployment.

## Implementation slices
Применяются только после закрытия Planning blockers; решения здесь не выбираются.
1. **Reader/mapping.** Сначала synthetic fixtures и tests, затем Infrastructure
   reader и Application normalization; все ошибки с Excel row/field до записи.
2. **Единый create.** Characterization обычного create должны быть green до
   узкого выделения validate/build/assignments/audit. Затем file rollback tests
   до batch orchestration; edit/transfer/archive без структурной перестройки.
3. **Import authorization/API.** Сначала role/session/HTTP/PG regressions,
   затем ImportClients capability/policy, auth scope, groupName+branchId request,
   повторная проверка actor/scope/group под locks, transaction и summary audit.
4. **API consumer и настройки.** Сначала tests auth mapping, multipart/errors,
   вкладки/формы/состояний, затем mirror/facade и UI по утверждённому дизайну.
   Состояние запроса не теряется при переключении tab; no retry на remount.
   Синхронизировать новые audit labels и отображение в существующем журнале.
5. **Сквозная проверка и evidence.** Playwright с backend/PG на обезличенных
   профилях, сравнение runtime с выбранным дизайном, инструкция Settings → Import
   и сверка неизвестного исхода. REQ-CLI-010/BRN-002/USR-001 и CHANGELOG обновить
   по фактической реализации, не объявляя широкие BRN/USR полностью выполненными.

## Likely files and layers
Новые файлы — предложения для реализации, сейчас их нет.
- `backend/src/GymCrm.Application/Clients/`, Infrastructure/Clients — reader,
  import contracts/normalization, общий create и persistence interfaces.
- `backend/src/GymCrm.Application/Authorization/` — ImportClients, policy и
  backend import scope; API auth response/mapper/policy registration — consumer contract.
- `backend/src/GymCrm.Api/Auth/ClientLifecycleEndpoints.cs`, validation/shared
  helpers, новые import endpoint/DTO, ClientEndpoints/startup/resources.
- Infrastructure csproj/lockfiles — OpenXML; отдельного CLI-проекта нет.
- `frontend/src/features/settings/SettingsScreen.tsx`, новый ClientImportPanel
  и tests/resources; session scope приходит из API, CRM rules не копируются.
- `frontend/src/lib/api/{auth,clients,types,transport,errors,endpoints}.ts` и
  `frontend/src/lib/api.ts` — auth scope/request/result/issues/facade; tests.
- `backend/tests/GymCrm.Tests/`, `frontend/e2e/` — regressions ниже.
- `backend/AGENTS.md`, `scripts/harness/change_impact.py` и selector tests —
  расширить contract boundary для новых Application DTO при необходимости.
- `docs/operations/client-xlsx-import.md` (новый) — инструкция формы/ошибок/
  ручной сверки; task verification contract/evidence рядом с активной задачей.

## Regression specification
### Automated tests to add or update
- `ClientXlsxReaderTests`: A:J, sheet name, shared/inline string, row numbers,
  пустые строки; повреждённый архив/формула/лимиты дают безопасный отказ.
  114 обезличенных профилей из source review: 1/9 ошибочных строк и 47/57
  корректных; после исправления synthetic fixtures — 48/66 корректных.
- Mapping: 2/3 основные части ФИО, V/Д/(Д)/(д) остаются в исходных местах,
  включая сочетание V + (Д), и отсутствуют в заметке. Остальные пометки
  удалены; отдельные
  `8` в A6/A37/A46 и `год` в A32 отклонены. Первый телефон основной; 2/3
  номера, 11-значные 7/8 и 10-значный с 8 дают точное ожидаемое значение,
  включая дополнительный B23. Пустые телефоны не заменяются заглушкой.
- ДР текст/пусто/невалидная дата; все 10 полей покрыты assertions; нулевой
  и отрицательный баланс в заметке, contacts пусты; notes 2000 принимается,
  2001 отклоняется без обрезки. Существующие записи/финансы не изменяются.
- `ClientImportApiTests`: успешный файл; ошибки начала/середины/конца
  возвращаются вместе до записи; отсутствующая/неоднозначная группа,
  groupName+branchId определяют выбор; переименование файла не меняет группу.
  Один файл с разными значениями groupName выбирает разные группы целевого филиала;
  совпадения в других филиалах не влияют на результат. Неактивная группа не получает новый неоговорённый запрет.
- HTTP access matrix: anonymous 401, HeadCoach/Coach 403; Administrator свой/чужой/
  отсутствующий филиал; SuperAdministrator любой активный выбранный филиал,
  отсутствие branchId — ошибка; inactive actor, CSRF и password-change
  gate. Отказ не создаёт client/import audit и не раскрывает чужих клиентов.
- `ClientImportPostgreSqlTests`: сбой SaveChanges на поздней строке, сбой
  ClientCreated, ClientNoteChanged и итогового audit после сохранённых внутри
  транзакции ранних строк. Новый DbContext подтверждает нулевой delta Clients,
  ClientGroups, ClientBranchAssignments, ClientGroupAssignments, AuditLogs;
  существующие данные сохранены. InMemory не доказывает этот контракт.
- PostgreSQL barriers: до получения locks actor переведён/деактивирован либо
  выбранная группа сменила филиал/имя — старый scope не записывает файл.
  SuperAdministrator → HeadCoach после ожидания locks отклоняется именно
  ImportClients guard, хотя обычный ManageClients остаётся разрешённым.
  Уже неоднозначный выбор отклоняется; глобальная уникальность имени при
  конкурентном создании группы не обещается.
- Success: N клиентов, ожидаемые назначения и note metadata, стандартные
  audit events и один summary. Два осознанных запуска одного файла создают 2N;
  одинаковые телефоны/содержимое не служат дедупликации.
- Policy: HasCapability(ImportClients) false для HeadCoach/Coach и true для
  SA/Admin. Auth/session возвращает только clientImportScope
  SelectBranch/OwnBranch/None, fixed branch и отсутствие
  назначения. Отсутствующий/unknown/malformed scope в frontend → безопасный None.
- API consumer: FormData поля и CSRF/cookies, import issues/operationId,
  обычные ошибки без extensions и non-JSON сохраняют безопасный feedback.
  malformed/mismatched/non-JSON 2xx не подтверждает успех.
- Settings/component: capability scope, обязательный филиал SA, fixed Admin,
  groupName/file validation, полный отчёт строк; соседние tabs не меняются.
  Одно нажатие/двойной клик → один POST; переключение вкладки во время запроса
  сохраняет pending/result/operationId без повторной отправки.
- Network: обрыв после commit и rollback → одинаковый unconfirmed UI с ID,
  разные фактические audit outcomes; 5xx/timeout не объявляют отсутствие записи.
- Playwright: SA импорт в выбранный другой филиал; Admin в свой; HeadCoach
  restricted; ошибка XLSX → исправленный synthetic файл → success; произвольное
  имя файла и явная группа; no-retry, state после tab switch, audit summary.

### Expected red evidence
Новый endpoint сначала 404; capability/scope/session/UI tests падают из-за
отсутствия поведения. Parser tests используют минимальный compile-only seam.
PG failpoint доказывает ранние SaveChanges перед поздним отказом. Старый
create characterization должен быть green до extraction, искусственный red не нужен.

### Required validation
Task contract добавляет affected Playwright import/settings/audit flows с
основным, failure/recovery и restricted путями на desktop и target-iPhone
projects по текущей конфигурации. Полная mobile matrix и runtime comparison
берутся из UI-контракта и применимых правил; проверяется доступность новой вкладки
при большем числе tabs, keyboard/file-picker, отсутствие overflow.
Synthetic HTTP/PG cases входят в основной suite. Evidence обязан подтвердить
фактическое выполнение PG tests: skip при отсутствии Docker не доказывает
атомарность/lock interleavings. Реальные Safari keyboard/chrome/safe-area
проверки отмечаются выполненными только при наличии device/Simulator evidence.

### Regression barrier
Публичный import API + PostgreSQL: поздний сбой любой записи/аудита → нулевой
прирост всего графа файла; success/repeated run → N/2N. Отдельный запрет
HeadCoach и чужого филиала Administrator действует также после ожидания locks;
web UI отправляет один запрос и корректно сообщает неподтверждённый исход.

## Risks and stop conditions
- Proposed ADR/невыбранный дизайн не разрешают execution; новое материальное
  решение возвращает affected plan к планированию.
- Нельзя использовать ManageClients вместо ImportClients: HeadCoach имеет
  первое, но запрещён для нового импорта по прямому решению владельца.
- Новый формат или неоднозначность вне mapping — ошибка без эвристик/потери данных.
- Раздельный commit строк, best-effort audit и автоматический replay нарушают цель.
- Откат версии сохраняет успешно импортированных клиентов и append-only audit.
  Реальные XLSX/персональные данные не копировать в fixtures и логи.
