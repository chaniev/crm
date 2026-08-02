# TASK-105: Определить access-management контракт реестра тренеров

## Status
needs-clarification

## Goal
Пользователь с правом управления сотрудниками видит в реестре достаточно данных, чтобы найти исключительное состояние доступа и выбрать правильное разрешённое действие.

## Context
После TASK-096 реестр поддерживает поиск по ФИО и логину. После TASK-098 обычные positive badges намеренно скрыты, а decision-changing исключения сохранены. Аудит 2026-08-02 предлагает добавить фильтры role, active, password rotation и Telegram link state, compact status metadata и определить row primary operation, но не задаёт, какие роли должны находиться в экране `Тренеры` и какие поля/действия разрешены каждой управляющей роли.

## User role
SuperAdministrator / HeadCoach / Administrator — точная access matrix требует уточнения.

## Problem
Текущий список хорошо ищет identity, но не оформлен как однозначный access-management workflow. Без продуктового и backend-контракта frontend может раскрыть лишние состояния, вернуть удалённый визуальный шум или вывести действие, недоступное пользователю.

## Scope
- Определить назначение экрана: trainer-only registry или staff/access registry.
- Зафиксировать доступные управляющие роли и backend-owned access scope.
- Определить decision-changing фильтры и row metadata для active, password rotation, Telegram link и role state.
- Определить primary row operation и exceptional actions для каждой разрешённой роли/состояния.
- Проверить, какие фильтры и поля уже доступны в backend contract, а какие требуют отдельного contract change.
- После ответов разделить работу на безопасную frontend-задачу и, при необходимости, отдельную risky backend/authorization задачу.

## Out of scope
- Немедленное добавление role/permission logic во frontend.
- Изменение ролей, permissions, password policy или Telegram linking semantics без отдельного backend-контракта.
- Возврат обычных меток `Тренер`, `Активен` и `Пароль актуален`, удалённых TASK-098.
- Изменение create/edit flow до определения primary row operation.

## Constraints
- Backend владеет roles, permissions, visible staff scope, password state и Telegram link semantics.
- Frontend не должен выводить доступ или разрешённые действия из названия роли.
- Normal/default states не конкурируют с исключительными состояниями; статус показывается текстом, а не только цветом.
- Search, filter trigger, refresh и create должны оставаться в одной non-wrapping строке на `390/420/440px`, сохраняя полезную ширину поиска и touch targets `44 x 44px`.

## Acceptance criteria
- [ ] Зафиксировано, является экран trainer-only или общим staff/access registry.
- [ ] Для каждой управляющей роли определены видимые записи, фильтры, metadata и allowed actions.
- [ ] Обычные positive states и decision-changing exceptions разделены явно и не противоречат TASK-098.
- [ ] Определено, какие данные и фильтрация принадлежат backend contract.
- [ ] Primary row operation определена для editable и read-only записей.
- [ ] После уточнения подготовлены отдельные bounded задачи без дублирования permission rules во frontend.

## Test checklist
- [ ] Зафиксировать role/scope matrix для component и integration tests.
- [ ] Проверить отсутствие данных и действий вне backend-permitted response.
- [ ] Проверить active/password/Telegram exception states и read-only row.
- [ ] Проверить active filters, reset, empty-search и recovery.
- [ ] Проверить toolbar и строки на `390 x 844`, `420 x 912`, `440 x 956`, compact landscape и `1440 x 1200`.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача затрагивает роли, permissions, password rotation и Telegram identity; текущая product/access matrix и граница backend contract не определены.

## Clarification questions
- [ ] Экран `Тренеры` должен оставаться trainer-only или показывать другие staff roles?
- [ ] Какие роли могут просматривать и изменять active, password rotation и Telegram link state?
- [ ] Какие normal и exceptional состояния нужны в строке, а какие только в фильтре/details?
- [ ] Какое действие является primary для editable row и что показывать для read-only row?
- [ ] Должна ли фильтрация выполняться server-side и поддерживает ли текущий API все требуемые поля?

## Source notes
- Source file: `backlog/processed/2026-08-02.md`
- Original note: `UX-2026-08-02-04 — довести реестр тренеров до access-management сценария`.
- Evidence: `backlog/processed/assets/2026-08-02-usability-audit/annotated-users-440x956.png`.

## Processing notes
- Created at: 2026-08-02 14:44
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- Duplicate check: активного дубликата нет; завершённые TASK-096 и TASK-098 являются обязательным baseline и частично ограничивают предлагаемое решение.
- Classification: needs-clarification выбрана раньше risky по decision tree, потому что ожидаемый registry scope и permission matrix не определены; после уточнения backend/authorization часть останется risky.
