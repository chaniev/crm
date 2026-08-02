# Implementation Plan: TASK-106 Сделать параллельные занятия читаемыми в desktop schedule

## Source task
/backlog/implementation/TASK-106-parallel-schedule-readability.md

## Implementation branch
fix/TASK-106-parallel-schedule-readability

Branch rules:
- перед изменением project code использовать
  `.agents/skills/task-worktree/SKILL.md` и создать либо безопасно возобновить
  отдельный worktree
  `../crm-worktrees/TASK-106-parallel-schedule-readability`;
- создать branch непосредственно от актуального `origin/main`; primary
  repository оставить на `main`, а код менять только в task worktree;
- до первой правки подтвердить registered worktree, active branch, отсутствие
  unexplained changes и `git merge-base --is-ancestor origin/main HEAD`;
- не включать другие schedule/backlog TASKs, backend/API changes или общий
  redesign календаря;
- Docker Compose по умолчанию не запускать: задача покрывается frontend unit,
  component и mocked Playwright tests.

Planning evidence на 2026-08-02: primary repository находится на clean `main`
`eeb471f3e5da3577a3a1566f43f9583bd6194d25`, совпадающем с локальным
`origin/main`; branch/worktree TASK-106 и дубликат implementation plan не
найдены. Executor обязан повторить проверку после `git fetch origin` и не
считать planning snapshot актуальным execution base.

## Goal
Coach, Administrator или HeadCoach на desktop schedule видит существование и
число параллельных занятий и определяет полный интервал, группу, зал и тренера
каждого события напрямую либо через один очевидный keyboard-accessible
drill-down. Высокая параллельность и длинные значения не превращают карточки в
`08:…`/`Б…`, не создают page-level overflow и не перестраивают mobile day
timeline.

## Evidence
- Source screenshot:
  `/backlog/processed/assets/2026-08-02-usability-audit/desktop-schedule-1440x1200.png`.
- На `1440 x 1200` screenshot показывает несколько одновременных карточек,
  сжатых до неразличимых fragments времени и названия.
- UX research и UI-design handoff выполнены на planning stage. Выбран
  desktop-only hybrid: readable individual cards для достаточно просторных
  overlap cases и grouped summary + Mantine Popover для dense/unreadable
  clusters.

## Current understanding
- `frontend/src/features/schedule/GroupScheduleScreen.tsx` рендерит desktop
  entries absolute-positioned по дням и использует тот же
  `ScheduleCalendarCard` для normal/overlap entries.
- При `entry.laneCount > 1` компонент сейчас показывает только start time,
  устанавливает `data-compact` и не даёт action для полных details.
- `frontend/src/App.css` скрывает у compact card hall/trainer metadata и
  ellipsizes title/time. DOM presence не делает эти данные понятными или
  доступными одним очевидным действием.
- `frontend/src/lib/groupSchedule.ts` вычисляет overlap lanes и делит ширину
  дня как `100 / laneCount`; cluster уже формируется внутри layout algorithm,
  но не экспортируется как desktop render model.
- `frontend/src/lib/groupSchedule.test.ts` защищает lane assignment, однако не
  проверяет cluster derivation/readability decision.
- `frontend/src/features/schedule/GroupScheduleScreen.test.tsx` проверяет API
  rendering и mobile day-strip keyboard behavior, но не disclosure для dense
  desktop clusters.
- `frontend/e2e/group-schedule.spec.ts` проверяет, что overlapping cards имеют
  разные `x`, и отсутствие document overflow, но не full decision-data при
  4–6 simultaneous events.
- Loading, role-specific empty, filtered empty, initial error и stale schedule
  paths уже принадлежат screen. Их semantics и временной контекст нужно
  сохранить.
- `/api/schedule/groups`, payload, permissions, access scope, conflict rules,
  time parsing и backend code не меняются. Backend tests и DB changes для
  TASK-106 не требуются.

## UX contract
- Пользователь: Coach / Administrator / HeadCoach, уже допущенный к Schedule
  backend contract. Frontend не выводит доступ или conflict semantics из role.
- Основной контекст: быстрое чтение недельной сетки на `1440 x 1200` при
  нескольких занятиях в одном временном cluster.
- Primary path: открыть `/schedule` → найти день/время → прочитать просторную
  event card либо активировать summary → увидеть полные details всех events →
  закрыть surface → продолжить scan с возвращённого focus.
- Completion signal: для каждого event известны start/end, group и
  hall/trainer; summary явно сообщает точное число скрытых в нём events.
- Required decision-data: weekday/date context, полный time range, group name,
  hall, trainer(s). Group type, branch, active state и participants сохраняются
  в details как существующий secondary context.
- Primary operation: прочитать и различить занятия. Frequent operations:
  filters, refresh и mobile day selection. Secondary operation: открыть dense
  cluster. Edit/create/resolve-conflict operations отсутствуют.
- Action budget: dense cluster раскрывает все обязательные данные одним click,
  Enter или Space с summary trigger.
- Failure/recovery: initial error и stale/retry сохраняют существующую board
  semantics; Escape/close возвращает focus к trigger, а при исчезновении
  trigger после filter/refresh — к schedule board.
- Measurable success: ни одна desktop overlap entry не остаётся start-only
  compact card без hall/trainer и без obvious disclosure.

## UI specification

### Desktop render decision
- Выделить pure presentation helper/render model для overlap clusters поверх
  уже отсортированных schedule entries. Не называть его conflict detector и не
  переносить в него backend business rules.
- Cluster с одной entry всегда остаётся обычной card: TASK-106 не меняет
  single-event presentation.
- Для overlap cluster определить:
  - `SCHEDULE_DENSE_CLUSTER_MIN_LANE_COUNT = 3`;
  - `SCHEDULE_MIN_READABLE_LANE_WIDTH_PX = 112`;
  - `SCHEDULE_MIN_READABLE_CARD_HEIGHT_PX = 84`;
  - effective width с учётом existing `SCHEDULE_LANE_GAP_PX`;
  - allocated card height из duration и desktop hour height с existing `54px`
    lower geometry bound.
- Render summary, если overlap cluster имеет `laneCount >= 3` либо хотя бы одна
  entry получает effective width `<112px` или allocated height `<84px`.
- Unsummarized two-lane cluster допустим только когда каждая card проходит оба
  readability threshold. Такие cards больше не используют current
  `laneCount > 1` compact rule: они показывают full time range, group и
  hall/trainer напрямую.
- Решение по ширине должно зависеть от измеренной day-column width, например
  через один local ResizeObserver/use-resize hook, а не от text measurement,
  user-agent branching или duplicated DOM. До первого достоверного measurement
  использовать консервативный state, который не показывает unreadable overlap
  cards.
- Summary заменяет individual cards данного cluster; скрытые cards не остаются
  под ним в DOM как competing/readable surfaces.

### Summary trigger
- Semantic `<button type="button">`, full-width внутри day column с `6px`
  inset, positioned от minimum cluster start до maximum cluster end.
- Minimum hit area `44 x 44px`; minimum visual height сохраняет existing
  `54px`, но не растягивает cluster поверх следующего non-overlapping event.
- Visible content:
  1. `{clusterStart} - {clusterEnd} · {count} занятий`;
  2. первые две group names и `+N`, если events больше двух;
  3. hall/trainer counts только при фактической высоте не меньше `72px`.
- Exact count всегда видим; существование ни одного event не маскируется.
- Accessible name:
  `{weekday} {date}, {start} - {end}: {count} параллельных занятий. Открыть детали`.
- Использовать `aria-haspopup="dialog"`, `aria-expanded`, stable
  `aria-controls`; `:focus-visible` — `2px` theme selection outline.
- Palette может показать максимум шесть existing type dots и `+N`, без новых
  raw colors или global tokens.

### Detail Popover
- Использовать Mantine `Popover`, потому что read-only details контекстны
  конкретному time block; не вводить mobile Drawer или route-level Modal.
- Required behavior: `withinPortal`, `trapFocus`, `closeOnEscape`, viewport
  collision/fallback, width `min(420px, calc(100vw - 32px))`, max height
  `min(520px, calc(100dvh - 32px))`.
- Только detail list может иметь intentional vertical scrolling. Не добавлять
  horizontal scroll, row-level nested scroll или второй temporary surface.
- Heading: `Параллельные занятия`. Explicit close control:
  `Закрыть детали параллельных занятий`.
- Native button activation поддерживает Enter/Space. При open focus переходит
  на close control либо heading с `tabIndex=-1`; Escape/close возвращает focus
  к summary trigger, если он существует.
- Если filter/successful refresh удалил open cluster, закрыть Popover и
  перевести focus на surviving trigger либо `schedule-board`. Stale refresh
  error не закрывает details и не отключает уже видимые данные.

### Detail rows
- Рендерить семантический list; каждая row показывает:
  - full `start - end`;
  - full group name;
  - existing group type chip;
  - `hallName · branchName`;
  - comma-separated full trainer names или `Тренер не назначен`;
  - participants count;
  - `Неактивна`, когда `!group.isActive`.
- Long group/hall/trainer text переносится; ellipsis не является единственным
  способом получить полное значение.
- Row accessible name содержит time, group, type, hall, branch, trainers,
  participants и inactive state.
- Не добавлять edit/open-group links или отдельные row actions.
- Fixture `6` simultaneous events является regression stress case, но
  production list не получает hard cap и отображает точный count для любого
  payload.

### Responsive behavior
- `1440 x 1200`: основной acceptance target; dense cluster показывает одну
  summary и полный list после одного action; document/body не overflow.
- `768 x 1024`: если current media query выбирает desktop grid, применить тот
  же measured threshold. Сохранить существующий intentional board viewport,
  но не создавать новый nested-scroll layer или page overflow.
- `360 x 780`, `390 x 844`, `420 x 912`, `440 x 956`: сохранить selected-day
  mobile timeline, day strip, filters и existing event rendering; desktop
  summary/Popover отсутствует.
- `912 x 420`, `956 x 440`: при coarse pointer сохраняется mobile branch; при
  fine pointer Popover ограничен `100dvh - 32px`, close остаётся reachable.
- Mobile smoke должен доказать сохранение task-first order и отсутствие weekly
  desktop table, а не объявлять исправленной mobile high-density readability,
  которая не подтверждена scope.
- На всех representative sizes: no document-level horizontal overflow; long
  content не расширяет Popover/page.

### Operational states
- Initial loading: сохранить current `LoadingState`, не показывать empty-like
  summary skeleton.
- Global/filtered/Coach zero-scope empty: сохранить current copy и refresh/
  filter availability.
- Initial error: сохранить current `ErrorState` и `Повторить`.
- Stale refresh error: board, summary и открытые details остаются доступными
  под current error panel; stale data не выглядит как пустое расписание.
- Successful refresh/filter: обновить surviving cluster rows; закрыть orphaned
  Popover с defined focus fallback.
- Никаких disabled/pending/success controls не добавляется: TASK read-only.

## Execution roles
1. `ux-researcher` contract выполнен на planning stage: зафиксированы primary
   task, decision-data, one-action disclosure и failure/recovery paths.
2. `ui-designer` handoff выполнен на planning stage: зафиксированы hybrid
   threshold, summary geometry, Popover, detail fields, focus и responsive
   behavior.
3. `test-automator` до production-кода добавляет unit/component/Playwright red
   regressions и после implementation закрывает desktop/mobile matrix.
4. `react-specialist` только после подтверждённого red state реализует
   минимальные React/Mantine/CSS changes по этому contract, применяя
   `.agents/skills/react-best-practices/SKILL.md`.
5. Координирующий агент проверяет worktree, test-first evidence и результат
   против UX/UI contract; backend/domain changes не делегируются.

## Execution steps

### Phase 0 — task workspace and baseline
1. Выполнить `git fetch origin`, перечитать root/frontend `AGENTS.md`, source
   TASK, этот plan, `crm-mobile-first-ui`, `react-best-practices` и
   `task-worktree`; создать/возобновить declared branch/worktree и вернуть
   verified path, branch, base и current commit.
2. До новых assertions запустить focused baseline:
   `cd frontend && npm run test:unit -- src/lib/groupSchedule.test.ts src/features/schedule/GroupScheduleScreen.test.tsx`
   и `npm run test:e2e -- group-schedule.spec.ts`. Отделить pre-existing
   failures от ожидаемого TASK-106 red state.
3. Source-search подтвердить consumers current lane/compact CSS, test ids,
   schedule viewport contract и Mantine Popover patterns. Не менять backend,
   API types или unrelated shared components.

### Phase 1 — tests before functional code
4. До production-кода расширить `frontend/src/lib/groupSchedule.test.ts`:
   - single event не classified как parallel cluster;
   - exact same-time 2/3/6 events и transitive partial overlaps образуют
     deterministic clusters в chronological/stable order;
   - boundary `end === next.start` начинает новый cluster;
   - readability helper сохраняет roomy/tall 2-lane cards, но summarizes 3+
     lanes, width `<112px` и height `<84px`;
   - long names и count >6 не теряют entry identity и не получают hard cap;
   - helper не меняет time parsing, lane assignment или group references.
5. До production-кода расширить
   `frontend/src/features/schedule/GroupScheduleScreen.test.tsx` с mocked API
   fixture на шесть одновременных events:
   - desktop рендерит один summary trigger, exact count и не рендерит шесть
     unreadable competing cards;
   - accessible name содержит weekday/date/full cluster range/count;
   - click и Enter/Space открывают `Параллельные занятия`;
   - visible detail rows содержат full time/group/hall/branch/trainer для всех
     six events, long text и inactive/fallback state;
   - Escape и explicit close закрывают Popover и возвращают focus;
   - filter/refresh orphan close имеет schedule-board focus fallback;
   - roomy two-lane entries остаются full readable cards, без start-only
     compact state;
   - initial loading/error, Coach/global/filtered empty и stale board tests
     сохраняются.
6. До production-кода добавить focused Playwright scenario в
   `frontend/e2e/group-schedule.spec.ts` на `1440 x 1200`:
   - fixture: six parallel events, long Russian group/hall/trainer values,
     inactive and trainer-missing edges;
   - summary visible, full count/range and stable accessible name;
   - Tab/Enter либо focus/Enter открывает details; все required decision-data
     visible после одного action;
   - Escape closes, trigger focused; explicit close тоже проверен;
   - no individual card представлен только `08:…`/single-fragment surface;
   - `documentElement`/`body.scrollWidth <= innerWidth + 1`;
   - Popover и rows не имеют horizontal/nested-scroll trap.
7. До production-кода расширить mobile preservation coverage:
   - `group-schedule.spec.ts` проверяет normal selected-day timeline на
     `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420`, `956 x 440`, отсутствие
     desktop summary и weekly grid в mobile/coarse-pointer path;
   - при необходимости добавить один schedule smoke в
     `iphone-target-devices.spec.ts`, выполняемый обоими WebKit target projects,
     без объявления real-device Safari acceptance.
8. Запустить новые focused unit/component и Playwright tests на неизменённом
   production-коде. Сохранить expected red evidence: cluster/readability helper
   отсутствует; current UI даёт six tiny start-only cards; summary, Popover и
   focus-return contract отсутствуют. Failure из-за broken mock/selector или
   unrelated baseline не считается корректным red state.

### Phase 2 — minimal functional implementation
9. Экспортировать local presentation cluster/readability helpers из
   `groupSchedule.ts`, переиспользуя existing sorted entry boundaries и не
   создавая альтернативную conflict semantics.
10. В desktop grid измерить day-column width одним shared/local observer,
    построить render items и заменить только dense/unreadable overlap clusters
    на full-column summary triggers. Mobile path не подключать к этому state.
11. Развязать `data-compact` и `timeLabel` от raw `laneCount > 1`: surviving
    roomy two-lane cards показывают full time/group/hall/trainer; summary
    исключает узкие/короткие cards.
12. Реализовать local schedule summary/Popover component. Предпочесть новый
    `ScheduleParallelEventsPopover.tsx`, если inline implementation ещё больше
    раздувает `GroupScheduleScreen.tsx`; не создавать global abstraction.
13. Добавить controlled `openedClusterKey`, close/reconcile behavior при
    filter/refresh, explicit focus return/fallback и stable ids. Не хранить
    stale copied API entities, если cluster можно derive из current data.
14. Добавить только schedule-local theme-token CSS для summary, wrapped detail
    rows, focus, viewport bounds и single list scroll. Не менять overall shell,
    board viewport, breakpoints или mobile event hierarchy.

### Phase 3 — green and regression closure
15. Повторно запустить focused unit/component, desktop dense Playwright и
    mobile preservation tests; исправлять production code по contract, не
    ослаблять decision-data/focus/overflow assertions.
16. Запустить обязательные frontend checks из task worktree:
    - `cd frontend && npm run test:unit`;
    - `npm run lint`;
    - `npm run build`;
    - `npm run test:e2e -- group-schedule.spec.ts responsive-main-screens.spec.ts`;
    - `npm run test:e2e:iphone`.
17. Выполнить source/DOM review: нет start-only undisclosed desktop overlap
    cards, duplicate hidden cards под summary, hard-capped events, frontend
    permission/conflict inference, raw colors, orphaned Popover state, new
    page-level overflow или unrelated files.
18. Провести manual keyboard/200% zoom check at `1440 x 1200` и, если доступен,
    Safari Responsive Design Mode/iOS Simulator smoke для mobile preservation.
    Непроверенное device behavior указать как residual risk; manual QA не
    заменяет automated regression barrier.

## Preferred implementation strategy
1. Pure cluster/readability tests and component/Playwright disclosure tests in
   red state.
2. One presentation-only cluster render model derived from existing entries.
3. Desktop summary + one controlled Mantine Popover for unreadable clusters.
4. Direct full metadata for surviving readable two-lane cards.
5. Focus/refresh reconciliation, full frontend regression and mobile WebKit
   preservation checks.

## Files likely to change
- `frontend/src/lib/groupSchedule.ts`
- `frontend/src/lib/groupSchedule.test.ts`
- `frontend/src/features/schedule/GroupScheduleScreen.tsx`
- `frontend/src/features/schedule/ScheduleParallelEventsPopover.tsx` (new,
  preferred if local extraction keeps the screen focused)
- `frontend/src/features/schedule/GroupScheduleScreen.test.tsx`
- `frontend/src/App.css`
- `frontend/e2e/group-schedule.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts` (only if schedule overflow or
  representative desktop contract needs a focused assertion)
- `frontend/e2e/iphone-target-devices.spec.ts` (only for target-device schedule
  preservation smoke)

Files to inspect but not expected to change:
- `frontend/src/lib/api/schedule.ts`
- `frontend/src/lib/api/types.ts`
- `frontend/src/features/shared/ux.tsx`
- backend schedule endpoints/tests

## Constraints
- Backend остаётся единственным владельцем schedule data, permissions, access
  scope, validation и conflict semantics.
- Не менять API request/response, database, routes, roles, filters, refresh
  interval, time parsing или group edit behavior.
- Сохранить React 19, TypeScript, Vite, Mantine 9, Onest, existing design
  tokens и schedule type palette; не добавлять component library или raw color.
- Desktop summary не скрывает точное event count и даёт required data за один
  obvious action.
- Не оставлять start-only/ellipsis-only desktop overlap card без disclosure.
- Mobile selected-day timeline, day strip, task order, safe-area/shell behavior
  и breakpoint остаются существующими.
- Сохранить current intentional schedule board viewport contract; не добавлять
  page-level horizontal scroll или новый nested scroll.
- Popover focus trap, Escape, close, focus return/fallback и long-content
  wrapping являются implementation contract, а не manual polish.
- Не создавать global state/abstraction или refactor shared schedule code сверх
  локальной необходимости TASK-106.

## Out of scope
- Schedule conflict detection/validation, automatic resolution, hall capacity
  и trainer availability rules.
- Create/edit/open-group actions, drag/drop, resize, cancellation,
  substitution и attendance behavior.
- Backend/API/DB changes.
- Week navigation, dated event model или timezone semantics.
- Redesign mobile high-density event layout без отдельного подтверждённого
  evidence/product scope.
- Общий redesign filters, legend, shell, schedule colors или typography.

## Required test coverage

### Unit tests — write before production code
- Pure overlap cluster grouping: independent, exact, transitive and boundary
  cases; deterministic order and identity preservation.
- Pure readability decision: lane count `2/3/6`, measured width around `112px`,
  allocated height around `84px`, lane gap and unknown-measurement fallback.
- Existing lane assignment, visible hour range, filters and time formatting
  remain green.

### Component/integration tests — write before production code
- Full `GroupScheduleScreen` with mocked `/api/schedule/groups`: summary render,
  exact count, full detail list, accessible names, keyboard activation,
  Escape/close/focus return and orphaned-trigger recovery.
- Readable two-lane vs summarized narrow/short cluster behavior.
- Long strings, six events, no-trainer fallback and inactive badge.
- Existing loading, empty, filtered empty, initial error and stale schedule
  behavior remains observable.
- Backend integration tests are not applicable: TASK-106 changes no API,
  permission, persistence or cross-service contract. TypeScript build plus
  mocked component/Playwright payloads are the nearest contract barrier.

### UI/e2e tests — write before production code
- `1440 x 1200` primary path and one-action full decision-data.
- Summary accessible name, Enter/Space, Escape, explicit close, visible focus
  and focus return.
- Long group/hall/trainer names and six events without document/body overflow.
- `768 x 1024` desktop-grid containment when current breakpoint applies.
- Mobile preservation at `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420`,
  `956 x 440`; target-iPhone WebKit smoke when added.
- Screenshot may supplement but must not replace behavior/geometry assertions.

### Regression priority
High for frontend presentation: the screen is shared by three operational roles,
current tests can pass while decision-data is visually unusable, and focus
behavior is newly introduced. Domain/API risk remains low because contracts do
not change.

### Manual-only checks
- Visual balance of summary at 200% zoom and unusual desktop scaling.
- Real Safari chrome/safe-area/mobile preservation if Simulator or device is
  available. These are reported residual checks, not substitutes for automated
  tests.

## Test plan
- [ ] До production-кода добавить unit tests для cluster/readability helpers.
- [ ] До production-кода добавить component/integration tests для
      summary/Popover/focus/states.
- [ ] До production-кода добавить Playwright desktop dense fixture и mobile
      preservation assertions.
- [ ] Запустить новые tests на unchanged production code и сохранить ожидаемый
      red по отсутствующей TASK-106 functionality.
- [ ] Реализовать минимальный desktop presentation change.
- [ ] `cd frontend && npm run test:unit`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:e2e -- group-schedule.spec.ts responsive-main-screens.spec.ts`
- [ ] `cd frontend && npm run test:e2e:iphone`
- [ ] Manual keyboard/200% zoom и residual Safari/device report.

## Regression barrier
Primary barrier: pure unit tests lock deterministic overlap clusters and the
`112px` width / `84px` height / `3+ lanes` summary decision without changing
schedule semantics.

Interaction barrier: component tests lock one summary, complete visible detail
rows, stable accessible names, Escape/close, focus return and stale/orphan
recovery before production code is written.

User-task barrier: Playwright at `1440 x 1200` proves that six parallel events
with long values expose full time/group/hall/trainer in one action and do not
overflow the document; mobile and target-iPhone smoke protect the existing day
timeline.

## Risks
- Reimplementing overlap detection separately can drift from lane layout and
  accidentally mimic domain conflict semantics. Derive one presentation model
  from existing entries and cover transitive/boundary cases.
- Layout measurement can cause unreadable first-frame flash, observer loops or
  excess renders. Use one column measurement source and conservative unknown
  state; do not measure text.
- Two-lane cards can still lose data if compact state remains tied to
  `laneCount`. Tests must reject any undisclosed start-only card.
- Popover portal/long strings can introduce overflow, clipped close control or
  broken focus return after refresh. Cover geometry and orphaned trigger.
- DOM text assertions can pass for CSS-hidden content. E2E must open the
  Popover and assert visible rows, not merely `toContainText` on hidden cards.
- A six-event fixture is a stress baseline, not a production hard cap.
- Existing board has an intentional internal desktop/tablet viewport contract;
  TASK-106 must not turn it into page overflow or add a second scroll trap.

## Stop conditions
Остановиться и не писать production-код, если:
- required grouping cannot be derived as frontend presentation without
  changing backend conflict/permission semantics;
- implementation requires API/DB/auth/role changes;
- product requires edit/navigation/resolve-conflict actions in detail rows;
- safe solution requires a material redesign of mobile day timeline;
- target cluster identity/focus behavior cannot remain stable across current
  filter/refresh lifecycle;
- scope expands into global schedule/calendar redesign or shared component
  refactor.

Не останавливаться только потому, что Schedule shared между ролями или потому,
что responsive measurement/component tests затрагивают несколько frontend
files.

## Ready for Codex execution
yes
