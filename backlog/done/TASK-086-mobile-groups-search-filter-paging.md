# TASK-086: Добавить mobile-first поиск, фильтры и paging списка групп

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-07-26 23:56
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/TASK-086-mobile-groups-search-filter-paging.plan.md
- implementation_branch: feature/TASK-086-mobile-groups-search-filter-paging
- implementation_state: completed
- implementation_commit: d3963a91191f53255290ce1e57b044f5ae824107
- integration_commit: f8f646008097d8dbbc83cf1f8834ea57c2ee37e6
- delivered_on_main_at: 2026-07-30
- moved_to_done_at: 2026-07-30
- last_status_reviewed_at: 2026-07-30 19:33 MSK
- reviewed_main_commit: c69f47b9a91d09363577406052cf8d36633726b3

## Priority
P1

## Goal
Суперадминистратор, администратор или главный тренер находит и редактирует нужную группу без прокрутки всех групп клуба.

## Shared mobile UI contract

- Normative contract:
  [Единый контракт мобильного интерфейса CRM](../../docs/MOBILE_UI_CONTRACT.md).
- Foundation dependency: `TASK-090`; touch/compact-height sweep: `TASK-084`.
- Эта задача владеет group-specific locator fields, decision data и paging
  source, но использует shared locator, filters, range, states и cards.
- Выпущенные `EntityLocatorBar`, `ActiveFiltersBar`, `ListRangeStatus`,
  `TaskItem` и hidden route-title contract являются обязательным baseline.
- Visual comparison не задаёт собственные colors, typography, radii, shadows
  или touch sizes.

## User role
Суперадминистратор / администратор / главный тренер.

## Problem
После TASK-090 visible route header скрыт, но Groups registry всё ещё:

- показывает `GroupsSummaryBar`, запрещённый нормативным registry contract;
- загружает до `50` длинных cards без search, filters или UI paging;
- использует `/groups`, который принимает только `isActive` и возвращает
  массив без `totalCount`, поэтому честный range/paging невозможен;
- не поддерживает server-side поиск по названию и `без тренера`;
- сохраняет повторяющуюся edit action меньше целевого mobile contract в части
  call sites.

Frontend-фильтрация уже полученного page не решает задачу для 30+ групп и
создаёт неверные totals, поэтому locator и paging требуют typed backend
contract.

## Scope
- Удалить `GroupsSummaryBar` из registry на mobile, tablet и desktop; create и
  refresh перенести в первый `EntityLocatorBar`.
- Добавить server-side trimmed case-insensitive contains-поиск `query` по
  названию группы.
- Добавить server-side фильтры `isActive=true|false|absent` и
  `withoutTrainer=true|absent`.
- Изменить typed `/groups` list response на envelope
  `{ items, totalCount, skip, take }`, где `totalCount` считается после
  access scope, search и filters, до paging.
- Сохранить совместимость всех существующих frontend consumers `/groups`;
  frontend не фильтрует текущий page для имитации server result.
- Реализовать page-based pagination с `pageSize=10`, current page, total и
  previous/next controls; она использует server `totalCount` и не подменяется
  client-side `Показать ещё`.
- Более плотная mobile card hierarchy без потери branch, hall, schedule, trainer и status.
- Edit action минимум `44 x 44`.
- Показывать count/range через `ListRangeStatus`, а `без тренера` — через filter
  и group row, не через summary widget.
- Использовать branch/type/trainer/hall display data только если они уже
  присутствуют в разрешённом backend response.
- Для SuperAdministrator использовать глобальный backend-permitted набор; branch и hall остаются видимыми в rows/cards, а filter options берутся только из backend response.

## Out of scope
- Переработка group create/edit form.
- Новые group или trainer assignment business rules.
- Frontend-фильтрация данных, которых пользователь не должен получать.
- Превращение summary metrics в действия без отдельной операции.
- Удаление `/groups/summary` как backend endpoint, если у него остаются другие
  consumers; registry просто перестаёт от него зависеть.

## Responsive behavior
- `360 x 780`: search с min-width `156px`, filter trigger, refresh и create
  остаются в одной non-wrapping строке; secondary labels сворачиваются до
  accessible icon-only `44 x 44` раньше search. В первом batch не более 10
  групп.
- `390 x 844`: первым видимым рабочим блоком является locator без summary;
  search сохраняет min-width `176px`, затем видны range и начало первых 1–2
  групп.
- `420 x 912`, `440 x 956`: можно показать больше card metadata, не добавляя unmapped controls.
- `768 x 1024`: допустим двухколоночный grid при сохранении task/focus order.
- `1440 x 1200`: предпочтительны compact rows или table-like list с видимым
  `ListRangeStatus` и pagination.
- `912 x 420`, `956 x 440`: locator остаётся одной строкой compact-height
  mobile shell; filters открываются в достижимой dynamic-viewport surface, а
  primary list не скрыт nested scroll.

## Operational and interaction states
- Loading сохраняет locator, active filters и range placeholder; не выглядит
  empty.
- Empty first-run показывает create group как primary action.
- Empty filtered/search сохраняет query/filters и предлагает scoped reset.
- List error имеет retry, который не очищает query, filters или page.
- Focus order: search → clear при непустом query → filters → refresh → create
  → active filters/reset → list actions → pagination.
- Card не становится лишней focus stop, если единственная операция — отдельная edit action.
- Pagination объявляет current page и total.

## Acceptance criteria
- [ ] Пользователь сокращает список из 30+ групп search/filter без прокрутки всех карточек.
- [ ] Первый page/batch ограничен, интерфейс показывает текущий диапазон и total.
- [ ] `/groups` выполняет `query`, `isActive`, `withoutTrainer` до paging и
      возвращает `{ items, totalCount, skip, take }`; total стабилен для
      одинакового scoped запроса.
- [ ] `GroupsSummaryBar` и metrics `Всего` / `Без тренера` отсутствуют на
      `360`, `390`, `420`, `440`, `768` и `1440`; первым видимым row является
      `EntityLocatorBar`.
- [ ] Locator и retained actions не переносятся во вторую action-only строку;
      search сохраняет нормативную min-width.
- [ ] Edit action минимум `44 x 44` на обязательных mobile-размерах.
- [ ] Backend access scope сохранён; frontend не создаёт собственные permission rules.
- [ ] Нет horizontal page scroll, badge/text overlap и скрытых primary actions.
- [ ] Search/filter state сохраняется после edit и возврата к списку.
- [ ] SuperAdministrator сокращает набор из 30+ групп минимум двух филиалов search/filter/paging без прокрутки всех cards.
- [ ] SuperAdministrator create/edit actions отражают backend permissions; frontend не создаёт branch scope локально.

## Test checklist
- [ ] Backend integration tests для trimmed/case-insensitive `query`,
      `isActive`, `withoutTrainer`, combined filters, stable total и paging
      validation.
- [ ] Frontend API tests envelope mapping и unit tests filtering/paging view
      model без client-side filtering page.
- [ ] E2E: search → active/inactive → без тренера → edit → return → reset.
- [ ] E2E SuperAdministrator: multi-branch search/filter/page → edit → return; branch/hall context остаётся читаемым.
- [ ] E2E с 30+ группами на `390 x 844`.
- [ ] Проверить все обязательные mobile/tablet/desktop/compact-height размеры.
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:unit`
- [ ] `dotnet test backend/GymCrm.slnx`
- [ ] Запустить affected Playwright и iPhone WebKit checks.

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: заметное cross-layer изменение list/query contract без изменения
  backend domain или permission semantics.

## Related tasks
- `TASK-065`: завершённая сводка групп; её metrics больше не показываются как
  верхний registry widget после нормативного решения TASK-090.

## Source notes
- Source: usability audit of the fully rebuilt and seeded local stand.
- Evidence date: 2026-07-25.
- Source file: `backlog/processed/2026-07-27.md`
- Original note: `На экранах «Группы» и «Тренеры» отсутствует поиск. Необходимо добавить возможность поиска на обоих экранах.`
- Source file: `backlog/processed/2026-07-27-2.md`
- Original note: `Необходимо проверить все экраны и удалить оставшиеся виджеты.`

## Visual comparison
- [Сейчас / после](../mockups/usability-2026-07-25/TASK-086-comparison.png)
- [Описание преимуществ и границ макета](../mockups/usability-2026-07-25/README.md#task-086-mobile-first-group-locator-and-paging)

## Processing notes

- Reviewed at: 2026-07-26 after TASK-090 was merged to `main`.
- Foundation dependency is complete: shared locator, active-filter, range and
  state primitives are available.
- Revalidated against commit `3253b23`: `GroupsSummaryBar` remains in the
  current screen despite the normative no-summary contract, and `/groups`
  still lacks search, `withoutTrainer` and a real total envelope.
- Status remains `ready` after requirements correction: the card now owns
  removal of the residual summary widget plus server-side
  search/filter/paging and affected frontend consumers.
- Updated at: 2026-07-27 00:25
- Duplicate check: часть новой заметки про поиск групп полностью покрыта этой
  implementation task; отдельная задача не создана, scope и acceptance
  criteria не изменены. Поиск тренеров вынесен в TASK-096.
- Updated at: 2026-07-27 01:04
- Duplicate check: group-registry summary widget уже явно удаляется этой implementation task; новая all-screen заметка добавлена как source evidence без изменения scope. Другие непокрытые MetricCard вынесены в TASK-101.

## Completion notes

- Implementation commit `d3963a91191f53255290ce1e57b044f5ae824107`
  is an ancestor of current `origin/main` through integration commit
  `f8f646008097d8dbbc83cf1f8834ea57c2ee37e6`.
- Backend now owns group management scope, server-side query/filter/count/page
  semantics and direct foreign-branch target protection; frontend consumes the
  typed envelope without local permission filtering.
- The registry exposes locator, filters, honest range/paging, return-state
  restoration and no summary widget across the required responsive modes.
- Validation on 2026-07-30: backend tests `420/420`; frontend lint and build
  passed; unit tests `367/367`; targeted Chromium flows `46/46`; target iPhone
  WebKit `20/20`.
- Simulator/physical-device evidence remains unverified.
