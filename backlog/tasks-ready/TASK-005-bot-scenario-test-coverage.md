# TASK-005: Расширить scenario tests Telegram-бота

## Status
ready

## Requirements
- REQ-BOT-003 — verifies
- REQ-BOT-004 — verifies
- REQ-BOT-007 — verifies

## Goal
Telegram MVP защищен regression tests по актуальной матрице ролей, ограничениям, поиску, абонементам, attendance/audit idempotency и update pipeline.

## Context
Нужно расширить Python scenario tests: роли `HeadCoach` / `SuperAdministrator` / `Administrator` / `Coach`, ограничения дат, forbidden responses и `BotAccessDenied`, search pagination, expiring membership lists, attendance/audit idempotency, private-chat/update-idempotency pipeline.

Исходный пункт `mark-payment idempotency` удалён как неактуальный: TASK-083 убрала отдельный mark-payment flow.

## User role
система

## Problem
Критичные Telegram-сценарии могут регрессировать без достаточно широкого test coverage.

## Scope
- Найти существующий scenario test harness в `bot/`.
- Добавить или расширить tests по актуальным перечисленным сценариям.
- Использовать существующие fixtures и fake API patterns.
- Зафиксировать edge cases без изменения production behavior.

## Out of scope
- Реализация новых функций, которые еще не существуют.
- Переписывание test architecture без необходимости.

## Constraints
- Tests должны отражать backend-контракты, а не придумывать CRM-правила в боте.
- Не делать brittle assertions на несущественный текст, если есть устойчивые признаки сценария.

## Acceptance criteria
- [ ] Tests покрывают роли `HeadCoach`, `SuperAdministrator`, `Administrator`, `Coach`.
- [ ] Tests покрывают ограничения дат и forbidden responses.
- [ ] Tests покрывают `BotAccessDenied`, search pagination, expiring membership lists и attendance/audit idempotency.
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
- Updated at: 2026-07-25 by backlog status audit.
- Current gap: focused tests exist for several contracts, but the complete scenario matrix above is not yet proven; in particular search pagination, forbidden-to-audit flow and transport-level private/group chat handling remain incomplete.
