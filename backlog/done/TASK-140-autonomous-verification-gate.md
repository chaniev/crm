# TASK-140: Автономный task-aware verification gate

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-29
- implementation_branch: feature/TASK-140-autonomous-verification-gate
- implementation_state: completed
- implementation_commit: 36a95ce2e2543487959acd5bd2f953cd93c0d215
- completed_at: 2026-08-29
- verification_contract: backlog/done/TASK-140-autonomous-verification-contract.json

## Goal
Довести harness до воспроизводимого merge gate: одна task identity выбирает
контракт локально и в detached CI, выполняет canonical, browser и managed
runtime проверки и агрегирует evidence для одного Git HEAD/tree.

## Scope
- Task ID discovery и однозначный поиск verification contract.
- Detached HEAD validation через явно переданный source ref.
- Автоматическая установка Playwright browsers и уникальный E2E port.
- Реальный Chromium и target-iPhone WebKit dogfooding.
- Управляемый Compose lifecycle с уникальными project/ports и cleanup в finally.
- Manual evidence с actor, timestamp, note и artifacts.
- Агрегация JSON reports в единый status и merge gate.
- CI wiring, unit/integration coverage и документация.

## Out of scope
- Изменение CRM product behavior, API или database schema.
- Production deployment.
- Долговременный dashboard метрик и flaky-test analytics.
- Криптографическая подпись manual evidence.

## Requirements
- none — developer verification tooling; поведение CRM не меняется.

## Acceptance criteria
- [x] `--task-id` находит ровно один contract или завершается до checks.
- [x] Local branch и detached `--source-ref` валидируются одинаково строго.
- [x] Contract не может ослабить canonical baseline.
- [x] Playwright browsers устанавливаются один раз перед task E2E checks.
- [x] Desktop Chromium и target-iPhone WebKit проходят через harness.
- [x] Runtime stack использует уникальные project/ports и `BOT_ENABLED=false`.
- [x] Runtime cleanup выполняется после success, failure и interrupt без `-v`.
- [x] Manual confirmation содержит проверяемую provenance metadata.
- [x] Aggregator обнаруживает failed, incomplete и stale evidence.
- [x] CI публикует единый aggregate artifact и job summary.
- [x] Core остаётся vendor- и coding-agent-neutral.
- [x] Полный repository baseline и TASK-140 contract проходят.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: medium
- Reason: меняется CI/runtime orchestration, но только для disposable verification environments.

## Validation
- Candidate `36a95ce2e2543487959acd5bd2f953cd93c0d215` прошёл task-aware
  `--profile full`; aggregate evidence имеет status `passed` и привязан к exact
  HEAD/tree и contract digest.
- Harness: 49 unit tests и manual provenance validation passed.
- Backend: format, Release build, 512 tests и NuGet vulnerability audit passed.
- Frontend: install, audit, lint, typecheck, raw-color scan, 580 unit tests,
  production build, 8 Chromium E2E и 66 target-iPhone WebKit E2E passed.
- Bot: locked sync, lint, format, typing и 65 tests passed.
- Deploy: обе Compose configurations, shell syntax, managed runtime readiness,
  smoke и scoped cleanup passed; основной Compose project не изменён.
