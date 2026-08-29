# TASK-152: Создать внутренний каталог дизайн-системы

## Status
ready

## Requirements
- none — developer documentation and tooling; production behavior does not change

## Goal
Developers and designers can inspect tokens, themes, component anatomy,
variants, states and responsive behavior without reconstructing them from
feature screens.

## Context
The repository has `frontend/DESIGN.md`, TypeScript props and component tests,
but no browsable component catalog or sandbox. Design System Checklist
documentation/anatomy/composition items are therefore only partially covered.

## User role
Frontend developers, designers and reviewers.

## Problem
Discoverability depends on reading source files, which slows adoption and makes
incorrect local composition more likely.

## Scope
- Build a development-only catalog using the existing React/Vite/Mantine stack.
- Show semantic colors, typography, spacing/elevation/motion when available.
- Show both theme profiles and applicable component variants/states.
- Include long Russian content, reduced motion and target-width previews.
- Link examples to source ownership and usage guidance.

## Out of scope
- New production route or customer-facing style editor.
- Introducing another component library.
- Implementing missing product workflows.

## Constraints
- Catalog must render production components, not copies.
- It must not enter the production bundle unless explicitly enabled.
- Storybook is optional; choose the smallest maintainable solution compatible with Vite.

## Acceptance criteria
- [ ] A documented command opens the catalog locally.
- [ ] Foundations and every shared component have at least one canonical example.
- [ ] Interactive components show focus/loading/disabled/error where applicable.
- [ ] Default and alternate themes can be compared deterministically.
- [ ] Catalog ownership and update expectation are documented.

## Test checklist
- [ ] Add a build/smoke test for the catalog entry point.
- [ ] Verify no catalog code leaks into normal production output.
- [ ] Add accessibility smoke checks for representative examples.
- [ ] Run instruction/docs and frontend harness validation.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: low
- Reason: isolated developer tooling with explicit production exclusion.

## Clarification questions
Не требуется. Tool choice is an implementation decision subject to existing stack constraints.

## Source notes
- Source: direct conversation on 2026-08-29 after Design System Checklist audit.
- Original finding: no component anatomy/props/composition sandbox exists.

## Processing notes
- Created at: 2026-08-29 16:45 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: no active or completed task provides a reusable design-system catalog.

