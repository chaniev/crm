# TASK-148: Зафиксировать границы customer branding

## Status
done

## Requirements
- REQ-NFR-005 — changes

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
- Auth action follows the customer primary color.
- Customer-specific neutral colors are supported.
- Logo and favicon are part of supported branding and move to a separate task.
- Initial customer branding is configured at deployment without requiring a
  customer-specific frontend release.
- Branding can be changed after deployment through CRM settings.
- Unknown or broken branding deterministically falls back to bundled defaults.
- Functional status meaning remains invariant.
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
- [x] Minimum and maximum supported branding scope are explicit.
- [x] Build-time versus runtime onboarding policy is explicit.
- [x] Auth, neutral, functional status, logo and favicon ownership are explicit.
- [x] Unknown/broken branding fallback and rollback expectations are explicit.
- [x] REQ-NFR-005 receives an accepted updated decision and change history.
- [x] Follow-up implementation tasks are created only for the accepted scope.

## Test checklist
- [x] Validate requirement metadata and CHANGELOG after the decision is recorded.
- [x] Verify all referenced current config/theme/background contracts.
- [x] No runtime or UI validation is required until an implementation task exists.

## AI safety
- Safe for autonomous implementation: no
- Risk level: medium
- Reason: this is a product boundary decision affecting deployment branding and future customer onboarding.

## Clarification questions
Не требуется. Product owner принял решения 29.08.2026:

- auth action использует primary color;
- разрешены customer-specific neutral colors;
- logo и favicon вынесены в отдельную задачу;
- первоначальная настройка выполняется при деплое;
- после деплоя branding настраивается через CRM UI;
- unknown или broken configuration откатывается на bundled defaults.

## Source notes
- Source: direct conversation on 2026-08-29 after Design System Checklist audit.
- Original finding: current implementation supports controlled accent profiles but requirements do not define the full customer-branding boundary.
- Related completed tasks: TASK-049 and TASK-090.

## Processing notes
- Created at: 2026-08-29 16:45 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: completed TASK-049 explicitly excluded full white-label; TASK-090 implemented controlled profiles, but no active card resolves the registry/contract boundary.
- Resolved at: 2026-08-29 17:13 MSK by explicit product-owner decisions.
- Follow-ups: TASK-155 owns runtime/UI customer branding; TASK-156 owns logo and favicon.
- Completion: accepted boundary recorded in REQ-NFR-005, requirements changelog,
  `frontend/DESIGN.md` and `docs/MOBILE_UI_CONTRACT.md`; no project code changed.
