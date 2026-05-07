# TASK-010: Определить архитектуру read models Telegram-бота

## Status
needs-clarification

## Goal
Понять, оставлять ли сборку read models в `BotApiService` или выделять именованные query/use case классы.

## Context
В inbox отмечено архитектурное отличие полного плана: нужно решить, оставлять сборку read models в `BotApiService` или выделять отдельные именованные query/use case классы.

## User role
система

## Problem
Без архитектурного решения бот может накапливать крупный сервис со смешением transport, orchestration и query logic.

## Scope
- Оценить текущий размер и ответственность `BotApiService`.
- Определить критерии выделения query/use case классов.
- После решения создать implementation/refactoring task.

## Out of scope
- Немедленный широкий refactoring.
- Изменение backend business logic.

## Constraints
- Backend остается владельцем CRM domain rules.
- Рефакторинг не должен менять API contracts и Telegram behavior.
- Если структура меняется широко, нужно привлекать `refactoring-specialist`.

## Acceptance criteria
- [ ] Зафиксировано решение по `BotApiService`.
- [ ] Описаны границы query/use case классов, если они нужны.
- [ ] Определен минимальный первый refactoring slice.
- [ ] Создана отдельная implementation task.

## Test checklist
- [ ] Проверить текущие tests вокруг `BotApiService`.
- [ ] После будущего refactoring запустить `cd bot && pytest`.

## AI safety
- Safe for Codex: no
- Risk level: medium
- Reason: архитектурное решение может привести к широкому refactoring.

## Clarification questions
- [ ] Есть ли текущая боль от размера или ответственности `BotApiService`?
- [ ] Нужны ли query/use case классы уже сейчас или после стабилизации MVP?
- [ ] Какие сценарии должны стать первым refactoring slice?

## Source notes
- Source file: `backlog/inbox/2026-05-04.md`
- Original note: `Решить архитектурное отличие полного плана: оставлять сборку read models в BotApiService или выделять отдельные именованные query/use case классы.`

## Processing notes
- Created at: 2026-05-07 11:26
- Created by skill: codex-backlog-skill
- Duplicate check: existing task folders were empty before processing; no duplicate found.
