# TASK-124: Выделить membership HTTP orchestration из ClientEndpoints

## Status
done

## Goal
Transport orchestration покупки, продления, корректировки, оплаты, возвратов и
комментариев абонемента находится в отдельном bounded endpoint module.

## Context
Membership handlers, validation, idempotency records, transaction helpers,
error mapping и audit serialization занимают значительную часть
`ClientEndpoints.cs`. Slice выполняется после TASK-122 и TASK-123.

## User role
Администратор и главный тренер, выполняющие backend-разрешённые membership operations.

## Problem
Критические операции с оплатой и абонементами смешаны с client queries и
lifecycle routes, что увеличивает риск случайного изменения idempotency,
concurrency или audit behavior.

## Scope
- Перед переносом добавить недостающие HTTP characterization/regression tests.
- Выделить registration/handlers purchase, renew, correct, mark-payment,
  refund, cancel-refund и sale-comment.
- Выделить membership request validation и mutation-error mapping.
- Сохранить idempotency key parsing, payload hashing, record lifecycle,
  transaction/cleanup behavior и exact response replay.
- Выделить membership audit serialization рядом с HTTP orchestration.
- После TASK-122–124 оставить `ClientEndpoints.cs` composition root размером не
  более 300 строк; capability modules не должны превышать 900 строк каждый.

## Out of scope
- Изменение `IClientMembershipService` internals — TASK-125.
- Новые membership semantics, pricing, target groups, payment/refund rules.
- Изменение API DTO, ProblemDetails codes, schema или frontend forms.

## Constraints
- TASK-122 и TASK-123 должны быть интегрированы последовательно.
- Сохранить route templates, status codes, validation keys и idempotency replay.
- Не ослаблять DB overlap constraint и не скрывать concurrency exceptions.
- Audit failure продолжает откатывать обязательную mutation.
- Обязательны `refactoring-specialist`, `dotnet-backend-specialist` и `test-automator`.

## Acceptance criteria
- [x] Все membership HTTP contracts и ProblemDetails полностью сохранены.
- [x] Same-key retry возвращает тот же результат без второй mutation.
- [x] Different-key concurrent overlap даёт один success и один stable conflict, без `500`.
- [x] Refund/comment/audit isolation не изменена.
- [x] `ClientEndpoints.cs` после TASK-122–124 не превышает 300 строк и только композирует modules.
- [x] Полный backend quality baseline проходит.

## Test checklist
- [x] Characterization tests на все membership routes и validation failures.
- [x] Idempotency replay/in-progress/cleanup regression tests.
- [x] Повторить PostgreSQL concurrent-overlap test минимум 5 раз подряд.
- [x] Проверить mandatory audit rollback и отсутствие leaked constraint details.
- [x] Запустить format, Release build, полный xUnit suite и NuGet audit.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: refactoring затрагивает деньги, абонементы, idempotency, concurrency и обязательный audit.

## Clarification questions
Не требуется: бизнес-правила и HTTP contract явно запрещено менять.

## Source notes
- Source: direct user request, 2026-08-22.
- Parent task: `/backlog/risky/TASK-121-decompose-oversized-cross-layer-files.md`.

## Processing notes
- Created at: 2026-08-22 23:47 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: TASK-114/TASK-115 покрывают behavior regressions и новую target model, но не transport decomposition.

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-23
- moved_from: /backlog/risky
- implementation_plan: /backlog/done/TASK-124-client-membership-http-decomposition.plan.md
- implementation_branch: refactor/TASK-124-client-membership-http-decomposition
- implementation_state: completed
- implementation_commits: ffac884, 22ddd06, 3731a4d
- delivered_on_main_at: 2026-08-23
- moved_to_done_at: 2026-08-23
- last_status_reviewed_at: 2026-08-23

## Completion record
- Completed on: 2026-08-23; final local-main integration: `0a6dbfa`.
- `ClientEndpoints.cs` is a 15-line composition root; membership endpoint, validation and audit owners are separate top-level modules.
- Validation: exact seven-route/policy/ProblemDetails/idempotency/replay tests, `44/44` membership regressions, five PostgreSQL overlap repetitions and aggregate `430/430` xUnit tests passed; NuGet audit was clean.
- Runtime/data: HTTP contracts and schema were unchanged; migration and Docker Compose task stack were not required.
