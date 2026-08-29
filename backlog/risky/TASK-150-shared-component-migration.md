# TASK-150: Мигрировать feature UI на shared design-system primitives

## Status
risky

## Requirements
- none — behavior-preserving presentation migration across existing workflows

## Goal
Production feature screens use the approved project recipes and shared
primitives consistently without changing CRM workflows or backend contracts.

## Context
The audit found widespread direct Mantine Button/ActionIcon and status-color
usage. A single all-screen rewrite would create excessive regression and merge
risk, so migration must be decomposed by ownership area.

## User role
Все пользователи CRM; frontend maintainers.

## Problem
Shared design-system contracts cannot prevent drift while most equivalent
feature components may continue bypassing them.

## Scope
- Inventory direct use that should move to TASK-149 recipes/shared primitives.
- Create and execute independent slices for:
  1. auth and shell;
  2. clients;
  3. groups/users/settings;
  4. attendance/schedule;
  5. finance/audit.
- Remove proven local duplicates after each slice.
- Preserve API, copy, permissions, action hierarchy and operational states.

## Out of scope
- One branch changing every feature area.
- Business-rule, API, navigation-model or content redesign.
- Opportunistic refactoring unrelated to component adoption.

## Constraints
- Requires explicit refactoring review and implementation-ready slice plan.
- One slice uses one task branch/worktree and avoids overlapping active owners.
- Every visible change requires rendered before/after evidence.
- Backend-owned CRM rules must not move into frontend abstractions.

## Acceptance criteria
- [ ] A complete inventory classifies justified direct Mantine uses and migration targets.
- [ ] Child/slice ownership and dependency order are explicit before production changes.
- [ ] Each completed slice uses approved semantic variants and shared primitives.
- [ ] Loading, empty, error, stale, disabled, restricted and success behavior is preserved.
- [ ] No slice introduces mobile overflow, focus regression or action duplication.
- [ ] Final static checks prevent regression to bypass patterns.

## Test checklist
- [ ] Characterize representative components before each slice.
- [ ] Run affected component and Playwright flows per slice.
- [ ] Include target-iPhone projects for changed visible flows.
- [ ] Run the root frontend harness after every slice and final integration.

## AI safety
- Safe for autonomous implementation: no
- Risk level: high
- Reason: broad cross-screen presentation migration can silently alter operational workflows, focus and responsive behavior.

## Clarification questions
Не требуется at product level; implementation must stop if slice ownership or overlapping active work is ambiguous.

## Source notes
- Source: direct conversation on 2026-08-29 after Design System Checklist audit.
- Original finding: component system exists but direct feature-level Mantine usage remains widespread.
- Dependency: TASK-149; tone migration coordinates with TASK-143.

## Processing notes
- Created at: 2026-08-29 16:45 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: TASK-121 decomposes large cross-layer source files and does not own design-system component adoption; completed TASK-046/TASK-090 are historical foundations.
- Classification: risky due global visual surface and required multi-slice coordination, not because CRM domain semantics may change.

