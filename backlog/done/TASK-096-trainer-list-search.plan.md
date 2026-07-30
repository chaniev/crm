# Implementation Plan: TASK-096 Добавить поиск в список тренеров

## Source task
/backlog/done/TASK-096-trainer-list-search.md

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
  user create/edit routes; он может хранить trainer query без app-wide store
  или history/deep-link persistence.
- Existing component test covers non-filtering of backend-permitted non-Coach
  payloads and edit allowed actions, but not search/states/return flow.

## UX/UI contract
- First visible row: search → clear (when present) → refresh → create; no filter
  trigger or dummy drawer.
- Accessible name: `Найти тренера`; placeholder: `ФИО или логин`.
- Normalize with `trim().toLocaleLowerCase('ru-RU')`; match substring in
  `fullName` or `login` only.
- Create is shown for any non-empty backend `createRoleOptions`, regardless of
  which allowed role it contains; row edit only from existing `allowedActions`.
- Match the released Clients/Groups list-return behavior at the UX level:
  preserve query through list → create/edit → explicit or browser back; reset it
  when leaving the Users workflow, on logout or full reload.
- Locator remains visible and editable through loading/error. Refresh/retry is
  disabled while a request is pending and never clears query.
- Initial load without retained items uses a blocking loading state. Refresh
  keeps the last backend-permitted filtered results visible, marks the results
  region busy and exposes request progress without presenting stale data as a
  completed refresh.
- Initial failure without retained items uses blocking `ErrorState`; failed
  refresh with retained items uses an inline stale-error beside the still
  visible results. Both error paths provide an explicit `Повторить` action and
  retain query.
- Blank query plus an empty backend response is first-run empty. Any non-blank
  query with zero matches, including an empty backend response, is
  query-scoped `Тренеры не найдены` with an explicit clear action.

## Dependencies and execution order
1. TASK-090 — done.
2. TASK-084 — touch/compact-height foundation должна быть merged.
3. TASK-094 — shared locator/filter surface baseline должна быть merged.
4. TASK-093 — optional no-filter locator and action recipe должна быть merged.
5. TASK-096.
6. TASK-086 is not a code dependency. Reuse its list-return UX semantics, but
   keep trainer query local to `RouteViewport`; do not add a trainer history
   serializer, reload persistence or generic return-state refactor.

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
   - blank-query first-run empty vs non-blank `Тренеры не найдены` with clear,
     including when the backend response itself is empty;
   - non-empty query through initial loading, stale refresh, blocking/stale
     errors and explicit retry;
   - refresh keeps retained backend-permitted results, marks them busy and
     disables duplicate refresh/retry;
   - `createRoleOptions=[]` hides create; any non-empty option set shows it,
     including Coach and a representative non-Coach role;
   - per-item allowed edit/read-only semantics unchanged.
4. До production-кода добавить App/route integration test for local query
   ownership: search → open create/edit → explicit/browser return → same query
   and result; leaving the Users workflow or remounting after full reload resets
   query; other user mutations/forms remain unchanged.
5. До production-кода add Playwright primary path and geometry:
   - find by full name/login;
   - clear/no-match;
   - edit/back restore;
   - blocking/stale error recovery with query and explicit `Повторить`;
   - `360 x 780` narrow-width guardrail plus `390 x 844`, target iPhone,
     compact-height, tablet and desktop geometry;
   - search min widths, one row, `44px` actions, keyboard/focus and no unintended
     horizontal overflow.
6. Run new tests and confirm expected failures because locator/search helper,
   empty-search and return-state integration do not exist.
7. Implement pure normalized filtering over the already received `items`;
   never refetch or infer hidden/unauthorized trainers from query.
8. Consume full `UserListResponse`: keep items and `createRoleOptions`, and
   render shared create action when backend returns any non-empty allowed role
   set.
9. Replace `users-list-toolbar` with no-filter `EntityLocatorBar` using shared
   refresh/create actions; connect it to a named results region via
   `aria-controls`/`aria-busy`.
10. Keep query in the smallest existing parent that survives list→edit→return
    (`RouteViewport` controlled props preferred); retain it only while the route
    remains in the Users list/create/edit workflow and do not add a global
    store, history serializer or reload/deep-link persistence.
11. Render filtered results and scoped empty-search recovery while preserving
    backend order. Keep retained results during refresh, distinguish blocking
    from stale error, and wire explicit `Повторить` to the same safe reload
    operation without clearing query.
12. Run focused red→green tests, full unit/raw-color/lint/build, users/responsive
    Playwright, target iPhone WebKit checks and Simulator/physical-device
    acceptance evidence.

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
- `frontend/src/lib/resources.ts` if the new empty/recovery copy is centralized
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
- Create visibility is exactly `createRoleOptions.length > 0`; frontend must not
  special-case Coach or infer a role permission.
- No new global store; do not persist PII beyond existing route lifetime.
- Query is local to the Users list/create/edit workflow and resets outside it.
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
- Component tests for locator, blocking/stale states, explicit retry, refresh
  and backend-owned actions.
- App route test for search→create/edit→return persistence and reset outside the
  Users workflow/full reload.
- Backend integration tests are not applicable because `/users` contract and
  authorization are unchanged.
- All new tests are written before functional code and must first fail for the
  missing search/state behavior.

### UI/e2e tests
- Primary find→edit→return path, no match→clear and error→retry.
- Backend create denied/allowed and protected target edit behavior.
- `360 x 780` narrow guardrail; `390 x 844`, `420 x 912`, `440 x 956`,
  `912 x 420`, `956 x 440`, `768 x 1024` and `1440 x 1200` geometry with no
  unintended horizontal page scroll.
- Focus order, accessible names, keyboard clear and software-keyboard reachability.
- Browser chrome, software keyboard, safe-area and home-indicator acceptance
  requires recorded iOS Simulator or physical-device evidence; Playwright
  geometry alone is insufficient.

## Test plan
- [x] Pure search tests red before implementation.
- [x] Component and App route tests red before implementation.
- [x] Users/geometry Playwright tests red before implementation.
- [x] `cd frontend && npm run test:unit`
- [x] `cd frontend && npm run check:raw-colors`
- [x] `cd frontend && npm run test:e2e -- e2e/users.spec.ts e2e/responsive-main-screens.spec.ts`
- [x] `cd frontend && npm run test:e2e:iphone`
- [x] Record iOS Simulator or physical-device evidence with Safari chrome and
      software keyboard open at target portrait sizes; verify focused search,
      recovery feedback, refresh/create actions and one intentional-scroll
      reachability.
- [x] Record compact-height Simulator/physical-device smoke evidence for
      `912 x 420` and `956 x 440`.
- [x] `cd frontend && npm run lint`
- [x] `cd frontend && npm run build`

## Regression barrier
Pure matching tests plus an automated search→edit→return scenario must prove
trimmed case-insensitive fullName/login matching, preserved backend order/query,
scoped empty recovery, blocking/stale retry and unchanged backend-owned
create/edit visibility. The `360 x 780` guardrail and target-device geometry
prevent a dummy filter, wrapped toolbar or unusable locator. TASK-096 cannot be
marked accepted without Simulator or physical-device evidence for changing
Safari viewport, software keyboard and safe areas.

## Risks
- Lowercasing/normalization can accidentally change displayed order or data.
- Route-local persistence can expand into a generic global navigation refactor.
- Discarding `createRoleOptions` would preserve the current permission leak in UI.
- Loading implementation can mislabel a pending refresh as empty results.
- Retained results can look current after a failed refresh unless busy/stale
  feedback remains explicit.

## Stop conditions
Остановиться, если:
- final shared no-filter locator/action API from TASK-093 is unavailable;
- search would require backend contract or permission changes;
- persistence requires a new global store or unrelated routing redesign;
- allowed create/edit semantics cannot be derived from existing backend response;
- task worktree/branch is invalid.

Do not close the task as accepted if iOS Simulator or physical-device evidence
for Safari chrome, software keyboard and safe-area reachability is unavailable.

## Ready for Codex execution
no — completed 2026-07-30 in commit `a9d3098`

## Completion record
- Source task moved to `/backlog/done/TASK-096-trainer-list-search.md`.
- Integrated `main` validation passed: lint, build, raw-color check, 404 unit tests and 202 Playwright tests.
- Actual iPhone Air Simulator acceptance passed with Safari chrome/safe areas, software keyboard, typed filtering and compact-height landscape reachability.
- No backend or database contract changed; no migration is required.
