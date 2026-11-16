# TASK-198: Выделить lifecycle операций абонемента из HTTP

## Status
done

## Requirements
- none — сохраняются API, бизнес-правила, scope, audit payloads, hash/replay, locks и transaction semantics

## Goal
HTTP handlers не выполняют reservation/replay/cleanup и transaction lifecycle операций абонемента; разные текущие algorithms остаются раздельными typed collaborators.

## Source and authorization
Пользователь проекта, 16.11.2026, текущий чат: «выполни каждый шаг предлагаемого рефакторинга», «после каждого шага комить локально изменения», «новый рефакторинг начинай после успешного завершения предыдущего шага», «после всех шагов рефакторинга запусти существующие тесты и добейся их позелеления».
Одобренное предложение шага 1: вынести выполнение операций абонемента из HTTP handlers, выделить reservation/replay handling, затем переносить по одной операции; HTTP responses оставить в API, не объединять различающиеся scenarios механически.
Предварительный fix TASK-197 завершён, локально интегрирован: f05716e / 5fb81ea; 782 backend + 769 frontend tests прошли.

## Scope
Common membership execution (включая существующего consumer перевода филиала), refund/cancel lifecycle, target transfer lifecycle. Application — typed contracts/outcomes, Infrastructure — existing EF/locks/idempotency/audit commit sequencing. API сохраняет CSRF/header parsing, request normalization, current operation-specific callbacks/factories и response/ProblemDetails mapping.

## Constraints
Никаких новых retries, locks, transaction isolation, схемы, public/internal HTTP DTOs, domain rules. Refund reservation не объединяется с common/target reservation. Immutable completed record не удаляется cleanup при неопределённом commit. Snapshot loader переносится буквально; API facade сохраняется для существующих consumers. Границы broad extraction закрепляются ADR до project code.

## Acceptance
- HTTP modules делегируют lifecycle focused execution services; Application result не зависит от HttpContext/IResult/EF/Staff DTO.
- Все существующие callbacks получают same scoped DbContext и actor recheck; audit entries пишутся внутри той же transaction.
- Сохраняются 204 после branch transfer, pending fast conflict, completed replay access checks, hash payload ordering и cancel/refund distinctions.
- Full backend/frontend checks и focused PostgreSQL regression green.

## Decision 2026-11-16
Пользователю предъявлена граница: три отдельных серверных сценария — обычные операции абонемента, возвраты и перенос групп — управляют проверками повторных запросов, транзакциями и записью аудита. HTTP-слой сохраняет проверку запросов, формирование ответов и текста аудита. Поведение, API и схема БД сохраняются. Явный ответ: «Подтверждаю, продолжай последовательно».

## Implementation lifecycle
- implementation_plan: /backlog/done/2026-11-16/TASK-198-membership-execution.plan.md
- implementation_branch: refactor/TASK-198-membership-execution

## Completion
- completed_at: 2026-11-16
- completion_date_evidence: local main fast-forward to 00bf8fb; [review](TASK-198-review.md), [verification](TASK-198-evidence/verification.json)
- delivered_on_main_at: 2026-11-16
