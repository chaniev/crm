# TASK-089: Устранить horizontal overflow desktop-списка клиентов с preview

## Status
ready

## Priority
P2

## Goal
На desktop пользователь одновременно читает список и preview клиента без горизонтальной прокрутки скрытых колонок и потери значений.

## User role
Суперадминистратор / администратор / главный тренер.

## Problem
На `1440 x 1200` при открытом client preview ширина list scroll container составляет около `774px`, а его content и строки — `918-919px`. Часть заголовков и значений обрезана, а horizontal scroll находится в длинном списке и не является удобным способом сравнения данных.

## Scope
- Desktop split layout списка и client preview.
- Перераспределение ширины колонок и visible fields по приоритету задачи.
- Collapsible/resizable preview или другой implementation-ready способ убрать обязательный horizontal scroll.
- Full values для зрячего пользователя через достаточную ширину, wrap или явный tooltip/detail, а не только screen-reader accessible name.
- Сохранить selection, search, filters и scroll state.
- Для SuperAdministrator сохранить branch context, full name и primary preview action в глобальном multi-branch наборе.

## Out of scope
- Полный redesign client detail.
- Quick actions из `TASK-016`, tabs из `TASK-019`, empty states из `TASK-020`.
- New-client form/photo issue из `TASK-018` и `TASK-021`.
- Horizontal scrolling как default desktop solution.

## Responsive behavior
- `390 x 844`, `420 x 912`, `440 x 956`: остаётся single-column mobile preview/detail path.
- `768 x 1024`: split pane используется только если list сохраняет required decision data; иначе single-column/drill-down.
- `1440 x 1200`: при открытом preview list не имеет скрытого horizontal overflow; primary columns и next action читаемы.
- `912 x 420`, `956 x 440`: touch compact-height не использует тесный desktop split pane.

## Operational and interaction states
- Preview loading не блокирует список.
- Empty selection даёт компактную полезную подсказку без большой пустой панели.
- Preview error содержит retry или `Открыть карточку`.
- Manage-only actions скрыты или объяснены согласно backend/session state.
- Выбор строки обновляет preview без focus trap; закрытие/collapse возвращает focus к выбранному клиенту.

## Acceptance criteria
- [ ] На `1440 x 1200` при открытом preview list container не требует horizontal scroll для primary decision data.
- [ ] Полное имя и критичные значения доступны зрячему и keyboard-пользователю.
- [ ] Primary preview action достижим Tab и не скрыт overflow.
- [ ] Selection, search, filters и list scroll сохраняются при open/collapse preview.
- [ ] Mobile behavior не изменяется, кроме shared corrections из `TASK-084`.
- [ ] SuperAdministrator с `branchId: null` видит branch context и primary decision data без horizontal overflow при открытом preview.

## Test checklist
- [ ] Desktop E2E: выбрать клиента с длинными значениями, проверить list/preview, открыть полную карточку, вернуться.
- [ ] Desktop E2E SuperAdministrator: multi-branch results с длинными client/branch/group values, selection/search/filter/scroll сохраняются.
- [ ] Geometry assertion: list `scrollWidth <= clientWidth` для утверждённого набора primary columns.
- [ ] Проверить `768 x 1024`, `1440 x 1200` и mobile smoke `390 x 844`.
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] Запустить affected client Playwright specs.

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: desktop responsive/layout изменение в сложном client workspace без backend contract changes.

## Related tasks
- `TASK-017`: return-state.
- `TASK-018`, `TASK-019`, `TASK-020`, `TASK-021`: client detail/form work; не дублировать.

## Source notes
- Source: usability audit of the fully rebuilt and seeded local stand.
- Evidence date: 2026-07-25.

## Visual comparison
- [Сейчас / после](../mockups/usability-2026-07-25/TASK-089-comparison.png)
- [Описание преимуществ и границ макета](../mockups/usability-2026-07-25/README.md#task-089-desktop-client-list-and-preview-without-overflow)
