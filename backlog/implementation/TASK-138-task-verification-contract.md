# TASK-138: Task-aware verification contract для harness

## Status
implementation

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-29
- implementation_branch: feature/TASK-138-task-verification-contract
- implementation_state: in_progress
- verification_contract: backlog/implementation/TASK-138-task-verification-contract.json

## Goal
Расширить verification harness task-specific контрактом, который дополняет,
но не ослабляет автоматически выбранный baseline, запускает явно указанные
Playwright и runtime smoke checks и сохраняет проверяемое evidence.

## Scope
- Исправить сообщение harness для чистого local diff.
- Добавить stdlib-only JSON verification contract с task ID, expected branch,
  обязательными areas, Playwright, runtime smoke и manual checks.
- Добавить CLI-параметры выбора контракта и подтверждения ручных проверок.
- Объединять impact selection и task contract без удаления или дублирования
  обязательных проверок.
- Валидировать schema, пути, идентификаторы, команды и branch freshness до
  запуска проверок.
- Сохранять контракт, его digest, Git SHA/tree и источники выбора проверок в
  JSON evidence.
- Добавить unit coverage, документацию и agent-neutral usage guidance.

## Out of scope
- Изменение поведения CRM, API, database schema или deployment runtime.
- Автоматическое угадывание task contract без явного CLI-параметра.
- Динамическое отключение CI jobs.
- Выполнение реального браузерного или server smoke сценария в unit tests.

## Requirements
- none — developer verification tooling; наблюдаемое поведение CRM не меняется.

## Acceptance criteria
- [ ] Чистый local diff выводится как `no changed paths`.
- [ ] JSON contract связан с task ID и ожидаемой task-веткой.
- [ ] Contract areas только расширяют diff-selected baseline.
- [ ] Playwright и runtime smoke checks выполняются как argv без shell.
- [ ] Дубликаты canonical и task-specific checks отклоняются или объединяются.
- [ ] Manual checks имеют статусы `required`, `confirmed`, `not_confirmed` и
  неподтверждённые обязательные проверки делают execution незавершённым.
- [ ] Evidence содержит task contract, digest, HEAD/tree и причины выбора checks.
- [ ] Missing, malformed и stale contracts завершаются понятной ошибкой до checks.
- [ ] Unit tests, requirements validator и полный repository baseline проходят.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: low
- Reason: контракт только усиливает developer verification и не меняет CRM runtime.
