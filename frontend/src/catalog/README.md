# Design-system catalog shell

## Tool selection

The initial tool selection compared two viable approaches:

| Criterion | Separate Vite entry | Storybook |
|---|---|---|
| Added runtime/build dependencies | None; reuses installed Vite, React and Mantine | Adds Storybook runtime, builders, addons and upgrade surface |
| Production isolation | Explicit HTML input and `dist-catalog`; normal build assertion inspects `dist` | Separate command by convention, but dependency/config integration is larger |
| Production fidelity | Uses the exact application React/Vite/Mantine pipeline | Requires keeping Storybook decorators and Vite behavior aligned |
| Catalog needs | URL controls, inventory and interaction smoke need little infrastructure | Strong story/addon ecosystem is more than this catalog needs |

Decision: use the separate Vite entry. Revisit Storybook only if later catalog
work demonstrates that interaction documentation or addon-based accessibility
coverage offsets its dependency and configuration cost.

## Commands and isolation

- `npm run catalog:dev` opens `/catalog.html` locally.
- `npm run catalog:build` writes only to `dist-catalog`.
- `npm run build` writes the CRM to `dist` and then asserts that no catalog path
  or catalog entry marker reached production output.

Catalog source imports production foundation/theme registries. Do not copy a
shared component, recipe or token into this directory. Fixtures may supply only
content and state needed to exercise a production export.

The canonical URL parameters are `theme`, `viewport`, `motion` and `content`.
Unknown values normalize deterministically to bundled defaults. Review links
and visual baselines include all four parameters. The required review widths
are `390`, `440` and `1440`; the preview frame applies the selected width and
the catalog Playwright projects run the browser at the matching viewport so
CSS media queries are exercised rather than inferred from a label.

## UX and visual contract

- User: frontend developer, designer or reviewer inspecting production UI
  contracts without entering a CRM workflow.
- Primary path: open an addressable URL, select theme/viewport/motion/content,
  then scan foundations, recipes and canonical shared examples in that order.
- Completion signal: every runtime export from `features/shared/ux.tsx` matches
  an item in `componentInventory.ts` and has a rendered source-linked example.
- Responsive direction: one-column examples at narrow widths; denser grids at
  desktop without changing component order. Controls remain labelled and at
  least 44 CSS px high. Long content wraps; page-level horizontal overflow is
  a regression.
- Interaction states: focusable, loading, disabled, error, empty, restricted,
  destructive confirmation, pagination, filters and reduced motion are shown
  with fixture-only state. No fixture defines permissions or CRM business
  meaning.
- Reduced motion is selected with `motion=reduced`; repeating animation is
  effectively stopped while explicit loading/status copy remains.

## Inventory, sources and ownership

`componentInventory.ts` is the executable audit of retained shared runtime
exports. `SharedComponentsCatalog.tsx` imports those production exports through
the same `features/shared/ux.tsx` public contract used by the application. Each
example links to its owning source file. Foundations come directly from
`theme/foundations.ts`, typography from `theme/typography.ts`, theme profiles
from `theme/profiles.ts`, tones from `theme/semanticTones.ts`, and Mantine
defaults from `theme/componentRecipes.ts` through `createGymCrmTheme`.

The frontend design-system owner updates catalog examples whenever a stable
production foundation or shared component contract changes. Final TASK-152
review compares the runtime export namespace with the inventory test. A new or
removed shared export therefore fails until its canonical example and source
mapping are updated. Missing product components must be implemented in their
production owner task first; never satisfy catalog coverage with a local copy.

Run `npm run catalog:test:e2e` for smoke, semantics, focus/interaction,
reduced-motion and overflow checks at 390, 440 and 1440 CSS px. Browser chrome,
safe-area insets, software keyboard and physical-device behavior are not
claimed by this developer-tool catalog.
