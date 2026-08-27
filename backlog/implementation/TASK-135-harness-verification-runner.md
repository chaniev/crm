# TASK-135: Единый harness verification runner

## Status
implementation

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-28
- implementation_branch: feature/TASK-135-harness-verification-runner
- implementation_state: in_progress

## Goal
Дать разработчику и Codex единую локальную и CI-точку входа, которая по
фактическому diff выбирает обязательные проверки CRM, объясняет выбор и
сохраняет machine-readable evidence без ослабления текущего CI baseline.

## Scope
- Добавить stdlib-only Python runner с `local`, `full` и `dry-run` режимами.
- Выбирать backend, frontend, bot, deploy, requirements и harness проверки по
  изменённым путям и известным contract boundaries.
- Для неизвестных инфраструктурных путей безопасно выбирать полный baseline.
- Подключить runner к существующим CI jobs.
- Добавить unit coverage матрицы и локальную документацию.

## Out of scope
- Product behavior, API или database schema changes.
- Runtime observability stack, task manifest и autonomous merge.
- Автоматический выбор отдельных Playwright specs.

## Requirements
- none — инфраструктура разработки и проверки; наблюдаемое поведение CRM не меняется.

## Acceptance criteria
- [x] `--dry-run` показывает изменённые пути, выбранные areas, причины и команды.
- [x] `local` учитывает committed, staged, unstaged и untracked changes.
- [x] Staff API boundary включает backend и frontend, Bot API boundary — backend и bot.
- [x] Неизвестный инфраструктурный путь выбирает полный baseline.
- [x] `full --area ...` позволяет CI job запускать прежний обязательный baseline через runner.
- [x] Результат сохраняется как JSON evidence, failures возвращают non-zero exit code.
- [x] Матрица покрыта stdlib unit tests, документация и CI синхронизированы.

## Validation evidence
- Harness: 15/15 unit tests passed; local dry-run selected the safe full baseline.
- Requirements: 57 cards, 24 active tasks and 1 active plan passed validation.
- Backend: format, Release build, 512 tests and NuGet vulnerability audit passed.
- Frontend: locked install, audit, lint, typecheck, raw-color scan, 568 unit tests and build passed.
- Bot: locked sync, Ruff lint/format, mypy and 65 tests passed.
- Deploy: both Compose configurations and deploy shell syntax passed.
- CI workflow YAML parsed successfully; `git diff --check` passed.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: runner оркестрирует существующие проверки и не меняет CRM runtime.
