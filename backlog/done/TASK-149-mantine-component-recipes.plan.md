# Implementation Plan: TASK-149 Создать project-level Mantine component recipes

## Metadata
- source_task: /backlog/done/TASK-149-mantine-component-recipes.md
- completion: implemented and locally integrated into main on 2026-08-29
- requirements: none — reusable presentation defaults preserve CRM behavior and action hierarchy
- branch: feature/TASK-149-mantine-component-recipes
- readiness: yes
- dependencies: TASK-142 contrast matrix and TASK-143 semantic tone API must be green before recipe completion
- risk: medium — theme-level defaults can change every direct Mantine consumer, including focus, loading and destructive states

## Goal
In-scope Mantine controls expose stable project variants, geometry and interaction states through the theme and small domain-neutral primitives, with one representative consumer per recipe passing both themes and accessibility checks.

## Decisions and contracts
- Theme recipes own safe universal defaults; focused wrappers own typed project variants or accessibility props that Mantine cannot express globally.
- Preserve `primary`, `secondary`, `ghost`, `destructive` and icon-only hierarchy. Direct Mantine use remains allowed only for documented composition cases.
- Recipes consume TASK-143 tones and must pass TASK-142 for default/hover/active/loading/disabled/focus states.
- This task migrates only representative consumers; TASK-150 owns the full feature sweep.

## Scope
### In
- Button/ActionIcon, Alert, Badge, common inputs, Modal/Drawer, Skeleton/Loader, Notifications and Pagination recipes and representative adoption.

### Out
- Full call-site migration, new domain semantics, UI-library replacement, workflow redesign.

## Implementation slices
1. Add a recipe-state test matrix and select representative real consumers without overlapping active feature files.
2. Implement safe Mantine `components` defaults and extend small shared primitives only where typed variants/accessibility require it.
3. Adopt one representative consumer per recipe, validating focus, names, target geometry and state appearance.
4. Document direct-use exceptions and render both profiles at mobile/desktop widths.

## Likely files and layers
- `frontend/src/theme/createGymCrmTheme.ts` and `frontend/src/theme/componentRecipes.ts` (new) — theme recipes/default props/styles.
- `frontend/src/features/shared/Button.tsx`, `frontend/src/features/shared/IconButton.tsx`, `frontend/src/features/shared/ux.tsx`, `frontend/src/features/shared/notifications.ts` — typed project surfaces.
- Focused representative feature consumers selected after active-file ownership check.
- `frontend/src/theme/componentRecipes.test.tsx` (new), `frontend/src/features/shared/ux.test.tsx`, `frontend/src/features/shared/notifications.test.ts` — state/accessibility matrix.
- `frontend/DESIGN.md` — recipes, anatomy and direct-use boundary.

## Regression specification
### Automated tests to add or update
- Every in-scope component resolves documented default/focus/hover/active/loading/disabled styling and semantic tone in both profiles.
- Primary/destructive actions retain distinct typed variants; icon-only controls retain stable accessible names and `44 x 44px` targets.
- Modal/Drawer Escape and focus return, input label/error association, notification live region and Pagination labels remain correct.
- Representative consumers use production components rather than catalog/test copies.

### Expected red evidence
- Recipe matrix fails because `createGymCrmTheme` has no component configuration and several state choices remain local.

### Required validation
- Run the focused recipe/shared-component tests, TASK-142 matrix and representative mobile/desktop browser checks.

### Manual evidence
- Render and compare every recipe/state in both profiles; record any theme-global change to an existing direct consumer.

### Regression barrier
- Two-theme recipe-state component matrix plus TASK-142 contrast gate is the merge barrier.

## Risks and stop conditions
- Stop if a global default changes an unselected production consumer; narrow the recipe or explicitly include that consumer and regression coverage.
- Stop if a recipe requires feature/domain knowledge; keep it in the owning feature instead.
