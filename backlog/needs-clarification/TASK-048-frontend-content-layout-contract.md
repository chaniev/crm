# TASK-048: Унифицировать content-layout контракт для всех разделов CRM

## Status
needs-clarification

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
  - radius;
  - shadow;
  - responsive behavior;
  - варианты ширины вроде `default`, `wide`, `full`.
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
- Для `Schedule` отдельно унифицировать alignment верхнего фильтра и календарной доски.

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

## Acceptance criteria
- [ ] Все основные разделы используют единый shared content-layout wrapper.
- [ ] `Home` и `Schedule` имеют одинаковый базовый content alignment, outer padding и card rhythm.
- [ ] Page-level ширина задается через shared API, а не локальными CSS-классами страниц.
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

## AI safety
- Safe for Codex: no
- Risk level: medium
- Reason: задача затрагивает много frontend route-level screens и может вызвать широкий визуальный regression; перед реализацией нужно уточнить contract variants, визуальные критерии и объем миграции.

## Clarification questions
- [ ] Какие варианты ширины должны быть в контракте: только `default`/`wide` или также `full`?
- [ ] Должны ли все основные вкладки иметь одинаковую ширину, или data-heavy экраны вроде `Schedule` и `Clients` могут использовать `wide`?
- [ ] Должны ли заголовки страниц всегда быть внутри карточки или может быть единый вариант заголовка вне карточки?
- [ ] Какой radius должен быть стандартом для page-level карточек и внутренних карточек?
- [ ] Нужно ли унифицировать только alignment/spacing или также shadow, background и border style?
- [ ] Нужно ли сначала сделать design pass с `ui-designer` перед кодовой миграцией?
- [ ] Какие viewport sizes считать обязательными для визуальной проверки?

## Source notes
- Source: user request in Codex thread on 2026-05-20.
- Original request: `сформируй задачу на формирование единнго content-layout контракта для всех вкладок и устранения различия между ними по всем параметрам`
- Follow-up request: `сохрани требования в виде задачи needs-clarification`

## Processing notes
- Created at: 2026-05-20
- Created by: Codex
- Branch: not created by explicit user request.
- Duplicate check: existing active backlog has frontend UI tasks `TASK-045`, `TASK-046`, `TASK-047`, but no dedicated task for mandatory content-layout contract across all tabs.
