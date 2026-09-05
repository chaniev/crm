# Implementation Plan: TASK-147 Уточнить schema и validation ThemeProfile

## Metadata
- source_task: /backlog/done/2026-08-29/TASK-147-theme-profile-schema.md
- completion: implemented and locally integrated into main on 2026-08-29
- requirements: none — compatibility-schema hardening preserves registered profile output, IDs and fallback behavior
- branch: refactor/TASK-147-theme-profile-schema
- readiness: yes
- dependencies: coordinate schema boundary with risky TASK-155 before editing; TASK-155 owns runtime/customer-specific schema and settings
- risk: medium — a type-only migration can silently change generated CSS or fallback bootstrap behavior

## Goal
Every field accepted by the compatibility `ThemeProfile` schema has a named role, is validated with an exact profile/field reason, is consumed in theme generation, and preserves the current two-profile visual/CSS output.

## Decisions and contracts
- Replace positional `supplementary` meaning with named compatibility roles (`neutral`, `accentThree`, `accentFour`) or introduce an explicit schema-version adapter; no optional accepted field may be ignored.
- Validate schema version, ID, required roles, exactly ten valid color strings per tuple, and duplicate IDs at registry construction/resolution boundary.
- Preserve IDs, unknown/blank fallback, warning-sink deduplication and bootstrap non-blocking behavior.
- Do not add runtime JSON, customer-specific neutrals/auth primary or settings persistence; those belong to TASK-155.

## Scope
### In
- Compatibility type/schema, registry validation, version adapter if needed, authoring diagnostics and byte-for-byte semantic variable/theme regression evidence.

### Out
- Runtime branding/settings, expanded white-label boundary, feature code changes.

## Implementation slices
1. Add valid/invalid fixtures including the currently ignored fourth supplementary tuple and snapshot current generated theme/semantic variables.
2. Agree the non-overlap seam with TASK-155, then define the named schema and validator/version adapter.
3. Migrate both profiles and all creation/resolution consumers through the validated shape.
4. Prove fallback/bootstrap compatibility, contrast gating and unchanged output.

## Likely files and layers
- `frontend/src/theme/types.ts` — named/versioned compatibility profile type.
- `frontend/src/theme/validateProfile.ts` (new) — structured validation diagnostics.
- `frontend/src/theme/profiles.ts`, `frontend/src/theme/createGymCrmTheme.ts`, `frontend/src/theme/semanticVariables.ts` — named-role consumption.
- `frontend/src/theme/resolveProfiles.ts`, `frontend/src/bootstrap/configThemeResource.ts` — validation/fallback seam without blocking login.
- `frontend/src/theme/registry.test.ts`, `frontend/src/bootstrap/configThemeResource.test.ts`, `frontend/src/bootstrap/authBootstrap.test.tsx` — fixtures and compatibility evidence.
- `frontend/DESIGN.md` — safe authoring and required gates.

## Regression specification
### Automated tests to add or update
- Missing/malformed/extra/ignored role fixtures fail with profile ID, field path and exact reason; duplicate profile IDs fail deterministically.
- The former fourth tuple is either named and consumed or rejected at validation.
- Existing profiles generate the same theme colors and semantic variable map before/after migration and pass TASK-142.
- Blank/unknown IDs retain deterministic default fallback, warning shape/dedup and successful auth bootstrap.

### Expected red evidence
- The ignored-fourth-tuple fixture is currently accepted but has no output effect; named-role validator tests fail because validation does not exist.

### Required validation
- Run focused registry/config/bootstrap tests and the all-profile contrast matrix when TASK-142 is available.

### Regression barrier
- Golden generated theme/semantic-variable output plus invalid-schema fixture suite is the merge barrier.

## Risks and stop conditions
- Stop until TASK-155 owners agree the adapter/ownership boundary; do not define its runtime schema in this task.
- Stop on any unexplained output diff or login-blocking behavior.
