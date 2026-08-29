# TASK-136: Усилить корректность verification harness

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-29
- implementation_branch: fix/TASK-136-harness-correctness-hardening
- implementation_state: completed
- completed_at: 2026-08-29

## Goal
Verification harness корректно учитывает удаления и перемещения файлов,
предсказуемо завершает зависшие или прерванные проверки и сохраняет
долговременное evidence, однозначно связанное с проверенным Git tree.

## Scope
- Анализировать Git statuses `A/C/D/M/R/T`, включая оба пути rename/copy.
- Добавить per-check timeout, корректное завершение process group и состояния
  `timed_out`, `interrupted`, `spawn_failed`.
- Записывать JSON атомарно и завершать report при всех контролируемых отказах.
- Добавить HEAD/base/merge-base, branch, dirty state, tool versions и безопасную
  GitHub Actions metadata.
- Публиковать отдельный report каждого CI job через официальный
  `actions/upload-artifact` и писать краткий job summary.
- Покрыть новые контракты stdlib unit tests.

## Out of scope
- Выбор отдельных Playwright suites и task-specific verification contract.
- Условный пропуск CI jobs на основе impact matrix.
- Structural architecture tests, runtime observability и agent evals.
- Изменение продуктового или runtime-поведения CRM.

## Requirements
- none — повышение надёжности verification harness без изменения поведения CRM.

## Acceptance criteria
- [x] Deleted backend/frontend paths выбирают соответствующие areas.
- [x] Cross-layer rename/copy анализирует старый и новый paths.
- [x] Timeout завершает process group и оставляет финальный JSON status.
- [x] Interrupt и spawn failure не оставляют report в состоянии `running`.
- [x] Evidence содержит resolved Git identity, dirty state и tool versions.
- [x] Каждый CI job сохраняет уникальный report artifact даже при failure.
- [x] GitHub job summary показывает checks, durations и итоговый status.
- [x] Полный repository baseline проходит без ослабления audit checks.

## Validation
- `python3 scripts/harness/verify_change.py --profile full` — passed.
- Backend: format, Release build, 512 tests, NuGet vulnerability audit — passed.
- Frontend: install, npm audit, lint, typecheck, raw-color scan, 568 tests,
  production build — passed.
- Bot: locked sync, lint, format, typing, 65 tests — passed.
- Deploy: local/server Compose config and shell syntax — passed.
- Harness: 23 unit tests — passed.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: задача усиливает developer tooling и не меняет CRM runtime.
