# TASK-126: Декомпозировать App shell и routing orchestration

## Status
done

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
- [x] `App.tsx` не превышает 700 строк и является composition/session root.
- [x] Route parsing/navigation/history state остаются typed и имеют одного владельца.
- [x] Auth, forced-password и utility-password return behavior не изменились.
- [x] Shell access loss, not-found и recovery surfaces работают как прежде.
- [x] Не добавлены global store, component library или duplicated permission rules.
- [x] Frontend quality baseline и affected browser regressions проходят.

## Test checklist
- [x] Unit tests routing helpers, history snapshots и document titles.
- [x] Component tests auth/password/session transitions.
- [x] Playwright deep-link, back/forward и permission-restricted recovery.
- [x] Проверить 390 x 844, 420 x 912, 440 x 956 и compact landscape shell.
- [x] Запустить lint, strict typecheck, raw-color, unit, build и affected WebKit tests.

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
- implementation_plan: /backlog/done/TASK-126-app-shell-routing-decomposition.plan.md
- implementation_branch: refactor/TASK-126-app-shell-routing-decomposition
- implementation_state: completed
- implementation_commits: ed5a4ba, 61f05c9, a65bee8, 89aeab1
- delivered_on_main_at: 2026-08-23
- moved_to_done_at: 2026-08-23
- last_status_reviewed_at: 2026-08-23

## Completion record
- Completed on: 2026-08-23; integrated candidate: `509da63`.
- `App.tsx` is 551 lines; routing/history/title ownership is centralized in the app routing subsystem with one popstate owner.
- Validation: lint, typecheck, raw-color, full unit/build, affected Chromium and `40/40` target-iPhone WebKit checks passed on the integrated frontend chain.
- Residual device evidence: physical Safari chrome, software keyboard and physical-device safe areas were not executed; target-iPhone WebKit portrait and compact-landscape profiles passed.
