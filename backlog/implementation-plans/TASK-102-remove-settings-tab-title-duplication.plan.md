# Implementation Plan: TASK-102 Убрать дублирование названий вкладок в «Настройках»

## Source task
/backlog/implementation/TASK-102-remove-settings-tab-title-duplication.md

## Implementation branch
fix/TASK-102-remove-settings-tab-title-duplication

Branch rules:
- перед изменением project code использовать
  `.agents/skills/task-worktree/SKILL.md` и создать или безопасно возобновить
  отдельный worktree `../crm-worktrees/TASK-102-remove-settings-tab-title-duplication`;
- создать branch непосредственно от актуального `origin/main`, подтвердить
  зарегистрированный worktree, active branch, clean status и
  `git merge-base --is-ancestor origin/main HEAD`;
- primary repository оставить на `main`; код менять только в task worktree;
- повторно проверить, что merged baseline содержит TASK-093, TASK-095,
  TASK-100 и TASK-101 и что параллельная задача не владеет теми же settings
  call sites;
- не включать другие settings cleanup, CRUD, permission или shared design
  system changes.

## Goal
После выбора любой доступной вкладки «Настроек» пользователь сразу видит
operational toolbar, контекст и состояние/список без повторного видимого
названия вкладки; tab panel при этом сохраняет доступное имя, а standalone
`BranchSettingsScreen` — route-level заголовок.

## Current understanding
- `SettingsScreen` уже скрывает собственный route header и использует Mantine
  `Tabs`/`PageTabsPanel`; активная вкладка остаётся видимым владельцем названия
  embedded-панели.
- `MembershipCatalogSettings`, `GroupTypesSettingsPanel` и
  `AdministratorsSettingsPanel` начинают первый `PageSection` с
  `SectionHeader`, в котором находятся повторный title, общая description и
  `TaskToolbarActions`.
- Embedded `BranchSettingsScreen` выделяет отдельный `PageSection` только для
  `SectionHeader`; следующий `PageSection` уже содержит operational states и
  список. Standalone-ветка использует тот же `headerActions` через
  `PageLayout` и должна сохранить title `Филиалы и залы`.
- Текущие descriptions (`Названия, цены...`, `Справочник используется...`,
  `Администраторы управляют...`) не меняют решение, не объясняют validation,
  prerequisite или recovery. Пользователь отдельно подтвердил, что overview
  про возможности администратора, включая отсутствие доступа к созданию
  тренеров, также удаляется без переноса в форму или новую copy. Все три
  descriptions удаляются вместе с embedded `SectionHeader`.
- `TaskToolbarActions` уже является shared non-wrapping cluster с порядком
  frequent action → primary action, minimum `44 x 44px` targets и прежними
  accessible names. Новый toolbar component или CSS contract не требуется.
- Mantine `Tabs.Panel` должен получать accessible name через связанную вкладку.
  Это нужно закрепить role/name assertion для каждой разрешённой панели; новый
  видимый heading для этого не добавляется.
- Existing component tests сейчас положительно ожидают embedded headings у
  `Администраторы` и `Филиалы и залы`, а Playwright — у каталога и филиалов.
  Эти obsolete assertions дают конкретный red baseline.
- Backend/API, permissions, CRUD, async state и routing contracts не меняются.

## UX/UI contract
- Пользователи: все пользователи, которым существующие backend capabilities
  уже открывают соответствующие settings-вкладки. План не вводит собственную
  frontend role matrix; restricted пользователь не получает новых вкладок или
  controls.
- Контекст: mobile-first operational settings на `390 x 844`, затем target
  iPhone `420 x 912` и `440 x 956`, compact-height `912 x 420` и `956 x 440`,
  tablet `768 x 1024` и desktop `1440 x 1200`; `360 x 780` остаётся narrow
  guardrail.
- Primary path: открыть `/settings` → выбрать разрешённую вкладку → сразу
  увидеть toolbar и branch context либо loading/error/empty/list state →
  выполнить прежнюю операцию.
- Completion signal: у active tab сохраняются label и selected state; внутри
  named `tabpanel` отсутствует повторный standalone heading и его decorative
  description; toolbar/action/state доступны без пустого header block.
- Primary actions: `Добавить абонемент`, `Добавить тип`, `Добавить филиал`,
  `Добавить администратора` — видимы там, где их разрешает backend response.
- Frequent action: `Обновить` — остаётся видимым и предшествует primary action
  в DOM/focus order. Когда create запрещён, refresh остаётся единственным
  toolbar action без пустого placeholder.
- Secondary/exceptional actions: edit/delete/archive, modal actions и attendance
  scope остаются в текущих rows/details/modal surfaces и не перемещаются.
- Content order для embedded panels: tabs → один panel content container →
  operational toolbar → branch selector/fixed branch context при наличии →
  action error/loading/error/empty/populated state. Для standalone branches:
  `PageLayout` title/actions → operational state/list.
- Loading, empty, error/retry, disabled, success, permission-restricted и
  recovery headings сохраняются: запрет относится только к embedded collection
  title, а не к информативным state/modal/form headings.
- Focus/keyboard: Mantine tab navigation, `aria-selected`, связь tab ↔ panel,
  visible focus и существующий toolbar/modal focus order не меняются.
- Toolbar не фиксированный и не sticky; safe-area или software-keyboard logic
  не добавляется. Модальные формы должны остаться достижимыми при существующем
  mobile behavior.
- На любой ширине не возвращать удалённые headings/descriptions, не создавать
  action-only вторую строку, пустой wrapper, clipping или horizontal page
  scroll.

## Execution roles
1. `ui-designer` подтверждает локальный handoff: title/description удаляются,
   shared toolbar становится первым operational row, replacement copy не нужна.
2. `test-automator` добавляет component/Playwright red regressions до
   production-кода.
3. `react-specialist` выполняет минимальную React/Mantine коррекцию по
   зафиксированному контракту.
4. Координирующий агент проверяет результат против UX contract и acceptance
   matrix.

## Execution steps
1. Создать/проверить isolated task worktree и branch по правилам выше. Docker
   Compose не запускать по умолчанию: изменение покрывается static, component и
   mocked Playwright checks.
2. До production-кода обновить `SettingsScreen` component integration tests
   table-driven matrix для `Абонементы`, `Типы групп`, `Филиалы и залы`,
   `Администраторы`:
   - active `tabpanel` имеет accessible name соответствующей вкладки и связан с
     ней через Mantine tab semantics;
   - embedded duplicate heading и текущая decorative description отсутствуют;
   - tab label/selected state, permission visibility, refresh, разрешённый
     create action и representative loading/empty/populated state сохранены;
   - administrator case без create capability сохраняет refresh и не создаёт
     пустой action slot.
3. До production-кода обновить focused child component tests:
   - `MembershipCatalogSettings.test.tsx`: нет heading `Каталог абонементов` и
     intro description, но branch selector/fixed context, add/refresh и
     loading/error/empty/list сохраняются;
   - `BranchSettingsScreen.test.tsx`: embedded variant не содержит heading,
     отдельного header-only `PageSection` или empty spacer; toolbar находится в
     том же operational section перед state/list; это единственный component
     case, где structural assertion на число/порядок `PageSection` оправдан
     конкретным regression risk; standalone variant сохраняет видимый
     level-one heading и прежние actions;
   - не создавать искусственные pure unit tests для отсутствующей локальной
     логики.
4. До production-кода добавить focused table-driven browser regression на
   mobile stress baseline `390 x 844` для всех четырёх доступных settings tabs,
   предпочтительно отдельный
   `frontend/e2e/settings-tab-title-duplication.spec.ts`:
   - negative role/text assertions на повторные headings и descriptions;
   - named `tabpanel`, active tab и toolbar accessible names;
   - `Обновить`/`Добавить…` видимы, имеют target не меньше `44 x 44px` и
     сохраняют рабочие операции;
   - первый operational control/state/list доступен сразу после toolbar без
     видимого empty reserved block; не закреплять `.section-header` как общий
     browser-level API;
   - keyboard Arrow navigation между разрешёнными tabs и последовательный
     focus toolbar controls сохраняются;
   - нет horizontal page scroll, clipping или недостижимых primary/frequent
     actions на `390 x 844`.
5. До production-кода обновить obsolete positive heading assertions в
   `membership-catalog-settings.spec.ts`, `responsive-main-screens.spec.ts` и
   `stage12.spec.ts` на duplicate-absence + preserved-operation assertions.
   Переиспользовать существующую branch responsive matrix на `360 x 780`,
   `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420`, `956 x 440`,
   `768 x 1024`, `1440 x 1200`: заменить obsolete heading expectation на
   отсутствие embedded title при сохранённых actions, first row/state и no
   overflow. В существующих catalog и branch cases
   `iphone-target-devices.spec.ts` для обоих WebKit projects добавить только
   focused title-absence/named-panel assertions. Не прогонять четыре вкладки на
   каждом viewport и не дублировать CRUD flows.
6. Запустить новые component и Playwright tests на неизменённом production-коде
   и сохранить expected red evidence: current four `SectionHeader` headings,
   три decorative descriptions и branch header-only section нарушают новые
   assertions. Падение по API mock или unrelated selector не считается
   корректным red state.
7. В `MembershipCatalogSettings`, `GroupTypesSettingsPanel` и
   `AdministratorsSettingsPanel` заменить embedded `SectionHeader` на тот же
   `TaskToolbarActions` как первый child существующего operational `Stack`;
   удалить только теперь неиспользуемые `SectionHeader` imports и не переносить
   title/description в новую copy.
8. В embedded `BranchSettingsScreen` удалить отдельный header-only
   `PageSection` и поместить `headerActions` первым child существующего
   operational `Stack`. В standalone mode не дублировать actions в content:
   сохранить `PageLayout title="Филиалы и залы" actions={headerActions}`.
9. Если role/name tests подтверждают штатную Mantine связь, не менять
   `SettingsScreen`/`PageTabsPanel` semantics. Если accessible name теряется,
   добавить только локальную `aria-labelledby`/id связь tab → panel без
   видимого текста и без изменения shared tabs API сверх необходимого.
10. Повторно запустить focused component/browser tests, полный `test:unit`,
    affected Playwright specs, lint/build и target iPhone WebKit. Полный
    Playwright suite для этой локальной коррекции не требуется. Выполнить
    source search, подтверждающий, что четыре embedded titles/descriptions не
    остались, standalone title и operational state headings сохранены.

## Preferred implementation strategy
1. Accessibility/absence component tests in red state.
2. Focused four-tab Playwright regression на `390 x 844` в red state.
3. Minimal `SectionHeader` removal with shared toolbar reuse.
4. Standalone branch regression and dead-import cleanup.
5. Full unit/static validation и focused responsive/target-device regression
   closure.

## Files likely to change
- `frontend/src/features/settings/SettingsScreen.tsx`
- `frontend/src/features/settings/MembershipCatalogSettings.tsx`
- `frontend/src/features/settings/BranchSettingsScreen.tsx`
- `frontend/src/features/settings/AdministratorsSettingsPanel.tsx`
- `frontend/src/features/settings/SettingsScreen.test.tsx`
- `frontend/src/features/settings/MembershipCatalogSettings.test.tsx`
- `frontend/src/features/settings/BranchSettingsScreen.test.tsx`
- `frontend/e2e/settings-tab-title-duplication.spec.ts` (new, preferred)
- `frontend/e2e/membership-catalog-settings.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`
- `frontend/e2e/stage12.spec.ts`
- `frontend/e2e/iphone-target-devices.spec.ts`
- `frontend/src/App.css` only if a settings-specific orphaned spacing rule is
  proven by source search; no new layout token is expected

## Constraints
- Backend remains the only owner of permissions, roles, membership, branch and
  administrator semantics.
- Preserve Mantine, Onest, shared `PageSection`, `PageTabsPanel` and
  `TaskToolbarActions` patterns.
- Do not change tab order, labels, default tab, route, permission-based
  visibility or CRUD/API calls.
- Do not remove form, modal, loading, empty, error, permission, recovery or
  detail headings.
- Do not hide primary/frequent actions in overflow or reduce touch targets
  below `44 x 44px`.
- Do not add replacement title, subtitle, badge, hint-card, tooltip or
  decorative copy.
- Do not alter responsive row/card/form behavior beyond removal of the empty
  header block.

## Out of scope
- Settings navigation redesign, tab rename/reorder/removal or route redesign.
- Membership catalog, group type, branch/hall or administrator CRUD behavior.
- Roles, permissions, backend contracts, API mocks outside affected regression
  setup, database or bot changes.
- Shared toolbar/design-system refactor or cleanup of unrelated headings.
- Modal/form copy and operational/recovery state redesign.

## Required test coverage

### Unit tests
- Новая pure function/domain unit coverage не применяется: задача не меняет
  вычисления, reducer, mapping, validation или helper API. Не создавать
  synthetic helper только ради unit test.
- Vitest component tests ниже должны быть написаны/обновлены до production-кода
  и запускаются общей командой `test:unit`.

### Component/integration tests
- Four-tab `SettingsScreen` matrix: tab remains visible/selected, named panel
  remains accessible, duplicate title/description absent, actions and
  representative states preserved.
- Catalog branch selector/fixed branch context plus add/refresh and
  loading/error/empty/list regression.
- Embedded versus standalone `BranchSettingsScreen` contract, including one
  operational `PageSection` in embedded mode and retained standalone heading.
- Administrator response without create capability keeps refresh and has no
  empty primary-action slot.
- Backend integration tests are not applicable because API, permissions,
  persistence and business contracts do not change.

### UI/e2e tests
- All four authorized tabs under a capability-complete user на `390 x 844`.
- One restricted-role/deep-link regression remains green without exposing
  unauthorized tabs.
- Loading or empty state plus populated operational state are represented
  across the matrix; existing CRUD/error/recovery flows remain green.
- Keyboard tab navigation, active state, named panels, toolbar focus order and
  accessible action names.
- Existing branch responsive matrix подтверждает representative geometry на
  всех required portrait, compact-height, tablet и desktop viewports.
- Existing catalog и branch target portrait cases проходят в обоих WebKit
  projects с touch/iPhone profile и получают focused duplicate-absence/panel
  assertions; four-tab viewport cross-product не создаётся.
- No visible duplicate heading/description, header-only wrapper, horizontal
  page scroll, clipping or unreachable actions.

## Expected initial failure verification
- `SettingsScreen.test.tsx` fails negative assertions because current
  `SectionHeader` renders `Типы групп` and `Администраторы` plus descriptions.
- `MembershipCatalogSettings.test.tsx` and browser test fail because current
  catalog heading/description are visible.
- Embedded `BranchSettingsScreen.test.tsx` and responsive tests fail because
  current branch title is visible in a separate header-only `PageSection`.
- Standalone branch positive heading test remains green, demonstrating that the
  red state is scoped to embedded settings panels.

## Test plan
- [ ] До production-кода добавить/обновить component integration tests для
  четырёх вкладок.
- [ ] До production-кода добавить focused four-tab Playwright
  absence/accessibility regression на `390 x 844` и точечно обновить
  существующие responsive/iPhone geometry cases.
- [ ] Запустить focused tests и подтвердить expected red state только на
  существующих embedded `SectionHeader`/descriptions/wrapper.
- [ ] `cd frontend && npm run test:unit -- src/features/settings/SettingsScreen.test.tsx src/features/settings/MembershipCatalogSettings.test.tsx src/features/settings/BranchSettingsScreen.test.tsx`
- [ ] `cd frontend && npm run test:e2e -- settings-tab-title-duplication.spec.ts membership-catalog-settings.spec.ts responsive-main-screens.spec.ts stage12.spec.ts`
- [ ] `cd frontend && npm run test:unit`
- [ ] `cd frontend && npm run check:raw-colors`
- [ ] `cd frontend && npm run test:e2e:iphone`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] Отдельно отметить непроверенные physical Safari chrome, safe-area,
  software-keyboard и iOS Simulator checks; WebKit automation не выдавать за
  physical-device evidence.

## Regression barrier
Обязательная executable защита состоит из двух слоёв: table-driven Vitest
matrix одновременно запрещает четыре embedded headings/descriptions и
сохраняет tab/panel semantics, actions, capabilities и states; focused
Playwright regression повторяет four-tab контракт на `390 x 844`, а
существующие branch responsive и catalog/branch iPhone cases дают
representative geometry/no-overflow coverage на required widths и WebKit
profiles. CSS class absence не является общим browser contract; отдельный
embedded branch component test защищает удаление header-only `PageSection`, а
standalone branch test положительно ожидает route-level `Филиалы и залы`, чтобы
будущий broad cleanup не удалил необходимый заголовок.

## Risks
- Broad text queries могут спутать tab label или state heading с удаляемым
  embedded heading; assertions должны быть role- и panel-scoped.
- Без отдельного standalone case общий cleanup может удалить route-level title
  `BranchSettingsScreen`.
- Перенос `headerActions` в branch content может случайно продублировать actions
  в standalone mode или оставить два `PageSection`/лишний gap.
- Broad description cleanup может удалить field/state/recovery copy; удалять
  только три inventory-confirmed generic descriptions.
- Дублирование four-tab checks во всех viewport/spec combinations увеличит
  время и хрупкость regression suite без нового сигнала; four-tab semantics
  проверять один раз, geometry — в существующих representative matrices.
- Viewport-only Chromium не доказывает Safari chrome/safe-area behavior;
  automated target acceptance должна запускаться в существующих WebKit iPhone
  projects, а physical-device gaps — сообщаться явно.

## Stop conditions
Остановиться и не писать production-код, если:
- task worktree/branch невалиден, branch уже принадлежит другому worktree или
  baseline содержит необъяснённые изменения;
- Mantine tab ↔ panel accessible naming нельзя сохранить без shared tabs API
  redesign;
- удаление требует менять backend/API/permissions/CRUD semantics;
- найденный вне трёх product-approved descriptions heading или description
  несёт validation, security, prerequisite, decision-changing scope или
  recovery, а не только повторяет tab;
- scope расширяется до Settings redesign, shared toolbar refactor или других
  route headings;
- acceptance criteria невозможно выполнить без нового продуктового решения.

## Ready for Codex execution
yes
