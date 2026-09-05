# TASK-129: Разделить group registry и group form modules

## Status
done

## Goal
Список, создание, редактирование и форма группы имеют отдельные state/transport
boundaries при неизменном schedule payload и mobile workflow.

## Context
`frontend/src/features/groups/GroupManagement.tsx` содержит около 1450 строк:
registry, filters, row, create/edit screens, member list, form mapping и
validation находятся в одном модуле.

## User role
Администратор и главный тренер, управляющие группами в backend-разрешённом scope.

## Problem
Правка registry или form mapping затрагивает несвязанный экран и может изменить
weekday/time payload, trainer assignment или permission-restricted behavior.

## Scope
- Выполнять после TASK-126.
- Выделить group list state/filters/rows в registry module.
- Выделить create и edit route screens.
- Выделить `GroupForm`, mapping и local validation helpers.
- Сохранить member list и trainer-only/full update boundaries.
- Оставить compatibility barrel с текущими exports.
- Root/barrel не превышает 200 строк; feature modules — 500 строк.

## Out of scope
- Изменение group/schedule API, weekday model или trainer permissions.
- Redesign registry/form и новые filters/actions.
- TASK-117 weekday-specific schedule implementation.

## Constraints
- Backend владеет schedule validation и permissions.
- Request payload, field names, ordering и ProblemDetails mapping сохраняются.
- Mobile action hierarchy, focus return и form labels не меняются.
- Не добавлять global group store или generic form abstraction.
- Обязательны `refactoring-specialist`, `react-specialist` и `test-automator`.

## Acceptance criteria
- [x] Registry, create, edit и form имеют отдельные modules.
- [x] Create/update payloads полностью совпадают с baseline.
- [x] Filters, search, branch scope и member list behavior сохранены.
- [x] Loading/empty/error/pending/restricted states не изменились.
- [x] Root/barrel не превышает 200 строк; modules не превышают 500 строк.
- [x] Frontend quality baseline и affected mobile group workflows проходят.

## Test checklist
- [x] Characterization tests list filters and row actions.
- [x] Create/edit form payload and validation tests.
- [x] Allowed/forbidden role and branch scope paths.
- [x] Mobile portrait/compact-landscape form and registry checks.
- [x] Запустить lint, strict typecheck, raw-color, unit, build и affected Playwright/WebKit tests.

## AI safety
- Safe for Codex: no
- Risk level: medium
- Reason: frontend-only refactoring сохраняет contract, но форма управляет schedule и scoped trainer/group data.

## Clarification questions
Не требуется: schedule model и UX остаются текущими.

## Source notes
- Source: direct user request, 2026-08-22.
- Parent task: `/backlog/risky/TASK-121-decompose-oversized-cross-layer-files.md`.

## Processing notes
- Created at: 2026-08-22 23:47 MSK.
- Created by skill: codex-backlog-skill + react-best-practices + crm-mobile-first-ui.
- Duplicate check: TASK-117 меняет schedule contract и явно исключён; structural group module split не покрыт.

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-23
- moved_from: /backlog/risky
- implementation_plan: /backlog/done/2026-08-23/TASK-129-group-management-decomposition.plan.md
- implementation_branch: refactor/TASK-129-group-management-decomposition
- implementation_state: completed
- implementation_commits: 1866f6a, 2aed3ae
- delivered_on_main_at: 2026-08-23
- moved_to_done_at: 2026-08-23
- last_status_reviewed_at: 2026-08-23

## Completion record
- Completed on: 2026-08-23; integrated candidate: `dcac393`.
- Compatibility barrel is 6 lines; list/create/edit/form/mapper modules are within the 500-line target and preserve exact schedule/trainer payloads.
- Validation: lint/typecheck/raw-color, `512/512` unit tests, build, `21/21` affected Chromium and focused target-iPhone WebKit portrait/compact-height checks passed; the later combined frontend chain passed `40/40` iPhone WebKit.
- Residual device evidence: physical Safari/software keyboard were not executed; an unrelated full-suite client-filter timeout seen during an isolated run was absent from the final combined run.
