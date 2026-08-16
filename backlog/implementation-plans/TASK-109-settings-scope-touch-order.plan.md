# Implementation Plan: TASK-109 Сделать Settings touch-safe и связать actions со scope

## Source task
/backlog/implementation/TASK-109-settings-scope-touch-order.md

## Implementation branch
fix/TASK-109-settings-scope-touch-order

Branch rules:
- до изменения project code прочитать `.agents/skills/task-worktree/SKILL.md` и создать либо безопасно возобновить отдельный worktree `../crm-worktrees/TASK-109-settings-scope-touch-order`;
- создать branch непосредственно от актуального `origin/main`; primary repository оставить на `main`, а код менять только в task worktree;
- до первой правки подтвердить registered worktree, active branch, отсутствие unexplained changes и `git merge-base --is-ancestor origin/main HEAD`;
- не включать другие backlog-задачи, backend/API/permission changes, общий redesign Settings forms или global toolbar refactor;
- Docker Compose по умолчанию не запускать: задача покрывается frontend component, mocked Playwright, responsive и target-iPhone WebKit тестами.

Planning evidence на 2026-08-16: primary repository находится на clean `main` `d0d65dc19411e8ed9c12c3ef0844910a09bea0ea`, совпадающем с локальным `origin/main`; branch/worktree TASK-109 не найдены. Executor обязан повторить проверку после `git fetch origin` и не считать planning snapshot execution base.

## Goal
Пользователь на Settings до create/edit однозначно видит активную вкладку и, для каталога абонементов, выбранный backend branch scope. Tabs, selector, refresh, create и row actions имеют touch target не меньше `44 x 44 CSS px`; visual, DOM и focus order совпадают с `active tab → branch scope → refresh → create → state/content → row edit`, не меняя catalog payload, branch rules или permissions.

## Current understanding
- `SettingsScreen` рендерит Mantine `Tabs` и только разрешённые панели. Видимость определяется существующими backend/session capabilities (`permissions`, `createRoleOptions`, `branchId`), а не должна выводиться из подписи вкладки или имени роли.
- На portrait tabs уже складываются в визуальную матрицу `2 x 2`, но audit evidence фиксирует высоту около `40px`; Settings-specific minimum/focus style сейчас не заданы.
- `MembershipCatalogSettings` рендерит `TaskToolbarActions` раньше `Select`/static `Paper` «Филиал каталога». Create POST уже берёт текущий `branchId`, поэтому defect находится в presentation/task order, а не в backend contract.
- Shared `TaskToolbarAction` и `Button` уже дают refresh/create и большинство text edit controls минимум `44px`. Mantine tabs, catalog `Select` и hall `ActionIcon` такой локальной гарантии не имеют.
- Shared toolbar уже держит frequent refresh перед primary create и сворачивает labels в icon-only `44 x 44px` на mobile/coarse compact height. Глобально переделывать его не нужно.
- Branch list и catalog items используют общий `loading/error`. Ошибка `getBranches` не завершает initial loading, а toolbar refresh повторяет только items `reloadKey`; branch-scope recovery фактически может быть недостижимым.
- Existing coverage: `SettingsScreen.test.tsx`, `MembershipCatalogSettings.test.tsx`, `BranchSettingsScreen.test.tsx`, `settings-tab-title-duplication.spec.ts`, `membership-catalog-settings.spec.ts`, `touch-target-inventory.spec.ts`, `responsive-main-screens.spec.ts`, `iphone-target-devices.spec.ts`.
- Задача medium risk, `Safe for Codex: yes`, frontend-only и имеет realistic automated regression barrier. Critical clarification questions отсутствуют.

## UX contract
- Пользователь: SuperAdministrator, HeadCoach или Administrator с backend-разрешённым Settings access. Frontend не пересчитывает scope или allowed actions по роли.
- Primary path: открыть Settings, выбрать разрешённую вкладку, в каталоге подтвердить/выбрать филиал, выполнить create либо row edit, сохранить и остаться в той же вкладке/branch scope.
- Completion signal: active tab остаётся selected, persistent branch label/value видимы, modal закрывается, saved item появляется в текущем scoped list либо existing success feedback подтверждает действие.
- Required decision data: selected tab для всех panels; persistent `Филиал каталога` и selected value до action cluster; selected branch до branch/hall contextual actions.
- Primary: create active panel и modal `Сохранить`. Frequent: refresh, branch selection, row edit. Secondary/exceptional: attendance-scope, cancel, archive/restore/delete; они не поднимаются в primary toolbar.
- Duplicate tab headings/descriptions, metric cards, new tabs/filters и unmapped controls не добавляются.

### Exact task and focus order
- Tablist сохраняет Mantine roving tabindex: selected tab — один Tab stop; Arrow keys перемещают focus/selection по разрешённым tabs; `Tab` выходит в active panel.
- Catalog: selected tab → selectable `Филиал каталога` → `Обновить` → `Добавить абонемент` → recovery/state/content → row `Редактировать {name}` → modal fields → cancel/save.
- Fixed-branch static scope не становится лишним Tab stop, но визуально предшествует actions и семантически описывает action group; focus идёт refresh → create.
- Group types: selected tab → refresh → create → state/list → edit/delete.
- Branches: selected tab → refresh → create branch → branch rows → selected branch edit/archive → create hall → hall edit/archive/delete.
- Administrators: selected tab → refresh → разрешённый create → state/list → attendance groups/edit. Если create запрещён backend options, refresh остаётся единственным toolbar action.

## UI specification

### Settings tablist
- Переиспользовать Mantine `Tabs`; добавить только Settings-local classes на Tabs/list, не менять shared tabs глобально.
- Все rendered tabs имеют `min-height: 44px`, normal wrapping, visible focus и минимум `8px` между соседними touch targets.
- На `360–440px` использовать non-scrolling grid из двух equal columns. На landscape/tablet/desktop tabs могут идти одной строкой, если помещаются; minimum и DOM order сохраняются.
- Сохранить `aria-selected`, `aria-controls`, `aria-labelledby` и current no-duplicate-heading contract. Unauthorized tabs отсутствуют, а не отображаются disabled.

### Catalog scoped toolbar
- Выбран один pattern: один non-wrapping scoped toolbar row на всех widths. DOM содержит scope cell первым и existing `TaskToolbarActions` вторым: `minmax(0, 1fr) | action cluster`.
- На `360–440px` action cluster содержит два icon-only `44 x 44px` controls с gap `8px`; scope использует оставшуюся ширину. На `768/1440` labels могут вернуться, но toolbar не переносится.
- Select сохраняет visible label `Филиал каталога`, input `min-height: 44px`, font `16px`, `min-width: 0`. Long selected value может visual ellipsis, но full name остаётся в value/options и stable accessible description.
- Fixed assigned branch использует compact static scope cell с тем же visible label/full accessible value; это часть toolbar, не standalone summary card.
- `TaskToolbarActions` получает semantic group label/scope description; button names остаются `Обновить` и `Добавить абонемент`.
- Не добавлять overflow menu, sticky/fixed action bar, second action-only row, duplicate create или новый shared abstraction.

### Branch-scope and catalog states
- Локально разделить branch-scope loading/error/reload и catalog-items loading/error/reload; не создавать global state.
- Initial branch loading: toolbar остаётся; labelled scope показывает `Загружаем филиалы…`, refresh защищён от duplicate request, create disabled; catalog empty/error ещё не показывается.
- Branch load error: scope показывает `Филиалы не загрузились`, refresh повторяет `getBranches`, create disabled; inline recovery copy идёт сразу под toolbar без separate action row.
- Нет available branch: scope показывает `Нет доступного филиала`, refresh позволяет повторить branches load, create disabled и причина находится рядом со scope.
- Branch loaded + catalog loading/error: selected branch остаётся видимым; refresh повторяет items load selected branch; create доступен при valid resolved branch; stale rows не выдаются за current content.
- Branch switch обновляет `branchId`; AbortController/request identity не допускают stale list. Existing create/update request semantics сохраняются.
- Empty, validation, success и permission-restricted states не сбрасывают selected tab/branch. Form/API errors остаются у modal fields/action; scope errors — у toolbar.

### Remaining Settings actions
- Shared text buttons для group types, branches и administrators сохраняются; Settings touch inventory подтверждает минимум `44 x 44px`.
- Hall edit/archive/delete `ActionIcon` получают explicit local `44 x 44px` size и gap минимум `8px`, без повышения destructive visual priority.
- Branch selection rows сохраняют selected state, Enter/Space activation и hierarchy; row children не становятся новыми clickable surfaces.
- Mantine Modal сохраняет focus trap, Escape/close и focus return. Local opener ref добавлять только если RED test докажет нарушение Mantine default.

### Responsive and device behavior
- `360 x 780`: tabs `2 x N`, scoped toolbar one row, scope plus two `44px` icons, content one column, no page overflow.
- `390 x 844`: stress baseline; scope/action/content reachable above shell safe-area reservation.
- `420 x 912` и `440 x 956`: target portraits; исходные `40px` tab/`36px` select failures закрыты; long names не overlap actions.
- `912 x 420` и `956 x 440`: compact height; normal page scroll, one-row toolbar и primary/recovery reachable, без sticky/nested-scroll trap.
- `768 x 1024`: mobile hierarchy сохраняется; tabs/toolbar используют wide row без изменения DOM order.
- `1440 x 1200`: action text видим, но desktop не возвращает actions раньше scope и не добавляет duplicate heading/summary.
- На всех sizes: no unintended document/body horizontal scroll, independent gaps `>=8px`, controls не обрезаются при `200%` zoom.

### Safari, safe area and software keyboard
- TASK не добавляет fixed/sticky controls; existing shell reservation и normal scroll остаются владельцами safe-area reachability.
- Catalog form не редизайнится. Focused field, validation и save должны оставаться достижимыми одним intentional scroll; system-wide form redesign является scope expansion.
- WebKit emulation проверяет target logical screen/touch behavior. Safari chrome, virtual keyboard, Dynamic Island, home indicator и one-handed reach требуют Simulator/physical-device evidence.

## Execution roles
1. `ux-researcher` handoff выполнен на planning stage: user task, decision data, action priorities, focus order, states и measurable criteria зафиксированы.
2. `ui-designer` handoff выполнен на planning stage: выбран one-row local scoped toolbar, Settings-local touch CSS и branch recovery behavior.
3. `test-automator` до production-кода добавляет component/Playwright RED regressions; после implementation закрывает responsive matrix.
4. `react-specialist` только после подтверждённого RED реализует minimal React/Mantine/local-state change с `.agents/skills/react-best-practices/SKILL.md`.
5. Координатор проверяет worktree, test-first evidence, unchanged API semantics и результат против UX/UI contract.

## Execution steps

### Phase 0 — isolated workspace and baseline
1. Выполнить `git fetch origin`; перечитать root/frontend `AGENTS.md`, source TASK, plan, `crm-mobile-first-ui`, `react-best-practices`, `task-worktree`; создать/возобновить declared worktree/branch и вернуть verified path/branch/base/clean status.
2. Запустить baseline: `cd frontend && npm run test:unit -- src/features/settings/SettingsScreen.test.tsx src/features/settings/MembershipCatalogSettings.test.tsx src/features/settings/BranchSettingsScreen.test.tsx src/features/shared/ux.test.tsx`.
3. Запустить baseline: `cd frontend && npm run test:e2e -- settings-tab-title-duplication.spec.ts membership-catalog-settings.spec.ts touch-target-inventory.spec.ts`. Отделить pre-existing failures от будущего TASK-109 RED.
4. Source-search подтвердить tabs/select styles, hall ActionIcons, current request bodies, target-device projects и empty touch allowlist. Не менять backend/API/shared toolbar без тестового доказательства.

### Phase 1 — tests before functional code
5. Сначала расширить `MembershipCatalogSettings.test.tsx`:
   - selectable/static scope DOM идёт раньше refresh/create, state/content — после;
   - two branches: switch вызывает GET exact branch, create POST получает selected `branchId`, edit PUT не получает new scope semantics;
   - long branch name сохраняет full accessible value;
   - branch loading/error+retry/no-branch disabled reason и items loading/error/empty/success сохраняют selected scope;
   - create существует один раз и остаётся единственным primary action.
6. Сначала расширить `SettingsScreen.test.tsx` и `BranchSettingsScreen.test.tsx`:
   - разрешённые tabs сохраняют selected/panel associations и отсутствие duplicate headings/metrics;
   - backend-denied create не скрывает refresh;
   - hall actions получают explicit touch hook/size, branch row keyboard/selected behavior не меняется.
7. Сначала обновить `settings-tab-title-duplication.spec.ts`:
   - visible tabs, catalog select, refresh/create и representative edit имеют box `>=44 x 44` на `390 x 844`;
   - Arrow-key navigation сохраняется; Tab order идёт scope → refresh → create → row edit;
   - geometry доказывает scope before actions/content; no second action-only row/page overflow.
8. Сначала расширить Settings case в `touch-target-inventory.spec.ts`: добавить tabs, branch select, refresh, create, catalog edit и representative hall ActionIcons; прогнать existing eight-viewport matrix; не добавлять TASK-109 allowlist exceptions.
9. Сначала расширить `membership-catalog-settings.spec.ts`: two-branch query/POST/PUT identity, branch and items failure/retry, selected scope persistence, modal validation и focus return.
10. Сначала расширить `iphone-target-devices.spec.ts` и при необходимости focused Settings case в `responsive-main-screens.spec.ts`: оба target portraits + rotation, touch geometry, one-row toolbar, long names, primary/retry reachability, no overflow.
11. Запустить новые component/Playwright tests на неизменённом production code. Зафиксировать ожидаемый RED: actions precede scope, tabs/select меньше `44px`, branch retry не работает, hall ActionIcons меньше minimum. Broken fixture/selector или unrelated baseline не считается правильным RED.

### Phase 2 — minimal functional implementation
12. Добавить Settings-local Tabs/list classes и CSS для `44px`, `8px` gap, mobile two-column grid, wrapping и visible focus. Не менять shared Tabs/nav.
13. В `MembershipCatalogSettings` переставить scope перед existing `TaskToolbarActions` внутри one-row grid; добавить stable scope ids, action-group description и static-scope variant.
14. Добавить catalog-local CSS: `grid-template-columns: minmax(0, 1fr) auto`, `gap: 8px`, `align-items: end`, select `44px/16px/min-width:0`, accessible long-name truncation и mobile icon-only cluster.
15. Разделить только внутри catalog component branch/items loading/error/retry. Refresh повторяет failed branches до resolution, затем current branch items; create disabled/reason видимы, пока scope не определён; abort/stale guards сохраняются.
16. Установить explicit `44px` и gap `>=8px` для hall ActionIcons. Не менять branch/hall operations, colors или priorities.
17. Если focus-return RED показывает проблему Mantine default, добавить minimal local opener ref; не внедрять global modal manager.

### Phase 3 — GREEN and regression closure
18. Повторно запустить focused tests; не ослаблять geometry/order/payload/recovery assertions и не добавлять allowlist.
19. Запустить `cd frontend && npm run test:unit`, `npm run lint`, `npm run build`.
20. Запустить `npm run test:e2e -- settings-tab-title-duplication.spec.ts membership-catalog-settings.spec.ts touch-target-inventory.spec.ts responsive-main-screens.spec.ts` и `npm run test:e2e:iphone`.
21. Source/DOM review: нет backend/API changes, permission inference, duplicate headings/actions, global toolbar override, hidden action-only row, positive tabIndex, raw colors, overflow или unrelated files.
22. Manual keyboard/200% zoom на `390 x 844`, `956 x 440`, `1440 x 1200`; при доступности iOS Simulator/physical-device smoke. Непроверенное device behavior указать как residual risk.

## Preferred implementation strategy
1. Component and Playwright order/geometry/recovery tests in RED.
2. Settings-local tab/touch CSS without global redesign.
3. One catalog scoped row with DOM order scope → refresh → create.
4. Local branch-vs-items async recovery and stale-request reconciliation.
5. Full touch inventory, target-iPhone WebKit and unchanged-payload regression closure.

## Files likely to change
- `frontend/src/features/settings/SettingsScreen.tsx`
- `frontend/src/features/settings/MembershipCatalogSettings.tsx`
- `frontend/src/features/settings/BranchSettingsScreen.tsx`
- `frontend/src/App.css`
- `frontend/src/features/settings/SettingsScreen.test.tsx`
- `frontend/src/features/settings/MembershipCatalogSettings.test.tsx`
- `frontend/src/features/settings/BranchSettingsScreen.test.tsx`
- `frontend/e2e/settings-tab-title-duplication.spec.ts`
- `frontend/e2e/membership-catalog-settings.spec.ts`
- `frontend/e2e/touch-target-inventory.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts` (только если inventory не доказывает focused reachability)
- `frontend/e2e/iphone-target-devices.spec.ts`

Files to inspect but not expected to change:
- `frontend/src/features/shared/TaskToolbarActions.tsx`
- `frontend/src/features/shared/Button.tsx`
- `frontend/src/features/shared/ux.tsx`
- `frontend/src/lib/api/membershipCatalog.ts`
- backend Settings endpoints/tests
- `frontend/e2e/touch-target-inventory.allowlist.ts` — не добавлять TASK-109 exceptions.

## Constraints
- Backend остаётся владельцем branch scope, catalog rules, permissions, validation и ProblemDetails.
- Не менять API request/response, create/update payload, database, roles, allowed tabs/actions или availability rules.
- Сохранить React 19, TypeScript, Vite, Mantine, Onest, design tokens, `PageLayout/PageTabsPanel` semantics и shared toolbar priorities.
- Не добавлять component library, raw colors, global state, duplicate breakpoint DOM или positive `tabIndex`.
- Toolbar остаётся one-row; primary create не уходит в overflow.

## Out of scope
- Backend fix, если selected branch и actual create target расходятся.
- Новые Settings tabs/filters/entities, permission model или branch rules.
- Общий redesign forms, route shell, bottom navigation, shared toolbar или Settings IA.
- Изменение catalog price/behavior/date semantics и immutable edit fields.
- Physical-device certification при отсутствии Simulator/device; остаток документируется.

## Required test coverage

### Unit/component tests — до functional code
- Catalog DOM/scope association, selectable/static branch, local async/retry states, long names и exact create/update requests.
- Settings permission-derived tab matrix, selected/panel semantics, no duplicate headings и toolbar priorities.
- Branch selected/keyboard preservation и explicit touch hooks для hall actions.
- Pure domain unit tests не нужны: business logic не меняется. Если async reconciliation выделяется в pure helper, его transitions покрыть unit tests до implementation.

### Integration tests — до functional code
- Frontend Playwright с intercepted API проверяет branch A/B query, create `branchId`, unchanged edit route/body, failure/retry и scope persistence.
- Backend xUnit integration не применим, пока API/permissions/database не меняются. Если change нужен, implementation останавливается.

### UI/e2e tests — до functional code
- Geometry `>=44 x 44`, gaps `>=8px`, visual/DOM/focus order, one-row toolbar, long Russian names и no overflow на full matrix.
- Target iPhone WebKit portrait + rotation покрывают primary task и failure/retry; real Safari keyboard/safe-area остаётся device check.

### Initial expected failure
После добавления tests зафиксировать RED именно потому, что scope находится после actions, tabs/select меньше minimum, branch retry не работает и hall ActionIcons меньше `44px`. Только после этого менять production code.

### Manual-only remainder
Safari chrome collapse, physical safe-area, Dynamic Island/home indicator, software keyboard и one-handed reach требуют iOS Simulator/physical device и не заменяют automated tests.

## Test plan
- [ ] Baseline focused unit/e2e зафиксирован до новых assertions.
- [ ] Unit/component и integration/UI tests написаны до production code.
- [ ] Новые tests запущены в RED и падают по ожидаемой TASK-109 причине.
- [ ] Tabs/select/refresh/create/edit и gaps измерены на всей matrix.
- [ ] Scope → actions → content visual, DOM и keyboard order доказаны.
- [ ] Branch A/B requests не меняют backend semantics.
- [ ] Loading/empty/error/retry/disabled/success/permission states сохраняют tab/branch.
- [ ] Long names, compact landscape, overflow и focus return проверены.
- [ ] Full unit, lint, build, affected e2e и iPhone WebKit зелёные.
- [ ] Unverified Simulator/device checks перечислены отдельно.

## Regression barrier
Обязательный barrier: component tests на exact branch/task order и recovery; Playwright request assertions для двух branches; touch inventory без allowlist на восьми viewports; target-iPhone WebKit portrait/rotation; full frontend unit, lint и build. Screenshot без доказанных focus order, payload identity, recovery и geometry не считается завершением.

## Risks
- Settings-local CSS может задеть nested Mantine controls; class scope и non-Settings regression ограничивают риск.
- Async split может показать stale items после быстрого branch switch; AbortController/request identity и two-branch test обязательны.
- Long name может сжать actions на `360px`; `minmax(0,1fr) auto`, fixed `44px` actions и overflow assertions обязательны.
- Enlarged destructive hit areas могут выглядеть громче; менять только size/gap, не variant/color/priority.
- WebKit emulation не доказывает physical keyboard/safe area; не заявлять device acceptance без evidence.

## Stop conditions
Остановиться и не писать functional code, если:
- actual create target не соответствует selected branch или API contract нельзя определить;
- требуется изменение backend permissions, roles, payload, branch/catalog rules или production data;
- local Settings wrapper не изолирует change без global toolbar/tabs redesign;
- scope расширяется до system-wide form/shell redesign;
- acceptance criteria требуют нерешённого product decision.

Не останавливаться только потому, что несколько Settings panels используют shared controls: behavior локализуется Settings-specific classes/tests.

## Ready for Codex execution
yes

