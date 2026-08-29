# TASK-157 mobile schedule visual contract

## Authority

This backlog-owned contract translates the user-approved conversation mockup
into implementation constraints. `REQ-GRP-007`, the TASK-157 card and existing
backend contracts remain authoritative if the interactive concept differs in
geometry or behavior.

## Source evidence

- Current iPhone Air screenshot:
  [`artifacts/screenshots/schedule-iphone-air-420x912.png`](../../../artifacts/screenshots/schedule-iphone-air-420x912.png).
- Current scrolled screenshot:
  [`artifacts/screenshots/schedule-iphone-air-420x912-scrolled.png`](../../../artifacts/screenshots/schedule-iphone-air-420x912-scrolled.png).
- User-approved interactive direction (external conversation artifact):
  `/Users/muradchaniev/.codex/visualizations/2026/08/29/01a04f29-2b70-78c3-92d5-cd3cf24e2f35/schedule-mobile-redesign.html`.

## Selected direction

Compact rows inside one surface per exact time interval:

1. Compact shell header.
2. One non-wrapping date row: previous, date plus weekday, next, create.
3. One summary row: lesson count plus visibly labelled filter trigger.
4. Exact time group header with occurrence count.
5. Repeated compact lesson rows separated tonally rather than independent high cards.
6. Fixed bottom navigation with the existing route order and labels.

Each collapsed lesson row shows:

- group name as the first reading anchor;
- branch plus hall and trainer as aligned decision data with readable contrast;
- one backend-derived neutral attendance status;
- visible `Посещаемость` as the frequent action;
- `Ещё` for edit and exceptional actions;
- a rightward detail affordance on the row body.

The collapsed row does not show group-type or recurrence badges. These fields
remain available in detail and are not removed from contracts.

## Interaction hierarchy

- Route-level primary: create, only when backend capability allows it.
- Row frequent action: `Посещаемость`, visible in one interaction with
  secondary visual emphasis.
- Row secondary and exceptional actions: `Ещё`; destructive operations retain
  the existing preview/confirmation flow.
- Row body: opens detail and uses a rightward navigation affordance.
- Filters: collapsed by default, visibly labelled, active state discoverable,
  existing clear/reset and focus-return behavior preserved.

## Responsive acceptance

- `420 x 912`: at least four full lesson rows plus the next time header.
- `390 x 844`: at least three full lesson rows.
- `360 x 780`: no lost decision data, clipped labels or horizontal page scroll.
- `440 x 956`: no unnecessary expansion that returns to tall independent cards.
- `912 x 420` and `956 x 440`: usable compact-height path without nested scroll traps.
- Every independent target is at least `44 x 44px` with at least `8px`
  separation. This overrides the smaller visual icon boxes in the exploratory
  conversation artifact.

## Operational states

The same compact hierarchy must be rendered for loading, empty, filter-empty,
stale/error/retry, restricted, cancelled, substitution and mixed attendance
states. No new frontend-owned schedule or attendance meaning may be inferred.

## Deliberate non-goals

- no desktop/week-grid redesign;
- no new `Сейчас`, `Следующее`, overdue or attendance-required state;
- no backend, permissions, recurrence, cancellation or attendance changes;
- no direct copy of exploratory HTML/CSS into production.

## Analysis addendum (2026-08-30)

Additive evidence and constraints from the all-screens mobile analysis
(26 routes rendered at 420 x 912; artifacts under
`artifacts/screenshots/all-screens/`). The approved direction above is not
changed.

Additional rendered baseline:

- `06-schedule-day-top.png` quantifies the current budget: ~250–280px
  (28–31% of the first viewport) before the first lesson card — date row,
  weekday chips row and filter chips row; only ~2 full cards fit.
- The schedule is the only screen with three legitimate control rows; the
  approved two-row hierarchy (date row + summary/filter row) remains the
  cross-screen reference for TASK-163/TASK-164.

Additive implementation constraints:

- Row typography follows the registry standard observed on «Клиенты»,
  «Тренеры», «Журнал»: group name 15–16px, weight 600–700, as the first
  reading anchor; branch/hall/trainer metadata 12–13px in secondary color;
  one neutral attendance status.
- Compact rows consume the shared list-row surface tokens introduced by
  TASK-160 (tonal separation, radius ≤ 16px, no per-row elevation). The
  contract's "tonally separated rows" maps to those tokens; until TASK-160
  integrates, local values must match them.
- Heading sizes on `≤ 48rem` follow the mobile type overrides from TASK-158
  rather than the desktop heading scale.

