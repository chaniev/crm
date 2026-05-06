# Repository Agent Rules

## Routing

- Tasks in `backend/` -> read `backend/AGENTS.md`
- Tasks in `frontend/` -> read `frontend/AGENTS.md`
- Tasks in `bot/` -> read `bot/AGENTS.md`

Root file defines repository-wide architecture and coordination rules only.

---

## Source of truth priority

1. User request
2. Nearest `AGENTS.md`
3. Source code, types, tests, configs
4. Runtime/build configs
5. `docs/*` as additional context only

---

## Architecture invariants

Backend owns CRM business logic:
- roles
- permissions
- access scope
- memberships
- attendance
- audit semantics
- validation semantics
- ProblemDetails contracts

Frontend and bot must not duplicate domain rules.

---

## Cross-layer rules

If backend contract changes:
- update all consumers
- validate both sides

If runtime/infrastructure changes:
- validate affected services

If UX changes significantly:
- involve `ui-designer`

If workflow or usability is unclear:
- involve `ux-researcher`

If refactoring changes structure broadly:
- involve `refactoring-specialist`

---

## Backlog capture

`backlog/` stores improvement intake and follow-up work:
- `backlog/inbox/` - входящие запросы
- `backlog/tasks/` - задачи на доработку
- `backlog/done/` - реализованные задачи на доработку

When the user writes `зафиксируй`, create `backlog/inbox/YYYY-MM-DD.md` for the current date if it does not exist, then append everything written after the first `зафиксируй` into that file. Treat the typo `зафикчируй` as the same trigger if the user writes it.

---

## Required validation

Backend changes:
- run backend tests

Frontend changes:
- run lint + build

Bot changes:
- run ruff + pytest

Contract/runtime changes:
- validate all affected layers

---

## Forbidden patterns

- Duplicating CRM rules outside backend
- Mixing transport and domain logic
- Hidden cross-layer coupling
- Large unstructured files
- Bypassing validation/audit semantics
- Adding unrelated refactoring to feature tasks
