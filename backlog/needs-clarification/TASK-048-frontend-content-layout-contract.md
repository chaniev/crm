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
- [ ] `Home` и `Schedule` имеют одинаковый базовый content alignment, outer padding и card rhythm.
- [ ] Все route-level screens используют одинаковую page-level ширину `default`.
- [ ] Page-level ширина задается через shared API, а не локальными CSS-классами страниц.
- [ ] `Schedule` и `Clients` не используют локальные `wide` / full-width исключения для базовой геометрии вкладки.
- [ ] Заголовок страницы во всех вкладках используется через единый shared-вариант вне карточки.
- [ ] Все карточки в рамках content-layout используют radius `24px`.
- [ ] Shadow, background и border style унифицированы через shared contract.
- [ ] Внутренние вкладки используют общий wrapper для panel content.
- [ ] Различия между страницами оформлены как явные variants shared-компонентов.
- [ ] Локальные классы не управляют базовой геометрией всей страницы.
- [ ] UI не меняет бизнес-логику и не дублирует backend CRM rules.

## Test checklist
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Запустить affected Playwright tests по основным экранам.
- [ ] Проверить `responsive-main-screens.spec.ts`.
- [ ] Проверить `home-dashboard.spec.ts`.
- [ ] Проверить `group-schedule.spec.ts`.
- [ ] При изменении клиентских экранов проверить relevant clients e2e/tests.
- [ ] Визуально проверить обязательные viewport sizes: `390x844`, `393x852`, `402x874`, `420x912`, `440x956`, `768x1024`, `1440x1200`, `1920x1080`.

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

## Processing notes
- Created at: 2026-05-20
- Created by: Codex
- Branch: not created by explicit user request.
- Duplicate check: existing active backlog has frontend UI tasks `TASK-045`, `TASK-046`, `TASK-047`, but no dedicated task for mandatory content-layout contract across all tabs.
