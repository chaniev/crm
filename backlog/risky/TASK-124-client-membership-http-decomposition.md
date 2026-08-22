# TASK-124: Выделить membership HTTP orchestration из ClientEndpoints

## Status
risky

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
- [ ] Все membership HTTP contracts и ProblemDetails полностью сохранены.
- [ ] Same-key retry возвращает тот же результат без второй mutation.
- [ ] Different-key concurrent overlap даёт один success и один stable conflict, без `500`.
- [ ] Refund/comment/audit isolation не изменена.
- [ ] `ClientEndpoints.cs` после TASK-122–124 не превышает 300 строк и только композирует modules.
- [ ] Полный backend quality baseline проходит.

## Test checklist
- [ ] Characterization tests на все membership routes и validation failures.
- [ ] Idempotency replay/in-progress/cleanup regression tests.
- [ ] Повторить PostgreSQL concurrent-overlap test минимум 5 раз подряд.
- [ ] Проверить mandatory audit rollback и отсутствие leaked constraint details.
- [ ] Запустить format, Release build, полный xUnit suite и NuGet audit.

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
