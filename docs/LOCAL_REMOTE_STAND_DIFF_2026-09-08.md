# Remote stand release review — 2026-09-08

## Result

**Historical preparation record. Deployment completed on 2026-09-09 (Europe/Moscow).** See [final activation and verification report](LOCAL_REMOTE_STAND_DIFF_2026-09-09.md). Pending and NO-GO statements below describe earlier gates, not the current stand.

## Scope and provenance

- Authorization: user requested updating the existing remote stand on 2026-09-08.
- Host: 84.54.59.17; SSH user: user; environment: existing remote CRM stand; root: /home/user/gym-crm.
- Authentication: password entered through the interactive SSH password prompt; no password placed in files or shell commands.
- Identity: vm-chaniev, x86_64; target platform linux/amd64; free space 8.0 GiB.
- Target: locally integrated main, c2b6cdf90d9fe4b1fe633c22e7a575a48c72ab50. Includes TASK-171 login restart fix and TASK-170 build cache support; source application baseline 6bf5e7e matches refreshed origin/main.
- Backend/bot baseline: 390b21c0c4ad9f27f1391d615297e58e0aa805b4, tag 390b21c-20260829-amd64.
- Frontend baseline: b813da70d9dec1f45a54221ce175f27a71aab58f, tag b813da7-20260830-amd64.
- Baseline evidence: active image IDs/tags match the previous release report and retained remote release artifacts. OCI labels contain base-image metadata, not independent CRM commit provenance.
- Backend image: sha256:7412f1a001087588388a752d7d98093240987448d33cd97c1557ab27c856d372.
- Frontend image: sha256:05991ba4442642c409473b91a6407f606bca11cb74eea1a388b99df7dff7b41f.
- Bot image: sha256:f8bf3cf96e0d6cb93628721d76f73dc264a9f9997d6f455d2991de6c21e2e7b9.
- All application images are amd64; restart counts are zero.
- Requirements: none — this release operation transfers already accepted behavior without introducing new product decisions.

## Functional and contract impact

Backend, frontend and bot change. The new attendance worklist consumes GET /attendance/lessons/today and requires the matching backend before the new frontend. Authentication and login uniqueness become case-insensitive while preserving canonical spelling. The schedule action label becomes «Посещение». Most other changes extract existing user-facing text into resource owners.

Related accepted requirements: REQ-ATT-006, REQ-ATT-001, REQ-ATT-003, REQ-GRP-005, REQ-GRP-007, REQ-USR-002, REQ-USR-003, REQ-NFR-001, REQ-NFR-003, REQ-NFR-007. Frontend specialist review found synchronized endpoint/DTO consumption.

Compose runtime wiring matches target. Local and remote server Compose SHA-256:
3499775d4611729772c1010b58476f0f00b7b2f3491ed9bd24a7117077bb40ae.
No remote environment configuration was changed.

## Initial blockers and their resolution

1. **Repeated startup targets an earlier migration.** In backend/src/GymCrm.Api/Startup/LoginIdentityStartupExtensions.cs, MigrateAsync("20260901120000_AddNormalizedLoginKeyColumn") is unconditional. When migration 20260901120001 is already installed, this directs EF to the intermediate migration. The final migration's Down removes the normalized unique index and makes the column nullable; normal startup then upgrades it again. The backend specialist and coordinator confirmed this by code review. A repeated-start runtime regression was not executed in this session. A guard for the already applied final migration and a repeated-start regression are required before rollout.
2. **Mandatory frontend validation failed.** npm ci exited with `Exit handler never called`; its debug log contains widespread ETIMEDOUT downloading packages from registry.npmjs.org. Independent default and IPv4 HTTPS probes both failed with SSL connection timeout. Locked installation and dependency audit were not bypassed.
3. **Build cache prerequisite is unfinished.** Existing scripts lack external BuildKit cache wiring and persistent NuGet mounts required by the deploy skill. TASK-170 was created for this operational prerequisite. Its partial local patch is uncommitted, unintegrated and excluded from the selected release target.

## Schema and migration decision

The remote database has exactly seven expected migrations, ending at 20260823173644_AddLessonOccurrenceTrainerSubstitutions. Users.LoginNormalized is absent. The two new migrations use the normal startup path: nullable column, domain normalization backfill, final NOT NULL and unique index.

All 13 stored logins are ASCII; preliminary upper(Login) collision groups: zero. Exact identity normalization belongs to the .NET backend and is not replaced by the SQL probe.

All four retained membership/attendance target compatibility tables exist. Memberships without targets: zero; sales without snapshots: zero. Previously installed compatibility script SHA-256 matches target:
d8e56fab8a197b4fb9bbcc0638ca4a922cc55861da084edba8ad48548afbd3e5.

Evidence does not indicate a need for an additional data migration script. The previous compatibility script was not rerun. New migrations remain blocked by the startup finding.

## Data and health

| Entity | Count |
|---|---:|
| Users | 13 |
| Clients | 4 |
| ClientMemberships | 1 |
| Attendance | 1 |
| TrainingGroups | 14 |
| AuditLogs | 80 |

All services were healthy before and at the end of inspection. Internal backend /health/ready and frontend proxied /api/health/ready succeeded. No personal records were extracted and no CRM database writes were performed. The sampled active DDL/backup-related SQL count was zero; an exclusive release lock was not acquired because rollout did not begin.

## Backup, rollout and recovery

No new backup was created: no-go occurred before remote mutations. Historical backup /home/user/gym-crm/backups/pre-update-20260830-1625 was not verified as a recovery point for this release and must not substitute for a fresh backup.

Before a future rollout, create and verify a custom database dump and restore-list, protected copies of .env/Compose and active image metadata, archives of gym-crm_backend_client_photos and gym-crm_bot_data, and checksums. Recheck disk space and competing release operations. Transfer only verified artifacts from a clean exact-commit amd64 build.

After the final login migration, image-only rollback to the previous backend is unsafe: old code does not populate the required LoginNormalized column. Do not blindly downgrade or restore the database. Establish and rehearse forward recovery before activation. Any full pre-update restore must account for subsequent writes. No rollback, downgrade or restore was executed.

## Validation evidence

Clean isolated target checkout: /private/tmp/crm-release-build-20260908.

Canonical invocation: `python3 scripts/harness/verify_change.py --base 390b21c --report /private/tmp/crm-release-validation-20260908.json`.

Passed: instruction/ADR/plan/requirements validators; 108 harness tests; backend restore, text guard, formatting, Release build without warnings, 556 tests without skips, and NuGet audit without detected vulnerabilities. The backend suite includes clean, retained-upgrade and collision PostgreSQL scenarios.

Failed: frontend locked install due to network timeouts. Remaining frontend checks/audit, bot checks and canonical Compose checks are recorded as not_run after fail-fast. Release build/export/checksums, fresh backup, retained-copy deployment rehearsal, affected Chromium/WebKit Playwright tests, external health checks and post-migration checks were not performed. Physical iPhone/Safari chrome/keyboard/safe-area acceptance was not verified.

## Workspace handoff

Primary main remains clean at 55391a4. This report and unfinished TASK-170 are in branch codex/release-20260908, workspace /private/tmp/crm-release-20260908. TASK-170 preflight passed; build-cache changes remain uncommitted and are not deployed. Workspaces and validation evidence are retained for diagnosis.

The Docker specialist separately passed shell syntax and both Compose configuration checks in the cache task workspace. Its separate harness run was interrupted at backend.restore and is not evidence of complete validation. Cache-miss/cache-hit builds remain unverified. The bot specialist found no new Internal Bot API or bot-storage incompatibility; an existing requirements/payment-documentation discrepancy predates this release and is not treated as a new release regression.

Resume by fixing startup idempotency with a repeated-start regression, restoring npm connectivity, completing mandatory validation and the cache prerequisite, integrating verified changes, selecting a new exact target, and repeating remote preflight against fresh evidence. Release notes remain unpublished.

## Resumed release evidence

Fresh SSH preflight at 2026-09-08T20:13Z matched identity, architecture, active image IDs, seven migrations, compatibility checksum and all counts above. Backend specialist reviewed TASK-171 and approved forward migration under these preconditions. Frontend and bot contract reviews found no new unsynchronized producer/consumer boundary.

Full canonical release validation on clean 6bf5e7e passed 24/24 checks: 559 backend tests, 661 frontend tests, 67 bot tests and 108 harness tests. Additional Chromium/WebKit browser regression passed 93/93 tests (19 Chromium, 37 iPhone Air, 37 iPhone 17 Pro Max), plus 25 auth smoke tests. No physical-device acceptance is claimed.

NuGet audit has no detected vulnerabilities. npm audit passed the existing project threshold (high); one moderate dev-only @humanfs/node dependency via ESLint remains (GHSA-p498-v437-472g). No audit threshold was changed or bypassed. npm audit --omit=dev found zero vulnerabilities. Existing frontend chunk-size warning remains non-blocking.

TASK-170 cache changes passed their canonical backend/deploy/knowledge checks and additional root/lock/invalid-export-preservation/rotation checks. BuildKit runs in a persistent docker-container builder, with platform-specific NuGet mounts and external per-platform/service exports under /private/tmp/gym-crm-release-build-cache. Final clean checkout: /private/tmp/crm-release-build-c2b6cdf. Actual cache miss/hit and built-image runtime checks are pending build completion.

Activation sequence after verified build/export/checksum and fresh backup: acquire exclusive release lock; retain runtime .env/Compose/image metadata plus PostgreSQL custom dump, verified restore-list, photos and bot data; load only verified release artifacts; stop application services, keep PostgreSQL and all volumes; replace only three application image variables; start new backend and verify migration/health/count postconditions before frontend/bot activation. A repeated backend startup while dependents remain gated must preserve normalized index OID.

Forward recovery: if only nullable-key migration applied, retain target image and retry after resolving transient failure; domain normalization resumes safely. If collision diagnostics occur, keep dependents stopped and request an explicit account-resolution decision. Once final NOT NULL barrier is installed, never activate the old backend for writes: retain the new schema and use a forward fix for any non-migration failure. No blind downgrade or destructive restore is authorized.

## Pre-activation gate

Clean exact-target image build and repeat both succeeded. Repeated build reused cache and produced identical application image IDs. Built backend clean startup and restart passed; index OID, user count and nine-migration history remained identical. The frontend proxy readiness endpoint succeeded and the protected attendance endpoint returned 401 without authentication. All four local smoke containers are healthy, with Telegram disabled.

Fresh backup verified: /home/user/gym-crm/backups/pre-update-c2b6cdf-20260908-2342 (280 KiB). PostgreSQL custom dump restore-list and archive listing succeeded; all seven backup artifact checksums verified. This includes protected runtime config, active image metadata, database dump, client photos and bot data. Remote technical log volume remains untouched. Exclusive .codex-release.lock is held by this release session.

Archive: gym-crm-images-c2b6cdf-20260908-amd64.tar, approximately 529 MiB. Local SHA-256: 
9e90983ed6bc034d564f902254e6ab65a09c66b71d53877188ff3cc4dbb91627  gym-crm-images-c2b6cdf-20260908-amd64.tar

Application image manifest:

```json
{
  "commit": "c2b6cdf90d9fe4b1fe633c22e7a575a48c72ab50",
  "images": {
    "backend": {
      "tag": "gym-crm/backend:c2b6cdf-20260908-amd64",
      "id": "sha256:d994e4379c8fd194f110815bc82d379ff26479d385b75df8c881bb0defcd837c",
      "platform": "linux/amd64"
    },
    "frontend": {
      "tag": "gym-crm/frontend:c2b6cdf-20260908-amd64",
      "id": "sha256:3f315c4370984f39c686d82758851b28c72b78177bc61eb5b57b20a1d285bea5",
      "platform": "linux/amd64"
    },
    "bot": {
      "tag": "gym-crm/bot:c2b6cdf-20260908-amd64",
      "id": "sha256:af2e4b9351ffd32a7a2ec8fce99297609b2423a1b3e32da20d604ab38840993f",
      "platform": "linux/amd64"
    }
  }
}
```

Server upload/checksum/load and staged activation are the remaining gates.

## Final continuation — 2026-09-09

All remaining gates passed and the three application services were activated. The final fresh quiescent backup, migration and restart evidence, unchanged data counts, and external health checks are recorded in [the final report](LOCAL_REMOTE_STAND_DIFF_2026-09-09.md).
