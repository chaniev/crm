# Mobile acceptance criteria

Use the applicable checks. A screen does not pass merely because it renders at the target width.

## Viewports

| Mode | Required screen or viewport |
|---|---:|
| Narrow mobile guardrail | 360 x 780 |
| Narrow design stress baseline | 390 x 844 |
| Target iPhone Air portrait screen | 420 x 912 |
| Target iPhone 17 Pro Max portrait screen | 440 x 956 |
| Target iPhone Air compact-height smoke | 912 x 420 |
| Target iPhone 17 Pro Max compact-height smoke | 956 x 440 |
| Tablet | 768 x 1024 |
| Desktop | 1440 x 1200 |

Use 390 x 844 to expose cramped-layout failures, not as a substitute for
target-device acceptance. A significant mobile workflow is ready only after it
passes the narrow baseline and both target iPhone portrait screen sizes.

The portrait values above are full logical screen sizes. Mobile Safari browser
chrome and the software keyboard reduce the visible page viewport. WebKit
automation must therefore use a mobile device profile with the target screen
size, while Simulator or physical-device checks verify the actual changing
visual viewport.

## Interaction

- Minimum interactive target: 44 x 44 CSS px.
- Minimum 8 px separation between independent adjacent touch targets.
- Body text: at least 16 px unless an existing accessible design token explicitly defines a larger value.
- Text inputs, textareas, and selects use at least 16 CSS px text on iPhone.
- Focus is visible for every keyboard-operable element.
- Focus order follows visual and task order.
- Closing a modal, drawer, or menu returns focus to its trigger when that trigger still exists.
- Escape closes temporary desktop surfaces; mobile back or explicit close behavior is defined.
- With the software keyboard open, the focused field, its validation or recovery feedback, and the primary action remain visible or reachable within one intentional scroll.
- A fixed primary action is not covered by browser chrome, the software keyboard, or the home indicator.
- Destructive actions require explicit wording and confirmation when the consequence is not immediately reversible.

## Layout and content

- No unintended horizontal page scrolling at 360, 390, 420, or 440 px.
- Content does not overlap, clip, or disappear at 200% zoom.
- Long names, labels, and values wrap or truncate with an accessible way to obtain the full value.
- Dense desktop tables transform into task-oriented mobile content unless horizontal comparison is the explicit user task.
- Closed filters do not permanently consume the main mobile content area.
- Active filters remain discoverable and removable.
- The primary action does not compete with several equally emphasized actions.
- Route headers on mobile, tablet, and desktop default to title plus actions;
  decorative subtitle, eyebrow, badge, intro, or helper copy is absent.
- Every remaining explanatory text maps to a concrete validation, recovery,
  security/legal, prerequisite, decision-changing constraint, ambiguous scope,
  or operational-state need and is placed next to that field, action, section,
  toolbar/detail context, or state panel.
- Desktop `1440 x 1200` does not reintroduce mobile-forbidden intro/hero or
  subtitle copy merely because more space is available.
- A sole, obvious route-level search has no visible generic `Search`/`Find…`
  label on mobile, tablet, or desktop.
- Every visually unlabeled searchbox has a stable operation-and-object
  accessible name from a label or ARIA; placeholder is not its only name.
- Ordinary form fields, multiple or ambiguous text fields, and
  period/date/scope controls retain visible persistent labels.
- A top-level list has no visible route heading when an active persistent nav
  item already names the same route; a semantic level-one heading, document
  title, named main landmark, and active-nav state remain.
- Removing a duplicate list heading leaves no blank spacer or action-only row;
  the first visible row is a locator, summary, filters, or task content.
- Actions formerly owned by the hidden header remain visible in the first task
  toolbar when primary/frequent and retain accessible names.
- A route-level locator/search, filter trigger, and retained toolbar actions
  occupy one non-wrapping row at `360`, `390`, `420`, `440`, `768`, and
  `1440px`; an action-only second line is not used to resolve width pressure.
- The locator/search keeps a useful minimum width: `156px` at `360`, `176px`
  at `390`, `200px` at `420`, `216px` at `440`, `320px` at `768`, and
  `420px` at `1440`. Primary create may become an accessible icon-only
  `44 x 44px` control on mobile and restore its text on desktop.
- Secondary actions are collapsed or removed before the search is made
  unusable; horizontal toolbar scrolling and unintended page scrolling are
  not acceptable fallbacks.
- Registry screens do not gain aggregate summary/stat widgets solely to fill
  space; every retained widget changes a current decision and cannot be shown
  more directly in locator, filter, range/status, or entity rows.
- Content under an active persistent tab does not begin with a section
  card/title widget that repeats the tab or renames the same obvious
  collection. The populated list or operational state starts immediately;
  any semantic list name remains visually hidden or accessible-only.
- Desktop `768/1440` does not restore a mobile-removed duplicate tab heading,
  summary card, or standalone range/status panel merely to use available
  space.
- A primary filter/control is not preceded by a generic task heading or
  decorative date/scope meta when the active tab plus the control's own label
  and selected value already provide that context. Ordinary select/date/form
  labels remain visible or otherwise explicitly associated.
- A sole unambiguous workspace context selector may omit its visible generic
  label only as a documented exception: it retains an operation-specific
  accessible name independent of placeholder/value and has no adjacent
  competing selector. Forms and multi-selector toolbars retain visible labels.
- Desktop `768/1440` does not restore control-intro copy removed at mobile
  widths; exceptions remain limited to validation, recovery, ambiguous scope,
  prerequisites, or decision-changing constraints placed beside the control.
- The Groups registry has no top summary/stat widgets at mobile, tablet, or
  desktop widths; locator/filter toolbar and results use the released space.
- Detail/create/edit/auth screens and routes under a generic `More`
  destination keep a visible title when navigation does not name the task;
  recovery states with specific headings do not duplicate an active route name.
- When an active overflow destination replaces the last primary route item,
  the adaptive item shows the exact authorized route label/icon and
  `aria-current="page"`; the displaced primary item moves into overflow and
  the generic `More` trigger remains visible and is not marked current.
- Dynamic overflow state follows resolved route/access on deep link, reload,
  back/forward, and redirect without showing unauthorized or stale items.
- Current Russian overflow labels remain fully visible in one line at
  `360–440px`; every item stays at least `44 x 44px` and creates no horizontal
  page scroll.
- A configured auth/start-page background preserves aspect ratio and registered
  focal point without moving, covering, or reducing contrast of the form at
  `360`, `390`, `420`, `440`, `768`, or `1440px`.
- Missing, unknown, or failed auth background assets fall back
  deterministically and never block login, validation, or recovery.
- Fixed and sticky headers, bottom navigation, action bars, close controls, and notifications remain inside the safe area.
- Safe-area spacing combines the project spacing token with `env(safe-area-inset-*)` or an equivalent measured inset; the safe-area inset does not replace the normal content margin.
- Full-height mobile surfaces remain usable as Safari chrome expands or collapses and do not rely on `100vh` alone as evidence of correct height.
- At 912 x 420 and 956 x 440, shell navigation, temporary surfaces, forms, and primary actions have a usable compact-height path without clipped controls or nested scrolling traps.

## Operational states

Verify when applicable:

- loading does not look like an empty result;
- empty state explains the state and provides the relevant next action;
- error state identifies what failed and provides a recovery action;
- disabled controls explain prerequisites when the reason is not obvious;
- permission-restricted state does not expose an unusable control;
- duplicate submission is prevented;
- success feedback confirms the affected entity or operation;
- stale data and partial completion do not appear as full success.

## Playwright behavior

Cover:

1. the primary user task;
2. one meaningful failure and recovery;
3. one integration or permission edge;
4. open/close behavior for affected modal, drawer, menu, or filter surface;
5. absence of unintended horizontal overflow;
6. preservation of important search/filter context after navigation when required;
7. the 390 x 844 stress baseline and target-device portrait acceptance at 420 x 912 and 440 x 956;
8. compact-height shell and temporary-surface behavior when rotation is supported.

Run target-device acceptance with WebKit mobile emulation, an iPhone user agent,
touch enabled, a 3x device scale factor, and the target logical screen size.
Desktop Chromium with only `page.setViewportSize()` is geometry coverage, not
iPhone Safari acceptance.

Prefer role, label, and observable behavior assertions. Screenshot comparisons may supplement but must not replace behavioral coverage.

## Required commands

From `frontend/`:

```text
npm run lint
npm run build
npm run test:e2e -- <affected-spec>
npm run test:e2e:iphone
```

Report commands actually run, their result, and checks that still require Safari
Responsive Design Mode, an iOS Simulator, a deployed environment, or a physical
device. Browser chrome, the software keyboard, safe-area insets, Dynamic Island,
the home indicator, and one-handed reach require Simulator or physical-device
evidence before claiming device-level acceptance.
