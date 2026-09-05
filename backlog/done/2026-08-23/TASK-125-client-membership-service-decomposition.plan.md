# Implementation Plan: TASK-125 Декомпозировать ClientMembershipService за стабильным facade

## Metadata
- source_task: /backlog/done/2026-08-23/TASK-125-client-membership-service-decomposition.md
- branch: refactor/TASK-125-client-membership-service-decomposition
- readiness: no — требуется human review transaction/overlap/attendance service boundaries
- dependencies: TASK-124 — должна быть интегрирована до исполнения
- risk: high — service владеет membership, payment, refund, attendance write-off and persistence atomicity

## Goal
`IClientMembershipService` и его DI consumer contract остаются неизменными, а
`ClientMembershipService` становится facade не более 250 строк над bounded
collaborators не более 400 строк каждый.

## Decisions and contracts
- Сохранить все девять public methods, records/enums, null/error semantics и
  `AddScoped<IClientMembershipService, ClientMembershipService>()`.
- Выделить responsibilities: details/query mapping; sale lifecycle
  purchase/renew/correct/comment; SingleVisit write-off/restore; refund/cancel.
- Каждый mutation collaborator полностью владеет transaction одной операции;
  collaborators используют тот же scoped `GymCrmDbContext` и не передают
  ambient mutable state друг другу.
- Общие lookups/mappers выделяются только при двух фактических consumers и не
  становятся repository/unit-of-work framework.
- HTTP idempotency остаётся в integrated TASK-124; service сохраняет только
  observable mutation/concurrency results, вызываемые API and Attendance.

## Scope
### In
- Internal infrastructure decomposition, DI graph and service-level characterization.

### Out
- Application contracts, membership/payment/refund/attendance rules, schema,
  API/frontend/bot changes and new persistence abstractions.

## Implementation slices
1. Добавить direct facade contract tests всех public methods и relational
   atomicity/consumer cases поверх current implementation.
2. Выделить details reader/mapping и refund/comment operations where ownership is explicit.
3. Выделить sale lifecycle and SingleVisit collaborators по transaction boundary.
4. Сократить facade до validation/delegation, обновить scoped DI for internal
   collaborators и проверить absence of cross-operation state.

## Likely files and layers
- `backend/src/GymCrm.Application/Clients/IClientMembershipService.cs` — verification only; contract should not change.
- `backend/src/GymCrm.Infrastructure/Clients/ClientMembershipService.cs` — thin facade.
- `backend/src/GymCrm.Infrastructure/Clients/ClientMembershipDetailsReader.cs` — load/map details.
- `backend/src/GymCrm.Infrastructure/Clients/ClientMembershipSaleService.cs` — purchase/renew/correct/comment.
- `backend/src/GymCrm.Infrastructure/Clients/ClientMembershipVisitService.cs` — write-off/restore.
- `backend/src/GymCrm.Infrastructure/Clients/ClientMembershipRefundService.cs` — register/cancel refund.
- `backend/src/GymCrm.Infrastructure/DependencyInjection.cs` — scoped internal collaborators.
- `backend/tests/GymCrm.Tests/ClientMembershipServiceContractTests.cs` — direct facade matrix.
- Existing `ClientMembershipWriteRegressionApiTests.cs`, `AttendanceApiTests.cs` and `ClientsApiTests.cs`.

## Regression specification
### Automated tests to add or update
- Resolve facade from DI and characterize Get/Purchase/Renew/Correct/Comment
  results, reload snapshots, addressed identities and all mutation errors.
- Register/Cancel refund preserves sale totals/status/audit-observable snapshots and rollback.
- WriteOff/Restore SingleVisit through Attendance preserves exact lineage,
  conflict rollback and idempotent same-state behavior.
- Real PostgreSQL overlap/concurrent purchase and mandatory audit rollback keep
  current results with no partial rows.
- DI scope proves facade/collaborators share one `GymCrmDbContext`; two scopes
  share no mutable operation state.
- Existing API payload/status/replay tests remain unchanged and green.

### Expected red evidence
- Behavior tests should be green on baseline because public behavior is
  preserved. Structural red is inapplicable as a product test; record baseline
  facade size (996 lines) and method ownership before extraction, without
  manufacturing a failing assertion tied only to filenames.

### Required validation
- Focused xUnit filter for `ClientMembershipServiceContractTests`, membership
  write regressions and Attendance SingleVisit/rollback scenarios.
- Verify facade `<= 250` and every collaborator `<= 400` lines.

### Regression barrier
- One relational facade sequence Purchase → Get → Renew/Correct →
  WriteOff/Restore → Refund/Cancel with fresh scope reloads, exact result enums,
  row counts and rollback assertions; existing API tests protect consumers.

## Risks and stop conditions
- Остановиться, если extraction требует изменить Application records/enums or
  the facade interface, or introduces a second transaction owner.
- Остановиться при non-relational-only proof for concurrency/rollback.
- Не продолжать, если shared helper starts encoding operation-specific rules or
  API idempotency leaks into infrastructure service.
