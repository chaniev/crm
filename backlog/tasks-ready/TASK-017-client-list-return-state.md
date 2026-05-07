# TASK-017: Сохранять состояние списка при возврате из карточки клиента

## Status
ready

## Goal
Пользователь возвращается из карточки клиента к тому же списку, поиску, фильтрам, выбранному клиенту и позиции прокрутки.

## Context
Нужно сделать возврат к списку клиентов с сохранением поиска, фильтров, выбранного клиента и позиции в списке.

## User role
администратор / тренер

## Problem
После просмотра карточки пользователь теряет контекст списка и вынужден заново искать клиента.

## Scope
- Найти routing/state management списка клиентов.
- Сохранить search, filters, selected client и scroll/list position.
- Восстановить состояние при возврате.
- Добавить regression test на основной сценарий.

## Out of scope
- Изменение backend поиска и фильтрации.
- Переработка всей навигации приложения.

## Constraints
- State restoration не должен ломать прямую ссылку на карточку клиента.
- Не хранить персональные данные в неподходящем persistent storage без необходимости.
- Поведение должно быть предсказуемым после reload.

## Acceptance criteria
- [ ] Возврат из карточки восстанавливает поиск.
- [ ] Возврат восстанавливает фильтры.
- [ ] Возврат восстанавливает выбранного клиента и позицию списка.
- [ ] Прямая навигация в карточку клиента продолжает работать.

## Test checklist
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Добавить или обновить Playwright test на поиск, фильтры, карточку и возврат.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: локальная frontend state/navigation задача.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/inbox/2026-05-05.md`
- Original note: `Сделать возврат к списку клиентов с сохранением поиска, фильтров, выбранного клиента и позиции в списке.`

## Processing notes
- Created at: 2026-05-07 11:26
- Created by skill: codex-backlog-skill
- Duplicate check: existing task folders were empty before processing; no duplicate found.
