# TASK-128: Выделить membership UI из ClientManagement

## Status
done

## Goal
Membership snapshot, purchase, renew, correct, payment, comment и refund UI
имеют отдельные typed feature modules без изменения финансового workflow.

## Context
Критический membership UI занимает крупную часть 3430-строчного
`ClientManagement.tsx`: forms, idempotency key, date/price formatting,
confirmation и history mapping находятся рядом с общими client screens.

## User role
Администратор и главный тренер, управляющие абонементами клиента.

## Problem
Изменение формы или presentation helper может незаметно затронуть другую
операцию с оплатой, сроком, комментарием или возвратом.

## Scope
- Выполнять после TASK-127 на актуальном `origin/main`.
- Выделить membership snapshot/history, sale comment и financial summary.
- Выделить purchase, renew и correct panels с локальными typed form models.
- Выделить confirmation/payment/refund surfaces и formatting helpers.
- Сохранить idempotency key ownership на уровне одной submit operation.
- Не создавать frontend domain service; backend API/ProblemDetails остаются source of truth.
- Каждый module не превышает 500 строк; общий membership barrel — 150 строк.

## Out of scope
- Изменение pricing, validity, payment/refund или membership target semantics.
- API/DTO/backend changes и redesign client profile.
- Объединение разных operations в одну универсальную dynamic form.

## Constraints
- Сохранить exact request payloads и обработку backend validation keys.
- Pending submit нельзя повторить с новым idempotency key.
- Не вычислять permissions, prices или validity rules во frontend.
- Visible actions, confirmation и recovery paths остаются на прежних местах.
- Обязательны `refactoring-specialist`, `react-specialist` и `test-automator`.

## Acceptance criteria
- [x] Membership operations разделены по state/submit ownership.
- [x] Request payloads и idempotency behavior не изменились.
- [x] Payment/refund/comment attribution и history ordering сохранены.
- [x] Все loading/error/pending/disabled/success states имеют прежнее поведение.
- [x] Ни один membership module не превышает 500 строк.
- [x] Frontend quality baseline и membership browser regressions проходят.

## Test checklist
- [x] Characterization tests purchase/renew/correct payloads and validation.
- [x] Tests same-submit idempotency, double-click protection и retry recovery.
- [x] Refund/comment/payment/history regressions.
- [x] Permission-restricted и backend ProblemDetails paths.
- [x] Запустить lint, strict typecheck, raw-color, unit, build и affected Playwright/WebKit tests.

## Completion notes
- Completed at: 2026-08-23.
- Membership UI split into client-local `frontend/src/features/clients/membership/`
  modules with `index.ts` barrel under 150 lines and every module under 500
  lines.
- Exact purchase/renew/correct payloads, backend ProblemDetails draft recovery,
  sale comment identity, history ordering and idempotency retry lifecycle covered
  by unit and affected browser regressions.
- iPhone WebKit membership-only Playwright regression passed for 420 x 912 and
  440 x 956 via temporary task config. Full run including transfer scenarios
  exposed an unrelated transfer modal bottom-nav interception on iPhone profiles.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: UI refactoring затрагивает деньги, абонементы, idempotency и пользовательское подтверждение критических операций.

## Clarification questions
Не требуется: product workflow и backend contract запрещено менять.

## Source notes
- Source: direct user request, 2026-08-22.
- Parent task: `/backlog/risky/TASK-121-decompose-oversized-cross-layer-files.md`.

## Processing notes
- Created at: 2026-08-22 23:47 MSK.
- Created by skill: codex-backlog-skill + react-best-practices + crm-mobile-first-ui.
- Duplicate check: TASK-114/TASK-115 относятся к behavior/data model; эта задача только структурирует существующий consumer.
