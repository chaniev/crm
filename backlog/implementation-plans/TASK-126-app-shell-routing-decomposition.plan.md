# Implementation Plan: TASK-126 Декомпозировать App shell и routing orchestration

## Metadata
- source_task: /backlog/implementation/TASK-126-app-shell-routing-decomposition.md
- branch: refactor/TASK-126-app-shell-routing-decomposition
- readiness: yes
- dependencies: none
- risk: medium — history snapshots, auth stages and permission recovery share one React state graph

## Goal
`App.tsx` становится composition/session root не более 700 строк, а typed
routing/history, auth stages, authenticated shell and route viewport получают
отдельных owners без видимого или access-contract изменения.

## Decisions and contracts
- `App` сохраняет `AppProps`, config/session loading, auth mutations and top-level composition.
- `useAppRoute`/routing module становится единственным owner pathname parsing,
  `pushState`/`replaceState`, `popstate`, pending return snapshots and document titles.
- Auth stage screens получают typed state/callback props и не загружают session сами.
- `AuthenticatedShell` владеет текущей navigation/profile/logout presentation;
  `RouteViewport` только dispatches current typed route/access outcome.
- Сохранить `appRoutes`, routes/labels/DOM hierarchy, role/access outcomes,
  focus/return behavior and existing Mantine/Onest presentation.

## Scope
### In
- App-level routing/history hook/helpers, auth stage presentation, shell and viewport extraction.

### Out
- New routes/navigation/UX, access-matrix changes, feature decomposition,
  React Router/global store/framework or backend changes.

## Implementation slices
1. Дополнить routing/history/auth characterization around current `App`.
2. Выделить typed routing/history helpers and hook; keep one History API listener/owner.
3. Выделить auth stage screens with explicit callback/state props.
4. Выделить `AuthenticatedShell` and `RouteViewport`, then reduce `App` to composition/session orchestration.

## Likely files and layers
- `frontend/src/App.tsx` — final composition/session root.
- `frontend/src/app/useAppRoute.ts` and tests — route/history/return/title owner.
- `frontend/src/app/AuthStages.tsx` — login/forced/utility password presentation.
- `frontend/src/app/AuthenticatedShell.tsx` — current shell/navigation/profile.
- `frontend/src/app/RouteViewport.tsx` — typed route dispatch and recovery surfaces.
- `frontend/src/lib/appRoutes.ts` and tests — stable route contract, changed only if extraction needs exports.
- `frontend/src/App.test.tsx`, `frontend/e2e/auth.spec.ts`, `frontend/e2e/client-profile-context-navigation.spec.ts`.

## Regression specification
### Automated tests to add or update
- Routing helper/hook tests cover direct/deep link, push/replace/no-op,
  back/forward, malformed path, document title and pending return snapshot mismatch.
- App integration covers loading → login → forced password → authenticated,
  utility-password return, logout pending and session/config errors.
- Access matrix keeps allowed/restricted/not-found outcomes and same-user
  one-time recovery without replay for another user or history navigation.
- Client/group/attendance return contexts survive details/edit round trips with focus recovery.
- Browser tests cover deep-link/refresh/back-forward and shell reachability at
  390x844, 420x912, 440x956, 912x420 and 956x440.

### Expected red evidence
- Behavior characterization is expected green on baseline and must stay green;
  artificial behavior red is inappropriate for this structural task. Record
  the concrete structural baseline: `App.tsx` is 2013 lines and the named
  boundaries do not yet exist.

### Required validation
- Focused unit run for `App.test.tsx`, `appRoutes.test.ts` and new routing tests.
- Affected `auth.spec.ts` and `client-profile-context-navigation.spec.ts` on Chromium and target-iPhone WebKit.
- Verify `App.tsx <= 700` and each new app-level module `<= 600` lines.

### Manual evidence
- Report any unverified physical Safari chrome/safe-area/software-keyboard behavior; no visual change is expected.

### Regression barrier
- `App.test.tsx` route/auth/access matrix plus browser deep-link → nested client
  return → back/forward → access-loss recovery sequence on desktop and target-iPhone WebKit.

## Risks and stop conditions
- Остановиться, если extraction changes visible navigation/access/focus or adds
  a second history listener/route state owner.
- Остановиться, если a feature screen must change its public workflow; handle it in its own task.
- Do not trade the line target for prop-drilling cycles or a new global store.
