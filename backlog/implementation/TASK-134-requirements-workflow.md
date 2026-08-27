# TASK-134: Встроить реестр требований в delivery workflow

## Status
implementation

## Requirements
- none — process-only change; product behavior does not change

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-28
- moved_from: direct user request
- implementation_plan: none — scope was explicitly accepted in conversation
- implementation_branch: feature/TASK-134-requirements-workflow

## Goal
Каждая задача проходит от triage до закрытия с проверяемой связью с реестром
требований, а структура реестра и обязательные workflow gates валидируются в CI.

## Scope
- Уточнить approval и implementation status model требований.
- Добавить requirement metadata в backlog templates, planning и execution skills.
- Мигрировать все активные TASK-файлы и незавершённые plans.
- Добавить статический requirements validator, PR template и CI job.
- Пометить конкурирующие исторические требования как неактуальные.

## Out of scope
- Изменение поведения CRM, API, базы данных, frontend или Telegram-бота.
- Ретроспективная миграция всех завершённых TASK-файлов.

## Acceptance criteria
- [x] Активные TASK-файлы содержат `## Requirements` с существующими `REQ-*`,
  обоснованным `none` либо `pending` только для `needs-clarification`.
- [x] Незавершённые implementation plans содержат requirements metadata.
- [x] Статус требования разделён на продуктовое решение и реализованность.
- [x] Предложенное требование не может разрешить переход в implementation.
- [x] Executor workflow обновляет карточку и `CHANGELOG.md` в той же задаче.
- [x] CI запускает статический валидатор реестра и workflow metadata.
- [x] Старый документ требований явно помечен архивным и не конкурирует с реестром.

## Test checklist
- [x] Запустить requirements validator без ошибок.
- [x] Запустить `quick_validate.py` для изменённых repository skills.
- [x] Проверить YAML workflow и ссылки в изменённых process files.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: изменения ограничены repository workflow и документацией.

## Source notes
- Source file: direct conversation on 2026-08-27.
- Original note: внедрить предложения P0, P1 и P2 из аудита `docs/requirements`.
