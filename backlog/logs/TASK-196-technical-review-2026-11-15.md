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
