# Implementation Plan: TASK-118 Зафиксировать историческое время занятия в посещении

## Source task
/backlog/risky/TASK-118-attendance-start-time-snapshots.md

Source task status remains `risky`. This plan is created for explicit
product/architecture review; TASK-118 is not moved into active implementation.

## Implementation branch
feature/TASK-118-attendance-start-time-snapshots

Branch and worktree rules:
- before any project-code change, read and use
  `.agents/skills/task-worktree/SKILL.md`;
- execute TASK-118 only after TASK-117 is merged into current `origin/main`;
- from the primary repository run `git fetch origin`, verify the TASK-117 merge
  commit is an ancestor of `origin/main`, then create or safely resume the
  branch above in the registered sibling worktree
  `../crm-worktrees/TASK-118-attendance-start-time-snapshots`;
- create the branch directly from that current `origin/main`; never base
  TASK-118 on an unmerged TASK-117 branch and never copy TASK-117 changes into
  this branch manually;
- keep the primary repository on `main` and do not change project code there;
- before editing, return the verified worktree path, active branch, base SHA,
  current SHA and clean/unexplained-change status;
- do not mix TASK-075 lesson state, attendance eligibility, permissions,
  membership/financial changes, schedule UI redesign or unrelated refactoring
  into this branch;
- if runtime validation is needed, use a task-local Docker Compose project,
  unique verified ports and `BOT_ENABLED=false` unless bot runtime validation
  is explicitly required.

Planning evidence on 2026-08-19: the primary repository is clean on local
`main` at `781aa86ed9a53b872716021413a6355c31c75ab3`, seven commits ahead of
local `origin/main` at `921e17340922ebdab701d76fa671387e57577115`; no local
TASK-118 branch or additional worktree exists. TASK-117 is planned but not
implemented. The executor must repeat all checks after `git fetch origin` and
must not use this planning snapshot as the execution base.

## Goal
When the first persisted `Present` or `Absent` mark creates the attendance
session for a group and training date, backend captures the authoritative local
start time once. Later schedule edits, weekday removal, attendance corrections,
web/bot retries and temporary absence of client rows do not change that time.
Client history, missed-training ordering and acknowledgement boundaries use the
captured value, so historical event order remains stable.

## Current understanding
- Current `Attendance` is one row per `(ClientId, GroupId, TrainingDate)` and
  contains state, single-visit lineage, actor and `MarkedAt`/`UpdatedAt`; it has
  no historical session-time field or separate session record.
- `AttendanceService.SaveAsync` is the single backend mutation boundary used by
  both the web endpoint and `BotApiService`. It owns the transaction, validates
  authorization, locks the group on PostgreSQL, applies tri-state changes,
  coordinates single-visit write-off/restore and writes mandatory audit.
- A repeated identical state is a no-op and preserves `MarkedAt`; `Unmarked`
  removes the attendance row. A row-only snapshot would therefore disappear
  when the last mark is reset and could be recaptured from a changed schedule.
- One training occurrence is currently identified by `(GroupId,
  TrainingDate)`. Several client attendance rows for that occurrence must not
  acquire different times when clients are marked in separate requests.
- Current client history orders by date, `UpdatedAt` and id, and reads the
  group's mutable time. The frontend then sorts again by date only. The internal
  bot client card also orders by date/`UpdatedAt` and omits time from its typed
  history item.
- `ClientAttentionEndpoints` orders the last event and creates
  `MissedTrainingAttendanceEvent` from the current group time. The persisted
  `ClientMissedTrainingAcknowledgement` already stores an immutable cutoff time,
  but that value is currently copied from the mutable group schedule.
- TASK-117 defines the prerequisite `scheduleEntries[{weekday,startTime}]`
  contract, a backend-owned date-to-entry resolver and the matching-weekday /
  earliest-time compatibility fallback. TASK-118 must reuse that resolver and
  must not create a second schedule rule.
- The repository is pre-production and `backend/AGENTS.md` requires reproducible
  clean schema changes in `InitialCreate` and the EF model snapshot. An
  incremental migration is not authorized unless the user explicitly requires
  preservation of an existing deployed database.
- Adding event time to the existing history rows is a local presentation and
  ordering correction, not a new screen or a substantial CRM workflow redesign.

## Proposed implementation contract

This plan fixes the persistence and read contract before execution. A change
from occurrence-level storage to a per-client-row snapshot, or a requirement to
preserve a live database, requires explicit review and corresponding red-test
updates before production code.

### Prerequisite contract from TASK-117

- TASK-117 must already be merged into `origin/main` with one authoritative
  backend resolver for `(TrainingDate, scheduleEntries)`.
- The resolver selects the exact ISO weekday entry; for historical/off-schedule
  dates without a matching entry it returns the earliest configured start time
  as the documented compatibility fallback.
- TASK-118 calls this resolver only when creating a previously absent session
  snapshot. It does not copy weekday matching or fallback logic into
  `AttendanceService`, endpoints, frontend or bot.
- If the merged TASK-117 contract uses different field names or resolver
  semantics, update this plan and its red assertions first. Do not maintain two
  competing schedule models.

### Minimal persistence model

Add a focused `AttendanceSessionStartTimeSnapshot` entity/table with:

```text
GroupId                    uuid     composite PK, FK to TrainingGroups
TrainingDate               date     composite PK
TrainingStartTime          time     required local wall-clock snapshot
```

- The composite key `(GroupId, TrainingDate)` represents exactly the current
  one-session-per-group-per-date attendance identity.
- `Attendance` keeps its existing client row and adds a required composite
  relationship to the snapshot through its existing `GroupId` and
  `TrainingDate`; it does not copy the same time into every client row.
- The foreign key and one snapshot row guarantee that web and bot writes, batch
  marks and later per-client marks for the same occurrence share one time.
- The snapshot has no `Held/NotHeld`, duration, hall, trainer, expected-client
  list, cancellation or generated-session state. It is not the generalized
  lesson lifecycle from TASK-075.
- The snapshot is created lazily only when a valid command will persist at least
  one new non-`Unmarked` attendance row and no snapshot exists yet. Opening a
  roster, sending an empty batch or sending `Unmarked` for a missing row creates
  nothing.
- The snapshot remains after every client mark for that group/date is reset to
  `Unmarked`. Recreating a mark later reuses the original time.
- Application code has no update path for `TrainingStartTime`. Schedule edits
  never traverse or rewrite snapshot rows.
- `TimeOnly` is stored as PostgreSQL `time without time zone`; JSON projection
  uses normalized `HH:mm`. No timezone, UTC conversion or JavaScript `Date`
  parsing is introduced.
- Group deletion remains restricted while historical attendance or session
  snapshots exist; TASK-118 does not change group archival/deletion semantics.

### Atomic capture and concurrency semantics

For every valid `SaveAttendanceCommand`:

1. preserve the existing date policy and authorization checks;
2. start the existing service-owned transaction and acquire the same group row
   lock used by TASK-117 group schedule mutations;
3. load an existing `(GroupId, TrainingDate)` snapshot after the lock;
4. only if the command will create a stored `Present`/`Absent` row and the
   snapshot is missing, load the locked group's schedule entries, resolve the
   date once through the TASK-117 resolver and add one snapshot;
5. associate all new attendance rows with that snapshot and apply the existing
   membership/audit work in the same transaction;
6. roll back the snapshot together with attendance, membership and audit if any
   required operation fails.

Additional rules:
- An existing snapshot always wins; current schedule is not consulted for
  re-marking, additional clients or recreation after `Unmarked`.
- `Present -> Absent`, `Absent -> Present`, same-state replay and bot
  idempotency replay never replace the snapshot.
- A batch containing several newly marked clients creates one snapshot.
- Concurrent first web/bot writes for the same group/date serialize on the
  group lock and converge on one snapshot without a unique-key exception.
- A concurrent schedule update and first attendance write use the common group
  lock. Whichever transaction acquires the lock first defines whether the old
  or new authoritative schedule is captured; the result is then immutable.
- Provider-capability handling remains explicit: PostgreSQL proves lock and
  uniqueness behavior; SQLite/InMemory test hosts must not execute Npgsql SQL.
- Existing no-op `MarkedAt` protection, membership lineage and mandatory audit
  semantics remain unchanged.

### Historical read and audit contract

- Add event-level `trainingStartTime: "HH:mm"` to web
  `ClientAttendanceHistoryEntryResponse` and internal bot
  `BotAttendanceHistoryItem`.
- `trainingStartTime` is the immutable occurrence snapshot. Any current
  `groupScheduleEntries` supplied after TASK-117 remains current group context
  and must not be used as the historical event time.
- Web and internal bot history queries order by `TrainingDate DESC`, snapshot
  `TrainingStartTime DESC`, then `Attendance.Id DESC`. `UpdatedAt` is not an
  event-order key, so correcting a mark does not move the historical occurrence.
- Frontend maps the typed field, displays date plus `HH:mm`, and uses the same
  date/time/id comparator if it locally sorts a received page.
- Python bot model parses the typed field and renders it in the existing client
  history line. The bot preserves backend order and does not resolve schedule
  entries itself.
- Attendance create/update audit old/new JSON includes normalized
  `trainingStartTime` from the session snapshot. A transition to `Unmarked`
  still records the session time even though the client attendance row is
  removed.
- No attendance write request accepts a client-provided start time. Existing
  web and internal bot roster/save routes, permissions, CSRF and bot
  idempotency keys remain unchanged.

### Client-attention and acknowledgement contract

- `MissedTrainingAttendanceEvent.TrainingStartTime` is populated only from the
  persisted session snapshot.
- Last-attendance selection for `Связались` orders by date, snapshot time and
  attendance id, never by current group schedule.
- `ClientMissedTrainingAcknowledgement.LastTrainingStartTime` remains the
  denormalized immutable boundary component and is copied from the selected
  event snapshot. Removing it is out of scope.
- Existing `MarkedAt <= AcknowledgedAt` protection and acknowledgement
  idempotency remain unchanged.
- Changing/removing a group schedule entry after acknowledgement cannot change
  event order, boundary comparison or the number of post-boundary absences.

### Clean-schema and legacy-data decision

- Under the current repository/runtime policy, implementation updates
  `20260513165936_InitialCreate.cs`, its designer, the latest required migration
  designer and `GymCrmDbContextModelSnapshot`; it does not create a new forward
  migration and performs no historical backfill.
- Seed data and every direct attendance fixture must create a matching session
  snapshot with an explicitly chosen local time.
- Phase 0 must reverify the database lifecycle. If any deployed database must
  be preserved, stop before schema or behavior code and obtain explicit user
  approval for a revised forward-migration contract.
- A legacy row has no trustworthy historical start time. A safe preservation
  design must either use an authoritative external source or add explicit
  provenance such as `Captured` versus `LegacyEstimated` and surface that
  distinction to consumers. Backfilling the current schedule and presenting it
  as factual captured history is forbidden.
- The conditional legacy path needs its own migration/upgrade tests and product
  copy; it is not silently included in the clean-schema implementation.

## Safe decomposition

TASK-118 remains one branch and one coordinated backend/consumer rollout, split
into verifiable phases:

1. Prerequisite/base and database-lifecycle verification.
2. Unit, raw-contract and PostgreSQL red tests for occurrence snapshot storage.
3. Domain/persistence schema and atomic capture in the shared attendance service.
4. History, audit, missed-training and acknowledgement propagation.
5. Small synchronized frontend and Python bot history adaptations.
6. Focused green runs, full regressions, clean PostgreSQL/runtime smoke and
   final mutable-schedule-source search.

Do not merge or deploy a backend history-contract change while frontend and bot
client-card consumers still ignore the new historical field.

## Execution roles

1. Coordinating agent creates/verifies the dedicated worktree, confirms the
   TASK-117/base and database lifecycle, owns the cross-layer contract and final
   acceptance.
2. `test-automator` writes backend unit/integration/PostgreSQL, frontend unit/
   component and bot contract/render regressions before behavioral code.
3. `dotnet-backend-specialist` implements domain, EF, service, history,
   attention and internal-bot changes only after red evidence exists; when
   creating or substantially changing xUnit tests, the executor reads
   `.agents/skills/csharp-xunit/SKILL.md`.
4. `react-specialist` performs only the typed client-history mapping, stable
   sorting and small display change, after reading
   `.agents/skills/react-best-practices/SKILL.md`. No screen redesign is planned.
5. `python-pro` adapts the thin bot history model/rendering without moving
   schedule or attendance rules into Python.

All specialists work only in the coordinator-delegated TASK-118 worktree, do
not create/remove worktrees and do not revert another agent's edits.

## Execution steps

### Phase 0 — isolated workspace, prerequisite and baseline

1. Re-read root/backend/frontend/bot `AGENTS.md`, this plan, TASK-117's merged
   plan/contract, `task-worktree`, `csharp-xunit` and applicable React testing
   guidance.
2. Fetch `origin`; prove TASK-117 is merged into current `origin/main`; create
   or safely resume the declared worktree/branch directly from that base and
   report execution identity before edits.
3. Inventory all executable reads of group schedule time from attendance,
   history, client attention, acknowledgement, audit and bot paths, plus every
   direct `Attendance` fixture. Classify each occurrence as mutable current
   schedule, future snapshot source or unrelated group display.
4. Verify from deployment/runtime evidence that target environments may still
   be recreated. Record `clean-schema only`; stop for explicit migration design
   approval if persistence of an applied database is required.
5. Run focused baseline suites for attendance service/API, client history,
   missed-training calculator/attention, internal bot API, frontend client API/
   card and Python bot client-card rendering. Separate pre-existing failures
   from TASK-118 evidence.

### Phase 1 — tests before functional code

6. Before domain/schema code, add focused model and initial-migration tests for
   `AttendanceSessionStartTimeSnapshot`: composite key, required local time,
   group FK, required Attendance composite FK, restrictive deletion and clean
   PostgreSQL creation.
7. Before service behavior, add `AttendanceStartTimeSnapshotApiTests` (or an
   equivalently focused suite) covering web first mark, several clients in one
   batch, later clients in another request, `Present/Absent` transitions,
   identical replay, `Unmarked`, recreation after reset, audit JSON and no-op
   `MarkedAt` preservation.
8. Add schedule-mutation regressions on the TASK-117 API: capture Monday time,
   edit that weekday's time, remove the weekday, then prove persistence,
   history JSON and audit retain the captured value. Cover the documented
   earliest-time fallback only at first capture for an off-schedule date.
9. Add real-PostgreSQL concurrency tests for two first attendance writes and
   for first attendance capture racing a group schedule update. Assert one
   snapshot, identical time for every row, no provider exception and a result
   matching one complete serialized transaction.
10. Add rollback regressions proving invalid client/date/state, authorization
    failure, mandatory audit failure and single-visit restore conflict leave no
    new snapshot; all-`Unmarked`/empty no-op requests also create none.
11. Before attention code, extend calculator/client-attention tests with two
    same-date groups at different captured times, acknowledgement, later
    schedule edits/removal and new post-boundary absences. Assert stable order,
    boundary and streak.
12. Before web consumer code, add raw client-history API tests for normalized
    `trainingStartTime`, date/time/id order, paging stability, role/group scope
    and schedule changes. Add frontend mapper/comparator/component assertions
    for the typed time and exact displayed date/time.
13. Before bot consumer code, add internal-bot tests proving its write creates
    the same persistence model, bot idempotency replay does not recapture, and
    client-card history returns the snapshot in stable order. Add Python model
    and rendering tests for `HH:mm` without local schedule resolution.
14. Run all new focused tests and record executed failures caused by missing
    TASK-118 behavior. Compile errors, host/bootstrap failures and unrelated
    baseline failures do not count as the required red phase. No behavioral
    production code starts until executable red evidence exists.

### Phase 2 — domain, persistence and clean schema

15. Implement `AttendanceSessionStartTimeSnapshot` with focused construction
    semantics and no public application update method.
16. Add its EF configuration/`DbSet`, group FK and Attendance composite
    relationship; keep the existing attendance uniqueness and financial FKs.
17. Update `InitialCreate`, applicable designers and model snapshot. Update
    seed/test fixture builders to create one explicit snapshot per group/date.
18. Re-run model/initial-script tests and create a clean PostgreSQL database
    before service behavior, proving schema/model parity and FK enforcement.

### Phase 3 — backend-owned atomic capture

19. Refactor `AttendanceService.SaveAsync` only enough to load/create the
    occurrence snapshot after the shared group lock and before adding new rows.
    Reuse the merged TASK-117 resolver and resolve at most once per command.
20. Preserve the existing transaction, authorization, membership and audit
    ordering. Make snapshot creation roll back with every existing failure
    path; never catch uniqueness errors as normal production flow on PostgreSQL.
21. Reuse an existing snapshot for every later mark and recreation. Do not
    query current schedule when a snapshot exists and do not delete the
    snapshot when attendance rows are removed.
22. Include normalized snapshot time in attendance audit old/new state without
    changing action type, source, messenger attribution or description.

### Phase 4 — history, attention and acknowledgement

23. Project `trainingStartTime` from the snapshot in client attendance history;
    replace `UpdatedAt`/mutable-schedule ordering with date/time/id ordering and
    retain existing paging and scope filters.
24. Project the same field/order through internal bot client-card history.
25. Change `ClientAttentionEndpoints` last-event selection and calculator event
    construction to use snapshots. Copy the selected snapshot into the existing
    acknowledgement boundary and audit payload.
26. Remove attendance-derived reads of mutable group schedule time. A final
    search may retain group schedule only for current roster/group display and
    historical backlog/docs, never as an attendance event key.

### Phase 5 — synchronized frontend and Python bot consumers

27. Add `trainingStartTime` to the frontend client-history type/mapper; use
    backend-equivalent date/time/id order and render time beside the date in the
    existing card. Preserve loading, empty, partial-history, permission and
    responsive behavior.
28. Add `training_start_time` to the Python bot client-history model and render
    it in the existing history line. Preserve server order; do not sort or infer
    schedule in Python.
29. Update mocks/fixtures to contain explicit historical times. Do not add a
    fallback to current group schedule or accept both historical contracts in
    production mapping.

### Phase 6 — green regression and runtime acceptance

30. Re-run the identical focused red suites until green without weakening
    assertions; record commands, executed counts and outcomes.
31. Run full backend, frontend and bot validation required by nearest
    `AGENTS.md` files.
32. Recreate the isolated PostgreSQL database from scratch, seed it, verify
    backend readiness, perform one web save and one internal-bot save, mutate
    the relevant schedules and verify stable web/bot history plus client
    attention.
33. Search executable code/tests for attendance event ordering by
    `Group.ScheduleEntries`, group start-time fallback or `UpdatedAt`. Classify
    every remaining result and reject hidden mutable historical sources.
34. Record that no forward migration/backfill or physical-device UI validation
    was performed unless separately approved and actually executed.

## Preferred implementation strategy

1. Executable persistence and raw-contract tests before DTO/entity behavior.
2. One lazy occurrence-level snapshot, not duplicated per client attendance row.
3. One backend resolver reused only at first capture.
4. Shared service capture before web/internal-bot read propagation.
5. Snapshot-based history/attention ordering before thin consumer display.
6. Clean-schema PostgreSQL and concurrency proof before full regressions.
7. Small verifiable commits with no partially deployed history contract.

## Files likely to change

Backend domain/persistence:
- `backend/src/GymCrm.Domain/Attendance/AttendanceSessionStartTimeSnapshot.cs` (new)
- `backend/src/GymCrm.Domain/Attendance/Attendance.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/GymCrmDbContext.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/AttendanceSessionStartTimeSnapshotConfiguration.cs` (new)
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/AttendanceConfiguration.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.Designer.cs`
- latest migration designer required after TASK-117 is merged
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/GymCrmDbContextModelSnapshot.cs`
- affected seed/fixture builders found by the mandatory source audit

Backend behavior/contracts:
- merged TASK-117 date-to-schedule resolver under
  `backend/src/GymCrm.Application/Attendance/` or its final owning module
- `backend/src/GymCrm.Infrastructure/Attendance/AttendanceService.cs`
- `backend/src/GymCrm.Api/Auth/ClientAttendanceHistoryEntryResponse.cs`
- `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/ClientAttentionEndpoints.cs`
- `backend/src/GymCrm.Application/Attendance/MissedTrainingAttendanceEvent.cs`
- `backend/src/GymCrm.Application/Attendance/MissedTrainingStreakCalculator.cs`
- `backend/src/GymCrm.Application/Bot/BotApiContracts.cs`
- `backend/src/GymCrm.Infrastructure/Bot/BotApiService.cs`

Backend tests:
- `backend/tests/GymCrm.Tests/AttendanceStartTimeSnapshotApiTests.cs` (new, preferred)
- `backend/tests/GymCrm.Tests/AttendanceStartTimeSnapshotPostgreSqlTests.cs` (new, preferred)
- `backend/tests/GymCrm.Tests/AttendanceApiTests.cs`
- `backend/tests/GymCrm.Tests/ClientsApiTests.cs`
- `backend/tests/GymCrm.Tests/MissedTrainingStreakCalculatorTests.cs`
- `backend/tests/GymCrm.Tests/InternalBotApiTests.cs`
- `backend/tests/GymCrm.Tests/BootstrapSmokeTests.cs`
- `backend/tests/GymCrm.Tests/TestDataSeederTests.cs`
- other direct attendance fixtures found by the source audit

Frontend production/tests:
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/clients.ts`
- `frontend/src/lib/api/clients.test.ts`
- `frontend/src/features/clients/ClientManagement.tsx`
- `frontend/src/features/clients/ClientManagement.test.tsx`
- affected client-card e2e mocks/spec only if the rendered history is covered

Bot production/tests:
- `bot/src/gym_crm_bot/crm/models.py`
- `bot/src/gym_crm_bot/core/service.py`
- `bot/tests/test_crm_client.py`
- `bot/tests/test_bot_service.py`

## Constraints
- Backend exclusively owns snapshot capture, schedule resolution, permissions,
  attendance state, missed-training ordering and acknowledgement semantics.
- Frontend and Python bot consume a normalized historical time and never derive
  it from current schedule or display strings.
- Snapshot identity is one occurrence per `(GroupId, TrainingDate)`; supporting
  multiple sessions for one group/day requires a new identity and is out of scope.
- Snapshot is a local wall-clock `TimeOnly`; no timezone conversion.
- Opening/reading a roster has no persistence side effect.
- Schedule edit/removal never mutates a captured snapshot.
- Resetting all attendance rows does not delete the snapshot.
- Attendance, snapshot, membership effects and mandatory audits commit or roll
  back atomically.
- Existing permissions, access scopes, date windows, CSRF, bot idempotency,
  single-visit lineage and `MarkedAt` protection remain unchanged.
- Existing acknowledgement `MarkedAt` guard and denormalized boundary remain.
- Project code changes occur only in the declared TASK-118 worktree.

## Out of scope
- Implementing TASK-117 or changing its accepted `scheduleEntries` contract.
- Multiple sessions for one group on one date.
- General `LessonOccurrence` generation, `Held/NotHeld`, cancellations,
  reschedules, exceptions, holidays or expected-participant snapshots.
- Attendance eligibility, date windows, trainer substitution, roles or access
  scope changes.
- Changes to single-visit write-off/restore, membership or financial semantics.
- Reconstructing unknown historical time without an authoritative source.
- Forward migration/backfill until explicit existing-database preservation is
  requested and a provenance contract is approved.
- General redesign of Attendance, Client profile, Home or bot navigation.
- Removing the existing acknowledgement time boundary or rewriting historical
  audit rows.

## Required test coverage

All unit and integration tests below are written or updated before behavioral
functional code. The initial red run must contain executed failing assertions
for absent TASK-118 behavior; compilation/setup failures are not evidence.

### Unit tests
- TASK-117 date resolver selects the matching ISO weekday and uses earliest
  configured time only when no match exists; TASK-118 adds no duplicate resolver.
- Snapshot capture policy distinguishes missing/existing session and does not
  capture for empty or all-no-op/`Unmarked` commands.
- Missed-training same-date ordering and boundary comparisons consume event
  snapshot time and keep `MarkedAt` protection.
- Frontend history mapping requires normalized historical `trainingStartTime`;
  comparator uses date, time and id without `UpdatedAt` or current schedule.
- Python model parses `trainingStartTime` and renders `HH:mm` without local
  weekday/time calculation.

### Integration tests
- First web `Present` and first web `Absent` each create the exact matching-day
  snapshot and required Attendance relationship.
- Several clients in one batch and later separate requests share one snapshot.
- Same-state replay and `Present <-> Absent` preserve snapshot, `MarkedAt`
  no-op behavior, audit semantics and single-visit lineage.
- `Unmarked` deletes the client row but not the session snapshot; recreation
  after schedule change reuses the original time.
- Editing or deleting the weekday after capture does not change persistence,
  history response, audit values, event order, missed count or boundary.
- First off-schedule capture persists the documented TASK-117 earliest-time
  fallback once and later schedule changes do not recalculate it.
- Web and internal bot writes use the same service and produce identical
  snapshot semantics; bot idempotency replay creates no second snapshot/audit.
- Invalid request/client/date, forbidden actor, audit failure and membership
  conflict leave no orphan snapshot or partial state.
- PostgreSQL concurrent first writes create one row without raw unique error;
  schedule-update race produces one serialized old-or-new captured value.
- Direct persistence cannot create Attendance without its composite snapshot
  FK or duplicate snapshots for the same group/date.
- Web and bot history return normalized time in date/time/id order with existing
  paging, coach scope and elevated-role visibility intact.
- Acknowledgement copies the event snapshot, remains idempotent and requires
  three genuinely new post-boundary absences after schedule changes.
- Audit old/new state contains the immutable time and preserves source/
  messenger metadata and action types.
- Clean PostgreSQL schema, seed and model snapshot are reproducible.

### UI and bot presentation tests
- Client history displays `dd.mm.yyyy · HH:mm` (or the existing equivalent
  local composition) and group/state without layout or permission regression.
- Two same-date entries render in backend-equivalent descending time/id order.
- Loading, empty and partial-history states remain unchanged.
- Narrow client-card layout wraps the added time without horizontal overflow;
  no new interaction or primary action is introduced.
- Telegram client card renders each history row with date, time, group and state
  while preserving backend order.

### Manual-only validation
- A quick web/bot smoke may confirm readable Russian formatting. No physical
  device behavior is introduced, so manual QA is not the regression barrier.
- Legacy-data truthfulness can be validated only after a separately approved
  preservation/provenance design; it is not claimed by clean-schema tests.

## Test plan
- [ ] Record focused baseline backend/frontend/bot results after TASK-117 merge.
- [ ] Run red backend snapshot suites:
  `dotnet test backend/tests/GymCrm.Tests/GymCrm.Tests.csproj --filter "FullyQualifiedName~AttendanceStartTimeSnapshot"`.
- [ ] Run red missed-training/client-history/internal-bot focused tests and
  record exact assertion failures.
- [ ] Run red frontend client API/card tests.
- [ ] Run red Python bot client/service tests.
- [ ] After implementation, rerun the identical focused suites to green.
- [ ] Run `dotnet test backend/GymCrm.slnx`.
- [ ] From `frontend`, run `npm run lint`, `npm run build` and
  `npm run test:unit`.
- [ ] Run the affected client-card Playwright spec if history rendering has an
  existing e2e boundary.
- [ ] From `bot`, run `ruff check .` and `pytest`.
- [ ] Recreate clean PostgreSQL in the isolated stack, seed and smoke web/bot
  save -> schedule change -> stable history/attention.
- [ ] Search executable code/tests for mutable schedule or `UpdatedAt` used as
  attendance event order and classify every remaining result.
- [ ] Confirm no incremental migration/backfill was added under clean-schema
  policy.

## Regression barrier

The primary barrier is one real-PostgreSQL red/green scenario that creates an
occurrence through web and bot writes, proves the composite snapshot/FK and
concurrent first-write behavior, changes/removes the authoritative schedule,
then verifies unchanged persistence, audit, web history, bot history,
missed-training order and acknowledgement boundary. Focused unit/contract tests
protect the resolver boundary and thin consumers; clean-database creation and
full backend/frontend/bot suites prevent a partial rollout.

No implementation is complete without recorded red and green evidence for the
same focused assertions.

## Risks
- TASK-117 is not implemented yet; planning against its proposed rather than
  merged contract can create field/resolver drift.
- A per-client-row time would diverge across separate marks and disappear after
  `Unmarked`; the selected occurrence table avoids that but creates a small
  persistent session concept that must remain separate from TASK-075 state.
- If TASK-075 is implemented first with an overlapping `(GroupId,
  TrainingDate)` entity, two session sources could emerge; reconcile the model
  before writing TASK-118 code.
- Schedule mutation and attendance capture must share the same PostgreSQL group
  lock order or a race can capture an uncommitted/ambiguous schedule.
- Snapshot rows intentionally survive an empty attendance roster and may grow;
  automatic cleanup would destroy history and is forbidden in this task.
- History can accidentally expose both current `groupScheduleEntries` and
  historical `trainingStartTime` without clear naming, inviting consumers to
  keep using the mutable value.
- Removing `UpdatedAt` from ordering changes same-date correction order to
  occurrence order; tests must lock this intentional semantic change.
- Direct fixtures that omit snapshots may pass InMemory tests and fail only on
  PostgreSQL, so clean-schema and FK tests are mandatory.
- Unknown legacy time cannot be made factual by deterministic calculation; a
  late database-preservation requirement materially changes persistence and UI
  scope.
- A bot or frontend compatibility fallback can hide a partially deployed
  backend and reintroduce mutable schedule semantics.

## Stop conditions

Stop and do not write or continue functional code if:
- TASK-117 is not merged into current `origin/main`, or its authoritative
  resolver/contract cannot satisfy the prerequisite defined here;
- the declared branch/worktree is ambiguous, dirty with unexplained changes or
  not based directly on current `origin/main` after TASK-117;
- an existing database must be preserved without explicit approval of a
  trustworthy legacy provenance/backfill contract;
- product requires multiple sessions for one group/date, timezone conversion,
  cancellation/held state or expected-participant snapshots;
- TASK-075 or another merged model already owns the same occurrence identity
  and cannot be safely reused without broad redesign;
- TASK-117 schedule mutations do not serialize on a lock compatible with
  attendance capture and the race cannot be localized safely;
- a required consumer can only work by deriving historical time from current
  schedule or by accepting dual sources of truth;
- changes expand into permissions, attendance eligibility, membership/
  financial behavior or a general UI workflow redesign;
- the mandatory PostgreSQL constraint/concurrency or clean-schema regression
  cannot be made executable.

Do not stop merely because backend, frontend and bot all need synchronized
contract updates. That coordinated propagation is expected.

## Ready for Codex execution
no — the source task remains high-risk and `Safe for Codex: no`; TASK-117 is an
unmerged prerequisite, and active execution plus any legacy-data compatibility
path require explicit user approval and movement from `/backlog/risky` into the
task implementation lifecycle.
