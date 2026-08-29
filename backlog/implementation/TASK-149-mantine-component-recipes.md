# TASK-149: Создать project-level Mantine component recipes

## Status
implementation

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-29 17:21
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-149-mantine-component-recipes.plan.md
- implementation_branch: feature/TASK-149-mantine-component-recipes

## Requirements
- none — reusable presentation defaults without CRM behavior changes

## Goal
Основные Mantine controls получают единые project-level variants, geometry and
state styling through the theme and focused shared primitives.

## Context
`createGymCrmTheme` currently configures colors, fonts and radius but no
component recipes. Button/IconButton wrappers exist, while many feature files
still select Mantine variants, colors and radii locally.

## User role
Все пользователи CRM; frontend developers.

## Problem
Mantine provides capabilities, but the project does not consistently turn them
into one stable design-system contract, so equivalent actions can drift.

## Scope
- Define recipes for Button/ActionIcon, Alert, Badge, common inputs,
  Modal/Drawer, Skeleton/Loader, Notifications and Pagination.
- Preserve primary, secondary, ghost, destructive and icon-only hierarchy.
- Define default/focus/hover/active/loading/disabled states.
- Document when direct Mantine component use remains justified.

## Out of scope
- Full feature-code migration, owned by TASK-150.
- New UI library, Tailwind or workflow redesign.
- Backend/domain semantics.

## Constraints
- Preserve current Mantine and Onest stack.
- One active task state keeps one dominant primary action.
- Icon-only actions retain stable accessible labels and 44 x 44 targets.

## Acceptance criteria
- [ ] Each in-scope component has a documented project recipe and typed variant surface.
- [ ] State appearance is consistent in both registered themes.
- [ ] Recipes use semantic tokens and pass TASK-142 contrast matrix.
- [ ] Shared primitives remain small and domain-neutral.
- [ ] A representative consumer for every recipe passes rendered review.

## Test checklist
- [ ] Add component tests for variants and states.
- [ ] Verify accessible roles/names and focus indicators.
- [ ] Render both themes at mobile and desktop widths.
- [ ] Run root frontend harness validation.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: medium
- Reason: shared component defaults can affect many screens; rollout is limited to representative consumers in this task.

## Clarification questions
Не требуется.

## Source notes
- Source: direct conversation on 2026-08-29 after Design System Checklist audit.
- Original finding: no project-level Mantine component recipes; shared primitive adoption is partial.
- Dependencies: TASK-142 and TASK-143.

## Processing notes
- Created at: 2026-08-29 16:45 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: TASK-090 introduced shared recipes conceptually, but no active task owns systematic Mantine theme recipes for the current component inventory.
