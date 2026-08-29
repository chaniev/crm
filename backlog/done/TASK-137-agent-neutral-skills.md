# TASK-137: Нормализовать skills и нейтрализовать agent safety metadata

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-29
- implementation_branch: refactor/TASK-137-agent-neutral-skills
- implementation_state: completed
- completed_at: 2026-08-29

## Goal
Сделать активные skill bundles структурно корректными и убрать из общих
workflow-ограничений смысловую привязку к конкретному coding agent.

## Scope
- Добавить обязательный YAML frontmatter отсутствующему skill.
- Привести имена каталогов skills в соответствие с полем `name`.
- Исправить устаревшие ссылки на расположение skills.
- Заменить vendor-specific session label на нейтральный `coding-agent session`.
- Заменить vendor-specific safety label на `Safe for autonomous implementation` в активных
  backlog tasks и в актуальном шаблоне triage skill.
- Проверить все repository-local skills валидатором `skill-creator`.

## Out of scope
- Claude Code, OpenCode, Zed или ZCode adapters.
- Перенос specialist definitions из `.codex/agents`.
- Переписывание исторических записей в `backlog/done`, `processed` и `logs`.
- Изменение CRM product/runtime behavior.

## Requirements
- none — нормализация developer workflow не меняет поведение CRM.

## Acceptance criteria
- [x] Каждый `.agents/skills/*/SKILL.md` имеет корректный frontmatter.
- [x] `name` каждого skill совпадает с именем каталога.
- [x] В активных skills нет ссылок на устаревшее vendor-specific расположение.
- [x] Активные правила используют нейтральные session и safety labels.
- [x] Requirements validator и change-aware harness selection проходят.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: low
- Reason: изменения ограничены инструкциями и metadata developer workflow.

## Validation
- Все 11 repository-local skills прошли официальный `quick_validate.py` из
  `skill-creator`; имена каталогов совпадают с `name` во frontmatter.
- `python3 scripts/harness/verify_change.py --profile full` — passed:
  requirements, 23 harness tests, backend restore/format/build, 512 backend
  tests, dependency audit, frontend install/audit/lint/typecheck/unit/build,
  580 frontend tests, bot sync/lint/format/types, 65 bot tests, обе Compose
  configurations и shell syntax checks.
- Активные инструкции, skills и незавершённые backlog tasks не содержат старых
  vendor-specific session/safety labels или прежних путей переименованных
  skill bundles. Исторические записи в `backlog/done` и `backlog/logs`
  намеренно сохранены без переписывания.
