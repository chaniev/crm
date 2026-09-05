---
name: tasks-ready-to-implementation
description: "Выбрать готовые backlog tasks, перевести их в implementation и создать компактные test-first implementation plans без дублирования AGENTS.md, worktree, agent и validation правил. Использовать для подготовки одной задачи или небольшого batch к последующей реализации без изменения project code."
---

# Tasks ready to implementation

## Результат

Подготовить 1–3 выбранные задачи к исполнению:

1. проверить eligibility и отсутствие дубликатов;
2. переместить ready task в `backlog/implementation` или оставить risky task в
   `backlog/risky` с planning-only plan;
3. обновить lifecycle metadata;
4. создать один компактный implementation plan на задачу;
5. обновить `backlog/logs/implementation-log.md`.

Не менять project code, не создавать task branch/worktree и не реализовывать
план. Branch здесь только объявляется для будущего executor.

## Выбор задач

Если пользователь указал TASK-файлы, работать только с ними. Иначе выбрать не
более трёх задач из `backlog/tasks-ready` по impact, ясности scope, риску и
наличию реалистичного automated regression barrier.

Не готовить дубликат существующей active/done задачи или plan. Не переводить в
implementation задачу с unresolved critical product questions, полностью
неясным scope или необратимым production действием без recovery.

Каждая задача содержит `## Requirements`. Для изменения поведения использовать
существующий `REQ-*` с решением `принято` либо добавить карточку по шаблону
`docs/requirements/_шаблон-требования.md`. Новая карточка с решением
`предложено` не разрешает implementation: оставить задачу в
`backlog/needs-clarification` до явного product approval, затем записать
`принято` со ссылкой на задачу. `none` допустимо только с конкретной причиной,
что поведение не меняется. `pending` допустимо только в
`needs-clarification`. Обновление затронутых карточек и CHANGELOG входит в
definition of done executor'а.

Для отношения `changes` до перемещения задачи записать принятую целевую
редакцию в карточку, добавить history/CHANGELOG и сменить её реализацию с
`реализовано` на `частично` или `не начато`. Для `implements` карточка уже
должна описывать принятый target без изменения смысла этой задачей.

Full-stack, shared UI, migrations, payments, roles и permissions сами по себе
не являются blocker для planning. Если изменение локализуемо, создать plan и
явно описать task-specific risk. Risky task может получить plan, но остаётся в
`backlog/risky` и получает `readiness: no` до требуемого review/решения.

Если подходящей source task нет, не создавать plan из догадки и не перемещать
файлы. Записать `moved: none`, перечислить проверенные/skipped candidates и
сообщить минимальную недостающую информацию.

## Lifecycle

Для ready task:

- переместить файл из `backlog/tasks-ready` в `backlog/implementation`;
- установить `## Status` в `implementation`;
- добавить/обновить:

```md
## Implementation lifecycle
- moved_to_implementation_at: YYYY-MM-DD HH:mm
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-XXX-short.plan.md
- implementation_branch: feature/TASK-XXX-short
```

Для planning-only risky task не менять каталог/status. Добавить ссылку на plan
в существующий lifecycle/processing section только если проект уже использует
такой metadata contract.

## Правила компактного plan

Plan должен содержать только информацию, необходимую будущему executor и не
доступную дешевле из source task, `AGENTS.md`, code или project skills.

Обязательно:

- source task, branch, readiness, dependencies и task-specific risk;
- requirements metadata из source task с отношением `implements`, `changes`,
  `constrains`, `verifies` либо обоснованным `none`; `pending` в executable
  plan запрещён;
- goal и решения, реально влияющие на implementation;
- изменяемые contracts/data/UX semantics;
- bounded implementation slices;
- вероятные файлы/слои;
- конкретные tests, expected red evidence и regression barrier;
- task-specific risks и stop conditions.

Не включать:

- branch/worktree команды или planning-time SHA/worktree inventory;
- пересказ `AGENTS.md`, architecture invariants и validation matrix;
- generic agent roles — executor выберет их по ближайшему `AGENTS.md`;
- общий test-first алгоритм в каждом plan;
- generic full-stack/compatibility/commit strategy;
- одинаковые требования одновременно в `Current understanding`, execution
  steps, test coverage, test plan и regression barrier;
- длинный final checklist или поля для неприменимых миграций/стендов.

Test-first порядок задаётся этим skill один раз: executor сначала добавляет или
обновляет перечисленные в plan automated tests, подтверждает ожидаемый red по
отсутствующему поведению, затем меняет functional code и получает green. Если
baseline уже green или red неприменим, plan должен указать конкретное evidence
и не требовать искусственного failing test.

Обычно plan должен укладываться примерно в 250 строк. Сложный domain/API/data
contract может быть длиннее, но каждая семантика описывается ровно в одном
месте.

## Шаблон plan

```md
# Implementation Plan: TASK-XXX Название

## Metadata
- source_task: /backlog/implementation/TASK-XXX-short.md
- requirements: REQ-XXX-000 (implements|changes|constrains|verifies) | none — reason
- branch: feature/TASK-XXX-short
- readiness: yes | no — краткая причина, если no
- dependencies: none | TASK-YYY (условие)
- risk: low | medium | high — task-specific причина

## Goal
Измеримый пользовательский или системный результат.

## Decisions and contracts
- Только подтверждённые решения и изменяемые contracts.
- Не повторять неизменившийся source task.

## Scope
### In
- ...

### Out
- ...

## Implementation slices
1. Bounded functional slice с наблюдаемым результатом.
2. Следующий slice только при реальной зависимости.

## Likely files and layers
- `path` — зачем меняется; либо `to be discovered before editing`.

## Regression specification
### Automated tests to add or update
- Конкретный test/scenario и ожидаемое поведение.

### Expected red evidence
- Какой test должен упасть и почему; либо почему red неприменим.

### Required validation
- Только task-specific command/filter сверх обязательных checks ближайшего
  `AGENTS.md`.

### Manual evidence
- Только то, что невозможно надёжно автоматизировать.

### Regression barrier
- Один основной automated barrier, защищающий goal.

## Risks and stop conditions
- Только task-specific риск/условие остановки и минимальное решение.
```

Не создавать пустые разделы. Если task требует большой UX/domain contract,
добавить один раздел `## UX contract` или `## Domain/API contract` и не
пересказывать его в других разделах.

## Workflow

Для каждой задачи:

1. прочитать source task и проверить соответствие каталога/status;
2. найти возможные дубликаты во всех active folders и рекурсивно в `backlog/done/YYYY-MM-DD/`;
3. проверить critical questions, scope, dependencies, regression strategy и
   requirements approval state;
4. выбрать уникальную branch с префиксом `feature/`, `fix/` или `refactor/`;
5. создать plan по компактному шаблону;
6. переместить только ready task и обновить lifecycle;
7. добавить одну краткую запись в implementation log.

Формат log:

```md
# YYYY-MM-DD HH:mm
- moved: TASK-XXX | none
- planned_in_place: TASK-YYY | none
- skipped: TASK-ZZZ — причина | none
- plans: /backlog/implementation-plans/TASK-XXX-short.plan.md | none
```

## Проверка результата

Проверить:

- source/task/plan links и branch names;
- requirements metadata в task/plan, существование ID, решение `принято` и
  отсутствие `pending`; для `none` — конкретная behavior-preserving причина;
- отсутствие duplicate TASK IDs/plans;
- status и lifecycle перемещённых задач;
- наличие конкретных tests, expected-red evidence и regression barrier;
- отсутствие повторов `AGENTS.md`, worktree, agents и generic validation;
- diff ограничен backlog-файлами и, только когда создаётся/принимается
  требование, `docs/requirements/**` вместе с `CHANGELOG.md`.

В отчёте перечислить изменённые task/plan/log files и причины пропуска. Не
печатать полный tree backlog и не повторять содержание созданных plans.
