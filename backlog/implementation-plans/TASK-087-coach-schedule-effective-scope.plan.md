# Implementation Plan: TASK-087 Ограничить расписание тренера его effective groups

## Source task
/backlog/implementation/TASK-087-coach-schedule-effective-scope.md

## Implementation branch
fix/TASK-087-coach-schedule-effective-scope

Branch rules:
- использовать `.agents/skills/task-worktree/SKILL.md` и dedicated worktree,
  созданный напрямую от актуального `origin/main`;
- перед backend tests применить `.agents/skills/csharp-xunit/SKILL.md`;
- не менять role/permission model или effective-assignment semantics;
- не объединять TASK-088 или unrelated schedule redesign.

## Goal
Устранить over-broad schedule visibility: Coach получает из
`/schedule/groups` только permanent + active non-cancelled temporary effective
groups на backend business date, а count, paging, filters, day counts, legend и
empty state строятся исключительно из этого scoped response.

## Current understanding
- `EffectiveGroupAssignmentService` уже реализует required union и inclusive
  date boundaries через `IBusinessDateProvider.Today`.
- `AccessScopeService` already reuses it for Coach attendance/session scope.
- `ScheduleEndpoints.ListGroupsAsync` currently loads global
  `TrainingGroupListQuery` before count/paging and does not inspect current user.
- Existing `Coach_can_view_all_seeded_schedule_groups...` test explicitly locks
  the incorrect global behavior.
- Response shape need not change; the security boundary is query scoping.
- Risk is high because data visibility changes, but the rule is localized,
  already centralized and testable. No unresolved product clarification remains.

## Risk decomposition
1. Lock existing effective-assignment service semantics with focused tests.
2. Scope the schedule query before count/paging.
3. Prove non-Coach roles remain unchanged.
4. Update frontend states/copy without frontend authorization logic.
5. Close access, substitution-boundary and leakage regression matrix.

## Execution steps
1. Prepare isolated worktree and run current backend/frontend schedule baselines.
2. Before production code add/extend unit tests for
   `EffectiveGroupAssignmentService`:
   - permanent assignment;
   - active substitution;
   - inclusive start/end;
   - future, expired and cancelled exclusion;
   - union deduplication and empty trainer id.
3. Before production code replace the incorrect Coach schedule integration
   regression and add endpoint tests:
   - unrelated global group excluded;
   - direct + active substitute groups included;
   - scope applied before `totalCount` and paging;
   - zero-scope envelope is empty with correct skip/take;
   - HeadCoach, Administrator and SuperAdministrator preserve existing
     backend-permitted sets;
   - SuperAdministrator `branchId:null` remains global.
4. Before production code extend
   `GroupTrainerSubstitutionAccessMatrixTests` with an unrelated third group so
   the test proves both inclusion and non-leakage across active/future/expired/
   cancelled transitions.
5. Before production code add frontend component/Playwright tests:
   - Coach sees only returned cards/options/counts/legend;
   - scoped empty text differs from global empty/loading/error;
   - no client-side filtering based on `assignedGroupIds`;
   - SuperAdministrator remains global and does not see Coach copy.
6. Run new tests and confirm endpoint tests fail because `/schedule/groups`
   still returns the global query; keep service tests green if they describe
   already released semantics.
7. Implement backend scoping:
   - obtain authenticated current user in `ScheduleEndpoints`;
   - for `UserRole.Coach`, request ids only through
     `IEffectiveGroupAssignmentService`;
   - constrain `TrainingGroupListQuery` before count and page load;
   - for an empty id set generate an empty query without loading all groups;
   - leave other roles on current permitted behavior.
8. Keep response envelope/schema stable and ensure scoped items are the only
   source of group/branch/hall/trainer/type options.
9. Update frontend schedule state copy and tests only where needed; do not merge
   local session ids with response or invent permission rules.
10. Run focused backend tests, full `GymCrm.slnx`, frontend unit/lint/build and
    affected schedule Playwright/iPhone tests.
11. Perform security review of changed query and report rollback: reverting the
    endpoint scoping commit restores previous behavior without schema/data change.

## Preferred implementation strategy
1. Security regression tests around the existing service.
2. Endpoint scope before count/paging.
3. Non-Coach compatibility tests.
4. Frontend scoped operational states.
5. Full access matrix and responsive verification.

## Files likely to change
- `backend/src/GymCrm.Api/Auth/ScheduleEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/TrainingGroupListQuery.cs` if a reusable
  group-id filter belongs there
- `backend/tests/GymCrm.Tests/GroupsApiTests.cs`
- `backend/tests/GymCrm.Tests/GroupTrainerSubstitutionAccessMatrixTests.cs`
- focused effective-assignment service test file
- `frontend/src/features/schedule/GroupScheduleScreen.tsx`
- new/focused schedule component tests
- `frontend/e2e/group-schedule.spec.ts`
- affected responsive/iPhone schedule fixtures

## Constraints
- Backend is the only owner of scope.
- Reuse `IEffectiveGroupAssignmentService`; no copied date/substitution query.
- Business date and inclusive boundary semantics remain unchanged.
- No “show all” escape path for Coach.
- No schema/migration change is expected.

## Out of scope
- Schedule editing, drag/drop, conflicts or attendance rule changes.
- New role/permission model.
- Historical/future entitlement preview.
- Frontend filtering of unauthorized schedule cards.

## Required test coverage

### Unit tests
- Existing effective assignment semantics and boundary/deduplication cases.
- If endpoint role selection is extracted as a pure helper, Coach vs non-Coach
  selection is tested without duplicating authorization rules.

### Integration tests
- `/schedule/groups` role/scope/count/paging matrix.
- Temporary substitution lifecycle and unrelated-group leakage barrier.
- Tests are written before endpoint production code and must fail specifically
  because the current endpoint returns global data.

### UI/e2e tests
- Coach scoped list/grid, counts, legend, filters and empty copy.
- No unauthorized card or option in mobile/desktop.
- SuperAdministrator global non-regression and compact-height states.

## Test plan
- [ ] Service tests added/updated before endpoint changes.
- [ ] Backend scope/leakage tests red before implementation.
- [ ] Frontend scoped-state tests red before implementation.
- [ ] `dotnet test backend/GymCrm.slnx`
- [ ] `npm run test:unit`
- [ ] affected schedule Playwright and iPhone specs
- [ ] `npm run lint`
- [ ] `npm run build`

## Regression barrier
The release barrier is a fixed-business-date backend matrix proving exact Coach
group ids, filtered totals/pages and substitution boundaries plus negative
unrelated-group assertions. Frontend e2e proves it renders only backend response
data and preserves SuperAdministrator global behavior.

## Risks
- A role check in the wrong layer can diverge from session/attendance scope.
- Filtering after count or paging can leak totals and create empty pages.
- Weak fixtures with only permitted groups can pass without proving non-leakage.

## Stop conditions
Остановиться, если:
- effective scope differs among schedule/session/attendance and cannot be
  resolved through the existing service;
- a global exception for Coach is discovered in an authoritative backend contract;
- implementation requires role/permission redesign;
- unrelated roles would require system-wide scope changes;
- isolated worktree/branch is invalid.

## Ready for Codex execution
yes, with high-risk security review and the required regression gates
