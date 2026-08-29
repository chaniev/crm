# Implementation Plan: TASK-133 Сделать карточки расписания task-first на mobile и desktop

## Metadata
- source_task: /backlog/done/TASK-133-schedule-task-first-cards.md
- requirements: REQ-GRP-007 (implements); REQ-GRP-005 (constrains); REQ-NFR-001 (constrains); REQ-ATT-006 (constrains)
- branch: feature/TASK-133-schedule-task-first-cards
- readiness: yes
- ux_handoff: /backlog/mockups/TASK-133-schedule-task-first-cards/proposed/README-v2.md; `v2-*` PNGs are the visual reference and the README corrections override ambiguous PNG details
- prompt_evidence: /backlog/logs/TASK-133-ui-prompt-autoresearch.md; promoted change is integrated into `.agents/skills/design-first-ui-prompting/SKILL.md`
- dependencies: none; completed TASK-119 is the occurrence-calendar baseline, and TASK-131 may add overlapping schedule tests but does not block this UI change
- risk: medium — dense responsive schedule, shared mobile navigation and list-return behavior change together without changing backend semantics
- completion: implemented and locally integrated to `main` at candidate `3150c2a038bd09e702784a1d0104e2d6dd0b2381` on 2026-08-29

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
- The empty state has one create operation: keep the capability-driven toolbar `+`; do not duplicate it with a body `Создать занятие` action. A filtered empty state uses the existing filter recovery/reset path rather than inventing another create control.
- A cancelled occurrence uses the same card-body detail trigger and chevron as every other occurrence. Do not add a visible `Подробнее`; restore and other deferred operations remain in `Ещё`.
- Recoverable error has one primary retry. When last-known data exists, render the actual retained time groups/cards with an explicit stale indicator; skeletons are loading-only and must not represent cached data.
- At `360–440px`, the date toolbar contains previous, full date, next and capability-driven icon-only create. Schedule tools move to a labeled `44 x 44px` trigger in the day-summary row with the active-filter count; tablet/desktop may return tools to the main toolbar.

## UX contract
- Day section order is: day heading, chronological time groups, occurrence cards. The exact interval is the group heading and is not repeated as the dominant visible field in every sibling card; accessible card/action names still include enough time and lesson identity to remain unique.
- Card decision-data order is group, branch/hall, effective trainer, then source, substitution/cancellation and neutral attendance states. The card body is a keyboard-operable detail trigger with a visible affordance and focus ring; its nested action cluster does not trigger detail navigation.
- At `360–440px`, each card exposes at most `Посещаемость`, permitted `Изменить`, and `Ещё`, with `44 x 44px` targets and at least `8px` between independent targets. Desktop keeps the same hierarchy and places the compact action cluster next to decision data rather than at the far edge.
- `Ещё` uses the established Mantine `Menu` on fine-pointer/keyboard layouts and a bottom `Drawer` at `360–440px` coarse-pointer layouts. Both consume the same capability-derived action model and order: move, series edit, assign/cancel substitution, then cancel/restore last. Escape, explicit close and mobile back close the temporary surface and return focus to its originating trigger; when the trigger unmounts, focus falls back to the occurrence body or time-group heading.
- The toolbar remains one non-wrapping row. At `360–440px`, full date and previous/next controls take priority, create is a labeled `44 x 44px` icon, and calendar/filter tools use the day-summary trigger. At `768px` and `1440px`, tools may return to the toolbar and create restores its text label without changing action hierarchy.
- Mobile bottom-navigation labels `Посещения`, `Внимание`, `Расписание`, `Клиенты`, `Ещё` remain single-line and fully visible at `360–440px`; adaptive-route and `aria-current` semantics are unchanged.
- The approved v2 handoff and its README corrections are the implementation contract. Do not reinterpret decorative or illustrative PNG details as new fields, capabilities or frontend-owned semantics.

## Approved implementation-ready UI specification
### Component and focus order
1. Existing app-shell header and persistent navigation.
2. Schedule date toolbar: previous, full date, next, capability-driven create; tools also appear here only from `768px` upward.
3. Mobile day-summary row: weekday, lesson count and labeled schedule-tools trigger with active-filter count.
4. Operational state or schedule board. The board order is day section, exact time-group heading, separate occurrence cards.
5. Within a card: keyboard-operable body trigger with group, branch/hall, effective trainer and state row; then nested attendance, edit and `Ещё` controls.
6. Temporary surfaces: schedule-tools drawer, mobile `Ещё` drawer or desktop menu, then the existing cancellation/substitution confirmation surfaces. Closing unwinds focus to the immediate origin.

Stable anchors are derived from the schedule date plus exact `(startTime, endTime)` for a time group and `lessonOccurrenceId` for a card. Anchors need `scroll-margin-top` and `scroll-margin-bottom`; the mobile schedule board reserves bottom-navigation height plus safe area plus at least `16px` normal spacing.

### Responsive transformations
- `360 x 780`: single-column cards; toolbar geometry is `44px previous / flexible full date / 44px next / 44px create` with gaps of at least `8px`; `Изменить` and `Ещё` may be icon-only but retain stable accessible names.
- `390 x 844`: same hierarchy; attendance remains text-visible and dominant; at least one complete card plus following-card context is visible above bottom navigation.
- `420 x 912` and `440 x 956`: icon-plus-label secondary actions may return when they fit; long group/trainer names wrap; disabled attendance reason stays attached to its control; cancelled cards have no duplicate detail action.
- `768 x 1024`: switch to the existing side rail, remove bottom navigation, retain a single-column schedule list and allow tools back into the toolbar.
- `1440 x 1200`: use a bounded responsive group grid with `minmax(320px, 1fr)` and a maximum of three columns; keep action clusters inside cards next to decision data, not at the page edge. Exact group order and DOM order remain chronological regardless of columns.
- `912 x 420` and `956 x 440`: the mobile `Ещё` surface uses the approved landscape split—occurrence context left, actions right—with `max-height: calc(100dvh - 16px)`, one intentional scroll container only when content cannot fit, and a reachable `44 x 44px` close control.

### Operational states
- Loading retains toolbar/date/day context and uses stable card-shaped skeletons; mutation triggers are disabled to prevent duplicate actions.
- Empty retains the selected date and exposes only the toolbar create operation when permitted; active filters instead expose their existing reset/recovery path.
- Error without retained data uses one retry action. Error with retained data places the error/retry banner before actual stale cards and marks them `Данные могут быть устаревшими`; mutation actions requiring a fresh revision remain disabled or route through retry.
- Restricted attendance keeps the backend-localized reason associated with the disabled control through visible text and `aria-describedby`; forbidden secondary/deferred actions are absent.
- Cancelled cards remain readable, use the shared body detail trigger, and show only capability-permitted actions; restore stays inside `Ещё` and opens existing confirmation.
- Successful mutation identifies the affected lesson, then restores the captured schedule URL, exact time group/card, scroll and appropriate focus target.

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
1. Lock red component, route and browser evidence for exact grouping, action hierarchy, one-create/one-retry/no-duplicate-detail rules, capability gating, responsive geometry and schedule-origin restoration before production UI edits.
2. Add a pure exact-interval grouping/presentation layer and render chronological time groups with stable anchors, separate occurrence identities, exhaustive neutral attendance and existing response-driven source/substitution/cancellation states.
3. Replace the repeated action grid with the shared task-first card anatomy and a single capability-derived deferred-action model consumed by desktop `Menu` and mobile/compact-height `Drawer`; preserve the existing confirmation flows and deterministic focus return.
4. Add bounded schedule-origin capture/restoration so body/action navigation, mutation completion and explicit returns restore URL/query, group/card anchor, scroll and focus without changing route identity contracts or browser-history authority.
5. Implement operational states and responsive shell geometry: one-row mobile date toolbar, day-summary tools trigger, single create/retry/detail operations, real stale retained cards, bottom-nav clearance, label fit and tablet/desktop transformations.
6. Complete component and Playwright coverage across the viewport matrix, compare implementation with the approved v2 assets plus README corrections, then run the canonical frontend and target-iPhone validation barriers.

## Likely files and layers
- `frontend/src/features/schedule/GroupScheduleScreen.tsx` — time-group markup, card hierarchy, overflow actions and focus anchors.
- `frontend/src/features/schedule/scheduleTimeGroups.ts` (new, or an equivalently focused helper) — pure exact-interval grouping and stable presentation labels.
- `frontend/src/features/schedule/ScheduleMoreActionsSurface.tsx` (new only if extraction keeps one action model shared by `Menu` and `Drawer`; otherwise keep a focused local component) — capability-driven deferred actions and focus return.
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
- Component action-surface parity: desktop `Menu` and mobile `Drawer` consume the same capability-derived ordered action model; `Ещё` is absent when it would be empty, and cancel/restore remains last and opens the existing confirmation surface.
- Component keyboard path: Enter/Space opens detail from card body; nested actions do not navigate; opening and closing `Ещё` with Escape/close/back returns focus; selecting cancel/restore opens the existing confirmation drawer and closing it returns to the correct card action or documented fallback when the origin unmounts.
- Component operational states: loading skeletons preserve context but do not look empty; unfiltered empty has only toolbar create, filtered empty uses reset/recovery; error has one retry; retained stale state renders real marked cards; cancelled card has no duplicate `Подробнее`.
- Component toolbar: `360–440px` date row contains previous/full date/next/create only, while the day-summary tools trigger remains `44 x 44px`, named and exposes active-filter count; `768/1440` may restore tools and labeled create to the toolbar.
- Route/navigation: detail, attendance, edit, move, series and mutation completion/return preserve the original schedule query and restore the exact group/card anchor plus recorded scroll; reload and back/forward do not reuse stale schedule origins.
- Shared navigation: all five current Russian primary labels and the active-route `aria-current` contract remain present; adaptive overflow behavior is unchanged.
- Playwright dense fixture: 15 lessons including parallel intervals, long names, marks/no marks, substitution, cancellation and varied capabilities proves the primary `date -> time group -> lesson -> attendance -> return` flow and the destructive overflow confirmation/recovery flow.
- Playwright geometry: at `360 x 780`, `390 x 844`, `420 x 912`, `440 x 956`, `768 x 1024` and `1440 x 1200`, assert no page overflow, a fully readable date and nav labels, maximum three visible card actions, non-overlapping action/data clusters, bottom-nav clearance and visible restored anchor; smoke the approved split temporary surface at `912 x 420` and `956 x 440`.

### Expected red evidence
- The new grouping/action-hierarchy component test fails because current cards repeat the interval and render move/series/substitution/cancel directly; the no-marks assertion fails because current UI omits `Без отметок`.
- The schedule-return test fails because explicit return currently navigates to bare `/schedule` and no schedule list anchor/scroll snapshot exists.
- The responsive browser assertion fails on the supplied baseline because the date/nav labels are clipped or ellipsized and the current dense card exposes more than three actions.
- The operational-state assertions fail because the current empty/detail/error paths do not enforce the approved one-create, no-duplicate-detail and one-retry/stale-retained-content contracts.

### Required validation
- `cd frontend && npm run check`.
- `cd frontend && npm run test:unit -- GroupScheduleScreen.test.tsx ux.test.tsx`.
- `cd frontend && npm run test:e2e -- group-schedule.spec.ts` for affected Chromium projects and `cd frontend && npm run test:e2e:iphone` for the schedule target-device projects.

### Manual evidence
- Compare the rendered dense fixture with `v2-mobile-main-390x844.png`, `v2-mobile-main-420x912.png`, `v2-mobile-mixed-states-440x956.png`, `v2-tablet-main-768x1024.png`, `v2-desktop-main-1440x1200.png` and both approved `Ещё` surfaces; apply README corrections where the PNG is ambiguous.
- Record first-viewport content density, full toolbar/navigation labels, one-create/one-retry/no-duplicate-detail behavior, card-body focus, menu/drawer close and restored anchor visibility.
- Record physical Safari chrome, software keyboard, real safe-area and one-handed reach as unverified unless Simulator or physical-device evidence is actually collected.

### Regression barrier
- The dense-fixture `group-schedule` Playwright flow must pass at the `390 x 844` stress baseline and both target-iPhone portrait projects, proving exact time grouping, maximum-three visible actions, attendance round-trip with restored context, readable toolbar/navigation and no horizontal overflow.

## Risks and stop conditions
- Stop if any required action or state is absent from `ScheduleLesson`/`allowedActions`; do not infer it or expand the API inside TASK-133.
- Stop for product review if the UI handoff would hide permitted attendance, keep destructive cancellation permanently visible, or replace exact occurrence identity with an aggregate action.
- Stop if implementation needs a second visible create, detail or retry action to match an illustrative PNG; the README correction is authoritative instead.
- If TASK-131 lands first, preserve its group-type filter assertions and adapt locators without weakening its URL/API regression barrier.
- If restoring list position requires a generic router rewrite rather than a bounded schedule-origin snapshot using existing history-state patterns, split that infrastructure work before proceeding.
