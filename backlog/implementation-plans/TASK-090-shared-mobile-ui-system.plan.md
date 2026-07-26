# Implementation Plan: TASK-090 Ввести единую mobile UI system и deployment theme profiles

## Source task
/backlog/implementation/TASK-090-shared-mobile-ui-system.md

## Git branch
feature/TASK-090-shared-mobile-ui-system

Branch rules:
- before branch creation, stop if the worktree contains unrelated changes;
- checkout `main`, pull the latest changes, verify clean status, then create
  this branch from that updated `main`;
- do not implement other unrelated TASKs in this branch;
- confirm the branch is active before making project code changes;
- stop implementation if git status is dirty with unrelated changes.

Recommended branch preparation:

```text
git checkout main
git pull
git checkout -b feature/TASK-090-shared-mobile-ui-system
```

## Goal
Сделать `docs/MOBILE_UI_CONTRACT.md` исполняемой foundation для CRM UI:
backend отдаёт opaque `themeId` и `authBackgroundImageId`, frontend
резолвит registered theme/background profiles, Mantine и CSS получают
semantic `--crm-*` tokens, auth/start screen использует registered background,
а shared mobile primitives задают единый locator, filters, range/status,
task item, restricted state и temporary footer без screen-specific CSS-копий.

## Current understanding
- TASK-090 является P0 foundation для TASK-084-TASK-089.
- Scope затрагивает backend `/api/config`, frontend bootstrap, theme registry,
  auth background registry, `features/shared`, `AppLayout`/navigation/header,
  `App.css`, representative screens и regression tooling.
- Backend не валидирует frontend registry: missing/blank заменяет на default,
  unknown non-empty id trim-ится и передаётся frontend как configured value.
- Frontend является единственным владельцем registered `ThemeProfile` и
  `AuthBackgroundProfile`.
- Theme может менять presentation, но не hierarchy, permissions, status
  meaning, density, typography, safe-area, keyboard или responsive behavior.
- Existing evidence: `/config` сейчас отдаёт только `clubName`;
  `frontend/src/App.tsx` выполняет config load внутри App;
  `frontend/src/main.tsx` монтирует статичный `gymCrmTheme`;
  `frontend/src/theme.ts`, `frontend/src/App.css` и `frontend/src/lib/groupSchedule.ts`
  содержат raw theme-sensitive colors.
- Existing compact-height regression: `frontend/e2e/iphone-target-devices.spec.ts`
  сейчас ожидает desktop side navigation и скрытую mobile bottom navigation
  после landscape resize, что прямо противоречит coarse-pointer compact-height
  contract TASK-090.
- В `docs/MOBILE_UI_CONTRACT.md` осталась локальная коллизия: responsive matrix
  допускает wrap filter trigger на `360px`, но source TASK-090 и measurable
  locator contract требуют одну non-wrapping строку на `360/390/420/440/768/1440`.
  Для реализации действует более строгий TASK-090 contract; нормативный
  документ синхронизируется в этой же branch.

## UX research synthesis

### Top UX problems
1. Critical: shared mobile screens can diverge after TASK-084-TASK-089.
   Evidence basis: ready task explicitly lists divergent page header, locator,
   density, filters, states, touch sizes and colors; current CSS contains many
   raw brand/surface/focus colors outside a single system.
2. Critical: deployment branding is coupled to CSS and auth asset path.
   Evidence basis: current auth background is referenced directly from
   `App.css`; `/api/config` has only `clubName`, so deployment cannot select
   a registered profile without code changes.
3. High: bootstrap can render meaningful UI before theme/background resolution
   and can duplicate config fetching.
   Evidence basis: `MantineProvider` is created in `main.tsx` with static
   theme while `App` loads config/session itself and retries config/session
   together.
4. High: list workspace controls lack one implementation contract.
   Evidence basis: normative contract defines one-line locator/action geometry,
   accessible unlabeled primary search, active filters, range/status and
   shared states; current work is distributed across feature screens.
5. High: mobile acceptance can regress invisibly.
   Evidence basis: existing target dimensions are documented, but TASK-090
   requires static raw-color prevention and repeated representative E2E with
   default and alternate theme profiles.

### Likely root causes by layer
- Information architecture: route title, locator, filters, range and state
  placement are encoded per screen instead of controlled through shared
  primitives.
- Interaction layer: primary/frequent/secondary/exceptional actions are not
  enforced by shared APIs, so controls can drift into overflow or duplicate
  toolbar rows.
- Visual system: Mantine theme, CSS variables and feature CSS do not share one
  semantic token source.
- Runtime config: backend config and frontend theme bootstrap are not separated
  by opaque identifiers and frontend registry resolution.
- Validation layer: tests verify individual screens, but not enough profile
  switching, token usage, compact-height, safe-area, and raw-color regressions.

## UX contract for implementation

### User, device and context
- Users: `SuperAdministrator`, `Administrator`, `HeadCoach`, `Coach`.
- Context: CRM is used as an operational tool on phones during gym work,
  often one-handed, with Safari chrome, software keyboard, route transitions,
  and permission-dependent sections.
- Stress baseline: `390 x 844`.
- Target devices: iPhone Air `420 x 912`, iPhone 17 Pro Max `440 x 956`.
- Additional guardrails: `360 x 780`, tablet `768 x 1024`, desktop
  `1440 x 1200`, compact-height landscape `912 x 420` and `956 x 440`.

### Required result
The user opens an allowed section, finds or narrows the intended entity,
performs one operation, sees a completion signal naming the entity/operation,
and returns with `query`, filters, page/batch, selected entity, preview and
scroll context preserved where applicable.

### Primary path
```text
app shell
-> route context
-> visible primary locator
-> active constraints
-> task-oriented results
-> preview/detail/edit
-> back with preserved context
```

Completion signals:
- success state or notification names the changed entity/operation;
- loader disappearance alone is not a completion signal;
- retry/recovery does not clear locator/context.

### Action classification
- Primary: one visually dominant action in the active task state; never hidden
  in overflow or filters drawer.
- Frequent: visible or reachable through one obvious interaction; refresh is
  frequent, not a second primary.
- Secondary: contextual surface, drawer or detail.
- Exceptional/destructive: contextual menu/detail plus explicit confirmation
  when irreversible.
- Unmapped: not rendered until tied to a concrete user operation.

### Action budget
- Authorized list route opens directly to locator/results without decorative
  intro.
- Search input is the first task control; filter trigger and retained
  primary/frequent actions stay in the same non-wrapping row.
- Filter opening is one action; active filter removal is one action per filter.
- Mobile bottom navigation exposes at most four route slots plus stable `Ещё`;
  an active overflow route promotes into the fourth adaptive route slot.
- Back/reload/deep link must not require the user to restore search or filters.

### Required data at decisions
- Route identity through active nav/tab, semantic `h1`, document title and
  named main landmark.
- Search object/operation through stable accessible name; placeholder may only
  describe searchable attributes.
- Active constraints through active filters and range/status.
- Entity identity, scope, status and next action in each `TaskItem`.
- Permission or restriction reason only from backend/session contract or an
  explicitly allowed frontend generic access fact.

### Failure and recovery
- Loading remains visually distinct from empty.
- Empty first-run shows allowed create action when authorized.
- Empty search keeps query and offers clear search.
- Empty filtered keeps filters and offers scoped reset.
- Error names failed operation and retries without clearing context.
- Stale is explicitly marked and not styled as success.
- Restricted state names the limitation and a backend-authorized recovery.
- Disabled controls explain prerequisite when not obvious.
- Auth background/theme failure falls back deterministically and never blocks
  login.

### Measurable UX criteria
- No unintended horizontal page scroll at `360`, `390`, `420`, `440`.
- Mobile/coarse-pointer targets are at least `44 x 44 CSS px`; independent
  targets have at least `8px` gap.
- iPhone inputs/selects/textareas use `font-size >= 16px`.
- `EntityLocatorBar` search min-widths: `156/176/200/216/320/420px` for
  `360/390/420/440/768/1440` respectively.
- Bottom navigation, drawers and sticky footers include safe-area padding and
  remain reachable under dynamic viewport changes.
- `912 x 420` and `956 x 440` use touch compact-height shell, not desktop-only
  density.
- Normal text contrast is at least `4.5:1`; large text and UI boundaries are
  at least `3:1`; color is never the only status/selection signal.

## Boundary with TASK-084-TASK-089
- TASK-090 owns shared foundation: config contract, theme/background profiles,
  semantic tokens, shared primitives, shell/header/navigation policy,
  representative migrations and static raw-color prevention.
- TASK-084 remains the all-screen touch target and compact-height acceptance
  sweep after the shared foundation exists.
- TASK-085 remains the Clients search-focused workflow, `96px` client cards
  and client-specific query/filter behavior.
- TASK-086 remains Groups search/filter/paging data flow and group card
  decision data.
- TASK-087 remains blocked until backend/product effective schedule scope is
  clarified.
- TASK-088 remains route-specific permission redirect feedback wiring; TASK-090
  only creates the shared `RestrictedState` contract and representative tests.
- TASK-089 remains the desktop client split/overflow workflow; TASK-090 only
  prevents foundation conflicts and raw color drift.

## Safe decomposition and review gates

These are sequential slices of one coordinated TASK-090 release. They stay in
the same task branch because `/config`, bootstrap, theme tokens and migrated
consumers must not ship in incompatible combinations. Each slice begins with
its own automated red tests and ends with a review gate before the next slice.

### Slice A — Public config and deployment contract
- Red first: backend API tests for default/blank/configured/unknown opaque ids
  and compose/env contract checks.
- Production after red: `BrandingOptions`, response DTO and both deployment
  compose files plus `.env.example`.
- Gate: focused backend tests and compose rendering pass; backend contains no
  copy of the frontend registry.

### Slice B — Registries, bootstrap and auth background
- Red first: profile/schema/contrast/resolver warning tests, bootstrap request
  cardinality, auth loading/error/login/forced-password fallback coverage.
- Production after red: versioned theme/background registries,
  `createGymCrmTheme`, injected warning sink and single-owner
  `ConfigThemeBootstrap`.
- Gate: one config request per explicit bootstrap attempt, no meaningful App
  under an unresolved profile and auth remains operable with a broken asset.

### Slice C — Semantic tokens and raw-color barrier
- Red first: capture the current raw-color inventory and prove the scanner
  rejects a synthetic forbidden value and broad allowlist entries.
- Production after red: semantic `--crm-*` source, invariant status roles,
  narrow asset-overlay allowlist and replacement of all theme-sensitive
  shared/feature raw colors.
- Gate: scanner is green, both required profiles pass contrast tests and a
  focused alternate-theme suite exposes no hardcoded green/amber dependency.

### Slice D — Shared primitives and shell/navigation
- Red first: component, accessibility, focus-return, adaptive-navigation,
  no-wrap locator and compact-height tests.
- Production after red: focused shared files, constrained route header API,
  adaptive fourth slot, stable `Ещё`, safe-area/dynamic-viewport footer and
  coarse-pointer compact shell.
- Gate: component tests prove ARIA/action semantics; navigation fixtures with
  and without Finance pass without role inference.

### Slice E — Representative consumers and regression closure
- Red first: Home, Schedule, Clients, Groups, Users, Audit, Finance, Settings
  assertions for headers/copy/locator geometry/states under both profiles.
- Production after red: migrate only representative TASK-090 call sites and
  shared theme-sensitive colors; do not implement TASK-085–TASK-089 workflows.
- Gate: full frontend/backend suites, lint/build, target iPhone WebKit,
  compact-height geometry and compose validation are green; unverified
  Simulator/physical-device evidence is reported explicitly.

## Execution steps
All test-writing steps below happen before functional production code.

1. Verify repository state before implementation:
   - confirm current branch is `feature/TASK-090-shared-mobile-ui-system`;
   - confirm no unrelated dirty files block isolated work.
2. Write backend config tests first:
   - update `backend/tests/GymCrm.Tests/AppConfigApiTests.cs`;
   - assert `/config` returns `clubName`, `themeId`, `authBackgroundImageId`;
   - assert missing/blank defaults become `default-green-v1` and
     `k4pro-login-v1`;
   - assert configured non-empty values are trimmed and unknown ids pass
     through unchanged.
3. Write frontend config and registry unit tests first:
   - update `frontend/src/lib/api/config.test.ts` and API types expectations;
   - add tests for `ThemeProfile`, `AuthBackgroundProfile`,
     `resolveThemeProfile`, `resolveAuthBackgroundProfile`;
   - assert unknown profile fallback returns default plus reportable warning.
4. Write frontend theme/token tests first:
   - test `createGymCrmTheme(profile)`;
   - verify required profiles `default-green-v1` and `test-blue-coral-v1`;
   - verify schema version, palette count, focal point range and contrast
     thresholds for each profile;
   - verify generated semantic `--crm-*` variables include neutral, text,
     border, action, selection, focus and status roles.
5. Write bootstrap tests first:
   - cover `ConfigThemeBootstrap` or equivalent bootstrap owner;
   - assert exactly one `/config` request on initial bootstrap and exactly one
     additional request only after an explicit config-bootstrap retry;
   - assert meaningful `App` is not rendered under an unresolved wrong palette;
   - assert `App` receives config through props/context and does not perform a
     duplicate config request when loading or retrying session state.
6. Write shared component tests first:
   - cover `EntityLocatorBar`, `ActiveFiltersBar`, `ListRangeStatus`,
     `TaskItem`, `RestrictedState`, `TemporarySurfaceFooter`;
   - assert accessible names, roles, keyboard behavior, focus return,
     `aria-controls`, `aria-current`, `aria-selected` constraints and
     `44px` target classes/styles where testable.
7. Write representative UI/E2E tests first:
   - extend `frontend/e2e/auth.spec.ts` for registered auth background,
     forced password change, loading/bootstrap error and fallback behavior;
   - extend `frontend/e2e/responsive-main-screens.spec.ts` and
     `frontend/e2e/iphone-target-devices.spec.ts` for locator/header/nav
     geometry at target widths;
   - change compact-height expectations to require coarse-pointer mobile shell,
     reachable mobile navigation and hidden desktop-only side navigation at
     `912 x 420` and `956 x 440`;
   - update every mocked `/api/config` fixture to include explicit
     `themeId`/`authBackgroundImageId`, while keeping focused missing/unknown
     fallback fixtures only in config/bootstrap tests;
   - add or update specs for Home, Schedule, Clients, Groups, Users, Audit,
     Finance and Settings representative states with both theme profiles.
8. Write static raw-color regression test first:
   - scan `frontend/src/**/*.{ts,tsx,css}` for raw hex, rgb(a), hsl(a) and
     theme-sensitive direct `brand.N` usage;
   - permit definitions only in the versioned profile registry, invariant
     semantic token source and a narrow machine-readable allowlist;
   - require every allowlist entry to name an exact path/pattern, reason, owner
     and review/removal note; directory globs and generic feature exemptions
     are forbidden;
   - allow asset-specific auth overlays only in their registered background
     profile/explicit exception and exclude generated `docs/ui-concept`
     prototypes from the production-code scan.
9. Run the new/updated tests before production changes and confirm expected
   failures are caused by missing TASK-090 behavior, not setup errors.
10. Implement backend config contract:
   - add `ThemeId` and `AuthBackgroundImageId` to `BrandingOptions`;
   - add deterministic resolver methods and defaults;
   - extend `AppConfigResponse`;
   - add `CRM_THEME_ID -> Branding__ThemeId` and
     `CRM_AUTH_BACKGROUND_IMAGE_ID -> Branding__AuthBackgroundImageId` to
     `deploy/docker-compose.yml`, `deploy/docker-compose.server.yml` and
     `deploy/.env.example`, preserving deterministic defaults.
11. Implement frontend config types and registry:
   - extend `AppConfigResponse`;
   - create versioned theme and background registry files;
   - register `default-green-v1`, `test-blue-coral-v1` and `k4pro-login-v1`;
   - ensure `k4pro-login-v1` owns `frontend/src/assets/auth/k4pro-login-bg.png`;
   - make resolvers return the resolved profile plus a typed warning for unknown
     identifiers; report through an injectable sink with `console.warn` as the
     production fallback, deduplicated by profile kind/id, and never through a
     user-facing CRM notification.
12. Implement `createGymCrmTheme(profile)` and semantic token export:
   - move static `gymCrmTheme` to a profile-derived theme;
   - expose semantic CSS variables with prefix `--crm-`;
   - keep Onest, Mantine, light scheme and invariant status meanings.
13. Implement config/theme bootstrap:
   - move config loading before meaningful `App` render;
   - mount `MantineProvider` after resolving the theme profile;
   - pass resolved app config/profile/background through props/context;
   - remove duplicate config request paths from `App`;
   - keep session loading/retry behavior intact.
14. Implement auth background profile application:
   - apply resolved background to unauthenticated/forced-auth loading,
     bootstrap error, login and forced password change;
   - keep contrast-safe auth form surface;
   - fallback from unknown/broken image to default image, then semantic solid
     auth background without layout shift.
15. Implement shared primitives in focused files and re-export through
   `frontend/src/features/shared/ux.tsx`:
   - `EntityLocatorBar.tsx`;
   - `ActiveFiltersBar.tsx`;
   - `ListRangeStatus.tsx`;
   - `TaskItem.tsx`;
   - `RestrictedState.tsx`;
   - `TemporarySurfaceFooter.tsx`;
   - give `EntityLocatorBar` explicit primary/frequent action slots and a fixed
     collapse priority so consumers cannot create a forbidden action-only
     second row;
   - extend `PageLayout`, `PageHeader`, `PageSection`, `AppLayout`,
     `MobileBottomNavigation` only as required by the contract.
16. Migrate representative call sites and all theme-sensitive colors:
   - replace raw brand/accent/surface/border/focus/selection values in shared
     and feature code with semantic tokens or shared component variants;
   - convert schedule/category presentation to invariant status tokens or
     configurable accent families plus text/icon/border cues;
   - keep feature-specific domain fields as props/slots, not embedded in
     shared components.
17. Implement mobile shell/header/navigation contract:
   - route-level header API has no free decorative description/eyebrow/badge
     slots;
   - top-level list routes can use visually-hidden `h1` when active nav names
     the route;
   - hidden header actions move into the first locator/toolbar/summary row;
   - mobile bottom navigation supports adaptive fourth route slot and stable
     fifth `Ещё` drawer trigger derived from authorized sections;
   - Finance is present only when the backend access contract includes
     `Finance` and grants its existing permission; role name never creates
     access. Cover both with-Finance and without-Finance fixtures;
   - coarse-pointer landscape keeps the mobile/compact shell, `44px` targets,
     reachable navigation and one-scroll-container temporary surfaces.
18. Align the contradictory `360px` paragraph in
    `docs/MOBILE_UI_CONTRACT.md` with TASK-090: locator/filter/retained actions
    remain in one non-wrapping row and secondary actions collapse before the
    contracted search minimum is violated.
19. Run new tests and make them pass.
20. Run full required validation listed below.
21. Record any Safari Simulator or physical iPhone checks that could not be
    performed locally.

## Preferred implementation strategy
1. Contract-first: backend response shape and frontend types/tests.
2. Registry-first frontend: theme/background resolver and profile tests before
   UI migration.
3. Bootstrap isolation: make config/theme resolution a single owner before
   broad CSS migration.
4. Shared primitives next: build focused components and tests before moving
   screens.
5. Representative migration: migrate shell, auth, shared components and
   representative list routes first; do not implement screen-specific flows
   from TASK-085-TASK-089.
6. Static barrier before the color sweep: first capture its expected red
   inventory, then make it green as semantic tokens replace raw values; keep it
   enabled for all later changes.
7. Small commits by layer: backend contract, frontend registry/bootstrap,
   shared primitives, representative migrations, tests/static checks.

## Files likely to change
- `backend/src/GymCrm.Api/Startup/BrandingOptions.cs`
- `backend/src/GymCrm.Api/Startup/AppConfigEndpoints.cs`
- `backend/src/GymCrm.Api/Startup/AppConfigResponse.cs`
- `backend/tests/GymCrm.Tests/AppConfigApiTests.cs`
- `deploy/docker-compose.yml`
- `deploy/docker-compose.server.yml`
- `deploy/.env.example`
- `docs/MOBILE_UI_CONTRACT.md`
- `frontend/package.json`
- `frontend/scripts/check-raw-colors.mjs` — likely new
- `frontend/scripts/raw-color-allowlist.json` — likely new and narrowly scoped
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/config.test.ts`
- `frontend/src/main.tsx`
- `frontend/src/App.tsx`
- `frontend/src/theme.ts`
- focused theme/profile/token modules under `frontend/src/theme/` if splitting
  `theme.ts` is needed to preserve one top-level responsibility per file
- `frontend/src/index.css`
- `frontend/src/App.css`
- `frontend/src/test/render.tsx`
- `frontend/src/assets/auth/k4pro-login-bg.png` only as referenced asset,
  not replaced unless product explicitly provides a new registered asset
- `frontend/src/features/shared/ux.tsx`
- `frontend/src/features/shared/AppLayout.tsx`
- `frontend/src/features/shared/Header.tsx`
- `frontend/src/features/shared/MobileBottomNavigation.tsx`
- `frontend/src/features/shared/EntityLocatorBar.tsx`
- `frontend/src/features/shared/ActiveFiltersBar.tsx`
- `frontend/src/features/shared/ListRangeStatus.tsx`
- `frontend/src/features/shared/TaskItem.tsx`
- `frontend/src/features/shared/RestrictedState.tsx`
- `frontend/src/features/shared/TemporarySurfaceFooter.tsx`
- `frontend/src/features/shared/ux.test.tsx`
- `frontend/src/lib/appRoutes.ts`
- `frontend/src/lib/appRoutes.test.ts`
- representative screens under `frontend/src/features/home`,
  `frontend/src/features/schedule`, `frontend/src/features/clients`,
  `frontend/src/features/groups`, `frontend/src/features/users`,
  `frontend/src/features/audit`, `frontend/src/features/finance`,
  `frontend/src/features/settings`
- `frontend/src/lib/groupSchedule.ts`
- `frontend/e2e/auth.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`
- `frontend/e2e/iphone-target-devices.spec.ts`
- new raw-color scanner/test file under frontend tooling or tests

Exact files must be re-discovered before editing because local worktree state
may have changed.

## Constraints
- Do not change CRM business rules, roles, permissions, access scope,
  validation semantics or ProblemDetails contracts.
- Do not duplicate frontend theme registry in backend.
- Do not accept arbitrary runtime hex, CSS, URL, binary image, crop or overlay
  data from deployment config.
- Do not add Tailwind or another component library; preserve React,
  TypeScript, Mantine, Onest and existing app architecture.
- Do not make color the only status, validation, selected or permission signal.
- Do not infer Finance or any destination from `role`; use the existing
  backend-owned `allowedSections`/permissions contract.
- Do not use horizontal scrolling of desktop content as mobile adaptation.
- Do not create nested cards or decorative route-level copy prohibited by the
  mobile UI contract.
- Do not hide primary operations in overflow menus or filter drawers.
- Do not implement screen-specific workflow changes from dependent tasks.

## Out of scope
- Coach effective schedule scope from TASK-087.
- Client search-focused state and `96px` cards from TASK-085.
- Group search/paging data flow from TASK-086.
- Route-specific permission redirect behavior from TASK-088.
- Client desktop split from TASK-089.
- Dark theme.
- Runtime arbitrary palette/CSS/image upload.
- Different themes per role.
- Backend-owned business rule changes.
- Replacing the default auth asset unless a registered replacement is approved.

## Required test coverage
Unit and integration tests must be written or updated before functional code.
Manual QA is supplementary only.

### Unit tests
- `BrandingOptions` resolver behavior through API tests or direct unit coverage:
  defaults, trimming, unknown pass-through.
- Frontend `AppConfigResponse` parsing/typing expectations.
- `resolveThemeProfile` and `resolveAuthBackgroundProfile` default,
  configured, unknown and typed warning behavior, including injected warning
  sink and per-kind/id deduplication.
- Profile schema and contrast validation for `default-green-v1` and
  `test-blue-coral-v1`.
- `createGymCrmTheme(profile)` preserves Onest, light scheme, primary/action
  mapping and semantic token roles.
- Shared component behavior for locator, active filters, range/status,
  task item interactions, restricted state and temporary footer.
- Raw-color scanner allowlist behavior.
- Navigation partitioning with and without backend-authorized Finance.

### Integration tests
- Backend `/config` contract in
  `backend/tests/GymCrm.Tests/AppConfigApiTests.cs`.
- Bootstrap integration: config/theme/background resolution happens before
  meaningful `App` render and no duplicate `/config` request is made.
- Auth integration: login, forced password change, loading and bootstrap error
  use resolved/fallback background without blocking forms.
- Mobile navigation integration: adaptive fourth route slot and stable `Ещё`
  derived from authorized sections, including deep link, reload and browser
  back/forward; separate fixtures prove both absence and promotion of Finance
  based only on backend access.
- Representative screen integration: shared locator/action row, visible/hidden
  route header rules, active filters, range/status and state panels.

### UI/E2E tests
- `auth.spec.ts`: default background, alternate config, unknown/broken fallback,
  contrast-safe auth form and forced password change.
- `responsive-main-screens.spec.ts`: Home, Schedule, Clients, Groups plus
  representative Users/Audit/Finance/Settings states at `390`, `768`, `1440`.
- `iphone-target-devices.spec.ts`: `420 x 912`, `440 x 956`, compact-height
  `912 x 420`, `956 x 440`, coarse-pointer compact shell, reachable bottom
  navigation, hidden desktop-only navigation, drawer/modal footer and form
  submit reachability, touch targets, no horizontal scroll and safe-area
  assumptions.
- Repeat representative path with `default-green-v1` and
  `test-blue-coral-v1`.
- Across both profiles assert the same visible controls, DOM/focus order and
  status semantics, plus geometry equality within a documented rendering
  tolerance.
- Role/name assertions for visually unlabeled primary searchboxes.
- Geometry assertions that locator, filter trigger and retained actions remain
  in one row and search width does not fall below contract minima.

## Test plan
- [ ] `dotnet test backend/tests/GymCrm.Tests/GymCrm.Tests.csproj --filter AppConfigApiTests`
- [ ] `cd frontend && npm run test:unit -- config`
- [ ] `cd frontend && npm run test:unit -- theme`
- [ ] `cd frontend && npm run test:unit -- ux`
- [ ] `cd frontend && npm run check:raw-colors`
- [ ] `cd frontend && npm run test:e2e -- auth.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- responsive-main-screens.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- iphone-target-devices.spec.ts`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:unit`
- [ ] `cd frontend && npm run test:e2e:iphone`
- [ ] `dotnet test backend/tests/GymCrm.Tests/GymCrm.Tests.csproj`
- [ ] `dotnet test backend/GymCrm.slnx`
- [ ] `docker compose --project-directory . --env-file deploy/.env.example -f deploy/docker-compose.yml config --quiet`
- [ ] `docker compose --project-directory . --env-file deploy/.env.example -f deploy/docker-compose.server.yml config --quiet`

Manual/device checks to record separately:
- Safari Responsive Design Mode or iOS Simulator for dynamic viewport,
  software keyboard and safe-area behavior.
- Physical iPhone check for Safari chrome, home indicator and one-handed
  reach if available.
- Visual review screenshots for auth, list, detail/create/edit, empty, error
  and restricted states at required target sizes.

## Regression barrier
- Backend API tests fail if `/config` drops `themeId` or
  `authBackgroundImageId`, mishandles defaults or starts validating frontend
  registry ids.
- Frontend unit tests fail if theme/background registries lose required
  profiles, fallback behavior or contrast/token guarantees.
- Bootstrap tests fail on duplicate config requests or meaningful render under
  unresolved theme/background state.
- Shared component tests fail on broken accessible names, roles, focus return
  or action semantics.
- E2E/mobile tests fail on route header duplication, locator/action wrapping,
  adaptive nav regression, horizontal scroll, target-device geometry drift or
  profile-dependent layout differences.
- Static raw-color check fails when new theme-sensitive hex/rgba values appear
  outside registry, invariant token source or explicit allowlist.
- The same representative routes under both profiles must expose the same
  operations, focus order, geometry within tolerance and invariant status
  semantics.

## Risks
- High blast radius across shared CSS and feature screens can create unrelated
  visual regressions.
- Bootstrap refactor can alter auth/session retry behavior if config and
  session loading responsibilities are mixed.
- Removing raw colors may accidentally change functional status meaning unless
  status tokens remain invariant and labels/icons/borders stay present.
- Static raw-color scanner may be too broad and block legitimate asset overlays
  unless the allowlist is explicit and reviewed.
- E2E screenshots in desktop Chromium do not prove Safari chrome or physical
  iPhone safe-area behavior.
- Representative migration may be mistaken for full TASK-085-TASK-089
  implementation; keep dependent workflow changes out of this branch.
- The existing compact-height E2E expectation and the `360px` contract text
  currently encode behavior opposite to TASK-090; leaving either unchanged
  would create a false-green regression suite.

## Resolved planning decisions and residual evidence gap
- Finance remains conditional on the backend access contract: a fixture without
  access must omit it; a fixture with `allowedSections` plus the existing
  permission must promote it through the same adaptive-slot algorithm.
- Unknown identifiers produce a typed, non-blocking resolver warning delivered
  to an injectable sink; production falls back to deduplicated `console.warn`.
  No user-facing notification is shown.
- `deploy/docker-compose.yml`, `deploy/docker-compose.server.yml` and
  `deploy/.env.example` exist and are mandatory consumers of the two new env
  variables.
- The raw-color scanner covers production `frontend/src` TS/TSX/CSS and rejects
  broad exemptions. Only registry/token sources and exact justified
  asset-specific entries are allowed; generated prototypes are outside scope.
- TASK-090's non-wrapping locator acceptance takes priority at `360px`; the
  contradictory normative paragraph is corrected in the same branch.
- Real Safari keyboard, browser chrome, safe-area, Dynamic Island, home
  indicator and physical one-handed reach remain an evidence gap until tested
  in Simulator or on a physical iPhone; this does not block planning but must
  be reported before claiming device-level acceptance.

## Stop conditions
Stop and do not continue writing project code if:
- implementation branch is not `feature/TASK-090-shared-mobile-ui-system`;
- git status contains unrelated dirty changes that affect planned files;
- backend `/config` contract cannot remain an opaque-id pass-through without
  duplicating frontend registry;
- required changes expand into a roles/permissions/access-scope redesign;
- theme profile would need arbitrary runtime CSS/hex/image URL from deployment;
- auth/session bootstrap requires changing authentication semantics;
- a dependent TASK-085-TASK-089 workflow becomes necessary to satisfy TASK-090;
- representative screens cannot meet target mobile criteria without product
  clarification;
- static raw-color migration requires broad unrelated redesign rather than
  semantic token replacement.

Do not stop only because both backend and frontend change, because shared
components are touched, or because the risk level is high.

## Ready for Codex execution
yes
