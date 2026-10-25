# TASK-195 — Восстановить список филиалов на PostgreSQL перед релизом

Статус: done
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
[Готовый план](TASK-195-branch-list-postgresql.plan.md).

## Completion
- completed_at: 2026-10-25
- completion_date_evidence: исправление интегрировано и опубликовано в main commit `ea450769080ebac349668069f8216ed5889950eb`; exact-image smoke и remote rollout завершены в тот же день.
- moved_to_done_at: 2026-10-25

Шесть новых PostgreSQL-сценариев воспроизвели HTTP 500 до исправления.
После исправления targeted fixture 9/9, canonical 13/13 checks (714 backend,
750 frontend) passed. Exact-image API smoke: 118 assertions / 72 requests passed.
Порядок/фильтр и scoped counts сохранены; схема, DTO и права не менялись.
[Проверки](TASK-195-evidence/verification.json),
[real-API smoke](TASK-195-evidence/api-smoke.json),
[отчёт релиза](/docs/LOCAL_REMOTE_STAND_DIFF_2026-10-25.md).
