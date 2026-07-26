# Mantine mobile patterns

Use the installed Mantine version and inspect existing shared components before adding a pattern.

## Selection guide

| Need | Preferred direction |
|---|---|
| Compact mobile filters | Trigger button plus `Drawer`; keep search visible when it is the primary locator |
| Secondary row actions | `Menu` with a clear accessible label |
| Destructive confirmation | `Modal` with explicit entity and consequence |
| Short mobile form | Single-column `Stack`; keep validation near the field |
| Dense desktop data | Task-oriented mobile rows/cards and desktop table from the same typed data model |
| Temporary status | Notification for transient feedback; persistent inline state when recovery is required |
| Segmented mode switch | Use only for a small mutually exclusive set; do not use as navigation for many destinations |

## Rules

- Prefer existing shared wrappers and theme tokens over raw inline values.
- Keep DOM and accessible names stable across breakpoints where practical.
- Responsive variants must expose equivalent information and operations.
- A `Drawer` or `Modal` must have a clear title, close behavior, initial focus strategy, and focus return.
- Icon-only controls require accessible labels and 44 x 44 px interaction areas.
- Do not add an icon when text alone is clearer.
- Do not place every row action permanently on mobile.
- Do not hide the primary row action in `Menu`.
- Avoid nested modals and nested scroll regions.
- Preserve pending state and prevent repeated submission.
- Bottom-anchored controls combine normal spacing with `env(safe-area-inset-bottom)` or an equivalent inset.
- Full-height mobile `Drawer` and `Modal` surfaces use dynamic viewport sizing and retain a usable compact-height scroll path.

## Filters

- Keep the filter surface collapsed by default on mobile unless filtering is the screen's primary task.
- Show active state on the trigger.
- Provide clear application semantics: immediate application or explicit apply, not a mixture.
- Preserve selections while the surface is temporarily closed.
- Reset only the affected filter scope and make the effect predictable.
- Do not display redundant headings, explanatory copy, counts, and reset controls when they do not improve the task.

## Forms

- Use the correct input type and autocomplete attributes.
- Keep text inputs, textareas, and selects at 16 CSS px or larger on iPhone.
- Keep labels persistent for ordinary forms, multiple or ambiguous fields, and
  period/date/scope controls. A sole obvious route-level search may use a
  visually-hidden label or ARIA name, but never placeholder-only identification.
- Scroll or focus the first invalid field after submit.
- Preserve entered values after recoverable API errors.
- Keep the submit action visible or reachable with the mobile keyboard open.
