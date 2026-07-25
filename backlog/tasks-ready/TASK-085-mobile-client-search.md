# TASK-085: Оставить поиск клиентов видимым в mobile-списке

## Status
ready

## Priority
P0

## Goal
Суперадминистратор, администратор или тренер находит клиента на mobile без предварительного открытия полноэкранной панели расширенных фильтров.

## User role
Суперадминистратор / администратор / тренер.

## Problem
На `390 x 844` экран клиентов с 300 записями показывает только кнопку `Фильтры`; основной locator `Поиск по имени или телефону` появляется лишь после открытия full-screen drawer. Высота списка из 20 строк составляет около `3366px`, поэтому поиск является primary operation, а не secondary filter.

## Scope
- Оставить client search постоянно видимым в верхней части списка на mobile.
- Сохранить в drawer вторичные фильтры: группа, статус, membership dates, без фото и размер страницы.
- Показывать активность расширенных фильтров вне drawer: count/chips и предсказуемый reset.
- Сохранять search и filters при закрытии drawer, открытии preview/detail и возврате к списку.
- Сохранить существующую backend search semantics и typed API boundary.
- Для SuperAdministrator искать по глобальному backend-permitted набору без локальной permission-фильтрации; сохранять branch context в rows/cards, когда он нужен для различения одноимённых клиентов.
- `Новый клиент` показывать только по backend permission `canManageClients`.

## Out of scope
- Client detail, tabs и quick actions из `TASK-016`–`TASK-021`.
- Изменение backend-правил поиска.
- Переработка формы нового клиента.

## Responsive behavior
- `360 x 780`: full-width search отдельной строкой; ниже — trigger расширенных фильтров и active count/chips без horizontal scroll.
- `390 x 844`: search видим без дополнительного действия; `Новый клиент` остаётся dominant page action для роли с правом создания.
- `420 x 912`, `440 x 956`: допускаются 1–2 active chips в строке с переносом остальных.
- `768 x 1024`: search и частые filters могут размещаться inline, secondary filters остаются в popover/drawer.
- `1440 x 1200`: сохраняется компактный desktop toolbar.
- `912 x 420`, `956 x 440`: search остаётся достижим без drawer; при software keyboard search, result/recovery state и переход к результатам доступны.

## Operational and interaction states
- Loading не скрывает search без необходимости.
- Empty first-run предлагает `Новый клиент`, если операция разрешена.
- Empty filtered state показывает `Клиенты не найдены` и `Сбросить фильтры`.
- Retry после error не очищает введённый search и выбранные filters.
- Для роли без доступа к телефону label не обещает поиск по недоступному полю.
- Focus order: search → filter trigger → active filters/reset → create/refresh → results.
- Закрытие drawer возвращает focus на filter trigger.

## Acceptance criteria
- [ ] На `390 x 844` search виден без открытия `Фильтры`.
- [ ] Открытие и закрытие drawer сохраняет search и filters.
- [ ] Active filters видимы и удаляемы вне drawer.
- [ ] Search и filter controls соответствуют `TASK-084`: target минимум `44 x 44`, font минимум `16px`.
- [ ] Переход в preview/detail и возврат не сбрасывает список и не ухудшает требования `TASK-017`.
- [ ] Нет horizontal page scroll на обязательных mobile-размерах.
- [ ] SuperAdministrator с `branchId: null` ищет клиентов во всех разрешённых филиалах, а branch identity остаётся читаемой в multi-branch результатах.
- [ ] Frontend не добавляет собственный branch switcher или permission filter без backend contract.

## Test checklist
- [ ] Добавить unit/component tests mobile client toolbar.
- [ ] E2E: search → расширенные filters → apply/reset → открыть клиента → вернуться.
- [ ] E2E SuperAdministrator: global set из 300+ клиентов → search → filtered empty/reset → preview/detail → return с сохранённым state.
- [ ] Проверить `360`, `390 x 844`, `420 x 912`, `440 x 956`, `768`, `1440` и compact-height landscape.
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] Запустить affected Playwright и iPhone WebKit checks.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: локальная frontend information-hierarchy задача, использующая существующий backend query contract.

## Related tasks
- `TASK-017`: сохранение состояния при возврате.
- `TASK-016`, `TASK-018`, `TASK-019`, `TASK-020`, `TASK-021`: client quick/detail/form work; не дублировать.

## Source notes
- Source: usability audit of the fully rebuilt and seeded local stand.
- Evidence date: 2026-07-25.

## Visual comparison
- [Сейчас / после](../mockups/usability-2026-07-25/TASK-085-comparison.png)
- [Описание преимуществ и границ макета](../mockups/usability-2026-07-25/README.md#task-085-visible-mobile-client-search)
