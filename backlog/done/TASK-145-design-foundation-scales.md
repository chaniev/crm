# TASK-145: Централизовать foundation scales дизайн-системы

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-29 17:21
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/TASK-145-design-foundation-scales.plan.md
- implementation_branch: refactor/TASK-145-design-foundation-scales
- integrated_to_main_at: 2026-08-29
- candidate_commit: 4174a2371e17ffd8e2be0c479457134596a8a30a

## Requirements
- none — behavior-preserving design-foundation refactor

## Goal
Spacing, breakpoints, radii, elevation, z-index and motion values have one
named implementation contract without changing current screen geometry.

## Context
The project has a strong responsive product contract, but `App.css` contains
many equivalent or near-equivalent media queries and local spacing/z-index
values. No explicit elevation or layer scale exists.

## User role
Frontend developers and designers maintaining all CRM screens.

## Problem
Local values make cross-screen changes expensive and allow accidental drift
even when screens follow the same intended visual language.

## Scope
- Inventory current spacing, breakpoints, radii, shadows and z-index usage.
- Define canonical aliases/tokens and ownership boundaries.
- Consolidate equivalent breakpoint expressions.
- Introduce named elevation and layer levels.
- Migrate only behavior-equivalent call sites in reviewed slices.

## Out of scope
- New visual direction or density change.
- Typography scale, which is owned by TASK-146.
- Feature-specific responsive redesign.

## Constraints
- Preserve computed geometry and responsive transformations.
- Keep required target viewport and compact-height contract.
- Broad structural work requires refactoring review before implementation.

## Acceptance criteria
- [ ] Canonical scales and their allowed exceptions are documented in `frontend/DESIGN.md`.
- [ ] Equivalent `48em/rem` and related breakpoint spellings use one contract.
- [ ] Raw application z-index values are replaced by named layers.
- [ ] Shadows map to named elevation roles and surfaces.
- [ ] Representative screens have no computed-style or overflow regressions.

## Test checklist
- [ ] Add static checks for disallowed new raw breakpoint/layer values where practical.
- [ ] Capture before/after computed geometry on representative screens.
- [ ] Run responsive and target-iPhone Playwright coverage.
- [ ] Run the frontend harness baseline.

## AI safety
- Safe for autonomous implementation: no
- Risk level: medium
- Reason: behavior-preserving but broad foundation refactor can affect every responsive screen.

## Clarification questions
Не требуется; visual output must remain unchanged.

## Source notes
- Source: direct conversation on 2026-08-29 after Design System Checklist audit.
- Original finding: responsive policy exists, but technical foundation scales are fragmented.
- Related completed contracts: TASK-048, TASK-084 and TASK-090.

## Processing notes
- Created at: 2026-08-29 16:45 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: completed TASK-048/TASK-090 established baseline behavior but do not own current scale consolidation.
