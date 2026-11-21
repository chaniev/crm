# TASK-168 design gate: today attendance worklist

## UX contract

- Primary user: Coach or Administrator on a phone at the start of the working day; management roles use the same route from navigation.
- Task: scan backend-authorized lessons for the CRM day, choose the next exact occurrence with unmarked clients, and open its attendance workbench.
- Completion signal: the exact occurrence workbench opens; returning refreshes the list and restores the source row and scroll position when that row remains.
- Decision data: group, start/end time, branch and hall, effective trainers, and backend `unmarkedClientCount`.
- Primary/frequent actions: one visible `Открыть` action per row and one explicit `Обновить` action for the list.
- Backend-owned rules: date, access scope, occurrence eligibility, ordering, and count. The UI does not filter or infer any of them.
- States: loading, one empty state for empty day/scope, full error with retry, partial result with retry, stale action recovery, long content, and refreshed return state.
- Focus/back: activation stores the source occurrence anchor and scroll offset. On return, refresh first, then focus the same row; if removed, focus the next row, otherwise the list refresh action.
- Success criteria: at 390 x 844 the first actionable row and its 44 px action are visible without scrolling, long values wrap without horizontal overflow, and a row is distinguishable in one scan by time, group, location, trainer, and count.

## Visual brief

SURFACE
- Route: `/attendance` without an occurrence target.
- Current problem: the route is a schedule-link placeholder instead of a worklist.

VISUAL INTENT
- Character: calm, compact, operational, and consistent with the current warm-neutral CRM.
- Density: several actionable lessons above the mobile bottom navigation without shrinking touch targets.
- Hierarchy: chronological position → group → location/trainer → unmarked count → action.
- Acceptable novelty: layout/grouping may change; no dashboard metrics, decorative hero, or new design system.
- Existing exemplar: task-first schedule rows and shared list/state surfaces.

CONSTRAINTS
- Onest, current semantic colors, 8 px list-row radius, border/tonal grouping, no row shadows.
- No visible route heading because persistent navigation already names `Посещения`.
- No restricted rows; every rendered row is actionable because backend already filters the response.
- Required concept viewports: 390 x 844 and 1440 x 1200; populated and partial-result state.

SELECTION CRITERIA
- Fastest chronological scanning during repeated daily use.
- Clear count/action association without implying frontend urgency or priority.
- Deliberate mobile-to-desktop transformation and resilience to long Russian content.

## Directions

| Direction | Design axis | Main advantage | Cost or risk | UX-contract fit |
|---|---|---|---|---|
| A — Time rail | Chronological list with a persistent time column | Fastest scan and compact mobile density | Location metadata is visually quieter | Strong |
| B — Time bands | Lessons grouped under explicit time-band headers | Best separation when several lessons share a start time | Repeated headers consume more vertical space | Strong for parallel lessons |
| C — Action ledger | Count and action form a stable trailing ledger; desktop becomes a table-like list | Strong count-to-action association and desktop throughput | Mobile rows feel denser and need careful long-name wrapping | Strong for administrators |

The product owner selected direction C. Its stable trailing count/action ledger
is the approved hierarchy for both mobile operations and desktop throughput.

## Operational contract shared by all concepts

- Visible: explicit refresh, ordered actionable rows, exact decision data, `Не отмечено N`, and one `Открыть` action.
- Absent: date picker, schedule filters, restricted/disabled rows, role-derived hints, metrics, duplicate heading, and automatic day rollover refresh.
- Partial state: valid rows remain visible; a warning names partial loading and exposes retry without presenting full success.
- Route transition: `Открыть` navigates with backend `lessonOccurrenceId` and `lessonDate`; return restores the attendance-list origin, row anchor, and scroll position after refresh.

## Selection record

- Status: selected by product owner on 2026-09-01.
- Selected direction: C — Action ledger.
- Feedback: implement direction C; preserve the accepted `Scheduled | Cancelled`
  lifecycle and remove stale `NotHeld` assumptions from TASK-168.
- Rejected alternatives: A and B remain exploration evidence only.

## Implementation-ready contract: direction C

- Content order: refresh toolbar, optional inline operational alert, one
  accessible today-worklist, then rows in backend order. No visible route title,
  date picker, summary metrics, filters, or schedule link.
- Desktop (`768–1440`): a table-like list with aligned columns for time,
  group, location/trainers, `Не отмечено N`, and `Открыть`. Rows use the shared
  subtle list surface, muted border, 8 px radius, and no shadow.
- Mobile (`360–440`): each row becomes a three-column task card. Time is the
  leading locator, group is the dominant wrapping value, location/trainers and
  count stack below it, and the 44 px `Открыть` action remains in the trailing
  column. No field is hidden or horizontally scrolled.
- Tablet and compact height use the same mobile information order until the
  desktop columns fit without compression. Bottom navigation and safe-area
  spacing remain owned by the existing shell.
- Loading: shared list-shaped loading state plus explicit polite status copy;
  it must not resemble an empty result.
- Empty: one neutral state for no actionable lessons, with explicit refresh and
  no forced navigation to schedule.
- Full error: persistent error state with `Повторить`; no stale rows presented
  as current success.
- Partial result: valid rows stay visible under a warning with `Повторить`.
- Stale action: failed/opened row triggers an immediate list refresh; if the row
  disappears, focus moves to the next row or the refresh action when no row
  remains.
- Return: opening stores `lessonOccurrenceId`, list scroll offset, and row
  anchor. Returning from the attendance workbench refreshes once, restores the
  row when it remains, and otherwise uses the same deterministic fallback.
- Explicit refresh is the only other reload trigger. A CRM-day change by itself
  does not schedule a timer or reload.
- Acceptance: exact backend identity/date are passed to the workbench; every
  rendered row is actionable; targets are at least 44 px; long content wraps;
  no page overflow at 360/390/420/440 or the target compact-height profiles.

## Artifacts

`prototype.html` is an isolated, non-production static prototype. Screenshots are generated for each direction, state, and required concept viewport under `renders/`.
