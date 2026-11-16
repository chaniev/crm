# TASK-198: planning and review evidence

## Accepted boundary
2026-11-16: user explicitly accepted the three-workflow boundary in this chat; ADR-0007 records the decision. Plan readiness and ADR validation passed before production edits.

## Dependency map
- Common execution: purchase / renew / correct; ClientLifecycleEndpoints branch transfer invokes the same execution helper.
- Refund execution: register / cancel use their own reservation lease/expiry ordering.
- Target transfer: independent reservation/replay and transaction algorithm; preview is unchanged.
- Snapshot: ClientResponseMapper loader moves literally behind Infrastructure reader; API callers retain forwarding facade.
- Application descriptors/results carry no HTTP, EF or Staff DTO types. Scoped operation callbacks retain their current lifetime.
- API retains parsing, response/ProblemDetails formatting and pure audit entry factories. Infrastructure owns writing entries within the existing transaction.

## Independent planning review
No need for a new product decision, schema, lock, TTL, retry or framework. Preserve:
- exact lazy payload construction after validation; unchanged JSON property/order/date/array semantics for hashes;
- Pending immediate conflict versus Completed/expiry client lease;
- refund actor/client lease before expiry cleanup;
- actor/scope and validation rechecks after mutation locks;
- branch transfer completed replay without PII after loss of scope;
- cleanup after rollback/dispose in a separate bounded scope, deleting only Pending;
- common response read outside mutation catch; refund/target non-replay mapping failures retain old failure mapping; replay remains outside catch;
- original error keys/codes/descriptions and audit ordering.

## Existing regression barriers
ClientMembershipWriteRegressionApiTests; ClientMembershipTargetPostgreSqlBarrierTests; AdministratorClientScopePostgreSqlTests; ClientsApiTests. Historical ClientMembershipHttpContractTests filename does not exist in the current tree and is not counted as coverage.

## Validation
Full baseline before extraction: 782 backend and 769 frontend tests passed on local main 5fb81ea as part of TASK-197. Focused baseline and post-change evidence will be added by the executor before completion.

Focused baseline before backend edits: 61/61 passed, 0 failed (executor TRX `task198-baseline.trx`). Includes ClientMembershipWriteRegressionApiTests, ClientMembershipTargetPostgreSqlBarrierTests and AdministratorClientScopePostgreSqlTests.

Incremental review: common workflow preserves typed outcomes and transfer replay/access behavior. Refund workflow preserves lease-before-lookup, lazy validated payload, addressed sale identity and separate register/cancel error texts. Target workflow preserves status-only Pending branch, conditional client leases for Completed/expiry and collision fallback. Scoped DI shares the original DbContext. No blocking findings in these paths; final diff and full harness pending.

Final independent code review (coordinator): no blocking findings. Verified literal snapshot query forwarding, separate reservation algorithms, actor/access recheck, Pending-only cleanup, preserved canonical payloads, old API ProblemDetails and distinct DTO mapping exception boundaries. API no longer owns the transferred execution/reservation transactions. Remaining simple comment mutation and preview were outside the agreed three-workflow extraction.

Post-extraction focused results: common54/54, refund13/13, full selected scenarios133/133. Release build 0 warnings/errors; changed-file formatting and diff whitespace passed. Full root harness passed: backend782/782, frontend769/769, all build/format/lint/type/knowledge gates passed. NuGet audit clean; npm audit passes high threshold with 7 unchanged moderate transitive findings (minimatch/typescript-eslint). No audit suppression. Endpoint module1537 ->765 lines; Infrastructure collaborators279/223/198 lines.

Full command: `python3 scripts/harness/verify_change.py --base origin/main`; [machine evidence](TASK-198-evidence/verification.json).
