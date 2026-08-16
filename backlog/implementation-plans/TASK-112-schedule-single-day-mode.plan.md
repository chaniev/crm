# Implementation Plan: TASK-112 Добавить однодневный режим недельного расписания

## Source task
/backlog/implementation/TASK-112-schedule-single-day-mode.md

## Implementation branch
feature/TASK-112-schedule-single-day-mode

Branch rules:
- перед изменением project code прочитать
  `.agents/skills/task-worktree/SKILL.md` и создать либо безопасно возобновить
  отдельный worktree
  `../crm-worktrees/TASK-112-schedule-single-day-mode`;
- создать branch непосредственно от актуального `origin/main`; primary
  repository оставить на `main`, а код менять только в task worktree;
- до первой правки подтвердить registered worktree, active branch, clean
  status и `git merge-base --is-ancestor origin/main HEAD`;
- не включать TASK-106, другие schedule/backlog TASKs, backend/API changes или
  общий redesign routing/calendar;
- Docker Compose по умолчанию не запускать: задача покрывается frontend unit,
  component/integration, mocked Playwright и target-iPhone WebKit tests.

Planning evidence на 2026-08-16: до backlog-подготовки primary repository был
на clean `main` `d0d65dc19411e8ed9c12c3ef0844910a09bea0ea`, совпадающем с
локальным `origin/main`; branch/worktree TASK-112 и дубликат plan не найдены.
Executor обязан повторить проверку после `git fetch origin` и не считать этот
planning snapshot актуальным execution base.

## Goal
Coach, Administrator или HeadCoach на tablet/desktop может переключить
существующее read-only расписание между недельной сеткой и одним выбранным
weekday повторяющегося недельного шаблона. На mobile и compact-height остаётся
day-only workflow. Stored mode и weekday воспроизводятся из URL после refresh,
back/forward, фильтрации, обновления payload и смены viewport без введения
dated-calendar semantics.

## Planning handoff
- `ux-researcher` на planning stage подтвердил primary path, action budget,
  URL/viewport semantics, operational states и отсутствие blocking product
  questions.
- `ui-designer` преобразовал UX-контракт в implementation-ready specification:
  wide-only Mantine mode switch, переиспользуемый day view, точную history
  policy, tab/focus semantics и responsive matrix.
- Product decision закрыт source TASK: `День` означает weekday повторяющегося
  weekly template; `dd.MM` остаётся presentation-only label.

## Current understanding
- `frontend/src/features/schedule/GroupScheduleScreen.tsx` получает весь
  разрешённый payload через `/api/schedule/groups`, строит одну calendar week
  и сейчас хранит `selectedWeekday` только в local React state.
- `ResponsiveScheduleContent` выбирает mobile day grid через
  `(max-width: 47.99em), (max-height: 30rem) and (pointer: coarse)`; wide path
  всегда рендерит seven-column `ScheduleDesktopGrid`.
- Текущий day strip уже имеет `role="tablist"`, `role="tab`, `aria-selected`,
  click и ArrowLeft/ArrowRight, но все tabs остаются в tab order и Home/End не
  реализованы.
- `frontend/src/App.tsx` хранит и обновляет только normalized pathname.
  Query-only browser navigation не является state этого router, поэтому
  schedule feature должен локально читать `window.location.search`, писать
  History API и слушать `popstate`; общий router менять не требуется.
- Filters, manual reload, 60-second auto refresh, current-week presentation
  labels, loading/error/stale/empty states и type legend уже принадлежат
  screen. View state не должен зависеть от schedule payload или filter state.
- `frontend/src/App.css` содержит отдельные weekly и mobile-day surfaces.
  Weekly grid намеренно может иметь один contained horizontal viewport на
  tablet; wide day view не должен наследовать этот x-scroll.
- `frontend/src/lib/groupSchedule.ts` уже сортирует entries по start time и
  вычисляет overlap lanes/grid metrics. TASK-112 не меняет эту presentation
  math и не вводит conflict/domain rules.
- Existing tests: pure schedule helpers в `groupSchedule.test.ts`, component
  coverage в `GroupScheduleScreen.test.tsx`, browser/responsive behavior в
  `group-schedule.spec.ts`, `responsive-main-screens.spec.ts` и target-iPhone
  projects.
- Backend/API/database/permissions contracts не меняются; backend tests и DB
  migration для TASK-112 не требуются.

## UX contract
- Пользователь: Coach / Administrator / HeadCoach, уже допущенный к Schedule
  backend contract. Существующий SuperAdministrator global view остаётся
  regression edge, но новые role rules не добавляются.
- Результат: пользователь фокусируется на одном weekday и читает занятия в
  хронологическом порядке, сохраняя возможность вернуться к week overview на
  wide viewport.
- Primary path wide: `/schedule` → `День` → weekday → day time grid → следующий
  weekday. Week overview остаётся default и доступен без дополнительных
  действий.
- Primary path mobile/compact-height: `/schedule` → weekday strip → day time
  grid → следующий weekday; mode control отсутствует.
- Completion signal: выбранный tab имеет `aria-selected="true"`, day panel
  связан с ним через ARIA и рендерит только entries выбранного weekday либо
  точное day-empty состояние.
- Primary/frequent controls: mode switch на wide, weekday tabs, filters и
  refresh. Secondary/recovery: reset filters, retry. Type legend — supporting
  information.
- Unmapped/out of scope controls: date picker, Today/previous/next week,
  edit/create/move/cancel, drag-and-drop и conflict resolution.
- Required information сохраняет current contract: weekday, presentation-only
  `dd.MM`, lesson count/current marker, time axis, full time, group, type,
  hall/trainer, participants и inactive state в пределах существующей card
  presentation.
- Нельзя добавлять route subtitle, helper panel или copy, создающие впечатление
  выбора конкретной календарной даты.

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

## Execution roles
1. UX contract и UI specification выполнены на planning stage и являются
   implementation input.
2. `test-automator` до production-кода добавляет pure unit,
   component/integration и Playwright red regressions, затем закрывает
   responsive и target-iPhone matrix.
3. `react-specialist` только после подтверждённого red state реализует
   минимальные React/Mantine/history/CSS changes, применяя
   `.agents/skills/react-best-practices/SKILL.md`.
4. Координирующий агент проверяет worktree, test-first evidence, URL history,
   UX/UI contract и сохранение backend-owned semantics.
5. Если актуальный `origin/main` уже содержит TASK-106 и её shared card/render
   model изменился, executor адаптирует TASK-112 к merged contract. Код из
   unmerged TASK-106 branch не копируется и branch dependency не создаётся.

## Execution steps

### Phase 0 — isolated workspace and baseline
1. Выполнить `git fetch origin`; перечитать root/frontend `AGENTS.md`, source
   TASK, этот plan, `crm-mobile-first-ui`, `react-best-practices` и
   `task-worktree`; создать/возобновить declared branch/worktree и вернуть
   verified path, branch, base commit и clean status.
2. Проверить, merged ли TASK-106 в актуальный `origin/main`, и зафиксировать
   current schedule card/grid contract. Не ждать TASK-106 автоматически и не
   основывать TASK-112 на её unmerged branch; при одновременной работе
   уведомить integration owner об overlapping files.
3. До новых assertions запустить focused baseline:
   - `cd frontend && npm run test:unit -- src/lib/groupSchedule.test.ts src/features/schedule/GroupScheduleScreen.test.tsx`;
   - `npm run test:e2e -- group-schedule.spec.ts responsive-main-screens.spec.ts`.
   Отделить pre-existing failures от ожидаемого TASK-112 red state.
4. Source-search подтвердить current consumers schedule media query, History
   API/popstate, mobile ids, filter drawer, card modes и overflow contract. Не
   менять backend, API types, app route model или unrelated shared components.

### Phase 1 — tests before functional code
5. До production-кода создать
   `frontend/src/features/schedule/scheduleViewQuery.test.ts` и описать pure
   query contract:
   - exact round-trip `week/day` и weekdays `1..7`;
   - missing values canonicalize to `week` + injected local weekday;
   - unknown, blank, duplicate, `0`, `8`, decimal и non-numeric values fail
     closed and repair deterministically;
   - unrelated query params/hash composition сохраняются;
   - serialization не мутирует input, заменяет только owned keys и даёт
     stable canonical result;
   - same semantic state определяется как no-op.
6. До production-кода расширить `GroupScheduleScreen.test.tsx` как frontend
   integration barrier:
   - wide `/schedule` canonicalizes через `replaceState`, выбирает `week`,
     показывает mode switch и weekly grid;
   - wide `?mode=day&weekday=7` показывает только Sunday day panel и сохраняет
     chronological entries;
   - invalid query repair использует `replaceState`, сохраняет
     `history.state`/unrelated query и не вызывает runtime error;
   - click по mode/weekday использует ровно один `pushState`; semantic no-op
     не создаёт entry;
   - `popstate` на том же pathname восстанавливает mode/weekday;
   - mobile/compact query `mode=week` скрывает mode switch, показывает stored
     weekday и не переписывает mode; widening восстанавливает week;
   - filter apply/reset, manual refresh, fake-timer auto refresh, payload
     success/stale error не сбрасывают query/view;
   - initial/global/Coach/filter empty скрывают mode control; selected-day
     empty сохраняет strip/panel и точную copy;
   - tabs имеют roving tabindex, `aria-controls`/tabpanel, ArrowLeft/Right,
     Home/End, wrapping, focus и visible-focus class contract.
7. До production-кода расширить `frontend/e2e/group-schedule.spec.ts`:
   - `1440 x 1200` URL without params repairs/defaults to weekly grid; mode
     switch доступен и имеет target не меньше `44px`;
   - wide `День` + Tuesday создаёт URL, показывает только Tuesday day grid;
     full reload сохраняет selection;
   - browser Back/Forward проходит weekday/mode history без extra entries;
   - filters/reset, manual refresh и `page.clock.fastForward(60_000)` auto
     refresh сохраняют URL и visible day;
   - `1440 → 390 → 1440` и `768 → compact-height → 768` показывают effective
     day UI на narrow/coarse viewport, не меняют stored mode и восстанавливают
     wide mode;
   - empty selected weekday, filtered empty и stale/retry сохраняют current
     temporal context;
   - Arrow/Home/End, `aria-selected`, roving focus и tabpanel association;
   - long group/type/hall/trainer values и viewport matrix не создают document
     overflow; day mode не получает x-scroll/nested-scroll trap.
8. При необходимости до production-кода добавить focused schedule case в
   `responsive-main-screens.spec.ts` и/или `iphone-target-devices.spec.ts`,
   только если current shared matrix не может доказать geometry/target-device
   behavior без дублирования fixture.
9. Запустить новые unit/component/integration и Playwright tests на неизменённом
   production code. Зафиксировать expected red evidence: query helpers и mode
   switch отсутствуют; selected weekday не восстанавливается; wide day mode,
   Home/End и query-only popstate behavior отсутствуют. Broken mock/clock/
   selector или unrelated baseline failure не считается корректным red state.

### Phase 2 — minimal functional implementation
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

### Phase 3 — green and regression closure
17. Повторно запустить focused unit/component/integration и Playwright tests;
    исправлять production code по contract, не ослаблять URL, focus, state или
    overflow assertions.
18. Запустить обязательные frontend checks из task worktree:
    - `cd frontend && npm run test:unit`;
    - `npm run lint`;
    - `npm run build`;
    - `npm run test:e2e -- group-schedule.spec.ts responsive-main-screens.spec.ts`;
    - `npm run test:e2e:iphone`.
19. Выполнить source/DOM review: нет frontend permission/date/conflict logic,
    filters в query, duplicate responsive DOM с competing ids, positive
    tabindex, viewport-driven mode rewrite, leaked popstate listener, raw
    colors или нового page/nested overflow.
20. Выполнить manual keyboard/200% zoom smoke на `768 x 1024` и
    `1440 x 1200`. Если доступны Safari Responsive Design Mode/iOS Simulator
    или physical target iPhones, проверить browser chrome, safe area и
    compact-height; непроверенное device behavior указать residual risk.

## Preferred implementation strategy
1. Pure query tests → component/history integration tests → Playwright red
   scenarios.
2. Один typed schedule-owned stored URL state, отдельный от responsive
   effective mode и payload/filter state.
3. Переиспользование current day strip/time grid и cards без новой domain
   model.
4. Wide-only mode control и bounded one-day layout с локальным CSS.
5. Green focused suite → full frontend regression → target-iPhone WebKit.

## Files likely to change
- `frontend/src/features/schedule/scheduleViewQuery.ts` (new)
- `frontend/src/features/schedule/scheduleViewQuery.test.ts` (new)
- `frontend/src/features/schedule/GroupScheduleScreen.tsx`
- `frontend/src/features/schedule/GroupScheduleScreen.test.tsx`
- `frontend/src/App.css`
- `frontend/e2e/group-schedule.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts` (only for focused geometry
  contract not already covered by group schedule spec)
- `frontend/e2e/iphone-target-devices.spec.ts` (only if current target-iPhone
  project selection needs an explicit schedule case)

Files to inspect but not expected to change:
- `frontend/src/App.tsx`
- `frontend/src/lib/appRoutes.ts`
- `frontend/src/lib/groupSchedule.ts`
- `frontend/src/lib/groupSchedule.test.ts`
- `frontend/src/lib/api/schedule.ts`
- `frontend/src/lib/api/types.ts`
- backend schedule endpoints/tests

If `GroupScheduleScreen.tsx` remains too large after extracting pure query
logic, a focused local `ScheduleDayView.tsx` extraction is allowed. Do not
create a shared/global abstraction only for this task.

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

## Required test coverage

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

## Test plan
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

## Ready for Codex execution
yes
