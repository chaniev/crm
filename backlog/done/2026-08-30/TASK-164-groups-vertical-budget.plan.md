# Implementation Plan: TASK-164 «Группы» — вертикальный бюджет реестра

## Metadata
- source_task: /backlog/done/2026-08-30/TASK-164-groups-vertical-budget.md
- completion: implemented and locally integrated into main on 2026-08-30
- requirements: REQ-GRP-001 (constrains), REQ-NFR-001 (constrains)
- branch: feature/TASK-164-groups-vertical-budget
- readiness: yes
- dependencies: TASK-160 — карточки потребляют его list-row surface-токены; до интеграции допускаются локальные значения, совпадающие с будущими токенами
- risk: low — уплотнение одного реестра с сохранением контрактов данных и существующих тулбар-паттернов

## Goal
На `420 x 912` первая карточка группы начинается не ниже ~180px, видно минимум 5 карточек (на `390` — минимум 4); над списком максимум две строки управления; locator/filter/actions в одной строке на 360–1440px.

## Decisions and contracts
- Строка подзаголовка убирается; счётчики («Всего», «без тренера») встраиваются в строку диапазона/статуса (`ListRangeStatus`) или локатор без потери информации и доступных имён.
- `EntityLocatorBar`-паттерн (locator/filter/actions в одной строке) сохраняется; разрешённые TASK-090 элементы реестра уплотляются, не удаляются.
- Карточки групп → list-row surface (TASK-160): имя группы первый якорь, расписание/зал/филиал — выровненные decision-данные, тренеры компактно; состав данных REQ-GRP-001 сохраняется; длинные названия переносятся.
- `EntityLocatorBar` контракты фокуса/очистки, backend-пагинация/фильтры и desktop-представление не меняются.
- Все цели ≥ 44×44px; без горизонтального скролла на 360–440px.

## Scope
### In
- Заголовочная зона реестра, карточки групп, regression-покрытие (Chromium + iphone projects).

### Out
- Состав полей группы, backend-пагинация/фильтры; desktop-реестр; расписание и detail-карточка группы.

## Implementation slices
1. RED: geometry-ассерты вертикального бюджета (первая карточка ≤ ~180px, ≥5 карточек, ≤2 строки управления) и component-ассерты счётчиков — падают на текущих ~250–300px до контента.
2. Убрать подзаголовок; встроить счётчики в строку диапазона/статуса с доступными именами.
3. Перевести карточки на list-row surface с выравниванием decision-данных и компактными тренерами; сверить сохранность данных REQ-GRP-001.
4. Browser RED→green: groups-registry regression на Chromium и target-iPhone; geometry 360/390/420/440/768/1440; одна строка locator/filter/actions на всём диапазоне.

## Likely files and layers
- `frontend/src/features/groups/GroupsListScreen.tsx` — заголовочная зона, карточки.
- `frontend/src/features/groups/useGroupsListState.ts` — если владеет счётчиками/сводками.
- `frontend/src/features/groups/GroupManagement.test.tsx` / focused list-тест — component coverage.
- `frontend/src/features/shared/ListRangeStatus.tsx`, `EntityLocatorBar.tsx` — переиспользование (без изменения контрактов).
- `frontend/e2e/groups-registry.spec.ts` — browser coverage.

## Regression specification
### Automated tests to add or update
- Component: счётчики присутствуют и доступны вне отдельной строки; данные REQ-GRP-001 в карточке; длинные названия переносятся; контракты фокуса/очистки локатора.
- Playwright geometry: первая карточка ≤ ~180px на `420 x 912`; ≥5 карточек на `420`, ≥4 на `390`; ≤2 управляющих строки; locator/filter/actions одна строка на 360–1440; отсутствие horizontal overflow.
- Groups-registry regression (Chromium + iphone projects) зелёная.

### Expected red evidence
- Вертикальный бюджет-ассерты падают на текущих ~250–300px до первой карточки — RED до уплотнения.

### Required validation
- Root verification harness для frontend diff; `npm run test:e2e:iphone` groups specs.

### Manual evidence
- Rendered before/after сверька с эталонными реестрами («Клиенты» ~108px, «Тренеры» ~150px) на 390/420.

### Regression barrier
- Один groups-registry сценарий на target-iPhone и Chromium: вертикальный бюджет + полнота данных REQ-GRP-001 + одна строка локатора.

## Risks and stop conditions
- Если счётчики не помещаются в разрешённые строки на `360px` без потери информации — стоп и фиксация; не удалять и не сокращать до потери смысла.
- Не удалять разрешённые элементы реестра (TASK-090 acceptance) — только уплотнять; конфликт — стоп.
- Stop при необходимости менять backend-пагинацию или состав полей.
