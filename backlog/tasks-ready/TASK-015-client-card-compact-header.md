# TASK-015: Сделать верх карточки клиента компактнее

## Status
ready

## Goal
Карточка клиента быстрее сканируется: ключевые данные видны в компактном верхнем блоке без лишнего визуального шума.

## Context
Нужно сделать верх карточки клиента более компактным: ФИО, телефон, статус, текущий абонемент, дата окончания, последнее посещение, группа.

## User role
администратор / тренер

## Problem
Верх карточки клиента занимает слишком много места или не помогает быстро понять состояние клиента.

## Scope
- Найти frontend-компонент карточки клиента.
- Перекомпоновать верхний блок под компактное отображение ключевых данных.
- Сохранить читаемость на desktop/tablet/mobile.
- Добавить или обновить frontend checks.

## Out of scope
- Изменение backend модели клиента.
- Изменение правил статуса, абонемента или посещений.
- Переработка всех вкладок карточки.

## Constraints
- Frontend не должен вычислять CRM domain rules, которые принадлежат backend.
- Не дублировать одно и то же состояние в нескольких местах.
- Для заметного UX-изменения перед implementation желательно привлечь `ui-designer`.

## Acceptance criteria
- [ ] В верхнем блоке видны ФИО, телефон, статус, текущий абонемент, дата окончания, последнее посещение и группа.
- [ ] Блок стал компактнее без потери читаемости.
- [ ] На mobile данные не перекрываются и не ломают layout.
- [ ] Existing client detail flow продолжает открываться без регрессий.

## Test checklist
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Вручную проверить карточку клиента на desktop и mobile.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: локальная frontend layout-задача без изменения domain rules.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/inbox/2026-05-05.md`
- Original note: `Сделать верх карточки клиента более компактным: ФИО; телефон; статус; текущий абонемент; дата окончания; последнее посещение; группа.`

## Processing notes
- Created at: 2026-05-07 11:26
- Created by skill: codex-backlog-skill
- Duplicate check: existing task folders were empty before processing; no duplicate found.
