# TASK-099: Удалить колонку «Действие» из списка журнала

## Status
implementation

## Implementation lifecycle
- moved_to_implementation_at: 2026-07-27 20:00
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-099-audit-log-remove-action-column.plan.md
- implementation_branch: fix/TASK-099-audit-log-remove-action-column

## Goal
Пользователь быстрее сканирует журнал по времени, описанию, автору и деталям без отдельной повторяющей колонки `Действие`.

## Context
В журнале уже была удалена техническая колонка `Объект` в TASK-057. Текущий список по-прежнему показывает отдельные desktop header/cell и mobile label/value `Действие`, хотя описание события и детали остаются доступными.

## User role
Суперадминистратор / главный тренер / администратор с backend-разрешённым доступом к журналу.

## Problem
Отдельная колонка действия занимает ширину и дублирует контекст записи, усложняя чтение основного описания.

## Scope
- Удалить column header `Действие` из grid/list журнала.
- Удалить соответствующую row cell на desktop и label/value на mobile/card layout.
- Перераспределить grid geometry в пользу описания и автора без horizontal scroll.
- Сохранить дату/время, описание, пользователя и действие открытия деталей.
- Обновить component и responsive Playwright regression coverage.

## Out of scope
- Удаление `actionType` из backend response, API types, persistence или audit semantics.
- Удаление фильтра по типу действия.
- Удаление типа действия из details modal, если он нужен для диагностики.
- Изменение permissions журнала, pagination или других фильтров.

## Constraints
- Backend остаётся source of truth для audit data и access scope.
- Details action остаётся keyboard-accessible и возвращает focus после закрытия modal.
- Удаление колонки не должно скрыть description или автора и не должно менять фильтрацию.

## Acceptance criteria
- [ ] В header журнала нет колонки `Действие`.
- [ ] В каждой строке desktop и mobile нет отдельной cell/label/value `Действие`.
- [ ] Дата/время, описание, пользователь и кнопка `Детали` сохранены.
- [ ] Фильтр по типу действия продолжает работать.
- [ ] Details modal по-прежнему показывает диагностическую информацию, включая action type, если она была частью текущего контракта.
- [ ] Grid/table semantics соответствуют фактическому числу колонок.
- [ ] На 390 x 844, 420 x 912, 440 x 956, 768 x 1024 и 1440 x 1200 нет horizontal page scroll или пустой колонки.

## Test checklist
- [ ] Расширить `AuditLogScreen` component test: отсутствует header/cell `Действие`, остальные данные и details action видимы.
- [ ] Проверить action-type filter после удаления display column.
- [ ] Проверить details modal и focus return.
- [ ] Обновить affected audit Playwright geometry на mobile/tablet/desktop.
- [ ] Запустить `cd frontend && npm run test:unit`.
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Запустить affected Playwright checks.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: задача ограничена frontend-представлением audit list и не меняет audit data, semantics или permissions.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/processed/2026-07-27-2.md`
- Original note: `В списке в Журнале удалить колонку «ДЕЙСТВИЕ».`

## Processing notes
- Created at: 2026-07-27 01:04
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- Duplicate check: завершённая TASK-057 удаляла `Объект`, но явно сохраняла `Действие`; новая задача является отдельным regression follow-up.
