# TASK-042: Перевести журнал событий на обычный grid с ФИО автора

## Status
implementation

## Implementation lifecycle
- moved_to_implementation_at: 2026-05-14 21:17
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-042-audit-log-grid-actor-full-name.plan.md
- implementation_branch: feature/TASK-042-audit-log-grid-actor-full-name

## Goal
Журнал событий отображается как привычная таблица/grid с отдельными колонками записей, включая ФИО пользователя, который внес изменение.

## Context
В inbox есть заметка: "журнал событий в виде обычного грида с записями, в журнале должно также отображаться ФИО кто вносил изменения". Текущий frontend audit screen показывает записи через accordion; frontend API mapper уже читает `user.fullName`/`userName`, а backend response содержит `User`.

## User role
главный тренер / администратор

## Problem
Accordion-список хуже подходит для быстрого просмотра большого журнала. Пользователю нужен обычный сканируемый grid, где сразу видны дата, действие, объект и ФИО автора изменения.

## Scope
- Заменить список записей audit log на table/grid presentation.
- Добавить явную колонку с ФИО автора изменения.
- Сохранить фильтры, пагинацию, empty/loading/error states.
- Сохранить доступ к старым и новым значениям записи через expandable row, modal, drawer или компактный details action.
- Убедиться, что grid адаптивен на tablet/mobile и не ломает длинные значения.
- Обновить frontend tests/e2e selectors для audit log screen.

## Out of scope
- Изменение audit domain semantics.
- Добавление новых audit events.
- Изменение прав доступа к журналу.
- Изменение backend contract, если текущий response уже содержит ФИО автора.

## Constraints
- Backend владеет audit semantics and permissions.
- Frontend не должен вычислять автора изменения из description, если backend не отдал пользователя.
- Если окажется, что backend не отдает ФИО автора для части записей, нужно создать отдельную backend follow-up задачу, а не подменять данные frontend-only эвристикой.
- Для значимого UX-изменения перед реализацией стоит привлечь `ui-designer`.

## Acceptance criteria
- [ ] Audit log entries отображаются обычным grid/table, а не accordion-only списком.
- [ ] В grid есть отдельная колонка с ФИО автора изменения.
- [ ] Дата/время, тип действия, тип объекта, описание и источник остаются доступны пользователю.
- [ ] Старые и новые значения записи можно посмотреть без потери текущей страницы и фильтров.
- [ ] Фильтры, пагинация, загрузка, ошибка и пустое состояние продолжают работать.
- [ ] Grid не ломается на mobile и не перекрывает действия.

## Test checklist
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Добавить или обновить frontend/e2e coverage для audit log grid.
- [ ] Вручную проверить журнал под главным тренером и администратором.

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: задача локализована во frontend audit screen, но должна сохранить backend-derived audit data and permissions.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/inbox/2026-05-14.md`
- Original note: `журнал событий в виде обычного грида с записями, в журнале должно также отображаться ФИО кто вносил изменения`

## Processing notes
- Created at: 2026-05-14 13:01
- Created by skill: codex-backlog-skill
- Duplicate check: активной задачи-дубликата не найдено; текущий audit screen уже существует, но задача меняет способ отображения и делает ФИО автора явной grid-колонкой.
