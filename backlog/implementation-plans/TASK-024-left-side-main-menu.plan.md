# Implementation Plan: TASK-024 Перенести главное меню в левую навигацию

## Source task
/backlog/implementation/TASK-024-left-side-main-menu.md

## Goal
Главное меню CRM отображается слева на desktop, сохраняет понятный active state и не ухудшает мобильную навигацию.

## Current understanding
Сейчас shell собран в `frontend/src/App.tsx` через `AppLayout`, `Header` и `NavigationTabs`. `AppLayout` использует Mantine `AppShell` только с header, а `NavigationTabs` рендерит горизонтальную навигацию внутри header. Доступность пунктов уже определяется `getAccessibleNavigationSections(user)`, поэтому реализация должна перенести только представление меню, не меняя permission logic.

## Execution steps
1. Перед кодингом сделать короткий UI checkpoint по desktop/mobile поведению, потому что задача меняет основной app shell.
2. Изменить `AppLayout`, чтобы он поддерживал левую desktop-навигацию через Mantine `AppShell.Navbar` или локальный эквивалент в существующем стиле.
3. Перенести `NavigationTabs` из header в левую навигацию на desktop, сохранив `aria-label`, `aria-current`, порядок секций и `getAccessibleNavigationSections(user)`.
4. Оставить удобное mobile behavior: горизонтальная компактная навигация в header или другой существующий mobile-friendly вариант без перекрытия контента.
5. Обновить CSS для left nav, main offset, active state, overflow и узких экранов без смены информационной архитектуры.
6. Обновить unit/e2e ожидания, которые сейчас ищут навигацию в header или проверяют прежнюю горизонтальную компоновку.
7. Проверить основные маршруты на desktop и mobile.

## Files likely to change
- frontend/src/App.tsx
- frontend/src/App.css
- frontend/src/features/shared/AppLayout.tsx
- frontend/src/features/shared/Header.tsx
- frontend/src/features/shared/NavigationTabs.tsx
- frontend/src/features/shared/ux.test.tsx
- frontend/e2e/home-dashboard.spec.ts
- frontend/e2e/responsive-main-screens.spec.ts
- frontend/e2e/stage12.spec.ts

## Constraints
- Не менять `APP_NAVIGATION_SECTIONS`, route ids, backend contracts или permission visibility logic.
- Не дублировать permission rules во frontend вне существующего `getAccessibleNavigationSections`.
- Сохранить Mantine и текущий визуальный язык приложения.
- Не ломать доступность: у навигации остается role `navigation`, понятный label и active state.

## Out of scope
- Изменение информационной архитектуры разделов.
- Изменение ролей, permissions и доступности пунктов меню.
- Полный redesign приложения.

## Test plan
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Запустить или обновить затронутые frontend unit tests для shared shell.
- [ ] Запустить affected Playwright checks для home/responsive navigation.
- [ ] Вручную проверить основные маршруты на desktop и mobile.

## Regression barrier
Обновленный shared shell test плюс responsive Playwright-сценарий должны фиксировать, что навигация видима, active route отмечен через `aria-current`, а на mobile нет горизонтального скролла/перекрытия контента.

## Risks
- Mantine `AppShell` offsets могут изменить высоту/ширину рабочей области и вызвать regressions в плотных CRM-экранах.
- Mobile navigation может стать хуже, если просто спрятать левую панель без замены.
- Старые e2e ожидания могут быть завязаны на то, что навигация находится внутри header.

## Stop conditions
Остановиться и не писать код, если:
- найдено расхождение с архитектурой;
- задача требует изменения БД;
- задача требует изменения auth/roles/permissions;
- scope стал больше исходной задачи;
- acceptance criteria невозможно выполнить без уточнений.

## Ready for Codex execution
yes
