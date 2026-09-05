# TASK-085: Search-focused mobile-поиск клиентов — вариант C

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-07-26 23:56
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/2026-07-30/TASK-085-mobile-client-search.plan.md
- implementation_branch: feature/TASK-085-mobile-client-search
- implementation_state: completed
- implementation_commit: 4e231991e28e2930c0bd4f5feb0c7ef7c52c1d0c
- delivered_on_main_at: 2026-07-30
- moved_to_done_at: 2026-07-30
- last_status_reviewed_at: 2026-07-30 19:33 MSK
- reviewed_main_commit: c69f47b9a91d09363577406052cf8d36633726b3

## Priority
P0

## Git branch
feature/TASK-085-mobile-client-search

## Goal
Суперадминистратор, администратор или тренер находит клиента среди 300+ записей
на mobile без предварительного открытия расширенных фильтров. Compact layout
использует плотные identity-first cards, а после начала поиска переходит в
search-focused state, сохраняет locator, активные фильтры и минимум пять
полностью видимых результатов на `390 x 844`.

## Shared mobile UI contract

- Normative contract:
  [Единый контракт мобильного интерфейса CRM](../../../docs/MOBILE_UI_CONTRACT.md).
- Foundation dependency: `TASK-090`; touch/compact-height sweep: `TASK-084`.
- Return-state dependency: `TASK-017` должен быть реализован отдельной задачей
  до TASK-085. Эта карточка не сохраняет focus-only UI mode: после hydration
  `browse` / `search-focused` выводится из normalized restored query, а focus
  восстанавливается на selected/anchor card без открытия keyboard.
- Эта задача владеет только client-specific `browse` / `search-focused`,
  `96px` identity cards, client decision data и state transitions.
- Page spacing, typography, colors, locator/filter primitives, operational
  states и temporary surfaces берутся из общего контракта.
- Существующие `EntityLocatorBar`, `ActiveFiltersBar`, `ListRangeStatus`,
  `TemporarySurfaceFooter` и typed client API являются baseline и не
  реализуются заново.
- Approved visual определяет workflow и information hierarchy, но не является
  источником общей palette или component geometry.

## User role
Суперадминистратор / администратор / тренер.

## UX contract

- Контекст: быстрый рабочий поиск клиента на ходу с телефона.
- Primary operation: поиск по имени или доступному роли телефону.
- Primary path:
  1. открыть `Клиенты`;
  2. сразу сфокусировать видимый search;
  3. ввести запрос;
  4. выбрать клиента из плотного списка;
  5. открыть preview/detail;
  6. вернуться с сохранёнными query, filters, scroll position и selected result.
- Completion signal: нужный клиент открыт, а возврат не заставляет повторять
  поиск или восстанавливать фильтры.
- Frequent operations: очистить search, открыть расширенные фильтры, удалить
  один active filter, сбросить только расширенные filters, открыть клиента.
- Secondary operations: group, status, membership dates, without photo и page
  size в drawer/popover.
- Permission-bound page action: `Новый клиент` только по backend permission
  `canManageClients`.
- Required decision data: ФИО, доступный роли телефон, branch identity для
  global multi-branch результата и конкретное status/action состояние.

## Problem
TASK-090 уже сделал locator постоянно видимым, скрыл дублирующий visible route
header и подключил shared filters/states. Оставшаяся client-specific проблема:

- состояния `browse` / `search-focused` не различаются;
- refresh и create постоянно занимают locator row во время ввода;
- mobile row сохраняет `min-height: 8.1rem` и отдельную fixed right action
  column, поэтому длинные ФИО обрезаются, а число видимых клиентов мало;
- branch identity не показана в mobile global/multi-branch result;
- navigation вызывает scroll reset, а полный `TASK-017` return-state contract
  ещё не реализован.

Вариант C решает остаточный workflow: при поиске остаются locator, filters и
результаты, а identity-first card высотой `96px` не резервирует отдельную
колонку под action text. Visible top-level header не возвращается ни в одном
state.

## Scope
- Реализовать compact state machine `browse` / `search-focused` внутри
  существующего breakpoint `max-width: 62rem`.
- Сохранить выпущенный TASK-090 inline search и shared locator/filter/state
  primitives.
- Использовать плотные identity-first cards точной высотой `96px` и gap `8px`
  в обоих compact states: `browse` и `search-focused`.
- Сохранить в drawer вторичные filters: group, status, membership dates,
  without photo и page size.
- Показывать active advanced filters вне drawer как удаляемые controls высотой
  минимум `44px`; не дублировать query отдельным chip.
- Разделить `Очистить поиск` и `Сбросить фильтры`:
  - clear search очищает только `query`;
  - reset filters не очищает `query`;
  - filter count не включает `query` и default `status=Active`.
- После отдельной реализации `TASK-017` сохранять search, filters, page, scroll
  position и selected result при открытии preview/detail и возврате к списку.
  Focus-only `search-focused` не сериализовать; restored visual mode выводить
  только из normalized query.
- Сохранить существующую backend search semantics и typed API boundary.
- Для пользователя с `branchId === null` искать по глобальному
  backend-permitted набору без локальной permission-фильтрации и показывать
  branch identity в каждой card. Видимость branch identity не зависит от
  количества rows, числа филиалов в response или совпадения ФИО.
- `Новый клиент` показывать только по backend permission `canManageClients`;
  внутри compact layout скрывать его только в `search-focused`, а desktop
  retained action не менять.
- Сохранять search и active filters видимыми при loading, empty, error и retry.
- Во время list loading оставлять search, clear-search и filter trigger
  enabled; stale request отменять или игнорировать.

## Out of scope
- Client detail, tabs и quick actions из `TASK-016`–`TASK-021`.
- Изменение backend-правил поиска.
- Переработка формы нового клиента.
- Новый branch switcher или frontend permission filter.
- Изменение server-provided action hints.

## Approved interaction model

### Browse state

Условие внутри compact layout: normalized `query` пустой и search не
сфокусирован.

- Visible page title отсутствует: persistent navigation уже называет
  top-level route, а semantic `h1`, document title и named main сохраняются.
- `EntityLocatorBar` является первым видимым row и содержит search, filter
  trigger, refresh и permission-bound `Новый клиент`.
- Count/range показывается через `ListRangeStatus` у results, а не через page
  header или summary card.
- Filter trigger показывает только количество active advanced filters.
- Active filters видимы и индивидуально удаляемы вне drawer.
- Cards используют ту же identity-first hierarchy и точную высоту `96px`, что
  и search results.

### Search-focused state

Условие внутри compact layout: search сфокусирован или normalized `query` не
пустой.

- Visible page title уже отсутствует; в этом compact state скрываются только
  refresh и `Новый клиент`, без spacer или action-only строки. На desktop
  `1440 x 1200` эти retained actions при search не скрываются.
- Locator row остаётся первой строкой content area и достижим при software
  keyboard.
- Search, clear-search, filter trigger, active filter chips/reset и results
  остаются видимыми.
- Results используют cards высотой `96px` с gap `8px`.
- На `390 x 844` при двух active filters видны минимум пять полных cards и
  начало следующей.

### State transitions

- Focus пустого search: `browse` → `search-focused`.
- Ввод query: остаёмся в `search-focused`.
- Clear search при сохранённом focus: очищается только query, интерфейс остаётся
  в `search-focused` до blur.
- Blur при пустом query: `search-focused` → `browse`.
- Blur при непустом query: остаёмся в `search-focused`.
- Whitespace-only draft нормализуется как empty query и после blur переводит
  интерфейс в `browse`.
- Mobile back при открытом drawer сначала закрывает drawer и возвращает focus
  на filter trigger.
- Закрытие software keyboard не очищает query и filters.
- Preview/detail/back с empty или whitespace-only restored query возвращает
  `browse`; с non-empty normalized query возвращает visual
  `search-focused`.
- После preview/detail/back focus получает restored selected/anchor card, а
  если её нет — first visible card или results region по контракту TASK-017.
  Search input не получает focus, и software keyboard не открывается.
- Focus-only `search-focused` с empty query не сохраняется в TASK-017 payload.

## Mobile information hierarchy

Порядок content:

1. app header;
2. visually-hidden semantic route `h1`;
3. locator row: search + filter trigger + разрешённые retained actions;
4. active advanced filters/reset;
5. range и results/recovery state;
6. bottom navigation с safe-area clearance.

Dense client card:

- common height `96px`, padding `10px 12px`, gap между cards `8px`;
- grid `36px minmax(0, 1fr) 20px`: avatar, identity content, decorative
  chevron;
- вся card является единственным primary row action и открывает preview;
- ФИО: `16px`, line-height `18–20px`, weight `800`, максимум две строки;
- не использовать one-line ellipsis для ФИО на `360–440px`;
- телефон показывать только роли с доступом;
- branch identity показывать в visible metadata и accessible name card тогда и
  только тогда, когда `currentUser.branchId === null`;
- при `status=Archived` compact pill всегда показывает `В архиве`;
- для active client compact pill использует первый backend-provided
  `actionHint`, mapped в краткую подпись (`Без абонемента`, `Без группы`,
  `До 31 июля`); без значимого hint показывает `Активен`;
- frontend не выводит приоритет pill из локальных membership/group rules;
- не резервировать fixed right column под `Нужно сделать`;
- полный ФИО остаётся в accessible name card и в preview/detail.

## Responsive behavior
- `360 x 780`: search и filter trigger образуют locator row; active chips
  переносятся без horizontal scroll. В search-focused state видны минимум пять
  полных common cards. Search сохраняет min-width `156px`.
- `390 x 844`: approved stress baseline варианта C; search-focused state
  показывает минимум пять полных common cards и часть шестой; search сохраняет
  min-width `176px`.
- `420 x 912`, `440 x 956`: в search-focused state видны минимум шесть полных
  common cards; search сохраняет min-width `200px` и `216px` соответственно;
  допускается 1–3 active chips в строке с переносом остальных.
- `768 x 1024`: search и frequent filters могут размещаться inline; secondary
  filters остаются в popover/drawer. Duplicate top-level header не
  возвращается; existing compact behavior применяется, cards остаются `96px`,
  а в `search-focused` refresh/create скрываются.
- `1440 x 1200`: сохраняется compact desktop toolbar и desktop row/table
  presentation; search не скрывает retained refresh/create и не включает
  mobile cards.
- `912 x 420`, `956 x 440`: на touch/mobile profile используется
  compact-height locator-first layout, а не desktop sidebar. Search остаётся
  достижим без drawer; search, result/recovery state и переход к результатам
  доступны при software keyboard.
- На `360`, `390`, `420`, `440` отсутствует horizontal page scroll.

## Operational and interaction states
- Loading сохраняет locator и active filters; search, clear-search и filter
  trigger остаются enabled, а skeleton cards имеют точную высоту `96px`, что и
  compact results, чтобы не создавать layout shift.
- Новый query/filter во время loading отменяет предыдущий list request или
  делает его response stale; старый response не может перезаписать более новые
  clients, loading, error, selection или derived visual mode.
- Empty first-run в `browse` предлагает `Новый клиент`, только если операция
  разрешена.
- Empty search state сохраняет query и показывает `Клиенты не найдены` +
  `Очистить поиск`.
- Empty filtered state сохраняет chips и показывает `Клиенты не найдены` +
  `Сбросить фильтры`.
- Если одновременно активны query и advanced filters, обе recovery operations
  доступны раздельно и явно называют свой scope.
- Error сохраняет query, filters и derived visual mode; retry ничего не
  очищает.
- Refresh в `browse` не очищает query, filters, page или scroll state; в
  `search-focused` page refresh action скрыт, а recovery retry остаётся видимым.
- Для роли без доступа к телефону label не обещает поиск по недоступному полю и
  card не показывает phone.
- Compact focus order: search → clear search при непустом query → filter trigger
  → refresh/create только в `browse` → active filters/reset → results.
- Закрытие drawer возвращает focus на filter trigger.
- Enter/Space на focused card открывает preview.
- Escape закрывает desktop popover; mobile drawer закрывается системным back
  или явной close operation.

## Drawer behavior

- Search не дублируется внутри drawer.
- Drawer имеет title `Фильтры`, явный close, одну модель применения filters и
  focus return.
- Стандартная модель CRM — immediate application; closing action называется
  `Готово`, а не `Применить`.
- Staged state в этом workflow не используется.
- Full-height surface использует dynamic viewport sizing, сохраняет scrollable
  fields и sticky bottom actions с
  `calc(12px + env(safe-area-inset-bottom))`.

## Implementation constraints

- Использовать React, TypeScript, Mantine, Onest и существующие theme tokens.
- Использовать выпущенные `EntityLocatorBar`, `ActiveFiltersBar`,
  `ListRangeStatus`, `TemporarySurfaceFooter`, `TaskItem` и shared
  `Button` / `IconButton`; не создавать локальную alternative foundation.
- Расширять существующий `ClientsToolbar` через shared slots/state, не
  возвращать `CompactFilterPanel` и не создавать отдельный
  `ClientsMobileToolbar`.
- Не добавлять global state или новую abstraction только ради локального
  визуального перехода.
- Search-focused state определяется UI/search state, а не frontend domain
  inference.
- Focus-only UI mode не добавляется в TASK-017 payload: restored compact mode
  выводится из normalized query.
- Скрытие retained actions и mobile card presentation ограничены existing
  compact query `max-width: 62rem`; TASK-089 desktop geometry не изменяется.
- Backend остаётся владельцем search, permission и branch scope semantics.
- Bottom navigation и sticky controls учитывают normal spacing плюс safe-area.
- Не использовать `100vh` как единственное ограничение высоты drawer; применять
  dynamic viewport unit/equivalent.

## Acceptance criteria
- [ ] На `390 x 844` search виден без открытия `Фильтры`.
- [ ] Top-level list не показывает visible `Клиенты` ни в `browse`, ни в
      `search-focused`; semantic `h1`, document title, named main и active nav
      сохраняются.
- [ ] В compact `browse` search, filters, refresh и разрешённый `Новый клиент`
      находятся в одном `EntityLocatorBar`; в compact `search-focused`
      refresh/create скрыты без spacer и второй action-only строки.
- [ ] На `1440 x 1200` непустой query не скрывает desktop refresh/create и не
      включает mobile card presentation.
- [ ] Focus search переводит mobile screen в `search-focused`; blur пустого
      или whitespace-only search возвращает `browse`, а непустой normalized
      query сохраняет focused layout.
- [ ] Clear search очищает только query; reset filters не очищает query.
- [ ] Filter count не включает query и default `status=Active`.
- [ ] Открытие и закрытие drawer сохраняет search и filters.
- [ ] Active advanced filters видимы и индивидуально удаляемы вне drawer.
- [ ] Search и filter controls соответствуют `TASK-084`: target минимум `44 x 44`, font минимум `16px`.
- [ ] Compact cards в `browse`, `search-focused` и loading имеют exact computed
      height `96px`; последовательные card top positions отличаются на `104px`.
- [ ] На `360 x 780` search-focused state показывает минимум пять полностью
      видимых cards высотой `96px`.
- [ ] На `390 x 844` search-focused state с двумя active filters показывает
      минимум пять полностью видимых cards высотой `96px` и часть шестой.
- [ ] На `420 x 912` и `440 x 956` тот же state показывает минимум шесть
      полностью видимых common cards.
- [ ] Проверочные ФИО `Алексеев Алексей Александрович` и
      `Алексеев Андрей Александрович` читаются полностью максимум в две строки
      без fixed right action column.
- [ ] Status/action state не уменьшает доступную ФИО ширину отдельной колонкой.
- [ ] Archived client с action hints показывает `В архиве`; active client с
      несколькими hints показывает compact mapping первого backend hint;
      active client без hint показывает `Активен`.
- [ ] Возврат с empty/whitespace-only query показывает `browse`, а с non-empty
      query — visual `search-focused`; в обоих случаях focus получает
      selected/anchor card, search не сфокусирован и keyboard не открывается.
- [ ] Нет horizontal page scroll на обязательных mobile-размерах.
- [ ] Пользователь с `branchId: null` видит branch identity в visible metadata и
      accessible name каждой card, включая one-row и single-branch result set;
      при non-null `branchId` identity не показывается.
- [ ] Frontend не добавляет собственный branch switcher или permission filter без backend contract.
- [ ] Loading, empty, error и retry сохраняют locator, active filters и
      derived search-focused/browse state.
- [ ] Во время loading search, clear-search и filter trigger остаются enabled;
      stale response не может заменить более свежую выдачу или selection.
- [ ] При software keyboard search, clear/recovery operation и первый result
      остаются видимыми или достижимыми одним intentional scroll.

## Test checklist
- [ ] Сначала добавить unit/component tests state machine
      `browse ↔ search-focused`, whitespace-only query, clear-search и
      independent filter reset.
- [ ] Добавить component tests mobile toolbar, removable chips, filter count и
      permission-bound browse actions.
- [ ] Добавить component test long ФИО + branch context + concrete status в
      card без one-line truncation.
- [ ] Проверить locator min-width `156/176/200/216px` на
      `360/390/420/440`.
- [ ] E2E: search → расширенные filters → apply/reset → открыть клиента → вернуться.
- [ ] E2E: focus empty search → type → clear while focused → blur → restore
      browse retained actions.
- [ ] E2E: empty/whitespace-only и non-empty query проходят
      preview/detail/back с focus на selected card и без открытия keyboard.
- [ ] E2E SuperAdministrator: global set из 300+ клиентов → search → filtered empty/reset → preview/detail → return с сохранённым state.
- [ ] Проверить `360`, `390 x 844`, `420 x 912`, `440 x 956`, `768`, `1440` и compact-height landscape.
- [ ] На `360 x 780` и `390 x 844` проверить пять полных cards; на
      `420 x 912` и `440 x 956` — шесть.
- [ ] Проверить compact behavior на `768 x 1024`, `912 x 420`,
      `956 x 440` и сохранение desktop retained actions/table rows на
      `1440 x 1200`.
- [ ] Проверить loading race: query/filter остаются интерактивными, stale
      response отменён или проигнорирован.
- [ ] Проверить отсутствие horizontal overflow и controls меньше `44 x 44`.
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:unit`
- [ ] Запустить affected Playwright и iPhone WebKit checks.

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: локальная frontend information-hierarchy задача без backend changes,
  но с stateful mobile header transition, preservation requirements и
  software-keyboard behavior.

## Related tasks
- `TASK-017`: сохранение состояния при возврате.
- `TASK-016`, `TASK-018`, `TASK-019`, `TASK-020`, `TASK-021`: client quick/detail/form work; не дублировать.

## Source notes
- Source: usability audit of the fully rebuilt and seeded local stand.
- Evidence date: 2026-07-25.
- Approved UX direction: Variant C, search-focused dense list.

## Approved visual
- [Variant C — search-focused, 390 x 844](../../mockups/usability-2026-07-25/TASK-085-variant-C.png)
- [Reproducible HTML source](../../mockups/usability-2026-07-25/task-085-variants.html?variant=c)

## Previous comparison
- [Сейчас / после](../../mockups/usability-2026-07-25/TASK-085-comparison.png)
- [Описание преимуществ и границ макета](../../mockups/usability-2026-07-25/README.md#task-085-visible-mobile-client-search)

## Processing notes

- Reviewed at: 2026-07-26 after TASK-090 was merged to `main`.
- Revalidated against commit `3253b23`: inline search, hidden top-level header,
  shared locator/filters/range/states, scoped reset and drawer foundation are
  already implemented and become regression baseline.
- Status remains `ready`: TASK-090 explicitly excluded the client-specific
  browse/search-focused state machine and `96px` cards. Generic return-state
  implementation remains owned by separate `TASK-017`.
- Product decisions confirmed and `ux-researcher` → `ui-designer` conformance
  handoff completed at 2026-07-30: focus-only mode is not persisted, behavior
  is compact-only, cards stay `96px` in both compact states, branch visibility
  uses `branchId === null`, pill priority follows backend hints, and locator
  remains interactive during list loading.

## Completion notes

- Implementation commit `4e231991e28e2930c0bd4f5feb0c7ef7c52c1d0c`
  is an ancestor of current `origin/main`.
- TASK-017 dependency is delivered by `d86ded4`; TASK-085 reuses its
  versioned return-state boundary without a second persistence mechanism.
- Released code contains the compact browse/search-focused state machine,
  `96px` identity cards, branch-aware metadata, loading-race protection and
  mobile/desktop action behavior required by the approved Variant C contract.
- Validation on 2026-07-30: frontend lint and build passed; unit tests
  `367/367`; targeted Chromium flows `46/46`; target iPhone WebKit `20/20`.
- Simulator/physical-device Safari chrome, software keyboard, home indicator
  and safe-area evidence was not collected; no physical-device acceptance is
  claimed.
