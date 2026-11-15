# TASK-196: review прав, аудита и сохранности — 2026-11-15

Связь: [задача](/backlog/implementation/TASK-196-xlsx-client-import.md),
[ADR-0004](/docs/architecture/adr/0004-atomic-xlsx-client-import.md).
Review выполнен чтением code/tests/contracts основным Codex и отдельным
backend reviewer. Приложение и БД не запускались, тесты приложения не выполнялись.
Это техническая рекомендация, не approval владельца и не runtime evidence.

## Evidence и выводы

| Область | Проверенный источник | Вывод для импорта |
| --- | --- | --- |
| Обязательные поля | `backend/tests/GymCrm.Tests/ClientsApiTests.cs`: `Client_create_validates_required_fields_contact_limit_and_groups`, `Client_create_requires_branch_and_rejects_group_from_another_branch` | Телефон, активный филиал и существующая группа того же филиала обязательны; активность самой группы не является правилом create |
| HTTP и auth | `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs`, `AuthEndpoints.cs`, `AuthConstants.cs`, `AuthCsrfValidation.cs` | Backend `/clients`; cookie/CSRF уже существуют, отдельный import token не нужен |
| Одиночное создание | `backend/src/GymCrm.Api/Auth/ClientLifecycleEndpoints.cs` | Validate, client graph, note metadata и аудит внутри одной ClientAccessTransaction; вызовы HTTP по строкам дают разные commits |
| Повторная проверка доступа | `backend/src/GymCrm.Infrastructure/Authorization/ClientAccessTransaction.cs`; `backend/tests/GymCrm.Tests/AdministratorClientScopePostgreSqlTests.cs` | Branches → actor → TrainingGroups → Clients; загрузка актуального actor/group после ожидания, scope до записи |
| Аудит | `backend/src/GymCrm.Api/Auth/ClientEndpointSharedHelpers.cs`, `backend/src/GymCrm.Infrastructure/Audit/AuditLogService.cs` | WriteClientAuditAsync не подавляет ошибку; service сохраняет в том же scoped DbContext. Внешняя transaction охватывает несколько SaveChanges |
| Атомарность | `AdministratorClientScopePostgreSqlTests.Audit_failure_rolls_back_mutation_assignments_and_reservation`; `backend/tests/GymCrm.Tests/MutationAuditAtomicityPostgreSqlTests.cs` | Есть образцы проверки rollback в настоящем PostgreSQL; импорт требует собственных late-failure cases |
| Имена групп | `backend/src/GymCrm.Infrastructure/Persistence/Configurations/TrainingGroupConfiguration.cs` | Индекс имени не уникален; требуется явная проверка неоднозначности, не FirstOrDefault |
| Recovery | `backend/src/GymCrm.Domain/Audit/AuditLog.cs`, `backend/src/GymCrm.Api/Auth/AuditLogEndpoints.cs` | Existing EntityId/NewValueJson позволяют корреляцию без schema; чтение журнала только HeadCoach/SuperAdministrator, фильтра EntityId сейчас нет |
| Frontend | `frontend/src/lib/api/clients.ts`, `auth.ts`, `audit.ts`, `frontend/src/features/audit/AuditLogScreen.tsx` | Новый Staff API требует mirror/facade/tests; новый audit action/entity требует подписи и проверки существующего отображения |
| Источники | [114 строк](/backlog/logs/TASK-196-source-review-2026-11-15.md) | Две дополнительные неоднозначности A6/A46 покрыты уже принятым правилом; новые продуктовые решения не нужны |

## Рекомендация

Одна authenticated backend batch operation с тонкой CLI и узким выделением
общей create логики. Переносить правила в CLI или копировать endpoint нельзя.
API-per-row не удовлетворяет atomicity; прямой DB host требует новой границы
доверия и не нужен. Полный предложенный контракт, отрицательные последствия
и сравнение вариантов находятся только в ADR-0004.

Итоговый audit нужен для различения одинаковых независимых импортов при
потере подтверждения commit. Он дополняет стандартный per-client audit.
operationId не становится replay key. Отсутствие summary до завершения запроса
не доказывает rollback; автоматический повтор опасен. Возвращать count/ID
операции достаточно, послекоммитные клиентские DTO не требуются.

Новые глобальные locks, очередь, ledger/import table, schema и сервис не
обоснованы текущим scope. Нельзя обещать глобальную уникальность имени группы
при конкурентном создании: принят только существующий scope/lock boundary.

## Состояние review

- Read-only анализ доступа, выбора группы, validation, audit, transaction и
  recovery завершён; recommendation: вариант B в ADR-0004.
- Реальная проверка proposed implementation перечислена в плане; сейчас не выполнена.
- Обязательное решение владельца по предложенному техническому контракту
  ещё не получено. Required review не объявляется полностью закрытым до него.
- Final review: import extensions ограничены ошибками import handler;
  auth/framework/proxy ответы сохраняются, CLI обрабатывает non-JSON.
  Запрет хранения workbook означает отсутствие постоянного артефакта,
  а не несуществующую гарантию отсутствия штатного request buffering.

## Завершение required review — 2026-11-15

Владелец явно выбрал «Принять техническое решение ADR-0004». ADR принят;
required review доступа, аудита, транзакции и восстановления закрыт.
Последующее продуктовое уточнение V/Д сохраняет маркеры в исходном ФИО;
технические границы ADR не меняются. План и REQ-CLI-010 синхронизированы.
Никакие runtime/tests приложения этим подтверждением не объявляются выполненными.

## Пересмотр: веб-импорт и отдельные роли — 2026-11-15

Предыдущие результаты описывают CLI и ManageClients. По последующим прямым
решениям владельца актуальна
[TASK-196](/backlog/needs-clarification/TASK-196-xlsx-client-import.md):
Settings → Import, явные файл/название группы; только SuperAdministrator
с предварительным выбором филиала и Administrator своего филиала.
Исторический путь `/backlog/implementation/TASK-196-xlsx-client-import.md`
теперь соответствует `/backlog/needs-clarification/TASK-196-xlsx-client-import.md`.

Read-only delta review выполнен основным Codex и отдельным reviewer:

- `AuthorizationFlowTests.cs`, Application `UserRoleAuthorizationPolicy.cs`:
  ManageClients разрешает также HeadCoach, поэтому для импорта непригоден.
  Предложен ImportClients в существующей capability/policy, без новой системы auth.
- `AuthEndpoints.cs`/AuthenticatedUserResponse и frontend `auth.ts`/`types.ts`:
  additive backend `clientImportScope` None/SelectBranch/OwnBranch управляет
  доступом и режимом филиала; дублирующий PermissionSet boolean не нужен.
  None — HeadCoach/Coach/inactive; OwnBranch без назначения не даёт выбрать чужой.
- `appRoutes.ts`/`appRoutes.test.ts`: существующий Settings gate сохраняется.
  `SettingsScreen.tsx`/`.test.tsx`: вкладки размонтируются, состояние import
  следует держать выше панели; роль и scope не вычислять в UI самостоятельно.
- `transport.ts`: FormData, cookie/CSRF, один fetch без retry уже есть.
  `errors.ts` теряет import extensions; нужны additive typed operationId/issues
  и безопасный разбор non-JSON. Невалидный/mismatched/non-JSON success payload
  не доказывает commit, UI должен показать неподтверждённый результат.
- Request branchId обязателен для обеих разрешённых ролей: SA выбирает,
  Admin UI передаёт backend OwnBranch.branchId. Backend подтверждает актуальный
  филиал до lookup и после locks; foreign branch — existing scope rejection
  без раскрытия существования. Привязка запроса не меняется после перевода Admin.
- ClientAccessTransaction.LoadActorAsync проверяет active actor, но новое
  ImportClients нужно проверять отдельно после ожидания locks. Критическая
  регрессия SA → HeadCoach: ManageClients/global scope не изменятся, импорт запрещён.
- Bot использует отдельные session resolve/BotUserContext, не Staff auth scope;
  Python mirror и Bot API не меняются. Клиентский mapping/transaction/audit
  прежнего review сохраняются, filename lookup и CLI исключены.
- Scope-specific tests: session четырёх ролей; SA без выбранного филиала;
  Admin без назначения/с чужим филиалом; HC direct HTTP; revoke role/branch
  при ожидании; tab switch/double click/network loss/no retry; audit права прежние.

Рекомендация оформлена в [ADR-0005](/docs/architecture/adr/0005-settings-xlsx-client-import.md).
Статус Proposed: owner approval и rendered UI/interaction contract пока отсутствуют.
Этот review не объявляет их принятыми. Приложение и тесты не запускались.

Финальная независимая сверка новой редакции task/plan/REQ/ADR завершена:
уточнено тестовое groupName вместо двусмысленного «названия», отделён
HasCapability(ImportClients) от session-only clientImportScope, REQ-USR-001
помечен changes. Других противоречий в ролях, обязательном request branchId,
scope DTO и гарантиях записи reviewer не выявил. Это проверка документов,
не runtime доказательство будущей реализации и не принятие ADR владельцем.

## Повторный review нового плана — 2026-11-15

Основание: запрос нового плана для текущего Settings import. Read-only review
выполнили основной Codex и отдельный reviewer; backend-specialist capability
оказалась недоступна в сессии, её evidence/review boundary выполнены доступным
reviewer. Принятие ADR или реализация не заявляются.

- `ClientLifecycleEndpoints.cs:69`: обычный create владеет транзакцией и затем
  повторно проверяет read access для ответа. Общий writer выделяется без commit
  и response reload, batch не вызывает endpoint для каждой строки.
- `ClientAccessTransaction.cs:76`: существующие preparation retries и ID/scope
  locks не заменяют проверки ImportClients и свежих group ID/name/branch.
  Добавлен сценарий удаления/замены группы с тем же названием после lookup.
- `AuditLogEndpoints.cs:22`, `AuditLogScreen.tsx:682`: фильтры по UUID отсутствуют;
  полный EntityId и NewValueJson доступны в деталях. Восстановление — фильтры
  actor/time/action → детали → сравнение ID/count. Не добавлять скрытый поиск
  по operationId или право аудита Administrator; пустой журнал не доказывает rollback.
- `frontend/src/lib/api/transport.ts:48`: generic cast не проверяет success
  payload и не сохраняет import extensions. Runtime validation локализуется
  в import client; optional errors расширяются без изменения прочих consumers.
- Auth session содержит branchId, но не branchName; имя фиксированного филиала
  Admin получать из существующего разрешённого branch lookup.
- Существующий create требует активный филиал, а не активную группу;
  сохраняется отдельный запрет HeadCoach, имеющего ManageClients.

Новых оснований для сервиса, таблицы импорта, deduplication или глобальной
перестройки create/navigation не найдено. Уточнения внесены в Proposed ADR-0005
и новый plan. [UI evidence](/backlog/mockups/TASK-196-settings-import/README.md)
содержит три rendered направления и предложенный interaction contract A.
Проверка выполнена по исходникам/контрактам; backend/PG тесты не запускались,
результат не является runtime-доказательством будущей реализации.

Финальная проверка navigation contract:
- `frontend/src/App.tsx:483` и `frontend/src/app/RouteViewport.tsx:357` дают
  узкую границу section/password/logout callback; форма/dialog остаются Settings.
  Logout предупреждается до вызова API, App не получает CRM-правила.
- `frontend/src/app/useAppRoute.ts:92` обрабатывает popstate без history index
  и отменяемого blocker. План не обещает custom dialog для browser Back/Forward;
  выбран минимальный предложенный контракт постоянного предупреждения/no replay
  и ручной сверки без нового history protocol.
- `frontend/src/App.tsx:191` forced access redirect обходит guard. Пока Settings
  доступен, recovery-состояние сохраняется; при полном уходе/local ID loss остаётся
  сверка по сохранённому ID/actor/time/action. Дополнительный shell ledger не введён.
Это уточнение Proposed UX/ADR до approval, не изменение принятого продукта.
