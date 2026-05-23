# TASK-051: Mobile bottom navigation

## Status
implementation

## Implementation lifecycle
- moved_to_implementation_at: 2026-05-23 13:20
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-051-mobile-bottom-navigation.plan.md
- implementation_branch: feature/TASK-051-mobile-bottom-navigation

## Goal
Спроектировать и реализовать нижнюю мобильную навигацию для CRM как отдельную all-screen задачу, а не как часть экрана `Клиенты`.

## Context
В mockups для `TASK-050` показана bottom navigation и вкладка `Уведомления`. Текущий frontend использует mobile drawer и не имеет отдельного notifications route. Поэтому `TASK-050` не должен подменять shell, добавлять fake-route или менять навигацию только на одном экране.

## Scope
- Проанализировать текущий mobile shell и разрешенные разделы пользователя.
- Спроектировать bottom navigation для всех мобильных экранов CRM.
- Определить, какие разделы попадают в нижнюю навигацию, а какие остаются в меню.
- Сохранить permissions/allowedSections behavior из backend/session.
- Не добавлять fake `Уведомления`, если нет backend/frontend раздела уведомлений.
- Если уведомления нужны как продуктовая функция, завести отдельную задачу на notifications route/backend contract.
- Обновить все affected mobile screens, чтобы layout не конфликтовал с bottom navigation.

## Out of scope
- Экран `Клиенты` по mockups из `TASK-050`.
- Backend notifications.
- Изменение CRM permissions без отдельной backend задачи.
- Desktop navigation.

## Branch
`feature/TASK-051-mobile-bottom-navigation`

## Validation
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- Affected mobile Playwright coverage for authorized sections and responsive no-horizontal-scroll checks.
