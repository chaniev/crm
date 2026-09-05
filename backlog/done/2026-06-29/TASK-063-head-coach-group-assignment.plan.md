# Implementation Plan: TASK-063 Разрешить назначать главного тренера на любую группу

## Source task
/backlog/done/2026-06-29/TASK-063-head-coach-group-assignment.md

Source task remains in `/backlog/risky` until explicit risky-task implementation review/selection.

## Implementation branch
feature/TASK-063-head-coach-group-assignment

Branch rules:
- create this branch from `main` before writing code;
- before branch creation, run `git status`, switch to `main`, pull latest changes, and verify the worktree is clean;
- do not implement other unrelated TASKs in this branch;
- confirm the branch is active before making project code changes.

## Goal
Пользователь с правом управления группами должен видеть главного тренера среди кандидатов на назначение в группу и сохранять группу с главным тренером в составе тренеров, без расширения прав обычных тренеров и без клиентского обхода backend validation.

## Current understanding
- Backend сейчас является источником правил назначения тренеров на группы.
- `backend/src/GymCrm.Api/Auth/GroupEndpoints.cs` в `ListTrainerOptionsAsync` возвращает только активных пользователей с `UserRole.Coach`.
- `backend/src/GymCrm.Api/Auth/GroupRequestValidator.cs` в `ValidateTrainerIdsAsync` принимает только активных пользователей с `UserRole.Coach`.
- Текст ошибки `OnlyActiveCoachesCanBeAssigned` прямо говорит про роль `Coach`, поэтому после расширения правила его нужно обновить, чтобы не показывать технически неверную причину.
- Frontend `frontend/src/features/groups/GroupManagement.tsx` берет список через `getTrainerOptions` и отображает `fullName (login)`, явного role-фильтра рядом с формой групп не найдено.
- `getTrainerOptions` также используется в финансовых отчетах. Backend `ReportsEndpoints` сейчас отклоняет `trainerId`, если пользователь не `UserRole.Coach`, поэтому появление HeadCoach в общем списке тренеров требует синхронной проверки report consumer.
- `AccessScopeService` уже дает HeadCoach полный доступ независимо от `GroupTrainers`, а обычным Coach доступ выдается только по их собственным `GroupTrainers` связям. Это правило нужно сохранить.
- Схема БД, модель `GroupTrainer` и audit state уже хранят trainer id без ограничения роли на уровне доменной модели, поэтому ожидаемая реализация должна быть локальной.

## Execution steps
1. Prepare branch and context
   - Switch to latest clean `main`.
   - Create `feature/TASK-063-head-coach-group-assignment`.
   - Reread `AGENTS.md`, `backend/AGENTS.md`, `frontend/AGENTS.md`, source task and this plan before code changes.
   - Run a focused source search for role-based trainer predicates:
     `rg "OnlyActiveCoachesCanBeAssigned|TrainerMustBeCoach|UserRole\\.Coach|trainerId|TrainerIds" backend/src backend/tests frontend/src frontend/e2e`.

2. Centralize backend assignable-trainer eligibility
   - Add a small backend-owned predicate for users assignable as group trainers, for example `GroupTrainerEligibility.IsAssignableTrainerRole(UserRole role)`.
   - The predicate should allow `UserRole.Coach` and `UserRole.HeadCoach`.
   - Keep the active-user requirement outside or alongside the predicate so inactive users remain rejected.
   - Do not add `Administrator` or any future role implicitly.

3. Update group trainer options contract
   - In `GroupEndpoints.ListTrainerOptionsAsync`, return active users whose role is assignable for group trainer assignment.
   - Preserve ordering by `FullName`, then `Login`.
   - Do not add role fields to `TrainerOptionResponse`; the UI acceptance criterion says no technical role labels.

4. Update group assignment validation
   - In `GroupRequestValidator.ValidateTrainerIdsAsync`, accept normalized ids only when all users are active and have an assignable trainer role.
   - Preserve current behavior for empty arrays, duplicate ids after normalization, invalid Guid.Empty and unknown users.
   - Update `GroupResources` text away from "роль Coach", for example to "активных тренеров или главного тренера", while keeping the same validation field `trainerIds`.

5. Validate report consumer compatibility
   - Because frontend finance reports use the same `getTrainerOptions`, update `ReportsEndpoints.ValidateBranchAndTrainerAsync` to accept `HeadCoach` as a valid trainer filter if the user can be assigned as a group trainer.
   - Keep administrators and unknown users rejected.
   - Update `ReportsResources` only if the current generic text becomes misleading after the predicate change.
   - Confirm `FinancialReportService` already loads assigned trainer users by id and does not require a role-specific change.

6. Preserve access-scope semantics
   - Do not change `AccessScopeService` unless tests reveal a direct incompatibility.
   - HeadCoach should still receive elevated all-group access from role semantics, not from assigned group ids.
   - Coach should still receive access only to groups where that same coach id is assigned.
   - Do not expand ordinary coaches' permissions or allowed sections.

7. Frontend group form integration
   - Confirm `frontend/src/lib/api/types.ts`, `frontend/src/lib/api/groups.ts` and `GroupManagement.tsx` do not need a contract shape change.
   - If no client-side role filtering exists, keep code unchanged and rely on backend options.
   - If a client-side filter is discovered during implementation, remove or update it so frontend consumes backend options without duplicating role rules.
   - Keep `MultiSelect` option labels based on name/login only and do not add role labels such as `HeadCoach`.

8. Update frontend regression coverage
   - In `frontend/e2e/stage12.spec.ts`, extend the trainers fixture with a HeadCoach option returned by `/api/groups/options/trainers`.
   - Update or add a group create/edit flow that selects HeadCoach in `Тренеры группы`, asserts the submitted `trainerIds` contains the HeadCoach id, and asserts the resulting group card displays the HeadCoach name as a normal trainer name.
   - Keep existing ordinary coach selection coverage.
   - If a closer group-management component test exists by implementation time, add a focused assertion there instead of broadening e2e more than needed.

9. Update backend regression coverage
   - In `backend/tests/GymCrm.Tests/GroupsApiTests.cs`, add coverage that `/groups/options/trainers` includes active HeadCoach and active Coach users, while excluding Administrator and inactive users.
   - Add create/update or dedicated `PUT /groups/{id}/trainers` coverage proving a HeadCoach id is accepted and persisted in both `GroupTrainers` and active `GroupTrainerAssignments`.
   - Add negative coverage proving Administrator is still rejected as a group trainer.
   - Keep or extend coverage proving a Coach still cannot access group management endpoints.
   - In `backend/tests/GymCrm.Tests/FinancialReportsApiTests.cs`, add or update coverage so report filtering by an assigned HeadCoach trainer id succeeds, while an Administrator id still fails.

10. Run validation
   - Run backend tests.
   - Run frontend lint and build.
   - Run affected frontend e2e or the closest supported targeted Playwright command for group management.
   - Run a final source search for remaining role-only trainer assignment predicates and classify any remaining `UserRole.Coach` checks as intentionally access-scope or coach-only behavior.

## Preferred implementation strategy
1. Contract-first backend change: options and validation use the same assignable-trainer predicate.
2. Consumer compatibility: reports either accept the same assignable trainer ids or do not receive HeadCoach options; prefer backend acceptance because HeadCoach becomes a real group trainer assignment.
3. Frontend as contract consumer: do not encode CRM role rules in React; the form should render whatever valid trainer options backend returns.
4. Regression-first around permissions: tests must prove ordinary Coach access is unchanged.
5. Small localized edits: no role model redesign, no schema changes, no broad access-scope refactor.

## Files likely to change
- `backend/src/GymCrm.Api/Auth/GroupEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/GroupRequestValidator.cs`
- `backend/src/GymCrm.Api/Auth/Resources/GroupResources.resx`
- `backend/src/GymCrm.Api/Auth/GroupResources.cs`
- `backend/src/GymCrm.Api/Auth/ReportsEndpoints.cs`
- optionally `backend/src/GymCrm.Api/Auth/Resources/ReportsResources.resx`
- optionally `backend/src/GymCrm.Api/Auth/ReportsResources.cs`
- optionally a new backend helper near `backend/src/GymCrm.Api/Auth/GroupTrainerEligibility.cs`
- `backend/tests/GymCrm.Tests/GroupsApiTests.cs`
- `backend/tests/GymCrm.Tests/FinancialReportsApiTests.cs`
- `frontend/e2e/stage12.spec.ts`
- optionally `frontend/src/features/groups/GroupManagement.tsx` only if frontend role filtering or misleading copy is found

If additional consumers are unclear, discover them before editing with:
`rg "getTrainerOptions|/groups/options/trainers|GroupTrainers|GroupTrainerAssignments|TrainerMustBeCoach|OnlyActiveCoachesCanBeAssigned|UserRole\\.Coach" backend frontend`.

## Constraints
- Backend owns roles, permissions, access scope, group assignment and validation semantics.
- Frontend must not bypass backend by injecting HeadCoach ids that backend does not validate.
- Do not change the global user role model or allow creating extra HeadCoach users.
- Do not let `Administrator` become assignable as a group trainer.
- Do not allow inactive or archived users to be assigned.
- Do not expand ordinary Coach access to unassigned groups.
- Do not add technical role labels to group trainer options.
- Do not change schedule, attendance, finance attribution or bot behavior except where needed to consume the valid HeadCoach group-trainer relationship.
- No DB/schema migration is expected.

## Out of scope
- Creating or managing multiple HeadCoach accounts.
- Redesigning RBAC, permissions or access-scope architecture.
- Changing ordinary Coach access to clients outside assigned groups.
- Changing group scheduling, attendance write-off rules, finance calculations or bot flows beyond compatibility checks.
- Mass migration of existing group trainers.
- UI redesign of the group form or finance filters.

## Required test coverage

### Unit tests
Add unit tests only if the assignable-trainer predicate is placed in a unit-testable application/domain helper. If it stays as a tiny API-local helper, focused backend integration tests are sufficient.

Useful unit assertions, if applicable:
- `Coach` is assignable;
- `HeadCoach` is assignable;
- `Administrator` is not assignable;
- active status is enforced by the caller or companion predicate.

### Integration tests
Backend integration coverage is required:
- trainer options include active HeadCoach and active Coach;
- trainer options exclude Administrator and inactive users;
- group create/update or `PUT /groups/{id}/trainers` accepts HeadCoach and persists current plus historical assignment records correctly;
- Administrator or inactive user ids still produce `trainerIds` validation errors;
- financial report trainer filter accepts assigned HeadCoach after the shared options list can expose it;
- ordinary Coach authorization remains restricted to existing allowed endpoints and assigned groups.

### UI tests
Frontend UI/e2e coverage is required if no lower-level group-management test exists:
- `/api/groups/options/trainers` mock includes HeadCoach;
- group form lets the user select HeadCoach from `Тренеры группы`;
- create/edit payload includes the HeadCoach id in `trainerIds`;
- saved group display shows the HeadCoach full name as a normal trainer name without role labels.

### Manual validation
Manual checks are useful for the final product flow but are not enough as the regression barrier.

## Test plan
- [ ] Run `dotnet test backend/GymCrm.slnx`.
- [ ] Run `cd frontend && npm run lint`.
- [ ] Run `cd frontend && npm run build`.
- [ ] Run the affected Playwright group-management spec, for example `cd frontend && npm run test:e2e -- stage12.spec.ts` if supported by the project scripts.
- [ ] Manually log in as HeadCoach or Administrator, open group create/edit, confirm HeadCoach appears in trainer options and can be saved.
- [ ] Manually confirm ordinary Coach still cannot access group management and does not gain access to unrelated clients/groups.
- [ ] Manually check finance report trainer filter if HeadCoach appears in that shared options list.

## Regression barrier
No implementation is complete without automated checks proving:
- backend options and backend assignment validation agree on `Coach | HeadCoach` as assignable group trainer roles;
- HeadCoach assignment persists in `GroupTrainers` and `GroupTrainerAssignments`;
- inactive users and Administrator remain rejected;
- frontend group form submits HeadCoach id through the normal trainer selection flow;
- ordinary Coach permissions and access scope remain unchanged;
- finance report trainer filtering does not offer a HeadCoach id that backend rejects.

## Risks
- Role predicate drift: options may include HeadCoach while validation or reports still reject the id.
- Permission regression: changing `AccessScopeService` unnecessarily could alter ordinary Coach access.
- Shared endpoint risk: `/groups/options/trainers` is used outside group management, especially finance reports.
- Copy drift: backend validation text currently mentions role `Coach` and can become misleading after the rule change.
- Hidden consumer risk: schedule, attendance, finance or bot code may assume every `GroupTrainer.Trainer` has `UserRole.Coach`.
- Test fixture risk: existing tests may use HeadCoach id as actor id and now also as assignable trainer id, so assertions must distinguish actor permissions from trainer assignment semantics.

## Stop conditions
Остановиться и не писать код, если:
- реализация требует изменения общей модели ролей или создания нескольких HeadCoach пользователей;
- нужно менять auth/session/security architecture, а не локальное правило assignable trainer;
- обнаружено, что `GroupTrainer` используется как источник прав для HeadCoach и это ломает elevated access semantics;
- backend contract для trainer options не может быть синхронизирован с report consumers без отдельного продуктового решения;
- scope начинает требовать миграцию существующих назначений, перерасчет отчетов или изменение attendance semantics;
- acceptance criteria невозможно выполнить без уточнения branch/group constraints.

Do not stop only because both backend and frontend need validation. Stop only if the change becomes system-wide instead of localized.

## Ready for Codex execution
yes, after explicit risky-task implementation approval.

Reason: task is high-risk because it touches roles, permissions and group assignment, but the implementation surface is local, clarification questions are closed, branch is defined, and automated regression barriers are available.
