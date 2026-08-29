# Implementation Plan: TASK-153 Ввести visual regression gate для дизайн-системы

## Metadata
- source_task: /backlog/done/TASK-153-visual-regression-gate.md
- completion: implemented and locally integrated into main on 2026-08-29
- requirements: REQ-NFR-001 (verifies)
- branch: feature/TASK-153-visual-regression-gate
- readiness: yes
- dependencies: TASK-142 and TASK-144 establish contrast/motion setup; TASK-145/TASK-146/TASK-149/TASK-151 should stabilize before accepting final baselines
- risk: medium — nondeterministic fixtures, fonts or rendering can create flaky CI or thresholds that hide real drift

## Goal
A small deterministic Playwright screenshot matrix fails on accidental cross-theme/foundation/component-state drift and produces reviewable diff artifacts, while behavioral and accessibility assertions remain mandatory.

## Decisions and contracts
- Reference states cover auth, shell/navigation, shared toolbar/list, form/error, Modal/Drawer and key operational states; select the smallest set that spans foundations/components without snapshotting every screen.
- Cover both profiles and required mobile/desktop widths through pairwise matrix design, avoiding redundant permutations.
- Freeze time, data, animations, fonts, viewport, color scheme and network state. Use exact clipping/masks only for content proven irrelevant and nondeterministic.
- Baseline updates require a reason and rendered review; no broad threshold increase, blanket masking or snapshot replacement after a failure without diagnosis.

## Scope
### In
- Deterministic fixtures, reference matrix, committed baselines or CI artifact strategy, task-aware harness integration, update/review documentation and one deliberate-failure proof.

### Out
- Replacing behavior/accessibility tests, every-screen snapshots, physical-device claims.

## Implementation slices
1. Define the pairwise reference matrix and determinism contract; add a single state whose screenshot is expected to fail before baseline acceptance.
2. Stabilize fixture data/time/motion/fonts and prove identical output across two consecutive runs.
3. Add remaining bounded reference states for both themes/mobile/desktop and tune only per-assertion tolerances backed by evidence.
4. Wire diff artifacts and task verification contract, then document baseline review/update rules.

## Likely files and layers
- `frontend/e2e/design-system-visual.spec.ts` (new) — deterministic reference matrix and behavioral preconditions.
- `frontend/e2e/fixtures/**` or existing route mocks — frozen state builders.
- `frontend/playwright.config.ts` — snapshot path/template and diff policy without weakening other tests.
- `frontend/e2e/**-snapshots/` — reviewed baselines if repository storage is selected.
- `scripts/harness/commands.py` and task verification contract — visual command/artifact integration.
- `frontend/DESIGN.md`, `docs/HARNESS.md` — baseline update and reviewer evidence rules.

## Regression specification
### Automated tests to add or update
- Each screenshot waits for loaded Onest, frozen fixtures/time and reduced-motion setup, then asserts behavioral/accessibility preconditions before capture.
- Matrix covers auth, shell/navigation, toolbar/list, form/error, temporary surface and operational states across both themes and representative mobile/desktop widths.
- A controlled one-pixel-or-token mutation produces a failing, reviewable diff; reverting it restores green.
- Two clean consecutive runs produce identical snapshots.
- Harness failure retains/publishes expected/actual/diff artifacts and does not skip behavior/accessibility suites.

### Expected red evidence
- The first reference assertion fails because no approved baseline exists; one controlled mutation must later prove the accepted baseline detects material drift.

### Required validation
- Run the visual suite twice from clean state, then run the task-aware verification contract and inspect its failure artifacts once.

### Manual evidence
- Review every initial baseline and the deliberate diff at actual rendered size; record why each state exists and any narrowly scoped mask/tolerance.

### Regression barrier
- Two-run deterministic visual matrix with reviewed diff artifacts is the merge barrier.

## Risks and stop conditions
- Stop on inconsistent pixels between clean consecutive runs; diagnose fonts, animations, fixture timing or platform before accepting baselines.
- Stop if a threshold/mask can hide text, focus, color or layout changes; keep the test red until the source is deterministic.
