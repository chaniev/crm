# TASK-048: Унифицировать content-layout контракт для всех разделов CRM

## Status
ready

## Goal
Сформировать единый content-layout контракт для всех авторизованных вкладок CRM и устранить различия между ними по базовой геометрии: ширине, внешним и внутренним отступам, gap, radius, shadow, alignment и responsive-поведению.

## Context
По скриншотам `Главная` и `Расписание` видно, что содержимое разделов визуально живет в разных системах отступов. Проверка frontend source code подтвердила: общий shell и общие UI-примитивы есть, но нет обязательного общего wrapper-а для content area всех разделов.

Сейчас часть экранов использует `PageCard`, часть использует сырой `Paper className="surface-card surface-card--wide"`, часть задает локальные page-level ширины и отступы через screen-specific CSS. Из-за этого страницы отличаются не только содержимым, но и базовой сеткой.

## User role
администратор / тренер / главный тренер

## Problem
Без единого content-layout контракта новые и существующие вкладки могут расходиться визуально: разные горизонтальные отступы, разные card padding, разные ширины, разный ритм между секциями и локальные компенсации внутри отдельных экранов.

## Scope
- Спроектировать shared frontend contract для content layout авторизованных разделов.
- Ввести или уточнить shared-компоненты для page-level layout, например `PageLayout`, `PageSection`, `PageCard`, `PageToolbar`, `TabContent`.
- Централизованно задать:
  - max-width контента;
  - horizontal alignment;
  - outer page padding;
  - vertical rhythm между секциями;
  - card padding;
  - radius `24px` для всех карточек в рамках content-layout;
  - shadow;
  - responsive behavior;
  - единый вариант ширины `default` для всех route-level экранов.
- Все авторизованные вкладки должны использовать одинаковую page-level ширину `default`; `wide` и `full` не должны применяться для базового layout-а вкладок.
- Заголовок страницы должен иметь единый shared-вариант вне карточки, а не задаваться разными способами внутри `PageCard` / `Paper`.
- Унифицировать все базовые визуальные параметры content-layout: width, alignment, outer padding, inner/card padding, gap/rhythm, radius, shadow, background и border style.
- Привести к единому контракту основные route-level screens:
  - `HomeDashboard`;
  - `GroupScheduleScreen`;
  - `ClientsListScreen`;
  - `ClientManagement` create/edit/detail;
  - `AttendanceScreen`;
  - `AuditLogScreen`;
  - `FinanceReportsScreen`;
  - `UsersListScreen`;
  - `UserCreateScreen`;
  - `UserEditScreen`;
  - `GroupManagement`;
  - `SettingsScreen`;
  - `BranchSettingsScreen`.
- Для `Settings` отдельно определить общий wrapper для `Tabs.Panel` content.
- Для `Schedule` отдельно унифицировать alignment верхнего фильтра и календарной доски в рамках той же `default` ширины, без локального `wide`-исключения.
- Для `Clients` отдельно заменить кастомный page-level layout на shared content-layout wrapper с той же `default` шириной.

## Clarified decisions
- Ширина: все вкладки используют только `default`.
- Data-heavy экраны: `Schedule` и `Clients` не получают отдельный `wide`; они должны жить в той же ширине, что и остальные вкладки.
- Заголовок: нужен единый shared-вариант заголовка страницы вне карточки.
- Radius: везде в рамках content-layout использовать `24px`.
- Унификация параметров: унифицировать не только alignment/spacing, но также shadow, background и border style.
- Design pass: перед кодовой миграцией обязателен design pass с `ui-designer`.
- Обязательные viewport sizes для визуальной проверки:
  - `390x844` mobile baseline;
  - `393x852` iPhone 15 Pro;
  - `402x874` iPhone 17 Pro;
  - `420x912` iPhone Air;
  - `440x956` iPhone 17 Pro Max;
  - `768x1024` tablet / navigation breakpoint;
  - `1440x1200` desktop baseline;
  - `1920x1080` desktop Full HD.

## Current implementation notes
- `PageCard` сейчас поддерживает `default` / `wide` / `full`, но явные `width="wide"` и `width="full"` в route-level screens не используются.
- Большинство `PageCard` фактически используют `default`.
- `Schedule` сейчас имеет локальные `92rem`-исключения для фильтра и календарной доски.
- `ClientsListScreen` сейчас использует кастомный page-level layout без `PageCard`.
- `ClientManagement` create/edit/detail местами использует сырой `Paper className="surface-card surface-card--wide"` вместо shared wrapper.
- Radius сейчас смешан: встречаются `8px`, `20px`, `24px` и `28px`; целевое значение для content-layout - `24px`.

## Design pass proposals

### Shared content-layout contract
- Ввести обязательный route-level wrapper `PageLayout` для всех авторизованных экранов CRM.
- `PageLayout` должен быть единственным владельцем:
  - page-level width `default`;
  - outer content alignment;
  - vertical rhythm страницы;
  - верхнего заголовка страницы вне карточек;
  - primary actions страницы;
  - page-level typography и text color roles.
- Не менять `AppLayout` / shell без необходимости: `AppLayout` уже владеет `AppShell` и `Container`, а новый контракт должен работать внутри content area.
- Разделить семантику заголовков:
  - `PageLayout` / `PageTitle` - только внешний заголовок route-level страницы;
  - `SectionHeader` - заголовки внутри карточек и секций;
  - текущий `PageHeader` не должен одновременно быть page header, section header и action-only row.
- `PageCard` оставить как совместимый alias на shared card section на период миграции, но убрать из route-level API публичную width-семантику `wide` / `full`.
- Ввести `PageSection` для page-level секций:
  - `variant="card"` для карточных секций;
  - `variant="plain"` для секций без surface, если это нужно;
  - `density="default" | "compact"` для внутренней плотности без изменения ширины страницы.
- Для `Settings` ввести общий wrapper `TabContent` / `PageTabsPanel` для содержимого `Tabs.Panel`, чтобы panel spacing, width и heading behavior не задавались через локальный `mt` и embedded-режимы.

### Proposed shared API
```tsx
<PageLayout
  title="Клиенты"
  description="Описание раздела"
  actions={actions}
  data-testid="clients-screen"
>
  <PageSection>
    <SectionHeader title="Фильтры" />
    {content}
  </PageSection>
</PageLayout>
```

Минимальный набор shared components:
- `PageLayout`;
- `PageSection`;
- `SectionHeader`;
- `TabContent` / `PageTabsPanel`;
- `PageCard` как временный compatibility alias для `PageSection variant="card"`.

### Geometry tokens
- Зафиксировать текущую default-ширину как базу: `--page-max-width: 65rem`.
- Убрать page-level `wide` / `full` из authenticated content-layout contract.
- Не расширять `Schedule` и `Clients` через локальные width-исключения; если экрану нужна плотность, уменьшать внутренние gaps/padding конкретного content widget, а не ширину страницы.
- Рекомендуемые токены:
  - `--page-gap-y: 1rem` на mobile, `1.5rem` на tablet+;
  - `--page-section-gap: 1rem`;
  - `--page-card-padding: 1rem` на mobile, `1.5rem` на desktop;
  - `--page-card-padding-compact: 1rem`;
  - `--page-card-radius: 24px`;
  - `--page-card-shadow: var(--shadow-card)`;
  - `--page-card-bg: #ffffff`;
  - `--page-card-border: rgba(20, 90, 82, 0.1)`.
- Все user-perceived top-level и section-level cards в рамках content-layout должны использовать `24px`.
- Плотные list/table rows либо тоже приводятся к `24px`, либо получают явно описанный sanctioned variant, например `itemCard`, если `24px` визуально перегружает плотные operational lists.

### Typography contract
- Использовать `Onest` как единственный шрифт, сохраняя текущую Mantine/theme базу.
- Ввести семантическую типографическую шкалу вместо локальных screen-specific размеров:
  - page title: `font-weight: 800`, `font-size: clamp(1.625rem, 1.4rem + 0.8vw, 2rem)`, `line-height: 1.1`;
  - page description: `font-size: 0.9375rem`, `line-height: 1.5`;
  - section title: `font-size: 1.125rem`, `font-weight: 700`;
  - toolbar/form label: `font-size: 0.8125rem`, `font-weight: 700`;
  - overline/meta label: `font-size: 0.75rem`, `font-weight: 700`, uppercase;
  - row/card primary text: `font-size: 1rem`, `font-weight: 700`;
  - row/card secondary text: `font-size: 0.875rem`, `font-weight: 400/500`.
- Запретить локальные font-size/color overrides для route-level page title.
- Предметные таблицы, календарные карточки и плотные row-компоненты могут иметь feature-specific typography только внутри content widget, но не для page-level title/rhythm/alignment.

### Text color contract
- Поднять цвета из `theme.other` в semantic CSS variables для content-layout:
  - `--text-heading: var(--mantine-color-brand-9)`;
  - `--text-primary: #17312D`;
  - `--text-secondary: #66756F`;
  - `--text-label: var(--mantine-color-brand-8)`;
  - `--text-danger: var(--mantine-color-red-7)`;
  - `--text-warning: var(--mantine-color-yellow-8)`.
- Не использовать `c="dimmed"` как единственный системный muted-contract для page layout: сейчас он смешивает page descriptions, counters, labels, table headers и helper copy.
- Для page description, section description, meta labels, counters и helper text использовать semantic variants/classes.
- Status/accent colors должны оставаться предметными tokens/variants, а не подменять базовую цветовую гамму текста.

### Screen-specific proposals
- `HomeDashboard`: вынести title/description/actions из первой карточки в `PageLayout`; первую карточку оставить только для содержимого expiring memberships.
- `GroupScheduleScreen`: убрать `92rem`-исключения для фильтра и календарной доски; фильтр и board должны жить в той же `default` колонке. Board перевести с raw `Paper` на `PageSection density="compact"`.
- `ClientsListScreen`: заменить кастомный page-level layout на `PageLayout(title="Клиенты")`; toolbar/count/actions перенести в page actions или первую `PageSection`; quick filters и list/preview оформить внутри shared sections.
- `ClientManagement` create/edit/detail: заменить raw `Paper surface-card surface-card--wide` и локальные `8px`/`28px` surfaces на `PageSection`; убрать дублирование имени клиента как H1 снаружи и H2 внутри overview, если H1 уже есть в `PageLayout`.
- `AttendanceScreen`, `AuditLogScreen`, `FinanceReportsScreen`: вынести page title из первой filter/result card наружу; filter cards и result cards оставить как sections.
- `UsersListScreen` и `GroupManagement`: заменить action-only верхний `PageHeader` на полноценный внешний page title с actions; заголовок списка внутри карточки сделать `SectionHeader`.
- `UserCreateScreen`, `UserEditScreen`, group create/edit/detail flows: оставить внешний page title, но заменить page-level raw surfaces на shared sections.
- `SettingsScreen`: добавить внешний page title до tabs; `Tabs.List` оставить первой секцией; каждый `Tabs.Panel` обернуть в `TabContent`.
- `BranchSettingsScreen`: embedded mode не должен добавлять собственный top margin, title-card или менять heading level вручную; эти решения должен задавать `TabContent` / parent layout.
- Placeholder screens в `App.tsx` также привести к shared contract, чтобы новые разделы не копировали устаревший raw `Paper surface-card--wide`.

### Accessibility and interaction proposals
- Единый focus order для route-level экранов: page title -> page actions -> first section controls -> results.
- Page title не должен пропадать при loading/error/empty state.
- Loading/empty/error states должны жить внутри section с постоянным padding/min-height, чтобы не создавать layout jump.
- Для `Tabs` оставить keyboard behavior Mantine; panel не должен перехватывать focus при смене tab.
- Для динамических counters/status copy использовать `aria-live="polite"` там, где текст обновляется без явного navigation.
- Для selectable rows в `Clients` и settings branch selector рассмотреть `listbox` / `option` с `aria-selected`, если preview pattern сохраняется.

### Migration order
1. Зафиксировать shared tokens и API в `shared/ux.tsx` и `App.css`.
2. Мигрировать простые экраны: `Home`, `Attendance`, `Audit`, `Finance`.
3. Мигрировать list/form экраны: `Users`, `Groups`, `UserCreate`, `UserEdit`, group create/edit/detail.
4. Отдельно мигрировать high-risk экраны: `Schedule`, `ClientsList`, `ClientManagement`, `Settings` / `BranchSettings`.
5. После миграции удалить dead CSS/API:
   - `.page-card--wide`;
   - `.page-card--full`;
   - `.surface-card--wide`;
   - `.page-title-row`;
   - direct-child width rule для `.dashboard-stack > .mantine-SimpleGrid-root`.

### Risks
- `65rem` для `Schedule` и `Clients` может оказаться плотным на `1440x1200` и `768x1024`; компенсировать это внутренней плотностью widgets, а не `wide` шириной страницы.
- Буквальное применение `24px` ко всем nested `Paper` может перегрузить плотные utility/list/table containers; нужны явные границы между `layout surfaces` и `content items`.
- Замена `c="dimmed"` на semantic muted может визуально изменить много текста; нужен отдельный visual regression pass.
- `ClientManagement` самый рискованный по radius/padding из-за смеси `28px`, `24px`, `8px`.
- `ClientsListScreen` и `Schedule` самые рискованные по responsive geometry из-за текущих локальных layout exceptions.
- `responsive-main-screens.spec.ts` может содержать ожидания, которые придется обновить после появления внешних page headings.

### Remaining product decisions before implementation
- Нужен ли visible H1 на каждом route-level экране без исключений, включая `Users`, `Groups`, `Attendance`, `Audit`, `Finance`.
- Считать ли плотные list/table rows частью `content-layout cards` или вывести их в отдельный compact primitive.
- Распространяется ли `24px` на modal hint-cards, photo placeholders и table wrappers, или только на card-like content surfaces внутри route-level content.
- Для `Clients` persistent preview-aside на desktop является sanctioned shared pattern или feature-specific inner layout внутри стандартной page section.
- Должен ли page title повторять label текущего route из shell один в один.
- Для `ClientDetail` оставлять ли повтор имени клиента внутри overview, если H1 уже снаружи.

## Out of scope
- Изменение backend contracts.
- Изменение CRM business rules, ролей, permissions или access scope.
- Редизайн предметного содержимого экранов сверх унификации layout-контракта.
- Переписывание календарной сетки, клиентской таблицы или форм без необходимости для layout-контракта.

## Constraints
- Frontend не должен дублировать CRM domain rules из backend.
- Локальные CSS-классы должны оставаться только для предметного содержимого: календарная сетка, клиентские строки, формы, карточки событий, специфичные внутренние блоки.
- Page-level ширина и базовый rhythm должны задаваться shared API, а не локальными screen-specific CSS-исключениями.
- Не использовать новые page-level `Paper surface-card surface-card--wide` вне shared layout-компонентов.
- Существенные UX-изменения требуют проверки с `ui-designer` по root `AGENTS.md`.
- Перед началом кодовой миграции выполнить design pass с `ui-designer` и зафиксировать итоговый shared contract.

## Acceptance criteria
- [ ] Все основные разделы используют единый shared content-layout wrapper.
- [ ] У каждого route-level CRM screen есть ровно один shared page title/header вне карточек.
- [ ] Action-only page header без title не используется как route-level header.
- [ ] `Home` и `Schedule` имеют одинаковый базовый content alignment, outer padding и card rhythm.
- [ ] Все route-level screens используют одинаковую page-level ширину `default`.
- [ ] Page-level ширина задается через shared API, а не локальными CSS-классами страниц.
- [ ] Route-level screens не используют raw `Paper` / `surface-card` / `surface-card--wide` для базовой геометрии страницы.
- [ ] `Schedule` и `Clients` не используют локальные `wide` / full-width исключения для базовой геометрии вкладки.
- [ ] `Schedule` filters и board выровнены в той же `default` колонке; horizontal overflow решается внутри board, а не расширением page shell.
- [ ] `ClientsListScreen` использует shared page header и shared section wrappers; count label и quick filters не считаются page title.
- [ ] Заголовок страницы во всех вкладках используется через единый shared-вариант вне карточки.
- [ ] Внутренние card/section headers используют отдельный `SectionHeader`, а не route-level page title component.
- [ ] Все карточки в рамках content-layout используют radius `24px`.
- [ ] Исключения для плотных row/item/table surfaces оформлены как явные sanctioned variants shared-компонентов.
- [ ] Shadow, background и border style унифицированы через shared contract.
- [ ] Внутренние вкладки используют общий wrapper для panel content.
- [ ] `Settings` tab panels используют общий `TabContent` / `PageTabsPanel`; embedded screens не добавляют собственный top margin и не меняют heading level вручную.
- [ ] Различия между страницами оформлены как явные variants shared-компонентов.
- [ ] Размеры и роли текста задаются shared semantic variants: page title, page description, section title, section description, muted/helper text, label, row primary, row secondary.
- [ ] Цвета текста задаются semantic tokens/classes, а не локальными screen-specific overrides для page-level typography.
- [ ] Локальные классы не управляют базовой геометрией всей страницы.
- [ ] `Home`, `Schedule`, `Clients`, `Users`, `Groups`, `Settings` имеют одинаковые left/right content edges на desktop и mobile baseline; допустимое расхождение не более `8px`, если не зафиксировано отдельным sanctioned variant.
- [ ] На каждом route screen page title, primary action cluster и first content section остаются above-the-fold и читаются как одна и та же иерархия на `390x844`, `768x1024`, `1440x1200`.
- [ ] UI не меняет бизнес-логику и не дублирует backend CRM rules.

## Test checklist
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Обновить/добавить unit tests для shared `PageLayout`, `PageSection`, `SectionHeader`, `TabContent` / `PageTabsPanel`.
- [ ] Запустить affected Playwright tests по основным экранам.
- [ ] Проверить `responsive-main-screens.spec.ts`.
- [ ] Обновить ожидания `responsive-main-screens.spec.ts`, если текущие тесты предполагают отсутствие внешних page headings.
- [ ] Проверить `home-dashboard.spec.ts`.
- [ ] Проверить `group-schedule.spec.ts`.
- [ ] При изменении клиентских экранов проверить relevant clients e2e/tests.
- [ ] Добавить или расширить e2e coverage для `ClientsListScreen`, `ClientManagement`, `Settings`, `GroupManagement`, если миграция меняет их page-level layout.
- [ ] Визуально проверить обязательные viewport sizes: `390x844`, `393x852`, `402x874`, `420x912`, `440x956`, `768x1024`, `1440x1200`, `1920x1080`.
- [ ] Визуально сравнить left/right content edges между `Home`, `Schedule`, `Clients`, `Users`, `Groups`, `Settings`.
- [ ] Отдельно проверить `Schedule` и `Clients` на `768x1024`, `1440x1200`, `1920x1080` после удаления `wide`-исключений.

## AI safety
- Safe for Codex: yes, after required `ui-designer` design pass
- Risk level: medium
- Reason: задача затрагивает много frontend route-level screens и может вызвать широкий визуальный regression; ключевые contract variants и визуальные критерии уточнены, но перед кодовой миграцией нужен design pass.

## Clarification questions
- [x] Какие варианты ширины должны быть в контракте: только `default`/`wide` или также `full`?
  - Ответ: все вкладки должны использовать `default`; `wide` и `full` не применяются для базового route-level content-layout.
- [x] Должны ли все основные вкладки иметь одинаковую ширину, или data-heavy экраны вроде `Schedule` и `Clients` могут использовать `wide`?
  - Ответ: все основные вкладки должны иметь одинаковую ширину; `Schedule` и `Clients` также используют `default`.
- [x] Должны ли заголовки страниц всегда быть внутри карточки или может быть единый вариант заголовка вне карточки?
  - Ответ: нужен единый shared-вариант заголовка страницы вне карточки.
- [x] Какой radius должен быть стандартом для page-level карточек и внутренних карточек?
  - Ответ: `24px` везде в рамках content-layout.
- [x] Нужно ли унифицировать только alignment/spacing или также shadow, background и border style?
  - Ответ: унифицировать все параметры: alignment, spacing, shadow, background, border style и остальные базовые параметры content-layout.
- [x] Нужно ли сначала сделать design pass с `ui-designer` перед кодовой миграцией?
  - Ответ: да, design pass обязателен перед кодовой миграцией.
- [x] Какие viewport sizes считать обязательными для визуальной проверки?
  - Ответ: `390x844`, `393x852`, `402x874`, `420x912`, `440x956`, `768x1024`, `1440x1200`, `1920x1080`.

## Source notes
- Source: user request in Codex thread on 2026-05-20.
- Original request: `сформируй задачу на формирование единнго content-layout контракта для всех вкладок и устранения различия между ними по всем параметрам`
- Follow-up request: `сохрани требования в виде задачи needs-clarification`
- Clarification answers received on 2026-05-20:
  - width: везде `default`;
  - headers: единый вариант вне карточки;
  - radius: везде `24px`;
  - visual parameters: унифицировать все;
  - design pass: нужен;
  - viewport set: approved with additional iPhone Air, iPhone 15 Pro, iPhone 17 Pro/Pro Max and `1920x1080`.
- Specialist analysis added on 2026-05-20:
  - `ux-researcher`: confirmed need for mandatory `PageLayout`, external page title, semantic typography/color roles and explicit acceptance criteria;
  - `ui-designer`: proposed implementation-ready geometry tokens, typography scale, text color tokens, screen-specific visual migration and risks;
  - `react-specialist`: proposed shared React API, migration order, files in scope and test risks.

## Processing notes
- Created at: 2026-05-20
- Created by: Codex
- Branch: not created by explicit user request.
- Duplicate check: existing active backlog has frontend UI tasks `TASK-045`, `TASK-046`, `TASK-047`, but no dedicated task for mandatory content-layout contract across all tabs.
