# TASK-021: Проверить responsive и Playwright-покрытие карточки клиента

## Status
ready

## Goal
Карточка клиента и связанные form/detail сценарии стабильно работают на tablet и mobile после UI-изменений.

## Context
Нужно проверить detail/form сценарии на tablet и mobile после введения вкладок, убедиться, что действия карточки не переносятся хаотично и не перекрывают друг друга. Для заметных UX-изменений нужно добавить или обновить Playwright-тесты на поиск клиента, фильтры, открытие карточки, сохранение фильтров при возврате, quick actions и мобильный режим.

## User role
администратор / тренер

## Problem
После redesign карточки клиента возможны responsive-регрессии и поломки основных сценариев.

## Scope
- Проверить tablet/mobile layout client detail/form.
- Добавить или обновить Playwright coverage для перечисленных сценариев.
- Зафиксировать явные viewport sizes в тестах.
- Убедиться, что actions не перекрываются.

## Out of scope
- Реализация вкладок или quick actions в этой задаче.
- Изменение backend contracts.

## Constraints
- Тесты должны проверять пользовательские сценарии, а не внутреннюю структуру компонентов.
- Не делать flaky assertions на пиксельные детали без необходимости.

## Acceptance criteria
- [ ] Tablet и mobile viewports не имеют перекрытий действий.
- [ ] Playwright покрывает поиск, фильтры, открытие карточки и возврат с сохранением состояния.
- [ ] Playwright покрывает основные quick actions.
- [ ] Playwright покрывает мобильный режим карточки клиента.

## Test checklist
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Запустить frontend e2e checks по принятому проектному сценарию.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: задача про verification и regression coverage frontend UI.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/inbox/2026-05-05.md`
- Original note: `Responsive: проверить detail/form сценарии на tablet и mobile ... Для заметных UX-изменений добавить или обновить Playwright-тесты ...`

## Processing notes
- Created at: 2026-05-07 11:26
- Created by skill: codex-backlog-skill
- Duplicate check: existing task folders were empty before processing; no duplicate found.
