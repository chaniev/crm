# Implementation Plan: TASK-086 Добавить mobile-first поиск, фильтры и paging списка групп

## Source task
/backlog/implementation/TASK-086-mobile-groups-search-filter-paging.md

## Implementation branch
feature/TASK-086-mobile-groups-search-filter-paging

Branch rules:
- использовать `.agents/skills/task-worktree/SKILL.md` и отдельный worktree из
  актуального `origin/main`;
- проверить clean status, branch ownership и base before code;
- не менять group create/edit business rules, substitutions или summary endpoint
  consumers вне registry;
- cross-layer backend/frontend contract changes остаются в этой одной task branch.

## Goal
Заменить длинный groups registry на locator-first workflow с server-side
trimmed search, active/without-trainer filters, honest `{items,totalCount,skip,take}`
envelope и page-based pagination `pageSize=10`, сохранив backend access scope и
все required group decision data.

## Current understanding
- `/groups` защищён backend `ManageGroups`, но сейчас принимает только `isActive`
  и возвращает массив после paging без `totalCount`.
- `TrainingGroupListQuery` уже централизует ordered page loading.
- Frontend `getGroups` умеет читать envelope и временно поддерживает array
  payload, но `GroupsListScreen` запрашивает до 50 элементов и отдельно загружает
  `GroupsSummaryBar`.
- Existing component tests закрепляют summary behavior и должны быть заменены
  registry contract tests.
- UX contract source task approved; `ux-researcher` and `ui-designer` before
  implementation confirm only responsive/component handoff.

## Execution steps
1. Подготовить isolated worktree and capture current consumers/fixtures of
   `/groups` and `/groups/summary`.
2. До production-кода добавить backend integration tests in `GroupsApiTests`:
   - trimmed case-insensitive contains query;
   - `isActive=true/false/absent`, `withoutTrainer=true/absent`;
   - combined filters applied before count/paging;
   - stable ordering/total, page and skip/take validation;
   - SuperAdministrator multi-branch result context and unchanged authorization.
3. До production-кода добавить frontend API unit tests:
   - exact query serialization;
   - strict envelope mapping;
   - compatibility behavior for existing consumers during coordinated rollout;
   - no client-side filtering of a page.
4. До production-кода replace summary-oriented component tests with locator,
   filters, range, paging, retry and scoped reset tests; add pure group list
   query/view-model tests.
5. До production-кода add Playwright integration scenarios for 30+ groups,
   edit/return state, multi-branch SuperAdministrator and target geometry.
6. Run all new tests and record expected failures on the array backend response,
   missing query/withoutTrainer filters, summary-first UI and absent paging.
7. Backend green slice:
   - add a required list envelope response DTO;
   - normalize/validate query inputs without changing domain rules;
   - extend `TrainingGroupListQuery` with server-side name/active/trainer filters;
   - count filtered scoped query before `Skip/Take`;
   - return envelope with deterministic ordering.
8. Frontend contract slice:
   - extend typed query params/keys and make registry use `pageSize=10`;
   - update all affected fixtures/consumers for envelope without deriving totals
     from current page;
   - retain temporary array compatibility only if another in-repo consumer
     demonstrably needs coordinated transition.
9. Frontend workflow slice:
   - remove `GroupsSummaryBar` dependency/rendering from registry;
   - introduce focused list-state/query serializer and `EntityLocatorBar`,
     `ActiveFiltersBar`, `ListRangeStatus`;
   - keep create/refresh in first non-wrapping row;
   - preserve query/filter/page after edit/back through URL/history state, or
     reuse the merged TASK-017 utility if it provides a generic safe mechanism;
   - distinguish first-run empty, filtered/search empty, loading and error/retry.
10. Render denser responsive group cards/rows with branch, hall, schedule,
    trainers, status and `44 x 44` edit action; keep filter option data limited
    to backend-provided data.
11. Run focused tests after each slice, full backend suite, frontend unit/lint/
    build and affected Playwright/iPhone WebKit checks.

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
- `frontend/src/features/groups/GroupManagement.tsx`
- `frontend/src/features/groups/GroupManagement.test.tsx`
- new focused group list state/view-model files if needed
- `frontend/src/App.css`
- affected group/responsive Playwright specs and API fixtures

## Constraints
- Backend owns access scope and filter semantics; frontend never filters a page
  to simulate server results.
- Do not delete `/groups/summary` unless repository search proves no consumers.
- Do not change group create/edit/trainer assignment semantics.
- Query normalization must be deterministic; total is after scope/search/filter
  and before paging.
- No summary widgets at any target width.

## Out of scope
- Group form redesign.
- Trainer assignment/substitution domain changes.
- Frontend-generated branch scope or unauthorized option discovery.
- Client list workflows.

## Required test coverage

### Unit tests
- Frontend query serialization and envelope mapping.
- Group list UI query/reset/page state.
- Range/pagination view model and return-state serialization if extracted.

### Integration tests
- Backend endpoint filter/paging/total/access matrix is written before backend code.
- Frontend component tests verify API arguments, no local page filtering and
  operational-state preservation.
- Each red slice must fail for the expected missing contract before production changes.

### UI/e2e tests
- 30+ group primary path search→filters→page→edit→back→reset.
- SuperAdministrator multi-branch data and allowed actions.
- First visible locator, no summary, required min search widths, edit target and
  no horizontal overflow.
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
scoped totals. Frontend API/component/Playwright tests must prove no client-side
page filtering, summary removal, honest range/paging, state restoration and
SuperAdministrator multi-branch behavior.

## Risks
- Envelope change can break numerous mocked consumers if fixtures are not updated.
- Incorrect count/filter order can leak totals or create inconsistent pages.
- Return-state implementation can expand into global routing redesign.

## Stop conditions
Остановиться, если:
- backend access scope for `/groups` cannot be determined from current policies;
- required filter option data would expose unauthorized entities;
- state preservation requires unbounded global routing redesign;
- another consumer requires an incompatible `/groups` contract without a safe
  compatibility layer;
- task worktree or branch is invalid.

## Ready for Codex execution
yes
