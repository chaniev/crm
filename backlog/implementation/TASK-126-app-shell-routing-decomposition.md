# TASK-126: Декомпозировать App shell и routing orchestration

## Status
implementation

## Goal
`App.tsx` остаётся небольшим composition root, а routing/history, auth stages,
authenticated shell и route viewport имеют отдельные typed boundaries.

## Context
`frontend/src/App.tsx` содержит около 2000 строк: history state, return
snapshots, document titles, auth/password flows, shell navigation и route
dispatch находятся в одном модуле.

## User role
Все авторизованные роли и пользователь экрана входа.

## Problem
Локальная правка routing или auth presentation затрагивает слишком большой
state graph и может сломать back/forward, recovery или permission redirect.

## Scope
- До переноса зафиксировать characterization tests route/history/auth behavior.
- Выделить typed routing/history helpers и `useAppRoute` в app-level module.
- Выделить auth stage screens без изменения формы и password return behavior.
- Выделить `AuthenticatedShell`, `RouteViewport` и route state surfaces.
- Оставить в `App.tsx` session/config orchestration и composition.
- Сократить `App.tsx` до 700 строк; новый app-level модуль не превышает 600 строк.

## Out of scope
- Изменение routes, navigation labels, access matrix или UX hierarchy.
- Client/group feature decomposition — TASK-127–129.
- Новая global state library, React Router или другой framework.

## Constraints
- Сохранить `AppProps`, React 19, Mantine, Onest и typed `appRoutes` contract.
- Не копировать backend permissions во frontend conditions.
- Effects используются только для history/document/external synchronization.
- Сохранить pending return snapshots, deep links, back/forward и access recovery.
- Обязательны `refactoring-specialist`, `react-specialist` и `test-automator`.

## Acceptance criteria
- [ ] `App.tsx` не превышает 700 строк и является composition/session root.
- [ ] Route parsing/navigation/history state остаются typed и имеют одного владельца.
- [ ] Auth, forced-password и utility-password return behavior не изменились.
- [ ] Shell access loss, not-found и recovery surfaces работают как прежде.
- [ ] Не добавлены global store, component library или duplicated permission rules.
- [ ] Frontend quality baseline и affected browser regressions проходят.

## Test checklist
- [ ] Unit tests routing helpers, history snapshots и document titles.
- [ ] Component tests auth/password/session transitions.
- [ ] Playwright deep-link, back/forward и permission-restricted recovery.
- [ ] Проверить 390 x 844, 420 x 912, 440 x 956 и compact landscape shell.
- [ ] Запустить lint, strict typecheck, raw-color, unit, build и affected WebKit tests.

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: refactoring frontend-only и не меняет продуктовый contract, но требует строгой route/session regression coverage.

## Clarification questions
Не требуется: visible workflow и access behavior должны остаться без изменений.

## Source notes
- Source: direct user request, 2026-08-22.
- Parent task: `/backlog/risky/TASK-121-decompose-oversized-cross-layer-files.md`.

## Processing notes
- Created at: 2026-08-22 23:47 MSK.
- Created by skill: codex-backlog-skill + react-best-practices + crm-mobile-first-ui.
- Duplicate check: active navigation tasks меняют product routes; эта задача сохраняет текущую route model.

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-23 01:15
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-126-app-shell-routing-decomposition.plan.md
- implementation_branch: refactor/TASK-126-app-shell-routing-decomposition
