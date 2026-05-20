# Implementation Plan: TASK-047 Вертикальное левое меню на мобильном экране

## Source task
/backlog/implementation/TASK-047-mobile-left-side-menu.md

## Implementation branch
feature/TASK-047-mobile-left-side-menu

Branch rules:
- create this branch before writing project code;
- create it from updated `main`;
- run `git pull` and verify clean `git status` before branch creation;
- if the branch already exists, verify that it belongs only to `TASK-047`;
- do not implement unrelated visual cleanup or navigation redesign in this branch;
- confirm the branch is active before making frontend changes.

## Goal
На мобильном viewport основная навигация CRM должна быть вертикальной и располагаться слева, при этом список доступных разделов, active state и логика видимости пунктов остаются прежними.

## Current understanding
- Это frontend-only layout-задача в app shell.
- Сейчас `AuthenticatedShell` в `frontend/src/App.tsx` рендерит две навигации: `mobileNavigation` внутри `Header` как горизонтальный `NavigationTabs`, и `desktopNavigation` в `AppShell.Navbar` как вертикальный `NavigationTabs`.
- `AppLayout` в `frontend/src/features/shared/AppLayout.tsx` по умолчанию скрывает navbar на mobile через `collapsed: { mobile: true }`, а breakpoint установлен на `lg`.
- Стили навигации находятся в `frontend/src/App.css`: `.app-shell__navigation--horizontal`, `.app-shell__navigation--vertical`, `.app-shell__mobile-nav`, `.app-shell__navbar-inner`.
- Доступность пунктов уже централизована в `getAccessibleNavigationSections(user)`. Реализация не должна менять permissions, роли или backend contracts.
- E2E уже проверяют mobile navigation как `nav.app-shell__mobile-nav[...]`; эти ожидания нужно обновить под новую левую вертикальную mobile-навигацию.
- Задача связана с `TASK-024`, поэтому desktop-left-nav поведение надо сохранить и не переписать заново.

## Execution steps
1. Подготовить ветку: перейти на `main`, выполнить `git pull`, проверить чистый `git status`, создать или проверить `feature/TASK-047-mobile-left-side-menu`.
2. Перед кодом сделать короткий `ui-designer` checkpoint по mobile shell: определить точную mobile-ширину левого меню, поведение длинных русских labels и границу, где меню становится полным desktop-вариантом.
3. Аудировать текущий shell в `frontend/src/App.tsx`, `AppLayout`, `Header`, `NavigationTabs` и CSS: подтвердить, какие элементы сейчас создают mobile header navigation, navbar collapse и main offset.
4. Свести основную навигацию к одному источнику данных: оставить `sections={navigationSections}`, `currentSection`, `onNavigate` и `aria-current` без изменений; не добавлять новых role/permission checks.
5. Перенести mobile-представление из header в левую вертикальную область: убрать горизонтальную `mobileNavigation` из `Header` для authenticated shell и сделать navbar доступным на mobile.
6. Настроить responsive navbar: использовать существующий `AppShell.Navbar` там, где он корректно offset-ит main area; если Mantine mobile navbar ведет себя как overlay, добавить локальный layout/CSS offset для header/main так, чтобы меню не перекрывало контент.
7. Подобрать mobile width без page-level horizontal scroll: ориентир - компактная левая rail-навигация на phone и текущая ширина `232px` на large desktop; labels должны быть видимыми или доступными через `aria-label`, не ломать высоту и не вызывать горизонтальный scroll.
8. Обновить CSS для `.app-shell__navbar-inner`, `.app-shell__side-nav`, mobile/tablet breakpoints и кнопок в vertical navigation: overflow-y при большом числе пунктов, отсутствие overflow-x, стабильные размеры icon/text кнопок, корректный active state.
9. Упростить или удалить устаревшие `.app-shell__mobile-nav` стили только после обновления тестов и проверки, что селекторы больше не нужны.
10. Обновить shared unit tests, если изменятся контракты `AppLayout`, `Header` или `NavigationTabs`.
11. Обновить Playwright responsive/navigation specs: mobile должен искать левую вертикальную navigation, проверять `data-orientation="vertical"`, active route и отсутствие page-level horizontal scroll.
12. Пройти ключевые маршруты для administrator/head coach/coach sessions на 390px, 768px и desktop width; убедиться, что profile controls, header и основной контент не пересекаются с меню.
13. Запустить required frontend validation commands.

## Preferred implementation strategy
1. Reuse existing `NavigationTabs` and `getAccessibleNavigationSections(user)`.
2. Prefer one persistent navbar implementation across breakpoints over keeping two independent navigation variants.
3. Use CSS/responsive AppShell configuration for layout changes instead of duplicating route/domain logic.
4. Keep the phone rail compact but accessible; expand labels/width progressively on larger viewports.
5. Protect the change with Playwright responsive tests before relying on manual QA.

Avoid:
- changing `APP_NAVIGATION_SECTIONS`, route ids, backend contracts or permission visibility rules;
- introducing frontend-only CRM domain rules;
- redesigning the whole app shell beyond mobile left vertical navigation;
- hiding navigation items just to make the rail fit;
- allowing navbar/header/main overlap or horizontal page scroll.

## Files likely to change
- `frontend/src/App.tsx`
- `frontend/src/App.css`
- `frontend/src/features/shared/AppLayout.tsx`
- `frontend/src/features/shared/Header.tsx`
- `frontend/src/features/shared/NavigationTabs.tsx`
- `frontend/src/features/shared/ux.test.tsx`
- `frontend/e2e/responsive-main-screens.spec.ts`
- `frontend/e2e/home-dashboard.spec.ts`
- `frontend/e2e/attendance.spec.ts`
- `frontend/e2e/stage12.spec.ts`
- affected route e2e specs that assert old mobile navigation selectors

## Constraints
- Preserve Mantine and Onest.
- Frontend must not duplicate backend-owned CRM rules: roles, permissions, access scope, validation semantics or audit semantics.
- Preserve current navigation section availability from `getAccessibleNavigationSections(user)`.
- Preserve `aria-label="Основная навигация"` and active state through `aria-current="page"`.
- Do not regress desktop left navigation introduced by `TASK-024`.
- Do not introduce uncontrolled horizontal scroll on mobile, tablet or desktop.
- Keep implementation local to authenticated app shell and related tests.

## Out of scope
- Backend contract changes.
- Role, permission or visibility rule changes.
- Changing the set, order or labels of main menu sections.
- Full redesign of the app shell, dashboard or route screens.
- Bot changes.
- New navigation destinations or routing behavior.

## Required test coverage

### Unit tests
Add or update unit tests if implementation changes component contracts:
- `AppLayout` renders navbar on mobile-capable configuration;
- `Header` no longer requires embedded navigation for authenticated shell;
- `NavigationTabs` still renders configured sections, vertical orientation and active tab/page state.

Pure CSS-only responsive changes do not need new unit tests unless a component abstraction is introduced.

### Integration tests
No backend integration tests are expected. If implementation reveals a required backend/domain contract change, stop and create a separate task.

Frontend integration is protected by TypeScript build and route-level e2e mocks.

### UI tests
Update Playwright coverage:
- mobile 390px shows the main navigation at the left and vertical;
- tablet width keeps the intended left navigation behavior without overlap or horizontal scroll;
- desktop left navigation remains visible and active;
- administrator/head coach session keeps all granted sections visible;
- coach session keeps only allowed sections visible and active route works;
- major routes keep no page-level horizontal scroll.

### Regression priority
Medium. The change is localized to frontend shell, but shell regressions affect every authenticated route.

### Minimum expectation
- `npm run lint` and `npm run build` pass.
- Affected Playwright responsive/navigation tests pass.
- Automated coverage verifies orientation/placement enough to catch a return to horizontal mobile header navigation.
- Manual viewport review supplements automated checks for overlap and text fit.

## Test plan
- [ ] `cd frontend && npm run test:unit`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:e2e -- responsive-main-screens.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- home-dashboard.spec.ts`
- [ ] `cd frontend && npm run test:e2e -- attendance.spec.ts`
- [ ] Run `stage12.spec.ts` or update it if its navigation assertions are part of the current regression suite.
- [ ] Manually verify authenticated routes at 390x844, 768x1024 and 1440x1200 for overlap, active state, visible sections and horizontal scroll.

## Regression barrier
Primary barrier: `frontend/e2e/responsive-main-screens.spec.ts` should assert that mobile/tablet/desktop routes expose the active main navigation, that phone navigation is vertical/left-positioned, and that `document.documentElement.scrollWidth` does not exceed viewport width.

Secondary barrier: `home-dashboard.spec.ts` and `attendance.spec.ts` should update old mobile-header-navigation expectations and verify active state plus role-scoped visible sections after login.

Tertiary barrier: shared UX unit tests protect `NavigationTabs` orientation and active-state rendering if component contracts are touched.

## Risks
- Mantine `AppShell.Navbar` mobile behavior may render as overlay instead of reserving layout space, which would violate the no-overlap criterion.
- A full-width desktop sidebar on a phone would leave too little content space, while an icon-only rail could reduce discoverability.
- Existing e2e selectors are tied to `.app-shell__mobile-nav` and may need coordinated updates.
- Global shell CSS can accidentally affect dense screens such as schedule, clients and finance.
- Hiding labels or truncating Russian section names poorly can make navigation unclear.

## Stop conditions
Остановиться и не писать код, если:
- задача требует изменения backend contracts, roles, permissions or access-scope semantics;
- mobile-left-nav cannot satisfy no-overlap/no-horizontal-scroll without a broader app shell redesign;
- `ui-designer` checkpoint identifies a conflicting mobile navigation pattern that changes information architecture;
- implementation requires hiding granted navigation sections;
- scope expands into unrelated visual unification or route redesign;
- acceptance criteria cannot be met without clarification.

## Ready for Codex execution
yes
