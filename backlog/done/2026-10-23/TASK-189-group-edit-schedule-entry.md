# TASK-189: Открывать редактор расписания из карточки группы

## Status
done

## Requirements
- REQ-GRP-001 — changes
- REQ-GRP-004 — constrains
- REQ-NFR-001 — constrains

## Requirement links
- [REQ-GRP-001/004](../../../docs/requirements/02-группы.md)
- [REQ-NFR-001](../../../docs/requirements/08-нефункциональные.md)

## Goal
Пользователь карточки группы может изменить время занятий через заметную
кнопку «Изменить расписание», открывающую существующий редактор серии.

## Context
`GroupEditScreen` передаёт `showScheduleFields={false}` и сохраняет только
identity-поля через `toUpdateGroupIdentityPayload`. При этом
`ScheduleSeriesEditScreen` уже поддерживает отдельное время слотов, выбор
области изменения, дату вступления в силу и preview/execute.
Пробел — отсутствие доступного перехода из карточки группы, а не отсутствие
редактирования расписания во всей системе.

## User role
Главный тренер, суперадминистратор, администратор в backend-разрешённом охвате.

## Scope
- Добавить заметное действие «Изменить расписание» в карточку группы.
- Открывать существующий редактор с правильными группой и серией;
  сохранить backend-семантику «это и будущие» / «вся серия» и явный выбор даты.
- Обеспечить возврат к исходной группе после сохранения или отмены.
- Сохранить согласованную обработку несохранённых identity-изменений,
  отсутствующей серии и ошибки загрузки по UX-контракту направления A.

## Out of scope
- Встроенный редактор расписания внутри формы группы: пользователь выбрал переход.
- Изменение календарной модели, прав, preview/execute, пересчёт истории посещений.
- Форма создания группы — [TASK-188](TASK-188-group-create-weekday-start-times.md).

## Constraints
- Identity update не должен записывать расписание или обходить редактор серии.
- Использовать backend-разрешённые действия; frontend не выводит права по роли.
- Прошлые занятия, посещения, отмены и ручные переносы сохраняют действующие
  защиты серии; не интерпретировать «вся серия» как переписывание истории.
- До реализации нужен ready plan по [HARNESS](../../../docs/HARNESS.md).
- Definition of done включает состояние требований и `docs/requirements/CHANGELOG.md`.

## Acceptance criteria
- [x] Из карточки разрешённой группы одним явным действием открывается её редактор серии.
- [x] Можно изменить время выбранного дня, увидеть область воздействия и
  подтвердить изменение; повторное открытие и календарь показывают результат.
- [x] Сохранение и отмена возвращают в исходный контекст; несохранённые изменения
  карточки не теряются молча.
- [x] Отсутствующая серия, загрузка, отказ в доступе и конфликт обрабатываются
  явно без перехода к чужой серии или обхода backend-проверок.
- [x] Редактирование имени, типа и тренеров продолжает работать независимо.

## Test checklist
- [x] Component/router regression: правильные group/series ID, return context,
  ограниченная роль, unsaved changes, отсутствие серии и retry.
- [x] Playwright mobile/desktop: карточка → редактор → preview → подтверждение → возврат.
- [x] Сохранение действующих revision/token и исторических защит редактора.

## AI safety
- Safe for autonomous implementation: yes, после ready plan и применимого design gate.
- Risk level: medium
- Reason: Неверный контекст перехода способен изменить чужую серию; используются
  действующие проверки доступа и отдельный редактор, без новых доменных правил.

## Evidence
- [GroupEditScreen.tsx](../../../frontend/src/features/groups/GroupEditScreen.tsx)
- [groupFormMapping.test.ts](../../../frontend/src/features/groups/groupFormMapping.test.ts)
- [ScheduleSeriesEditScreen](../../../frontend/src/features/schedule/GroupScheduleScreen.tsx)
- [groups API client](../../../frontend/src/lib/api/groups.ts)
- [GroupLessonSeriesRequests.cs](../../../backend/src/GymCrm.Api/Auth/GroupLessonSeriesRequests.cs)
- [ScheduleLessonsApiTests.cs](../../../backend/tests/GymCrm.Tests/ScheduleLessonsApiTests.cs)

## Source notes
- Source file: [2026-10-23.md](../../processed/2026-10-23.md), пункт 2.
> При редактировании группы не дает изменить время начала занятия, только тип, название и тренера
- Решение пользователя 23.10.2026 в текущем обсуждении inbox:
  «Кнопка в существующий редактор».

## Processing notes
- Created at: 2026-10-23 16:47 MSK.
- Created by skill: codex-backlog-skill; mode: triage одного файла inbox.
- Duplicate check: активного дубля нет. [TASK-119](../2026-08-24/TASK-119-full-lesson-calendar.md)
  создала редактор серии из календаря, но карточка группы не содержит входа в него.
  [TASK-177](../../tasks-ready/TASK-177-group-weekday-touch-targets.md) касается только touch targets.
- Продуктовый выбор точки входа разрешён ответом пользователя; это ещё не
  утверждение visual specification или executable implementation plan.
- Evidence: статический анализ main `7154cee`; runtime в этом triage не запускался.

## Planning — 2026-10-23
- Подготовлен [implementation plan](TASK-189-group-edit-schedule-entry.plan.md).
- Принятые требования и backend contracts подтверждены; блокирующих продуктовых и технических вопросов нет.
- Пользователь / владелец продукта 23.10.2026 прямо ответил: «выбираю вариант А А».
- Для TASK-189 выбран A: блок текущего расписания и кнопка «Изменить расписание» перед identity-полями.
- [Согласованный визуальный контракт](../../mockups/TASK-188-189-group-schedule/brief.md) фиксирует композицию, состояния и rendered evidence.
- Предыдущий planning blocker снят; подготовка плана не является началом реализации кода.

## Implementation lifecycle
- moved_to_implementation_at: 2026-10-23 17:26
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/2026-10-23/TASK-189-group-edit-schedule-entry.plan.md
- implementation_branch: codex/TASK-189-group-edit-schedule-entry

## Completion
- status: completed
- completed_at: 2026-10-23
- completion_date_evidence: локальная main содержит проверенный TASK-188 `d17baff` и TASK-189 `6aeefcb`; fast-forward 23.10.2026, tree `3b31d5259d4a6b575f9113d04bf6578a318c5d91` совпадает с проверенным TASK-189 candidate.
- verification: [validation](TASK-189-evidence/validation.md), [harness](TASK-189-evidence/harness.json), [batch log](../../logs/2026-10-23-TASK-188-189-implementation.md).
