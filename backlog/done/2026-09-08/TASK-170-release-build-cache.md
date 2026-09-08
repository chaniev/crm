# TASK-170: Persistent cache for remote release builds

## Status
done

- completed_at: 2026-09-08
- completion_date_evidence: code integrated into main at c2b6cdf90d9fe4b1fe633c22e7a575a48c72ab50, 2026-09-08 23:23:44 +03:00.
- moved_to_done_at: 2026-09-09

## Requirements
- none — build acceleration preserves application behavior, API, database and runtime topology.

## Goal
Bring the existing project image build script into compliance with the mandatory persistent BuildKit/NuGet cache contract before the authorized remote stand update.

## Scope
- Keep project Compose build contexts, arguments and image resolution.
- Persist platform/service separated layers outside Git and clean release checkout.
- Use persistent NuGet cache for restore and publish; missing cache uses normal sources.
- Import existing valid cache and atomically publish successful exports.
- Preserve validation/audit, image export and server runtime contracts.

## Decisions
No product or material technical decision: local build-cache plumbing implements the existing deploy-project requirement. No data/runtime/API change or new infrastructure service.

## Acceptance criteria
- Shell/config validation passes; clean build and repeated build demonstrate miss/hit.
- Cache stays outside Git/build contexts, credentials and release archives.
- Existing deploy image scripts remain release entry points.

## Source notes
- User request, 2026-09-08: «обнови удаленный стенд» (credentials intentionally omitted).
- Existing mandatory contract: [.agents/skills/deploy-project/SKILL.md](/.agents/skills/deploy-project/SKILL.md), section «Инварианты деплоя».
- Docker specialist read-only review confirmed absent external cache wiring and NuGet mount.

## Processing notes
- No duplicate active cache task found on 2026-09-08; greatest allocated ID was TASK-169.
- Dedicated workspace: /private/tmp/crm-release-20260908; branch codex/release-20260908.

## Completion evidence
Canonical delta verification passed 13/13 checks. Initial and repeated exact-commit image builds succeeded with identical image IDs and persistent cache reuse. Root/lock/invalid-export preservation/rotation checks passed. Final Docker review found no blockers. See [deployment evidence](/docs/LOCAL_REMOTE_STAND_DIFF_2026-09-09.md).
