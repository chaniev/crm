# Bot Agent Rules

## Scope

Applies to all tasks inside `bot/` together with the root `AGENTS.md`.
Bot is a thin Telegram adapter over backend APIs.

---

## Main areas

- `src/gym_crm_bot/telegram/` -> Telegram adapters and middleware
- `src/gym_crm_bot/crm/` -> typed backend Bot API client and error mapping
- `src/gym_crm_bot/core/` -> dialog flows, rendering, and idempotency orchestration
- `src/gym_crm_bot/storage/` -> bot-owned session/runtime persistence
- `src/gym_crm_bot/resources/` -> messages, callbacks, and keyboards
- `tests/` -> unit, integration-boundary, and runtime regression tests

---

## Responsibility boundary

Bot handles:

- Telegram events and presentation
- dialog/session state
- adapter-level idempotency orchestration
- user interaction flow
- backend response and error presentation

Backend handles permissions, memberships, attendance, validation, access scope,
and all other CRM business rules. Bot must not infer or persist independent CRM
truth.

---

## Runtime and request rules

- Use long polling while it remains the supported MVP mode.
- Load secrets from runtime environment only; never commit, log, or include
  tokens, proxy secrets, or MTProto session material in diagnostics.
- Use the configured service token only through the backend API client boundary.
- Send `X-Request-Id` on every backend request.
- Send `Idempotency-Key` for write operations.
- Retry only safe reads and only for transient failures covered by the client policy.
- Never automatically retry a mutation. A deliberate repeat of the same action
  must preserve the same idempotency identity only when action and payload match.

---

## Storage rules

Bot-owned storage may contain only:

- dialog/session state
- processed Telegram updates
- adapter-specific idempotency/runtime data

Bot storage is not a CRM source of truth. Schema/runtime policy changes must
define the migration owner and validate both clean initialization and any
retained bot-storage upgrade path before production use.

---

## Required validation

Run from the repository root.

Minimum:

- `cd bot && uv sync --locked --extra dev`
- `cd bot && uv run --locked --extra dev ruff check .`
- `cd bot && uv run --locked --extra dev ruff format --check .`
- `cd bot && uv run --locked --extra dev mypy`
- `cd bot && uv run --locked --extra dev pytest`

Use `bot/uv.lock` for local, CI, and container dependency installation. Do not
use an unlocked `pip install` as the normal project workflow.

If runtime, storage, or Docker behavior changes, validate the affected
container/startup path and one representative failure path.

---

## Code review rules

Flag:

- CRM permissions or business rules reimplemented in Python
- mutations retried automatically or sent without idempotency identity
- backend requests missing request correlation
- CRM entity state persisted as bot-owned truth
- backend ProblemDetails flattened into misleading user messages
- logs or fixtures exposing tokens, proxy secrets, session material, or user PII

Prefer fixes at the adapter/client boundary and behavior assertions over private
implementation coupling.

---

## Preferred specialists

Default:

- python-pro

Additional:

- refactoring-specialist
- docker-expert
- test-automator
