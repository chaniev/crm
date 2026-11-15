# Implementation Plan: TASK-196 Утилита импорта клиентов из XLSX

## Metadata
- source_task: /backlog/implementation/TASK-196-xlsx-client-import.md
- requirements: REQ-CLI-010 (implements); REQ-CLI-001 (constrains); REQ-CLI-003 (constrains); REQ-CLI-005 (constrains); REQ-CLI-006 (constrains); REQ-BRN-001 (constrains); REQ-USR-001 (constrains); REQ-AUD-001 (constrains)
- branch: codex/TASK-196-xlsx-client-import
- readiness: yes
- product_decisions: accepted
- technical_decisions: accepted
- architecture_decisions: ADR-0003; ADR-0004
- open_questions: none
- dependencies: none — необходимые client scope и audit transaction уже интегрированы; новая task-зависимость не требуется
- risk: high — массовая запись клиентских данных и аудита, ошибка scope/commit затрагивает весь файл

## Goal
Одним запуском утилиты перенести корректный XLSX в заранее созданную группу:
создать все строки с сохранением согласованных данных либо не создать ни одной.
Неисправленные примеры дают 0 новых клиентов; исправленные — 48 и 66
соответственно при существующей однозначной группе и разрешённом доступе.

## Decisions and contracts
- Продуктовый mapping и границы переноса нормативны в
  [TASK-196](/backlog/implementation/TASK-196-xlsx-client-import.md#field-mapping)
  и [REQ-CLI-010](/docs/requirements/01-клиенты.md#req-cli-010-разовый-импорт-новых-клиентов-из-xlsx).
  Повторный запуск — независимое создание; баланс — только текст заметки.
- Технический вариант полностью описан в
  [ADR-0004](/docs/architecture/adr/0004-atomic-xlsx-client-import.md):
  authenticated CLI → один backend endpoint → одна транзакция файла;
  общий use case создания; parser на backend; summary audit для сверки
  неподтверждённого commit. Владелец принял контракт 15.11.2026.
- [ADR-0003](/docs/architecture/adr/0003-administrator-client-branch-scope.md)
  ограничивает доступ и порядок блокировок. Не добавлять требование активной
  группы: текущее создание требует активный филиал, но не active group.
- [Построчная сверка](/backlog/logs/TASK-196-source-review-2026-11-15.md)
  охватывает все 114 строк. Исправить надо B7 первого файла, B7/B9/B26/B41/B62
  второго и A6/A32/A37/A46 второго. Исполнитель не исправляет реальные ФИО
  и не придумывает отсутствующие телефоны.
- Итоговое уточнение владельца: `V` и `Д`, включая `(Д)`, сохраняются в ФИО
  на исходных местах с исходным написанием/скобками, не в заметке.
  Разбор 2/3 основных частей имени не считает пометки самостоятельной частью:
  начальный V остаётся префиксом фамилии; пометка после части остаётся
  суффиксом той же части. Например, `V Иванов (Д) Иван Иванович` →
  LastName `V Иванов (Д)`, FirstName `Иван`, MiddleName `Иванович`;
  `Иванов Иван Иванович (Д)` сохраняет `(Д)` в MiddleName.
  Не менять регистр маркеров; варианты `(д)` сохраняются как `(д)`.
  Остальные пометки удаляются по прежнему правилу. Полная длина части имени
  с сохранёнными пометками проходит существующую backend-валидацию.

## Decision evidence
- product: [Product decisions TASK-196](/backlog/implementation/TASK-196-xlsx-client-import.md) — owner: пользователь, владелец продукта; decision: разовая утилита, новые независимые импорты, группа по имени файла и уточнение филиала, согласованный mapping с сохранением V/Д в исходном ФИО, исправление неоднозначных ФИО в источнике, результат файла «всё или ничего».
- technical-review: [Проверка прав, аудита и сохранности](/backlog/logs/TASK-196-technical-review-2026-11-15.md) — owner: Codex, отдельный backend reviewer; outcome: вариант B рекомендован, owner approval не подменяется review.
- technical: [ADR-0004](/docs/architecture/adr/0004-atomic-xlsx-client-import.md#approval) — owner: пользователь, владелец проекта; decision: вариант B, authenticated backend batch и CLI, одна транзакция файла с обязательным аудитом, согласованные transport/file limits и сверка неопределённого commit по operationId без автоматического повтора; прямой ответ «Принять техническое решение ADR-0004».

## Scope
### In
- Backend parser согласованного XLSX, нормализация полей, диагностика всех строк.
- Узкое переиспользование одиночного создания, атомарное создание файла и аудит.
- CLI с обычным входом в CRM, operationId и понятным результатом/отчётом ошибок.
- API consumer mirror, локализованное представление нового события журнала,
  инструкция оператора и обезличенные fixtures/regressions.

### Out
- Экран импорта CRM, бот-команда, создание групп, изменение схемы БД.
- Обновление/слияние/дедупликация клиентов, повторяемые фоновые задания.
- Финансовые операции, контактные лица из свободного текста, угадывание ФИО.
- Реальный импорт предоставленных персональных данных и deployment.

## Implementation slices
Порядок ниже реализует принятые решения; приложение на этапе планирования
не изменялось.

1. **XLSX → проверенный набор.** Добавить обезличенные fixtures и mapping tests,
   затем reader в Infrastructure и import normalization в Application.
   Результат — все нормализованные строки или все ошибки с Excel row/field.
   Не обращаться к БД из XLSX reader и не сохранять workbook как постоянный
   артефакт; штатные временные request buffers освобождаются после запроса.
2. **Единый путь создания.** Зафиксировать текущий контракт обычного create
   characterization tests, выделить только его validate/build/assignments/audit
   в общий use case, сохранив HTTP mapping. Добавить file transaction regression
   до реализации batch orchestration. Существующие edit/transfer/archive paths
   затрагивать только для совместимости общего validation helper.
3. **Авторизованная операция импорта.** Сначала HTTP/PG regressions, затем
   endpoint, повторная проверка actor/group, единая transaction и итоговый
   audit. Существующий одиночный create и новый batch используют одну логику
   создания; число SaveChanges не определяет границу commit.
4. **CLI и consumers.** Сначала тесты с реальным HTTP/cookie/CSRF и сетевым
   обрывом, затем CLI. Синхронизировать frontend DTO/facade/ошибки и подписи
   аудита; проверить новый event в существующем журнале без перестройки UX.
5. **Проверка сценария и документация.** Проверить CLI → API → PostgreSQL на
   обезличенных аналогах примеров; оформить operator guide с base URL, именем
   файла, branchId, ошибками, сверкой operationId и запретом автоматического
   повторения. Зафиксировать implementation evidence в REQ-CLI-010 и
   CHANGELOG; затронутые constraining REQ не объявлять реализованными целиком
   на основании только этой задачи.

## Likely files and layers
Новые пути ниже — предложения для реализации, сейчас файлов нет.
- `backend/src/GymCrm.Application/Clients/` — импортные commands/results,
  нормализация, общий create use case и interfaces.
- `backend/src/GymCrm.Infrastructure/Clients/` — XLSX reader и persistence
  реализации; `Infrastructure/Authorization/ClientAccessTransaction.cs` —
  существующий механизм для использования, без нового глобального lock.
- `backend/src/GymCrm.Api/Auth/ClientLifecycleEndpoints.cs`,
  `ClientLifecycleRequestValidation.cs`, `ClientEndpointSharedHelpers.cs` —
  узкое выделение общего создания; новые `ClientImportEndpoints.cs`/DTO.
- `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs`, startup registration и
  соответствующие resources — подключение handler/use case и сообщения.
- `backend/tools/GymCrm.ClientImport/` (новый проект), `backend/GymCrm.slnx`,
  `.csproj`/lockfiles — CLI и OpenXML dependency; tool включить в Release build.
- `frontend/src/lib/api/clients.ts`, `types.ts`, `endpoints.ts`,
  `frontend/src/lib/api.ts` — mirror/facade; API tests и audit resources/tests.
- `backend/tests/GymCrm.Tests/` — reader/HTTP/PostgreSQL/CLI coverage;
  `frontend/e2e/` — сценарий чтения нового audit event.
- `backend/AGENTS.md`, `scripts/harness/change_impact.py` и selector tests —
  добавить новый Application contract path, если DTO выносятся за уже
  распознаваемый Staff API boundary; это обязательная часть синхронизации.
- `docs/operations/client-xlsx-import.md` (новый) — operator guide;
  task verification contract и evidence — рядом с активной task.

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
  branchId разрешает выбор или оставляет отказ; переименованный файл выбирает
  нужную группу. Неактивная группа не получает новый неоговорённый запрет.
- HTTP access matrix: anonymous 401, Coach 403, Administrator свой/чужой/
  отсутствующий филиал, global roles, inactive actor, CSRF и password-change
  gate. Отказ не создаёт client/import audit и не раскрывает чужих клиентов.
- `ClientImportPostgreSqlTests`: сбой SaveChanges на поздней строке, сбой
  ClientCreated, ClientNoteChanged и итогового audit после сохранённых внутри
  транзакции ранних строк. Новый DbContext подтверждает нулевой delta Clients,
  ClientGroups, ClientBranchAssignments, ClientGroupAssignments, AuditLogs;
  существующие данные сохранены. InMemory не доказывает этот контракт.
- PostgreSQL barriers: до получения locks actor переведён/деактивирован либо
  выбранная группа сменила филиал/имя — старый scope не записывает файл.
  Уже неоднозначный выбор отклоняется; глобальная уникальность имени при
  конкурентном создании группы не обещается.
- Success: N клиентов, ожидаемые назначения и note metadata, стандартные
  audit events и один summary. Два осознанных запуска одного файла создают 2N;
  одинаковые телефоны/содержимое не служат дедупликации.
- `ClientImportCliTests`: cookie/CSRF flow, безопасный ввод пароля, base URL
  с proxy prefix, строки/причины ошибок, operationId до отправки; штатные
  auth/proxy/non-JSON errors без import extensions не ломают отчёт. Потеря ответа
  после commit и rollback различимы по журналу, CLI в обоих случаях не шлёт
  mutation повторно и не утверждает отсутствие записи.
- `frontend/src/lib/api/clients.test.ts` и audit tests: DTO/result/problem
  mapping, новый event/operationId/count, сохранение ограничений чтения аудита.

### Expected red evidence
Новый HTTP success сначала получает 404; parser tests отсутствующего reader
и тесты batch contract требуют минимального compile-only seam и затем падают
по отсутствующему поведению. Для PG rollback использовать детерминированный
failpoint, доказывающий выполнение ранних SaveChanges до отказа. Старые
create characterization tests должны быть green до extraction; искусственный
red для неизменяемого поведения не нужен.

### Required validation
Task contract добавляет существующему baseline сценарий Playwright нового
audit event: desktop и target-iPhone projects по текущей конфигурации,
с assertions на отображение и доступ. Synthetic CLI/HTTP/PG tests включить
в основной backend suite; не дублировать их фильтром как ещё один smoke.
Если PG test infrastructure умеет skip без Docker, evidence обязан подтверждать
фактическое выполнение всех import PG cases. Без доступной PostgreSQL/Docker
атомарность и lock interleavings остаются непроверенными.

### Regression barrier
`ClientImportPostgreSqlTests` через публичный HTTP контракт: поздний сбой
клиента/назначений/аудита → нулевой прирост графа файла; success/repeated run
→ ровно N/2N с обязательным аудитом и сохранённым доступом.

## Risks and stop conditions
- Изменение принятых границ ADR-0004 требует возврата плана к согласованию.
- Новый формат источника или неоднозначность вне принятого mapping — отказ
  с причиной, без эвристик, потери данных или расширения продуктового scope.
- Необходимость schema/replay table/DB credentials или обхода текущих guards
  возвращает план на архитектурное согласование.
- Раздельный commit строк, подавление audit exceptions, перезапуск mutation
  после сетевого обрыва нарушают цель: остановить affected slice и исправить.
- Откат версии не удаляет успешный импорт; реальные исходные XLSX не править
  и персональные данные не переносить в новые fixtures, evidence или CLI logs.
