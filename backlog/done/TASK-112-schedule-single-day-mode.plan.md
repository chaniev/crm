# Implementation Plan: TASK-112 Добавить однодневный режим недельного расписания

## Metadata
- source_task: /backlog/done/TASK-112-schedule-single-day-mode.md
- branch: feature/TASK-112-schedule-single-day-mode
- readiness: completed by superseding TASK-119 implementation; not executed independently
- dependencies: none; TASK-106 is merge-aware but not a functional dependency
- risk: medium — URL/history/responsive state on a shared schedule screen

## Goal
Coach, Administrator или HeadCoach на tablet/desktop может переключить
существующее read-only расписание между недельной сеткой и одним выбранным
weekday повторяющегося недельного шаблона. На mobile и compact-height остаётся
day-only workflow. Stored mode и weekday воспроизводятся из URL после refresh,
back/forward, фильтрации, обновления payload и смены viewport без введения
dated-calendar semantics.

## UI specification

### Screen order and render decision
1. Сохранить `PageLayout showHeader={false}` и current visually-hidden heading.
2. Сохранить `ScheduleFiltersToolbar` либо Coach zero-scope
   `ScheduleRefreshToolbar` первым operational row.
3. Сохранить initial loading и initial/stale error surfaces.
4. В `schedule-board` при renderable filtered schedule content показать:
   - wide-only `ScheduleModeSwitch`;
   - effective `week` → current `ScheduleDesktopGrid` внутри
     `.schedule-board__viewport`;
   - effective `day` → reusable `ScheduleDayMode` без weekly x-scroll wrapper;
   - current `ScheduleTypeLegend` после schedule content.
5. Initial loading, initial error without stale groups, global/Coach zero-scope
   empty и whole-filter empty не показывают mode switch или ложную grid.
   Selected-day empty сохраняет tab strip и day grid с `ScheduleDayEmpty`.

Effective mode вычисляется как `isMobileOrCompactHeight ? 'day' : storedMode`.
Media-query change меняет только render decision и никогда не пишет URL.

### Mode control
- Использовать Mantine `SegmentedControl` с values `week`/`day`, visible labels
  `Неделя`/`День`, `aria-label="Режим расписания"` и
  `data-testid="schedule-mode-switch"`.
- Разместить сразу после filters/refresh surface и перед grid/day strip внутри
  renderable schedule content.
- Control существует только на wide viewport, имеет min target `44 x 44px`,
  visible theme-token focus и не превращается в page navigation tabs.
- User change пишет новый history entry; повторный выбор current value не
  создаёт entry. После переключения focus остаётся на selected segment.

### Reusable weekday strip and day time grid
- Выделить из current `ScheduleMobileList` локальные
  `ScheduleDayStrip`, `ScheduleDayTimeGrid` и `ScheduleDayMode` либо
  эквивалентные focused components; не создавать global UI abstraction.
- Сохранить mobile test ids для совместимости:
  `schedule-mobile-day-list`, `schedule-mobile-day-strip`,
  `schedule-mobile-day-tab-${weekday}` и
  `schedule-mobile-day-${weekday}`.
- Для wide day mode добавить stable ids:
  `schedule-day-mode`, `schedule-day-strip`,
  `schedule-day-tab-${weekday}` и `schedule-day-grid-${weekday}`.
- Strip: `role="tablist"`, `aria-label="День недели"`. Каждый tab:
  `role="tab"`, `aria-selected`, stable `aria-controls`; selected tab получает
  `tabIndex=0`, остальные `tabIndex=-1`.
- Day grid: `role="tabpanel"`, stable id и `aria-labelledby` selected tab.
  `dd.MM` и current marker остаются labels, не date navigation.
- ArrowLeft/ArrowRight циклически выбирают weekday и переводят focus на новый
  selected tab; Home выбирает Monday, End — Sunday. Click выбирает exact tab.
  Каждое meaningful user selection использует one `pushState`.
- День берётся из уже построенного `calendarWeek.days`; порядок entries и
  overlap metrics не пересчитываются альтернативным алгоритмом.
- Mobile сохраняет current `SCHEDULE_MOBILE_HOUR_HEIGHT_PX`; wide day может
  использовать desktop hour density, но общий card/data contract остаётся
  тем же. Day view использует normal page vertical scroll и не вводит nested
  vertical scroll.

### URL and browser history contract
- Query keys фиксированы: `mode` и `weekday`.
- Stored state: `mode: 'week' | 'day'`; `weekday: 1..7`.
- Missing/invalid `mode` нормализуется к `week`; missing/invalid `weekday` — к
  current local weekday, вычисленному один раз при mount/URL repair.
- Mount и invalid/default canonical repair используют
  `window.history.replaceState`, сохраняют current `history.state`, pathname,
  hash и unrelated query params, удаляют duplicate/invalid schedule values и
  не добавляют history entry.
- User mode/weekday change использует `window.history.pushState`, сохраняет
  unrelated query params/state/hash и не пишет entry при semantic no-op.
- Pure helpers рекомендуются в schedule feature:
  `parseScheduleViewSearch(search, defaultWeekday)`,
  `toScheduleViewSearch(currentSearch, nextState)` и canonical comparison.
- Schedule hook/listener подписывается на `popstate`, reparses query и обновляет
  React state даже когда pathname остался `/schedule`; listener снимается при
  unmount. Programmatic write синхронно обновляет local state, не ожидая
  искусственного `popstate`.
- Full refresh восстанавливает canonical query. Filters, filter reset,
  manual/auto refresh, payload success/error и `now` update не меняют view
  query.
- Mobile/compact-height никогда не переписывает stored mode. Например,
  `/schedule?mode=week&weekday=7` показывает Sunday day UI на mobile и снова
  weekly grid после widening, сохраняя тот же URL.
- Filters остаются local state и не добавляются в URL.

### Responsive behavior
- `360 x 780`, `390 x 844`, `420 x 912`, `440 x 956`: day-only; no mode
  switch; filters/refresh → weekday strip → day grid → legend. Targets не
  меньше `44 x 44px`, page horizontal overflow отсутствует.
- `912 x 420`, `956 x 440` с coarse pointer: current compact-height media path
  остаётся day-only; mode не переписывается; filter temporary surface,
  weekday tabs и primary recovery остаются reachable без nested-scroll trap.
- `768 x 1024`: wide/tablet, visible mode switch, missing mode → week. Weekly
  grid может сохранить один existing contained horizontal viewport; day mode
  не использует его и помещается по ширине page content.
- `1440 x 1200`: wide/desktop, week default. Day grid ограничить примерно
  `max-width: 64rem` и выровнять по началу board, чтобы не растягивать lesson
  cards до нечитаемой строки; horizontal scroll отсутствует.
- Во всех режимах использовать `min-width: 0`, existing tokens/Onest/Mantine и
  не скрывать focus через indiscriminate overflow clipping.
- Safari chrome, safe-area, Dynamic Island, home indicator и software keyboard
  не объявляются проверенными только по desktop viewport emulation.

### Focus and operational states
- Focus order: toolbar/filter controls → wide mode switch → weekday strip в
  day mode → remaining interactive recovery controls. Schedule cards остаются
  non-interactive articles.
- History/viewport update не крадёт focus, пока focused node остаётся. Если
  wide day → week удаляет focused weekday tab, focus возвращается на selected
  mode segment; если wide → mobile удаляет focused mode control, focus идёт на
  selected weekday tab. Использовать deterministic refs, не positive tabindex.
- Initial loading: toolbar + `Загружаем расписание...`, без mode/grid.
- Global empty: current Admin/HeadCoach copy и filter/reset behavior; Coach
  zero-scope — current role-specific copy и только refresh.
- Whole filter-empty: current `По выбранным фильтрам занятий нет`, без mode.
- Selected-day empty: day strip/grid остаются, copy различает filtered и
  role-specific no-filter state.
- Initial error: current `Расписание не загрузилось` + `Повторить`, без grid.
- Stale error: current board, mode/weekday и stale data остаются доступны под
  error/retry; retry меняет только payload request state.
- Permission-restricted route остаётся ответственностью current App/session
  access resolution; screen не выводит новые permission rules.

## Implementation sequence

### minimal functional implementation
10. Добавить pure typed query helper `scheduleViewQuery.ts`; он владеет только
    `mode`/`weekday`, canonical repair и preservation unrelated URL state.
11. Добавить local schedule URL-state hook либо focused logic рядом с helper:
    one-time default weekday, replace-on-repair, push-on-user-change,
    popstate subscription и no-op guard. Не менять `useAppRoute`.
12. Заменить local `selectedWeekday` на URL-owned stored view state. Отделить
    stored mode от responsive effective mode; media-query effect не должен
    писать History API.
13. Реализовать wide-only `ScheduleModeSwitch` и refactor current mobile day
    rendering в reusable strip/time-grid components, сохранив mobile ids,
    data/card derivation и current operational copy.
14. Добавить roving tab/focus/tabpanel semantics и Arrow/Home/End handling.
    Реализовать focus fallback только когда responsive/mode change удалил
    focused control.
15. Добавить schedule-local CSS для mode switch, wide day layout, focus,
    `min-width: 0` и responsive geometry. Weekly contained viewport и mobile
    safe-area/filter behavior не перестраивать.
16. Если merged TASK-106 изменила `ScheduleCalendarCard`/parallel summary,
    использовать её current public/local render contract; не возвращать
    start-only cards и не менять cluster/conflict semantics в рамках TASK-112.

## Likely files and layers
- Schedule query/state helpers and their unit tests.
- `GroupScheduleScreen` mode/day controls, styles and component/history tests.
- Affected schedule Playwright specs for required portrait/landscape viewports.

## Constraints
- Backend owns schedule payload, permissions, access scope, weekly-template
  semantics, validation and conflict logic.
- `mode`/`weekday` are presentation state only and never become API params.
- `dd.MM` labels are non-interactive current-week presentation labels.
- Filters remain local and outside URL.
- Preserve React 19, TypeScript, Vite, Mantine 9, Onest, current theme tokens,
  API client, route access, filter panel and schedule card data.
- Mobile/compact-height is always effective day mode and must not overwrite
  stored wide mode.
- User history must remain finite and predictable: replace for repair, push
  for meaningful user change, no entry for viewport/payload/filter/no-op.
- Do not combine TASK-112 and TASK-106 in one branch or redefine overlap
  presentation as conflict semantics.

## Out of scope
- Backend/API/database changes.
- Dated event calendar, selectable date, week navigation or date-based query.
- Schedule filters in URL.
- Mobile weekly mode.
- Edit/create/move/cancel/drag-and-drop and conflict resolution.
- TASK-106 parallel-event readability implementation.
- General app-router, navigation shell, filter panel or design-system refactor.

## Regression specification

### Unit tests — before production code
- Pure parsing, validation, canonicalization, serialization, unrelated-query
  preservation and semantic no-op detection for schedule view query.
- Existing weekday/date/order/layout helper suite stays green; no backend
  business helper is duplicated.

### Integration tests — before production code
- `GroupScheduleScreen` + History API + popstate + media query + filters/reload
  interaction.
- Render-state matrix for loading, global/Coach/filter/day empty, initial/stale
  error and retry.
- ARIA tabs/tabpanel, roving tabindex, keyboard navigation and deterministic
  focus fallback.

Backend integration tests are not applicable: API request/response, database,
permissions and cross-service interactions do not change. The frontend
component/history tests are the relevant integration boundary.

### UI/E2E tests — before production code
- Wide default/mode switch/day selection, URL refresh/back/forward.
- Filter/manual/auto refresh and payload-state preservation.
- Wide/mobile/wide and compact-height transitions without stored-mode rewrite.
- Selected-day empty, filter-empty, stale/retry, keyboard and overflow.
- Target-iPhone WebKit acceptance at `420 x 912` and `440 x 956`; geometry at
  `390 x 844`, `912 x 420`, `956 x 440`, `768 x 1024`, `1440 x 1200`.

### Manual-only residual checks
- Real Safari chrome collapse/expand, safe-area/home indicator, Dynamic Island
  and physical software-keyboard behavior require Simulator or physical-device
  evidence. Manual QA supplements but does not replace automated barriers.

### Validation and acceptance
- [ ] Pure query tests written first and fail because helper is absent.
- [ ] Component/history integration tests written first and fail on missing
  wide mode/day URL behavior.
- [ ] Playwright workflow/responsive tests written first and fail for the
  expected missing UI/history behavior.
- [ ] Expected red state recorded before production code.
- [ ] Focused tests pass after minimal implementation.
- [ ] Full unit, lint and build pass.
- [ ] Affected Chromium and target-iPhone WebKit suites pass.
- [ ] No document overflow or nested-scroll trap on the required matrix.
- [ ] Manual/Safari checks not performed are explicitly reported.

## Regression barrier
The minimum production barrier is the combination of:
- pure query round-trip/canonicalization tests;
- `GroupScheduleScreen` history/media/filter/operational-state integration
  tests;
- `group-schedule.spec.ts` refresh/back-forward/auto-refresh/responsive/empty
  scenarios;
- shared overflow matrix and target-iPhone WebKit acceptance;
- full `test:unit`, `lint` and `build`.

No completion claim is allowed if only manual switching was checked, if new
tests were not observed red before implementation, or if viewport changes can
still mutate stored mode.

## Risks
- Query-only back/forward may not re-render through current pathname-only app
  router unless the schedule hook owns `popstate` correctly.
- Canonical repair can pollute browser history or lose unrelated state/hash if
  replace/push responsibilities are mixed.
- Media-query changes can accidentally overwrite stored mode or remount day
  state if stored/effective state are not separated.
- Midnight/timezone behavior can unexpectedly change default weekday unless
  canonicalization captures it once.
- Day-view refactor can regress mobile ids, empty copy, lane geometry, long
  labels, focus order or filter/refresh state.
- Active TASK-106 touches the same screen/CSS/tests; merge conflicts or stale
  assumptions are likely even though there is no branch dependency.
- Weekly tablet containment and day-mode no-scroll requirements can be
  conflated, producing either page overflow or an unnecessary nested scroller.

## Stop conditions
Остановиться и не писать production code, если:
- задача требует backend/API/database, permissions/access или schedule
  conflict changes;
- `День` начинает означать calendar date либо требует week navigation;
- filters должны быть перенесены в URL для выполнения acceptance;
- URL/history contract невозможно локализовать и требуется system-wide router
  redesign;
- актуальный merged TASK-106 изменил shared card/grid contract так, что reuse
  или ownership неясны;
- scope расширился за исходную TASK-112 или testable acceptance перестал быть
  однозначным.

Не останавливаться только из-за frontend-only responsive/history change,
shared Schedule module или необходимости согласовать обычный merge conflict с
TASK-106.
