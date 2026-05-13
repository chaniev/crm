# TASK-034: Реализовать backend-модель графика групповых занятий

## Status
risky

## Goal
Backend хранит и валидирует график занятий группы, включая тип группы, филиал, зал, время начала и продолжительность занятия, чтобы расписание CRM формировалось автоматически на основе групп.

## Context
Задача создана после завершения уточнений в `TASK-028`.

Уточненная продуктовая модель:
- Расписание нужно только для групповых занятий.
- Источник расписания - график занятий по группам.
- Расписание формируется автоматически на основе графика занятий по группам.
- У группы обязательны тип группы, филиал, зал, время начала и продолжительность занятия.
- Персональные тренировки, переносы, отмены, замены тренера, проверки занятости зала, конфликты времени, посещаемость и уведомления не входят в текущую модель.

Текущий backend уже содержит `TrainingGroup.ScheduleText`, `TrainingGroup.TrainingStartTime`, `BranchId`, `HallId` и `GroupTypeId`, но не содержит продолжительность занятия как обязательное поле графика.

## User role
администратор / тренер / владелец

## Problem
График группы пока не описывает полную продуктовую модель расписания: не хватает продолжительности занятия и явного backend-контракта, из которого frontend может строить расписание по группам.

## Scope
- Достроить backend-модель графика занятий группы.
- Добавить обязательную продолжительность занятия в group create/update contracts, domain model, persistence и responses.
- Сохранить или аккуратно мигрировать существующее представление дней/периодичности группы (`scheduleText`), чтобы текущие consumers не ломались без необходимости.
- Обеспечить backend-валидацию обязательных полей группы: тип группы, филиал, зал, время начала, продолжительность занятия и график занятий.
- Вернуть данные, достаточные frontend для автоматического отображения расписания на основе групп.
- Обновить audit state и ProblemDetails validation errors для новых полей.
- Обновить backend tests для group create/update/list/details и affected read models.

## Out of scope
- Персональные тренировки.
- Переносы, отмены и замены тренера.
- Проверка занятости зала и конфликтов времени.
- Автоматическое создание attendance records.
- Уведомления и bot notifications.
- Frontend-экран расписания.

## Constraints
- Backend owns CRM validation semantics and group schedule contracts.
- Филиалы и залы должны использовать backend rules из `TASK-031`.
- Frontend и bot не должны дублировать rules филиалов, залов, групп или графика.
- При изменении response contracts нужно обновить affected consumers или сохранить обратную совместимость.

## Acceptance criteria
- [ ] Группу нельзя создать или обновить без продолжительности занятия.
- [ ] Group create/update/list/details responses возвращают продолжительность занятия вместе с существующими schedule fields.
- [ ] Backend валидирует тип группы, филиал, зал, время начала, продолжительность и график занятий.
- [ ] Backend не проверяет занятость зала и конфликты времени в рамках этой задачи.
- [ ] Backend не создает переносы, отмены, замены тренера, attendance records или notifications.
- [ ] Audit log отражает изменения графика занятий группы.
- [ ] Обновлены backend tests.

## Test checklist
- [ ] Запустить backend tests.
- [ ] Проверить validation errors для пустой/некорректной продолжительности.
- [ ] Проверить create/update group с branch/hall/group type/start time/duration/schedule.
- [ ] Проверить, что hall conflict validation отсутствует.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: backend contract and persistence changes can affect frontend, bot and existing group/attendance read models.

## Clarification questions
Не требуется.

## Source notes
- Derived from: `backlog/done/TASK-028-schedule-product-model.md`
- Depends on: `backlog/done/TASK-031-branches-backend-domain-contracts.md`

## Processing notes
- Created at: 2026-05-13
- Created after TASK-028 clarification was completed.
