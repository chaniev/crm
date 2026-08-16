# Implementation Plan: TASK-117 Поддержать разное время занятий группы по дням недели

## Source task
/backlog/risky/TASK-117-group-weekday-specific-start-times.md

Source task status remains `risky`. This plan is created for explicit
product/architecture review; TASK-117 is not moved into active implementation.

## Implementation branch
feature/TASK-117-group-weekday-specific-start-times

Branch and worktree rules:
- before any project-code change, read and use
  `.agents/skills/task-worktree/SKILL.md`;
- from the primary repository run `git fetch origin`, then create or safely
  resume the branch above in the registered sibling worktree
  `../crm-worktrees/TASK-117-group-weekday-specific-start-times`;
- create a new branch directly from current `origin/main`; do not base it on
  an unmerged schedule or backlog branch;
- keep the primary repository on `main` and do not change project code there;
- before editing, return the verified worktree path, active branch, base SHA,
  current SHA and clean/unexplained-change status;
- do not mix TASK-106, another schedule redesign, attendance-policy changes,
  unrelated refactoring or another backlog task into this branch;
- if runtime validation is needed, use a task-local Docker Compose project,
  unique verified ports and `BOT_ENABLED=false` unless bot runtime validation
  is explicitly required.

Planning evidence on 2026-08-16: the primary repository is on clean `main` at
`9cea2f2ffadc3a0057dfdafd51c8aa0bdb172f9c`, equal to local `origin/main`;
no local/remote TASK-117 branch and no target worktree path were found. The
executor must repeat the checks after `git fetch origin`; this planning snapshot
is not an execution base guarantee.

## Goal
Administrator or HeadCoach can create and edit one group with a common
duration and one local start time per selected ISO weekday. The same ordered
weekday/time pairs round-trip through persistence and every affected API,
frontend, attendance, audit and bot consumer, so `/schedule` renders, for
example, `Пн 18:00`, `Ср 18:00`, `Сб 10:00` for the same group.

## Current understanding
- `TrainingGroup` currently persists one `TimeOnly TrainingStartTime`, one
  `int[] Weekdays` and a shared `DurationMinutes`.
- `UpsertTrainingGroupRequest`, normalized validation, group details/list,
  audit state, attendance group responses, client group summaries,
  administrator attendance-scope options and internal bot contracts repeat
  that scalar-time/weekday-array shape.
- `/schedule/groups` reuses `TrainingGroupListQuery` and
  `TrainingGroupListItemMapper`; it does not own a separate scheduling model.
- `frontend/src/lib/groupSchedule.ts` expands every selected weekday from the
  same `group.trainingStartTime`, so its calendar occurrence model must change,
  not only the API type.
- The existing create/edit form presents one global time input plus a weekday
  checkbox group. Its preview separates `Старт`, `Дни` and `Длительность`, so
  it cannot show the required day/time pairing.
- Client, attendance and administrator-scope UI snippets use the same old
  fields. Python bot models and formatting also consume them.
- Client-attention missed-training ordering uses a group's mutable scalar time
  as a same-day ordering key and persists that resolved value in the existing
  acknowledgement boundary. The new model needs an explicit date-to-entry
  resolver; silently choosing an arbitrary entry is unsafe.
- Group create/update currently has no task-specific idempotency key, ETag or
  optimistic concurrency token. TASK-117 must not invent a new public
  concurrency contract, but child-entry replacement must remain atomic and
  must never produce a union/partial schedule under concurrent updates.
- The repository's early-stage database policy requires updating the
  reproducible initial schema, migration designers and model snapshot; a new
  incremental migration is forbidden unless the user later requests deployed
  database compatibility.
- UX research and UI-design handoff were completed at planning time. No WebKit
  device, Simulator or physical-iPhone validation was performed during
  planning; those remain implementation acceptance work.

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
- The same typed `GroupScheduleEntryResponse` shape is reused by group list,
  group details, `/schedule/groups`, attendance group/client summaries,
  administrator attendance-scope options and internal bot projections.
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
- Update `20260513165936_InitialCreate.cs`, its designer, the later migration
  designer if needed to keep the target model coherent, and
  `GymCrmDbContextModelSnapshot`. Do not create a third incremental migration.
- Recreate a clean PostgreSQL database and run the seeder as the schema
  regression check; production backfill is out of scope.

### Atomic update and current concurrency semantics

- A valid PUT replaces the schedule as one exact set in the same transaction
  as group scalar fields, trainer assignment changes and audit emission.
- Do not add ETags, expected-version request fields or a new public
  idempotency contract.
- On PostgreSQL, lock/reload the target group mutation aggregate before
  applying the child-entry diff so two overlapping writes cannot leave a
  merged or partial weekday set. The final committed resource must equal one
  complete submitted request; current last-completed-write behavior remains
  recognizable to callers.
- Use the repository's provider-capability pattern for in-memory/SQLite test
  hosts; do not issue PostgreSQL SQL against unsupported providers.
- Repeating the same valid payload must round-trip to the same resource shape,
  while current audit behavior remains unchanged; do not add silent audit
  suppression under the label of idempotency.

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
- This preserves the existing mutable-group-schedule limitation. If product
  review requires immutable historical session time, stop: adding an
  attendance/session snapshot is a separate model decision beyond TASK-117.
- Do not add attendance-day validation, session generation or exception-day
  semantics in this task.

## UX contract

- User: Administrator or HeadCoach with existing group-management permission.
  Coach/Trainer consumes the schedule read-only through authorized schedule and
  attendance surfaces.
- Primary path: open create/edit group, confirm branch/hall/type/name, set the
  common duration, select weekdays, enter one time for each selected weekday,
  save, then observe success and exact pairs after reload.
- Completion signal: notification plus list/details/schedule read model shows
  the exact ISO-ordered pairs returned by backend.
- Primary action: `Создать группу` / `Сохранить изменения`, visible and never
  hidden in overflow.
- Frequent controls: existing group fields, duration, weekday selectors,
  selected-day time inputs and trainer assignment.
- Secondary: cancel/back. Exceptional: existing active switch. No destructive
  warning is added when deselecting a weekday within this task.
- Failure recovery: retain every entered value on server/network error; show
  section or row ProblemDetails near the affected control; focus and scroll to
  the first invalid schedule control.
- Permission-restricted users do not receive disabled fake edit controls; they
  only see paired read-only values where already authorized.

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
- seven rows keep stable DOM/ISO order; selecting a weekday creates an empty
  time value and reveals/enables its adjacent `type="time"` input;
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

## Safe decomposition

TASK-117 remains one branch and one coordinated rollout, but execution is split
into verifiable phases:

1. Backend contract/validation red tests and schedule semantics unit tests.
2. Domain persistence, clean initial schema and atomic group aggregate update.
3. Backend read/audit/attendance/authorization/internal-bot consumer
   propagation.
4. Frontend typed contract, occurrence helpers and form red tests, then
   implementation against the planning-stage UI specification.
5. Python bot contract/formatting adaptation.
6. Focused green runs, full regressions, clean-DB/runtime smoke and device
   acceptance.

Do not deploy or merge a backend-only contract break while frontend/bot still
consume the legacy fields.

## Execution roles

1. `ux-researcher` planning contract: complete; primary task, recovery,
   mobile constraints and measurable outcomes are captured above.
2. `ui-designer` planning handoff: complete; component order, states,
   geometry, focus and responsive behavior are captured above.
3. Coordinating agent creates/verifies the dedicated worktree and owns the
   contract, integration order, schema/run-time checks and final acceptance.
4. `test-automator` writes backend raw-JSON/integration, frontend
   unit/component/Playwright and bot regression tests before behavioral code.
5. `dotnet-backend-specialist` implements backend/domain/persistence only after
   the red tests exist; when adding/substantially changing xUnit tests, the
   executor reads `.agents/skills/csharp-xunit/SKILL.md`.
6. `react-specialist` implements the reviewed React/Mantine contract only after
   frontend red tests exist and reads
   `.agents/skills/react-best-practices/SKILL.md`.
7. `python-pro` adapts the thin bot consumer without moving CRM validation into
   Python.

All specialists must work in the coordinator-delegated TASK-117 worktree,
must not create/remove worktrees, and must not revert another agent's edits.

## Execution steps

### Phase 0 — isolated workspace and baseline

1. Re-read root/backend/frontend/bot `AGENTS.md`, this plan,
   `task-worktree`, `crm-mobile-first-ui` and the applicable testing/
   implementation skills.
2. Fetch `origin`, create or safely resume the declared worktree/branch from
   `origin/main`, and report the verified execution identity before edits.
3. Inventory every active reference to `TrainingStartTime`, `Weekdays`,
   `trainingStartTime`, `weekdays`, `training_start_time` and bot `weekdays`.
   Classify domain, request, read model, attendance ordering, audit, seed,
   frontend display and test-fixture consumers.
4. Run and record focused baseline suites before changing assertions:
   group/schedule/attendance/client-attention/internal-bot backend tests;
   group form/schedule/frontend API unit tests and affected Playwright specs;
   bot contract/service tests. Separate pre-existing failures from TASK-117.

### Phase 1 — tests before functional code

5. Before changing backend behavior, add a focused raw-JSON HTTP suite named
   `GroupWeekdaySpecificScheduleApiTests` (or update the filter in this plan at
   the same time). It must compile against the old server and cover:
   - create `Пн 18:00`, `Ср 18:00`, `Сб 10:00`;
   - response/list/details/schedule ordering and reload;
   - update to a different exact set;
   - empty, duplicate, out-of-range and invalid-time ProblemDetails paths;
   - invalid create/update has no group/entry/audit partial write;
   - permission and CSRF behavior;
   - audit old/new ordered entries.
6. Run that focused suite on the old behavior and record executed/failed counts
   and assertion reasons. Expected HTTP/shape/atomicity assertion failures are
   the red phase; compile errors, host setup errors or unrelated baseline
   failures do not count.
7. Add only the compile scaffolding necessary for the remaining tests (record
   shapes/signatures with no successful mapping/persistence behavior), then
   write backend unit tests for raw validation/normalization and date-to-entry
   resolution before implementing them.
8. Before backend functional code, add persistence/integration regressions for
   composite uniqueness, weekday check, clean initial PostgreSQL creation,
   equal-time seed conversion, mixed-time seed, exact-set concurrent update and
   provider fallback behavior.
9. Before frontend functional code, update/add tests using only the new payload:
   API mapping, form selection/deselection/payload/edit reload, nested field
   errors/focus, state retention, paired formatter, calendar occurrences and
   mixed Saturday time. Do not make tests accept both old and new shapes.
10. Before bot functional code, update/add Pydantic/client/service tests for
    `scheduleEntries`, paired formatting and preservation of backend-provided
    order without Python validation.
11. Run all new focused unit/integration/component/bot tests and confirm they
    execute and fail for missing TASK-117 behavior. No behavioral production
    code starts until this evidence exists.

### Phase 2 — backend model, schema and write contract

12. Implement `TrainingGroupScheduleEntry`, its EF configuration/navigation and
    `DbSet`; remove the legacy scalar time/weekday array from the domain model.
13. Implement request/normalized/response schedule-entry records and one
    backend validator/normalizer that preserves raw indexes for errors, rejects
    duplicates before sorting and emits normalized `TimeOnly` entries.
14. Update group create/update to validate before mutation, build/replace the
    exact child set and serialize the replacement with the scoped
    transaction/lock strategy. Keep branch/hall/type/trainer validation,
    permissions, CSRF and current audit sequencing intact.
15. Update initial migration, designers and snapshot without adding an
    incremental migration. Update seeder/factories and prove clean PostgreSQL
    setup plus composite constraints.

### Phase 3 — backend read and behavioral consumers

16. Include/order schedule entries in group list/details loaders and mapper;
    use earliest start time only where a deterministic group-level sort
    tiebreaker is still needed.
17. Propagate the typed entries through `/schedule/groups`, attendance group and
    client summaries, client attendance history, administrator attendance
    grant options, audit state and application/internal bot contracts.
18. Update client-attention queries to load schedule entries and resolve the
    date-specific time through the planned pure resolver. Preserve existing
    acknowledgement idempotence and `MarkedAt` boundary protection; do not
    mutate historical attendance rows.
19. Update every backend test seed/entity initializer that directly sets the
    removed fields. Keep unrelated financial, membership and trainer
    substitution semantics unchanged.

### Phase 4 — frontend contract and UI

20. Replace frontend group/attendance/client/admin payload and view-model fields
    with a shared typed `GroupScheduleEntry`; update API mappers and payload
    builders without legacy fallback.
21. Refactor schedule helpers to create one occurrence per nested entry. Each
    calendar occurrence carries its own `startTime`; overlap layout, visible
    hour range, sorting, card key and time range use the occurrence, not a
    group-global field.
22. Replace the group form schedule controls according to the planning-stage UI
    specification. Implement stable ISO rows, paired summary, nested
    ProblemDetails mapping, first-invalid focus and retry state preservation.
23. Update group registry, client group snippets and administrator attendance
    scope descriptions to use the typed paired formatter. Preserve existing
    permissions and do not introduce editable schedule controls outside the
    group form.
24. Update `/schedule` desktop/mobile cards and tests so one group renders at
    its exact per-day times while preserving filters, loading/stale/error/empty
    states and TASK-106-independent current layout behavior from `origin/main`.

### Phase 5 — bot and synchronized cleanup

25. Replace Python `training_start_time`/`weekdays` fields with typed
    `schedule_entries`; format paired values such as
    `Пн 18:00, Ср 18:00, Сб 10:00 · 60 мин` in backend order. Do not validate,
    sort or infer weekdays in the bot.
26. Remove legacy request/response fields and stale fixtures across all layers.
    A final repository search may leave them only in historical backlog/docs
    that are intentionally not executable.

### Phase 6 — green regression and runtime acceptance

27. Re-run the identical focused backend, frontend and bot red suites until
    green without weakening assertions; record commands, executed counts and
    outcomes.
28. Run full required backend/frontend/bot regression commands.
29. In the isolated TASK-117 stack, recreate PostgreSQL from scratch, run seed,
    verify backend readiness and smoke the synchronized frontend contract.
30. Execute the primary create/edit/reload/schedule flow in WebKit mobile
    emulation at `390 x 844`, `420 x 912`, `440 x 956`, plus `360 x 780`,
    `768 x 1024`, `1440 x 1200` and compact-height `912 x 420`/`956 x 440`.
    Verify one validation recovery and one permission-restricted read-only path.
31. Report Safari Responsive Design Mode, iOS Simulator, physical-device,
    software-keyboard, browser-chrome, safe-area/home-indicator checks that
    remain unverified; do not claim physical-iPhone acceptance without that
    evidence.

## Preferred implementation strategy

1. Raw executable contract tests before DTO/domain behavior.
2. One normalized backend schedule model and one ordered response type.
3. Exact-set transactional persistence before consumer propagation.
4. Backend read/audit/attendance/bot contracts before frontend integration.
5. Occurrence-based frontend mapping before form and calendar rendering.
6. Planning-stage mobile form behavior with no parallel legacy UI.
7. Synchronized breaking rollout and small, independently verifiable commits.

Avoid a compatibility layer that preserves two schedule sources. Backend,
frontend and bot may be implemented in phases but must merge/deploy as one
coherent contract change.

## Files likely to change

Backend domain/persistence:
- `backend/src/GymCrm.Domain/Groups/TrainingGroup.cs`
- `backend/src/GymCrm.Domain/Groups/TrainingGroupScheduleEntry.cs` (new)
- `backend/src/GymCrm.Infrastructure/Persistence/GymCrmDbContext.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/TrainingGroupConfiguration.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/TrainingGroupScheduleEntryConfiguration.cs` (new)
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.Designer.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260721210111_FixClientMembershipVersionConstraints.Designer.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/GymCrmDbContextModelSnapshot.cs`
- `backend/src/GymCrm.Api/SeedData/TestDataSeeder.cs`

Backend write/read contracts and consumers:
- `backend/src/GymCrm.Api/Auth/GroupScheduleEntryRequest.cs` (new)
- `backend/src/GymCrm.Api/Auth/GroupScheduleEntryResponse.cs` (new)
- `backend/src/GymCrm.Api/Auth/UpsertTrainingGroupRequest.cs`
- `backend/src/GymCrm.Api/Auth/NormalizedGroupRequest.cs`
- `backend/src/GymCrm.Api/Auth/GroupRequestValidator.cs`
- `backend/src/GymCrm.Api/Auth/GroupApiConstants.cs`
- `backend/src/GymCrm.Api/Auth/GroupResources.cs`
- `backend/src/GymCrm.Api/Auth/Resources/GroupResources.resx`
- `backend/src/GymCrm.Api/Auth/GroupEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/GroupDetailsResponse.cs`
- `backend/src/GymCrm.Api/Auth/GroupListItemResponse.cs`
- `backend/src/GymCrm.Api/Auth/TrainingGroupListItemMapper.cs`
- `backend/src/GymCrm.Api/Auth/TrainingGroupListQuery.cs`
- `backend/src/GymCrm.Api/Auth/TrainingGroupAuditState.cs`
- `backend/src/GymCrm.Api/Auth/AttendanceEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/AttendanceGroupResponse.cs`
- `backend/src/GymCrm.Api/Auth/ClientGroupSummaryResponse.cs`
- `backend/src/GymCrm.Api/Auth/ClientAttendanceHistoryEntryResponse.cs`
- `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/ClientAttentionEndpoints.cs`
- `backend/src/GymCrm.Application/Authorization/AdministratorAttendanceGroupGrantContracts.cs`
- `backend/src/GymCrm.Infrastructure/Authorization/AdministratorAttendanceGroupGrantService.cs`
- `backend/src/GymCrm.Application/Bot/BotApiContracts.cs`
- `backend/src/GymCrm.Infrastructure/Bot/BotApiService.cs`
- focused date-to-schedule resolver under `backend/src/GymCrm.Application/Attendance/` or `backend/src/GymCrm.Domain/Groups/` (new; placement must respect dependencies)

Backend tests:
- `backend/tests/GymCrm.Tests/GroupWeekdaySpecificScheduleApiTests.cs` (new, preferred)
- `backend/tests/GymCrm.Tests/GroupScheduleValidationTests.cs` (new, preferred)
- `backend/tests/GymCrm.Tests/GroupSchedulePersistencePostgreSqlTests.cs` (new, preferred)
- `backend/tests/GymCrm.Tests/GroupsApiTests.cs`
- `backend/tests/GymCrm.Tests/AttendanceApiTests.cs`
- `backend/tests/GymCrm.Tests/ClientsApiTests.cs`
- `backend/tests/GymCrm.Tests/AdministratorAttendanceGrantApiTests.cs`
- `backend/tests/GymCrm.Tests/AdministratorAttendanceGrantPostgreSqlTests.cs`
- `backend/tests/GymCrm.Tests/InternalBotApiTests.cs`
- `backend/tests/GymCrm.Tests/MissedTrainingStreakCalculatorTests.cs`
- `backend/tests/GymCrm.Tests/TestDataSeederTests.cs`
- other entity-initializer fixtures found by the mandatory source audit

Frontend production and tests:
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/groups.ts`
- `frontend/src/lib/api/groups.test.ts`
- `frontend/src/lib/api/schedule.ts`
- `frontend/src/lib/api/attendance.ts`
- `frontend/src/lib/api/attendance.test.ts`
- `frontend/src/lib/api/administrators.ts`
- `frontend/src/lib/api/administrators.test.ts`
- `frontend/src/lib/api/mappers.ts`
- `frontend/src/lib/groupSchedule.ts`
- `frontend/src/lib/groupSchedule.test.ts`
- `frontend/src/features/groups/GroupManagement.tsx`
- `frontend/src/features/groups/GroupManagement.test.tsx`
- `frontend/src/features/schedule/GroupScheduleScreen.tsx`
- `frontend/src/features/schedule/GroupScheduleScreen.test.tsx`
- `frontend/src/features/clients/ClientManagement.tsx`
- `frontend/src/features/settings/AdministratorAttendanceScopeModal.tsx`
- `frontend/src/features/settings/SettingsScreen.test.tsx`
- `frontend/src/App.css`
- `frontend/e2e/group-schedule.spec.ts`
- `frontend/e2e/groups-registry.spec.ts`
- `frontend/e2e/attendance.spec.ts`
- `frontend/e2e/administrator-attendance-scope.spec.ts`
- `frontend/e2e/iphone-target-devices.spec.ts`
- affected shared mock fixtures discovered by the source audit

Bot production and tests:
- `bot/src/gym_crm_bot/crm/models.py`
- `bot/src/gym_crm_bot/core/service.py`
- `bot/tests/test_crm_client.py`
- `bot/tests/test_bot_service.py`

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
- Do not introduce a second schedule source, synthetic display-only weekday
  list or group-global fallback field.
- Use Mantine, Onest and existing design tokens/shared wrappers only.
- Every mobile interactive target is at least `44 x 44px`; no horizontal page
  scrolling or nested schedule scroller.
- Project code changes occur only in the declared TASK-117 worktree.

## Out of scope
- More than one class/session for a group on the same weekday.
- Per-weekday duration.
- Calendar exceptions, holidays, cancellations, reschedules or make-up
  sessions.
- Trainer substitution changes or editing from the schedule calendar.
- Hall conflict, capacity or conflict-resolution logic.
- Attendance-day eligibility changes or automatic attendance generation.
- Immutable historical session/start-time snapshots.
- New roles, permissions, access-scope behavior, ETags or public idempotency
  keys.
- Production data migration/backfill or compatibility with an already deployed
  database.
- General redesign of Groups, Schedule, Attendance or the navigation shell.
- Unrelated TASK-106 implementation or schedule-card readability changes.

## Required test coverage

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
  first-invalid focus and state retention.
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
- Two overlapping group updates finish with one exact submitted set and never
  a union/partial set or raw provider exception.
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

## Test plan
- [ ] Record clean baseline focused backend/frontend/bot results.
- [ ] Run red backend contract suite:
  `dotnet test backend/tests/GymCrm.Tests/GymCrm.Tests.csproj --filter "FullyQualifiedName~GroupWeekdaySpecificSchedule"`.
- [ ] Run red backend unit/persistence/consumer tests and record exact failing
  assertions; update this filter if the final class name differs.
- [ ] Run red frontend unit/component tests for API, group form and schedule
  helpers/screen.
- [ ] Run red bot CRM-client/service tests.
- [ ] After implementation, rerun the identical focused suites to green.
- [ ] Run `dotnet test backend/GymCrm.slnx`.
- [ ] From `frontend`, run `npm run lint`, `npm run build` and
  `npm run test:unit`.
- [ ] From `frontend`, run affected Playwright specs including
  `npm run test:e2e -- group-schedule.spec.ts groups-registry.spec.ts attendance.spec.ts administrator-attendance-scope.spec.ts`.
- [ ] From `frontend`, run `npm run test:e2e:iphone`.
- [ ] From `bot`, run `ruff check .` and `pytest`.
- [ ] Recreate the isolated PostgreSQL database, run seed and verify backend
  readiness/full-stack contract smoke.
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
- the declared branch/worktree is ambiguous, dirty with unexplained changes or
  not based on current `origin/main`;
- an external consumer or deployed database requires backward compatibility or
  production data preservation not captured here;
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
- a new incremental migration appears necessary for a deployed environment.

Do not stop merely because backend, frontend and bot all change. Their
synchronized update is expected for TASK-117.

## Ready for Codex execution
no — the source task remains high-risk and `Safe for Codex: no`. The plan is
implementation-ready for explicit product/architecture review, but active
execution requires user approval and movement from `/backlog/risky` into the
task implementation lifecycle.
