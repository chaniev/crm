# Implementation Plan: TASK-119 Полноценный календарь занятий

## Metadata
- source_task: /backlog/done/TASK-119-full-lesson-calendar.md
- branch: feature/TASK-119-full-lesson-calendar
- readiness: completed — phased gates and integrated release regression passed
- dependencies: if batched with TASK-115, integrate TASK-115 first; re-audit TASK-103/117/118 baseline before execution
- risk: high — occurrence identity, migration, attendance, UI and bot coordinated cutover
- confirmed_trainer_model: 2026-08-23 — schedule slots do not own trainers;
  permanent trainers belong to the group, and a substitute replaces one of
  them only on exact lesson occurrences with occurrence-scoped access

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
  - hall, необходимый для projection/conflict preview;
  - trainer assignment в slot отсутствует: постоянные тренеры принадлежат
    группе, а замены относятся к конкретным occurrences;
  - несколько slots одного weekday для одной группы разрешены только если их
    time ranges не пересекаются; одновременные или полностью одинаковые занятия
    одной группы запрещены hard validation.
- `LessonOccurrence`:
  - `Id`, required `GroupId`, local `LessonDate`, start, duration и hall;
  - nullable source series/rule/slot refs для standalone one-off;
  - immutable `ProjectedDate`/source identity для moved occurrence overlay;
  - status `Scheduled | Cancelled`;
  - source kind `Recurring | OneOff | LegacyAttendance`;
  - concurrency token, materialization/audit metadata и effective trainer
    snapshot для factual/materialized history.
- Постоянные тренеры остаются dated group assignments. Для projected occurrence
  backend получает base trainer set из assignments, чьи inclusive validity
  dates содержат `LessonDate`; current `GroupTrainers` не используется как
  historical shortcut.
- `LessonOccurrenceTrainerSubstitution`:
  - `Id`, required `LessonOccurrenceId`, `ReplacedTrainerId` и
    `SubstituteTrainerId`;
  - одна active замена конкретного permanent trainer внутри конкретного
    occurrence; replacement materializes projected occurrence с тем же id;
  - concurrency/audit metadata и nullable cancellation metadata;
  - unique active replacement per `(LessonOccurrenceId, ReplacedTrainerId)`;
  - substitute не становится permanent group trainer и не получает доступ к
    другим occurrences той же группы или даты.

Имена группы, type и branch могут читаться из текущей group identity, но
время/duration/hall принадлежат versioned slot или materialized occurrence.
Effective trainers вычисляет backend как permanent assignments на `LessonDate`
минус replaced trainers плюс active occurrence substitutions; factual
materialized occurrence сохраняет этот result как history. Frontend и bot не
восстанавливают trainers из current group state.

### Deterministic occurrence identity

- Для recurring projection использовать fixed RFC 4122 UUIDv5 namespace
  `a4b0c93e-e5d5-56ba-b9c1-236bd3254960` и canonical UTF-8 key
  `lesson-slot-lineage:{slotLineageId:D}:{date:yyyy-MM-dd}`.
- `SlotLineageId` сохраняется при изменении времени, duration или hall того же
  логического слота через `ThisAndFuture`/`EntireSeries`. Новый
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
- One-off occurrence получает server-generated random UUID. Legacy attendance
  backfill использует отдельный UUIDv5 namespace
  `51897eb3-fa5e-5206-89f6-a1cec037392e` и canonical key
  `legacy-attendance:{groupId:D}:{date:yyyy-MM-dd}`, чтобы не имитировать
  recurring origin, которого исторически нельзя доказать.
- Обязательные cross-runtime vectors:
  - recurring key
    `lesson-slot-lineage:11111111-1111-1111-1111-111111111111:2026-08-20`
    даёт `6ae07738-e4c4-5f0b-a8c3-24e2349f4e6e`;
  - legacy key
    `legacy-attendance:22222222-2222-2222-2222-222222222222:2026-08-20`
    даёт `a896ae57-b0cb-50de-a308-cb438fc57893`.
- Opaque `revision` — base64url SHA-256 digest canonical mutation state:
  occurrence/source ids, source rule/slot version, source/current date, start,
  duration, hall, dated permanent-assignment revision, active substitution ids,
  sorted effective trainer ids, cancellation state, materialized concurrency
  token и attendance-fact version. Presentation names и
  actor-specific allowed actions в digest не входят. Projected и materialized
  формы используют одну canonical serialization policy.
- Frontend/bot считают id opaque string и никогда не вычисляют его локально.

### Occurrence locator and bounded resolution

- `LessonOccurrenceId` остаётся единственной identity занятия. Companion
  `lessonDate` является недоверенным locator для bounded lookup, не частью
  identity и не заменой occurrence id в command/audit/attendance keys.
- Каждый occurrence-targeted detail, preview, execute и attendance request
  передаёт пару `lessonOccurrenceId + lessonDate`. Для HTTP endpoints
  `lessonOccurrenceId` остаётся route parameter, а `lessonDate=YYYY-MM-DD` —
  required query parameter. Calendar DTO возвращает canonical current
  `lessonDate`, и frontend/bot переносят её вместе с opaque id.
- Общий backend resolver сначала ищет materialized occurrence по id и проверяет,
  что locator равен его current `LessonDate`. Если строки нет, resolver
  загружает только доступные actor rule versions/slots, действующие в указанную
  дату, вычисляет projected ids ровно для этого дня и принимает только exact id
  match. Resolver не сканирует другие даты, не вызывает `SaveChanges` и не
  создаёт projection index/background materialization.
- Для moved occurrence caller использует current displayed `LessonDate`;
  immutable source/projected date остаётся backend state и не передаётся как
  locator. One-off и другие materialized occurrences используют ту же пару для
  единообразного deep-link/reload contract.
- Missing или malformed `lessonDate` возвращает field-level ValidationProblem.
  Well-formed date, на которой id не разрешается, не раскрывает данные другого
  scope и возвращает существующий occurrence not-found/forbidden contract.
- Preview token связывается также с normalized locator date. Execute повторно
  разрешает id/date внутри transaction; locator mismatch или изменившийся
  resolved target не выполняет mutation.

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
- Постоянно назначенный Coach видит occurrences своей группы во всём
  разрешённом calendar range.
- Неотменённая occurrence substitution даёт substitute Coach доступ только к
  exact `LessonOccurrenceId`, перечисленным в replacement command. Upcoming
  replacement occurrences видны заранее; после наступления их дат historical
  access к этим exact occurrences сохраняется. Другие занятия той же группы и
  даже другие same-day occurrences не становятся доступными. Cancelled
  substitution доступа не даёт.
- Calendar/detail и attendance roster для доступного будущего occurrence можно
  открыть read-only. Attendance mutation для Coach разрешена только на business
  today и два предыдущих calendar days; management сохраняет текущую policy —
  future writes запрещены, исторического нижнего ограничения нет.
- Backend возвращает отдельные `canViewAttendance` и `canEditAttendance` с
  stable reason codes. Доступ вычисляется относительно `LessonDate`, а не только
  текущей даты запроса.
- Frontend и bot не выводят доступ из current permanent/substitute trainer
  lists; они используют только backend `allowedActions` и 403 ProblemDetails.

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
boolean/reason codes для view/edit attendance, edit, move, cancel, restore,
assign trainer substitution и cancel trainer substitution. UI не выводит
permissions, effective trainers или cancellation state из role/date/attendance
rows самостоятельно.

Если `Present`/`Absent` уже существуют, переход в `Cancelled` возвращает stable
409 conflict и не удаляет marks. Recovery ведёт к явному разрешению attendance
conflict; attendance change и последующая cancellation команда аудитируются
отдельно.

## API contract to lock with red tests

### Calendar reads

- `GET /schedule/lessons?from=YYYY-MM-DD&to=YYYY-MM-DD` с optional
  `branchId`, `hallId`, `trainerId`, `groupId`, `groupTypeId`.
  `trainerId` фильтрует backend-computed effective trainers occurrence, поэтому
  replacement находится по substitute и не находится по replaced trainer.
- `GET /schedule/lessons/{lessonOccurrenceId}?lessonDate=YYYY-MM-DD` для
  detail/deep link и bounded resolution projected occurrence.
- Range response — typed envelope с normalized inclusive `from`/`to`, `items`,
  screen-level `capabilities` и access-scoped `filterOptions`. Capabilities как
  минимум содержат `canCreateOneOff` и nullable stable unavailable reason.
  Filter options для branch/hall/trainer/group/group type не выводятся из
  текущих items, поэтому остаются доступны при empty/filtered-empty результате;
  unauthorized values не возвращаются.
- Response item содержит:
  - `lessonOccurrenceId`, `sourceKind`, `isMaterialized`;
  - canonical current `lessonDate`, `startTime`, `durationMinutes` и computed
    `endTime`;
  - group id/name/type, branch, hall and backend-computed effective trainer
    entries: trainer id/name, `Permanent | Substitute`, nullable
    `replacedTrainerId`/`substitutionId` and replacement marker;
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
  `DurationMinutes` и hall как редактируемый schedule template внутри обычного
  group update. Permanent trainer assignments остаются group-owned contract и
  никогда не копируются в editable schedule slots.
- Group create остаётся одной пользовательской операцией: request содержит
  group fields, required `initialLessonSeries` и preview `confirmationToken`.
  Backend создаёт группу, series, first rule version и slots одной transaction;
  ошибка расписания не оставляет группу без initial schedule.
- Group update управляет identity полями группы: name, type, branch, active
  state и другими non-schedule атрибутами. Изменение дней, времени, duration и
  hall выполняется только через lesson-series preview/execute.
- Permanent trainer assignment изменяется через
  `POST /groups/{groupId}/trainer-assignments/preview` и
  `POST /groups/{groupId}/trainer-assignments`. Dated preview/execute contract
  возвращает exact future occurrences и trainer-overlap warnings; удаление
  trainer не переписывает factual history. Series editor не содержит trainer
  fields.
- Замещающий тренер задаётся occurrence-aware substitution command: management
  выбирает permanent trainer, substitute и точный набор
  `lessonOccurrenceId + lessonDate`. Date range может быть только UI/query
  способом получить bounded candidate set; execute хранит exact occurrence
  replacements и не использует `(GroupId, date)` как identity.
- Legacy fields читает только transition runner для migration/report. Они не
  входят в activated group read/write contract и не используются production
  API как compatibility source.

### Series and lesson mutations

- `POST /groups/{groupId}/lesson-series/preview` и
  `POST /groups/{groupId}/lesson-series` для изменения существующей series;
  initial series новой группы создаётся только atomic group-create command.
- `POST /schedule/lessons/one-off/preview` и
  `POST /schedule/lessons/one-off` для standalone lesson.
- `POST /schedule/lessons/{id}/change/preview?lessonDate=YYYY-MM-DD` и
  `POST /schedule/lessons/{id}/change?lessonDate=YYYY-MM-DD` для edit/move с scope
  `Occurrence | ThisAndFuture | EntireSeries`.
- `POST /schedule/lessons/{id}/cancellation/preview?lessonDate=YYYY-MM-DD` и
  `POST /schedule/lessons/{id}/cancellation?lessonDate=YYYY-MM-DD` для
  cancel/restore между
  `Scheduled | Cancelled` в разрешённой matrix.
- `POST /schedule/lesson-trainer-substitutions/preview` и
  `POST /schedule/lesson-trainer-substitutions` принимают
  `replacedTrainerId`, `substituteTrainerId` и bounded exact target list из
  `lessonOccurrenceId`, `lessonDate`, `expectedRevision`; execute создаёт по
  одной audited replacement row на target occurrence.
- Cancellation существующей замены использует тот же preview/confirmation-token
  contract и exact occurrence/substitution ids; она не отменяет занятие и не
  меняет permanent group assignment.
- Preview request использует local dates/time и opaque `expectedRevision`.
  Preview response возвращает structured warnings, affected/skipped set и
  opaque `confirmationToken`, привязанный к actor, normalized command,
  occurrence/source revisions и точному preview result.
- Preview token хранится server-side, действует 15 минут, одноразовый и содержит
  actor id, normalized-command digest, target/source revisions, exact preview
  digest, created/expires/consumed timestamps. Execute атомарно проверяет и
  consume token вместе с mutation; expired, consumed или actor-mismatched token
  не выполняет команду: expired возвращает
  `lesson-mutation-preview-expired`, а consumed/actor-mismatched/unknown —
  `lesson-mutation-preview-invalid` без раскрытия чужого preview.
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
же effective trainer или hall. Effective trainer set строится из dated
permanent group assignments и exact occurrence substitutions; trainer из slot
не существует. Само совпадение времени у разных групп без общего effective
trainer или hall предупреждением не является.

Warnings не блокируют подтверждённое сохранение. Для бессрочной weekly series
conflict engine сравнивает weekday/time/range и dated permanent-assignment
periods алгебраически, а materialized exceptions/substitutions — по конкретным
датам; он не разворачивает бесконечный календарь. Назначение или отмена
substitute повторно проверяет trainer overlaps exact target occurrences.
Response ограничивает examples, но сообщает, если конфликт повторяется без
конечной даты.

Hard validation без confirmation:
- validation precedence сначала проверяет exact duplicate, затем более общий
  same-group overlap;
- `lesson-group-overlap` — у одной группы не может быть двух занятий с
  пересекающимися time ranges в одну дату/weekday независимо от hall/trainer;
- `lesson-duplicate` — полностью одинаковое занятие одной группы запрещено:
  совпадают one-off date либо recurring weekday/effective range, start,
  duration и hall. Permanent/substitute trainer state не создаёт отдельный
  schedule slot и не различает duplicate lessons.

Stable ProblemDetails минимум:
- `lesson-calendar-range-invalid` — invalid/oversized range;
- `lesson-occurrence-not-found`;
- `lesson-occurrence-forbidden`;
- `lesson-occurrence-concurrency-conflict`;
- `lesson-mutation-preview-invalid` — missing, consumed, actor-mismatched или
  otherwise unusable one-time token без раскрытия чужого preview;
- `lesson-mutation-preview-expired` — истёк 15-minute confirmation window;
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
- `GET /attendance/lessons/{lessonOccurrenceId}/clients?lessonDate=YYYY-MM-DD`;
- `POST /attendance/lessons/{lessonOccurrenceId}?lessonDate=YYYY-MM-DD`;

Canonical bot endpoints:
- `GET /internal/bot/attendance/lessons?trainingDate=YYYY-MM-DD`;
- `GET /internal/bot/attendance/lessons/{lessonOccurrenceId}/clients?lessonDate=YYYY-MM-DD`;
- `POST /internal/bot/attendance/lessons/{lessonOccurrenceId}?lessonDate=YYYY-MM-DD`.

Group/date остаются display fields в responses, но не command identity.
`lessonDate` в occurrence-targeted request используется только как проверяемый
bounded locator; attendance identity и mutation target остаются
`LessonOccurrenceId`.
GET roster разрешён для доступного будущего occurrence и возвращает
`canEditAttendance=false` с backend reason; POST применяет role/date mutation
window и не полагается на disabled state frontend.
Attendance save атомарно:
1. разрешает projected/materialized occurrence и actor access;
2. materializes projected occurrence с тем же id idempotently;
3. применяет marks и membership write-off/restore;
4. не меняет cancellation state; наличие marks видно через direct
   `hasAttendanceMarks`;
5. пишет occurrence, attendance и membership audits;
6. commits либо rolls back всю boundary.

Если у клиента `SingleVisit` уже использован другим occurrence, второй
`Present` остаётся допустимым attendance fact: mark сохраняется, дополнительное
списание или новая продажа автоматически не создаются, response возвращает
stable membership warning `single_visit_already_used`, а audit фиксирует
attendance без write-off. Последующее снятие исходной отметки не переносит
write-off на другой occurrence автоматически; такая корректировка остаётся
явной пользовательской операцией.

Unique attendance identity после cutover — `(ClientId, LessonOccurrenceId)`.

## Edit-scope semantics

### Occurrence
- Materialize selected projection с тем же id.
- Сохранить immutable source date/slot и записать overrides.
- Move подавляет source position и показывает occurrence на target date.
- Occurrence с attendance marks или status `Cancelled` является factual и не
  принимает change/move command. Attendance исправляется через attendance
  endpoint; `Cancelled` восстанавливается только explicit restore command, после
  чего снова применяются обычные mutation guards.

### ThisAndFuture
- Закрыть текущую immutable version на день перед target date.
- Создать новую version, начинающуюся target date, и новые slots.
- Scope начинается с выбранной target date и меняет projected schedule этого и
  последующих периодов.
- Не менять occurrences с attendance, cancellation state или любыми
  materialized manual overrides/moves: explicit exception всегда сильнее
  последующего series edit. Preview показывает их в skipped set.

### EntireSeries
- Scope начинается с `max(series.StartsOn, business today)` независимо от даты
  occurrence, из которого открыт editor, и меняет весь projected schedule всех
  slots от этой границы.
- Прошедшие даты не переписываются. Occurrences с attendance, cancellation state
  или materialized manual overrides/moves остаются immutable facts/exceptions;
  preview показывает skipped/affected counts.
- Создать replacement versions только для этого редактируемого future range.
- Нельзя выполнять unbounded row generation для бессрочной части.

Cancellation/restore всегда относится к одному конкретному occurrence и не
имеет series scope. Прекращение или изменение будущих занятий выполняется через
series editor (`EndsOn`, удаление/замена slots с `ThisAndFuture` или
`EntireSeries`), а не массовой установкой `Cancelled`.

Все три scope должны иметь domain tests на boundary dates, inclusive ends,
multiple slots/day, existing exceptions и attendance facts.

## Data transition and compatibility

Фаза C подготавливает многошаговую проверяемую transition из текущей модели:

1. Additive schema:
   - создать series/version/slot/occurrence tables и nullable
     `Attendance.LessonOccurrenceId`;
   - обновить reproducible initial migration/state и model snapshot;
   - из-за явного требования сохранить existing attendance подготовить
     отдельный forward migration/transition runner от текущей schema.
2. Recurring cutover:
   - для каждой existing group создать одну current series/rule version из
     legacy weekday/time/duration/hall с required operator parameter
     `--cutover-date YYYY-MM-DD`;
   - current и historical permanent trainer assignments остаются group-owned
     dated facts и не копируются в schedule slots;
   - записать cutover date и source schema/version в durable singleton migration
     run; rerun обязан использовать ту же дату, а другая дата завершает run
     stable mismatch error до изменения данных;
   - не проецировать этот current template назад как доказанную историю.
3. Existing substitution transition:
   - legacy group/date substitution разворачивается в exact occurrence
     replacements только если на каждом target occurrence однозначно определён
     один replaced permanent trainer;
   - при нескольких permanent trainers, нескольких same-day occurrences без
     доказанного target или отсутствующем assignment replacement не угадывается
     и попадает в durable migration report;
   - operator resolution выбирает exact occurrence ids, replaced trainer и
     substitute; каждая созданная replacement row аудитируется и повторный run
     идемпотентен.
4. Historical attendance backfill:
   - сгруппировать rows по `(GroupId, TrainingDate)`;
   - автоматически создать `LegacyAttendance` occurrence и связать rows только
     если legacy schedule даёт ровно один доказуемый slot для weekday;
   - zero/multiple match, missing group/slot или inconsistent payload записать
     в durable migration report без guessed binding.
5. Resolution gate:
   - durable report row содержит run id, group/date, bounded attendance row ids
     и count, reason code, resolution status/kind, target occurrence id,
     resolved by/at и operator comment;
   - maintenance CLI/command позволяет либо выбрать существующий occurrence,
     либо создать `LegacyAttendance` occurrence с явно введёнными date/start,
     duration, hall и доказанным effective trainer provenance: permanent
     assignments и, если применимо, occurrence substitutions. Operator
     передаёт exact subset
     attendance row ids; ambiguous group/date можно partition между несколькими
     occurrences, каждая row связывается ровно один раз, а report считается
     resolved только после mapping всех rows. Guessed/default-first mapping
     запрещён;
   - manual repair command/materialized mapping аудитируется и идемпотентно
     возвращает прежний result при повторе того же resolution;
   - activation запрещена, пока unresolved count не равен нулю.
6. Canonical cutover:
   - сделать occurrence FK required;
   - заменить unique index на `(ClientId, LessonOccurrenceId)`;
   - обновить client history, missed-training, membership write-off/restore,
     audit и all readers на occurrence join;
   - удалить `Attendance.GroupId/TrainingDate` как command source после
     verified migration; display values читаются из occurrence.
7. Coordinated activation в фазе F:
   - DB transition, backend, frontend и bot входят в один release и не
     разворачиваются в production частично;
   - legacy group/date attendance mutation endpoints и legacy weekly-template
     write fields отсутствуют в activated release;
   - maintenance gate закрывает attendance writes до migration/report-zero,
     deploy и occurrence-aware smoke; dual write/source не используется.

Clean database, current-schema forward migration, ambiguous report и
idempotent rerun/concurrent materialization тестируются отдельно на PostgreSQL.

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
   Previous/next меняют anchor на один день в `day` mode и ровно на семь дней в
   `week` mode с сохранением выбранного weekday; date picker выбирает anchor
   date, а week boundaries — ISO Monday–Sunday, содержащие anchor. `Сегодня` в
   week mode выбирает ISO week текущей даты и после render scroll/focus ведёт к
   today section без перекрытия browser chrome.
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
   Create visibility и filter choices берутся из response-level
   `capabilities/filterOptions`, поэтому management create остаётся доступным в
   global/filtered empty state, а frontend не выводит право из role/items.
6. Mobile default — selected-day task list, не сжатая desktop week grid.
7. Lesson row/card показывает time/group, `Cancelled` marker when applicable и
   attendance marks fact first, затем type/hall/branch и backend-computed
   effective trainers. Substitute показывается как явная `Замена`, а replaced
   permanent trainer не отображается как фактически ведущий это occurrence.
   Отдельный
   `Scheduled` badge не выводится. Несколько same-group lessons различаются
   временем и stable occurrence identity; technical UUID полностью не выводится.
8. `Посещаемость` — visible row primary action минимум 44px и никогда не
   находится в overflow.
9. Secondary row menu содержит только разрешённые edit/move/series и
   assign/cancel-substitution actions. Trainer replacement выбирает permanent
   trainer, substitute и exact occurrence; destructive lesson cancellation
   отделён и требует explicit confirmation; restore остаётся contextual
   recovery action.
10. Week mode на `360–768px` показывает семь последовательных вертикальных
    day sections Monday–Sunday без horizontal scroll. Section имеет semantic
    heading с weekday/date/lesson count, today marker when applicable и
    chronological lesson cards; empty day остаётся компактным named state,
    чтобы неделя сохраняла структуру. Body lesson card открывает occurrence
    detail, а отдельная видимая `Посещаемость` открывает exact roster.
11. На `1440px` week mode становится семиколонной week grid Monday–Sunday.
    Cards сохраняют те же visible facts, accessible names и отдельную primary
    attendance action; grid не меняет backend/query/URL state contract.

Selected `date`, `view=day|week` и filters сохраняются в URL/history. Calendar
feature обрабатывает reload/back/forward, retry и stale refresh без сброса к
today. Attendance detail использует canonical
`/attendance/{lessonOccurrenceId}?lessonDate=YYYY-MM-DD` и return URL/state на
selected calendar context. Если TASK-103 merged, detail включается в его section; иначе TASK-119
не меняет broader landing/nav model.

### Mutation surfaces

- Create one-off, edit/move occurrence и edit series используют отдельные
  routes с visible title и Mantine single-column form на mobile/tablet/desktop;
  calendar context передаётся return URL/state. Browser back или close при dirty
  draft требует explicit discard confirmation; successful save возвращает в
  сохранённый calendar date/view/filter context и фокусирует affected lesson.
- Canonical route patterns:
  - `/schedule/lessons/new`;
  - `/schedule/lessons/{lessonOccurrenceId}?lessonDate=YYYY-MM-DD` для detail;
  - `/schedule/lessons/{lessonOccurrenceId}/edit?lessonDate=YYYY-MM-DD&scope=occurrence`;
  - `/schedule/lessons/{lessonOccurrenceId}/move?lessonDate=YYYY-MM-DD`;
  - `/schedule/series/{lessonSeriesId}/edit?scope=this-and-future|entire`.
  Return context хранится typed history state/validated return parameter по
  текущему router pattern и fails closed при malformed external value.
- Cancellation и restore используют короткий explicit confirmation Modal с
  date/time/group и последствием; это не nested modal и не full form route.
- Series edit обязательно показывает scope `Только это`, `Это и будущие`,
  `Вся серия` с persistent label и backend preview affected/skipped counts.
- Series/occurrence schedule forms не содержат arbitrary trainer selector.
  Permanent trainers редактируются в group assignment surface, а замена — в
  occurrence substitution surface с именами permanent/substitute trainer,
  exact lesson date/time и backend preview conflicts.
- Preview вызывается до execute. Trainer/hall warnings показываются рядом
  с confirmation action, остаются non-blocking для разрешённых resource
  overlaps и требуют explicit confirm. Same-group overlap и duplicate не
  являются warnings; это hard validation.
- При preview stale или recoverable API error entered values, selected scope и
  focus context сохраняются.
- Попытка отменить `Scheduled` occurrence с attendance marks открывает recovery
  surface с понятной причиной и ссылкой в occurrence attendance; marks не
  очищаются автоматически.
- Закрытие Menu/Drawer/Modal возвращает focus trigger; Escape закрывает desktop
  temporary surface, mobile back/explicit close не теряет draft без confirm.

### Attendance detail

- Header/context: date, time, group, hall/branch, effective trainers с явным
  replacement marker, `Cancelled` marker
  when applicable и direct indication наличия marks; не показывать generic
  `Scheduled`, technical series/rule или производный completion status.
- Roster/save state остаётся row-local и получает occurrence id from route и
  canonical `lessonDate` locator from validated route query.
- Future attendance route показывает roster read-only и disabled edit controls
  с backend reason. Permission-restricted attendance action остаётся visible
  disabled только если отсутствие создало бы ложное ощущение исчезнувшей primary
  operation; unauthorized occurrence data не раскрывается.
- Back возвращает selected schedule date/view/filter. Client profile return
  state меняет canonical identity с group/date на occurrence id и fails closed
  для stale/malformed history.

### Responsive behavior

- `360 x 780`: content width assumes 16px side padding (`328px`). Management
  toolbar fits as `[date group max 224px] 8 [tools 44] 8 [create 44]`; Coach
  toolbar fits as `[date group max 276px] 8 [tools 44]`. Date label truncates to
  short format such as `20 авг` before reducing touch targets. Filters, Today,
  day/week and refresh are inside Calendar tools Drawer. No horizontal page
  scroll. Week mode использует одну колонку из семи vertical day sections.
- `390 x 844`: stress baseline; content width assumes 16px side padding
  (`358px`). Management toolbar fits as `[date group max 254px] 8 [tools 44] 8
  [create 44]`; Coach toolbar fits as `[date group max 306px] 8 [tools 44]`.
  Primary attendance visible on every actionable row; no second action-only
  toolbar. Week sections используют normal page scroll; ни section, ни card не
  создаёт nested/horizontal scroll.
- `420 x 912`: content width assumes 16px side padding (`388px`). Management
  date group max `284px`; Coach date group max `336px`. Date label may use
  medium weekday/date format if it does not push tools/create below `44px`.
  Week mode остаётся той же одноколоночной hierarchy.
- `440 x 956`: content width assumes 16px side padding (`408px`). Management
  date group max `304px`; Coach date group max `356px`. Same hierarchy; more
  row metadata may remain visible before wrapping. Do not add decorative summary
  panels. Week mode остаётся одной колонкой; extra width отдаётся metadata wrap,
  а не второй day column.
- `768 x 1024`: toolbar may surface `Сегодня`, day/week switch, refresh and
  filters as separate controls if the row remains non-wrapping and primary row
  hierarchy stays stable. Week remains seven vertical chronological day
  sections in one content column; primary attendance stays visible and
  DOM/access names stable.
- `1440 x 1200`: toolbar surfaces date navigation, Today, day/week, refresh,
  filters and create as labeled controls where useful. Week uses seven columns
  Monday–Sunday; cards order by start time and expose detail plus visible
  attendance action. Do not return hero, aggregate widgets or duplicate heading
  only to use free width.
- `912 x 420` и `956 x 440`: compact shell; toolbar сохраняет reachable date
  navigation. Calendar tools opens a temporary surface with max-height based on
  `100dvh`/measured dynamic visible viewport, internal scroll only for the tools
  list, and sticky
  `Готово`/`Сбросить фильтры` footer respecting safe area. Forms use one
  intentional scroll and sticky footer without nested scrolling trap. Week mode
  stays vertical day sections in normal page scroll; it does not switch to a
  compressed seven-column grid.
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
  contextual menu. In week mode day headings/cards follow chronological DOM
  order; desktop grid does not implement a custom keyboard trap and its lesson
  actions remain reachable by ordinary Tab order.
- Calendar tools Drawer/Menu имеет title, initial focus, close semantics и focus
  return. `Escape` закрывает desktop Menu/Drawer; mobile browser back или
  explicit close закрывает surface и возвращает focus на trigger. `Готово` и
  `Сбросить фильтры` не сбрасывают selected date.
- Drawer/Modal имеет title, initial focus, close semantics и focus return.
- Week section headings are semantic headings, not tabs. Cancellation/restore
  Modal includes date, time, group and consequence; close returns focus to its
  trigger. Dirty mutation route back navigation requires discard confirmation.
- Keyboard-open view сохраняет focused field, validation/warning и primary
  submit reachable within one intentional scroll.
- Long group/trainer/hall names, Russian text, 200% zoom и content wrapping не
  создают clipped actions.

## Phased execution inside TASK-119

Этапы ниже являются внутренней декомпозицией одной implementation task. Они не
создают отдельные backlog tasks и интегрируются одним согласованным результатом.

### Phase A — calendar core and projection

Deliverables:
- domain entities, pure recurrence/range/UUIDv5 policies;
- dated permanent group-trainer projection and pure effective-trainer policy
  without slot-owned trainers;
- additive EF model/configurations and reproducible schema baseline;
- side-effect-free `/schedule/lessons` range query;
- shared bounded occurrence resolver для projected/materialized id + date без
  read-side writes или cross-date scan;
- role-scoped DTO with allowedActions placeholders from backend policy;
- domain, API, SQLite/InMemory compatibility and PostgreSQL constraint/read
  tests.

До green checkpoint A не менять attendance writes, web UI или bot.

### Phase B — mutations, cancellation, conflicts and audit

Deliverables:
- preview/execute application services and explicit endpoints;
- atomic group + required initial series preview/execute and generic group
  update without legacy schedule writes;
- permanent trainer assignment preview/execute and exact occurrence substitution
  preview/execute/cancellation with effective-trainer conflict checks;
- three edit scopes, cancellation/restore matrix, warning algebra, opaque
  revision/confirmation-token concurrency;
- permissions, stable ProblemDetails/resources and audits;
- atomic/idempotent materialization for calendar mutations;
- domain/API/PostgreSQL concurrency tests.

До green checkpoint B не мигрировать attendance identity и не менять consumers.

### Phase C — attendance identity and data transition

Deliverables:
- nullable-to-required occurrence FK transition, migration report/resolution
  gate and final attendance unique identity;
- legacy group/date substitution transition to exact occurrence replacements
  with ambiguity report/resolution;
- atomic first attendance materialization + attendance/membership/audit;
- occurrence-aware web/internal-bot backend endpoints;
- all backend readers/history/attention boundaries updated;
- clean/current-schema/PostgreSQL concurrency tests.

До green checkpoint C не менять frontend/bot production code.

### Phase D — web calendar and attendance

Deliverables:
- typed API mappers and URL state;
- approved Schedule day/week UI, detail/mutation surfaces and responsive states;
- occurrence-aware Attendance route/workspace/client-return context;
- group create/edit permanent-trainer consumer, occurrence substitution surface
  and schedule consumer aligned with canonical series contract;
- unit/component/Playwright/target-iPhone tests.

### Phase E — bot occurrence consumer

Deliverables:
- Pydantic models/client methods для lessons/occurrence id;
- dialog: date -> concrete lessons (group + time/effective trainer/cancelled
  marker) -> roster -> save;
- bot state/idempotency target uses occurrence id;
- no recurrence/cancellation/permission rules in Python;
- API client/service/callback regressions.

### Phase F — release regression and cleanup

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

## Likely files and layers
- Backend lesson series/rule/slot/occurrence domain, policies, endpoints, persistence/migrations and cross-layer tests.
- Occurrence-aware attendance, access, audit, reporting and internal-bot contracts.
- Frontend schedule/calendar, group schedule editing, attendance routes/workspace and responsive tests.
- Python bot occurrence flow/tests plus coordinated runtime, migration and activation assets.

## Constraints

- Backend owns recurrence, occurrence identity, cancellation state, permissions,
  warnings, validation, audit and migration semantics.
- Frontend/bot do not infer status, conflicts, allowed actions or recurrence.
- Dates/times are local `DateOnly`/`TimeOnly`; no timezone conversion is added.
- Coach future attendance is read-only; attendance writes preserve the explicit
  role/date policy and are revalidated inside the transaction.
- `EndsOn` inclusive, `null` indefinite, and never earlier than `StartsOn`.
- No unbounded pre-generation, read-side writes or mandatory background
  materializer.
- Several lessons per group/day are first-class and never collapsed by
  group/date keys.
- Occurrence-targeted reads/mutations carry `lessonOccurrenceId + lessonDate`;
  date is validated only as bounded locator and never replaces occurrence id as
  attendance, audit or mutation identity.
- Time ranges занятий одной группы не пересекаются; exact duplicates также
  запрещены hard validation независимо от warning confirmation.
- Attendance marks are never automatically deleted by cancellation command.
- Factual cancelled/attendance occurrences and materialized manual exceptions
  are not rewritten by series edits; cancellation/restore has occurrence scope
  only.
- Existing access scope/permissions are reused; no RBAC redesign.
- Schedule slots never own trainers. Permanent trainer assignments are
  group-owned dated facts; substitute access and display are limited to exact
  occurrence replacements and never widen to group/date scope.
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

## Regression specification

### Unit/domain tests
- inclusive series/version ranges, nullable end and version splitting;
- several slots/day, different times, duration and boundary weekdays;
- exact recurring/legacy UUIDv5 namespaces, canonical keys and fixed vectors;
  culture/provider/timezone independence, projected/materialized equality and
  lineage continuity across time/duration/hall edits;
- bounded resolver accepts projected id only on its locator date, resolves
  materialized/moved id only on current displayed date and never scans other
  dates;
- overlay of original/moved/current dates without duplicates;
- cancellation/restore matrix without `Held`/`NotHeld` and attendance conflict
  guard;
- edit scopes: `ThisAndFuture` from selected date, `EntireSeries` from
  `max(StartsOn, business today)`, factual/manual exceptions preserved and
  cancellation restricted to one occurrence;
- effective-trainer policy: dated permanent assignments, exact replacement,
  replacement cancellation, multiple permanent trainers and no same-day access
  leakage to a non-target occurrence;
- conflict warning algebra for finite/indefinite weekly ranges using permanent
  assignment periods and concrete substitution exceptions;
- backend allowed-action policy for all four roles/access scopes, включая
  permanent Coach assignment, upcoming/historical non-cancelled substitution
  on exact occurrence ids, future read-only roster and Coach today/minus-two
  write window.

### Backend integration/PostgreSQL
- bounded calendar query validation, exact raw JSON and stable ordering;
- projected detail/change/cancellation/attendance endpoints require a valid
  `lessonDate`, resolve the same external id without materializing on reads and
  reject missing, malformed or mismatched locators without cross-scope leakage;
- calendar envelope capabilities/filter options remain access-scoped and usable
  for global/filtered empty results;
- no `SaveChanges`/row count change on calendar GET;
- projected -> concurrent first materialization produces one occurrence;
- canonical revision changes on target mutation/attendance facts; one-time
  server-side confirmation token enforces actor binding, 15-minute expiry,
  atomic consumption and rejects changed preview result/replay;
- different-group trainer/hall warnings remain confirmable, while same-group
  overlap and exact duplicate are rejected;
- permanent trainer assignment preview reports affected occurrences/conflicts;
  exact substitution materializes targets idempotently, replaces only the
  selected trainer, changes effective-trainer filter/display and grants the
  substitute no access to another occurrence of the group or same date;
- group create either commits group + initial series/slots/audits together or
  leaves no partial group, including stale preview and warning cases;
- permissions/ProblemDetails/audit for every mutation/cancellation path;
- attendance transaction materializes, marks and audits atomically without
  changing cancellation state;
- audit or membership failure rolls back the entire mutation;
- two same-group same-day occurrences keep independent rosters/marks;
- second same-day `Present` with an already-used SingleVisit remains saved,
  creates no automatic sale/write-off, returns stable warning and does not
  auto-transfer provenance after the original mark is cleared;
- clean schema and current-schema forward migration converge;
- persisted cutover-date mismatch fails before writes; unambiguous backfill,
  durable ambiguous report, exact-row partition across existing/create-legacy
  manual repair, idempotent rerun and unresolved activation block;
- legacy group/date substitution auto-maps only with one provable replaced
  permanent trainer and exact targets; ambiguous trainer/occurrence mapping
  blocks activation until audited resolution;
- final required FK and `(ClientId, LessonOccurrenceId)` uniqueness;
- client history, missed-training, substitutions and internal bot consumers.

### Frontend unit/component
- API mapping for projected/materialized/one-off/cancellation/actions/warnings/errors;
- API mapping for direct `hasAttendanceMarks` without completion inference;
- API mapping for permanent/effective/substitute trainers without frontend
  derivation from current group assignments;
- URL date/view/filter parse, normalization, reload/back/forward and retry;
- occurrence detail/mutation/attendance routes round-trip opaque id together
  with canonical `lessonDate`; malformed or stale locator fails closed;
- same-group same-day cards remain distinct and open exact occurrence;
- row action visibility/disabled reasons by backend allowedActions;
- response-level create capability/filter options in empty results, future
  read-only attendance and exact upcoming/historical substitution visibility;
- mutation preview/confirm, preserved draft, stale preview and attendance
  conflict recovery;
- day arrows move one date, week arrows move seven dates; vertical week section
  order, desktop week-grid Tab semantics and route focus return;
- occurrence-aware attendance/client return context and malformed fail-closed;
- loading, stale, role-specific empty, filtered empty, error, permission and
  success states.

### UI/E2E
- Coach primary path in <=3 actions from Schedule to today attendance;
- Administrator/HeadCoach create one-off, move occurrence and edit series scope;
- Administrator/HeadCoach replaces one permanent trainer on exact selected
  occurrences; substitute sees upcoming/history only for those targets, card
  and trainer filter show effective trainer, and another same-day occurrence
  remains inaccessible;
- cancellation attempt for `Scheduled` occurrence with marks keeps marks and
  form/context;
- warning-only conflict confirms successfully after explicit acknowledgement;
- same-group overlapping or exact duplicate lesson is blocked without a
  confirm override;
- multiple same-day occurrences never share route/roster;
- selected date/filter survives retry and attendance round trip;
- mobile/tablet week renders seven vertical Monday–Sunday sections without
  horizontal/nested scroll; desktop week renders seven columns; card body opens
  detail and visible attendance action opens the exact roster;
- create/edit/move/series routes preserve/discard draft deliberately and return
  to the affected lesson; cancellation/restore confirmation is explicit;
- compact Calendar tools surface exposes Today, day/week, refresh and filters
  in one interaction, preserves active-filter indication and returns focus;
- no horizontal page scroll, 44x44 targets, focus, Escape/back and safe-area
  behavior at `360 x 780`, `390 x 844`, `420 x 912`, `440 x 956`, `768 x
  1024`, `1440 x 1200`, `912 x 420`, `956 x 440`;
- affected target-iPhone scenarios use WebKit mobile emulation and touch.

### Bot tests
- date lists concrete lessons with time/effective trainer/replacement marker,
  cancelled marker and distinct occurrence ids;
- roster/save carry canonical lesson date as bounded locator while occurrence id
  remains command/idempotency target;
- same group twice per date selects correct lesson;
- access/ProblemDetails/retry mapping does not add domain rules;
- persisted draft/state resumes or fails closed after stale occurrence.

### Manual-only evidence
- physical Safari/iOS Simulator browser chrome and changing visual viewport;
- real safe-area/home indicator and software keyboard reachability;
- one-handed reach and readability with production-like long names.

Manual QA не заменяет automated barriers.

### Validation and acceptance

- [x] PostgreSQL migration/concurrency suites проходят в isolated runtime.
- [x] Affected Chromium Playwright specs проходят.
- [x] `cd frontend && npm run test:e2e:iphone` проходит для affected scenarios.
- [x] Isolated Compose smoke подтверждает schema, health, real API web/bot
  contracts и report-zero activation gate.
- [x] Candidate SHA проходит полный integrated regression; после merge проверки
      повторяются только при изменении tree/conflicts, затем выполняется один
      aggregate release pass.
- [x] Simulator/physical-device gaps явно перечислены.
- [x] Related-task status audit выполнен только после integrated green result.

## Regression barriers

1. **Identity barrier:** domain/API/PostgreSQL tests доказывают одинаковый
   deterministic id до/после materialization, bounded id/date resolution без
   read-side write/cross-date scan и независимость двух занятий группы в день.
2. **Fact barrier:** attendance concurrency test доказывает одну atomic boundary
   occurrence + marks + membership + audit с rollback on failure, без скрытого
   изменения cancellation state.
3. **Migration barrier:** current-schema fixture даёт проверяемый report,
   запрещает activation при attendance или legacy-substitution ambiguity и
   после repair достигает required occurrence FK/exact replacement mapping без
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

Этот раздел применяется только при явно заданном deployment target.

- Phases A–F выполняются в одной task branch. Промежуточных merge в `main` нет;
  Phase F проверяет совместный результат, после полного green regression task
  branch один раз вливается в `main` и только затем готовится production release.
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
- UUIDv5 projected id нельзя обратить в source date/slot; потеря `lessonDate`
  в route, return state или bot callback сделает projected deep link
  неразрешимым. Typed route/callback models и bounded resolver tests обязательны.
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
- Если substitute access останется group/date-based, Coach увидит другое
  same-day occurrence или будущие занятия вне exact replacement. Access matrix,
  effective-trainer filter и migration tests должны доказывать occurrence-only
  scope.
- Web route overlap with unmerged TASK-103 может вызвать navigation conflict;
  TASK-119 добавляет только occurrence detail и reuses merged route when present.
- TASK-117/TASK-118 implementation before TASK-119 would create overlapping
  schedule/snapshot sources; execution must re-audit current `origin/main`.
- Preview warning TOCTOU может разрешить unseen conflict; execute recomputes
  under concurrency boundary and rejects stale acknowledgement.
- Permanent compatibility fallback может снова сделать group/date source of
  truth; Phase F removes it.
- Large current `GroupScheduleScreen.tsx`/`AttendanceEndpoints.cs` can grow
  further; new behavior goes to focused feature/services/types, not one large
  file or broad unrelated refactor.

## Stop conditions

Stop and do not write/continue functional code if:
- source task/plan is absent from current `origin/main`;
- deterministic projected/materialized identity cannot be made provider- and
  culture-independent;
- occurrence-targeted API требует ID-only поиска projected UUID через
  unbounded date scan, read-side materialization или постоянный projection
  index вместо bounded `lessonOccurrenceId + lessonDate` resolution;
- calendar read requires write-side materialization or unbounded generation;
- occurrence access cannot reuse existing backend scope without RBAC redesign;
- current DB must be preserved but no forward migration/report/backup path is
  approved;
- ambiguous attendance rows would be guessed or hidden instead of reported;
- legacy substitution требует угадать replaced trainer/target occurrence либо
  substitute access может быть реализован только через group/date scope вместо
  exact occurrence replacements;
- implementation снова вводит trainer set в schedule slot или выводит
  effective trainers из current group links без dated assignment/substitution
  policy;
- atomic occurrence + attendance + membership + audit boundary cannot be proven on
  PostgreSQL;
- API contract can only work through permanent dual source or frontend/bot
  domain inference;
- technical constraint materially conflicts with approved UX contract;
- scope expands into timezone, billing cancellation policy, notifications,
  arbitrary recurrence or production-destructive migration without rollback;
- выполнение любой фазы требует импортировать код из другой unmerged TASK
  branch.

Do not stop merely because backend, frontend, bot and migration all change.
Это причина последовательной декомпозиции, а не отказа от planning.

## Completion record

- Completed on: 2026-08-24.
- Verified implementation candidate: `5a5cabe` on
  `feature/TASK-119-full-lesson-calendar`.
- Phase gates A–E passed focused domain/API/PostgreSQL, frontend Chromium/WebKit
  and bot contract checks; Phase F passed the complete 512-test backend suite,
  568 frontend unit tests/build, 66/66 target-iPhone WebKit and 65/65 bot tests.
- Clean isolated Compose bootstrap applied all seven migrations; backend,
  frontend, bot and PostgreSQL were healthy. Transition run
  `c0d26679-8efa-4146-a740-28528c2d3b37` reported no items/unresolved rows and
  activation-check returned `canActivate: true`.
- NuGet vulnerability audit was clean; EF reported no pending model changes.
- TASK-075, TASK-112, TASK-117 and TASK-118 were moved to done as superseded by
  the implemented occurrence model. Physical iPhone/Safari chrome, real safe
  area and software keyboard remain manual-only evidence gaps.
