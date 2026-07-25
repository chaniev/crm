# TASK-085: Search-focused mobile-поиск клиентов — вариант C

## Status
ready

## Priority
P0

## Git branch
feature/TASK-085-ux-variants

## Goal
Суперадминистратор, администратор или тренер находит клиента среди 300+ записей
на mobile без предварительного открытия расширенных фильтров. После начала
поиска интерфейс переходит в плотный search-focused state, сохраняет locator,
активные фильтры и минимум пять полностью видимых результатов на `390 x 844`.

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
На `390 x 844` текущий экран клиентов с 300 записями показывает только кнопку
`Фильтры`; locator `Поиск по имени или телефону` появляется после открытия
full-screen drawer. Высота списка из 20 строк составляет около `3366px`,
поэтому search является primary operation, а не secondary filter.

Первый концепт с постоянно видимым search решил discoverability, но создал два
новых риска:

- верхняя зона и увеличенные cards снизили число видимых клиентов;
- fixed right column `Нужно сделать / Без абонемента` продолжила обрезать ФИО,
  хотя внутри card оставалось неиспользованное пространство.

Вариант C устраняет оба риска: search-focused state сворачивает page header и
page actions, а identity-first card больше не резервирует отдельную правую
колонку под action text.

## Scope
- Реализовать mobile state machine `browse` / `search-focused`.
- Оставить client search постоянно видимым без открытия drawer.
- Использовать плотные identity-first cards высотой `96px` в
  search-focused state.
- Сохранить в drawer вторичные filters: group, status, membership dates,
  without photo и page size.
- Показывать active advanced filters вне drawer как удаляемые controls высотой
  минимум `44px`; не дублировать query отдельным chip.
- Разделить `Очистить поиск` и `Сбросить фильтры`:
  - clear search очищает только `query`;
  - reset filters не очищает `query`;
  - filter count не включает `query` и default `status=Active`.
- Сохранять search, filters, scroll position и selected result при закрытии
  drawer, открытии preview/detail и возврате к списку.
- Сохранить существующую backend search semantics и typed API boundary.
- Для SuperAdministrator искать по глобальному backend-permitted набору без
  локальной permission-фильтрации; показывать branch identity в cards для
  различения одноимённых клиентов.
- `Новый клиент` показывать только по backend permission `canManageClients` и
  только в `browse` state.
- Сохранять search и active filters видимыми при loading, empty, error и retry.

## Out of scope
- Client detail, tabs и quick actions из `TASK-016`–`TASK-021`.
- Изменение backend-правил поиска.
- Переработка формы нового клиента.
- Новый branch switcher или frontend permission filter.
- Изменение server-provided action hints.

## Approved interaction model

### Browse state

Условие: `query` пустой и search не сфокусирован.

- Видны page title, client count, refresh и permission-bound `Новый клиент`.
- Search остаётся видимым под page header.
- Filter trigger показывает только количество active advanced filters.
- Active filters видимы и индивидуально удаляемы вне drawer.
- Cards используют ту же identity-first hierarchy, что и search results.

### Search-focused state

Условие: search сфокусирован или normalized `query` не пустой.

- Page title, count, refresh и `Новый клиент` сворачиваются.
- Locator row становится первой строкой content area и остаётся достижимой при
  software keyboard.
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
- Mobile back при открытом drawer сначала закрывает drawer и возвращает focus
  на filter trigger.
- Закрытие software keyboard не очищает query и filters.
- Preview/detail/back восстанавливает предыдущий state без layout reset.

## Mobile information hierarchy

Порядок content:

1. app header;
2. page header только в `browse`;
3. locator row: search + filter trigger;
4. active advanced filters/reset;
5. results/recovery state;
6. bottom navigation с safe-area clearance.

Dense client card:

- common height `96px`, padding `10px 12px`, gap между cards `8px`;
- grid `36px minmax(0, 1fr) 20px`: avatar, identity content, decorative
  chevron;
- вся card является единственным primary row action и открывает preview;
- ФИО: `16px`, line-height `18–20px`, weight `800`, максимум две строки;
- не использовать one-line ellipsis для ФИО на `360–440px`;
- телефон показывать только роли с доступом;
- branch identity показывать в global/multi-branch context;
- concrete action/status `Без абонемента`, `Без группы`, `До 31 июля`,
  `В архиве` показывать compact status pill под identity;
- не резервировать fixed right column под `Нужно сделать`;
- полный ФИО остаётся в accessible name card и в preview/detail.

## Responsive behavior
- `360 x 780`: search и filter trigger образуют locator row; active chips
  переносятся без horizontal scroll. В search-focused state видны минимум пять
  полных common cards.
- `390 x 844`: approved stress baseline варианта C; search-focused state
  показывает минимум пять полных common cards и часть шестой.
- `420 x 912`, `440 x 956`: в search-focused state видны минимум шесть полных
  common cards; допускается 1–3 active chips в строке с переносом остальных.
- `768 x 1024`: search и frequent filters могут размещаться inline; secondary
  filters остаются в popover/drawer. Mobile header-collapse не переносится
  автоматически в desktop/tablet toolbar.
- `1440 x 1200`: сохраняется компактный desktop toolbar.
- `912 x 420`, `956 x 440`: на touch/mobile profile используется
  compact-height locator-first layout, а не desktop sidebar. Search остаётся
  достижим без drawer; search, result/recovery state и переход к результатам
  доступны при software keyboard.
- На `360`, `390`, `420`, `440` отсутствует horizontal page scroll.

## Operational and interaction states
- Loading сохраняет locator и active filters; skeleton cards имеют ту же высоту
  `96px`, что и results, чтобы не создавать layout shift.
- Empty first-run в `browse` предлагает `Новый клиент`, только если операция
  разрешена.
- Empty search state сохраняет query и показывает `Клиенты не найдены` +
  `Очистить поиск`.
- Empty filtered state сохраняет chips и показывает `Клиенты не найдены` +
  `Сбросить фильтры`.
- Если одновременно активны query и advanced filters, обе recovery operations
  доступны раздельно и явно называют свой scope.
- Error сохраняет query, filters и текущий UI state; retry ничего не очищает.
- Refresh в `browse` не очищает query, filters, page или scroll state; в
  `search-focused` page refresh action скрыт, а recovery retry остаётся видимым.
- Для роли без доступа к телефону label не обещает поиск по недоступному полю и
  card не показывает phone.
- Focus order: search → clear search при непустом query → filter trigger →
  active filters/reset → refresh/create только в `browse` → results.
- Закрытие drawer возвращает focus на filter trigger.
- Enter/Space на focused card открывает preview.
- Escape закрывает desktop popover; mobile drawer закрывается системным back
  или явной close operation.

## Drawer behavior

- Search не дублируется внутри drawer.
- Drawer имеет title `Фильтры`, явный close, одну модель применения filters и
  focus return.
- Если filters применяются сразу, closing action называется `Готово`, а не
  `Применить`.
- Если используется staged state, backend query обновляется только после
  `Применить`; до этого chips вне drawer не меняются.
- Нельзя смешивать immediate и explicit apply semantics.
- Full-height surface использует dynamic viewport sizing, сохраняет scrollable
  fields и sticky bottom actions с
  `calc(12px + env(safe-area-inset-bottom))`.

## Implementation constraints

- Использовать React, TypeScript, Mantine, Onest и существующие theme tokens.
- Использовать Mantine `TextInput`, `Drawer`, `Button`, `Badge` и shared
  `Button` / `IconButton`.
- Текущий mobile `CompactFilterPanel` скрывает primary search в drawer, поэтому
  его нужно расширить режимом inline mobile primary control или создать
  локальный `ClientsMobileToolbar`.
- Не добавлять global state или новую abstraction только ради локального
  визуального перехода.
- Search-focused state определяется UI/search state, а не frontend domain
  inference.
- Backend остаётся владельцем search, permission и branch scope semantics.
- Bottom navigation и sticky controls учитывают normal spacing плюс safe-area.
- Не использовать `100vh` как единственное ограничение высоты drawer; применять
  dynamic viewport unit/equivalent.

## Acceptance criteria
- [ ] На `390 x 844` search виден без открытия `Фильтры`.
- [ ] Focus search переводит mobile screen в `search-focused`; blur пустого
      search возвращает `browse`, а непустой query сохраняет focused layout.
- [ ] Clear search очищает только query; reset filters не очищает query.
- [ ] Filter count не включает query и default `status=Active`.
- [ ] Открытие и закрытие drawer сохраняет search и filters.
- [ ] Active advanced filters видимы и индивидуально удаляемы вне drawer.
- [ ] Search и filter controls соответствуют `TASK-084`: target минимум `44 x 44`, font минимум `16px`.
- [ ] На `390 x 844` search-focused state с двумя active filters показывает
      минимум пять полностью видимых cards высотой `96px` и часть шестой.
- [ ] На `420 x 912` и `440 x 956` тот же state показывает минимум шесть
      полностью видимых common cards.
- [ ] Проверочные ФИО `Алексеев Алексей Александрович` и
      `Алексеев Андрей Александрович` читаются полностью максимум в две строки
      без fixed right action column.
- [ ] Status/action state не уменьшает доступную ФИО ширину отдельной колонкой.
- [ ] Переход в preview/detail и возврат не сбрасывает список и не ухудшает требования `TASK-017`.
- [ ] Нет horizontal page scroll на обязательных mobile-размерах.
- [ ] SuperAdministrator с `branchId: null` ищет клиентов во всех разрешённых филиалах, а branch identity остаётся читаемой в multi-branch результатах.
- [ ] Frontend не добавляет собственный branch switcher или permission filter без backend contract.
- [ ] Loading, empty, error и retry сохраняют locator, active filters и
      search-focused/browse state.
- [ ] При software keyboard search, clear/recovery operation и первый result
      остаются видимыми или достижимыми одним intentional scroll.

## Test checklist
- [ ] Сначала добавить unit/component tests state machine
      `browse ↔ search-focused`, clear-search и independent filter reset.
- [ ] Добавить component tests mobile toolbar, removable chips, filter count и
      permission-bound browse actions.
- [ ] Добавить component test long ФИО + branch context + concrete status в
      card без one-line truncation.
- [ ] E2E: search → расширенные filters → apply/reset → открыть клиента → вернуться.
- [ ] E2E: focus empty search → type → clear while focused → blur → restore
      browse header/actions.
- [ ] E2E SuperAdministrator: global set из 300+ клиентов → search → filtered empty/reset → preview/detail → return с сохранённым state.
- [ ] Проверить `360`, `390 x 844`, `420 x 912`, `440 x 956`, `768`, `1440` и compact-height landscape.
- [ ] На `390 x 844` проверить пять полных cards; на `420 x 912` и
      `440 x 956` — шесть.
- [ ] Проверить отсутствие horizontal overflow и controls меньше `44 x 44`.
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
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
- [Variant C — search-focused, 390 x 844](../mockups/usability-2026-07-25/TASK-085-variant-C.png)
- [Reproducible HTML source](../mockups/usability-2026-07-25/task-085-variants.html?variant=c)

## Previous comparison
- [Сейчас / после](../mockups/usability-2026-07-25/TASK-085-comparison.png)
- [Описание преимуществ и границ макета](../mockups/usability-2026-07-25/README.md#task-085-visible-mobile-client-search)
