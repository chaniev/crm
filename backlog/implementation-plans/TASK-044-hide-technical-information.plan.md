# Implementation Plan: TASK-044 Убрать служебные intro-блоки со всех страниц CRM

## Source task
/backlog/implementation/TASK-044-hide-technical-information.md

## Implementation branch
feature/TASK-044-hide-technical-information

Branch rules:
- create this branch before writing project code;
- create it from `main` after `git pull` and clean `git status`;
- if the branch already exists, verify that it belongs only to `TASK-044`;
- do not implement other unrelated TASKs in this branch;
- confirm the branch is active before making frontend changes.

## Goal
Рабочие CRM-экраны должны начинаться с полезного содержимого: фильтров, списков, таблиц, форм и основных действий. Верхние intro/hero-карточки с поясняющим текстом, role/access-бейджами, техническими счетчиками и служебными подсказками должны исчезнуть со всех найденных frontend routes.

## Current understanding
- Задача локализована во frontend и не меняет backend audit data, raw JSON, object IDs, ProblemDetails contracts, roles, permissions or access scope.
- Общий паттерн найден через `PageCard className="page-header-card"` + `PageHeader` with `eyebrow/description`, а также локальные hero-компоненты `UserManagementHero`, `GroupFormHero` and `ClientHero`.
- Примеры уже видны в `Schedule`, `Attendance`, `Groups`, `Users/Trainers`, `Audit`, `Finance`, `Settings`, `Branch settings`, `Clients create/edit/detail` and placeholder screens in `App.tsx`.
- Некоторые действия сейчас живут внутри hero-блоков, например create/refresh/back/edit/transfer. Их нужно перенести рядом с рабочим содержимым или в обычный компактный page heading, не потеряв сценарии.
- Служебные бейджи вроде `Главный тренер и администратор`, `Только для главного тренера`, `Любая доступная группа`, `Показано N из N`, `Фильтры: N` удаляются именно из intro/header areas. Рабочие статусы внутри карточек, таблиц, фильтров, форм и модалок не удаляются автоматически.
- Изменение широкое по UI, поэтому перед кодом нужен короткий `ui-designer` review ожидаемого layout после удаления верхних блоков.

## Execution steps
1. Подготовить ветку: перейти на `main`, выполнить `git pull`, убедиться в clean `git status`, создать or switch to `feature/TASK-044-hide-technical-information`.
2. Прочитать `frontend/AGENTS.md` and confirm frontend-only scope: Mantine/Onest preserved, backend CRM rules not duplicated, required validation is lint + build.
3. Провести короткий `ui-designer` review для общего решения: как выглядят screens после удаления hero, куда переносятся primary actions, какие заголовки остаются обычными, без hero-card.
4. Сделать инвентаризацию routes/screens через code search:
   - `rg "page-header-card|UserManagementHero|ClientHero|GroupFormHero|eyebrow=|Показано|Главный тренер|Только для|Любая доступная группа" frontend/src`;
   - сверить все routes from `frontend/src/lib/appRoutes.ts` and route rendering in `frontend/src/App.tsx`;
   - отметить screens where top service intro exists and screens that already start with useful content, such as the current clients list toolbar.
5. В `frontend/src/features/shared/ux.tsx` решить, нужен ли небольшой reusable compact heading/action row. Если existing `PageHeader` достаточно, использовать его без `eyebrow` and without service descriptions; не добавлять новую abstraction без реальной пользы.
6. Удалить верхние `page-header-card` intro blocks from route screens and move useful actions:
   - Schedule: move refresh near filters/calendar, remove group/scope/count/filter badges and explanatory intro text.
   - Attendance: start with attendance filters/work card, keep date/group controls and refresh roster, remove scope badge and intro explanation.
   - Groups: move create/refresh to list/work header, remove top hero and role/count service header text; keep group list, form actions, useful metrics only if they are operational and not decorative intro.
   - Users/Trainers: remove `UserManagementHero` usage or shrink it into normal work heading, move create/refresh/back actions, remove role-only badges.
   - Audit: remove top journal intro and role badge, keep filters/table/details modal and do not hide raw audit details because they are out of scope.
   - Finance: remove top finance intro, keep period/filter form and refresh; remove badge-like period only if it is part of the intro/header noise rather than an active filter control.
   - Settings/Branch settings: remove settings intro cards, keep tabs, create/refresh actions and dictionaries.
   - Clients create/edit/detail: remove `ClientHero` badge/description hero treatment, keep back/edit/transfer/archive actions and readable client/title context.
   - App placeholder screens: remove service hero blocks from unavailable sections if they are still reachable through routes.
7. Clean up strings in `frontend/src/lib/resources.ts` that only served removed intro/hero blocks, while preserving labels used by forms, tables, empty states, errors and navigation.
8. Update CSS in `frontend/src/App.css`: remove or reduce unused `.page-header-card*` and `.management-hero__actions` styles only after verifying no remaining legitimate consumer needs them; adjust top spacing so no blank gaps remain.
9. Update existing unit/component tests that asserted removed intro copy or badges. Do not add domain-rule tests because no business logic changes.
10. Add or extend Playwright coverage, preferably in `frontend/e2e/responsive-main-screens.spec.ts`, to visit the main CRM routes and assert:
    - top service hero/intro blocks are absent;
    - forbidden technical labels are not visible in page intro areas;
    - primary actions such as create/refresh/back remain available where expected;
    - main working content still renders.
11. Run frontend validation and fix only TASK-044-related failures.
12. Manually inspect desktop and mobile/tablet layouts for affected screens after automated checks pass, focusing on top spacing, action placement, text wrapping and absence of overlapping.

## Preferred implementation strategy
1. Inventory-first UI cleanup across all frontend routes.
2. Remove local hero instances in small screen-by-screen patches, preserving actions before deleting wrapper blocks.
3. Prefer existing Mantine layout and shared frontend components over new abstractions.
4. Keep backend contracts untouched and avoid moving CRM business/access rules into frontend.
5. Add a Playwright regression barrier for route-level absence of service intros; use manual QA only for final visual polish.

Avoid:
- changing backend audit, validation, ProblemDetails or permissions behavior;
- removing useful work controls, filters, forms, data tables, detail modals or domain status labels inside actual content;
- broad redesign of cards, navigation or table layouts;
- replacing removed service text with new explanatory copy elsewhere;
- creating page-level empty gaps where hero cards used to be.

## Files likely to change
- `frontend/src/features/schedule/GroupScheduleScreen.tsx`
- `frontend/src/features/attendance/AttendanceScreen.tsx`
- `frontend/src/features/groups/GroupManagement.tsx`
- `frontend/src/features/users/UserManagementHero.tsx`
- `frontend/src/features/users/UsersListScreen.tsx`
- `frontend/src/features/users/UserCreateScreen.tsx`
- `frontend/src/features/users/UserEditScreen.tsx`
- `frontend/src/features/audit/AuditLogScreen.tsx`
- `frontend/src/features/finance/FinanceReportsScreen.tsx`
- `frontend/src/features/settings/SettingsScreen.tsx`
- `frontend/src/features/settings/BranchSettingsScreen.tsx`
- `frontend/src/features/clients/ClientManagement.tsx`
- `frontend/src/App.tsx`
- `frontend/src/App.css`
- `frontend/src/lib/resources.ts`
- `frontend/src/features/shared/ux.tsx` if a small shared heading/action adjustment is needed
- `frontend/src/features/shared/ux.test.tsx` if shared heading behavior changes
- affected feature tests, especially `frontend/src/features/audit/AuditLogScreen.test.tsx`, `frontend/src/features/finance/FinanceReportsScreen.test.tsx`, and `frontend/src/features/home/HomeDashboard.test.tsx` only if assertions reference removed copy
- `frontend/e2e/responsive-main-screens.spec.ts`
- possible route-specific e2e specs: `frontend/e2e/group-schedule.spec.ts`, `frontend/e2e/attendance.spec.ts`, `frontend/e2e/finance-reports.spec.ts`, `frontend/e2e/users.spec.ts`

## Constraints
- Backend remains source of truth for audit semantics, validation semantics, ProblemDetails contracts, roles, permissions and access scope.
- Frontend must not duplicate CRM domain rules while removing explanatory role/access text.
- Do not remove primary actions, filters, lists, tables, forms, useful detail data or core page content.
- Do not hide raw audit details, object IDs or JSON panels in audit/details areas as part of this task.
- Mantine and Onest must be preserved.
- Significant layout movement must be checked on desktop and mobile/tablet.
- Project code changes start only after the correct task branch is active.

## Out of scope
- Backend changes.
- Bot changes.
- Raw audit data cleanup.
- ProblemDetails/validation presentation changes.
- Role, permission or access-scope changes.
- Redesigning navigation or the whole CRM visual system.
- Reworking tables/cards unrelated to removed top intro/hero areas.
- Replacing audit JSON with human-readable diffs.

## Required test coverage

### Unit tests
No new unit tests are required by default because this is primarily route-level presentation cleanup without business logic changes.

Update unit/component tests only if:
- `PageHeader`, `UserManagementHero`, `ClientHero` or another shared/pseudo-shared UI component changes;
- existing tests assert removed badge/description copy;
- a small helper is introduced to detect or render compact page headings.

### Integration tests
No backend or API integration tests are required because backend contracts and frontend API calls should remain unchanged.

Frontend integration is protected by TypeScript compile, existing feature tests and e2e route coverage.

### UI tests
Add/update Playwright coverage for:
- `/schedule`, `/attendance`, `/groups`, `/users`, `/audit`, `/finance`, `/settings`, `/clients` and client create/edit/detail routes where practical with existing mocks;
- absence of `.page-header-card` or equivalent top service hero on affected screens;
- absence of the removed service labels in intro areas: `Главный тренер и администратор`, `Только для главного тренера`, `Любая доступная группа`, `Показано ... из ...`;
- presence of primary work controls after cleanup: create, refresh, back, filters, tabs, lists/tables/forms;
- desktop and mobile/tablet layout sanity, including no top blank gap and no overlapping content.

### Regression priority
Medium. The task is low risk for business logic but broad across route-level UI, so automated route smoke coverage is needed to prevent removed intros from returning and to protect primary actions.

### Minimum expectation
- Existing tests that reference removed text must be updated.
- At least one automated Playwright route-level regression should guard the new "no top service intro" rule across main screens.
- Manual QA must cover the screenshot examples and any additional screens discovered in inventory.

## Test plan
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:e2e -- responsive-main-screens.spec.ts`
- [ ] Run affected route-specific Playwright specs if edited screens already have coverage: `group-schedule`, `attendance`, `finance-reports`, `users`.
- [ ] Manually inspect desktop routes: Расписание, Посещения, Группы, Тренеры/Пользователи, Журнал, Финансы, Настройки, Клиенты create/edit/detail.
- [ ] Manually inspect mobile/tablet layouts for the same affected screens.

## Regression barrier
Primary barrier: Playwright route smoke test that visits the main CRM screens and fails if top service hero/intro blocks or forbidden service labels are visible again.

Secondary barrier: `npm run lint` and `npm run build` catch removed imports, unused resources and broken TypeScript after deleting hero components.

Manual barrier: desktop and mobile/tablet visual pass verifies spacing, action placement and absence of overlap after the top cards are removed.

## Risks
- Removing a hero block can accidentally remove create/refresh/back/edit actions that were nested inside it.
- Removing descriptions can leave a screen without a clear short title or with awkward top spacing.
- CSS for `.page-header-card*` may still be used by multiple local components; deleting styles too early can create regressions.
- Playwright route mocks may not cover every role or nested detail route where hero blocks exist.
- Some badges inside actual content are legitimate status indicators and should not be removed just because they use the same `Badge` component.

## Stop conditions
Остановиться и не писать код, если:
- обнаружится, что acceptance criteria требуют изменения backend audit/ProblemDetails/permissions contracts;
- невозможно сохранить primary actions after removing an intro without product clarification;
- scope expands into broad redesign of route layouts, navigation or data presentation outside top intro/hero areas;
- tests reveal that required routes cannot be opened with existing mocks and no bounded test strategy can be added;
- current branch is not `feature/TASK-044-hide-technical-information` before project code edits.

Do NOT stop only because the same UI pattern appears across shared CRM screens; this task is explicitly cross-screen frontend cleanup.

## Ready for Codex execution
yes
