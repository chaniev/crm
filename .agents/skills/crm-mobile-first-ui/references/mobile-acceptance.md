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
