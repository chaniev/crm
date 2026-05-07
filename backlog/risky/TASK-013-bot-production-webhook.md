# TASK-013: Реализовать production webhook для Telegram-бота

## Status
risky

## Goal
Telegram-бот может работать в production через webhook с валидацией secret и понятной deployment-инструкцией.

## Context
Нужно реализовать production webhook: public base URL, webhook endpoint, secret validation, allowed updates и deployment-инструкцию.

## User role
система

## Problem
Long polling подходит для MVP/dev, но production webhook требует отдельной безопасности и инфраструктурной настройки.

## Scope
- Добавить webhook endpoint для Telegram updates.
- Поддержать public base URL config.
- Проверять secret token.
- Настроить allowed updates.
- Добавить deployment-инструкцию.

## Out of scope
- Полная перестройка deployment pipeline.
- Отказ от long polling в dev, если это не требуется.

## Constraints
- Webhook endpoint должен быть защищен secret validation.
- Нельзя логировать секреты и чувствительные payloads.
- Runtime/infrastructure changes требуют validation affected services.

## Acceptance criteria
- [ ] Webhook endpoint принимает Telegram updates.
- [ ] Secret validation отклоняет неподписанные или неверные запросы.
- [ ] Config содержит public base URL и allowed updates.
- [ ] README/deployment docs описывают setup и rollback.

## Test checklist
- [ ] Запустить `cd bot && ruff check .`.
- [ ] Запустить `cd bot && pytest`.
- [ ] Проверить webhook request с валидным и невалидным secret.
- [ ] При Docker/runtime изменениях выполнить `docker compose build bot`.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача затрагивает production deployment, security validation и runtime ingress.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/inbox/2026-05-04.md`
- Original note: `Реализовать production webhook: public base URL; webhook endpoint; secret validation; allowed updates; deployment-инструкция.`

## Processing notes
- Created at: 2026-05-07 11:26
- Created by skill: codex-backlog-skill
- Duplicate check: existing task folders were empty before processing; no duplicate found.
