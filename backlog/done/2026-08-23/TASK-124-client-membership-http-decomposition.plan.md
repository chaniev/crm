# Implementation Plan: TASK-124 Выделить membership HTTP orchestration из ClientEndpoints

## Metadata
- source_task: /backlog/done/2026-08-23/TASK-124-client-membership-http-decomposition.md
- branch: refactor/TASK-124-client-membership-http-decomposition
- readiness: no — требуется human review money/idempotency/concurrency/audit boundary
- dependencies: TASK-122 и TASK-123 — обе последовательно интегрированы до начала исполнения
- risk: high — transport refactor затрагивает финансовые mutations, exact replay и mandatory rollback

## Goal
Все membership HTTP operations обслуживаются bounded endpoint module, при этом
`ClientEndpoints.cs` становится composition root не более 300 строк, а каждый
capability module — не более 900 строк.

## Decisions and contracts
- Сохранить routes purchase/renew/correct/mark-payment tombstone/refund/
  cancel-refund/comment, request DTOs, validation keys, statuses and JSON.
- Один membership HTTP orchestration owner хранит idempotency key parsing,
  normalized payload hash, reservation/replay/in-progress/cleanup lifecycle,
  transaction helpers, service-error mapping and mandatory audit sequencing.
- Exact completed replay возвращает сохранённый результат без вызова service;
  concurrency/constraint errors продолжают маппиться в bounded ProblemDetails.
- TASK-125 service internals не меняются; module зависит только от текущего
  `IClientMembershipService` и integrated neutral client read mapper.

## Scope
### In
- Membership route registration/handlers, request validation, idempotency,
  transport transactions/error mapping and membership audit serialization.

### Out
- Membership domain/service semantics, DTO/schema/frontend changes, pricing,
  target, overlap, payment or refund rule changes.

## Implementation slices
1. Зафиксировать route manifest и raw HTTP matrix всех operations, validation,
   replay/in-progress/cleanup, concurrency and audit rollback.
2. Выделить pure validation/error mapping and idempotency payload helpers.
3. Перенести handlers с единым execution pipeline, сохраняя transaction/audit order.
4. Подключить module из composition root, удалить перенесённые helpers и
   проверить final size boundaries после TASK-122–124.

## Likely files and layers
- `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs` — final composition root.
- `backend/src/GymCrm.Api/Auth/ClientMembershipEndpoints.cs` — routes/handlers.
- `backend/src/GymCrm.Api/Auth/ClientMembershipHttpExecution.cs` — idempotency/transaction pipeline.
- `backend/src/GymCrm.Api/Auth/ClientMembershipRequestValidation.cs` — current validation and error mapping.
- `backend/src/GymCrm.Api/Auth/ClientMembershipAudit.cs` — sale/refund/membership snapshots.
- `backend/tests/GymCrm.Tests/ClientMembershipWriteRegressionApiTests.cs` — PostgreSQL/idempotency/concurrency barrier.
- `backend/tests/GymCrm.Tests/ClientsApiTests.cs` — full operation/permission/refund/comment contracts.
- `backend/tests/GymCrm.Tests/ClientMembershipHttpContractTests.cs` — route/raw validation characterization.

## Regression specification
### Automated tests to add or update
- Endpoint manifest contains every current membership method/template once.
- Raw requests assert payload/validation field keys for purchase, renew,
  correction, refund, cancel, comment and removed mark-payment behavior.
- Same key/same normalized payload replays exact status/body with no second
  sale/version/audit; same key/different payload conflicts; pending and expired
  reservations preserve current semantics.
- Different-key PostgreSQL overlap race yields one success/one stable conflict
  without raw provider details; execute five consecutive iterations.
- Mandatory audit failure rolls back mutation and idempotency outcome; refund,
  cancel and comment remain addressed by exact sale/refund identity.
- Coach/invalid scope writes nothing; allowed roles retain current results.

### Expected red evidence
- Behavior red is not expected for a pure extraction: characterization and
  existing regressions must be green before editing and after every slice.
  Structural gap is proven by membership HTTP/idempotency/audit symbols still
  living in `ClientEndpoints.cs`; no artificial contract failure is required.

### Required validation
- Focused xUnit run for `ClientMembershipHttpContractTests`,
  `ClientMembershipWriteRegressionApiTests` and membership scenarios in `ClientsApiTests`.
- Repeat the concurrent-overlap focused test five times and assert final
  `ClientEndpoints.cs <= 300` and each new capability module `<= 900` lines.

### Regression barrier
- Real PostgreSQL vertical sequence: purchase with idempotency → exact replay →
  addressed correction/refund/comment → fresh GET, plus concurrent overlap and
  mandatory-audit rollback assertions over rows and audit counts.

## Risks and stop conditions
- Остановиться при изменении `IClientMembershipService`, DTO, persistence or
  business error enum: это TASK-125 или отдельный contract task.
- Остановиться, если replay body/status либо transaction/audit ordering нельзя
  доказать baseline tests до переноса.
- Не продолжать после raw `DbUpdateException`/constraint leakage или flaky concurrency evidence.
