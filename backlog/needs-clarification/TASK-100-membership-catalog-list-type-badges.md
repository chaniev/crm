# TASK-100: Уточнить отображение типа абонемента в каталоге

## Status
needs-clarification

## Goal
Каталог абонементов не повторяет тип рядом с названием и одновременно не скрывает системную семантику `Professional`, которая может влиять на решение пользователя.

## Context
В строке каталога рядом с названием выводится generic behavior badge (`Разовый`, `На срок` или `Профессиональный`). Для `Professional` дополнительно выводится ещё одна метка `Профессиональный`, поэтому текст повторяется.

Пользователь просит убрать тип из списка и удалить повтор. Однако завершённая TASK-070 требует, чтобы главный тренер видел системный `Professional` как заметную метку даже после переименования каталожного варианта.

## User role
Суперадминистратор / главный тренер / администратор с доступом к каталогу своего филиала.

## Problem
Текущая строка создаёт визуальный дубль, но полное удаление меток без продуктового решения может скрыть единственный признак особого системного поведения переименованного `Professional`.

## Scope
После уточнения:
- убрать generic behavior/type badges из list rows каталога;
- выбрать и закрепить один вариант для `Professional`: удалить все type badges либо сохранить ровно одну exceptional system badge;
- обновить row hierarchy и component regression tests;
- сохранить название, цену, период доступности и edit action.

## Out of scope
- Удаление выбора `Поведение` из create form.
- Изменение backend `behaviorKind`, Professional privileges, seed, permissions или contracts.
- Разрешение администратору создавать/редактировать системный `Professional`.
- Изменение immutable behavior semantics в edit flow.

## Constraints
- Frontend не выводит Professional semantics из названия.
- Нельзя противоречить backend-owned membership behavior или завершённому продуктовому контракту TASK-070.
- Любая сохранённая exceptional badge должна появляться один раз и не дублировать generic type.

## Acceptance criteria
- [ ] Generic type badge не повторяет очевидный тип рядом с названием.
- [ ] В строке Professional отсутствует повторяющийся текст `Профессиональный`.
- [ ] Согласованное представление Professional закреплено component test.
- [ ] Название, цена, период доступности и edit action сохранены.
- [ ] Create/edit forms и backend behavior contracts не изменены.
- [ ] На 390 x 844, 420 x 912, 440 x 956, 768 x 1024 и 1440 x 1200 строка не получает horizontal scroll или clipping.

## Test checklist
- [ ] Добавить list-row cases для `SingleVisit`, `Term` и `Professional`.
- [ ] Проверить точное количество видимых type/system badges после продуктового решения.
- [ ] Проверить, что create form по-прежнему содержит выбор поведения для разрешённых типов.
- [ ] Запустить frontend unit tests, lint и build после перевода задачи в ready.

## AI safety
- Safe for Codex: no
- Risk level: medium
- Reason: без уточнения UI может скрыть обязательную системную семантику Professional или нарушить принятый в TASK-070 продуктовый контракт.

## Clarification questions
- [ ] Удалить из list rows все behavior/type badges, включая единственную специальную метку `Профессиональный`?
- [ ] Или удалить generic badge для всех типов, но сохранить ровно одну exceptional system badge `Профессиональный`?
- [ ] Если название варианта само равно `Профессиональный`, должна ли отдельная system badge всё равно оставаться видимой?

## Source notes
- Source file: `backlog/processed/2026-07-27-2.md`
- Original note: `В списке абонементов рядом с названием отображается тип абонемента. Этот текст лишний и должен быть удалён.`
- Original note: `Рядом с названием профессионального абонемента текст «Профессиональный» отображается два раза — повтор необходимо удалить.`
- Related completed task: `backlog/done/TASK-070-membership-catalog.md`.

## Processing notes
- Created at: 2026-07-27 01:04
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- Duplicate check: TASK-070 определяет domain/UI visibility системного Professional, но не устраняет текущий двойной badge; возможный конфликт требует продуктового ответа.
