# TASK-200: Разделить компонент расписания по обязанностям

## Status
implementation

## Requirements
- none — сохраняются интерфейс, маршруты, запросы, backend allowances, обработка ошибок, черновики и восстановление контекста

## Source and authorization
Пользователь текущего чата поручил выполнить каждый предложенный шаг рефакторинга последовательно с локальными коммитами и успешными проверками. Этот шаг продолжает согласованное разделение GroupScheduleScreen: редактор серии и замены тренеров, затем загрузка и URL state. TASK-199 завершена и локально интегрирована bc15d03; следующий шаг начинается после её успешных проверок.

## Goal
Редакторы владеют своим состоянием и preview/execute lifecycle в отдельных модулях. Календарь использует отдельные локальные загрузку и URL state, сохраняя существующие компоненты и публичные route exports.

## Scope
frontend/src/features/schedule/GroupScheduleScreen.tsx, локальные компоненты/hooks/helpers и regression tests. JSX, classNames, тексты, Mantine props, API contracts и backend semantics сохраняются. Не добавлять общий fetch framework, global store, lazy routes или новый дизайн.

## Acceptance
Сохраняются cancellation/abort guards, requestScopeRef редактора серии, stale cards, popstate/history.state, preview invalidation, точный lesson locator и focus/scroll restoration. Существующие unit и desktop/target-iPhone browser tests проходят. Независимый refactoring review обязателен перед реализацией и на итоговом diff.

## Implementation lifecycle
- moved_to_implementation_at: 2026-11-17
- moved_from: /backlog/risky
- implementation_plan: /backlog/implementation-plans/TASK-200-schedule-screen-decomposition.plan.md
- implementation_branch: codex/TASK-200-schedule-screen-decomposition
