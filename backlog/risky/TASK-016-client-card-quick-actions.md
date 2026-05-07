# TASK-016: Довести быстрые действия в карточке клиента

## Status
risky

## Goal
В карточке клиента доступны ожидаемые быстрые действия, а каждое действие соблюдает права, статус клиента и backend-валидацию.

## Context
Нужно довести быстрые действия: отметить посещение, новый абонемент, принять оплату, добавить в группу, редактировать, отправить в архив.

## User role
администратор / тренер

## Problem
Сейчас карточка клиента не дает быстрый доступ ко всем частым операциям или делает их недостаточно ясно.

## Scope
- Проверить существующие frontend actions и backend endpoints.
- Добавить недостающие quick action controls.
- Подключить действия к существующим flows.
- Показать disabled/unavailable state там, где действие запрещено.
- Добавить regression coverage на основные действия.

## Out of scope
- Изменение бизнес-правил посещений, абонементов, оплат, групп или архива.
- Создание новых backend semantics без отдельной contract task.

## Constraints
- Backend владеет permissions, memberships, attendance, payments и validation semantics.
- Frontend не должен сам решать, кому разрешено действие, если это не отражение backend-состояния.
- Архивация и оплата требуют особой проверки UX и прав.

## Acceptance criteria
- [ ] В карточке есть быстрые действия: отметить посещение, новый абонемент, принять оплату, добавить в группу, редактировать, отправить в архив.
- [ ] Недоступные действия не позволяют обойти backend restrictions.
- [ ] Ошибки backend отображаются через существующий error UX.
- [ ] Основные quick actions покрыты frontend tests или ручным checklist.

## Test checklist
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Проверить actions для ролей с правами и без прав.
- [ ] Проверить клиента без абонемента, с абонементом и в архиве.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача затрагивает посещаемость, абонементы, оплату, группы, архив и permissions.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/inbox/2026-05-05.md`
- Original note: `Довести быстрые действия в карточке: отметить посещение; новый абонемент; принять оплату; добавить в группу; редактировать; отправить в архив.`

## Processing notes
- Created at: 2026-05-07 11:26
- Created by skill: codex-backlog-skill
- Duplicate check: existing task folders were empty before processing; no duplicate found.
