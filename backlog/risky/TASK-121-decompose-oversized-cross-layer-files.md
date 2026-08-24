# TASK-121: Декомпозировать крупные cross-layer файлы без изменения поведения

## Status
risky

## Goal
Снизить стоимость изменений и регрессионный риск в крупнейших backend,
frontend и bot-файлах, выделив небольшие проверяемые границы без изменения
CRM-поведения и публичных контрактов.

## Context
Исходные structural hotspots и состояние на актуальном `origin/main` `e3eff91`:

| Hotspot | Baseline 2026-08-22 | Current 2026-08-24 | State |
|---|---:|---:|---|
| `ClientEndpoints.cs` | ~3950 | 15 | decomposed |
| `BotApiService.cs` | 1108 | 1550 | active hotspot |
| `App.tsx` | ~2000 | 589 | decomposed |
| `ClientManagement.tsx` | ~3430 | 5 | decomposed |
| `GroupManagement.tsx` | ~1450 | 6 | decomposed |
| Python `core/service.py` | ~750 | 166 | decomposed |

TASK-122–TASK-130 завершены и находятся в `/backlog/done`. TASK-010 закрыла
архитектурный вопрос для backend `BotApiService`: стабильный facade сохраняется,
а capabilities выделяются последовательными internal collaborators без
class-per-endpoint архитектуры. Первый executable slice оформлен как TASK-132.

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
- TASK-010 — завершённое архитектурное решение для backend `BotApiService`.
- TASK-132 — первый backend `BotApiService` client read-model slice.

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
- Выполнить TASK-132 за стабильным `IBotApiService` facade, не вводя
  конкурирующую class-per-endpoint query/use-case архитектуру.
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
- `BotApiService` slice обязан следовать закрытому решению TASK-010 и выполняться
  только через TASK-132 либо явно согласованную последующую capability task.

## Acceptance criteria
- [x] Зафиксирована карта текущих ответственностей и зависимостей всех hotspots.
- [x] Созданы ограниченные child tasks с порядком, метриками и rollback boundaries.
- [x] Ни один публичный API/route/callback/ProblemDetails/audit contract не изменён.
- [x] `ClientEndpoints` больше не является единым catch-all endpoint module.
- [x] `App.tsx`, `ClientManagement.tsx` и `GroupManagement.tsx` оставляют orchestration на уровне feature и используют focused components/hooks.
- [x] Python bot service разбит на typed responsibilities без дублирования backend rules.
- [x] Решение TASK-010 зафиксировано; `BotApiService` не получает вторую конкурирующую архитектуру.
- [ ] TASK-132 интегрирована: client read models выделены за стабильным facade,
  а `BotApiService` заметно уменьшен без contract или behavior diff.
- [x] Размер и cyclomatic/ownership hotspots заметно уменьшены и измерены до/после.
- [x] Все обязательные backend/frontend/bot gates проходят после каждого завершённого slice.

## Test checklist
- [x] До первого переноса определить characterization tests для каждого hotspot.
- [x] Backend: format, Release build, полный xUnit suite и affected PostgreSQL integration tests.
- [x] Frontend: lint, strict typecheck, raw-color gate, unit tests, build и affected mobile Playwright workflows.
- [x] Bot: Ruff lint/format, strict mypy, pytest и callback/idempotency regressions.
- [x] Проверить отсутствие contract diffs в OpenAPI/typed DTO/callback payload snapshots, где применимо.
- [x] Повторить cross-layer validation после интеграции всех TASK-122–130 slices.
- [ ] После TASK-132 повторить backend gates и affected internal Bot API/bot
  consumer regressions.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: широкий структурный refactoring затрагивает несколько runtime-слоёв и может незаметно изменить authorization, orchestration или пользовательские workflow.

## Clarification questions
- [x] Архитектурное решение TASK-010 закрыто 2026-08-24; first slice — TASK-132.
- [x] Метрики завершения, dependency direction и допустимый public surface зафиксированы в TASK-122–TASK-130.

## Source notes
- Source: direct user request, 2026-08-22, пункт 6 рекомендаций по engineering standards.
- Source: direct user request, 2026-08-22, сформировать отдельные задачи на рефакторинг.
- Related decision: `/backlog/done/TASK-010-bot-read-model-architecture.md`.
- Remaining child task: `/backlog/risky/TASK-132-bot-client-read-model-decomposition.md`.
- Historical context: `/backlog/done/REFACTORING_PLAN.md`; остаточные hotspots появились или выросли после прежней декомпозиции.

## Processing notes
- Created at: 2026-08-22 23:28 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: TASK-010 частично пересекается только с `BotApiService`; связь оформлена как dependency, остальные hotspots активной задачей не покрыты.
- Decomposed at: 2026-08-22 23:47 MSK into TASK-122–TASK-130; umbrella task остаётся risky coordination record до завершения child tasks и решения TASK-010.
- Progress reviewed at 2026-08-23: TASK-122–130 завершены, independently reviewed и локально интегрированы; TASK-010 остаётся единственной unresolved dependency для `BotApiService`, поэтому umbrella task сохраняет статус `risky`.
- Status reviewed at 2026-08-24 09:56 MSK against `main == origin/main`
  `e3eff91`: TASK-010 architecture resolved and moved to done; TASK-132 created
  as the only remaining executable slice. Umbrella remains `risky` until
  TASK-132 is implemented and validated.
