# Implementation Plan: TASK-081 Вернуть администратору редактирование типов групп

## Source task
/backlog/risky/TASK-081-administrator-group-type-settings.md

## Implementation branch
fix/TASK-081-administrator-group-type-settings

Branch rules:
- before writing project code, checkout `main`, pull the latest changes and confirm a clean `git status`;
- create this branch from the updated `main`, not from another feature/fix/refactor branch;
- if the branch already exists, verify that it belongs only to TASK-081;
- do not implement unrelated TASKs in this branch;
- confirm that the branch is active before changing backend or frontend files;
- stop before project-code changes if the current branch is unclear or the worktree contains unknown changes.

## Goal
Administrator и SuperAdministrator, как роли с действующим backend capability `ManageSettings`, видят глобальную вкладку `Типы групп`, загружают справочник и используют существующие list/create/edit/delete действия через текущий API. При этом соседние вкладки настроек, backend authorization, validation, CSRF, audit и связи существующих групп не расширяются и не переопределяются на frontend.

## Current understanding
- `/settings` уже доступен Administrator: frontend route guard требует одновременно `user.permissions.canManageSettings` и `allowedSections.includes('Settings')`.
- Backend `UserRoleAuthorizationPolicy` возвращает `CanManageSettings: true` для `HeadCoach`, `SuperAdministrator` и `Administrator`, а для `Coach` — `false`.
- Весь `/group-types` route group защищён backend policy `ManageSettings`; `GET`, `POST`, `PUT` и `DELETE` используют один и тот же permission contract.
- Текущий frontend не проверяет `user.role === 'HeadCoach'`, как указано в исходном контексте задачи. После TASK-082 проблема выражена иначе: `SettingsScreen` объединяет вкладки `Типы групп` и `Филиалы и залы` под косвенным признаком `user.createRoleOptions?.includes('SuperAdministrator')`.
- `createRoleOptions` описывает допустимые staff-role transitions и не является capability для справочника типов групп. Сейчас этот признак истинный для HeadCoach, но ложный для SuperAdministrator и Administrator, несмотря на их backend `ManageSettings`.
- `GroupTypesSettingsPanel` уже реализует загрузку списка, create/edit/delete, локальное обновление списка, передачу `name`/`description`, отображение backend `ApiError`/field errors и запрет удаления связанного типа.
- `GroupsApiTests.HeadCoach_or_Administrator_can_manage_group_types` уже доказывает create/update/delete для HeadCoach и Administrator, а отдельный тест доказывает запрет Coach. Однако роль SuperAdministrator не включена в эту матрицу, а тест не фиксирует точный update audit payload, CSRF для `PUT` и сохранность связанной группы после переименования типа.
- `SettingsScreen.test.tsx` проверяет только наличие вкладки `Администраторы` у SuperAdministrator и её отсутствие у Administrator. В нём нет role matrix для `Типы групп` и нет edit flow.
- Существующий Playwright settings flow работает под HeadCoach и создаёт тип группы, но не проверяет Administrator, редактирование, backend validation или отсутствие нецелевых вкладок.
- Изменение локально: ожидается frontend production change только в visibility predicate и независимом рендеринге tab/panel. Изменение API, доменной модели, БД или backend authorization не ожидается.
- Синхронизация с `ManageSettings` также возвращает вкладку SuperAdministrator. Это не новое право: backend уже предоставляет этой роли тот же capability и разрешает `/group-types`.

## Execution steps
1. Подготовить ветку `fix/TASK-081-administrator-group-type-settings` по правилам выше; перечитать root, backend и frontend `AGENTS.md`, исходную задачу и этот план.
2. До production-кода зафиксировать фактическую матрицу:
   - HeadCoach: `canManageSettings = true`, видит `Типы групп`; текущая видимость `Филиалы и залы` сохраняется;
   - SuperAdministrator: `canManageSettings = true`, видит `Типы групп`, загружает список и использует существующие create/edit/delete действия; staff-management вкладка остаётся permission/options-driven;
   - Administrator: `canManageSettings = true`, видит `Типы групп`, но не получает `Филиалы и залы` или `Администраторы`;
   - Coach: `canManageSettings = false`, не получает UI- и API-доступ.
3. **До production-кода** расширить `SettingsScreen.test.tsx` table-driven component tests:
   - вкладка и panel `Типы групп` видимы для HeadCoach, SuperAdministrator и Administrator по `permissions.canManageSettings`;
   - Coach не видит вкладку;
   - Administrator по-прежнему не видит `Филиалы и залы` и `Администраторы`;
   - существующая видимость HeadCoach и staff-management controls не регрессирует.
4. **До production-кода** добавить параметризованный component integration test edit flow под Administrator и SuperAdministrator:
   - `getGroupTypes` возвращает существующий тип;
   - пользователь открывает вкладку, затем modal редактирования;
   - текущие `name` и `description` предзаполнены;
   - submit вызывает `updateGroupType(id, { name, description })`;
   - успешный ответ обновляет карточку без потери `id`/`groupCount`.
5. **До production-кода** добавить component test для backend validation:
   - `updateGroupType` отклоняется `ApiError` с `fieldErrors.name`;
   - ошибка показывается у поля и в существующем общем alert;
   - modal остаётся открыт, введённые данные не теряются;
   - frontend не воспроизводит backend uniqueness rule.
6. **До production-кода** добавить отдельный focused Playwright flow, предпочтительно `frontend/e2e/settings-group-types.spec.ts`, вместо дальнейшего расширения большого `stage12.spec.ts`:
   - session Administrator содержит `Settings`, `canManageSettings: true`, `createRoleOptions: []` и branch scope;
   - тот же list/edit/reload сценарий выполняется для session SuperAdministrator с `canManageSettings: true`;
   - Administrator видит `Абонементы` и `Типы групп`, но не получает `Филиалы и залы`/`Администраторы`;
   - SuperAdministrator сохраняет текущую permission/options-driven видимость staff-management вкладки и дополнительно получает `Типы групп`;
   - `GET /api/group-types` загружает существующий тип;
   - edit отправляет точный `PUT /api/group-types/{id}` с CSRF и допустимым payload;
   - успешный ответ виден в карточке и после повторной загрузки страницы;
   - отдельный ответ `ValidationProblem` отображается в форме;
   - Coach session не видит `Настройки`/вкладку и прямой `/settings` проходит через существующий route guard.
7. **До production-кода** усилить backend integration regression coverage:
   - расширить разрешённую theory-матрицу `/group-types` до HeadCoach, SuperAdministrator и Administrator;
   - явно проверить `GET` и `PUT`, а не полагаться только на create/delete happy path;
   - сохранить negative `GET`/`PUT` для Coach;
   - после `PUT` проверить, что существующая `TrainingGroup.GroupTypeId` не изменилась и group details/list возвращает новое имя типа;
   - проверить ровно одну update audit entry с actor id, entity id, old/new `name` и `description`;
   - подтвердить текущий `ValidationProblem` для duplicate/invalid name.
8. **До production-кода** добавить в `CsrfProtectionTests` `PUT /group-types/{id}` как state-changing scenario с missing и invalid token; после отказа подтвердить отсутствие изменения типа и update audit entry.
9. Запустить новые frontend component и focused Playwright tests до production-кода. Зафиксировать ожидаемую красную фазу: Administrator/SuperAdministrator не находят вкладку `Типы групп` из-за текущего `createRoleOptions.includes('SuperAdministrator')`. Backend tests могут остаться зелёными, потому что они фиксируют уже существующий авторитетный контракт; это baseline, а не замена обязательной красной frontend-регрессии.
10. Реализовать минимальную frontend-коррекцию:
    - ввести отдельный predicate для типов групп на основе `user.permissions.canManageSettings`;
    - отделить рендеринг tab и `PageTabsPanel` типов групп от predicate для `Филиалы и залы`;
    - не использовать role-name checks и `createRoleOptions` как разрешение на group-type API;
    - не менять существующие predicates вкладок филиалов и управления администраторами вне необходимого структурного разделения.
11. Запустить новые component, backend integration и Playwright tests; подтвердить зелёную фазу.
12. Запустить полный backend regression suite, frontend unit suite, lint, build и affected Playwright settings flow.
13. Выполнить финальный source audit: UI не содержит нового `role === ...` для типов групп, backend `/group-types` всё ещё защищён `ManageSettings`, а код TASK-081 не затронул схемы, маршруты соседних settings modules или доменные правила.

## Preferred implementation strategy
1. Permission-contract audit and frozen role matrix.
2. Frontend component and Playwright regression tests first.
3. Backend contract/CSRF/audit tests first, without speculative backend production changes.
4. One localized frontend predicate split.
5. Focused green verification, then full backend/frontend regression.
6. Small commits: red tests, minimal UI fix, green/regression adjustments.

## Files likely to change

### Tests before functional code
- `frontend/src/features/settings/SettingsScreen.test.tsx`
- `frontend/e2e/settings-group-types.spec.ts` (new, preferred)
- `backend/tests/GymCrm.Tests/GroupsApiTests.cs`
- `backend/tests/GymCrm.Tests/CsrfProtectionTests.cs`

### Functional code after the red phase
- `frontend/src/features/settings/SettingsScreen.tsx`

No backend production, API contract, persistence or migration file is expected to change. If implementation discovers that the current backend contract no longer matches this baseline, stop before changing authorization.

## Constraints
- Backend remains the source of truth for roles, permissions, access scope, validation, audit and ProblemDetails.
- Frontend visibility for `Типы групп` must consume `permissions.canManageSettings`; do not introduce or retain a role-name allowlist for this capability.
- Frontend must not duplicate name uniqueness, relationship or deletion rules.
- Keep the existing `/group-types` payload and endpoints unchanged.
- Preserve CSRF validation and exact audit semantics for create/update/delete.
- Preserve the `GroupTypeId` of every linked training group during a type edit.
- Do not couple group-type visibility to staff `createRoleOptions`.
- Do not grant Administrator the `Филиалы и залы` or `Администраторы` tabs as a side effect of this change.
- Preserve HeadCoach behavior and TASK-082 SuperAdministrator compatibility.
- Preserve Mantine, Onest and the existing modal/list interaction pattern.

## Out of scope
- Изменение полей, DTO или схемы типа группы.
- Возврат `SystemIdentifier`.
- Изменение глобальности справочника.
- Изменение `ManageSettings` role matrix.
- Новый granular RBAC/capability только для отдельных settings tabs.
- Изменение branch scope Administrator.
- Изменение create/delete behavior, кроме regression coverage уже существующего контракта.
- Рефакторинг всего `SettingsScreen` или разделение его на новые feature-модули.
- Изменение UI/authorization вкладок `Абонементы`, `Филиалы и залы` и `Администраторы`.
- Изменения bot или database schema.

## Required test coverage

Unit and integration tests must be written or updated before functional code. At least the frontend visibility/edit tests must be run and fail for the missing TASK-081 behavior before `SettingsScreen.tsx` is changed.

### Unit/component tests
1. Role/capability matrix for the `Типы групп` tab and panel.
2. Negative assertions that Administrator does not gain neighboring tabs.
3. Administrator and SuperAdministrator edit form prefill, normalized payload and successful local state update.
4. `ApiError.fieldErrors.name` mapping without duplicated uniqueness rules.
5. Existing HeadCoach/SuperAdministrator staff-related tab behavior remains unchanged.

### Integration tests
1. Backend `GET`/`PUT /group-types/{id}` allow HeadCoach, SuperAdministrator and Administrator.
2. Coach receives `403` for list/update and cannot mutate data or create audit.
3. Administrator update preserves the linked group’s `GroupTypeId` and exposes the updated type name after reload.
4. Validation returns current ProblemDetails/field errors.
5. Valid update creates one exact audit record with actor and old/new state.
6. Missing/invalid CSRF rejects `PUT` without mutation or audit.

### UI/e2e tests
1. Administrator reaches `/settings`, sees `Типы групп` and edits an existing item.
2. SuperAdministrator reaches `/settings`, sees `Типы групп` and completes the same edit-and-reload flow.
3. The exact `PUT` payload and CSRF header are sent for both permitted roles.
4. Updated values survive a reload.
5. Backend validation is rendered in the modal.
6. Administrator does not gain branches or administrator-management tabs.
7. Coach has neither navigation nor direct-route UI access.

## Test plan
- [ ] On the correct task branch, add/update unit, component, backend integration and Playwright tests before production code.
- [ ] Run `cd frontend && npm run test:unit -- src/features/settings/SettingsScreen.test.tsx`; record the expected failure on missing Administrator/SuperAdministrator tab.
- [ ] Run the focused Playwright spec before production code; record the same expected visibility failure.
- [ ] Run focused backend tests and record the existing authorization baseline separately from the frontend red phase.
- [ ] Implement only the permission-driven group-type tab/panel predicate split.
- [ ] Rerun focused frontend and backend tests until green.
- [ ] Run `dotnet test backend/GymCrm.slnx`.
- [ ] Run `cd frontend && npm run test:unit`.
- [ ] Run `cd frontend && npm run lint`.
- [ ] Run `cd frontend && npm run build`.
- [ ] Run `cd frontend && npm run test:e2e -- settings-group-types.spec.ts`.
- [ ] Run the existing affected settings scenario in `stage12.spec.ts`.
- [ ] Manually inspect desktop and narrow viewport only as supplemental QA; automated component/Playwright coverage remains the release barrier.

## Regression barrier
The primary barrier is an automated four-role matrix across frontend component tests and backend integration tests:

| Role | Backend `ManageSettings` | Group-types UI/API | Neighboring tabs protected |
|---|---:|---:|---:|
| HeadCoach | yes | yes | existing behavior |
| SuperAdministrator | yes | yes | existing staff/branch behavior |
| Administrator | yes | yes | no branches/admin-management expansion |
| Coach | no | no | yes |

The release barrier additionally requires Administrator and SuperAdministrator Playwright edit-and-reload flows, an exact update audit assertion, linked-group identity preservation and CSRF rejection without mutation. Manual QA alone is not sufficient.

## Risks
- Reusing `createRoleOptions` would preserve a hidden coupling between staff-management transitions and global settings access.
- Reusing one new `canManageSettings` predicate for both group types and branches would accidentally expose the `Филиалы и залы` tab to Administrator, violating scope.
- Omitting SuperAdministrator from tests would leave the same consumer/backend mismatch for the role added by TASK-082.
- Mock-only Playwright coverage could hide a backend authorization regression; backend integration tests must remain part of the barrier.
- Expanding the fix into a general settings-permission redesign would increase security risk and exceed the localized regression scope.
- Existing `GroupsApiTests` is broad; keep added assertions focused and avoid unrelated restructuring.

## Stop conditions
Stop and do not write functional code if:
- the active branch is not `fix/TASK-081-administrator-group-type-settings` created from current `main`;
- the worktree contains unknown backend/frontend changes;
- current backend no longer protects all `/group-types` endpoints with `ManageSettings`;
- current session no longer gives Administrator `Settings` plus `CanManageSettings`;
- Administrator access requires a global RBAC/auth redesign rather than the localized frontend predicate split;
- the change cannot keep `Филиалы и залы` and `Администраторы` visibility isolated;
- implementation requires API/schema changes, destructive data operations or changes to linked group identity;
- acceptance requires product decisions beyond the source task.

Do not stop merely because the task touches frontend and backend regression tests or because it concerns roles/permissions. Backend production changes are not expected.

## Ready for Codex execution
yes, after explicit review of this high-risk plan and explicit selection of TASK-081 for implementation. Until then the source task remains in `/backlog/risky`.
