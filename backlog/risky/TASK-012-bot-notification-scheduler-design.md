# TASK-012: Спроектировать уведомления и scheduler Telegram-бота

## Status
risky

## Goal
Появляется безопасная проектная основа для напоминаний, ежедневных сводок и уведомлений о неотмеченной посещаемости.

## Context
Нужно спроектировать `BotNotificationSettings`, `bot_delivery_log` и scheduler после уточнения backend-модели расписаний тренировок. Затем реализовать напоминания, ежедневные сводки и уведомления с защитой от дублей.

## User role
администратор / тренер / система

## Problem
Уведомления требуют расписания, delivery log и защиты от дублей; без дизайна можно легко создать спам, пропуски или неверные уведомления.

## Scope
- Уточнить backend-модель расписаний тренировок.
- Спроектировать настройки уведомлений.
- Спроектировать delivery log и idempotency для отправок.
- Определить scheduler lifecycle и failure handling.
- Разбить реализацию на отдельные tasks.

## Out of scope
- Немедленная реализация всех видов уведомлений.
- Изменение расписания тренировок без отдельной задачи.

## Constraints
- Schedule conflict logic и attendance rules принадлежат backend.
- Scheduler должен иметь защиту от дублей.
- Нужно учитывать opt-in/opt-out и роли получателей.

## Acceptance criteria
- [ ] Описана модель `BotNotificationSettings`.
- [ ] Описан `bot_delivery_log` и ключи идемпотентности.
- [ ] Описан scheduler flow для напоминаний, сводок и неотмеченной посещаемости.
- [ ] Созданы отдельные implementation tasks после дизайна.

## Test checklist
- [ ] Проверить сценарии повторного запуска scheduler.
- [ ] Проверить отсутствие дублей при retry.
- [ ] Проверить permissions и роли получателей.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача затрагивает scheduler, расписание, attendance и delivery correctness.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/inbox/2026-05-04.md`
- Original note: `Спроектировать BotNotificationSettings, bot_delivery_log и scheduler после уточнения backend-модели расписаний тренировок. Реализовать напоминания, ежедневные сводки и уведомления о неотмеченной посещаемости с защитой от дублей.`

## Processing notes
- Created at: 2026-05-07 11:26
- Created by skill: codex-backlog-skill
- Duplicate check: existing task folders were empty before processing; no duplicate found.
