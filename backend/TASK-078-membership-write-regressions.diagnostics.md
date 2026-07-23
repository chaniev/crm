# TASK-078 membership write diagnostics

Branch: `fix/TASK-078-membership-write-regressions`
Date: 2026-07-23

Root runtime diagnosis reported by coordinator:
- Active `gym-crm-*` stack is healthy.
- Current DB has migrations `InitialCreate` and `FixClientMembershipVersionConstraints`.
- Current DB has the expected unique partial `SaleId` current-version index and filtered membership overlap exclusion.
- Legacy `task069-smoke-*` stack has only `InitialCreate` and stale constraints; it is not used for TASK-078 evidence.
- No production repair is required.

Initial backend code diagnosis before production changes:

| Case | Actor | Branch | Catalog behavior | Existing assignments | Requested dates/payment | HTTP status | ProblemDetails type/title/detail/errors | Persisted sales/versions/audits |
|---|---|---|---|---|---|---|---|---|
| allowed correction | HeadCoach in isolated test branch | exact branch | Term | unpaid current version targeted by `saleId`/`expectedMembershipId` | `validFrom`/`validTo`; payment intentionally omitted | red test expects 200, current code returns 400 validation | current request contract rejects `saleId`, `expectedMembershipId`, `validFrom`, `validTo` and requires legacy `purchaseDate`/`isPaid` | current code writes nothing for new contract; legacy path would mutate sale purchase date/payment |
| second membership | HeadCoach in isolated PostgreSQL branch | exact branch | Term | active Term | direct overlapping purchase | red test expects 409 `membership-overlap`, current code reaches PostgreSQL exclusion as unhandled save failure | current code has no stable overlap ProblemDetails mapping | transaction outcome verified by fresh DbContext in PostgreSQL test |
| renewal | HeadCoach in isolated test branch | exact branch | finite Term | current finite Term | sequential renewal with idempotency key | covered by existing pricing tests for success path; TASK-078 adds idempotency/audit atomicity expectations | missing idempotency requirement in current code | existing tests prove versions/sales, new tests cover idempotency/audit gap |
| unpaid correction then payment | HeadCoach in isolated test branch | exact branch | Term | unpaid current version | addressed correction then addressed mark-payment | red test expects addressed correction 200 and mark-payment contract acceptance; current correction returns 400 for new payload | current endpoint cannot bind approved addressed correction/payment payload | current code cannot prove target-specific persistence because it chooses current membership by backend sorting |
| term validity edit | HeadCoach in isolated test branch | exact branch | Term | explicit `IndividualValidFrom/To`; immutable sale purchase date | addressed `validFrom`/`validTo` edit | red test expects sale purchase date unchanged; current approved payload fails validation | current contract conflates purchase date with validity start | fresh DbContext assertions added for sale/version/payment invariants |

Red phase command evidence is recorded in the agent report after running the focused tests.
