# TASK-019: Разделить карточку клиента на вкладки

## Status
ready

## Goal
Карточка клиента разделена на понятные вкладки, чтобы пользователь быстро находил обзор, абонементы, посещения, группы, контакты и историю.

## Context
В inbox предложены вкладки: `Обзор`, `Абонемент и оплата`, `Посещения`, `Группы`, `Контакты`, `История` с соответствующим наполнением.

## User role
администратор / тренер

## Problem
Карточка клиента перегружена и смешивает разные сценарии в одном пространстве.

## Scope
- Спроектировать tabs layout в текущем frontend style.
- Разнести существующие блоки по вкладкам.
- Сохранить быстрые действия и ключевые данные в ожидаемых местах.
- Проверить responsive behavior.

## Out of scope
- Изменение backend contracts.
- Добавление новых доменных правил абонементов, оплат или посещений.
- Полная redesign-система приложения.

## Constraints
- Значимое UX-изменение: перед implementation желательно привлечь `ui-designer`.
- Frontend не должен дублировать CRM domain rules.
- Вкладки должны быть доступны с клавиатуры и не ломать mobile.

## Acceptance criteria
- [ ] Есть вкладки `Обзор`, `Абонемент и оплата`, `Посещения`, `Группы`, `Контакты`, `История`.
- [ ] Каждый существующий блок перенесен в логичную вкладку или явно убран как дубликат.
- [ ] Mobile/tablet layout не перекрывает действия и контент.
- [ ] Состояние выбранной вкладки ведет себя предсказуемо при навигации.

## Test checklist
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Добавить или обновить Playwright test на открытие карточки и основные вкладки.
- [ ] Вручную проверить desktop, tablet и mobile.

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: значимая, но в основном frontend UI-структура; риск снижается сохранением backend contracts.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/inbox/2026-05-05.md`
- Original note: `Разделить карточку на вкладки: Обзор; Абонемент и оплата; Посещения; Группы; Контакты; История.`

## Processing notes
- Created at: 2026-05-07 11:26
- Created by skill: codex-backlog-skill
- Duplicate check: existing task folders were empty before processing; no duplicate found.
