# ADR-0007: Граница выполнения операций абонемента

- **Статус:** Accepted (пользователь, владелец проекта, 2026-11-16)
- **Дата:** 2026-11-16
- **Автор / владелец:** Codex / пользователь проекта

## Связанные требования
- none — сохраняются действующие membership, scope, replay, audit и API contracts

## Контекст
ClientMembershipEndpoints выполняет HTTP parsing/mapping и EF transaction/idempotency orchestration. Common executor также используется ClientLifecycleEndpoints при переводе филиала. Refund reservation и target transfer имеют отличающиеся последовательности lease/expiry/replay. Пользователь поручил выполнить предложение разделить HTTP и lifecycle, сохраняя эти различия.

## Критерии выбора
Сохранить observable contracts, scoped DbContext, locks/commit ordering, current audit JSON и defensive cleanup Completed. Не переписывать доменные сервисы или text resources ради переноса.

## Рассмотренные варианты
### Вариант A: Только разнести partial HTTP modules
Уменьшает файл, но сохраняет EF/transaction ownership в HTTP и не выполняет порученный перенос.
### Вариант B: Typed execution contracts с текущими callbacks
Application описывает operation descriptor и result без HTTP/EF/Staff DTO; Infrastructure исполняет текущие transaction/reservation алгоритмы; API задаёт прежние validation/execute/audit factories и отображает outcome. Это минимальное выделение текущего lifecycle; callbacks scoped и не сохраняются.
### Вариант C: Новый универсальный command framework и общая reservation policy
Увеличивает объём и меняет границы существующих разных algorithms; не нужен для текущей задачи.

## Решение
Выбран B: focused collaborators для common/refund/target execution, без общего framework и без унификации отличающихся algorithms. Snapshot EF query переносится буквально в Infrastructure ClientSnapshotReader, старый API reader оставляет delegating facade. Audit factory возвращает existing AuditLogEntry, запись выполняет workflow в текущей transaction. HTTP, CSRF, ProblemDetails и header parsing остаются API.

## Последствия
- Положительные: transport-free execution boundary, меньше взаимосвязанных lifecycle ветвей внутри handlers.
- Цена: typed descriptors/results, DI collaborators и API outcome mapping.
- Риски: callback sequencing и scoped state; защитить существующими PostgreSQL regressions и review.

## Cross-layer impact
- Backend: Application contracts, Infrastructure lifecycle/reader, API adapters и DI.
- Frontend: HTTP contracts unchanged; consumer tests обязательны.
- Bot: не меняется; Internal Bot API не затронут.
- Deploy/runtime: не меняется.
- Public or internal contracts: новые только backend-internal execution types, HTTP shape unchanged.

## Migration and rollback
Schema/data migration не нужна; последовательный revert task commits. Existing idempotency records, hash serialization и статусы совместимы.

## Validation
ClientMembership HTTP/write regression, target PostgreSQL barrier и client branch scope tests; full harness. Сначала baseline, затем каждый алгоритм с отдельной проверкой, финальное independent review.

## Open questions
- Нет.

## Approval
Пользователь, владелец проекта, 2026-11-16: «Подтверждаю, продолжай последовательно» в ответ на конкретное предложение трёх отдельных серверных сценариев, владеющих повторами/транзакциями/записью аудита, при сохранении проверки запросов, ответов и текста аудита в HTTP-слое. [Approval record](/backlog/implementation/TASK-198-membership-execution.md).
