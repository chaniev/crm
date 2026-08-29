# Implementation Plan: TASK-163 «Внимание» — плотность списка и actions в карточке

## Metadata
- source_task: /backlog/implementation/TASK-163-attention-density.md
- requirements: REQ-ATTN-001 (constrains), REQ-NFR-001 (constrains)
- branch: feature/TASK-163-attention-density
- readiness: yes
- dependencies: TASK-160 — карточки потребляют его list-row surface-токены; до интеграции допускаются локальные значения, совпадающие с будущими токенами
- risk: medium — перекомпоновка рабочего раздела при полном сохранении backend-контракта данных и операций

## Goal
На `420 x 912` до первой карточки не более двух управляющих строк и минимум 5 полностью видимых карточек клиентов; на `390 x 844` — минимум 4; ровно одна доминантная кнопка в карточке, остальные действия за одним меню без обрезанных подписей.

## Decisions and contracts
- Убираются отдельная строка подзаголовка и строка сводок; счётчики («Всего», «Просрочен») переносятся в локатор/строку состояния списка (`EntityLocatorBar`/`ListRangeStatus`) без потери смысла и доступных имён.
- Карточки → list-row surface (TASK-160): компактная строка ~90–110px, тон/бордер, радиус ≤ 16px; состав данных REQ-ATTN-001 (ФИО, телефон, статус абонемента, комментарий, Telegram, причины) сохраняется полностью.
- Действия: одна видимая основная (контакт vs «Связались» — выбирается rendered-сравнением в задаче, решение фиксируется) + остальные за одной иконкой-меню с доступными именами; семантика «Связались» REQ-ATTN-001 не меняется; ни одна операция не теряется.
- Backend остаётся источником данных/состояний; новые причины/статусы/действия/фильтры не вводятся.
- Все цели ≥ 44×44px с интервалами ≥ 8px; карточка остаётся keyboard-operable; filter/status surface и фокус-возврат сохраняются.

## Scope
### In
- Перекомпоновка заголовочной зоны и карточек `AttentionDashboard`, action-hierarchy, обновление regression-покрытия.

### Out
- Backend-расчёт причин/статусов, «Связались»-семантика; новые действия/фильтры; detail клиента и чат.

## Implementation slices
1. RED: component-тесты новой иерархии (состав полей, счётчики в разрешённых строках, одна доминантная кнопка + меню) и geometry-ассерты (≥5 карточек на `420 x 912`) — падают на текущей компоновке.
2. Свести заголовочную зону к двум строкам: локатор + строка диапазона/статуса со счётчиками.
3. Перевести карточки на list-row surface с сохранением всех данных REQ-ATTN-001; выбрать и реализовать action-hierarchy (одна доминантная + меню); длинные значения переносятся/обрезаются с доступом к полному тексту.
4. Browser RED→green: attention-флоу (действия, меню, «Связались») на Chromium и target-iPhone; geometry на 360/390/420/440; состояния loading/empty/error/retry.

## Likely files and layers
- `frontend/src/features/attention/AttentionDashboard.tsx` — заголовочная зона, карточки, actions.
- `frontend/src/features/attention/AttentionPanel.tsx` — если владеет выводом сводок/статуса.
- `frontend/src/features/attention/AttentionDashboard.test.tsx` — component coverage.
- `frontend/src/features/shared/EntityLocatorBar.tsx`, `ListRangeStatus.tsx` — переиспользование (без изменения контрактов).
- `frontend/e2e/attention-dashboard.spec.ts` — browser coverage.

## Regression specification
### Automated tests to add or update
- Component: все поля REQ-ATTN-001 присутствуют; счётчики доступны (accessible names) не отдельной строкой; ровно одна доминантная кнопка; все операции достижимы через меню; длинные значения не вытесняют действия; keyboard-operable карточка; loading/empty/error/retry сохранены.
- Playwright geometry: ≥5 карточек на `420 x 912`, ≥4 на `390 x 844`; ≤2 управляющих строки до первой карточки; отсутствие overflow на 360–440.
- Флоу: «Связались» и операции из меню работают; filter/status surface и focus return.

### Expected red evidence
- Geometry (сейчас 3 клиента на экран при карточках ~140–150px) и hierarchy-ассерты (сейчас три равнозначные кнопки в ряд) падают до перекомпоновки.

### Required validation
- Root verification harness для frontend diff; `npm run test:e2e:iphone` attention specs.

### Manual evidence
- Rendered-сравнение вариантов главной кнопки (контакт vs «Связались») на `390/420` — фиксация решения в задаче.

### Regression barrier
- Один attention-сценарий на target-iPhone: ≥5 карточек, все данные REQ-ATTN-001, все операции достижимы, «Связались» сохраняет семантику.

## Risks and stop conditions
- Если на `360px` счётчики не помещаются в две разрешённые строки без потери смысла — стоп и фиксация; не удалять счётчики.
- Если меню скрывает операцию так, что её нельзя найти одним нажатием — переоценить состав меню; не терять операции.
- Stop при необходимости изменить backend-состав данных карточки.
