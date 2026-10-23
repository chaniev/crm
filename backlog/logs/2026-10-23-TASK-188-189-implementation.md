# TASK-188 / TASK-189 implementation

## Preflight

Both explicit `validate_plan_readiness.py --plan` calls passed on `d01bcd4`.
Accepted REQ-GRP-001/003/004 and REQ-NFR-001, selected A/A and exact branch names verified.
No unresolved product, API or migration decisions. TASK-177 has no task workspace;
its overlapping weekday geometry is covered by TASK-188, without closing TASK-177.

| Plan | Branch | Depends on | Overlap | DB/runtime | Status |
|---|---|---|---|---|---|
| TASK-188 | codex/TASK-188-group-create-weekday-start-times | none | shared group tests, resources | no schema/runtime configuration | implementing |
| TASK-189 | codex/TASK-189-group-edit-schedule-entry | none; ordered after 188 | shared group tests, resources | no schema/runtime configuration | ready |

## TASK-188 evidence

- Red: focused mapper/component suite on baseline failed 6 tests (25 passed):
  independent time controls/projection absent, hidden schedule validation blocked identity save.
- Implementation: weekday-keyed controlled drafts, canonical ordered slots, per-snapshot
  error aliases, immediate preview invalidation and obsolete response protection.
- Focused suite: 34 passing tests. Backend new public API round-trip plus existing
  atomic creation/token tests: 3 passing tests; backend behavior already supported slots.
- Validation prerequisite: `dotnet restore` failed NU1902/NU1903 for transitive
  System.Security.Cryptography.Pkcs 9.0.0 from EF design tooling. Applied the same-major
  patched 9.0.21 reference in the two affected projects; no suppression or domain/API change.
  Sources: [Microsoft advisory 454](https://github.com/dotnet/announcements/issues/454),
  [Microsoft advisory 468](https://github.com/dotnet/announcements/issues/468).

- Browser verification: 12/12 scenarios on Chromium and both target WebKit profiles.
- Full frontend check: 74 files, 696 tests plus lint/types/guards/build passed.
- Frontend audit also exposed existing Vite high advisories: same-major lockfile
  update 8.2.2 → 8.3.5 removes them. Two moderate Vitest/mocker advisories remain
  visible below the unchanged canonical high threshold; no suppressions.
- Runtime comparison and limitations: [evidence](../implementation/TASK-188-evidence/validation.md).

## TASK-188 focus recovery follow-up

The batch browser pass exposed a race: requestAnimationFrame could focus a
disabled input before React committed the failed request's enabled/error state.
Recovery now runs in the post-commit effect, after submission is released.
The existing field-mapping unit scenario also asserts focus. This correction
is kept in the TASK-188 workspace before synchronizing TASK-189.
