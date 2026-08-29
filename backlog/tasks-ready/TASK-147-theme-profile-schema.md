# TASK-147: Уточнить schema и validation ThemeProfile

## Status
ready

## Requirements
- none — behavior-preserving theme-schema hardening; existing deployment branding output remains unchanged

## Goal
Каждое поле versioned `ThemeProfile` имеет однозначную семантическую роль,
валидируется и реально участвует в генерации темы.

## Context
Current `supplementary` is positional, its first tuple acts as neutral/sand,
and the type permits an optional fourth tuple that `createSemanticVariables`
does not consume. This is error-prone for new customer profiles.

## User role
Команда, добавляющая и проверяющая deployment theme profiles.

## Problem
A syntactically valid profile can contain a palette whose purpose is unclear or
whose optional tuple has no effect, making customer onboarding unreliable.

## Scope
- Replace or version positional supplementary tuples with named roles.
- Validate tuple count, color format, role completeness and consumed fields.
- Preserve current default/test visual output or provide explicit versioned migration.
- Document safe profile authoring and failure messages.

## Out of scope
- Expanding white-label scope.
- Making neutral/status/auth colors configurable.
- Arbitrary runtime JSON/CSS themes.

## Constraints
- Existing profile IDs and deployment fallback remain deterministic.
- Unknown IDs still fall back without blocking login.
- No feature code changes should be required for a new registered profile.

## Acceptance criteria
- [ ] Every allowed profile field is consumed or rejected.
- [ ] Brand, accent and neutral roles are named unambiguously.
- [ ] Schema validation reports profile ID, field and exact reason.
- [ ] Existing visual output is unchanged or migrated through a new schema version.
- [ ] Authoring documentation includes contrast and affected-screen gates.

## Test checklist
- [ ] Add valid/invalid schema fixtures.
- [ ] Add regression for the previously ignored optional tuple.
- [ ] Verify resolver/fallback and bootstrap behavior.
- [ ] Run both themes through contrast and frontend baseline checks.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: medium
- Reason: bounded theme infrastructure change with strict compatibility requirement.

## Clarification questions
Не требуется because this card intentionally preserves the current branding boundary.

## Source notes
- Source: direct conversation on 2026-08-29 after Design System Checklist audit.
- Original finding: ThemeProfile positional supplementary schema is ambiguous and permits an unused tuple.
- Related completed foundation: TASK-090.

## Processing notes
- Created at: 2026-08-29 16:45 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: TASK-090 introduced schema version 1; no active task owns schema hardening.

