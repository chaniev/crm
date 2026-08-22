# TASK-127: Разделить core client screens и form components

## Status
implementation

## Goal
Create, edit и detail client screens имеют отдельные feature modules, а общий
client form, overview, photo и attendance sections владеют только своим state.

## Context
`frontend/src/features/clients/ClientManagement.tsx` содержит около 3430 строк.
В одном файле находятся три route screens, client form, transfer, profile
sections, photo, attendance и membership UI.

## User role
Тренер, администратор, главный тренер и суперадминистратор в рамках текущего scope.

## Problem
Изменение одного client screen вызывает широкий render/test контекст и
повышает вероятность нарушения pending state, return context и role restrictions.

## Scope
- Выполнять после интеграции TASK-126.
- Выделить `ClientCreateScreen`, `ClientEditScreen`, `ClientDetailScreen` в
  отдельные feature modules с прежними exports.
- Выделить `ClientForm`, overview/contact/group fields, transfer modal, photo
  и attendance history sections по ownership/state boundaries.
- Оставить compatibility barrel с публичными exports для текущих consumers.
- Не переносить membership purchase/renew/correct/refund panels: TASK-128.
- Сократить compatibility/root file до 250 строк; feature module — до 600 строк.

## Out of scope
- Membership UI refactoring.
- Изменение client API, validation, routes, visual hierarchy или operations.
- Новый shared form framework или global client store.

## Constraints
- Сохранить controlled form behavior, async stale-response protection и API errors.
- Backend остаётся владельцем scope, permissions и validation semantics.
- Primary/frequent actions и mobile layout не перемещаются.
- Split выполняется по state ownership, не только по количеству строк.
- Обязательны `refactoring-specialist`, `react-specialist` и `test-automator`.

## Acceptance criteria
- [ ] Три route screen имеют отдельные modules и прежние public exports.
- [ ] Form/photo/attendance/transfer state не поднят в новый global context.
- [ ] Loading, empty, error, disabled, pending и restricted states сохранены.
- [ ] Return-to-list/group/attendance context и focus behavior не изменились.
- [ ] Root/barrel не превышает 250 строк; feature modules не превышают 600 строк.
- [ ] Frontend quality baseline и affected mobile workflows проходят.

## Test checklist
- [ ] Characterization component tests create/edit/detail and validation errors.
- [ ] Photo upload/validation и attendance pagination regressions.
- [ ] Transfer allowed/forbidden и navigation return-context tests.
- [ ] Проверить long names и все обязательные mobile/desktop viewports.
- [ ] Запустить lint, strict typecheck, raw-color, unit, build и affected Playwright/WebKit tests.

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: frontend-only structural change is bounded and testable; client mutations and route state require regression barriers.

## Clarification questions
Не требуется: screen behavior и видимые операции не меняются.

## Source notes
- Source: direct user request, 2026-08-22.
- Parent task: `/backlog/risky/TASK-121-decompose-oversized-cross-layer-files.md`.

## Processing notes
- Created at: 2026-08-22 23:47 MSK.
- Created by skill: codex-backlog-skill + react-best-practices + crm-mobile-first-ui.
- Duplicate check: client UX tasks меняют конкретные workflows; structural screen/form split отдельно не покрыт.

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-23 01:15
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-127-client-management-core-decomposition.plan.md
- implementation_branch: refactor/TASK-127-client-management-core-decomposition
