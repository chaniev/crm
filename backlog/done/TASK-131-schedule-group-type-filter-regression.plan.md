# Implementation Plan: TASK-131 Закрепить регрессии фильтра расписания по типу группы

## Metadata
- source_task: /backlog/implementation/TASK-131-schedule-group-type-filter-regression.md
- requirements: REQ-GRP-005 (verifies)
- branch: feature/TASK-131-schedule-group-type-filter-regression
- readiness: yes
- dependencies: none; completed TASK-119 owns the current URL/API/filter-options contract, and completed TASK-133 is the current task-first schedule UI baseline
- risk: medium — verification spans backend access scope, URL-backed React state and mobile/wide browser behavior; production behavior is outside the authorized scope

## Goal
Protect the existing `Тип группы` schedule filter with direct backend, API-client, component and browser regression tests for exact filtering, authorized options, URL round-trip, composition, clear/reset and responsive behavior.

## Decisions and contracts
- Do not change the public schedule contract: `groupTypeId` remains an optional exact-match query parameter, and frontend state remains URL-backed.
- Build `filterOptions.groupTypes` from the unfiltered access-scoped schedule series so authorized options remain available when the selected filter produces no lessons; never expose options outside the user's backend scope.
- Filters compose with AND semantics. Tests use at least two group types and one additional distinguishing filter so an unfiltered or OR-filtered response cannot pass accidentally.
- Frontend consumes response options and serializes the selected identifier; it must not load a separate catalog or reproduce filtering semantics locally.
- Preserve `date` and `view` while changing, clearing or resetting filters. Reload, back/forward and retry must recover the selected filter from the URL.
- This task adds regression coverage only. If a new test exposes a production defect, record the RED evidence and stop before changing functional code until the fix scope is approved.

## Scope
### In
- Focused integration coverage for `GET /schedule/lessons` and access-scoped `filterOptions.groupTypes`.
- Focused API-client query serialization coverage.
- `GroupScheduleScreen` coverage for selection, request/URL state, active count, clear/reset, retry and URL restoration.
- Mobile and wide Playwright coverage for matching chronological results, clear/reset and page overflow.

### Out
- Schedule endpoint, permission, access-scope, conflict, database or calendar-model changes.
- Client-side schedule filtering, separate group-type catalog loading or filter-option pruning.
- Redesign of the TASK-133 task-first cards or calendar tools surface.

## Implementation slices
1. Extend the schedule backend fixture with two authorized group types plus an out-of-scope type, then add focused integration cases for exact `groupTypeId`, AND-composition, filtered-empty option retention and unauthorized-option exclusion.
2. Add an API-client test that calls `getScheduleLessons` with `from`, `to`, `groupTypeId` and one neighboring filter and asserts the exact encoded GET URL.
3. Add component scenarios that select `Тип группы` from response options, verify URL/request/count state, exercise clear and global reset without losing `date`/`view`, and prove retry plus URL rehydration preserve the selection.
4. Add one data-driven Playwright workflow exercised at mobile and wide viewports: route fixtures by received query, select a type, assert only matching lessons in chronological order, clear/reset, reload or back/forward, and assert no page-level horizontal overflow.
5. Run the focused backend/frontend/browser checks and the canonical task-aware verification. Change production code only under separately approved defect scope.

## Likely files and layers
- `backend/tests/GymCrm.Tests/ScheduleLessonsApiTests.cs` — schedule endpoint predicate, access-scope and stable filter-option integration cases.
- `frontend/src/lib/api/schedule.test.ts` — `getScheduleLessons` query serialization.
- `frontend/src/features/schedule/GroupScheduleScreen.test.tsx` — URL-backed filter interaction, count, clear/reset and retry/rehydration cases.
- `frontend/e2e/group-schedule.spec.ts` — mobile/wide group-type workflow and overflow assertion.
- `backlog/implementation/TASK-131-schedule-group-type-filter-regression.md` and this plan — completion evidence only; no requirement text change is expected.

## Regression specification
### Automated tests to add or update
- Backend exact/composed predicate: seed lessons across two group types and at least two branches or halls; `groupTypeId=A` returns only A, and `groupTypeId=A&branchId=B` returns only their intersection in existing chronological order.
- Backend option scope: an inaccessible group's type is absent from `filterOptions.groupTypes`; an authorized type remains in options when another valid filter combination makes `items` empty.
- API client: `getScheduleLessons({ from, to, branchId, groupTypeId })` issues one GET whose query contains all four exact parameters and no null/undefined filter values.
- Component selection: opening `Параметры календаря` exposes the response-provided `Тип группы`; selecting it writes `groupTypeId`, triggers a request and increments the accessible active-filter count.
- Component recovery: individual clear and global `Сбросить фильтры` remove `groupTypeId` while keeping `date` and `view`; retry, rerender from the same URL and popstate/back-forward keep the selected identifier and request.
- Playwright mobile/wide: the route stub returns distinct lessons by query; selecting one type leaves only matching cards in chronological DOM order, reload/back-forward preserves state, clear/reset restores results, and document width never exceeds viewport width.

### Expected red evidence
- No functional RED is expected: current production code already implements the accepted TASK-119 contract, while the verified gap is the absence of focused tests.
- The new tests should be green against the baseline. A failing assertion is evidence of a production regression or an invalid fixture, not authorization to patch functional code; preserve the failure and stop for scope review after ruling out the fixture.

### Required validation
- Focused `ScheduleLessonsApiTests` filter for the new group-type cases.
- Focused Vitest runs for `schedule.test.ts` and `GroupScheduleScreen.test.tsx`.
- Affected Chromium `group-schedule.spec.ts` workflow plus the existing target-iPhone schedule projects.
- `python3 scripts/harness/verify_change.py --base origin/main --task-id TASK-131` after the task verification contract is available; otherwise run the diff-selected harness without `--task-id` and record the missing contract explicitly.

### Manual evidence
- Use browser inspection only if reload/back-forward or responsive overflow cannot be made deterministic in Playwright; record physical Safari/device checks as unverified unless actually performed.

### Regression barrier
- The primary barrier is one query-sensitive `group-schedule` Playwright workflow passing on a target-iPhone viewport and a wide viewport, backed by the exact backend predicate/access-scope tests and API serialization test.

## Risks and stop conditions
- Stop if the backend test requires broadening access scope or exposing a catalog type not reachable from the authorized schedule series.
- Stop if a filter option disappears only because the current result set is empty; do not redefine the accepted stable-options contract inside a test-only task.
- Stop if a component or browser failure requires changing URL identity, TASK-133 card behavior or calendar-tools UX; separate the production defect from this regression-only task.
- Avoid assertions against Mantine internals or visual card structure; use public query/response fields, URL state, accessible control names and stable lesson identities.
