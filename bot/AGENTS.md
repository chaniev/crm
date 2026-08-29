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

Bot owns Telegram presentation, dialog/session state, interaction flow, and
adapter-level idempotency orchestration. It presents backend responses and
errors but never infers or persists independent CRM truth.

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

Use the root verification harness. Its canonical bot area must use
`bot/uv.lock` for locked dependency sync, then run lint, format, typing, and
tests. Command definitions live only in `scripts/harness/commands.py`. Do not
use an unlocked dependency installation as the normal project workflow.

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

## Preferred capabilities

When available, prefer:

- python-pro
- refactoring-specialist
- docker-expert
- test-automator

The required bot outcomes and validation do not depend on a particular agent
topology.
