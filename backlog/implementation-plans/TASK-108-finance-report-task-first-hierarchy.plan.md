# Implementation Plan: TASK-108 Вернуть финансовому отчету task-first hierarchy

## Source task
/backlog/risky/TASK-108-finance-report-task-first-hierarchy.md

Task remains in `/backlog/risky` until human review approves active
implementation. This plan is created for implementation readiness and financial
trust review, not as permission to start code changes in the primary repository.

## Implementation branch
fix/TASK-108-finance-report-task-first-hierarchy

Branch rules:
- перед изменением project code использовать `.agents/skills/task-worktree/SKILL.md`
  и создать либо безопасно возобновить отдельный worktree
  `../crm-worktrees/TASK-108-finance-report-task-first-hierarchy`;
- создать branch непосредственно от актуального `origin/main`; primary
  repository оставить на `main`, а код менять только в task worktree;
- до первой правки подтвердить registered worktree, active branch, отсутствие
  unexplained changes и `git merge-base --is-ancestor origin/main HEAD`;
- не включать backend/API contract changes, formula changes, permissions,
  export controls, currency/rounding changes или unrelated finance redesign;
- Docker Compose по умолчанию не нужен: задача покрывается frontend unit,
  component и mocked Playwright tests.

Planning evidence на 2026-08-02: primary repository был проверен на clean
`main` `8b77992b9026c8637befe15a7969d00aa7153870`, совпадающем с локальным
`origin/main`; branch, remote branch и worktree TASK-108 не найдены. Source
task находится в `/backlog/risky`. Executor обязан повторить проверку после
`git fetch origin` и не считать planning snapshot актуальным execution base.

## Goal
Пользователь, которому backend разрешил финансовые отчеты, сразу видит период и
scope данных, отличает empty/loading/error/stale состояния и быстро переходит
от KPI к branch/trainer/group breakdown на мобильных размерах без сомнений в
актуальности финансовых данных.

## UX contract used
- Пользователь: SuperAdministrator, HeadCoach или другой backend-authorized
  finance-report user.
- Primary context: mobile operational check at `390 x 844`, with target checks
  at `420 x 912` and `440 x 956`.
- Completion signal: user can state the period, branch scope and trainer scope
  of the displayed report, see whether operations exist, read totals, and reach
  breakdown within the first intentional scroll.
- Primary path: open `/finance` -> read closed scope summary -> optionally open
  filters/change/reset -> read compact KPI summary -> inspect empty state or
  breakdown -> retry if report failed.
- Frequent actions: change period/branch/trainer/date, reset active scope,
  refresh/retry. Secondary actions: open/close filter drawer/popover.
- Stale trust rule: previous report data must be labeled with the last
  successful scope, not the failed new filter values.

## Human review decisions (2026-08-16)
- Cleared/default filter baseline is the current month anchored to the local
  current date, matching the valid initial request. Initial state has active
  filter count `0`; reset returns to that valid baseline.
- One external reset is shown in the filter toolbar only while filters are
  active; the open drawer/popover keeps its contextual reset. Scope header and
  empty state do not duplicate reset.
- Backend field-validation errors recover through the affected fields and do
  not offer retry. Retry is reserved for transport/server failures.
- A newer immediate filter request supersedes an older failed request and its
  retry target. Displayed money remains labeled only with the last successful
  scope.
- Zero reports suppress all five KPI surfaces and render one explicit empty
  state.
- All five KPI values have equal visual weight. `Чистая выручка` receives no
  accent treatment; the full-width fifth row is a neutral geometry solution,
  not emphasis.
- Successful backend periods are formatted as exact
  `dd.MM.yyyy–dd.MM.yyyy` ranges. Stale copy distinguishes same-scope refresh
  failure from failure to load a newly requested scope.
- A selected branch/trainer without an authorized option label is a data/access
  inconsistency, not a normal fallback state. UI must not guess or silently
  mask that inconsistency.
- Export, sales/refund drill-down and new report navigation remain out of scope.
- These decisions close the product/design questions but do not by themselves
  activate implementation or move the source task out of `/backlog/risky`.

## Current understanding
- `frontend/src/features/finance/FinanceReportsScreen.tsx` fetches options and
  report through existing API helpers, applies filters immediately, keeps the
  previous `report` on refresh failure, and uses backend `report.period` and
  `report.totals` as canonical data.
- Mobile `CompactFilterPanel` currently collapses all period/branch/trainer
  context behind a generic `Фильтры` button.
- The KPI area is a five-card `SimpleGrid`; at mobile width each card has
  `min-height: 8.25rem`, so empty periods show a long sequence of zero metrics
  before the empty explanation.
- Current stale behavior is a yellow alert above `FinanceReportResults`; the
  displayed report surface itself is not marked stale and retry is not placed
  inside that surface.
- Existing tests already protect backend values from local recomputation,
  filter query params, permissions, field errors and narrow no-horizontal-scroll.
- Current `createClearedFilterValues()` returns `month` with an empty
  `anchorDate`, although backend requires `anchorDate` for non-custom presets.
  TASK-108 must correct this frontend reset defect while preserving endpoint
  keys and backend period interpretation.
- Backend contracts, formulas, query parameters, roles and permissions must not
  change.

## Constraints
- Backend remains the only source of truth for report values, resolved period,
  permissions, available branch/trainer scope and historical attribution.
- Frontend may format existing values and labels, but must not recompute totals
  from breakdown rows or infer hidden scope.
- `toFinancialReportParams`, endpoint path/query keys and immediate filter-apply
  semantics remain unchanged.
- Loading, empty, initial error, refreshing, stale error, success and
  permission-restricted states must stay observably distinct; missing or
  partial data is never rendered as zero.
- Stale semantics use text plus status/alert semantics, not color alone.
- Every non-null selected branch/trainer id must have a label from the
  authorized options used to form that selection. A missing label is an
  integration/access inconsistency and must not be rendered as a normal
  financial scope.
- Mantine, Onest, existing tokens, `CompactFilterPanel` and current breakpoint/
  safe-area contracts remain authoritative.

## Out of scope
- Backend/API/DB changes, finance formulas, attribution, rounding, currency,
  sales/refund semantics and permission/access-scope changes.
- New KPIs, charts, exports, sales/refund drill-down or report navigation.
- Local caching of several report versions, persistence in URL/storage or new
  global state.
- Global redesign of shared filters, shell, navigation or unrelated finance
  screens.
- Production deployment or physical-device acceptance during planning.

## Design recommendation by screen/component

### `FinanceReportsScreen`
Render order:
1. Permission guard, unchanged.
2. Options-load warning, only if branch/trainer options failed.
3. Backend filter-validation alert, unchanged location near filters.
4. Один composite `finance-report-controls`: локальный `FinanceScopeHeader`
   первым рядом и `CompactFilterPanel` непосредственно под ним, без
   декоративной промежуточной карточки или дублирующего заголовка.
5. `FinanceReportSurface` containing initial loading, error, stale, empty,
   KPI strip and breakdown states.

Do not restore a visible route heading: current finance route is named by
navigation and `PageLayout showHeader={false}` is acceptable.

### `FinanceScopeHeader`
New finance-local presentation component in
`frontend/src/features/finance/FinanceReportPresentation.tsx`. The route screen
keeps fetching, form state and the successful/requested snapshot; the new file
owns only scope/status/KPI/empty rendering and does not move unrelated
breakdown logic.

Visible content, in this order:
1. Первый ряд: `Отчет: {period}` без reset action. Period берется из displayed
   backend `report.period`, когда successful report существует, и форматируется
   точным диапазоном `dd.MM.yyyy–dd.MM.yyyy`.
   До первого success используется явный request context
   `Запрос: {preset/date or custom range}`, без локального вычисления
   backend period boundaries.
2. Второй ряд: `Филиал: {scope} · Тренер: {scope}`. На `360-440px` он может
   занимать максимум две визуальные строки; при line clamp полный текст
   остается в accessible name и доступен в filter drawer.

Active-filter count и единственный внешний reset принадлежат filter toolbar, а
не scope header. Count считается по трем пользовательским категориям:
period/date, branch, trainer, а не по числу внутренних query fields.

При refresh с предыдущими данными header продолжает подписывать именно
displayed report. Inline status отдельно сообщает `Обновляем для {requested
scope}`. При stale error header сохраняет displayed scope, а alert называет
failed requested scope. Один и тот же денежный набор никогда не получает
подпись нового неуспешного запроса.

Scope label invariant:
- `branchId === null`: `Все филиалы`.
- found branch option: branch `name`.
- `trainerId === null`: `Все тренеры`.
- found trainer option: current option label, preserving `fullName (login)`.
- selected non-null id without a corresponding authorized option is not a
  fallback branch. Treat it as `scope-data-inconsistent`, show a visible trust
  error, do not guess the label or present ambiguously scoped money as normal,
  and stop for product/backend review if the inconsistency is reproducible.

Financial-trust rule: if a later refresh fails, the scope header for displayed
money uses last successful filters + report period. The stale alert separately
states that the requested new scope did not load.

### `CompactFilterPanel`
Reuse existing component and CSS. Do not change backend query semantics.

Closed mobile state:
- button label should include active status, e.g. `Фильтры` plus active count
  exposed by adjacent summary or `aria-label`, not a long concatenated scope
  that can overflow;
- refresh action remains visible as the only permanent toolbar action beside
  filters;
- external reset appears only when active filters exist and must be at least
  `44 x 44px`; if width is tight, it may be icon-only with accessible label
  `Сбросить фильтры финансового отчета`.

Open drawer/popover:
- keep immediate-apply semantics. `Готово` only closes the drawer; it must not
  imply delayed apply.
- `Сбросить` is present only while filters are active. It resets only current
  finance report filters to the valid default baseline and leaves backend
  interpretation unchanged.
- field labels remain visible for period/date/branch/trainer controls.
- backend field errors remain next to affected fields and focus first invalid
  field.

Active filter semantics:
- baseline is created once for the screen session using the same values as the
  valid initial request: `month`, current local `anchorDate`, initial custom
  date drafts, `branchId: null`, `trainerId: null`;
- active if `periodPreset`, applicable date fields, `branchId` or `trainerId`
  differ from that baseline. Inapplicable hidden date drafts do not increment
  the count;
- reset clears branch/trainer and restores the baseline. The resulting request
  keeps the current query mapping and sends `periodPreset=month` plus the valid
  baseline `anchorDate`, never an invalid empty anchor;
- reset must never locally recalculate or reinterpret report totals.
- Add the smallest shared `CompactFilterPanel` API needed to conditionally show
  its reset in desktop/popover/drawer modes, protected by shared regression
  tests; keep the external mobile reset finance-local.

### `FinanceReportSurface`
New local component boundary around report states. It should receive:
- `report`;
- `displayedScope`;
- `requestedScope`;
- `failedRequest` snapshot when the latest completed request failed;
- `isInitialLoading`;
- `isRefreshing`;
- `reportError` with validation vs retryable failure classification;
- `isStale`;
- `onRetry`;
- `isMobile`;
- existing breakdown content as `children`, rendered only for non-empty report.

Surface hierarchy:
1. Inline status/stale/error region.
2. Empty report state when report is zero.
3. Compact KPI strip when report is non-empty.
4. Breakdown start.

Retry placement:
- retryable error without data: inside report surface `ErrorState`, action
  `Повторить`;
- retryable stale error with data: inside the same report surface alert, action
  `Повторить обновление`; do not place retry only in the toolbar.
- backend validation/ProblemDetails field error: no retry. Keep the error beside
  filters, focus the first invalid field and tell the user to correct it.
- a new filter change supersedes the previous `failedRequest`, starts a new
  `Обновляем...` state and removes the abandoned retry target. If that newer
  request fails, it becomes the new failed snapshot.

Stale copy:
- same-scope refresh failure:
  `Не удалось обновить отчет. Показаны ранее загруженные данные за {displayed period}.`;
- changed-scope failure:
  `Не удалось загрузить отчет для {requested scope}. Показан предыдущий отчет: {displayed scope}.`;
- displayed period uses the backend `from/to` exact range. A failed non-custom
  request is described by its preset plus requested anchor date; frontend does
  not invent unresolved backend period boundaries.

### `FinanceKpiStrip`
Replace five large metric cards with compact non-interactive KPI items.

Order is unchanged:
1. `Продано абонементов`
2. `Выручка`
3. `Возвраты`
4. `Чистая выручка`
5. `Новые клиенты`

Mobile geometry:
- grid, no horizontal scrolling;
- at `360-440px`: two columns, gap `8px`, item min-height `56px`;
- fifth item always spans both columns at `360-440px`, чтобы layout был
  deterministic и не зависел от измерения текста. It uses the same neutral
  border/background/type treatment as its peers and may place label/value
  inline to avoid accidental emphasis;
- all five KPI values use equal visual weight. Do not accent, enlarge, color or
  otherwise promote `Чистая выручка`, `Новые клиенты` or any other metric;
- labels use existing text tokens, at least `12px`; values use tabular nums,
  at least `16px`; money values wrap with `overflow-wrap: anywhere`;
- no KPI item may exceed `76px` height at normal font size in the standard
  fixture.

Tablet/desktop geometry:
- `768px`: five columns if each item can remain at least `112px`; otherwise
  wrap to 3+2, no page overflow.
- `1440px`: five columns, max item height `80px`.

Empty report behavior:
- if `isZeroReport(report)` is true, show one explicit empty report state
  and do not render the KPI strip or repeated zero metrics.

### `FinanceEmptyReportState`
Use existing `EmptyState` style, but as a single report state.

Visible content:
- title: `За выбранный период операций нет.`
- description: `Измените период или снимите фильтры.`
- actions: none. The visible toolbar owns filter opening and the only external
  reset, avoiding duplicate operations inside the empty state.

Do not render empty breakdown section messages for branch/trainer/group in this
state; they duplicate the single report-empty state.

### `MobileBreakdowns` and `DesktopBreakdowns`
Keep existing breakdown data and columns. No formula or attribution changes.

Mobile:
- rendered after non-empty KPI strip;
- first breakdown control must begin within the first intentional scroll on
  `390 x 844`, `420 x 912`, and `440 x 956`;
- для standard non-empty fixture Playwright guard на initial scroll position:
  `firstBreakdownBox.y <= window.visualViewport.height`; длинные stress-values
  могут потребовать один scroll, но после прокрутки на `75%` visual viewport
  control должен быть полностью видим;
- no horizontal table scrolling;
- long branch/trainer/group names wrap in mobile rows.
- Не закрывать существующие breakdown sections и не удалять данные только
  ради geometry assertion; высвобождать место за счет scope/KPI hierarchy.

Desktop/tablet:
- keep task-oriented hierarchy derived from mobile;
- extra width may improve columns but must not restore large decorative KPI
  cards or introduce top summary widgets unrelated to the current task.

## Responsive matrix

### `360 x 780`
- Closed scope header: two text rows maximum before toolbar; branch/trainer
  chips may wrap to a second row.
- Filter toolbar: one row, `Фильтры` button min width `156px`; refresh and
  reset may be icon-only `44 x 44px`.
- KPI: 2-column compact grid, max normal-height block about `200px`.
- Empty: scope header + single empty state visible without passing five zero
  KPI cards.
- No document/body horizontal overflow.

### `390 x 844` stress baseline
- Design primary target.
- Scope summary, filter trigger, refresh and active reset are visible before
  opening drawer.
- Non-empty: scope + toolbar + KPI strip + first breakdown control fit within
  the first screen or the first deliberate scroll.
- Empty: single empty state appears before any repeated zero metric surface.

### `420 x 912` iPhone Air portrait
- Same hierarchy as `390`.
- Branch/trainer names get slightly more inline room; no new controls are added.
- Drawer action bar remains above safe area.

### `440 x 956` iPhone 17 Pro Max portrait
- Same hierarchy as `390`.
- More text can stay on one line, but do not change component order.
- Annotated audit issue is accepted only when period, branch and trainer scope
  are visible before opening filters.

### `768 x 1024`
- Scope header and filter panel can share a two-column layout only if focus
  order remains scope -> filters -> actions -> report.
- KPI strip should use five columns when each item remains at least `112px`;
  otherwise wrap without horizontal scroll.
- Breakdown may use existing desktop table/grid if no page overflow and long
  values wrap.

### `1440 x 1200`
- Same task-first order: scope -> filters -> report status -> KPI -> breakdown.
- KPI items are compact five-column summary, not large dashboard cards.
- Desktop must not add decorative subtitles, hero copy, or extra summary cards.

### Compact landscape `912 x 420` and `956 x 440`
- Coarse pointer uses mobile filter drawer path.
- Drawer content uses `100dvh`, not `100vh`; body scrolls, sticky actions stay
  reachable with safe-area padding.
- If keyboard opens on a date/select field, focused field, validation feedback
  and `Готово`/`Сбросить` actions remain reachable within one intentional
  scroll.
- Report surface recovery/retry is inline; no nested scrolling trap or clipped
  bottom action.
- Shell navigation and report content must not overlap fixed/sticky controls.

## Interaction-state notes
- Initial loading: show loading label, no zeros and no empty state.
- Refreshing with data: previous report remains visible with `Обновляем...`
  status; refresh button shows pending and prevents repeated click if existing
  `TaskToolbarRefreshAction` supports loading.
- Retryable error without data: report surface `ErrorState`, no KPI/breakdowns,
  retry inside the surface.
- Retryable stale error with data: keep previous report, mark surface as stale
  with text and status semantics, include retry inside the report surface, and
  do not relabel previous money with failed filters.
- Success empty: one empty state, no repeated zero KPI cards and no empty
  breakdown triplet.
- Success non-empty: KPI strip followed by breakdown.
- Options error: warning stays near filters; unfiltered report can still render.
  A selected non-null id without its authorized label is
  `scope-data-inconsistent`, not a fallback copy state.
- Permission restricted: current no-fetch/no-tab behavior remains unchanged.
- Backend validation error: keep ProblemDetails alert and first-invalid-field
  focus behavior, show no retry, and keep displayed money labeled with the last
  successful scope.

Feedback timing:
- filter change continues to apply immediately;
- visible loading/refreshing feedback should appear in the same render cycle as
  `reportLoading`;
- stale alert appears after the latest retryable failed request and remains
  until retry or filter change starts a newer request. The newer request shows
  `Обновляем...`; only its own failure may create the next stale alert.

## Focus, keyboard and temporary surfaces
- Focus order on mobile: scope summary -> filter trigger -> conditional external
  reset -> refresh -> report status/retry -> KPI items if focusable none ->
  breakdown controls.
- KPI items are not buttons and should not enter tab order.
- Filter drawer trigger opens a titled `Drawer`; close/Escape/mobile close
  returns focus to the trigger when it still exists.
- Inside drawer: period control -> date fields -> branch -> trainer -> `Готово`
  -> conditional `Сбросить`.
- `Готово` closes drawer. `Сбросить` resets values immediately and keeps focus
  on reset or moves to the first changed field; do not surprise-close if the
  user is still reviewing filters.
- Desktop popover for additional filters keeps `trapFocus`, Escape close and
  focus return.
- Retry button is keyboard-operable and has visible focus.
- `aria-live="polite"` or equivalent status semantics should announce
  refreshing/stale state without interrupting form typing.

## Safe-area, Safari viewport and keyboard behavior
- Fixed/sticky drawer actions must combine normal spacing with
  `env(safe-area-inset-bottom, 0px)`.
- Full-height drawer/modal surfaces use `100dvh` and maintain an internal body
  scroll path; do not rely on `100vh` alone.
- Page-level content must not be hidden behind mobile bottom navigation or
  Safari chrome.
- With software keyboard open on date/select controls, focused field,
  validation/recovery text and primary drawer action remain reachable within
  one intentional scroll.
- The logical test sizes (`390 x 844`, `420 x 912`, `440 x 956`) are not enough
  to claim physical Safari acceptance; Simulator or device checks remain
  required for browser chrome, home indicator and safe-area evidence.

## Implementation guidance and constraints
- Keep changes frontend-only unless a stop condition is hit.
- Do not change `frontend/src/lib/api/reports.ts`,
  `GetFinancialReportParams`, endpoint paths or query keys unless tests reveal
  an existing frontend contract bug unrelated to TASK-108; such a discovery
  requires human review before proceeding.
- Do not locally recompute totals from breakdown rows.
- Store last successful display metadata together with the last successful
  report. Suggested local type:
  `DisplayedFinancialReport = { report, filters, scopeLabels }`; не изобретать
  и не показывать financial `loadedAt`, которого нет в backend contract.
- Track the latest retryable failure separately, including its request params,
  request scope labels and request identity, so retry cannot target an abandoned
  filter set. A newer filter request supersedes this snapshot.
- Capture branch/trainer labels only from authorized options used by the
  selected ids; never infer unauthorized names. Missing selected-id labels are
  a trust/integration error, not a display fallback.
- Keep `FinanceReportsScreen.tsx` responsible for API effects, filter form,
  request lifecycle and existing breakdown data. Add task-local
  `FinanceReportPresentation.tsx` for `FinanceScopeHeader`,
  `FinanceReportSurface`, `FinanceKpiStrip` and `FinanceEmptyReportState` so the
  already large route file does not grow with new presentation structure.
- Do not move existing breakdown/table code merely to reorganize the file;
  pass the current mobile/desktop breakdown content into the report surface.
- CSS likely changes stay in `frontend/src/App.css` near existing
  `.finance-*` rules; use current CRM tokens and Mantine/Onest patterns.
- Add a small conditional-reset API to shared `CompactFilterPanel` so desktop,
  popover and drawer reset visibility follows active state. Protect existing
  consumers with shared tests; keep finance-specific count and external mobile
  reset composition local.
- Do not introduce Tailwind, new component libraries, global state, exports,
  charts or new KPI definitions.

## Preferred implementation strategy
1. Contract-preserving frontend change: keep current API types and query
   mapping, and treat backend response period/totals as immutable input.
2. Model one last-successful `{ report, filters, scopeLabels }` snapshot plus a
   request-identified latest retryable failure beside current requested filters
   so stale data cannot be relabeled or retried with an abandoned scope.
3. Prefer finance-local components/state over a shared abstraction; extend
   `CompactFilterPanel` only with the minimal conditional-reset contract and
   protect all existing consumers with shared tests.
4. Implement in small verifiable commits: red tests, display-state model,
   scope/report hierarchy, compact styling, green/regression closure.
5. Do not use feature flags or a backend compatibility layer: no contract or
   rollout change is required for this bounded presentation fix.

## Execution roles
1. `ux-researcher` handoff выполнен на planning stage: зафиксированы task,
   decision-data, state/recovery contract и financial-trust risks.
2. `ui-designer` handoff выполнен на planning stage: зафиксированы component
   order, scope/KPI geometry, responsive/focus behavior и human-review gates.
3. `test-automator` до production-кода добавляет component/Playwright red
   regressions и сохраняет expected-failure evidence.
4. `react-specialist` только после подтвержденного red state реализует
   минимальные React/Mantine/CSS changes по этому contract, применяя
   `.agents/skills/react-best-practices/SKILL.md`.
5. Координирующий агент проверяет worktree, test-first evidence, finance
   contract preservation и acceptance matrix; backend specialists не нужны,
   пока stop condition не обнаружит contract change.

## Files likely to change
- `frontend/src/features/finance/FinanceReportsScreen.tsx`
- `frontend/src/features/finance/FinanceReportsScreen.test.tsx`
- `frontend/src/features/finance/FinanceReportPresentation.tsx` — new local
  presentation boundary
- `frontend/src/features/finance/FinanceReportPresentation.test.tsx` — focused
  state/scope/KPI unit-component coverage
- `frontend/src/features/shared/ux.tsx` — minimal conditional reset visibility
- `frontend/src/features/shared/ux.test.tsx` — shared reset regression coverage
- `frontend/e2e/finance-reports.spec.ts`
- `frontend/src/App.css`
- `frontend/e2e/iphone-target-devices.spec.ts` — обязательный finance smoke для
  обоих target WebKit projects
- possibly `frontend/e2e/touch-target-inventory.spec.ts` only if added
  controls require inventory updates

## Execution steps

### Phase 0 - workspace and baseline
1. Read root `AGENTS.md`, `frontend/AGENTS.md`, source TASK, this plan,
   `.agents/skills/crm-mobile-first-ui/SKILL.md`,
   `.agents/skills/react-best-practices/SKILL.md` and
   `.agents/skills/task-worktree/SKILL.md`.
2. Create/resume the declared task worktree and branch from current
   `origin/main`; confirm path, branch, base and clean task workspace.
3. Inspect current `FinanceReportsScreen.tsx`, `CompactFilterPanel`, finance
   CSS, `FinanceReportsScreen.test.tsx`, `finance-reports.spec.ts`, and API
   types before writing tests.
4. Run focused baseline when practical:
   `cd frontend && npm run test:unit -- src/features/finance/FinanceReportsScreen.test.tsx src/lib/api/reports.test.ts`
   and `npm run test:e2e -- finance-reports.spec.ts`.

### Phase 1 - tests before functional code
5. Before production code, add/update component tests for:
   - `FinanceReportPresentation.test.tsx`: scope labels/inconsistency, active count,
     loading/refreshing/error/stale/empty/success branches and compact KPI DOM;
   - `FinanceReportsScreen.test.tsx`: async successful/requested snapshot,
     unchanged API params, retry sequence, reset and permission boundary;
   - non-empty report shows period, branch and trainer scope before opening
     filters;
   - backend totals are still rendered without local recomputation;
   - zero report shows one explicit empty state and does not render five zero
     KPI cards before it;
   - initial loading shows loading, not empty/zero totals;
   - error without data shows report-surface retry and no totals;
   - stale-data error keeps previous report, labels it stale, uses last
     successful scope, names the failed requested scope, and places retry
     inside the report surface;
   - retry repeats the latest retryable failed params; a newer filter request
     supersedes the older retry target, and a later success replaces the
     displayed snapshot and clears stale semantics;
   - refreshing with previous data is announced as pending, not success,
     empty or stale;
   - backend field-validation errors focus the field and offer no retry;
   - selected branch/trainer ids without authorized labels enter explicit
     scope-data-inconsistent handling rather than a guessed fallback;
   - initial baseline has active count `0`; reset clears only finance filters,
     restores a valid current-month anchor and preserves query semantics;
   - all KPI items use equal semantic/visual priority and zero reports render no
     KPI strip.
6. Before production code, add/update Playwright tests for:
   - `390 x 844`, `420 x 912`, `440 x 956` scope summary visibility before
     drawer open;
   - no horizontal overflow at `360`, `390`, `420`, `440`;
   - filter drawer open/close, reset and focus return;
   - retry after initial error and stale refresh failure;
   - long branch/trainer names, large/negative RUB values and wrapping;
   - non-empty breakdown start reachable in the first intentional scroll;
   - permission-restricted route still does not fetch or show finance data.
7. До production code добавить finance scenario в
   `frontend/e2e/iphone-target-devices.spec.ts`: на обоих WebKit projects
   scope виден при закрытом drawer, controls имеют минимум `44 x 44px`, KPI и
   первый breakdown не создают horizontal overflow, empty/stale recovery
   остается достижимым.
8. Run the new/updated component, Chromium matrix and target-iPhone tests and
   capture expected red failures caused by the
   missing hierarchy/stale behavior. Do not implement production code before
   this red state unless a test is impossible to express; document any
   exception.

### Phase 2 - minimal implementation
9. Add local display-state model for last successful report/scope and requested
   scope; update it only on successful `getFinancialReport`. Add a separate
   request-identified retryable-failure snapshot that is superseded by a newer
   filter request.
10. Add finance-local `FinanceReportPresentation.tsx` with
    `FinanceScopeHeader` plus active-filter derivation using existing filter
    values, branch/trainer options and backend `report.period`; toolbar remains
    the sole owner of external reset.
11. Add its `FinanceReportSurface` and move
    loading/error/stale/empty/success presentation decisions into it while the
    route screen retains request state and effects.
12. Replace `FinanceMetric` card grid with presentation-local
    `FinanceKpiStrip` compact items for non-empty reports.
13. Change empty behavior to render a single report empty state before any KPI
    repetition and suppress duplicate empty breakdown messages.
14. Add CSS for compact finance scope, KPI strip, stale surface and responsive
    wrapping using existing tokens.
15. Fix the finance reset baseline to restore the valid initial current-month
    anchor, add minimal shared conditional-reset support, and preserve existing
    `toFinancialReportParams`, immediate apply, permissions and API calls.

### Phase 3 - validation
16. Rerun focused unit/component tests:
    `cd frontend && npm run test:unit -- src/features/finance/FinanceReportPresentation.test.tsx src/features/finance/FinanceReportsScreen.test.tsx src/lib/api/reports.test.ts`.
17. Rerun affected Chromium e2e:
    `cd frontend && npm run test:e2e -- finance-reports.spec.ts responsive-main-screens.spec.ts touch-target-inventory.spec.ts`.
18. Run required frontend checks:
    `cd frontend && npm run lint`,
    `cd frontend && npm run build`,
    `cd frontend && npm run test:unit`,
    `cd frontend && npm run check:raw-colors`.
19. Run required target-device smoke:
    `cd frontend && npm run test:e2e:iphone`.
20. Report unverified physical Safari items: browser chrome, software keyboard,
    Dynamic Island/home indicator, safe-area insets and one-handed reach unless
    checked in Simulator or on device.

## Required test coverage

### Unit/component tests
Required before functional code:
- scope summary labels and selected-id inconsistency handling;
- active filter count/reset semantics;
- KPI strip/empty branching;
- stale data display metadata;
- loading/validation/retryable-error/refreshing state distinction;
- backend totals remain source of truth.

### Integration/e2e tests
Required before functional code:
- mocked API request query params remain unchanged;
- Playwright filter drawer open/close, valid baseline reset and retry;
- viewport hierarchy and no horizontal overflow at required mobile sizes;
- compact-height recovery at `912 x 420` and `956 x 440`, plus tablet/desktop
  preservation at `768 x 1024` and `1440 x 1200`;
- target WebKit acceptance through `iphone-target-devices.spec.ts` at
  `420 x 912` and `440 x 956`;
- permission-restricted route does not expose financial data;
- long labels and large/negative values do not clip.

Backend integration tests are not required because backend contracts and
financial calculations are explicitly out of scope. If implementation discovers
that backend behavior must change, stop and request product/backend review.

## Test plan
- [ ] Red component tests for non-empty, zero/empty, loading, error without
      data, validation without retry, stale-data error and scope-label
      inconsistency.
- [ ] Red Playwright tests for mobile scope summary, reset, retry, drawer focus,
      no horizontal overflow, first-scroll breakdown, compact-height and target
      WebKit behavior.
- [ ] Green focused unit/component tests after implementation.
- [ ] Green affected Playwright finance spec after implementation.
- [ ] Green `npm run lint`, `npm run build`, `npm run test:unit`.
- [ ] Green `npm run check:raw-colors` and `npm run test:e2e:iphone`.
- [ ] Explicit report of remaining Simulator/physical-device gaps.

## Regression barrier
The task is not complete unless automated tests fail before implementation for
the current hierarchy/stale bugs and pass after implementation. The regression
barrier must include:
- component coverage of all report operational states;
- mocked Playwright coverage of scope visibility, reset, retry and no mobile
  overflow;
- target-iPhone WebKit coverage at both declared portrait sizes and compact-
  height recovery coverage;
- existing test that backend totals are not recomputed remains passing;
- permission-restricted finance route remains passing.

Manual screenshot review may supplement but cannot replace the automated
regression barrier.

## Risks
- Financial trust risk: stale report data can be mislabeled with newly requested
  filters if last-successful scope is not stored explicitly.
- Financial trust risk: compact KPI styling can visually overemphasize or hide
  a value; approved equal-weight treatment must remain regression-protected.
- Label trust risk: a selected branch/trainer id without its authorized label
  indicates data/access inconsistency. Do not guess or normalize it into a
  routine fallback.
- Responsive risk: compact KPI grid can still push breakdown too low if item
  heights are not capped and tested with long values.
- Shared-component risk: modifying `CompactFilterPanel` globally could affect
  audit/schedule/client screens; keep the conditional-reset API narrow and
  protect existing behavior with shared tests.

## Human review outcome
Product/design review completed on 2026-08-16:
- zero reports use one empty state without five zero KPI surfaces;
- all five KPI values have equal weight; no metric receives accent treatment;
- exact displayed period and same-scope/changed-scope stale copy are approved;
- selected branch/trainer labels are required authorized data, not a fallback;
- export, details and sales/refund drill-down remain out of scope.

No unresolved product decision remains in this plan. Starting implementation
still requires an explicit activation request and moving the source task from
`/backlog/risky` into the active implementation workflow.

## Stop conditions
Stop and do not write further code if:
- implementation requires changing finance formulas, attribution, refund
  semantics, rounding, currency or backend report contracts;
- query parameters or permissions must change to satisfy the UI;
- frontend would need to locally recalculate totals or infer hidden access
  scope;
- selected branch/trainer names would have to be guessed from unauthorized or
  unavailable data;
- active implementation is requested before the user explicitly activates the
  task and the source item leaves `/backlog/risky`;
- scope expands into exports, charts, new KPI definitions or a full finance
  redesign.

## Ready for Codex execution
no

Reason: product/design questions are resolved and the plan itself is
implementation-ready, but the source task remains in `/backlog/risky` and the
user has not yet requested activation or implementation. On explicit activation,
move the task into `/backlog/implementation`, create the declared isolated
worktree and begin with the required red regression tests.
