# Implementation Plan: TASK-040 Добавить автоматическое скрытие frontend-уведомлений

## Source task
/backlog/implementation/TASK-040-notifications-auto-dismiss.md

## Implementation branch
feature/TASK-040-notifications-auto-dismiss

Branch rules:
- create this branch before writing project code;
- create it from `main` after `git pull` and clean `git status`;
- if the branch already exists, verify that it belongs only to `TASK-040`;
- do not implement other unrelated TASKs in this branch;
- confirm the branch is active before making frontend changes.

## Goal
Обычные in-app уведомления CRM должны закрываться автоматически через единый понятный интервал, не скапливаться после повторных действий и не требовать ручного закрытия в обычных success/error/info сценариях.

## Current understanding
- Задача локализована во frontend and does not change backend notification semantics, bot scheduler, delivery logs, roles, permissions or CRM validation rules.
- `@mantine/notifications` уже подключен глобально в `frontend/src/main.tsx` as `<Notifications position="top-right" />`.
- Mantine 9 поддерживает provider-level `autoClose?: number | false` and `limit?: number`; current package default is `autoClose: 4000` and `limit: 5`, but the app does not make this behavior explicit.
- `rg` found current `notifications.show` usage in:
  - `frontend/src/App.tsx`
  - `frontend/src/features/attendance/AttendanceScreen.tsx`
  - `frontend/src/features/clients/ClientManagement.tsx`
  - `frontend/src/features/groups/GroupManagement.tsx`
  - `frontend/src/features/settings/SettingsScreen.tsx`
  - `frontend/src/features/settings/BranchSettingsScreen.tsx`
  - `frontend/src/features/users/UserCreateScreen.tsx`
  - `frontend/src/features/users/UserEditScreen.tsx`
- No current project call sets explicit `autoClose`, `limit`, `withCloseButton`, `notifications.cleanQueue` or a shared notification helper.
- Most calls are success/error feedback after create/update/archive/delete/login/session actions. Form-level validation errors remain inline and are out of scope unless they already call `notifications.show`.
- This is a small UX behavior change, not a broad screen redesign; `ui-designer` review is not required unless implementation starts changing layout/positioning beyond notification behavior.

## Execution steps
1. Prepare the branch: switch to `main`, run `git pull`, verify clean `git status`, create or verify `feature/TASK-040-notifications-auto-dismiss`.
2. Read `frontend/AGENTS.md` and keep the implementation frontend-only: Mantine/Onest preserved, backend CRM rules not duplicated, required validation is lint + build.
3. Reconfirm notification inventory with:
   - `rg "notifications\\.show|<Notifications|autoClose|limit|cleanQueue" frontend/src`
   - verify no new notification calls appeared since this plan.
4. Define explicit app notification defaults near the app root, preferably in `frontend/src/main.tsx` or a tiny constants file only if reuse is needed:
   - one default interval: `APP_NOTIFICATION_AUTO_CLOSE_MS = 10000`;
   - visible `limit`: `APP_NOTIFICATION_LIMIT = 5`, matching Mantine's current default while making the app behavior explicit.
5. Update the global `<Notifications />` configuration:
   - keep `position="top-right"` unless mobile QA proves it blocks critical controls;
   - set `autoClose={APP_NOTIFICATION_AUTO_CLOSE_MS}`;
   - set `limit={APP_NOTIFICATION_LIMIT}`;
   - keep Mantine defaults such as hover pause unless there is a concrete regression.
6. Check whether provider-level `autoClose + limit` is sufficient for the acceptance criterion "Нет накопления уведомлений после повторных действий пользователя":
   - trigger the same success/error action several times quickly;
   - observe whether queued duplicate notifications continue appearing long after user actions stop.
7. If duplicate queues still accumulate, add a small local/shared helper instead of refactoring unrelated UI:
   - preferred location: `frontend/src/features/shared/notifications.ts` or another existing shared UX area discovered during implementation;
   - helper keeps current titles/messages/colors and only standardizes `autoClose`, optional stable `id`, and queue behavior for ordinary app feedback;
   - use stable IDs only for repeated same-action notifications where replacing/skipping duplicates is safe, such as save/update/delete feedback from the same feature.
8. Do not convert every feature module to a new abstraction if root-level configuration already satisfies the behavior. If a helper is added, migrate only the calls needed to prevent real duplicate accumulation.
9. Preserve the ability to create persistent notifications for future critical cases:
   - document in code via type/API shape, not visible UI copy;
   - allow explicit `autoClose: false` in the helper or direct Mantine calls if a critical scenario is introduced later.
10. Add an automated UI regression around notification disappearance:
    - trigger a deterministic existing notification in a low-risk flow with Playwright mocks;
    - assert the notification appears with the existing text and disappears after the configured interval plus a small buffer;
    - repeat at least one action quickly and assert the visible notification count stays bounded.
11. Add or update unit tests only if a helper/constants module is introduced; use fake timers where practical to avoid slow timeout tests.
12. Manually check desktop and mobile viewports for representative notifications in clients, groups, attendance and settings:
    - notifications do not cover primary action areas for too long;
    - repeated actions do not leave a long queue;
    - success/error meaning and text remain unchanged.
13. Run required frontend validation and fix only TASK-040-related failures.

## Preferred implementation strategy
1. Start with explicit provider-level Mantine configuration because it is global, low-risk and matches the existing app architecture.
2. Add a helper only if testing proves provider-level defaults do not prevent practical duplicate accumulation.
3. Keep notification text, color and error handling semantics unchanged.
4. Keep backend and bot notification behavior untouched.
5. Prefer one automated Playwright regression over broad manual-only QA for the auto-dismiss contract.

Avoid:
- changing CRM domain, permission, validation, ProblemDetails, bot or scheduler behavior;
- replacing inline form errors with notifications;
- broad refactoring of all feature modules without a demonstrated duplicate-queue need;
- adding visible instructional text about notification behavior;
- moving notification position or restyling the notification system unless mobile overlap requires a narrow adjustment.

## Files likely to change
- `frontend/src/main.tsx`
- possible `frontend/src/features/shared/notifications.ts` if a helper is needed
- possible feature files only if stable IDs/helper calls are needed:
  - `frontend/src/App.tsx`
  - `frontend/src/features/attendance/AttendanceScreen.tsx`
  - `frontend/src/features/clients/ClientManagement.tsx`
  - `frontend/src/features/groups/GroupManagement.tsx`
  - `frontend/src/features/settings/SettingsScreen.tsx`
  - `frontend/src/features/settings/BranchSettingsScreen.tsx`
  - `frontend/src/features/users/UserCreateScreen.tsx`
  - `frontend/src/features/users/UserEditScreen.tsx`
- possible `frontend/src/features/shared/notifications.test.ts` or `.test.tsx` if a helper is added
- `frontend/e2e/responsive-main-screens.spec.ts` or a focused new `frontend/e2e/notifications.spec.ts`

## Constraints
- Frontend must not duplicate backend-owned CRM rules.
- Keep existing notification titles, messages, colors and success/error meanings.
- Ordinary notifications should auto-dismiss through one shared interval.
- Persistent notifications must remain possible only through explicit opt-in, such as `autoClose: false`, for critical future cases.
- Do not change bot notification scheduler, backend notification/event semantics or external push/delivery channels.
- Preserve Mantine and Onest.
- Project code changes start only after the correct task branch is active.

## Out of scope
- Bot notifications, scheduler, delivery log and reminders.
- Backend event/notification semantics.
- Push notifications and external delivery channels.
- Rewriting form validation UX.
- Global visual redesign of notification cards.
- Broad feature-module refactoring unrelated to notification accumulation.

## Required test coverage

Determine automated tests before implementation starts and add regression coverage together with the behavior change.

### Unit tests
No unit tests are required if the implementation only sets `autoClose` and `limit` on the Mantine provider.

Add a focused unit test if a helper/constants module is introduced, covering:
- default `autoClose` is applied to ordinary notifications;
- explicit `autoClose: false` remains possible;
- stable notification IDs are preserved or derived as intended;
- existing payload fields such as `title`, `message` and `color` pass through unchanged.

### Integration tests
Backend/API integration tests are not required because no backend contract or data flow changes are planned.

Frontend integration is protected by TypeScript build and Playwright mocks for the selected UI flow.

### UI tests
Add or update Playwright coverage for:
- notification appears after a deterministic success or error action;
- notification disappears after the configured interval plus buffer;
- repeated triggering does not leave more than the configured visible limit;
- mobile viewport does not keep notifications over primary controls after the auto-close interval.

Prefer a focused notification spec if existing responsive smoke tests would become too slow or brittle.

### Regression priority
Low to medium. Business logic risk is low, but the behavior is global and user-facing, so at least one automated UI regression should protect the timeout and bounded visible stack.

### Minimum expectation
- `npm run lint` and `npm run build` must pass.
- At least one automated Playwright test must fail if ordinary notifications no longer auto-dismiss.
- Manual QA must cover the task's named areas: clients, groups, attendance and settings on desktop and mobile.

## Test plan
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:e2e -- notifications.spec.ts` if a focused spec is added
- [ ] Or run the affected existing e2e spec if notification checks are added there, for example `cd frontend && npm run test:e2e -- responsive-main-screens.spec.ts`
- [ ] Manually trigger success/error notifications in clients, groups, attendance and settings on desktop.
- [ ] Manually repeat the same action several times quickly and confirm visible notifications stay bounded and disappear.
- [ ] Manually repeat the same checks on a mobile viewport.

## Regression barrier
Primary barrier: Playwright test that triggers an ordinary in-app notification, confirms its current text/meaning, waits for the configured interval plus buffer and verifies that it is removed from the page.

Secondary barrier: visible stack/count assertion after repeated triggers protects against notifications covering the CRM after rapid user actions.

Build barrier: `npm run lint` and `npm run build` catch broken imports, invalid Mantine props and TypeScript issues from any helper migration.

Manual barrier: desktop and mobile visual pass confirms notification placement does not block important actions for longer than the shared interval.

## Risks
- Mantine provider `limit` bounds visible notifications but can still queue duplicates; repeated actions may need stable IDs or a small helper.
- A too-short interval can make error messages disappear before the user can read them.
- A too-long interval can still block mobile controls.
- Tests that wait for real timeout can become slow or flaky; use fake timers or a small test-only timeout only if the app already has a clean pattern for it.
- Adding a helper and migrating all calls at once could create churn unrelated to the task.

## Stop conditions
Остановиться и не писать код, если:
- implementation would require backend, bot, scheduler or external delivery changes;
- preserving current notification texts conflicts with auto-dismiss behavior;
- no deterministic UI flow can trigger a notification in tests without introducing broad e2e setup changes;
- a proposed helper starts turning into a wide feature-module refactor;
- current branch is not `feature/TASK-040-notifications-auto-dismiss` before project code edits.

Do NOT stop only because notification calls are spread across multiple frontend features; the shared provider is the intended global integration point.

## Ready for Codex execution
yes
