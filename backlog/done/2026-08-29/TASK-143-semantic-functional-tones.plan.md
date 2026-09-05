# Implementation Plan: TASK-143 Ввести semantic tone variants для функциональных состояний

## Metadata
- source_task: /backlog/done/2026-08-29/TASK-143-semantic-functional-tones.md
- completion: implemented and locally integrated into main on 2026-08-29
- requirements: none — typed presentation contract preserves existing CRM status meanings and behavior
- branch: feature/TASK-143-semantic-functional-tones
- readiness: yes
- dependencies: none; TASK-142 validates the resulting pairs and TASK-150 owns production-wide migration/enforcement
- risk: medium — a mapping mistake could visually reinterpret warnings, destructive actions or operational status

## Goal
Shared components express functional meaning through one typed `danger|warning|success|info|neutral` contract, while reusable scanner fixtures can reject direct functional Mantine colors without requiring a production sweep in this task.

## Decisions and contracts
- One `SemanticTone` maps to foreground, soft background, border, icon/non-color cue and component-specific Mantine props; brand/accent is separate and cannot stand for status.
- Alerts, badges, text/icons, destructive buttons and notifications consume the same mapping; copy, backend status and permissions remain unchanged.
- Scanner classification is syntax-aware enough to distinguish approved semantic helpers/tokens, decorative brand usage and forbidden direct functional colors. Final production zero-bypass enforcement belongs to TASK-150.

## Scope
### In
- Typed tone API, component mappings, scanner module/fixtures and representative consumers in both themes.

### Out
- Bulk call-site migration, new domain statuses, final repository-wide scanner failure, component recipes beyond tone consumption.

## Implementation slices
1. Add failing mapping and scanner fixtures for every tone and representative allowed/forbidden syntax.
2. Implement the domain-neutral tone registry and narrow wrappers/helpers for the in-scope Mantine components.
3. Convert only representative Alert, Badge, destructive Button and notification consumers needed to prove the API.
4. Document the boundary and hand reusable scanner rules to TASK-150.

## Likely files and layers
- `frontend/src/theme/semanticTones.ts` (new) — typed tone registry and component mappings.
- `frontend/src/theme/semanticVariables.ts` — existing CSS variable backing, without status-semantic changes.
- `frontend/src/features/shared/Button.tsx`, `frontend/src/features/shared/notifications.ts`, and focused shared tone primitives — typed consumption.
- `frontend/scripts/check-raw-colors.mjs` or a focused semantic-tone scanner module — reusable classification rules.
- `frontend/src/test/raw-color-scanner.test.ts`, `frontend/src/features/shared/ux.test.tsx`, `frontend/src/features/shared/notifications.test.ts` — fixtures and semantics.
- `frontend/DESIGN.md` — tone roles and direct-color exception boundary.

## Regression specification
### Automated tests to add or update
- Each tone maps to the expected CSS variables plus a text/icon/border cue and produces equivalent meaning in both profiles.
- Destructive Button cannot accept a brand/accent tone; neutral and informational roles remain distinct.
- Scanner fixtures accept semantic tone helpers and documented decorative brand use, but reject `color="red|yellow|teal|blue|gray"` when used as functional state.
- Representative Alert, Badge and notification preserve accessible role/name/live-region semantics.

### Expected red evidence
- Mapping tests fail because no typed tone registry exists; forbidden fixture tests fail because current raw-color scanning does not classify functional Mantine names.

### Required validation
- Run focused tone/scanner/shared-component tests and representative two-theme render checks.

### Manual evidence
- Review the five tones in both profiles and confirm meaning is not color-only.

### Regression barrier
- Typed tone mapping tests plus reusable scanner fixture suite are the merge barrier.

## Risks and stop conditions
- Stop if a representative consumer requires interpreting a backend status; preserve its current semantics and request a producer-owned clarification.
- Do not enable final production-wide rejection or overlap TASK-150 migration scope.
