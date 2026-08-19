# Implementation Plan: TASK-119 Полноценный календарь занятий

## Source task
/backlog/risky/TASK-119-full-lesson-calendar.md

TASK-119 остаётся в `/backlog/risky`. Продуктовые вопросы закрыты, поэтому
детальное planning и test-first декомпозиция допустимы, но umbrella scope имеет
`Safe for Codex: no` и не переводится в активную implementation этим запуском.
Код проекта, schema и runtime этим планом не меняются.

## Implementation branches

TASK-119 нельзя безопасно реализовывать одной общей веткой. До кода координатор
должен создать отдельные backlog-карточки для следующих execution slices и
назначить каждой отдельную branch/worktree:

| Slice | Предлагаемая branch | Зависимость |
|---|---|---|
| A. Calendar core и bounded projection | `feature/TASK-119-calendar-core` | текущий `origin/main` |
| B. Calendar mutations, cancellation и warnings | `feature/TASK-119-calendar-mutations` | A merged в `origin/main` |
| C. Occurrence-aware attendance и data transition | `feature/TASK-119-attendance-migration` | A и B merged |
| D. Web calendar и attendance UX | `feature/TASK-119-web-calendar` | A–C merged |
| E. Bot occurrence consumer | `feature/TASK-119-bot-occurrence-attendance` | A–C merged; может идти параллельно D |
| F. Coordinated activation, cleanup и release regression | `feature/TASK-119-calendar-release-regression` | D и E merged |

Branch rules для каждого slice:
- перед первым изменением project code прочитать и выполнить
  `.agents/skills/task-worktree/SKILL.md`;
- создать branch непосредственно от актуального `origin/main` после merge всех
  объявленных predecessor slices; не основывать её на unmerged child branch;
- primary repository оставить на `main`, а код менять только в отдельном
  registered task worktree;
- до правки проверить git root, active branch, clean status, worktree list и
  `git merge-base --is-ancestor origin/main HEAD`;
- при параллельной работе D/E второй merge выполнять только после повторной
  проверки/rebase на уже обновлённый `origin/main`;
- не использовать umbrella branch `feature/TASK-119-full-lesson-calendar` для
  смешанного full-stack изменения;
- не копировать код из unmerged TASK-103/TASK-112/TASK-117/TASK-118 branches.

Planning baseline `2026-08-20 00:42 MSK`:
- primary repository: clean `main`, HEAD
  `803f25ecf056023c9507721e0daff67e1eb3d627`;
- local `origin/main`: `803f25ecf056023c9507721e0daff67e1eb3d627`;
- local `main` совпадает с `origin/main` и содержит clarified TASK-119;
- TASK-119 branch/worktree и implementation plan до этого запуска отсутствовали.

Executor обязан выполнить `git fetch origin` и повторить preflight. Нельзя
начинать child slice, пока source task, этот план и predecessor results не
находятся в его фактическом `origin/main` или пользователь явно не утвердил
другой base.

## Goal

Coach, Administrator, HeadCoach и SuperAdministrator видят расписание как
ограниченный диапазон конкретных занятий с устойчивым
`LessonOccurrenceId`. Пользователь может найти день/неделю, различить несколько
занятий одной группы в день, открыть attendance нужного occurrence, а
разрешённые роли — создать разовое занятие, изменить occurrence или series,
перенести, отменить и восстановить занятие. Recurrence,
cancellation state, access, warnings, audit и attendance identity остаются
backend-owned. Отдельный факт/статус проведения тренировки не вводится:
проведённость не моделируется как lifecycle, а календарь показывает только
прямой факт наличия сохранённых отметок клиентов.

## Planning handoff

- `ux-researcher` подтвердил day-first mobile primary path, action budget,
  классификацию операций, recovery и риски старой пары
  `(GroupId, TrainingDate)`.
- `ui-designer` преобразовал contract в implementation-ready hierarchy:
  visible row-level `Посещаемость`, contextual mutation surfaces, URL-owned
  date/view state, preview/confirm warnings, exact responsive and focus rules.
- Product clarification `2026-08-20` уточнил contract: Coach access проверяется
  по постоянному назначению или upcoming/active substitution на дату occurrence;
  recurring identity сохраняет slot lineage между rule versions; `Held` и
  attendance completion status не вводятся; group + initial series создаются
  атомарно; overlapping lessons одной группы запрещены; release обновляет DB,
  backend, frontend и bot согласованно; mobile toolbar использует compact
  single-row variant с Calendar tools surface.
- Evidence основана на source task, текущем коде и тестах. Physical iPhone,
  Safari chrome, software keyboard, safe area и one-handed reach не проверялись
  и остаются manual/Simulator evidence будущего execution.

## Current understanding

- `TrainingGroup` хранит один `TrainingStartTime`, общий `DurationMinutes` и
  массив `Weekdays`; самостоятельного факта занятия нет.
- `/schedule/groups` возвращает group list. `GroupScheduleScreen.tsx` и
  `groupSchedule.ts` разворачивают presentation-only неделю во frontend; read
  не адресует реальные даты и не умеет открыть конкретный occurrence.
- Frontend attendance получает roster и сохраняет mark по `groupId +
  trainingDate`; `AttendanceWorkspace` выбирает группу и дату, а current route
  `/attendance` пока не является canonical section route.
- `Attendance` хранит `GroupId` и `TrainingDate`; unique index
  `(ClientId, GroupId, TrainingDate)` не различает два занятия группы в один
  день.
- Первая/повторная attendance save, membership write-off/restore и audit уже
  объединены `AttendanceService` в transaction, но materialization occurrence в
  эту boundary не входит.
- Bot повторяет старый contract: date -> groups -> group/date roster ->
  group/date save. Bot state и idempotency target не содержат occurrence id.
- TASK-112/TASK-117/TASK-118 имеют планы вокруг weekly-template/snapshot, но не
  реализованы и не являются prerequisites. Их решения можно использовать как
  evidence, но нельзя строить TASK-119 branch на их unmerged code.
- TASK-075 остаётся needs-clarification. TASK-119 вводит только cancellation
  transitions `Scheduled -> Cancelled -> Scheduled`; отдельные `Held`,
  `NotHeld` и completion status не нужны. Related-task status audit выполняется
  по факту интеграции.
- TASK-103 планирует отдельный `/attendance`. TASK-119-D не зависит от unmerged
  TASK-103: он обязан дать occurrence-addressable detail route. Если TASK-103 к
  тому моменту merged, route расширяется; если нет — более широкий landing/nav
  redesign TASK-103 не копируется в TASK-119.
- Backend migration rule обычно предпочитает recreated initial state. Однако
  source TASK явно требует compatibility/backfill существующих attendance rows
  и migration report, поэтому Slice C должен подготовить проверяемый forward
  data transition, а также обновить reproducible initial state и model snapshot.

## Target domain contract

### Series, immutable rule versions and slots

Добавить backend domain/application model:

- `LessonSeries`:
  - `Id`, required `GroupId`;
  - один canonical series на группу, protected by unique `GroupId`; изменения
    расписания создают rule versions, а не параллельные overlapping series;
  - inclusive `StartsOn`;
  - nullable inclusive `EndsOn`, где `null` означает бессрочно;
  - optimistic concurrency token и audit timestamps.
- `LessonScheduleRuleVersion`:
  - `Id`, `LessonSeriesId`, monotonic version number;
  - inclusive `EffectiveFrom` и nullable inclusive `EffectiveTo`;
  - immutable после появления projected/materialized facts;
  - соседние versions одной series не пересекаются.
- `LessonScheduleSlot`:
  - stable row id внутри конкретной rule version;
  - required stable `SlotLineageId`, сохраняемый между rule versions для того
    же логического слота;
  - ISO weekday, local `TimeOnly` start, duration;
  - hall и trainer assignment set, необходимые для projection/conflict preview;
  - несколько slots одного weekday для одной группы разрешены только если их
    time ranges не пересекаются; одновременные или полностью одинаковые занятия
    одной группы запрещены hard validation.
- `LessonOccurrence`:
  - `Id`, required `GroupId`, local `LessonDate`, start, duration, hall и
    trainer set;
  - nullable source series/rule/slot refs для standalone one-off;
  - immutable `ProjectedDate`/source identity для moved occurrence overlay;
  - status `Scheduled | Cancelled`;
  - source kind `Recurring | OneOff | LegacyAttendance`;
  - concurrency token, materialization/audit metadata.

Имена группы, type и branch могут читаться из текущей group identity, но
время/duration/hall/trainers занятия принадлежат versioned slot или
materialized occurrence. Frontend и bot не восстанавливают их из current group
template.

### Deterministic occurrence identity

- Для recurring projection использовать один fixed RFC 4122 UUIDv5 namespace
  и canonical UTF-8 key
  `lesson-slot-lineage:{slotLineageId:D}:{date:yyyy-MM-dd}`.
- `SlotLineageId` сохраняется при изменении времени, duration, hall или trainer
  set того же логического слота через `ThisAndFuture`/`EntireSeries`. Новый
  добавленный slot или перенос существующего slot на другой ISO weekday получает
  новый lineage. Удалённый slot прекращает создавать projected occurrences, но
  старые/materialized facts сохраняют source lineage.
- В одной rule version допускается не более одного slot для конкретного
  lineage. Slot row id остаётся version-local persistence identity и не входит
  во внешний occurrence id.
- Реализация явно нормализует RFC byte order и не зависит от culture, timezone,
  database provider или process.
- Projected DTO и последующая materialization обязаны получить один и тот же
  id; unique constraint и idempotent upsert защищают concurrent first write.
- One-off occurrence получает server-generated UUID, а legacy attendance
  backfill — детерминированный id из отдельного documented namespace, чтобы не
  имитировать recurring origin, которого исторически нельзя доказать.
- Frontend/bot считают id opaque string и никогда не вычисляют его локально.

### Bounded, side-effect-free projection

- Calendar query принимает inclusive `from`/`to`, валидирует порядок и
  ограничивает диапазон day/week use case (target maximum 31 days).
- Query разворачивает только rule versions/slots, пересекающие диапазон,
  вычисляет projected IDs и накладывает materialized occurrences по source id.
- Moved occurrence загружается, если в диапазон попадает исходная или текущая
  дата: исходная projection подавляется, текущая позиция добавляется один раз.
- Standalone occurrences добавляются тем же typed result.
- Read path не вызывает `SaveChanges`, не материализует строки и не требует
  background generator.
- Сортировка: lesson date, start time, group name, occurrence id. Filters и
  role/access scope применяются backend до выдачи payload.

### Access scope

- Management roles используют существующий branch/group access scope.
- Coach видит occurrence и может открыть attendance, если он сейчас постоянно
  назначен на группу или имеет неотменённую upcoming/active substitution:
  `EndsOn >= business today`, а inclusive range содержит дату occurrence.
- Coach access вычисляется относительно `LessonDate`, а не относительно
  только текущей даты запроса. После окончания/cancellation substitution доступ
  к прошлым occurrences этой замены закрывается.
- Frontend и bot не выводят доступ из текущего списка тренеров группы; они
  используют только backend `allowedActions` и 403 ProblemDetails.

### Cancellation and attendance mark fact

Backend state machine:

| From | To | Кто/условие |
|---|---|---|
| Scheduled | Cancelled | Administrator/HeadCoach/SuperAdministrator в access scope |
| Cancelled | Scheduled | разрешённый restore с audit |

Отдельных `Held`, `ConfirmedHeld`, `NotHeld`, completion status и команды
подтверждения пустого занятия нет. Первая attendance write может materialize
projected occurrence, но не меняет cancellation state. Отсутствие marks ничего
не говорит о проведении занятия. Любое расширение matrix требует отдельного
product decision и tests.

Calendar DTO возвращает только прямой backend-owned факт
`hasAttendanceMarks`, равный наличию хотя бы одной persisted `Present`/`Absent`
mark для occurrence. Completion enum, expected-client denominator и производный
статус проведения не вводятся. DTO также возвращает `allowedActions` с
boolean/reason codes для open attendance, edit, move, cancel и restore. UI не
выводит permissions или cancellation state из
role/date/attendance rows самостоятельно.

Если `Present`/`Absent` уже существуют, переход в `Cancelled` возвращает stable
409 conflict и не удаляет marks. Recovery ведёт к явному разрешению attendance
conflict; attendance change и последующая cancellation команда аудитируются
отдельно.

## API contract to lock with red tests

### Calendar reads

- `GET /schedule/lessons?from=YYYY-MM-DD&to=YYYY-MM-DD` с optional
  `branchId`, `hallId`, `trainerId`, `groupId`, `groupTypeId`.
- `GET /schedule/lessons/{lessonOccurrenceId}` для detail/deep link.
- Response item содержит:
  - `lessonOccurrenceId`, `sourceKind`, `isMaterialized`;
  - date, start/end или duration;
  - group id/name/type, branch, hall, trainers;
  - cancellation state и direct `hasAttendanceMarks` fact;
  - allowed actions/reasons;
  - opaque `revision`, одинаково применимый к projected и materialized forms.
- Projected и materialized forms одного occurrence имеют одинаковую external
  shape и id.

### Group create/update with initial schedule

- `POST /groups/preview` принимает group identity, permanent trainer
  assignments и required nested `initialLessonSeries`, валидирует весь command
  и возвращает warnings/confirmation token до записи.
- После cutover frontend не отправляет legacy `Weekdays`, `TrainingStartTime`,
  `DurationMinutes`, hall и trainers как редактируемый schedule template внутри
  обычного group update.
- Group create остаётся одной пользовательской операцией: request содержит
  group fields, required `initialLessonSeries` и preview `confirmationToken`.
  Backend создаёт группу, series, first rule version и slots одной transaction;
  ошибка расписания не оставляет группу без initial schedule.
- Group update управляет identity полями группы: name, type, branch, active
  state и другими non-schedule атрибутами. Изменение дней, времени, duration,
  hall и trainer set выполняется только через lesson-series preview/execute.
- Постоянное назначение тренера на группу влияет на coach access scope.
  Замещающий тренер задаётся отдельной substitution сущностью/командой на
  конкретные даты и не переписывает historical occurrences.
- Legacy fields читает только transition runner для migration/report. Они не
  входят в activated group read/write contract и не используются production
  API как compatibility source.

### Series and lesson mutations

- `POST /groups/{groupId}/lesson-series/preview` и
  `POST /groups/{groupId}/lesson-series` для изменения существующей series;
  initial series новой группы создаётся только atomic group-create command.
- `POST /schedule/lessons/one-off/preview` и
  `POST /schedule/lessons/one-off` для standalone lesson.
- `POST /schedule/lessons/{id}/change/preview` и
  `POST /schedule/lessons/{id}/change` для edit/move с scope
  `Occurrence | ThisAndFuture | EntireSeries`.
- `POST /schedule/lessons/{id}/cancellation/preview` и
  `POST /schedule/lessons/{id}/cancellation` для cancel/restore между
  `Scheduled | Cancelled` в разрешённой matrix.
- Preview request использует local dates/time и opaque `expectedRevision`.
  Preview response возвращает structured warnings, affected/skipped set и
  opaque `confirmationToken`, привязанный к actor, normalized command,
  occurrence/source revisions и точному preview result.
- Execute передаёт `confirmationToken`; warning codes используются только для
  presentation. Backend повторно вычисляет conflicts и affected/skipped set
  внутри transaction. Любое отличие возвращает
  `lesson-mutation-preview-stale`, даже если warning codes остались прежними.

Warning здесь означает non-blocking resource конфликт с другими занятиями,
который backend показывает до сохранения и разрешает только после explicit
confirmation:
- `lesson_trainer_overlap`;
- `lesson_hall_overlap`.

Они означают, что занятие другой группы в пересекающееся время использует того
же trainer или hall. Само совпадение времени у разных групп без общего trainer
или hall предупреждением не является.

Warnings не блокируют подтверждённое сохранение. Для бессрочной weekly series
conflict engine сравнивает weekday/time/range алгебраически, а materialized
exceptions — по конкретным датам; он не разворачивает бесконечный календарь.
Response ограничивает examples, но сообщает, если конфликт повторяется без
конечной даты.

Hard validation без confirmation:
- validation precedence сначала проверяет exact duplicate, затем более общий
  same-group overlap;
- `lesson-group-overlap` — у одной группы не может быть двух занятий с
  пересекающимися time ranges в одну дату/weekday независимо от hall/trainer;
- `lesson-duplicate` — полностью одинаковое занятие одной группы запрещено:
  совпадают one-off date либо recurring weekday/effective range, start,
  duration, hall и нормализованный trainer set.

Stable ProblemDetails минимум:
- `lesson-calendar-range-invalid` — invalid/oversized range;
- `lesson-occurrence-not-found`;
- `lesson-occurrence-forbidden`;
- `lesson-occurrence-concurrency-conflict`;
- `lesson-mutation-preview-stale` с актуальными warnings;
- `lesson-group-overlap`;
- `lesson-duplicate`;
- `lesson-attendance-state-conflict` с occurrence id, bounded counts и recovery
  code без автоматического удаления marks;
- field-level ValidationProblem для invalid starts/ends, slots, duration и
  scope.

Не возвращать trainer/hall/group details вне actor access scope.

### Occurrence-aware attendance

Canonical web endpoints:
- `GET /attendance/lessons/{lessonOccurrenceId}/clients`;
- `POST /attendance/lessons/{lessonOccurrenceId}`;

Canonical bot endpoints:
- `GET /internal/bot/attendance/lessons?trainingDate=YYYY-MM-DD`;
- `GET /internal/bot/attendance/lessons/{lessonOccurrenceId}/clients`;
- `POST /internal/bot/attendance/lessons/{lessonOccurrenceId}`.

Group/date остаются display fields в responses, но не command identity.
Attendance save атомарно:
1. разрешает projected/materialized occurrence и actor access;
2. materializes projected occurrence с тем же id idempotently;
3. применяет marks и membership write-off/restore;
4. не меняет cancellation state; наличие marks видно через direct
   `hasAttendanceMarks`;
5. пишет occurrence, attendance и membership audits;
6. commits либо rolls back всю boundary.

Unique attendance identity после cutover — `(ClientId, LessonOccurrenceId)`.

## Edit-scope semantics

### Occurrence
- Materialize selected projection с тем же id.
- Сохранить immutable source date/slot и записать overrides.
- Move подавляет source position и показывает occurrence на target date.

### ThisAndFuture
- Закрыть текущую immutable version на день перед target date.
- Создать новую version, начинающуюся target date, и новые slots.
- Не менять occurrences с attendance или factual cancellation state.
- Scheduled materialized exceptions в scope либо сохраняют явные overrides,
  либо обновляются только по правилам, зафиксированным preview; affected set
  показывается до execute.

### EntireSeries
- Не переписывать rule/fact history задним числом.
- Создать replacement versions только для редактируемых ranges.
- `Cancelled` и occurrences с attendance остаются immutable
  facts; preview показывает skipped/affected counts.
- Нельзя выполнять unbounded row generation для бессрочной части.

Все три scope должны иметь domain tests на boundary dates, inclusive ends,
multiple slots/day, existing exceptions и attendance facts.

## Data transition and compatibility

Slice C подготавливает многошаговую проверяемую transition из текущей модели:

1. Additive schema:
   - создать series/version/slot/occurrence tables и nullable
     `Attendance.LessonOccurrenceId`;
   - обновить reproducible initial migration/state и model snapshot;
   - из-за явного требования сохранить existing attendance подготовить
     отдельный forward migration/transition runner от текущей schema.
2. Recurring cutover:
   - для каждой existing group создать одну current series/rule version из
     legacy weekday/time/duration/hall/trainers с явной cutover date;
   - не проецировать этот current template назад как доказанную историю.
3. Historical attendance backfill:
   - сгруппировать rows по `(GroupId, TrainingDate)`;
   - автоматически создать `LegacyAttendance` occurrence и связать rows только
     если legacy schedule даёт ровно один доказуемый slot для weekday;
   - zero/multiple match, missing group/slot или inconsistent payload записать
     в durable migration report без guessed binding.
4. Resolution gate:
   - report содержит group/date/reason/row count и resolution status;
   - manual repair command/materialized mapping аудитируется;
   - activation запрещена, пока unresolved count не равен нулю.
5. Canonical cutover:
   - сделать occurrence FK required;
   - заменить unique index на `(ClientId, LessonOccurrenceId)`;
   - обновить client history, missed-training, membership write-off/restore,
     audit и all readers на occurrence join;
   - удалить `Attendance.GroupId/TrainingDate` как command source после
     verified migration; display values читаются из occurrence.
6. Coordinated activation в Slice F:
   - DB transition, backend, frontend и bot входят в один release и не
     разворачиваются в production частично;
   - legacy group/date attendance mutation endpoints и legacy weekly-template
     write fields отсутствуют в activated release;
   - maintenance gate закрывает attendance writes до migration/report-zero,
     deploy и occurrence-aware smoke; dual write/source не используется.

Clean database, current-schema forward migration, ambiguous report и
idempotent rerun/concurrent materialization тестируются отдельно на PostgreSQL.

## UX contract

- User/context: Coach и management roles работают на телефоне между занятиями.
- Result: найти конкретное занятие, увидеть отмену и наличие attendance marks,
  выполнить разрешённую операцию без выбора технической series/rule сущности.
- Primary mobile path: `Расписание` -> `Сегодня` или selected date -> day list
  -> lesson row -> `Посещаемость`.
- Action budget: Coach открывает attendance сегодняшнего занятия не более чем
  за три действия после входа в `Расписание`.
- Completion signal: attendance route/detail содержит тот же
  `LessonOccurrenceId`, time/group/date и возвращается к сохранённой calendar
  date/view/filter state.
- Required row data: date, time range, group, group type, branch/hall, trainers,
  visible cancellation marker только для `Cancelled` и direct indication
  наличия attendance marks. Для обычного `Scheduled` отдельный status badge не
  показывается.
- Primary: `Посещаемость`. Frequent: previous/next date and current date
  selector visible in the toolbar; today, day/week, refresh и filters reachable
  in one obvious Calendar tools interaction on narrow mobile.
- Secondary: create one-off, move, edit occurrence, edit series.
- Exceptional/destructive: cancel, restore, edit past occurrence with
  attendance.
- Coach видит свои lessons и открывает attendance; calendar mutation controls
  не показываются как usable actions.
- Error retry сохраняет selected date/filter. Conflict сохраняет form values.
  Permission denial объясняет недоступное действие.

## UI specification

### Schedule screen hierarchy

1. Сохранить top-level `Расписание` route semantics и visually-hidden `h1`,
   если active persistent navigation уже однозначно называет route.
2. Первый operational row на mobile — выбранный compact variant B, одна
   non-wrapping строка без horizontal scroll:
   - compound date navigation group: previous date icon button `44 x 44`,
     persistent date control with `min-width: 120px`, next date icon button
     `44 x 44`; date control uses remaining width and truncates only its visible
     label while preserving the full accessible date name;
   - Calendar tools trigger `44 x 44`, открывающий Drawer/Menu с `Сегодня`,
     `День/Неделя`, `Обновить` и filters;
   - management-only create one-off `44 x 44` icon button. У Coach этот control
     отсутствует, а освободившаяся ширина отдаётся date control.
3. Все independent controls, включая previous/date/next внутри compound date
   group, имеют минимум `8px` gap. Touch target каждого интерактивного элемента
   не меньше `44 x 44`.
4. На `360–440px` Calendar tools — bottom Drawer с title
   `Параметры календаря`. Порядок: `Сегодня`, segmented `День/Неделя`,
   `Обновить`, затем persistently labeled filter fields и footer actions
   `Готово`/`Сбросить фильтры`. Today/view/refresh применяются сразу и закрывают
   Drawer; filter changes применяются сразу, Drawer остаётся открыт для
   нескольких изменений, `Готово` только закрывает его. Date picker открывается
   отдельным surface из date control и никогда не вкладывается в Calendar tools.
5. Active filters не скрываются: Calendar tools trigger показывает count badge
   или active indicator, а accessible name включает количество активных
   фильтров. Текущие значения видны в labeled fields; отдельный summary не
   дублируется. Если активных фильтров нет, trigger не показывает badge.
6. Mobile default — selected-day task list, не сжатая desktop week grid.
7. Lesson row/card показывает time/group, `Cancelled` marker when applicable и
   attendance marks fact first, затем type/hall/branch/trainer. Отдельный
   `Scheduled` badge не выводится. Несколько same-group lessons различаются
   временем и stable occurrence identity; technical UUID полностью не выводится.
8. `Посещаемость` — visible row primary action минимум 44px и никогда не
   находится в overflow.
9. Secondary row menu содержит только разрешённые edit/move/series actions.
   Destructive cancellation action отделён и требует explicit confirmation;
   restore остаётся contextual recovery action.
10. Week mode служит overview/navigation context; выбор lesson открывает detail
   или attendance, не desktop table horizontal-scroll на mobile.

Selected `date`, `view=day|week` и filters сохраняются в URL/history. Calendar
feature обрабатывает reload/back/forward, retry и stale refresh без сброса к
today. Attendance detail использует canonical
`/attendance/{lessonOccurrenceId}` и return URL/state на selected calendar
context. Если TASK-103 merged, detail включается в его section; иначе TASK-119
не меняет broader landing/nav model.

### Mutation surfaces

- Create/edit/move — Mantine single-column form на mobile, Drawer или route
  surface по existing pattern; не nested modal.
- Series edit обязательно показывает scope `Только это`, `Это и будущие`,
  `Вся серия` с persistent label и backend preview affected/skipped counts.
- Preview вызывается до execute. Trainer/hall warnings показываются рядом
  с confirmation action, остаются non-blocking для разрешённых resource
  overlaps и требуют explicit confirm. Same-group overlap и duplicate не
  являются warnings; это hard validation.
- При preview stale или recoverable API error entered values, selected scope и
  focus context сохраняются.
- `Cancelled` attendance conflict открывает recovery surface с понятной
  причиной и ссылкой в occurrence attendance; marks не очищаются автоматически.
- Закрытие Menu/Drawer/Modal возвращает focus trigger; Escape закрывает desktop
  temporary surface, mobile back/explicit close не теряет draft без confirm.

### Attendance detail

- Header/context: date, time, group, hall/branch, trainer, `Cancelled` marker
  when applicable и direct indication наличия marks; не показывать generic
  `Scheduled`, technical series/rule или производный completion status.
- Roster/save state остаётся row-local и получает occurrence id from route.
- Future/permission-restricted attendance action остаётся visible disabled с
  backend reason, если его отсутствие создало бы ложное ощущение исчезнувшей
  primary operation.
- Back возвращает selected schedule date/view/filter. Client profile return
  state меняет canonical identity с group/date на occurrence id и fails closed
  для stale/malformed history.

### Responsive behavior

- `360 x 780`: content width assumes 16px side padding (`328px`). Management
  toolbar fits as `[date group max 224px] 8 [tools 44] 8 [create 44]`; Coach
  toolbar fits as `[date group max 276px] 8 [tools 44]`. Date label truncates to
  short format such as `20 авг` before reducing touch targets. Filters, Today,
  day/week and refresh are inside Calendar tools Drawer. No horizontal page
  scroll.
- `390 x 844`: stress baseline; content width assumes 16px side padding
  (`358px`). Management toolbar fits as `[date group max 254px] 8 [tools 44] 8
  [create 44]`; Coach toolbar fits as `[date group max 306px] 8 [tools 44]`.
  Primary attendance visible on every actionable row; no second action-only
  toolbar.
- `420 x 912`: content width assumes 16px side padding (`388px`). Management
  date group max `284px`; Coach date group max `336px`. Date label may use
  medium weekday/date format if it does not push tools/create below `44px`.
- `440 x 956`: content width assumes 16px side padding (`408px`). Management
  date group max `304px`; Coach date group max `356px`. Same hierarchy; more
  row metadata may remain visible before wrapping. Do not add decorative summary
  panels.
- `768 x 1024`: toolbar may surface `Сегодня`, day/week switch, refresh and
  filters as separate controls if the row remains non-wrapping and primary row
  hierarchy stays stable. Week overview + selected-day detail или wide day list
  допустимы, но primary attendance остаётся visible и DOM/access names
  стабильны.
- `1440 x 1200`: toolbar surfaces date navigation, Today, day/week, refresh,
  filters and create as labeled controls where useful. Week grid/list hybrid
  допустим; не возвращать hero, aggregate widgets или duplicate heading только
  ради свободной ширины.
- `912 x 420` и `956 x 440`: compact shell; toolbar сохраняет reachable date
  navigation. Calendar tools opens a temporary surface with max-height based on
  dynamic visible viewport, internal scroll only for the tools list, and sticky
  `Готово`/`Сбросить фильтры` footer respecting safe area. Forms use one
  intentional scroll and sticky footer without nested scrolling trap.
- Fixed/sticky controls используют normal spacing плюс
  `env(safe-area-inset-bottom)`; `100vh` alone не считается достаточным.

### Operational and accessibility states

- Loading не выглядит empty; stale payload остаётся видимым с inline warning.
- Distinct empty states: Coach no assigned lessons, global no lessons, selected
  day empty, filtered empty; recovery соответствует причине.
- Error retry не сбрасывает date/filter/draft.
- Duplicate submit предотвращён; success называет affected lesson/date/scope.
- Focus order: previous date -> date control -> next date -> Calendar tools
  trigger -> management create, if present -> lessons -> attendance primary ->
  contextual menu. Day/date strip поддерживает arrows/Home/End.
- Calendar tools Drawer/Menu имеет title, initial focus, close semantics и focus
  return. `Escape` закрывает desktop Menu/Drawer; mobile browser back или
  explicit close закрывает surface и возвращает focus на trigger. `Готово` и
  `Сбросить фильтры` не сбрасывают selected date.
- Drawer/Modal имеет title, initial focus, close semantics и focus return.
- Keyboard-open view сохраняет focused field, validation/warning и primary
  submit reachable within one intentional scroll.
- Long group/trainer/hall names, Russian text, 200% zoom и content wrapping не
  создают clipped actions.

## Safe decomposition

### Slice A — calendar core and projection

Deliverables:
- domain entities, pure recurrence/range/UUIDv5 policies;
- additive EF model/configurations and reproducible schema baseline;
- side-effect-free `/schedule/lessons` range query;
- role-scoped DTO with allowedActions placeholders from backend policy;
- domain, API, SQLite/InMemory compatibility and PostgreSQL constraint/read
  tests written red first.

Не менять attendance writes, web UI или bot в этой ветке.

### Slice B — mutations, cancellation, conflicts and audit

Deliverables:
- preview/execute application services and explicit endpoints;
- atomic group + required initial series preview/execute and generic group
  update without legacy schedule writes;
- three edit scopes, cancellation/restore matrix, warning algebra, opaque
  revision/confirmation-token concurrency;
- permissions, stable ProblemDetails/resources and audits;
- atomic/idempotent materialization for calendar mutations;
- red-first domain/API/PostgreSQL concurrency tests.

Не мигрировать attendance identity и не менять consumers.

### Slice C — attendance identity and data transition

Deliverables:
- nullable-to-required occurrence FK transition, migration report/resolution
  gate and final attendance unique identity;
- atomic first attendance materialization + attendance/membership/audit;
- occurrence-aware web/internal-bot backend endpoints;
- all backend readers/history/attention boundaries updated;
- clean/current-schema/PostgreSQL concurrency tests red first.

Не менять frontend/bot production code в этой ветке.

### Slice D — web calendar and attendance

Deliverables:
- typed API mappers and URL state;
- approved Schedule day/week UI, detail/mutation surfaces and responsive states;
- occurrence-aware Attendance route/workspace/client-return context;
- group create/edit schedule consumer aligned with canonical series contract;
- unit/component/Playwright/target-iPhone tests red before production code.

React implementation использует `react-specialist` и
`.agents/skills/react-best-practices/SKILL.md`; technical conflicts возвращаются
`ui-designer`, workflow не упрощается локально.

### Slice E — bot occurrence consumer

Deliverables:
- Pydantic models/client methods для lessons/occurrence id;
- dialog: date -> concrete lessons (group + time/cancelled marker) -> roster -> save;
- bot state/idempotency target uses occurrence id;
- no recurrence/cancellation/permission rules in Python;
- API client/service/callback regressions red first, затем `ruff`/`pytest`.

### Slice F — release regression and cleanup

Deliverables:
- cross-layer capability/activation gate and coordinated stack smoke;
- report-zero/data integrity gate;
- old group/date attendance endpoints and weekly-template write fields absent
  from the coordinated activated release;
- one release bundle updates DB transition, backend, frontend and bot before
  attendance writes reopen; no partial production consumer state;
- complete backend/frontend/bot/runtime regression and post-implementation
  status audit TASK-075/TASK-112/TASK-117/TASK-118.

Status files related TASKs не меняются до green integrated result.

## Execution roles

For each child task:
1. Coordinating agent owns branch/worktree, dependencies, merge order, isolated
   Compose project, integrated verification and cleanup.
2. `test-automator` writes automated regression coverage before production
   code and records expected red evidence.
3. Backend slices use `dotnet-backend-specialist`; substantial xUnit work reads
   `.agents/skills/csharp-xunit/SKILL.md`.
4. Web slice uses the completed `ux-researcher -> ui-designer` handoff, then
   `react-specialist`; `test-automator` covers primary mobile workflow.
5. Bot slice uses `python-pro` and keeps Python as thin adapter.
6. `docker-expert` is involved only for actual runtime/container failure or
   required image/Compose change, not for ordinary feature design.

Specialists не создают/remove worktrees, не меняют чужие slices и не копируют
unmerged branches без explicit assignment.

## Test-first execution order

Каждый slice обязан повторить полный red-green цикл:

1. Выполнить workspace/dependency preflight и baseline focused tests.
2. Написать/обновить unit tests требуемого поведения до functional code.
3. Написать/обновить integration/contract tests до functional code.
4. Для D/E написать соответствующие UI/e2e или bot contract tests до
   production code.
5. Запустить новые tests и зафиксировать expected failure именно из-за
   отсутствующей функциональности; compile/setup failure не считается
   достаточным red evidence.
6. Реализовать минимальный slice contract.
7. Запустить те же focused tests green.
8. Запустить relevant full regression suite и runtime check.
9. Merge slice в `main`, повторить integration checks, затем только после push
   актуального `origin/main` создавать dependent branch.

Нельзя сначала написать entities/endpoints/UI, а tests добавить в финальной
validation phase.

## Preferred implementation strategy

1. Contract-first additive core, затем mutations, затем attendance transition.
2. Один canonical backend occurrence model; frontend и bot только consumers.
3. Side-effect-free read и materialization only on facts/exceptions/mutations.
4. Additive compatibility может существовать в merged code между slices, но
   промежуточные contracts не deploy в production. Slice F выпускает DB,
   backend, frontend и bot одним bundle; dual write запрещён.
5. Small verifiable commits внутри каждой branch: red tests -> minimal code ->
   green -> regression evidence.
6. Backend/frontend/bot activation coordinated. После появления multiple
   same-day occurrences downgrade к old group/date writes небезопасен; rollback
   после activation — forward fix или restore verified pre-activation backup,
   не silent re-enable legacy endpoint.

## Files likely to change

### Backend domain/application
- new `backend/src/GymCrm.Domain/Scheduling/*`
- new `backend/src/GymCrm.Application/Scheduling/*`
- `backend/src/GymCrm.Domain/Groups/TrainingGroup.cs`
- `backend/src/GymCrm.Domain/Attendance/Attendance.cs`
- `backend/src/GymCrm.Application/Attendance/IAttendanceService.cs`
- `backend/src/GymCrm.Application/Attendance/AttendanceAuditContract.cs`

### Backend API/infrastructure
- `backend/src/GymCrm.Api/Auth/ScheduleEndpoints.cs`
- new focused schedule request/response/problem/resource files under
  `backend/src/GymCrm.Api/Auth/`
- `backend/src/GymCrm.Api/Auth/AttendanceEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/BotInternalEndpoints.cs`
- `backend/src/GymCrm.Infrastructure/Attendance/AttendanceService.cs`
- new `backend/src/GymCrm.Infrastructure/Scheduling/*`
- `backend/src/GymCrm.Infrastructure/Persistence/GymCrmDbContext.cs`
- new persistence configurations for series/rules/slots/occurrences/report
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/AttendanceConfiguration.cs`
- current initial/reproducible migration, forward transition migration and
  `GymCrmDbContextModelSnapshot.cs`
- seed/bootstrap data where schedule fixtures are created

### Backend tests
- new focused domain tests for recurrence, slot lineage, UUID and cancellation
- new `LessonCalendarApiTests.cs`
- new `LessonCalendarPostgreSqlTests.cs`
- new `LessonOccurrenceMigrationTests.cs`
- `backend/tests/GymCrm.Tests/AttendanceApiTests.cs`
- `backend/tests/GymCrm.Tests/GroupsApiTests.cs`
- `backend/tests/GymCrm.Tests/GroupTrainerSubstitutionsApiTests.cs`
- client history, audit, missed-training, bot internal and bootstrap smoke tests
  discovered by `GroupId`, `TrainingDate`, `Weekdays`, `TrainingStartTime`.

### Frontend
- `frontend/src/lib/api/endpoints.ts`
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/schedule.ts`
- `frontend/src/lib/api/attendance.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/appRoutes.ts` and route tests for occurrence detail
- `frontend/src/features/schedule/GroupScheduleScreen.tsx` split into focused
  calendar/date/list/mutation components rather than growing the current large
  file further
- `frontend/src/features/attendance/*`
- `frontend/src/features/groups/GroupManagement.tsx` and group API/form tests
- `frontend/src/features/clients/clientProfileReturnState.ts`
- `frontend/src/lib/groupSchedule.ts` only for reusable presentation math; no
  recurrence/domain decisions
- `frontend/src/App.tsx`, `frontend/src/App.css` and shared UI only where route,
  dynamic viewport or established tokens require it
- `frontend/e2e/group-schedule.spec.ts`
- `frontend/e2e/attendance.spec.ts`
- `frontend/e2e/iphone-target-devices.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`
- affected permission/history/touch/overflow specs.

### Bot
- `bot/src/gym_crm_bot/crm/models.py`
- `bot/src/gym_crm_bot/crm/client.py`
- `bot/src/gym_crm_bot/core/service.py`
- `bot/src/gym_crm_bot/telegram/keyboards.py`
- focused tests for models/client/service/callback/state/idempotency.

### Runtime/backlog
- deploy files only if schema migration/health activation genuinely requires a
  runtime change; otherwise validate existing Compose path without editing it
- related backlog task files only in final Slice F status audit.

Exact files are confirmed with `rg` inside each child worktree before editing.

## Constraints

- Backend owns recurrence, occurrence identity, cancellation state, permissions,
  warnings, validation, audit and migration semantics.
- Frontend/bot do not infer status, conflicts, allowed actions or recurrence.
- Dates/times are local `DateOnly`/`TimeOnly`; no timezone conversion is added.
- `EndsOn` inclusive, `null` indefinite, and never earlier than `StartsOn`.
- No unbounded pre-generation, read-side writes or mandatory background
  materializer.
- Several lessons per group/day are first-class and never collapsed by
  group/date keys.
- Time ranges занятий одной группы не пересекаются; exact duplicates также
  запрещены hard validation независимо от warning confirmation.
- Attendance marks are never automatically deleted by cancellation command.
- Existing access scope/permissions are reused; no RBAC redesign.
- Initial/forward schema paths must converge to the same final model.
- Every backend contract change updates web and bot consumers before activation.
- Keep React 19, TypeScript, Vite, Mantine, Onest and existing tokens; no new UI
  library/global state without demonstrated need.
- TASK-075/TASK-112/TASK-117/TASK-118 statuses remain unchanged until final
  integrated audit.

## Out of scope

- Drag-and-drop calendar.
- Google/Outlook integrations.
- Notifications for moves/cancellations.
- Billing/write-off policy for cancelled lessons.
- Hard-block or automatic resolution of trainer/hall/capacity conflicts.
- Monthly/arbitrary RRULE, holidays or timezone model.
- Broader TASK-103 landing/navigation redesign unless already merged.
- Unrelated group, membership, audit UI or routing refactor.

## Required test coverage

### Unit/domain tests
- inclusive series/version ranges, nullable end and version splitting;
- several slots/day, different times, duration and boundary weekdays;
- UUIDv5 culture/provider/timezone independence and projected/materialized
  equality plus lineage continuity across time/duration/hall/trainer edits;
- overlay of original/moved/current dates without duplicates;
- cancellation/restore matrix without `Held`/`NotHeld` and attendance conflict
  guard;
- edit scopes with factual occurrences preserved;
- conflict warning algebra for finite/indefinite weekly ranges;
- backend allowed-action policy for all four roles/access scopes, включая
  permanent Coach assignment и upcoming/active substitution by occurrence date.

### Backend integration/PostgreSQL
- bounded calendar query validation, exact raw JSON and stable ordering;
- no `SaveChanges`/row count change on calendar GET;
- projected -> concurrent first materialization produces one occurrence;
- opaque revision/confirmation token rejects any changed preview result;
- different-group trainer/hall warnings remain confirmable, while same-group
  overlap and exact duplicate are rejected;
- group create either commits group + initial series/slots/audits together or
  leaves no partial group, including stale preview and warning cases;
- permissions/ProblemDetails/audit for every mutation/cancellation path;
- attendance transaction materializes, marks and audits atomically without
  changing cancellation state;
- audit or membership failure rolls back the entire mutation;
- two same-group same-day occurrences keep independent rosters/marks;
- clean schema and current-schema forward migration converge;
- unambiguous backfill, ambiguous report, repair, rerun idempotency and
  unresolved activation block;
- final required FK and `(ClientId, LessonOccurrenceId)` uniqueness;
- client history, missed-training, substitutions and internal bot consumers.

### Frontend unit/component
- API mapping for projected/materialized/one-off/cancellation/actions/warnings/errors;
- API mapping for direct `hasAttendanceMarks` without completion inference;
- URL date/view/filter parse, normalization, reload/back/forward and retry;
- same-group same-day cards remain distinct and open exact occurrence;
- row action visibility/disabled reasons by backend allowedActions;
- mutation preview/confirm, preserved draft, stale preview and attendance
  conflict recovery;
- day/week navigation keyboard semantics and focus return;
- occurrence-aware attendance/client return context and malformed fail-closed;
- loading, stale, role-specific empty, filtered empty, error, permission and
  success states.

### UI/E2E
- Coach primary path in <=3 actions from Schedule to today attendance;
- Administrator/HeadCoach create one-off, move occurrence and edit series scope;
- `Cancelled` conflict keeps marks and form context;
- warning-only conflict confirms successfully after explicit acknowledgement;
- same-group overlapping or exact duplicate lesson is blocked without a
  confirm override;
- multiple same-day occurrences never share route/roster;
- selected date/filter survives retry and attendance round trip;
- compact Calendar tools surface exposes Today, day/week, refresh and filters
  in one interaction, preserves active-filter indication and returns focus;
- no horizontal page scroll, 44x44 targets, focus, Escape/back and safe-area
  behavior at `360 x 780`, `390 x 844`, `420 x 912`, `440 x 956`, `768 x
  1024`, `1440 x 1200`, `912 x 420`, `956 x 440`;
- affected target-iPhone scenarios use WebKit mobile emulation and touch.

### Bot tests
- date lists concrete lessons with time/cancelled marker and distinct occurrence ids;
- roster/save use occurrence id and idempotency target;
- same group twice per date selects correct lesson;
- access/ProblemDetails/retry mapping does not add domain rules;
- persisted draft/state resumes or fails closed after stale occurrence.

### Manual-only evidence
- physical Safari/iOS Simulator browser chrome and changing visual viewport;
- real safe-area/home indicator and software keyboard reachability;
- one-handed reach and readability with production-like long names.

Manual QA не заменяет automated barriers.

## Test plan

- [ ] Для каждого slice unit и integration tests написаны до production code.
- [ ] Для каждого slice зафиксирован expected red по отсутствующей функции.
- [ ] Focused tests green на той же assertion set после implementation.
- [ ] `dotnet test backend/GymCrm.slnx` проходит.
- [ ] PostgreSQL migration/concurrency suites проходят в isolated runtime.
- [ ] `cd frontend && npm run lint` проходит.
- [ ] `cd frontend && npm run build` проходит.
- [ ] `cd frontend && npm run test:unit` проходит.
- [ ] Affected Chromium Playwright specs проходят.
- [ ] `cd frontend && npm run test:e2e:iphone` проходит для affected scenarios.
- [ ] `cd bot && ruff check .` проходит.
- [ ] `cd bot && pytest` проходит.
- [ ] Isolated Compose smoke подтверждает schema, health, real API web/bot
  contracts и report-zero activation gate.
- [ ] Integrated `main` повторно проходит affected suites после каждого merge.
- [ ] Simulator/physical-device gaps явно перечислены.
- [ ] Related-task status audit выполнен только после integrated green result.

## Regression barriers

1. **Identity barrier:** domain/API/PostgreSQL tests доказывают одинаковый
   deterministic id до/после materialization и независимость двух занятий
   группы в день.
2. **Fact barrier:** attendance concurrency test доказывает одну atomic boundary
   occurrence + marks + membership + audit с rollback on failure, без скрытого
   изменения cancellation state.
3. **Migration barrier:** current-schema fixture даёт проверяемый report,
   запрещает activation при ambiguity и после repair достигает required FK без
   silent mapping.
4. **Consumer barrier:** frontend and bot contract tests принимают только
   occurrence-aware command identity; legacy group/date write routes отсутствуют
   в activated release.
5. **Workflow barrier:** Chromium + target-iPhone WebKit покрывают <=3 action
   primary path, warnings/conflict recovery, date preservation, touch/overflow
   and focus behavior.
6. **Release barrier:** DB transition, backend, web and bot artifacts
   активируются как одна contract version только после report-zero and
   integrated smoke; partial production deployment запрещён.

No implementation is complete without recorded red and green evidence for the
same focused assertions.

## Rollout and rollback

- Merge slices A–F может временно оставлять additive compatibility в `main`, но
  ни один промежуточный slice не выпускается в production отдельно.
- До activation собрать совместимый release bundle: DB transition, backend,
  frontend и bot из согласованных commits/artifacts.
- На pre-production выполнить dry-run current-schema transition, получить и
  разрешить migration report, проверить clean bootstrap отдельно.
- В activation window закрыть attendance writes, сохранить verified
  backup/snapshot и exact schema version, затем идемпотентно повторить migration
  для финальной delta.
- Writes открываются только когда unresolved = 0, required FK/index применены,
  все четыре части release развернуты и occurrence-aware health/read/write smoke
  green. Legacy group/date routes и weekly-template writes в release отсутствуют.
- До первой canonical write rollback восстанавливает backup и предыдущий полный
  release bundle. После occurrence-only facts safe rollback — forward fix или
  restore pre-activation backup с осознанной потерей новых writes; старые
  endpoints отдельно не включаются.

## Risks

- Incorrect Guid byte ordering даст разные ids у projection/materialization;
  pure vectors и PostgreSQL concurrency tests обязательны.
- Rule split может потерять moved exceptions или переписать facts; preview
  affected/skipped set и overlay tests защищают boundary.
- Calendar query может скрыто материализовать data или читать бесконечный
  range; read-only row-count and maximum-range tests обязательны.
- Backfill current group time в историю может создать ложный факт; автоматически
  связываются только доказуемые rows, остальные идут в report.
- Nullable transition слишком рано сделает legacy rows невидимыми; activation
  blocked until repair/final required FK.
- Existing attendance, client history, missed-training, substitutions and
  SingleVisit flows широко используют group/date; `rg` inventory и full backend
  suite нужны в C.
- Web route overlap with unmerged TASK-103 может вызвать navigation conflict;
  TASK-119 добавляет только occurrence detail и reuses merged route when present.
- TASK-117/TASK-118 implementation before TASK-119 would create overlapping
  schedule/snapshot sources; execution must re-audit current `origin/main`.
- Preview warning TOCTOU может разрешить unseen conflict; execute recomputes
  under concurrency boundary and rejects stale acknowledgement.
- Permanent compatibility fallback может снова сделать group/date source of
  truth; Slice F removes it.
- Large current `GroupScheduleScreen.tsx`/`AttendanceEndpoints.cs` can grow
  further; new behavior goes to focused feature/services/types, not one large
  file or broad unrelated refactor.

## Stop conditions

Stop and do not write/continue functional code if:
- child branch/worktree/base/dependency is ambiguous or contains unexplained
  changes;
- source task/plan/predecessor merge is absent from current `origin/main`;
- deterministic projected/materialized identity cannot be made provider- and
  culture-independent;
- calendar read requires write-side materialization or unbounded generation;
- occurrence access cannot reuse existing backend scope without RBAC redesign;
- current DB must be preserved but no forward migration/report/backup path is
  approved;
- ambiguous attendance rows would be guessed or hidden instead of reported;
- atomic occurrence + attendance + membership + audit boundary cannot be proven on
  PostgreSQL;
- API contract can only work through permanent dual source or frontend/bot
  domain inference;
- technical constraint materially conflicts with approved UX contract;
- scope expands into timezone, billing cancellation policy, notifications,
  arbitrary recurrence or production-destructive migration without rollback;
- a required child slice would have to import an unmerged TASK branch.

Do not stop merely because backend, frontend, bot and migration all change.
Это причина последовательной декомпозиции, а не отказа от planning.

## Ready for Codex execution

no — продуктовые решения закрыты и план implementation-ready на уровне
архитектуры, UX, tests и dependencies, но TASK-119 остаётся high-risk umbrella.
Перед кодом нужно создать/review отдельные child backlog tasks A–F, перевести
первый slice в implementation и выполнять их по одному через отдельные
branch/worktree с test-first и merge gates.
