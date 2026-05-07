# TASK-025: Рассчитать общую сумму абонементов по каждому тренеру

## Status
risky

## Goal
Владелец или администратор видит общую сумму абонементов, связанную с каждым тренером, по понятным правилам расчета.

## Context
В inbox есть заметка: `Расчет общей суммы абонементов по каждому тренеру`.

## User role
владелец / администратор

## Problem
Нет отчета или метрики, показывающей сумму абонементов в разрезе тренеров.

## Scope
- Уточнить текущую связь абонемента, клиента, группы и тренера.
- Определить backend endpoint/report query для суммы по тренеру.
- Добавить frontend отображение или отчет после согласования места в UI.
- Покрыть расчет tests.

## Out of scope
- Полный финансовый отчет по всем метрикам.
- Изменение правил оплаты или признания выручки.
- Расчет зарплаты тренеров.

## Constraints
- Backend владеет financial report semantics.
- Нужно явно определить период, статус абонемента и учет возвратов/отмен.
- Нельзя считать сумму только во frontend.

## Acceptance criteria
- [ ] Определено, какие абонементы входят в сумму тренера.
- [ ] Расчет выполняется backend-логикой или backend report query.
- [ ] UI показывает сумму по каждому тренеру в согласованном месте.
- [ ] Tests покрывают несколько тренеров и неоднозначные связи.

## Test checklist
- [ ] Запустить `dotnet test backend/GymCrm.slnx`.
- [ ] При frontend изменениях запустить `cd frontend && npm run lint`.
- [ ] При frontend изменениях запустить `cd frontend && npm run build`.
- [ ] Проверить данные с несколькими тренерами и периодами.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача относится к финансовым отчетам, абонементам и потенциально спорным правилам расчета.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/inbox/2026-05-06.md`
- Original note: `Расчет общей суммы абонементов по каждому тренеру`

## Processing notes
- Created at: 2026-05-07 11:26
- Created by skill: codex-backlog-skill
- Duplicate check: existing task folders were empty before processing; no duplicate found.
