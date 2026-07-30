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
группы — форма; шесть aggregate `MetricCard`, три дублирующих detail
`BranchStat`, их dead calculations/components и empty wrappers исчезают на всех
ширинах.

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
- Branch row уже показывает `Залов`, `Групп`, `Клиентов`. Detail
  `BranchStat` повторяет те же значения отдельной сеткой, не поддерживает
  дополнительное решение и удаляется вместе с local props/component.
- Branch row counts и group-client section `Всего` остаются как локальные
  данные соответствующей строки/секции.

## UX/UI contract
- Embedded Branch Settings: section header/actions → operational state/list;
  standalone variant: PageLayout header/actions → operational state/list.
- Group edit: header return → loading/error либо form; top aggregate cards не
  появляются.
- Desktop не возвращает удалённые widgets ради свободного места.
- Loading, error/retry, empty/create, branch selection/details, modals and
  permission-restricted Settings tabs сохраняются.
- Group form, save, validation, substitutions и client list сохраняются.
- Group load-error не получает новый retry control: доступным recovery остаётся
  `К списку групп`. Проверяемый save recovery: первый submit получает server
  error, введённые значения остаются в form, повторный submit успешен.
- Branch row counts и group-client section `Всего` остаются; дублирующая
  `BranchStat` grid в details удаляется, replacement summary widgets не
  создаются.
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
   - три `MetricCard` labels/values отсутствуют как top metrics;
   - три detail `BranchStat` отсутствуют, а те же branch-specific counts
     сохраняются в branch row;
   - header, add/refresh, loading, error/retry, empty/create and populated
     branch/hall operations сохраняются;
   - embedded variant получает основное coverage; standalone variant сохраняет
     PageLayout header/actions и проверяется отдельным component case без
     искусственного production route.
3. До production-кода расширить `GroupManagement` edit tests:
   - `Клиенты`, `Тренеры`, `Назначено` отсутствуют как top metric cards;
   - form fields, save, validation, substitutions and group-client state
     сохраняются;
   - loading/error state не получает fake zero metrics, а load-error сохраняет
     рабочую кнопку `К списку групп`;
   - failed save сохраняет введённые values/error feedback и допускает
     успешный повторный submit.
4. До production-кода добавить Playwright primary paths:
   - Settings → `Филиалы и залы`: first operational viewport starts at
     actions/state/list, detail `BranchStat` отсутствует, create/edit modal
     remains usable;
   - group edit: form begins immediately after state resolution; first save
     fails without clearing form values, second save succeeds;
   - no metric/stat grid or empty spacer at required
     portrait/landscape/tablet/desktop.
5. Запустить new tests и подтвердить expected failures на шести current
   `MetricCard`, трёх current detail `BranchStat` и top geometry.
6. Удалить BranchSettings top `SimpleGrid`, `activeBranchCount`,
   `activeHallCount`, detail `BranchStat` grid, local `BranchStatProps`/
   `BranchStat` и только ставшие неиспользуемыми imports.
7. Удалить GroupEdit top `SimpleGrid`, `clientCount` state/setter и
   `MetricCard` import; сохранить `GROUPS_GRID_COLUMNS`, если merged form hint
   продолжает его использовать.
8. Повторить repository-wide `MetricCard` search:
   - при наличии consumers сохранить shared component/export/styles;
   - при zero consumers удалить `MetricCardProps`, component/export и его
     dedicated tests/styles, не затрагивая `HintStat` и другие operational
     surfaces.
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
- `frontend/e2e/groups-registry.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`
- `frontend/e2e/iphone-target-devices.spec.ts`, if it owns final target-device
  coverage

## Constraints
- Удаляются только aggregate metric widgets и их dead code.
- Удаляется дублирующая detail `BranchStat` grid; branch row counts и
  group-client `Всего` остаются.
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
- BranchSettings top metrics и detail `BranchStat` absent while branch row
  counts, actions/list/loading/error/empty/populated states remain.
- GroupEdit metrics absent while form/save/validation/substitutions/clients
  remain.
- Group load-error keeps return navigation; failed save preserves form values
  and supports successful resubmit.
- Branch row counts and group-client `Всего` preserved where explicitly
  retained.
- Zero-consumer shared `MetricCard` deletion, if applicable, leaves no broken
  exports/imports.

### Integration tests
- BranchSettings mocked API component integration covers load→error/retry and
  populated operational actions.
- GroupEdit mocked API integration covers load-error→back and
  load→edit→failed save→successful resubmit.
- Backend integration tests неприменимы: API/domain behavior does not change.
- Component/integration tests are written before production code and must fail
  on current metric rendering.

### UI/e2e tests
- Branch settings primary operation and error/retry; group edit save and failed
  save→successful resubmit.
- Absence of six top metrics, three detail `BranchStat` and empty wrappers at
  `360 x 780`, `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420`,
  `956 x 440`, `768 x 1024` and `1440 x 1200`.
- No page overflow/clipping; every affected create/save/back/retry action has
  a touch target of at least `44 x 44px` where touch acceptance applies and
  remains reachable.

### Measurable layout assertions
- Embedded Branch Settings DOM order is `SectionHeader` →
  loading/error/empty/list `PageSection`; no metric/stat grid, empty element or
  spacer node exists between them.
- Standalone Branch Settings keeps `PageLayout` title/actions and the same
  operational-state order; it receives component coverage only because no
  production route currently consumes this variant.
- The applicable first Branch operational surface (loading/error/empty or first
  populated row) and, after successful Group load, the first labeled form
  control start inside the initial viewport without programmatic or user
  scrolling.
- Group form/save remains vertically reachable by normal page scroll without
  nested scrolling traps; the plan does not require the bottom save button to
  be above the fold.
- At `360`, `390`, `420` and `440px`, document/body scroll width is no more than
  viewport width + `1px`; there is no clipping of affected operations.
- Chromium viewport resizing proves responsive geometry. Only the configured
  WebKit device projects at `420 x 912` and `440 x 956` count as target-iPhone
  acceptance.

### Test ownership
- `BranchSettingsScreen.test.tsx`: embedded states/operations, standalone
  contract, absence of top metrics/detail `BranchStat`, preservation of row
  counts.
- `GroupManagement.test.tsx`: metric absence, load-error/back, form values,
  validation, failed save→successful resubmit, substitutions and clients.
- `stage12.spec.ts`: existing Settings branch CRUD/error-retry path plus
  absence of Branch metrics/detail stats; do not duplicate the viewport matrix
  here.
- `groups-registry.spec.ts`: group edit navigation/save/recovery path; do not
  duplicate the viewport matrix here.
- `responsive-main-screens.spec.ts`: Chromium geometry for `360 x 780`,
  `390 x 844`, `912 x 420`, `956 x 440`, `768 x 1024` and `1440 x 1200`.
- `iphone-target-devices.spec.ts`: only WebKit target-device assertions at
  `420 x 912` and `440 x 956`.
- Permission contracts are unchanged: rerun existing Settings/group access
  component and e2e coverage; do not add duplicate TASK-101 permission cases.

## Expected initial failure verification
- Branch tests must find the three current top metric cards and three current
  detail `BranchStat`.
- Group edit tests must find `Клиенты`, `Тренеры`, `Назначено` in the metric
  structure; queries must be scoped so form labels/entity sections do not cause
  false positives.
- Browser geometry test must show the current metric block before the first
  operation, not fail due to missing API fixtures.

## Test plan
- [ ] Написать BranchSettings/GroupEdit component tests до production-кода.
- [ ] Добавить responsive Playwright absence/first-viewport checks до кода.
- [ ] Подтвердить expected red state на девяти widgets.
- [ ] `cd frontend && npm run test:unit`
- [ ] `cd frontend && npm run check:raw-colors`
- [ ] `cd frontend && npm run test:e2e -- <settings/group affected specs>`
- [ ] `cd frontend && npm run test:e2e:iphone`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`

## Regression barrier
Два focused component suites должны одновременно запрещать top metric blocks и
detail `BranchStat`, требовать actions, operational states, form/save recovery,
branch row counts и group-client section data.
Repository-wide zero-consumer check защищает shared cleanup, а responsive
Playwright доказывает, что mobile/desktop первый viewport не содержит widgets,
пустого gap или потерянной primary action.

## Risks
- Broad text assertions `Клиенты`/`Тренеры` совпадут с form labels и
  entity-local sections.
- Branch row и removed detail `BranchStat` используют одинаковые labels/values;
  absence assertion должна быть scoped к detail stat structure, а preservation
  assertion — к конкретной branch row.
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
