# TASK-001: Исправить audit BotAccessDenied из Python-бота

## Status
done

## Implementation lifecycle
- closed_by_status_audit_at: 2026-07-25
- implementation_evidence: `feature/TASK-083-membership-payment-status-simplification` (`d64ca57`) and current backend/bot regression coverage

## Goal
Отказы доступа из Telegram-бота надежно записываются в audit один раз на событие и не создают дублей при повторной обработке.

## Context
В Telegram MVP нужно передавать `Idempotency-Key` в `CrmBotApiClient.audit_access_denied`, строить стабильный idempotency key в `BotService` и добавить regression tests на заголовок и успешную запись audit.

## User role
система

## Problem
Сейчас запись `BotAccessDenied` из Python-сервиса может быть неидемпотентной или не соответствовать backend-контракту аудита.

## Scope
- Проверить контракт backend endpoint для audit access denied.
- Передавать `Idempotency-Key` из Python-клиента.
- Построить стабильный ключ в `BotService` из детерминированных данных события.
- Добавить regression tests на заголовок и успешную запись audit.

## Out of scope
- Изменение audit-семантики backend без отдельной задачи.
- Переработка всей idempotency pipeline бота.

## Constraints
- Не дублировать audit, role и permission правила вне backend.
- Не менять ProblemDetails и audit-контракты без обновления потребителей.
- Повторный callback или update не должен создавать вторую audit-запись.

## Acceptance criteria
- [x] `CrmBotApiClient.audit_access_denied` отправляет `Idempotency-Key`.
- [x] `BotService` формирует стабильный idempotency key для access denied события.
- [x] Повторная обработка того же события не создает дубликаты audit.
- [x] Regression tests покрывают заголовок и успешный audit request.

## Test checklist
- [x] Запустить `cd bot && ruff check .`.
- [x] Запустить `cd bot && pytest`.
- [x] При изменении backend-контракта запустить `dotnet test backend/GymCrm.slnx`.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача затрагивает audit, access denied, idempotency и security-sensitive поток.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/inbox/2026-05-04.md`
- Original note: `Исправить запись BotAccessDenied из Python-сервиса: передавать Idempotency-Key в CrmBotApiClient.audit_access_denied; строить стабильный idempotency key в BotService; добавить regression tests на заголовок и успешную запись audit.`

## Processing notes
- Created at: 2026-05-07 11:26
- Created by skill: codex-backlog-skill
- Duplicate check: existing task folders were empty before processing; no duplicate found.
- Closed at: 2026-07-25 by backlog status audit.
- Evidence: Python client sends `Idempotency-Key`; `BotService` derives it from platform user, update id and denial reason; backend reserves the key and returns the prior response for a duplicate. Bot and backend tests cover the header, non-retry mutation behavior and duplicate audit cardinality.
