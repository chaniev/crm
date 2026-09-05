# Implementation Plan: TASK-087 Ограничить расписание тренера его effective groups

## Source task
/backlog/done/2026-07-30/TASK-087-coach-schedule-effective-scope.md

Source status is `done`: implementation commit `9aef592` is integrated by
`7e386d1` on current `origin/main`; backend leakage/scope coverage and the
frontend responsive release barriers passed during the 2026-07-30 status
audit.

## Implementation status

Done. The high-risk data-visibility contract is protected by backend and
frontend regression coverage. Historical pre-implementation red-phase ordering
was not reconstructed by the status audit.

## Implementation branch
fix/TASK-087-coach-schedule-effective-scope

Branch rules:
- использовать `.agents/skills/task-worktree/SKILL.md` и dedicated worktree,
  созданный напрямую от актуального `origin/main`;
- до создания или существенного изменения backend xUnit tests применить
  `.agents/skills/csharp-xunit/SKILL.md`;
- до frontend implementation/testing применить
  `.agents/skills/crm-mobile-first-ui/SKILL.md` и
  `.agents/skills/react-best-practices/SKILL.md`;
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
- `/schedule/groups` remains a group-level recurring weekly template. Effective
  scope is evaluated on the current backend business date; an effective group
  is returned with all of its configured weekdays even when a temporary
  substitution covers only part of that displayed week.
- Existing trainer fields and trainer filter semantics remain based on permanent
  `GroupTrainers`. TASK-087 does not make the temporary substitute an effective
  displayed trainer; that presentation change requires a separate task.
- Risk is high because data visibility changes, but the rule is localized,
  already centralized and testable. No unresolved product clarification remains.

## Resolved implementation decisions
- Coach-specific copy receives an explicit role signal from authenticated
  frontend session data; it must not infer Coach from `canManageGroups`,
  `assignedGroupIds` or another permission.
- Coach zero-scope state:
  - title: `Для вас занятий в расписании нет`;
  - description: `Когда вас назначат на группу или временную замену, занятия появятся здесь.`;
  - empty filter controls are hidden;
  - refresh remains reachable.
- Day-level empty state distinguishes:
  - Coach without active filters: `В этот день у вас занятий нет`;
  - an active filtered result: the existing filter-specific empty copy;
  - elevated roles without active filters: the existing global day-empty copy.
- Keyboard day selection keeps focus on the newly selected day tab.

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
     backend-permitted sets by exact group ids;
   - SuperAdministrator `branchId:null` remains global across a fixture with at
     least two branches.
4. Before production code extend
   `GroupTrainerSubstitutionAccessMatrixTests` with an unrelated third group so
   the test proves both inclusion and non-leakage across active/future/expired/
   cancelled transitions.
5. Before production code add frontend component/Playwright tests:
   - Coach sees only returned cards/options/counts/legend;
   - a deliberately conflicting `assignedGroupIds` session fixture proves there
     is no client-side permission filtering;
   - Coach zero-scope title/description, hidden empty filters and reachable
     refresh differ from global empty/loading/error;
   - Coach and elevated no-filter day-empty copy differ from filtered empty copy;
   - ArrowLeft/ArrowRight selection moves focus to the selected day tab;
   - SuperAdministrator remains global and does not see Coach copy.
6. Run new tests and confirm:
   - endpoint scope/leakage tests fail because `/schedule/groups` still returns
     the global query;
   - existing-service characterization tests remain green;
   - frontend response-consumption characterizations may already be green
     because the current screen renders backend response data;
   - new Coach copy, zero-scope and keyboard-focus regressions are red where the
     current UI does not implement the agreed state.
7. Implement backend scoping:
   - obtain authenticated current user in `ScheduleEndpoints`;
   - for `UserRole.Coach`, request ids only through
     `IEffectiveGroupAssignmentService`;
   - constrain `TrainingGroupListQuery` before count and page load;
   - for an empty id set generate an empty query without loading all groups;
   - leave other roles on current permitted behavior.
8. Keep response envelope/schema stable and ensure scoped items are the only
   source of group/branch/hall/trainer/type options. Preserve permanent
   `GroupTrainers` as the trainer metadata source.
9. Pass an explicit Coach role signal from authenticated session data to the
   schedule screen. Implement the agreed zero-scope/day-empty copy, empty-filter
   behavior and day-tab focus without merging local session ids with response or
   inventing permission rules.
10. Validate the group-id scope query on a relational provider, not only EF
    InMemory, then run focused backend tests, full `GymCrm.slnx`, frontend
    unit/lint/build and affected schedule Playwright/iPhone tests.
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
- `frontend/src/App.tsx` or the nearest authenticated route composition that
  passes the explicit Coach role signal
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
- Changing trainer metadata/filter semantics to show temporary substitutes.
- Pruning recurring group weekdays to the temporary substitution date range.
- Frontend filtering of unauthorized schedule cards.

## Required test coverage

### Unit tests
- Existing effective assignment semantics and boundary/deduplication cases.
- If endpoint role selection is extracted as a pure helper, Coach vs non-Coach
  selection is tested without duplicating authorization rules.

### Integration tests
- `/schedule/groups` role/scope/count/paging matrix.
- Temporary substitution lifecycle and unrelated-group leakage barrier.
- At least one relational-provider check proving the group-id scope is
  translated and applied before count/page load.
- Tests are written before endpoint production code and must fail specifically
  because the current endpoint returns global data.

### UI/e2e tests
- Coach scoped list/grid, counts, legend, filters and empty copy.
- No unauthorized card or option in mobile/desktop.
- Explicit role signal; no inference from permissions or `assignedGroupIds`.
- Zero-scope filter/refresh behavior and no-filter vs filtered day-empty copy.
- Arrow-key selection and focus on the selected day tab.
- SuperAdministrator multi-branch global non-regression.
- No horizontal overflow at `360 x 780`, `390 x 844`, `420 x 912` and
  `440 x 956`; compact-height smoke at `912 x 420` and `956 x 440`; affected
  tablet/desktop behavior at `768 x 1024` and `1440 x 1200`.

## Test plan
- [ ] Service tests added/updated before endpoint changes.
- [ ] Backend scope/leakage tests red before implementation.
- [ ] Frontend response-consumption characterizations recorded green/red
      according to current behavior.
- [ ] New Coach zero-scope/copy/focus regressions red before implementation.
- [ ] Relational-provider scope query check.
- [ ] `dotnet test backend/GymCrm.slnx`
- [ ] `cd frontend && npm run test:unit`
- [ ] `cd frontend && npm run test:e2e -- e2e/group-schedule.spec.ts`
- [ ] `cd frontend && npm run test:e2e:iphone`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`

## Regression barrier
The release barrier is a fixed-business-date backend matrix proving exact Coach
group ids, filtered totals/pages and substitution boundaries plus negative
unrelated-group assertions on the endpoint, with relational-provider coverage
for the scoped query. Frontend e2e proves it renders only backend response data,
uses the explicit Coach role only for presentation copy, preserves focus and
zero-scope recovery, and keeps SuperAdministrator global across branches.

## Risks
- A role check in the wrong layer can diverge from session/attendance scope.
- Filtering after count or paging can leak totals and create empty pages.
- Weak fixtures with only permitted groups can pass without proving non-leakage.
- The accepted group-level weekly contract can show weekdays outside a short
  temporary-substitution range; this is documented behavior, not date-specific
  entitlement preview.
- Temporary substitutes remain absent from trainer metadata/filter options in
  this task because those fields preserve permanent `GroupTrainers` semantics.

## Stop conditions
Остановиться, если:
- effective scope differs among schedule/session/attendance and cannot be
  resolved through the existing service;
- a global exception for Coach is discovered in an authoritative backend contract;
- implementation requires role/permission redesign;
- unrelated roles would require system-wide scope changes;
- isolated worktree/branch is invalid.

## Ready for Codex execution
no — implementation completed
