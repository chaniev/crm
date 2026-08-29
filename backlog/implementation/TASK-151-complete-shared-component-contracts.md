# TASK-151: Завершить контракты прикладных shared components

## Status
implementation

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-29 17:21
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-151-complete-shared-component-contracts.plan.md
- implementation_branch: feature/TASK-151-complete-shared-component-contracts

## Requirements
- none — component API and presentation consistency without product behavior changes

## Goal
Повторяющиеся pagination, avatar, form feedback, loading and notification
patterns получают focused shared contracts с доступными состояниями.

## Context
TaskItem, locator, filters and temporary surfaces are mature, while Pagination,
Avatar fallback, field label/error/helper composition, progress/loading and
toast actions remain local or only inherit generic Mantine behavior.

## User role
Все пользователи CRM; frontend developers.

## Problem
Repeated local compositions differ in accessibility, responsive behavior and
state handling even when they solve the same user need.

## Scope
- Shared Pagination with current/disabled/accessibility labels and responsive modes.
- Avatar contract for image/error/initials fallback.
- Field feedback composition for persistent label, error and decision-changing helper.
- Loading/Skeleton/Progress state recipes.
- Notification contract for polite/assertive, timeout, persistent and contextual action.

## Out of scope
- Components not used by the product, such as carousel or breadcrumbs.
- Replacing Mantine internals.
- Domain-specific status or validation semantics.

## Constraints
- Add a shared component only after at least two real consumers or an explicit cross-screen contract.
- Placeholder never replaces the accessible/visible label where a label is required.
- Component API remains domain-neutral.

## Acceptance criteria
- [ ] Each new/extended component has typed props, anatomy and composition limits.
- [ ] Default, loading, empty/error/disabled and accessibility behavior is documented where applicable.
- [ ] Responsive behavior is defined at project target widths.
- [ ] At least two duplicate consumers migrate for each justified shared contract.
- [ ] Reduced-motion behavior follows TASK-144.

## Test checklist
- [ ] Add component tests for semantics, keyboard and state transitions.
- [ ] Add responsive checks for Pagination and field feedback.
- [ ] Verify notification live-region and persistent-action behavior.
- [ ] Run affected feature Playwright and frontend harness checks.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: medium
- Reason: bounded shared-component work, but consumer migration can affect focus and operational feedback.

## Clarification questions
Не требуется; only proven repeated patterns are eligible.

## Source notes
- Source: direct conversation on 2026-08-29 after Design System Checklist audit.
- Original finding: several applicable checklist components have only generic Mantine behavior or local implementations.

## Processing notes
- Created at: 2026-08-29 16:45 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: existing active client/schedule tasks own feature behavior, not cross-screen component contracts; implementation must avoid their files while active.
