# TASK-129: Разделить group registry и group form modules

## Status
risky

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
- [ ] Registry, create, edit и form имеют отдельные modules.
- [ ] Create/update payloads полностью совпадают с baseline.
- [ ] Filters, search, branch scope и member list behavior сохранены.
- [ ] Loading/empty/error/pending/restricted states не изменились.
- [ ] Root/barrel не превышает 200 строк; modules не превышают 500 строк.
- [ ] Frontend quality baseline и affected mobile group workflows проходят.

## Test checklist
- [ ] Characterization tests list filters and row actions.
- [ ] Create/edit form payload and validation tests.
- [ ] Allowed/forbidden role and branch scope paths.
- [ ] Mobile portrait/compact-landscape form and registry checks.
- [ ] Запустить lint, strict typecheck, raw-color, unit, build и affected Playwright/WebKit tests.

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
