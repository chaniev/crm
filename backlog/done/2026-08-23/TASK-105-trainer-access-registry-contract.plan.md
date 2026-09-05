# Implementation Plan: TASK-105 Довести реестр тренеров до access-management workflow

## Metadata
- source_task: /backlog/done/2026-08-23/TASK-105-trainer-access-registry-contract.md
- branch: feature/TASK-105-trainer-access-registry-contract
- readiness: done — human approval received; implemented, validated and locally integrated 2026-08-23
- dependencies: none
- risk: high — protected access-management HTTP/browser contract changes atomically

## Goal
HeadCoach или SuperAdministrator открывает trainer-only реестр на canonical
`/coaches`, локально отбирает отключённых тренеров и/или тренеров с обязательной
сменой пароля, затем открывает разрешённое backend-ом редактирование через один
row target. Старый frontend/API path `/users` больше не обслуживает trainer
workflow, а access, validation, audit, CSRF и ProblemDetails semantics остаются
неизменными.

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

## Implementation sequence

### backend canonical route
20. Change only the trainer endpoint group from `/users` to `/coaches` and the
    created `Location` to `/coaches/{id}`. Keep method names/types if renaming
    would be cosmetic.
21. Do not change `StaffManagementBoundary`, role family, permissions,
    validation, audit serializer, database `Users`, generic DTOs or
    `/settings/administrators`.
22. Rerun focused backend tests green, including old-route `404` and CSRF, then
    run the complete backend solution.

### frontend canonical route/API
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

### local filters and operational states
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

### single row target and return focus
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

## Likely files and layers
- Backend trainer route group, created-location handling and Users/CSRF API tests.
- Frontend route/API constants and the existing trainer registry workflow.
- Registry filter, focus-return, mapper/component and affected Playwright tests.

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

## Regression specification

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

### Validation and acceptance
- [ ] Capture baseline green focused backend/frontend tests.
- [ ] Write/update all backend integration tests before production code.
- [ ] Write/update all frontend unit/component/App tests before production code.
- [ ] Write/update affected Playwright tests before production code.
- [ ] Record expected red failures for backend, frontend and Playwright.
- [ ] Run focused backend tests for `UsersApiTests|CsrfProtectionTests`.
- [ ] Run focused frontend unit/component/App tests.
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
- new tests cannot distinguish an intentional legacy `404` from auth/CSRF
  handling;
- scope expands beyond TASK-105.

Do not stop only because backend and frontend both change or because the module
uses generic internal `User` names. Those are expected constraints.
