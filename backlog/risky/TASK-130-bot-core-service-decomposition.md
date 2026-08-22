# TASK-130: Декомпозировать Python BotService по сценариям

## Status
risky

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
- [ ] `BotService` не превышает 200 строк и только dispatch/delegates.
- [ ] Attendance, client и membership scenarios имеют отдельные typed boundaries.
- [ ] Callback payloads и visible Telegram responses сохранены.
- [ ] State recovery/cleanup, request ids и idempotency behavior не изменились.
- [ ] Не создана конкурирующая MAX/core abstraction.
- [ ] Ruff, strict mypy и полный pytest suite проходят.

## Test checklist
- [ ] Characterization tests command/text/callback dispatch.
- [ ] Attendance date/group/toggle/save and failure recovery tests.
- [ ] Client search pagination/card/membership rendering tests.
- [ ] State cleanup, CRM errors, request-id/idempotency regressions.
- [ ] Запустить locked uv sync, Ruff lint/format, mypy и pytest.

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
