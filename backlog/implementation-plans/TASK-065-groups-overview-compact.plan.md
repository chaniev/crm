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
Экран управления группами должен сразу начинаться с одной компактной горизонтальной строки `Всего 100 · Без тренера 4 · Создать · Обновить`, после которой без промежуточного заголовка идут строки групп. Видимые заголовки `Группы`, `Обзор групп`, `Список групп` и показатель `Активные` удаляются на desktop и mobile.

## Current understanding
Задача локальная full-stack и имеет низкий риск. Backend сохраняет существующие правила доступа и становится источником достоверных агрегатов; frontend отвечает только за типизированное потребление двух значений и максимально компактный responsive UX. Domain rules, permissions, CRUD групп и назначение тренеров не меняются.

Текущий `GET /groups` возвращает страницу как массив `GroupListItemResponse`. `GroupsListScreen` запрашивает `take=50`: `totalCount`, `activeGroupsCount` и `staffedGroupsCount` фактически зависят от полученной страницы. Frontend уже умеет читать как legacy-массив, так и envelope, но backend всё ещё возвращает массив, поэтому расширять или заменять list contract ради обзора не требуется.

Предпочтительный контракт — отдельный `GET /groups/summary`, защищённый той же policy `ManageGroups`, с ответом:

```json
{
  "totalCount": 0,
  "activeWithoutTrainerCount": 0
}
```

Отдельный endpoint сохраняет совместимость списка и позволяет загружать summary независимо: сбой агрегатов не блокирует успешно загруженные строки и действия. `activeWithoutTrainerCount` считается backend-запросом только среди активных групп без записей `Trainers`; paging-параметры списка на агрегаты не влияют.

Нормальное видимое состояние summary содержит ровно две пары: `Всего 128` и `Без тренера 4`. При нулевых значениях показываются `Всего 0` и `Без тренера 0`. Процент активных, текст `Всё назначено`, видимое уточнение `среди активных`, отдельный attention-текст и метрика `Активные` не выводятся. Семантика `Без тренера среди активных` сохраняется через backend query и доступное скрытое описание.

## Final UI decision
Последние согласованные desktop/mobile макеты имеют приоритет над конфликтующим wording исходной task-карточки:
- заказчик повторно подтвердил это решение 2026-07-14: финальный вариант содержит только две метрики и не должен возвращать `Активные`, процент или `Всё назначено`;
- не показывать H1/видимый page title `Группы` в main content; название route остаётся в desktop/mobile navigation;
- не показывать `Обзор групп`;
- не показывать `Список групп`;
- не показывать `Активные`, процент активных или третью метрику;
- первая строка main content объединяет `Всего`, `Без тренера`, primary action `Создать` и icon-refresh `Обновить список`;
- непосредственно после этой строки, без промежуточного заголовка, начинается существующий список групп;
- desktop и mobile используют одну и ту же информационную иерархию.

UI-review рекомендует вынести сфокусированный presentational-компонент `GroupsSummaryBar`, поскольку `GroupManagement.tsx` уже крупный. Компонент размечается как доступная section/toolbar, связанная через `aria-labelledby` с visually hidden H2, с двумя парами `dl/dt/dd` и группой действий, но без видимого заголовка. Метрики остаются неинтерактивными.

## Execution steps
1. Branch and preflight
   - Переключиться на `main`, выполнить `git pull` и убедиться, что status чистый.
   - Создать и активировать `feature/TASK-065-groups-overview-compact`.
   - Перед backend/frontend изменениями перечитать корневой, `backend/AGENTS.md` и `frontend/AGENTS.md`.

2. Добавить независимый backend summary contract
   - В `GroupApiConstants` добавить локальный маршрут `/summary` до параметризованного `/{id:guid}`.
   - Создать отдельный typed response `GroupSummaryResponse` только с `TotalCount` и `ActiveWithoutTrainerCount`.
   - В `GroupEndpoints` зарегистрировать `GET /groups/summary` внутри существующей группы с `ManageGroups`; не добавлять новую permission или обход авторизации.
   - Summary считает все группы системы для любого пользователя с `ManageGroups`; дополнительная фильтрация по филиалу, тренеру или membership не применяется, что соответствует текущему scope `GET /groups`.
   - Выполнить агрегирование на полном `TrainingGroups.AsNoTracking()` без `Skip/Take`. Считать `activeWithoutTrainerCount` условием `IsActive && !Trainers.Any()` на стороне БД.
   - Не загружать коллекцию групп в память и не переиспользовать paged `LoadPageAsync` для summary; использовать count/projection запросы, корректно возвращающие нули при пустом наборе.
   - Не менять `GET /groups`, write endpoints, domain entities, schema или migrations.

3. Зафиксировать backend regression coverage
   - Дополнить `GroupsApiTests` проверкой точного JSON-контракта summary и доступа HeadCoach/Administrator через действующую policy.
   - Создать набор более чем из 50 групп с сочетанием active/inactive и assigned/unassigned trainers и доказать, что summary возвращает значения полного набора независимо от list paging.
   - Отдельно проверить пустой набор (`0/0`) и семантику: неактивная группа без тренера не входит в `activeWithoutTrainerCount`, активная с одним или несколькими тренерами не входит, активная без тренеров входит.
   - Сохранить существующие list-contract тесты без переписывания под новый envelope.

4. Добавить типизированный frontend consumer
   - В `frontend/src/lib/api/endpoints.ts` добавить `API_ENDPOINTS.groups.summary`.
   - В `frontend/src/lib/api/types.ts` добавить `TrainingGroupSummary` и payload type, если transport type отделяется от UI type.
   - В `frontend/src/lib/api/groups.ts` реализовать `getGroupSummary(signal?)` и явное mapping/validation по принятому в текущем API-слое паттерну.
   - Реэкспортировать функцию и публичный тип из `frontend/src/lib/api.ts`.
   - Добавить `frontend/src/lib/api/groups.test.ts`: правильный endpoint/method, mapping двух полей, abort/error propagation без подмены ответа данными первой страницы.

5. Создать сверхкомпактный `GroupsSummaryBar`
   - Добавить сфокусированный `frontend/src/features/groups/GroupsSummaryBar.tsx`, принимающий typed summary, явное состояние loading/error и actions slots/callbacks.
   - Разметить контейнер как `<section aria-labelledby="groups-summary-title">`, где `groups-summary-title` — реальный visually hidden H2 `Сводка и действия групп`; показатели — один `<dl>` ровно с двумя парами `<dt>/<dd>`: `Всего` и `Без тренера`.
   - Не добавлять видимый heading, card wrapper, shadow, описание, процент, `Активные`, `Всё назначено` или третий показатель.
   - Для `Без тренера` добавить доступное скрытое уточнение `среди активных`, не расширяя видимый текст согласованного макета.
   - Разместить primary `Создать` и icon-refresh в той же строке, что и две метрики, внутри отдельной семантической группы действий.
   - Не добавлять `cursor: pointer`, `tabIndex`, `role="button"`, click handlers или фильтрацию по метрикам.
   - Loading/error не должны создавать отдельную вертикальную панель: использовать `—` для недоступных значений и компактный `aria-live` status; список и actions всегда остаются доступны.

6. Разделить загрузку списка и summary в `GroupsListScreen`
   - Оставить текущую загрузку `getGroups({ take: GROUPS_LIST_TAKE })` и её state независимыми.
   - Добавить отдельный запрос `getGroupSummary` со своим data/loading/error и AbortController; не объединять запросы через fail-fast `Promise.all`.
   - Удалить вычисления `activeGroupsCount`/`staffedGroupsCount` по `groups` и три `MetricCard`.
   - Общий refresh-key должен повторно запускать оба независимых запроса. Ошибка одного ресурса не очищает успешные данные другого.
   - В `PageLayout` отключить штатный видимый header через `showHeader={false}` и добавить реальный visually hidden H1 `Группы`, чтобы сохранить heading hierarchy без видимого page title.
   - Добавить `GroupsSummaryBar` первым элементом main content.
   - Удалить видимый `SectionHeader title="Список групп"`; добавить реальный visually hidden H2 `Список групп` и связать с ним section списка через `aria-labelledby`.
   - Не менять list rows, empty state, CRUD callbacks или navigation.

7. Встроить actions в summary-строку только на экране групп
   - Использовать `Создать` как текстовую primary-кнопку с текущим accent styling на всех проверяемых ширинах, включая 320 px.
   - Удалить actions из `PageLayout` header и заменить высокий mobile `ResponsiveButtonGroup` локальной actions-группой внутри `GroupsSummaryBar`.
   - Реализовать refresh как Mantine `ActionIcon`/эквивалент размером не меньше 44x44 px, с `aria-label="Обновить список"`, `Tooltip` и видимыми hover/focus/disabled/loading states.
   - Сохранить keyboard order `Создать` → `Обновить список`; не обрезать focus ring.
   - На 320 px убрать декоративный plus-icon из create-action, использовать `nowrap`, `min-width: 0` и компактный horizontal padding; не сокращать и не скрывать видимый label `Создать`.
   - Не менять глобальный `RefreshButton` или `ResponsiveButtonGroup`, если локального решения достаточно.

8. Добавить локальные responsive styles
   - В `frontend/src/App.css` добавить только namespaced правила `.groups-screen`, `.groups-summary-bar*`, `.groups-list-section*`.
   - На desktop, 320, 390 и 440 px summary использует одну строку без wrap: две inline-метрики слева, actions справа; высота строки 52–56 px, абсолютный максимум 60 px.
   - Для 320 px использовать grid `max-content max-content minmax(0, 1fr) 44px`, horizontal padding 4–6 px и gap 4 px; с 390 px gap 6–8 px.
   - Summary не является карточкой: без background card, radius и shadow; допустим один нейтральный нижний divider как в согласованном макете.
   - Между нижней границей summary-строки и первой строкой/контейнером списка оставить 8–12 px; отдельный видимый заголовочный уровень не резервировать.
   - Для 320 px использовать `min-width: 0`, компактные gap/divider и `font-variant-numeric: tabular-nums`; create-action имеет полный `Создать`, высоту 44 px, `nowrap`, без plus-icon и с компактным padding, refresh — строго 44x44 px.
   - Продуктово ожидается не более 100 групп; responsive layout и геометрические тесты должны поддерживать значения summary от `0` до `100` без сокращения и переполнения. Backend не вводит искусственный лимит на агрегат.
   - Не переиспользовать `.compact-summary-strip`: его mobile rules могут переводить содержимое в колонку.
   - Видимый текст метрик должен сохранять контраст не ниже 4.5:1; focus/icon states — не ниже 3:1.
   - Не добавлять отрицательные margin/top offsets и не менять глобальные AppShell/PageLayout offsets скрыто.

9. Добавить frontend unit/component regression coverage
   - `GroupsSummaryBar.test.tsx`: semantic section и `dl`, связь с visually hidden H2, ровно две видимые метрики, `0/0`, loading/error placeholders, скрытое уточнение `среди активных`, отсутствие интерактивной роли/tab stop у метрик.
   - Добавить negative assertions: в main content отсутствуют видимые `Группы`, `Обзор групп`, `Список групп`, `Активные`, процент и `Всё назначено`; одновременно accessibility assertions находят visually hidden H1/H2 и labelled sections.
   - `GroupManagement.test.tsx`: список остаётся доступным при loading/error summary; summary остаётся независимым при ошибке списка; actions доступны в каждом состоянии; refresh повторно вызывает list и summary.
   - Проверить accessible names и tooltips обеих actions; геометрические размеры и одну строку оставить Playwright.

10. Обновить Playwright mocks и responsive coverage
   - Добавить mock `/api/groups/summary` во все affected specs, которые открывают `/groups`, минимум в `responsive-main-screens.spec.ts`, `stage12.spec.ts` и при необходимости `group-schedule.spec.ts`.
   - На desktop, 320, 390 и 440 px проверить одну summary-строку высотой <=60 px, две метрики и обе actions без wrap; `summary.scrollWidth <= summary.clientWidth` и page-level horizontal scroll отсутствует.
   - Проверить, что верх summary находится не выше нижней границы AppShell header с допуском округления 1 px.
   - Геометрически проверить общую горизонтальную полосу: все четыре элемента целиком находятся внутри одного `summaryBox`, разница их вертикальных центров не превышает 3 px, X-порядок строгий `total < withoutTrainer < create < refresh`.
   - Проверить `firstRowTop >= summaryBottom` и gap в диапазоне 8–12 px; между ними нет видимого heading.
   - Добавить negative assertions для main content: нет видимых `Группы`, `Обзор групп`, `Список групп`, `Активные`, процентов и legacy metric cards; navigation label `Группы` остаётся, а accessibility tree содержит скрытые H1/H2 и labelled regions.
   - Проверить primary/refresh ordering, обе touch targets >=44x44, accessible names, tooltips, keyboard focus ring и граничное ожидаемое значение `100`.
   - На всех ширинах, включая 320 px, проверить полный видимый label `Создать`; на 320 px plus-icon отсутствует.
   - Проверить, что после прокрутки список не перекрывается mobile bottom navigation.

11. Финальная cross-layer validation
   - Запустить backend tests, frontend unit tests, lint, build и affected Playwright specs.
   - Вручную осмотреть `/groups` на desktop и 320/390/440 px с empty/normal/large/summary-error состояниями.
   - Убедиться, что list endpoint, roles/permissions, CRUD, group assignment и другие routes не изменены.

## Preferred implementation strategy
1. Contract-first: отдельный additive `GET /groups/summary` и backend integration tests.
2. Typed frontend API consumer и его unit test.
3. Изолированный presentational `GroupsSummaryBar` с component tests.
4. Независимая интеграция summary в `GroupsListScreen`, отключение видимого PageLayout header и перенос actions в summary-строку.
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
- `frontend/src/features/groups/GroupsSummaryBar.tsx` (new)
- `frontend/src/features/groups/GroupsSummaryBar.test.tsx` (new)
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
- Summary is a semantic noninteractive data region combined with a distinct actions group; видимые headings отсутствуют, но реальные visually hidden H1/H2 и `aria-labelledby` обязательны.
- Visible metric text contrast >=4.5:1; focus/icon state contrast >=3:1; both action touch targets >=44x44 px.
- No page horizontal scroll, focus-ring clipping or overlap with top/bottom navigation.
- Normal UI exposes only `Всего`, `Без тренера`, `Создать` and refresh before list rows; no other summary label is added.
- Summary охватывает все группы системы для пользователя с `ManageGroups`, без дополнительного branch/trainer/membership scope.
- Keep changes local to the groups screen and additive API contract.

## Out of scope
- Group create/edit/activity/assignment business rules.
- Roles, permissions, access-scope redesign or new authorization policy.
- List row/card redesign or group forms.
- Global redesign of `MetricCard`, `PageLayout`, `PageHeader`, `RefreshButton`, `ResponsiveButtonGroup` or AppShell.
- Click-to-filter metrics, URL filter state or new filters.
- Any product metrics beyond `Всего` and `Без тренера`, including visible `Активные` or active percentage.
- Schema changes or migrations.

## Required test coverage

### Unit tests
- Frontend API test for `getGroupSummary` endpoint and typed mapping.
- `GroupsSummaryBar` tests for two values, zero/error/loading states, semantic markup, accessible actions and noninteractive metrics.
- `GroupsListScreen` tests for independent list/summary states, refresh of both resources and actions remaining available.

### Integration tests
- Backend `GroupsApiTests` for exact summary contract, policy access, zero rows, active/inactive and trainer assignment combinations.
- Backend test with more than 50 rows proving summary independence from list page size.
- Existing list API tests remain green, protecting backward compatibility.

### UI tests
- Playwright on desktop and 320/390/440 px for one-row summary/actions geometry, <=60 px height, 8–12 px gap to list, no overflow/overlap, >=44 px actions, tooltips/accessibility and keyboard focus.
- Negative Playwright assertions for removed visible headings and `Активные`.
- Update affected network mocks for the additive endpoint.

### Manual validation
- Visual review of compactness, contrast, focus states and long values is required, but does not replace automated regression checks.
- Compare list start position with the last approved mockups and confirm rows begin immediately after the compact summary divider without a visible list title.

## Test plan
- [ ] `dotnet test backend/GymCrm.slnx`
- [ ] `cd frontend && npm run test:unit -- GroupsSummaryBar GroupManagement groups.test`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:e2e -- responsive-main-screens.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- stage12.spec.ts`
- [ ] Run `group-schedule.spec.ts` if its mocks or `/groups` flow change.
- [ ] Manual desktop and 320/390/440 px review for empty, populated, boundary value `100`, loading and error states.

## Regression barrier
TASK-065 is not complete until automated tests jointly prove that backend summary counts the complete system dataset available under `ManageGroups` (including >50 rows), frontend never derives summary from the loaded page, unassigned semantics exclude inactive groups, summary failure does not block list/actions, and Playwright confirms one <=60 px row containing only `Всего`, `Без тренера` and both actions before titleless list rows. Tests must fail if visible `Группы`, `Обзор групп`, `Список групп`, `Активные`, a percentage, wrapping, horizontal overflow, gap outside 8–12 px, hidden heading semantics loss, a sub-44px action or shortening of `Создать` returns.

## Risks
- Route ordering: `/groups/summary` must not be captured by `/{id:guid}`; registering the constant endpoint explicitly avoids ambiguity.
- EF translation/count semantics for `!group.Trainers.Any()` must be integration-tested against the real test provider.
- Existing e2e route mocks may treat the new request as unexpected; update every spec that mounts `/groups`.
- `PageLayout showHeader={false}` may remove the visible H1 expected by generic responsive tests; update only groups-specific expectations while preserving the navigation label and accessible main name.
- Значения до ожидаемого максимума `100` плюс две actions могут быть тесными на 320 px; использовать компактную четырёхколоночную сетку, убрать декоративный plus-icon и уменьшить padding, не перенося и не сокращая `Создать`.
- Removing visible headings must not leave unnamed regions; use `aria-label`/hidden semantics and automated accessibility assertions.
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
