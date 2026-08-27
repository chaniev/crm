# TASK-132: Выделить client read models из backend BotApiService

## Status
risky

## Requirements
- none — behavior-preserving internal service decomposition only

## Goal
Уменьшить backend `BotApiService` и стоимость изменений internal Bot API,
выделив client read-model capability за стабильным facade без изменения
authorization, membership semantics, API contracts или Telegram behavior.

## Context
На актуальном `origin/main` `e3eff91` от 2026-08-24:

- `backend/src/GymCrm.Infrastructure/Bot/BotApiService.cs` — 1550 строк;
- `backend/src/GymCrm.Application/Bot/IBotApiService.cs` — 12 операций;
- `backend/tests/GymCrm.Tests/InternalBotApiTests.cs` — 1229 строк;
- client read paths занимают `SearchClientsAsync`, `GetClientCardAsync`,
  `ListExpiringMembershipsAsync` и связанные scope/query/mapping helpers.

TASK-010 выбрала capability-oriented internal collaborators за стабильным
`IBotApiService` facade. TASK-121 остаётся umbrella coordination record до
проверенной интеграции этого первого slice.

## User role
Команда разработки, сопровождающая backend internal Bot API и Telegram-бот.

## Problem
`BotApiService` смешивает identity resolution, access scope, attendance
queries/mutations, idempotency, audit и client/membership projections. Client
read-model изменения требуют читать и повторно проверять mutation-heavy код, а
последующие schedule/membership features продолжают увеличивать общий файл.

## Scope
- Перед переносом составить dependency map для трёх client read operations,
  shared identity/access-scope helpers, EF projections и DTO mappers.
- Добавить или уточнить characterization tests до структурных изменений.
- Сохранить `IBotApiService` и `BotApiService` как public/internal endpoint facade.
- Выделить focused internal client read collaborator для `SearchClientsAsync`,
  `GetClientCardAsync` и `ListExpiringMembershipsAsync`.
- При необходимости выделить отдельный mapper, чтобы query orchestration и
  DTO construction не образовали новый oversized type.
- Сохранить единый identity resolution path без копирования authorization logic.
- Обновить только необходимую backend DI wiring и focused tests.

## Out of scope
- Изменение `IBotApiService`, `BotInternalEndpoints`, internal routes, DTO или
  Python `bot/src/gym_crm_bot/crm/**` contracts.
- Attendance menu/date/group/lesson/roster/save decomposition.
- Изменение idempotency, access-denied audit, membership, attendance, schedule
  или permission semantics.
- Новые Telegram scenarios, callback payloads или UX.
- Database schema/migrations и production deployment.
- Class-per-endpoint query/use-case architecture или общий массовый refactoring.

## Constraints
- Backend остаётся единственным владельцем permissions, access scope,
  membership warning/entitlement и client visibility rules.
- Route, status/error, ordering, paging, filtering, photo, group, attendance
  history и membership projection contracts должны остаться byte-for-byte или
  semantically equivalent согласно существующим tests/snapshots.
- Existing behavior сначала фиксируется tests, затем переносится код.
- Обязательны `dotnet-backend-specialist`, `refactoring-specialist` и
  `test-automator`; при существенном изменении xUnit coverage использовать
  `.agents/skills/csharp-xunit/SKILL.md`.
- Задача выполняется в отдельном branch/worktree от актуального `origin/main`;
  implementation plan должен определить per-commit rollback boundary.
- Если extraction требует нового public application contract, изменения API
  payload или переноса CRM rules, остановиться и вернуть архитектурный вопрос.

## Acceptance criteria
- [ ] `IBotApiService` signatures, `BotInternalEndpoints`, routes и DTO не изменены.
- [ ] `BotApiService` делегирует три client read operations focused collaborator-у.
- [ ] Identity resolution и role/access-scope checks имеют одного владельца и
  не продублированы между facade и collaborator.
- [ ] Search full-name/phone behavior, paging bounds, ordering и role scope сохранены.
- [ ] Client card photo/groups/attendance/current-membership projections,
  membership target/warning semantics и ordering сохранены.
- [ ] Expiring-membership filtering, ordering и role scope сохранены.
- [ ] `BotApiService.cs` не превышает 1100 строк; каждый новый production type
  не превышает 500 строк и имеет одну явную responsibility.
- [ ] Python-бот не получает backend CRM rules или независимую read-model сборку.
- [ ] Полный backend quality baseline и affected bot consumer regressions проходят.

## Test checklist
- [ ] Зафиксировать characterization coverage всех трёх client read operations
  до extraction, включая allowed/forbidden/not-found paths.
- [ ] Проверить role/access-scope matrix существующих internal Bot API tests.
- [ ] Проверить search по ФИО и телефону, normalization, skip/take limits,
  deterministic ordering и пустой результат.
- [ ] Проверить client card photo, group summaries, attendance history,
  current memberships, target/overlap и warning projections.
- [ ] Проверить expiring-membership date boundary, scope и ordering.
- [ ] Проверить отсутствие internal route/DTO diff и совместимость Python client.
- [ ] Запустить `dotnet format backend/GymCrm.slnx --no-restore --verify-no-changes`.
- [ ] Запустить Release build с warnings as errors, полный xUnit suite и чистый
  NuGet vulnerable dependency audit.
- [ ] Запустить locked bot Ruff/format/mypy/pytest consumer gates либо явно
  зафиксировать, почему backend-only contract-preserving slice их не затрагивает.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: read-only refactoring пересекает authorization scope и membership
  projections; незаметная ошибка может раскрыть данные или изменить Telegram output.

## Source notes
- Source task: `/backlog/done/TASK-010-bot-read-model-architecture.md`.
- Parent task: `/backlog/risky/TASK-121-decompose-oversized-cross-layer-files.md`.
- Original source: `/backlog/processed/2026-05-04.md`, архитектурный вопрос о
  read models `BotApiService`.
- Direct request: 2026-08-24, актуализировать задачи без изменения project code.

## Processing notes
- Created at: 2026-08-24 09:56 MSK.
- Created by skill: codex-backlog-skill.
- Baseline: clean `main == origin/main` `e3eff91`.
- Duplicate check: active and done backlog searched by `BotApiService`, read
  models and query/use-case terms; TASK-010 owns the completed decision,
  TASK-121 owns coordination, and no executable client read decomposition task exists.
- No implementation plan, branch, worktree, code change or runtime action was created.
