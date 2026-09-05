# TASK-035: Реализовать frontend-расписание групповых занятий

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-05-13 18:01
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/2026-05-13/TASK-035-group-schedule-frontend-experience.plan.md
- implementation_branch: feature/TASK-035-group-schedule-frontend-experience

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

Backend contract уточнен в `TASK-034`:
- Продолжительность занятия хранится и передается в поле `durationMinutes`.
- Допустимая продолжительность: целое число больше 0 и не более 180 минут.
- Дни недели передаются в поле `weekdays`.
- `weekdays` - ISO `number[]` 1..7, где `1 = Monday`, `7 = Sunday`.
- `weekdays` обязателен, минимум 1 день, без дублей, backend хранит и возвращает массив отсортированным.
- `scheduleText` удаляется и заменяется на `weekdays`.
- ProblemDetails validation fields: `durationMinutes`, `weekdays`.

UX/IA уточнение от 2026-05-13:
- Расписание должно быть отдельным разделом `Расписание`.
- Первый вид расписания - список по дням недели, сгруппированный `Пн...Вс`.
- Внутри каждого дня занятия сортируются по времени начала.
- Расписание видят все пользователи CRM.
- Нужно показывать все дни недели, включая дни без занятий.
- Frontend показывает backend `trainingStartTime` как локальное `HH:mm` без timezone-конвертации.
- Расписание только показывает занятия; карточка группы кликабельна и ведет в редактирование группы при наличии прав.

## User role
администратор / тренер / владелец / все пользователи CRM

## Problem
Пользователю нужно видеть расписание групповых занятий без ручного ведения отдельного календаря, а форма группы должна собрать все данные, необходимые backend для такого расписания.

## Scope
- Обновить frontend API types после `TASK-034`.
- Добавить или обновить поле `durationMinutes` в форме создания/редактирования группы.
- Добавить структурированный выбор `weekdays` в форме создания/редактирования группы.
- Убедиться, что в форме группы доступны тип группы, филиал, зал, время начала, продолжительность и дни недели.
- Добавить отдельный раздел `Расписание`.
- Отображать расписание групповых занятий на основе backend group schedule data.
- Показывать расписание всем пользователям CRM; состав групп должен приходить из backend с учетом backend access scope.
- Отображать расписание как список по всем дням недели `Пн...Вс`.
- Внутри каждого дня сортировать занятия по `trainingStartTime`.
- Показывать backend `trainingStartTime` как локальное `HH:mm` без timezone-конвертации.
- Показывать группу, тип группы, филиал, зал, тренера/тренеров, время начала и продолжительность.
- Показать компактное пустое состояние внутри дней без занятий.
- Сделать карточку группы кликабельной и ведущей в редактирование группы только при наличии прав.

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
- `trainingStartTime` отображается как локальное расписание `HH:mm`, не как absolute timestamp with timezone conversion.

## Acceptance criteria
- [x] В CRM есть отдельный раздел `Расписание`.
- [x] Раздел `Расписание` доступен всем пользователям CRM.
- [x] Расписание отображается списком по всем дням недели `Пн...Вс`.
- [x] Дни без занятий отображаются с компактным пустым состоянием.
- [x] Внутри дня занятия отсортированы по `trainingStartTime`.
- [x] `trainingStartTime` отображается как локальное `HH:mm` без timezone-конвертации.
- [x] Форма группы позволяет заполнить `durationMinutes`.
- [x] Форма группы не отправляет `scheduleText` или frontend-only свободный текст как источник дней недели.
- [x] Форма группы позволяет выбрать `weekdays`.
- [x] Форма группы отправляет backend все обязательные schedule-поля.
- [x] Ошибки backend validation по `durationMinutes` и `weekdays` отображаются в форме.
- [x] Расписание групповых занятий строится из backend group schedule data, а не из frontend-only правил.
- [x] В расписании видны группа, тип группы, филиал, зал, тренер(ы), время начала и продолжительность.
- [x] Карточка группы в расписании ведет в редактирование группы только при наличии прав.
- [x] UI не предлагает переносы, отмены, замены тренера или conflict resolution.
- [x] Responsive layout не перекрывает расписание и действия.

## Test checklist
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Добавить или обновить frontend/e2e coverage для group schedule fields.
- [ ] Вручную проверить desktop, tablet и mobile.

## AI safety
- Safe for Codex: yes
- Risk level: high
- Reason: задача готова к реализации, но frontend depends on backend schedule contract changes and touches group management plus a new schedule-facing workflow.

## Clarification questions
Не требуется. UX/IA решения закрыты: отдельный раздел `Расписание`, недельный список `Пн...Вс`, доступно всем пользователям CRM, все дни показываются, `trainingStartTime` отображается как локальное `HH:mm`, карточка группы ведет в редактирование только при наличии прав.

## Source notes
- Derived from: `backlog/done/2026-05-13/TASK-028-schedule-product-model.md`
- Depends on: `backlog/done/2026-05-13/TASK-034-group-schedule-backend-model.md`
- User clarification 2026-05-13 for backend contract: duration in minutes, range 1-180, structured weekdays, fresh deployment.
- User clarification 2026-05-13 for backend contract: field names are `durationMinutes` and `weekdays`; `weekdays` is ISO `number[]` 1..7, required, deduplicated and sorted by backend; `scheduleText` is removed.
- User clarification 2026-05-13 for frontend IA: separate `Расписание` section; list grouped by weekdays `Пн...Вс`; sort within day by start time; schedule visible to all; show all weekdays; render `trainingStartTime` as local `HH:mm`; schedule is read-only and group card opens edit only when user has permission.

## Processing notes
- Created at: 2026-05-13
- Created after TASK-028 clarification was completed.
- Updated at: 2026-05-13 after TASK-034 duration and structured weekdays clarification.
- Updated at: 2026-05-13 after final TASK-034 contract field-name clarification.
- Moved to tasks-ready at: 2026-05-13 after schedule UI placement, visibility, grouping, sorting and navigation semantics were clarified.
