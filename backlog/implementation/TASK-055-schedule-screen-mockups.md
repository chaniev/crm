# TASK-055: Обновить окно расписания по макетам из docs/mockups

## Status
implementation

## Implementation lifecycle
- moved_to_implementation_at: 2026-05-24 12:33
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-055-schedule-screen-mockups.plan.md
- implementation_branch: feature/TASK-055-schedule-screen-mockups

## Goal
Экран `Расписание` визуально соответствует новым desktop и mobile макетам из `docs/mockups/расписание`, сохраняя существующие backend-owned правила расписания.

## Context
В inbox есть заметка: `изменений окна Расписаний на основе макетов в docs/mockups/расписание`.

В `docs/mockups/расписание` есть два PNG-макета:
- desktop: `docs/mockups/расписание/ChatGPT Image 23 мая 2026 г., 19_28_48.png`
- mobile: `docs/mockups/расписание/ChatGPT Image 23 мая 2026 г., 19_28_59.png`

В backlog уже завершены `TASK-043` и `TASK-045`: они создали календарную основу расписания и предыдущий polish по старому макету. Новые файлы в `docs/mockups/расписание` выглядят как отдельная follow-up итерация.

## User role
главный тренер / администратор / тренер / все пользователи CRM

## Problem
Текущий экран `Расписание` нужно привести к новым утвержденным макетам, чтобы desktop и mobile версии выглядели согласованно с текущим shell, bottom navigation и визуальным стилем CRM.

## Scope
- Сравнить текущий `/schedule` с двумя макетами из `docs/mockups/расписание`.
- Обновить desktop-недельную сетку расписания под макет: сайдбар, верхняя панель, фильтры, временная сетка, карточки занятий и легенда.
- Обновить mobile-вид расписания под макет: верхняя панель, горизонтальные дни, фильтры, дневная временная сетка, карточки занятий, легенда и bottom navigation.
- Сохранить read-only behavior расписания для всех ролей.
- Сохранить текущие фильтры, refresh/loading/error states и responsive behavior.
- Проверить, что тексты, карточки и контролы не перекрываются на desktop и mobile.
- Зафиксировать visual QA сравнением с обоими PNG-макетами.

## Out of scope
- Backend schedule contract changes.
- Новые business rules расписания.
- Drag-and-drop, переносы, отмены, замены тренера и conflict resolution.
- Редактирование занятий из календаря.
- Добавление персональных тренировок или dated event calendar.
- Изменение roles, permissions, access scope или attendance flows.
- Редизайн остальных экранов CRM.

## Constraints
- Backend остается источником истины для schedule data, access scope, validation semantics и ProblemDetails.
- Frontend не должен добавлять frontend-only правила конфликтов, переносов, отмен или занятости залов.
- Использовать существующий read-only schedule contract из `TASK-043`, если данных достаточно.
- Если для точного соответствия макетам нужны новые backend-поля или domain aggregates, остановить реализацию и создать отдельную backend/contract задачу.
- Сохранить решения `TASK-045`, если новые макеты не противоречат им: weekly schedule, read-only cards, фильтры, цветовая легенда и отсутствие schedule editing.
- Учитывать уже реализованный mobile shell и не создавать отдельную fake navigation только внутри `/schedule`.

## Acceptance criteria
- [ ] `/schedule` на desktop визуально соответствует `docs/mockups/расписание/ChatGPT Image 23 мая 2026 г., 19_28_48.png`.
- [ ] `/schedule` на mobile визуально соответствует `docs/mockups/расписание/ChatGPT Image 23 мая 2026 г., 19_28_59.png`.
- [ ] Desktop показывает недельную сетку с временем по вертикали и днями по горизонтали.
- [ ] Mobile показывает компактный дневной вид без page-level horizontal scroll.
- [ ] Фильтры и refresh доступны и не ломают текущую логику загрузки расписания.
- [ ] Карточки занятий показывают время, название группы, зал и тренера на основе существующих schedule data.
- [ ] Цвета карточек и легенда типов занятий согласованы и стабильны.
- [ ] Read-only поведение сохранено: нет редактирования, drag-and-drop, переносов или conflict-resolution UI.
- [ ] Layout не допускает перекрытия текста и контролов на desktop, tablet и mobile.
- [ ] Изменение не трогает backend schedule validation, roles, permissions или attendance flows.

## Test checklist
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Запустить affected Playwright specs для `/schedule` и responsive shell.
- [ ] Добавить или обновить e2e-проверку desktop schedule layout, если текущая не покрывает новый макет.
- [ ] Добавить или обновить e2e-проверку mobile schedule layout, если текущая не покрывает новый макет.
- [ ] Вручную сравнить desktop `/schedule` с PNG-макетом.
- [ ] Вручную сравнить mobile `/schedule` с PNG-макетом.

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: задача локализована во frontend schedule UI, но затрагивает важный пользовательский экран и должна не превратиться в изменение backend schedule rules.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/inbox/2026-05-24.md`
- Original note: `изменений окна Расписаний на основе макетов в docs/mockups/расписание`

## Processing notes
- Created at: 2026-05-24 12:23
- Created by skill: codex-backlog-skill
- Duplicate check: активного дубликата в `tasks-ready`, `risky` или `needs-clarification` не найдено; завершенные `TASK-043` и `TASK-045` связаны с предыдущими итерациями расписания, но новые mockup-файлы от 2026-05-23 задают отдельный follow-up.
