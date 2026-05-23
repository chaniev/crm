# TASK-047: Вертикальное левое меню на мобильном экране

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-05-20 19:48
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-047-mobile-left-side-menu.plan.md
- implementation_branch: feature/TASK-047-mobile-left-side-menu

## Goal
На мобильном телефоне главное меню CRM тоже отображается слева и вертикально, чтобы навигация была единообразной с desktop-версией.

## Context
В inbox добавлена заметка о том, что при просмотре на мобильном телефоне меню также должно быть вертикальным и отображаться слева.

Связанная завершенная задача: `backlog/done/TASK-024-left-side-main-menu.md`. В ней левое меню было реализовано для desktop, а mobile navigation оставалась отдельным responsive-вариантом.

## User role
администратор / тренер / владелец

## Problem
Текущее мобильное поведение меню может отличаться от ожидаемого: пользователь хочет видеть основное меню на мобильном экране слева в вертикальном виде, а не как горизонтальную навигацию сверху.

## Scope
- Проверить текущий `frontend` app shell и responsive-поведение главной навигации.
- Сделать мобильное меню вертикальным и расположенным слева.
- Сохранить доступность разделов, active state и текущую логику видимости пунктов.
- Убедиться, что меню не перекрывает рабочий контент и не создает неконтролируемый горизонтальный scroll.
- Обновить или добавить frontend regression coverage для mobile navigation.

## Out of scope
- Изменение набора разделов главного меню.
- Изменение ролей, permissions или правил видимости пунктов меню.
- Изменение backend contracts или CRM domain logic.
- Полный редизайн app shell за пределами мобильного поведения меню.

## Constraints
- Работать в рамках существующего frontend stack: Mantine и Onest.
- Не дублировать permission logic во frontend.
- Не ломать desktop/tablet left navigation, реализованную в `TASK-024`.
- Значимое UX-изменение shell/navigation желательно согласовать с `ui-designer` перед реализацией.

## Acceptance criteria
- [ ] На мобильном viewport главное меню отображается слева и вертикально.
- [ ] Mobile navigation сохраняет все доступные пользователю пункты и корректный active state.
- [ ] Основной контент не перекрывается меню, header или profile controls.
- [ ] На mobile/tablet/desktop нет page-level horizontal scroll из-за меню.
- [ ] Desktop/tablet left navigation не регрессирует.
- [ ] Логика видимости пунктов меню по ролям не меняется.

## Test checklist
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Запустить или обновить affected Playwright responsive/navigation tests.
- [ ] Вручную проверить основные маршруты на mobile, tablet и desktop viewports.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: frontend layout-задача без изменения backend contracts, ролей, permissions или CRM domain logic.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/inbox/2026-05-20.md`
- Original note: `при просмотре в мобильном телефоне меню тоже должно вертикальным и отображаться слева`

## Processing notes
- Created at: 2026-05-20 19:44
- Created by skill: codex-backlog-skill
- Duplicate check: active task folders checked; no active duplicate found. Related completed task `TASK-024-left-side-main-menu` found, but the new note narrows mobile behavior and should be tracked as a separate follow-up.
