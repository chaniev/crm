# TASK-171 validation evidence

- Date: 2026-09-08.
- Base: 55391a41d324c21bf8f621eefc512271f81ea182 (origin/main).
- Branch: codex/TASK-171-login-startup-idempotency.
- Plan preflight passed before implementation.

## Regression

The new PostgreSQL application-restart theory uses three starting schemas: clean database, previous retained migration, and the intermediate nullable-key migration. It starts and disposes two real application hosts on the same disposable database, checks the public session endpoint, captures PostgreSQL unique-index OID, full synthetic user rows and migration history, and verifies the barrier/NOT NULL state. Index OID detects transient drop/recreate that final-schema assertions would miss.

Before the production fix, all three cases failed at the OID equality assertion (17945 versus 17947). The first draft of the test used readiness health checks, which did not use the factory's replacement database configuration; it was corrected to the public session endpoint before measuring the intended regression.

After the fix, all six CaseInsensitiveLoginPostgreSqlTests passed, including existing clean authentication/duplicate, retained-upgrade and collision failure scenarios.

Commands from repository root:

```text
dotnet test backend/GymCrm.slnx --configuration Release --filter FullyQualifiedName~PostgreSql_application_restart_preserves_login_barrier_and_users
dotnet test backend/GymCrm.slnx --configuration Release --filter FullyQualifiedName~CaseInsensitiveLoginPostgreSqlTests
python3 scripts/harness/verify_change.py --base origin/main --report /private/tmp/crm-task171-validation.json
```

## Complete baseline

Canonical backend and knowledge baseline passed: restore, text guard, formatting, Release build with warnings as errors, 559 tests (zero failures/skips), direct/transitive NuGet audit with no detected vulnerabilities, and all knowledge checks. See [machine evidence](TASK-171-verification-report.json). After updating requirement history and moving completion artifacts, knowledge checks and diff whitespace verification were repeated.

## Review and limits

Coordinator reviewed the final change against the original defect. Final-barrier history causes an early return before intermediate migration or backfill; missing intermediate schema follows the original forward path, while interrupted upgrades resume backfill. The disabled-migrations configuration check remains before database access. Existing migration files and authentication/API contracts are unchanged. No new ADR or product decision is needed.

The tests use disposable PostgreSQL containers and synthetic users; no remote database was accessed. Remote deployment, image build and frontend/npm connectivity are outside this fix verification and remain gated by the release workflow.
