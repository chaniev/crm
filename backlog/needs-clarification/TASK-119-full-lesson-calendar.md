# TASK-119: Реализовать полноценный календарь занятий

## Status
needs-clarification

## Goal
CRM должна перейти от повторяющегося недельного шаблона к полноценному календарю
конкретных занятий, чтобы администратор, главный тренер и тренер работали с
реальными датами: день/неделя, перенос, отмена, разовое занятие, изменение
одного занятия или серии и переход к посещаемости.

## Context
Текущая модель расписания описывает группу как недельный шаблон: выбранные
weekday, одно общее время и presentation-only календарные подписи. TASK-117
планирует отдельное время для каждого weekday, но также не создаёт
самостоятельный факт конкретного занятия.

Из-за этого несколько активных задач решают части одной проблемы:

- TASK-117 добавляет разное время группы по weekday, но остаётся weekly-template
  моделью.
- TASK-118 фиксирует историческое время в attendance snapshot, но не вводит
  полноценное занятие как сущность.
- TASK-075 пытается добавить состояние `Held`/`NotHeld` для пары
  `group + training date`, но блокируется вопросами lifecycle.
- TASK-112 добавляет day mode для недельного шаблона, а не календарь дат.

Продуктовое направление от 2026-08-20: вместо наращивания отдельных snapshot и
weekday-исключений рассмотреть полноценную календарную модель с occurrence.

## User role
Администратор / главный тренер / тренер / суперадминистратор / система.

## Problem
Пользователь ожидает календарь занятий как набор конкретных событий на даты, а
CRM сейчас показывает повторяющийся шаблон. Из-за этого:

- нельзя корректно перенести одно занятие без изменения всей группы;
- нельзя добавить разовое занятие без создания отдельной группы или обходного
  сценария;
- отмена или `занятие не проводилось` не имеет общего lifecycle с расписанием;
- история attendance зависит от текущего расписания или требует отдельного
  snapshot-механизма;
- `(GroupId, TrainingDate)` становится недостаточным ключом, если у группы
  появятся два занятия в один день.

## UX problem summary
- Severity: high. Ментальная модель пользователя — календарь реальных занятий,
  а системная модель — weekday-шаблон. Это создаёт риск неправильного переноса,
  отмены и открытия attendance не того занятия.
- Evidence basis: текущие backlog-задачи TASK-075/TASK-112/TASK-117/TASK-118 и
  продуктовая дискуссия 2026-08-20. Это не результат физического iPhone-теста.
- Root cause: backend не имеет стабильной сущности конкретного занятия, поэтому
  frontend вынужден показывать календареподобный UI без календарной семантики.

## UX contract
- User/context: тренер и администратор работают в CRM на телефоне между
  занятиями; частая операция — быстро открыть сегодня/выбранный день и перейти
  к attendance.
- Device baseline: проектировать сначала под `390 x 844`, затем проверить
  `420 x 912`, `440 x 956`, `912 x 420`, `956 x 440`, tablet и desktop.
- Goal: найти конкретное занятие по дате, понять его состояние и выполнить
  допустимое действие без выбора между техническими сущностями.
- Primary path mobile: `Расписание` -> `Сегодня` или выбор даты -> список
  занятий дня -> карточка занятия -> `Посещаемость`.
- Frequent operations: сменить день, сменить неделю, открыть сегодня, перейти к
  attendance, увидеть время/группу/зал/тренера/статус.
- Secondary operations: создать разовое занятие, перенести занятие, изменить
  серию, изменить одно занятие.
- Exceptional/destructive operations: отменить занятие, отметить
  `не проводилось`, восстановить, изменить прошлое занятие с attendance.
- Required data in lesson row/card: дата, время начала, длительность, группа,
  тип группы, зал/филиал, тренер, статус занятия, attendance completion state.
- Action budget: в primary mobile path тренер должен открыть attendance
  сегодняшнего занятия не более чем за 3 действия после входа в `Расписание`.
- Failure recovery: при ошибке загрузки показать повтор запроса без потери
  выбранной даты; при конфликте переноса показать причину и оставить введённые
  данные; при permission denial объяснить недоступное действие.
- Success criteria: нет горизонтального page scroll на mobile; primary action
  не спрятан в overflow; fixed/sticky controls учитывают safe area, Safari
  chrome и software keyboard.

## Scope
- Спроектировать backend-owned календарную модель:
  - recurring schedule rules for group lessons;
  - concrete lesson occurrences for dated lessons and exceptions;
  - stable `LessonOccurrenceId` for attendance, history and audit.
- Определить generation/materialization policy для будущих занятий.
- Определить lifecycle states конкретного занятия, минимум кандидаты:
  `Scheduled`, `Held`, `NotHeld`, `Cancelled`.
- Связать attendance с конкретным occurrence, а не только с
  `GroupId + TrainingDate`.
- Поддержать календарную навигацию:
  - today;
  - конкретная дата;
  - день;
  - неделя;
  - переход между неделями.
- Поддержать операции:
  - создать разовое занятие;
  - изменить одно занятие;
  - изменить серию;
  - перенести занятие;
  - отменить занятие;
  - отметить `не проводилось`;
  - восстановить занятие;
  - открыть attendance конкретного occurrence.
- Определить migration/backfill policy для существующего расписания и
  существующих attendance rows.
- Определить влияние на TASK-075, TASK-117, TASK-118 и TASK-112: заменить,
  поглотить, оставить как промежуточные задачи или закрыть.
- Подготовить дальнейшую декомпозицию на backend contract/persistence,
  frontend calendar UX, attendance migration, bot consumers и regression tests.

## Out of scope
- Drag-and-drop календарь.
- Интеграция с Google/Outlook Calendar.
- Уведомления о переносах и отменах.
- Автоматический conflict-resolution по залам, тренерам и capacity, если не
  будет отдельно утверждён как blocking rule.
- Billing/write-off policy для отменённых занятий, если не будет отдельно
  утверждена.
- Сложные recurrence rules beyond weekly group schedule: праздники, месячные
  правила, произвольные RRULE.

## Constraints
- Backend владеет календарной семантикой, permissions, validation,
  ProblemDetails, audit и migration policy.
- Frontend не восстанавливает lifecycle занятия из attendance rows.
- Время занятия хранится как local wall-clock time без timezone conversion,
  пока не утверждена отдельная timezone-модель.
- Старые attendance rows нельзя silently привязать к неверному occurrence при
  неоднозначности backfill.
- UI должен быть mobile-first и соответствовать `.agents/skills/crm-mobile-first-ui/SKILL.md`.
- До implementation plan новый календарный workflow проходит обязательную
  последовательность `ux-researcher -> ui-designer`; React-реализация не
  проектирует lifecycle или permissions самостоятельно.
- Изменение backend contract требует синхронного обновления web и bot
  consumers.

## Acceptance criteria
- [ ] Утверждена целевая доменная модель: schedule rule, occurrence,
  occurrence state, attendance link.
- [ ] Утверждён ключ attendance: `LessonOccurrenceId` или документированная
  альтернатива, которая поддерживает несколько занятий группы в один день.
- [ ] Утверждена policy создания будущих occurrences: pre-generate, on-demand
  или hybrid.
- [ ] Утверждены правила изменения одного занятия, всей серии и будущей части
  серии.
- [ ] Утверждены состояния занятия и допустимые переходы, включая поведение
  существующих `Present`/`Absent` при `Cancelled`/`NotHeld`.
- [ ] Утверждены роли и permissions для create/reschedule/cancel/not-held.
- [ ] Утверждён migration/backfill plan для текущих групп и attendance rows.
- [ ] Утверждён UX contract для mobile day/week календаря и перехода к
  attendance.
- [ ] Определено, какие активные задачи TASK-075/TASK-117/TASK-118/TASK-112
  заменяются или остаются промежуточными.
- [ ] После уточнений задача декомпозирована на implementation-ready tasks с
  тестовыми границами.

## Test checklist
- [ ] Для будущей реализации предусмотреть backend domain tests на recurrence,
  occurrence generation/materialization и state transitions.
- [ ] Для будущей реализации предусмотреть integration tests на migration,
  attendance binding, audit, permissions и ProblemDetails.
- [ ] Для будущей реализации предусмотреть frontend tests на mobile primary
  path, date/week navigation, empty/error states и action availability.
- [ ] Для будущей реализации предусмотреть bot/consumer contract tests, если bot
  открывает или создаёт attendance.
- [ ] Для будущей реализации проверить `390 x 844`, `420 x 912`, `440 x 956`,
  `912 x 420`, `956 x 440`, tablet и desktop без горизонтального overflow.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача меняет доменную модель расписания, persistence, migration,
  attendance identity, audit, permissions и несколько frontend/bot workflows.

## Clarification questions
- Какую materialization policy выбираем для будущих занятий: заранее на горизонт
  N месяцев, on-demand или hybrid?
- Может ли одна группа иметь больше одного занятия в один календарный день?
- При изменении серии нужны варианты `только это занятие`, `вся серия`,
  `эта и будущие`?
- Какие роли могут создавать, переносить, отменять и восстанавливать занятия?
- Что происходит с уже сохранёнными `Present`/`Absent`, если занятие переводят
  в `Cancelled` или `NotHeld`?
- `Held` создаётся автоматически при первой attendance-операции или только
  явной командой?
- Разовое занятие может существовать без recurring rule?
- Нужны ли предупреждения или hard-block при конфликте тренера/зала/времени?
- Как migration связывает существующие attendance rows с occurrences, если
  появится неоднозначность?
- Нужен ли bot-доступ к calendar occurrence или bot продолжает работать через
  backend attendance endpoint?
- Какие из TASK-075, TASK-117, TASK-118 и TASK-112 останавливаем до решения по
  календарю?

## Source notes
- Source file: conversation on 2026-08-20.
- Original note: пользователь подтвердил, что нравится идея полноценного
  календаря, и попросил сформировать новую продуктовую задачу на его реализацию.

## Processing notes
- Created at: 2026-08-20 00:15 MSK
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- UX analysis: `ux-researcher` зафиксировал mobile day-first primary path,
  action classification, failure recovery и измеримые device constraints;
  implementation-ready UI specification намеренно отложена до закрытия
  продуктовых вопросов.
- Duplicate check: активного полного дубликата нет; TASK-075/TASK-117/TASK-118
  решают отдельные фрагменты lifecycle/schedule/attendance snapshot, TASK-112
  остаётся day mode для weekly-template baseline.
