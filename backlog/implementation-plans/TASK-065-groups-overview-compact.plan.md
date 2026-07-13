# Implementation Plan: TASK-065 Сделать обзор групп и шапку экрана компактными

## Source task
/backlog/implementation/TASK-065-groups-overview-compact.md

## Implementation branch
feature/TASK-065-groups-overview-compact

Branch rules:
- create this branch from the latest clean `main` before writing code;
- do not implement other unrelated TASKs in this branch;
- confirm the branch is active before making project code changes;
- required preflight: `git checkout main`, `git pull`, `git status --short --branch`, `git checkout -b feature/TASK-065-groups-overview-compact`;
- stop before code changes if `main` is dirty, the current branch is unclear, or the task branch already exists but does not belong to TASK-065.

## Goal
Экран `Группы` должен быстрее подводить администратора или главного тренера к списку: вместо трёх высоких карточек показывается один компактный и доступный обзор с корректными агрегатами по полному набору групп, а основное и вторичное действия остаются удобными и не перекрываются навигацией на узких экранах.

## Current understanding
Задача локальная full-stack и имеет низкий риск. Backend сохраняет существующие правила доступа и становится источником достоверных агрегатов; frontend отвечает только за типизированное потребление, представление процента и responsive UX. Domain rules, permissions, CRUD групп и назначение тренеров не меняются.

Текущий `GET /groups` возвращает страницу как массив `GroupListItemResponse`. `GroupsListScreen` запрашивает `take=50`: `totalCount`, `activeGroupsCount` и `staffedGroupsCount` фактически зависят от полученной страницы. Frontend уже умеет читать как legacy-массив, так и envelope, но backend всё ещё возвращает массив, поэтому расширять или заменять list contract ради обзора не требуется.

Предпочтительный контракт — отдельный `GET /groups/summary`, защищённый той же policy `ManageGroups`, с ответом:

```json
{
  "totalCount": 0,
  "activeCount": 0,
  "activeWithoutTrainerCount": 0
}
```

Отдельный endpoint сохраняет совместимость списка и позволяет загружать обзор независимо: сбой summary не блокирует успешно загруженные строки, H1 и действия. `activeWithoutTrainerCount` считается backend-запросом только среди активных групп без записей `Trainers`; paging-параметры списка на агрегаты не влияют.

Процент — presentation logic: `Math.round(activeCount / totalCount * 100)`. При `totalCount = 0` показывается `—`, а не `0%`. При `activeWithoutTrainerCount = 0` выводится нейтральное `Всё назначено`; при положительном значении число и текст явно сообщают, что требуется назначение, без зависимости только от цвета.

UI-review от `ui-designer` рекомендует вынести presentational-компонент `GroupsOverview`, поскольку `GroupManagement.tsx` уже крупный. Обзор размечается как `section` с видимым заголовком `Обзор групп` и `dl/dt/dd`; метрики остаются неинтерактивными.

## Execution steps
1. Branch and preflight
   - Переключиться на `main`, выполнить `git pull` и убедиться, что status чистый.
   - Создать и активировать `feature/TASK-065-groups-overview-compact`.
   - Перед backend/frontend изменениями перечитать корневой, `backend/AGENTS.md` и `frontend/AGENTS.md`.

2. Добавить независимый backend summary contract
   - В `GroupApiConstants` добавить локальный маршрут `/summary` до параметризованного `/{id:guid}`.
   - Создать отдельный typed response `GroupSummaryResponse` с `TotalCount`, `ActiveCount`, `ActiveWithoutTrainerCount`.
   - В `GroupEndpoints` зарегистрировать `GET /groups/summary` внутри существующей группы с `ManageGroups`; не добавлять новую permission или обход авторизации.
   - Выполнить агрегирование на полном `TrainingGroups.AsNoTracking()` без `Skip/Take`. Считать `activeWithoutTrainerCount` условием `IsActive && !Trainers.Any()` на стороне БД.
   - Не загружать коллекцию групп в память и не переиспользовать paged `LoadPageAsync` для summary; использовать count/projection запросы, корректно возвращающие нули при пустом наборе.
   - Не менять `GET /groups`, write endpoints, domain entities, schema или migrations.

3. Зафиксировать backend regression coverage
   - Дополнить `GroupsApiTests` проверкой точного JSON-контракта summary и доступа HeadCoach/Administrator через действующую policy.
   - Создать набор более чем из 50 групп с сочетанием active/inactive и assigned/unassigned trainers и доказать, что summary возвращает значения полного набора независимо от list paging.
   - Отдельно проверить пустой набор (`0/0/0`) и семантику: неактивная группа без тренера не входит в `activeWithoutTrainerCount`, активная с одним или несколькими тренерами не входит, активная без тренеров входит.
   - Сохранить существующие list-contract тесты без переписывания под новый envelope.

4. Добавить типизированный frontend consumer
   - В `frontend/src/lib/api/endpoints.ts` добавить `API_ENDPOINTS.groups.summary`.
   - В `frontend/src/lib/api/types.ts` добавить `TrainingGroupSummary` и payload type, если transport type отделяется от UI type.
   - В `frontend/src/lib/api/groups.ts` реализовать `getGroupSummary(signal?)` и явное mapping/validation по принятому в текущем API-слое паттерну.
   - Реэкспортировать функцию и публичный тип из `frontend/src/lib/api.ts`.
   - Добавить `frontend/src/lib/api/groups.test.ts`: правильный endpoint/method, mapping трёх полей, abort/error propagation без подмены ответа данными первой страницы.

5. Создать компактный `GroupsOverview`
   - Добавить сфокусированный `frontend/src/features/groups/GroupsOverview.tsx`, принимающий typed summary и явное состояние loading/error.
   - Разметить контейнер как `<section aria-labelledby="groups-overview-title">`, заголовок как H2, показатели как один `<dl>` с тремя парами `<dt>/<dd>`.
   - Для `Активные` показать количество и округлённый процент; для пустого total — `—`.
   - Для `Без тренера` всегда показать уточнение `среди активных`; при нуле — `Всё назначено`, при положительном значении — число и текстовый attention-сигнал.
   - Не добавлять `cursor: pointer`, `tabIndex`, `role="button"`, click handlers или фильтрацию по метрикам.
   - Loading и error делать компактными внутри overview region; ошибка summary не должна заменять список или actions.

6. Разделить загрузку списка и обзора в `GroupsListScreen`
   - Оставить текущую загрузку `getGroups({ take: GROUPS_LIST_TAKE })` и её state независимыми.
   - Добавить отдельный запрос `getGroupSummary` со своим data/loading/error и AbortController; не объединять запросы через fail-fast `Promise.all`.
   - Удалить вычисления `activeGroupsCount`/`staffedGroupsCount` по `groups` и три `MetricCard`.
   - Общий refresh-key должен повторно запускать оба независимых запроса. Ошибка одного ресурса не очищает успешные данные другого.
   - Добавить `GroupsOverview` перед секцией списка, не менять list rows, empty state, CRUD callbacks или navigation.

7. Уплотнить actions только на экране групп
   - Оставить `Создать группу` текстовой primary-кнопкой с текущим accent styling.
   - Заменить высокий mobile `ResponsiveButtonGroup` для этого экрана на локальную actions-группу: primary action и secondary icon-refresh рядом.
   - Реализовать refresh как Mantine `ActionIcon`/эквивалент размером не меньше 44x44 px, с `aria-label="Обновить список"`, `Tooltip` и видимыми hover/focus/disabled/loading states.
   - Сохранить keyboard order `Создать группу` → `Обновить список`; не обрезать focus ring.
   - Не менять глобальный `RefreshButton` или `ResponsiveButtonGroup`, если локального решения достаточно.

8. Добавить локальные responsive styles
   - В `frontend/src/App.css` добавить только namespaced правила `.groups-screen`, `.groups-header-actions`, `.groups-overview*`.
   - Desktop: H1/actions в штатной строке; overview — три горизонтальные колонки, высота не более 128 px.
   - 320/390/440 px: H1 не перекрывается header, actions используют компактную сетку `minmax(0, 1fr) 44px`, overview остаётся `repeat(3, minmax(0, 1fr))` и не превращается в три вертикальные карточки; высота не более 144 px.
   - Для 320 px использовать компактные padding/gap, разделители, `min-width: 0`, адаптивный размер чисел, `font-variant-numeric: tabular-nums` и безопасный перенос длинных значений без horizontal scroll.
   - Не переиспользовать `.compact-summary-strip`: его текущие mobile rules переводят содержимое в одну колонку.
   - Для helper labels использовать цвет с контрастом не ниже 4.5:1 (например существующий muted token около `#66756F`), для attention-текста — тёмный accent token; не использовать светлый warning/accent как единственный текстовый сигнал.
   - Не добавлять отрицательные margin/top offsets и не менять глобальные AppShell/PageLayout offsets скрыто.

9. Добавить frontend unit/component regression coverage
   - `GroupsOverview.test.tsx`: semantic region и `dl`, три метрики, rounding, `total=0 -> —`, `Всё назначено`, positive attention state, видимое `среди активных`, отсутствие интерактивной роли/tab stop.
   - `GroupManagement.test.tsx`: список остаётся доступным при loading/error summary; overview остаётся независимым при ошибке списка; actions доступны в каждом состоянии; refresh повторно вызывает list и summary.
   - Проверить accessible name refresh и наличие tooltip через keyboard/pointer interaction; геометрический размер оставить Playwright.

10. Обновить Playwright mocks и responsive coverage
   - Добавить mock `/api/groups/summary` во все affected specs, которые открывают `/groups`, минимум в `responsive-main-screens.spec.ts`, `stage12.spec.ts` и при необходимости `group-schedule.spec.ts`.
   - На desktop проверить три горизонтальные метрики, overview height <=128 px и отсутствие длинных legacy descriptions/cards.
   - На 320/390/440 проверить overview height <=144 px, `scrollWidth <= clientWidth`, три колонки, отсутствие page-level horizontal scroll и непересечение H1/actions/overview.
   - Добавить двустороннюю геометрическую проверку: `headingBox.y >= headerBox.y + headerBox.height` с допуском округления 1 px, а не только существующий upper bound для положительного отступа.
   - Проверить primary/refresh ordering, размер refresh >=44x44, accessible name, tooltip, keyboard focus ring, длинные 5–7-значные значения и состояние `Всё назначено`.
   - Проверить, что после прокрутки список не перекрывается mobile bottom navigation.

11. Финальная cross-layer validation
   - Запустить backend tests, frontend unit tests, lint, build и affected Playwright specs.
   - Вручную осмотреть `/groups` на desktop и 320/390/440 px с empty/normal/large/summary-error состояниями.
   - Убедиться, что list endpoint, roles/permissions, CRUD, group assignment и другие routes не изменены.

## Preferred implementation strategy
1. Contract-first: отдельный additive `GET /groups/summary` и backend integration tests.
2. Typed frontend API consumer и его unit test.
3. Изолированный presentational `GroupsOverview` с component tests.
4. Независимая интеграция summary в `GroupsListScreen` и локальное уплотнение header actions.
5. Локальные responsive styles и Playwright geometry/a11y coverage.
6. Небольшие проверяемые commits внутри одной task-ветки.

Отдельный endpoint предпочтительнее изменения list envelope: он не ломает текущих consumers и естественно выполняет требование независимых loading/error states.

## Files likely to change
- `backend/src/GymCrm.Api/Auth/GroupApiConstants.cs`
- `backend/src/GymCrm.Api/Auth/GroupEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/GroupSummaryResponse.cs` (new)
- `backend/tests/GymCrm.Tests/GroupsApiTests.cs`
- `frontend/src/lib/api/endpoints.ts`
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/groups.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/api/groups.test.ts` (new)
- `frontend/src/features/groups/GroupManagement.tsx`
- `frontend/src/features/groups/GroupsOverview.tsx` (new)
- `frontend/src/features/groups/GroupsOverview.test.tsx` (new)
- `frontend/src/features/groups/GroupManagement.test.tsx` (new, if screen-level request isolation is not fully covered by a focused existing harness)
- `frontend/src/App.css`
- `frontend/e2e/responsive-main-screens.spec.ts`
- `frontend/e2e/stage12.spec.ts`
- `frontend/e2e/group-schedule.spec.ts` only if its `/groups` route mock requires the new summary response

## Constraints
- Backend remains the source of truth for access scope and aggregate membership.
- Preserve the existing `ManageGroups` policy; do not add or change roles/permissions.
- Summary values must not depend on `page`, `pageSize`, `skip`, `take` or the first 50 loaded rows.
- Do not infer missing aggregates from frontend list data or silently approximate values.
- Preserve Mantine, Onest and the existing content-layout contract.
- Preserve independent list/actions availability when summary loads or fails.
- Overview is a semantic noninteractive data region; state meaning is not color-only.
- Helper text contrast >=4.5:1; focus/icon state contrast >=3:1; refresh touch target >=44x44 px.
- No page horizontal scroll, focus-ring clipping or overlap with top/bottom navigation.
- Keep changes local to the groups screen and additive API contract.

## Out of scope
- Group create/edit/activity/assignment business rules.
- Roles, permissions, access-scope redesign or new authorization policy.
- List row/card redesign or group forms.
- Global redesign of `MetricCard`, `PageLayout`, `PageHeader`, `RefreshButton`, `ResponsiveButtonGroup` or AppShell.
- Click-to-filter metrics, URL filter state or new filters.
- New product metrics beyond `Всего`, `Активные`, `Без тренера`.
- Schema changes or migrations.

## Required test coverage

### Unit tests
- Frontend API test for `getGroupSummary` endpoint and typed mapping.
- `GroupsOverview` tests for values, rounding, empty total, neutral/attention states, semantic markup and noninteractive behavior.
- `GroupsListScreen` tests for independent list/summary states, refresh of both resources and actions remaining available.

### Integration tests
- Backend `GroupsApiTests` for exact summary contract, policy access, zero rows, active/inactive and trainer assignment combinations.
- Backend test with more than 50 rows proving summary independence from list page size.
- Existing list API tests remain green, protecting backward compatibility.

### UI tests
- Playwright on desktop and 320/390/440 px for overview/header geometry, height caps, no overflow/overlap, 44x44 refresh, tooltip/accessibility and keyboard focus.
- Update affected network mocks for the additive endpoint.

### Manual validation
- Visual review of compactness, contrast, focus states and long values is required, but does not replace automated regression checks.
- Compare list start position before/after implementation and confirm the new overview moves primary content materially upward while satisfying the explicit height caps.

## Test plan
- [ ] `dotnet test backend/GymCrm.slnx`
- [ ] `cd frontend && npm run test:unit -- GroupsOverview GroupManagement groups.test`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:e2e -- responsive-main-screens.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- stage12.spec.ts`
- [ ] Run `group-schedule.spec.ts` if its mocks or `/groups` flow change.
- [ ] Manual desktop and 320/390/440 px review for empty, populated, large-number, loading and error states.

## Regression barrier
TASK-065 is not complete until automated tests jointly prove that backend summary counts the complete dataset (including >50 rows), the frontend never derives summary from the loaded page, zero totals render `—`, unassigned semantics exclude inactive groups, summary failure does not block the list/actions, and Playwright geometry checks prevent top-header overlap, horizontal overflow, oversized overview and sub-44px refresh targets at the required widths.

## Risks
- Route ordering: `/groups/summary` must not be captured by `/{id:guid}`; registering the constant endpoint explicitly avoids ambiguity.
- EF translation/count semantics for `!group.Trainers.Any()` must be integration-tested against the real test provider.
- Existing e2e route mocks may treat the new request as unexpected; update every spec that mounts `/groups`.
- Global mobile `.page-header__actions` rules may still affect the local actions wrapper; keep overrides namespaced and verify geometry.
- Long values and `Всё назначено` can increase height at 320 px; use a stable three-column grid and adaptive typography instead of vertical cards.
- Light Mantine dimmed/warning colors may miss contrast requirements; use verified project tokens and text labels.
- Shared shell overlap may be the true cause rather than local groups layout.

## Stop conditions
Остановиться и не писать код, если:
- branch preflight не подтверждает чистый актуальный `main` и правильную task-ветку;
- API contract или существующая `ManageGroups` access scope не могут быть определены из кода;
- корректные агрегаты требуют изменения roles/permissions/domain assignment rules;
- причина отрицательного перекрытия подтверждена в общем `AppLayout`, `.app-shell__main`, `.app-shell__header`, глобальном `PageLayout/PageHeader` или header offsets: оформить отдельную shared-shell задачу и проверить все affected routes, не чинить shell скрыто в TASK-065;
- scope расширяется до глобальной переработки shared UI или других экранов;
- rollout перестаёт быть additive/local или acceptance criteria невозможно выполнить без уточнений.

Backend + frontend сами по себе не являются stop condition.

## Ready for Codex execution
yes
