# Implementation Plan: TASK-103 Выделить «Посещения» в самостоятельный раздел

## Source task
/backlog/risky/TASK-103-attendance-navigation-model.md

Карточка остаётся в `/backlog/risky`: этот файл готовит реализацию, но сам по
себе не переводит medium-risk cross-layer изменение в активное исполнение.

## Implementation branch
feature/TASK-103-attendance-navigation-model

Branch rules:
- перед изменением project code использовать
  `.agents/skills/task-worktree/SKILL.md` и создать либо безопасно возобновить
  отдельный worktree
  `../crm-worktrees/TASK-103-attendance-navigation-model`;
- создать branch непосредственно от актуального `origin/main`; primary
  repository оставить на `main`, а код менять только в task worktree;
- до первой правки подтвердить registered worktree, active branch, отсутствие
  unexplained changes и `git merge-base --is-ancestor origin/main HEAD`;
- не включать TASK-104, TASK-111 или другой redesign
  attendance/Attention/schedule;
- backend и frontend изменения TASK-103 должны находиться в одной task branch
  и выпускаться как один согласованный contract change.

Planning snapshot на 2026-08-19: primary repository находится на clean local
`main` `781aa86ed9a53b872716021413a6355c31c75ab3`, который на 7 commits опережает
локальный `origin/main` `921e17340922ebdab701d76fa671387e57577115`.
`origin/main` уже содержит завершённые TASK-104 и TASK-116. Локальной/remote
branch TASK-103 и назначенного ей worktree не найдено. Executor обязан сделать
`git fetch origin`, повторить preflight и не считать planning snapshot
актуальным execution base.

## Goal
Coach, Administrator, HeadCoach и SuperAdministrator открывают отметку факта
посещения через самостоятельный backend-authorized раздел `Посещения` с
canonical route `/attendance`. Бывшая `Главная` заменяется backend-authorized
section `Attention` с label `Внимание` и canonical route `/attention`;
`Расписание` остаётся отдельным `/schedule`, а route,
navigation, document title, main landmark, recovery и client-return используют
одну стабильную attendance-модель.

## Current understanding
- Продуктовые решения, role matrix, landing routes, mobile placement и
  SuperAdministrator scope подтверждены; blocking clarification questions нет.
- Backend уже объявляет `AppSection.Attendance`, но `AccessScopeService` не
  выдаёт section ни одной роли и оставляет `Home` landing для всех ролей;
  целевой contract удаляет `AppSection.Home` и добавляет `AppSection.Attention`.
- Frontend `AppSection`, session mapper и route registry не знают `Attendance`
  или `Attention`; `/attendance` намеренно закреплён unit-тестом как
  `not-found`, `/attention` также не существует, а `/` всё ещё означает `Home`.
- `AttendanceScreen` уже существует и переиспользует выпущенный
  `AttendanceWorkspace`, однако `RouteViewport` его не рендерит: workbench
  монтируется внутри attendance tab `HomeDashboard`.
- TASK-104 уже уплотнила attendance toolbar и сохранила row-local pending,
  success, failure, retry, stale refresh и scope-recovery states. TASK-103 не
  меняет их content, layout или attendance API semantics.
- TASK-116 хранит versioned client-profile return context, но attendance origin
  жёстко типизирован как section `Home`; explicit return и history validation
  поэтому пока восстанавливают `/`.
- TASK-088 уже предоставляет typed `allowed | restricted | not-found`, inline
  direct denial и polite automatic access-loss feedback. Нужно изменить его
  входной session/route contract, а не создавать новый redirect mechanism.
- Mobile navigation сейчас резервирует `Home`, `Schedule`, `Clients` и
  adaptive fourth slot. Простого добавления `Attendance` в список недостаточно:
  целевой порядок начинается с `Attendance`, `Home` заменяется на `Attention`,
  относительный порядок `Schedule` -> `Clients` сохраняется, а active overflow
  promotion вытесняет адаптивный `Clients`, не затрагивая первые три позиции.
- Backend/frontend contract меняется без database/schema migration и без
  изменения bot contract. `AuthEndpoints` уже сериализует `LandingScreen` и
  `AllowedSections` из `AccessScope`; отдельный transport DTO redesign не нужен.

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

## UX contract used
- Users: Coach, Administrator, HeadCoach, SuperAdministrator.
- Coach primary path: login -> `/attendance` -> active `Посещения` -> choose
  group/date -> mark attendance.
- Administrator primary path is the same; `Внимание` remains separately
  reachable as management inbox.
- HeadCoach/SuperAdministrator primary landing: login -> `/attention` -> active
  `Внимание`; `Посещения` is the first navigation item and remains reachable
  with one direct navigation action.
- Direct `/attention` for Coach remains at the requested URL and renders the
  TASK-088 restricted state; primary recovery is `Открыть Посещения` to
  `/attendance`.
- Direct `/` for an authenticated user is `not-found`, is not an alias for
  `/attention`, and offers the existing explicit recovery action to that
  user's backend-authorized landing section.
- Direct/reload/back/forward `/attendance` resolves to the same canonical route
  and `aria-current="page"` state without silent redirect or loop.
- Attendance row -> client details/edit -> `К посещениям` restores
  `groupId`, `trainingDate`, `rosterView` and `anchorClientId` on
  `/attendance`; malformed/stale context fails closed to `Клиенты`.
- `Расписание` always means planned sessions on `/schedule`, never the entry
  point for recording attendance.

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

## Execution roles
1. Planning-stage `ux-researcher` contract is complete: role paths, recovery,
   history and mobile-primary invariants are fixed above.
2. Planning-stage `ui-designer` handoff is complete: hierarchy, hidden heading,
   main landmark, responsive matrix, overflow promotion and focus semantics are
   fixed above.
3. `test-automator` writes/updates the backend contract, frontend unit/component
   and Playwright regressions before any production code and records red evidence.
4. `dotnet-backend-specialist` makes the minimal backend session/access-scope
   change after the backend red test is confirmed.
5. `react-specialist` consumes the approved contracts and implements the
   frontend mapper/route/navigation/Attention/return changes after frontend red
   tests are confirmed, using `react-best-practices`.
6. Coordinating agent verifies the shared worktree, test-first evidence,
   cross-layer result, integrated local stand and residual device risks.

## Execution steps

### Phase 0 — workspace and baseline
1. Run `git fetch origin`; reread root/backend/frontend `AGENTS.md`, source task,
   this plan, `task-worktree`, `crm-mobile-first-ui`, `react-best-practices` and
   `csharp-xunit` before their respective implementation/test work.
2. Create/resume the declared isolated branch/worktree and report verified
   worktree path, branch, base and current commit before edits.
3. Confirm current `origin/main` contains completed TASK-104 and TASK-116 and
   does not contain a competing TASK-103 branch/implementation.
4. Capture baseline green results for the focused backend authorization tests,
   current frontend unit tests and current affected Playwright specs. Baseline
   tests that intentionally assert the old model are expected to be green here.
5. Do not start Docker yet; unit/component/contract red-green work does not
   require a runtime stack.

### Phase 1 — write all required tests before functional code
6. Update backend HTTP integration tests in `AuthorizationFlowTests.cs` with the
   exact four-role matrix above. Preserve all permission and attendance-scope
   assertions to prove representation changed without privilege expansion, and
   assert that current `landingScreen`/`allowedSections` never serialize `Home`.
7. Update frontend API mapper unit tests so session JSON containing
   `Attendance`/`Attention` maps them in `landingScreen` and `allowedSections`,
   unknown entries inside `allowedSections` are dropped, and a user payload
   whose landing is unknown, legacy `Home`, missing or absent from the mapped
   allowed sections—or whose mapped allowed sections are empty—is rejected
   fail closed without substituting `Attention` or another local default.
8. Update `appRoutes` unit tests before implementation:
   - `/attendance` parse/serialize, exact label/path and allowed resolution;
   - `/attention` parse/serialize with section `Attention`, exact label/path and
     allowed resolution; `/` remains a separate `not-found` path;
   - Coach `/attention` restricted outcome with `/attendance`/`Посещения`
     recovery, while `/` uses role-specific not-found recovery;
   - all role navigation inventories and exact desktop order `Attendance`,
     `Attention`, `Schedule`, `Clients`, then the
     remaining authorized sections;
   - stable mobile primary sets and active overflow promotion which replaces
     `Clients` without displacing `Attendance`, `Attention` or `Schedule`;
   - reload/back/forward-equivalent route parsing and not-found separation.
9. Update shared navigation/component tests before implementation:
   - attendance icon/label/current state in sidebar and bottom navigation;
   - generic `Ещё`, displaced-item drawer membership, `aria-current`, focus
     return and authorized-only items;
   - named `main` landmark for allowed `Посещения`, `Внимание`, restricted and
     root not-found states.
10. Update Attention/Attendance component tests before implementation:
    - section `Attention` renders management inbox `Внимание` only, without a
      visible `Требуют внимания`, tablist or attendance API calls; its hidden
      `h1` remains available to screen readers without participating in layout,
      its accessible list name and attention loading/error/empty/success remain
      intact, and no heading spacer or flex gap precedes the first operational
      surface;
    - Attendance owns the semantic hidden `h1`, workbench and client-origin
      section `Attendance` without changing TASK-104 behavior.
11. Update client-profile return-state unit tests before implementation:
    - newly serialized attendance origin is `/attendance`/`Attendance`;
    - group/date/view/anchor/depth and unrelated history-state preservation;
    - current version round-trip and malformed payload rejection;
   - bump serialization to version 2; read a valid legacy version-1 `groupEdit`
     context as version 2 in memory without eagerly rewriting `history.state`,
     because its route is unchanged; reject legacy version-1 attendance/`Home`
     context and use the existing Clients fallback because its history entry
     cannot satisfy the new canonical URL.
12. Update `App` integration tests before implementation:
    - role-specific post-login landings and section rendering;
    - document titles, hidden/visible headings and named `main` landmarks;
    - direct Coach `/attention` denial, recovery and no initial silent redirect;
    - direct `/` not-found with backend-landing recovery and no Attention alias;
    - session access loss notification/replacement without loops;
    - attendance client-return validation on `/attendance`.
13. Update Playwright tests before implementation:
    - Coach and Administrator login land on `/attendance` with active
      `Посещения`; Coach has no `Внимание`;
    - HeadCoach/SuperAdministrator land on `/attention`, see active `Внимание`
      management inbox only and reach the first navigation item `Посещения` in
      one direct action;
    - canonical deep link, reload, back/forward and permission/access change;
    - client details/edit return restores attendance context and anchor;
    - `/schedule` remains separate and never renders attendance workbench;
    - mobile primary/overflow/accessibility/geometry matrix at required sizes.
14. Audit all realistic frontend unit/E2E session fixtures found by
    `allowedSections`/`landingScreen`: update canonical role fixtures to the new
    backend matrix; retain deliberately synthetic permission fixtures only when
    the test names and asserts that synthetic contract. Do not introduce a
    broad fixture-framework refactor in TASK-103.

### Phase 2 — prove the expected red state
15. Run the focused backend authorization tests. Expected red reason: current
    `AccessScopeService` still returns `Home` landing for all roles and omits
    both target `Attention` and `Attendance` contracts.
16. Run the focused frontend unit/component tests. Expected red reasons:
    mapper drops `Attendance` and `Attention`, `/attendance` and `/attention`
    are `not-found`, `/` still resolves as `Home`, mobile ordering lacks the
    target `Attendance`, `Attention`, `Schedule`, `Clients` priority,
    Home still owns attendance and attendance return origin is still legacy
    `Home`.
17. Run the new affected Chromium Playwright specs. Expected red reasons must
    match the same missing contract; distinguish genuine test/setup defects.
18. Save command/output evidence for each expected failure. Do not weaken
    assertions merely to get red tests compiling or passing.

### Phase 3 — backend contract implementation
19. Replace `AppSection.Home` with `AppSection.Attention`, then update
    `AccessScopeService` with the exact role matrix. Reuse the existing
    `AppSection.Attendance` constant; do not duplicate strings or role rules in
    transport code.
20. Keep permission set, attendance scope kind/group IDs, assigned groups,
    branch scope, group authorization and API ProblemDetails unchanged.
21. Rerun focused backend tests green, then the complete backend solution.

### Phase 4 — frontend route and session contract
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

### Phase 5 — separate the screens and update history
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

### Phase 6 — green and regression validation
34. Rerun all new focused tests green, then run the complete backend and
    frontend unit suites, lint and production build.
35. Run affected Chromium Playwright specs for attendance, auth landing,
    `Attention`/`Внимание`,
    route access, client-profile return, responsive screens and touch/navigation
    inventory.
36. Run target-iPhone WebKit projects and compact-height coverage. Treat desktop
    Chromium viewport resizing as geometry evidence, not iPhone Safari proof.
37. Start a task-local Docker Compose stack only after automated green checks:
    choose free ports, use unique `COMPOSE_PROJECT_NAME`, keep `BOT_ENABLED=false`
    and do not reuse another task's containers/volumes.
38. On the integrated backend/frontend stand, smoke all four role landings,
    actual session JSON, direct `/attendance`, Coach direct `/attention`
    recovery, root `/` not-found recovery, management `Внимание` and
    attendance client return. Stop the exact task stack
    without deleting volumes unless the implementation workflow needs it kept.
39. Review final diff for product-code scope, generated artifacts, fixture drift
    and accidental TASK-104/attendance-domain changes.

## Preferred implementation strategy
1. One atomic cross-layer task branch with small verifiable commits:
   tests/red evidence -> backend contract -> frontend contract/route ->
   screen/history wiring -> green/regression evidence.
2. Contract-first exact role matrix; frontend only consumes backend sections.
3. Reuse TASK-088, TASK-104, TASK-116 and shared navigation components; do not
   replace them with a new router, state store or authorization layer.
4. No feature flag is required for a coordinated CRM release. Backend-first or
   frontend-first independent rollout is unsafe because old frontend drops
   `Attendance`/`Attention` and new frontend rejects old session section `Home`;
   deploy/rollback the paired backend and frontend artifacts together.
5. If runtime requires independent rolling compatibility, stop and design an
   explicit version/feature capability before code rather than temporarily
   deriving access from role strings.

## Files likely to change

Backend production:
- `backend/src/GymCrm.Infrastructure/Authorization/AccessScopeService.cs`
- `backend/src/GymCrm.Application/Authorization/AppSection.cs` to remove `Home`
  and add `Attention` while preserving the existing `Attendance` constant

Backend tests:
- `backend/tests/GymCrm.Tests/AuthorizationFlowTests.cs`

Frontend production:
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/auth.ts`
- `frontend/src/lib/appRoutes.ts`
- `frontend/src/lib/resources.ts`
- `frontend/src/App.tsx`
- `frontend/src/App.css`
- `frontend/src/features/shared/AppLayout.tsx`
- `frontend/src/features/shared/navigationIcons.tsx`
- rename `frontend/src/features/home/HomeDashboard.tsx` to
  `frontend/src/features/attention/AttentionDashboard.tsx`
- move `frontend/src/features/home/AttentionPanel.tsx` to
  `frontend/src/features/attention/AttentionPanel.tsx` and preserve its
  visually-hidden list name without adding a visible operation heading
- `frontend/src/features/attendance/AttendanceScreen.tsx`
- `frontend/src/features/clients/clientProfileReturnState.ts`

Frontend unit/component tests:
- `frontend/src/lib/api/auth.test.ts`
- `frontend/src/lib/appRoutes.test.ts`
- `frontend/src/App.test.tsx`
- `frontend/src/features/shared/ux.test.tsx`
- rename `frontend/src/features/home/HomeDashboard.test.tsx` to
  `frontend/src/features/attention/AttentionDashboard.test.tsx`
- `frontend/src/features/attendance/AttendanceScreen.test.tsx`
- `frontend/src/features/clients/clientProfileReturnState.test.ts`

Primary Playwright tests:
- `frontend/e2e/attendance.spec.ts`
- `frontend/e2e/auth.spec.ts`
- rename `frontend/e2e/home-dashboard.spec.ts` to
  `frontend/e2e/attention-dashboard.spec.ts`
- `frontend/e2e/route-access-feedback.spec.ts`
- `frontend/e2e/client-profile-context-navigation.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`
- `frontend/e2e/iphone-target-devices.spec.ts`
- `frontend/e2e/touch-target-inventory.spec.ts`
- other specs containing canonical role session fixtures, discovered before
  editing and changed only where the backend matrix affects their assumptions

No database, migration, bot or deploy production files are expected to change.

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

## Required test coverage

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

## Test plan
- [ ] Backend role matrix tests written before production code and confirmed red.
- [ ] Frontend unit/component tests written before production code and confirmed red.
- [ ] Affected Playwright tests written before production code and confirmed red.
- [ ] `dotnet test backend/GymCrm.slnx` passes.
- [ ] `cd frontend && npm run lint` passes.
- [ ] `cd frontend && npm run build` passes.
- [ ] `cd frontend && npm run test:unit` passes.
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
- branch/worktree/base differs from this plan or contains unexplained changes;
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

## Ready for Codex execution
yes — plan is implementation-ready, but the source task intentionally remains
in `/backlog/risky`; begin only after explicit selection for execution, human
review of this contract and creation of the declared isolated worktree.
