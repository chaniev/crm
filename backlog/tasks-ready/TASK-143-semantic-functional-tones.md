# TASK-143: Ввести semantic tone variants для функциональных состояний

## Status
ready

## Requirements
- none — presentation consistency change that preserves existing CRM status semantics

## Goal
Alerts, badges, text, icons, destructive actions and notifications express
functional meaning through one typed semantic tone contract instead of direct
Mantine color names.

## Context
Theme foundation already exposes `--crm-status-success|warning|danger|info|neutral`,
while production feature code contains more than one hundred direct named color
usages such as `red`, `yellow`, `teal`, `blue` and `gray`.

## User role
Все пользователи CRM; frontend developers.

## Problem
Two parallel color systems produce inconsistent status appearance and allow
feature code to bypass invariant status tokens and future accessibility fixes.

## Scope
- Define typed tones: `danger`, `warning`, `success`, `info`, `neutral` and any
  justified non-status accent.
- Map Alert, Badge, Text, ThemeIcon, destructive Button and notification roles.
- Extend static scanning to prevent new direct functional color usage.
- Migrate call sites in bounded feature slices without changing their meaning.

## Out of scope
- Reinterpreting backend statuses or permissions.
- Customer-specific status colors.
- General component or CSS-file decomposition.

## Constraints
- State meaning must remain understandable without color.
- Do not replace semantic status tones with brand accents.
- Preserve public API, operational copy and action hierarchy.

## Acceptance criteria
- [ ] Shared typed tone API covers all functional status roles.
- [ ] Production feature code contains no unapproved direct functional Mantine colors.
- [ ] Static check blocks new bypasses and has an explicit, empty-by-default allowlist.
- [ ] Every tone has text/icon/border semantics in addition to color.
- [ ] Default and alternate themes render identical functional meaning.

## Test checklist
- [ ] Add unit tests for tone-to-token/component mapping.
- [ ] Add scanner fixtures for allowed and forbidden forms.
- [ ] Cover representative Alert, Badge, destructive Button and notification.
- [ ] Run affected component and target-iPhone Playwright checks.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: medium
- Reason: CRM behavior is unchanged, but migration spans many visual call sites and needs rendered comparison.

## Clarification questions
Не требуется. Existing functional meanings and invariant token roles are authoritative.

## Source notes
- Source: direct conversation on 2026-08-29 after Design System Checklist audit.
- Original finding: direct named Mantine colors bypass semantic status tokens.
- Related completed tasks: TASK-090 and TASK-094.

## Processing notes
- Created at: 2026-08-29 16:45 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: TASK-090 intended semantic migration, but no active task owns the residual direct functional-color sweep and enforcement.

