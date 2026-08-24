# Implementation Plan: TASK-133 Сделать карточки расписания task-first на mobile и desktop

## Metadata
- source_task: /backlog/implementation/TASK-133-schedule-task-first-cards.md
- branch: feature/TASK-133-schedule-task-first-cards
- readiness: yes
- dependencies: none; completed TASK-119 is the occurrence-calendar baseline, and TASK-131 may add overlapping schedule tests but does not block this UI change
- risk: medium — dense responsive schedule, shared mobile navigation and list-return behavior change together without changing backend semantics

## Goal
На плотном расписании из 15 занятий пользователь различает занятие по времени и decision data, открывает разрешённую посещаемость как primary operation и возвращается в тот же URL-backed и визуальный контекст списка; rare/destructive actions не перегружают повторяющиеся карточки.

## Decisions and contracts
- API types and schedule domain contracts do not change. Time grouping, labels and action placement consume existing `ScheduleLesson` fields and `allowedActions` only.
- Group day occurrences by exact `(startTime, endTime)` after the existing chronological sort. Every occurrence remains a separate accessible card; a group does not merge identities or imply a backend conflict.
- `Посещаемость` remains visible and dominant when `viewAttendance.allowed`; `Изменить` is the only visible secondary mutation when `edit.allowed`; `Ещё` is rendered only when at least one permitted deferred action exists.
- `Перенести`, series edit, trainer substitution and cancellation/restore move into `Ещё`. Cancellation/restore continues to open the existing preview/execute confirmation drawer.
- A disabled attendance action retains the backend-provided localized reason. No role, overdue, conflict or attendance-required state is inferred in frontend.
- The neutral attendance badge is exhaustive: `Отметки есть` for `hasAttendanceMarks=true`, otherwise `Без отметок`.
- Schedule return context must preserve the list URL (`date`, `view`, filters), exact time-group/card anchor and scroll position across detail, attendance, edit, move, series and substitution/cancellation routes. History back/forward remains authoritative; explicit return uses the captured schedule origin instead of `/schedule` without query.

## UX contract
- Day section order is: day heading, chronological time groups, occurrence cards. The exact interval is the group heading and is not repeated as the dominant visible field in every sibling card; accessible card/action names still include enough time and lesson identity to remain unique.
- Card decision-data order is group, branch/hall, effective trainer, then source, substitution/cancellation and neutral attendance states. The card body is a keyboard-operable detail trigger with a visible affordance and focus ring; its nested action cluster does not trigger detail navigation.
- At `360–440px`, each card exposes at most `Посещаемость`, permitted `Изменить`, and `Ещё`, with `44 x 44px` targets and at least `8px` between independent targets. Desktop keeps the same hierarchy and places the compact action cluster next to decision data rather than at the far edge.
- `Ещё` uses the established Mantine contextual-menu pattern on pointer/keyboard layouts; if the approved mobile specification chooses a bottom surface, it must keep the same action names/order and avoid a nested scroll trap. Escape/close returns focus to the originating card trigger.
- The toolbar remains one non-wrapping row. The full date value and previous/next controls take priority; create collapses to its labeled `44 x 44px` icon form before any wrap, and calendar tools remain reachable without overlap.
- Mobile bottom-navigation labels `Посещения`, `Внимание`, `Расписание`, `Клиенты`, `Ещё` remain single-line and fully visible at `360–440px`; adaptive-route and `aria-current` semantics are unchanged.
- Before functional UI edits, record the implementation-ready mobile-first specification for component order, exact breakpoint transformations, menu/surface behavior, operational states and focus return. Stop if it conflicts with the action hierarchy or backend capability boundary above.

## Scope
### In
- Day and week occurrence presentation, exact-interval grouping, card action hierarchy and responsive density.
- Schedule toolbar and shared mobile bottom-navigation geometry required by the task.
- Schedule-origin URL/anchor/scroll restoration for all routes opened from a card.
- Component and browser regression fixtures for dense, parallel, restricted, stale/error and destructive flows.

### Out
- Backend/API/database changes or new schedule, permission, attendance and conflict semantics.
- Changes to create/detail/edit/move forms beyond schedule-origin capture, return/focus behavior and existing confirmation-surface reuse.
- Generic app-shell or navigation redesign beyond making the current five Russian mobile labels fit.

## Implementation slices
1. Finalize the UX/UI handoff against the supplied `390 x 844` and `1440 x 1200` evidence, resolving exact card anatomy, time-group markup, overflow behavior and responsive geometry before production edits.
2. Add a pure exact-interval grouping/presentation layer and render chronological time groups with exhaustive neutral attendance and existing cancellation/substitution/source states.
3. Replace the repeated action grid with primary attendance, permitted edit and capability-driven `Ещё`; route every deferred action to its existing handler/drawer and implement keyboard close/focus return.
4. Add schedule-origin capture/restoration so body/action navigation and explicit returns restore URL, time-group/card anchor and scroll without changing route identity contracts.
5. Tune schedule/card/toolbar and bottom-navigation styles across the target matrix, then lock the approved hierarchy and geometry in component and Playwright coverage.

## Likely files and layers
- `frontend/src/features/schedule/GroupScheduleScreen.tsx` — time-group markup, card hierarchy, overflow actions and focus anchors.
- `frontend/src/features/schedule/scheduleTimeGroups.ts` (new, or an equivalently focused helper) — pure exact-interval grouping and stable presentation labels.
- `frontend/src/features/schedule/GroupScheduleScreen.test.tsx` — dense fixtures, capability matrix, grouping, menu, keyboard and focus-return behavior.
- `frontend/src/App.css` — schedule, toolbar, menu/card and mobile-navigation responsive geometry.
- `frontend/src/features/shared/MobileBottomNavigation.tsx` and `frontend/src/features/shared/ux.test.tsx` — label-fit correction while preserving adaptive/active semantics.
- `frontend/src/app/useAppReturnNavigation.ts`, `frontend/src/App.tsx`, `frontend/src/app/RouteViewport.tsx` and focused route tests — schedule-origin URL/anchor/scroll capture and explicit return wiring.
- `frontend/e2e/group-schedule.spec.ts` — primary, destructive, restricted and responsive schedule workflows.

## Regression specification
### Automated tests to add or update
- Component: two or more occurrences with the same exact interval render under one ordered time-group heading, preserve every occurrence identity and expose distinct group/branch/hall/trainer data; a different end time creates a separate group.
- Component: `hasAttendanceMarks` renders exactly one of `Отметки есть` / `Без отметок`; substitute, cancelled and source-kind labels come only from response fields.
- Component capability matrix: permitted attendance/edit are visible, deferred permitted actions appear only after `Ещё`, forbidden actions are absent, and a restricted attendance reason remains associated with its disabled control.
- Component keyboard path: Enter/Space opens detail from card body; opening and closing `Ещё` with Escape returns focus; selecting cancel/restore opens the existing confirmation drawer and closing it returns to the correct card action.
- Route/navigation: detail, attendance, edit, move, series and mutation completion/return preserve the original schedule query and restore the exact group/card anchor plus recorded scroll; reload and back/forward do not reuse stale schedule origins.
- Shared navigation: all five current Russian primary labels and the active-route `aria-current` contract remain present; adaptive overflow behavior is unchanged.
- Playwright dense fixture: 15 lessons including parallel intervals, long names, marks/no marks, substitution, cancellation and varied capabilities proves the primary `date -> time group -> lesson -> attendance -> return` flow and the destructive overflow confirmation/recovery flow.
- Playwright geometry: at `360 x 780`, `390 x 844`, `420 x 912`, `440 x 956`, `768 x 1024` and `1440 x 1200`, assert no page overflow, a fully readable date and nav labels, maximum three visible card actions, and non-overlapping action/data clusters; smoke `912 x 420` and `956 x 440` temporary-surface behavior.

### Expected red evidence
- The new grouping/action-hierarchy component test fails because current cards repeat the interval and render move/series/substitution/cancel directly; the no-marks assertion fails because current UI omits `Без отметок`.
- The schedule-return test fails because explicit return currently navigates to bare `/schedule` and no schedule list anchor/scroll snapshot exists.
- The responsive browser assertion fails on the supplied baseline because the date/nav labels are clipped or ellipsized and the current dense card exposes more than three actions.

### Required validation
- `cd frontend && npm run test:unit -- GroupScheduleScreen.test.tsx ux.test.tsx`.
- `cd frontend && npm run test:e2e -- group-schedule.spec.ts` for affected Chromium projects and `cd frontend && npm run test:e2e:iphone` for the schedule target-device projects.

### Manual evidence
- Compare the rendered dense fixture with both TASK-133 source images at `390 x 844` and `1440 x 1200`; record first-viewport content density and focus/menu behavior.
- Record physical Safari chrome, software keyboard, real safe-area and one-handed reach as unverified unless Simulator or physical-device evidence is actually collected.

### Regression barrier
- The dense-fixture `group-schedule` Playwright flow must pass at the `390 x 844` stress baseline and both target-iPhone portrait projects, proving exact time grouping, maximum-three visible actions, attendance round-trip with restored context, readable toolbar/navigation and no horizontal overflow.

## Risks and stop conditions
- Stop if any required action or state is absent from `ScheduleLesson`/`allowedActions`; do not infer it or expand the API inside TASK-133.
- Stop for product review if the UI handoff would hide permitted attendance, keep destructive cancellation permanently visible, or replace exact occurrence identity with an aggregate action.
- If TASK-131 lands first, preserve its group-type filter assertions and adapt locators without weakening its URL/API regression barrier.
- If restoring list position requires a generic router rewrite rather than a bounded schedule-origin snapshot using existing history-state patterns, split that infrastructure work before proceeding.
