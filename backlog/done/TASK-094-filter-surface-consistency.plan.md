# Implementation Plan: TASK-094 Унифицировать фон областей фильтров

## Source task
/backlog/done/TASK-094-filter-surface-consistency.md

## Implementation branch
fix/TASK-094-filter-surface-consistency

Branch rules:
- перед кодом использовать `.agents/skills/task-worktree/SKILL.md` и отдельный
  worktree из актуального `origin/main`;
- подтвердить clean status и active branch;
- не менять action placement из TASK-093, service copy из TASK-095 или trainer
  search из TASK-096;
- не реализовывать group search/filter/paging, которым владеет TASK-086.

## Goal
Унифицировать область фильтров на всех экранах CRM: каждый найденный standard
route-level locator/filter area использует одну shared semantic surface на
mobile и desktop, сохраняя filter behavior, operational states, focus и
component-owned geometry в обеих поддерживаемых theme profiles. Ни одна
standard filter/locator surface не остаётся вне inventory, migration или
обоснованного исключения.

## Current understanding
- `FilterToolbar` и `CompactFilterPanel` уже используют
  `--crm-surface-card`, `--crm-border-muted`, `10px`, no shadow.
- Schedule, Clients, Audit и Finance добавляют feature wrappers/overrides;
  schedule имеет legacy transparent inner toolbar и alpha-card wrapper,
  clients имеет custom locator/drawer wrapper.
- `EntityLocatorBar` владеет controls geometry, но standard surface paint не
  закреплён единым shared CSS class/recipe.
- Attendance context controls являются operation-specific route-level
  scope/date surface, а не standard filter/locator. Они остаются
  документированным исключением с теми же semantic background, border и shadow
  tokens, но без filter drawer/reset semantics.
- Current alternate-theme matrix проверяет geometry, но не закрывает равенство
  semantic background/border/shadow всех filter surfaces.

## UX/UI contract
- Shared CSS surface recipe владеет только paint/elevation contract:
  `background: var(--crm-surface-card)`, `border: 1px solid
  var(--crm-border-muted)`, `border-radius: 10px`, `box-shadow: none`.
  Component-specific padding, min-width, grid, responsive layout and control
  geometry остаются у component owners.
- Surface recipe не задаёт ARIA role и не меняет существующие semantics:
  `EntityLocatorBar` остаётся `role="search"`, active filters сохраняют свой
  named region, а focus проверяется на реальных interactive controls.
- Mobile secondary filters закрыты по умолчанию; drawer содержит только fields,
  close/`Готово`/scoped reset, но не create или refresh.
- Active filters находятся сразу под painted toolbar/locator surface отдельным
  sibling, доступны по одному для удаления, не включаются внутрь painted
  surface и не меняют её между loading/empty/error/populated states.
- Compact-height drawer использует dynamic viewport, один scroll body, safe-area
  footer и reachable close/action controls.

## Resolved clarification decisions
- TASK-086 merged into `origin/main` through `f8f6460`; TASK-094 uses that
  final Groups locator/filter contract as its baseline.
- Attendance остаётся operation-specific context surface с общими semantic
  paint tokens, но без standard filter semantics.
- `surface role` в этой задаче означает shared CSS class/recipe, а не ARIA role.
- Active filters остаются sibling сразу под painted surface.
- Shared recipe унифицирует только background, border, radius and shadow;
  layout/spacing остаются component-owned.
- Inventory охватывает все route-level filter/locator areas. Computed-style
  conformance покрывает каждую stable user-reachable standard surface из
  inventory; operational-state cases используют representative matrix без
  полного state × route × theme × viewport Cartesian product.

## Dependencies and execution order
1. TASK-090 — done, theme tokens/shared components уже выпущены.
2. TASK-084 — done, compact-height and touch foundation уже merged.
3. TASK-086 — done; она остаётся владельцем Groups search/filter/paging и
   предоставляет финальный Groups locator/filter baseline.
4. TASK-094 создаёт semantic surface baseline,
   включая conformance финального Groups без второго filter implementation.
5. TASK-093 затем использует этот baseline для action sweep.
6. TASK-096 использует итоговый locator surface на Trainers.

## Execution steps
1. Создать isolated worktree и committed inventory
   `docs/ui-concept/TASK-094-filter-surface-inventory.md`: Schedule, Clients,
   Audit, Finance, Attendance context, final Groups и каждый другой route-level
   locator/filter; для каждого указать component owner, current overrides,
   target shared CSS recipe и обоснованные исключения. Attendance сразу
   классифицировать как operation-specific context surface; ни один standard
   filter/locator call site нельзя исключить только потому, что он не входит в
   текущий representative test set.
2. До production-кода добавить shared component tests:
   - `EntityLocatorBar`, `FilterToolbar`, `CompactFilterPanel` получают один
     standard surface class/recipe без изменения ARIA semantics;
   - recipe владеет только background/border/radius/shadow, а component layout
     and spacing не унифицируются этой задачей;
   - active filters остаются sibling сразу под painted surface;
   - mobile drawer не содержит create/refresh;
   - active filter semantics, trigger count, close/reset and focus return remain.
3. До production-кода добавить feature component/conformance tests для всех
   standard surfaces из inventory, которые закрепляют shared component/recipe
   use и отсутствие inline/raw/page-background overrides.
4. До production-кода расширить Playwright:
   - computed background, border, radius and shadow для каждой stable
     user-reachable standard surface из inventory, минимум Schedule, Clients,
     Audit, Finance и final Groups;
   - Attendance проверяется отдельно как context-surface exception с теми же
     semantic background, border and shadow tokens, но без standard filter
     class/semantics;
   - resolved computed values сравниваются с CSS custom properties активной
     theme profile, а не с hard-coded RGB;
   - focus indicator проверяется на реальных interactive controls каждой
     surface, а не на нефокусируемом wrapper;
   - одинаковый semantic paint contract внутри каждой theme profile;
   - geometry/state invariance между `default-green-v1` и
     `test-blue-coral-v1`;
   - representative loading/error/empty/populated and active-filter cases не
     меняют surface без полного Cartesian product всех routes/states/viewports.
5. Запустить tests и подтвердить expected failures на текущих wrapper/transparent
   overrides и неполном computed-style matrix.
6. Ввести один shared CSS surface class/recipe с ownership только
   background/border/radius/shadow и применить его внутри `EntityLocatorBar`,
   `FilterToolbar`/`CompactFilterPanel`; не создавать параллельный feature token
   и не переносить в recipe component-specific padding/layout.
7. Удалить conflicting route CSS и double surfaces:
   - schedule outer/inner background ownership;
   - clients custom transparent/page surface;
   - audit/finance duplicates;
   - attendance context документируется как operation-specific exception и
     получает те же semantic background, border and shadow paint tokens без
     filter drawer/reset semantics.
8. Сохранить drawer/popover structure, immediate/staged semantics конкретного
   экрана, query/filter state, reset scope и API calls.
9. Проверить merged final Groups из TASK-086 на shared recipe conformance, не
   меняя group search/filter/paging; Trainers намеренно не мигрировать до
   TASK-096, но shared locator default должен автоматически дать тот же surface.
10. Запустить focused tests, raw-color check, full unit/lint/build,
    inventory-wide surface conformance, representative state Playwright,
    alternate-theme and iPhone WebKit checks.

## Preferred implementation strategy
1. Inventory and computed-style red tests.
2. One shared semantic surface CSS recipe.
3. Remove feature overrides one route at a time.
4. Theme/state/compact-height regression closure.

## Files likely to change
- `docs/ui-concept/TASK-094-filter-surface-inventory.md`
- `frontend/src/features/shared/EntityLocatorBar.tsx`
- `frontend/src/features/shared/ux.tsx`
- `frontend/src/features/shared/ux.test.tsx`
- `frontend/src/features/schedule/GroupScheduleScreen.tsx`
- `frontend/src/features/clients/list/ClientsToolbar.tsx`
- `frontend/src/features/audit/AuditLogScreen.tsx`
- `frontend/src/features/finance/FinanceReportsScreen.tsx`
- `frontend/src/features/attendance/AttendanceContextControls.tsx`
- `frontend/src/features/groups/GroupManagement.tsx` after TASK-086 if needed
- `frontend/src/App.css`
- `frontend/e2e/responsive-main-screens.spec.ts`
- `frontend/e2e/group-schedule.spec.ts`
- `frontend/e2e/finance-reports.spec.ts`
- affected client/audit specs

## Constraints
- Mantine, Onest, existing semantic tokens and shared components only.
- No raw `white`, hex/rgba, direct palette or page-background override for a
  standard filter surface.
- Theme changes color values only, never geometry/hierarchy/meaning.
- No horizontal page scroll or desktop filter panel passed unchanged to mobile.
- Shared surface recipe не меняет ARIA roles, component layout or spacing.
- Active filters остаются отдельным sibling сразу под painted surface.
- Filter values, API queries, roles, permissions and access scope stay unchanged.

## Out of scope
- Create/refresh order and styling from TASK-093.
- Copy removal from TASK-095.
- Trainer search from TASK-096.
- Group search/filter/paging implementation from TASK-086.
- General page/table/card redesign.

## Required test coverage

### Unit/component tests
- Shared CSS surface class/recipe for locator and both filter components without
  ARIA-role changes.
- Every standard inventory call site composes the shared recipe without local
  paint override; Attendance asserts the documented context exception.
- Trigger count, active filters, reset scope, drawer actions and focus return.
- Active filters remain a sibling outside the painted standard surface.

### Integration tests
- Backend integration tests are not applicable because query/API contracts do
  not change.
- Component and Playwright tests cover shared component ↔ route state/drawer
  integration and are written before CSS/production changes.
- Initial failures must identify current style/ownership mismatches.

### UI/e2e tests
- Resolved computed styles against active CSS custom properties under both theme
  profiles for every stable user-reachable standard surface in inventory.
- At minimum Schedule, Clients, Audit, Finance and merged final Groups;
  Attendance has separate context-exception conformance.
- Representative loading, empty, error, populated and active-filter states,
  without requiring every state on every route and viewport.
- Focus indicator on actual interactive controls, not the surface wrapper.
- Required portrait, tablet/desktop and compact-height sizes; drawer focus,
  Escape/close/`Готово`, safe area and no overflow.

## Test plan
- [x] Shared/component surface tests red before implementation.
- [x] Computed-style/theme Playwright matrix red before implementation.
- [x] `cd frontend && npm run test:unit`
- [x] `cd frontend && npm run check:raw-colors`
- [x] `cd frontend && npm run test:e2e -- <affected-specs>`
- [x] `cd frontend && npm run test:e2e:iphone`
- [x] `cd frontend && npm run lint`
- [x] `cd frontend && npm run build`

## Regression barrier
A route inventory plus automated computed-style/theme matrix must fail on any
standard locator/filter area that returns to raw white, page background,
transparent feature override, a different border/shadow role, broken focus or
theme-dependent geometry. Every stable user-reachable standard surface from
inventory must have an automated conformance entry; a representative-only list
cannot silently omit another standard screen.

## Risks
- Removing only color without resolving double wrapper ownership can preserve
  inconsistent spacing/elevation.
- Broad CSS selectors can change unrelated forms or detail surfaces.
- An incomplete inventory can leave a custom route-level filter surface outside
  the shared contract despite passing representative tests.
- Screenshot-only tests could miss focus, reset or operational-state regressions.

## Stop conditions
Остановиться, если:
- TASK-086 is not merged into `origin/main` or its final Groups locator/filter
  contract is unavailable;
- a route requires a materially different filter workflow rather than a visual
  surface exception;
- behavior/API/filter semantics must change;
- shared tokens cannot express required contrast in both theme profiles;
- task worktree/branch is invalid.

## Ready for Codex execution
no — completed on 2026-07-30 in commit `691a550`.
