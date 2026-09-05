# TASK-123: Выделить client lifecycle endpoints и validation

## Status
done

## Goal
Создание, редактирование, перевод между филиалами и archive/restore клиента
имеют отдельную transport boundary с явными validation и audit dependencies.

## Context
Lifecycle handlers и их helpers находятся внутри 3950-строчного
`ClientEndpoints.cs` вместе с query и membership кодом. Slice выполняется после
интеграции TASK-122 на новой ветке от актуального `origin/main`.

## User role
Администратор, главный тренер и суперадминистратор с backend-разрешённым scope.

## Problem
Upsert, transfer, group/contact assignment periods и audit serialization трудно
изменять изолированно; границы транзакции и validation рассеяны по большому типу.

## Scope
- Зафиксировать characterization tests create/update/transfer/archive/restore.
- Выделить lifecycle endpoint registration и handlers.
- Выделить request reading/normalization и lifecycle validation без изменения
  validation semantics.
- Сохранить contact, group и branch assignment period orchestration рядом с
  lifecycle use cases либо в явных internal collaborators.
- Выделить lifecycle audit mapping/writing с сохранением event payloads.
- После slice удалить lifecycle helpers из исходного catch-all типа.

## Out of scope
- Client list/detail query refactoring, принадлежащий TASK-122.
- Membership actions и `IClientMembershipService`.
- Новые поля клиента, permissions, group rules или schema changes.

## Constraints
- TASK-122 должна быть интегрирована до начала этой задачи.
- Сохранить HTTP routes, status codes, validation keys и audit semantics.
- Branch/group access проверяется backend; не переносить правила в request DTO.
- Transfer и period updates остаются атомарными.
- Обязательны `refactoring-specialist`, `dotnet-backend-specialist` и `test-automator`.

## Acceptance criteria
- [x] Create/update/transfer/archive/restore routes и contracts не изменились.
- [x] Invalid JSON и validation errors имеют прежние ProblemDetails keys/status.
- [x] Contact/group/branch assignment periods сохраняются и закрываются как прежде.
- [x] Audit state before/after и actor semantics не изменились.
- [x] Lifecycle module не содержит membership sale/refund orchestration.
- [x] Полный backend quality baseline проходит.

## Test checklist
- [x] Characterization tests на каждый lifecycle route и повторный reload.
- [x] Allowed/forbidden tests по ролям и филиалам.
- [x] Validation/atomicity tests для transfer и group assignments.
- [x] Audit regression tests с точными event categories и entity ids.
- [x] Запустить format, Release build, полный xUnit suite и NuGet audit.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: slice затрагивает authorization, персональные данные, period persistence и audit correctness.

## Clarification questions
Не требуется: продуктовый contract не меняется, задача только выделяет существующую lifecycle boundary.

## Source notes
- Source: direct user request, 2026-08-22.
- Parent task: `/backlog/risky/TASK-121-decompose-oversized-cross-layer-files.md`.

## Processing notes
- Created at: 2026-08-22 23:47 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: active client workflow tasks меняют UX/возможности и не покрывают structural lifecycle extraction.

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-23
- moved_from: /backlog/risky
- implementation_plan: /backlog/done/2026-08-23/TASK-123-client-lifecycle-endpoints-decomposition.plan.md
- implementation_branch: refactor/TASK-123-client-lifecycle-endpoints-decomposition
- implementation_state: completed
- implementation_commits: b13dc9a, e23a2e7, 264e3aa, 54ec604, b8f5ebd
- delivered_on_main_at: 2026-08-23
- moved_to_done_at: 2026-08-23
- last_status_reviewed_at: 2026-08-23

## Completion record
- Completed on: 2026-08-23; final local-main integration: `a3e12ea`.
- Lifecycle endpoints and validation are dedicated top-level owners; the initial filename-only partial split was corrected before acceptance.
- Validation: exact route/role/404/audit/rollback regressions plus backend format, warnings-as-errors build, NuGet audit and aggregate `430/430` xUnit tests passed.
- Runtime/data: contracts and schema were unchanged; migration and Docker Compose task stack were not required.
