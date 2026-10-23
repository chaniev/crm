# TASK-189: Открывать редактор расписания из карточки группы

## Status
tasks-ready

## Requirements
- REQ-GRP-001 — changes
- REQ-GRP-004 — constrains
- REQ-NFR-001 — constrains

## Requirement links
- [REQ-GRP-001/004](../../docs/requirements/02-группы.md)
- [REQ-NFR-001](../../docs/requirements/08-нефункциональные.md)

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
- До ready plan определить обработку несохранённых identity-изменений,
  отсутствующей серии и ошибки загрузки, используя существующие UX-контракты;
  согласовать визуальный контракт по применимому design gate.

## Out of scope
- Встроенный редактор расписания внутри формы группы: пользователь выбрал переход.
- Изменение календарной модели, прав, preview/execute, пересчёт истории посещений.
- Форма создания группы — [TASK-188](TASK-188-group-create-weekday-start-times.md).

## Constraints
- Identity update не должен записывать расписание или обходить редактор серии.
- Использовать backend-разрешённые действия; frontend не выводит права по роли.
- Прошлые занятия, посещения, отмены и ручные переносы сохраняют действующие
  защиты серии; не интерпретировать «вся серия» как переписывание истории.
- До реализации нужен ready plan по [HARNESS](../../docs/HARNESS.md).
- Definition of done включает состояние требований и `docs/requirements/CHANGELOG.md`.

## Acceptance criteria
- [ ] Из карточки разрешённой группы одним явным действием открывается её редактор серии.
- [ ] Можно изменить время выбранного дня, увидеть область воздействия и
  подтвердить изменение; повторное открытие и календарь показывают результат.
- [ ] Сохранение и отмена возвращают в исходный контекст; несохранённые изменения
  карточки не теряются молча.
- [ ] Отсутствующая серия, загрузка, отказ в доступе и конфликт обрабатываются
  явно без перехода к чужой серии или обхода backend-проверок.
- [ ] Редактирование имени, типа и тренеров продолжает работать независимо.

## Test checklist
- [ ] Component/router regression: правильные group/series ID, return context,
  ограниченная роль, unsaved changes, отсутствие серии и retry.
- [ ] Playwright mobile/desktop: карточка → редактор → preview → подтверждение → возврат.
- [ ] Сохранение действующих revision/token и исторических защит редактора.

## AI safety
- Safe for autonomous implementation: yes, после ready plan и применимого design gate.
- Risk level: medium
- Reason: Неверный контекст перехода способен изменить чужую серию; используются
  действующие проверки доступа и отдельный редактор, без новых доменных правил.

## Evidence
- [GroupEditScreen.tsx](../../frontend/src/features/groups/GroupEditScreen.tsx)
- [groupFormMapping.test.ts](../../frontend/src/features/groups/groupFormMapping.test.ts)
- [ScheduleSeriesEditScreen](../../frontend/src/features/schedule/GroupScheduleScreen.tsx)
- [groups API client](../../frontend/src/lib/api/groups.ts)
- [GroupLessonSeriesRequests.cs](../../backend/src/GymCrm.Api/Auth/GroupLessonSeriesRequests.cs)
- [ScheduleLessonsApiTests.cs](../../backend/tests/GymCrm.Tests/ScheduleLessonsApiTests.cs)

## Source notes
- Source file: [2026-10-23.md](../processed/2026-10-23.md), пункт 2.
> При редактировании группы не дает изменить время начала занятия, только тип, название и тренера
- Решение пользователя 23.10.2026 в текущем обсуждении inbox:
  «Кнопка в существующий редактор».

## Processing notes
- Created at: 2026-10-23 16:47 MSK.
- Created by skill: codex-backlog-skill; mode: triage одного файла inbox.
- Duplicate check: активного дубля нет. [TASK-119](../done/2026-08-24/TASK-119-full-lesson-calendar.md)
  создала редактор серии из календаря, но карточка группы не содержит входа в него.
  [TASK-177](TASK-177-group-weekday-touch-targets.md) касается только touch targets.
- Продуктовый выбор точки входа разрешён ответом пользователя; это ещё не
  утверждение visual specification или executable implementation plan.
- Evidence: статический анализ main `7154cee`; runtime в этом triage не запускался.
