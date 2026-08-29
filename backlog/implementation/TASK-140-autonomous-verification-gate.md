# TASK-140: Автономный task-aware verification gate

## Status
implementation

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-29
- implementation_branch: feature/TASK-140-autonomous-verification-gate
- implementation_state: in_progress
- verification_contract: backlog/implementation/TASK-140-autonomous-verification-contract.json

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
- [ ] `--task-id` находит ровно один contract или завершается до checks.
- [ ] Local branch и detached `--source-ref` валидируются одинаково строго.
- [ ] Contract не может ослабить canonical baseline.
- [ ] Playwright browsers устанавливаются один раз перед task E2E checks.
- [ ] Desktop Chromium и target-iPhone WebKit проходят через harness.
- [ ] Runtime stack использует уникальные project/ports и `BOT_ENABLED=false`.
- [ ] Runtime cleanup выполняется после success, failure и interrupt без `-v`.
- [ ] Manual confirmation содержит проверяемую provenance metadata.
- [ ] Aggregator обнаруживает failed, incomplete и stale evidence.
- [ ] CI публикует единый aggregate artifact и job summary.
- [ ] Core остаётся vendor- и coding-agent-neutral.
- [ ] Полный repository baseline и TASK-140 contract проходят.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: medium
- Reason: меняется CI/runtime orchestration, но только для disposable verification environments.
