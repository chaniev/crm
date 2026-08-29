# TASK-002: Показывать остаток дней в списке заканчивающихся абонементов Telegram-бота

## Status
ready

## Requirements
- REQ-BOT-003 — changes
- REQ-SUB-005 — constrains

## Goal
Пользователь Telegram-бота видит дату окончания и количество оставшихся дней по каждому заканчивающемуся абонементу.

## Context
Исходная задача объединяла список заканчивающихся абонементов и подтверждение последующей оплаты. TASK-083 удалила unpaid/mark-payment сценарий: добавление абонемента теперь сразу фиксирует оплату, поэтому подтверждение отдельной оплаты больше не существует.

Backend internal bot contract уже возвращает `daysUntilExpiration`, Python DTO его принимает, но `_render_membership_list_text` показывает только тип и дату окончания. Актуальный остаток задачи — отобразить backend-значение и закрепить формат тестом.

## User role
администратор / тренер

## Problem
В списке заканчивающихся абонементов дата видна, но пользователю приходится самостоятельно оценивать, сколько дней осталось.

## Scope
- Обновить сообщение списка заканчивающихся абонементов.
- Отображать готовое backend-поле `daysUntilExpiration`, не вычисляя membership semantics в боте.
- Покрыть формат для нескольких значений и частичных данных focused tests.

## Out of scope
- Изменение правил действия абонементов.
- Возврат удалённых unpaid/mark-payment endpoints, меню или подтверждения оплаты.
- Изменение финансовой логики и даты оплаты из TASK-083.
- Добавление новых типов абонементов.

## Constraints
- Backend остается источником истины по memberships и сроку действия.
- Бот отображает `daysUntilExpiration`, возвращённый backend, и не пересчитывает его из локальной даты.
- Даты должны быть однозначными и проверяемыми в тестах.

## Acceptance criteria
- [ ] В списке заканчивающихся абонементов видно количество дней до окончания.
- [ ] Формат использует backend `daysUntilExpiration` и не содержит локального расчёта membership validity.
- [ ] Формат не ломается на отсутствующих или частичных данных.
- [ ] Добавлен focused regression test на текст списка.

## Test checklist
- [ ] Запустить `cd bot && ruff check .`.
- [ ] Запустить `cd bot && pytest`.
- [ ] Вручную проверить Telegram-сценарий списка заканчивающихся абонементов.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: low
- Reason: после TASK-083 задача ограничена отображением готового backend-поля без write-flow и изменения доменных правил.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/inbox/2026-05-04.md`
- Original note: `Довести отображение абонементов: в списке заканчивающихся показывать количество дней до окончания; в подтверждении оплаты показывать ФИО, тип абонемента, дату покупки и дату окончания.`

## Processing notes
- Created at: 2026-05-07 11:26
- Created by skill: codex-backlog-skill
- Duplicate check: existing task folders were empty before processing; no duplicate found.
- Updated at: 2026-07-25 by backlog status audit.
- Superseded scope: отдельное подтверждение оплаты удалено TASK-083 и не должно возвращаться.
- Remaining evidence: backend `BotExpiringMembershipListItem.DaysUntilExpiration` and Python `ClientListItem.days_until_expiration` exist; current renderer still omits the value.
