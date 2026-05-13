# Implementation Plan: TASK-036 Добавить возвраты и семантику продажи абонемента

## Source task
/backlog/risky/TASK-036-membership-refunds-sale-semantics.md

Note: source task remains in `/backlog/risky`. This run creates an implementation plan only; it does not move the task into active implementation.

## Implementation branch
feature/TASK-036-membership-refunds-sale-semantics

Branch rules:
- create this branch from `main` before writing product code;
- run `git checkout main`, `git pull`, and verify clean `git status`;
- do not implement other unrelated TASKs in this branch;
- confirm this branch is active before making backend code changes.

## Goal
Backend должен хранить валовую продажу абонемента и возвраты как отдельные финансовые события, отдавать backend-derived refund summary, не считать технические версии абонемента как новые продажи и подготовить периодную атрибуцию клиентов/групп/тренеров для будущих финансовых отчетов.

## Current understanding
Задача backend-only по ownership: финансовая семантика, validation, audit, ProblemDetails и persistence принадлежат backend.

Текущая модель `ClientMembership` уже версионирует абонементы через `ValidFrom`/`ValidTo` и `ChangeReason`, но не имеет стабильной sale identity. Из-за этого `Correction`, `PaymentUpdate` и `SingleVisitWriteOff` выглядят как отдельные строки истории и будущий отчет может посчитать их как продажи.

Текущие `ClientGroup` и `GroupTrainer` являются active join-таблицами без `DateOnly` period semantics. `Client.BranchId` хранит текущий филиал, но не историческую привязку. Для минимального безопасного изменения текущие поля/joins лучше сохранить как current-state read model, а новые period tables сделать источником будущей report attribution.

`UpsertClientRequest` уже содержит `GroupIds`, но пустой список сейчас допустим. `TransferClientBranchRequest` сейчас принимает один optional `GroupId`; для задачи нужен plural contract с минимум одной группой целевого филиала. Для снижения риска можно принять `GroupIds` как основной contract и временно нормализовать legacy `GroupId` как одиночный список, если это не конфликтует с текущими consumers.

`GroupEndpoints.UpdateGroupAsync` сейчас может менять `BranchId`; TASK-036 требует сделать филиал группы immutable после создания.

Rollout выполняется только на чистую базу, поэтому `ClientMembership.SaleId` можно делать required сразу, без nullable-stage и legacy backfill.

## Execution steps
1. Создать branch `feature/TASK-036-membership-refunds-sale-semantics` от актуального `main` и убедиться, что worktree clean.
2. Зафиксировать backend contracts до реализации: sale/refund DTOs, refund endpoints, refund ProblemDetails keys, membership response additions, audit action/entity names.
3. Добавить domain/persistence модели финансовых событий:
   - `ClientMembershipSale`;
   - `ClientMembershipRefund`;
   - required `ClientMembership.SaleId`;
   - navigation properties and EF configurations.
4. Обновить clean schema/migration:
   - sale/refund tables;
   - required FK from memberships to sales;
   - precision/check constraints for money fields;
   - refund cancellation fields without cancel reason;
   - indexes by `ClientId`, `SaleId`, `PurchaseDate`, `RefundDate`, active/canceled state.
5. Обновить `IClientMembershipService` и `ClientMembershipService`:
   - `PurchaseAsync` and `RenewAsync` create a new `ClientMembershipSale` and membership with the new `SaleId`;
   - `CorrectAsync` preserves `SaleId` and updates sale `PurchaseDate`/`GrossAmount` when corrected;
   - `CorrectAsync` rejects gross below non-canceled refund total;
   - `CorrectAsync` rejects purchase date later than earliest non-canceled refund date;
   - `MarkPaymentAsync` and `WriteOffSingleVisitAsync` preserve the current `SaleId`;
   - zero-price memberships create a sale with `GrossAmount = 0`.
6. Add refund use cases, preferably in the same membership application boundary first:
   - register refund for a sale owned by the client;
   - validate amount, refund date, sale ownership and accumulated refund total;
   - use a transaction around refund total validation and insert/cancel;
   - cancel refund by marking `CanceledAt`/`CanceledByUserId`, never deleting;
   - reject repeated cancellation.
7. Add HTTP endpoints under `/clients/{id}`:
   - `POST /clients/{id}/membership/sales/{saleId:guid}/refunds`;
   - `POST /clients/{id}/membership/refunds/{refundId:guid}/cancel`;
   - both require `ManageClients`, authenticated user and CSRF validation like existing membership mutations.
8. Extend API response contracts:
   - add `SaleId` to membership responses/audit snapshots;
   - add backend-derived financial summary: `grossAmount`, `refundedAmount`, `netAmount`, `refundStatus`, `lastRefundDate`;
   - expose `refunds[]` in manager details/history, while keeping coach details free of payment/refund payloads.
9. Add audit semantics:
   - refund created: entity `ClientMembershipRefund`, old null/new refund state;
   - refund canceled: entity `ClientMembershipRefund`, old/new state with cancellation fields;
   - sale corrected through membership correction: entity `ClientMembershipSale`, old/new sale state;
   - preserve existing membership action audit and ensure no password/user sensitive fields leak.
10. Add period attribution models while preserving current-state compatibility:
    - `ClientBranchAssignment(ClientId, BranchId, ValidFrom, ValidTo, CreatedByUserId, CreatedAt)`;
    - `ClientGroupAssignment(ClientId, GroupId, ValidFrom, ValidTo, CreatedByUserId, CreatedAt)`;
    - `GroupTrainerAssignment(TrainerId, GroupId, ValidFrom, ValidTo, CreatedByUserId, CreatedAt)`;
    - implement shared half-open period helper/query rule: `ValidFrom <= date && (ValidTo == null || date < ValidTo)`.
11. Update client create/update/transfer flows:
    - require at least one group for create/update;
    - on create, create initial active branch and group assignment periods with `ValidFrom = today`;
    - on same-branch group update, close removed group periods at today and open new group periods at today;
    - on branch transfer, require one or more target branch groups, close previous branch/group periods at today, update current `Client.BranchId` and current joins, then open new periods at today;
    - validate target groups belong to the active/target branch.
12. Update group flows:
    - reject `BranchId` changes for an existing group;
    - keep hall changes limited to halls in the immutable group branch;
    - on trainer assignment update, close removed trainer periods and open new periods at today;
    - allow one trainer in multiple groups and one group with multiple trainers.
13. Add DB-level and application-level period guards:
    - non-empty period check: `ValidTo IS NULL OR ValidTo > ValidFrom`;
    - one active branch assignment per client;
    - no overlapping `ClientBranchAssignment` periods per client, preferably with PostgreSQL exclusion constraint over half-open dateranges;
    - no duplicate overlapping period for the same client/group or trainer/group pair;
    - current client groups must not be empty.
14. Update seed/test fixtures and direct test inserts to create required `ClientMembershipSale` rows and `SaleId` values.
15. Run backend validation and fix regressions: `dotnet test backend/GymCrm.slnx`.

## Preferred implementation strategy
1. Contract-first backend implementation.
2. Persistence models before endpoint wiring.
3. Sale identity migration before refund endpoints.
4. Refund and correction validation inside backend service/use-case layer, not in HTTP-only code.
5. Add period attribution tables as report-ready source of truth while keeping current active joins for existing client/group screens.
6. Small commits by phase: schema/entities, membership sale flow, refund API, period assignments, tests.

## Files likely to change
- backend/src/GymCrm.Domain/Clients/ClientMembership.cs
- backend/src/GymCrm.Domain/Clients/ClientMembershipSale.cs
- backend/src/GymCrm.Domain/Clients/ClientMembershipRefund.cs
- backend/src/GymCrm.Domain/Clients/ClientMembershipRefundStatus.cs
- backend/src/GymCrm.Domain/Clients/ClientBranchAssignment.cs
- backend/src/GymCrm.Domain/Groups/ClientGroupAssignment.cs
- backend/src/GymCrm.Domain/Groups/GroupTrainerAssignment.cs
- backend/src/GymCrm.Application/Clients/IClientMembershipService.cs
- backend/src/GymCrm.Application/Clients/ClientMembershipSemantics.cs
- backend/src/GymCrm.Infrastructure/Clients/ClientMembershipService.cs
- backend/src/GymCrm.Infrastructure/Persistence/GymCrmDbContext.cs
- backend/src/GymCrm.Infrastructure/Persistence/Configurations/ClientMembershipConfiguration.cs
- backend/src/GymCrm.Infrastructure/Persistence/Configurations/ClientMembershipSaleConfiguration.cs
- backend/src/GymCrm.Infrastructure/Persistence/Configurations/ClientMembershipRefundConfiguration.cs
- backend/src/GymCrm.Infrastructure/Persistence/Configurations/ClientBranchAssignmentConfiguration.cs
- backend/src/GymCrm.Infrastructure/Persistence/Configurations/ClientGroupAssignmentConfiguration.cs
- backend/src/GymCrm.Infrastructure/Persistence/Configurations/GroupTrainerAssignmentConfiguration.cs
- backend/src/GymCrm.Infrastructure/Persistence/Migrations/*
- backend/src/GymCrm.Api/Auth/ClientEndpoints.cs
- backend/src/GymCrm.Api/Auth/ClientMembershipResponse.cs
- backend/src/GymCrm.Api/Auth/ClientMembershipAuditState.cs
- backend/src/GymCrm.Api/Auth/ClientAuditConstants.cs
- backend/src/GymCrm.Api/Auth/ClientResources.cs
- backend/src/GymCrm.Api/Auth/Resources/ClientResources.resx
- backend/src/GymCrm.Api/Auth/PurchaseClientMembershipRequest.cs
- backend/src/GymCrm.Api/Auth/RenewClientMembershipRequest.cs
- backend/src/GymCrm.Api/Auth/CorrectClientMembershipRequest.cs
- backend/src/GymCrm.Api/Auth/TransferClientBranchRequest.cs
- backend/src/GymCrm.Api/Auth/GroupEndpoints.cs
- backend/src/GymCrm.Api/Auth/GroupRequestValidator.cs
- backend/tests/GymCrm.Tests/BootstrapSmokeTests.cs
- backend/tests/GymCrm.Tests/ClientsApiTests.cs
- backend/tests/GymCrm.Tests/GroupsApiTests.cs

## Constraints
- Backend remains the only source of financial, validation, audit and report attribution semantics.
- Do not reduce `ClientMembership.PaymentAmount` when a refund is registered.
- Do not reduce `ClientMembershipSale.GrossAmount` because of refund.
- Refunds are counted by `RefundDate`, not purchase date.
- Refund amount must be explicit and must not make non-canceled refund total exceed sale gross.
- Canceled refunds remain stored and audited, but are excluded from summary/report totals.
- Refund does not change `IsPaid`, `ValidTo`, `PaymentAmount`, `SingleVisitUsed` or access state.
- `NewPurchase` and `Renewal` create financial sales.
- `Correction`, `PaymentUpdate` and `SingleVisitWriteOff` must not create sales.
- `Correction` must not make sale gross lower than existing non-canceled refunds.
- `Correction` must not move sale purchase date after earliest non-canceled refund date.
- Period dates use `DateOnly` and half-open matching.
- Client branch assignment periods for one client must never overlap.
- Client and trainer can have multiple group assignments on one date; report duplication by groups/trainers is expected.
- Group branch is immutable after creation.
- No legacy/backfill support is required for partially populated databases.

## Out of scope
- Aggregated financial report API.
- Frontend `Финансы` UI.
- Bot consumer changes unless backend compile/tests reveal direct contract breakage.
- External payment providers.
- Cancellation/freeze accounting.
- Legacy data backfill or production data preservation.
- Full removal of current-state `Client.BranchId`, `ClientGroup` or `GroupTrainer` read-model compatibility.

## Required test coverage

### Unit tests
Add or update unit tests if implementation extracts:
- refund summary calculation;
- refund date/amount validation;
- half-open period matching helpers;
- sale classification helpers for `NewPurchase`/`Renewal` vs technical membership versions.

### Integration tests
Add backend integration tests for:
- purchase creates `ClientMembershipSale` and required `SaleId`;
- renewal creates a second sale;
- correction, payment mark and single-visit write-off preserve `SaleId`;
- correction updates sale date/gross and writes sale audit old/new;
- correction rejects gross below non-canceled refund total;
- correction rejects purchase date later than earliest non-canceled refund date;
- zero-price membership creates sale with gross `0`;
- valid refund registration stores amount/date/user/time and does not mutate membership state;
- negative/zero amount rejection;
- future refund date rejection;
- refund date before purchase date rejection;
- refund date before sale creation date rejection;
- several partial refunds are allowed up to sale gross;
- refund above sale gross is rejected;
- refund cancellation marks canceled fields, audits old/new and excludes the refund from summary;
- repeated refund cancellation is rejected;
- manager details include financial summary/refunds and coach details do not expose payment/refund details;
- client create/update reject missing groups and groups from another branch;
- branch transfer requires target groups, closes previous periods and opens new branch/group periods;
- group branch update is rejected;
- trainer group update writes period assignment changes;
- `ClientBranchAssignment` non-overlap and half-open boundary behavior;
- clean schema model includes sale/refund/period entities, required `SaleId`, indexes and constraints.

### UI tests
No frontend/e2e coverage is required in this task because frontend finance UI is out of scope. Existing frontend may need a later consumer update if backend membership response changes are not fully backward-compatible.

### Regression priority
High. This task changes financial semantics, schema and audit behavior; automated backend integration tests are mandatory and manual QA alone is not sufficient.

### Minimum expectation
Before completion, tests must prove:
- technical membership history rows cannot be counted as extra sales;
- refunds cannot exceed gross sale amount;
- cancellation does not delete refunds and does not affect active access;
- period attribution state is reproducible from create/update/transfer flows;
- branch/group/trainer attribution rules are enforced by backend.

## Test plan
- [ ] Run `dotnet test backend/GymCrm.slnx`.
- [ ] Verify clean database schema creates all sale/refund/period tables and required FKs.
- [ ] Verify membership purchase, renewal, correction, payment mark and single-visit flows still pass.
- [ ] Verify refund create/cancel flows through HTTP and persistence.
- [ ] Verify audit log entries for refund create, refund cancel and sale correction.
- [ ] Verify manager/coach response visibility for membership financial payloads.
- [ ] Verify client group-required validation on create/update/transfer.
- [ ] Verify period assignments and half-open boundaries.
- [ ] Verify group branch immutability.

## Regression barrier
The regression barrier is backend integration coverage in `backend/tests/GymCrm.Tests/ClientsApiTests.cs`, `GroupsApiTests.cs` and `BootstrapSmokeTests.cs`, plus `dotnet test backend/GymCrm.slnx`. The most important barriers are sale/refund persistence tests, correction/refund validation tests, audit tests and period assignment tests.

## Risks
- Current membership endpoints audit only the current membership old/new state; sale correction needs an additional audit entry without weakening existing audit behavior.
- Required `SaleId` will break direct test inserts until fixtures create `ClientMembershipSale` first.
- Period attribution adds current-state/period-state synchronization; missed writes could make future reports inconsistent.
- PostgreSQL-level no-overlap constraints may need raw migration SQL and careful test strategy.
- Transfer client contract currently accepts one optional group; moving to plural required groups can affect frontend or tests even though frontend implementation is out of scope.
- Keeping current joins plus period tables is safer now, but it introduces temporary duplication that must be guarded by service-level writes and tests.

## Stop conditions
Остановиться и не писать код, если:
- выяснится, что полный возврат должен автоматически закрывать доступ или менять `IsPaid`;
- потребуется физически удалять возвраты вместо cancel-state;
- нужно разрешить возврат выше gross sale amount;
- refund cancellation reason станет обязательной;
- `Correction` не должна менять финансовую продажу;
- report breakdowns должны дедуплицироваться по группам/тренерам вместо ожидаемого дублирования;
- невозможно сохранить backend-owned financial formulas without frontend duplication;
- branch/group period synchronization требует redesign текущих clients/groups APIs шире TASK-036;
- DB-level no-overlap constraint невозможен без неподтвержденной production-risk migration strategy.

## Ready for Codex execution
yes, as a phased backend implementation after explicit branch setup and clean `main` sync.

no, for a one-shot broad rewrite without the schema/contracts/test phases above.
