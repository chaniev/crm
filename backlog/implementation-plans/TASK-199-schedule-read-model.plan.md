# TASK-199: Общая проекция фактического расписания

## Metadata
- source_task: /backlog/implementation/TASK-199-schedule-read-model.md
- branch: codex/TASK-199-schedule-read-model
- readiness: yes
- requirements: REQ-BOT-003 — changes; REQ-GRP-004 — implements; REQ-ATT-002, REQ-ATT-003, REQ-BOT-002 — constrains
- product_decisions: accepted
- technical_decisions: accepted
- architecture_decisions: ADR-0008
- open_questions: none
- dependencies: TASK-198 — локально интегрирована 6f2e27c
- risk: medium — scope, actual locators и сохранение web revisions/filter behavior

## Decisions and contracts
[ADR-0008](/docs/architecture/adr/0008-shared-schedule-projection.md) фиксирует общую серверную проекцию и scoped reader. REQ-BOT-003 принят до project code: one-off/переносы/замещения, Cancelled строка без кнопки; устаревший locator не сохраняет отметки. Existing rights/date policies, AttendanceService transaction checks, DTO shape, web filters/revisions и idempotency сохраняются. Новых блокировок, schema или framework нет. Rollback через revert task commit.

## Decision evidence
- product: [Решения владельца](/backlog/implementation/TASK-199-schedule-read-model.md) — owner: пользователь проекта; decision: единые актуальные занятия и отменённые строки без кнопки отметок.
- technical: [Общая серверная модель](/docs/architecture/adr/0008-shared-schedule-projection.md) — owner: пользователь проекта; decision: выполнить общий backend read model для принятого единого фактического календаря без расходящихся сборок.

## Implementation slices
1. Добавить HTTP regressions общего actual lesson list и rejected stale/cancelled writes; Python regressions mixed/all-cancelled списка и backend permissions. Подтвердить red на текущем коде; correct web tests сохранить.
2. Выделить typed facts, pure projection/effective trainers и scoped reader на базе web алгоритма; подключить API wrappers и Bot list/resolver. Сохранить actor/scope rechecks и final AttendanceService guard.
3. Python оставляет строки и создаёт кнопки по backend canEditAttendance. Обновить shared-contract routing backend/AGENTS.md и harness, покрыть selector regression.
4. Focused tests, independent review, local candidate code commit; full task-aware harness on the clean candidate SHA; local integration and closure only after all checks pass. Следующий рефакторинг — после успешного завершения этого шага.

## Regression specification
ScheduleLessonsApiTests, InternalBotApiTests, AttendanceApiTests и existing PostgreSQL suites. Новые tests: stable IDs, actual dates/times/halls/trainers, one-off, cancellation/restore, moved beyond date range, exact substitute read scope, read-without-write. Старые roster/save locators после переноса отклоняются; cancelled save не меняет attendance/audit и не оставляет reservation. Python проверяет текст и markup через AttendanceFlow, включая ограничения flags и all-cancelled. Harness regression проверяет обоих consumers новой Scheduling границы.

## Planning review
Независимый review 17.11.2026 подтвердил границу и достаточность принятых решений. AttendanceService уже проверяет materialized ID глобально, actual date и Scheduled внутри transaction; нового механизма не требуется. Bot resolver не должен recurring fallback поверх moved row. Cancelled roster read можно сохранить, write должен отклоняться. Существующее ограничение Coach save по постоянным назначениям не расширяется.

## Risks and stop conditions
Новые guarantees параллельных schedule mutations, расширение доступа, изменение DTO shapes или schema возвращают affected plan к planning. Не копировать action-only today worklist фильтры в Bot и не менять snapshots истории.

## Required standalone path found during implementation — 2026-11-17
One-off creation validates group/scope/hall/time but does not require an overlapping series. Current web query loses a valid standalone one-off or moved occurrence after series end because candidate group IDs come only from overlapping series. The accepted actual-calendar/one-off contract requires this path. Extend materialized candidates only for authorized groups without any overlapping series, using the existing AttendanceScope and branch/group/type filters, plus actual hall for those additional candidates. Keep existing-series filter behavior and filterOptions unchanged. Negative scope/filter regression is required. This is an existing-scope query completion, not a new permission or synchronization mechanism.
