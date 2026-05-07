# TASK-005: Расширить scenario tests Telegram-бота

## Status
ready

## Goal
Telegram MVP защищен regression tests по ролям, ограничениям, поиску, абонементам, оплате и idempotency.

## Context
Нужно расширить Python scenario tests: роли `HeadCoach` / `Administrator` / `Coach`, ограничения дат, forbidden responses и `BotAccessDenied`, search pagination, membership lists, mark-payment idempotency, private-chat/idempotency pipeline.

## User role
система

## Problem
Критичные Telegram-сценарии могут регрессировать без достаточно широкого test coverage.

## Scope
- Найти существующий scenario test harness в `bot/`.
- Добавить или расширить tests по перечисленным сценариям.
- Использовать существующие fixtures и fake API patterns.
- Зафиксировать edge cases без изменения production behavior.

## Out of scope
- Реализация новых функций, которые еще не существуют.
- Переписывание test architecture без необходимости.

## Constraints
- Tests должны отражать backend-контракты, а не придумывать CRM-правила в боте.
- Не делать brittle assertions на несущественный текст, если есть устойчивые признаки сценария.

## Acceptance criteria
- [ ] Tests покрывают роли `HeadCoach`, `Administrator`, `Coach`.
- [ ] Tests покрывают ограничения дат и forbidden responses.
- [ ] Tests покрывают `BotAccessDenied`, search pagination, membership lists и mark-payment idempotency.
- [ ] Tests покрывают private-chat/idempotency pipeline.

## Test checklist
- [ ] Запустить `cd bot && ruff check .`.
- [ ] Запустить `cd bot && pytest`.
- [ ] Проверить, что новые tests падают при удалении соответствующей защиты.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: задача добавляет regression coverage и не должна менять runtime behavior.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/inbox/2026-05-04.md`
- Original note: `Расширить Python scenario tests: роли HeadCoach / Administrator / Coach; ограничения дат; forbidden responses и BotAccessDenied; search pagination; membership lists; mark-payment idempotency; private-chat/idempotency pipeline.`

## Processing notes
- Created at: 2026-05-07 11:26
- Created by skill: codex-backlog-skill
- Duplicate check: existing task folders were empty before processing; no duplicate found.
