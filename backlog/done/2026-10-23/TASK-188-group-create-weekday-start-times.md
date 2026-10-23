# TASK-188: Задавать отдельное время начала по дням при создании группы

## Status
done

## Requirements
- REQ-GRP-003 — implements
- REQ-GRP-004 — constrains
- REQ-GRP-001 — constrains
- REQ-NFR-001 — constrains

## Requirement links
- [REQ-GRP-001/003/004](../../../docs/requirements/02-группы.md)
- [REQ-NFR-001](../../../docs/requirements/08-нефункциональные.md)

## Goal
При создании одной группы пользователь задаёт, например, Пн 18:00, Ср 18:00,
Сб 10:00; созданные занятия сохраняют эти времена.

## Context
В текущем `GroupForm` одно поле `trainingStartTime`. Функция
`toCreateGroupWithInitialSeriesPayload` копирует его во все
`initialLessonSeries.slots`. Backend уже принимает отдельное время каждого
слота; `GroupsApiTests` содержит создание начальной серии с разными временами.
Пробел находится в форме создания, а не в отсутствии модели расписания.

## User role
Главный тренер, суперадминистратор, администратор в backend-разрешённом охвате.

## Scope
- Дать каждому выбранному дню независимое время начала в форме новой группы.
- Передавать эти значения существующему preview/execute создания начальной серии.
- Сохранить общие длительность и зал текущей формы, даты начала/окончания серии,
  назначение тренеров и backend-проверки конфликтов.
- Реализовать отображение полей и ошибок по согласованному направлению A.

## Out of scope
- Несколько занятий в один день в форме создания: пользователь выбрал только
  разные времена по дням. Возможности существующего редактора серии не сужать.
- Новая модель расписания, миграции, изменение правил посещаемости.
- Вход в редактор из карточки группы — [TASK-189](TASK-189-group-edit-schedule-entry.md).

## Constraints
- Источник расписания — `LessonSeries` и slots; не возвращать независимую
  legacy-модель `trainingStartTime + weekdays` как источник истины.
- Время остаётся локальным `HH:mm`; backend владеет валидацией и правами.
- До реализации нужен ready plan по [HARNESS](../../../docs/HARNESS.md).
- Definition of done включает состояние требований и `docs/requirements/CHANGELOG.md`.

## Acceptance criteria
- [x] Для выбранных дней доступны независимо редактируемые времена начала.
- [x] Пн 18:00 / Ср 18:00 / Сб 10:00 сохраняются после preview, создания и reload;
  календарь показывает занятия в соответствующее время.
- [x] Изменение одного времени не перезаписывает остальные дни; удалённый день
  не попадает в запрос создания.
- [x] Изменение формы после preview требует актуального подтверждения;
  ошибки конкретного слота привязаны к соответствующему дню/полю.
- [x] Сценарий с одинаковым временем во все дни продолжает работать.

## Test checklist
- [x] Mapping и component regression: разные времена, добавление/снятие дня,
  ошибки не первого слота, сохранение ввода при отказе.
- [x] API round-trip начальной серии; отказ preview без частичного создания.
- [x] Playwright mobile/desktop: создание → reload → календарь; ограниченная роль.
- [x] Проверить touch-target coverage нового контрола с учётом пересечения с [TASK-177](../../tasks-ready/TASK-177-group-weekday-touch-targets.md).

## AI safety
- Safe for autonomous implementation: yes, после ready plan и применимого design gate.
- Risk level: medium
- Reason: Ошибка mapping может сдвинуть будущие занятия; задача использует
  существующие backend-контракты и не меняет правила серии или исторические данные.

## Evidence
- [GroupForm.tsx](../../../frontend/src/features/groups/GroupForm.tsx)
- [groupFormMapping.ts](../../../frontend/src/features/groups/groupFormMapping.ts)
- [GroupCreateScreen.tsx](../../../frontend/src/features/groups/GroupCreateScreen.tsx)
- [UpsertTrainingGroupRequest.cs](../../../backend/src/GymCrm.Api/Auth/UpsertTrainingGroupRequest.cs)
- [GroupsApiTests.cs](../../../backend/tests/GymCrm.Tests/GroupsApiTests.cs)

## Source notes
- Source file: [2026-10-23.md](../../processed/2026-10-23.md), пункт 1.
> При создании новой группы дает выставить только одно время начала занятия, нужно, чтобы была вариативность.
- Решение пользователя 23.10.2026 в текущем обсуждении inbox:
  «Разное время по дням недели».

## Processing notes
- Created at: 2026-10-23 16:47 MSK.
- Created by skill: codex-backlog-skill; mode: triage одного файла inbox.
- Duplicate check: активного дубля нет. [TASK-117](../2026-08-24/TASK-117-group-weekday-specific-start-times.md)
  закрыта заменяющей реализацией [TASK-119](../2026-08-24/TASK-119-full-lesson-calendar.md),
  но текущая форма создания всё ещё отправляет одно время во все slots.
  Новая карточка закрывает этот подтверждённый пробел; исторические done не переоткрываются.
  TASK-177 меняет геометрию выбора дней, не их временные значения.
- Evidence: статический анализ main `7154cee`; runtime в этом triage не запускался.

## Planning — 2026-10-23
- Подготовлен [implementation plan](TASK-188-group-create-weekday-start-times.plan.md).
- Принятые требования и backend contracts подтверждены; блокирующих продуктовых и технических вопросов нет.
- Пользователь / владелец продукта 23.10.2026 прямо ответил: «выбираю вариант А А».
- Для TASK-188 выбран A: выбор дней и постоянно видимые строки времени каждого выбранного дня.
- [Согласованный визуальный контракт](../../mockups/TASK-188-189-group-schedule/brief.md) фиксирует композицию, состояния и rendered evidence.
- Предыдущий planning blocker снят; подготовка плана не является началом реализации кода.

## Implementation lifecycle
- moved_to_implementation_at: 2026-10-23 17:26
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/2026-10-23/TASK-188-group-create-weekday-start-times.plan.md
- implementation_branch: codex/TASK-188-group-create-weekday-start-times

## Completion
- status: completed
- completed_at: 2026-10-23
- completion_date_evidence: локальная main содержит проверенный TASK-188 `d17baff` и TASK-189 `6aeefcb`; fast-forward 23.10.2026, tree `3b31d5259d4a6b575f9113d04bf6578a318c5d91` совпадает с проверенным TASK-189 candidate.
- verification: [validation](TASK-188-evidence/validation.md), [harness](TASK-188-evidence/harness.json), [batch log](../../logs/2026-10-23-TASK-188-189-implementation.md).
