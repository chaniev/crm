# TASK-146: Формализовать семантическую типографическую шкалу

## Status
ready

## Requirements
- REQ-NFR-001 — constrains

## Goal
Текстовые роли CRM используют документированную Onest scale с предсказуемыми
size, line-height and weight вместо множества локальных значений.

## Context
Onest and mobile input sizing are established, but `App.css` includes many
screen-specific font sizes and no executable role scale for headings, body,
labels, captions and operational numeric values.

## User role
Все пользователи CRM; frontend designers and developers.

## Problem
Typography hierarchy can drift between screens and make compact text too small
or semantically important recovery copy visually secondary.

## Scope
- Define roles such as display, heading, body, compact body, label, caption and numeric.
- Define font-size, line-height, weight and permitted responsive behavior.
- Document permitted compact-text exceptions.
- Migrate shared components and representative screens before wider rollout.

## Out of scope
- Replacing Onest.
- Marketing typography or full visual redesign.
- Hiding or shortening product content.

## Constraints
- Inputs/selects/textarea stay at least 16 CSS px on iPhone.
- Validation, consequences and recovery text cannot use caption treatment.
- Long Russian content and 200% zoom remain usable.

## Acceptance criteria
- [ ] Typography roles are typed or tokenized and documented.
- [ ] Shared page, section, form and state components use roles rather than local sizes.
- [ ] Values below 16 px require an explicit documented compact role.
- [ ] Numeric comparisons use tabular numerals where beneficial.
- [ ] Representative mobile/desktop screens preserve hierarchy and containment.

## Test checklist
- [ ] Add static/component checks for critical input and body sizes.
- [ ] Render long Russian labels and operational values at target widths.
- [ ] Verify 200% zoom and no horizontal page overflow.
- [ ] Run affected Playwright and frontend harness checks.

## AI safety
- Safe for autonomous implementation: no
- Risk level: medium
- Reason: system-wide visual change requires rendered design review even when behavior is unchanged.

## Clarification questions
Не требуется. Onest and current product character remain fixed.

## Source notes
- Source: direct conversation on 2026-08-29 after Design System Checklist audit.
- Original finding: typography guidance exists but an executable scale is incomplete.
- Related completed contracts: TASK-046 and TASK-048.

## Processing notes
- Created at: 2026-08-29 16:45 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: TASK-046/TASK-048 are completed historical baseline tasks; no active follow-up owns the current local-size drift.

