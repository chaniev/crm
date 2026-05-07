# Implementation Plan: TASK-033 Обновить bot-consumer после внедрения филиалов

## Source task
/backlog/risky/TASK-033-branches-bot-contract-consumer.md

## Goal
Telegram bot remains a thin consumer of backend APIs after branches/halls are introduced, without storing branch state or duplicating branch, group, access or membership rules.

## Current understanding
Bot Python client DTOs live in `bot/src/gym_crm_bot/crm/models.py`, HTTP calls in `bot/src/gym_crm_bot/crm/client.py`, dialog/service logic in `bot/src/gym_crm_bot/core/service.py`, and message rendering in `bot/src/gym_crm_bot/resources`. Backend internal bot contracts live in `backend/src/GymCrm.Application/Bot/BotApiContracts.cs` and are implemented by `backend/src/GymCrm.Infrastructure/Bot/BotApiService.cs`.

Current bot flows ask backend for attendance groups, rosters, client search/cards and membership lists. Coach visibility is already backend-driven through assigned groups. TASK-033 should start only after TASK-031 backend branch-aware contracts are stable.

## Execution steps
1. Wait for TASK-031 backend contract changes and compare internal bot payloads for attendance groups, rosters, client search/cards and membership lists.
2. Update Pydantic DTOs in `crm/models.py` to accept optional branch/hall fields on groups and client group summaries, using aliases compatible with backend JSON.
3. Update bot API client only if endpoint paths, query params or payloads changed. Preserve `X-Request-Id` and `Idempotency-Key` behavior for writes.
4. Update message/keyboards rendering to include branch/hall in group labels only where it helps disambiguate groups, especially attendance group selection.
5. Ensure bot service never filters by branch locally except passive display/search text from backend data.
6. Update tests to prove bot displays only groups/clients returned by backend fixtures and does not add cross-branch validation.
7. Run ruff and pytest.

## Preferred implementation strategy
1. Contract diff from TASK-031.
2. DTO compatibility update with optional fields.
3. Minimal display update for branch/hall labels.
4. Focused tests around parsing and flow rendering.
5. No bot storage changes unless backend contract requires dialog-only transient state.

## Files likely to change
- bot/src/gym_crm_bot/crm/models.py
- bot/src/gym_crm_bot/crm/client.py
- bot/src/gym_crm_bot/core/service.py
- bot/src/gym_crm_bot/resources/messages.py
- bot/src/gym_crm_bot/resources/keyboards.py
- bot/tests/test_crm_client.py
- bot/tests/test_bot_service.py
- bot/tests/test_callbacks_and_menu.py
- backend/src/GymCrm.Application/Bot/BotApiContracts.cs
- backend/src/GymCrm.Infrastructure/Bot/BotApiService.cs
- backend/tests/GymCrm.Tests/InternalBotApiTests.cs

## Constraints
- Bot is a thin Telegram adapter over backend APIs.
- Bot storage may contain only dialog/session state, processed Telegram updates and adapter runtime data.
- Backend handles permissions, memberships, attendance logic and validation semantics.
- Bot must not implement cross-branch validation locally.
- Preserve request id and idempotency behavior for write operations.
- Retry only safe read requests.

## Out of scope
- Backend branch/hall domain rules.
- Frontend settings/forms.
- Managing branches/halls from Telegram bot.
- Financial reports by branch.
- Bot-owned CRM read model.

## Required test coverage

### Unit tests
Update Python model tests/client tests:
1. attendance group payload parses optional `branch`/`branchName`, `hall`/`hallName`;
2. client card/search payload parses branch-aware group summaries;
3. missing branch/hall fields remain backward-compatible if backend omits them in some flows.

### Integration tests
Update backend `InternalBotApiTests.cs` if internal bot contracts change:
1. coach receives only backend-visible groups/clients;
2. group labels/contracts include branch/hall only as data, not access logic;
3. attendance roster remains branch-aware through backend group membership.

### UI tests
No browser UI tests. Bot flow tests should cover rendered messages/keyboards:
1. group selection can show branch/hall to disambiguate;
2. no branch management commands appear;
3. client outside backend-visible scope is not shown because backend did not return it.

## Test plan
- [ ] Запустить `cd bot && ruff check .`.
- [ ] Запустить `cd bot && pytest`.
- [ ] Запустить `dotnet test backend/GymCrm.slnx` if backend internal bot contracts are touched.
- [ ] Вручную пройти сценарий выбора группы и отметки посещаемости тренером на branch-aware payload fixtures.
- [ ] Проверить, что bot не показывает клиентов вне backend-visible scope.

## Regression barrier
Regression barrier is a combination of backend internal bot tests for access scope and Python bot tests for DTO parsing/rendering. The bot must only render backend-provided branch/hall data; any illegal branch/group action must be rejected by backend, not pre-decided by bot.

## Risks
- If backend branch fields are required but bot models are not updated, Pydantic parsing can fail in runtime flows.
- Adding local branch filters in bot would violate the adapter boundary.
- Branch/hall labels can make Telegram keyboards too wide; rendering may need concise formatting.
- Backend internal bot contracts may change together with public API contracts, so this task should not start before TASK-031 stabilizes.

## Stop conditions
Остановиться и не писать код, если:
- TASK-031 backend internal bot contracts are unavailable or unstable;
- implementation requires bot-owned branch storage beyond transient dialog state;
- bot must decide cross-branch validity locally;
- endpoint auth/idempotency semantics change beyond existing bot adapter patterns;
- group disambiguation text cannot fit Telegram UI without a product wording decision.

## Ready for Codex execution
no, blocked until TASK-031 backend contract is implemented/reviewed
