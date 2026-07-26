# TASK-089: Устранить horizontal overflow desktop-списка клиентов с preview

## Status
ready

## Priority
P2

## Goal
На desktop пользователь одновременно читает список и preview клиента без горизонтальной прокрутки скрытых колонок и потери значений.

## Shared mobile UI contract

- Normative contract:
  [Единый контракт мобильного интерфейса CRM](../../docs/MOBILE_UI_CONTRACT.md).
- Foundation dependency: `TASK-090`; shared mobile corrections: `TASK-084`.
- Execution dependencies: generic return-state `TASK-017`, then mobile client
  hierarchy/state `TASK-085`, then this desktop split task.
- Эта задача владеет desktop split geometry и client decision columns.
- Theme, typography, state panels, selection и tablet/mobile fallback берутся
  из общего контракта.
- Visual comparison определяет split workflow, но не отдельный desktop style.

## User role
Суперадминистратор / администратор / главный тренер.

## Problem
На `1440 x 1200` при открытом client preview ширина list scroll container составляет около `774px`, а его content и строки — `918-919px`. Часть заголовков и значений обрезана, а horizontal scroll находится в длинном списке и не является удобным способом сравнения данных.

Проблема остаётся после TASK-090: current CSS резервирует preview шириной
`22rem`, оставляет `overflow-x: auto` у списка и задаёт rows/header
`min-width: 46rem`, поэтому foundation tokens и shared states не устраняют
геометрический конфликт.

## Scope
- Desktop split layout списка и client preview.
- На `1440 x 1200` использовать list-primary split:
  `minmax(0, 1fr) clamp(18rem, 24vw, 21rem)` или измеримо эквивалентную
  geometry; preview является secondary pane.
- В preview-open desktop mode убрать `min-width: 46rem` и обязательный
  `overflow-x: auto` у rows/header.
- Approved primary decision columns:
  - client identity: full name, доступный роли phone и branch identity в
    global/multi-branch context;
  - membership/status;
  - group/branch context;
  - last visit и concrete next action.
- Lower-priority values переносятся в preview, secondary row или явное
  keyboard-accessible disclosure; они не исчезают и не доступны только через
  screen-reader name.
- Preview можно collapse/close; default width и восстановление состояния
  детерминированы. Произвольный resizable splitter не требуется.
- При первом desktop входе preview открыт для восстановленного или первого
  selected client с default width из split contract; осознанный collapse
  сохраняется до следующего явного open и при return-state восстановлении.
- Если доступная list width не сохраняет approved columns, preview
  сворачивается в hidden/right drawer или используется drill-down, а list
  остаётся full-width.
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
- `768 x 1024`: split pane используется только если approved columns
  сохраняют читаемость и `scrollWidth <= clientWidth`; иначе
  single-column/drill-down.
- `1440 x 1200`: при открытом preview list не имеет скрытого horizontal overflow; primary columns и next action читаемы.
- `912 x 420`, `956 x 440`: touch compact-height не использует тесный desktop split pane.

## Operational and interaction states
- Preview loading не блокирует список.
- Empty selection даёт компактную полезную подсказку без большой пустой панели.
- Preview error содержит retry или `Открыть карточку`.
- Manage-only actions скрыты или объяснены согласно backend/session state.
- Выбор строки обновляет preview без focus trap; закрытие/collapse возвращает focus к выбранному клиенту.
- Open/collapse/back сохраняют выбранного клиента, search, filters, page,
  preview state и list scroll по `TASK-017`.

## Acceptance criteria
- [ ] На `1440 x 1200` при открытом preview list container не требует horizontal scroll для primary decision data.
- [ ] В preview-open mode list/header имеют `scrollWidth <= clientWidth`; тест
      не ограничивается CSS overflow property.
- [ ] Полное имя, доступный phone, branch/group, membership/status, last visit
      и next action доступны зрячему и keyboard-пользователю через approved
      columns или явное disclosure/preview.
- [ ] Primary preview action достижим Tab и не скрыт overflow.
- [ ] Selection, search, filters и list scroll сохраняются при open/collapse preview.
- [ ] Collapse возвращает focus выбранному row; повторное открытие
      восстанавливает выбранного клиента и deterministic default width.
- [ ] При недостаточной list width preview автоматически использует
      single-column/drawer fallback без horizontal page/list scroll.
- [ ] Mobile behavior не изменяется, кроме shared corrections из `TASK-084`.
- [ ] SuperAdministrator с `branchId: null` видит branch context и primary decision data без horizontal overflow при открытом preview.

## Test checklist
- [ ] Desktop E2E: выбрать клиента с длинными значениями, проверить list/preview, открыть полную карточку, вернуться.
- [ ] Desktop E2E SuperAdministrator: multi-branch results с длинными client/branch/group values, selection/search/filter/scroll сохраняются.
- [ ] Geometry assertion: list `scrollWidth <= clientWidth` для утверждённого набора primary columns.
- [ ] Проверить `768 x 1024`, `1440 x 1200` и mobile smoke `390 x 844`.
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:unit`
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

## Processing notes

- Reviewed at: 2026-07-26 after TASK-090 was merged to `main`.
- Foundation dependency is complete: theme, state and responsive primitives
  no longer block the desktop workflow.
- Revalidated against current CSS: `22rem` preview, `46rem` row/header
  min-width and list `overflow-x: auto` still reproduce the conflict.
- Status remains `ready`: desktop split geometry, approved visible decision
  columns, overflow removal and fallback are now implementation-ready.
  Execution follows `TASK-017` and `TASK-085` to avoid duplicate state/list
  work.
