# TASK-024: Перенести главное меню в левую навигацию

## Status
implementation

## Implementation lifecycle
- moved_to_implementation_at: 2026-05-07 21:28
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-024-left-side-main-menu.plan.md

## Goal
Главное меню приложения находится слева и поддерживает привычную навигацию по разделам CRM.

## Context
В inbox есть короткая заметка: `Главное меню сделать слева`.

## User role
администратор / тренер / владелец

## Problem
Текущая позиция главного меню, вероятно, хуже подходит для регулярной CRM-навигации.

## Scope
- Найти текущий app shell/frontend layout.
- Перенести главное меню в левую навигацию.
- Сохранить доступность разделов и active state.
- Проверить desktop и mobile behavior.

## Out of scope
- Изменение информационной архитектуры разделов.
- Изменение permissions видимости пунктов меню.
- Полный redesign приложения.

## Constraints
- Значимое UX-изменение: перед implementation желательно привлечь `ui-designer`.
- Не ломать responsive navigation.
- Не дублировать permission rules во frontend.

## Acceptance criteria
- [ ] Главное меню отображается слева на desktop.
- [ ] Active route визуально понятен.
- [ ] Mobile navigation остается удобной и не перекрывает контент.
- [ ] Пункты меню сохраняют текущую логику видимости.

## Test checklist
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Вручную проверить основные маршруты на desktop и mobile.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: frontend layout-задача без изменения domain contracts.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/inbox/2026-05-06.md`
- Original note: `Главное меню сделать слева`

## Processing notes
- Created at: 2026-05-07 11:26
- Created by skill: codex-backlog-skill
- Duplicate check: existing task folders were empty before processing; no duplicate found.
