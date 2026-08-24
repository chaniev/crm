# TASK-133 proposed mockups v2

The `v2-*` files are the implementation reference. The older unprefixed PNGs
are retained as comparison evidence.

## Screen matrix

| File | Purpose |
|---|---|
| `v2-mobile-narrow-360x780.png` | Narrow-width guardrail; icon-only secondary card actions |
| `v2-mobile-main-390x844.png` | Mobile stress baseline and primary attendance path |
| `v2-mobile-main-420x912.png` | Target portrait geometry |
| `v2-mobile-mixed-states-440x956.png` | Long content, restricted attendance, cancelled and capability-minimal cards |
| `v2-mobile-more-drawer-390x844.png` | Deferred and destructive actions with exact occurrence context |
| `v2-mobile-loading-390x844.png` | Loading skeleton preserving selected date and navigation context |
| `v2-mobile-empty-390x844.png` | Empty day with create as the sole primary operation |
| `v2-mobile-error-stale-390x844.png` | Recoverable error plus explicitly stale last-known content |
| `v2-compact-more-drawer-912x420.png` | Compact-height action surface without nested scrolling |
| `v2-tablet-main-768x1024.png` | Single-column tablet list, icon rail and visible card-body focus |
| `v2-desktop-main-1440x1200.png` | Dense desktop grid with compact, left-aligned action clusters |

## Implementation contract

- The toolbar stays on one line. At `360–440px` it contains previous date,
  the full selected date, next date and an icon-only create action. Settings
  moves outside this row.
- The day heading shows the weekday; the toolbar owns the full date. This
  avoids repeating the same date immediately above the list.
- Group name, branch/hall and effective trainer are the card's primary
  decision data. Default source kind is lower emphasis; exception and neutral
  attendance states remain visible.
- Card body opens detail and has its own focus ring. Nested actions do not
  trigger body navigation.
- `Посещаемость` is the only visually dominant card action. `Изменить` and
  `Ещё` use natural-width secondary controls. At `360px`, both secondary
  controls may be icon-only with stable accessible names.
- `Ещё` renders only when at least one deferred backend action is allowed.
  Cancellation/restore is never permanently visible on a repeating card.
- The action surface identifies group, branch/hall, exact interval and trainer
  before exposing cancellation. Cancellation still opens the existing
  confirmation flow.
- Disabled attendance keeps the backend-provided reason next to the disabled
  control. Cancelled cards do not expose attendance as an apparently usable
  action.
- Empty, loading, recoverable error and stale states retain the selected date.
  Stale content must not look like a successful fresh response.
- Mobile navigation and temporary surfaces include normal spacing plus the
  safe-area inset. The compact-height surface fits without nested scrolling.
- Desktop uses a two-column grid for the dense group; tablet switches to one
  column instead of squeezing the desktop grid.

## Interaction details not encoded by PNG

- Minimum target size is `44 x 44px`; independent targets have at least `8px`
  separation.
- `Escape` closes desktop menus and temporary surfaces. Explicit mobile close
  and browser back close the mobile surface. Focus returns to the originating
  `Ещё` trigger.
- History back/forward remains authoritative. Explicit returns restore the
  captured schedule URL, exact time-group/card anchor and scroll position.
- Loading prevents duplicate mutation actions. Retry keeps date and filters.
- Visible text is illustrative presentation copy only where the task already
  defines that state; permissions and reasons still come from backend fields.

