# TASK-195 — Восстановить список филиалов на PostgreSQL перед релизом

Статус: implementation
Дата: 2026-10-25
Источник: пользователь 24.10.2026 разрешил обновление удалённого стенда,
25.10.2026 попросил возобновить. Exact-image API smoke обнаружил блокирующий
HTTP 500 на GET /branches в релизе 5b1e036. Разрешённое исправление причины
failed runtime check входит в deploy-project workflow; нового поведения нет.

## Requirements
- REQ-BRN-001 — implements
- REQ-CLI-007 — constrains

## Проблема и границы
Сортировка после проекции в positional BranchResponse не переводится Npgsql
в SQL. Список недоступен HeadCoach и Administrator; InMemory-проверки проходят.
Перенести существующую сортировку IsArchived/Name/Id на entity query до проекции.
Сохранить архивный фильтр, общий lookup и backend-owned nullable clientCount.
Не менять DTO, роли, scope, миграции и данные.

## Приёмка
- PostgreSQL GET /branches успешно возвращает активные филиалы в прежнем порядке.
- includeArchived включает архивные после активных с сортировкой Name/Id.
- HeadCoach получает глобальные counts; Administrator — count своего филиала
  и null чужого; ограничения Coach не расширяются.
- Регрессионный тест воспроизводит HTTP 500 до исправления и проходит после.
- Diff-selected harness и повтор exact-image API smoke проходят до rollout.

## План
[Готовый план](../implementation-plans/TASK-195-branch-list-postgresql.plan.md).
