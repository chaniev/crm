# TASK-198: Membership execution extraction

## Metadata
- source_task: /backlog/done/2026-11-16/TASK-198-membership-execution.md
- branch: refactor/TASK-198-membership-execution
- readiness: yes
- requirements: none — behavior-preserving extraction, без API/schema/domain changes
- product_decisions: none — продуктовые правила не меняются
- technical_decisions: accepted
- architecture_decisions: ADR-0007
- open_questions: none
- dependencies: TASK-197 — локально интегрирована 5fb81ea
- risk: high — деньги, access races, idempotency и audit

## Decisions and contracts
[ADR-0007](/docs/architecture/adr/0007-membership-execution-boundary.md) фиксирует выбранную границу, сохранение трёх разных algorithms и запрет расширения guarantees. Validation/execute/audit callbacks повторяют текущие responsibilities и scoped lifetime; HTTP result строится только API. Старый snapshot-loader facade делегирует новому Infrastructure reader. UI/API/schema не меняются; rollback через revert commits.

## Decision evidence
- technical: [Принятая граница](/docs/architecture/adr/0007-membership-execution-boundary.md) — owner: пользователь проекта; decision: выполнить предложенный перенос lifecycle из HTTP с сохранением контрактов и раздельных algorithms.

## Implementation slices
1. Зафиксировать baseline и dependency map: common purchase/renew/correct + ClientLifecycle transfer, refund/cancel, target transfer; сверить status/error/validation/hash/lease/cleanup paths.
2. Перенести snapshot loader без изменения query; ввести transport-free typed outcomes и operation descriptors на основе существующих callbacks.
3. Последовательно выделить common execution, refunds и target transfer; сохранить отдельные reservation algorithms, подключить через scoped DI. Выделить API response mapping и audit entry factories.
4. Проверить focused contracts/concurrency/rollback, независимое review, full diff-selected baseline, локальный commit и integration.

## Regression specification
Baseline уже green на 5fb81ea (782 backend tests). Искусственный red не нужен для переноса без изменения поведения. Обязательный barrier: ClientsApiTests, ClientMembershipWriteRegressionApiTests, ClientMembershipTargetPostgreSqlBarrierTests и AdministratorClientScopePostgreSqlTests. Проверить одинаковый payload replay, conflicting/pending/expired keys, refund/cancel totals и audit rollback, transfer response after access loss. Existing tests сохраняются; недостающий observable scenario добавляется до соответствующего переноса.

## Risks and stop conditions
Новый public HTTP contract, новые locks/transaction boundaries, изменения callback ordering или refund/common replay semantics требуют возврата affected plan в planning. Не начинать следующий предложенный рефакторинг до commit и успешных проверок этого шага.

## Planning review
Independent backend review confirms existing algorithms can move without a new mechanism. Preserve lazy payload creation after validation, current callback order, scoped DbContext, distinct refund/common reservation ordering, Pending-only cleanup, and old HTTP mapping exception boundaries. User explicitly accepted the concrete boundary on 2026-11-16.
