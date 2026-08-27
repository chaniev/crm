---
name: codex-backlog-skill
description: Reconcile existing backlog task statuses and transform raw backlog inbox notes into structured AI-ready tasks. Use when Codex needs to actualize backlog state against the integrated repository baseline, triage backlog/inbox, prevent duplicate tasks, preserve source traceability, or update backlog status and triage logs.
---

# Codex Inbox → Tasks Skill

## Purpose

Transform raw notes from `/backlog/inbox` into structured AI-ready markdown tasks.

This skill is designed for AI-assisted development workflows with Codex / ChatGPT.

Main goals:

- actualize existing task statuses before reading new inbox notes;
- quickly capture raw ideas without over-formatting them;
- convert chaotic inbox notes into executable tasks;
- separate safe tasks from risky or unclear work;
- avoid duplicate task generation;
- connect every task to accepted product requirements or record why requirement
  metadata is intentionally `none`/`pending`;
- preserve traceability from raw note to generated task;
- keep `/backlog/inbox` clean by moving processed notes through a lifecycle.

---

## Expected project structure

```text
/backlog
    /inbox
    /processing
    /processed

    /tasks-ready
    /needs-clarification
    /risky
    /implementation
    /implementation-plans
    /done

    /logs
```

If any folder does not exist, create it.

---

## Folder meaning

### `/backlog/inbox`

Raw incoming notes.

This folder is for fast capture only.

Examples:

```text
- тренеры не замечают перенос тренировки
- поиск клиентов слишком медленный
- mobile layout разваливается
- Codex снова ломает migrations
```

Do not expect inbox notes to be complete, structured, or ready for implementation.

---

### `/backlog/processing`

Temporary working folder.

Before processing an inbox file, move it from:

```text
/backlog/inbox
```

to:

```text
/backlog/processing
```

This prevents the same file from being processed twice during the same run.

---

### `/backlog/processed`

Archive of already processed inbox notes.

After all tasks are successfully generated and the triage log is updated, move the source note from:

```text
/backlog/processing
```

to:

```text
/backlog/processed
```

Never delete processed notes.

---

### `/backlog/tasks-ready`

Tasks that are clear, local, and safe enough to give to Codex.

Use this folder when:

- the problem is understandable;
- the scope is reasonably clear;
- the task is local;
- the task does not touch dangerous areas;
- Codex can likely implement it with normal review.

Typical examples:

- UI improvements;
- forms;
- small CRUD changes;
- table layout fixes;
- validation;
- tests;
- local refactoring;
- small UX improvements.

---

### `/backlog/risky`

Tasks that may affect critical business logic, data, security, migrations, money, or system reliability.

Use this folder when:

- a mistake can break a critical workflow;
- hidden business rules are likely;
- the task touches data migrations;
- the task touches billing, payments, subscriptions, or training write-offs;
- the task touches auth, permissions, roles, or security;
- the task changes scheduling rules;
- rollback may be difficult;
- production data may be affected.

Risky tasks are not rejected. They require decomposition, human review, and guardrails before implementation.

---

### `/backlog/needs-clarification`

Tasks that are too vague or incomplete.

Use this folder when:

- the problem is unclear;
- the expected behavior is unclear;
- the affected screen or user role is unclear;
- reproduction steps are missing for a bug;
- the task says only “make better”, “fix UX”, “optimize”, or similar;
- Codex would need to invent missing requirements.

These tasks should contain explicit questions that need to be answered before the task can move to `tasks-ready` or `risky`.

---

### `/backlog/logs`

Processing logs.

The main log file is:

```text
/backlog/logs/triage-log.md
```

Every run must append a new entry.

---

## Classification rules

Use the following decision tree:

```text
Is the problem understandable?
  └─ no → needs-clarification

Is the expected result understandable?
  └─ no → needs-clarification

Is the scope reasonably bounded?
  └─ no → needs-clarification

Is the product behavior linked to an accepted REQ-*?
  └─ no, product decision missing → needs-clarification + pending

Does the task touch risky areas?
  └─ yes → risky

Is it local and safe for Codex?
  └─ yes → tasks-ready

Otherwise:
  └─ needs-clarification
```

---

## Risky areas

Classify as `risky` if the task touches any of these areas:

- database migrations;
- destructive data operations;
- authentication;
- authorization;
- roles and permissions;
- billing;
- payments;
- subscriptions;
- training write-offs;
- financial reports;
- schedule conflict logic;
- concurrency;
- queues;
- background jobs;
- caching correctness;
- production deployment;
- rollback behavior;
- import/export of user or payment data.

For the sports CRM project, pay special attention to:

- memberships and subscriptions;
- visit write-offs;
- trainer schedule;
- client payments;
- freeze/unfreeze logic;
- administrator and trainer permissions.

---

## Idempotency rules

Before creating a new task file, check existing tasks in:

```text
/backlog/tasks-ready
/backlog/risky
/backlog/needs-clarification
/backlog/implementation
/backlog/done
```

Look for similar tasks by:

- title;
- keywords;
- user flow;
- source notes;
- problem statement.

If a matching task already exists:

1. Do not create a duplicate task.
2. Update the existing task by appending the new source note under `## Source notes`.
3. Add a short note under `## Processing notes`.
4. Record this in `/backlog/logs/triage-log.md`.

If unsure whether it is a duplicate, create a new task in `/backlog/needs-clarification` with a note explaining the possible overlap.

---

## Task file naming

Use this format:

```text
TASK-001-short-name.md
TASK-002-short-name.md
TASK-003-short-name.md
```

Rules:

- Use the next available number across all task folders.
- Do not reuse numbers.
- Use lowercase English slugs for filenames.
- Keep filenames short.
- The title inside the file may be in Russian.

Example:

```text
TASK-014-client-search-speed.md
```

---

## Task file template

Every generated task must use this structure:

```md
# TASK-XXX: Название задачи

## Status
ready / risky / needs-clarification

## Requirements
- REQ-XXX-000 — implements | changes | constrains | verifies
<!-- or: none — concrete behavior-preserving reason -->
<!-- or, only in needs-clarification: pending — missing product decision -->

## Goal
Что должно измениться для пользователя.

## Context
Что известно из inbox.

## User role
Администратор / тренер / владелец / система / неизвестно.

## Problem
Какая проблема решается.

## Scope
Что входит в задачу.

## Out of scope
Что НЕ нужно делать.

## Constraints
Что нельзя менять или ломать.

## Acceptance criteria
- [ ] Критерий 1
- [ ] Критерий 2
- [ ] Критерий 3

## Test checklist
- [ ] Что проверить вручную
- [ ] Какие тесты добавить или обновить

## AI safety
- Safe for Codex: yes/no
- Risk level: low/medium/high
- Reason:

## Clarification questions
Заполнять только для needs-clarification.

- [ ] Вопрос 1
- [ ] Вопрос 2

## Source notes
- Source file:
- Original note:

## Processing notes
- Created at:
- Created by skill:
- Duplicate check:
```

---

## Execution prompt

```text
Сначала актуализируй статусы существующих задач, затем проанализируй содержимое папки /backlog/inbox и создай готовые markdown-файлы задач.

Цель:
сверить backlog с актуальным состоянием интегрированной кодовой базы, а затем превратить сырые заметки из inbox в отдельные AI-ready задачи с сохранением traceability и защитой от повторной обработки.

Обязательный lifecycle:

1. До чтения или перемещения файлов из /backlog/inbox актуализируй статусы существующих задач:
   - прочитай repository instructions и /backlog/README.md;
   - выполни audit в текущем coordination workspace: не создавай и не переключай отдельную ветку или worktree только ради актуализации статусов;
   - определи integrated baseline, предпочтительно origin/main, и сверь с ним задачи в /backlog/tasks-ready, /backlog/risky, /backlog/needs-clarification и /backlog/implementation по коду, Git history, веткам/worktrees, plans и явным продуктовым решениям;
   - проверь соответствие поля ## Status каталогу, уникальность активных TASK-ID, корректность ссылок из plans и наличие незакрытых обязательных вопросов;
   - переводи задачу и ее plan в /backlog/done только при достаточном evidence выполнения goal и acceptance criteria; наличие plan, ветки, worktree, commit message или частичной реализации само по себе недостаточно;
   - не меняй код проекта; используй только необходимые read-only checks и validation;
   - добавь отдельную запись `status audit` в /backlog/logs/triage-log.md с baseline, scope, evidence, изменениями, неизмененными активными задачами, consistency checks, counts и validation; явно зафиксируй нулевой результат, если изменений нет;
   - заверши audit до проверки, пуст ли inbox, и выполняй его даже при пустом inbox.

2. Убедись, что существуют папки:
   - /backlog/inbox
   - /backlog/processing
   - /backlog/processed
   - /backlog/tasks-ready
   - /backlog/needs-clarification
   - /backlog/risky
   - /backlog/implementation
   - /backlog/implementation-plans
   - /backlog/done
   - /backlog/logs

3. Найди все markdown-файлы в /backlog/inbox.

4. Если /backlog/inbox пуст:
   - не создавай задачи;
   - обнови /backlog/logs/triage-log.md;
   - напиши, что новых inbox-файлов нет;
   - покажи tree /backlog.

5. Для каждого inbox-файла:
   - перемести файл из /backlog/inbox в /backlog/processing;
   - прочитай содержимое файла;
   - сгруппируй похожие идеи;
   - удали дубликаты внутри одного inbox-файла;
   - классифицируй каждую группу как:
     - tasks-ready
     - risky
     - needs-clarification

6. Перед созданием каждой задачи проверь существующие файлы в:
   - /backlog/tasks-ready
   - /backlog/risky
   - /backlog/needs-clarification
   - /backlog/implementation
   - /backlog/done

   Нужно проверить, не существует ли уже похожая задача.

7. Если похожая задача уже существует:
   - не создавай дубликат;
   - добавь новую исходную заметку в раздел ## Source notes существующей задачи;
   - добавь запись в ## Processing notes;
   - отрази это в /backlog/logs/triage-log.md.

8. Если похожей задачи нет:
   - создай новый TASK-XXX-short-name.md в соответствующей папке;
   - используй общий шаблон задачи;
   - сопоставь поведение с `docs/requirements/**`;
   - используй только требования с решением `принято` для `tasks-ready` и
     `risky`; новая карточка `предложено` оставляет задачу в
     `needs-clarification` до явного approval;
   - используй `none` только для behavior-preserving работы с причиной, а
     `pending` — только для незакрытого продуктового решения;
   - заполни все обязательные разделы.

9. После успешного создания или обновления всех задач из inbox-файла:
   - перемести этот файл из /backlog/processing в /backlog/processed;
   - добавь в начало processed-файла metadata-блок:

---
status: processed
processed_at: YYYY-MM-DD HH:mm
generated_tasks:
  - TASK-XXX-short-name.md
  - TASK-YYY-short-name.md
updated_existing_tasks:
  - TASK-ZZZ-short-name.md
---

   Если metadata уже есть, не дублируй его, а обнови аккуратно.

10. Обнови /backlog/logs/triage-log.md.

Формат записи в triage-log.md:

# YYYY-MM-DD HH:mm

## Processed inbox files
- filename.md

## Created tasks
- /backlog/tasks-ready/TASK-XXX-short-name.md
- /backlog/risky/TASK-YYY-short-name.md
- /backlog/needs-clarification/TASK-ZZZ-short-name.md

## Updated existing tasks
- /backlog/tasks-ready/TASK-AAA-existing-task.md

## Skipped duplicates
- краткое описание

## Summary
- tasks-ready: N
- risky: N
- needs-clarification: N
- updated existing: N
- processed files: N

11. Не меняй код проекта.
12. Не удаляй исходные заметки.
13. Не оставляй успешно обработанные файлы в /backlog/inbox.
14. Не перемещай файл в /backlog/processed, если задачи не были созданы или обновлены из-за ошибки.
15. Если выполнение прервано, файл должен остаться в /backlog/processing.

Финальная проверка обязательна:

1. Покажи результат status audit: baseline, evidence, измененные статусы и неизмененные активные задачи.
2. Покажи tree /backlog.
3. Покажи список созданных TASK-файлов.
4. Покажи список обновленных существующих TASK-файлов.
5. Покажи список файлов, перемещенных в /backlog/processed.
6. Покажи количество задач:
   - tasks-ready
   - risky
   - needs-clarification
   - implementation
7. Подтверди:
   - status audit завершен до анализа inbox и не потребовал новой ветки или worktree;
   - /backlog/inbox содержит только необработанные новые заметки;
   - успешно обработанные файлы перемещены в /backlog/processed;
   - исходные заметки не удалены;
   - triage-log.md обновлен;
   - requirements metadata присутствует, все `REQ-*` существуют, а
     `предложено` не попало в ready/implementation workflow;
   - дубликаты не созданы намеренно.
8. Если задачи не были созданы и не были обновлены при наличии inbox-файлов — это ошибка выполнения.
```

---

## Recommended workflow

1. Quickly add raw notes into `/backlog/inbox`.
2. Run this skill.
3. Review generated tasks in:
   - `/backlog/tasks-ready`
   - `/backlog/risky`
   - `/backlog/needs-clarification`
4. Take one task from `/backlog/tasks-ready`.
5. Send that task to Codex for implementation.
6. After implementation, add regression barriers.
7. Keep `/backlog/processed` as product history.

---

## Recommended usage prompt

```text
Используй skill:
.codex/skills/codex-backlog-triage/SKILL.md

Выполни triage backlog:
- обработай /backlog/inbox
- создай или обнови TASK-файлы
- перемести обработанные inbox-файлы в /backlog/processed
- обнови /backlog/logs/triage-log.md
- выполни финальную проверку
```

---

## Recommended companion files

```text
/context
    architecture.md
    ux_rules.md
    ai_safe.md
    coding_rules.md

/backlog
    REVIEW_CHECKLIST.md
    AI_SAFE.md
```

---

## Best practices

- Keep inbox chaotic.
- Keep execution tasks small.
- Prefer scenario-based tasks.
- Do not give vague tasks directly to Codex.
- Do not allow Codex to invent missing requirements.
- Do not treat a newly proposed requirement as approved implementation scope.
- Move unclear work to `needs-clarification`.
- Move dangerous work to `risky`.
- Add guardrails after incidents.
- Preserve processed notes.
- Keep traceability from source note to generated task.
- Avoid duplicate task generation.
