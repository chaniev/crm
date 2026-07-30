# TASK-017: Сохранять состояние списка при возврате из карточки клиента

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-07-27 20:56
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/TASK-017-client-list-return-state.plan.md
- implementation_branch: fix/TASK-017-client-list-return-state
- moved_to_done_at: 2026-07-30

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
- [x] Возврат из карточки восстанавливает поиск.
- [x] Возврат восстанавливает фильтры.
- [x] Возврат восстанавливает выбранного клиента и позицию списка.
- [x] Прямая навигация в карточку клиента продолжает работать.

## Test checklist
- [x] Запустить `cd frontend && npm run lint`.
- [x] Запустить `cd frontend && npm run build`.
- [x] Добавить или обновить Playwright test на поиск, фильтры, карточку и возврат.

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
