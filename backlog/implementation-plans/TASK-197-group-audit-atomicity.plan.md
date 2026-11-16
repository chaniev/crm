# TASK-197: План атомарности обновления группы

## Metadata
- source_task: /backlog/implementation/TASK-197-group-audit-atomicity.md
- branch: fix/TASK-197-group-audit-atomicity
- readiness: yes
- requirements: REQ-AUD-001 — implements
- product_decisions: none — восстанавливается существующая обязательность аудита без новых правил
- technical_decisions: none — используется существующая mutation transaction и AuditLogService
- architecture_decisions: none — локальное исправление порядка операций в существующей транзакции
- open_questions: none
- dependencies: none
- risk: medium — сохранение audit payload и повторной проверки доступа к ответу

## Decisions and contracts
Обязательный audit write выполняется после SaveChanges, но до commit mutation transaction. После commit остаётся отдельное чтение ответа с актуальной проверкой доступа. Snapshot для нового значения аудита читается внутри mutation transaction; формат audit не меняется. Миграций нет; rollback через revert task commit.

## Decision evidence
[Запрос пользователя и scope](/backlog/implementation/TASK-197-group-audit-atomicity.md). Существующие REQ-AUD-001 и backend invariant требуют согласованности изменения и аудита.

## Implementation slices
1. Добавить PostgreSQL тест на audit failure / rollback / retry / old-new payload для PUT группы; подтвердить red на текущем коде.
2. Переместить audit write в существующую mutation transaction, сохранить response scope check.
3. Повторить regression, обязательные проверки и review; обновить requirement evidence и локально закоммитить.

## Regression specification
Расширить MutationAuditAtomicityPostgreSqlTests: отдельно создать группу и тип, сохранить snapshot, инъецировать failure TrainingGroupUpdated, проверить unchanged snapshot, затем successful retry и единственный audit с корректными old/new values. Основной барьер — PostgreSQL test; также существующие group/access-scope tests. Не менять API/DTO/разрешения.

## Risks and stop conditions
Остановиться при необходимости новых locks или изменении публичного payload; существующие транзакционные механизмы достаточны. Не редактировать незарегистрированные handlers.
