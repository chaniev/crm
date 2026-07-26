# Implementation Plan: TASK-094 Унифицировать фон областей фильтров

## Source task
/backlog/implementation/TASK-094-filter-surface-consistency.md

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
Свести все standard route-level locator/filter areas к одной semantic surface
на mobile и desktop, сохранив filter behavior, operational states, focus и
geometry в обеих поддерживаемых theme profiles.

## Current understanding
- `FilterToolbar` и `CompactFilterPanel` уже используют
  `--crm-surface-card`, `--crm-border-muted`, `10px`, no shadow.
- Schedule, Clients, Audit и Finance добавляют feature wrappers/overrides;
  schedule имеет legacy transparent inner toolbar и alpha-card wrapper,
  clients имеет custom locator/drawer wrapper.
- `EntityLocatorBar` владеет controls geometry, но standard surface role не
  закреплён единым shared class/API.
- Attendance context controls являются route-level scope/date surface и должны
  быть либо приведены к тому же semantic role, либо явно исключены как
  screen-specific context control.
- Current alternate-theme matrix проверяет geometry, но не закрывает равенство
  semantic background/border/shadow всех filter surfaces.

## UX/UI contract
- Shared surface: `var(--crm-surface-card)`, `1px solid
  var(--crm-border-muted)`, radius `10px`, shadow `none`, existing semantic
  focus tokens.
- Mobile secondary filters закрыты по умолчанию; drawer содержит только fields,
  close/`Готово`/scoped reset, но не create или refresh.
- Active filters находятся под toolbar, доступны по одному для удаления и не
  меняют surface между loading/empty/error/populated states.
- Compact-height drawer использует dynamic viewport, один scroll body, safe-area
  footer и reachable close/action controls.

## Dependencies and execution order
1. TASK-090 — done, theme tokens/shared components уже выпущены.
2. TASK-084 — compact-height and touch foundation должна быть merged.
3. TASK-086 остаётся владельцем Groups; после его merge Groups проходит
   conformance verification, а не получает второй filter implementation.
4. TASK-094 создаёт semantic surface baseline.
5. TASK-093 затем использует этот baseline для action sweep.
6. TASK-096 использует итоговый locator surface на Trainers.

## Execution steps
1. Создать isolated worktree и committed inventory
   `docs/ui-concept/TASK-094-filter-surface-inventory.md`: Schedule, Clients,
   Audit, Finance, Attendance context, final Groups и каждый другой route-level
   locator/filter; для каждого указать component owner, current overrides,
   target shared role и обоснованные исключения.
2. До production-кода добавить shared component tests:
   - `EntityLocatorBar`, `FilterToolbar`, `CompactFilterPanel` получают один
     standard surface class/role;
   - mobile drawer не содержит create/refresh;
   - active filter semantics, trigger count, close/reset and focus return remain.
3. До production-кода добавить representative feature component tests, которые
   закрепляют shared component use и отсутствие inline/raw/page-background
   overrides у standard surfaces.
4. До production-кода расширить Playwright:
   - computed background, border, radius, shadow and focus ring для Schedule,
     Clients, Audit, Finance и final Groups;
   - одинаковая semantic role внутри каждой theme profile;
   - geometry/state invariance между `default-green-v1` и
     `test-blue-coral-v1`;
   - loading/error/empty/populated и active filters не меняют surface.
5. Запустить tests и подтвердить expected failures на текущих wrapper/transparent
   overrides и неполном computed-style matrix.
6. Ввести один shared surface class/recipe и применить его внутри
   `EntityLocatorBar`, `FilterToolbar`/`CompactFilterPanel`; не создавать
   параллельный feature token.
7. Удалить conflicting route CSS и double surfaces:
   - schedule outer/inner background ownership;
   - clients custom transparent/page surface;
   - audit/finance duplicates;
   - attendance context либо переводится на shared role, либо документируется
     как operation-specific exception с теми же semantic tokens.
8. Сохранить drawer/popover structure, immediate/staged semantics конкретного
   экрана, query/filter state, reset scope и API calls.
9. Проверить final Groups после TASK-086; Trainers намеренно не мигрировать до
   TASK-096, но shared locator default должен автоматически дать тот же surface.
10. Запустить focused tests, raw-color check, full unit/lint/build,
    representative Playwright, alternate-theme and iPhone WebKit checks.

## Preferred implementation strategy
1. Inventory and computed-style red tests.
2. One shared semantic surface role.
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
- Filter values, API queries, roles, permissions and access scope stay unchanged.

## Out of scope
- Create/refresh order and styling from TASK-093.
- Copy removal from TASK-095.
- Trainer search from TASK-096.
- Group search/filter/paging implementation from TASK-086.
- General page/table/card redesign.

## Required test coverage

### Unit/component tests
- Shared surface class/role for locator and both filter components.
- Trigger count, active filters, reset scope, drawer actions and focus return.
- Representative screens compose the shared pattern without local background.

### Integration tests
- Backend integration tests are not applicable because query/API contracts do
  not change.
- Component and Playwright tests cover shared component ↔ route state/drawer
  integration and are written before CSS/production changes.
- Initial failures must identify current style/ownership mismatches.

### UI/e2e tests
- Computed styles under both theme profiles.
- Schedule, Clients, Audit, Finance and final Groups.
- Loading, empty, error, populated and active-filter states.
- Required portrait, tablet/desktop and compact-height sizes; drawer focus,
  Escape/close/`Готово`, safe area and no overflow.

## Test plan
- [ ] Shared/component surface tests red before implementation.
- [ ] Computed-style/theme Playwright matrix red before implementation.
- [ ] `cd frontend && npm run test:unit`
- [ ] `cd frontend && npm run check:raw-colors`
- [ ] `cd frontend && npm run test:e2e -- <affected-specs>`
- [ ] `cd frontend && npm run test:e2e:iphone`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`

## Regression barrier
A route inventory plus automated computed-style/theme matrix must fail on any
standard locator/filter area that returns to raw white, page background,
transparent feature override, a different border/shadow role, broken focus or
theme-dependent geometry.

## Risks
- Removing only color without resolving double wrapper ownership can preserve
  inconsistent spacing/elevation.
- Broad CSS selectors can change unrelated forms or detail surfaces.
- TASK-086 may replace current Groups markup while this work is in progress.
- Screenshot-only tests could miss focus, reset or operational-state regressions.

## Stop conditions
Остановиться, если:
- TASK-084 compact-height foundation or final TASK-086 Groups contract is
  unavailable for required acceptance;
- a route requires a materially different filter workflow rather than a visual
  surface exception;
- behavior/API/filter semantics must change;
- shared tokens cannot express required contrast in both theme profiles;
- task worktree/branch is invalid.

## Ready for Codex execution
yes, after TASK-084 is merged; final Groups sign-off follows TASK-086 merge
