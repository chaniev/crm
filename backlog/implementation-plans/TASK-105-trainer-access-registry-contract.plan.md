# Implementation Plan: TASK-105 Довести реестр тренеров до access-management workflow

## Source task
/backlog/risky/TASK-105-trainer-access-registry-contract.md

Карточка остаётся в `/backlog/risky`: этот файл подготавливает high-risk
cross-layer изменение, но не переводит его в активное исполнение. Продуктовые
решения закрыты, однако запуск реализации требует отдельного human review из-за
атомарного переименования защищённого HTTP/browser contract без legacy alias.

## Implementation branch
feature/TASK-105-trainer-access-registry-contract

Branch rules:
- перед изменением project code использовать
  `.agents/skills/task-worktree/SKILL.md` и создать либо безопасно возобновить
  отдельный worktree
  `../crm-worktrees/TASK-105-trainer-access-registry-contract`;
- создать branch непосредственно от актуального `origin/main`; primary
  repository оставить на `main`, а код менять только в task worktree;
- до первой правки подтвердить registered worktree, active branch, отсутствие
  unexplained changes и `git merge-base --is-ancestor origin/main HEAD`;
- не включать другие staff, settings, navigation или visual-refactor TASKs;
- backend route, frontend API consumer и browser routes должны находиться в
  одной branch и выпускаться/откатываться как один согласованный contract;
- не добавлять временный `/users` alias: он прямо исключён продуктовым
  контрактом TASK-105.

Planning snapshot на 2026-08-19: primary repository находится на clean local
`main` `ad81fb1723aff17f266b77e5448a2d414745ae58`, который на 10 commits
опережает локальный `origin/main` `921e17340922ebdab701d76fa671387e57577115`.
`origin/main` уже содержит завершённые TASK-096 и TASK-098. Локальной/remote
branch TASK-105 и назначенного ей worktree не найдено. Executor обязан сделать
`git fetch origin`, повторить preflight и не считать planning snapshot
актуальным execution base.

## Goal
HeadCoach или SuperAdministrator открывает trainer-only реестр на canonical
`/coaches`, локально отбирает отключённых тренеров и/или тренеров с обязательной
сменой пароля, затем открывает разрешённое backend-ом редактирование через один
row target. Старый frontend/API path `/users` больше не обслуживает trainer
workflow, а access, validation, audit, CSRF и ProblemDetails semantics остаются
неизменными.

## Current understanding
- Продуктовые решения, canonical paths, filter dimensions, Telegram treatment,
  row operation и access matrix подтверждены; clarification questions нет.
- Backend `UserEndpoints` уже является trainer-only boundary: list/details
  ограничены `UserRole.Coach`, create/update используют
  `StaffEndpointRoleFamily.Trainers`, а `allowedActions` вычисляет backend.
- HeadCoach и SuperAdministrator уже имеют доступ; Administrator и Coach уже
  получают deterministic `staff_management_forbidden`. Эти правила не меняются.
- Administrator/SuperAdministrator management остаётся на
  `/settings/administrators`; общий `User` domain/database model остаётся общим.
- Backend contract rename локализован в route group и created `Location`, но
  затрагивает весь `UsersApiTests`/CSRF HTTP inventory.
- Frontend browser paths сосредоточены в `appRoutes.ts`; `AppSection.Users`,
  `canManageUsers`, route kinds `userCreate/userEdit`, feature directory
  `features/users` и generic DTO/function names могут остаться внутренними.
- Frontend API transport получает path из `API_ENDPOINTS.users`; transport
  mapper и payload shape менять не требуется.
- `UsersWorkflowViewport` уже сохраняет query между list/create/edit и
  размонтируется после выхода из workflow. Здесь же следует хранить два filter
  dimensions и return-focus snapshot, не вводя global store.
- `EntityLocatorBar` уже поддерживает filter trigger/count и single-row action
  layout; `ActiveFiltersBar`, Mantine `Drawer`, `Select` и
  `TemporarySurfaceFooter` уже выпущены в соседних registry workflows.
- Текущий `canEditUser` опасно считает отсутствующий `allowedActions`
  разрешением на edit. TASK-105 должен fail closed: только `Edit`/`Update`
  создаёт mutation target.
- TASK-096 search и TASK-098 exception badges являются обязательным baseline;
  server-side filtering, pagination, role/Telegram filters не нужны.
- Database/schema, bot и deploy contracts не меняются; migration не требуется.

## Canonical contract

| Surface | Canonical value | Legacy outcome |
|---|---|---|
| Frontend list | `/coaches` | `/users` -> not-found, без redirect/alias |
| Frontend create | `/coaches/new` | `/users/new` -> not-found |
| Frontend edit | `/coaches/{id}/edit` | `/users/{id}/edit` -> not-found |
| Backend list/create | `/coaches` | `/users` -> unmapped `404` |
| Backend details/update | `/coaches/{id}` | `/users/{id}` -> unmapped `404` |
| Frontend API URL | `/api/coaches...` | `/api/users...` не вызывается |

Invariants:
- list/details/create/update остаются trainer-only;
- response содержит только `Coach` и backend-owned `allowedActions`;
- access остаётся только у HeadCoach/SuperAdministrator;
- validation keys, ProblemDetails codes/types, CSRF и audit payloads не
  переименовываются из `User` только ради route cosmetics;
- created response `Location` использует `/coaches/{id}`;
- deployment и rollback меняют backend и frontend вместе.

## UX contract used
- Users: HeadCoach и SuperAdministrator; Administrator/Coach видят существующий
  permission-restricted route/API outcome.
- Device context: быстрый one-handed operational workflow с design baseline
  `390 x 844`, target iPhone `420 x 912` и `440 x 956`, compact-height
  `912 x 420` и `956 x 440`.
- Primary path: `/coaches` -> optional search -> filters -> выбрать один/два
  exception states -> открыть editable row -> `/coaches/{id}/edit` -> back/save
  -> тот же список, criteria и focus target.
- Completion signal: edit form загружена для выбранного Coach; после возврата
  search/filters сохранены, а фокус возвращён на строку либо определённый
  recovery target.
- Required decision data: ФИО, логин, optional Telegram ID, `Отключен`,
  `Требуется смена пароля`, defensive `Только просмотр`.
- Primary operation: editable trainer row. Frequent: search, filters, refresh.
  Secondary: create, clear search, remove/reset filters. Exceptional list
  operations отсутствуют.
- Unmapped controls: role filter, Telegram filter, missing-Telegram marker,
  positive badges `Тренер`, `Активен`, `Пароль актуален`.

## UI specification

### List hierarchy
1. Existing `PageLayout showHeader={false} title="Тренеры"` with semantic hidden
   `h1`; не добавлять visible duplicate heading/intro/metrics.
2. Plain controls section with `EntityLocatorBar`.
3. `ActiveFiltersBar`, only when status/password filters are active.
4. Results region with stable id `coaches-results`, label
   `Результаты поиска тренеров` and explicit busy/focus behavior.
5. Loading, blocking error, stale error, empty/filtered-empty or trainer rows.

`EntityLocatorBar`, left to right:
- search accessible name `Найти тренера`, placeholder `ФИО или логин`;
- filter trigger: `Открыть фильтры` or
  `Открыть фильтры, активно {1|2}`;
- existing refresh action `Обновить`;
- `Создать тренера`, only when backend `createRoleOptions` is non-empty.

Filter count includes only non-default status/password dimensions; search is
visible in the locator and is never counted as a filter.

### Filter state and projection
Use two explicit local values:
- status: `all | inactive`;
- password: `all | mustChange`.

Extend the pure trainer-list projection so it preserves backend order and keeps
the predicate explicit:
`searchMatch AND statusMatch AND passwordMatch`.

Rules:
- `inactive` means `isActive === false`;
- `mustChange` means `mustChangePassword === true`;
- both active values must match simultaneously;
- role and Telegram are never predicate inputs;
- reset changes both dimensions to `all` and does not mutate query;
- refresh/retry only replace server response, not query/filter state.

### Filter Drawer
Reuse the released Groups bottom-Drawer pattern:
- Mantine `Drawer`, `position="bottom"`, title `Фильтры тренеров`;
- close accessible name `Закрыть фильтры тренеров`;
- `returnFocus`, `trapFocus`, `closeOnEscape`, `closeOnClickOutside`;
- overlay opacity `0.18`, blur `2`;
- `size="min(24rem, 100dvh)"`;
- scoped `coaches-filters-drawer__content/header/body/fields` classes;
- initial meaningful field is `Статус`; closing by `Готово`, Escape, overlay or
  close button returns focus to trigger, with search fallback if trigger is gone.

Fields:
- `Select` label `Статус`: `Все`, `Отключённые`;
- `Select` label `Пароль`: `Все`, `Требуется смена`;
- no role/Telegram controls.

Application is immediate on field change. `Готово` only closes. Sticky
`TemporarySurfaceFooter` contains primary `Готово` and secondary `Сбросить`;
reset keeps the Drawer open and updates both fields immediately.

### Active filters and empty recovery
`ActiveFiltersBar` appears below the locator only when at least one dimension
is active:
- chip `Отключённые` resets only status;
- chip `Требуется смена пароля` resets only password;
- `Сбросить фильтры` resets both and keeps query;
- no search chip.

Empty behavior:
- no response items, no query/filters: existing first-run empty state;
- query only: `Тренеры не найдены` + `Очистить поиск`;
- any filters, with or without query: `Тренеры не найдены` +
  `Сбросить фильтры`; if query still matches nothing after reset, transition to
  query-only empty state rather than clearing it implicitly;
- filtered-empty copy may say `Измените поисковый запрос или фильтры, чтобы
  расширить список.`; it must not imply that backend returned no trainers.

### Row contract
Editable row:
- exactly one native button-like target for the whole row;
- accessible name `Редактировать тренера «{fullName}»`;
- click/tap/Enter/Space opens `/coaches/{id}/edit`;
- `allowedActions` must explicitly include `Edit` or `Update`;
- full row touch area is at least `44px` high; target design min-height `64px`;
- mobile has no separate edit button;
- desktop may show trailing text/icon `Редактировать`, but it is presentation
  inside the same target, has no interactive semantics and adds no tab stop;
- visible focus/hover uses existing CRM tokens, not raw colors.

Read-only row:
- static non-focusable row/list item, no click/key handler and no pointer cursor;
- shown for empty, missing or non-edit `allowedActions`;
- contains `Только просмотр` and no edit control/cue.

All rows retain:
- full name and `Логин: {login}`;
- `Telegram ID: {id}` only when id exists;
- text exception badges `Отключен` and/or `Требуется смена пароля`;
- no normal positive badges and no missing-Telegram marker;
- a defensive non-Coach badge may remain only as anomaly coverage; canonical
  `/coaches` response is still asserted to contain only Coach.

Prefer a scoped trainer row element with native `<button type="button">`
semantics for editable rows and a static sibling element for read-only rows.
Do not nest a button/link inside the row target. If a shared primitive is used,
verify valid markup, propagation of test/data attributes and wrapping of long
content before extending it globally.

### Workflow state and focus return
Keep route-local state in `UsersWorkflowViewport`, not in a global store:
- query;
- status/password filters;
- selected trainer id;
- return scroll position.

Before edit navigation capture selected id and scroll. On explicit back,
browser back or successful save:
1. restore criteria before projecting response;
2. after async list response resolves, scroll selected visible row into view;
3. focus it only if it is still editable;
4. if it became read-only or disappeared, focus the results region
   (`tabIndex=-1`);
5. on blocking/empty recovery, prefer the visible recovery action;
6. final fallback is the search input;
7. consume the return-focus request once to avoid stealing later user focus.

Leaving the Users workflow unmounts this local state and resets it, preserving
TASK-096 behavior. Direct edit deep links have no synthetic source row and use
the normal list/search fallback on return.

### Operational states
- First load: existing `Загружаем тренеров...`; filter/query values remain in
  controls.
- Refresh with retained response: rows remain visible, results have
  `aria-busy`, polite `Обновляем список тренеров...` appears.
- Blocking error: `Список не загрузился` and exact retry; criteria preserved.
- Stale error: inline `Список не обновился`, retained filtered rows and retry;
  criteria preserved.
- Permission restriction continues through the existing typed route recovery;
  no unauthorized create/edit controls are rendered.
- Create/edit success notifications and form validation remain unchanged.

### Responsive contract
- `360 x 780`: search min width `156px`; filter/refresh/create are `44 x 44px`,
  8px apart, with visible labels collapsed but accessible names retained.
- `390 x 844`: search min width `176px`; this is the primary design stress
  baseline; locator remains a single row and active chips wrap below it.
- `420 x 912`: search min width `200px`; target iPhone Air portrait acceptance.
- `440 x 956`: search min width `216px`; target iPhone 17 Pro Max portrait;
  long identity content wraps without colliding with cue/status.
- `768 x 1024`: search min width `320px`; registry rows remain task-oriented,
  not a horizontally scrolling table.
- `1440 x 1200`: search min width `420px`; no summary cards/duplicate heading;
  optional desktop cue remains in the one row target.
- `912 x 420` and `956 x 440`: Drawer uses dynamic viewport, one scrollable
  fields body and sticky safe-area footer; close, both selects, reset/done and
  shell navigation remain reachable without nested scroll traps.
- All sizes: locator/filter/refresh/create never wrap, page has no unintended
  horizontal scroll, interactive targets are at least `44 x 44px`, long
  names/logins/Telegram IDs use `overflow-wrap:anywhere`.
- Input/select text stays at least `16px` on iPhone. Sticky footer combines
  normal spacing with `env(safe-area-inset-bottom)`.
- Playwright geometry is not proof of Safari chrome, visual viewport, keyboard,
  Dynamic Island/home indicator or one-handed reach; record Simulator/physical
  device residual evidence separately.

## Execution roles
1. Planning-stage `ux-researcher` handoff is complete: user task, control
   classes, failure/recovery paths and success criteria are fixed above.
2. Planning-stage `ui-designer` handoff is complete: Drawer, active filters,
   row semantics, focus return and responsive matrix are fixed above.
3. `test-automator` writes/updates all backend contract, frontend unit/component
   and Playwright regressions before any production code and records red
   evidence.
4. `dotnet-backend-specialist` performs the minimal endpoint path/Location
   change after backend red evidence, without altering staff rules.
5. `react-specialist` consumes this UX/UI contract and implements routes,
   local state, filters, row interaction and focus recovery using
   `react-best-practices` only after frontend red evidence.
6. Coordinating agent verifies worktree, atomic cross-layer result, test-first
   evidence and residual device risks.

## Execution steps

### Phase 0 — workspace and baseline
1. Run `git fetch origin`; reread root/backend/frontend `AGENTS.md`, source task,
   this plan, `task-worktree`, `crm-mobile-first-ui`, `react-best-practices` and
   `csharp-xunit` before their respective implementation/test work.
2. Create/resume the declared worktree and report verified path, branch, base,
   status and commit before edits.
3. Confirm `origin/main` contains TASK-096/TASK-098 search/row baseline, no
   competing TASK-105 branch and no unexplained worktree changes.
4. Capture baseline green focused backend/frontend tests and the current
   affected Playwright specs. Old `/users` assertions are expected to be green
   only at this baseline stage.
5. Do not start Docker: route/unit/component/WebApplicationFactory/Playwright
   red-green work does not require a Compose stack.

### Phase 1 — write all required tests before functional code
6. Update backend integration HTTP paths in `UsersApiTests.cs` from `/users` to
   `/coaches` before production code. Preserve and explicitly assert:
   - HeadCoach/SuperAdministrator list/create/details/update;
   - response items are only `Coach` with backend-owned actions/options;
   - Administrator/Coach receive the same deterministic `403` ProblemDetails;
   - administrative targets remain `staff_not_found` through trainer endpoint;
   - validation field keys, wrong-role denials, Telegram uniqueness, branch
     constraints, session sync, audit payload/count and rollback behavior;
   - created response `Location` is `/coaches/{id}`.
7. Add one explicit canonical-route integration theory which proves old
   `/users` list/details/create/update are unmapped `404` and do not mutate or
   write audit. Do not authenticate/validate through an accidental legacy
   handler.
8. Move the trainer scenario in `CsrfProtectionTests.cs` to `/coaches`; keep
   both missing and invalid-token assertions so the new state-changing route
   cannot bypass CSRF.
9. Update frontend API unit tests before production code to assert GET/details,
   POST and PUT request `/api/coaches...`, preserve payload mapping and never
   call `/api/users...`.
10. Update `appRoutes` unit tests before production code:
    - exact list/create/edit parse and serialization under `/coaches`;
    - `APP_SECTION_PATHS.Users === '/coaches'` while internal section remains
      `Users`;
    - `/users`, `/users/new`, `/users/{id}/edit` are not-found, not redirects;
    - direct/reload/back-forward-equivalent parsing, active navigation and
      permission recovery use `/coaches`.
11. Extend pure trainer-list unit tests before production code for status and
    password separately, both together, query + each/both filters with AND,
    backend-order preservation, active-count and no role/Telegram predicate.
12. Update `UsersListScreen` component tests before production code:
    - filter trigger/count, Drawer fields, immediate selection and focus return;
    - active chips, single removal, reset preserving query;
    - first-run/search/filter/search+filter empty recovery;
    - refresh, blocking and stale errors preserve query/filters;
    - exact row state matrix for normal, disabled, password, combined,
      Telegram-present, missing-Telegram, empty/missing actions and defensive
      non-Coach anomaly;
    - editable row is one native target with click/Enter/Space path;
    - read-only row is static; desktop cue is not another button/tab stop.
13. Update `App.test.tsx` and bootstrap route tests before production code:
    - list/create/edit returns and browser-path expectations are `/coaches`;
    - query + both filters survive list -> edit -> explicit back/save/browser
      back and reset after leaving workflow;
    - edited row focus is restored once, with results/search fallback;
    - session permission loss/recovery and unknown legacy `/users` outcome.
14. Update all Playwright consumers before production code:
    - `users.spec.ts` canonical browser/API routes, filters and row operation;
    - `responsive-main-screens.spec.ts` route inventory;
    - `touch-target-inventory.spec.ts` API mock and single-row target inventory;
    - `iphone-target-devices.spec.ts` API/browser routes, Drawer/landscape and
      target-device checks;
    - `membership-catalog-settings.spec.ts` shared trainer API mock.
15. Add route-level Playwright coverage for old `/users` not-found, direct
    `/coaches`/create/edit reload, explicit/browser back-forward, active nav,
    permission restriction, filter Drawer open/close/focus return, criteria
    retention and editable/read-only rows.

### Phase 2 — prove the expected red state
16. Run focused backend tests. Expected red reasons: `/coaches` is currently
    `404`, created `Location` is `/users/{id}`, and old `/users` is still mapped.
17. Run focused frontend unit/component/App tests. Expected red reasons:
    browser/API paths still use `/users`, no filter surface/state exists,
    editable row has a nested heavy button, and missing `allowedActions` is
    treated as editable.
18. Run affected Chromium Playwright specs. Expected red reasons must match the
    same route/filter/row contract, not fixture mistakes.
19. Save command/output evidence for each failure. Do not weaken a contract or
    change production code until backend integration, frontend unit/component
    and frontend integration/E2E tests have all been written and observed red.

### Phase 3 — backend canonical route
20. Change only the trainer endpoint group from `/users` to `/coaches` and the
    created `Location` to `/coaches/{id}`. Keep method names/types if renaming
    would be cosmetic.
21. Do not change `StaffManagementBoundary`, role family, permissions,
    validation, audit serializer, database `Users`, generic DTOs or
    `/settings/administrators`.
22. Rerun focused backend tests green, including old-route `404` and CSRF, then
    run the complete backend solution.

### Phase 4 — frontend canonical route/API
23. Change `API_ENDPOINTS.users.collection/byId` values to `/coaches...` while
    retaining internal symbol names unless a compiler-required change exists.
24. Change only path constants/patterns/serialization for `AppSection.Users`,
    userCreate and userEdit to `/coaches...`; do not rename backend-owned
    permission/section values.
25. Align App/bootstrap/Playwright fixtures and request mocks mechanically.
    Old `/users...` must resolve to the existing not-found state, never a hidden
    compatibility redirect.
26. Verify list/create/edit direct link, reload, navigation current state,
    explicit/browser back-forward and permission recovery before continuing.

### Phase 5 — local filters and operational states
27. Extend the pure local projection with typed status/password filters and
    active count. Derive filtered items during render; do not duplicate server
    data or use an effect for filtering.
28. Lift query, filters and return target into `UsersWorkflowViewport`; pass
    focused props/callbacks rather than adding global context/store.
29. Wire `EntityLocatorBar` filter trigger/count and existing refresh/create
    actions in the same non-wrapping row.
30. Add the specified bottom Drawer and `ActiveFiltersBar`, using immediate
    apply, dimension-only reset and existing tokens/safe-area footer.
31. Split first-run, search-only and filter-active empty recovery without
    clearing unrelated criteria.
32. Preserve response/loading/error cancellation behavior; obsolete requests
    must not overwrite current response and stale refresh must not clear state.

### Phase 6 — single row target and return focus
33. Replace the per-row edit button with one full-row native target only for
    explicit `Edit`/`Update`; fail closed for undefined/empty/other actions.
34. Keep static read-only row and exact exception metadata. Add only scoped row
    CSS needed for focus, hover, wrapping and responsive cue; do not alter
    unrelated `.list-row-card` consumers globally.
35. Capture selected id/scroll before navigation. Restore criteria first, then
    focus the returned editable row after data load; use the documented
    results/recovery/search fallbacks and consume the request once.
36. Verify one tab stop per editable row, zero edit tab stops for read-only row,
    native Enter/Space activation and no nested interactive descendants.

### Phase 7 — green and regression validation
37. Rerun all new focused tests green, then full backend/frontend suites, lint,
    raw-color check and production build.
38. Run affected Chromium Playwright specs and target-iPhone WebKit projects at
    `360 x 780`, `390 x 844`, `420 x 912`, `440 x 956`, `768 x 1024`,
    `1440 x 1200`, `912 x 420` and `956 x 440` as applicable.
39. Verify literal-route inventory with `rg -n '/users' backend frontend`:
    remaining matches may be only internal module/directory names such as
    `features/users` or `api/users`; no HTTP/browser route literal may remain.
40. Run a coordinated backend/frontend smoke only if the execution workflow
    requires it. If Compose is used, create a task-local project with free
    ports and `BOT_ENABLED=false`; never reuse another task stack.
41. Review final diff for accidental auth/permission/domain/model renames,
    unrelated E2E fixture changes, generated artifacts and legacy aliases.
42. Deploy and rollback backend/frontend artifacts together. If the runtime
    requires independent rolling compatibility, stop: adding a temporary
    `/users` alias would contradict the accepted product contract and needs a
    separate rollout decision.

## Preferred implementation strategy
1. One atomic task branch: all tests/red evidence -> minimal backend path ->
   frontend path/API -> local filters/row/focus -> green/regression evidence.
2. Contract-first path inventory and explicit negative legacy tests.
3. Backend-owned permissions/actions; frontend only projects returned items.
4. Minimal route-local state and render-time derivation, without global store.
5. Reuse EntityLocatorBar/ActiveFiltersBar/Drawer/footer and existing CRM
   tokens; use scoped row CSS.
6. No feature flag or compatibility alias. Coordinated release/rollback is the
   safety mechanism.

## Files likely to change

Backend production:
- `backend/src/GymCrm.Api/Auth/UserEndpoints.cs`

Backend integration tests:
- `backend/tests/GymCrm.Tests/UsersApiTests.cs`
- `backend/tests/GymCrm.Tests/CsrfProtectionTests.cs`

Frontend route/API production:
- `frontend/src/lib/api/endpoints.ts`
- `frontend/src/lib/appRoutes.ts`
- `frontend/src/App.tsx`

Frontend list production:
- `frontend/src/features/users/UsersListScreen.tsx`
- `frontend/src/features/users/trainerListSearch.ts`
- `frontend/src/lib/resources.ts` for filter/filtered-empty accessible copy only
- `frontend/src/App.css` for scoped trainer row/Drawer/responsive rules

Frontend unit/component/integration tests:
- `frontend/src/lib/api/users.test.ts`
- `frontend/src/lib/appRoutes.test.ts`
- `frontend/src/features/users/trainerListSearch.test.ts`
- `frontend/src/features/users/UserManagement.test.tsx`
- `frontend/src/App.test.tsx`
- `frontend/src/bootstrap/authBootstrap.test.tsx`

Frontend Playwright:
- `frontend/e2e/users.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`
- `frontend/e2e/touch-target-inventory.spec.ts`
- `frontend/e2e/iphone-target-devices.spec.ts`
- `frontend/e2e/membership-catalog-settings.spec.ts`

Conditional files:
- `frontend/src/features/shared/EntityLocatorBar.tsx` and its shared tests only
  if current focus fallback/trigger ref cannot be expressed by existing props;
  prefer a narrow ref/prop extension, not redesign.
- A focused `frontend/src/features/users/trainerListReturnState.ts` plus unit
  test may be added if query/filter/id/scroll ownership makes
  `UsersWorkflowViewport` unclear; do not copy server paging/query logic from
  Groups or introduce persistence outside the workflow.

No database, migration, bot or deploy production file is expected to change.

## Constraints
- Backend remains the sole source of truth for roles, access scope, trainer-only
  response, password/Telegram state and `allowedActions`.
- Frontend must not derive editability from role/status or default missing
  actions to editable.
- Route/API rename and all consumers are delivered atomically, with no alias.
- Preserve generic `User`, database `Users`, audit entity/action names,
  `canManageUsers`, `AppSection.Users`, DTOs and internal feature names unless a
  functional compiler/runtime dependency requires a local change.
- Preserve `/settings/administrators`, auth/session contract, validation,
  ProblemDetails and audit semantics.
- Search/filter is local over backend-permitted response; no server query,
  paging or alternate role scope.
- Search/filter/refresh/create remain one non-wrapping toolbar row; no
  horizontal toolbar/page scroll.
- Preserve Mantine, Onest, existing tokens, 44px targets, focus visibility,
  safe-area and dynamic-viewport patterns.
- Normal states remain visually quiet; exceptions are text, not color only.

## Out of scope
- Unified staff registry or administrators in trainer response.
- New access for Administrator/Coach or changes to HeadCoach/SuperAdministrator.
- Roles, permissions, password policy, Telegram linking or allowedActions rules.
- Role/Telegram filters, missing-Telegram marker or positive default badges.
- Server-side filtering, paging, query parameters or database changes.
- Renaming domain/database/auth/audit/generic User terminology.
- Redesigning create/edit forms, navigation shell or Settings.
- Preserving `/users` as redirect, frontend alias or backend compatibility route.

## Required test coverage

### Unit tests
- Pure search/status/password projection, AND semantics, stable backend order,
  filter count and forbidden role/Telegram predicate.
- Frontend API path construction/mapping for list/details/create/update.
- Browser path parse/serialize, legacy not-found and route/access recovery.
- Component row action projection: explicit `Edit`/`Update` vs
  empty/missing/other actions.
- Backend unit tests are not applicable: TASK-105 does not change a domain,
  authorization, validation or mapping algorithm. The closest backend barrier
  is HTTP integration through the real mapped endpoints plus persistence/audit
  assertions. Do not invent a private route-string unit merely to satisfy a
  category.

### Integration tests
- Backend WebApplicationFactory: new routes, legacy unmapped routes, both
  manager roles, both forbidden roles, only-Coach response, allowedActions,
  CSRF, validation, ProblemDetails, `Location`, session sync, mutation/audit and
  rollback.
- Frontend component/App integration: Drawer, active filters, empty/recovery,
  refresh/stale error, workflow state and focus return.
- API + browser route integration: `/api/coaches` and `/coaches...` only.
- All unit and integration tests above are written/updated before functional
  code and their expected initial failure is recorded.

### UI/e2e tests
- Navigation/deep link/reload/explicit and browser back-forward/permission
  recovery on `/coaches`; `/users...` not-found.
- Filters separately/together and with search; count, chips, reset and
  filtered-empty recovery.
- Drawer open/close/Escape/focus return and compact-height scroll/footer.
- Single editable row tab stop, click/tap/Enter/Space, read-only static row,
  mobile absence of edit button and desktop non-focusable cue.
- Normal/inactive/password/combined/Telegram-present/missing/read-only rows;
  no default/missing-Telegram markers.
- Toolbar useful search widths, `44 x 44px` targets, long content wrapping and
  no horizontal scroll at all required sizes.

### Expected initial failure verification
- Backend `/coaches` tests fail with `404`; old `/users` negative test fails
  because route remains mapped; `Location` still reports `/users/{id}`.
- API/route unit tests observe `/api/users` and `/users...`.
- Filter tests fail because status/password state and Drawer do not exist.
- Row tests fail because edit is a separate button and undefined actions are
  currently allowed.
- Return-focus tests fail because only query is retained and no selected-row
  snapshot/focus restoration exists.

## Test plan
- [ ] Capture baseline green focused backend/frontend tests.
- [ ] Write/update all backend integration tests before production code.
- [ ] Write/update all frontend unit/component/App tests before production code.
- [ ] Write/update affected Playwright tests before production code.
- [ ] Record expected red failures for backend, frontend and Playwright.
- [ ] Run focused backend tests for `UsersApiTests|CsrfProtectionTests`.
- [ ] Run `dotnet test backend/GymCrm.slnx`.
- [ ] Run focused frontend unit/component/App tests.
- [ ] Run `cd frontend && npm run test:unit`.
- [ ] Run `cd frontend && npm run check:raw-colors`.
- [ ] Run `cd frontend && npm run lint`.
- [ ] Run `cd frontend && npm run build`.
- [ ] Run affected Chromium Playwright specs listed above.
- [ ] Run `cd frontend && npm run test:e2e:iphone`.
- [ ] Record iOS Simulator or physical-device evidence for Safari chrome,
      software keyboard, safe areas/home indicator and target portraits.
- [ ] Record compact-height Simulator/physical-device smoke at `912 x 420` and
      `956 x 440`.
- [ ] Verify no HTTP/browser `/users` literal or compatibility route remains.

## Regression barriers
1. **Canonical-route barrier:** backend integration + frontend route/API tests
   must require `/coaches...` and explicitly reject `/users...`.
2. **Authorization/transport barrier:** the existing role matrix, only-Coach
   projection, CSRF, validation, ProblemDetails, audit and rollback assertions
   must pass unchanged through the new route.
3. **Filter barrier:** one executable truth table must cover both dimensions,
   AND with search, stable order, count/reset and filtered-empty recovery.
4. **Row/action barrier:** component + Playwright tests must prove one target
   only for explicit backend action and zero mutation target for missing/empty
   actions.
5. **Workflow/mobile barrier:** route-level return-state/focus tests plus
   target-iPhone/compact-height geometry must protect toolbar, Drawer, long rows
   and no-overflow behavior.

TASK-105 is not complete if any barrier is replaced by manual QA alone.

## Risks
- Partial backend/frontend rollout makes one artifact call a route the other no
  longer serves; the task deliberately has no compatibility alias.
- Mechanical `/users` replacement can accidentally rename internal domain,
  auth/audit or administrator code outside scope.
- A stale test fixture can hide an `/api/users` request by over-broad routing.
- Missing `allowedActions` fail-closed behavior may expose previously permissive
  mock fixtures; fixtures must be corrected, not the security contract weakened.
- A full-row button can gain invalid nested interactive markup or duplicate
  accessible names if the old Button is not fully removed.
- Local state/focus effects can steal focus after user interaction or restore a
  row no longer visible after an update.
- Active filter UI can become a second toolbar or clear query unexpectedly.
- Generic `.list-row-card` CSS changes can regress other registries.
- Chromium viewport checks can give false confidence about Safari keyboard,
  browser chrome and safe areas.

## Stop conditions
Остановиться и не писать/не продолжать production code, если:
- `/coaches` cannot be the sole route without an unapproved compatibility
  window or independent rolling deployment;
- discovered client/bot/external consumer cannot be updated atomically;
- current endpoint is not actually isolated to Coach/Trainers family;
- permission, role, allowedActions, validation, ProblemDetails or audit semantics
  must change to complete the route rename;
- implementation requires global state/router replacement, server-side filters
  or database changes;
- active branch/worktree differs from this plan or has unexplained changes;
- new tests cannot distinguish an intentional legacy `404` from auth/CSRF
  handling;
- scope expands beyond TASK-105.

Do not stop only because backend and frontend both change or because the module
uses generic internal `User` names. Those are expected constraints.

## Ready for Codex execution
no — detailed test-first plan is ready, but the source remains high-risk and
`Safe for Codex: no`. Require explicit human approval of the atomic
backend/frontend release/rollback contract, then execute only in the declared
branch/worktree.
