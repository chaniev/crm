# Gym CRM visual language

## Authority and scope

This document defines the visual language of the React CRM frontend. It does
not define roles, permissions, validation, membership, attendance, audit, or
other business behavior. Those remain owned by accepted requirements and
backend contracts.

Executable theme values and component behavior take precedence when this
document drifts. Update this document together with an intentional visual-system
change; do not treat an isolated local style as a new convention.

Governing sources:

- `src/theme/createGymCrmTheme.ts`;
- `src/theme/semanticVariables.ts`;
- `src/theme/profiles.ts`;
- `src/features/shared/**`;
- `.agents/skills/crm-mobile-first-ui/**`.

## Product character

Gym CRM is an operational tool for coaches and administrators. It should feel:

- calm and trustworthy;
- compact but not cramped;
- direct rather than promotional;
- visually ordered around the current task;
- restrained enough for frequent daily use.

Visual novelty is welcome only when it improves hierarchy, recognition,
feedback, or spatial understanding. Decorative dashboards, generic hero copy,
and effects that compete with operational data do not fit the product.

## Typography

- Onest is the product typeface for body text and headings.
- Hierarchy comes from size, weight, spacing, and placement before extra color
  or decoration.
- Body and form text remains readable on iPhone; inputs do not trigger zoom.
- Numeric columns and repeated operational values should align predictably;
  use tabular numerals when comparison benefits.
- Truncation is reserved for dense repeated content and must preserve access to
  the full value. Consequences and recovery text are never truncated.

## Color and surfaces

- The bundled default foundation is warm neutral page space, white or subtle
  surfaces, dark green text, a green primary action, and restrained secondary
  accents. A validated customer branding profile may replace brand/accent and
  neutral families; the auth primary action follows the customer primary color.
- Semantic variables under `--crm-*` are the implementation contract. Do not
  introduce raw colors where an appropriate semantic variable exists.
- Use one dominant action accent within a task state. Status colors communicate
  backend state and are not decorative accents.
- Customer branding never reassigns functional status meaning. Unknown,
  invalid or broken branding falls back to bundled defaults.
- Prefer tonal separation and borders for grouping. Shadows indicate actual
  elevation or temporary surfaces and remain restrained.
- Gradients already owned by the theme may be reused for their established
  role; do not introduce decorative gradient systems locally.

## Layout and density

- Start with the user's operation, not a decorative page introduction.
- Keep one visually dominant primary action per active task state.
- Group by decision and operation. Avoid card mosaics that fragment one list or
  workflow into unrelated-looking widgets.
- Extra desktop width does not justify summary cards, duplicate headings, or
  explanatory copy that does not change a decision.
- Mobile is a deliberate task-oriented composition, not a compressed desktop
  table. Desktop may increase visible context without changing the hierarchy of
  operations.
- Use spacing consistently to express containment and relationship; avoid
  nested cards used only to manufacture hierarchy.

## Components and interaction

- Use Mantine and the shared components in `src/features/shared` before creating
  local primitives.
- Preserve accessible names and equivalent operations across responsive
  variants.
- Icon-only controls are reserved for familiar, space-constrained actions and
  require stable accessible labels and 44 x 44 px targets.
- Loading, empty, error, stale, disabled, restricted, pending, and success are
  designed states, not implementation leftovers.
- Motion is functional and restrained. Frequent navigation and keyboard-first
  actions remain instant.

### Motion contract

- Custom feedback uses `--crm-motion-duration-fast` (120 ms) or
  `--crm-motion-duration-standard` (140 ms) with
  `--crm-motion-easing-functional`; repeating loading feedback uses the
  dedicated continuous duration/easing pair.
- With `prefers-reduced-motion: reduce`, repeating skeleton motion stops and
  temporary surfaces become effectively instant. Static skeleton geometry,
  explicit loading copy, focus, completion copy and live-region announcements
  remain available.
- Motion is never the only evidence of loading, pending, completion or error.

### Semantic tone contract

- Functional presentation uses the typed tones `danger`, `warning`, `success`,
  `info` and `neutral`; brand/accent colors do not stand for CRM status.
- Tone components consume `--crm-status-*-fg`, `--crm-status-*-bg` and
  `--crm-status-*-border` together with an icon/text cue. The original
  `--crm-status-*` paint variables remain for compatibility until the
  production migration task removes approved bypasses.
- Direct Mantine functional names such as `red`, `yellow`, `teal`, `blue` and
  `gray` are scanner fixtures for TASK-150 enforcement. Decorative brand use
  stays separate from status tone APIs.

### Bundled theme profile authoring

- `ThemeProfile` schema v2 is the bundled compatibility contract. It names
  `brand.primary`, optional `brand.secondary`, `roles.neutral`,
  `roles.accentThree` and `roles.accentFour`; every palette has exactly ten
  hex colors and every named palette is consumed by theme generation.
- Register bundled profiles through `createThemeProfileRegistry`. Validation
  rejects unknown fields, malformed or short palettes and duplicate IDs with
  the profile ID and exact field path. A v1 profile with the three historically
  consumed supplementary palettes is adapted to v2; the formerly ignored
  fourth positional palette is rejected.
- Preserve existing profile IDs. Blank or unknown configured IDs continue to
  resolve to `default-green-v1` without blocking login.
- Before registering or changing a bundled profile, run the all-profile
  contrast matrix, focused registry/bootstrap tests, the frontend baseline,
  and representative alternate-theme mobile and desktop screens.
- This compatibility schema is not the runtime customer-settings schema. It
  does not define persistence, API payloads, arbitrary CSS/colors,
  customer-specific neutral/status/auth roles or onboarding behavior.

## Design acceptance

A design is not approved because it compiles or satisfies a checklist. For a
material redesign, acceptance requires:

- an explicit UX contract and visual brief;
- rendered alternatives or an already approved design;
- a recorded selected direction;
- runtime comparison at mobile and desktop widths;
- realistic content and consequential operational states;
- evidence for hierarchy, scanability, density, rhythm, typography, identity,
  feedback, and responsive integrity.

Record approved deviations in the task's visual contract. Do not silently turn
one exception into a global design rule.
