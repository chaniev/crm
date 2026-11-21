# TASK-219: Открывать полный состав конкретного занятия при частично заполненных отметках

## Status
done

## Requirements
- REQ-ATT-001 — implements

## Goal
Открывать полный состав конкретного занятия при частично заполненных отметках.

## Context
При открытии занятия со смешанным составом отмеченный клиент скрыт, а переключатель доступен только в старом сценарии выбора группы. Кнопка «Показать всех» появляется после отметки последнего клиента. TASK-205 завершила шапку и возврат.

## Acceptance criteria
- [x] Список открывается на неотмеченных. Пока есть отмеченные и неотмеченные клиенты, сотрудник может открыть весь состав и вернуться к отфильтрованному списку.
- [x] Переключение сохраняет занятие, дату и отметки, включая вход из расписания и по прямой ссылке.

## Source notes
[Сверка main 3e729130 и решения владельца от 21.11.2026](../2026-11-21/TASK-216-requirements-audit.md).

## Implementation lifecycle
- moved_to_implementation_at: 2026-11-21 23:53
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/2026-11-22/TASK-219-lesson-mixed-roster.plan.md
- implementation_branch: fix/TASK-219-lesson-mixed-roster

## Completion
- completed_at: 2026-11-22
- completion_date_evidence: версия `f28f81a4` прошла контракт TASK-219 и интегрирована в локальную main 22 ноября. [Браузерная приёмка](TASK-219-evidence/acceptance.md).
