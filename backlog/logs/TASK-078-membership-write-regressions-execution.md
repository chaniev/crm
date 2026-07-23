# TASK-078 implementation execution notes

## Execution gate

- Explicit execution approval: user request on 2026-07-23.
- Source task: moved from `/backlog/risky` to `/backlog/implementation`.
- Branch: `fix/TASK-078-membership-write-regressions`.
- Branch base: clean and up-to-date `main` (`git pull --ff-only` reported “Already up to date”).
- Database policy: do not add a migration; update the reproducible initial state because the stack will be deployed from scratch.
- Production data repair: not required and not performed.

## Five-case reproduction record

Business time zone: `Europe/Moscow`.

| Case | Actor | Branch | Catalog behavior | Existing assignments | Requested dates/payment | Request/header | Red HTTP/contract evidence | Red persisted-state evidence | Failure layer |
|---|---|---|---|---|---|---|---|---|---|
| allowed correction | Administrator and HeadCoach | exact branch | Term | paid and unpaid variants; exact card target | `saleId`, `expectedMembershipId`, `validFrom`, `validTo` | POST JSON plus `Idempotency-Key` | Red: `400`; new target/date fields rejected while legacy purchase/payment fields were required | No addressed write; fresh-scope assertions show the approved path was unavailable | request validation / legacy contract |
| second membership | Administrator and HeadCoach | exact branch | Term plus SingleVisit/Professional controls | active, expired and future queue | direct purchase rejection plus sequential renewal | POST purchase/renew JSON plus `Idempotency-Key` | Red provider case: future/future overlap reached PostgreSQL and returned `500` with Npgsql `23P01`; expected `409 membership-overlap` | PostgreSQL transaction/cardinality assertions added; final green pending | EF SaveChanges / response mapping |
| renewal | Administrator and HeadCoach | exact branch | finite Term; finite/open Professional; SingleVisit | current plus optional future renewal | exact renewal payload | POST JSON plus repeated `Idempotency-Key` | Red replay: first request `200`, identical retry incorrectly reached normal lifecycle validation and returned `400` | Existing success fixtures persisted sale/version; replay barrier was absent | idempotency / application validation |
| unpaid correction then payment | Administrator and HeadCoach | exact branch | Term | unpaid current/version history; exact card target | correction preserving unpaid, then addressed mark-payment | Two addressed POSTs with distinct keys; payment replay reuses its key | Red correction: `400` on approved addressed payload; mark-payment had no exact-card contract | Could not prove exact target/payment transition; new fresh-scope cardinality/actor assertions added | request validation / target selection |
| term validity edit | Administrator and HeadCoach | exact branch | Term | explicit `IndividualValidFrom`/`IndividualValidTo`; immutable sale purchase date | exact addressed edited range | POST correction JSON plus `Idempotency-Key` | Red: `400`; legacy contract conflated `PurchaseDate` with validity start | No write on approved payload; legacy path would mutate immutable sale/payment fields | contract / application mapping |

## Runtime schema diagnosis

- Target local stack: `gym-crm-*`; all four services were healthy during the read-only inspection.
- `__EFMigrationsHistory`: `20260513165936_InitialCreate` and `20260721210111_FixClientMembershipVersionConstraints`.
- Per-sale current-version index: `IX_ClientMemberships_SaleId` is unique and filtered by `"ValidTo" IS NULL`.
- Filtered membership overlap constraint: `EX_ClientMemberships_ClientId_Period_NoOverlap` uses an inclusive PostgreSQL `daterange` exclusion and filters to open versions with `BehaviorKind IN ('Term', 'Professional')`.
- The clean-schema check exposed PostgreSQL's 63-byte identifier truncation for the generated actor/key idempotency index. The model, initial migration, snapshot and exception mapping now share the explicit short name `UX_ClientMembershipIdempotency_Actor_Key`; a barrier test forces two identical concurrent reservations through that unique constraint.
- A separate legacy `task069-smoke-*` stack contains only `InitialCreate` and stale membership constraints; it is excluded from TASK-078 evidence.
- Compose validation uses the repository-root `.env`; `deploy/.env` does not exist.
- Diagnosis found schema drift only in the unrelated legacy smoke stack. No production repair or irreversible database action is required for TASK-078.

## Red phase

### Backend unit/API/PostgreSQL

Command:

```text
dotnet test backend/GymCrm.slnx --filter FullyQualifiedName~ClientMembershipWriteRegressionApiTests
```

Compile-clean behavioral red captured before backend production changes:

- `Membership_purchase_requires_idempotency_key_before_any_write`: expected `400` with field `idempotencyKey`; actual `200 OK` with a persisted sale, version and audit.
- `Completed_idempotency_replay_reloads_result_without_duplicate_sale_version_or_audit`: the first purchase returned `200`; identical replay expected `200` without duplicates but returned `400` through normal membership validation.
- `Addressed_correction_uses_target_version_and_preserves_sale_purchase_date_and_payment`: the approved addressed payload expected `200`; actual `400` rejected `saleId`, `expectedMembershipId`, `validFrom` and `validTo` as unknown while requiring legacy `purchaseDate` and `isPaid`.
- `Mandatory_membership_audit_failure_rolls_back_relational_mutation`: on PostgreSQL, expected zero sales/versions after injected mandatory-audit failure; actual persisted sales count was one.
- `PostgreSql_overlap_violation_returns_stable_conflict_without_duplicate_write`: a fresh PostgreSQL testcontainer and overlapping future Term periods bypassed the current-active precheck. Expected `409 membership-overlap`; actual `500` exposed Npgsql `23P01` and `EX_ClientMemberships_ClientId_Period_NoOverlap`.

These failures localize the symptoms to the membership write contract, missing idempotency barrier, non-atomic mutation/audit boundary and unhandled PostgreSQL concurrency barrier. No production-data repair is required.

### Frontend component/Playwright

Commands:

```text
cd frontend && npm run test:unit -- src/lib/api/clients.membership-pricing.test.ts
cd frontend && npm run test:unit -- src/features/clients/ClientManagement.test.tsx
cd frontend && npm run test:e2e -- e2e/membership-sale-pricing.spec.ts -g "TASK-078"
```

Behavioral red captured before frontend production changes:

- Purchase and renewal API contract cases expected `Idempotency-Key` values but observed no header.
- Correction API expected `{ SaleId, ExpectedMembershipId, ValidFrom, ValidTo }` but observed legacy `{ PurchaseDate, ExpirationDate, IsPaid }`.
- Mark-payment API expected the addressed identifiers but observed `{}`.
- The mark-payment component expected the addressed payload plus key; the actual call used only the client id and `{}`.
- The correction component and Playwright scenarios expected immutable purchase-date context plus validity-only inputs; the legacy form did not render that contract.

The later Playwright stale-server mismatch after production edits is classified as infrastructure noise and is not counted as the red phase.

## Green phase and full validation

Frontend green:

- `npm run test:unit -- src/lib/api/clients.test.ts src/lib/api/clients.membership-pricing.test.ts src/features/clients/ClientManagement.test.tsx` — 47 passed.
- `E2E_PORT=3102 npm run test:e2e -- e2e/membership-sale-pricing.spec.ts -g "TASK-078"` — 6 passed on a fresh dev server.
- `npm run lint` — passed.
- `npm run build` — passed.
- `git diff --check -- frontend` — passed.

Backend, bot and clean-compose validation are complete.

Backend green:

- `dotnet test backend/GymCrm.slnx --filter FullyQualifiedName~ClientMembershipWriteRegressionApiTests` — 15 passed before the final explicit unique-index collision case was added.
- `Concurrent_identical_PostgreSql_reservation_collision_uses_stable_unique_index_mapping` — 1 passed against real PostgreSQL.
- `dotnet test backend/GymCrm.slnx --filter 'FullyQualifiedName~ClientMembershipPersistenceModelTests|FullyQualifiedName~ClientMembershipWriteRegressionApiTests'` — 22 passed before the final collision case; the final focused total is 23.
- `TechnicalLogging__DirectoryPath=/tmp/gym-crm-task078-final-logs dotnet test backend/GymCrm.slnx --no-restore` — 249 passed with the final explicit unique-index collision test.
- A full-suite-only SQLite regression caused by server-side `DateTimeOffset` ordering was found and fixed by applying the deterministic current-membership ordering after loading the small set of open versions.

Bot consumer green:

- `bot/.venv/bin/ruff check .` — passed.
- `bot/.venv/bin/pytest` — 36 passed.
- The external Python bot contract did not change. The backend bot consumer now resolves and sends the exact `saleId`/`expectedMembershipId` target.

## Clean compose and smoke validation

- `docker compose --project-directory . --env-file .env -f deploy/docker-compose.yml config --quiet` — passed.
- The local `gym-crm` containers and volumes were removed, including PostgreSQL data, and the stack was rebuilt twice from an empty database; the second rebuild verified the final explicit index name.
- `db`, `backend`, `frontend` and `bot` are healthy.
- `GET http://localhost:8080/health/ready` — healthy PostgreSQL check.
- `GET http://localhost:3000/` — `200`.
- Fresh schema:
  - migrations: `20260513165936_InitialCreate`, `20260721210111_FixClientMembershipVersionConstraints`;
  - idempotency indexes: `UX_ClientMembershipIdempotency_Actor_Key`, `IX_ClientMembershipIdempotencyRecords_ExpiresAt`;
  - membership overlap barrier: `EX_ClientMemberships_ClientId_Period_NoOverlap`;
  - no new migration was created.
- HTTP smoke on the clean stack:
  - login `200`;
  - client creation `201`;
  - purchase `200`;
  - addressed correction `200` with unchanged sale purchase date;
  - addressed mark-payment against the corrected version `200`;
  - sequential renewal `200`;
  - fresh client GET `200`.
- Fresh database counts for the smoke client: 2 sales, 4 membership versions, 4 mandatory membership audits and 4 completed idempotency records.

## Validation notes

- NuGet continues to report pre-existing `Magick.NET-Q8-AnyCPU 14.12.0` vulnerability warnings.
- Vite continues to report the existing large-chunk warning.
- Docker Desktop runs the configured PostgreSQL image under amd64 emulation on the arm64 host; all health checks pass.
- The broad legacy `--seed-test-data` helper is incompatible with the current `CK_Users_AdministratorBranch` constraint. This is outside TASK-078; the supported Leninsky seed plus API-created client was used for the smoke prerequisites.
- During log inspection, the existing client-Telegram `HttpClient` category logged its request URI, whose path contains the bot credential. No membership ProblemDetails or membership failure response exposed PostgreSQL details, but credential redaction for that unrelated transport should be handled separately.
