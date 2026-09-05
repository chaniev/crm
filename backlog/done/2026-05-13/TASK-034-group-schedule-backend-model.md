# TASK-034: Реализовать backend-модель графика групповых занятий

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-05-13 17:18
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/2026-05-13/TASK-034-group-schedule-backend-model.plan.md
- implementation_branch: feature/TASK-034-group-schedule-backend-model

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

Техническое уточнение от 2026-05-13:
- Продолжительность занятия хранится в поле `durationMinutes`.
- `durationMinutes` - целое число больше 0 и не более 180 минут.
- Дни недели хранятся в поле `weekdays`.
- `weekdays` - `number[]` в ISO-формате `1..7`, где `1 = Monday`, `7 = Sunday`.
- `weekdays` обязателен, минимум 1 день, без дублей.
- `weekdays` нужно хранить и возвращать отсортированным.
- Свободнотекстовый `scheduleText` нужно удалить и заменить на `weekdays`.
- ProblemDetails validation fields: `durationMinutes`, `weekdays`.
- Деплой будет с нуля, поэтому миграция существующих production-данных не нужна.

Текущий backend уже содержит `TrainingGroup.ScheduleText`, `TrainingGroup.TrainingStartTime`, `BranchId`, `HallId` и `GroupTypeId`, но не содержит `durationMinutes` как обязательное поле графика и не хранит дни недели структурированно. `ScheduleText` должен быть удален и заменен на `weekdays`.

## User role
администратор / тренер / владелец

## Problem
График группы пока не описывает полную продуктовую модель расписания: не хватает продолжительности занятия и явного backend-контракта, из которого frontend может строить расписание по группам.

## Scope
- Достроить backend-модель графика занятий группы.
- Добавить обязательное поле `durationMinutes` в group create/update contracts, domain model, persistence и responses.
- Удалить свободнотекстовый `scheduleText` и заменить его на `weekdays` как backend source of truth.
- Обеспечить backend-валидацию обязательных полей группы: тип группы, филиал, зал, время начала, `durationMinutes` и `weekdays`.
- Валидировать `weekdays`: массив обязателен, минимум 1 день, только числа `1..7`, без дублей.
- Нормализовать `weekdays`: хранить и возвращать отсортированным.
- Вернуть данные, достаточные frontend для автоматического отображения расписания на основе групп.
- Обновить audit state и ProblemDetails validation errors для `durationMinutes` и `weekdays`.
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
- При изменении response contracts нужно обновить affected consumers; `scheduleText` обратную совместимость сохранять не нужно.
- Production data backfill не требуется: деплой будет с нуля; seed/test data нужно обновить явно.

## Acceptance criteria
- [x] Группу нельзя создать или обновить без `durationMinutes`.
- [x] `durationMinutes` хранится и возвращается как целое количество минут.
- [x] Backend валидирует `durationMinutes`: целое число, больше 0, не более 180.
- [x] Группу нельзя создать или обновить без `weekdays`.
- [x] Backend валидирует `weekdays`: массив, минимум 1 день, только ISO-значения `1..7`, без дублей.
- [x] Backend хранит и возвращает `weekdays` отсортированным.
- [x] `scheduleText` удален из backend source of truth и заменен на `weekdays`.
- [x] Group create/update/list/details responses возвращают `durationMinutes` и `weekdays`.
- [x] Backend валидирует тип группы, филиал, зал, время начала, `durationMinutes` и `weekdays`.
- [x] Backend не проверяет занятость зала и конфликты времени в рамках этой задачи.
- [x] Backend не создает переносы, отмены, замены тренера, attendance records или notifications.
- [x] Audit log отражает изменения графика занятий группы.
- [x] Обновлены backend tests.

## Test checklist
- [ ] Запустить backend tests.
- [ ] Проверить validation errors для пустой/некорректной продолжительности.
- [ ] Проверить validation errors для продолжительности 0, отрицательного значения и значения больше 180.
- [ ] Проверить validation errors для пустых/некорректных структурированных дней недели.
- [ ] Проверить validation errors для дублей и значений вне диапазона `1..7` в `weekdays`.
- [ ] Проверить, что `weekdays` возвращается отсортированным.
- [ ] Проверить create/update group с branch/hall/group type/start time/durationMinutes/weekdays.
- [ ] Проверить, что hall conflict validation отсутствует.

## AI safety
- Safe for Codex: yes
- Risk level: high
- Reason: задача готова к реализации, но backend contract and persistence changes can affect frontend, bot and existing group/attendance read models.

## Clarification questions
Не требуется. Технические решения закрыты: `durationMinutes` хранится в минутах, допустимый диапазон 1-180 минут, `weekdays` - ISO `number[]` 1..7 без дублей и отсортированный, `scheduleText` удаляется, ProblemDetails fields - `durationMinutes` и `weekdays`, деплой с нуля.

## Source notes
- Derived from: `backlog/done/2026-05-13/TASK-028-schedule-product-model.md`
- Depends on: `backlog/done/2026-05-09/TASK-031-branches-backend-domain-contracts.md`
- User clarification 2026-05-13: продолжительность хранится в минутах; целое число больше 0 и не более 180; дни недели структурированные; деплой с нуля.
- User clarification 2026-05-13: `weekdays` uses ISO `number[]` 1..7, required, at least one day, no duplicates, stored/returned sorted; `scheduleText` is deleted and replaced by `weekdays`; duration field name is `durationMinutes`; ProblemDetails fields are `durationMinutes` and `weekdays`.

## Processing notes
- Created at: 2026-05-13
- Created after TASK-028 clarification was completed.
- Updated at: 2026-05-13 with duration and structured weekdays clarification.
- Moved to tasks-ready at: 2026-05-13 after schedule contract field names and validation semantics were clarified.
