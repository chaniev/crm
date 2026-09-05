# TASK-120: Ввести единый engineering quality baseline

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-22 22:40 MSK
- moved_from: direct user request
- implementation_branch: feature/TASK-120-engineering-standards-baseline
- implementation_state: completed
- implementation_commit: a32ed58
- delivered_on_main_at: 2026-08-22
- moved_to_done_at: 2026-08-22
- last_status_reviewed_at: 2026-08-22

## Goal
Закрепить воспроизводимые стандарты сборки, форматирования, типизации, аудита
зависимостей и локальной документации для backend, frontend и bot.

## Context
Рекомендации сформированы по стандартам из внешнего repository starter и
сопоставлены с текущими контрактами CRM. Пользователь поручил реализовать
пункты 1–5 и 7, а крупный структурный рефакторинг оформить отдельно.

## User role
Команда разработки и CI.

## Problem
Проверки качества распределены по локальным знаниям и не полностью закреплены
в конфигурации репозитория, lock-файлах, CI и component README.

## Scope
- Обновить уязвимые backend-зависимости и ввести NuGet audit gate.
- Включить frontend strict TypeScript, typecheck, raw-color и npm audit gates.
- Сделать `bot/uv.lock` единственным обычным способом установки bot-зависимостей.
- Добавить `.editorconfig`, встроенные .NET analyzers и format/build gates.
- Ввести Ruff formatting и strict mypy для Python-кода.
- Добавить общий CI workflow и README для backend, frontend и bot.
- Нормализовать существующий C# и Python formatting baseline.

## Out of scope
- Декомпозиция крупных файлов и изменение архитектурных границ.
- Изменение CRM business rules, API contracts, UX workflows или схемы БД.
- Усиление .NET analyzer profile выше `Default` без отдельного baseline task.

## Constraints
- Backend остаётся владельцем CRM domain rules.
- Lock-файлы обязательны; CI использует locked installs.
- Новые gates должны проходить на текущем поведении проекта.
- Generated migrations не переписываются ради performance-рекомендаций analyzers.

## Acceptance criteria
- [x] Backend restore/build блокирует известные NuGet vulnerabilities и warnings.
- [x] `dotnet format --verify-no-changes` проходит на репозитории.
- [x] Frontend strict typecheck, raw-color scanner и dependency audit проходят.
- [x] Bot устанавливается из `uv.lock`; Ruff format, mypy и pytest проходят.
- [x] CI запускает одинаковые backend/frontend/bot quality gates.
- [x] Backend, frontend и bot имеют актуальные component README.
- [x] Крупный рефакторинг вынесен в отдельную backlog task.

## Test checklist
- [x] `dotnet format backend/GymCrm.slnx --no-restore --verify-no-changes`.
- [x] `dotnet build backend/GymCrm.slnx --configuration Release --no-restore -warnaserror`.
- [x] `dotnet test backend/GymCrm.slnx --configuration Release --no-build`.
- [x] `dotnet list backend/GymCrm.slnx package --vulnerable --include-transitive`.
- [x] `cd frontend && npm run check && npm run audit`.
- [x] `cd bot && uv run --locked --extra dev ruff check .`.
- [x] `cd bot && uv run --locked --extra dev ruff format --check .`.
- [x] `cd bot && uv run --locked --extra dev mypy`.
- [x] `cd bot && uv run --locked --extra dev pytest`.
- [x] Собрать bot Docker image из locked environment.

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: изменения широкие по tooling, но не меняют продуктовые контракты; обязательна полная cross-layer validation.

## Clarification questions
Не требуется: пользователь явно выбрал пункты для реализации и отдельно
ограничил пункт 6 созданием задачи.

## Source notes
- Source: direct user request, 2026-08-22.
- Reference: `product-repo-starter (4)/docs/engineering`.

## Processing notes
- Created at: 2026-08-22 23:28 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: активной задачи на единый engineering baseline не найдено.

## Completion record
- Completed on: 2026-08-22.
- Implementation commit: `a32ed58`; integrated into local `main` by fast-forward.
- Validation: .NET format and Release build passed; 420 backend tests, 468 frontend unit tests and 51 bot tests passed; strict TypeScript, raw-color, Ruff, strict mypy, npm audit and NuGet audit gates passed.
- Container validation: locked bot Docker image built successfully and passed a runtime package import smoke-test.
- Data storage: application contracts and database schema were not changed; migration is not required.
- Residual observation: one concurrent PostgreSQL regression test produced a one-off `500` on an intermediate full run, then passed in isolation and in both subsequent full worktree/main runs.
