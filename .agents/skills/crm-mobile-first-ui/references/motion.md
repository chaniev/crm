# CRM motion

Use when adding, changing, or reviewing animation and transition behavior.

## Decide whether motion belongs

Name the frequency and purpose before choosing a technique.

| Frequency | Default decision |
|---|---|
| Repeated navigation or keyboard-first action | Instant; no animation |
| Frequent row, filter, or mode interaction | None or near-imperceptible feedback |
| Occasional modal, drawer, disclosure, or notification | Short functional motion |
| Rare onboarding or milestone | Restrained delight may be considered |

Allowed purposes are feedback, spatial continuity, state indication, or
preventing a jarring change. `It feels modern` is not a purpose. Do not move
data the user is reading or acting on for decoration.

## Select the smallest compatible technique

1. Reuse Mantine transition behavior or existing project tokens.
2. Use a CSS transition for hover, press, opacity, and controlled state changes.
3. Use CSS animation or WAAPI only when a transition cannot express the
   lifecycle.
4. Add a motion dependency only when an approved interaction genuinely needs
   springs, gestures, coordinated layout, or exit orchestration and existing
   tools cannot provide it.

Prefer `transform` and `opacity`. Avoid layout animation, large blur, and
permanent `will-change`. Do not invent a parallel duration or easing system.

## Required behavior

- Entrance motion uses a decelerating curve; exits do not linger.
- Frequent feedback should normally complete within 200 ms; ordinary temporary
  surfaces should remain below 300 ms unless the existing Mantine pattern
  defines otherwise.
- Animation is interruptible and cannot block the next operation.
- Open and close behavior preserve focus placement and focus return.
- `prefers-reduced-motion` produces an equivalent, understandable state change.
- Hover-only feedback is gated for devices that support hover.
- Motion does not delay primary actions, validation, recovery, or status
  announcements.

Verify the actual interaction, including rapid repetition, interruption,
reduced motion, compact height, and mobile WebKit behavior.
