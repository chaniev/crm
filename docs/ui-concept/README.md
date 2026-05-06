# Gym CRM UI concept

## Цель

Зафиксировать единую концепцию рабочего интерфейса Gym CRM до изменений в отдельных вкладках. Направление опирается на текущий стенд `localhost:3000`, код `frontend/`, роли из backend и замечания по макету посещений.

## Снятые скриншоты

Текущие скриншоты стенда лежат в:

- `docs/ui-concept/screenshots-current/01-home.png`
- `docs/ui-concept/screenshots-current/02-attendance.png`
- `docs/ui-concept/screenshots-current/03-clients.png`
- `docs/ui-concept/screenshots-current/04-groups.png`
- `docs/ui-concept/screenshots-current/05-users.png`
- `docs/ui-concept/screenshots-current/06-audit.png`

Новые макеты собраны в статическом прототипе:

- `docs/ui-concept/index.html`

## Главный вывод

Предпочтительная стратегия: не переносить весь продукт на левый sidebar ради одного макета, а сохранить текущий `AppShell` с верхней ролевой навигацией и унифицировать все вкладки через общий operational pattern:

```text
Compact intro -> Summary strip -> Filter bar -> Primary content surface
```

Это сохраняет уже работающую механику CRM, но убирает разнобой между вкладками.

## Таксономия экранов

`Главная` и `Журнал` - oversight/log screens. Они отвечают на вопросы "что требует внимания" и "что произошло".

`Посещения` - workbench screen. Это быстрый рабочий поток, где главное - безошибочно отметить клиентов на выбранную дату.

`Клиенты`, `Группы`, `Пользователи` - registry screens. Им нужны поиск, фильтры, плотный список, понятные статусы и один основной CTA.

## Общие правила интерфейса

- Header вкладки: один короткий title, одна task-oriented description, справа primary CTA и вторичные действия.
- Ролевые бейджи показывать только когда они реально объясняют доступ или сценарий.
- Summary strip: компактные stat pills в одну строку на desktop, wrap на mobile.
- Filter bar: сначала частые фильтры, редкие фильтры в advanced area/drawer.
- Content surface: основной объект страницы должен начинаться в первом экране на laptop-height.
- List row: максимум три слоя смысла - identity, state, next action.
- Empty state: различать "нет данных", "ничего не найдено", "нет доступа", "нет выбранного контекста".
- Loading state: skeleton внутри content surface, без прыжка layout.
- Error state: retry рядом с ошибкой, не только toast.
- Один primary CTA на экран: создать клиента, группу, пользователя или применить ключевое действие.

## Визуальные правила

- Сохраняем `Mantine + Onest`.
- Сохраняем светлую зеленовато-песочную палитру, но уменьшаем декоративность.
- `brand` - primary actions, selected states, success.
- `sand` - нейтральный контекст.
- `accent` - сроки, предупреждения, внимание.
- `red` - ошибки, блокеры, unpaid-risk.
- Radius: `24px` для intro, `16px` для content surfaces, `12px` для rows, `999px` для chips/tabs.
- Desktop row height: `64-72px`; controls: `36-40px`.
- Между секциями: `24px`; внутри секций: `16px`.

## Экранные решения

### Главная

Оставить как management inbox, не раздувать в большой dashboard.

Структура:

```text
Intro: Главная + refresh
Summary strip: истекают сегодня | за 7 дней | неоплаченные
Watchlist: клиенты с истекающими абонементами
```

### Посещения

Гибридный сценарий:

- тренер с одной группой сразу видит roster на сегодня;
- несколько групп или HeadCoach - сначала явный выбор `группа + дата`;
- сохраняем inline toggle, но добавляем более явный context strip и safer feedback.

Структура:

```text
Intro: Посещения + scope
Filter bar: группа | дата | refresh
Context strip: клиентов | отмечено | предупреждения
Roster rows: клиент | абонемент | warning | toggle
```

### Клиенты

Клиенты остаются эталонным registry screen.

Структура:

```text
Intro: Клиенты + Новый клиент + refresh
Filter bar: search | status | group | more filters
Quick filter chips
List/table + preview rail на desktop
```

### Группы

Заменить вертикальные metric cards на compact summary strip и добавить registry-фильтры.

Структура:

```text
Intro: Группы + Создать группу + refresh
Summary strip: всего | активные | без тренера | перегруженные
Filter bar: search | status | trainer
Rows: группа | расписание | тренеры | клиенты | статус | edit
```

### Пользователи

Такой же registry-паттерн, как у групп, но с фокусом на доступ.

Структура:

```text
Intro: Пользователи + Создать пользователя + refresh
Summary strip: всего | активные | смена пароля | Telegram
Filter bar: search | role | status | password state
Rows: ФИО/login | role | active | password | integrations | edit
```

### Журнал

Сделать фильтры компактнее, а записи - более сканируемыми до раскрытия деталей.

Структура:

```text
Intro: Журнал + refresh
Filter bar: user | action | entity | period | more filters
Active filter chips + total count
Expandable log rows
Diff panel inside expanded row
Pagination
```

## Shared components для реализации

Рекомендуемый минимальный набор:

- `SectionIntro`
- `SummaryStrip`
- `FilterBar`
- `QuickFilterChips`
- `EntityRow`
- `CollectionSurface`
- `InlineEmptyState`
- `SkeletonRows`

Важно: эти компоненты должны унифицировать layout и visual language, но не переносить CRM-бизнес-логику во frontend.

## Приоритет внедрения

1. Зафиксировать shared layout tokens и новые shared-компоненты.
2. Привести `Группы` и `Пользователи` к registry pattern.
3. Доработать `Посещения` по гибридной схеме.
4. Согласовать `Клиенты` с новым intro/filter/row language, не ломая state hook.
5. Упростить `Журнал`: compact filters + better log summary.
6. Полировать `Главную` последней.

