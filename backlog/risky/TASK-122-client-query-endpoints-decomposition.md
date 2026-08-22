# TASK-122: Выделить read-only client query endpoints

## Status
risky

## Goal
Изменения списка и карточки клиентов можно вносить в локальный query-модуль,
не затрагивая mutation, membership и idempotency orchestration.

## Context
`backend/src/GymCrm.Api/Auth/ClientEndpoints.cs` содержит около 3950 строк.
Read-only handlers, фильтры, paging, coach scope, hydration и response mapping
находятся в одном типе с критическими write endpoints.

## User role
Тренер, администратор, главный тренер и суперадминистратор, читающие доступный
им backend client scope.

## Problem
Изменение client query требует работать рядом с несвязанными write-операциями,
а случайное изменение scope, paging или mapping может раскрыть лишние данные.

## Scope
- До переноса зафиксировать route/query/response characterization tests.
- Выделить list, expiring-memberships, expiration-suggestion и client-details
  read handlers в feature-oriented endpoint modules.
- Перенести связанные paging/filter parsing, coach scope, quick-filter counts,
  hydration и read-only response mapping.
- Оставить `MapClientEndpoints` небольшим composition root с теми же routes.
- После slice сократить исходный `ClientEndpoints.cs` минимум на 1000 строк;
  новые query-модули не должны смешивать mutation или audit-write logic.

## Out of scope
- Create/update/transfer/archive/restore.
- Membership purchase/renew/correct/refund/comment operations.
- Изменение API contract, SQL semantics, индексов или frontend UX.

## Constraints
- Сохранить route templates, query names, default paging и ProblemDetails.
- Сохранить backend-owned Coach/branch scope и authorization behavior.
- Не материализовать запросы раньше текущей точки и не ухудшать pagination.
- Один файл — один top-level type; не создавать generic repository layer.
- Обязательны `refactoring-specialist`, `dotnet-backend-specialist` и test-first review.

## Acceptance criteria
- [ ] Route manifest и OpenAPI surface read endpoints не изменились.
- [ ] Все list/detail filters, ordering, counts и paging возвращают прежние результаты.
- [ ] Coach и branch scopes проходят отдельные allowed/forbidden regressions.
- [ ] `ClientEndpoints.cs` уменьшен минимум на 1000 строк без перемещения write logic в query modules.
- [ ] Новые типы имеют одну явную responsibility и не зависят от frontend/bot.
- [ ] Полный backend quality baseline проходит.

## Test checklist
- [ ] Добавить/обновить characterization tests для list, detail, quick filters и paging.
- [ ] Проверить HeadCoach, Administrator и Coach scope matrices.
- [ ] Проверить invalid dates/status/paging и стабильные ProblemDetails.
- [ ] Запустить format, Release build, полный xUnit suite и NuGet audit.

## AI safety
- Safe for Codex: no
- Risk level: medium
- Reason: refactoring read-only кода затрагивает authorization scope и потенциальную видимость персональных данных.

## Clarification questions
Не требуется: slice ограничен текущими read routes и запрещает изменение их поведения.

## Source notes
- Source: direct user request, 2026-08-22.
- Parent task: `/backlog/risky/TASK-121-decompose-oversized-cross-layer-files.md`.

## Processing notes
- Created at: 2026-08-22 23:47 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: активной задачи на структурное выделение client query endpoints не найдено.
