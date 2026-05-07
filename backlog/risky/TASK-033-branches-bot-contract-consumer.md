# TASK-033: Обновить bot-consumer после внедрения филиалов

## Status
risky

## Goal
Telegram bot остается тонким consumer backend API после появления филиалов и залов и не дублирует правила доступа, филиалов, групп или абонементов.

## Context
Задача создана после завершения уточнений в `TASK-022` и зависит от backend-контрактов из `TASK-031`.

Bot должен продолжать работать с клиентами, группами и посещаемостью через backend API. Если backend responses добавят филиалы, залы или изменят contracts по группам/клиентам, bot client и сценарии должны быть обновлены.

## User role
тренер / администратор

## Problem
Филиалы меняют backend contracts и access scope. Bot не должен самостоятельно вычислять, какие клиенты или группы доступны тренеру; он должен отображать только то, что вернул backend.

## Scope
- Проверить bot API client DTOs после изменений `TASK-031`.
- Обновить bot read/write requests, если backend contract клиентов, групп или посещаемости изменился.
- Убедиться, что bot не хранит филиалы или залы как CRM source of truth.
- Убедиться, что bot не реализует cross-branch validation локально.
- Проверить, что тренер видит в bot только backend-разрешенные группы и клиентов.
- При необходимости добавить филиал/зал в отображение группы, если это помогает различать группы в сценариях посещаемости.
- Обновить bot tests на изменившиеся contracts и access scope.

## Out of scope
- Backend domain rules.
- Frontend настройки филиалов и залов.
- Самостоятельное управление филиалами/залами из Telegram bot.
- Финансовые отчеты по филиалам.

## Constraints
- Bot является тонким Telegram adapter over backend APIs.
- Backend handles permissions, memberships, attendance logic and validation semantics.
- Bot storage may contain only dialog/session state, processed Telegram updates and adapter runtime data.
- Send `X-Request-Id` and `Idempotency-Key` for write operations where existing patterns require it.

## Acceptance criteria
- [ ] Bot API client совместим с backend contracts после внедрения филиалов.
- [ ] Bot не дублирует branch/group validation.
- [ ] Bot показывает тренеру только группы и клиентов, возвращенные backend.
- [ ] Attendance flows продолжают работать с branch-aware groups.
- [ ] При необходимости в списках групп отображается филиал/зал без изменения backend rules.
- [ ] Обновлены affected bot tests.

## Test checklist
- [ ] Запустить `cd bot && ruff check .`.
- [ ] Запустить `cd bot && pytest`.
- [ ] Проверить сценарий выбора группы и отметки посещаемости тренером.
- [ ] Проверить, что bot не показывает клиентов вне backend-visible scope.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача зависит от backend contract changes и trainer access scope.

## Clarification questions
Не требуется.

## Source notes
- Derived from: `backlog/done/TASK-022-branches-product-model.md`
- Depends on: `backlog/risky/TASK-031-branches-backend-domain-contracts.md`

## Processing notes
- Created at: 2026-05-07 20:05
- Created after TASK-022 clarification was completed.
