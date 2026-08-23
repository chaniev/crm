# Implementation Plan: TASK-123 Выделить client lifecycle endpoints и validation

## Metadata
- source_task: /backlog/done/TASK-123-client-lifecycle-endpoints-decomposition.md
- branch: refactor/TASK-123-client-lifecycle-endpoints-decomposition
- readiness: no — требуется human review атомарности period/audit boundaries
- dependencies: TASK-122 — должна быть интегрирована до начала исполнения
- risk: high — create/update/transfer/archive/restore затрагивают PII, scope, periods и mandatory audit

## Goal
Client lifecycle routes имеют отдельную transport/validation boundary, а их
observable HTTP, persistence periods и audit state совпадают с baseline.

## Decisions and contracts
- Сохранить routes create/update/transfer/archive/restore, request JSON,
  normalization, validation keys, status codes и current ProblemDetails.
- Request reading/normalization и lifecycle validation выделяются как internal
  collaborators без переноса backend scope rules в DTO.
- Contact, group и branch assignment period updates остаются в одной
  transaction с target lifecycle mutation; audit failure сохраняет current
  rollback semantics и exact event category/entity/old-new payload.
- Использовать нейтральный read mapper из integrated TASK-122, не возвращать
  query logic в lifecycle module и не создавать второй response contract.

## Scope
### In
- Registration/handlers create, update, transfer, archive and restore.
- Upsert JSON reader, normalization, validation, assignment-period orchestration and lifecycle audit mapping.

### Out
- Read queries, membership actions/service, new client fields/rules, schema or permission changes.

## Implementation slices
1. Расширить lifecycle characterization: raw invalid JSON/validation,
   role/branch matrix, period snapshots, audit and rollback.
2. Выделить request reader/normalizer/validator с прежними field keys и no-write failures.
3. Выделить create/update handlers вместе с contact/group period ownership.
4. Выделить transfer/archive/restore с branch periods и audit; подключить из
   composition root и удалить lifecycle helpers из catch-all file.

## Likely files and layers
- `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs` — composition after TASK-122.
- `backend/src/GymCrm.Api/Auth/ClientLifecycleEndpoints.cs` — route handlers.
- `backend/src/GymCrm.Api/Auth/ClientLifecycleRequestReader.cs` — JSON reading/normalization.
- `backend/src/GymCrm.Api/Auth/ClientLifecycleValidation.cs` — current validation semantics.
- `backend/src/GymCrm.Api/Auth/ClientLifecyclePersistence.cs` — assignment periods only if handler extraction needs a focused collaborator.
- `backend/src/GymCrm.Api/Auth/ClientLifecycleAudit.cs` — exact lifecycle audit snapshots.
- `backend/tests/GymCrm.Tests/ClientsApiTests.cs` and a focused `ClientLifecycleEndpointContractTests.cs`.

## Regression specification
### Automated tests to add or update
- Create/update round-trip covers omitted/null fields, contacts/groups and exact reload.
- Raw malformed JSON, missing/invalid fields, contact limit and invalid group/
  branch return identical ProblemDetails and write neither data nor audit.
- Transfer closes/opens branch and group assignment periods exactly once;
  invalid target and audit failure roll back the full graph.
- Archive/restore is idempotent according to current behavior and preserves
  memberships, contacts, periods and response mapping.
- Role matrix covers allowed managers plus Coach/branch forbidden paths; audit
  asserts actor, entity id, category and exact old/new state shape.

### Expected red evidence
- Observable tests are expected green before refactoring and must remain green;
  behavior red is inapplicable to a contract-preserving extraction. Structural
  evidence is the lifecycle handlers/helpers still present in the post-TASK-122
  composition file. Do not invent a behavior failure.

### Required validation
- Focused xUnit run for `ClientLifecycleEndpointContractTests` plus existing
  `Manager_roles_can_manage_client_lifecycle`, birth-date, transfer, audit and permission scenarios.

### Regression barrier
- A relational create → update contacts/groups → transfer → archive → restore
  sequence with reload after each step, exact assignment periods/audit and a
  forbidden cross-branch negative path.

## Risks and stop conditions
- Остановиться, если integrated TASK-122 surface отличается от plan dependency.
- Остановиться при необходимости изменить validation keys, period dates,
  transaction ownership или audit payload; это contract change вне задачи.
- Не выделять generic repository/unit-of-work только ради уменьшения файла.
