# Backend Agent Rules

## Scope

Applies to all tasks inside `backend/`.

Backend is the source of truth for CRM domain behavior.

---

## Main areas

- `Api/` -> HTTP, auth, middleware
- `Application/` -> use cases and contracts
- `Domain/` -> entities and domain rules
- `Infrastructure/` -> EF Core, persistence, external services
- `tests/` -> integration and regression tests

---

## Backend owns

- permissions
- membership state
- attendance rules
- audit semantics
- validation semantics
- persistence consistency
- API contracts

---

## Layer rules

- `Domain` must not depend on HTTP/UI
- `Api` handles transport/auth boundaries only
- `Infrastructure` handles persistence/runtime integrations
- Do not leak EF/storage concerns into domain logic

---

## Structural rules

Prefer:
- one file -> one top-level type
- small focused services
- explicit contracts
- typed DTOs

Avoid:
- large endpoint files
- nested helper types
- hidden shared state
- inline infrastructure logic

---

## Migration rules

During the current pre-production stage, deployments are recreated from
scratch. For schema changes, update the reproducible initial database state
and model snapshot. Do not create a new incremental migration unless the user
explicitly requests compatibility with an existing deployed database.

A schema change does not by itself block planning or implementation.

---

## Required validation

Minimum:
- `dotnet format backend/GymCrm.slnx --no-restore --verify-no-changes`
- `dotnet build backend/GymCrm.slnx --no-restore -warnaserror`
- `dotnet test backend/GymCrm.slnx --no-build`
- `dotnet list backend/GymCrm.slnx package --vulnerable --include-transitive`

Run `dotnet restore backend/GymCrm.slnx` before the checks when dependencies
have not been restored or project/package references changed. Do not suppress
NuGet audit warnings to make the build green.

If infrastructure/runtime changes:
- validate docker/runtime behavior

## Backend testing skill

When creating or substantially restructuring xUnit tests:
- read `.agents/skills/csharp-xunit/SKILL.md`;
- follow existing conventions in `backend/tests/GymCrm.Tests`;
- derive scenarios from CRM contracts, authorization boundaries, regression
  risks, and observable behavior;
- do not couple tests to private implementation details without a demonstrated
  need.

## Preferred specialists

Default:
- dotnet-backend-specialist

Additional:
- refactoring-specialist
- test-automator
- docker-expert
