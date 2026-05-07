# TASK-004: Добавить порционную выдачу roster посещаемости в Telegram-боте

## Status
ready

## Goal
Большие группы в Telegram-боте открываются без превышения лимитов сообщений и callback-кнопок.

## Context
Для roster посещаемости нужна порционная выдача, чтобы большие группы не упирались в лимиты Telegram-сообщений и callback-кнопок.

## User role
тренер / администратор

## Problem
Список участников большой группы может не помещаться в Telegram UI и ломать сценарий отметки посещаемости.

## Scope
- Найти текущий сценарий roster посещаемости в `bot/`.
- Добавить пагинацию или chunked rendering для списка участников.
- Сохранить корректную callback-навигацию между страницами.
- Добавить tests на большую группу.

## Out of scope
- Изменение правил посещаемости.
- Изменение состава группы или backend-запросов без необходимости.

## Constraints
- Не дублировать attendance domain logic вне backend.
- Callback data должна оставаться в лимитах Telegram.
- Навигация не должна сбрасывать выбранную дату и группу.

## Acceptance criteria
- [ ] Большая группа разбивается на страницы или порции.
- [ ] Пользователь может перейти вперед и назад между порциями.
- [ ] Отметка посещаемости работает для клиента с любой страницы.
- [ ] Scenario tests покрывают группу, которая раньше превышала UI-лимиты.

## Test checklist
- [ ] Запустить `cd bot && ruff check .`.
- [ ] Запустить `cd bot && pytest`.
- [ ] Вручную проверить roster большой группы в Telegram.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: локальная UI/flow-задача бота без изменения доменных правил.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/inbox/2026-05-04.md`
- Original note: `Добавить порционную выдачу roster посещаемости, чтобы большие группы не упирались в лимиты Telegram-сообщений и callback-кнопок.`

## Processing notes
- Created at: 2026-05-07 11:26
- Created by skill: codex-backlog-skill
- Duplicate check: existing task folders were empty before processing; no duplicate found.
