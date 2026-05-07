# TASK-006: Провести обязательную проверку Telegram MVP

## Status
ready

## Goal
Перед приемкой Telegram MVP есть воспроизводимый набор автоматических и ручных проверок.

## Context
В inbox перечислены обязательные команды проверки MVP и ручной smoke в Telegram: неизвестный и известный Telegram ID, меню по ролям, групповой чат, посещаемость, поиск, списки абонементов, отметка оплаты, повторный callback без дублей.

## User role
система

## Problem
Без отдельного validation task приемка Telegram MVP может пропустить сломанные cross-layer сценарии.

## Scope
- Запустить обязательные проверки по backend, frontend и bot.
- Провести ручной Telegram smoke по перечисленным сценариям.
- Зафиксировать найденные дефекты отдельными inbox/task notes.
- При runtime/Docker изменениях проверить `docker compose build bot`.

## Out of scope
- Исправление найденных дефектов в этой же задаче, если они требуют отдельной реализации.
- Изменение production deployment.

## Constraints
- Не считать smoke успешным, если не проверены роли и повторный callback.
- Если менялся backend contract, валидировать всех потребителей.

## Acceptance criteria
- [ ] Выполнены `cd bot && ruff check .` и `cd bot && pytest`.
- [ ] Выполнен `dotnet test backend/GymCrm.slnx`.
- [ ] Выполнены `cd frontend && npm run lint` и `cd frontend && npm run build`.
- [ ] Ручной Telegram smoke пройден или дефекты зафиксированы.

## Test checklist
- [ ] Неизвестный Telegram ID.
- [ ] Известный Telegram ID и меню по ролям.
- [ ] Групповой чат, посещаемость, поиск, списки абонементов, отметка оплаты.
- [ ] Повторный callback без дублей.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: задача про проверку и фиксацию результатов, без изменения кода.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/inbox/2026-05-04.md`
- Original note: `Запустить обязательные проверки MVP ... Провести ручной smoke в Telegram ...`

## Processing notes
- Created at: 2026-05-07 11:26
- Created by skill: codex-backlog-skill
- Duplicate check: existing task folders were empty before processing; no duplicate found.
