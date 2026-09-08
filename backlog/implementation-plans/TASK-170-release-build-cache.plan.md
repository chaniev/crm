# TASK-170 release build cache plan

## Metadata
- source_task: backlog/implementation/TASK-170-release-build-cache.md
- branch: codex/release-20260908
- readiness: yes
- requirements: none — application behavior and production contracts are preserved.
- product_decisions: none — no user-facing behavior is introduced or changed.
- technical_decisions: none — routine cache plumbing fulfills the existing mandatory release contract.
- architecture_decisions: none — no layer, API, security, data or deployment topology boundary changes.
- open_questions: none

## Decisions and contracts
Keep deploy/build-images.sh as the build entry point and existing Compose build definitions as the source of contexts and arguments. Use external per-platform/per-service BuildKit caches with distinct pending export and atomic promotion after success. NuGet packages persist across restore and publish using a platform-scoped BuildKit cache mount. Network sources fill cache misses normally. Do not change runtime wiring, lockfile/audit enforcement, image export or server activation. Preserve prior valid cache on build failure. No cache cleanup is part of release cleanup.

## Decision evidence
- [Source task and authorized release scope](/backlog/implementation/TASK-170-release-build-cache.md) explains behavior preservation.
- [Existing release cache contract](/.agents/skills/deploy-project/references/remote-release-workflow.md) requires external BuildKit/NuGet cache and project-script integration before release.

## Implementation and validation
1. Docker specialist implements only build scripts, backend Dockerfile cache mounts and related runbook instructions in the task workspace.
2. Review generated configuration and shell syntax; run canonical diff-selected harness and clean/repeated image builds.
3. Retain original application rollback point; cache failure aborts build without touching the stand. Revert the build-only commit if needed; no database rollback applies to this change.
4. Commit validated changes, integrate locally into main, create a fresh clean exact-commit release checkout and run required release validation/build there.
5. Record evidence and move completed card/plan together to dated done directory.
