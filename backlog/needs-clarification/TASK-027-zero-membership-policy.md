# TASK-027: Уточнить правила нулевого абонемента

## Status
needs-clarification

## Goal
Понять, что такое `нулевой абонемент` и как он влияет на оплаты, посещения, сроки, отчеты и права.

## Context
В inbox есть короткая заметка: `"Нулевой" абонемент`.

## User role
администратор / владелец / тренер / неизвестно

## Problem
Фраза не объясняет expected behavior: это бесплатный абонемент, тестовый доступ, служебная запись, абонемент без посещений или что-то другое.

## Scope
- Уточнить назначение нулевого абонемента.
- Уточнить цену, количество посещений, срок действия и статус оплаты.
- Уточнить влияние на посещаемость, списания и финансовые отчеты.
- После ответов создать risky implementation task.

## Out of scope
- Реализация нового типа абонемента до согласования правил.
- Изменение payment/reporting logic без отдельного review.

## Constraints
- Backend владеет memberships, subscriptions, visit write-offs и financial report semantics.
- Нужны tests на отчетность и списания.
- Нужно определить, как нулевой абонемент отображается во frontend и bot.

## Acceptance criteria
- [ ] Описано назначение нулевого абонемента.
- [ ] Определены цена, срок, посещения и payment status.
- [ ] Определено влияние на посещаемость и отчеты.
- [ ] Создана отдельная risky implementation task.

## Test checklist
- [ ] После будущей реализации проверить backend membership tests.
- [ ] Проверить отображение во frontend и bot consumers.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача затрагивает абонементы, списания и финансовые отчеты, но требования пока не определены.

## Clarification questions
- [ ] Что означает `нулевой`: цена 0, 0 посещений, бессрочный тестовый доступ или другое?
- [ ] Должен ли нулевой абонемент списывать посещения?
- [ ] Должен ли он попадать в финансовые отчеты?
- [ ] Кто может создавать такой абонемент?
- [ ] Нужен ли audit event при создании или использовании?

## Source notes
- Source file: `backlog/inbox/2026-05-06.md`
- Original note: `"Нулевой" абонемент`

## Processing notes
- Created at: 2026-05-07 11:26
- Created by skill: codex-backlog-skill
- Duplicate check: existing task folders were empty before processing; no duplicate found.
