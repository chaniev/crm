# TASK-007: Добавить cleanup job для bot runtime tables

## Status
risky

## Goal
Старые `bot_conversation_states` и `bot_processed_updates` очищаются по управляемой retention-политике.

## Context
После MVP нужно добавить cleanup job для истекших conversation states и старых processed updates, а также env-настройку retention периода.

## User role
система

## Problem
Без cleanup runtime-таблицы Telegram-бота могут бесконечно расти и ухудшать надежность сервиса.

## Scope
- Определить текущие таблицы и поля времени жизни.
- Добавить безопасный cleanup job.
- Добавить env-настройку retention периода.
- Добавить tests на удаление только устаревших записей.

## Out of scope
- Миграция или удаление production data без отдельного review.
- Изменение idempotency semantics.

## Constraints
- Нельзя удалять данные, нужные для защиты от дублей в актуальном retention window.
- Нужны guardrails против слишком короткого retention.
- Background job не должен блокировать long polling.

## Acceptance criteria
- [ ] Cleanup удаляет только записи старше настроенного retention.
- [ ] Retention период настраивается через env/config.
- [ ] Есть безопасное значение по умолчанию.
- [ ] Tests покрывают границы retention и отсутствие удаления свежих записей.

## Test checklist
- [ ] Запустить `cd bot && ruff check .`.
- [ ] Запустить `cd bot && pytest`.
- [ ] При изменениях миграций или backend storage запустить affected backend validation.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача затрагивает background job и удаление runtime data.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/inbox/2026-05-04.md`
- Original note: `Добавить cleanup job для истекших bot_conversation_states и старых bot_processed_updates. Добавить env-настройку retention периода.`

## Processing notes
- Created at: 2026-05-07 11:26
- Created by skill: codex-backlog-skill
- Duplicate check: existing task folders were empty before processing; no duplicate found.
