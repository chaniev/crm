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
field before React committed the failed request's validation errors.
Recovery now runs in the post-commit effect, after submission is released.
The existing field-mapping unit scenario also asserts focus. This correction
is kept in the TASK-188 workspace before synchronizing TASK-189.

## Integration and TASK-189 evidence

- TASK-188 full task harness passed at `7e3bc788af1312c16f6ea5cdabece14876cccc28`;
  primary main was fast-forwarded with identical candidate tree.
- TASK-188 focus correction: frontend/knowledge harness passed at `d17baff`,
  then Chromium field-error scenario passed 10 repeated runs. Main fast-forward
  tree `d12ab1183d7c1d7c676f6fb6fda741942a998eb2` matches that candidate.
- TASK-189 was created from origin/main, then synchronized only with already
  integrated main. Readiness preflight passed again. Its initial focused red
  had 14 failures/60 passes, with missing entry/guard and series identity check.
- TASK-189 implements independent lookup/recovery, all-slot summary, identity
  dirty guard, typed group/series/history origin, reload-safe session bootstrap,
  group refetch/focus/list return, and mismatched/obsolete response protections.
- Final task command: `python3 scripts/harness/verify_change.py --base d17baff --task-id TASK-189`.
  At `6aeefcb74fef27ec1d0fd6911054635638d5e3dc`, clean tree
  `3b31d5259d4a6b575f9113d04bf6578a318c5d91`, all checks passed:
  719 unit tests; 27 workflow + 18 schedule + 11 registry + 6 substitutions +
  3 group-client browser cases; lint/types/build/guards/audit and knowledge checks.
- Main fast-forwarded to that exact tree on 23.10.2026. No conflict resolution
  changed the candidate. Existing calendar-origin preview/execute return passed.
- A broad exploratory browser run found four old attendance-origin fixture
  failures in client-profile-context-navigation: missing today-worklist endpoint.
  One representative failure was reproduced before TASK-189 on `d17baff`.
  The task contract selects the three affected group-client cases; no tests were
  skipped or reported passed without running them.

## Archive mapping — 2026-10-23

Both task cards, plans, verification contracts, manual confirmations and their
owned evidence now live together under `backlog/done/2026-10-23/`.
Historical paths above retain their original meaning:

- `backlog/implementation/TASK-188*` → `backlog/done/2026-10-23/TASK-188*`.
- `backlog/implementation/TASK-189*` → `backlog/done/2026-10-23/TASK-189*`.
- Both `backlog/implementation-plans/TASK-188*.plan.md` and `TASK-189*.plan.md`
  → same basenames in `backlog/done/2026-10-23/`.
- Shared approved mockups remain at their existing path. Current requirement,
  task, plan and evidence links were repaired; a pre-existing stale TASK-157
  CHANGELOG link was corrected to its existing archive.

Final evidence: [TASK-188](../done/2026-10-23/TASK-188-evidence/validation.md),
[TASK-189](../done/2026-10-23/TASK-189-evidence/validation.md).
REQ-GRP-001/003 are realized in main; REQ-NFR-001 remains partial for the recorded
physical-device limits. Requirements decisions and backend-owned semantics are unchanged.

## Aggregate regression

After the last code merge, `python3 scripts/harness/verify_change.py --base origin/main`
passed on clean primary main `6aeefcb`: backend 590 tests, restore, formatting,
Release build and dependency audit; frontend 719 tests, install/audit/check/build;
all knowledge checks. Reports are retained as `integration-harness.json` in both
archived evidence directories. The remaining closure changes only documentation
and evidence and therefore use the harness-selected knowledge checks.
