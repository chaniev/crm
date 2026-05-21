# Implementation Plan: TASK-039 Интеграция клиентских Telegram-чатов в CRM

## Source task
/backlog/needs-clarification/TASK-039-crm-messenger-chat-integration.md

## Implementation branch
feature/TASK-039-crm-messenger-chat-integration

Branch rules:
- create this branch before writing project code;
- create it from updated `main`;
- run `git pull` and verify clean `git status` before branch creation;
- if the branch already exists, verify that it belongs only to `TASK-039`;
- do not mix staff Telegram bot changes, marketing messaging, attachments, dialog assignment or unrelated notification refactoring in this branch;
- confirm the branch is active before making backend, frontend or runtime changes.

## Goal
CRM should let an administrator link a client's Telegram account to the CRM client card, read and send text messages from that client card, show in-app indicators for new client messages, and let the head coach read the conversation without reply permissions. Backend remains the source of truth for access, storage, validation, audit and retention.

## Current understanding
- MVP messenger is Telegram only.
- MVP supports two-way text chat only.
- Chat is shown inside the client card.
- A client links Telegram through a one-time CRM-generated code or deep link.
- Administrators and head coach can read client conversations.
- Only administrators can reply from CRM.
- Coach access, branch scope, group scope and assigned-trainer scope are out of scope for MVP.
- Existing staff Telegram bot must not be reused as the client chat bot. The client integration needs a separate Telegram bot token and separate runtime settings.
- Existing backend already has `MessengerPlatform.Telegram`, audit entries can store messenger platform metadata, and client details are role-shaped in `ClientEndpoints`.
- Existing `ManageClients` policy includes both head coach and administrator, so reply permissions need a separate policy or explicit role check. Reusing `ManageClients` would incorrectly allow the head coach to reply.
- Telegram Bot API supports incoming updates through mutually exclusive `getUpdates` long polling or webhook delivery. For MVP, prefer long polling unless production deployment explicitly requires webhook, because the existing deployment is single-instance and this avoids a public webhook endpoint.
- Telegram Bot API `sendMessage` returns a sent `Message` on success. It does not provide ordinary bot-to-user delivered/read receipts through update types. For MVP, CRM should expose local statuses such as `Queued`, `Sending`, `SentToTelegram`, `Failed`, and internal CRM read/unread state. Telegram-level `delivered` and `read` must be marked unsupported unless a separate Telegram Business/Secretary Bot design is explicitly selected.
- Telegram deep links can pass a start parameter to the bot, so the preferred link flow is `https://t.me/<client_bot_username>?start=<short-token>`.

## Execution steps
1. Prepare the implementation branch from clean updated `main`: checkout `main`, pull, verify clean status, create or switch to `feature/TASK-039-crm-messenger-chat-integration`.
2. Run a short design checkpoint before code:
   - confirm long polling vs webhook for production;
   - confirm that Telegram read/delivery receipts are not part of MVP;
   - confirm whether one implementation branch is acceptable or whether this plan should be split into backend, frontend and runtime subtasks.
3. Define backend contract first:
   - conversation summary for a client;
   - message list pagination;
   - one-time Telegram link creation;
   - text message send command;
   - mark/read-on-view behavior;
   - unread indicators for the current authenticated CRM user.
4. Add backend domain/storage model:
   - `ClientMessengerAccount` for active client-to-platform binding;
   - `ClientMessengerLinkToken` for one-time link/code flow with hash, TTL and used timestamp;
   - `ClientMessengerMessage` for inbound/outbound text messages and local send status;
   - `ClientMessengerReadState` for per-CRM-user internal unread indicators;
   - uniqueness constraints for one active Telegram account per client and one active client per Telegram account.
5. Add EF configurations and migration:
   - explicit table/column names;
   - indexes for client/platform lookup, Telegram update/message id idempotency and unread queries;
   - cascade or delete behavior that removes conversation data when the client record is physically deleted;
   - no automatic deletion on archive unless product requirements change.
6. Add backend service layer:
   - validate client existence and role permissions;
   - create short one-time tokens/deep links and store only token hashes;
   - link Telegram update `/start <token>` to a CRM client;
   - ingest inbound text messages idempotently;
   - create outbound message records with idempotency keys;
   - send or enqueue outbound text through the Telegram integration;
   - update local message statuses and failure details;
   - update internal read state when a CRM user opens the conversation.
7. Add backend authorization:
   - read policy or role check: `Administrator`, `HeadCoach`;
   - reply policy or role check: `Administrator` only;
   - reject `Coach` even if the coach can view the base client card through assigned groups.
8. Add audit events:
   - link token created;
   - Telegram account linked/unlinked if unlink is added;
   - conversation viewed;
   - outbound CRM message sent;
   - inbound Telegram message received if useful for compliance;
   - include messenger platform and hashed Telegram user id where applicable.
9. Add Telegram runtime inside backend infrastructure for MVP:
   - separate `ClientTelegram` options/token/bot username/runtime enabled flag;
   - `HttpClient` integration with Bot API methods needed for `getUpdates` and `sendMessage`;
   - background polling worker with stored offset, cancellation, backoff and idempotent update handling;
   - outbound send worker or transactional outbox-style processor if send is not performed synchronously;
   - clear stop condition if backend horizontal scaling or webhook-only production constraints are discovered.
10. Keep existing staff bot isolated:
   - do not reuse `BOT_TELEGRAM_TOKEN`;
   - do not alter staff bot dialog flows;
   - do not store client chat messages in bot-owned storage;
   - update deploy/runtime config with separate client chat variables.
11. Update frontend API contracts:
   - `frontend/src/lib/api/endpoints.ts`;
   - `frontend/src/lib/api/types.ts`;
   - a focused `frontend/src/lib/api/clientMessenger.ts` or existing clients API module extension;
   - mapper tests for message statuses, unread counts and optional connection state.
12. Add client-card chat UI:
   - a `ClientMessengerChatSection` inside `ClientDetailScreen`;
   - connection state with generated Telegram link/code for administrators;
   - read-only conversation for head coach;
   - composer enabled only for administrators;
   - stable loading/error/empty states;
   - text-only message rendering;
   - local status labels for `Queued`, `Sending`, `SentToTelegram`, `Failed`;
   - unsupported Telegram delivery/read status copy kept out of the UI unless product wording is approved.
13. Add in-app indicators:
   - unread count/badge in the client chat section;
   - optional client list/client preview indicator only if backend exposes a cheap summary without broad list-query regressions;
   - polling or refresh-on-focus for MVP unless a broader realtime notification mechanism already exists.
14. Update deployment/runtime config:
   - `ClientTelegram__Enabled`;
   - `ClientTelegram__BotToken`;
   - `ClientTelegram__BotUsername`;
   - polling interval/backoff settings;
   - proxy settings only if required by the current Telegram access environment;
   - `deploy/.env.example`, `deploy/docker-compose.yml`, `deploy/docker-compose.server.yml`.
15. Run backend, frontend and runtime validation.

## Preferred implementation strategy
1. Contract-first backend implementation.
2. Add storage and audit before UI so frontend never owns CRM chat rules.
3. Add Telegram integration behind an interface and use fake Telegram transport in tests.
4. Keep runtime local and reversible: feature flag disabled by default until token/config is present.
5. Integrate frontend incrementally after backend contracts and mocks are stable.
6. Keep delivery/read wording conservative: expose only states that backend can prove.

Recommended decomposition if this is too large for one Codex execution:
1. `TASK-039A` backend storage, API contracts, authorization and audit.
2. `TASK-039B` frontend client-card chat UI and unread indicators against mocked/stable backend contracts.
3. `TASK-039C` Telegram runtime, deployment config, polling/send worker and production runbook.

## Files likely to change
- `backend/src/GymCrm.Domain/Users/MessengerPlatform.cs`
- `backend/src/GymCrm.Domain/Messenger/*`
- `backend/src/GymCrm.Application/Messenger/*`
- `backend/src/GymCrm.Infrastructure/Messenger/*`
- `backend/src/GymCrm.Infrastructure/Persistence/GymCrmDbContext.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/*`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/*`
- `backend/src/GymCrm.Application/DependencyInjection.cs`
- `backend/src/GymCrm.Api/Auth/GymCrmAuthorizationPolicies.cs`
- `backend/src/GymCrm.Api/Auth/ClientMessengerEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs` if client details need chat summary fields
- `backend/src/GymCrm.Api/appsettings.json`
- `backend/src/GymCrm.Api/appsettings.Development.json`
- `backend/tests/GymCrm.Tests/ClientsApiTests.cs`
- `backend/tests/GymCrm.Tests/AuditLogApiTests.cs`
- `backend/tests/GymCrm.Tests/ClientMessengerApiTests.cs`
- `frontend/src/lib/api/endpoints.ts`
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/clientMessenger.ts`
- `frontend/src/lib/api/clientMessenger.test.ts`
- `frontend/src/features/clients/ClientManagement.tsx`
- `frontend/src/features/clients/ClientMessengerChatSection.tsx`
- `frontend/src/features/clients/ClientMessengerChatSection.test.tsx`
- `frontend/e2e/clients-messenger-chat.spec.ts`
- `deploy/.env.example`
- `deploy/docker-compose.yml`
- `deploy/docker-compose.server.yml`

If implementation chooses a separate adapter service instead of a backend hosted worker, update this plan before code and list the new service files explicitly.

## Constraints
- Backend owns CRM access rules, validation semantics, storage, audit and retention.
- Frontend must not infer or duplicate chat permissions beyond rendering backend-provided capabilities.
- Existing staff Telegram bot must stay separate from client chat runtime and token.
- MVP supports only Telegram and only text messages.
- Do not import historical Telegram history.
- Do not add attachments, voice, video, stickers as first-class message types.
- Do not add conversation assignment, open/closed statuses, global search or filters in MVP.
- Do not add branch/group/assigned-trainer scope for chat access in MVP.
- Store messages only while the CRM client record exists.
- Do not show Telegram delivered/read status unless Telegram capability is proven by the chosen API mode.
- Secrets must come from environment/config only and must not be written to audit logs, frontend payloads or technical logs.

## Out of scope
- Marketing campaigns or automated broadcasts.
- Mixing this feature into the current employee Telegram bot.
- Telegram Business/Secretary Bot mode.
- Multi-messenger abstraction beyond data model choices that keep future platforms possible.
- Global CRM inbox.
- Full realtime websocket infrastructure unless already available and cheap to reuse.
- Production migration rollback tooling beyond normal early-stage EF migration validation.

## Required test coverage

### Unit tests
Add or update backend unit/service tests for:
- one-time token generation, hashing, TTL and single-use behavior;
- Telegram deep-link payload parsing;
- message status transitions;
- inbound text-only filtering;
- idempotency by Telegram update/message id;
- reply permission check allowing administrators and rejecting head coach/coach;
- read permission check allowing administrators/head coach and rejecting coach;
- unread count/read-state calculation.

Add or update frontend unit tests for:
- API mappers for connection state, messages, statuses and unread count;
- chat section rendering connected/unconnected/empty/error/loading states;
- composer enabled only when backend capability says the user can reply;
- failed outbound message status display;
- link/code creation state for administrators only.

### Integration tests
Add backend integration tests for:
- `POST /clients/{id}/messenger/telegram/link-token` creates a link for administrator and rejects head coach/coach if creation is admin-only;
- `GET /clients/{id}/messenger/telegram/messages` returns messages for administrator/head coach and logs conversation view;
- `POST /clients/{id}/messenger/telegram/messages` allows administrator, rejects head coach/coach and records audit;
- inbound `/start <token>` links the Telegram account once and rejects expired/reused tokens;
- inbound Telegram text creates a client message once even if the update is repeated;
- outbound send stores local failed status when fake Telegram transport returns an error;
- deleting a client physically removes or makes inaccessible its messenger records according to configured delete behavior;
- existing `GetClientAsync` coach behavior does not expose chat details.

### UI tests
Add Playwright coverage for:
- administrator opens a connected client card, sees chat history, sends a text message and sees local sent/failed status;
- administrator opens an unconnected client card and can generate a Telegram link/code;
- head coach can read messages but cannot see an enabled composer;
- coach does not see the chat section or receives a forbidden state if navigated directly;
- unread indicator clears after opening the conversation;
- narrow viewports keep chat bubbles, composer and link controls inside the client card layout without horizontal page scroll.

### Runtime tests
Add fake Telegram transport tests for:
- long polling offset progression;
- duplicate updates;
- ignored non-text updates;
- `/start <token>` linking flow;
- outbound `sendMessage` success mapping to Telegram message id;
- outbound `sendMessage` failure mapping to local failed status without leaking token or full Telegram payload.

### Minimum expectation
- Backend API tests cover permission, audit, idempotency, link flow, status transitions and persistence.
- Frontend unit/e2e tests cover role-specific UI behavior and unread indicator behavior.
- Runtime tests use fake Telegram responses; no automated test should require a real Telegram token.
- Manual QA covers real Telegram link/send only in a configured non-production environment.

## Test plan
- [ ] `dotnet test backend/GymCrm.slnx`
- [ ] `cd frontend && npm run test:unit`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:e2e -- clients-messenger-chat.spec.ts`
- [ ] `docker compose --env-file deploy/.env.example -f deploy/docker-compose.yml config` or equivalent deployment config validation after env/compose changes.
- [ ] Manual non-production smoke test with a dedicated Telegram test bot: generate link, open link as client, send client text, reply as administrator, verify head coach read-only view, verify coach cannot access chat.

## Regression barrier
Primary barrier: backend integration tests must lock role access, audit logging, one-time link semantics, idempotent inbound ingestion, local message status transitions and the absence of chat data in coach client responses.

Secondary barrier: frontend unit and Playwright tests must lock administrator/head-coach/coach UI differences, unread indicator clearing and text-only send behavior.

Runtime barrier: fake Telegram transport tests must prove polling/send behavior without real external network calls, and deployment config validation must prove the client Telegram token/settings are separate from the existing staff bot token/settings.

## Risks
- Telegram Bot API does not expose ordinary delivered/read receipts for bot-to-client messages; promising these in the UI would create a false state.
- Long polling inside the backend process is unsafe if backend is later scaled horizontally without a single-worker lock or separate adapter service.
- Telegram chat/user ids are personal data; raw ids are needed to send messages, so storage, logs and audit must be minimized.
- Retrying outbound sends can duplicate Telegram messages unless the local outbox and status transitions are carefully designed.
- One-time link tokens can be brute-forced if short, long-lived or stored raw.
- Logging every conversation view may create high audit volume; this is required by the task but may need throttling as a follow-up if audit becomes noisy.
- Reusing `ManageClients` for replies would accidentally allow head coach replies.
- Adding unread counts to broad client list queries may create performance regressions if not indexed.
- Non-text Telegram updates will arrive even though MVP is text-only; they must be ignored or answered with a safe unsupported-message response without corrupting history.

## Stop conditions
Остановиться и не писать код, если:
- product insists on Telegram delivered/read receipts for ordinary bot chats despite API limitations;
- implementation requires reusing the existing employee Telegram bot token or dialog/storage flow;
- production requires multiple backend replicas before a single-worker or webhook design is agreed;
- chat access must use branch/group/assigned-trainer scope in MVP;
- attachments, voice, video, stickers or old-history import become required;
- API contract cannot preserve backend ownership of permissions, audit and validation;
- token/secret handling would expose Telegram credentials to frontend, audit logs or general technical logs;
- the branch is not created from clean updated `main`.

## Ready for Codex execution
no, not as one uncontrolled implementation batch. This plan is ready for review and decomposition. Direct execution should start only after the owner accepts either:
- the phased single-branch implementation in `feature/TASK-039-crm-messenger-chat-integration`; or
- the recommended split into backend, frontend and Telegram runtime subtasks with separate branches.
