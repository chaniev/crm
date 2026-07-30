# Implementation Plan: TASK-101 Удалить оставшиеся неоперационные metric-виджеты

## Source task
/backlog/implementation/TASK-101-remove-residual-metric-widgets-settings-group-edit.md

## Implementation branch
fix/TASK-101-remove-residual-metric-widgets-settings-group-edit

Branch rules:
- перед кодом использовать `.agents/skills/task-worktree/SKILL.md` и отдельный
  worktree от актуального `origin/main`;
- подтвердить clean status, active branch и merged TASK-086/TASK-092 baseline;
- не включать TASK-097 footer-action cleanup, group registry redesign или
  branch/group domain changes;
- удалять shared `MetricCard` только если repository-wide search после
  dependencies подтверждает zero consumers.

## Goal
На `Филиалы и залы` первым рабочим content становится список/state, а на edit
группы — форма; шесть aggregate metric cards, их dead calculations и empty
wrappers исчезают на всех ширинах.

## Current understanding
- `BranchSettingsScreen` всегда рендерит top `SimpleGrid` с `Филиалы`,
  `Активные филиалы`, `Активные залы`, включая loading/error/empty phases.
- `activeBranchCount` и `activeHallCount` существуют только ради этих cards.
- `GroupEditScreen` после загрузки рендерит top `SimpleGrid` с `Клиенты`,
  `Тренеры`, `Назначено` перед form.
- Group edit `clientCount` state/setter используется только первой metric.
  `trainerOptions` и `form.values.trainerIds` нужны форме и не удаляются.
- `GROUPS_GRID_COLUMNS` также используется внутри operational group form hint
  block и не является автоматически dead после metric removal.
- TASK-092 удаляет administrator `MetricCard`, TASK-086 удаляет
  `GroupsSummaryBar`. После их merge TASK-101 должна повторить consumer search:
  если BranchSettings/GroupEdit были последними, shared `MetricCard` можно
  удалить как dead code; иначе он сохраняется.
- Branch row/details counts (`Залов`, `Групп`, `Клиентов`) и group-client
  section `Всего` относятся к выбранной сущности и остаются.

## UX/UI contract
- Embedded Branch Settings: section header/actions → operational state/list;
  standalone variant: PageLayout header/actions → operational state/list.
- Group edit: header return → loading/error либо form; top aggregate cards не
  появляются.
- Desktop не возвращает удалённые widgets ради свободного места.
- Loading, error/retry, empty/create, branch selection/details, modals and
  permission-restricted Settings tabs сохраняются.
- Group form, save, validation, substitutions и client list сохраняются.
- Decision-changing counts в конкретной branch row/details/group-clients
  section остаются; replacement summary widgets не создаются.
- После удаления нет empty grid, top spacer, horizontal scroll или
  недостижимого primary action.

## Dependencies and execution order
1. TASK-086 — done; group registry summary ownership закрыт и final
   `GroupManagement.tsx` baseline известен.
2. TASK-092 должна быть merged, чтобы administrator metrics и final
   `MetricCard` consumer set были известны.
3. Выполнить TASK-101 и repository-wide consumer cleanup.
4. TASK-097 выполнять после TASK-101, потому что обе задачи меняют
   `GroupManagement.tsx`; TASK-101 владеет metrics/state/imports, TASK-097 —
   footer actions.

## Execution steps
1. Создать isolated worktree, подтвердить merged TASK-086/TASK-092 и выполнить
   `rg` inventory всех `MetricCard`/`GroupsSummaryBar` consumers.
2. До production-кода добавить targeted `BranchSettingsScreen` component tests:
   - три metric labels/values отсутствуют как top metrics;
   - header, add/refresh, loading, error/retry, empty/create and populated
     branch/hall operations сохраняются;
   - branch-specific counts в row/details не удалены.
3. До production-кода расширить `GroupManagement` edit tests:
   - `Клиенты`, `Тренеры`, `Назначено` отсутствуют как top metric cards;
   - form fields, save, validation, substitutions and group-client state
     сохраняются;
   - loading/error state не получает fake zero metrics.
4. До production-кода добавить Playwright primary paths:
   - Settings → `Филиалы и залы`: first operational viewport starts at
     actions/state/list, create/edit modal remains usable;
   - group edit: form begins immediately after state resolution, save and one
     recovery path work;
   - no metric grid/empty spacer at required portrait/landscape/tablet/desktop.
5. Запустить new tests и подтвердить expected failures на шести current
   `MetricCard` и их top geometry.
6. Удалить BranchSettings top `SimpleGrid`, `activeBranchCount`,
   `activeHallCount` и только ставшие неиспользуемыми imports.
7. Удалить GroupEdit top `SimpleGrid`, `clientCount` state/setter и
   `MetricCard` import; сохранить `GROUPS_GRID_COLUMNS`, если merged form hint
   продолжает его использовать.
8. Повторить repository-wide `MetricCard` search:
   - при наличии consumers сохранить shared component/export/styles;
   - при zero consumers удалить `MetricCardProps`, component/export и его
     dedicated tests/styles, не затрагивая `BranchStat`, `HintStat` и другие
     operational surfaces.
9. Удалить только пустые layout wrappers/rules, доказанно принадлежавшие
   removed metrics.
10. Обновить old positive assertions/fixtures на absence + preserved
    operations, не используя broad text queries, которые совпадают с
    branch-specific counts или form labels.
11. Запустить focused component/e2e tests, full frontend
    unit/raw-color/lint/build, responsive and target iPhone WebKit checks.

## Preferred implementation strategy
1. Final consumer inventory after dependencies.
2. Red screen-level absence/non-regression tests.
3. BranchSettings minimal removal.
4. GroupEdit minimal removal.
5. Conditional shared dead-code cleanup and responsive closure.

## Files likely to change
- `frontend/src/features/settings/BranchSettingsScreen.tsx`
- new `frontend/src/features/settings/BranchSettingsScreen.test.tsx` or the
  final focused settings test owner discovered after TASK-092
- `frontend/src/features/groups/GroupManagement.tsx`
- `frontend/src/features/groups/GroupManagement.test.tsx`
- `frontend/src/features/shared/ux.tsx` only if `MetricCard` has zero consumers
- `frontend/src/features/shared/ux.test.tsx` only for matching dead shared tests
- `frontend/src/App.css` only for proven metric-specific empty rules
- `frontend/e2e/stage12.spec.ts`
- affected group/settings responsive Playwright specs
- `frontend/e2e/iphone-target-devices.spec.ts`, if it owns final target-device
  coverage

## Constraints
- Удаляются только aggregate metric widgets и их dead code.
- Branch/group CRUD, assignments, substitutions, permissions and API contracts
  stay unchanged.
- Operational/recovery/form/validation surfaces remain.
- Entity-local counts may remain where they directly support a decision.
- Do not delete shared `MetricCard` while any consumer remains.
- Do not combine TASK-097 action changes in this branch.

## Out of scope
- TASK-086 group registry search/filter/paging.
- TASK-092 administrator widgets.
- Group edit footer return cleanup from TASK-097.
- Branch/group form or CRUD redesign.
- Backend contracts, permissions and audit.

## Required test coverage

### Unit/component tests
- BranchSettings metrics absent while actions/list/loading/error/empty/populated
  states remain.
- GroupEdit metrics absent while form/save/validation/substitutions/clients
  remain.
- Entity-local branch/group counts preserved where explicitly retained.
- Zero-consumer shared `MetricCard` deletion, if applicable, leaves no broken
  exports/imports.

### Integration tests
- BranchSettings mocked API component integration covers load→error/retry and
  populated operational actions.
- GroupEdit mocked API integration covers load→edit→save and failure state.
- Backend integration tests неприменимы: API/domain behavior does not change.
- Component/integration tests are written before production code and must fail
  on current metric rendering.

### UI/e2e tests
- Branch settings and group edit primary operations plus one recovery path.
- Absence of six metrics and empty top wrappers at `360 x 780`, `390 x 844`,
  `420 x 912`, `440 x 956`, `912 x 420`, `956 x 440`, `768 x 1024` and
  `1440 x 1200`.
- No page overflow/clipping; create/save actions stay `44 x 44px` and reachable.

## Expected initial failure verification
- Branch tests must find the three current top metric cards.
- Group edit tests must find `Клиенты`, `Тренеры`, `Назначено` in the metric
  structure; queries must be scoped so form labels/entity sections do not cause
  false positives.
- Browser geometry test must show the current metric block before the first
  operation, not fail due to missing API fixtures.

## Test plan
- [ ] Написать BranchSettings/GroupEdit component tests до production-кода.
- [ ] Добавить responsive Playwright absence/first-viewport checks до кода.
- [ ] Подтвердить expected red state на шести widgets.
- [ ] `cd frontend && npm run test:unit`
- [ ] `cd frontend && npm run check:raw-colors`
- [ ] `cd frontend && npm run test:e2e -- <settings/group affected specs>`
- [ ] `cd frontend && npm run test:e2e:iphone`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`

## Regression barrier
Два focused component suites должны одновременно запрещать top metric blocks и
требовать actions, operational states, form/save и entity-local decision data.
Repository-wide zero-consumer check защищает shared cleanup, а responsive
Playwright доказывает, что mobile/desktop первый viewport не содержит widgets,
пустого gap или потерянной primary action.

## Risks
- Broad text assertions `Клиенты`/`Тренеры` совпадут с form labels и
  entity-local sections.
- `clientCount` можно ошибочно удалить из registry row, где он остаётся нужен.
- `GROUPS_GRID_COLUMNS` останется consumer form hint даже после top grid removal.
- Shared `MetricCard` consumer set будет неверным, если TASK-092 не merged.
- TASK-097 может конфликтовать с тем же `GroupManagement.tsx`.

## Stop conditions
Остановиться, если:
- TASK-086/TASK-092 merged baseline не подтверждён;
- конкретный count доказанно меняет решение, но его safe local placement не
  определено в task contract;
- removal требует менять API, permissions, CRUD or form semantics;
- shared component ownership/consumers неясны;
- task worktree/branch невалиден.

## Ready for Codex execution
yes, after TASK-092 is merged into origin/main; TASK-086 is done
