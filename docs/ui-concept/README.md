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

Финальные адаптивные макеты собраны из одного статического прототипа:

- `docs/ui-concept/task-090-iphone-17-pro-max/index.html`
- `docs/ui-concept/task-090-iphone-17-pro-max/screenshots/default-green-v1/`
  — iPhone 17 Pro Max `440 x 956`
- `docs/ui-concept/task-090-iphone-17-pro-max/screenshots/iphone-air/default-green-v1/`
  — iPhone Air `420 x 912`
- `docs/ui-concept/task-090-iphone-17-pro-max/screenshots/desktop/default-green-v1/`
  — desktop `1440 x 1200`

## Главный вывод

Предпочтительная стратегия: не переносить весь продукт на левый sidebar ради одного макета, а сохранить текущий `AppShell` с верхней ролевой навигацией и унифицировать все вкладки через общий operational pattern:

```text
Active navigation + semantic route title -> Summary/locator/filter -> Primary content surface
```

Это сохраняет уже работающую механику CRM, но убирает разнобой между вкладками.

## Таксономия экранов

`Главная` и `Журнал` - oversight/log screens. Они отвечают на вопросы "что требует внимания" и "что произошло".

`Посещения` - workbench screen. Это быстрый рабочий поток, где главное - безошибочно отметить клиентов на выбранную дату.

`Клиенты`, `Группы`, `Пользователи` - registry screens. Им нужны поиск, фильтры, плотный список, понятные статусы и один основной CTA.

## Общие правила интерфейса

- Header вкладки: один короткий title, справа primary CTA и вторичные действия.
- На top-level list видимый header отсутствует, если active persistent
  navigation уже однозначно показывает тот же route. Semantic `h1`, document
  title и accessible main name сохраняются.
- Действия удалённого header переходят в первый locator/toolbar/summary row;
  пустая строка на месте заголовка не остаётся.
- На mobile четвёртый route slot адаптивный: на `Тренеры`, `Журнал`,
  `Финансы`, `Настройки` он показывает точный active destination вместо
  последней primary вкладки. Вытесненная вкладка переходит в drawer, а пятый
  trigger `Ещё` всегда остаётся видимым.
- Detail/form screens сохраняют visible operation/entity title, когда active
  parent navigation не называет текущую задачу. Recovery state с конкретным
  heading не дублирует уже видимое название active route.
- Постоянные subtitle/eyebrow/badge/intro/helper под title запрещены на mobile
  и desktop, если не проходят `decision/usefulness test` из
  `docs/MOBILE_UI_CONTRACT.md`.
- Допустимые пояснения к validation, recovery, constraint, security/legal или
  operational state показываются у связанного поля, действия или state panel,
  а не используются для заполнения header.
- Единственный primary search locator не показывает отдельную строку `Поиск`
  или `Найти...` на mobile и desktop. Его accessible name остаётся доступен
  через visually-hidden label/ARIA, а placeholder описывает searchable fields.
- Search/locator и его filter/refresh/create actions остаются в одной строке
  без отдельного action-only уровня на mobile, tablet и desktop. На узкой
  ширине подпись create скрывается визуально до icon-only `44 x 44px`, но
  сохраняет accessible name; дополнительная ширина desktop не создаёт перенос.
- Active tab не повторяется ниже отдельной title/summary card: после
  `Требуют внимания` сразу начинается operational list/state на mobile и
  desktop.
- Рабочий filter/control не получает generic intro перед собой, если active tab
  и label/value control уже задают контекст: в `Посещения` карточка начинается
  сразу с group select и date navigation на mobile и desktop; generic label
  скрыт, accessible name `Группа для отметки посещений` сохранён.
- Visible labels сохраняются у обычных form fields, нескольких неоднозначных
  inputs и period/date/scope controls.
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
- Auth/start page сохраняет текущее `k4pro-login-bg.png` как default background;
  deployment может выбрать другой registered `authBackgroundImageId` независимо
  от palette.
- `brand` - primary actions, selected states, success.
- `sand` - нейтральный контекст.
- `accent` - сроки, предупреждения, внимание.
- `red` - ошибки, блокеры, unpaid-risk.
- Radius: `24px` для route-level sections, `16px` для content surfaces, `12px` для rows, `999px` для chips/tabs.
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

Использовать компактный registry без верхних metric/summary widgets. Состояние
группы показывается в фильтрах и непосредственно в строке, где оно влияет на
следующее действие.

Структура:

```text
Filter bar: search | status | trainer | day | refresh | create
Range/status
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
4. Согласовать `Клиенты` с новым header/filter/row language, не ломая state hook.
5. Упростить `Журнал`: compact filters + better log summary.
6. Полировать `Главную` последней.
