# Implementation Plan: TASK-089 Устранить horizontal overflow desktop-списка клиентов с preview

## Source task
/backlog/implementation/TASK-089-desktop-client-list-preview-overflow.md

## Implementation branch
fix/TASK-089-desktop-client-list-preview-overflow

Branch rules:
- использовать `.agents/skills/task-worktree/SKILL.md` и отдельный worktree
  directly from updated `origin/main`;
- start only after TASK-017 and TASK-085 are merged;
- do not reimplement mobile search cards or client detail redesign;
- verify branch/dependency commits before production edits.

## Goal
Сделать desktop client workspace list-primary: при открытом preview на
`1440 x 1200` approved decision data читается без horizontal list scroll,
preview имеет deterministic open/collapse behavior, а narrower layouts use a
single-column/drawer fallback while preserving TASK-017 state.

## Current understanding
- Current CSS fixes preview at `22rem`, list rows/header at `min-width:46rem`
  and makes the list `overflow-x:auto`; measured content exceeds container.
- `useClientsListState` selects first/restored client, but there is no explicit
  persistent collapse state or focus-return contract.
- `ClientsResults` currently renders five desktop columns; lower-priority data
  can move into secondary row/preview while required fields remain visible.
- `ClientPreviewPanel` lacks a collapse operation and its error state has no retry/open action.
- Source task is an approved substantial desktop workflow. Before code,
  `ux-researcher` and `ui-designer` confirm the exact column/disclosure and
  fallback handoff without changing client business semantics.

## Dependencies and execution order
1. TASK-017 merged: generic client list restoration.
2. TASK-084 shared corrections available.
3. TASK-085 merged: final mobile client hierarchy/state.
4. TASK-089.

## Execution steps
1. Create task worktree from `origin/main` after all dependencies and inspect
   the merged state/restoration APIs.
2. Before production code add unit tests for desktop workspace state:
   - initial preview open for restored/first selected client;
   - deliberate collapse persists through list interactions and TASK-017 return;
   - explicit reopen restores selected client and default width;
   - fallback mode does not change selection.
3. Before production code add component tests:
   - approved visible decision fields and keyboard-accessible disclosure;
   - preview loading does not block list;
   - preview error retry/open action;
   - collapse focus returns to selected row;
   - primary preview action remains Tab reachable.
4. Before production code add Playwright geometry tests:
   - `1440 x 1200` open preview with long multi-branch data and
     `scrollWidth <= clientWidth` for list/header;
   - `768 x 1024` fallback when required columns do not fit;
   - `390 x 844` and compact-height mobile non-regression;
   - selection/search/filter/scroll/preview state across open/collapse/detail/back.
5. Run tests and capture expected failures from `22rem`, `46rem`,
   `overflow-x:auto`, missing collapse/focus/retry behavior.
6. Refactor workspace state through the merged TASK-017 contract:
   - add explicit preview expanded/collapsed state;
   - preserve selected client and collapse state without a new global store;
   - expose row refs/focus return safely.
7. Implement list-primary responsive geometry:
   - `minmax(0,1fr) clamp(18rem,24vw,21rem)` or measured equivalent;
   - remove mandatory row/header min-width and list horizontal scrolling in
     preview-open desktop mode;
   - define responsive columns/secondary row so full name, allowed phone,
     branch/group, membership/status, last visit and next action remain visible.
8. Add deterministic fallback:
   - if available width cannot preserve approved data, render full-width list
     plus existing drill-down/right-drawer path;
   - never use touch compact-height desktop split.
9. Add preview collapse/close, retry/open recovery and focus return; avoid a
   resizable splitter or focus trap.
10. Run focused tests after each slice, then full frontend unit/lint/build and
    affected desktop/mobile Playwright suites.

## Preferred implementation strategy
1. Geometry and state red tests.
2. Workspace state/focus contract.
3. Responsive list-primary columns.
4. Preview fallback and recovery.
5. TASK-017/TASK-085 regression closure.

## Files likely to change
- `frontend/src/features/clients/list/ClientsListScreen.tsx`
- `frontend/src/features/clients/list/ClientsResults.tsx`
- `frontend/src/features/clients/list/ClientPreviewPanel.tsx`
- `frontend/src/features/clients/list/useClientsListState.ts`
- focused client workspace component/state tests
- `frontend/src/App.css`
- affected client return-state/desktop responsive Playwright specs
- `frontend/e2e/responsive-main-screens.spec.ts`

## Constraints
- No backend contract or permission changes.
- Reuse TASK-017 state and TASK-085 card/data hierarchy.
- No horizontal scrolling as default solution.
- No arbitrary resizable splitter.
- Full values must be visually available through wrap/space/disclosure/preview,
  not only accessible names.

## Out of scope
- Client detail redesign, quick actions, tabs and forms.
- Mobile search-focused workflow changes.
- New client API fields unless the required value is proven absent, which is a stop condition.

## Required test coverage

### Unit tests
- Preview expanded/collapsed/restored state transitions.
- Responsive mode selection helper if extracted.
- Required decision-column view model/disclosure mapping.

### Integration tests
- Component tests integrate list selection, preview async states, collapse,
  focus return and TASK-017 restoration.
- Backend integration tests are not applicable because API contracts do not change.
- Tests are written before production code and must first fail on current state/geometry.

### UI/e2e tests
- Long-value geometry at `1440 x 1200` with real `scrollWidth/clientWidth`.
- Tablet fallback and mobile/compact-height non-regression.
- Search/filter/selection/scroll/collapse/detail/back restoration.
- SuperAdministrator global multi-branch visibility.

## Test plan
- [ ] State/component tests red before implementation.
- [ ] Desktop geometry/return-state Playwright tests red before implementation.
- [ ] `npm run test:unit`
- [ ] affected client Playwright specs
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] mobile/compact-height smoke green.

## Regression barrier
Completion requires an automated long-content desktop test asserting
`scrollWidth <= clientWidth` with preview open, plus state/focus restoration
through TASK-017 and tablet/mobile fallback tests. CSS property assertions alone
are insufficient.

## Risks
- Removing min-width can silently truncate decision data instead of solving overflow.
- Resize/media transitions can lose selection or focus.
- Implementing before TASK-085 may cause conflicting client row rewrites.

## Stop conditions
Остановиться, если:
- TASK-017 or TASK-085 is not merged into the branch base;
- approved fields are absent from backend response and require contract expansion;
- no measurable width can retain required columns without a product-level redesign;
- implementation changes mobile workflow beyond TASK-085/shared corrections;
- task worktree/branch is invalid.

## Ready for Codex execution
yes, after TASK-017 and TASK-085 are merged
