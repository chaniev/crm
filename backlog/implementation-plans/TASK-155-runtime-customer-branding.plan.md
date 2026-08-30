# Implementation Plan: TASK-155 Runtime customer branding и управление после деплоя

## Metadata
- source_task: /backlog/risky/TASK-155-runtime-customer-branding.md
- requirements: REQ-NFR-005 (implements), REQ-BRN-002 (constrains), REQ-AUD-001 (constrains)
- branch: feature/TASK-155-runtime-customer-branding
- readiness: no — до functional code нужны runtime/data/security review описанного precedence и rollback contract, а до production UI — выбранное владельцем продукта rendered-направление settings surface
- dependencies: completed TASK-147 is the bundled profile/contrast foundation; TASK-156 logo/favicon stays outside this task and must reuse, not duplicate, the resulting settings/config path
- risk: high — anonymous auth bootstrap, retained-database migration, global settings authorization, audit atomicity and deploy/runtime recovery change together

## Goal
Позволить задать валидную customer palette при деплое без frontend build, безопасно менять и откатывать её в CRM и всегда выдавать login-ready effective branding с deterministic bundled fallback.

## Decisions and contracts
- Ввести отдельный `RuntimeBrandingProfile` schema v1; bundled `ThemeProfile` v2 остаётся compatibility/fallback contract и не принимается как API DTO. Input содержит `schemaVersion`, `clubName`, exact 10-step hex palettes для `primary`, optional `secondary/accent` и `neutral`, а также allowlisted bundled `authBackgroundImageId`. Unknown fields, CSS, URLs, assets, status colors and alpha values outside the approved contrast policy are rejected.
- Backend normalizes runtime input into a complete safe effective contract consumed by frontend semantic roles. Missing auxiliary accent roles inherit bundled defaults; functional status palettes never come from customer input.
- Deployment baseline arrives as one documented non-secret JSON value `CRM_BRANDING_PROFILE_JSON`, wired identically to both Compose files. Blank, malformed, incomplete or contrast-invalid input resolves to bundled defaults and produces a technical warning without exposing the payload or blocking `/config`/login. Existing `CRM_CLUB_NAME`, `CRM_THEME_ID` and `CRM_AUTH_BACKGROUND_IMAGE_ID` remain a compatibility adapter for upgraded deployments and preserve the current appearance when no v1 JSON is supplied.
- Effective precedence is fixed: valid active stored revision > valid deploy v1 baseline > valid legacy deploy IDs > bundled defaults. A failure to read persistence uses the last-known-valid in-memory revision when available, otherwise the deploy/bundled chain; anonymous reads do not wait for a failing database.
- Persistence is append-only `BrandingRevision` plus one active revision pointer/version. Update writes a complete normalized revision and activates it; reset clears the stored pointer and exposes the deploy baseline; rollback activates an existing valid revision. Update, reset and rollback use optimistic version/ETag and commit revision/pointer plus audit entry atomically.
- Upgrade migration creates the tables with no active stored revision. Therefore the pre-upgrade deploy values remain effective until an explicit settings mutation. Rollback of application code keeps the legacy env inputs available and ignores the additive tables; database downgrade is not required for service recovery.
- Anonymous `GET /config` returns only the normalized effective club name, semantic palettes and allowlisted auth-background selection. Authenticated settings read additionally returns source (`stored`, `deploy-v1`, `legacy-deploy`, `bundled`), current version and rollback candidates. Mutations are CSRF-protected and available only through the existing backend-owned Settings capability for HeadCoach, SuperAdministrator and Administrator.
- A successful settings mutation updates the editor's global theme snapshot without logout and survives reload; other sessions receive it on their next `/config` bootstrap. A rejected mutation leaves the active revision and rendered theme unchanged.

## UX contract
- User: HeadCoach, SuperAdministrator or Administrator changing global club branding, primarily on mobile but with desktop parity. Completion signal: validated preview, explicit save/reset/rollback confirmation, success feedback and immediate application of the effective theme.
- Add one `Оформление` settings tab. The primary path is load effective/source state → edit club name and semantic palette fields → inspect auth/action/neutral contrast preview → save. Reset to deployment and rollback to an earlier revision are exceptional actions with explicit consequence and confirmation.
- Loading, validation failure, stale version, forbidden, persistence failure, saved, reset and rollback states preserve entered values and a recovery action. Preview never applies invalid values to the live page and never changes functional status examples.
- Before production UI, create a visual brief and three rendered directions at 390 x 844 and 1440 using real Mantine/Onest/shared components, including one invalid-contrast state; record the selected direction and responsive/focus/keyboard contract. No production settings layout is implemented before that selection.

## Scope
### In
- Runtime schema/validator/effective-resolution service, additive revision persistence, settings API, authorization and audit.
- Anonymous normalized config and frontend runtime theme/bootstrap adapter with semantic auth roles and fallback.
- Deploy input parity, upgrade/reset/rollback runbook, settings workflow and contrast-safe preview.

### Out
- Logo/favicon, remote or uploaded auth assets, arbitrary CSS, dark/role themes, status palette changes, typography/layout redesign and permission changes.

## Implementation slices
1. Freeze schema, normalization, contrast rules, precedence and revision state machine in backend domain/application tests; add anonymous/settings API contract tests with expected RED before persistence or UI code.
2. Implement validator/effective service and additive revision persistence. Prove clean bootstrap, retained upgrade, optimistic conflict, atomic audit, reset and rollback; keep `/config` available under invalid deploy input and simulated stored-read failure.
3. Extend deploy configuration and both Compose files with the v1 JSON input while retaining legacy variables; document onboarding, upgrade, reset-to-deploy, previous-revision rollback and application rollback sequence.
4. Extend frontend API/runtime types and adapt normalized v1 branding to existing `createGymCrmTheme`/semantic variables. Remove auth-local color ownership, make primary action and background selection semantic, and prove invalid/transport/broken-background fallback.
5. Complete the required UX/design gate, then implement the selected `Оформление` settings workflow with live safe preview, stale/error recovery, confirmation and same-session theme update.
6. Add end-to-end deploy baseline → stored edit → reload → reset → rollback coverage, run the full contrast matrix for runtime profiles and validate both Compose paths plus login fallback.

## Likely files and layers
- `backend/src/GymCrm.Domain/Branding/**`, `backend/src/GymCrm.Application/Branding/**` — runtime schema semantics, precedence and revision operations.
- `backend/src/GymCrm.Infrastructure/Persistence/**`, new forward migration — revision storage, active pointer and retained upgrade.
- `backend/src/GymCrm.Api/Startup/AppConfig*.cs`, `BrandingOptions.cs`, new authenticated branding endpoints/contracts/resources — public effective config and settings mutations.
- `backend/tests/GymCrm.Tests/AppConfigApiTests.cs` and new branding settings/migration tests — fallback, authz, validation, audit and state machine.
- `frontend/src/lib/api/config.ts`, `types.ts`, facade exports — normalized config and settings contracts.
- `frontend/src/bootstrap/**`, `frontend/src/theme/**`, `frontend/src/app/AuthStages.tsx`, `frontend/src/App.css` — runtime adaptation and semantic auth colors.
- `frontend/src/features/settings/SettingsScreen.tsx` plus a focused branding feature/test module — selected settings workflow.
- `frontend/e2e/settings-branding.spec.ts` and auth bootstrap coverage — responsive mutation/fallback workflow.
- `deploy/docker-compose.yml`, `deploy/docker-compose.server.yml`, `deploy/.env.example`, `deploy/SERVER_INSTALL.md` — deploy baseline and recovery contract.

## Regression specification
### Automated tests to add or update
- Validator tables reject wrong schema, unknown fields, malformed/short palettes, disallowed alpha/URL/CSS/status fields and failing contrast pairs; valid customer primary/accent/neutral roles normalize deterministically.
- Effective-resolution tests cover every precedence edge, invalid inputs at each source, no-row upgrade, last-known-valid cache and bundled fallback without throwing from anonymous config.
- Settings API tests cover all three permitted roles, Coach/anonymous denial, CSRF, optimistic conflict, update/reset/rollback, unavailable target revision and field-level ProblemDetails.
- Transaction test forces audit or persistence failure and proves neither active pointer nor revision/audit can commit alone; successful changes record actor, source, old/new normalized value and action.
- Migration tests cover clean PostgreSQL bootstrap and upgrade from the current retained schema with legacy env values preserving the same effective theme.
- Frontend tests consume normalized runtime palettes, preserve semantic status tones, apply primary/neutral/auth roles, reject incomplete payloads and fall back on config timeout, unknown background and failed asset preload.
- Settings component tests cover load/edit/preview/save, first invalid field, retained values after API error, stale reload, restricted state, reset/rollback confirmation and immediate provider update.
- Playwright covers valid deploy baseline, post-deploy edit and reload, invalid mutation, reset, previous-revision rollback, broken config/background and successful login at target-iPhone plus desktop widths.

### Expected red evidence
- Backend tests initially fail because `/config` returns opaque IDs only and no revision/settings boundary exists.
- Frontend tests initially fail because bootstrap resolves only bundled IDs and auth CSS still owns local `--auth-*` mappings rather than a runtime normalized profile.
- The first settings workflow test fails because `Оформление` and its API client do not exist.

### Required validation
- Focused branding/app-config/authorization/audit/migration tests, runtime-profile frontend/contrast tests and affected settings/auth Playwright scenarios.
- Task verification contract must add PostgreSQL retained-upgrade, both Compose configurations and the deploy/edit/reset/rollback runtime smoke beyond the diff-selected baseline.

### Manual evidence
- Product-owner selection among three rendered settings directions; runtime comparison of the selected direction at mobile/desktop with invalid, stale and rollback states.
- Physical Safari/browser-chrome/software-keyboard evidence remains explicitly unverified unless performed.

### Regression barrier
- One isolated runtime scenario must start from a legacy deployment, upgrade without visual change, apply a stored customer palette, survive reload, reset to deploy baseline, roll back to the stored revision and keep login available after an injected invalid/broken config; backend authorization/audit and contrast assertions gate every transition.

## Risks and stop conditions
- Stop before functional code if runtime/data/security review does not approve the exact precedence, append-only revision, atomic audit and application rollback contract.
- Stop before production settings UI until the rendered direction is selected; do not infer palette-editor hierarchy or destructive-action placement.
- Stop if existing active theme/logo work claims the same schema, settings endpoint or config carrier; establish one owner instead of parallel contracts.
- Stop on any migration requiring destructive transformation, any inability to keep legacy env rollback, or any `/config` path that can block login on persistence failure.
- Stop if requested colors cannot pass the approved primary-action/neutral contrast matrix; do not silently alter status colors or weaken the gate.
