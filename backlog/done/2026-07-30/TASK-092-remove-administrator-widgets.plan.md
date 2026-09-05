# Implementation Plan: TASK-092 Удалить сводные виджеты из раздела администраторов

## Source task
/backlog/done/2026-07-30/TASK-092-remove-administrator-widgets.md

## Implementation branch
feature/TASK-092-remove-administrator-widgets

Branch rules:
- использовать `.agents/skills/task-worktree/SKILL.md` и отдельный worktree из
  актуального `origin/main`;
- подтвердить clean status и active branch до changes;
- не включать TASK-091 role-creation flow или изменения placement primary action;
- не удалять shared `MetricCard`, потому что у него есть другие consumers.

## Goal
Удалить только три сводных `MetricCard` из administrator settings panel и
связанный dead code, сохранив заголовок, описание, actions, list, forms,
permissions и operational states без иных workflow changes.

## Current understanding
- Widgets и два derived counts локализованы в
  `AdministratorsSettingsPanel.tsx`.
- `MetricCard` shared component используется другими screens и остаётся.
- Existing `SettingsScreen.test.tsx` covers administrator permissions/forms,
  но пока не закрепляет отсутствие registry metrics.
- Это локальная визуальная коррекция. `ui-designer` перед implementation
  подтверждает, что после удаления не требуется новый replacement content;
  full UX research is not needed.

## Execution steps
1. Create isolated worktree and run focused Settings tests as baseline.
2. Before production code update component tests:
   - assert the administrator panel contains no `.metric-card` and no orphaned
     metrics `SimpleGrid`; do not use a broad absence query for
     `Администраторы`, because the tab and section heading remain;
   - assert `PageSection` is the first visible panel block after removal, with
     no empty wrapper before it;
   - assert section heading/description, add/refresh actions and populated list
     remain;
   - retain loading/error/empty and permission-bound action cases without
     adding new recovery controls or changing their current behavior.
3. Before production code add/update Playwright integration assertion in the
   existing Settings/administrator flows:
   - in `administrator-role-flow.spec.ts`, cover `360 x 780`, `390 x 844`,
     `768 x 1024`, `1440 x 1200` and compact-height smoke at `912 x 420` and
     `956 x 440`;
   - in `iphone-target-devices.spec.ts`, cover target-device acceptance at
     `420 x 912` and `440 x 956` with the existing WebKit projects;
   - assert no metric grid or empty wrapper remains;
   - without scrolling after opening the tab, add/refresh and the first
     populated administrator row are in the viewport; actions retain the
     existing `SectionHeader -> state/list` order;
   - assert no horizontal overflow at `360`, `390`, `420` and `440` widths,
     with tablet/desktop smoke.
4. Run new tests and confirm expected failure because current metrics render.
5. Remove the panel-local `SimpleGrid` metrics block, `MetricCard` import,
   `activeCount` and `passwordRotationCount`.
6. Remove only layout wrappers/styles proven unused by this panel; keep shared
   components and administrator data loading/mutations untouched.
7. Run focused component/integration tests, full frontend unit suite, lint and
   build.

## Preferred implementation strategy
1. Red component and layout assertions.
2. Minimal local removal.
3. Dead-code cleanup.
4. Focused operational-state and responsive regression.

## Files likely to change
- `frontend/src/features/settings/AdministratorsSettingsPanel.tsx`
- `frontend/src/features/settings/SettingsScreen.test.tsx`
- `frontend/e2e/administrator-role-flow.spec.ts`
- `frontend/e2e/iphone-target-devices.spec.ts`
- `frontend/src/App.css` only if a now-unused panel-specific rule is discovered

## Constraints
- Do not change administrator loading, create/edit mutations, role options,
  permissions or audit semantics.
- Do not remove status badges from rows.
- Keep heading, description, add/refresh and all states.
- Preserve Mantine/Onest/shared patterns.

## Out of scope
- Administrator list/card/form redesign.
- Primary action relocation.
- Widgets on other screens.
- TASK-091 role creation behavior.

## Required test coverage

### Unit/component tests
- Administrator panel has no scoped `.metric-card`, metrics `SimpleGrid` or
  empty wrapper before `PageSection`.
- Header/actions/list and permission behavior unchanged.
- Loading/error/empty/populated states keep their existing rendering and
  behavior; TASK-092 adds no new recovery action.

### Integration tests
- Backend integration tests are not applicable because API/business contracts
  do not change.
- Existing Settings component integration and Playwright flow are updated before
  production removal and must initially fail on visible metrics.

### UI/e2e tests
- Administrator tab has no metric block or empty gap.
- Without initial scrolling, add/refresh and the first populated administrator
  row are in the viewport at `390 x 844`, `420 x 912` and `440 x 956`.
- No horizontal overflow at `360`, `390`, `420` or `440` widths.
- `768 x 1024`, `1440 x 1200`, `912 x 420` and `956 x 440` receive the stated
  tablet, desktop and compact-height smoke coverage.

## Test plan
- [x] Component absence/non-regression tests red before implementation.
- [x] Responsive Playwright assertion red before implementation.
- [x] `npm run test:unit`
- [x] `npm run test:e2e -- e2e/administrator-role-flow.spec.ts`
- [x] `npm run test:e2e:iphone`
- [x] `npm run lint`
- [x] `npm run build`

## Regression barrier
Focused Settings component tests must simultaneously assert metric absence and
the preserved administrator list/actions/states. A browser-level responsive
assertion protects against an empty wrapper or overflow after removal and
proves that the first administrator row is not pushed below the initial mobile
viewport.

## Risks
- Broad text queries can confuse the section heading `Администраторы` with the
  removed metric label; tests must scope structural selectors to the
  administrator panel. Shared `MetricCard` currently has no test id.
- Removing shared `MetricCard` or generic grid CSS would regress other settings.

## Stop conditions
Остановиться, если:
- removal requires changing administrator API/permissions/forms;
- a shared component/style appears unused only because consumers were not searched;
- UI handoff requests replacement widgets or action relocation outside source scope;
- task worktree/branch is invalid.

## Ready for Codex execution
no — completed on 2026-07-30 in commit `47f4a81`.
