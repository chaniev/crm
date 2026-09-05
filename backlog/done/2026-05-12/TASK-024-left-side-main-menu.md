# TASK-024: Перенести главное меню в левую навигацию

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-05-07 21:28
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/2026-05-12/TASK-024-left-side-main-menu.plan.md

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
- [x] Главное меню отображается слева на desktop.
- [x] Active route визуально понятен.
- [x] Mobile navigation остается удобной и не перекрывает контент.
- [x] Пункты меню сохраняют текущую логику видимости.

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
- Status актуализирован и перенесен в done at: 2026-05-12.
- Evidence: в текущем `main` `AuthenticatedShell` передает vertical `NavigationTabs` в `AppLayout.navbar`, desktop navbar включается media query, mobile navigation остается в header.
- Validation note: текущая актуализация backlog не запускала frontend validation заново.
