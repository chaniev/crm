# Implementation Plan: TASK-031 Реализовать backend-модель филиалов и залов

## Source task
/backlog/risky/TASK-031-branches-backend-domain-contracts.md

## Goal
Backend becomes the source of truth for branches, halls and branch-aware rules for clients, groups, trainer access and memberships.

## Current understanding
Current backend has `Client`, `TrainingGroup`, `ClientGroup`, `GroupTrainer`, `ClientMembership`, attendance and access scope, but no branch or hall entities. Groups currently have only name, start time, schedule text, activity status, trainers and clients. Clients may belong to multiple groups through `ClientGroup`. Coach scope is derived from assigned groups, which matches the accepted model and should stay that way.

The task is backend-only by scope, but its contract changes will unblock TASK-032 and TASK-033. Existing deployment can be recreated from scratch, so schema migration is allowed, but backend rules still need deterministic tests.

## Execution steps
1. Define domain entities `Branch` and `Hall`: branch has name, address, description, archived status; hall has name, description, required branch and archival/delete restrictions.
2. Add `BranchId` to `Client` and `TrainingGroup`, and `HallId` to `TrainingGroup`. Decide whether existing `IsActive` stays separate from branch archival semantics.
3. Add EF configurations, DbSets, relationships and migration. Because clean deploy is allowed, avoid legacy data backfill beyond deterministic defaults required by tests.
4. Add branch/hall API contracts and endpoints for admin CRUD/archive flows. Keep domain validation out of transport helpers where possible.
5. Update client create/update request and response contracts so a client belongs to exactly one branch.
6. Update group create/update request and response contracts so a group belongs to exactly one branch and picks a hall from the same branch.
7. Add backend validation: no cross-branch client/group assignment; selected group during branch transfer must belong to the target branch; selected hall must belong to the group branch.
8. Implement client transfer endpoint/use case: update client branch, remove existing group assignments, optionally assign exactly selected group from the target branch, preserve current membership.
9. Preserve trainer access model: no `trainer-branch` table; coach-visible clients and groups remain derived from assigned groups.
10. Add hall delete/archive guard: reject if groups or schedule entries reference the hall. If schedule model is absent, implement guard for groups now and leave schedule check as an explicit extension point.
11. Update ProblemDetails/resource messages for branch/hall validation and permission errors.
12. Update backend bot/internal contracts only if they live in backend and expose group/client DTOs affected by new fields; consumer-side bot work remains TASK-033.
13. Add integration/regression tests before handing off to frontend/bot tasks.

## Preferred implementation strategy
1. Backend contract-first design and route naming.
2. Schema/entities/configurations.
3. Admin branch/hall endpoints with tests.
4. Client/group branch-aware fields and validation.
5. Client transfer command/endpoint.
6. Access scope regression tests for coach visibility.
7. Compatibility review for frontend/bot contracts.

## Files likely to change
- backend/src/GymCrm.Domain/Branches/Branch.cs
- backend/src/GymCrm.Domain/Branches/Hall.cs
- backend/src/GymCrm.Domain/Clients/Client.cs
- backend/src/GymCrm.Domain/Groups/TrainingGroup.cs
- backend/src/GymCrm.Infrastructure/Persistence/GymCrmDbContext.cs
- backend/src/GymCrm.Infrastructure/Persistence/Configurations/BranchConfiguration.cs
- backend/src/GymCrm.Infrastructure/Persistence/Configurations/HallConfiguration.cs
- backend/src/GymCrm.Infrastructure/Persistence/Configurations/ClientConfiguration.cs
- backend/src/GymCrm.Infrastructure/Persistence/Configurations/TrainingGroupConfiguration.cs
- backend/src/GymCrm.Infrastructure/Persistence/Configurations/ClientGroupConfiguration.cs
- backend/src/GymCrm.Infrastructure/Persistence/Migrations/*
- backend/src/GymCrm.Api/Auth/BranchEndpoints.cs
- backend/src/GymCrm.Api/Auth/BranchResources.cs
- backend/src/GymCrm.Api/Auth/Resources/BranchResources.resx
- backend/src/GymCrm.Api/Auth/ClientEndpoints.cs
- backend/src/GymCrm.Api/Auth/UpsertClientRequest.cs
- backend/src/GymCrm.Api/Auth/ClientDetailsResponse.cs
- backend/src/GymCrm.Api/Auth/ClientListItemResponse.cs
- backend/src/GymCrm.Api/Auth/GroupEndpoints.cs
- backend/src/GymCrm.Api/Auth/UpsertTrainingGroupRequest.cs
- backend/src/GymCrm.Api/Auth/GroupDetailsResponse.cs
- backend/src/GymCrm.Api/Auth/GroupListItemResponse.cs
- backend/src/GymCrm.Api/Auth/GroupRequestValidator.cs
- backend/src/GymCrm.Infrastructure/Authorization/AccessScopeService.cs
- backend/src/GymCrm.Infrastructure/Bot/BotApiService.cs
- backend/src/GymCrm.Application/Bot/BotApiContracts.cs
- backend/tests/GymCrm.Tests/BranchesApiTests.cs
- backend/tests/GymCrm.Tests/ClientsApiTests.cs
- backend/tests/GymCrm.Tests/GroupsApiTests.cs
- backend/tests/GymCrm.Tests/AuthorizationFlowTests.cs
- backend/tests/GymCrm.Tests/InternalBotApiTests.cs

## Constraints
- Backend owns branch validation, access scope, memberships and ProblemDetails.
- Domain must not depend on HTTP/UI.
- No direct trainer-branch relationship.
- Client belongs to exactly one branch.
- Group belongs to exactly one branch and hall from that branch.
- Frontend/bot consumers must be updated after contract changes, but not inside this task unless backend internal contracts are part of backend.
- Legacy production data migration is out of scope because deploy is from scratch.

## Out of scope
- Frontend settings/forms for branches and halls.
- Telegram bot consumer changes beyond backend internal DTO compatibility.
- Financial reports by branch.
- Full schedule conflict model.
- Production legacy data migration.

## Required test coverage

### Unit tests
Add unit tests only for extracted validation helpers if branch/hall validation is moved into small services. Otherwise cover behavior through integration tests.

### Integration tests
Add or update backend integration tests:
1. Branch CRUD/archive returns expected contracts and validation ProblemDetails.
2. Hall CRUD rejects missing branch, wrong branch, and archive/delete when group references the hall.
3. Client create/update requires valid `branchId`.
4. Group create/update requires valid `branchId` and `hallId` from the same branch.
5. Client cannot be assigned to a group from another branch.
6. Transfer client to another branch preserves membership, clears old groups and optionally assigns target-branch group.
7. Transfer rejects group from a different branch.
8. Coach access remains based on `GroupTrainer`, not branch membership.
9. Internal bot group/client queries return branch-aware contracts without widening coach scope.

### UI tests
No frontend UI tests in this task. TASK-032 owns frontend validation once backend contracts are available.

## Test plan
- [ ] Запустить `dotnet test backend/GymCrm.slnx`.
- [ ] Проверить CRUD филиалов и залов через backend integration tests.
- [ ] Проверить cross-branch client/group assignment rejection.
- [ ] Проверить перевод клиента между филиалами с группой и без группы.
- [ ] Проверить coach scope through assigned groups.
- [ ] Проверить ProblemDetails for branch/hall validation and permission errors.

## Regression barrier
Regression barrier is a backend integration suite proving branch/hall schema, cross-branch validation, client transfer behavior and trainer access scope. These tests must run before TASK-032/TASK-033 consume the contracts.

## Risks
- Adding branch rules directly into endpoint methods can create transport/domain coupling and make frontend/bot contracts fragile.
- Changing client-group relationship from many groups to branch-bound groups can accidentally break existing client list and attendance flows.
- Hall archive/delete semantics depend on schedule; if schedule entity appears before implementation, it must be included in guards.
- Existing tests and fixtures may assume clients/groups can be created without branch/hall.
- API route naming for settings must be stable before frontend work starts.

## Stop conditions
Остановиться и не писать код, если:
- API contract for branches/halls cannot be determined locally;
- implementation requires direct trainer-branch membership;
- schedule model exists and hall constraints require broad schedule redesign;
- required changes become system-wide instead of local domain/contract changes;
- production data preservation becomes critical and requires irreversible migration design.

## Ready for Codex execution
yes, after explicit review of this high-risk plan
