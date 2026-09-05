# Implementation Plan: TASK-142 Расширить матрицу контраста дизайн-системы

## Metadata
- source_task: /backlog/done/2026-08-29/TASK-142-theme-contrast-matrix.md
- completion: implemented and locally integrated into main on 2026-08-29
- requirements: REQ-NFR-001 (verifies)
- branch: feature/TASK-142-theme-contrast-matrix
- readiness: yes
- dependencies: none; TASK-147 may change profile shape but must preserve the registry validation seam
- risk: medium — resolving Mantine foreground/state colors incorrectly could certify inaccessible component combinations

## Goal
Registration of any `ThemeProfile` fails with a diagnostic naming profile, component/state, colors and ratio whenever a required text, focus or UI-boundary contrast pair misses its WCAG threshold.

## Decisions and contracts
- Keep one typed contrast-case registry grouped by text pairs (`4.5:1`) and large-text/focus/boundary pairs (`3:1`); component and state metadata is part of every failure.
- Derive filled-control foreground from the resolved Mantine theme/recipe output. Do not hard-code white or choose a foreground only to make the test green.
- Cover primary/destructive buttons, semantic Badge/Alert tones, links, selected navigation, configurable accents, focus, and default/hover/active/disabled states where the state is meaningful.
- Change palettes only for a measured failing pair and preserve functional tone meaning across profiles.

## Scope
### In
- Reusable color parsing/compositing and contrast assertions for every registered profile.
- Render/style resolution only for cases Mantine determines at component level.
- Minimal fixes to current profile shades or semantic foreground selection proven necessary by the matrix.

### Out
- Dark mode, runtime arbitrary colors, unrelated visual tuning, typography/spacing changes.

## Implementation slices
1. Extract the current contrast helpers and add table-driven failing fixtures with complete diagnostic output.
2. Define the required semantic/component-state matrix and run it against `themeProfiles` plus an injected invalid profile.
3. Add focused rendered resolution for Mantine-owned foreground/state decisions, then correct only demonstrated failures.
4. Add representative two-theme browser evidence without duplicating the full visual gate owned by TASK-153.

## Likely files and layers
- `frontend/src/theme/contrast.ts` (new) — parser, alpha flattening, thresholds and structured assertion results.
- `frontend/src/theme/contrastMatrix.ts` (new) — required semantic/component-state cases.
- `frontend/src/theme/registry.test.ts` — all-profile gate, invalid fixture and diagnostics.
- `frontend/src/theme/createGymCrmTheme.ts`, `frontend/src/theme/semanticVariables.ts`, `frontend/src/theme/profiles.ts` — only measured corrections or foreground contracts.
- `frontend/src/features/shared/ux.test.tsx` and a focused E2E spec — resolved Mantine states and both profiles.

## Regression specification
### Automated tests to add or update
- A synthetic low-contrast profile fails and reports its ID, `Button/filled/default`, foreground/background, threshold and actual ratio.
- Every registered profile passes normal text at `>=4.5`, and large text/focus/boundaries at `>=3.0`, including hover/active/disabled/selected cases.
- Rendered filled primary/destructive Button, Badge, Alert and navigation selection use the foreground asserted by the matrix.
- Adding a profile to `themeProfiles` automatically subjects it to the same matrix.

### Expected red evidence
- The synthetic-profile diagnostic and component/state coverage tests fail because the current suite checks only page/card text and focus and assumes no resolved component foreground.

### Required validation
- Run the focused theme registry/component tests and two-theme representative browser scenario through the task verification contract.

### Manual evidence
- Compare the corrected states in both profiles at mobile and desktop widths; record only pairs whose palette changed.

### Regression barrier
- The table-driven all-profile contrast matrix in `registry.test.ts` is the merge barrier.

## Risks and stop conditions
- Stop if a compliant foreground requires changing component hierarchy or status meaning; coordinate with TASK-143/TASK-149 instead of encoding a one-off exception.
- Stop if TASK-147 changes schema concurrently without a shared adapter boundary.
