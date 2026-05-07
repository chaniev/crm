# TASK-003: Довести выбор даты посещаемости в Telegram-боте

## Status
risky

## Goal
`HeadCoach` и `Administrator` могут корректно работать с посещаемостью за прошлые даты в Telegram-боте.

## Context
Нужно добавить реальный выбор произвольной даты в прошлом либо явно зафиксировать продуктово упрощенный набор быстрых дат.

## User role
администратор / тренер

## Problem
Сценарий посещаемости неясно поддерживает выбор даты в прошлом, из-за чего пользователи могут отмечать или смотреть не тот день.

## Scope
- Проверить текущие backend-ограничения по датам посещаемости.
- Реализовать выбранный UX: произвольная прошлая дата или ограниченный набор быстрых дат.
- Обновить тексты, callback flow и обработку ошибок.
- Покрыть роли `HeadCoach` и `Administrator` scenario tests.

## Out of scope
- Изменение правил списания посещений.
- Изменение backend permissions без отдельной задачи.
- Расширение календаря на будущие даты.

## Constraints
- Backend владеет attendance, permissions и validation semantics.
- Бот не должен обходить ограничения дат.
- Ошибки backend должны показываться пользователю безопасно и понятно.

## Acceptance criteria
- [ ] Для `HeadCoach` и `Administrator` доступен согласованный выбор прошлой даты.
- [ ] Недоступные даты не приводят к неконсистентной отметке посещаемости.
- [ ] Поведение выбранного UX явно зафиксировано в тестах.
- [ ] Forbidden responses остаются корректными для ролей без доступа.

## Test checklist
- [ ] Запустить `cd bot && ruff check .`.
- [ ] Запустить `cd bot && pytest`.
- [ ] Вручную проверить посещаемость в Telegram для `HeadCoach`, `Administrator` и `Coach`.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача затрагивает посещаемость, роли, ограничения дат и потенциальные списания.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/inbox/2026-05-04.md`
- Original note: `Довести посещаемость для HeadCoach и Administrator: добавить реальный выбор произвольной даты в прошлом; либо явно зафиксировать продуктово упрощенный набор быстрых дат, если произвольный выбор не нужен.`

## Processing notes
- Created at: 2026-05-07 11:26
- Created by skill: codex-backlog-skill
- Duplicate check: existing task folders were empty before processing; no duplicate found.
