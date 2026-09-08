# Remote stand deployment — 2026-09-09

## Result and provenance

Successfully activated on 2026-09-09, Europe/Moscow. Target: `main` application commit `c2b6cdf90d9fe4b1fe633c22e7a575a48c72ab50`, tag `c2b6cdf-20260908-amd64`. Subsequent reporting commits do not change deployed code.

User authorized updating the existing stand: host `84.54.59.17`, SSH user `user`, identity `vm-chaniev`, root `/home/user/gym-crm`, platform `linux/amd64`. Authentication used an interactive SSH prompt; credentials are excluded from artifacts. Release mutations were serialized under `.codex-release.lock`.

[Preparation and layer/contract review](LOCAL_REMOTE_STAND_DIFF_2026-09-08.md) records baseline evidence and the initial startup blocker resolved by TASK-171. Backend/bot baseline: `390b21c0c4ad9f27f1391d615297e58e0aa805b4`; frontend baseline: `b813da70d9dec1f45a54221ce175f27a71aab58f`. Backend-owned login normalization and today's attendance worklist remain compatible with frontend/bot consumers. No new public contract incompatibility was found.

## Build and delivery

Built from clean immutable checkout `/private/tmp/crm-release-build-c2b6cdf` through project build/export/load scripts. Initial and repeat builds passed; repeat reused persistent caches and produced identical image IDs. Cache root `/private/tmp/gym-crm-release-build-cache` and builder `gym-crm-release-builder` are retained outside source and release archives.

| Service | Active image ID (sha256) | Health / restarts |
|---|---|---|
| backend | d994e4379c8fd194f110815bc82d379ff26479d385b75df8c881bb0defcd837c | healthy / 0 |
| frontend | 3f315c4370984f39c686d82758851b28c72b78177bc61eb5b57b20a1d285bea5 | healthy / 0 |
| bot | af2e4b9351ffd32a7a2ec8fce99297609b2423a1b3e32da20d604ab38840993f | healthy / 0 |

All three application images use tag `c2b6cdf-20260908-amd64`; server image IDs match the release manifest and platform. Frontend full ID is `sha256:3f315c4370984f39c686d82758851b28c72b78177bc61eb5b57b20a1d285bea5`.

Archive `gym-crm-images-c2b6cdf-20260908-amd64.tar` (~529 MiB), SHA-256 `9e90983ed6bc034d564f902254e6ab65a09c66b71d53877188ff3cc4dbb91627`. Server release directory: `/home/user/gym-crm/releases/c2b6cdf-20260908-amd64`; all uploaded manifest checksums passed before loading.

Server Compose matches source (SHA-256 `3499775d4611729772c1010b58476f0f00b7b2f3491ed9bd24a7117077bb40ae`). Only `BACKEND_IMAGE`, `FRONTEND_IMAGE`, `BOT_IMAGE` changed in the retained runtime environment. PostgreSQL was not recreated or restarted: active image remains `sha256:af194ccf3e2d7fe367012c7b88ce8b816c5c889b18a5b316799a1f0d7eac746a`, healthy, restarts 0. Database, photo, log and bot volumes remain intact.

## Backup and recovery

Final backup: `/home/user/gym-crm/backups/pre-update-c2b6cdf-20260909-0018`. It contains protected runtime configuration, Compose, previous active image metadata, PostgreSQL custom dump/restore-list, photos and bot data. After stopping application writers, a fresh quiescent dump and file archives were added: `database.quiescent.dump`, `database.quiescent.restore-list`, `client-photos.quiescent.tar`, `bot-data.quiescent.tar`. Both dump restore-lists and archive listings passed; all 11 artifact checksums verified. `pre-activation-counts.txt` records the frozen baseline. Earlier backup `pre-update-c2b6cdf-20260908-2342` is retained.

After the final NOT NULL login migration, the old backend is not a safe writer. Recovery is a forward fix on the retained schema; no blind image rollback, database downgrade or destructive restore. Previous images/configuration and quiescent backup are retained for deliberate recovery if required.

## Retained-data migration and activation

Existing retained-membership compatibility objects were present with zero missing targets. Previously applied compatibility SQL matched repository checksum `d8e56fab8a197b4fb9bbcc0638ca4a922cc55861da084edba8ad48548afbd3e5`; it was not rerun. All 13 existing logins were ASCII, with no normalization collision. No separate migration script was needed.

Stopped frontend/bot/backend, kept PostgreSQL running, then started the new backend. Startup applied exactly two forward migrations:

- `20260901120000_AddNormalizedLoginKeyColumn`
- `20260901120001_RequireCaseInsensitiveLoginIdentity`

Migration history now contains nine entries. Postconditions verified non-null unique normalized login keys, NOT NULL enforcement, new unique index presence, old index absence, and retained membership target consistency. A deliberate backend restart preserved complete migration history, aggregate counts and login index OID `17979`; `post-migration.txt` and `post-restart.txt` matched exactly. Frontend and bot were then activated and became healthy.

| Aggregate | Before | After restart and final activation |
|---|---:|---:|
| Users | 13 | 13 |
| Clients | 4 | 4 |
| Memberships | 1 | 1 |
| Attendance | 1 | 1 |
| Groups | 14 | 14 |
| Audit records | 80 | 80 |

No account renaming, merging, reset or seeding occurred.

## Verification and limits

- Canonical application/release baseline: 24/24 checks passed; 559 backend, 661 frontend, 67 bot, 108 harness tests.
- Cache delta: 13/13 canonical checks passed, plus cache root/lock/invalid-export preservation/rotation checks and actual initial/repeat builds. Final Docker specialist review found no blockers.
- Additional auth smoke: 25/25. Browser regression: 93/93 (19 Chromium, 37 iPhone Air WebKit, 37 iPhone 17 Pro Max WebKit).
- Exact built images passed isolated clean bootstrap and repeated startup before deployment, with Telegram disabled locally.
- Remote internal backend readiness, frontend health and frontend proxy readiness passed. External `/`, `/healthz`, `/api/health/ready`, `/api/auth/session` returned 200; protected `/api/attendance/lessons/today` returned expected 401 without authentication.
- NuGet audit found no vulnerabilities. npm passed the unchanged high-severity gate; one moderate development-only `@humanfs/node@0.16.7` finding via ESLint remains (GHSA-p498-v437-472g). Production-only npm audit found zero vulnerabilities. Existing frontend chunk-size warning remains non-blocking.
- Physical iPhone/Simulator Safari chrome, actual software keyboard and hardware safe-area behavior were not verified; WebKit emulation is not physical-device acceptance. No authenticated end-to-end interaction on the live stand or Telegram message exchange was performed.

Local machine evidence: `/private/tmp/crm-release-resumed-validation.json`, `/private/tmp/crm-cache-validation.json`, build/repeat logs and release artifact manifest. Server evidence is retained in the release directory and backup above. [User release notes](RELEASE_NOTES_2026-09-09.md).
