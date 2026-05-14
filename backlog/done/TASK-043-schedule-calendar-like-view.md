# TASK-043: Календарный вид расписания

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-05-14 13:58
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-043-schedule-calendar-like-view.plan.md
- implementation_branch: feature/TASK-043-schedule-calendar-like-view

## Goal
Заменить текущий недельный список расписания на календарный вид: неделя с временной сеткой на desktop/tablet и список выбранного дня на mobile. Первая версия должна быть строго read-only и строиться из backend group schedule data.

## Context
В inbox есть заметка: "модифичировать отображение расписания - сделать по аналогии с календарем задач популярных планировщиках задач". `TASK-035` уже реализовал отдельный раздел `Расписание` как недельный список групповых занятий. `TASK-043` описывает следующую итерацию отображения: календарный вид, похожий на приложенный скриншот и привычные calendar/task planners.

Уточнения от 2026-05-14:
- нужен календарь, похожий на приложенный скриншот;
- целевой вид первой версии - неделя с временной сеткой;
- расписание только для просмотра, без редактирования из календаря;
- на карточке достаточно текущего набора данных из расписания;
- фильтры нужны по филиалу, залу, тренеру и группе;
- mobile-сценарий - список выбранного дня;
- drag-and-drop, переносы, отмены, замены тренера и конфликты вне первой версии;
- на первом этапе календарь доступен всем пользователям CRM в полном объеме.

## User role
администратор / главный тренер / тренер / все пользователи CRM

## Problem
Текущий список по дням хуже подходит для быстрого просмотра плотного расписания. Пользователю нужен привычный календарный экран, где видно распределение занятий по дням и времени, при этом первая версия не должна создавать ожидание редактирования, переносов или управления конфликтами.

Дополнительный backend-риск: текущий management endpoint `/groups` закрыт для тренеров, поэтому требование "всем пользователям CRM в полном объеме" нельзя корректно выполнить только frontend-изменением.

## Requirements
- Desktop/tablet отображают недельный календарь с колонками `Пн...Вс` и временем по вертикали.
- Заголовки дней показывают только дни недели, без календарных дат и без навигации по неделям.
- Временной диапазон сетки вычисляется по видимым занятиям и округляется до полных часов.
- Занятия располагаются по `trainingStartTime` и `durationMinutes`.
- Пересекающиеся занятия внутри одного дня отображаются рядом, без визуального наложения текста и действий.
- Mobile отображает список выбранного дня с переключателем дней недели.
- Карточка занятия показывает текущие поля расписания: время, группа, тип группы, длительность, филиал, зал, тренер/тренеры, статус неактивной группы.
- Календарь не содержит кнопок редактирования и не ведет в редактирование группы ни для одной роли.
- Фильтры: филиал, зал, тренер, группа.
- Значения фильтров берутся из загруженного расписания, без отдельной загрузки полных справочников.
- Фильтры применяются совместно и имеют сброс.
- Расписание доступно всем аутентифицированным пользователям CRM в полном объеме.

## Backend requirement
- Добавить read-only endpoint `GET /schedule/groups`.
- Endpoint доступен всем authenticated CRM users.
- Endpoint возвращает все группы с данными, необходимыми календарю.
- Response должен содержать group schedule fields, совместимые с текущим frontend schedule contract: `id`, `name`, `branchId`, `branchName`, `hallId`, `hallName`, `groupTypeId`, `groupTypeName`, `groupTypeSystemIdentifier`, `trainingStartTime`, `durationMinutes`, `weekdays`, `isActive`, `trainers`, `trainerIds`, `trainerCount`, `trainerNames`, `clientCount`, `updatedAt`.
- Поддержать paging shape, совместимый с текущим frontend list consumer: `items`, `totalCount`, `skip`, `take`.
- Management endpoint `/groups` остается закрытым для пользователей без `CanManageGroups`.
- Frontend `/schedule` должен использовать новый schedule endpoint, а не management `/groups`.

## Scope
- Создать backend read-only contract для календарного расписания.
- Обновить frontend API consumer для `/schedule`.
- Переработать `/schedule` из недельного списка карточек в weekly calendar grid.
- Реализовать mobile selected-day list.
- Реализовать frontend-фильтры по филиалу, залу, тренеру и группе на основе загруженных schedule groups.
- Сохранить loading/error/stale-data/refresh states текущего экрана расписания.
- Обновить Playwright coverage для schedule и responsive behavior.

## Out of scope
- Редактирование из календаря.
- Drag-and-drop.
- Переносы занятий.
- Отмены занятий.
- Замены тренера.
- Проверка конфликтов и занятости залов.
- Изменение backend schedule validation rules.
- Изменение attendance flows.
- Bot changes.
- Личные тренировки и dated event calendar.

## Constraints
- Backend владеет CRM business logic, permissions, access scope and validation semantics.
- Frontend не должен добавлять frontend-only правила конфликтов, переносов, отмен или проверки занятости залов.
- `trainingStartTime` отображается как локальное `HH:mm` без `Date` parsing и timezone conversion.
- Расписание v1 является недельным шаблоном групповых занятий, а не календарем конкретных дат.
- Значимое UX-изменение требует участия `ui-designer` перед реализацией.
- Нужно сохранить решения `TASK-035`: раздел `Расписание` доступен в навигации всем CRM users, данные строятся из backend group schedule data, дни недели используют ISO `1..7`.

## Acceptance criteria
- [ ] `/schedule` отображает недельную календарную сетку на desktop/tablet.
- [ ] В календаре есть колонки `Пн...Вс`.
- [ ] Заголовки дней не показывают даты и не предлагают навигацию по неделям.
- [ ] Занятия расположены по времени начала и длительности.
- [ ] Пересекающиеся занятия не перекрывают друг друга визуально.
- [ ] На mobile отображается список выбранного дня.
- [ ] Карточки занятий read-only для всех ролей.
- [ ] В календаре нет кнопок редактирования и переходов в редактирование группы.
- [ ] Карточка занятия показывает текущий набор данных расписания.
- [ ] Фильтры по филиалу, залу, тренеру и группе работают совместно.
- [ ] Сброс фильтров возвращает полное расписание.
- [ ] Head coach, administrator и coach могут открыть расписание.
- [ ] Coach видит все группы в расписании.
- [ ] `/groups` остается закрытым для coach.
- [ ] UI не предлагает переносы, отмены, замены, drag-and-drop или conflict resolution.
- [ ] Layout не создает page-level horizontal scroll на mobile/tablet/desktop.

## Test checklist
- [ ] Backend: head coach, administrator и coach получают `GET /schedule/groups`.
- [ ] Backend: anonymous user не получает `GET /schedule/groups`.
- [ ] Backend: coach видит все группы через `GET /schedule/groups`.
- [ ] Backend: coach по-прежнему получает forbidden на management `/groups`.
- [ ] Frontend/unit: helper форматирует `trainingStartTime` как `HH:mm` без timezone conversion.
- [ ] Frontend/unit: overlapping entries получают непересекающиеся lanes.
- [ ] Frontend/e2e: `/schedule` отображает weekly grid на desktop/tablet.
- [ ] Frontend/e2e: mobile viewport отображает selected-day list.
- [ ] Frontend/e2e: карточки read-only для всех ролей.
- [ ] Frontend/e2e: фильтры по филиалу, залу, тренеру и группе применяются совместно и сбрасываются.
- [ ] Запустить `dotnet test backend/GymCrm.slnx`.
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Запустить affected Playwright specs для schedule/responsive screens.

## AI safety
- Safe for Codex: yes
- Risk level: high
- Reason: задача готова к реализации, но затрагивает backend read-only contract, frontend API consumer, значимую UX-переработку расписания и role-based доступ к данным.

## Clarification questions
Не требуется. Решения закрыты:
- reference: календарь как на приложенном скриншоте;
- вид: неделя с временной сеткой;
- режим: строго read-only;
- карточка: текущий набор данных расписания;
- фильтры: филиал, зал, тренер, группа;
- mobile: список выбранного дня;
- переносы/отмены/замены/drag-and-drop/conflicts: вне v1;
- доступ: все CRM users видят полный объем расписания;
- заголовки дней: только `Пн...Вс`, без дат.

## Source notes
- Source file: `backlog/inbox/2026-05-14.md`
- Original note: `модифичировать отображение расписания - сделать по аналогии с календарем задач популярных планировщиках задач`
- Related completed task: `backlog/done/TASK-035-group-schedule-frontend-experience.md`

## Processing notes
- Created at: 2026-05-14 13:01
- Created by skill: codex-backlog-skill
- Updated at: 2026-05-14 after user clarified target calendar behavior and access requirements.
- Moved to tasks-ready at: 2026-05-14 after clarification questions were closed.
- Duplicate check: задача пересекается с `TASK-035`, но не дублирует его; это новая calendar-like итерация отображения расписания.
- Completed at: 2026-05-15 status audit after merge of `feature/TASK-043-schedule-calendar-like-view`.
- Implementation evidence: commit `22d10cb` adds backend `GET /schedule/groups`, schedule auth/contract tests, frontend schedule API consumer, weekly calendar helpers, calendar screen UI, unit tests and Playwright schedule coverage.
- Validation: implementation branch contains backend/frontend/unit/e2e coverage; runtime validation was not re-run during this backlog status audit.
