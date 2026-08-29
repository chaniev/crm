# Implementation Plan: TASK-152 Создать внутренний каталог дизайн-системы

## Metadata
- source_task: /backlog/implementation/TASK-152-design-system-catalog.md
- requirements: none — development-only documentation/tooling does not change production behavior
- branch: feature/TASK-152-design-system-catalog
- readiness: yes
- dependencies: TASK-145/TASK-146 foundations and TASK-149/TASK-151 component contracts must be stable before final catalog coverage; shell can be built earlier
- risk: low — catalog dependencies or entry code could leak into the production bundle or drift into copied components

## Goal
A documented local command opens a deterministic development-only catalog that renders production foundations/components, both theme profiles, relevant states, long Russian content, reduced motion and target widths without entering the normal production build.

## Decisions and contracts
- Prefer the smallest Vite-native separate entry compatible with the existing stack; add Storybook only if a recorded comparison proves lower maintenance and no production coupling.
- Catalog examples import production components/tokens and provide fixture data only; copied component implementations are forbidden.
- Theme, viewport and motion controls are deterministic URL/state inputs so examples are addressable by tests and visual review.
- Production exclusion is proven from build inputs/output, not assumed from route visibility.

## Scope
### In
- Development entry/command, foundation pages, component/state examples, theme/viewport/motion controls, ownership/source guidance and smoke/accessibility tests.

### Out
- Production route, customer style editor, missing workflow implementation, alternate UI library.

## Implementation slices
1. Compare Vite-native entry versus Storybook against install/build/isolation cost and record the selection.
2. Add catalog entry, command and production-exclusion test before examples.
3. Generate examples from foundation registries and production shared components, with both profiles and required state fixtures.
4. Add addressable target-width/reduced-motion/long-content views and accessibility smoke coverage.

## Likely files and layers
- `frontend/package.json`, `frontend/vite.config.ts` and a separate catalog config/HTML entry — local command and isolated build.
- `frontend/src/catalog/**` (new) — shell, fixture-only examples and source guidance.
- `frontend/src/theme/**`, `frontend/src/features/shared/**` — imports only unless a missing exported production contract is proven.
- `frontend/src/catalog/catalog.test.tsx` and/or `frontend/e2e/design-system-catalog.spec.ts` — smoke, addressability and accessibility.
- `frontend/DESIGN.md` — command, ownership and update expectation.

## Regression specification
### Automated tests to add or update
- Catalog command builds/serves its entry and canonical examples render without console/runtime errors.
- Normal `npm run build` output and module graph contain no catalog entry/examples or catalog-only dependency.
- Both profile IDs, target viewport modes, reduced-motion mode and long Russian fixtures are deterministic/addressable.
- Representative interactive examples expose names, focus, loading, disabled and error semantics.

### Expected red evidence
- Catalog smoke test fails because no entry/command exists; production-exclusion test establishes a green baseline and must stay green once the catalog is added.

### Required validation
- Run catalog build/smoke/accessibility checks plus the normal production build and frontend harness.

### Manual evidence
- Review foundation and component coverage against the production export inventory and verify source links/usage guidance.

### Regression barrier
- Catalog smoke plus normal-build exclusion assertion is the merge barrier.

## Risks and stop conditions
- Stop if the selected tool requires a second UI/runtime stack or alters normal production dependencies without a reviewed maintenance case.
- Do not mark a missing component as catalog-complete by copying it into fixtures.
