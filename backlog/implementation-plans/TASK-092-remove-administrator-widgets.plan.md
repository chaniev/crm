# Implementation Plan: TASK-092 Удалить сводные виджеты из раздела администраторов

## Source task
/backlog/implementation/TASK-092-remove-administrator-widgets.md

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
   - assert labels/values `Администраторы`, `Активные`, `Смена пароля` are not
     rendered as metric cards;
   - assert section heading/description, add/refresh actions and populated list
     remain;
   - retain loading/error/empty and permission-bound action cases.
3. Before production code add/update Playwright integration assertion in the
   existing Settings/administrator flow:
   - no metric grid;
   - actions precede list;
   - no empty spacer or horizontal overflow at `390 x 844`, `420 x 912`,
     `440 x 956`, with tablet/desktop smoke.
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
- affected administrator/settings Playwright spec
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
- Metrics absent.
- Header/actions/list and permission behavior unchanged.
- Loading/error/empty/populated states continue to render expected recovery.

### Integration tests
- Backend integration tests are not applicable because API/business contracts
  do not change.
- Existing Settings component integration and Playwright flow are updated before
  production removal and must initially fail on visible metrics.

### UI/e2e tests
- Administrator tab has no metric block or empty gap.
- Add/refresh and list remain reachable.
- No horizontal overflow at required mobile widths; tablet/desktop smoke.

## Test plan
- [ ] Component absence/non-regression tests red before implementation.
- [ ] Responsive Playwright assertion red before implementation.
- [ ] `npm run test:unit`
- [ ] affected Settings Playwright spec
- [ ] `npm run lint`
- [ ] `npm run build`

## Regression barrier
Focused Settings component tests must simultaneously assert metric absence and
the preserved administrator list/actions/states. A browser-level responsive
assertion protects against an empty wrapper or overflow after removal.

## Risks
- Broad text queries can confuse the section heading `Администраторы` with the
  removed metric label; tests must target metric structure/test ids.
- Removing shared `MetricCard` or generic grid CSS would regress other settings.

## Stop conditions
Остановиться, если:
- removal requires changing administrator API/permissions/forms;
- a shared component/style appears unused only because consumers were not searched;
- UI handoff requests replacement widgets or action relocation outside source scope;
- task worktree/branch is invalid.

## Ready for Codex execution
yes
