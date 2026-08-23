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

Backend owns:

- permissions and access scope
- membership and attendance state transitions
- audit and validation semantics
- persistence consistency and transaction boundaries
- public Staff API and internal Bot API contracts
- ProblemDetails and field-error contracts

Consumers may present backend decisions but must not reimplement them.

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

Run from the repository root.

Minimum:

- `dotnet format backend/GymCrm.slnx --no-restore --verify-no-changes`
- `dotnet build backend/GymCrm.slnx --configuration Release --no-restore -warnaserror`
- `dotnet test backend/GymCrm.slnx --configuration Release --no-build`
- `dotnet list backend/GymCrm.slnx package --vulnerable --include-transitive`

Run `dotnet restore backend/GymCrm.slnx` before these checks when dependencies
are unavailable or project/package references changed. Do not suppress NuGet
audit warnings to make validation green.

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

## Preferred specialists

Default:

- dotnet-backend-specialist

Additional:

- refactoring-specialist
- test-automator
- docker-expert
