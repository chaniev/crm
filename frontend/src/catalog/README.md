# Design-system catalog shell

## Tool selection

Phase A compares two viable approaches:

| Criterion | Separate Vite entry | Storybook |
|---|---|---|
| Added runtime/build dependencies | None; reuses installed Vite, React and Mantine | Adds Storybook runtime, builders, addons and upgrade surface |
| Production isolation | Explicit HTML input and `dist-catalog`; normal build assertion inspects `dist` | Separate command by convention, but dependency/config integration is larger |
| Production fidelity | Uses the exact application React/Vite/Mantine pipeline | Requires keeping Storybook decorators and Vite behavior aligned |
| Phase-A needs | URL controls and registry smoke need little infrastructure | Strong story/addon ecosystem is more than the stable-shell slice needs |

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
and future visual baselines should include all four parameters.

## Phase boundary and ownership

Phase A owns the shell, isolated build and foundation-registry smoke only. It
does not claim final component coverage. TASK-146, TASK-149 and TASK-151 must be
integrated before the component inventory and acceptance matrix can be closed.

The frontend design-system owner updates catalog examples whenever a stable
production foundation or shared component contract changes. Final TASK-152
review must compare examples with the production export inventory and add the
remaining interaction/accessibility coverage without implementing missing
components inside catalog fixtures.
