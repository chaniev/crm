# Implementation Plan: TASK-145 Централизовать foundation scales дизайн-системы

## Metadata
- source_task: /backlog/done/2026-08-29/TASK-145-design-foundation-scales.md
- completion: implemented and locally integrated into main on 2026-08-29
- requirements: none — behavior-preserving refactor retains computed geometry and responsive behavior
- branch: refactor/TASK-145-design-foundation-scales
- readiness: yes
- dependencies: none; coordinate motion token ownership with TASK-144 and typography ownership with TASK-146
- risk: medium — broad token substitution can alter cascade, stacking contexts and responsive boundaries

## Goal
Spacing, breakpoints, radii, elevation, layer and motion aliases have one documented implementation contract, and representative screens retain their current computed geometry, overflow and stacking behavior.

## Decisions and contracts
- Build the scale from an inventory of current computed values; introduce aliases only for demonstrated equivalence and document narrow exceptions.
- Canonical breakpoints have one owner and spelling; preserve the current `em/rem` responsive thresholds exactly.
- Layer names describe app shell, sticky controls, temporary surfaces and overlays without creating new stacking contexts.
- TASK-144 owns reduced-motion semantics; this task may host shared duration aliases but cannot redefine its policy. TASK-146 owns type roles.

## Scope
### In
- Inventory, token definitions, static drift checks and bounded behavior-equivalent migration of representative slices.

### Out
- Density/visual redesign, typography roles, feature-responsive redesign, wholesale CSS decomposition.

## Implementation slices
1. Produce a checked inventory of raw values and capture before geometry/computed-style evidence for auth, shell, list/form and temporary surface.
2. Complete the required structural/refactoring review and define canonical scales plus exceptions in `DESIGN.md`.
3. Add static tests, then migrate theme/shared CSS first and representative feature slices in small batches.
4. Compare after evidence at target viewports and compact height before widening any migration.

## Likely files and layers
- `frontend/src/theme/foundations.ts` (new) and `frontend/src/theme/semanticVariables.ts` — typed/CSS foundation aliases.
- `frontend/src/App.css` — bounded substitutions for equivalent spacing, radius, shadow, layer and media-query values.
- `frontend/src/test/designFoundationScales.test.ts` (new) — scale and disallowed-raw-value fixtures.
- `frontend/e2e/responsive-main-screens.spec.ts`, `frontend/e2e/iphone-target-devices.spec.ts` — computed geometry/overflow/stacking evidence.
- `frontend/DESIGN.md` — ownership and allowed exceptions.

## Regression specification
### Automated tests to add or update
- Canonical scales contain unique named values and reject new unapproved raw application z-index/breakpoint values.
- Before/after fixture assertions preserve key dimensions, gaps, radii, breakpoint transitions and temporary-surface stacking.
- Representative 390/768/1440 and compact-height screens have no horizontal page overflow or obscured controls.

### Expected red evidence
- Inventory/static test reports current raw breakpoint, z-index and shadow values; no functional test should be made red solely by renaming an equivalent value.

### Required validation
- Run focused static tests and existing responsive/target-iPhone Playwright flows for each migration slice.

### Manual evidence
- Rendered before/after overlay review for the representative screens; differences require classification before continuing.

### Regression barrier
- Computed-geometry and overflow comparison across representative viewports is the merge barrier.

## Risks and stop conditions
- Stop on any unexplained pixel, overflow or stacking difference; do not normalize near-equivalent values without explicit design approval.
- Stop before broad edits until the required refactoring review has bounded migration slices and concurrent file ownership.
