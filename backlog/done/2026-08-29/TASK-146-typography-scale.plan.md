# Implementation Plan: TASK-146 Формализовать семантическую типографическую шкалу

## Metadata
- source_task: /backlog/done/2026-08-29/TASK-146-typography-scale.md
- completion: implemented and locally integrated into main on 2026-08-29
- requirements: REQ-NFR-001 (constrains)
- branch: feature/TASK-146-typography-scale
- readiness: yes
- dependencies: TASK-145 for the shared foundation ownership boundary; planning/rendered design review is required before visible migration
- risk: medium — system-wide type changes can harm hierarchy, long Russian content, zoom containment and iPhone input behavior

## Goal
Shared CRM text roles use a documented Onest scale for size, line-height, weight and numeric behavior, while critical body/input text and long-content layouts remain usable at target widths and 200% zoom.

## Decisions and contracts
- Define semantic roles (`display`, heading levels, `body`, `bodyCompact`, `label`, `caption`, `numeric`) rather than screen-specific sizes.
- Inputs/selects/textarea remain at least 16 CSS px on iPhone. Validation, consequences and recovery copy cannot use caption styling.
- Any sub-16px role is explicitly named, bounded to noncritical compact metadata and tested with zoom/long content.
- Use tabular numerals only for columns/comparisons where stable alignment improves scanning.

## Scope
### In
- Typed/theme/CSS type roles, shared page/section/form/state adoption and a small representative-screen migration after rendered approval.

### Out
- Font replacement, copy shortening, marketing typography, production-wide call-site sweep.

## Implementation slices
1. Inventory current shared/local type values and add failing role/input/zoom tests with long Russian fixtures.
2. Produce and approve a rendered type-scale direction preserving current product character and hierarchy.
3. Implement tokens and migrate shared page, section, form and operational-state components.
4. Migrate representative auth/list/form screens, compare at mobile/desktop and 200% zoom, then document rollout rules.

## Likely files and layers
- `frontend/src/theme/typography.ts` (new), `frontend/src/theme/createGymCrmTheme.ts`, `frontend/src/theme/semanticVariables.ts` — role definitions and theme exposure.
- `frontend/src/features/shared/ux.tsx`, shared form/state components — semantic role consumption.
- `frontend/src/App.css` — token adoption in approved slices.
- `frontend/src/test/typographyScale.test.tsx` (new) — role, critical-size and long-content fixtures.
- `frontend/e2e/responsive-main-screens.spec.ts`, `frontend/e2e/iphone-target-devices.spec.ts` — zoom, overflow and iPhone input coverage.
- `frontend/DESIGN.md` — roles, exceptions and responsive rules.

## Regression specification
### Automated tests to add or update
- Every role resolves to Onest, size, line-height and weight; numeric role enables tabular numerals where requested.
- Shared inputs/selects/textareas compute to at least 16px on target iPhone projects.
- Error/recovery/decision-changing helper copy never resolves to caption.
- Long Russian labels/values at 390px and 200% zoom do not cause horizontal page overflow or clipped actions.

### Expected red evidence
- Role tests fail because no executable scale exists; inventory flags local shared-component sizes and zoom fixture exposes uncontracted behavior.

### Required validation
- Run focused type/component tests plus responsive and target-iPhone browser scenarios.

### Manual evidence
- Approve the rendered role hierarchy in both themes before migrating production consumers; compare representative before/after screens.

### Regression barrier
- Critical-size plus 200%-zoom/long-content browser scenario is the merge barrier.

## Risks and stop conditions
- Stop if the role scale changes information hierarchy or density beyond current intent; return to rendered design review.
- Stop if TASK-145 has not established the shared foundation ownership boundary needed to avoid duplicate tokens.
