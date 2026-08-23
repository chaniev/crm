# TASK-121: Декомпозировать крупные cross-layer файлы без изменения поведения

## Status
risky

## Goal
Снизить стоимость изменений и регрессионный риск в крупнейших backend,
frontend и bot-файлах, выделив небольшие проверяемые границы без изменения
CRM-поведения и публичных контрактов.

## Context
После введения engineering quality baseline остаются структурные hotspots:

- `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs` — около 3950 строк;
- `backend/src/GymCrm.Infrastructure/Bot/BotApiService.cs` — около 1100 строк;
- `frontend/src/App.tsx` — около 2000 строк;
- `frontend/src/features/clients/ClientManagement.tsx` — около 3430 строк;
- `frontend/src/features/groups/GroupManagement.tsx` — около 1450 строк;
- `bot/src/gym_crm_bot/core/service.py` — около 750 строк.

`backlog/needs-clarification/TASK-010-bot-read-model-architecture.md` уже владеет
решением о выделении query/use-case классов из `BotApiService`; эта задача не
должна подменять или дублировать то решение.

## Child task map
- TASK-122 — read-only client query endpoints.
- TASK-123 — client lifecycle endpoints и validation.
- TASK-124 — membership HTTP/idempotency/audit orchestration.
- TASK-125 — `ClientMembershipService` за стабильным facade.
- TASK-126 — `App.tsx` shell/routing decomposition.
- TASK-127 — core client screens/forms.
- TASK-128 — client membership UI.
- TASK-129 — group registry/forms.
- TASK-130 — Python `BotService` Telegram scenarios.
- TASK-010 — архитектурное решение для backend `BotApiService`; отдельная
  implementation task создаётся только после закрытия вопросов TASK-010.

Последовательность внутри одного hotspot обязательна: TASK-122 -> TASK-123 ->
TASK-124 -> TASK-125 и TASK-126 -> TASK-127 -> TASK-128. TASK-129 начинается
после TASK-126. TASK-130 независима от frontend/backend slices, но выполняется
в собственной branch/worktree.

## User role
Команда разработки, сопровождающая CRM backend, frontend и Telegram bot.

## Problem
Крупные файлы смешивают регистрацию, orchestration, presentation и вспомогательные
детали. Локальное изменение требует читать и повторно проверять слишком большой
контекст, а конфликты между независимыми задачами становятся вероятнее.

## Scope
- Перед кодом составить dependency map и test-first implementation plan с
  независимыми, последовательно интегрируемыми slices.
- Разделить `ClientEndpoints` по существующим CRM capabilities, сохранив route,
  authorization, validation, audit и ProblemDetails contracts.
- Вынести из `App.tsx` application shell/routing orchestration, не перемещая
  backend-owned permission rules во frontend.
- Разделить client/group management на feature components, hooks и typed
  transport adapters по текущим пользовательским операциям.
- Разделить Python bot orchestration на небольшие сервисы с явными typed
  boundaries, сохранив callback payloads, idempotency и Telegram behavior.
- После решения TASK-010 выполнить согласованный slice для `BotApiService`; до
  этого не вводить собственную конкурирующую query/use-case архитектуру.
- Сохранить или усилить regression coverage перед каждым переносом кода.

## Out of scope
- Новые продуктовые возможности и redesign пользовательских workflow.
- Изменение API payloads, routes, permissions, membership/attendance semantics,
  audit events, ProblemDetails codes или database schema.
- Параллельное переименование всего проекта и массовая смена namespace.
- Объединение независимых business-rule исправлений с рефакторингом.

## Constraints
- Обязателен `refactoring-specialist`; frontend slices дополнительно проверяет
  `react-specialist`, тестовую стратегию — `test-automator`.
- Один implementation slice не должен одновременно менять несвязанные слои.
- Backend domain/application contracts имеют приоритет над удобством UI/bot.
- Existing tests сначала фиксируют поведение, затем переносится код.
- Для каждого slice нужен отдельный task branch/worktree и чистый merge-base от
  актуального `origin/main`; umbrella plan обязан создать дочерние executable tasks.
- `BotApiService` slice зависит от закрытого архитектурного решения TASK-010.

## Acceptance criteria
- [x] Зафиксирована карта текущих ответственностей и зависимостей всех hotspots.
- [x] Созданы ограниченные child tasks с порядком, метриками и rollback boundaries.
- [x] Ни один публичный API/route/callback/ProblemDetails/audit contract не изменён.
- [x] `ClientEndpoints` больше не является единым catch-all endpoint module.
- [x] `App.tsx`, `ClientManagement.tsx` и `GroupManagement.tsx` оставляют orchestration на уровне feature и используют focused components/hooks.
- [x] Python bot service разбит на typed responsibilities без дублирования backend rules.
- [ ] Решение TASK-010 соблюдено; `BotApiService` не получает вторую конкурирующую архитектуру.
- [x] Размер и cyclomatic/ownership hotspots заметно уменьшены и измерены до/после.
- [x] Все обязательные backend/frontend/bot gates проходят после каждого завершённого slice.

## Test checklist
- [x] До первого переноса определить characterization tests для каждого hotspot.
- [x] Backend: format, Release build, полный xUnit suite и affected PostgreSQL integration tests.
- [x] Frontend: lint, strict typecheck, raw-color gate, unit tests, build и affected mobile Playwright workflows.
- [x] Bot: Ruff lint/format, strict mypy, pytest и callback/idempotency regressions.
- [x] Проверить отсутствие contract diffs в OpenAPI/typed DTO/callback payload snapshots, где применимо.
- [ ] Повторить cross-layer validation после интеграции всех slices.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: широкий структурный refactoring затрагивает несколько runtime-слоёв и может незаметно изменить authorization, orchestration или пользовательские workflow.

## Clarification questions
- [ ] Подтвердить и закрыть архитектурное решение TASK-010 до планирования `BotApiService` slice.
- [x] Метрики завершения, dependency direction и допустимый public surface зафиксированы в TASK-122–TASK-130.

## Source notes
- Source: direct user request, 2026-08-22, пункт 6 рекомендаций по engineering standards.
- Source: direct user request, 2026-08-22, сформировать отдельные задачи на рефакторинг.
- Related task: `/backlog/needs-clarification/TASK-010-bot-read-model-architecture.md`.
- Historical context: `/backlog/done/REFACTORING_PLAN.md`; остаточные hotspots появились или выросли после прежней декомпозиции.

## Processing notes
- Created at: 2026-08-22 23:28 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: TASK-010 частично пересекается только с `BotApiService`; связь оформлена как dependency, остальные hotspots активной задачей не покрыты.
- Decomposed at: 2026-08-22 23:47 MSK into TASK-122–TASK-130; umbrella task остаётся risky coordination record до завершения child tasks и решения TASK-010.
- Progress reviewed at 2026-08-23: TASK-122–127, TASK-129 and TASK-130 завершены и локально интегрированы; TASK-128 ожидает отдельного явного high-risk approval после disclosure риска idempotency денежных membership mutations; TASK-010 остаётся unresolved dependency для `BotApiService`.
