# Implementation Plan: TASK-117 Поддержать разное время занятий группы по дням недели

## Metadata
- source_task: /backlog/done/TASK-117-group-weekday-specific-start-times.md
- branch: feature/TASK-117-group-weekday-specific-start-times
- readiness: completed by superseding TASK-119 implementation; not executed independently
- dependencies: none
- risk: high — synchronized schedule schema/API/frontend/bot contract

## Goal
Administrator or HeadCoach can create and edit one group with a common
duration and one local start time per selected ISO weekday. The same ordered
weekday/time pairs round-trip through persistence and every affected API,
frontend, attendance, audit and bot consumer, so `/schedule` renders, for
example, `Пн 18:00`, `Ср 18:00`, `Сб 10:00` for the same group.

## Proposed implementation contract

This plan proposes one explicit contract so implementation does not stop on field
naming. Changing it requires updating this plan and all red tests together
before behavioral production code.

### Request and response shape

```json
{
  "name": "Старшая группа",
  "branchId": "...",
  "hallId": "...",
  "groupTypeId": "...",
  "durationMinutes": 60,
  "scheduleEntries": [
    { "weekday": 1, "startTime": "18:00" },
    { "weekday": 3, "startTime": "18:00" },
    { "weekday": 6, "startTime": "10:00" }
  ],
  "isActive": true,
  "trainerIds": []
}
```

- `durationMinutes` remains a required group-level value with current `1..180`
  semantics.
- `scheduleEntries` replaces top-level `trainingStartTime` and `weekdays` in
  group write/read contracts.
- Each entry has required ISO `weekday` `1..7` and local `startTime`.
- Input preserves the current accepted local-time compatibility (`HH:mm` and
  `HH:mm:ss`) but every response and audit state normalizes to `HH:mm`; there
  is no timezone conversion or `Date` parsing.
- Every response returns entries sorted by `weekday`; with one allowed entry
  per weekday, no second sort key is necessary.
- Group list, details, `/schedule/groups`, attendance group/client summaries,
  administrator attendance-scope options and internal bot projections use the
  same JSON entry schema `{ weekday, startTime }`. CLR/Python/TypeScript DTOs
  remain local to their owning layer and are mapped explicitly; Application or
  Domain must not depend on an API response type.
- Client attendance-history payloads that expose group schedule context use
  `groupScheduleEntries`; they do not retain the old scalar/array aliases.
- No synchronized consumer may keep or derive behavior from legacy top-level
  `trainingStartTime` or `weekdays`. There is no dual-write or hidden
  compatibility source of truth.

### Stable validation and ProblemDetails

- missing/null/empty collection: `errors.scheduleEntries`;
- invalid ISO weekday at request index `i`:
  `errors["scheduleEntries[i].weekday"]`;
- missing/invalid local time at request index `i`:
  `errors["scheduleEntries[i].startTime"]`;
- duplicate weekday: `errors.scheduleEntries`, with one stable localized
  duplicate-weekday message;
- current `durationMinutes` key and messages remain unchanged;
- validate the raw indexed collection before sorting; never deduplicate invalid
  input during normalization;
- perform all schedule, branch/hall, group-type and trainer validation before
  mutating a tracked group or its child entries;
- an invalid create/update writes no group/entry/audit data.

### Domain and persistence shape

- Add `TrainingGroupScheduleEntry` with `TrainingGroupId`, `Weekday`,
  `StartTime` and `TrainingGroup` navigation.
- Replace `TrainingGroup.TrainingStartTime` and `TrainingGroup.Weekdays` with
  `ICollection<TrainingGroupScheduleEntry> ScheduleEntries`; keep shared
  `DurationMinutes` on `TrainingGroup`.
- Map a `TrainingGroupScheduleEntries` table with composite primary key
  `(TrainingGroupId, Weekday)`, a weekday `1..7` check, required `time without
  time zone` start time and cascade delete from the group.
- The composite key enforces one entry per weekday. Application validation
  enforces a non-empty set and produces ProblemDetails before persistence;
  do not add a trigger solely to enforce child-count non-emptiness.
- Seed/test groups that previously used one time plus several weekdays create
  one child row per weekday with that same time. Add at least one mixed-time
  seed fixture to protect the new behavior.
- Always update `20260513165936_InitialCreate.cs`, its designer, the later
  migration designer needed to keep the target model coherent, and
  `GymCrmDbContextModelSnapshot` for reproducible clean creation.
- If implementation evidence shows that an existing target database must be
  preserved, also add a forward migration that creates and backfills
  `TrainingGroupScheduleEntries` with one child row for every legacy weekday
  using the legacy group time, verifies row counts/constraints, and only then
  removes the legacy columns. Do not infer distinct historical weekday times,
  because the old schema never stored them.
- Validate clean PostgreSQL creation in all cases. When the forward-migration
  path is required, additionally validate upgrade from the immediately
  preceding schema with representative equal-time data.

### Atomic group mutations and current concurrency semantics

- Group create, full group PUT and trainer-only PUT persist their state change
  and audit entry in one transaction. Audit failure rolls back the CRM state
  change; no successful group mutation may exist without its required audit.
- A valid full PUT replaces the schedule as one exact set in the same
  transaction as group scalar fields and trainer assignment changes.
- Do not add ETags, expected-version request fields or a new public
  idempotency contract.
- On PostgreSQL, use one shared group-mutation lock/reload strategy for both
  full group PUT and trainer-only PUT. Apply the child-entry/trainer diff only
  after the lock so overlapping writes cannot leave a merged or partial
  aggregate. The final committed resource must equal one complete submitted
  request; current last-completed-write behavior remains recognizable to
  callers.
- Use the repository's provider-capability pattern for in-memory/SQLite test
  hosts; do not issue PostgreSQL SQL against unsupported providers.
- Repeating the same valid payload must round-trip to the same resource shape.
  Preserve the current repeat-submit audit semantics: every accepted write
  emits its required audit entry inside the atomic transaction; do not add
  silent audit suppression under the label of idempotency.

### Attendance-derived time

- Add one backend-owned pure resolver for an attendance date:
  1. use the entry whose ISO weekday matches `TrainingDate`;
  2. if historical/off-schedule attendance has no matching entry, use the
     earliest configured start time as a deterministic compatibility fallback;
  3. never reject or rewrite existing attendance because a weekday was later
     removed.
- Use that resolver for client-attention ordering/acknowledgement boundaries
  and any date-specific attendance projection that needs a start time.
- Load the required schedule entries before in-memory resolution; do not rely
  on an unverified provider translation of `DateOnly.DayOfWeek`.
- This intentionally preserves the existing mutable-group-schedule limitation.
  Immutable historical session/start-time snapshots are tracked separately in
  `TASK-118-attendance-start-time-snapshots.md`; TASK-117 must not implement
  that follow-up or block on it.
- Do not add attendance-day validation, session generation or exception-day
  semantics in this task.

## UI specification

Keep the current create/edit shell and replace only the schedule portion of
`GroupForm`.

Content order:
1. existing form-level `Сохранение не выполнено` alert;
2. branch and hall;
3. group name and type;
4. shared `Длительность`;
5. semantic `Расписание` fieldset/group with ISO rows `Пн..Вс`;
6. trainers;
7. active switch;
8. existing summary surface with one paired `Расписание` value instead of
   separate `Старт`, `Дни`, `Длительность`;
9. cancel and visually dominant save action.

Schedule behavior:
- local form shape is
  `scheduleEntries: Array<{ weekday: string; startTime: string }>`;
- seven rows keep stable DOM/ISO order; selecting a weekday reveals/enables its
  adjacent `type="time"` input and copies the time from the nearest earlier
  selected ISO weekday with a non-empty value; if none exists, the new value is
  empty;
- copied values are independent after selection: later editing or deselecting
  the source weekday does not rewrite already selected weekdays;
- deselecting removes only that weekday entry from form state, summary and
  payload, without confirmation;
- request mapping converts weekday to number, trims time and sorts before
  sending; edit mapping restores exact returned pairs;
- row accessible names use full Russian weekday names; short labels may remain
  visible;
- one shared typed formatter renders, for example,
  `Пн 18:00, Ср 18:00, Сб 10:00 · 60 мин`; it never parses a display string;
- form preview shows all selected entries. Existing compact list surfaces may
  wrap, but must not hide a different time as if all days were equal.

Geometry and interaction:
- one-column schedule rows at `360`, `390 x 844`, `420 x 912` and
  `440 x 956`; no horizontal scrolling;
- mobile row minimum height `56px`, desktop/compact-height minimum `48px`;
- checkbox and time input targets are at least `44 x 44px`, separated by at
  least `8px`; input text is at least `16px` on iPhone;
- mobile time input minimum width `132px` (`124px` guardrail at `360px`),
  typical maximum `160px`; do not shrink the weekday label into wrapping;
- at `768` and `1440`, normal fields remain two-column while the schedule is
  one logical block; a two-column weekday layout is optional only if DOM order
  and target sizes remain correct;
- at `912 x 420` and `956 x 440`, use one page scroll without a nested
  schedule scroller; keep focused field, row error and save reachable;
- prefer normal document flow. If the existing action becomes sticky, combine
  normal spacing, bottom-navigation reservation and
  `env(safe-area-inset-bottom)`; do not rely on `100vh`.

Operational states:
- preserve existing create/edit loading and blocking load-error states;
- while submitting, prevent duplicate submit and keep schedule values visible;
- server/network error retains schedule, trainers and all other form state;
- empty schedule maps the backend section error and focuses the first weekday
  checkbox;
- time error focuses the indexed time input after `scrollIntoView`;
- success keeps current notifications and must be followed by exact persisted
  values on reload;
- long group names and paired schedules wrap without page overflow.

## Implementation sequence

### backend model, schema and write contract

13. Implement `TrainingGroupScheduleEntry`, its EF configuration/navigation and
    `DbSet`; remove the legacy scalar time/weekday array from the domain model.
14. Implement request/normalized/response schedule-entry records and one
    backend validator/normalizer that preserves raw indexes for errors, rejects
    duplicates before sorting and emits normalized `TimeOnly` entries.
15. Update group create, full update and trainer-only update to use atomic
    state-plus-audit transactions; both PUT paths use the shared scoped
    group-mutation lock/reload strategy. Build/replace the exact child set only
    after validation and lock. Keep branch/hall/type/trainer validation,
    permissions, CSRF and audit action semantics intact.
16. Update initial migration, required designers, snapshot, seeder and
    factories, then prove clean PostgreSQL setup plus composite constraints. If
    Phase 0 selected the forward-migration path, implement and verify the
    create/backfill/verify/drop sequence as well.

### backend read and behavioral consumers

17. Include/order schedule entries in group list/details loaders and mapper;
    use earliest start time only where a deterministic group-level sort
    tiebreaker is still needed.
18. Propagate layer-owned typed entries with the common JSON shape through
    `/schedule/groups`, attendance group and
    client summaries, client attendance history, administrator attendance
    grant options, audit state and application/internal bot contracts.
19. Update client-attention queries to load schedule entries and resolve the
    date-specific time through the planned pure resolver. Preserve existing
    acknowledgement idempotence and `MarkedAt` boundary protection; do not
    mutate historical attendance rows.
20. Update every backend test seed/entity initializer that directly sets the
    removed fields. Keep unrelated financial, membership and trainer
    substitution semantics unchanged.

### frontend contract and UI

21. Replace frontend group/attendance/client/admin payload and view-model fields
    with a shared typed `GroupScheduleEntry`; update API mappers and payload
    builders without legacy fallback.
22. Refactor schedule helpers to create one occurrence per nested entry. Each
    calendar occurrence carries its own `startTime`; overlap layout, visible
    hour range, sorting, card key and time range use the occurrence, not a
    group-global field.
23. Replace the group form schedule controls according to the planning-stage UI
    specification. Implement stable ISO rows, nearest-earlier-day copy on
    selection, independent copied values, paired summary, nested ProblemDetails
    mapping, first-invalid focus and retry state preservation.
24. Update group registry, client group snippets and administrator attendance
    scope descriptions to use the typed paired formatter. Preserve existing
    permissions and do not introduce editable schedule controls outside the
    group form.
25. Update `/schedule` desktop/mobile cards and tests so one group renders at
    its exact per-day times while preserving filters, loading/stale/error/empty
    states and TASK-106-independent current layout behavior from `origin/main`.

### bot and synchronized cleanup

26. Replace Python `training_start_time`/`weekdays` fields with typed
    `schedule_entries`; format paired values such as
    `Пн 18:00, Ср 18:00, Сб 10:00 · 60 мин` in backend order. Do not validate,
    sort or infer weekdays in the bot.
27. Remove legacy request/response fields and stale fixtures across all layers.
    A final repository search may leave them only in historical backlog/docs
    that are intentionally not executable.

## Likely files and layers
- Backend group schedule domain, requests/projections, EF schema/migration, audit/attendance/internal-bot consumers and tests.
- Frontend group form, schedule helpers/screen, typed API contracts and responsive tests.
- Python bot schedule models/rendering/tests and synchronized runtime fixtures.

## Constraints
- Backend is the only owner of ISO weekday uniqueness, time parsing,
  normalization, permissions, audit semantics and ProblemDetails.
- Frontend and bot consume typed entries; neither derives schedule from display
  strings nor reimplements backend validation.
- One group has exactly one configured start time per selected weekday and one
  shared duration.
- `startTime` is local wall-clock text normalized to `HH:mm`; no timezone or
  date conversion.
- Responses, audit and bot projections use deterministic ISO order.
- Invalid writes are atomic and create no partial child rows or audit events.
- Composite persistence cannot leave duplicate weekdays.
- Current group permissions, access scopes, CSRF behavior, trainer assignment,
  audit actions and endpoint routes remain unchanged.
- Existing attendance rows and historical financial data are not rewritten.
- Historical attendance time remains derived from the current group schedule
  with the documented earliest-time fallback; immutable snapshots belong to
  TASK-118.
- Do not introduce a second schedule source, synthetic display-only weekday
  list or group-global fallback field.
- Use Mantine, Onest and existing design tokens/shared wrappers only.
- Every mobile interactive target is at least `44 x 44px`; no horizontal page
  scrolling or nested schedule scroller.

## Out of scope
- More than one class/session for a group on the same weekday.
- Per-weekday duration.
- Calendar exceptions, holidays, cancellations, reschedules or make-up
  sessions.
- Trainer substitution changes or editing from the schedule calendar.
- Hall conflict, capacity or conflict-resolution logic.
- Attendance-day eligibility changes or automatic attendance generation.
- Immutable historical session/start-time snapshots; tracked by TASK-118.
- New roles, permissions, access-scope behavior, ETags or public idempotency
  keys.
- Recovery of distinct historical weekday times that were never stored by the
  legacy schema. A conditional structural forward migration/backfill of the
  legacy equal-time representation is in scope when Phase 0 proves it is
  required.
- General redesign of Groups, Schedule, Attendance or the navigation shell.
- Unrelated TASK-106 implementation or schedule-card readability changes.

## Regression specification

All unit and integration tests below are written or updated before behavioral
functional code. The initial red run must contain executed failing assertions
for absent TASK-117 behavior; compile/setup failures are not evidence.

### Unit tests
- Raw `scheduleEntries` validation: null, empty, invalid ISO bounds, duplicate
  weekdays and multiple simultaneous errors with stable field paths.
- Time parsing accepts current supported local formats and normalizes output to
  `HH:mm`; invalid/blank time retains request-index error identity.
- Normalization preserves all valid entries, sorts by ISO weekday and never
  hides duplicates before validation.
- Date resolver selects Monday/Wednesday/Saturday-specific times and uses the
  deterministic earliest-time fallback only when no matching weekday exists.
- Frontend API mapping and form payload mapping use only `scheduleEntries`.
- Frontend selection, deselection, edit hydration, nested error mapping,
  first-invalid focus and state retention; selecting a day copies from the
  nearest earlier selected non-empty ISO day, while copied values remain
  independent afterward.
- Paired formatter and calendar occurrence builder use the entry start time,
  preserve duration, sorting, visible range and overlap layout.
- Python models parse the new shape and formatter preserves backend order
  without local validation.

### Integration tests
- Create/update/get/list/reload round-trip for mixed weekday times and stable
  ISO order.
- `/schedule/groups` returns the same entries and frontend renders each
  occurrence on the correct day/time.
- Empty/duplicate/out-of-range/invalid-time failures return stable
  ProblemDetails and no partial group/entry/audit write.
- Persistence composite key and weekday check reject invalid direct writes;
  clean PostgreSQL schema and seeder are reproducible.
- Two overlapping full group updates, and one full update overlapping the
  trainer-only update, finish with one serialized aggregate state and never a
  union/partial set or raw provider exception.
- Create, full update and trainer-only update roll back their CRM state if
  required audit persistence fails.
- When Phase 0 selects the forward-migration path, upgrade from the preceding
  schema creates one child entry per legacy weekday using the legacy time,
  verifies the result and removes old columns without data loss.
- Audit create/update old/new states contain ordered entries and shared
  duration.
- Permissions and CSRF remain unchanged for Administrator, HeadCoach, Coach
  and anonymous callers.
- Attendance group/client summaries, client details/history, administrator
  attendance-scope response and internal bot response expose the new shape.
- Client-attention acknowledgement remains idempotent and date-specific mixed
  times do not reorder the wrong weekday; off-schedule fallback is stable.
- Equal-time schedules continue to display and behave as before after seed
  conversion.
- Existing membership/financial data and trainer assignments remain unchanged
  by schedule updates.

### UI and e2e tests
- Create and edit the sample schedule at `390 x 844`, then reload and verify
  exact pairs.
- Selecting Wednesday after Monday copies Monday's time; editing Wednesday
  afterward does not change Monday, and later Monday edits do not rewrite
  Wednesday.
- Deselecting Wednesday removes only Wednesday from state, preview and request.
- Server row error for Saturday displays under Saturday and receives focus;
  network/server retry retains all fields.
- `/schedule` shows the same group at `18:00` Monday/Wednesday and `10:00`
  Saturday on desktop and selected-day mobile layouts.
- Long group names and seven entries do not overflow at `360 x 780`,
  `390 x 844`, `420 x 912`, `440 x 956`, `768 x 1024`, `1440 x 1200`,
  `912 x 420` and `956 x 440`.
- WebKit mobile/touch coverage verifies `44px` targets, focus order, no
  horizontal page overflow and reachable error/save behavior.
- Coach/Trainer read-only schedule/attendance path contains no edit affordance.

### Manual-only validation
- Safari browser chrome, native iOS time picker/software keyboard, Dynamic
  Island/home indicator and one-handed reach require Simulator or physical
  device evidence.
- Manual QA may review Russian copy and wrapping, but it is not the regression
  barrier.

### Validation and acceptance
- [ ] Record clean baseline focused backend/frontend/bot results.
- [ ] Run red backend contract suite:
  `dotnet test backend/tests/GymCrm.Tests/GymCrm.Tests.csproj --filter "FullyQualifiedName~GroupWeekdaySpecificSchedule"`.
- [ ] Run red backend unit/persistence/consumer tests and record exact failing
  assertions; update this filter if the final class name differs.
- [ ] Run red frontend unit/component tests for API, group form and schedule
  helpers/screen.
- [ ] Run red bot CRM-client/service tests.
- [ ] After implementation, rerun the identical focused suites to green.
- [ ] From `frontend`, run affected Playwright specs including
  `npm run test:e2e -- group-schedule.spec.ts groups-registry.spec.ts attendance.spec.ts administrator-attendance-scope.spec.ts`.
- [ ] From `frontend`, run `npm run test:e2e:iphone`.
- [ ] Recreate the isolated PostgreSQL database, run seed and verify backend
  readiness/full-stack contract smoke; when Phase 0 selects the migration
  path, also run and verify the forward upgrade/backfill smoke.
- [ ] Search executable code/tests for legacy scalar schedule fields and
  classify every intentional historical occurrence.
- [ ] Report automated viewport/device evidence and all remaining physical
  Safari/iPhone checks.

## Regression barrier

The primary barrier is the raw-JSON backend contract suite plus PostgreSQL
exact-set/constraint coverage: it proves the new shape, ordered round-trip,
stable ProblemDetails and atomic persistence independently of CLR DTO
convenience. Frontend helper/component/Playwright tests prove that each nested
entry becomes the correct calendar occurrence and that the mobile form submits
and recovers correctly. Internal bot xUnit plus Python tests protect the
synchronized thin consumer. Full backend/frontend/bot suites, clean-DB startup
and a final legacy-field search prevent a partially migrated rollout.

No implementation is complete without recorded red and green evidence for the
same focused assertions.

## Risks
- A missed consumer can compile against or render the removed scalar fields,
  producing a partial contract rollout.
- Naive tracked-collection replacement can fail or merge under concurrent
  updates; exact-set PostgreSQL coverage and scoped serialization are required.
- Duplicate validation can be accidentally hidden if normalization deduplicates
  before checking raw input.
- Migration designer/snapshot drift can make clean database startup differ from
  the runtime model.
- A forward migration selected too late can leave the implementation tested
  only for clean creation; Phase 0 must settle and record the database lifecycle
  before schema code or red migration tests.
- Date-specific attendance ordering becomes ambiguous after a weekday is
  removed; the documented deterministic fallback is compatibility behavior,
  not an immutable historical schedule.
- Nested ProblemDetails indexes can point to the wrong UI row if frontend and
  backend sort at different stages; request order and ISO normalization must be
  tested end-to-end.
- Schedule helper refactoring can regress overlap layout, filters, mobile day
  selection or visible hour range even when simple cards look correct.
- TASK-106 or another unmerged schedule task may touch the same frontend files;
  TASK-117 must not depend on that branch and may require later integration
  conflict resolution after either task merges.
- Bot output can become verbose for seven entries; wrapping is acceptable, but
  truncation or re-grouping that hides distinct times is not.

## Stop conditions

Stop and do not write or continue functional code if:
- an external consumer requires a dual API contract or database preservation
  semantics beyond the equal-time forward migration captured here;
- product requires multiple sessions per weekday, per-day duration,
  exception-day scheduling or immutable historical session snapshots;
- safe exact-set concurrent replacement cannot be localized without a broader
  group-write concurrency redesign;
- the API cannot use the proposed `scheduleEntries[{weekday,startTime}]` shape
  without an architecture conflict;
- required attendance ordering cannot be preserved with the documented
  resolver and fallback;
- a frontend constraint conflicts materially with the reviewed UX/UI contract;
- changes expand into roles/permissions, financial semantics, attendance-day
  eligibility, hall conflict resolution or a general schedule redesign;
- a forward migration cannot safely backfill the legacy equal-time rows before
  dropping the old columns, or the target database contains incompatible
  schema/data not covered by the recorded preceding baseline.

Do not stop merely because backend, frontend and bot all change. Their
synchronized update is expected for TASK-117.
