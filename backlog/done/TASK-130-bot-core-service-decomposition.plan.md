# Implementation Plan: TASK-130 Декомпозировать Python BotService по сценариям

## Metadata
- source_task: /backlog/done/TASK-130-bot-core-service-decomposition.md
- branch: refactor/TASK-130-bot-core-service-decomposition
- readiness: no — требуется human review attendance state/idempotency callback characterization
- dependencies: none; TASK-010 and TASK-014 remain explicitly out of scope
- risk: medium — Telegram callback dispatch, attendance writes and dialog cleanup can regress during extraction

## Goal
`BotService` становится event-dispatch/dependency-composition facade не более
200 строк, а attendance and client/card/membership scenarios плюс dialog state
имеют typed modules не более 300 строк без изменения Telegram behavior.

## Decisions and contracts
- Preserve `BotService` constructor and `handle_event` entry point used by the
  adapter; command/text/callback classification remains single dispatch owner.
- Attendance flow owns date/group/toggle/save sequence and its rendering;
  client flow owns search/pagination/card/membership sequence and rendering.
- Typed dialog-state boundary wraps current persistence/session behavior and
  cleanup; models, keys, schema and processed-update semantics do not change.
- Preserve callback data, visible response text/keyboards, `X-Request-Id`,
  mutation idempotency keys and safe-read-only retry policy exactly.
- Shared CRM error presentation may be extracted only when both scenarios use
  the same existing mapping; no channel UI framework, DI framework or MAX abstraction.

## Scope
### In
- Bot event facade, attendance flow, client lookup/card/membership flow,
  dialog state access/cleanup and owning render helpers.

### Out
- Backend BotApiService, Telegram/MAX abstraction, callback/API/storage/runtime changes and CRM rule duplication.

## Implementation slices
1. Expand event-sequence characterization for dispatch, callbacks, state,
   exact responses, request ids and idempotency.
2. Introduce typed dialog-state access boundary over current storage behavior.
3. Extract attendance flow as one scenario service with atomic save/recovery/cleanup.
4. Extract client search/card/membership flow, leave facade dispatch/composition only and split tests by owner.

## Likely files and layers
- `bot/src/gym_crm_bot/core/service.py` — final facade and `BotResponse` compatibility.
- `bot/src/gym_crm_bot/core/dialog_state.py` — typed existing-state boundary.
- `bot/src/gym_crm_bot/core/attendance_flow.py` — attendance callback flow/rendering.
- `bot/src/gym_crm_bot/core/client_flow.py` — search/card/membership flow/rendering.
- `bot/tests/test_bot_service.py` — facade dispatch/compatibility tests.
- New `bot/tests/test_attendance_flow.py`, `test_client_flow.py`, `test_dialog_state.py` as ownership warrants.
- Existing `test_callbacks_and_menu.py`, `test_crm_client.py`, `test_storage.py` — contract barriers.

## Regression specification
### Automated tests to add or update
- Table-driven command/text/callback dispatch asserts exact target scenario,
  response/keyboard and unknown/expired callback recovery.
- Attendance event sequence date → group → toggle → save covers backend error,
  retry, duplicate update/idempotency, state cleanup and exact request id.
- Client search sequence covers query, pages/bounds, card and membership list,
  CRM errors and state cleanup without local business calculations.
- Dialog state tests cover get/upsert/clear and isolation by chat/user with the
  current database model; no cleanup occurs early on failed writes.
- Existing CRM client tests continue proving safe-read retry only and exact write headers.

### Expected red evidence
- Baseline behavior tests should be green and remain green; an artificial
  behavior red is inappropriate. Structural evidence is the current 751-line
  `BotService` with all scenario/state/render symbols and no scenario modules.

### Required validation
- Focused pytest run for bot service, new flow/state tests, callbacks/menu,
  CRM client and storage contracts.
- Verify facade `<= 200` and each scenario module `<= 300` lines.

### Regression barrier
- Two automated event transcripts through real `BotService`: complete
  attendance save with retry/idempotency and paged client search → card →
  memberships, asserting exact callbacks, responses, persisted state cleanup
  and CRM request headers.

## Risks and stop conditions
- Остановиться при callback payload, storage schema, public constructor or
  visible Telegram response change; these are contract changes outside task.
- Остановиться, если extraction requires channel abstraction or overlaps
  unresolved TASK-010/TASK-014 decisions.
- Do not move permissions, membership or attendance rules from backend responses into bot services.
