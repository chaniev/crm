# TASK-148: Зафиксировать границы customer branding

## Status
needs-clarification

## Requirements
- pending — current REQ-NFR-005 covers club name, while palette/auth/logo/runtime branding boundaries require an accepted product decision

## Goal
Product owner explicitly defines the supported customer-branding surface before
the project expands or constrains the current deployment theme mechanism.

## Context
Theme profiles and auth backgrounds are implemented by TASK-090 and described
in `docs/MOBILE_UI_CONTRACT.md`, but the requirements registry entry
`REQ-NFR-005` currently mentions only deployment club name. The audit also found
that auth actions, neutral surfaces, status colors, logo and favicon are outside
the configurable palette.

## User role
Владелец продукта / оператор deployment / заказчик клуба.

## Problem
Without an accepted boundary, implementation would have to invent whether CRM
offers accent theming, full white-label, runtime manifests or build-time profiles.

## Scope
- Decide whether auth action follows customer primary color.
- Decide whether neutral surfaces are shared or configurable.
- Decide whether logo/favicon belong to supported branding.
- Decide whether a new customer palette may require a frontend build.
- Decide whether a validated runtime manifest is needed.
- Confirm that functional status meaning remains invariant.
- Reconcile `REQ-NFR-005`, `frontend/DESIGN.md` and mobile UI contract.

## Out of scope
- Implementing any selected branding expansion.
- Dark mode, role-specific themes or arbitrary customer CSS.
- Uploading remote URLs or binary assets through public config.

## Constraints
- Security and deterministic fallback must not be weakened.
- Branding must not change operation order, permissions, density or responsive behavior.
- Accepted decisions must be recorded in the requirements registry before implementation cards move to ready.

## Acceptance criteria
- [ ] Minimum and maximum supported branding scope are explicit.
- [ ] Build-time versus runtime onboarding policy is explicit.
- [ ] Auth, neutral, functional status, logo and favicon ownership are explicit.
- [ ] Unknown/broken branding fallback and rollback expectations are explicit.
- [ ] REQ-NFR-005 receives an accepted updated decision and change history.
- [ ] Follow-up implementation tasks are created only for the accepted scope.

## Test checklist
- [ ] Validate requirement metadata and CHANGELOG after the decision is recorded.
- [ ] Verify all referenced current config/theme/background contracts.
- [ ] No runtime or UI validation is required until an implementation task exists.

## AI safety
- Safe for autonomous implementation: no
- Risk level: medium
- Reason: this is a product boundary decision affecting deployment branding and future customer onboarding.

## Clarification questions
- [ ] Должна ли кнопка входа использовать primary color customer theme?
- [ ] Разрешается ли customer-specific neutral foundation?
- [ ] Входят ли logo и favicon в обязательный white-label scope?
- [ ] Допустим ли frontend release для нового профиля или нужен validated runtime manifest?
- [ ] Нужна ли настройка branding через CRM UI либо только deployment configuration?

## Source notes
- Source: direct conversation on 2026-08-29 after Design System Checklist audit.
- Original finding: current implementation supports controlled accent profiles but requirements do not define the full customer-branding boundary.
- Related completed tasks: TASK-049 and TASK-090.

## Processing notes
- Created at: 2026-08-29 16:45 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: completed TASK-049 explicitly excluded full white-label; TASK-090 implemented controlled profiles, but no active card resolves the registry/contract boundary.
