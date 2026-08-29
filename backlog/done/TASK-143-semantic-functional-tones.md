# TASK-143: Ввести semantic tone variants для функциональных состояний

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-29 17:21
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/TASK-143-semantic-functional-tones.plan.md
- implementation_branch: feature/TASK-143-semantic-functional-tones
- integrated_to_main_at: 2026-08-29
- candidate_commit: 532ca88a9319a8edbfd8d1ebe27d77fe32fb1a3e

## Requirements
- none — presentation consistency change that preserves existing CRM status semantics

## Goal
Shared presentation primitives can express functional meaning for alerts,
badges, text, icons, destructive actions and notifications through one typed
semantic tone contract instead of direct Mantine color names.

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
- Define and test static scanning rules that distinguish approved semantic tone
  usage from direct functional Mantine colors.
- Adopt the contract only in representative consumers needed to validate the
  shared API and both registered themes.

## Out of scope
- Reinterpreting backend statuses or permissions.
- Customer-specific status colors.
- Production feature call-site migration and final zero-bypass enforcement,
  owned by TASK-150.
- General component or CSS-file decomposition.

## Constraints
- State meaning must remain understandable without color.
- Do not replace semantic status tones with brand accents.
- Preserve public API, operational copy and action hierarchy.

## Acceptance criteria
- [ ] Shared typed tone API covers all functional status roles.
- [ ] Scanner fixtures classify approved semantic usage and forbidden direct
      functional colors without requiring production call-site migration.
- [ ] Scanner rules are reusable by TASK-150 for final zero-bypass enforcement.
- [ ] Every tone has text/icon/border semantics in addition to color.
- [ ] Default and alternate themes render identical functional meaning.

## Test checklist
- [ ] Add unit tests for tone-to-token/component mapping.
- [ ] Add scanner fixtures for allowed and forbidden forms.
- [ ] Cover representative Alert, Badge, destructive Button and notification.
- [ ] Render representative consumers in both registered themes and run the
      root frontend harness.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: medium
- Reason: CRM behavior is unchanged; shared tone and scanner contracts can
  affect representative consumers but production migration is deferred.

## Clarification questions
Не требуется. Existing functional meanings and invariant token roles are authoritative.

## Source notes
- Source: direct conversation on 2026-08-29 after Design System Checklist audit.
- Original finding: direct named Mantine colors bypass semantic status tokens.
- Scope decision: direct conversation on 2026-08-29; production call-site
  migration belongs exclusively to TASK-150.
- Related completed tasks: TASK-090 and TASK-094.

## Processing notes
- Created at: 2026-08-29 16:45 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: TASK-090 intended semantic migration, but no active task owns the residual direct functional-color sweep and enforcement.
- Updated at: 2026-08-29 17:15 MSK; removed production call-site migration and
  final enforcement from TASK-143 to eliminate overlap with TASK-150.
