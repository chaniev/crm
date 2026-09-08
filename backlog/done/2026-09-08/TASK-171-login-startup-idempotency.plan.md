# TASK-171 login startup idempotency

## Metadata
- source_task: backlog/done/2026-09-08/TASK-171-login-startup-idempotency.md
- branch: codex/TASK-171-login-startup-idempotency
- readiness: yes
- requirements: REQ-USR-002, REQ-USR-003
- product_decisions: none — existing accepted login identity behavior is preserved.
- technical_decisions: none — a local applied-migration guard corrects startup sequencing within existing contracts.
- architecture_decisions: none — no data model, migration source, API or ownership boundary changes.
- open_questions: none

## Decisions and contracts
Read applied migration history before targeting the intermediate login migration. Skip login preparation once the final barrier is applied, so later migrations remain untouched. Only target the intermediate migration when it is absent; resume its domain backfill when needed. Keep normal latest-migration startup responsible for pending forward migrations. Preserve disabled-migrations behavior and collision diagnostics. Do not modify installed migrations or database contents outside the existing authorized forward-upgrade flow.

## Decision evidence
- [User-authorized defect correction and scope](/backlog/done/2026-09-08/TASK-171-login-startup-idempotency.md) records the request and existing contracts; no new product/material technical choice.

## Implementation and validation
1. Add PostgreSQL regression using real application starts and persisted unique-index identity, not only final migration history. Observe failure before the fix.
2. Add minimal history guard. Cover retained and intermediate upgrade restart paths with the existing application factory.
3. Run focused login tests, canonical backend/knowledge baseline and database regression scenarios.
4. Update requirement implementation evidence and task completion records, commit and locally integrate after checks pass.

## Recovery
No schema migration is added or modified. The fix preserves schema and data; local code rollback is a commit revert, although restoring the defective startup is not a suitable remote release recovery strategy. Remote activation remains gated by the separate release workflow.

## Completion
All implementation and automated verification steps completed on 2026-09-08; see [validation evidence](TASK-171-validation.md).
