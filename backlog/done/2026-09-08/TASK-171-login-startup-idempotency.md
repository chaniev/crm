# TASK-171: Preserve login migration barrier on repeated startup

## Status
done

## Requirements
- REQ-USR-002 — implements
- REQ-USR-003 — verifies

## Goal
Repeated startup must preserve the installed login uniqueness barrier without downgrade/reapply or data rewrites.

## Scope
Guard login upgrade preparation using applied migration history. Keep initial/retained/interrupted upgrade paths, domain normalization and collision failure behavior. Do not edit applied migrations or change authentication/API contracts.

## Acceptance criteria
- Regression uses real PostgreSQL and two application starts; the same normalized unique index and data survive restart.
- Legacy and intermediate-schema upgrade paths still reach the final barrier.
- Original code fails regression; fixed code and required backend baseline pass.

## Source notes
- User decision 2026-09-08: fix the repeated-start login migration error discovered during the remote release review.
- Existing accepted REQ-USR-002/003; no new product or material architectural choice.
- TASK-170 is reserved by the separate release/cache workspace. No existing task covers this restart regression.

## Completion
- completed_at: 2026-09-08
- completion_date_evidence: [Validation evidence](TASK-171-validation.md), completed in this authorized fix session before local integration.
- Full backend baseline: 559 passed, zero failed/skipped; dependency audit clear.
- No applied migration, API contract, frontend or bot runtime changed.
