# Implementation Plan: TASK-088 Заменить silent permission redirects явной обратной связью

## Source task
/backlog/done/2026-07-30/TASK-088-permission-redirect-feedback.md

Source status is `done`: implementation commit `2ca95ef`, integration commit
`7c43c04` and stabilization commit `c69f47b` are present on current
`origin/main`; frontend unit, Chromium, target-iPhone WebKit, lint and build
barriers passed during the 2026-07-30 status audit.

## Implementation status

Done. The status audit verified final release behavior; historical
pre-implementation red-phase ordering was not reconstructed.

## Implementation branch
fix/TASK-088-permission-redirect-feedback

Branch rules:
- использовать `.agents/skills/task-worktree/SKILL.md` и отдельный clean
  worktree from current `origin/main`;
- не менять backend session/permission schema;
- не смешивать target-specific API `403` handling or unrelated navigation redesign;
- confirm the branch before test or production edits.

## Goal
Заменить path-only fallback на typed route access outcome
`allowed | restricted | not-found`, показывать persistent inline restriction
для direct denied URL и one-time polite notification только при automatic
recovery после изменения access/session.

## Current understanding
- `parseRoute` currently maps unknown paths to Home, so unknown and denial are
  indistinguishable.
- `resolveAccessibleRoutePath` returns only a path and loses requested route,
  reason and recovery choice.
- `App` redirects in an effect as soon as session loads, while
  `RouteViewport` retains several loader placeholders for denied paths.
- Shared `RestrictedState` and notification infrastructure already exist.
- Navigation remains derived from backend `allowedSections`, permissions and
  action options; no role-name inference is needed.
- Source task supplies the interaction/focus contract. The `ux-researcher` and
  `ui-designer` review is recorded in the decisions and UI specification below.

## Resolved product/UX decisions
- Recovery UI exposes exactly one primary action. Do not render a competing
  secondary/alternative recovery action.
- Recovery destination is deterministic and backend-authorized:
  - restricted nested route: use its readable parent section when that parent
    is currently accessible, otherwise use the generic recovery destination;
  - restricted section/read route: use `landingScreen` only if that section is
    accessible in the current session, otherwise use the first accessible
    navigation section;
  - if no valid recovery can be selected from current session navigation, stop
    implementation and escalate instead of inventing frontend permission rules.
- Copy is generic and must not infer that a named role caused the restriction.
  Use text such as `У вас нет доступа к разделу «Группы».` or `У вас нет
  доступа к операции «Новый клиент».` without `У роли ... нет доступа ...`
  unless backend later provides an explicit reason.
- A new automatic denial event exists only for transition
  `allowed -> restricted` on the current pathname for the same authenticated
  user. Reload/direct URL/back-forward to an already restricted route renders
  inline state. User change/login/logout resets event history.
- `/attendance` is no longer a legacy alias. It must parse as `not-found`, not
  normalize to Home.
- Access loss after session refresh is covered by an App integration test.
  Do not add polling, test-only production hooks or a Playwright-only session
  refresh mechanism for this task.

## Resolved `/password` utility route decision
- Use context-aware return (former Option A).
- Keep direct `/password` allowed for any authenticated user who is not in
  forced password-change mode. The route has no active CRM section and is not a
  permission denial.
- Preserve the saved return pathname and its typed access outcome at the moment
  the utility route opens.
- On utility Back or successful password change:
  - an originally `allowed` route that remains allowed returns to the saved
    pathname;
  - an originally `restricted` or `not-found` route returns to the saved
    pathname and renders the same inline state, avoiding a new silent fallback;
  - if the same user's originally allowed route becomes restricted in the
    session returned by password change, treat it as the defined automatic
    `allowed -> restricted` event: replace to the single authorized recovery
    destination and announce it once;
  - a missing return pathname uses the single authorized recovery destination.
- When password success and automatic route recovery happen together, emit one
  combined polite notification instead of competing success and denial
  notifications.
- Keep forced password change separate from route access resolution. After a
  forced change succeeds, navigate to the single authorized recovery
  destination selected from the new session.

## UI and accessibility specification

### Route-level restricted state
- Reuse existing CRM state styling and Mantine/Onest tokens. If
  `RestrictedState` is reused, extend it minimally so route-level states can
  participate in the route heading contract.
- The route boundary must expose exactly one semantic `h1`. When the restricted
  state is the only visible route content, its visible focused heading is that
  `h1`; do not also render a duplicate hidden `PageLayout` heading.
- Content hierarchy:
  1. one focused visible heading: `Нет доступа`;
  2. one generic explanation naming the requested destination, not the user's
     role: `У вас нет доступа к разделу «Группы».` or `У вас нет доступа к
     операции «Новый клиент».`;
  3. exactly one primary recovery action.
- Primary action hierarchy:
  - restricted nested route: `Открыть {parentSectionLabel}` when the readable
    parent section is accessible, for example `Открыть клиентов` for
    `/clients/new`;
  - restricted section/read route: `Открыть {landingScreenLabel}` when
    `landingScreen` is accessible, otherwise `Открыть {firstAccessibleSection}`;
  - if the selected recovery label cannot be resolved from authorized
    navigation, stop and escalate; do not render a generic second choice.
- Do not render `secondaryAction` in this task even if the shared component
  supports it.
- Document title: `{requestedDestinationLabel} — нет доступа`.
- Direct restricted URL focus: after mount, move focus to the `h1` with
  `tabIndex={-1}`. The primary recovery action is the next tabbable element.
- Automatic access-loss recovery: do not mount the restricted state before
  redirect. Replace to the authorized recovery destination, keep destination
  focus behavior, and show only one polite notification.

### Not-found state
- Unknown paths, including `/attendance`, render a separate not-found state and
  are not treated as permission denials.
- Content hierarchy:
  1. focused visible `h1`: `Страница не найдена`;
  2. description: `Такой страницы нет или ссылка устарела.`;
  3. exactly one primary action: `Открыть {authorizedRecoveryLabel}`.
- Document title: `Страница не найдена`.
- Do not display raw malformed or undecodable path text. Preserve the requested
  pathname in route outcome/test data, but use safe generic copy in UI.
- Focus behavior matches direct restricted URL: focus the `h1` on mount; the
  primary recovery action follows it in tab order.

### Route-denial notification
- Notification is only for same-user automatic `allowed -> restricted` on the
  current pathname.
- Copy is generic and non-blaming, for example:
  - title: `Открыт доступный раздел`;
  - message: `Раздел «Группы» больше недоступен. Открыты «Клиенты».`
- Notification must be announced as polite status feedback:
  `role="status"` and `aria-live="polite"`. Mantine's default assertive
  notification semantics must be overridden or wrapped for this route-level
  notification if they resolve to `role="alert"`.
- On mobile, the notification remains at the top with normal spacing plus the
  top safe-area inset and does not cover the route heading or primary recovery
  action.
- Do not move focus to the notification. Do not replay the notification on
  reload, Back/Forward, already-restricted state, user change, login or logout.

### Responsive matrix
- 360 px width:
  - state content is one column inside the existing shell content area;
  - horizontal page overflow is forbidden;
  - heading, description and primary action may wrap, but the action keeps at
    least a `44 x 44px` touch target and full available width.
- 390 x 844 baseline:
  - use this as the narrow stress layout;
  - content padding follows existing route padding, with at least `16px`
    inline breathing room;
  - primary action is full width under the explanation, remains visible or
    reachable in the normal page scroll and is not covered by shell controls.
- iPhone Air 420 x 912:
  - same one-column layout;
  - do not introduce secondary actions or extra explanatory blocks just because
    width is available.
- iPhone 17 Pro Max 440 x 956:
  - same hierarchy and action placement;
  - state block may use a max readable width, but must remain visually aligned
    with existing CRM route content rather than floating as a separate landing
    page design.
- 768 px:
  - keep one state column, centered within the content region with max readable
    width around the existing form/state width;
  - shell navigation remains the existing tablet behavior and must not expose
    unauthorized routes.
- 1440 px:
  - keep the state compact and centered in the main content area;
  - do not add desktop-only alternative actions, illustrations or explanatory
    panels.

### Compact-height and visible-viewport behavior
- At 912 x 420 and 956 x 440 landscape:
  - keep shell navigation in its existing compact-height mode;
  - place the state near the top of the scrollable main content instead of
    vertical-centering it off-screen;
  - reduce only vertical gaps, not font size below existing route-state scale;
  - the primary recovery action must be reachable without horizontal scroll,
    clipping or nested scrolling; normal main-page vertical scroll is
    acceptable when Safari chrome reduces the visual viewport.
- No temporary surface, dialog or form is introduced by this task. If the
  implementation touches an existing shell surface, its fixed/sticky controls
  must continue to clear `env(safe-area-inset-*)`.
- Do not implement the recovery action as a fixed bottom bar. Keep it in normal
  document flow so Safari chrome and the software keyboard cannot cover it.

### Operational and interaction states
- Loading: keep loader only while auth/session/route outcome cannot yet be
  resolved. Do not show restricted/not-found copy during unresolved session
  loading.
- Empty: there is no empty state for route denial. If no authorized recovery
  destination exists in session navigation, this is a stop condition for the
  implementation plan.
- Error: target-specific API `403` and ProblemDetails remain screen-level and
  out of scope; route-level resolver errors must not be disguised as
  permission denials.
- Disabled: the primary recovery action should normally be a link/button that
  navigates immediately. Do not add a disabled state unless an async navigation
  state actually exists.
- Keyboard:
  - direct restricted/not-found: programmatically focus `h1`; the primary
    action is the next tabbable element inside the route state, while existing
    shell tab order remains unchanged;
  - primary action activates with Enter/Space when rendered as a button, or
    Enter when rendered as a link;
  - Escape has no special behavior;
  - browser Back/Forward must not create redirect loops or notification replay.

## Execution steps
1. Create isolated worktree and map all parsed routes, access checks,
   placeholders and navigation/deep-link tests.
2. Before production code add route unit tests:
   - parsing unknown path preserves requested pathname as `not-found`;
   - `/attendance` parses as `not-found`;
   - allowed section/read/detail;
   - restricted section and restricted write route;
   - requested destination, generic reason and valid recovery path;
   - recovery selection always belongs to accessible navigation/session;
   - SuperAdministrator `/finance` restriction without Finance navigation;
   - direct `/password` utility access plus allowed, restricted, not-found and
     missing context-aware return destinations.
3. Before production code add App/component tests:
   - direct restricted route renders `RestrictedState`, correct title and focus;
   - direct unknown route renders separate not-found state;
   - malformed encoded unknown path renders not-found without exposing unsafe
     raw path text;
   - session loading remains loader only while unresolved;
   - automatic access loss performs one replace and one polite notification;
   - automatic denial is only same-user `allowed -> restricted` on the current
     pathname; reload/back-forward/already-restricted states do not replay it;
   - selected utility password return behavior does not create silent fallback
     or replay an automatic denial notification;
   - back/forward does not loop or replay acknowledged denial.
4. Before production code add Playwright tests for Coach `/groups`,
   denied `/clients/new`, SuperAdministrator `/finance`, unknown path and
   back/forward no-loop behavior. Access change after session refresh stays in
   App integration coverage for this task.
5. Run new tests and confirm expected failures from Home normalization, path-only
   resolution, redirect effect and `RouteRedirectPlaceholder`.
6. Introduce typed route model/outcome:
   - preserve unknown path as a route outcome;
   - implement one `resolveRouteAccess` boundary;
   - include requested route label/path, generic denial reason and authorized
     recovery destination without frontend domain semantics.
7. Refactor App routing:
   - compute outcome once from route + session;
   - on initial deep link/reload render inline restricted/not-found state;
   - only auto-replace when a route was allowed in the active session and a
     later session/access update makes the current pathname restricted for the
     same authenticated user;
   - identify denial events so one event produces one notification;
   - reset denial-event history on login/logout/authenticated user change.
8. Replace denied loader branches in `RouteViewport` with typed rendering at
   the routing boundary; retain allowed screen-level ProblemDetails for
   target-specific `403`.
9. Set document title/focus behavior:
   - direct restriction focuses heading and names requested destination;
   - not-found has its own title, heading, focus target and primary recovery;
   - automatic replacement uses destination title and polite notification
     without focus theft;
   - `RestrictedState` must not mount and steal focus before automatic
     replacement;
   - route-level notification feedback must be exposed as polite status
     (`role="status"` with `aria-live="polite"`), not assertive alert.
10. Run focused red→green unit/component/e2e tests, then full frontend
    unit/lint/build and target-device checks.

## Preferred implementation strategy
1. Typed pure route access resolution.
2. Initial direct-denial rendering.
3. Event-based automatic recovery after access loss.
4. Not-found separation.
5. Navigation/security non-regression matrix.

## Files likely to change
- `frontend/src/lib/appRoutes.ts`
- `frontend/src/lib/appRoutes.test.ts`
- `frontend/src/App.tsx`
- focused App/routing component test file
- `frontend/src/features/shared/RestrictedState.tsx` only if a missing generic
  slot is proven; prefer existing API
- `frontend/src/features/shared/notifications.ts` only if event id support is needed
- affected authorization/navigation Playwright specs
- `frontend/e2e/responsive-main-screens.spec.ts`

## Constraints
- Frontend consumes, never redefines, backend access semantics.
- Direct denied deep link must not auto-replace.
- Automatic replace is only for an actual access/session change during work.
- Unknown route is not a permission denial.
- `/attendance` is an unknown route and must render not-found.
- `/password` is a utility route, not an app navigation section; its direct and
  return behavior follows the context-aware contract above.
- No unusable controls or Finance navigation item may appear.

## Out of scope
- Backend RBAC/session changes.
- Access request workflow.
- Screen-level API `403` recovery.
- Staff mutation rules and create-role options beyond regression assertions.

## Required test coverage

### Unit tests
- Typed parser/access outcome and recovery selection matrix.
- Event identity/deduplication helper if extracted.
- Document-title mapping for restricted/not-found outcomes if pure.

### Integration tests
- App component tests integrate session loading/update, route outcome,
  navigation replace, notification and focus.
- Tests are written before production code and first fail on current silent redirect.
- Same-user session refresh access loss is covered here; do not introduce
  polling or production-only test hooks.
- Backend integration tests are not applicable because session contract is unchanged.

### UI/e2e tests
- Direct Coach `/groups`, denied client create, SuperAdministrator `/finance`.
- Unknown path and back/forward no-loop behavior.
- Responsive and compact-height visibility/focus at 360 px, 390 x 844,
  420 x 912, 440 x 956, 768 px, 1440 px, plus 912 x 420 and 956 x 440
  landscape smoke checks.

## Test plan
- [ ] Route unit tests red before implementation.
- [ ] App integration tests red before implementation.
- [ ] Direct restricted/not-found and back/forward Playwright tests red before
      implementation.
- [ ] `npm run test:unit`
- [ ] affected Playwright specs
- [ ] `npm run test:e2e:iphone`
- [ ] `npm run lint`
- [ ] `npm run build`

## Regression barrier
A typed unit matrix plus App integration and browser tests must prove that direct
denials are persistent inline states, automatic access-loss recovery notifies
exactly once, not-found remains separate, recovery is authorized, and existing
navigation/staff-action baselines are unchanged.
The matrix must also prove that `/attendance` is not-found and that `/password`
follows the context-aware return contract without silent fallback.

## Risks
- A naive effect can redirect direct URLs before feedback renders.
- Notification deduplication can break back/forward or hide a new denial event.
- Parsing unknown paths as a new route variant can affect document titles and nav state.
- Password utility return can accidentally preserve the old silent fallback if
  it continues using path-only `resolveAccessibleRoutePath`.

## Stop conditions
Остановиться, если:
- valid recovery cannot be selected from backend-authorized sections;
- implementation requires new frontend permission semantics;
- direct vs automatic denial cannot be distinguished without changing session contract;
- route changes expand into a router replacement;
- task worktree/branch is invalid.

## Ready for Codex execution
no — implementation completed
