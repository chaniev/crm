# Implementation Plan: TASK-113 Добавить фильтр расписания по типу группы

## Metadata
- source_task: /backlog/done/2026-08-24/TASK-113-schedule-group-type-organization.md
- branch: feature/TASK-113-schedule-group-type-organization
- readiness: completed by superseding TASK-119 implementation; not executed independently
- dependencies: superseded by TASK-119; historical TASK-112/TASK-106 dependencies are closed
- risk: medium — shared schedule filters and derived counts/legend

## Goal
Тренер, администратор или главный тренер на `/schedule` выбирает один доступный
`Тип группы`, сразу сокращает расписание до занятий этого типа и сохраняет
привычный chronological/time-first порядок. Фильтр работает совместно с
филиалом, залом, тренером и группой, остаётся выбранным при refresh и смене
viewport в рамках открытого экрана, а пассивная легенда пересчитывается только
по фактически показанным занятиям.

## UX contract

### User task
- Пользователь: Coach / Administrator / HeadCoach и любой другой пользователь,
  которому текущий backend/session contract уже разрешил Schedule. Frontend не
  добавляет role checks и не расширяет payload scope.
- Primary path: открыть existing filter surface → выбрать `Тип группы` →
  увидеть только matching занятия в том же temporal order → при необходимости
  очистить сам select или нажать общий `Сбросить`.
- Completion signal: selected value или active-filter state видим в filter
  surface, все показанные cards имеют выбранный `groupTypeId`, day counts
  отражают filtered entries каждого weekday, а passive legend соответствует
  effective rendered scope.
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
- Existing contextual reconciliation распространяется на все пять
  dimensions: если после изменения другого filter selected value больше не
  входит в options своего dimension, оно очищается автоматически. Не
  вводить competing draft/confirmation model.
- `applyScheduleFilters` добавляет exact `group.groupTypeId ===
  filters.groupTypeId` и сохраняет AND-composition всех пяти dimensions.
- Filter state не входит в URL, API query, global store или TASK-112 history
  state. Viewport/mode change не remount-ит и не очищает selection.
- Manual/auto refresh сохраняет selected id, если он остаётся разрешённой
  contextual option в новом payload. Если успешный refresh удалил id из
  authorized scope или сделал его недоступным в current contextual options,
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
- Без active filters mobile launcher показывает `Фильтры`, а desktop overflow
  trigger — `Ещё фильтры`. При любом active filter оба trigger показывают
  neutral state `Фильтры · N` через existing label props, где `N` — число
  всех non-null schedule filters, а не только hidden/secondary. Не добавлять
  отдельную строку chips, badges или actions.
- Mobile `360/390/420/440`: новый select находится в существующем Drawer после
  `Группа`; fields scroll vertically, sticky `Готово`/`Сбросить` остаются
  reachable, page не получает horizontal scroll.
- `768 x 1024` и `1440 x 1200`: filter surface остаётся одной строкой;
  overflowed controls доступны через один visible trigger: `Ещё фильтры`
  без active filters и `Фильтры · N` при active filters. Не разрешать
  clipping control как способ пройти no-overflow assertion.
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
- Day counts в week и effective day modes derive из всей filtered week и
  сохраняют точный count для каждого weekday. Legend в effective week mode
  derive from all filtered rendered week entries, а в effective day mode —
  только from selected weekday filtered entries, чтобы metadata не описывала
  hidden days.
- Whole-filter empty сохраняет `По выбранным фильтрам занятий нет` и visible
  reset path. Selected-day empty после TASK-112 сохраняет day strip/context и
  current filtered-day copy.
- Initial loading не выглядит как empty; initial error/retry, stale data,
  Coach zero-scope и global empty сохраняют current controls/copy. Coach
  zero-scope по-прежнему показывает только refresh без filters.
- Successful refresh updates options/results atomically enough that stale type
  selection не раскрывает unauthorized data. Failed refresh leaves existing
  filtered board available under stale/error surface.

## Implementation sequence

### minimal functional implementation
12. Только после red расширить `ScheduleFilters`, `ScheduleFilterOptions` и
    `EMPTY_SCHEDULE_FILTERS` новым type dimension.
13. В `applyScheduleFilters` добавить exact type predicate; в
    `buildScheduleFilterOptions` построить contextual `groupTypes` из current
    payload с existing dedup/sort helper. Не добавлять API/catalog request.
14. В integrated `GroupScheduleScreen` добавить type retention/equality и
    `Select` item. Сохранить existing contextual reconciliation: после любого
    options recomputation очищать selected values, больше не входящие в options
    своего dimension. Сохранить immutable state update, local ownership и existing
    `setFilters` lifecycle; не добавлять effect, зависящий от viewport/mode.
15. Встроить select в current `CompactFilterPanel`: existing primary filters
    не переставлять, type передать secondary item, active count передать через
    existing mobile/more label props. Inactive labels — `Фильтры` / `Ещё фильтры`,
    active labels — exact `Фильтры · N` для обоих trigger; reset оставить
    `EMPTY_SCHEDULE_FILTERS`.
16. Если new red geometry test докажет, что current panel clipping-ует primary
    item из-за refresh custom action, сначала добавить focused regression в
    `features/shared/ux.test.tsx`, затем минимально исправить measurement в
    `features/shared/ux.tsx`. Не делать shared redesign и не менять other
    consumers без tests; при отсутствии red shared files не трогать.
17. Убедиться, что integrated TASK-112 derives day counts из всех
    weekdays filtered calendar week в любом mode, а legend — из all filtered
    week entries в effective week mode и selected-weekday entries в effective day mode.
    Исправить только schedule-local derivation; mode/query logic не менять.
18. Не добавлять CSS, пока existing `CompactFilterPanel` contract проходит
    geometry. Если local CSS всё же нужен, использовать existing tokens,
    `min-width: 0`, `44px` targets и safe-area contract; не скрывать controls
    через `overflow`, не создавать вторую строку или horizontal scrolling.

## Likely files and layers
- Typed schedule filters/options/helpers and their unit tests.
- Existing schedule filter surface/screen and component integration tests.
- Affected schedule Playwright specs; backend and bot are not expected to change.

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
- Contextual retention автоматически очищает selected value, если оно
  больше не входит в current contextual options после filter change или
  successful payload refresh; failed/stale refresh selection не очищает.
- Day counts всегда охватывают всю filtered week; legend охватывает
  effective rendered scope.
- Minimum target `44 x 44px`, independent-target gap `8px`, select text `16px`,
  no page-level horizontal overflow и no action-only second row.
- Failed/stale refresh не является основанием очищать selection;
  id, исчезнувший из successful authorized payload, не сохранять.

## Out of scope
- Backend/API/database changes и server-side type filter.
- Group type catalog CRUD или дополнительный catalog request.
- Multi-select, grouping/type-first sort и configurable primary sort.
- Interactive legend chips или duplicate type control outside filter surface.
- Filter persistence в URL, reload/back-forward/deep link или global storage.
- TASK-106 parallel readability, TASK-112 mode/weekday semantics и общий
  schedule redesign.
- Общий refactor `GroupScheduleScreen`, filter design system или app routing.

## Regression specification

### Unit tests — before production code
- Typed default/active/reset behavior нового `groupTypeId` field.
- Payload-only group type options: id deduplication, label sorting, contextual
  other-filter application and self-dimension exclusion.
- Contextual auto-clear недоступного selected value после other-filter или
  successful payload change.
- Exact type predicate + AND-composition всех filters.
- Time-first calendar order after filtering, full-week per-weekday counts и
  effective-scope legend derivation.

### Integration tests — before production code
- `GroupScheduleScreen` + filter helpers + Mantine `CompactFilterPanel` +
  async payload refresh lifecycle.
- Selection, separate clear, global reset, manual/auto refresh, successful
  scope/context removal, stale/error retry and viewport preservation.
- Exact inactive/active mobile и desktop trigger labels с count всех non-null
  filters.
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
  inactive `Ещё фильтры` action и active `Фильтры · N` state while preserving
  refresh and reset order/names.
- Existing fixture legend/card expectations must remain deterministic after
  selecting and clearing type.
- Integrated TASK-112 tests must remain green and prove filters do not modify
  view URL/history.

### Manual-only residual checks
- Real Mobile Safari chrome collapse/expand, safe-area/home indicator, Dynamic
  Island and physical software-keyboard behavior require Simulator or device
  evidence. Manual QA supplements but does not replace automated barriers.

### Validation and acceptance
- [ ] TASK-112 confirmed merged into current `origin/main` before code.
- [ ] TASK-106 state recorded; its regressions/contracts included only if present in
  execution baseline, without branch dependency on unmerged work.
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
- released TASK-112 URL/mode regressions;
- TASK-106 presentation regressions only when TASK-106 is present in execution
  baseline;
- target-iPhone WebKit + viewport overflow/touch-target coverage;
- full frontend unit suite, lint and production build.

No completion claim is allowed if tests were not observed red before
production code, if type options come from anything other than authorized
schedule payload, if time-first order/legend scope is unprotected, or if only
manual QA was performed.

## Risks
- TASK-112 is a functional dependency and modifies the same screen/CSS/tests;
  starting before its merge or from a stale base can silently overwrite its contract.
- TASK-106 is not a functional dependency, but concurrent or later integration
  touches the same screen/CSS/tests and requires an explicit merge order/integration
  owner to preserve both filter and dense-event presentation regressions.
- Adding a fifth filter can clip desktop/tablet controls if existing panel
  measurement does not account for custom refresh action; hidden clipping is
  not acceptable even when document scroll width stays within viewport.
- Contextual option retention can clear selection incorrectly if a dimension
  applies its own predicate, or retain stale unauthorized ids if successful
  payload changes are ignored.
- Deriving legend from the full week in effective day mode exposes metadata for
  hidden days; deriving day counts only from selected weekday removes navigation
  context for the other weekdays.
- Fake-timer auto refresh tests can become flaky if timer/network completion is
  not advanced deterministically.
- Duplicate/long group type names can stress select readability and active
  count layout; id, not label, must remain identity.
- Mantine nested Popover/Select and mobile Drawer focus/portal behavior can
  regress keyboard close/focus return if tested only by clicks.

## Stop conditions
Остановиться и не писать production code, если:
- TASK-112 ещё не интегрирована в current `origin/main`;
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

Не останавливаться только из-за отсутствующей в baseline TASK-106,
frontend-only scope, shared Schedule screen, обычного merge conflict после
dependency integration или необходимости component + Playwright coverage.

## Completion and supersession record
- Status audit: 2026-08-24 09:44 MSK against integrated `main`/`origin/main` at `2adfc72`.
- TASK-119 candidate `5a5cabe` delivered the TASK-113 user goal as part of the approved full lesson calendar: `Тип группы` is a clearable schedule filter, `groupTypeId` is URL/API-backed, filter options are backend access-scoped and results remain chronologically ordered.
- This plan was not executed because its implementation boundary became stale: it targets frontend-local filtering, `CompactFilterPanel`, legacy `groupSchedule` helpers, weekday counts and a passive legend that no longer own the current dated occurrence calendar.
- Historical unchecked RED/validation items are preserved as the unexecuted original plan; they are not completion evidence for TASK-119.
- Focused missing regression coverage is owned by `/backlog/tasks-ready/TASK-131-schedule-group-type-filter-regression.md` and must validate the current TASK-119 contract rather than revive this plan.
