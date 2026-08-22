# Bot Agent Rules

## Scope

Applies to all tasks inside `bot/`.

Bot is a thin Telegram adapter over backend APIs.

---

## Main areas

- `telegram/` -> Telegram adapter
- `crm/` -> backend API client
- `core/` -> dialog flows
- `storage/` -> bot-owned state
- `tests/` -> runtime validation

---

## Bot responsibilities

Bot handles:
- Telegram events
- dialog state
- idempotency
- user interaction flow
- backend response presentation

Backend handles:
- permissions
- memberships
- attendance logic
- validation semantics
- business rules

---

## Runtime rules

- Use long polling in MVP
- Store secrets in env only
- Use service token for backend calls
- Send `X-Request-Id`
- Use `Idempotency-Key` for write operations

Retry only safe read requests.

---

## Storage rules

Bot-owned storage may contain only:
- dialog/session state
- processed Telegram updates
- adapter-specific runtime data

Bot storage is not a CRM source of truth.

---

## Required validation

Minimum:
- `uv sync --locked --extra dev`
- `uv run --locked --extra dev ruff check .`
- `uv run --locked --extra dev ruff format --check .`
- `uv run --locked --extra dev mypy`
- `uv run --locked --extra dev pytest`

Use `uv.lock` for local, CI and container dependency installation. Do not use
an unlocked `pip install` as the normal project workflow.

If runtime/docker changes:
- validate container build/runtime

## Preferred specialists

Default:
- python-pro

Additional:
- refactoring-specialist
- docker-expert
- test-automator
