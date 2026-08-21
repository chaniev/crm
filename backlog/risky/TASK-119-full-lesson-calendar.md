# TASK-119: Реализовать полноценный календарь занятий

## Status
risky

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

Продуктовые вопросы закрыты 2026-08-20. Пользователь подтвердил поддержку
нескольких занятий группы в один день, самостоятельных разовых занятий, трёх
режимов изменения серии, role-based операций, предупреждений о конфликтах и
неудаляющей attendance conflict policy. Для бессрочного расписания принята
модель правила серии с необязательной датой окончания и ленивой
материализацией конкретного occurrence.

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
- Exceptional/destructive operations: отменить или восстановить занятие.
- Required data in lesson row/card: дата, время начала, длительность, группа,
  тип группы, зал/филиал, тренер, marker отмены и прямой факт наличия attendance
  marks. Производный completion status не вводится.
- Action budget: в primary mobile path тренер должен открыть attendance
  сегодняшнего занятия не более чем за 3 действия после входа в `Расписание`.
- Failure recovery: при ошибке загрузки показать повтор запроса без потери
  выбранной даты; при конфликте переноса показать причину и оставить введённые
  данные; при permission denial объяснить недоступное действие.
- Success criteria: нет горизонтального page scroll на mobile; primary action
  не спрятан в overflow; fixed/sticky controls учитывают safe area, Safari
  chrome и software keyboard.

## Product and architecture decisions
- Одна группа может иметь несколько занятий в один календарный день; каждое
  занятие имеет отдельный стабильный `LessonOccurrenceId`.
- Разовое занятие может существовать без recurring rule.
- Изменение повторяющегося расписания поддерживает три scope: `только это
  занятие`, `это и будущие`, `вся серия`. Исторические occurrences с attendance
  не переписываются изменением серии.
- Администратор и главный тренер могут выполнять все календарные операции в
  пределах существующего access scope; суперадминистратор сохраняет полный
  системный доступ. Тренер может просматривать свои занятия и сохранять их
  attendance, но не создаёт и не изменяет серии или разовые занятия, не
  переносит, не отменяет и не восстанавливает занятия.
- Lifecycle occurrence содержит только `Scheduled` и `Cancelled`. Attendance
  write не меняет lifecycle state. Отсутствие attendance marks не доказывает,
  что занятие не проводилось; отдельные `Held`, `NotHeld`, completion status и
  команда подтверждения пустого занятия не вводятся.
- При попытке перевести `Scheduled` occurrence с существующими
  `Present`/`Absent` marks в `Cancelled` команда блокируется стабильным conflict
  ProblemDetails. Marks не удаляются автоматически; их явное изменение и
  последующая отмена аудитируются раздельно.
- Пересекающиеся занятия одной группы, включая exact duplicate, запрещены hard
  validation. Конфликты разных групп по общему тренеру или залу остаются
  неблокирующими preview warnings: backend возвращает structured warning codes,
  frontend показывает их до подтверждения, а подтверждённая команда может
  выполниться без автоматического разрешения конфликта.
- Постоянно назначенный тренер видит occurrences своей группы в разрешённом
  calendar range. Неотменённая substitution даёт доступ по `LessonDate` внутри
  inclusive периода, включая upcoming и historical occurrences после обычного
  окончания замены. Future attendance открывается read-only; Coach меняет marks
  только за today и два предыдущих дня.
- Повторяющаяся серия имеет включительную `StartsOn` и необязательную
  включительную `EndsOn`; `EndsOn = null` означает бессрочное расписание.
- Бессрочная серия не порождает бесконечный набор строк. Целевая модель:
  `LessonSeries` -> immutable `LessonScheduleRuleVersion` -> weekly schedule
  slots. Calendar query детерминированно разворачивает версии правил только для
  запрошенного ограниченного диапазона дат.
- Стабильный ID планового занятия детерминированно формируется UUIDv5 из stable
  schedule-slot lineage и даты. Обычное будущее занятие может оставаться
  проекцией правила; `LessonOccurrence` с тем же ID материализуется при разовом
  занятии, исключении, переносе, lifecycle-переходе или первой attendance-записи.
  Calendar read накладывает материализованные occurrences на проекцию правил и
  не требует записи в БД или фоновой генерации.
- `только это занятие` создаёт/изменяет materialized occurrence. `это и
  будущие` действует от выбранной даты. `вся серия` действует от
  `max(StartsOn, business today)` независимо от выбранного occurrence. Прошлые
  dates, cancellations, attendance facts и materialized manual overrides/moves
  не переписываются. Factual occurrence с attendance или cancellation нельзя
  edit/move; cancellation/restore относится только к одному occurrence.
- При первой attendance-операции backend атомарно материализует occurrence и
  связывает attendance с `LessonOccurrenceId`; concurrent materialization
  защищается unique constraints/idempotent upsert.
- Existing attendance rows связываются автоматически только при однозначном
  соответствии. Неоднозначные строки не привязываются молча и попадают в
  durable migration report для ручного выбора/создания legacy occurrence;
  activation blocked до unresolved = 0, а cutover date передаётся явно и
  сохраняется для idempotent rerun.
- Если `SingleVisit` уже использован другим occurrence, второй `Present`
  сохраняется как attendance fact без автоматической продажи или write-off и
  возвращает явное предупреждение.
- Calendar response возвращает screen-level create capability и access-scoped
  filter options отдельно от rows, поэтому empty result не заставляет frontend
  выводить permissions из роли.
- Mobile/tablet week mode — семь vertical Monday–Sunday sections без horizontal
  scroll; desktop — seven-column grid. Day arrows меняют один день, week arrows
  семь дней. Card body открывает detail, видимая `Посещаемость` — exact roster.
  Create/edit/move/series используют отдельные routes; cancellation/restore —
  короткое explicit confirmation.
- Bot продолжает работать через backend attendance endpoint, передавая
  `LessonOccurrenceId`; recurrence и calendar lifecycle в bot не дублируются.
- Статусы TASK-075, TASK-112, TASK-117 и TASK-118 сейчас не меняются. Их
  актуализация выполняется после реализации TASK-119 по фактическому
  интегрированному результату.

## Scope
- Спроектировать backend-owned календарную модель:
  - recurring schedule rules for group lessons;
  - concrete lesson occurrences for dated lessons and exceptions;
  - stable `LessonOccurrenceId` for attendance, history and audit.
- Поддержать у recurring series обязательную дату начала и необязательную дату
  окончания; отсутствие даты окончания означает бессрочную серию.
- Реализовать rule projection + fact materialization policy без бесконечной
  предварительной генерации и без write-side effects у calendar read.
- Поддержать несколько schedule slots и occurrences одной группы в один день.
- Поддержать lifecycle конкретного занятия только со states
  `Scheduled | Cancelled` и аудируемым restore `Cancelled -> Scheduled`.
- Связать attendance с конкретным occurrence, а не только с
  `GroupId + TrainingDate`.
- Поддержать календарную навигацию:
  - today;
  - конкретная дата;
  - день;
  - неделя;
  - переход между неделями.
- Поддержать read-only открытие future attendance и backend-owned distinction
  `canViewAttendance`/`canEditAttendance`.
- Поддержать операции:
  - создать разовое занятие;
  - изменить одно занятие;
  - изменить серию;
  - перенести занятие;
  - отменить занятие;
  - восстановить занятие;
  - открыть attendance конкретного occurrence.
- Запрещать пересечение time ranges и exact duplicate у одной группы; показывать
  неблокирующие предупреждения о конфликтах разных групп по тренеру или залу.
- Определить migration/backfill policy для существующего расписания и
  существующих attendance rows.
- После реализации актуализировать TASK-075, TASK-117, TASK-118 и TASK-112 по
  фактическому интегрированному результату, не меняя их статусы заранее.
- Подготовить дальнейшую декомпозицию на backend contract/persistence,
  frontend calendar UX, attendance migration, bot consumers и regression tests.

## Out of scope
- Drag-and-drop календарь.
- Интеграция с Google/Outlook Calendar.
- Уведомления о переносах и отменах.
- Hard-block и автоматический conflict-resolution конфликтов разных групп по
  залам, тренерам и capacity; same-group overlap и exact duplicate остаются
  hard validation, а resource conflicts разных групп дают предупреждение.
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
- `StartsOn`/`EndsOn` являются local calendar dates; `EndsOn` включительна,
  обязана быть не раньше `StartsOn`, а `null` не ограничивает серию.
- Нельзя материализовывать бессрочную серию на неограниченный горизонт или
  требовать background job только ради чтения календаря.
- Детерминированный recurring occurrence ID включает stable schedule-slot
  lineage и дату, чтобы несколько занятий группы в один день не конфликтовали,
  ID сохранялся между rule versions логического slot и совпадал до/после
  материализации.
- Rule versions не изменяются задним числом после появления фактических
  occurrences; изменения будущей части создают новую version.
- UI должен быть mobile-first и соответствовать `.agents/skills/crm-mobile-first-ui/SKILL.md`.
- До implementation plan новый календарный workflow проходит обязательную
  последовательность `ux-researcher -> ui-designer`; React-реализация не
  проектирует lifecycle или permissions самостоятельно.
- Изменение backend contract требует синхронного обновления web и bot
  consumers.

## Acceptance criteria
- [ ] Recurring series сохраняет `StartsOn` и nullable inclusive `EndsOn`;
  бессрочная серия корректно отображается в любом разрешённом диапазоне без
  бесконечной предварительной генерации.
- [ ] Rule versions и schedule slots поддерживают разные времена по weekday и
  несколько занятий группы в один день.
- [ ] Calendar API возвращает стабильный `LessonOccurrenceId` для projected и
  materialized occurrences, а materialization сохраняет тот же ID.
- [ ] Разовое занятие создаётся без recurring series и участвует в том же
  lifecycle, calendar query и attendance flow.
- [ ] `только это`, `это и будущие` и `вся серия` имеют backend-owned semantics
  с утверждёнными date boundaries и не переписывают factual/manual history.
- [ ] Переходы `Scheduled -> Cancelled -> Scheduled` валидируются и
  аудитируются; attendance write не меняет lifecycle state.
- [ ] Попытка отменить `Scheduled` occurrence с существующими
  `Present`/`Absent` возвращает conflict без автоматического удаления данных и
  допускает только явное аудируемое разрешение.
- [ ] Администратор и главный тренер имеют полный calendar mutation scope в
  пределах существующего access scope, суперадминистратор сохраняет полный
  доступ, а тренер для своих занятий ограничен attendance.
- [ ] Same-group overlap и exact duplicate блокируются без confirm override;
  конфликты разных групп по общему тренеру или залу видимы как warnings и не
  блокируют подтверждённое сохранение; warning codes вычисляет backend.
- [ ] Однозначный migration/backfill связывает legacy attendance автоматически,
  а неоднозначности формируют durable report с audited manual repair и
  report-zero activation gate.
- [ ] Coach видит upcoming и historical occurrences неотменённой substitution
  по LessonDate, future roster read-only и меняет marks только today/minus two.
- [ ] Второй `Present` при уже использованном SingleVisit сохраняется без
  автоматического списания/продажи и возвращает явное предупреждение.
- [ ] Empty calendar сохраняет backend-owned create capability/filter options;
  frontend не выводит permissions из role/items.
- [ ] Mobile day/week UX выполняет зафиксированный primary path и responsive
  criteria, включая seven-section mobile/tablet week, seven-column desktop week
  и route-based mutation forms; bot использует occurrence-aware backend endpoint.
- [ ] После интеграции выполнен status audit TASK-075/TASK-112/TASK-117/TASK-118
  без преждевременного изменения их текущих статусов.
- [ ] Внутри одной TASK-119 реализация разделена на implementation-ready phases
  backend core, mutations, migration/attendance, frontend, bot и release
  regression с явными checkpoint-зависимостями; отдельные backlog tasks,
  branches и worktrees для этих phases не создаются.

## Test checklist
- [ ] Для будущей реализации предусмотреть backend domain tests на recurrence,
  optional end date, rule version splitting, deterministic occurrence identity,
  occurrence materialization и state transitions.
- [ ] Для будущей реализации предусмотреть integration tests на migration,
  concurrent idempotent materialization, attendance binding, audit, permissions
  и ProblemDetails.
- [ ] Для будущей реализации предусмотреть frontend tests на mobile primary
  path, date/week navigation, empty/error states и action availability.
- [ ] Для будущей реализации предусмотреть bot/consumer contract tests, если bot
  открывает или создаёт attendance.
- [ ] Для будущей реализации проверить `390 x 844`, `420 x 912`, `440 x 956`,
  `912 x 420`, `956 x 440`, tablet и desktop без горизонтального overflow.

## AI safety
- Safe for Codex: yes, only with explicit user start and mandatory phased gates
- Risk level: high
- Reason: задача меняет доменную модель расписания, persistence, migration,
  attendance identity, audit, permissions и несколько frontend/bot workflows.
- Guardrail: одна task branch/worktree, red/green checkpoint после каждой фазы,
  report-zero activation gate, coordinated release и один merge после полного
  integrated regression.

## Clarification questions
Не требуется. Решения закрыты 2026-08-20 и зафиксированы в разделе
`Product and architecture decisions`.

## Source notes
- Source file: conversation on 2026-08-20.
- Original note: пользователь подтвердил, что нравится идея полноценного
  календаря, и попросил сформировать новую продуктовую задачу на его реализацию.
- Plan review 2026-08-20 01:42 MSK: пользователь подтвердил lifecycle только
  `Scheduled | Cancelled`, hard-block пересечений занятий одной группы и merge
  в `main` после готовности реализации всего плана.
- Plan review 2026-08-20 01:56 MSK: пользователь принял варианты A по вопросам
  access, entire-series boundary, identity/concurrency, factual immutability,
  migration repair, SingleVisit, screen capabilities и week/form UX.

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
- Clarified at: 2026-08-20 00:31 MSK — подтверждены multiple occurrences per
  day, standalone one-off lessons, три series-edit scope, role boundaries,
  non-destructive attendance conflicts, automatic `Held`, warning-only
  schedule conflicts, occurrence-aware bot и ambiguity-safe backfill.
- Superseded at: 2026-08-20 01:42 MSK — прежние решения об `Held`/`NotHeld` и
  warning-only любых schedule conflicts заменены явным lifecycle
  `Scheduled | Cancelled` и hard validation для same-group overlap/exact
  duplicate; different-group trainer/hall conflicts остаются warnings.
- Clarified at: 2026-08-20 01:56 MSK — зафиксированы occurrence-date Coach
  access и future read-only roster, `EntireSeries` от business today, immutable
  facts/manual exceptions, explicit cutover/report repair, non-blocking second
  SingleVisit attendance, response-level capabilities и exact responsive week
  UI с route-based mutation forms.
- Architecture decision: bounded deterministic rule projection plus on-fact
  materialization; recurring series uses inclusive `StartsOn` and nullable
  inclusive `EndsOn`, where `null` means indefinite. No unbounded pre-generation
  or mandatory background materializer.
- Related-task decision: TASK-075/TASK-112/TASK-117/TASK-118 remain unchanged
  until post-implementation status audit of TASK-119.
- Moved to risky at: 2026-08-20 00:31 MSK after all blocking product and
  architecture questions were resolved; classification remains high risk due
  to schedule, attendance identity, persistence, migration and permissions.
