# Implementation Plan: TASK-049 Настраиваемое название клуба при деплое

## Source task
/backlog/risky/TASK-049-deploy-club-name-branding.md

Note: the source task remains in `/backlog/risky`. It is planned here because risky tasks are allowed to receive detailed implementation plans, but it should not be moved to active implementation until the executor starts the dedicated branch and validates the runtime/config contract.

## Implementation branch
feature/TASK-049-deploy-club-name-branding

Branch rules:
- create this branch before writing project code;
- create it from updated `main`;
- run `git pull` and verify clean `git status` before branch creation;
- if the branch already exists, verify that it belongs only to `TASK-049`;
- do not implement unrelated white-label branding, favicon, colors, logo, tenancy or settings UI in this branch;
- confirm the branch is active before making backend, frontend or deploy changes.

## Goal
Deployment administrators can set the club name through runtime env. The backend normalizes that value, exposes it through an explicit config contract, and the frontend shows it in current user-facing brand places instead of hardcoded `Gym CRM`, with safe fallback and ellipsis for long names.

## Current understanding
- This is a full-stack runtime/config task: backend contract, frontend consumer and deploy compose examples must be updated together.
- Backend remains the source of truth for the resolved value. Frontend must not add an independent `VITE_*` club-name env path.
- Missing, empty or whitespace env must resolve to `Gym CRM` in backend.
- Updating the club name may require backend and frontend restart; hot reload/runtime update is out of scope.
- The current frontend API base path is `VITE_API_BASE_PATH ?? '/api'`; nginx/vite proxy `/api/*` to backend routes without the `/api` prefix.
- A dedicated public backend route such as `GET /config` can be consumed as `/api/config` by frontend. It must be reachable before login and while password change is required.
- Current visible hardcoded app brand spots include:
  - `frontend/index.html` title fallback;
  - `frontend/src/features/shared/Header.tsx` default `brandTitle = 'Gym CRM'`;
  - `frontend/src/App.tsx` logout notification, auth story kicker/title text, login heading, loading heading;
  - frontend tests/e2e expectations that assert `Gym CRM`.
- Current header CSS already has ellipsis for `.app-shell__brand-title`; auth/loading brand text may need explicit classes or title attributes for long names.
- Deployment examples live in `deploy/.env.example`, `deploy/docker-compose.yml` and `deploy/docker-compose.server.yml`.
- Nearest rules: `backend/AGENTS.md`, `frontend/AGENTS.md`, `deploy/AGENTS.md`.

## Execution steps
1. Prepare the implementation branch from updated `main`: checkout `main`, pull, verify clean status, create or switch to `feature/TASK-049-deploy-club-name-branding`.
2. Reconfirm the actual hardcoded app-brand surface with `rg -n "Gym CRM" frontend backend deploy`, ignoring historical docs/backlog as required by the task.
3. Backend contract:
   - add an API-layer options type, for example `BrandingOptions` or `AppConfigOptions`, with section name such as `Branding`;
   - define backend fallback constant `Gym CRM`;
   - normalize `ClubName` by trimming whitespace and falling back when missing/empty;
   - add a response DTO such as `AppConfigResponse` with `clubName`;
   - map a public `GET /config` endpoint returning the normalized value;
   - ensure the route is accessible without auth and is allowed for authenticated users that still must change password.
4. Backend configuration wiring:
   - bind the new options section in `Program.cs`;
   - prefer validation that cannot break local dev when the value is omitted;
   - keep this API-layer/runtime concern out of Domain/Application business rules.
5. Backend tests:
   - add contract tests for custom club name;
   - add fallback tests for missing, empty and whitespace values;
   - add an accessibility test that `GET /config` works before login;
   - if the password-change middleware blocks the route, add coverage for that allow-list behavior.
6. Frontend API contract:
   - add `AppConfigResponse`/`AppConfig` type in `frontend/src/lib/api/types.ts`;
   - add `API_ENDPOINTS.config` and `getAppConfig()` in a focused API module;
   - export the new contract from `frontend/src/lib/api.ts`;
   - do not add a frontend club-name env var.
7. Frontend app state:
   - load app config during bootstrap, preferably before or in parallel with session loading;
   - pass `clubName` into auth screens, loading state, `StageFrame`, and `AuthenticatedShell`;
   - update `document.title` to the resolved club name after config is loaded, while keeping `frontend/index.html` as static fallback only;
   - keep bootstrap error behavior clear if config/session cannot be loaded.
8. Replace current user-facing brand literals:
   - header brand title;
   - auth story kicker and title text that currently says `Gym CRM`;
   - login heading `Войти в Gym CRM`;
   - loading heading `Открываем Gym CRM`;
   - logout notification message;
   - affected tests/e2e assertions.
9. Long-name layout:
   - keep or add CSS ellipsis on constrained brand containers, especially header/mobile header and auth story kicker;
   - preserve accessible/full value with `title` or equivalent where practical;
   - avoid manual fixed-character truncation unless a container cannot use CSS ellipsis reliably.
10. Deployment/runtime updates:
   - add a clear deploy env variable in `deploy/.env.example`, for example `CRM_CLUB_NAME=Gym CRM`;
   - map it only into backend config in both compose files, for example `Branding__ClubName: ${CRM_CLUB_NAME:-Gym CRM}`;
   - do not pass club name as a frontend build arg or `VITE_*` variable.
11. Frontend tests:
   - update shared Header/component tests to assert custom brand rendering;
   - add API contract/unit coverage for `getAppConfig()` if the existing API test style supports it;
   - update e2e API stubs to handle `/api/config`;
   - add e2e coverage for custom name, default/fallback name and a long-name visual/truncation scenario.
12. Runtime validation:
   - run backend tests;
   - run frontend lint/build and targeted tests;
   - run compose config validation for deploy runtime changes;
   - manually verify UI with custom, missing and long club names.

## Preferred implementation strategy
1. Contract-first: implement backend normalization and `GET /config` before frontend consumption.
2. Runtime-isolated: keep the env variable backend-only and document it in deployment config.
3. Incremental frontend integration: wire the app config into the shell/auth/loading surfaces before broad text replacement.
4. Regression-first: add backend fallback contract tests and frontend/e2e brand rendering checks alongside the feature.
5. Visual containment: rely on CSS ellipsis and stable flex constraints rather than widening shell/header containers.

Avoid:
- frontend `VITE_CLUB_NAME` or other independent frontend env fallback logic;
- storing club name in CRM entities, settings dictionaries or database;
- changing roles, permissions, auth rules, memberships, attendance or audit semantics;
- replacing historical `Gym CRM` mentions in docs/backlog;
- implementing logos, colors, favicon, domain, email templates or multitenancy.

## Files likely to change
- `backend/src/GymCrm.Api/Program.cs`
- `backend/src/GymCrm.Api/Startup/ApiHostingConstants.cs`
- `backend/src/GymCrm.Api/Auth/AuthenticatedUserMiddleware.cs`
- `backend/src/GymCrm.Api/Startup/AppConfigEndpoints.cs` or equivalent new API contract file
- `backend/src/GymCrm.Api/Startup/AppConfigOptions.cs` or equivalent new options file
- `backend/src/GymCrm.Api/Startup/AppConfigResponse.cs` or equivalent new response DTO
- `backend/src/GymCrm.Api/appsettings.json`
- `backend/src/GymCrm.Api/appsettings.Development.json`
- `backend/tests/GymCrm.Tests/AppConfigApiTests.cs` or equivalent new backend test file
- `frontend/src/lib/api/endpoints.ts`
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/api/config.ts` or equivalent new API module
- `frontend/src/App.tsx`
- `frontend/src/App.css`
- `frontend/src/features/shared/Header.tsx`
- `frontend/src/features/shared/ux.test.tsx`
- `frontend/e2e/auth.spec.ts`
- `frontend/e2e/home-dashboard.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts` if long-name layout is covered there
- `frontend/index.html`
- `deploy/.env.example`
- `deploy/docker-compose.yml`
- `deploy/docker-compose.server.yml`

## Constraints
- Backend must normalize absent, empty and whitespace env to `Gym CRM`.
- Frontend must consume the resolved value from backend config contract.
- Local dev must continue without new required manual env variables.
- Config changes may require backend/frontend restart; live runtime update is not required.
- The config contract must be explicit and typed on both sides.
- Long names must not break header/sidebar/mobile layout and must visually ellipsize in constrained containers.
- Do not duplicate CRM domain/business rules outside backend.
- Do not introduce persistence or migrations for this task.
- Do not expose secrets or add hidden deployment dependencies.

## Out of scope
- Full white-label branding.
- Logo, color palette, favicon, domain or email template changes.
- Multitenancy or per-CRM-user club names.
- Editing club name from inside CRM UI.
- Historical docs/backlog replacements.
- Auth/roles/permissions/access-scope changes except allowing the new public config endpoint through existing password-change middleware if needed.

## Required test coverage

### Unit tests
Add or update unit tests if the implementation introduces pure helpers:
- backend normalization helper returns custom trimmed value;
- backend normalization helper falls back for null, empty and whitespace;
- frontend API module builds/requests the expected config endpoint if existing transport tests make this practical;
- `Header` renders a supplied brand title instead of defaulting to `Gym CRM`.

### Integration tests
Backend integration/contract tests are required:
- `GET /config` returns `{"clubName":"Gym CRM"}` without explicit config;
- `GET /config` returns custom value when `Branding:ClubName` is configured;
- empty/whitespace config returns fallback;
- endpoint is public before login;
- endpoint remains available while authenticated user has `mustChangePassword` if the middleware path allow-list is touched.

Deploy/runtime integration:
- compose config validates after adding `CRM_CLUB_NAME` mapping in both compose files.

### UI tests
Frontend UI/e2e coverage should include:
- login/auth shell shows a custom club name from `/api/config`;
- authenticated header shows custom club name;
- missing/fallback config path still shows `Gym CRM`;
- long club name does not create horizontal page overflow on mobile and header brand text ellipsizes.

### Regression priority
Medium-high. The code change is small, but the blast radius crosses backend config, frontend bootstrap and deployment examples. Automated backend contract tests plus frontend bootstrap/e2e coverage are mandatory.

### Minimum expectation
- Backend contract tests protect fallback/custom behavior.
- Frontend tests protect brand propagation into header/auth surfaces.
- E2E or visual check protects long-name layout on mobile.
- Compose config validation protects deployment env wiring.

## Test plan
- [ ] `dotnet test backend/GymCrm.slnx`
- [ ] `cd frontend && npm run test:unit`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:e2e -- auth.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- home-dashboard.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- responsive-main-screens.spec.ts` if long-name layout coverage is added there
- [ ] `docker compose --project-directory . --env-file .env -f deploy/docker-compose.yml config --quiet`
- [ ] Manual check with `CRM_CLUB_NAME` unset or empty: UI shows `Gym CRM`.
- [ ] Manual check with `CRM_CLUB_NAME=Iron Club`: auth and authenticated shell show `Iron Club`.
- [ ] Manual check with a long `CRM_CLUB_NAME`: mobile/desktop header uses ellipsis and no horizontal layout break appears.

## Regression barrier
Primary barrier: backend `AppConfigApiTests` for custom, missing, empty and whitespace club names, plus unauthenticated access to the config endpoint.

Secondary barrier: frontend unit/API tests and e2e route stubs that prove the UI renders the backend-provided club name in auth and authenticated header surfaces.

Tertiary barrier: responsive e2e or manual Playwright screenshot verification for a very long club name at mobile and desktop widths, checking no horizontal overflow and visible ellipsis in constrained brand containers.

## Risks
- A separate config endpoint can be accidentally blocked by auth/password-change middleware; explicitly test public access.
- Adding app config to frontend bootstrap may break e2e specs unless `/api/config` stubs are updated consistently.
- Long names can fit on desktop but break mobile header/profile spacing; validate mobile first.
- Compose env defaults with spaces must be validated with `docker compose config`.
- It is tempting to pass the value as a frontend build-time env var, but that would violate the backend contract requirement.
- Replacing all literal `Gym CRM` strings too broadly could touch historical docs/backlog or non-user-facing technical metadata.

## Stop conditions
Остановиться и не писать код, если:
- the branch is not created from clean updated `main`;
- implementing the contract requires database storage, tenant modeling or settings UI;
- frontend cannot receive the value from backend without a separate frontend env path;
- auth/session architecture must be redesigned instead of adding a local public config contract;
- required changes expand into logo/colors/favicon/domain/email templates;
- acceptance criteria cannot be validated without changing roles, permissions, memberships, attendance or audit semantics.

## Ready for Codex execution
yes
