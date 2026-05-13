# Implementation Plan: TASK-029 Переименовать раздел `Пользователи` в `Тренеры`

## Source task
/backlog/done/TASK-029-rename-users-to-trainers.md

## Implementation branch
feature/TASK-029-rename-users-to-trainers

Branch rules:
- create this branch from `main` before writing project code;
- do not implement other unrelated TASKs in this branch;
- confirm the branch is active before making frontend changes;
- do not reuse the TASK-030 branch even though the task depends on the administrator split created there.

## Goal
Видимый CRM-раздел для управления тренерами называется `Тренеры`, а не `Пользователи`, при этом технические route ids, `/users` API, permission contract and backend user model остаются прежними.

## Current understanding
TASK-029 раньше пропускался, потому что раздел `Users` управлял и администраторами, и тренерами. Текущий код уже содержит результат TASK-030: администраторы управляются через `Настройки` and `/settings/administrators`, а общий backend `/users` flow исключает `Administrator`. Во frontend создание пользователя в `features/users` предлагает только роль `Coach`, редактирование `HeadCoach` заблокировано по роли, поэтому этот раздел можно трактовать как тренерский без изменения доменной модели.

Задача остается локальной frontend-терминологией. Нужно поменять только пользовательский текст вокруг раздела `Users`: navigation label, headings, empty/loading/error states, action labels and tests. `AppSection.Users`, route `/users`, API functions/types `getUsers/createUser/updateUser`, permission `canManageUsers` and backend contracts не переименовывать.

## Execution steps
1. Подготовить ветку: `git checkout main`, `git pull`, убедиться в чистом статусе, создать `feature/TASK-029-rename-users-to-trainers`.
2. Перед правками подтвердить prerequisite TASK-030: `backend/src/GymCrm.Api/Auth/UserEndpoints.cs` не возвращает/не редактирует `Administrator`, а `frontend/src/features/settings/SettingsScreen.tsx` содержит вкладку `Администраторы`.
3. Провести frontend string audit по `Пользователи`, `пользователь`, `Создать пользователя`, `Карточка пользователя`, `Список пользователей` and related variants.
4. В `frontend/src/lib/appRoutes.ts` заменить видимый label секции `Users` с `Пользователи` на `Тренеры`; technical key `Users` and paths оставить без изменений.
5. В `frontend/src/lib/resources.ts` обновить `resources.users.*` только для trainer-management flow: list/create/edit titles, descriptions, empty states, action labels, validation text and form helper text.
6. Обновить hardcoded labels in `frontend/src/features/users/*`, например loading labels `Загружаем пользователей...` and `Загружаем карточку пользователя...`.
7. Не менять audit labels (`UserCreated`, `UserUpdated`, `User`, `UserSession`), auth/session copy, API mapper/type names and backend resource texts unless they are directly rendered inside the trainer-management section.
8. Обновить frontend unit/e2e expectations that assert visible navigation or users-section copy.
9. Добавить или обновить regression assertion that the visible navigation renders `Тренеры` while route `/users` and active state continue to work.
10. Запустить required frontend validation and do a quick manual UI check of `/users`, `/users/new`, and `/users/:id/edit`.

## Preferred implementation strategy
1. Text-resource first: keep copy changes centralized in `resources.users` and `APP_SECTION_LABELS`.
2. Minimal component edits only for hardcoded visible strings.
3. Test updates in the same branch, focused on visible labels and navigation behavior.
4. No backend changes unless prerequisite audit proves the current code no longer isolates administrators from the users flow.

## Files likely to change
- frontend/src/lib/appRoutes.ts
- frontend/src/lib/resources.ts
- frontend/src/features/users/UsersListScreen.tsx
- frontend/src/features/users/UserCreateScreen.tsx
- frontend/src/features/users/UserEditScreen.tsx
- frontend/src/features/users/UserFormFields.tsx
- frontend/src/features/shared/ux.test.tsx
- frontend/e2e/users.spec.ts
- frontend/e2e/responsive-main-screens.spec.ts
- frontend/e2e/home-dashboard.spec.ts
- frontend/e2e/auth.spec.ts
- frontend/e2e/stage12.spec.ts

## Constraints
- Backend remains the source of truth for roles, permissions, access scope, validation semantics, audit semantics and ProblemDetails.
- Do not duplicate role/access rules in frontend.
- Do not rename technical identifiers: `Users`, `/users`, `canManageUsers`, API endpoint names, DTO/type names, database fields.
- Do not move administrator management; TASK-030 already owns that scope.
- Keep role labels unchanged: `Главный тренер`, `Администратор`, `Тренер`.
- Preserve Mantine and existing shared UX patterns.

## Out of scope
- Backend roles, permissions, access scope, validation or audit changes.
- API route or database renames.
- Moving administrators between sections.
- Broad IA redesign of settings/users.
- Renaming generic audit/auth/system terminology where `Пользователь` means the auth actor rather than the trainer section.

## Required test coverage

### Unit tests
Update existing frontend unit tests that assert navigation labels:
1. `NavigationTabs` should render `Тренеры` for technical section `Users`.
2. Active state should still be applied when `currentSection="Users"`.

Add a small regression test only if the existing unit suite does not cover the section label after updates.

### Integration tests
No backend integration tests are expected because contracts do not change.

If prerequisite audit unexpectedly shows administrators are again present in `/users`, stop before implementation and create a separate IA/backend task instead of changing labels.

### UI tests
Update Playwright tests/fixtures that assert visible section labels:
1. `/users` opens from navigation label `Тренеры`.
2. `/users/new` remains accessible and still does not offer role `Администратор`.
3. Existing route `/users/:id/edit` remains accessible and shows trainer-oriented copy.

### Manual validation
Manual check remains useful for copy quality:
1. Navigation active state on `/users`.
2. List empty state and loading/error language.
3. Create/edit trainer screens on desktop and narrow viewport.

## Test plan
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] Run affected frontend tests if available, at minimum the unit test file that covers `NavigationTabs`.
- [ ] Run affected Playwright coverage for users/navigation if environment is available.
- [ ] Manually open `/users`, `/users/new`, `/users/:id/edit` and verify visible copy says `Тренеры`/`тренер` where the screen is the trainer-management flow.

## Regression barrier
Automated regression barrier should be a frontend test assertion that `Users` technical section renders visible label `Тренеры` and remains active on `/users`, plus existing Playwright coverage proving `/users/new` does not expose `Администратор`.

This protects the intended visible rename without changing backend contracts or duplicating CRM role rules.

## Risks
- Some `Пользователь` strings are generic auth/audit terminology; changing all occurrences blindly would degrade semantics.
- Existing e2e fixtures use technical `allowedSections: ['Users']`; these must remain technical even after visible label changes.
- If TASK-030 regression reintroduces administrators into generic `/users`, this rename would again become misleading.

## Stop conditions
Остановиться и не писать код, если:
- `/users` снова управляет `Administrator` accounts directly;
- реализация требует backend role/permission/API rename;
- acceptance criteria невозможно выполнить без изменения информационной архитектуры;
- scope начинает включать перенос администраторов, settings redesign or backend user model changes.

## Ready for Codex execution
yes
