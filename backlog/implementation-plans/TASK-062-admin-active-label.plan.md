# Implementation Plan: TASK-062 Исправить текст активности в форме администратора

## Source task
/backlog/implementation/TASK-062-admin-active-label.md

## Implementation branch
fix/TASK-062-admin-active-label

Branch rules:
- create this branch from `main` before writing code;
- do not implement other unrelated TASKs in this branch;
- confirm the branch is active before making project code changes;
- required preflight: `git checkout main`, `git pull`, `git status --short --branch`, `git checkout -b fix/TASK-062-admin-active-label`.

## Goal
В форме создания и редактирования администратора переключатель активности должен говорить про администратора, а trainer flow должен продолжать показывать текст про тренера.

## Current understanding
Задача frontend-only и локальна для общей формы пользователя. Сейчас `UserFormFields` берет подпись активности из `resources.users.form.labels.isActive`, где задано `Тренер активен`. Администраторская форма в `SettingsScreen.tsx` переиспользует этот компонент для create/edit flow и не передает отдельный текст, поэтому в администраторском сценарии появляется trainer copy.

Backend contract, роль администратора, permission model, payload mapping и `/settings/administrators` flow менять не нужно.

## Execution steps
1. Branch and preflight
   - Switch to `main`, pull latest changes and verify clean status.
   - Create `fix/TASK-062-admin-active-label`.
   - Read `AGENTS.md` and `frontend/AGENTS.md` before frontend edits.

2. Make the active switch label context-aware
   - In `frontend/src/features/users/UserFormFields.tsx`, add a small optional prop for the active switch label, for example `isActiveLabel?: string`.
   - Keep the default value as `resources.users.form.labels.isActive`, so trainer create/edit forms keep `Тренер активен` without call-site changes.
   - Use the prop in the `Switch` label instead of reading the trainer resource directly inside the switch.

3. Pass administrator copy from the settings administrator flow
   - In `frontend/src/features/settings/SettingsScreen.tsx`, pass the explicit administrator label to both administrator create and edit `UserFormFields` usages.
   - Prefer a local constant near `administratorRoleOptions`, such as `const administratorIsActiveLabel = 'Администратор активен'`, unless the implementation first introduces a suitable resources namespace for settings copy.
   - Keep `showRoleField={false}` in administrator create flow and keep administrator role payload behavior unchanged.

4. Preserve trainer behavior
   - Confirm `frontend/src/features/users/UserCreateScreen.tsx` and `frontend/src/features/users/UserEditScreen.tsx` continue relying on the default trainer label.
   - Do not replace the shared default text with a generic label that makes trainer copy worse.

5. Add regression coverage
   - Update the existing administrator Playwright coverage in `frontend/e2e/stage12.spec.ts` to assert the administrator dialog shows `Администратор активен` and does not show `Тренер активен`.
   - Update the existing trainer create coverage in `frontend/e2e/users.spec.ts` to assert the trainer create form still shows `Тренер активен`.
   - If a nearby component/unit test for `UserFormFields` is discovered during implementation, add a focused test for default and override labels; otherwise keep the e2e assertions as the regression barrier.

## Preferred implementation strategy
Use a narrow additive prop on the shared form component. This keeps existing trainer screens stable, avoids duplicating form markup in settings, and makes the administrator-specific UI copy explicit at the settings call site.

## Files likely to change
- `frontend/src/features/users/UserFormFields.tsx`
- `frontend/src/features/settings/SettingsScreen.tsx`
- `frontend/e2e/stage12.spec.ts`
- `frontend/e2e/users.spec.ts`

## Constraints
- Do not change backend-owned role, permission or validation semantics.
- Do not change `/settings/administrators` API contracts or payload shape.
- Do not return a manual role selector to administrator create flow.
- Do not hardcode a new generic shared label that breaks trainer copy.
- Preserve Mantine and existing form layout.

## Out of scope
- Backend changes.
- Administrator role or permission changes.
- New administrator fields.
- Redesign of settings, users or modal layout.
- Moving administrator management to another section.

## Required test coverage

### Unit tests
Add or update unit/component tests only if there is already nearby coverage for `UserFormFields` or a lightweight test can be added without creating broad test scaffolding. Useful assertions would cover the default trainer label and the administrator override label.

### Integration tests
No backend/frontend contract integration tests are required because API contracts and payload semantics must not change.

### UI tests
Update existing Playwright coverage:
- `frontend/e2e/stage12.spec.ts` should protect the administrator label in the settings administrator dialog.
- `frontend/e2e/users.spec.ts` should protect the trainer label in the trainer create flow.

### Manual validation
Manual checks are useful for confirming the modal copy visually, but they are not the primary regression barrier.

## Test plan
- [ ] Run `cd frontend && npm run test:e2e -- stage12.spec.ts users.spec.ts` or the closest supported targeted Playwright invocation for these specs.
- [ ] Run `cd frontend && npm run lint`.
- [ ] Run `cd frontend && npm run build`.
- [ ] Manually open settings, switch to `Администраторы`, click `Добавить администратора` and confirm the active switch says `Администратор активен`.
- [ ] Manually open trainer creation and confirm the active switch still says `Тренер активен`.

## Regression barrier
Automated regression barrier: Playwright must assert both sides of the shared component behavior: administrator flow renders `Администратор активен` and trainer flow still renders `Тренер активен`. This catches both the original regression and accidental broad copy changes in the shared form.

## Risks
- A broad edit to `resources.users.form.labels.isActive` could fix administrators while breaking trainer copy.
- Adding administrator text only to create flow would leave edit flow inconsistent.
- Negative text assertions must be scoped to the administrator dialog so unrelated page text does not create brittle tests.

## Stop conditions
Остановиться и не писать код, если:
- обнаружится, что текст активности приходит из backend contract или удаленной конфигурации, а не из frontend copy;
- выполнение acceptance criteria потребует изменения roles, permissions или backend contract;
- administrator create flow снова потребует ручной выбор роли;
- scope расширится до переработки общей модели user management или settings IA;
- acceptance criteria невозможно выполнить без уточнений.

## Ready for Codex execution
yes
