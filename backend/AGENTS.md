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

- Do not modify migrations unless schema changes
- Contract changes require test updates
- Persistence changes require integration validation

---

## Required validation

Minimum:
- `dotnet test backend/GymCrm.slnx`

If infrastructure/runtime changes:
- validate docker/runtime behavior

## Preferred specialists

Default:
- csharp-developer
- dotnet-core-expert

Additional:
- refactoring-specialist
- test-automator
- docker-expert