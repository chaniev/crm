# Implementation Plan: TASK-053 Полностью удалить системный идентификатор из типа группы

## Source task
/backlog/risky/TASK-053-hide-group-type-system-identifier.md

## Implementation branch
feature/TASK-053-hide-group-type-system-identifier

Branch rules:
- create this branch before writing project code;
- create it from `main` after `git pull` and clean `git status`;
- do not branch from another feature/fix/refactor branch;
- if `main` is ahead/behind or dirty, resolve that state before implementation starts;
- if the branch already exists, verify that it belongs only to `TASK-053`;
- do not implement other unrelated TASKs in this branch;
- confirm the branch is active before making backend or frontend changes.

## Goal
Тип группы создается, редактируется, хранится и возвращается API без `SystemIdentifier`/`systemIdentifier`, а все связанные пользовательские сценарии продолжают работать через backend-owned `groupTypeId` и название типа группы.

## Current understanding
- Задача явно выбрана из `/backlog/risky`; clarification закрыт 2026-05-27: `SystemIdentifier` нужно удалить полностью, не прятать в форме.
- Backend сейчас хранит поле в `GroupType`, EF configuration, initial migration/model snapshot, create/update DTO, response DTO, audit state, validation and duplicate checks.
- API групп сейчас возвращает `groupTypeSystemIdentifier` через `GroupListItemResponse`, `GroupDetailsResponse`, `TrainingGroupListItemMapper` and `GroupEndpoints.MapDetails`.
- Frontend сейчас содержит поле в `GroupType`, `UpsertGroupTypeRequest`, group type mapper, settings create/edit form, карточках справочника, group select labels, schedule helpers and e2e fixtures.
- `frontend/src/lib/groupSchedule.ts` использует `groupTypeSystemIdentifier` как ключ цвета/легенды и содержит slug overrides (`cardio`, `basics`, etc.); после удаления ключ должен стать `groupTypeId`, без восстановления нового slug/code.
- Изменение является backend contract/schema change и full-stack consumer update. Оно локально по сущности group type, но high-risk из-за схемы БД, API контрактов, audit JSON and many tests/fixtures.

## Execution steps
1. Подготовить ветку: перейти на `main`, выполнить `git pull`, убедиться в чистом `git status`, создать или проверить `feature/TASK-053-hide-group-type-system-identifier`.
2. Перед редактированием снять точный inventory командой `rg -n "SystemIdentifier|systemIdentifier|groupTypeSystemIdentifier" backend frontend` and keep it as implementation checklist.
3. Backend domain: удалить `GroupType.SystemIdentifier` and `GroupType.SystemIdentifierMaxLength` from `backend/src/GymCrm.Domain/Groups/GroupType.cs`.
4. Backend persistence: удалить EF property and unique index from `backend/src/GymCrm.Infrastructure/Persistence/Configurations/GroupTypeConfiguration.cs`; keep unique `Name` and existing `GroupTypeId` relationships unchanged.
5. Backend schema contract: remove `SystemIdentifier` column and `IX_GroupTypes_SystemIdentifier` from current schema artifacts. Preferred for current early-stage schema: update `20260513165936_InitialCreate.cs`, its designer and `GymCrmDbContextModelSnapshot.cs`; if execution confirms forward migrations are required instead, create a deterministic `DropGroupTypeSystemIdentifier` migration and keep the snapshot consistent.
6. Backend group type API: update `UpsertGroupTypeRequest`, `GroupTypeResponse`, `GroupTypeAuditState`, `GroupTypeEndpoints.NormalizeRequest`, create/update assignment, mapping and list ordering so no request/response/audit state contains `SystemIdentifier`.
7. Backend validation: remove required/length/uniqueness validation for `systemIdentifier`; keep backend-owned `name` and `description` validation and duplicate-name checks.
8. Backend resources: remove unused `SystemIdentifierRequired`, `SystemIdentifierTooLong` and `SystemIdentifierAlreadyExists` resource accessors and `.resx` entries.
9. Backend groups contract: remove `GroupTypeSystemIdentifier` from `GroupListItemResponse` and `GroupDetailsResponse`; update `TrainingGroupListItemMapper` and `GroupEndpoints.MapDetails` to return only `groupTypeId` and `groupTypeName`.
10. Check `GroupTypeSummaryResponse`; remove or simplify it if it becomes unused, but do not introduce a replacement technical identifier.
11. Backend tests: update all `GroupType` seeds to compile without `SystemIdentifier`; prefer a local test helper for repeated group type setup if it reduces fixture churn without broad refactoring.
12. Backend contract tests: update `GroupsApiTests` so create/update group type payloads omit `SystemIdentifier`, responses assert absence of `systemIdentifier`, duplicate validation asserts only `name`, and group list/details assert absence of `groupTypeSystemIdentifier`.
13. Frontend API types: remove `systemIdentifier` from `GroupType` and `UpsertGroupTypeRequest`; remove `groupTypeSystemIdentifier` from training group list/details/response payload types and mappings.
14. Frontend settings UI: remove `systemIdentifier` from `GroupTypeFormValues`, initial values, edit prefill, submit payload, field validation, modal input and visible badge/card text. Keep create/edit/delete behavior unchanged.
15. Frontend validation handling: keep ProblemDetails field error display via existing `ApiError` flow; do not add a hidden fallback field, generated slug or frontend-owned duplicate/length semantics.
16. Frontend group management: update type select labels to use the unique backend-owned group type name, optionally with non-technical context only if already available from backend.
17. Frontend schedule helpers: remove `groupTypeSystemIdentifier` from `ScheduleGroupLike`; make `getScheduleTypeKey` use `groupTypeId` only, keep `groupTypeName` for labels, and remove slug-specific palette overrides so colors are stable by id rather than technical code.
18. Frontend tests and mocks: update `groupSchedule.test.ts`, `notifications-auto-dismiss.spec.ts`, `group-schedule.spec.ts`, `responsive-main-screens.spec.ts`, `stage12.spec.ts` and any API fixtures so group type and group payloads no longer include removed fields.
19. Run final code search over project source/tests: `rg -n "SystemIdentifier|systemIdentifier|groupTypeSystemIdentifier" backend/src backend/tests frontend/src frontend/e2e`. Any remaining hit must be either deliberately out of scope documentation or a bug to remove before completion.
20. Run backend and frontend validation, then do a focused manual check of settings group type create/edit and group create/edit with selected type.

## Preferred implementation strategy
1. Contract-first: backend domain/schema/API DTOs first, then update all consumers.
2. Compile-driven cleanup: use C# and TypeScript errors to catch removed contract fields.
3. No compatibility alias for `SystemIdentifier`: requests, responses, audit state and frontend payloads should simply stop using it.
4. Use `groupTypeId` as the stable non-human key for frontend schedule color/legend logic.
5. Keep implementation in one branch because the backend contract and frontend consumer updates must land together.
6. Add/adjust automated regression tests in the same branch before final manual QA.

Avoid:
- adding `slug`, `code`, `alias`, hidden `systemIdentifier` or generated fallback;
- moving group type validation semantics into frontend;
- changing roles, permissions, membership, attendance or schedule domain rules;
- renaming existing group type names as a side effect;
- broad Settings redesign beyond removing the field and keeping the flow coherent.

## Files likely to change
- `backend/src/GymCrm.Domain/Groups/GroupType.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/GroupTypeConfiguration.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.Designer.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/GymCrmDbContextModelSnapshot.cs`
- `backend/src/GymCrm.Api/Auth/GroupTypeEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/UpsertGroupTypeRequest.cs`
- `backend/src/GymCrm.Api/Auth/GroupTypeResponse.cs`
- `backend/src/GymCrm.Api/Auth/GroupTypeAuditState.cs`
- `backend/src/GymCrm.Api/Auth/GroupTypeResources.cs`
- `backend/src/GymCrm.Api/Auth/Resources/GroupTypeResources.resx`
- `backend/src/GymCrm.Api/Auth/GroupListItemResponse.cs`
- `backend/src/GymCrm.Api/Auth/GroupDetailsResponse.cs`
- `backend/src/GymCrm.Api/Auth/TrainingGroupListItemMapper.cs`
- `backend/src/GymCrm.Api/Auth/GroupEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/GroupTypeSummaryResponse.cs`
- `backend/tests/GymCrm.Tests/GroupsApiTests.cs`
- backend tests with `GroupType` seeds: `AttendanceApiTests.cs`, `AuthorizationFlowTests.cs`, `BranchesApiTests.cs`, `ClientsApiTests.cs`, `CsrfProtectionTests.cs`, `FinancialReportsApiTests.cs`, `InternalBotApiTests.cs`
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/groupTypes.ts`
- `frontend/src/lib/api/groups.ts`
- `frontend/src/features/settings/SettingsScreen.tsx`
- `frontend/src/features/groups/GroupManagement.tsx`
- `frontend/src/lib/groupSchedule.ts`
- `frontend/src/lib/groupSchedule.test.ts`
- `frontend/e2e/notifications-auto-dismiss.spec.ts`
- `frontend/e2e/group-schedule.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`
- `frontend/e2e/stage12.spec.ts`

## Constraints
- Backend remains the source of truth for group type validation semantics and ProblemDetails.
- Frontend must not restore an equivalent technical identifier under another name.
- Existing groups must keep their `GroupTypeId` references and remain openable/editable.
- Group type names remain the user-facing discriminator; no bulk rename or generated naming migration in this task.
- Do not change schedule, attendance, membership, roles, permissions or bot behavior beyond compile/contract fallout.
- Database schema changes must preserve the `TrainingGroups.GroupTypeId -> GroupTypes.Id` relationship.
- Audit state for future group type changes must omit `SystemIdentifier`; historical audit rows are not rewritten in this task unless execution discovers a hard runtime requirement.

## Out of scope
- Redesign of the whole Settings section.
- Branch, hall, group, attendance, membership or schedule business logic changes.
- Adding a replacement slug/code field.
- Production data cleanup scripts or mass renaming existing group type names.
- Bot feature changes unless backend compile/runtime contracts force a narrow test fixture update.
- Changing auth, roles, permissions or access scope.

## Required test coverage

### Unit tests
Add or update tests for:
- frontend schedule helpers using `groupTypeId` as the stable type key;
- schedule legend/color behavior no longer depending on `groupTypeSystemIdentifier`;
- any frontend mapping/helper changed to remove the old contract field.

### Integration tests
Add or update backend integration tests for:
- creating a group type without `SystemIdentifier`;
- updating a group type without `SystemIdentifier`;
- list/get group type responses not containing `systemIdentifier`;
- group list/details responses not containing `groupTypeSystemIdentifier`;
- duplicate group type validation still works by `name`;
- existing groups with `GroupTypeId` still list, open and update after the schema/model change;
- schema/model validation through `dotnet test backend/GymCrm.slnx`.

Migration/schema coverage should include at least clean database setup through the normal test host. If a forward migration is created, add a smoke check that applies it cleanly.

### UI tests
Update or add e2e coverage for:
- settings group type creation without a "Системный идентификатор" field;
- settings group type editing without that field;
- group create/edit flow selecting a group type by user-facing name;
- schedule page rendering and legend/color mapping without `groupTypeSystemIdentifier`;
- notification auto-dismiss spec fixtures after the create payload change.

### Regression priority
High. This is a contract/schema removal touching domain, persistence, API, audit state, frontend API types, settings UI, group management, schedule helpers and e2e fixtures.

### Minimum expectation
- Backend tests must cover the removed request/response fields and group reference continuity.
- Frontend build must prove no consumer still expects `systemIdentifier` or `groupTypeSystemIdentifier`.
- At least one automated UI/e2e path must prove settings create/edit works without the removed field.
- Final source search must prove the identifier is gone from project source/tests, not merely hidden in UI.

## Test plan
- [ ] `dotnet test backend/GymCrm.slnx`
- [ ] `cd frontend && npm run test:unit -- groupSchedule.test.ts`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:e2e -- notifications-auto-dismiss.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- group-schedule.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- responsive-main-screens.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- stage12.spec.ts`
- [ ] Manual check: `/settings` create group type without system identifier.
- [ ] Manual check: `/settings` edit existing group type without system identifier.
- [ ] Manual check: create/edit training group with selected group type.
- [ ] Final search: `rg -n "SystemIdentifier|systemIdentifier|groupTypeSystemIdentifier" backend/src backend/tests frontend/src frontend/e2e`.

## Regression barrier
Primary barrier: backend integration tests lock the new contract by proving group type create/update/list/get and group list/details work without `SystemIdentifier`/`groupTypeSystemIdentifier`.

Secondary barrier: TypeScript build plus frontend unit/e2e tests lock all consumers so the old fields cannot silently return via mappings, fixtures or schedule helpers.

Search barrier: the final `rg` command over backend/frontend source and tests must have no live code hits for `SystemIdentifier`, `systemIdentifier` or `groupTypeSystemIdentifier`.

Manual barrier: settings create/edit and group create/edit are checked once after automated validation to catch UX regressions not expressed in tests.

## Risks
- Removing the EF property without updating all migration/model snapshot artifacts can leave schema drift.
- Group API consumers may still expect `groupTypeSystemIdentifier`, especially schedule and older e2e fixtures.
- Schedule color stability can regress if the key changes from slug to unstable label; use `groupTypeId`.
- Removing frontend form validation too broadly can make settings UX feel broken; keep backend-owned errors visible through existing ProblemDetails handling.
- Historical audit entries may still contain old JSON; rewriting them is out of scope, but new audit state must omit the field.
- Existing local/dev databases with the old column may need recreate or forward migration, depending on execution environment.

## Stop conditions
Остановиться и не писать код, если:
- implementation cannot preserve existing `TrainingGroups.GroupTypeId` references;
- the schema strategy is unclear for the target environment and would risk production data without migration/rollback agreement;
- a consumer requires a stable non-id code and product refuses `groupTypeId`;
- removing `groupTypeSystemIdentifier` expands into schedule, attendance, membership, roles or permission logic changes;
- acceptance criteria cannot be met without adding a replacement technical identifier;
- branch is not `feature/TASK-053-hide-group-type-system-identifier` or git status is dirty before implementation starts.

Do not stop only because both backend and frontend must change; this is expected for the contract removal.

## Ready for Codex execution
yes, after explicit review of this risky plan and after the executor confirms the schema strategy and the dedicated branch.
