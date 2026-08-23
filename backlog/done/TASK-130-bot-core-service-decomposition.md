# TASK-130: Декомпозировать Python BotService по сценариям

## Status
done

## Goal
`BotService` остаётся тонким event-dispatch facade, а attendance, client search,
client card/membership presentation и dialog state имеют отдельные typed services.

## Context
`bot/src/gym_crm_bot/core/service.py` содержит около 750 строк. Один класс
обрабатывает commands/callbacks, attendance draft/save, client search,
membership rendering, CRM errors и bot-owned state.

## User role
Тренер и другие Telegram-пользователи в рамках backend-разрешённых сценариев.

## Problem
Изменение одного callback flow требует повторно проверять все сценарии и может
сломать state cleanup, idempotency или presentation другого сценария.

## Scope
- До переноса зафиксировать callback/state/response characterization tests.
- Оставить `BotService` facade для event dispatch и dependency composition.
- Выделить attendance flow, client lookup/card flow и membership presentation.
- Выделить typed dialog state access/cleanup boundary без нового storage model.
- Вынести rendering только вместе с owning scenario, не создавать generic UI framework.
- Сократить facade до 200 строк; scenario module — до 300 строк.

## Out of scope
- Backend `BotApiService` architecture — остаётся в TASK-010.
- Generic Telegram/MAX abstraction и будущий MAX adapter — TASK-014.
- Изменение callback payloads, CRM API, storage schema или long-polling runtime.

## Constraints
- Bot остаётся thin adapter; CRM rules не переносятся из backend.
- Сохранить callback data, `X-Request-Id`, write idempotency и safe-read retry policy.
- Attendance draft/save и state cleanup остаются атомарно наблюдаемыми для пользователя.
- Не добавлять dependency injection framework или channel abstraction.
- Обязательны `refactoring-specialist`, `python-pro` и `test-automator`.

## Acceptance criteria
- [x] `BotService` не превышает 200 строк и только dispatch/delegates.
- [x] Attendance, client и membership scenarios имеют отдельные typed boundaries.
- [x] Callback payloads и visible Telegram responses сохранены.
- [x] State recovery/cleanup, request ids и idempotency behavior не изменились.
- [x] Не создана конкурирующая MAX/core abstraction.
- [x] Ruff, strict mypy и полный pytest suite проходят.

## Test checklist
- [x] Characterization tests command/text/callback dispatch.
- [x] Attendance date/group/toggle/save and failure recovery tests.
- [x] Client search pagination/card/membership rendering tests.
- [x] State cleanup, CRM errors, request-id/idempotency regressions.
- [x] Запустить locked uv sync, Ruff lint/format, mypy и pytest.

## AI safety
- Safe for Codex: no
- Risk level: medium
- Reason: bot refactoring затрагивает attendance writes, dialog state и idempotency, хотя backend business rules не меняются.

## Clarification questions
Не требуется: задача намеренно сохраняет Telegram-only runtime и исключает будущие channel abstractions.

## Source notes
- Source: direct user request, 2026-08-22.
- Parent task: `/backlog/risky/TASK-121-decompose-oversized-cross-layer-files.md`.
- Related clarification: `/backlog/needs-clarification/TASK-014-bot-adapter-core-abstractions.md` (out of scope).

## Processing notes
- Created at: 2026-08-22 23:47 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: TASK-014 зависит от будущего MAX; TASK-130 ограничен текущими Telegram scenarios и не создаёт channel abstraction.

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-23
- moved_from: /backlog/risky
- implementation_plan: /backlog/done/TASK-130-bot-core-service-decomposition.plan.md
- implementation_branch: refactor/TASK-130-bot-core-service-decomposition
- implementation_state: completed
- implementation_commits: ffc88c6, e262a09
- delivered_on_main_at: 2026-08-23
- moved_to_done_at: 2026-08-23
- last_status_reviewed_at: 2026-08-23

## Completion record
- Completed on: 2026-08-23; integrated candidate: `c994307`, local-main merge `a09096c`.
- `BotService` is 166 lines; attendance/client/dialog/error/rendering boundaries are separate and no MAX/channel abstraction was introduced.
- Validation: locked `uv sync`, Ruff lint/format, strict mypy and full `59/59` pytest passed, including failure/retry/idempotency/request-id/state-cleanup transcripts.
- Runtime/data: bot callback/storage/public constructor contracts were unchanged; deployment and Docker Compose task stack were not requested.
