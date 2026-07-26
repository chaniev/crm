# Implementation Plan: TASK-085 Search-focused mobile-поиск клиентов — вариант C

## Source task
/backlog/implementation/TASK-085-mobile-client-search.md

## Implementation branch
feature/TASK-085-mobile-client-search

Branch rules:
- использовать `.agents/skills/task-worktree/SKILL.md` и отдельный worktree,
  созданный из актуального `origin/main`;
- подтвердить clean status и active branch до production-кода;
- не реализовывать TASK-017 в этой branch и не смешивать TASK-089 desktop split;
- начать execution только после merge TASK-017 и синхронизации branch с новым
  `origin/main`.

## Goal
Реализовать утверждённый client-specific `browse ↔ search-focused` workflow:
видимый search остаётся первым control, retained actions скрываются только во
время поиска, результаты используют `96px` identity-first cards, а возврат из
preview/detail восстанавливает полный list context через механизм TASK-017.

## Current understanding
- Typed client API и backend search semantics уже существуют и не меняются.
- TASK-090 выпустил `EntityLocatorBar`, `ActiveFiltersBar`,
  `ListRangeStatus`, `TemporarySurfaceFooter`.
- Текущий `ClientsToolbar` всегда показывает refresh/create, а mobile
  `ClientsResults` резервирует action column и имеет `min-height: 8.1rem`.
- `useClientsListState` уже отделяет search draft от debounced query, но не
  хранит focus-driven UI state.
- UX contract в source task уже approved. Перед реализацией
  `ux-researcher`/`ui-designer` выполняют короткий conformance handoff; изменять
  Variant C без product decision нельзя.

## Dependencies and execution order
1. TASK-090 — done.
2. TASK-084 — shared touch/compact-height contract должен быть доступен или
   изменения этой branch должны быть rebased onto it.
3. TASK-017 — mandatory execution dependency and source of return-state
   persistence.
4. TASK-085.
5. TASK-089 после TASK-085.

## Execution steps
1. Создать/проверить task worktree после merge TASK-017; изучить его публичный
   list-state restoration contract и reuse без второго persistence mechanism.
2. До production-кода добавить unit tests:
   - transition table `browse ↔ search-focused`;
   - clear query while focused, blur empty/non-empty;
   - advanced filter count without query/default Active;
   - independent clear-search and reset-filters behavior;
   - long-name/branch/action view model.
3. До production-кода добавить component tests:
   - toolbar action visibility and focus order in both states;
   - permission-bound create action;
   - active chips/remove/reset and drawer focus return;
   - `96px` card DOM hierarchy without fixed action column;
   - loading/empty/error recovery preserves locator and state.
4. До production-кода добавить Playwright integration tests for the primary
   mobile flow, return through preview/detail, SuperAdministrator global search,
   keyboard/drawer behavior and required geometry.
5. Запустить new tests и подтвердить expected failures: missing state machine,
   visible retained actions, `8.1rem` rows/action column, missing branch context,
   absent return-state integration.
6. Реализовать локальный UI state:
   - derive `search-focused` from input focus or normalized query;
   - keep query/filter domain state in existing hook;
   - integrate `browse/search-focused` into TASK-017 restoration payload;
   - avoid new global store.
7. Extend `ClientsToolbar` through existing slots/state:
   - hide refresh/create only in search-focused without spacer;
   - preserve search, filter trigger, clear and active filters;
   - keep immediate filter application and scoped reset semantics.
8. Refactor mobile result card to approved `36px minmax(0,1fr) 20px` hierarchy,
   `96px` height, two-line full name, branch identity when relevant and one
   whole-card primary action.
9. Separate empty/recovery operations for query and advanced filters; retry and
   refresh must not reset context.
10. Add exact mobile/compact-height CSS using shared tokens and safe-area
    foundation; do not create `ClientsMobileToolbar`.
11. Run focused red→green tests after each slice, then full frontend lint,
    build, unit and affected Playwright/iPhone checks.

## Preferred implementation strategy
1. Reuse TASK-017 return-state.
2. Pure transition/filter tests.
3. Toolbar state integration.
4. Dense identity-card rendering.
5. Operational states and target-device geometry.

## Files likely to change
- `frontend/src/features/clients/list/useClientsListState.ts`
- `frontend/src/features/clients/list/ClientsToolbar.tsx`
- `frontend/src/features/clients/list/ClientsResults.tsx`
- `frontend/src/features/clients/list/ClientsListScreen.tsx`
- `frontend/src/features/clients/list/clientListFilters.ts`
- `frontend/src/features/clients/list/clientListFilters.test.ts`
- `frontend/src/features/clients/list/clientListViewModel.ts`
- new focused client toolbar/results/state component tests
- `frontend/src/App.css`
- affected client Playwright specs, including return-state and responsive specs

## Constraints
- Backend remains source of truth for search, permissions, phone visibility and
  branch scope.
- Use only released shared primitives and tokens.
- Query is not duplicated as active-filter chip.
- No new persistent storage contract outside TASK-017.
- Search-focused card height and required result counts are measurable acceptance.

## Out of scope
- Backend search changes.
- Client detail/tabs/quick actions/form redesign.
- New branch switcher or frontend permission filtering.
- TASK-089 desktop split geometry.

## Required test coverage

### Unit tests
- Complete state transition table.
- Filter count/reset scope.
- Long-name, branch and concrete status/action view models.
- Restoration serialization added by TASK-017 includes UI state without PII
  persistence beyond its approved boundary.

### Integration tests
- Backend tests are not applicable because the typed client API contract is unchanged.
- Component + Playwright tests cover state synchronization among search,
  filters, results, preview navigation and TASK-017 restoration.
- Tests are written before functional code and at least one new test must fail
  for each slice for the expected missing behavior.

### UI/e2e tests
- Search/filter/detail/back primary path and separate recoveries.
- Five full `96px` cards at `390 x 844`; six at `420 x 912` and `440 x 956`.
- Locator min widths `156/176/200/216px`, touch targets and no overflow.
- Long names and SuperAdministrator branch identity.
- Software keyboard reachability and drawer focus return.

## Test plan
- [ ] State/filter unit tests red before implementation.
- [ ] Toolbar/card component tests red before implementation.
- [ ] Return-state and geometry Playwright tests red before implementation.
- [ ] `npm run test:unit`
- [ ] affected client Playwright specs
- [ ] `npm run test:e2e:iphone`
- [ ] `npm run lint`
- [ ] `npm run build`

## Regression barrier
The primary barrier is an automated search→filters→preview/detail→back scenario
that asserts query, filters, page/batch, selected client, scroll position and
`browse/search-focused` state, plus measured card/locator geometry at the three
portrait targets and SuperAdministrator multi-branch coverage.

## Risks
- Focus/blur ordering can flicker retained actions or exit search-focused during clear.
- A dense card can hide decision data or make long names inaccessible.
- Duplicating TASK-017 storage would create inconsistent restoration behavior.

## Stop conditions
Остановиться, если:
- TASK-017 is not merged or exposes no safe reusable return-state contract;
- approved Variant C cannot meet visible-card counts without dropping required data;
- implementation requires backend search/permission changes;
- product workflow must change beyond source task;
- worktree/branch/dependency order is invalid.

## Ready for Codex execution
yes, after TASK-017 and shared TASK-084 changes are merged
