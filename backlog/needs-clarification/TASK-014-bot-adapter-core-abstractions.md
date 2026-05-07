# TASK-014: Уточнить adapter/core абстракции для будущего MAX

## Status
needs-clarification

## Goal
Понять, какие adapter/core границы нужны после стабилизации Telegram-сценариев для поддержки будущего MAX.

## Context
В inbox указано: после стабилизации Telegram-сценариев выделить adapter/core абстракции для будущего `MAX`.

## User role
система

## Problem
Задача сформулирована как будущий refactoring, но неизвестно, какие именно каналы, сценарии и shared core нужны.

## Scope
- Уточнить, что такое `MAX` в контексте проекта.
- Определить сценарии, которые должны быть общими между Telegram и MAX.
- Определить минимальный refactoring slice после стабилизации Telegram.

## Out of scope
- Реализация MAX-адаптера.
- Широкий refactoring Telegram-бота без подтвержденных границ.

## Constraints
- Refactoring должен сохранять Telegram behavior.
- Если структура меняется широко, нужно привлекать `refactoring-specialist`.
- Нельзя вытаскивать backend domain rules в bot core.

## Acceptance criteria
- [ ] Описан целевой канал `MAX` и его требования.
- [ ] Выделены общие сценарии и channel-specific части.
- [ ] Согласован минимальный первый refactoring slice.
- [ ] Создана отдельная implementation task.

## Test checklist
- [ ] Проверить существующие Telegram scenario tests как safety net.
- [ ] После будущего refactoring запустить `cd bot && pytest`.

## AI safety
- Safe for Codex: no
- Risk level: medium
- Reason: задача широкая и зависит от будущего канала и стабилизации Telegram-сценариев.

## Clarification questions
- [ ] Что именно означает `MAX` и какие API/ограничения у канала?
- [ ] Какие Telegram-сценарии должны стать общими?
- [ ] Какие части должны остаться adapter-specific?
- [ ] Когда Telegram-сценарии считаются достаточно стабильными для refactoring?

## Source notes
- Source file: `backlog/inbox/2026-05-04.md`
- Original note: `После стабилизации Telegram-сценариев выделить adapter/core абстракции для будущего MAX.`

## Processing notes
- Created at: 2026-05-07 11:26
- Created by skill: codex-backlog-skill
- Duplicate check: existing task folders were empty before processing; no duplicate found.
