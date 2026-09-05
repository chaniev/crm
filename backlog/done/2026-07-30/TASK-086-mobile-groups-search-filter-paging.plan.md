# Implementation Plan: TASK-086 Добавить mobile-first поиск, фильтры и paging списка групп

## Source task
/backlog/done/2026-07-30/TASK-086-mobile-groups-search-filter-paging.md

Source status is `done`: implementation commit `d3963a9` and integration commit
`f8f6460` are present on current `origin/main`; backend, frontend, Chromium and
target-iPhone release barriers passed during the 2026-07-30 status audit.

## Implementation status

Done. The status audit verified final release behavior; historical
pre-implementation red-phase ordering was not reconstructed.

## Implementation branch
feature/TASK-086-mobile-groups-search-filter-paging

Branch rules:
- использовать `.agents/skills/task-worktree/SKILL.md` и отдельный worktree из
  актуального `origin/main`;
- проверить clean status, branch ownership и base before code;
- не менять group create/edit/trainer-assignment/substitution business semantics;
  разрешено только применить согласованный management access scope ко всем
  group-owned reads and mutations;
- не удалять `/groups/summary` и не менять его consumers вне registry; retained
  summary counts используют тот же backend scope;
- cross-layer backend/frontend contract changes остаются в этой одной task branch.

## Goal
Заменить длинный groups registry на locator-first workflow с server-side
trimmed search, active/without-trainer filters, honest `{items,totalCount,skip,take}`
envelope и page-based pagination `pageSize=10`, сохранив backend access scope и
все required group decision data.

## Current understanding
- `/groups` защищён backend `ManageGroups`, но текущий list query не применяет
  branch scope, принимает только `isActive` и возвращает массив после paging
  без `totalCount`.
- Normative management scope resolved: `HeadCoach` and `SuperAdministrator`
  global; `Administrator` limited to `currentUser.BranchId`; `Coach` forbidden.
  Scope applies before search/filter/count/paging and consistently protects
  group details and mutations from direct foreign-branch access.
- `TrainingGroupListQuery` уже централизует ordered page loading.
- Frontend `getGroups` умеет читать envelope и временно поддерживает array
  payload, но `GroupsListScreen` запрашивает до 50 элементов и отдельно загружает
  `GroupsSummaryBar`.
- TASK-017 merged into `main` as `d86ded4` and provides a proven client-specific
  versioned `history.state` pattern. Its types, namespace and route allowlist
  are not generic, so Groups needs a separate focused snapshot without a broad
  routing refactor.
- Existing component tests закрепляют summary behavior и должны быть заменены
  registry contract tests.
- UX contract source task approved; `ux-researcher` and `ui-designer` before
  implementation confirm only responsive/component handoff.

## Resolved implementation contract

### Access scope
- `HeadCoach` and `SuperAdministrator` receive the global management dataset.
- `Administrator` receives only groups whose `BranchId` equals the authenticated
  user's `BranchId`; foreign groups do not contribute to `items`, `totalCount`
  or retained summary counts.
- The same branch boundary protects group details, clients, create/update,
  trainer assignment and trainer-substitution endpoints. An existing
  foreign-branch target returns the established forbidden ProblemDetails
  response; a missing target remains not found. Creating into a foreign branch
  is forbidden.
- `Coach` remains forbidden from group management endpoints.
- Frontend does not infer or reproduce branch scope.

### Search and filters
- `query` is normalized only with `Trim`; blank becomes absent.
- Search is database-side case-insensitive contains over group `Name` only.
- No application-level query length limit, truncation or length validation is
  introduced.
- `withoutTrainer=true` means no persistent `TrainingGroup.Trainers`
  assignments. A group assigned to an inactive trainer is still assigned;
  substitutions do not participate.
- `isActive=true|false|absent` and `withoutTrainer=true|absent` compose before
  count and paging.

### Paging
- Registry uses fixed `pageSize=10`.
- API continues to support `page/pageSize` and `skip/take` for existing
  consumers, but mixing the two parameter families returns validation
  ProblemDetails. Partial pairs retain current defaults.
- Validate positive values, current maximum take/page size and arithmetic
  overflow when resolving `(page - 1) * pageSize`.
- Applied query change, filter change, filter removal and reset move to page 1.
- Manual refresh and retry preserve the current page and criteria.
- Edit/back restoration first requests the restored page. If
  `page > ceil(totalCount / pageSize)`, clamp to the last existing page and
  perform at most one corrective request. `totalCount=0` renders the applicable
  first-run or scoped empty state without a corrective request.
- Disable repeated pagination while its request is pending and ignore or abort
  stale responses.

### Search/filter interaction
- Search keeps separate draft/applied values and applies normalized input after
  a 250 ms debounce.
- A newer request aborts or makes earlier responses ineligible to update state.
- Filters apply immediately; the filter surface action `Готово` only closes the
  surface.
- Removing an active-filter chip applies immediately. Full reset clears search,
  activity and without-trainer filters and returns to page 1.

### Return state
- Add a group-specific versioned `history.state` snapshot using the TASK-017
  pattern, not its client-specific schema.
- Snapshot allowlist is `/groups` and `/groups/:id/edit`; `/groups/new`,
  unrelated routes, logout and authenticated-user changes drop the group
  namespace while preserving unrelated history-state keys.
- Store only primitive state: search draft/applied query, `isActive`,
  `withoutTrainer`, page, selected/anchor group id, finite scroll offset, focus
  target, origin-list entry key and bounded return depth. Do not store group
  payloads, names, API responses or temporary filter-surface state.
- Browser Back, edit `Назад` and successful save return to the originating list
  entry without adding a duplicate `/groups` entry. Reload of a valid same-tab
  history entry restores it; direct edit without a snapshot replaces itself
  with default `/groups` on explicit return.
- Pending search draft is normalized and made applied before edit navigation;
  when it differs from the previous applied query, captured page becomes 1.
- Restore anchor visibility, scroll and focus after the first successful
  restored request; empty/error recovery focuses the results or recovery
  action rather than reopening the software keyboard.

### Responsive result presentation
- Every registry item exposes exactly: group name, branch, hall, schedule,
  trainers, status and the visible edit operation. `groupType`, `clientCount`
  and aggregate metrics are not rendered in this registry.
- Mobile uses the approved compact task-oriented card/row hierarchy.
- `768–1023px` uses one-column compact rows with internal metadata grid.
- `>=1024px` uses a table-like CSS Grid with columns
  `Группа | Филиал и зал | Расписание | Тренеры | Статус | Редактировать`.
  It reuses the same typed view model and task/focus order, has no horizontal
  scrolling and keeps edit at least `44 x 44`.

## Execution steps
1. Подготовить isolated worktree and capture current consumers/fixtures of
   `/groups` and `/groups/summary`, current group authorization paths and
   `/schedule/groups` use of `TrainingGroupListQuery`.
2. До production-кода добавить backend integration tests in `GroupsApiTests`:
   - HeadCoach/SuperAdministrator global and Administrator own-branch-only
     `items`, totals, details and mutations; Coach remains forbidden;
   - foreign existing target forbidden, missing target not found and foreign
     create forbidden;
   - trimmed/blank/unbounded-length case-insensitive contains query;
   - `isActive=true/false/absent`, `withoutTrainer=true/absent`, including an
     inactive assigned trainer and ignored substitutions;
   - combined filters applied before count/paging;
   - stable ordering/total, partial paging defaults, mixed-family rejection and
     paging arithmetic validation;
   - retained summary scope and unchanged `/schedule/groups` dataset/order/total.
3. До production-кода добавить frontend API unit tests:
   - exact query serialization;
   - strict envelope mapping;
   - array payload rejection after the coordinated rollout;
   - existing `take=100` consumers still map the required envelope;
   - no client-side filtering of a page.
4. До production-кода replace summary-oriented component tests with locator,
   250 ms debounced search, immediate filters, range, paging, retry, clamp and
   scoped reset tests; add pure group list query/view-model tests.
5. До production-кода add Playwright integration scenarios for 30+ groups,
   browser Back/edit CTA/successful-save return state, Administrator branch
   isolation, multi-branch SuperAdministrator and target geometry.
6. Run all new tests and record expected failures on the array backend response,
   current global Administrator result, missing query/withoutTrainer filters,
   summary-first UI, absent paging and absent group return state.
7. Backend green slice:
   - add a required list envelope response DTO;
   - add one explicit group-management scope path used consistently by
     group-owned reads and mutations;
   - keep `TrainingGroupListQuery.CreateBaseQuery` neutral for schedule and
     apply management scope/search/filters explicitly in the management path;
   - normalize query only with `Trim`, with no length limit;
   - apply server-side name/active/trainer filters;
   - count filtered scoped query before `Skip/Take`;
   - validate mixed paging families and overflow;
   - return envelope with deterministic ordering without changing schedule.
8. Frontend contract slice:
   - extend typed query params/keys and make registry use `pageSize=10`;
   - update all affected fixtures/consumers for envelope without deriving totals
     from current page;
   - remove array compatibility from the production adapter.
9. Frontend workflow slice:
   - remove `GroupsSummaryBar` dependency/rendering from registry;
   - introduce focused list-state/query serializer and `EntityLocatorBar`,
     `ActiveFiltersBar`, `ListRangeStatus`;
   - keep create/refresh in first non-wrapping row;
   - implement 250 ms draft/applied search, immediate filters and stale-request
     protection;
   - implement page reset/preserve/clamp rules;
   - add the group-specific TASK-017-style snapshot and exact return routing;
   - distinguish first-run empty, filtered/search empty, loading, stale refresh
     and error/retry.
10. Render the exact approved fields in compact mobile rows, one-column
    tablet rows and desktop table-like grid; keep edit visible and at least
    `44 x 44`.
11. Add explicit `/schedule/groups` regression coverage around the shared query,
    then run focused tests after each slice, full backend suite, frontend
    unit/lint/build and affected Playwright/iPhone WebKit checks.

## Preferred implementation strategy
1. Contract-first backend tests and envelope.
2. Typed frontend adapter.
3. Locator/filter/paging state.
4. Responsive card hierarchy.
5. Return-state and multi-role regression closure.

## Files likely to change
- `backend/src/GymCrm.Api/Auth/GroupEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/TrainingGroupListQuery.cs`
- `backend/src/GymCrm.Api/Auth/GroupRequestValidator.cs`
- `backend/src/GymCrm.Api/Auth/GroupApiConstants.cs`
- new backend groups list envelope DTO
- `backend/tests/GymCrm.Tests/GroupsApiTests.cs`
- `frontend/src/lib/api/groups.ts`
- `frontend/src/lib/api/groups.test.ts`
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/endpoints.ts`
- `frontend/src/App.tsx`
- `frontend/src/features/groups/GroupManagement.tsx`
- `frontend/src/features/groups/GroupManagement.test.tsx`
- new focused group list query/view-model files
- new `frontend/src/features/groups/groupListReturnState.ts`
- new group list-state/return-state unit tests
- `frontend/src/App.css`
- affected group/responsive Playwright specs and API fixtures

## Constraints
- Backend owns access scope and filter semantics; frontend never filters a page
  to simulate server results.
- HeadCoach/SuperAdministrator are global; Administrator is branch-scoped on
  every group-owned read/mutation; Coach remains forbidden.
- Do not delete `/groups/summary` unless repository search proves no consumers.
- Do not change group create/edit/trainer assignment semantics.
- Do not introduce an application-level query length limit.
- Production frontend accepts only the required list envelope after rollout.
- Keep both paging families for existing consumers but reject mixed-family
  requests.
- Query normalization must be deterministic; total is after scope/search/filter
  and before paging.
- Keep `/schedule/groups` behavior unchanged.
- Reuse TASK-017 behavior and safety boundaries, not its client-specific schema;
  do not expand this task into a generic router rewrite.
- No summary widgets at any target width.

## Out of scope
- Group form redesign.
- Trainer assignment/substitution domain changes.
- Frontend-generated branch scope or unauthorized option discovery.
- Client list workflows.
- Generic return-state framework or persistence across independent tabs/devices.
- Group create/cancel return-state.

## Required test coverage

### Unit tests
- Frontend query serialization, strict envelope mapping and array rejection.
- Group list UI draft/applied query, immediate filters, reset and paging state.
- Range/pagination view model including last-page clamping.
- Versioned group return-state serialization, sanitization, route allowlist,
  unrelated-key preservation and pending-draft capture.

### Integration tests
- Backend endpoint filter/paging/total/access matrix is written before backend
  code and covers global vs branch-scoped group management.
- Backend schedule regression proves shared query changes do not affect
  `/schedule/groups`.
- Frontend component tests verify API arguments, no local page filtering and
  operational-state preservation, stale request protection and at-most-one
  corrective clamp request.
- App/group integration verifies browser Back, edit CTA and successful-save
  return to the origin list entry without duplicate history.
- Each red slice must fail for the expected missing contract before production changes.

### UI/e2e tests
- 30+ group primary path search→filters→page→edit→browser Back→edit→save→reset.
- Restored query/filters/page/anchor/scroll/focus and no duplicate `/groups`
  entry on explicit return.
- Administrator cannot observe or open a foreign-branch group; direct foreign
  mutation remains forbidden.
- SuperAdministrator multi-branch data and allowed actions.
- First visible locator, no summary, required min search widths, edit target and
  no horizontal overflow.
- Desktop table-like columns contain only the approved registry fields.
- Loading, first-run empty, scoped empty and retry preserve context.

## Test plan
- [ ] Backend endpoint tests red before implementation.
- [ ] API/component tests red before implementation.
- [ ] Playwright primary and return-state tests red before implementation.
- [ ] `dotnet test backend/GymCrm.slnx`
- [ ] `npm run test:unit`
- [ ] affected Playwright and `test:e2e:iphone`
- [ ] `npm run lint`
- [ ] `npm run build`

## Regression barrier
Backend integration tests must prove filtering before count/paging and stable
scoped totals, global HeadCoach/SuperAdministrator behavior, Administrator
branch isolation, direct-target protection and unchanged schedule results.
Frontend API/component/Playwright tests must prove strict envelope consumption,
no client-side page filtering, summary removal, honest range/paging with clamp,
state restoration and no duplicate return history.

## Risks
- Envelope change can break numerous mocked consumers if fixtures are not updated.
- Incorrect count/filter order can leak totals or create inconsistent pages.
- Applying scope only to the list would leave direct foreign-group reads or
  mutations reachable.
- Group and client return-state namespaces can overwrite or leak into unrelated
  routes if history-state merge/drop rules are not explicit.
- Last-page correction can loop if it is not limited to one request per response.
- Shared query changes can silently alter schedule data.

## Stop conditions
Остановиться, если:
- authenticated Administrator branch cannot be resolved from the established
  backend session/user contract;
- applying the resolved scope consistently would require changing group domain
  semantics rather than authorization/query boundaries;
- state preservation requires unbounded global routing redesign;
- another consumer requires an incompatible `/groups` contract without a safe
  compatibility layer;
- task worktree or branch is invalid.

## Ready for Codex execution
no — implementation completed
