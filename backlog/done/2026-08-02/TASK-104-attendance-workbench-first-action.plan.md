# Implementation Plan: TASK-104 Поднять первое действие attendance workbench выше сгиба

## Source task
/backlog/done/2026-08-02/TASK-104-attendance-workbench-first-action.md

## Implementation branch
fix/TASK-104-attendance-workbench-first-action

Branch rules:
- перед изменением project code использовать
  `.agents/skills/task-worktree/SKILL.md` и создать либо безопасно возобновить
  отдельный worktree
  `../crm-worktrees/TASK-104-attendance-workbench-first-action`;
- создать branch непосредственно от актуального `origin/main`; primary
  repository оставить на `main`, а код менять только в task worktree;
- до первой правки подтвердить registered worktree, active branch, отсутствие
  unexplained changes и `git merge-base --is-ancestor origin/main HEAD`;
- не включать TASK-103, другие backlog-задачи, backend/API changes или общий
  redesign Home/attendance/navigation;
- Docker Compose по умолчанию не запускать: задача покрывается frontend
  component, mocked Playwright и target-iPhone WebKit checks.

Planning evidence на 2026-08-02: primary repository находится на clean `main`
`7ef8662b9032ff70cd0dc21479851738674eb27d`, совпадающем с локальным
`origin/main`; локальной или remote branch TASK-104 и назначенного ей worktree
не найдено. Executor обязан повторить проверку после `git fetch origin` и не
считать этот planning snapshot актуальным execution base.

## Goal
Тренер или администратор с backend-разрешённым attendance scope проверяет
группу, дату и прогресс и может отметить первого клиента без предварительного
скролла. В portrait и compact landscape дата остаётся полностью читаемой,
secondary controls не вытесняют primary row action, а row-local
pending/error/retry feedback сохраняется.

## Visual reference
- Mockup: `/backlog/implementation-plans/assets/TASK-104-attendance-workbench-after.png`
- Generation prompt: `/backlog/implementation-plans/assets/TASK-104-attendance-workbench-after.prompt.md`

Макет показывает целевую hierarchy для `390 x 844` и compact landscape
`912 x 420`. Это visual handoff, а не замена UX/UI contract, responsive
acceptance criteria или automated geometry checks из этого plan.

## Current understanding
- `AttendanceWorkspace` уже получает полный authoritative roster и хранит
  отдельные `displayedState`/`persistedState`, row save state, request versions
  и context versions. Эти гарантии защищают confirmed progress, exact retry и
  stale-response races и не должны переписываться.
- Текущая композиция рендерит `AttendanceContextControls`, затем отдельный
  `PageSection` с `SectionHeader`, повторяющим выбранную группу, schedule/client
  metadata и дату badge, затем progress/view/refresh. На зафиксированном
  `390 x 844` этот повтор отодвигает первый status action под fixed bottom
  navigation.
- `AttendanceContextControls` использует grid
  `minmax(0, 1fr) auto`: cluster previous/today/next сохраняет ширину, а date
  input может сжаться до пустого квадрата. Наблюдаемая регрессия подтверждена
  asset `annotated-attendance-landscape-912x420.png`.
- `AttendanceProgress`, `AttendanceRosterViewControl` и shared refresh action
  уже имеют нужные semantics и могут быть переиспользованы в compact mode без
  нового domain state или global store.
- `AttendanceClientRow` уже держит status controls и
  `AttendanceSaveStatus` внутри строки. Benign copy `Отметка доступна на
  выбранную дату` не меняет решение и создаёт лишнюю высоту; professional и
  membership warning/recovery information остаётся decision-changing.
- Current component tests уже защищают failed-row retry, pending refresh lock,
  authoritative progress, reset, scope revoke и stale response ordering.
  Их нужно сохранить и расширить структурным compact-header contract.
- `frontend/e2e/attendance.spec.ts` покрывает primary save flow на `390 x 844`,
  но не проверяет above-fold geometry. `responsive-main-screens.spec.ts`
  проверяет no-overflow на portrait matrix, однако attendance-specific geometry
  есть только для `320px`. `iphone-target-devices.spec.ts` пока не содержит
  target-device attendance roster acceptance.
- Backend contract, attendance semantics, membership validation, permissions,
  access scope, routes и schedule API не меняются. Backend tests и DB changes
  для TASK-104 не требуются.

## UX contract
- Пользователь: Coach, Administrator или HeadCoach, которому backend уже выдал
  attendance scope. Frontend не выводит доступ из role и не создаёт новую
  permission matrix.
- Контекст: быстрая отметка до или во время тренировки, прежде всего одной
  рукой на mobile; `390 x 844` — stress baseline, `420 x 912` и `440 x 956` —
  target iPhone portrait, `912 x 420` и `956 x 440` — compact-height path.
  `360 x 780` остаётся narrow guardrail, `768 x 1024` и `1440 x 1200` —
  representative tablet/desktop.
- Primary path: загрузить разрешённые группы → проверить выбранные группу и
  дату → увидеть confirmed progress → увидеть первого неотмеченного клиента →
  нажать `Был`, `Не был` или `Не отмечено` → получить row-local save feedback
  и authoritative progress update.
- Completion signal: pending/saved/failed feedback относится к затронутой
  строке; `Отмечено N из M` меняется только после backend-confirmed state.
- Required decision data: выбранные group/date, confirmed progress, current
  roster view, имя клиента и только влияющие на решение professional/membership
  warnings.
- Primary controls: три row-local attendance statuses.
- Frequent controls: group select, date input, previous/today/next.
- Secondary controls: `Не отмечено / Все` и refresh; они остаются видимыми, но
  не получают равный visual priority с row action.
- Exceptional/recovery controls: exact row retry, roster/groups retry и scope
  recovery.
- Видимый повтор выбранной group/date через roster `SectionHeader` и date badge
  удаляется. Group schedule/client count также удаляются из default header как
  не меняющие решение в пределах TASK-104; не переносить их в новый card,
  tooltip или decorative copy. Если implementation discovery докажет, что эти
  поля предотвращают ошибочную отметку, остановиться и вернуть conflict
  `ui-designer`, а не придумывать новую surface.
- Navigation ambiguity из TASK-103 признаётся, но route, tabs, active navigation
  и document title не меняются.

## UI specification

### Content hierarchy
1. Existing Home attendance tab/navigation context.
2. Один `attendance-toolbar`/compact workbench header:
   group select → date input → previous → today → next → compact progress →
   roster view → refresh.
3. Inline loading/error/stale/completion state, когда применимо.
4. Roster без дополнительного group/date header и без card-in-card wrapper.
5. Первая client row с identity, decision-changing warning и primary statuses.

Implementation direction:
- заменить separate context surface + roster header/toolbar одним локальным
  `AttendanceWorkbenchHeader` либо эквивалентной композицией; сохранить
  `data-testid="attendance-toolbar"` как существующий test hook;
- переиспользовать `AttendanceProgress`, `AttendanceRosterViewControl` и
  `TaskToolbarRefreshAction`, добавив только локальные `compact` variants;
- roster container сделать `PageSection variant="plain"` или эквивалентным
  unframed container, потому что client rows уже являются bordered cards;
- убрать `SectionHeader`, date badge, `formatDateLabel`,
  `getSelectedGroupDescription` и dead imports только после red tests;
- у `AttendanceRosterViewControl` сохранить programmatic group label, но в
  compact header разрешить visually-hidden `Показывать клиентов`;
- у progress сохранить `role="progressbar"`, `aria-valuenow/min/max` и full
  accessible label, а compact visible copy сделать короткой, например
  `0/12 отмечено`; exact copy согласовать с существующей русской терминологией
  без изменения semantics.

### Responsive behavior
- `360 x 780`: group занимает полный ряд; date input имеет минимум `156px`.
  Если date + три `44px` control не помещаются, navigation controls переходят
  на собственный `44px` ряд. Это guardrail, а не замена target acceptance.
- `390 x 844`: group занимает полный ряд; date row использует
  `minmax(176px, 1fr) 44px 44px 44px` с gap не меньше `8px`; `Сегодня` может
  стать icon-only с `aria-label`/`title`. Progress/view/refresh помещаются в
  один `44px` secondary row. Bottom первого status control должен быть не ниже
  чем `mobileBottomNav.top - 8px` без page scroll.
- `420 x 912`: та же hierarchy, date input минимум `200px`; first row/action
  остаются выше bottom navigation.
- `440 x 956`: date input минимум `216px`; extra width не возвращает удалённый
  group/date/schedule header.
- `912 x 420`: compact-height grid использует group minimum `220px`, date
  cluster minimum `332px` и progress/tools minimum `240px` в одном ряду либо
  двух рядах, если фактический shell inline-size меньше суммы. Полная дата
  читаема; first client primary action остаётся видимым над bottom navigation.
- `956 x 440`: тот же compact-height contract, без clipping и nested scroll;
  дополнительная ширина отдаётся group/date до secondary controls.
- `768 x 1024`: двухрядный header — group + date, затем
  progress/view/refresh; date минимум `216px`, refresh может остаться icon-only.
- `1440 x 1200`: один ряд group/date/progress/view/refresh; refresh text может
  вернуться, но удалённый context header и decorative metadata не возвращаются.
- Любой interactive target — минимум `44 x 44 CSS px`; между независимыми
  touch targets — минимум `8px`. Inputs/selects сохраняют минимум `16px` font
  на iPhone.
- На всех размерах нет document-level horizontal overflow, nested-scroll trap,
  clipped date value или hidden primary row action.

### Operational states and interaction
- Groups loading: показывать loading state, не empty-looking controls.
- Groups load error: показывать retry action, повторно запускающий существующий
  groups reload path; не рендерить disabled workspace.
- No groups/scope: сохранить role-specific empty states и не показывать
  недоступные controls.
- Roster initial loading: selected group/date header остаётся видимым, loading
  находится ниже него.
- Roster error: selected context и refresh остаются видимыми; retry не требует
  смены group/date.
- Empty roster и completed default view остаются разными states; действие
  `Показать всех` сохраняется.
- Row pending отключает только status controls этой строки; global refresh
  остаётся disabled, пока есть pending save.
- Row failure сохраняет attempted state, inline `Не сохранено…` и
  `Повторить` внутри строки. Toast-only feedback запрещён.
- Successful row сохраняет row-local confirmation; progress меняется только по
  confirmed `persistedState`.
- Background refresh-after-save failure не отменяет successful save. Показать
  compact stale/retry feedback рядом с progress/roster state и позволить
  manual refresh; очистить stale indication после успешного refresh/context
  change. Не вводить новый API contract.
- Scope-revoked `403` сохраняет существующее очищение roster и groups reload.
- Focus order следует visual/task order: group → date → previous → today → next
  → roster view → refresh → status controls первой строки → row retry.
- Icon-only today/refresh сохраняют стабильные accessible names и visible
  focus. Native select/date/dropdown behavior не подменяется custom widget.
- Attendance actions не становятся fixed/sticky. Переиспользовать текущую
  shell reservation для bottom nav и `100dvh`; normal page scroll должен
  сохранять достижимость focused group/date, inline recovery и primary action
  при Safari chrome/software keyboard.

## Execution roles
1. `ux-researcher` contract выполнен на planning stage: зафиксированы primary
   path, decision data, control priority, failure/recovery states и measurable
   above-fold criteria.
2. `ui-designer` handoff выполнен на planning stage: зафиксированы единый
   compact header, responsive matrix, removal rules, focus order и state
   placement.
3. `test-automator` до production-кода добавляет component/Playwright red
   regressions и после implementation закрывает target-device matrix.
4. `react-specialist` после подтверждённого red state реализует минимальный
   React/Mantine/CSS change по этому контракту, применяя
   `.agents/skills/react-best-practices/SKILL.md`.
5. Координирующий агент проверяет task worktree, test-first evidence, результат
   против UX/UI contract и residual Simulator/physical-device risks.

## Execution steps

### Phase 0 — task workspace and baseline
1. Выполнить `git fetch origin`, перечитать root/frontend `AGENTS.md`, source
   TASK, этот plan, `crm-mobile-first-ui`, `react-best-practices` и
   `task-worktree`; создать/возобновить declared branch/worktree и вернуть
   verified path, branch, base и current commit.
2. До правок production-кода запустить focused existing baseline:
   `cd frontend && npm run test:unit -- src/features/attendance/AttendanceScreen.test.tsx`
   и `npm run test:e2e -- attendance.spec.ts`. Отделить pre-existing failure от
   новых red assertions.
3. Source-search подтвердить все consumers текущих attendance class names,
   test ids, visible context copy и state components. Если новый shared
   component/token не нужен, сохранить решение локальным.

### Phase 1 — tests before functional code
4. До production-кода расширить `AttendanceScreen.test.tsx`:
   - один workbench header содержит group/date/progress/view/refresh;
   - selected group heading, date badge и schedule/client metadata не
     дублируются после controls;
   - date сохраняет visible persistent label `Дата тренировки`, full value,
     min/max и stable names previous/today/next;
   - compact progress сохраняет `progressbar` value semantics и считается по
     полному confirmed roster, включая large totals;
   - active membership без warning не рендерит benign status copy, но
     professional, inactive-membership и backend warning/message остаются;
   - groups error имеет retry; roster loading/error/empty/completed сохраняют
     selected header и primary path, когда context уже известен;
   - pending/error/exact retry остаются row-local, failed row не исчезает, а
     global refresh disabled только во время pending;
   - refresh-after-save failure сохраняет saved row, показывает stale/manual
     retry feedback и очищается после successful refresh;
   - scope revoke, stale response ordering и context reset tests остаются
     зелёными.
5. До production-кода расширить existing `attendance.spec.ts` на `390 x 844`:
   - no visible duplicate group heading/date badge/schedule meta;
   - group/date/progress/header и first client card видимы без scroll;
   - хотя бы один first-row status имеет
     `bottom <= mobileBottomNav.top - 8px`;
   - group/date/navigation/status targets не меньше `44 x 44px`, independent
     date controls разделены минимум `8px`;
   - keyboard focus order и accessible names соответствуют contract;
   - success save, progress update и row-local failure/retry остаются
     observable behavior, а не screenshot-only check.
6. До production-кода добавить focused attendance geometry matrix в
   `responsive-main-screens.spec.ts` для `390 x 844`, `420 x 912`,
   `440 x 956`, `912 x 420`, `956 x 440`, а representative checks — для
   `360 x 780`, `768 x 1024`, `1440 x 1200`:
   - date bounding width соответствует minimum текущего breakpoint, input
     имеет полное ISO value и не clipped;
   - first primary status above bottom nav на mobile/compact height;
   - long group/client names и progress минимум `123/123` не создают clipping;
   - document/body `scrollWidth <= innerWidth + 1`;
   - date/group controls не overlap, roster не вложен в competing card header.
7. До production-кода добавить в `iphone-target-devices.spec.ts` attendance
   roster fixture и один focused target-profile test, выполняемый обоими
   WebKit projects:
   - portrait target screen, iPhone UA, touch и `3x` profile;
   - first status выше bottom navigation, date/action targets touch-safe;
   - затем `page.setViewportSize({ width: target.height, height: target.width })`
     для `912 x 420`/`956 x 440`: date value fully readable, first action
     reachable и нет horizontal overflow;
   - WebKit check дополняет Chromium geometry, но не объявляется доказательством
     real Safari chrome/safe area.
8. Запустить новые focused component и Playwright tests на неизменённом
   production-коде. Сохранить expected red evidence: current duplicate
   `SectionHeader`, date shrink, below-nav first status, absent stale feedback и
   benign row copy. Падение из-за неверного API mock или unrelated selector не
   считается корректным red state.

### Phase 2 — minimal functional implementation
9. Собрать единый local `AttendanceWorkbenchHeader`: перенести в него
   progress/view/refresh, сохранить controlled group/date state и callback
   boundaries, не переносить save/domain logic из `AttendanceWorkspace`.
10. Удалить только visible duplicate `SectionHeader`/date badge/schedule copy;
    сохранить semantic screen/tab/roster names через existing headings,
    controls и accessible labels. Сделать roster unframed, не удаляя client
    card boundaries.
11. Добавить compact variants к progress и roster view без дублирования DOM или
    разных accessible names между breakpoints. Collapse today/refresh до
    icon-only только там, где это требуется width pressure.
12. Скорректировать `AttendanceClientRow`: убрать benign active-membership
    status copy; сохранить professional, missing/inactive membership и backend
    warning/message information рядом с затронутым клиентом. Не придумывать
    frontend validation или новую membership semantics.
13. Добавить локальные groups retry и roster stale/manual-refresh presentation
    поверх существующих reload/version guards. Не считать background refresh
    failure отменой already-confirmed save.
14. Переписать только attendance CSS grid/media rules:
    - enforce date minimums и `44px` controls/`8px` gaps;
    - compact tools row at portrait;
    - compact-height layout at `912 x 420`/`956 x 440`;
    - two-row tablet и single-row desktop variants;
    - при необходимости локально включить side-by-side client identity/actions
      в compact landscape, чтобы primary status оставался above fold;
    - не добавлять global token, fixed attendance bar, horizontal toolbar
      scrolling, nested scroll или raw colors.

### Phase 3 — green and regression closure
15. Повторно запустить focused unit/component tests, `attendance.spec.ts`,
    attendance responsive matrix и target iPhone WebKit; исправлять production
    code по зафиксированному contract, не ослаблять geometry/behavior assertions.
16. Запустить обязательные frontend checks из task worktree:
    - `cd frontend && npm run test:unit`;
    - `npm run lint`;
    - `npm run build`;
    - `npm run test:e2e -- attendance.spec.ts responsive-main-screens.spec.ts`;
    - `npm run test:e2e:iphone -- iphone-target-devices.spec.ts`.
17. Выполнить source/DOM review: нет duplicate group/date/schedule header,
    orphaned helpers/imports/classes, frontend permission inference, hidden
    primary action, duplicate DOM variants или page-level overflow.
18. Провести manual keyboard check и, если доступен, Safari Responsive Design
    Mode/iOS Simulator/physical-device check для dynamic chrome, native date
    picker, safe area, home indicator и software keyboard. Непроверенное явно
    зафиксировать как residual device risk; manual QA не заменяет automated
    regression barrier.

## Preferred implementation strategy
1. Structural/accessibility component tests and geometry Playwright tests in
   red state.
2. One local composed header that reuses existing attendance controls.
3. Remove visible duplication and benign copy before tuning responsive grid.
4. CSS-only breakpoint resolution for date priority and above-fold geometry.
5. Row/stale recovery regression closure, full frontend validation and target
   iPhone WebKit checks.

## Files likely to change
- `frontend/src/features/attendance/AttendanceScreen.tsx`
- `frontend/src/features/attendance/AttendanceContextControls.tsx`
- `frontend/src/features/attendance/AttendanceWorkbenchHeader.tsx` (new,
  preferred if the composed header would otherwise enlarge `AttendanceScreen`)
- `frontend/src/features/attendance/AttendanceProgress.tsx`
- `frontend/src/features/attendance/AttendanceRosterViewControl.tsx`
- `frontend/src/features/attendance/AttendanceClientRow.tsx`
- `frontend/src/features/attendance/AttendanceScreen.test.tsx`
- `frontend/src/App.css`
- `frontend/e2e/attendance.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`
- `frontend/e2e/iphone-target-devices.spec.ts`

Files to inspect but not expected to change:
- `frontend/src/features/attendance/AttendanceSaveStatus.tsx`
- `frontend/src/features/attendance/types.ts`
- `frontend/src/lib/api/attendance.ts`
- `frontend/src/lib/api/types.ts`
- `frontend/src/features/home/HomeDashboard.tsx`
- `backend/tests/GymCrm.Tests/AttendanceApiTests.cs`

## Constraints
- Backend остаётся единственным владельцем attendance/membership/permission/
  access/validation semantics и authoritative saved state.
- Сохранить React 19, TypeScript, Vite, Mantine 9, Onest, theme tokens и shared
  UX components; не добавлять Tailwind или новую component library.
- Не менять API requests/responses, routes, tabs, navigation labels, start
  route, backend permission scope или schedule behavior.
- Не скрывать primary status в menu/overflow и не уменьшать hit area ниже
  `44 x 44px`.
- Date control сохраняет visible persistent label, full value, min/max,
  accessible name и native input semantics на всех breakpoints.
- Progress считается по полному confirmed roster, не по visible subset и не по
  optimistic `displayedState`.
- Failed/pending rows не исчезают; save/retry state остаётся row-local; stale
  response guards не обходятся ради layout.
- Fixed bottom navigation, safe-area reservation и dynamic viewport shell не
  дублируются в attendance-specific code.
- Не использовать horizontal scrolling, `overflow: hidden` как маскировку
  clipping, nested scroll или multiple DOM variants как responsive solution.
- Не смешивать TASK-103 и unrelated attendance/home cleanup.

## Out of scope
- Navigation/route/IA model `Главная / Посещения / Расписание` из TASK-103.
- Attendance states, bulk marking, membership validation/write-off/restore,
  audit, permissions, access scope и backend/API changes.
- Group schedule, group/date defaults, date availability limits и timezone
  semantics.
- Redesign Home memberships/attention tab, client detail or schedule screen.
- New sticky/fixed action bar, offline queue, global store or shared design
  system refactor.
- Physical-device certification when Simulator/device is unavailable; это
  документируемый residual risk, а не причина ослабить automated acceptance.

## Required test coverage

### Unit tests
- Новая pure domain/helper unit coverage не применяется: TASK-104 не меняет
  calculation, mapping, validation или API helper. Не создавать artificial
  helper только ради isolated unit test.
- `AttendanceProgress` compact formatting/ARIA и row-copy predicate можно
  покрыть через existing React component tests; отдельный pure unit test нужен
  только если implementation действительно выделит non-trivial pure function.
- Эти tests пишутся до functional code и входят в `npm run test:unit`.

### Component/integration tests
- `AttendanceWorkspace` с mocked API: единый compact header, no duplicate
  context, accessible date, full confirmed progress, view/refresh operations и
  selected context during roster states.
- Long group/client names, large progress, benign copy removal и preserved
  decision-changing warnings.
- Existing row pending/failure/exact retry/success/reset/concurrency/scope
  scenarios остаются обязательным barrier.
- Groups load retry и background stale/manual refresh recovery.
- Backend integration tests не добавляются: API, database, permissions и
  business contract не меняются. Existing backend suite не требуется запускать
  как TASK-104 completion gate, если discovery не расширит scope.

### UI/e2e tests
- `390 x 844`: primary attendance flow, first action above bottom nav, target
  sizes/gaps, no duplicated context and no horizontal overflow.
- `420 x 912` и `440 x 956`: target portrait geometry в Chromium plus обоих
  target iPhone WebKit projects.
- `912 x 420` и `956 x 440`: date readability, compact-height first action,
  bottom-nav clearance и no overflow.
- `360 x 780`, `768 x 1024`, `1440 x 1200`: representative guardrail/tablet/
  desktop regression without restored duplicate context.
- Keyboard focus order, icon-only accessible names, visible focus, row-local
  error/retry and one permission/scope edge.
- Screenshot may supplement native date visual inspection, but behavior and
  bounding geometry remain primary assertions.

## Expected initial failure verification
- Component structural test fails because progress/view/refresh are outside
  `attendance-toolbar`, а selected group/date are repeated by `SectionHeader`.
- Benign-copy test fails on current `Отметка доступна на выбранную дату`.
- Stale recovery test fails because current background refresh-after-save
  failure is silently ignored.
- `390 x 844` geometry fails because first row status is below fixed bottom
  navigation in the captured baseline.
- `912 x 420`/`956 x 440` geometry fails because `minmax(0, 1fr)` lets the native
  date field collapse below its useful width.
- Existing pending/error/retry and backend-confirmed progress tests remain
  green, proving that red state is scoped to TASK-104 presentation/state gaps.

## Test plan
- [x] Unit/component and Playwright assertions are written before production
      code and fail for the expected TASK-104 reasons.
- [x] One compact workbench header owns group/date/progress/view/refresh without
      repeated selected group/date/schedule context.
- [x] First client row and at least one status action are above bottom navigation
      without scroll at `390 x 844`, `420 x 912` and `440 x 956`.
- [x] Full date remains readable at `912 x 420` and `956 x 440`.
- [x] Previous/today/next and status controls are at least `44 x 44px`, with at
      least `8px` between independent date actions.
- [x] Long group/client names and large progress do not clip required decision
      data or create horizontal overflow.
- [x] Benign membership copy is absent; professional/inactive/warning copy
      remains next to the affected client.
- [x] Loading, empty, roster error, completed, success, stale/retry and
      scope-revoked states retain the applicable context and primary path.
- [x] Pending/error/retry stay row-local; confirmed progress and stale-response
      protections remain correct.
- [x] Focus order and accessible names remain stable, including icon-only
      variants.
- [x] Full unit, lint, build, affected Chromium Playwright and target-iPhone
      WebKit commands pass.
- [x] Safari/Simulator/physical-device evidence or residual risk is reported.

## Regression barrier
Primary barrier: an automated `AttendanceScreen` component suite that protects
the compact header structure, no duplicate decision context, authoritative
progress, operational states and row-local save/retry semantics, plus focused
Playwright geometry proving the first status action stays above fixed bottom
navigation and the full date stays readable across the five required portrait/
compact-height viewports. Existing attendance flow tests protect save/reset/
scope behavior; target-iPhone WebKit tests protect mobile UA/touch profiles.

No implementation is complete if only screenshots or manual QA pass.

## Risks
- Removing `SectionHeader` without moving progress/view/refresh into one owner
  can leave disjointed spacing or an unnamed roster.
- Keeping schedule/client metadata in another surface would recreate the
  vertical regression under a different wrapper.
- Collapsing today/refresh to icon-only without stable names/focus would trade
  geometry for accessibility.
- A date min-width chosen without accounting for `44px` controls and gaps can
  create page overflow instead of fixing clipping.
- Compact landscape may still place row statuses below fold if client row stays
  stacked; use a local compact-height row layout only when required by measured
  geometry.
- Calculating progress from visible rows or optimistic state would regress
  confirmed completion semantics.
- Broad changes to request/version guards could resurrect stale rows or lose
  failed retry state; layout code must not own domain synchronization.
- WebKit emulation cannot prove real Safari chrome, native date picker,
  keyboard, home indicator or physical safe area.

## Stop conditions
Остановиться и не писать project code, если:
- active workspace/branch не совпадает с declared TASK-104 worktree/branch,
  branch base неясен либо имеются unexplained changes;
- correct result требует изменить backend API, attendance/membership/permission
  semantics или access scope;
- implementation требует выбрать navigation model из TASK-103;
- group schedule/client metadata оказывается обязательным decision data, но
  нет evidence-backed placement, не возвращающего above-fold regression;
- first action/date acceptance невозможно выполнить без hidden/clipped control,
  horizontal scroll, touch target меньше `44px` или дублирования DOM;
- scope расширяется в shared Home/design-system refactor либо system-wide
  responsive rewrite;
- expected red tests падают по API mock/selector setup, а не по текущей
  TASK-104 регрессии.

Не останавливаться только потому, что экран общий для нескольких backend-
разрешённых ролей или затрагиваются одновременно React, CSS и Playwright.

## Ready for Codex execution
yes — scope локализован во frontend attendance presentation/state feedback,
critical clarification questions отсутствуют, UX contract и UI specification
зафиксированы, отдельная branch/worktree определена, а automated red/green
strategy покрывает primary flow, failure/recovery, mobile geometry и regression
barrier. Реализация начинается только после повторной проверки `origin/main` и
task worktree.
