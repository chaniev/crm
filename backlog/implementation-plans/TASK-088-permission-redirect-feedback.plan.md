# Implementation Plan: TASK-088 Заменить silent permission redirects явной обратной связью

## Source task
/backlog/implementation/TASK-088-permission-redirect-feedback.md

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
- Source task supplies approved interaction/focus contract. `ux-researcher`
  and `ui-designer` verify recovery hierarchy before implementation.

## Execution steps
1. Create isolated worktree and map all parsed routes, access checks,
   placeholders and navigation/deep-link tests.
2. Before production code add route unit tests:
   - parsing unknown path preserves requested pathname as `not-found`;
   - allowed section/read/detail;
   - restricted section and restricted write route;
   - requested destination, generic reason and valid recovery path;
   - recovery selection always belongs to accessible navigation/session;
   - SuperAdministrator `/finance` restriction without Finance navigation.
3. Before production code add App/component tests:
   - direct restricted route renders `RestrictedState`, correct title and focus;
   - direct unknown route renders separate not-found state;
   - session loading remains loader only while unresolved;
   - automatic access loss performs one replace and one polite notification;
   - back/forward does not loop or replay acknowledged denial.
4. Before production code add Playwright tests for Coach `/groups`,
   denied `/clients/new`, SuperAdministrator `/finance`, unknown path and access
   change after session refresh.
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
     later session/access update makes it restricted;
   - identify denial events so one event produces one notification.
8. Replace denied loader branches in `RouteViewport` with typed rendering at
   the routing boundary; retain allowed screen-level ProblemDetails for
   target-specific `403`.
9. Set document title/focus behavior:
   - direct restriction focuses heading and names requested destination;
   - not-found has its own title;
   - automatic replacement uses destination title and polite notification
     without focus theft.
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
- Backend integration tests are not applicable because session contract is unchanged.

### UI/e2e tests
- Direct Coach `/groups`, denied client create, SuperAdministrator `/finance`.
- Access change automatic recovery with visible/announced feedback.
- Unknown path and back/forward no-loop behavior.
- Responsive and compact-height visibility/focus.

## Test plan
- [ ] Route unit tests red before implementation.
- [ ] App integration tests red before implementation.
- [ ] Direct/automatic Playwright tests red before implementation.
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

## Risks
- A naive effect can redirect direct URLs before feedback renders.
- Notification deduplication can break back/forward or hide a new denial event.
- Parsing unknown paths as a new route variant can affect document titles and nav state.

## Stop conditions
Остановиться, если:
- valid recovery cannot be selected from backend-authorized sections;
- implementation requires new frontend permission semantics;
- direct vs automatic denial cannot be distinguished without changing session contract;
- route changes expand into a router replacement;
- task worktree/branch is invalid.

## Ready for Codex execution
yes
