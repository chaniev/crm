# TASK-028: Уточнить модель расписания

## Status
needs-clarification

## Goal
Понять, какое расписание нужно CRM: тренировки, группы, тренеры, филиалы, переносы, конфликты и уведомления.

## Context
В inbox есть короткая заметка: `Расписание`.

## User role
администратор / тренер / владелец / неизвестно

## Problem
Задача слишком широкая и касается рискованной области schedule conflict logic; неизвестны сценарии и правила.

## Scope
- Уточнить, какие сущности участвуют в расписании.
- Уточнить повторяемость занятий, переносы, отмены и замены тренера.
- Уточнить связь с посещаемостью и уведомлениями.
- После ответов разбить на backend/frontend/bot tasks.

## Out of scope
- Немедленная реализация расписания.
- Изменение посещаемости и уведомлений без согласованной модели расписания.

## Constraints
- Backend владеет schedule conflict logic, attendance и validation semantics.
- Расписание может стать dependency для bot notifications.
- Нужно предусмотреть migrations и contract validation.

## Acceptance criteria
- [ ] Описаны основные сценарии расписания.
- [ ] Описаны правила конфликтов, переносов и отмен.
- [ ] Описана связь с группами, тренерами, филиалами и посещаемостью.
- [ ] Созданы отдельные implementation tasks.

## Test checklist
- [ ] После будущей реализации проверить backend tests на schedule rules.
- [ ] Проверить frontend и bot consumers при contract changes.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: расписание затрагивает conflict logic, attendance, уведомления и потенциальные backend migrations.

## Clarification questions
- [ ] Расписание нужно для групповых занятий, персональных тренировок или обоих вариантов?
- [ ] Нужны ли повторяющиеся занятия?
- [ ] Как обрабатывать переносы, отмены и замены тренера?
- [ ] Должны ли филиалы участвовать в расписании?
- [ ] Как расписание связано с отметкой посещаемости и уведомлениями?

## Source notes
- Source file: `backlog/inbox/2026-05-06.md`
- Original note: `Расписание`

## Processing notes
- Created at: 2026-05-07 11:26
- Created by skill: codex-backlog-skill
- Duplicate check: existing task folders were empty before processing; no duplicate found.
