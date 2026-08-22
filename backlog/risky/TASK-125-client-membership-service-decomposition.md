# TASK-125: Декомпозировать ClientMembershipService за стабильным facade

## Status
risky

## Goal
`IClientMembershipService` сохраняет текущий публичный contract, а purchase,
renew/correct, visit write-off, refund и query responsibilities реализуются
маленькими внутренними collaborators с явными транзакционными границами.

## Context
`ClientMembershipService.cs` содержит около 1000 строк и девять публичных
операций с общей persistence/query/mapping инфраструктурой. Изменение одной
операции требует повторно анализировать все membership transitions.

## User role
Система и пользователи, выполняющие backend-разрешённые membership/attendance operations.

## Problem
Один infrastructure service владеет слишком большим числом mutation paths;
неясные ownership boundaries повышают риск общей транзакции, mapping и overlap regressions.

## Scope
- Зафиксировать characterization tests всех методов `IClientMembershipService`.
- Сохранить `IClientMembershipService` и `ClientMembershipService` как тонкий
  facade, чтобы не менять consumers одним большим шагом.
- Выделить internal collaborators для details/query mapping, sale lifecycle,
  single-visit write-off/restore и refund/comment operations.
- Оставить transaction ownership внутри одной операции; не создавать ambient
  mutable state между collaborators.
- Вынести общие persistence lookups/mappers только при наличии двух и более
  реальных consumers.
- Сократить facade до 250 строк; каждый collaborator — не более 400 строк.

## Out of scope
- Изменение Application contracts или mutation result/error enums.
- Изменение membership, payment, refund, attendance или overlap semantics.
- Schema/migration changes и новый repository/unit-of-work framework.

## Constraints
- TASK-124 должна быть интегрирована до начала задачи, чтобы HTTP и service
  refactoring не смешивались в одном diff.
- Backend domain policies остаются source of truth.
- Один `DbContext` scope и текущая atomicity каждой операции сохраняются.
- Не дублировать validation между facade, collaborators и API.
- Обязательны `refactoring-specialist`, `dotnet-backend-specialist` и `test-automator`.

## Acceptance criteria
- [ ] Публичный `IClientMembershipService` и DI registration не изменились.
- [ ] Facade не превышает 250 строк и только валидирует boundary/delegates.
- [ ] Каждый collaborator имеет одну use-case responsibility и не превышает 400 строк.
- [ ] Transaction, overlap, idempotency-adjacent и audit-observable behavior сохранены.
- [ ] Attendance consumer продолжает корректно write-off/restore SingleVisit.
- [ ] Полный backend quality baseline проходит.

## Test checklist
- [ ] Characterization tests Get/Purchase/Renew/Correct/Comment.
- [ ] Tests WriteOff/Restore SingleVisit и attendance integration.
- [ ] Tests Register/Cancel refund, rollback и overlap concurrency.
- [ ] Проверить existing API regressions после изменения DI graph.
- [ ] Запустить format, Release build, полный xUnit suite и NuGet audit.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: service владеет критическими membership, payment, refund, attendance и transaction semantics.

## Clarification questions
Не требуется: facade и observable contracts должны остаться неизменными.

## Source notes
- Source: direct user request, 2026-08-22.
- Parent task: `/backlog/risky/TASK-121-decompose-oversized-cross-layer-files.md`.

## Processing notes
- Created at: 2026-08-22 23:47 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: active membership product tasks меняют behavior/data model и явно исключены из этого structural slice.
