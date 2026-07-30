# Implementation Plan: TASK-089 Устранить horizontal overflow desktop-списка клиентов с preview

## Source task
/backlog/done/TASK-089-desktop-client-list-preview-overflow.md

## Implementation branch
fix/TASK-089-desktop-client-list-preview-overflow

Branch rules:
- использовать `.agents/skills/task-worktree/SKILL.md` и отдельный worktree
  directly from updated `origin/main`;
- current `origin/main` already contains TASK-017 `d86ded4`, TASK-084
  `3e20367` and TASK-085 `4e23199`; verify those commits remain ancestors of
  the task branch before production edits;
- do not reimplement mobile search cards or client detail redesign;
- verify branch/dependency commits before production edits.

## Goal
Сделать desktop client workspace list-primary: при открытом preview на
`1440 x 1200` approved decision data читается без horizontal list scroll,
preview имеет deterministic open/collapse behavior, а narrower layouts use a
single-column route-based drill-down fallback while preserving TASK-017 state.

## Current understanding
- Current CSS fixes preview at `22rem`, list rows/header at `min-width:46rem`
  and makes the list `overflow-x:auto`; measured content exceeds container.
- Screenshot 2026-07-27 показывает пользовательский симптом той же geometry:
  видимый label row action `Открыть` обрезан до неполного слова.
- Product decision 2026-07-30 supersedes the source-task row-action
  requirement: удалить row button `Открыть`; в split-capable desktop table
  один click выбирает клиента/показывает preview, double-click открывает full
  client card, а видимая `Открыть карточку` остаётся в preview. Keyboard
  equivalents are defined below.
- TASK-084 намеренно оставляет этот client preview-open `1440 x 1200` case как
  machine-readable exception с `ownerTask: TASK-089`; эта задача владеет
  исправлением, regression test и удалением исключения вместе с устаревшей
  row-action inventory entry.
- `useClientsListState` selects first/restored client, but there is no explicit
  persistent collapse state or focus-return contract.
- `ClientsResults` currently renders five desktop columns; lower-priority data
  can move into secondary row/preview while required fields remain visible.
- `ClientPreviewPanel` lacks a collapse operation and its error state has no retry/open action.
- Product decisions are resolved for four exact columns and the fallback:
  - `Клиент`: full name + allowed phone;
  - `Филиал`: branch + group;
  - `Абонемент`: membership + status;
  - `Следующее действие`: concrete next action + last visit;
  - no separate row action column or row button;
  - insufficient-width fallback reuses `/clients/:id/preview`, not a new
    Drawer.
- Source task is an approved substantial desktop workflow. Before code,
  `ux-researcher` and `ui-designer` record a conformance handoff for this exact
  contract and measured breakpoint without reopening the resolved product
  decisions or changing client business semantics.

## Dependencies and execution order
1. TASK-017 merged in `d86ded4`: generic client list restoration.
2. TASK-084 merged in `3e20367`: shared corrections and owned exception.
3. TASK-085 merged in `4e23199`: final mobile client hierarchy/state.
4. TASK-089 may start from current `origin/main` after worktree preflight.

## Execution steps
1. Create task worktree from `origin/main` after all dependencies and inspect
   the merged state/restoration APIs.
2. Before production code add unit tests for desktop workspace state:
   - initial preview open for restored/first selected client only in
     split-capable desktop mode;
   - deliberate collapse persists through list interactions and TASK-017 return;
   - after collapse, a deliberate single click or `Space` on a desktop row
     reopens preview for that row at default width;
   - split-capability transitions do not mutate selection or the user's
     expanded/collapsed intent;
   - fallback mode is derived from available width and is never serialized;
   - typed TASK-017 `ui.previewIntent` parse/sanitize/serialize, malformed and
     legacy defaults.
3. Before production code add component tests:
   - exact four-column mapping and visually available long decision values;
   - no row `Открыть` button or fifth action column;
   - split desktop row interaction: click/`Space` selects and opens/updates
     preview; double-click/`Enter` opens the full client card;
   - fallback row retains the existing click/`Enter`/`Space` route-based
     preview operation;
   - preview loading does not block list;
   - preview error has primary `Повторить` and, when a selected id exists,
     secondary `Открыть карточку`;
   - collapse focus returns to selected row;
   - visible preview action `Открыть карточку` remains Tab reachable.
4. Before production code add Playwright geometry tests:
   - `1440 x 1200` open preview with long multi-branch data and
     `scrollWidth <= clientWidth` for list/header;
   - four headers/cells and their required values have no
     clipping/ellipsis/overlap; wrapped rows remain usable;
   - row button `Открыть` is absent, double-click and keyboard `Enter` open
     full detail, and preview `Открыть карточку` remains visible;
   - после зелёного geometry test удалить точечное TASK-084 inventory exception
     and the obsolete row-action inventory case for client preview-open desktop
     split;
   - responsive mode tests immediately below/above the deterministic
     split-capability threshold;
   - `768 x 1024` uses the existing single-column `/clients/:id/preview`
     drill-down;
   - `360 x 780`, `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420` and
     `956 x 440` mobile/compact-height non-regression;
   - `200%` zoom falls back without horizontal page/list scroll or clipped
     controls;
   - selection/search/filter/scroll/preview state across open/collapse/detail/back.
5. Run tests and capture expected failures from `22rem`, `46rem`,
   `overflow-x:auto`, the obsolete row action, missing typed preview intent and
   missing collapse/focus/retry behavior.
6. Refactor workspace state through the merged TASK-017 contract:
   - extend the existing typed `ui` seam with
     `previewIntent: 'expanded' | 'collapsed'`;
   - strictly sanitize it and default missing/malformed/legacy values to
     `expanded`;
   - persist intent only in the current TASK-017 history entry, including
     same-entry reload/detail/back; a fresh list entry defaults to `expanded`;
   - derive `split` versus `drill-down` from geometry without serializing the
     responsive mode;
   - keep deliberate collapse separate from forced fallback: returning to a
     split-capable width reopens only when stored intent is `expanded`;
   - preserve selected client and preview intent without a new global store;
   - if filters remove the selected row, retain the intent while the existing
     list contract chooses a valid current selection; deliberate reopen targets
     that current row;
   - expose row refs/focus return safely.
7. Implement list-primary responsive geometry:
   - `minmax(0,1fr) clamp(18rem,24vw,21rem)` or measured equivalent;
   - remove mandatory row/header min-width and list horizontal scrolling in
      preview-open desktop mode;
   - replace five columns with exactly four:
     `Клиент` (full name + allowed phone),
     `Филиал` (branch + group),
     `Абонемент` (membership + status),
     `Следующее действие` (concrete next action + last visit);
   - allow required values to wrap at `1440 x 1200`; do not replace them with
     ellipsis or accessible-name-only content;
   - remove the row `Открыть` button and its reserved action width; do not add
     an icon-only replacement or a fifth action column.
8. Add deterministic fallback:
   - split capability is based only on workspace inline size, never on live
     content `scrollWidth`: after allocating preview width and the `1rem` gap,
     the list must retain at least `48rem`; unit-test the resulting boundary at
     `threshold - 1px` and `threshold + 1px`;
   - if that allocation is unavailable, render the full-width list and reuse
     the existing `/clients/:id/preview` drill-down;
   - do not introduce a client Drawer;
   - never use touch compact-height desktop split.
9. Add deterministic interaction and recovery:
   - collapse/close removes the secondary pane, expands the list and returns
     focus to the selected row;
   - in split-capable desktop mode a single click or `Space` on any row is the
     explicit reopen operation after collapse; it selects that client and
     restores preview at default width;
   - in split-capable fine-pointer desktop mode double-clicking a row opens the
     full client card; keyboard `Enter` provides the equivalent shortcut;
   - the first click emitted as part of a double-click may update selection but
     must not cause stale preview state, duplicate navigation or focus loss;
   - keep the visible preview `Открыть карточку` action as the discoverable,
     Tab-reachable full-card operation;
   - fallback mode retains the existing whole-row drill-down semantics instead
     of the desktop double-click shortcut;
   - preview error recovery uses `Повторить` plus secondary
     `Открыть карточку` when possible;
   - avoid a resizable splitter or focus trap in the non-modal split pane.
10. Run focused tests after each slice, then full frontend unit/lint/build and
    affected desktop/mobile Playwright and target-iPhone WebKit suites.

## Preferred implementation strategy
1. Geometry and state red tests.
2. TASK-017 UI extension and workspace state/focus contract.
3. Responsive list-primary columns.
4. Row interaction, route-based fallback and recovery.
5. TASK-017/TASK-085 regression closure.

## Files likely to change
- `frontend/src/features/clients/list/ClientsListScreen.tsx`
- `frontend/src/features/clients/list/ClientsResults.tsx`
- `frontend/src/features/clients/list/ClientPreviewPanel.tsx`
- `frontend/src/features/clients/list/useClientsListState.ts`
- `frontend/src/features/clients/list/clientListReturnState.ts`
- `frontend/src/features/clients/list/clientListReturnState.test.tsx`
- focused client workspace component/state tests
- `frontend/src/App.css`
- affected client return-state/desktop responsive Playwright specs
- `frontend/e2e/responsive-main-screens.spec.ts`
- `frontend/e2e/iphone-target-devices.spec.ts`
- `frontend/e2e/touch-target-inventory.spec.ts`
- `frontend/e2e/touch-target-inventory.allowlist.ts`

## Constraints
- No backend contract or permission changes.
- Reuse TASK-017 state and TASK-085 card/data hierarchy.
- No horizontal scrolling as default solution.
- No arbitrary resizable splitter.
- Four desktop decision columns are fixed; there is no row action column.
- Full detail remains visibly reachable from preview; desktop double-click is a
  shortcut, not the only available operation.
- Responsive fallback reuses the existing preview route and does not add a
  Drawer.
- Full values must be visually available through wrap/space/disclosure/preview,
  not only accessible names.

## Out of scope
- Client detail redesign, quick actions, tabs and forms.
- Mobile search-focused workflow changes.
- New client API fields unless the required value is proven absent, which is a stop condition.

## Required test coverage

### Unit tests
- Preview expanded/collapsed/restored intent transitions.
- TASK-017 typed `ui.previewIntent` round-trip, sanitization and legacy default.
- Deterministic responsive mode selection boundary.
- Exact four-column view-model mapping.

### Integration tests
- Component tests integrate list selection, preview async states, collapse,
  focus return and TASK-017 restoration.
- Component tests cover split desktop click/Space versus double-click/Enter,
  fallback whole-row drill-down and absence of the former row action.
- Backend integration tests are not applicable because API contracts do not change.
- Tests are written before production code and must first fail on current state/geometry.

### UI/e2e tests
- Long-value geometry at `1440 x 1200` with real `scrollWidth/clientWidth`.
- Exact four-column visibility, wrapping and no fifth action column.
- Double-click/`Enter` full-detail shortcut plus visible, Tab-reachable preview
  action `Открыть карточку`.
- Tablet route-based fallback, boundary checks, `200%` zoom and
  mobile/compact-height non-regression.
- Search/filter/selection/scroll/collapse/detail/back restoration.
- SuperAdministrator global multi-branch visibility.

## Test plan
- [x] State/component tests red before implementation.
- [x] Desktop geometry/return-state Playwright tests red before implementation.
- [x] `npm run test:unit`
- [x] affected client Playwright specs
- [x] `npm run test:e2e:iphone`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `360/390/420/440`, tablet, desktop, zoom and compact-height checks green.

## Regression barrier
Completion requires an automated long-content desktop test asserting
`scrollWidth <= clientWidth` with preview open, the exact four decision columns,
no row `Открыть` control, working double-click/`Enter` full-detail shortcuts
and a visible Tab-reachable preview `Открыть карточку` action. It also requires
state/focus restoration through the typed TASK-017 UI extension, deterministic
tablet/mobile drill-down fallback and target-iPhone regressions. CSS property
assertions alone are insufficient. Completion также требует удаления
зарегистрированного TASK-084 exception и obsolete inventory case; расширять
или переносить exception запрещено.

## Risks
- Removing min-width can silently truncate decision data instead of solving overflow.
- Variable-height wrapping can affect TASK-017 scroll restoration.
- Resize/media transitions can lose selection, user collapse intent or focus.
- Native double-click emits click events first; handlers can cause redundant
  preview loading or duplicate navigation unless tested explicitly.
- Removing a visible row action can reduce discoverability; the preview
  `Открыть карточку` action and keyboard `Enter` equivalent are mandatory
  mitigations.

## Stop conditions
Остановиться, если:
- dependency commits `d86ded4`, `3e20367` or `4e23199` are not ancestors of
  the task branch base;
- approved fields are absent from backend response and require contract expansion;
- the four fixed columns cannot retain required values with a `48rem` list
  allocation without silent truncation or a product-level redesign;
- implementation changes mobile workflow beyond TASK-085/shared corrections;
- task worktree/branch is invalid.

## Ready for Codex execution
no — completed on 2026-07-30 in commit `87521b4`; regression closure
`378ea7f`.
