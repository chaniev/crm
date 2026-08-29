# Backend Agent Rules

## Scope

Applies to all tasks inside `backend/` together with the root `AGENTS.md`.
Backend is the source of truth for CRM domain behavior.

---

## Main areas

- `src/GymCrm.Api/` -> HTTP, authentication, middleware, endpoint composition
- `src/GymCrm.Application/` -> use cases, authorization, contracts, orchestration
- `src/GymCrm.Domain/` -> entities, value objects, and domain rules
- `src/GymCrm.Infrastructure/` -> EF Core, persistence, files, and external services
- `tests/GymCrm.Tests/` -> domain, contract, integration, and regression tests

---

## Backend ownership

Backend owns the CRM behavior listed in the root rules plus transaction
boundaries and public/internal transport contracts. Consumers present those
decisions without reimplementing them.

### Shared contract boundaries

Treat these paths as Staff API contract boundaries whose changes require
frontend impact analysis and consumer validation:

- `src/GymCrm.Api/**/*Request.cs`
- `src/GymCrm.Api/**/*Response.cs`
- `src/GymCrm.Api/**/*Endpoints.cs`
- `src/GymCrm.Api/**/*Contracts.cs`
- `src/GymCrm.Api/**/*ProblemDetails*.cs`
- `src/GymCrm.Api/**/*ValidationProblems*.cs`
- `src/GymCrm.Application/Authorization/**/*Contracts.cs`
- `src/GymCrm.Application/Messenger/**/*Contracts.cs`
- `src/GymCrm.Application/Reports/**/*Contracts.cs`

`src/GymCrm.Application/Bot/**` and
`src/GymCrm.Api/Auth/BotInternal*` are Internal Bot API boundaries and require
bot consumer validation. When a new application-layer shared-contract location
is introduced, update this list and `scripts/harness/change_impact.py` tests in
the same task.

---

## Layer rules

- `GymCrm.Domain` must not depend on HTTP, UI, EF Core, or storage details.
- `GymCrm.Application` owns use-case contracts and orchestration without
  transport-specific behavior.
- `GymCrm.Api` handles transport, authentication, request parsing, and response
  mapping; it does not own CRM rules.
- `GymCrm.Infrastructure` implements persistence and runtime integrations
  behind explicit application/domain boundaries.
- Mutations, persistence constraints, and audit records must remain consistent
  across success, conflict, and rollback paths.

---

## Structural rules

Prefer:

- one file -> one top-level type
- small focused services and endpoint modules
- explicit typed contracts
- observable domain and authorization decisions

Avoid:

- oversized endpoint files
- nested helper types without a demonstrated locality benefit
- hidden shared state
- inline persistence or external-service logic in transport handlers

---

## Schema and migration rules

Before changing the schema, determine whether every target database is
disposable or whether any deployed/local database and its data must be retained.

- Never modify a migration that has already been applied to a retained database.
- For retained databases, create a forward incremental migration and validate
  upgrade from the current deployed schema.
- Updating the reproducible initial state is allowed only when the task or
  release plan explicitly declares a clean rebuild and data disposal is approved.
- When clean and retained deployment paths both exist, validate clean bootstrap
  and forward upgrade separately.
- Keep the EF model, migrations, and model snapshot synchronized.
- Destructive or ambiguous transformations require an explicit backup,
  rollback, and data-migration decision before implementation.

A schema change does not by itself block planning. Missing target-database or
data-retention decisions do block destructive implementation.

---

## Backend testing skill

When creating or substantially restructuring xUnit tests:

- read `.agents/skills/csharp-xunit/SKILL.md`;
- follow existing conventions in `backend/tests/GymCrm.Tests`;
- derive scenarios from CRM contracts, authorization boundaries, regression
  risks, and observable behavior;
- do not couple tests to private implementation details without a demonstrated
  need.

---

## Required validation

Use the root verification harness. Its canonical backend area must restore
locked dependencies, verify formatting, build Release with warnings as errors,
run tests, and audit direct and transitive NuGet dependencies. Command
definitions live only in `scripts/harness/commands.py`.

Do not suppress NuGet audit warnings to make validation green.

If infrastructure, migrations, or runtime configuration changed, also validate
the affected Docker/runtime path. Schema changes must include the migration
paths required by the schema policy above.

---

## Code review rules

Flag:

- authorization or access-scope checks missing from a read or mutation path
- CRM rules implemented in endpoints instead of domain/application boundaries
- mutation and audit writes that can commit independently
- persistence exceptions leaking instead of mapped contract responses
- ProblemDetails, DTO, or endpoint changes without consumer impact coverage
- edits to migrations already applied to a retained database

Prefer the smallest safe fix and point to the existing boundary that should own
the behavior. Leave formatting and analyzer enforcement to required validation.

---

## Preferred capabilities

When available, prefer:

- dotnet-backend-specialist
- refactoring-specialist
- test-automator
- docker-expert

The required backend outcomes and validation do not depend on a particular
agent topology.
