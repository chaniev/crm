# Implementation Plan: TASK-113 Добавить фильтр расписания по типу группы

## Source task
/backlog/implementation/TASK-113-schedule-group-type-organization.md

## Implementation branch
feature/TASK-113-schedule-group-type-organization

Branch rules:
- до изменения project code применить `.agents/skills/task-worktree/SKILL.md`
  и создать либо безопасно возобновить отдельный worktree
  `../crm-worktrees/TASK-113-schedule-group-type-organization`;
- создать branch непосредственно от актуального `origin/main`; primary
  repository оставить на `main`, а код менять только в task worktree;
- до первой правки подтвердить repo root, active branch, clean status,
  registered worktree и `git merge-base --is-ancestor origin/main HEAD`;
- начинать implementation только от `origin/main`, в который уже интегрированы
  TASK-106 и TASK-112; не копировать файлы или commits из их незамерженных
  branches и не создавать branch dependency;
- не включать backend/API changes, TASK-106/TASK-112 fixes, redesign расписания,
  URL persistence фильтров или unrelated refactoring;
- Docker Compose по умолчанию не запускать: задача покрывается frontend unit,
  component integration, mocked Playwright и target-iPhone WebKit tests.

Planning evidence на 2026-08-16: primary repository находится на clean `main`
`76d96e5e3e576e5e006080f2733d7ed3f8c89ff2`, совпадающем с локальным
`origin/main`; отдельные worktree/branch TASK-113 и дубликат plan не найдены.
TASK-106 и TASK-112 на planning snapshot ещё находятся в
`/backlog/implementation`, поэтому этот commit не является допустимым execution
base. Executor обязан выполнить `git fetch origin`, проверить интеграцию обеих
задач и повторить source discovery после их merge.

## Goal
Тренер, администратор или главный тренер на `/schedule` выбирает один доступный
`Тип группы`, сразу сокращает расписание до занятий этого типа и сохраняет
привычный chronological/time-first порядок. Фильтр работает совместно с
филиалом, залом, тренером и группой, остаётся выбранным при refresh и смене
viewport в рамках открытого экрана, а пассивная легенда пересчитывается только
по фактически показанным занятиям.

## Current understanding
- `frontend/src/features/schedule/GroupScheduleScreen.tsx` хранит schedule
  filters в local React state, загружает весь разрешённый backend scope через
  `/api/schedule/groups`, применяет frontend presentation filters и только
  затем строит calendar render model.
- `ScheduleFilters` и `ScheduleFilterOptions` в
  `frontend/src/lib/groupSchedule.ts` сейчас содержат branch, hall, trainer и
  group. `EMPTY_SCHEDULE_FILTERS`, `applyScheduleFilters`,
  `buildScheduleFilterOptions`, retention/equality checks и toolbar должны
  получить один новый `groupTypeId` dimension.
- `TrainingGroupListItem` уже содержит обязательные `groupTypeId` и
  `groupTypeName`; `getScheduleGroups` уже возвращает их. Новый endpoint,
  request parameter, API mapping или справочник типов не нужны.
- `buildScheduleFilterOptions` строит contextual options из уже загруженного
  payload: для каждого dimension применяет остальные filters и исключает
  собственный. Новый type options builder должен следовать тому же contract,
  deduplicate по stable id и сортировать подписи через существующую русскую
  locale strategy.
- `buildScheduleCalendarWeek` сортирует entries time-first и затем по group
  name. Type filter не должен вводить новый sort или группировку.
- Type legend уже строится после фильтрации из calendar entries. После
  интеграции TASK-112 source legend должен совпадать с реально rendered scope:
  вся неделя в effective week mode и выбранный день в effective day mode.
- `CompactFilterPanel` уже даёт mobile bottom Drawer, desktop one-row filters,
  `Ещё фильтры`, reset, focus return, safe-area padding и `44px` controls.
  Новый select нужно встроить в этот surface, не создавая новый toolbar.
- Manual/auto refresh меняют payload/reload state, но не remount screen и не
  сбрасывают filter state. Existing retention effect удаляет значение только
  после успешного payload update, если value больше не входит в разрешённые
  contextual options; stale/error refresh сохраняет старые data и selection.
- TASK-112 делает mode/weekday URL-owned presentation state, а filters оставляет
  local и вне URL. TASK-113 не меняет `mode`/`weekday`, history или viewport
  semantics.
- Backend permissions/access scope, schedule conflict logic, loading, initial
  error, stale/retry, global empty и Coach zero-scope semantics не меняются.

## UX contract

### User task
- Пользователь: Coach / Administrator / HeadCoach и любой другой пользователь,
  которому текущий backend/session contract уже разрешил Schedule. Frontend не
  добавляет role checks и не расширяет payload scope.
- Primary path: открыть existing filter surface → выбрать `Тип группы` →
  увидеть только matching занятия в том же temporal order → при необходимости
  очистить сам select или нажать общий `Сбросить`.
- Completion signal: selected value или active-filter state видим в filter
  surface, все показанные cards имеют выбранный `groupTypeId`, day counts и
  passive legend соответствуют rendered entries.
- Frequent operations: открыть filters, выбрать/очистить type, refresh.
  Recovery: общий reset и existing empty-state guidance. Type legend остаётся
  metadata и не получает click/keyboard behavior.
- Immediate application сохраняет current filter semantics. Mobile button
  `Готово` только закрывает Drawer; он не создаёт отдельную deferred draft
  model и не меняет уже применённый фильтр.

### Filter data and state contract
- Добавить `groupTypeId: string | null` в typed filter state и `groupTypes` в
  options; initial/default value — `null`, visible placeholder — `Все типы`.
- Option `value` — exact non-empty `groupTypeId`; option `label` —
  `groupTypeName` из разрешённого schedule payload. Не запрашивать полный
  catalog и не создавать frontend business priority.
- Deduplicate options по id и сортировать по label через `localeCompare(...,
  'ru')` с deterministic id tie-break, если labels совпали.
- Type options применяют branch/hall/trainer/group filters, но игнорируют
  current `groupTypeId`, чтобы selected option не исчезала только из-за
  собственного filter predicate.
- `applyScheduleFilters` добавляет exact `group.groupTypeId ===
  filters.groupTypeId` и сохраняет AND-composition всех пяти dimensions.
- Filter state не входит в URL, API query, global store или TASK-112 history
  state. Viewport/mode change не remount-ит и не очищает selection.
- Manual/auto refresh сохраняет selected id, если он остаётся разрешённой
  option в новом payload. Если успешный refresh удалил id из authorized scope,
  очистить его через existing retention contract; failed/stale refresh не
  очищает selection.

### Filter surface and responsive behavior
- Visible label и accessible name select: `Тип группы`; placeholder:
  `Все типы`; select — `clearable`, single-select, searchable только если это
  соответствует current schedule Select pattern.
- Добавить стабильное accessible имя отдельной очистке, например
  `Очистить фильтр «Тип группы»`, не искать clear control по private Mantine
  class в tests.
- Desktop/wide baseline: сохранить четыре существующих primary filters в их
  current order, добавить `Тип группы` как secondary item existing
  `Ещё фильтры` Popover. Это включает предусмотренный panel overflow для
  tablet width и не демонтирует существующие controls на `1440px`.
- При активных filters mobile launcher и desktop overflow trigger должны
  показывать compact state `Фильтры · N` / `Ещё фильтры · N` либо эквивалентный
  точный count через existing label props; не добавлять отдельную строку chips,
  badges или actions. `N` — число non-null schedule filters.
- Mobile `360/390/420/440`: новый select находится в существующем Drawer после
  `Группа`; fields scroll vertically, sticky `Готово`/`Сбросить` остаются
  reachable, page не получает horizontal scroll.
- `768 x 1024` и `1440 x 1200`: filter surface остаётся одной строкой;
  overflowed controls доступны через один visible `Ещё фильтры` trigger. Не
  разрешать clipping control как способ пройти no-overflow assertion.
- `912 x 420` и `956 x 440` с coarse pointer: mobile Drawer сохраняет один
  intentional vertical scroll region, close и sticky actions доступны при
  `100dvh`/safe-area behavior; nested-scroll trap отсутствует.
- Minimum select/clear/trigger/reset/refresh target — `44 x 44 CSS px`, между
  independent adjacent targets минимум `8px`; Select text не меньше `16px`.
- Focus order следует visual order. Mantine Select keyboard semantics,
  Popover/Drawer Escape-close и focus return сохраняются; CSS не скрывает
  visible focus.

### Schedule result and operational states
- Filtering happens before calendar/day render derivation. Current calendar
  sorter remains the only ordering source; group type name/id never enters
  primary sort.
- In effective week mode legend/counts derive from all filtered rendered week
  entries. In effective day mode they derive from the selected day's filtered
  entries, so metadata does not describe hidden days.
- Whole-filter empty сохраняет `По выбранным фильтрам занятий нет` и visible
  reset path. Selected-day empty после TASK-112 сохраняет day strip/context и
  current filtered-day copy.
- Initial loading не выглядит как empty; initial error/retry, stale data,
  Coach zero-scope и global empty сохраняют current controls/copy. Coach
  zero-scope по-прежнему показывает только refresh без filters.
- Successful refresh updates options/results atomically enough that stale type
  selection не раскрывает unauthorized data. Failed refresh leaves existing
  filtered board available under stale/error surface.

## Execution roles
1. `ui-designer` перед test implementation сверяет локальный handoff с уже
   integrated TASK-112 filter/mode order и подтверждает, что secondary desktop
   placement, active-count labels и Drawer order не создают второй toolbar.
2. `test-automator` до production code добавляет pure unit, component
   integration и Playwright regressions и фиксирует expected red evidence.
3. `react-specialist` после red evidence вносит минимальные React 19/Mantine
   changes, не переносит domain rules во frontend и не перерабатывает screen.
4. Координирующий агент проверяет task worktree, merged dependency baseline,
   test-first order и итог против `crm-mobile-first-ui` criteria.

## Execution steps

### Phase 0 — isolated workspace and integrated baseline
1. Выполнить `git fetch origin`; перечитать root/frontend `AGENTS.md`, source
   TASK, этот plan, `task-worktree`, `crm-mobile-first-ui` и
   `react-best-practices`; создать/возобновить declared worktree/branch.
2. Вернуть evidence: absolute worktree path, active branch, HEAD/origin-main
   commits, clean status, registered ownership и successful ancestor check.
3. Проверить, что TASK-106 и TASK-112 действительно merged в `origin/main`:
   current schedule имеет released parallel-event presentation и released
   week/day URL contract. Если нет — остановить code execution, не брать их
   branches и не имитировать отсутствующие contracts.
4. Повторно обнаружить actual owners filters, mode/day render scope, legend,
   empty states, filter panel and tests. Planning file list ниже является
   baseline, а не разрешением перезаписать integrated changes.
5. До новых assertions запустить focused baseline:
   - `cd frontend && npm run test:unit -- src/lib/groupSchedule.test.ts src/features/schedule/GroupScheduleScreen.test.tsx`;
   - `npm run test:e2e -- group-schedule.spec.ts responsive-main-screens.spec.ts`;
   - `npm run test:e2e:iphone`.
   Отделить pre-existing/dependency/browser-fixture failures от TASK-113 red.

### Phase 1 — tests before functional code
6. До изменения `groupSchedule.ts` расширить
   `frontend/src/lib/groupSchedule.test.ts`:
   - `EMPTY_SCHEDULE_FILTERS` включает null `groupTypeId`, а active-filter
     detection считает выбранный type;
   - type options берутся только из supplied payload, deduplicate по id,
     сортируются по русскому label и не получают catalog-only values;
   - selected type option сохраняется при исключении собственного dimension,
     но options учитывают branch/hall/trainer/group context;
   - type predicate работает отдельно и в AND-combination со всеми четырьмя
     existing filters;
   - после type filtering `buildScheduleCalendarWeek` оставляет entries
     time-first и deterministic при одинаковом времени;
   - legend, day counts и effective rendered-entry selection используют только
     matching entries; отдельный type priority/sort отсутствует.
7. До изменения `GroupScheduleScreen.tsx` расширить
   `GroupScheduleScreen.test.tsx` как frontend integration barrier:
   - `Тип группы` имеет default `Все типы`, payload-only sorted options и exact
     stable ids;
   - selection фильтрует cards/counts/legend совместно с existing dimensions;
   - `Очистить фильтр «Тип группы»` возвращает all available types, а общий
     `Сбросить` очищает все пять fields;
   - selected type сохраняется при manual refresh, fake-timer auto refresh и
     media-query/viewport transition, если value остаётся в payload;
   - successful payload без selected id безопасно очищает type; stale error и
     retry сохраняют previous selection/data;
   - whole/day filter-empty, loading, initial error, stale board, global empty
     и Coach zero-scope не меняют existing state semantics;
   - mobile Drawer и desktop Popover имеют active-count state, keyboard close
     и focus return без duplicate controls.
8. Если active TASK-112 вынесла pure effective-mode/rendered-entry helper,
   добавить test туда, а не дублировать mode decision в TASK-113. Если helper
   отсутствует, проверять legend day/week scope через screen integration.
9. До production code расширить `frontend/e2e/group-schedule.spec.ts`:
   - wide `1440 x 1200`: открыть `Ещё фильтры`, выбрать type, увидеть только
     matching cards в chronological order, matching legend/count и unchanged
     mode/weekday URL; separate clear и global reset возвращают full schedule;
   - mobile day mode `390 x 844`: открыть Drawer, выбрать type, закрыть
     `Готово`, получить selected-day matching result; выбрать день без этого
     type и увидеть existing filtered-day empty с reset path;
   - создать combined-filter case и подтвердить AND semantics без нового API
     query/filter call;
   - manual refresh, auto refresh и `390 → 1440 → 390` сохраняют selected id,
     visible mode/weekday и active filter state;
   - successful response без id очищает stale selection; failed refresh
     сохраняет filtered stale board и retry;
   - filter Popover/Drawer close/focus, select clear target и no duplicate
     interactive legend behavior.
10. До production code добавить/расширить responsive coverage:
    - geometry/no-clipping/no-document-overflow на `360 x 780`, `390 x 844`,
      `420 x 912`, `440 x 956`, `768 x 1024`, `1440 x 1200`;
    - compact-height `912 x 420` и `956 x 440` с coarse/touch context;
    - target-iPhone WebKit в `iphone-target-devices.spec.ts` для `420 x 912`
      и `440 x 956`, если released shared matrix ещё не выполняет реальный
      schedule filter workflow;
    - actual borders `>=44 x 44`, visible focus, Drawer actions reachable,
      отсутствие page x-overflow и nested vertical scroll trap.
11. Запустить новые unit/component/integration и Playwright tests на unchanged
    production code. Обязательный expected red: typed `groupTypeId` filter,
    options и select отсутствуют; content/legend не фильтруются по type;
    refresh/responsive workflow не может сохранить отсутствующий selection.
    Selector, fixture, browser-install или unrelated dependency failure не
    считается корректным red state. Сохранить test names и failure reason.

### Phase 2 — minimal functional implementation
12. Только после red расширить `ScheduleFilters`, `ScheduleFilterOptions` и
    `EMPTY_SCHEDULE_FILTERS` новым type dimension.
13. В `applyScheduleFilters` добавить exact type predicate; в
    `buildScheduleFilterOptions` построить contextual `groupTypes` из current
    payload с existing dedup/sort helper. Не добавлять API/catalog request.
14. В integrated `GroupScheduleScreen` добавить type retention/equality и
    `Select` item. Сохранить immutable state update, local ownership и existing
    `setFilters` lifecycle; не добавлять effect, зависящий от viewport/mode.
15. Встроить select в current `CompactFilterPanel`: existing primary filters
    не переставлять, type передать secondary item, active count передать через
    existing mobile/more label props, reset оставить `EMPTY_SCHEDULE_FILTERS`.
16. Если new red geometry test докажет, что current panel clipping-ует primary
    item из-за refresh custom action, сначала добавить focused regression в
    `features/shared/ux.test.tsx`, затем минимально исправить measurement в
    `features/shared/ux.tsx`. Не делать shared redesign и не менять other
    consumers без tests; при отсутствии red shared files не трогать.
17. Убедиться, что integrated TASK-112 derives visible legend/counts from
    effective rendered entries. Исправить только schedule-local derivation,
    если test показывает hidden-day metadata; mode/query logic не менять.
18. Не добавлять CSS, пока existing `CompactFilterPanel` contract проходит
    geometry. Если local CSS всё же нужен, использовать existing tokens,
    `min-width: 0`, `44px` targets и safe-area contract; не скрывать controls
    через `overflow`, не создавать вторую строку или horizontal scrolling.

### Phase 3 — green and regression closure
19. Повторно запустить focused unit/component/integration и Playwright tests;
    исправлять implementation, не ослаблять id/source, ordering, refresh,
    focus, target-size или overflow assertions.
20. Запустить обязательные frontend checks из task worktree:
    - `cd frontend && npm run test:unit`;
    - `npm run lint`;
    - `npm run build`;
    - `npm run test:e2e -- group-schedule.spec.ts responsive-main-screens.spec.ts`;
    - `npm run test:e2e:iphone`.
21. Выполнить source/DOM review: нет `/group-types` request, server filter
    param, frontend permissions/type priorities, filter URL keys, duplicate
    select/legend action, stale option leakage, page overflow или unrelated
    TASK-106/TASK-112 code.
22. Выполнить manual keyboard/200% zoom smoke для mobile Drawer, desktop
    Popover, clear/reset and focus return. Если доступны Safari Responsive
    Design Mode, iOS Simulator или physical devices, проверить dynamic chrome,
    safe area, home indicator и software keyboard; непроверенное перечислить
    как residual device risk, не заменяя automated regression barrier.

## Preferred implementation strategy
1. Integrated dependency/source discovery.
2. Pure filtering/options/order unit tests.
3. Screen integration tests for selection, clear/reset, refresh and states.
4. Wide/mobile/target-iPhone Playwright red evidence.
5. Minimal typed helper + screen wiring using current payload and filter panel.
6. Focused green, full frontend regression and device-emulation barriers.

## Files likely to change
- `frontend/src/lib/groupSchedule.ts`
- `frontend/src/lib/groupSchedule.test.ts`
- `frontend/src/features/schedule/GroupScheduleScreen.tsx`
- `frontend/src/features/schedule/GroupScheduleScreen.test.tsx`
- `frontend/e2e/group-schedule.spec.ts`
- `frontend/e2e/iphone-target-devices.spec.ts` (если released target-device
  matrix не покрывает type-filter workflow)
- `frontend/e2e/responsive-main-screens.spec.ts` (только для недостающей общей
  geometry/no-overflow проверки)
- `frontend/src/App.css` (только при доказанном local geometry defect)

Conditional only after a focused red test:
- `frontend/src/features/shared/ux.tsx`
- `frontend/src/features/shared/ux.test.tsx`

Files to inspect but not expected to change:
- integrated TASK-112 `frontend/src/features/schedule/scheduleViewQuery.ts`
  и его tests;
- integrated TASK-106 schedule presentation helpers/components;
- `frontend/src/lib/api/schedule.ts`;
- `frontend/src/lib/api/types.ts`;
- backend schedule endpoints/tests.

## Constraints
- Backend остаётся владельцем permissions, access scope, schedule semantics,
  validation и conflict logic. Frontend фильтрует только already-authorized
  payload.
- Stable value — `groupTypeId`, visible label — `groupTypeName`; не использовать
  name как identity и не вводить type business priority.
- Сохранить React 19, TypeScript, Vite, Mantine, Onest, current tokens,
  `CompactFilterPanel` semantics и schedule API client.
- Filters остаются local state и не меняют TASK-112 `mode`/`weekday` URL.
- Type filter — single-select; clear и reset предсказуемы; legend metadata-only.
- Minimum target `44 x 44px`, independent-target gap `8px`, select text `16px`,
  no page-level horizontal overflow и no action-only second row.
- Не считать успешный stale/error refresh основанием очищать selection; не
  сохранять id, исчезнувший из successful authorized payload.

## Out of scope
- Backend/API/database changes и server-side type filter.
- Group type catalog CRUD или дополнительный catalog request.
- Multi-select, grouping/type-first sort и configurable primary sort.
- Interactive legend chips или duplicate type control outside filter surface.
- Filter persistence в URL, reload/back-forward/deep link или global storage.
- TASK-106 parallel readability, TASK-112 mode/weekday semantics и общий
  schedule redesign.
- Общий refactor `GroupScheduleScreen`, filter design system или app routing.

## Required test coverage

### Unit tests — before production code
- Typed default/active/reset behavior нового `groupTypeId` field.
- Payload-only group type options: id deduplication, label sorting, contextual
  other-filter application and self-dimension exclusion.
- Exact type predicate + AND-composition всех filters.
- Time-first calendar order after filtering and visible legend/count derivation.

### Integration tests — before production code
- `GroupScheduleScreen` + filter helpers + Mantine `CompactFilterPanel` +
  async payload refresh lifecycle.
- Selection, separate clear, global reset, manual/auto refresh, successful
  scope removal, stale/error retry and viewport preservation.
- Operational state matrix: loading, global/Coach/filter/day empty, initial and
  stale errors.

Backend integration tests are not applicable: endpoint, request/response
contract, permissions, database and service interactions do not change.
Frontend component tests are the affected integration boundary.

### UI/E2E tests — before production code
- Wide week/day and mobile selected-day type-filter workflows.
- Combined filters, empty result, clear/reset, legend and chronological order.
- Manual/auto refresh and viewport transition preservation.
- Keyboard/focus, `44px` targets, no clipping/overflow/nested-scroll across the
  required responsive matrix and target-iPhone WebKit projects.

### Existing tests to update
- Existing desktop action-count assertion must account for the new visible
  `Ещё фильтры` action while preserving refresh and reset order/names.
- Existing fixture legend/card expectations must remain deterministic after
  selecting and clearing type.
- Integrated TASK-112 tests must remain green and prove filters do not modify
  view URL/history.

### Manual-only residual checks
- Real Mobile Safari chrome collapse/expand, safe-area/home indicator, Dynamic
  Island and physical software-keyboard behavior require Simulator or device
  evidence. Manual QA supplements but does not replace automated barriers.

## Test plan
- [ ] TASK-106 and TASK-112 confirmed merged into current `origin/main` before code.
- [ ] Unit tests written first and fail on absent typed type-filter behavior.
- [ ] Component integration tests written first and fail on absent select/state flow.
- [ ] Playwright tests written first and fail on absent mobile/wide workflow.
- [ ] Expected red names/reasons recorded before production code.
- [ ] Focused unit/component/Playwright tests pass after minimal implementation.
- [ ] Full `test:unit`, `lint` and `build` pass.
- [ ] Affected Chromium and target-iPhone WebKit suites pass.
- [ ] Required viewport matrix has no clipped controls, page x-overflow or nested-scroll trap.
- [ ] Manual/Safari checks not performed are explicitly reported.

## Regression barrier
Minimum production barrier:
- pure `groupSchedule` options/filter/order tests;
- `GroupScheduleScreen` selection/clear/reset/refresh/state integration tests;
- `group-schedule.spec.ts` combined-filter, empty, refresh, responsive and
  legend workflow;
- released TASK-112 URL/mode regressions and TASK-106 presentation regressions;
- target-iPhone WebKit + viewport overflow/touch-target coverage;
- full frontend unit suite, lint and production build.

No completion claim is allowed if tests were not observed red before
production code, if type options come from anything other than authorized
schedule payload, if time-first order/legend scope is unprotected, or if only
manual QA was performed.

## Risks
- TASK-106/TASK-112 modify the same screen/CSS/tests; starting from an
  unintegrated or stale base can silently overwrite their contracts.
- Adding a fifth filter can clip desktop/tablet controls if existing panel
  measurement does not account for custom refresh action; hidden clipping is
  not acceptable even when document scroll width stays within viewport.
- Contextual option retention can clear selection too aggressively if type
  options accidentally apply their own predicate, or retain stale unauthorized
  ids if successful payload changes are ignored.
- Deriving legend from the full week in effective day mode can expose metadata
  for hidden days and violate the visible-result contract.
- Fake-timer auto refresh tests can become flaky if timer/network completion is
  not advanced deterministically.
- Duplicate/long group type names can stress select readability and active
  count layout; id, not label, must remain identity.
- Mantine nested Popover/Select and mobile Drawer focus/portal behavior can
  regress keyboard close/focus return if tested only by clicks.

## Stop conditions
Остановиться и не писать production code, если:
- TASK-106 или TASK-112 ещё не интегрирована в current `origin/main`;
- требуется backend/API/database, permissions/access или schedule conflict change;
- `groupTypeId`/`groupTypeName` отсутствуют в actual authorized schedule payload;
- выполнение acceptance требует filter URL persistence, multi-select,
  interactive legend или type-first business sort;
- existing filter surface не может вместить operation без system-wide shared
  redesign, а local tested adaptation невозможна;
- merged TASK-106/TASK-112 contracts расходятся с task acceptance и ownership
  нельзя локализовать;
- scope вышел за TASK-113 или expected red невозможно получить по причине уже
  реализованного поведения — сначала перепроверить stale/duplicate task.

Не останавливаться только из-за frontend-only scope, shared Schedule screen,
обычного merge conflict после dependency integration или необходимости
component + Playwright coverage.

## Ready for Codex execution
yes — после обязательной интеграции TASK-106 и TASK-112 в актуальный
`origin/main` и создания declared isolated worktree.
