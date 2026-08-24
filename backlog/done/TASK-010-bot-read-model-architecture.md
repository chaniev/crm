# TASK-010: Определить архитектуру read models Telegram-бота

## Status
done

## Goal
Зафиксировать минимальную архитектуру декомпозиции backend `BotApiService`,
которая уменьшает ownership hotspot без изменения internal Bot API и без
появления конкурирующих CRM-правил в Python-боте.

## Context
На baseline `origin/main` `a32ed58` от 2026-08-22
`backend/src/GymCrm.Infrastructure/Bot/BotApiService.cs` содержал 1108 строк.
На актуальном `origin/main` `e3eff91` от 2026-08-24 файл содержит 1550 строк,
а стабильный `IBotApiService` — 12 операций.

Сервис одновременно владеет identity/menu, attendance read и mutation paths,
idempotency, client search/card/expiring-membership projections, access scope,
mapping и audit. Рост после TASK-115 и TASK-119 подтвердил, что это текущий
ownership hotspot, а не отложенная гипотетическая проблема.

## Architecture decision
- `IBotApiService` и `BotApiService` сохраняются как стабильный facade для
  `BotInternalEndpoints`; internal routes, DTO и Python consumer не меняются.
- Декомпозиция выполняется по backend capabilities, а не отдельным query/use-case
  классом на каждый endpoint.
- Первый slice выделяет client read models (`SearchClients`, `GetClientCard`,
  `ListExpiringMemberships`) в focused internal collaborator с отдельным mapper,
  если mapper нужен для соблюдения размера и single-responsibility.
- Identity resolution остаётся единым и не дублируется. Facade передаёт
  авторизованный backend context collaborator-у либо использует один общий typed
  resolver; конкретный вариант фиксируется implementation plan после dependency map.
- Attendance query/mutation, idempotency и access-denied audit не смешиваются с
  первым slice и получают отдельные задачи только после измерения результата.
- Новая публичная application abstraction не вводится без отдельного доказанного
  consumer или replaceability requirement.

## User role
Команда разработки, сопровождающая backend internal Bot API и Telegram-бот.

## Problem
Один infrastructure service смешивает несколько CRM capabilities и продолжает
расти при развитии расписания и membership-модели. Это увеличивает контекст
изменений и риск незаметно повредить authorization, ordering, membership warning
или attendance/idempotency behavior.

## Scope
- Оценить текущий размер, public surface, зависимости и responsibility seams.
- Выбрать dependency direction и стабильный facade.
- Зафиксировать минимальный read-only refactoring slice.
- Создать отдельную risky-задачу с test-first и rollback boundaries.

## Out of scope
- Реализация refactoring в рамках архитектурной карточки.
- Изменение backend business logic, internal Bot API contracts или Telegram UX.
- Одновременная декомпозиция attendance mutation/idempotency/audit paths.

## Constraints
- Backend остаётся владельцем permissions, access scope, memberships,
  attendance, audit и validation semantics.
- Python-бот остаётся thin adapter и не вычисляет CRM read models самостоятельно.
- Рефакторинг сохраняет `IBotApiService`, routes, DTO, status/error mapping,
  ordering, paging, callback payloads и Telegram behavior.
- Implementation требует `refactoring-specialist`, backend specialist,
  characterization tests и отдельный branch/worktree.

## Acceptance criteria
- [x] Зафиксировано решение по `BotApiService` и stable facade.
- [x] Описаны capability boundaries без class-per-endpoint архитектуры.
- [x] Определён минимальный первый client read-model slice.
- [x] Создана отдельная risky implementation task TASK-132.

## Test checklist
- [x] Проверен текущий contract surface `IBotApiService` и public methods `BotApiService`.
- [x] Проверено текущее backend regression evidence: основной
  `InternalBotApiTests.cs` содержит 1229 строк, дополнительно есть связанные
  access-scope, substitution и PostgreSQL membership barrier tests.
- [x] Backend format/build/xUnit/NuGet audit и bot pytest перенесены в TASK-132;
  в архитектурном audit код не менялся, поэтому runtime gates не запускались.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: будущий slice затрагивает backend authorization и membership read
  models; ошибка может изменить доступные клиентские данные без contract diff.

## Clarification questions
- [x] Есть ли текущая боль от размера или ответственности `BotApiService`? Да:
  1108 -> 1550 строк за два дня и несколько независимых capabilities в одном типе.
- [x] Нужна ли декомпозиция сейчас? Да, но только последовательными
  behavior-preserving slices за стабильным facade.
- [x] Какой сценарий первый? Client read models, потому что это ограниченная
  read-only capability без attendance mutations и idempotency.

## Source notes
- Source file: `backlog/processed/2026-05-04.md`.
- Original note: `Решить архитектурное отличие полного плана: оставлять сборку read models в BotApiService или выделять отдельные именованные query/use case классы.`
- Direct follow-up: 2026-08-22, запрос сформировать отдельные refactoring tasks;
  новый дубликат для `BotApiService` не создан.
- Direct follow-up: 2026-08-24, актуализировать связанные задачи без изменения кода.
- Parent coordination task: `/backlog/risky/TASK-121-decompose-oversized-cross-layer-files.md`.
- Successor task: `/backlog/risky/TASK-132-bot-client-read-model-decomposition.md`.

## Processing notes
- Created at: 2026-05-07 11:26.
- Created by skill: codex-backlog-skill.
- Duplicate check: existing task folders were empty before processing; no duplicate found.
- Duplicate check 2026-08-22: TASK-121/TASK-122–TASK-130 проверены;
  backend `BotApiService` architecture оставлена исключительно в TASK-010.
- Architecture completed at: 2026-08-24 09:56 MSK against clean
  `main == origin/main` `e3eff91`; no project code, tests or runtime changed.
