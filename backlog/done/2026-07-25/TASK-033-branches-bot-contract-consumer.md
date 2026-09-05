# TASK-033: Обновить bot-consumer после внедрения филиалов

## Status
done

## Implementation lifecycle
- closed_by_status_audit_at: 2026-07-25
- implementation_evidence: branch-aware backend internal-bot scope and current thin Python consumer tests, including TASK-080/TASK-082 cross-branch coverage

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
- [x] Bot API client совместим с backend contracts после внедрения филиалов.
- [x] Bot не дублирует branch/group validation.
- [x] Bot показывает тренеру только группы и клиентов, возвращенные backend.
- [x] Attendance flows продолжают работать с branch-aware groups.
- [x] Отображение филиала/зала не потребовалось: internal bot contract возвращает уже отфильтрованные и однозначные группы.
- [x] Обновлены affected bot tests.

## Test checklist
- [x] Запустить `cd bot && ruff check .`.
- [x] Запустить `cd bot && pytest`.
- [x] Проверить сценарий выбора группы и отметки посещаемости тренером.
- [x] Проверить, что bot не показывает клиентов вне backend-visible scope.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача зависит от backend contract changes и trainer access scope.

## Clarification questions
Не требуется.

## Source notes
- Derived from: `backlog/done/2026-05-07/TASK-022-branches-product-model.md`
- Depends on: `backlog/done/2026-05-09/TASK-031-branches-backend-domain-contracts.md`

## Processing notes
- Created at: 2026-05-07 20:05
- Created after TASK-022 clarification was completed.
- Dependency update at 2026-05-12: TASK-031 moved to done, so backend branch-aware contracts are available for comparison; this task remains risky because Python bot DTOs/tests still do not consume branch/hall fields.
- Closed at: 2026-07-25 by backlog status audit.
- Evidence: backend `BotApiService` resolves effective branch/group scope and returns only authorized clients/groups; Python code contains no branch permission calculation; TASK-080/TASK-082 expanded backend, Python and internal-bot tests for Administrator grants, Coach assignments and SuperAdministrator multi-branch attendance.
