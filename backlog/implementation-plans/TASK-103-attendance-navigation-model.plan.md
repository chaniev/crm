# Implementation Plan: TASK-103 Выделить «Посещения» в самостоятельный раздел

## Metadata
- source_task: /backlog/risky/TASK-103-attendance-navigation-model.md
- branch: feature/TASK-103-attendance-navigation-model
- readiness: yes — после явного выбора задачи и human review cross-layer contract
- dependencies: none; завершённые TASK-104 и TASK-116 являются baseline
- risk: medium — coordinated backend session and frontend route/navigation contract

## Goal
Coach, Administrator, HeadCoach и SuperAdministrator открывают отметку факта
посещения через самостоятельный backend-authorized раздел `Посещения` с
canonical route `/attendance`. Бывшая `Главная` заменяется backend-authorized
section `Attention` с label `Внимание` и canonical route `/attention`;
`Расписание` остаётся отдельным `/schedule`, а route,
navigation, document title, main landmark, recovery и client-return используют
одну стабильную attendance-модель.

## Approved role/session matrix

Порядок в `allowedSections` фиксируется contract tests и одновременно задаёт
детерминированный desktop navigation order.

| Role | `landingScreen` | `allowedSections` |
|---|---|---|
| Coach | `Attendance` | `Attendance`, `Schedule`, `Clients` |
| Administrator | `Attendance` | `Attendance`, `Attention`, `Schedule`, `Clients`, `Groups`, `Audit`, `Settings` |
| HeadCoach | `Attention` | `Attendance`, `Attention`, `Schedule`, `Clients`, `Groups`, `Users`, `Audit`, `Finance`, `Settings` |
| SuperAdministrator | `Attention` | `Attendance`, `Attention`, `Schedule`, `Clients`, `Groups`, `Users`, `Audit`, `Settings` |

Invariants:
- `Attendance` availability and landing come only from backend session data;
- frontend does not derive sections from role strings;
- `CanMarkAttendance`, `AttendanceScope`, assigned/granted groups, group access
  and attendance save rules do not change;
- `Attention` is the only backend/frontend section identifier for `Внимание`
  and its only canonical section route is `/attention`;
- `Home` is removed from the current session/route contract, while raw legacy
  version-1 attendance history may mention it only so that the sanitizer can
  reject that stale context;
- frontend never aliases legacy `Home` to `Attention`; an otherwise
  authenticated user payload with unknown/legacy/missing `landingScreen`, a
  landing absent from its mapped `allowedSections`, or no known allowed section
  is rejected by the session mapper instead of receiving a fabricated landing;
- Coach does not receive `Attention` or display `Внимание`;
- Administrator, HeadCoach and SuperAdministrator receive `Attention` as the
  management inbox and `Attendance` as the first direct navigation item.

## UI specification

### `/attendance`
Hierarchy:
1. `AuthenticatedShell` / existing `AppLayout`.
2. `RouteViewport` for section `Attendance`.
3. Existing `AttendanceScreen`.
4. `PageLayout showHeader={false} title="Посещения"`.
5. Existing `AttendanceWorkspace` from TASK-104.

Semantics:
- keep one semantic, visually-hidden `h1` with exact text `Посещения`;
- do not add a visible duplicate page title, intro, summary widget or wrapper;
- name the `main` landmark exactly `Посещения`;
- document title is `Посещения • {clubName}`;
- desktop and mobile active navigation use label `Посещения` and
  `aria-current="page"`;
- preserve existing toolbar, roster, decision data and operational states.

### `/attention` management inbox `Внимание`
Hierarchy:
1. `AuthenticatedShell` / existing `AppLayout`.
2. `RouteViewport` for section `Attention`.
3. `AttentionDashboard` with `PageLayout showHeader={false} title="Внимание"`.
4. `AttentionPanel` only.

Rules:
- remove `Tabs`, attendance tab/panel, `AttendanceWorkspace`, attendance return
  context and `canMarkAttendance` branching from the renamed
  `AttentionDashboard`;
- keep visually-hidden `h1` `Внимание`, named `main` `Внимание` and document
  title `Внимание • {clubName}`;
- hidden `h1` is retained for screen-reader announcement and heading
  navigation, but must use the existing out-of-flow `visually-hidden` pattern:
  it remains in the accessibility tree, occupies no layout space, creates no
  `Stack`/flex gap and must not be replaced with `display: none`,
  `visibility: hidden` or `aria-hidden`;
- do not render a visible `Требуют внимания` or other duplicate route/operation
  heading; the first visible content is the existing action toolbar, loading,
  error, empty or populated list state, without a blank heading spacer;
- retain a visually-hidden accessible name for the client attention list;
- keep `AttentionPanel` loading, stale-success/error, empty, retry, row actions
  and client opening behavior unchanged.

### Direct restricted `/attention` for Coach
- do not call `replaceState` on initial denial;
- visible focused `h1`: `Нет доступа`;
- denial describes inaccessible `Внимание`;
- primary recovery action: `Открыть Посещения` -> `/attendance`;
- named `main`: `Нет доступа`;
- document title: `Внимание — нет доступа • {clubName}`;
- an access loss after an already allowed view continues to use TASK-088 polite
  notification and one authorized replacement destination.

### Desktop and mobile navigation
- desktop order: `Attendance`, `Attention`, `Schedule`, `Clients`, `Groups`,
  `Users`, `Audit`, `Finance`, `Settings`, filtered only by backend access and
  existing permission gates;
- add a distinct attendance icon through the existing icon factory; prefer an
  installed Tabler attendance/checklist icon and do not add a new icon system;
- replace the old Home icon mapping with a distinct installed Tabler
  alert/attention icon for section `Attention`; do not retain home-shaped
  semantics for `Внимание`;
- `Attendance` is the first primary mobile navigation item whenever authorized;
- Coach stable primary: `Посещения`, `Расписание`, `Клиенты`;
- management stable primary: `Посещения`, `Внимание`, `Расписание`, `Клиенты`;
- if an authorized overflow destination is active, promote it by replacing the
  adaptive fourth item `Клиенты`; move `Клиенты` into overflow and never
  displace `Посещения`, `Внимание` or `Расписание`;
- generic `Ещё` remains visible when overflow exists, never gets
  `aria-current`, and keeps existing drawer title/close semantics;
- deep link, reload, back/forward and access change recompute promotion from
  resolved route/access without stale or unauthorized items.

### Responsive and interaction contract
- `360 x 780`: Coach has three primary items and no `Ещё`; all navigation
  targets are at least `44 x 44px`, labels remain one line and the page has no
  horizontal overflow.
- `390 x 844`: `/attendance` starts with the TASK-104 context toolbar, not a
  duplicate heading; date input remains at least `176px` and primary attendance
  entry stays above the bottom navigation per existing TASK-104 barrier.
- `420 x 912`: date input remains at least `200px`; `Посещения` stays primary
  for every authorized role.
- `440 x 956`: date input remains at least `216px`; overflow labels remain one
  line and drawer items at least `44px` high.
- `768 x 1024` and `1440 x 1200`: sidebar is visible, bottom navigation hidden,
  `Посещения` remains a direct item, and removed Attention/attendance duplication is
  not restored on wide layouts.
- `912 x 420` and `956 x 440`: existing compact-height/bottom-navigation mode,
  dynamic viewport, safe-area reservation and drawer scroll path remain usable;
  no nested scroll trap or clipped navigation/attendance control is introduced.
- preserve focus order inside the existing attendance toolbar and roster;
  navigation follows visible order; opening/closing `Ещё` traps and returns
  focus according to the released drawer contract.
- iOS Simulator/physical Safari must confirm browser-chrome, actual safe-area
  and software-keyboard behavior before claiming device-level acceptance.

## Implementation sequence

### backend contract implementation
19. Replace `AppSection.Home` with `AppSection.Attention`, then update
    `AccessScopeService` with the exact role matrix. Reuse the existing
    `AppSection.Attendance` constant; do not duplicate strings or role rules in
    transport code.
20. Keep permission set, attendance scope kind/group IDs, assigned groups,
    branch scope, group authorization and API ProblemDetails unchanged.
21. Rerun focused backend tests green, then the complete backend solution.

### frontend route and session contract
22. Replace `Home` with `Attention` and add `Attendance` in the typed API
    section union and session mapper; remove the current `?? 'Home'` landing
    fallback, validate landing membership in the mapped allowed sections, and
    reject incompatible user payloads rather than treating `Home` as an alias
    or fabricating a local landing.
23. Add exact `Посещения`/`Внимание` labels, `/attendance`/`/attention` paths,
    remove `/` from the section registry, and update desktop inventory/order and
    route/access resolution in `appRoutes`.
24. Adjust mobile navigation calculation around an explicit mandatory
    first `Attendance` item, stable authorized `Attention` and `Schedule`, and
    adaptive fourth `Clients`; preserve the existing four-item limit and
    promote the current overflow destination by replacing `Clients` only.
25. Add the attendance icon through the existing exhaustive section icon
    factory, replace the Home icon case with an alert/attention icon for
    `Attention`, and keep all section switches exhaustive.
26. Add an optional/dynamic main-landmark label to `AppLayout` and provide the
    resolved allowed/restricted/not-found name from `App`; do not create nested
    main landmarks.

### separate the screens and update history
27. Route section `Attendance` to existing `AttendanceScreen`, pass the current
    client return context and client-opening callback, and hide only its
    duplicate visible route heading.
28. Rename `HomeDashboard` and its feature/test paths to `AttentionDashboard`,
    reduce it to `AttentionPanel`, and remove attendance tab state/mounting and
    dead imports/props without changing inbox behavior.
29. Remove the visible `Требуют внимания` operation heading. Keep the semantic
    hidden `h1` `Внимание` at page level and the visually-hidden accessible list
    name inside `AttentionPanel`. Use the existing out-of-flow
    `visually-hidden` implementation so the `h1` remains accessible without
    consuming layout space; the existing action toolbar or operational state
    must be the first visible content with no empty spacer or flex gap.
30. Mechanically rename current-screen `home` resource keys, test IDs and CSS
    selectors to `attention` where they identify this feature; do not rename
    historical/legacy payload fixtures whose exact `Home` value is under test.
31. Change attendance client origin and origin-route checks to section
    `Attendance`; implement the version-2 compatibility/fail-closed policy from
    Phase 1 and keep `К посещениям` as the explicit return label.
32. Verify browser history composition still preserves client-list and
    group-list snapshots, validates the expected `/attendance` landing and
    focuses/restores the anchor after roster context validation.
33. Mechanically align affected test session fixtures and old-model assertions;
    do not change unrelated product expectations.

## Likely files and layers
- `backend/src/**/AccessScope*`, auth/session contracts and focused API tests.
- `frontend/src/appRoutes.ts`, app/session routing and navigation components.
- Attendance/Attention viewports, client-return context and their unit/Playwright tests.

## Constraints
- Backend remains the only source of truth for sections, landings, roles,
  permissions and attendance scope.
- Do not add frontend role-to-section logic, silent direct-route redirects or
  duplicate permission semantics.
- Preserve attendance API, validation, audit and save semantics.
- Preserve TASK-104 toolbar/roster density and operational states.
- Preserve TASK-088 typed denial/not-found distinction and feedback behavior.
- Preserve TASK-116 history isolation, depth bounds, sanitizer and safe fallback.
- Keep Mantine, Onest, existing tokens, 44px touch targets, safe-area and
  dynamic-viewport patterns.
- No incremental DB migration or initial-state change is needed.

## Out of scope
- Attendance workbench layout/density changes from TASK-104.
- Attendance permission, group assignment/grant, schedule, membership, payment,
  audit or save-rule changes.
- New management inbox widgets or operations.
- Schedule rename/content redesign.
- New routing library, global navigation store or general E2E fixture refactor.
- Bot UI/navigation changes.

## Regression specification

All test changes below must be written before functional code and run red for
the expected missing TASK-103 behavior.

### Unit tests
- session mapping of `Attendance`/`Attention`, rejection of legacy `Home` and
  unknown-section fail-closed behavior;
- route parsing/serialization/labels/access/recovery and mobile section split;
- versioned attendance return context, sanitizer, history composition and
  legacy-version policy;
- Attention/Attendance render ownership, hidden heading semantics, absence of a
  visible `Требуют внимания`, zero layout footprint for the accessible hidden
  `h1` and no duplicate workbench mount;
- shared navigation current/overflow/focus semantics and main landmark name.

Backend-only unit extraction is not required: the changed backend behavior is
an HTTP-observable `AccessScopeService` contract already exercised through the
real authorization/session integration boundary. Do not extract a duplicate
pure role matrix solely to create an isolated unit test.

### Integration tests
- backend login/session response for all four roles with exact landing,
  sections, unchanged permissions and unchanged attendance scope;
- `App` component integration for login, direct/restricted routing, screen
  ownership, document title, landmark and session access loss;
- Playwright integration for actual user navigation, history/reload, overflow,
  client return and responsive semantics.

### UI/E2E coverage
- Coach/Administrator `/attendance` landing and primary task;
- HeadCoach/SuperAdministrator `/attention` management inbox `Внимание` and
  direct first navigation item `Посещения`;
- Coach restricted `/attention` with exact recovery;
- authenticated root `/` not-found with role-specific backend-landing recovery;
- `/attendance` deep link/reload/back/forward/current state;
- attendance client return context and invalid-context fallback;
- `/schedule` distinction;
- no unauthorized/stale navigation item, no horizontal overflow, 44px targets,
  `aria-current`, drawer focus/close return and exact accessible names;
- exact stable navigation priority `Посещения`, authorized `Внимание`,
  `Расписание`, `Клиенты`, with active overflow replacing only `Клиенты`;
- `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420`, `956 x 440`, plus
  `360 x 780`, `768 x 1024` and `1440 x 1200` smoke/geometry where applicable.

### Initial failure evidence
- targeted backend test fails on old exact role matrix;
- frontend route/mapper/history/component tests fail on missing
  Attendance/Attention contract, old `/`/`Главная` route model and old Home
  ownership;
- Playwright tests fail on old URL/active navigation/recovery/return behavior;
- record each command and relevant failing assertion before production edits.

### Manual-only validation
- physical Safari or iOS Simulator changing visual viewport/browser chrome;
- real safe-area/home-indicator clearance and software keyboard reachability;
- one-handed reach judgment.

These checks are residual device evidence, not substitutes for automated
regression coverage.

### Validation and acceptance
- [ ] Backend role matrix tests written before production code and confirmed red.
- [ ] Frontend unit/component tests written before production code and confirmed red.
- [ ] Affected Playwright tests written before production code and confirmed red.
- [ ] Affected Chromium Playwright specs pass.
- [ ] `cd frontend && npm run test:e2e:iphone` passes for affected target-device cases.
- [ ] Integrated isolated-stack smoke validates actual backend/frontend session contract.
- [ ] Manual/Simulator gaps are reported without claiming unverified device acceptance.

## Regression barrier
Primary barrier: `AuthorizationFlowTests` locks the exact four-role
`landingScreen`/`allowedSections` matrix while retaining existing permission and
attendance-scope assertions.

Secondary barrier: `appRoutes`, session mapper, `App`, Attention/Attendance and
return-context unit/component tests lock canonical `/attendance` and
`/attention`, removal of `Home` and root `/` from the section contract, typed
recovery, exact Attendance/Attention/Schedule/Clients navigation priority,
main/title/nav semantics and safe client return.

End-to-end barrier: affected Chromium plus target-iPhone WebKit scenarios lock
role landings, direct denial, deep link/reload/history, adaptive overflow,
`aria-current`, touch/overflow geometry and attendance client return.

Release barrier: backend and frontend artifacts are deployed and rolled back as
one contract version; integrated smoke must observe the real session JSON and
both target routes before handoff.

## Risks
- Contract skew between independently deployed backend/frontend can make the
  landing unavailable; require coordinated release or stop for compatibility design.
- Updating many realistic session fixtures can hide regressions if assertions
  are mechanically weakened; preserve explicitly synthetic fixtures and review
  every navigation-count/current-state change.
- Mobile four-slot promotion can accidentally move one of the stable first
  three items to overflow instead of replacing `Клиенты`, or mark `Ещё`
  current; exact unit and target-device tests are mandatory.
- Old version-1 attendance history points to `/`; accepting it as current would
  violate canonical return validation. Fail closed while preserving safe legacy
  group-edit normalization.
- Renaming/removing Home and its tabs can accidentally remove management
  loading/error/empty or client actions; Attention component and E2E regressions
  must remain.
- Adding a named `main` can create duplicate/nested landmarks or mismatch the
  visible state; use the existing single `AppShell.Main` and test exact names.
- Broad attendance UI or authorization refactoring would mix TASK-104/domain
  scope into TASK-103 and must be rejected.

## Rollout and rollback
- No data migration or rollback script is needed.
- Build backend and frontend from the same TASK-103 commit/release set.
- Before deployment verify health plus four role session contract,
  `/attendance`, `/attention` and root `/` not-found recovery in the isolated
  stand.
- Rollback redeploys the previous paired backend/frontend artifacts; do not roll
  back only one side.
- Ephemeral browser history with legacy attendance/Home context safely falls
  back to Clients; no persisted server data is transformed.

## Stop conditions
Stop and do not write/continue functional code if:
- current `origin/main` lacks TASK-104/TASK-116 baselines or a competing
  navigation implementation exists;
- product role matrix, `Attention` identifier, `/attention` canonical route,
  root `/` not-found behavior or navigation order differs from the source task;
- implementation requires frontend role inference or an auth/permission model
  redesign rather than section representation;
- required backend/frontend deployment cannot be coordinated and no explicit
  compatibility contract is approved;
- client return cannot remain typed/fail-closed without arbitrary path input;
- `Attendance` cannot be kept mandatory primary within the released adaptive
  mobile navigation contract;
- scope expands into attendance rules, schedule redesign, TASK-104 layout,
  database changes or a system-wide router refactor;
- new tests fail for reasons unrelated to the intended missing behavior and the
  baseline cannot be explained.

Do not stop merely because both backend and frontend change, shared navigation
is reused, or the task remains medium-risk. Those risks are localized by the
phases and regression barriers above.
