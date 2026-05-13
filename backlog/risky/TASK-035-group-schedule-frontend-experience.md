# TASK-035: Реализовать frontend-расписание групповых занятий

## Status
risky

## Goal
Frontend показывает расписание групповых занятий, автоматически собранное из графика занятий по группам, и позволяет администратору заполнять обязательные schedule-поля группы.

## Context
Задача создана после завершения уточнений в `TASK-028` и зависит от backend-контракта из `TASK-034`.

Уточненная продуктовая модель:
- Расписание нужно только для групповых занятий.
- Источник расписания - график занятий по группам.
- Расписание формируется автоматически на основе графика занятий по группам.
- У группы обязательны тип группы, филиал, зал, время начала и продолжительность занятия.
- Переносы, отмены, замены тренера, проверки занятости зала, конфликты времени, посещаемость и уведомления не входят в текущую модель.

## User role
администратор / тренер / владелец

## Problem
Пользователю нужно видеть расписание групповых занятий без ручного ведения отдельного календаря, а форма группы должна собрать все данные, необходимые backend для такого расписания.

## Scope
- Обновить frontend API types после `TASK-034`.
- Добавить или обновить поле продолжительности занятия в форме создания/редактирования группы.
- Убедиться, что в форме группы доступны тип группы, филиал, зал, время начала, продолжительность и график занятий.
- Отображать расписание групповых занятий на основе backend group schedule data.
- Для тренера показывать расписание только по группам, доступным через backend access scope.
- Для администратора/владельца показывать расписание по доступным группам с филиалом, залом, типом группы, тренерами, временем начала и продолжительностью.
- Показать пустое состояние, если групповой график еще не заполнен.

## Out of scope
- Персональные тренировки.
- Переносы, отмены и замены тренера.
- Проверка занятости зала и конфликтов времени во frontend.
- Изменение attendance flows.
- Уведомления и bot notifications.
- Backend domain rules.

## Constraints
- Frontend не должен дублировать CRM domain rules; validation source of truth остается в backend.
- Branch/hall filtering must follow backend contracts from `TASK-031` and `TASK-034`.
- Significant UX change: involve `ui-designer` before implementation.
- Если backend contract changes affect bot or attendance consumers, create/update a separate consumer task instead of hiding the coupling in frontend work.

## Acceptance criteria
- [ ] Форма группы позволяет заполнить продолжительность занятия.
- [ ] Форма группы отправляет backend все обязательные schedule-поля.
- [ ] Ошибки backend validation по schedule-полям отображаются в форме.
- [ ] Расписание групповых занятий строится из backend group schedule data, а не из frontend-only правил.
- [ ] В расписании видны группа, тип группы, филиал, зал, тренер(ы), время начала и продолжительность.
- [ ] UI не предлагает переносы, отмены, замены тренера или conflict resolution.
- [ ] Responsive layout не перекрывает расписание и действия.

## Test checklist
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Добавить или обновить frontend/e2e coverage для group schedule fields.
- [ ] Вручную проверить desktop, tablet и mobile.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: frontend depends on backend schedule contract changes and touches group management plus a new schedule-facing workflow.

## Clarification questions
Не требуется.

## Source notes
- Derived from: `backlog/done/TASK-028-schedule-product-model.md`
- Depends on: `backlog/risky/TASK-034-group-schedule-backend-model.md`

## Processing notes
- Created at: 2026-05-13
- Created after TASK-028 clarification was completed.
