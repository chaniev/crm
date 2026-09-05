# Implementation Plan: TASK-037 Реализовать backend API статистики и финансовых отчетов

## Source task
/backlog/done/2026-05-14/TASK-037-financial-reports-backend-api.md

## Implementation branch
feature/TASK-037-financial-reports-backend-api

Branch rules:
- create this branch before writing product code;
- create it from updated `main`, after `TASK-036` is merged or otherwise explicitly available on the base branch;
- do not implement other unrelated TASKs in this branch;
- confirm the branch is active and `git status` is clean before making backend code changes;
- stop if the active branch is still a TASK-036 or other unrelated branch.

Recommended start:
```text
git switch main
git pull
git switch -c feature/TASK-037-financial-reports-backend-api
```

## Goal
Главный тренер получает backend-owned API первого релиза для финансовых и статистических отчетов: продажи, возвраты, чистая сумма, новые клиенты, фильтры периода/филиала/тренера и историческая attribution-семантика через period-модели из `TASK-036`.

## Current understanding
TASK-037 является backend-задачей и не должна реализовывать frontend вкладку `Финансы`. Frontend и bot должны получать готовые totals/breakdowns от backend и не пересчитывать финансовые формулы локально.

Задача зависит от `TASK-036`: до старта реализации в backend должны существовать стабильная сущность продажи абонемента, отдельные refund events и period-модели для client-branch, client-group и group-trainer attribution. В текущем inspected-коде до применения TASK-036 все еще видны старые модели `ClientMembership`, `ClientGroup` и `GroupTrainer` без period boundaries, поэтому реализацию TASK-037 нельзя начинать поверх текущей схемы без завершенного TASK-036.

Текущий backend использует minimal API endpoints в `backend/src/GymCrm.Api/Auth`, EF Core `GymCrmDbContext` в Infrastructure, typed response records рядом с endpoint-группами, authorization policies в `GymCrmAuthorizationPolicies`, access profile через `PermissionSet`/`AccessScopeService`, и integration tests в `backend/tests/GymCrm.Tests`.

## Execution steps
1. Preflight: verify `TASK-036` is implemented on the selected base branch and provides `ClientMembershipSale`, `ClientMembershipRefund`, cancellation state, required `SaleId`, and `DateOnly` period assignments for client-branch, client-group and group-trainer.
2. Create the implementation branch `feature/TASK-037-financial-reports-backend-api` from updated `main`; stop if the branch cannot be created cleanly from the correct base.
3. Define the HTTP contract for the first release report endpoint, preferably `GET /reports/financial`, with:
   - `periodPreset=month|quarter|year|custom`;
   - required `anchorDate` for quick presets or explicit deterministic default policy;
   - required `from`/`to` for `custom`;
   - optional `branchId` where omitted means all branches;
   - optional `trainerId`;
   - response with normalized period, canonical totals, branch breakdown and trainer/group breakdowns.
4. Add backend request normalization and validation:
   - parse ISO `DateOnly` values;
   - reject invalid preset/custom combinations;
   - reject `from > to`;
   - validate branch exists when `branchId` is provided;
   - validate trainer exists and has `Coach` role when `trainerId` is provided;
   - return consistent `ValidationProblem`/ProblemDetails for bad filters.
5. Add report access behavior:
   - introduce `GymCrmAuthorizationPolicies.ViewFinancialReports` requiring only `HeadCoach`;
   - protect the report endpoint with that policy;
   - if frontend navigation requires backend capability discovery, extend `PermissionSet`, `AccessScopeService`, auth session response and related tests with `CanViewFinancialReports` and, if needed, a `Finance` section.
6. Add Application-layer contracts for report execution, for example:
   - `GymCrm.Application/Reports/IFinancialReportService.cs`;
   - request/result records for normalized filters, money totals and breakdown rows.
7. Implement Infrastructure report query service:
   - read sales from `ClientMembershipSale.PurchaseDate`;
   - compute sold membership count and gross sales from sale rows only;
   - compute refunds from non-canceled `ClientMembershipRefund.RefundDate`;
   - include refunds whose refund date is inside the selected period even if the original sale is outside the period;
   - compute net total as `grossSales - refundTotal`;
   - compute new clients by each client's first sale date;
   - use `AsNoTracking` projections and keep EF queries deterministic.
8. Implement historical attribution:
   - use the financial event date as the attribution date;
   - match period rows with `ValidFrom <= date && (ValidTo == null || date < ValidTo)`;
   - branch attribution comes from client-branch assignment on the event date;
   - group attribution comes from client-group assignment on the event date, restricted to groups in the active client branch;
   - trainer attribution comes from intersecting client-group and group-trainer assignments on the same group and event date;
   - canonical totals must count each matching financial event once;
   - duplicated breakdown rows may count the same event multiple times for multi-group/multi-trainer attribution.
9. Apply filters consistently:
   - `branchId` filters events by historical client branch at the financial event date;
   - `trainerId` filters events by existence of at least one matching trainer attribution at the event date, while canonical totals remain event-level and are not multiplied by the number of groups;
   - breakdown rows preserve expected duplication semantics after filters.
10. Wire the endpoint in `Program.cs`, add response records/resources/constants, and keep endpoint code as transport/mapping glue rather than embedding the full financial query.
11. Update contract generation/OpenAPI artifacts only if the project has an active generation convention; otherwise rely on typed minimal API contracts and integration tests.
12. Add focused integration tests before considering implementation complete.
13. Run `dotnet test backend/GymCrm.slnx`.
14. Add/update a note for `TASK-038` only if the final backend response shape or auth capability names differ from this plan.

## Preferred implementation strategy
1. Contract-first backend implementation.
2. Access policy and filter validation before aggregation internals.
3. Small Application contract plus Infrastructure query service.
4. Canonical event totals separated from duplicated breakdown projections.
5. Integration tests built from explicit sale/refund/period fixtures.
6. No frontend financial formula work in this task.

## Files likely to change
- backend/src/GymCrm.Api/Program.cs
- backend/src/GymCrm.Api/Auth/GymCrmAuthorizationPolicies.cs
- backend/src/GymCrm.Api/Auth/AuthEndpoints.cs
- backend/src/GymCrm.Api/Auth/AccessEndpoints.cs
- backend/src/GymCrm.Api/Auth/ReportsEndpoints.cs
- backend/src/GymCrm.Api/Auth/ReportsResources.cs
- backend/src/GymCrm.Api/Auth/Resources/ReportsResources.resx
- backend/src/GymCrm.Application/Authorization/AppSection.cs
- backend/src/GymCrm.Application/Authorization/PermissionSet.cs
- backend/src/GymCrm.Application/Reports/IFinancialReportService.cs
- backend/src/GymCrm.Application/Reports/FinancialReportContracts.cs
- backend/src/GymCrm.Infrastructure/DependencyInjection.cs
- backend/src/GymCrm.Infrastructure/Authorization/AccessScopeService.cs
- backend/src/GymCrm.Infrastructure/Reports/FinancialReportService.cs
- backend/src/GymCrm.Infrastructure/Persistence/GymCrmDbContext.cs
- backend/tests/GymCrm.Tests/FinancialReportsApiTests.cs
- backend/tests/GymCrm.Tests/AuthorizationFlowTests.cs

Files from `TASK-036` may be referenced but should not be redesigned in this task:
- backend/src/GymCrm.Domain/Clients/ClientMembershipSale.cs
- backend/src/GymCrm.Domain/Clients/ClientMembershipRefund.cs
- backend/src/GymCrm.Domain/Clients/ClientBranchAssignment.cs
- backend/src/GymCrm.Domain/Groups/ClientGroupAssignment.cs
- backend/src/GymCrm.Domain/Groups/GroupTrainerAssignment.cs
- backend/src/GymCrm.Infrastructure/Persistence/Configurations/*

If exact names from `TASK-036` differ, adapt the report implementation to the actual stable contracts instead of renaming unrelated domain types inside TASK-037.

## Constraints
- Backend is the only source of financial report semantics.
- Do not aggregate sales from all `ClientMemberships` history rows.
- Use `ClientMembershipSale.GrossAmount` or the exact stable sale contract from `TASK-036`.
- Count sales by sale `PurchaseDate`.
- Count refunds by refund `RefundDate`.
- Exclude canceled refunds from refund total, net total and breakdowns.
- Gross sales are not reduced by refunds.
- Full refunds do not remove original sales from sold membership count or gross sales.
- Technical membership versions do not create separate sales.
- Use `DateOnly` period boundaries and half-open attribution matching.
- Do not use current client/group/trainer state for historical reports.
- Do not add direct trainer-branch links.
- Do not deduplicate duplicated group/trainer breakdown rows.
- Canonical totals do not have to equal the sum of duplicated breakdown rows.
- Financial report access remains `HeadCoach` only unless a separate product decision changes it.

## Out of scope
- Frontend `Финансы` screen, navigation and visual states.
- Creating sale/refund/period domain models if `TASK-036` has not completed.
- Registering or canceling refunds.
- Legacy/backfill support for partially populated databases.
- Cancellations/freezes accounting.
- Trainer payroll.
- External payment providers or accounting reconciliation.
- Redesigning global roles and permissions beyond the report access capability.

## Required test coverage

### Unit tests
Add unit tests if period normalization or aggregation is extracted into pure helpers:
- quick period normalization for month, quarter and year;
- custom period validation;
- event-level canonical deduplication under trainer filters;
- money total mapping and net total calculation.

### Integration tests
Add backend integration tests for:
- `HeadCoach` can access the report endpoint;
- `Administrator` and `Coach` cannot access financial report data;
- invalid period preset/custom combinations return ProblemDetails;
- invalid branch/trainer filters return ProblemDetails;
- month, quarter, year and custom period selection;
- one-branch filter and all-branches mode through client-branch periods;
- branch transfer affects reports only from the new client-branch period date;
- `ValidFrom`, day before `ValidTo`, and `ValidTo` boundary behavior;
- sold membership count and gross sales from `ClientMembershipSale`;
- zero-price memberships count as sold and add `0` to gross sales;
- technical membership versions do not increase sold count or gross sales;
- refund total by refund date, including refund in period for a sale outside the period;
- canceled refund exclusion;
- full refund keeps original sale in purchase-period gross sales and sold count;
- several partial refunds for one sale;
- net total equals gross sales minus non-canceled refunds;
- new clients count by first sale date;
- correction-updated sale date/amount affects the report through the updated sale row;
- group/trainer attribution by period intersection;
- duplicated breakdown rows for multi-group/multi-trainer attribution;
- canonical totals remain event-level when duplicated breakdown rows exceed totals.

### UI tests
No UI tests in TASK-037. Frontend visibility and rendering coverage belongs to `TASK-038`.

### Regression priority
This is high-risk financial and access logic. Automated integration tests are mandatory; manual QA is not sufficient as the regression barrier.

### Minimum expectation
Before completion, the implementation must clearly prove:
- formulas are backend-owned and correct;
- period/filter validation is deterministic;
- historical attribution uses period rows, not current state;
- unauthorized roles cannot receive financial payloads;
- duplicated breakdown rows do not overwrite canonical totals.

## Test plan
- [ ] Запустить `dotnet test backend/GymCrm.slnx`.
- [ ] Проверить API contract manually with a logged-in `HeadCoach` against seeded integration data if needed.
- [ ] Проверить, что `Administrator` and `Coach` receive the expected denial for the report endpoint.
- [ ] Проверить, что frontend-facing auth/session payload names are stable enough for `TASK-038`.

## Regression barrier
The primary regression barrier is `FinancialReportsApiTests.cs`: fixture-driven integration tests covering formula correctness, filters, permissions, historical attribution and duplicated breakdown semantics. `AuthorizationFlowTests.cs` should additionally lock the new report permission/capability behavior if the session contract is extended.

## Risks
- `TASK-036` may not be merged or may choose different entity names than the examples in TASK-037.
- Current pre-TASK-036 models do not yet expose the required period attribution semantics.
- EF query translation can become complex for mixed sale/refund event projections; prefer readable staged projections over a single opaque query.
- Trainer filters can accidentally multiply canonical totals if implemented from breakdown rows instead of event rows.
- Frontend may need a slightly different response shape; backend should return canonical totals explicitly to avoid formula duplication.
- Access profile changes may affect existing auth tests and frontend permissions parsing.

## Stop conditions
Остановиться и не писать product code, если:
- `ClientMembershipSale` or equivalent stable sale contract is missing;
- separate refund events with cancellation state are missing;
- period models for client-branch, client-group or group-trainer are missing;
- `TASK-036` is not present on the base branch selected for implementation;
- product decision changes access beyond `HeadCoach`;
- product decision requires non-duplicated group/trainer breakdown semantics;
- report date range semantics cannot be made deterministic for quick periods;
- implementation would require redesigning roles, branch model, group model or refund lifecycle.

## Ready for Codex execution
conditional: yes after `TASK-036` is implemented and available on the base branch, and after the executor creates `feature/TASK-037-financial-reports-backend-api` from updated `main`.

not ready for direct product-code execution on the currently inspected pre-TASK-036 backend schema.
