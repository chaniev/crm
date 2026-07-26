# Единый контракт мобильного интерфейса CRM

## Статус и назначение

Этот документ является обязательным cross-screen UX/UI-контрактом для всех
авторизованных экранов CRM, мобильного shell и связанных состояний входа.

Контракт:

- задаёт единый task-first workflow, визуальную систему и responsive-поведение;
- отделяет общие правила интерфейса от предметных особенностей экранов;
- задаёт механизм выбора цветовой темы и фонового изображения стартовой
  страницы для разных deployment;
- является обязательной основой для `TASK-084`–`TASK-089` и новых UI-задач;
- уточняет завершённые `TASK-046`, `TASK-048`, `TASK-051` и `TASK-056`, не
  открывая их повторно.

Если screen-specific mockup конфликтует с этим документом, mockup определяет
только предметный workflow и состав данных, а этот контракт определяет
типографику, геометрию, общие компоненты, цвета, состояния, responsive и
accessibility.

## Область действия

### В scope

- роли `SuperAdministrator`, `Administrator`, `HeadCoach`, `Coach`;
- mobile portrait, mobile compact-height landscape, tablet и desktop;
- shell, header, navigation, route-level layout;
- списки, поиск, фильтры, формы, preview/detail, temporary surfaces;
- loading, empty, error, stale, disabled, restricted, success;
- deployment-specific light theme profiles;
- deployment-specific registered background images для auth/start page;
- общие Mantine-компоненты, Onest и Tabler Icons.

### Вне scope

- отдельная dark theme;
- изменение backend-owned ролей, permissions, access scope и validation;
- frontend-вычисление branch, attendance или schedule scope;
- произвольный CSS/HTML из deployment config;
- разные цветовые схемы для ролей;
- маркетинговая визуальная система или декоративный redesign.

## 1. Общий UX-контракт

### Пользовательский контекст

CRM используется сотрудником клуба как рабочий инструмент на телефоне:
пользователь часто действует одной рукой, переключается между объектами,
работает при открытой клавиатуре и должен быстро восстановить контекст после
preview, detail или edit.

### Требуемый результат

Пользователь должен:

1. открыть разрешённый раздел;
2. сразу увидеть основной способ найти нужный объект;
3. сузить набор без просмотра длинного документа;
4. понять identity, scope, status и next action;
5. выполнить одну операцию;
6. вернуться без повторного ввода query и восстановления фильтров.

Completion signal обязан называть изменённую сущность или подтверждённую
операцию. Простое исчезновение loader не считается завершением.

### Обязательный путь list-workspace

```text
app shell
→ route context
→ visible primary locator
→ active constraints
→ task-oriented results
→ preview/detail/edit
→ back with preserved context
```

При возврате сохраняются применимые к экрану:

- `query`;
- filters;
- page или loaded batch;
- selected entity;
- scroll position;
- раскрытый preview;
- `browse` / `search-focused` state.

### Классификация действий

| Класс | Обязательное размещение |
|---|---|
| Primary | Видимо и визуально доминирует в активном task state |
| Frequent | Видимо или доступно за одно очевидное действие |
| Secondary | В contextual surface, drawer или detail |
| Exceptional / destructive | В contextual menu/detail и с явным подтверждением, если действие необратимо |
| Unmapped | Не отображать до появления пользовательской операции |

На одном task state допускается только одно визуально доминирующее primary
action. Primary action нельзя скрывать в overflow, drawer с фильтрами или
контекстном меню.

### Backend boundary

Backend/session остаётся единственным источником истины для:

- roles и permissions;
- allowed sections и allowed actions;
- branch/global scope;
- attendance и schedule scope;
- доступных filter options;
- validation и ProblemDetails;
- access facts и разрешённых recovery destinations.

Цвет, видимость компонента или frontend role name не могут создавать новое
доменное правило.

Generic route-level restricted copy может находиться во frontend resources и
объяснять access fact из session contract. Backend-specific reason показывается
только при наличии явного backend contract.

## 2. Информационная и визуальная иерархия

### Route-level порядок

В `browse` state используется единый порядок:

1. shell header;
2. semantic route title и, только если он не дублирует persistent navigation,
   visible page header;
3. primary locator;
4. active filters и range/status;
5. result, form или recovery state;
6. mobile bottom navigation.

У каждого route есть ровно один `h1` и корректный document title. В
`search-focused` state видимый page header может свернуться, но route остаётся
доступно назван через document title, landmark и accessible name locator/results.

### Видимость route title

На mobile, tablet и desktop visible route header не показывается, если
одновременно выполняются все условия:

- это top-level list/workspace screen;
- active persistent navigation или tab уже видимо и однозначно называет route;
- `h1` не содержит entity identity, operation mode или critical scope;
- действия из header помещаются в первый locator/toolbar/summary row без
  скрытия primary/frequent operation.

Для таких экранов semantic `h1` остаётся первым элементом route `main`, но
визуально скрывается. Document title, main landmark name и
`aria-current="page"` активной навигации сохраняют доступное название route.
На mobile это применяется, например, к list screens `Клиенты`, `Группы` и
`Расписание`, когда одноимённый пункт bottom navigation виден и активен. На
desktop то же правило действует при одноимённом active item в persistent
sidebar/top navigation.

После удаления visible header:

- первый видимый row содержит locator, filters, summary или другой рабочий
  control;
- refresh и другие frequent actions переходят в locator/toolbar;
- create/add остаётся видимым в первом task area и не уходит в overflow;
- пустой spacer или action-only строка на месте header не создаётся.

Visible `h1` сохраняется, если active navigation не называет текущий route
однозначно: например, mobile navigation показывает generic `Ещё`, а не текущий
destination; route является detail/create/edit/form/auth screen; заголовок
называет сущность или операцию; recovery state не имеет собственного
конкретного heading; либо перенос действий скроет primary operation. После
продвижения overflow destination в четвёртый adaptive slot top-level
`Тренеры`, `Журнал`, `Финансы` или `Настройки` считаются однозначно названными
active navigation и проходят общий visibility test без специального исключения
для routes, исходно находившихся под `Ещё`.
Create/edit/detail route сохраняет visible operation/entity title: active
parent `Тренеры` не заменяет `Новый тренер` или имя редактируемого тренера.
Если active `Клиенты` и state heading уже сообщает `Список клиентов не
загрузился` / `Клиентов пока нет`, дублирующий visible route title не нужен.
Active parent `Клиенты` не заменяет visible title `Карточка клиента`.

Дополнительная ширина `768` или `1440px` не возвращает дублирующий header.
Если desktop sidebar уже называет list route, content начинается с toolbar,
table/list или summary. Если sidebar показывает лишь общий parent, visible
route title сохраняется.

### Сводные виджеты на list screen групп

`Группы` используют единый registry pattern на mobile, tablet и desktop без
верхних summary/stat widgets. Карточки `Всего`, `Активные`, `Без тренера`,
`Перегружены` и их сокращённые варианты не показываются перед locator или
списком.

Первым видимым рабочим блоком после shell является locator/filter toolbar с
доступными refresh и create actions, затем range/status и строки групп.
Количество результатов сообщает range/status, а требующие внимания признаки
показываются в соответствующем фильтре или строке группы. Дополнительная ширина
`768` или `1440px` не возвращает удалённые виджеты.

Новый summary widget на registry screen допустим только если он необходим для
решения текущей задачи и его значение нельзя понятнее показать в locator,
filter, range/status или строке объекта. Свободное место на desktop не является
основанием для такого виджета.

### Поясняющий текст и служебные метки

На mobile, tablet и desktop route-level header по умолчанию содержит только
короткий `h1` и действия. Постоянные subtitle/description под `h1`,
intro/hero-copy, eyebrow, badge/chip и другой служебный helper text запрещены,
если они не меняют решение пользователя в текущем task state.

Перед добавлением любого пояснения применяется `decision/usefulness test`.
Текст допускается только если без него пользователь может:

- выполнить неверное действие или не понять его важное последствие;
- не понять причину ограничения или недоступности;
- не выполнить обязательную предпосылку;
- не восстановиться после ошибки;
- пропустить security/legal/compliance требование;
- неверно определить неоднозначный scope, status или backend-owned constraint.

Текст, который лишь пересказывает title, navigation label, тип формы, роль или
очевидную цель экрана, тест не проходит. В частности, нельзя добавлять под
route title формулировки вроде `Управление и история`, а перед формой
принудительной смены пароля — декоративную метку `Обязательное действие`.
Свободное место на desktop не является основанием вернуть такой текст.

Допустимые пояснения размещаются рядом с местом решения:

- validation и password policy — у соответствующего поля;
- prerequisite, security/legal и необратимое последствие — у действия или
  внутри связанной form section;
- scope, выбранная дата/range/entity — в locator, toolbar, detail или content
  section;
- loading, empty, error, stale, restricted, recovery и success — в
  соответствующем state panel или inline recovery block.

Critical copy нельзя удалять только ради сокращения высоты. Если допустимое
пояснение не помещается компактно, его переносят из route header в связанную
рабочую section, сохраняя доступность и порядок focus.

### Подпись primary search locator

На mobile, tablet и desktop единственный очевидный primary search locator
показывается без видимой строки label перед полем. Generic подписи `Поиск`,
`Найти запись`, `Найти занятие`, `Найти клиента` и их аналоги запрещены, если:

- поле занимает стандартную route-level locator position;
- search icon и placeholder однозначно показывают searchable attributes;
- рядом нет другого text/search field, с которым его можно перепутать.

Удаление видимого label не отменяет доступное имя. Search input обязан иметь
стабильный `accessible name` через связанный visually-hidden `label`,
`aria-label` или `aria-labelledby`. Имя называет операцию и объект, например
`Найти клиента`, `Найти группу`, `Найти запись журнала`, и не исчезает после
ввода значения. Placeholder сообщает формат или searchable attributes
(`Имя или телефон`, `Пользователь или действие`), но не является единственным
accessible name.

Visible label допускается только как измеримое исключение:

- на одной surface находятся несколько text/search fields;
- locator встроен в форму, modal или detail и без label неоднозначен;
- control является не search, а period/date/scope selector;
- без label пользователь может выбрать неверный scope или тип данных.

Исключение не распространяется на обычные form fields: их persistent labels
сохраняются. Дополнительная ширина `768` или `1440px` не возвращает generic
search label, удалённый на mobile.

### Смысл поверхности

- `PageLayout` владеет route-level rhythm и header.
- `PageSection` группирует отдельную рабочую секцию.
- `TaskItem` представляет один результат или одну операционную сущность.
- Nested `Paper` не используется только ради декоративной вложенности.
- Цветной фон не заменяет section title, status label или selected state.

## 3. Visual foundations

### Типографика

Единственный UI-шрифт — `Onest`.

| Семантика | Mobile | Desktop | Weight |
|---|---:|---:|---:|
| Page title | `28/32px` | `32/36px` | `800` |
| Section title | `18/24px` | `18/24px` | `700–800` |
| Row/card primary | `16/20px` | `16/20px` | `700–800` |
| Body / required decision data | `16/24px` | `16/24px` | `400–600` |
| Secondary metadata | `14/20px` | `14/20px` | `400–600` |
| Persistent label | `14/20px` | `13–14/18–20px` | `700` |

Дополнительные правила:

- inputs, selects и textareas на iPhone используют `font-size >= 16px`;
- ФИО и другое primary identity на mobile допускает две строки;
- required decision data нельзя размещать только в `12px` copy;
- counters используют `font-variant-numeric: tabular-nums`;
- placeholder не заменяет accessible name; visible label может быть скрыт
  только у единственного очевидного primary search locator по правилу выше;
- локальные размеры route title запрещены.

### Spacing

| Token | `360–440` | `768` | `1440` |
|---|---:|---:|---:|
| Page horizontal padding | `16px` | `24px` | `32px` |
| Page section gap | `16px` | `20px` | `24px` |
| Normal component gap | `12px` | `12–16px` | `16px` |
| Dense result gap | `8px` | `8px` | `8px` |
| Form field gap | `16px` | `16px` | `16px` |

Между независимыми touch targets должно оставаться не меньше `8px`.

### Radii

| Token | Значение | Назначение |
|---|---:|---|
| `radius.section` | `24px` | Route-level `PageSection` |
| `radius.control` | `12px` | Button, input, select, compact toolbar |
| `radius.item` | `8px` | Dense operational row/card |
| `radius.sheet` | `20px 20px 0 0` | Bottom sheet, если он не full-screen |
| `radius.pill` | `999px` | Badge/chip, но не обычная card |

Full-screen mobile drawer/modal имеет radius `0`.

### Borders и elevation

- Основное разделение рабочих поверхностей выполняется border, spacing и
  heading hierarchy.
- Dense rows/cards не получают декоративную тень.
- `PageSection` может использовать только общий low-elevation shadow token.
- Selected state использует одновременно border/inset, доступный state и
  `aria-selected`; одной заливки недостаточно.
- Hover не является единственным признаком интерактивности.

### Размеры контролов

- Любой mobile/coarse-pointer target: минимум `44 x 44 CSS px`.
- Primary submit: `48–52px` по высоте.
- Search, select, tabs, pagination, close, refresh и icon actions: минимум
  `44px` по активной области.
- Fine-pointer desktop при normal height может использовать `36–40px`.
- Compact-height touch не получает desktop density.
- Визуальная иконка может быть `18–20px`, но hit area остаётся `44px`.

Icon-only action обязан иметь доступное имя. Иконка без отдельной операции не
добавляется.

## 4. Deployment theme profiles

### Цель

Разные deployment могут использовать разные заранее утверждённые наборы
цветов и фоновое изображение стартовой страницы, не меняя разметку, hierarchy,
component API и смысл состояний.

Один profile содержит:

- один обязательный основной цвет;
- один опциональный второй основной цвет;
- от трёх до четырёх дополнительных цветовых семейств;
- ссылку на общую neutral и functional semantic основу.

Количество основных и дополнительных цветов не включает neutral surfaces,
текстовые цвета и функциональные `success/warning/danger/info`.

### Выбранная модель конфигурации

Публичный `/api/config` расширяется полем:

```json
{
  "clubName": "K-4PRO",
  "themeId": "default-green-v1",
  "authBackgroundImageId": "k4pro-login-v1"
}
```

Deployment выбирает profile через environment configuration, например
`CRM_THEME_ID`, а фоновое изображение — через
`CRM_AUTH_BACKGROUND_IMAGE_ID`. Значения передаются backend как
`Branding__ThemeId` и `Branding__AuthBackgroundImageId`.

Frontend содержит registry заранее утверждённых versioned profiles:

```ts
type ThemeProfile = {
  schemaVersion: 1
  id: string
  main: {
    primary: MantineColorsTuple
    secondary?: MantineColorsTuple
  }
  supplementary: readonly [
    MantineColorsTuple,
    MantineColorsTuple,
    MantineColorsTuple,
    MantineColorsTuple?,
  ]
}

type AuthBackgroundProfile = {
  schemaVersion: 1
  id: string
  asset: string
  focalPoint: {
    xPercent: number
    yPercent: number
  }
}
```

`themeId` и `authBackgroundImageId` являются независимыми opaque identifiers:
deployment может использовать одну palette с разными фоновыми изображениями.
Произвольные hex, CSS variables, URL, binary image data и style rules через
`/api/config` не передаются.

Ответственность разделена однозначно:

- backend заменяет missing/blank value на `default-green-v1`, trim-ит
  configured string и возвращает его через `/api/config`;
- backend заменяет missing/blank `AuthBackgroundImageId` на
  `k4pro-login-v1`, trim-ит non-empty configured string и возвращает его без
  registry validation;
- backend не содержит копию frontend registry и не определяет, зарегистрирован
  ли non-empty theme/background identifier;
- frontend-функция `resolveThemeProfile(themeId)` единолично ищет profile в
  registry;
- frontend-функция
  `resolveAuthBackgroundProfile(authBackgroundImageId)` единолично ищет
  background profile в registry;
- неизвестный frontend registry identifier даёт `default-green-v1` и
  `k4pro-login-v1` соответственно, создаёт reportable warning и не блокирует
  экран входа.

### Обязательные profiles

- `default-green-v1` — текущая green/amber visual direction;
- `test-blue-coral-v1` — заведомо отличающаяся test palette для обнаружения
  hardcoded green/amber values.

Новый production profile добавляется в registry только вместе с theme,
contrast и affected-screen tests. Deployment может переключаться между уже
зарегистрированными profiles без изменения feature code.

### Фоновое изображение auth/start page

- `k4pro-login-v1` является обязательным default background profile и
  ссылается на текущее bundled изображение
  `frontend/src/assets/auth/k4pro-login-bg.png`.
- Background применяется ко всему unauthenticated/forced-auth stage:
  config/session loading, bootstrap error, `auth-login` и forced
  `auth-password-change`. Utility password screen внутри authenticated shell
  не превращается в стартовую страницу.
- Изображение декоративное: не создаёт отдельный accessible object и не требует
  `alt`; доступное имя и heading принадлежат форме или state card.
- Auth card, inputs, validation, recovery и primary action не используют
  изображение как единственный фон. Карточка сохраняет собственную opaque или
  contrast-safe surface; нормальный текст проходит `4.5:1`, controls/boundaries
  — `3:1`.
- Image использует `background-size: cover`, не растягивается с нарушением
  пропорций и кадрируется от зарегистрированного focal point. На `360`, `390`,
  `420`, `440`, `768` и `1440px` форма остаётся первым task target, а image не
  перекрывает и не сдвигает её.
- Asset-specific overlay/crop хранится только в registered background profile
  или явном allowlist. Deployment config не передаёт произвольный overlay,
  position, CSS или URL.
- Загрузка custom image не блокирует доступность формы входа. До разрешения
  `/api/config` используется `k4pro-login-v1`; unknown id, decode/load error или
  недоступный asset переключаются на current default image, а при невозможности
  загрузить и его — на semantic solid auth background без layout shift.
- Новый background profile добавляется только вместе с asset ownership/license
  confirmation, responsive crop review и auth contrast tests. Выбор profile не
  меняет content, geometry, focus order, validation или auth semantics.

### Семантические tokens

Configurable families:

- `brand.primary.*`;
- `brand.secondary.*`;
- `accent.1.*`–`accent.4.*`;
- `action.primary.*`;
- `nav.active.*`;
- `selection.*`;
- `focus.ring`.

Invariant neutral roles:

- `surface.page`;
- `surface.card`;
- `surface.subtle`;
- `surface.overlay`;
- `border.default`;
- `border.strong`;
- `text.heading`;
- `text.primary`;
- `text.secondary`;
- `text.inverse`.

Invariant functional roles:

- `status.success.*`;
- `status.warning.*`;
- `status.danger.*`;
- `status.info.*`;
- `status.neutral.*`.

Functional meaning не переназначается deployment profile. Role, permission и
branch не кодируются отдельными цветами.

### Mantine и CSS integration

- Тема создаётся через `createGymCrmTheme(profile)`.
- `main.tsx` рендерит `ConfigThemeBootstrap`, который загружает app config,
  разрешает profile и только затем монтирует meaningful `App` внутри
  `MantineProvider`.
- До разрешения config допустим минимальный loading shell в bundled default
  theme и с `k4pro-login-v1`; route content и authenticated shell в
  неподтверждённой palette не показываются.
- `App` получает уже загруженный app config через props/context и не выполняет
  второй `/config` request.
- `test/render.tsx` позволяет явно передать `themeId`/profile и по умолчанию
  использует `default-green-v1`.
- Semantic roles зеркалируются в CSS variables с prefix `--crm-`.
- Shared primitives могут обращаться к Mantine color families.
- Feature CSS/TSX использует semantic variables или shared component variants,
  но не `brand.7`, raw hex или rgba brand value напрямую после migration.
- Schedule/category presentation использует `accent.1`–`accent.4` вместе с
  текстовым label; при большем числе категорий цвет может повторяться, потому
  что identity не должна зависеть только от цвета.

### Fallback и validation

- missing/blank backend configuration считается обычным default и не требует
  warning; `/api/config` возвращает `default-green-v1` и
  `k4pro-login-v1`;
- unknown non-empty identifier возвращается backend без registry validation;
- frontend разрешает unknown theme/background identifiers в
  `default-green-v1`/`k4pro-login-v1`, фиксирует reportable warning и не
  блокирует login;
- theme/background profile schema, количество palettes и диапазон focal point
  проверяются unit tests;
- каждый profile проходит contrast tests:
  - normal text не меньше `4.5:1`;
  - large text и UI boundaries не меньше `3:1`;
  - focus ring различим на `surface.page` и `surface.card`;
- status и selected state всегда имеют text/icon/border сигнал помимо цвета.

### Что theme не может менять

- типографику;
- spacing и radii;
- control heights и density;
- порядок и видимость операций;
- permission/restricted semantics;
- status meaning;
- safe-area/keyboard behavior;
- responsive breakpoints;
- role-specific доступ.

Фоновое изображение является частью deployment branding, но не меняет эти
ограничения и не используется на authenticated CRM screens.

## 5. Общие component recipes

### Минимальный shared API и ownership

Foundation implementation создаёт focused files и re-export через текущий
`features/shared/ux.tsx`:

- `features/shared/EntityLocatorBar.tsx`;
- `features/shared/ActiveFiltersBar.tsx`;
- `features/shared/ListRangeStatus.tsx`;
- `features/shared/TaskItem.tsx`;
- `features/shared/RestrictedState.tsx`;
- `features/shared/TemporarySurfaceFooter.tsx`.

Минимальные contracts:

```ts
type EntityLocatorBarProps = {
  accessibleLabel: string
  placeholder: string
  visibleLabel?: string
  value: string
  onChange: (value: string) => void
  onClear: () => void
  onOpenFilters: () => void
  activeFilterCount: number
  resultsId: string
  disabled?: boolean
}

type ActiveFilter = {
  id: string
  label: string
  onRemove: () => void
}

type ActiveFiltersBarProps = {
  filters: readonly ActiveFilter[]
  onReset: () => void
  resetLabel: string
}

type ListRangeStatusProps = {
  start: number
  end: number
  total: number | null
  hasMore?: boolean
  loading?: boolean
}

type TaskItemInteraction =
  | { kind: 'link'; href: string; current?: boolean }
  | { kind: 'button'; onActivate: () => void; pressed?: boolean }
  | { kind: 'option'; onActivate: () => void; selected: boolean }
  | { kind: 'row'; onActivate: () => void; selected: boolean }

type TaskItemProps = {
  accessibleName: string
  leading?: ReactNode
  identity: ReactNode
  metadata?: ReactNode
  status?: ReactNode
  trailing?: ReactNode
  interaction?: TaskItemInteraction
}

type RestrictedStateProps = {
  title: string
  description: string
  primaryAction: ReactNode
  secondaryAction?: ReactNode
  focusOnMount?: 'heading' | 'primary-action' | false
}

type TemporarySurfaceFooterProps = {
  primaryAction: ReactNode
  secondaryAction?: ReactNode
}
```

Behavior:

- `EntityLocatorBar` использует `role="search"` и
  `aria-controls={resultsId}`; input получает `accessibleLabel` через
  `aria-label`/`aria-labelledby`, а не через placeholder.
- `visibleLabel` отсутствует у единственного route-level primary search и
  используется только для перечисленных неоднозначных исключений.
- Filter trigger имеет `aria-haspopup="dialog"` и отдельное accessible name.
- `ActiveFiltersBar` имеет доступное имя scope; remove target не меньше `44px`.
- `ListRangeStatus` использует `role="status"` и `aria-live="polite"`, но не
  объявляет каждую loading animation; при `total=null` показывает известный
  диапазон без выдуманного total и, если применимо, `hasMore`.
- `TaskItem` рендерит семантику из discriminated `interaction` и поддерживает
  соответствующее keyboard behavior; без `interaction` не получает
  `tabIndex`/interactive role.
- `kind='option'` допустим только внутри parent `role='listbox'`, а
  `kind='row'` — внутри `grid`/`treegrid`; только эти варианты используют
  `aria-selected`.
- Link использует `aria-current`, button — `aria-pressed` только когда это
  действительно toggle state, а не просто visual selection.
- `RestrictedState` содержит heading; `focusOnMount` применяется на direct URL,
  но не крадёт focus при обычной client navigation.
- `TemporarySurfaceFooter` владеет safe-area padding и не знает domain actions.

### App shell и header

- `AppLayout` остаётся владельцем Mantine `AppShell`.
- Mobile shell определяется не только width, но и touch/coarse pointer +
  compact height.
- Portrait header baseline — `72px`.
- В compact-height secondary brand copy может скрываться; touch targets не
  уменьшаются.
- Profile trigger не меньше `44px`, полное имя доступно через accessible name.

### Mobile bottom navigation

- Не больше четырёх primary destinations плюс один overflow.
- Набор destinations строится из целостного backend session access contract:
  `allowedSections` и, где применимо, permissions/allowed actions.
- Frontend не восстанавливает доступ из role name и не добавляет destination,
  отсутствующий в `allowedSections`.
- Для текущего SuperAdministrator contract primary destinations:
  `Home`, `Schedule`, `Clients`, `Groups`; overflow: `Users`, `Audit`,
  `Settings`; `Finance` отсутствует.
- При наличии скрытых destinations mobile navigation содержит четыре route
  slots и стабильный пятый trigger `Ещё` с overflow icon. `Ещё` всегда
  открывает drawer `Остальные разделы` и не заменяется текущим route.
- Первые три route slots сохраняют установленный priority order. Четвёртый
  route slot является adaptive: по умолчанию содержит последнюю видимую
  primary destination, для полного management access — `Groups`.
- После перехода на destination из `Ещё` четвёртый adaptive slot заменяет
  прежнюю четвёртую вкладку на точный label и icon текущего destination:
  `Users -> Тренеры`, `Audit -> Журнал`, `Finance -> Финансы`,
  `Settings -> Настройки`.
- Для полного management access видимый ряд меняется так:
  `Главная / Расписание / Клиенты / Группы / Ещё` ->
  `Главная / Расписание / Клиенты / Финансы / Ещё`. На `Журнал`,
  `Тренеры` и `Настройки` четвёртый slot меняется аналогично.
- Вытесненная четвёртая destination переходит в drawer вместе с остальными
  разрешёнными, но не видимыми в первых четырёх slots. Drawer сохраняет
  canonical `APP_NAVIGATION_SECTIONS` order и не дублирует текущий visible
  adaptive item. Например, на `Финансы` drawer содержит `Группы`, `Тренеры`,
  `Журнал`, `Настройки`.
- Adaptive slot остаётся обычной route navigation: active item использует тот
  же selected style, что остальные route tabs, и получает
  `aria-current="page"`. Русские labels `Тренеры`, `Журнал`,
  `Финансы`, `Настройки` полностью видимы в одну строку на `360–440px`, не
  перекрывают соседние items и не создают horizontal page scroll.
- Пятый slot всегда видимо называется `Ещё`, не получает `aria-current` из-за
  active overflow route и использует accessible name
  `Ещё, открыть остальные разделы`, `aria-haspopup="dialog"` и актуальный
  `aria-expanded`. Только он открывает drawer; click по adaptive route slot
  не смешивается с popup behavior.
- Если не видна ровно одна разрешённая destination, `Ещё` и drawer с одним
  пунктом сохраняются. При direct link на этот hidden route он занимает
  adaptive slot, а вытесненная четвёртая destination становится единственным
  пунктом drawer.
- Adaptive state и drawer contents вычисляются из resolved current route и
  разрешённого `currentSection`, а не запоминаются после click. Reload, direct
  deep link, browser back/forward и permission redirect синхронно пересчитывают
  четвёртый slot. Child routes наследуют parent section: `/users/new` и
  `/users/:id/edit` показывают active `Тренеры`.
- До разрешения session/access contract shell не показывает предположенные
  overflow destinations. Недоступный item не появляется даже кратковременно;
  после redirect route slots и drawer соответствуют разрешённому fallback
  route.
- Переход с overflow route на вытесненную primary destination возвращает её в
  четвёртый slot. Переход между overflow routes заменяет adaptive item без
  промежуточного состояния и без изменения стабильного `Ещё`.
- Main content резервирует:
  `navigation height + 16px + env(safe-area-inset-bottom)`.
- Overflow drawer имеет title, явный close, focus trap, focus return на
  актуальный пятый slot и dynamic viewport. Close button остаётся видимым, body
  скроллится внутри drawer без nested scroll trap.
- На `768px` и шире mobile bottom navigation скрыта; persistent side/top
  navigation показывает все разрешённые destinations и точный active item без
  overflow promotion.

### Page header

- Top-level list route не рендерит visible `PageHeader`, когда одноимённая
  active persistent navigation уже видима; `h1` остаётся visually hidden.
- В `browse` state по умолчанию содержит только title и actions.
- Route-level `PageLayout` / `PageHeader` не предоставляет свободные
  `description`, `subtitle`, `eyebrow` или badge slots для декоративного текста.
- Optional count/context допустим только как compact decision data, прошедшие
  `decision/usefulness test`; это не второе название экрана и не предложение
  общего назначения.
- Это ограничение относится к route-level `h1`: section title, status label и
  required decision data не удаляются, но их пояснения также проходят
  `decision/usefulness test` и остаются внутри соответствующей section.
- На `360–440px` допустимый context занимает не больше одной строки. Более
  длинное обязательное пояснение переносится в связанную content section без
  потери полного текста.
- На `768` и `1440px` действует тот же запрет: дополнительная ширина не
  создаёт desktop-only intro, hero или subtitle. Operational context
  размещается в toolbar, detail surface, form help или state panel.
- В compact-height `912 x 420` и `956 x 440` необязательный header context
  скрывается; обязательный остаётся в рабочей section вместе с действием или
  recovery path.
- В action cluster не больше одного filled/accent action.
- При скрытом `PageHeader` actions переходят в первый locator/toolbar/summary
  row: primary/frequent остаются видимыми, secondary/rare не создают отдельную
  строку только ради сохранения прежней геометрии.
- Refresh — frequent action, а не второй primary.
- `search-focused` может визуально свернуть header по screen-specific contract.

### Auth и form copy

- Перед `h1` и первым полем не используются pre-title badge, eyebrow или
  generic lead, которые лишь объявляют тип или обязательность формы.
- Forced password change показывает `Смените пароль` без badge
  `Обязательное действие`; сама route guard, форма и primary action задают
  обязательный путь.
- Фразы, дублирующие primary action, например `После сохранения откроется ваш
  стартовый раздел` рядом с кнопкой `Сменить пароль и продолжить`, удаляются.
- Password policy, validation и recovery размещаются у затронутого поля.
- Отдельный security/prerequisite alert допустим только при конкретной причине
  или последствии, которые меняют действие пользователя. Backend-owned причину
  frontend не придумывает.

### EntityLocatorBar

Shared pattern для длинных списков:

```text
[ search: minmax(0, 1fr) ] [ filter: >=44px ] [ retained actions: >=44px ]
[ removable active filters / scoped reset ]
[ result range ]
```

- Primary search всегда видим, если поиск является главным locator.
- Primary search не имеет видимого generic label над полем; route context,
  search icon и task-oriented placeholder дают визуальный контекст, а
  `accessibleLabel` сохраняет доступное имя.
- Search не дублируется в drawer.
- Clear очищает только query.
- Filter count не включает query и default values.
- Search input и filter trigger остаются достижимы при software keyboard.

#### Единая строка locator/toolbar

На mobile, tablet и desktop primary locator, filter trigger и сохранённые
primary/frequent actions располагаются в одной строке без переноса. Отдельная
вторая строка только для refresh/create запрещена: она создаёт пустоту рядом с
search и отнимает вертикальное место у результатов.

Базовая геометрия:

```text
grid: minmax(0, 1fr) auto
gap: 8px
action cluster: flex; flex-wrap: nowrap; gap: 8px
control target: >=44 x 44px
```

Минимальная полезная ширина search/locator:

| Viewport | Search min-width |
|---|---:|
| `360` | `156px` |
| `390` | `176px` |
| `420` | `200px` |
| `440` | `216px` |
| `768` | `320px` |
| `1440` | `420px`, preferred `420–560px` |

При нехватке ширины применяется фиксированный приоритет:

1. сохранить полезную ширину search;
2. сохранить видимым primary create/add;
3. сохранить filter trigger, если он меняет текущий result;
4. secondary refresh/rare actions свернуть или убрать из этой строки.

На `360–440px` create/add может быть icon-only `44 x 44px`, но сохраняет
точное accessible name операции и primary/accent treatment. Filter и refresh
используют icon-only controls с accessible name. На `768/1440` primary create
возвращает icon + text, если строка сохраняется без переноса; дополнительная
desktop-ширина не создаёт второй toolbar level.

Horizontal scrolling, уменьшение touch target и сжатие search ниже указанного
минимума не используются как fallback. DOM/focus order начинается с search,
затем идёт action cluster; все видимые controls остаются в той же строке.

### Filters

- Standard CRM list filters применяются сразу.
- Mobile drawer закрывается действием `Готово`, а не `Применить`.
- Staged filtering допускается только как отдельное явно обоснованное
  исключение и не смешивается с immediate controls в одной surface.
- Secondary filters находятся в drawer/popover.
- Active filters видимы вне temporary surface и удаляются по одному.
- Reset очищает только advanced filters текущего scope и не очищает query.
- Drawer footer sticky и использует:
  `padding-bottom: calc(12px + env(safe-area-inset-bottom))`.

### Task-oriented rows/cards

- Вся card является primary row action только если она открывает
  preview/detail.
- Если единственная операция — `Редактировать`, card не становится лишним
  focus stop, а edit action имеет target `44px`.
- Identity, scope metadata, status/next action и branch/hall при global context
  предшествуют secondary metadata.
- На `360–440px` запрещена fixed right column, которая обрезает identity.
- Полное primary identity остаётся доступно зрячему пользователю и в accessible
  name.

Sanctioned densities:

- client search-focused card: `96px`;
- normal identity card: content-driven, но не меньше `88px`;
- group card: content-driven, ориентир `112–136px`;
- skeleton повторяет geometry итогового item.

### Range и paging

- List показывает `Показаны X–Y из Z` или эквивалентное `1–10 из 30`.
- Если API возвращает `total=null`, показывается только достоверный диапазон и
  optional `Есть ещё`; UI не подставляет фиктивный total.
- Pagination target не меньше `44px`.
- Текущая page получает `aria-current="page"`.
- Нельзя создавать mobile document из всех 30+ длинных cards без range и
  ограниченного batch.
- Data source paging определяется screen/API contract; визуальный pattern
  остаётся единым.

### Forms

- Mobile form — одна колонка.
- Labels постоянны.
- API error не очищает введённые данные.
- После submit focus/scroll переходит к первому invalid field.
- При клавиатуре focused field, feedback и submit достижимы одним намеренным
  scroll.
- Pending блокирует duplicate submit.

### Tabs

- Сохраняется Mantine keyboard behavior.
- Mobile target не меньше `44px`.
- Tabs не заменяют primary navigation для большого числа destinations.

### Drawer, modal, menu

- Surface имеет доступное название, close behavior и initial focus strategy.
- Close возвращает focus trigger, если trigger существует.
- Escape закрывает desktop temporary surface.
- Mobile back сначала закрывает верхнюю temporary surface.
- Один temporary surface содержит не больше одного scroll container.
- Nested modal/drawer запрещён.

### Notifications

- Transient mobile notification располагается сверху с normal spacing +
  `env(safe-area-inset-top)` и не закрывает primary locator.
- Persistent error/recovery отображается inline в рабочей секции.
- Notification не используется вместо restricted или stale state, требующего
  действия пользователя.
- Desktop notification может оставаться top-right.

## 6. Operational states

| State | Обязательное поведение |
|---|---|
| Loading | Не выглядит empty; locator/context остаётся видимым |
| Empty first-run | Объясняет отсутствие данных и показывает разрешённое create action |
| Empty search | Сохраняет query и предлагает `Очистить поиск` |
| Empty filtered | Сохраняет filters и предлагает scoped reset |
| Error | Называет failed operation и предлагает retry без сброса context |
| Stale | Явно помечает устаревшие данные и не выглядит success |
| Disabled | Объясняет prerequisite, если причина не очевидна |
| Restricted | Называет ограничение и валидный backend-authorized recovery |
| Success | Называет сущность/операцию; duplicate submit предотвращён |

Permission-restricted action не отображается как мёртвый disabled control.
Unknown route, session loading и restricted route являются разными состояниями.

## 7. Responsive matrix

### `360 x 780`

- narrow guardrail;
- одна колонка и bottom navigation;
- no horizontal page scroll;
- chips переносятся, а не образуют обязательный horizontal rail;
- locator может перенести filter trigger на новую строку, сохранив `44px`.

### `390 x 844`

- основной design stress baseline;
- первый viewport показывает header/context, locator и начало results;
- client search-focused state с двумя active filters показывает минимум пять
  полных cards `96px` и начало шестой;
- groups показывают locator и начало первых 1–2 results без summary widgets.

### `420 x 912`

- target iPhone Air acceptance;
- hierarchy не меняется только из-за дополнительной ширины;
- client search-focused state показывает минимум шесть полных cards;
- primary action остаётся достижим одной рукой, где это практично.

### `440 x 956`

- target iPhone 17 Pro Max acceptance;
- допускается дополнительная secondary metadata line без смены action model;
- проверяются длинные ФИО, branch и group names.

### `768 x 1024`

- two-column layout разрешён только при сохранении required decision data;
- filters могут стать inline/popover;
- preview split используется только без horizontal overflow;
- иначе используется drill-down.

### `1440 x 1200`

- compact desktop toolbar и table-like rows;
- optional split preview;
- primary decision columns не требуют horizontal scroll;
- `36–40px` controls допустимы только при fine pointer и normal height.

### `912 x 420` и `956 x 440`

- touch/coarse pointer получает compact mobile shell, а не тесный desktop shell;
- temporary surfaces используют `dvh`/visual viewport, scrollable body и sticky
  footer;
- shell navigation и primary action достижимы;
- нет nested scroll trap;
- keyboard path сохраняет field, feedback и action.

## 8. Safari, keyboard и safe areas

- Full-height surface не полагается только на `100vh`.
- Используется `100dvh` или измеренный visual viewport.
- Fixed/sticky control добавляет safe-area inset к обычному spacing, а не
  заменяет им spacing.
- Bottom action не перекрывается browser chrome, keyboard или home indicator.
- Device-level acceptance требует Simulator или physical iPhone; изменение
  viewport в desktop Chromium не считается Safari acceptance.

## 9. Sanctioned screen-specific variants

### TASK-084

Общесистемная acceptance/migration задача: обновляет shared controls и все
affected call sites до touch/compact-height требований. Не задаёт собственную
палитру или screen-only control sizes.

### TASK-085

- `browse` / `search-focused` state;
- inline search;
- `96px` identity-first client cards;
- page create/refresh скрыты только в search-focused;
- query и advanced filter reset разделены.

### TASK-086

- inline group search;
- status/without-trainer filters;
- range/paging;
- branch/hall/schedule/trainer/status остаются decision data;
- отдельный edit target `44px`.

### TASK-087

UI не реализуется до backend/product решения effective scope. После решения
coach может получить variant `Мои занятия`: scoped counts, next lesson и
chronological day list. SuperAdministrator остаётся global.

### TASK-088

Использует общий `RestrictedState`: heading, reason, primary recovery и
optional accessible alternative. Silent loader/redirect запрещён.

### TASK-089

Desktop split разрешён только при `scrollWidth <= clientWidth` для primary
decision columns. На tablet и compact-height используется drill-down, если
split ухудшает читаемость.

## 10. Implementation constraints

- React, TypeScript, Mantine, Onest, Tabler Icons сохраняются.
- Общие patterns реализуются или расширяются в `features/shared`.
- Новый screen не копирует локально locator, state panel или touch-size rules.
- Feature CSS хранит только предметную geometry, а не page-level theme.
- Новые raw hex/rgba в feature code запрещены.
- `TASK-090` мигрирует все существующие theme-sensitive brand, accent, surface,
  border, focus и selection colors в shared и feature code.
- Functional status/category colors переводятся на invariant status tokens или
  configurable accent families.
- Оправданные asset-specific overlays фиксируются в явном allowlist.
- Static check запрещает raw color за пределами profile registry, invariant
  semantic token source и allowlist.
- Backend contract change для `themeId`/`authBackgroundImageId` обновляет
  frontend types, config tests, backend API tests и deployment example.
- Значимое отклонение от контракта требует UX/UI review и описанного
  screen-specific exception.

## 11. Measurable acceptance

### Geometry и interaction

- [ ] Нет unintended horizontal page scroll на `360`, `390`, `420`, `440`.
- [ ] Все mobile/coarse-pointer targets не меньше `44 x 44 CSS px`.
- [ ] Между независимыми targets не меньше `8px`.
- [ ] Inputs/selects/textareas на iPhone имеют `font-size >= 16px`.
- [ ] На одном task state только одно visually dominant primary action.
- [ ] Primary locator не скрыт в drawer на list screens, где поиск является
      основной операцией.
- [ ] Back восстанавливает query, filters, page/batch, selection и scroll.
- [ ] Focus order соответствует visual/task order.
- [ ] Close temporary surface возвращает focus trigger.

### Responsive и device

- [ ] Пройден `390 x 844` stress baseline.
- [ ] Пройдены target portraits `420 x 912` и `440 x 956`.
- [ ] `912 x 420` и `956 x 440` не включают desktop-only shell на touch.
- [ ] Drawer/modal и bottom actions безопасны при Safari chrome, keyboard и
      safe-area.
- [ ] `768 x 1024` не использует split, если теряется decision data.
- [ ] `1440 x 1200` не требует horizontal scroll для primary columns.

### States и accessibility

- [ ] Loading, empty, error, stale, restricted и success различимы.
- [ ] Color нигде не является единственным сигналом.
- [ ] Text/icon/background contrast проходит требования для каждого profile.
- [ ] Permission-restricted controls не выглядят доступными.
- [ ] Long Russian content и 200% zoom не создают clipping/overlap.

### Theme profiles

- [ ] `/api/config` возвращает configured `themeId` и
      `authBackgroundImageId`, а missing/blank config —
      `default-green-v1` и `k4pro-login-v1`.
- [ ] Unknown non-empty id проходит backend без registry validation; frontend
      использует соответствующий default profile и reportable warning.
- [ ] `auth-login`, forced `auth-password-change`, config/session loading и
      bootstrap error используют resolved background; default возвращает
      текущее `k4pro-login-bg.png`.
- [ ] На `360`, `390`, `420`, `440`, `768`, `1440` background сохраняет
      пропорции/focal point, не сдвигает форму и не ухудшает contrast.
- [ ] Unknown/missing/broken background не блокирует login и даёт
      deterministic image/solid-color fallback без layout shift.
- [ ] Основные mobile paths проходят с `default-green-v1`.
- [ ] Те же paths проходят с `test-blue-coral-v1`.
- [ ] Переключение theme не меняет hierarchy, geometry, meaning и permissions.
- [ ] Feature code не содержит новых raw brand/accent colors.

### Required validation

```text
cd frontend && npm run lint
cd frontend && npm run build
cd frontend && npm run test:unit
cd frontend && npm run test:e2e -- <affected-spec>
cd frontend && npm run test:e2e:iphone
dotnet test backend/tests/GymCrm.Tests/GymCrm.Tests.csproj
```

Backend tests обязательны при изменении `/config` и deployment theme contract.
Отдельно фиксируются проверки, которые остаются для Safari Responsive Design
Mode, iOS Simulator или physical device.

## 12. Governance для новых UI-задач

Каждая новая или существенно изменённая UI-задача должна:

1. ссылаться на этот контракт;
2. описывать user, result и primary path;
3. классифицировать действия;
4. перечислять required decision data;
5. описывать responsive transformations и operational states;
6. перечислять только реальные screen-specific исключения;
7. не задавать собственные brand colors, page spacing, control heights или
   generic states;
8. иметь measurable acceptance, а не только screenshot comparison.
