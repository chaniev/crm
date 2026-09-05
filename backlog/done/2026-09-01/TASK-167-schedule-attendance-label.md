# TASK-167: Переименовать действие расписания в «Посещение»

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-30 18:43 MSK
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/2026-09-01/TASK-167-schedule-attendance-label.plan.md
- implementation_branch: feature/TASK-167-schedule-attendance-label
- implementation_state: completed
- implementation_commit: 36e1530
- moved_to_done_at: 2026-09-01

## Requirements
- REQ-GRP-007 — changes

## Goal
В карточках расписания кнопка быстрого входа в отметку занятия называется
«Посещение» вместо «Посещаемость» во всех responsive вариантах.

## Context
`GroupScheduleScreen` сейчас рендерит кнопку `Посещаемость` отдельно в mobile
и desktop action surfaces. Inbox явно выбирает новую подпись `Посещение`.

## User role
Тренер / администратор / главный тренер / супер-администратор с доступом к занятию.

## Problem
Подпись действия обозначает общую характеристику вместо конкретной операции и
не совпадает с принятой терминологией сущности «Посещение».

## Scope
- Заменить видимую подпись schedule action на `Посещение` во всех карточках расписания.
- Вынести/использовать единый resource key для обеих responsive surfaces.
- Обновить component и Playwright assertions, которые находят эту кнопку.

## Out of scope
- Переименование раздела `Посещения`, attendance statuses или backend action codes.
- Изменение текста причин недоступности, если он не является подписью кнопки.
- Изменение маршрута, permissions или attendance write semantics.

## Constraints
- Accessible name кнопки также должен быть `Посещение`.
- Mobile и desktop используют один resource, без дублирующих literals.
- Переход продолжает использовать тот же lesson occurrence и дату.

## Acceptance criteria
- [x] Каждая разрешённая schedule card показывает действие `Посещение`.
- [x] Mobile и desktop action surfaces используют одинаковую подпись и accessible name.
- [x] Кнопка открывает прежний attendance route для выбранного занятия.
- [x] Старый button label `Посещаемость` отсутствует в schedule action surfaces.

## Test checklist
- [x] Обновить focused `GroupScheduleScreen` component tests.
- [x] Обновить affected schedule Playwright locators/assertions.
- [x] Запустить frontend check и affected Chromium/target-iPhone schedule flows.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: low
- Reason: локальное изменение resource-backed copy без изменения маршрута или доменной семантики.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/processed/2026-08-30.md`
- Original note: `в расписании переименовать кнопку Посещаемость в Посещение`

## Processing notes
- Created at: 2026-08-30 18:11 MSK
- Created by skill: codex-backlog-skill
- Duplicate check: TASK-103 owns the section name `Посещения`; TASK-133/TASK-157 own completed schedule composition. No active task owns this exact action-label change.
- Classification: tasks-ready because the target surface, exact copy and non-behavioral boundary are explicit.
