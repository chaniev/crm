# Implementation Plan: TASK-096 Добавить поиск в список тренеров

## Source task
/backlog/implementation/TASK-096-trainer-list-search.md

## Implementation branch
feature/TASK-096-trainer-list-search

Branch rules:
- перед кодом использовать `.agents/skills/task-worktree/SKILL.md` и отдельный
  worktree из актуального `origin/main`;
- подтвердить clean status и active branch;
- не менять backend `/users`, roles, permissions, create/edit forms или group
  search из TASK-086;
- использовать shared surface/action API from TASK-094/TASK-093 без
  trainer-specific toolbar CSS.

## Goal
Добавить постоянно видимый local locator по ФИО/логину к backend-permitted
списку тренеров, сохранить query при edit/back и отделить first-run empty от
empty-search без нового global state или backend contract.

## Current understanding
- `UsersListScreen` получает `UserListResponse`, но сохраняет только `items`;
  toolbar содержит create/refresh и не имеет locator.
- Backend `/users` уже возвращает только разрешённый trainer-family list,
  stable ordered by full name/login, `createRoleOptions` и per-item
  `allowedActions`.
- `EntityLocatorBar` реализует min search widths, clear, action slots and
  `aria-controls`, но current API всегда рендерит filter trigger.
- `RouteViewport` остаётся local authenticated composition owner между list и
  user edit routes; он может хранить trainer query без app-wide store.
- Existing component test covers non-filtering of backend-permitted non-Coach
  payloads and edit allowed actions, but not search/states/return flow.

## UX/UI contract
- First visible row: search → clear (when present) → refresh → create; no filter
  trigger or dummy drawer.
- Accessible name: `Найти тренера`; placeholder: `ФИО или логин`.
- Normalize with `trim().toLocaleLowerCase('ru-RU')`; match substring in
  `fullName` or `login` only.
- Create is shown only from backend `createRoleOptions`; row edit only from
  existing `allowedActions`.
- Locator remains visible through loading/error; refresh/retry and edit/back do
  not clear query.
- First-run empty and query-scoped `Тренеры не найдены` are separate states;
  empty-search includes explicit clear action.

## Dependencies and execution order
1. TASK-090 — done.
2. TASK-084 — touch/compact-height foundation должна быть merged.
3. TASK-094 — shared locator/filter surface baseline должна быть merged.
4. TASK-093 — optional no-filter locator and action recipe должна быть merged.
5. TASK-096.
6. TASK-086 is not a code dependency; reuse a generic merged return-state utility
   only if it exists, otherwise keep trainer query local to `RouteViewport`.

## Execution steps
1. Создать isolated worktree, inspect final shared APIs and record baseline
   Users component/e2e tests.
2. До production-кода добавить pure unit tests for a focused search helper:
   - partial full-name and login matches;
   - case-insensitive Russian/Latin behavior;
   - external trim and blank query;
   - original backend order preserved;
   - hidden/nonmatching data fields do not participate.
3. До production-кода расширить `UsersListScreen` component tests:
   - locator label/placeholder, no filter trigger;
   - clear restores full backend-permitted list;
   - first-run empty vs empty-search with clear action;
   - non-empty query through loading, refresh, error and retry;
   - `createRoleOptions=[]` hides create, Coach option shows it;
   - per-item allowed edit/read-only semantics unchanged.
4. До production-кода добавить App/route integration test for local query
   ownership: search → open edit → return → same query and result; other user
   mutations/forms remain unchanged.
5. До production-кода add Playwright primary path and geometry:
   - find by full name/login;
   - clear/no-match;
   - edit/back restore;
   - refresh/error recovery with query;
   - search min widths, one row, `44px` actions, keyboard/focus and no overflow.
6. Run new tests and confirm expected failures because locator/search helper,
   empty-search and return-state integration do not exist.
7. Implement pure normalized filtering over the already received `items`;
   never refetch or infer hidden/unauthorized trainers from query.
8. Consume full `UserListResponse`: keep items and `createRoleOptions`, and
   render shared create action only when backend returns an allowed create role.
9. Replace `users-list-toolbar` with no-filter `EntityLocatorBar` using shared
   refresh/create actions; connect it to a named results region via
   `aria-controls`/`aria-busy`.
10. Keep query in the smallest existing parent that survives list→edit→return
    (`RouteViewport` controlled props preferred); do not add global store or
    persistence beyond authenticated route lifetime.
11. Render filtered results and scoped empty-search recovery while preserving
    loading/error/first-run/list semantics and backend order.
12. Run focused red→green tests, full unit/raw-color/lint/build, users/responsive
    Playwright and target iPhone WebKit checks.

## Preferred implementation strategy
1. Pure search tests/helper.
2. Controlled local query/return state.
3. Shared no-filter locator composition.
4. Operational states and backend permission consumption.
5. Mobile/browser regression closure.

## Files likely to change
- `frontend/src/features/users/UsersListScreen.tsx`
- new `frontend/src/features/users/trainerListSearch.ts`
- new `frontend/src/features/users/trainerListSearch.test.ts`
- `frontend/src/features/users/UserManagement.test.tsx`
- `frontend/src/features/users/UserManagement.tsx` only if exports/props require it
- `frontend/src/App.tsx`
- App/route integration test location discovered before editing
- `frontend/src/App.css` only to remove old `users-list-toolbar` CSS or add
  truly feature-specific results geometry
- `frontend/e2e/users.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`
- `frontend/e2e/iphone-target-devices.spec.ts`

## Constraints
- Filter only the current backend response; no frontend permission/role inference.
- No new backend search/paging/filter endpoint.
- Search fields are exactly visible `fullName` and `login`.
- No filters button/drawer on Trainers.
- Create remains the single primary action; refresh is frequent secondary.
- No new global store; do not persist PII beyond existing route lifetime.
- Mantine, Onest, shared locator/actions and `44px` targets are mandatory.

## Out of scope
- Group search from TASK-086.
- Server-side trainer search, paging or new query contract.
- Trainer create/edit form or card redesign.
- New search fields, roles, permissions or access scope.
- Durable reload/deep-link query unless separately approved.

## Required test coverage

### Unit tests
- Normalization/matching/order for fullName and login.
- Blank/trim/case behavior and no matching on hidden fields.

### Integration tests
- Component tests for locator, states, refresh and backend-owned actions.
- App route test for search→edit→return persistence.
- Backend integration tests are not applicable because `/users` contract and
  authorization are unchanged.
- All new tests are written before functional code and must first fail for the
  missing search/state behavior.

### UI/e2e tests
- Primary find→edit→return path, no match→clear and error→retry.
- Backend create denied/allowed and protected target edit behavior.
- Required mobile/tablet/desktop/compact-height geometry and no page scroll.
- Focus order, accessible names, keyboard clear and software-keyboard reachability.

## Test plan
- [ ] Pure search tests red before implementation.
- [ ] Component and App route tests red before implementation.
- [ ] Users/geometry Playwright tests red before implementation.
- [ ] `cd frontend && npm run test:unit`
- [ ] `cd frontend && npm run check:raw-colors`
- [ ] `cd frontend && npm run test:e2e -- e2e/users.spec.ts e2e/responsive-main-screens.spec.ts`
- [ ] `cd frontend && npm run test:e2e:iphone`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`

## Regression barrier
Pure matching tests plus an automated search→edit→return scenario must prove
trimmed case-insensitive fullName/login matching, preserved backend order/query,
scoped empty recovery and unchanged backend-owned create/edit visibility. Target
device geometry prevents a dummy filter, wrapped toolbar or unusable locator.

## Risks
- Lowercasing/normalization can accidentally change displayed order or data.
- Route-local persistence can expand into a generic global navigation refactor.
- Discarding `createRoleOptions` would preserve the current permission leak in UI.
- Loading implementation can mislabel a pending refresh as empty results.

## Stop conditions
Остановиться, если:
- final shared no-filter locator/action API from TASK-093 is unavailable;
- search would require backend contract or permission changes;
- persistence requires a new global store or unrelated routing redesign;
- allowed create/edit semantics cannot be derived from existing backend response;
- task worktree/branch is invalid.

## Ready for Codex execution
yes, after TASK-084, TASK-094 and TASK-093 are merged into origin/main
