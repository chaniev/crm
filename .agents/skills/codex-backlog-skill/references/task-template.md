# Backlog task template

Use when creating a card. Fill only applicable optional sections, while keeping
requirements, goal, scope, acceptance, source traceability, and processing
metadata. Follow `backlog/AGENTS.md` for status and requirements rules.

```markdown
# TASK-NNN: Название задачи

## Status
tasks-ready / risky / needs-clarification

## Requirements
- REQ-XXX-000 — implements | changes | constrains | verifies
<!-- Or: none — concrete behavior-preserving reason. -->
<!-- Or, only in needs-clarification: pending — missing product decision. -->

## Goal
Наблюдаемый пользовательский или системный результат.

## Context
Существенный контекст из исходных заметок и связанного evidence.

## User role
Затронутый пользователь или система, когда это влияет на сценарий.

## Problem
Подтверждённая проблема и её последствия.

## Scope
Границы задачи.

## Out of scope
Только существенные исключения.

## Constraints
Ограничения, влияющие на решение.

## Acceptance criteria
- [ ] Наблюдаемый результат.

## Test checklist
- [ ] Проверки конкретного поведения или контракта, без копии общей матрицы.

## AI safety
- Safe for autonomous implementation: yes/no
- Risk level: low/medium/high
- Reason: конкретный механизм риска или обоснование его отсутствия.
<!-- For risky work, specify required review and stop conditions here. -->
<!-- This assessment does not authorize implementation without a ready plan. -->

## Clarification questions
<!-- Only for needs-clarification. -->
- [ ] Конкретное отсутствующее решение и зависимое от него поведение.

## Source notes
- Source file: путь к сохранённой исходной заметке.
- Original note: исходный текст без подмены смысла.

## Processing notes
- Created at: YYYY-MM-DD HH:mm
- Created by skill: codex-backlog-skill
- Duplicate check: проверенные связи и результат.
```

Replace examples with actual values; select one status and put the card in its
matching directory. Omit empty optional sections rather than copying a blank
checklist. Preserve concrete risk, unresolved-question, and source evidence.
