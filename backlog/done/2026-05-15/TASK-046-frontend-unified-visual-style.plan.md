# Implementation Plan: TASK-046 Привести остальные окна CRM к единому визуальному стилю

## Source task
/backlog/implementation/TASK-046-frontend-unified-visual-style.md

## Implementation branch
feature/TASK-046-frontend-unified-visual-style

Branch rules:
- create this branch before writing project code;
- create it from updated `main` after `TASK-045` is merged or otherwise explicitly available on `main`;
- run `git pull` and verify clean `git status` before branch creation;
- if the branch already exists, verify that it belongs only to `TASK-046`;
- do not continue `TASK-045` schedule implementation in this branch;
- confirm the branch is active before making frontend changes.

## Goal
Все основные CRM-разделы выглядят как одна рабочая SaaS-система: единые отступы, типографика, контролы, фильтры, таблицы/списки, карточки, пустые/loading/error states и responsive-поведение, без изменения backend contracts и CRM domain logic.

## Current understanding
- `TASK-046` должен идти после `TASK-045`, потому что расписание задает reusable visual baseline.
- Frontend использует Mantine, Onest, shared-компоненты в `frontend/src/features/shared`, глобальные стили в `frontend/src/App.css` и тему в `frontend/src/theme.ts`.
- Основные экраны расположены в `frontend/src/features/*`: Home, Schedule, Attendance, Clients, Groups, Users/Trainers, Audit, Finance, Settings.
- `TASK-044` уже убрал технические intro/service labels; их нельзя вернуть под видом унификации.
- Задача frontend-only, но затрагивает много route-level surfaces, поэтому риск в визуальных регрессиях и responsive layout.
- Значимое UX-изменение: перед кодом нужен `ui-designer` review результата `TASK-045` и cross-screen application plan.

## Execution steps
1. Подготовить ветку: убедиться, что результат `TASK-045` доступен на `main`, выполнить `git pull`, проверить чистый `git status`, создать или проверить `feature/TASK-046-frontend-unified-visual-style`.
2. Прочитать `TASK-045` implementation notes/handoff: зафиксировать baseline tokens/components/patterns, которые можно распространять на остальные разделы.
3. Провести `ui-designer` review: составить короткую матрицу экранов и паттернов для Home, Schedule, Attendance, Clients, Groups, Trainers/Users, Audit, Finance, Settings.
4. Сделать frontend-аудит текущих route components и CSS classes: page padding, card padding, toolbar gaps, table/list rows, filters, empty/loading/error states, long Russian text, mobile/tablet breakpoints.
5. Выделить минимальный набор нейтральных shared primitives или CSS utilities: page header, filter toolbar, surface/card/list row, compact summary block, table/list header, state panel. Не делать полный design-system rewrite.
6. Согласовать theme/CSS tokens с результатом `TASK-045`: radii, borders, shadows, background bands, control heights, focus/hover states, typography levels. Mantine and Onest остаются.
7. Обновить shared-компоненты в `frontend/src/features/shared`: `PageHeader`, `PageCard`, `MetricCard`, `EmptyState`, `LoadingState`, `ErrorState`, `Button`, `IconButton`, возможно добавить небольшие generic wrappers only if reused by several screens.
8. Применить baseline к route screens небольшими партиями: сначала Home/Attendance, затем Clients/Groups/Trainers, затем Audit/Finance/Settings. После каждой партии проверять responsive constraints.
9. Унифицировать filter/search/toolbars: одинаковые control heights, gaps, wrapping rules, reset/action placement; не менять смыслы фильтров.
10. Унифицировать tables/lists/cards: borders, row heights, header text scale, selected states, hover/focus, empty/loading/error panels; сохранить текущие data-testid и рабочие hooks.
11. Проверить schedule после `TASK-045` только на визуальную совместимость с общей системой; не менять schedule behavior сверх косметической интеграции.
12. Проверить, что нигде не возвращаются technical intro cards, role badges/service labels and duplicate tab headings, удаленные в `TASK-044`.
13. Обновить или добавить focused shared unit tests only for changed shared components/helpers.
14. Расширить Playwright responsive coverage для длинных русских названий, пустых/loading/error states и отсутствия page-level horizontal scroll на основных route screens.
15. После реализации пройти Playwright screenshots на desktop/tablet/mobile для основных экранов и итеративно исправить overlap/truncation.
16. Запустить required validation commands.

## Preferred implementation strategy
1. Depend on completed `TASK-045` baseline.
2. Audit before editing, then update shared primitives first.
3. Apply changes route-by-route in bounded batches.
4. Preserve behavior and tests hooks.
5. Prefer automated responsive/e2e barriers over manual-only visual QA.

Avoid:
- backend contract changes;
- frontend-only CRM domain calculations;
- IA/navigation redesign;
- marketing/landing-page composition;
- broad unrelated refactors while restyling.

## Files likely to change
- `frontend/src/App.css`
- `frontend/src/theme.ts`
- `frontend/src/features/shared/ux.tsx`
- `frontend/src/features/shared/ux.test.tsx`
- `frontend/src/features/shared/Button.tsx`
- `frontend/src/features/shared/IconButton.tsx`
- `frontend/src/features/shared/AppLayout.tsx`
- `frontend/src/features/shared/Header.tsx`
- `frontend/src/features/shared/NavigationTabs.tsx`
- `frontend/src/features/home/HomeDashboard.tsx`
- `frontend/src/features/attendance/AttendanceScreen.tsx`
- `frontend/src/features/clients/ClientManagement.tsx`
- `frontend/src/features/groups/GroupManagement.tsx`
- `frontend/src/features/users/UsersListScreen.tsx`
- `frontend/src/features/users/UserCreateScreen.tsx`
- `frontend/src/features/users/UserEditScreen.tsx`
- `frontend/src/features/audit/AuditLogScreen.tsx`
- `frontend/src/features/finance/FinanceReportsScreen.tsx`
- `frontend/src/features/settings/SettingsScreen.tsx`
- `frontend/src/features/settings/BranchSettingsScreen.tsx`
- `frontend/e2e/responsive-main-screens.spec.ts`
- affected route e2e specs if assertions need updated selectors or visual states

## Constraints
- Backend owns CRM business logic, permissions, access scope, validation semantics and ProblemDetails contracts.
- Frontend changes must stay visual/ergonomic only.
- Do not add frontend-only domain logic for counters/statuses.
- Do not bring back technical intro information removed in `TASK-044`.
- Preserve existing routing, permissions and primary workflows.
- Preserve Mantine and Onest.
- Desktop/tablet/mobile must not have overlapping text or uncontrolled horizontal scroll.
- Shared primitives must remain generic and domain-neutral.

## Out of scope
- Backend contract changes.
- Roles, permissions, access scope or validation changes.
- Information architecture rebuild.
- New business features.
- Schedule behavior beyond compatibility with `TASK-045`.
- Full design-system rewrite or UI-library replacement.
- Marketing heroes, decorative landing sections and promotional copy.
- Bot changes.

## Required test coverage

### Unit tests
Add/update unit tests only where code logic changes:
- shared component rendering states if new wrappers are added;
- responsive/shared UX helper behavior if extracted;
- existing route unit tests when component contracts change.

Do not add unit tests for pure CSS-only changes unless a component abstraction is introduced.

### Integration tests
No backend integration tests are expected. If implementation reveals a required backend/domain contract change, stop and create a separate task.

Frontend integration is protected by TypeScript build and existing API mocks.

### UI tests
Update Playwright coverage:
- all major management routes render stable hooks and primary controls;
- coach routes still render allowed sections;
- no technical intro/service labels return;
- no duplicate tab headings return;
- no page-level horizontal scroll on 390, 768 and 1440 widths;
- long Russian names/labels wrap or truncate professionally;
- empty/loading/error states look consistent where they are easy to trigger with mocks;
- changed route-specific specs still pass.

### Regression priority
High. The task touches many frontend screens and global CSS, so responsive and route smoke tests are mandatory.

### Minimum expectation
- `npm run lint` and `npm run build` pass.
- Playwright responsive smoke passes for all major screens.
- At least one automated barrier protects the global no-horizontal-scroll/no-technical-intro requirements.
- Manual screenshot review supplements automated checks but does not replace them.

## Test plan
- [ ] `cd frontend && npm run test:unit`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:e2e -- responsive-main-screens.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- group-schedule.spec.ts`
- [ ] Run affected route e2e specs when their screens/styles change: attendance, users, finance, home dashboard, audit if present.
- [ ] Capture Playwright screenshots for main screens at mobile/tablet/desktop and review for overlap, unstable wrapping and visual drift from `TASK-045`.

## Regression barrier
Primary barrier: `responsive-main-screens.spec.ts` verifies major routes, primary controls, absence of service intro/duplicate headings and no page-level horizontal scroll across key viewports.

Secondary barrier: route-specific e2e specs ensure visual normalization does not break workflows and stable test hooks.

Tertiary barrier: unit tests cover any new shared UX component behavior introduced during the visual pass.

## Risks
- Starting before `TASK-045` is merged can make the baseline unstable and cause duplicate restyling.
- Global CSS edits can regress screens that were not visually inspected.
- Over-abstracting shared components can become a design-system rewrite.
- Pure visual changes can accidentally change workflow affordances or hide primary actions.
- Long Russian labels and dense tables are easy to break on tablet/mobile widths.

## Stop conditions
Остановиться и не писать код, если:
- `TASK-045` baseline is unavailable or conflicts with current `main`;
- implementation requires backend contracts, CRM rules, permissions or access-scope changes;
- visual unification requires IA/navigation redesign rather than styling/component normalization;
- scope becomes too broad for one branch and needs decomposition by screen families;
- preserving no-horizontal-scroll conflicts with existing information density and requires product UX decisions;
- acceptance criteria cannot be met without clarification.

## Ready for Codex execution
yes, after `TASK-045` result is available on `main`
