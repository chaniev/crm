# Implementation Plan: TASK-099 Удалить колонку «Действие» из списка журнала

## Source task
/backlog/implementation/TASK-099-audit-log-remove-action-column.md

## Implementation branch
fix/TASK-099-audit-log-remove-action-column

Branch rules:
- перед кодом использовать `.agents/skills/task-worktree/SKILL.md` и отдельный
  worktree от актуального `origin/main`;
- подтвердить clean status, active branch и base;
- не удалять `actionType` из API/types/filter/details modal;
- не включать unrelated audit filters, pagination, permissions или backend
  semantics.

## Goal
Убрать отдельное отображение action type из audit list rows и отдать ширину
описанию/автору, сохранив фильтр, подробности и доступность журнала.

## Current understanding
- `AuditLogScreen` рендерит пять semantic columns: дата, действие, описание,
  пользователь и детали.
- `AuditLogGridRow` отдельно рендерит action cell с mobile label `Действие`.
- `actionType` также нужен для primary filter, API query и badge в details
  modal; эти consumers сохраняются.
- `App.css` после TASK-057 всё ещё задаёт шесть desktop grid tracks при пяти
  DOM columns и содержит responsive grid areas `action`/`source`, хотя
  отдельной source cell в row нет. TASK-099 должна привести geometry к
  фактическим четырём list columns, а не просто скрыть текст.
- Existing component/Stage12 tests закрепляют удаление `Объект`, description,
  actor и details, но не отсутствие `Действие` и не exact column count.

## UX/UI contract
- List header/rows содержат только: дата/время, описание, пользователь, детали.
- На mobile нет label/value `Действие`; action type остаётся доступен в фильтре
  и после открытия details modal.
- Desktop semantic row имеет четыре columnheaders/cells и четыре matching grid
  tracks.
- Mobile/tablet layout использует только существующие areas `date`,
  `description`, `actor`, `details`; orphan `action`/`source` areas удаляются.
- Description получает основную свободную ширину, details остаётся reachable
  `44 x 44px`, long actor/description wrap без page overflow.
- Закрытие details modal возвращает focus на тот же row trigger.
- Loading, empty, error, permission-restricted, filter and pagination states не
  меняются.

## Dependencies and execution order
1. TASK-057 — done; её отсутствие `Объект` остаётся regression contract.
2. TASK-094 желательно merged, если она меняет shared audit filter surface.
3. TASK-099 изменяет только list projection/CSS и тесты поверх итогового filter
   baseline.

## Execution steps
1. Создать isolated worktree и зафиксировать текущий DOM/CSS column inventory,
   включая mismatch `5 DOM columns ↔ 6 CSS tracks`.
2. До production-кода расширить `AuditLogScreen` component test:
   - exact header count равен четырём;
   - exact row cell count равен четырём;
   - header/cell/mobile label `Действие` и formatted action value отсутствуют
     внутри grid;
   - date, description, actor and details action видимы.
3. До production-кода добавить component integration для action-type filter:
   выбор stable option отправляет прежний `actionType` в `getAuditLogEntries`,
   хотя list column отсутствует.
4. До production-кода расширить modal/focus test:
   details показывает formatted action type и diagnostic values;
   close/Escape возвращает focus на row details trigger.
5. До production-кода обновить Stage12/Playwright:
   - отсутствуют `Объект` и `Действие` в list;
   - filter по action type продолжает сужать request;
   - details modal сохраняет action type;
   - long description/actor and button geometry do not overflow.
6. Запустить tests и подтвердить expected failures на существующем action
   header/cell и exact column count.
7. Удалить только action header и `audit-log-cell--action` из row; сохранить
   `entry.actionType` и `formatActionType` для options/modal.
8. Переписать desktop `grid-template-columns` на четыре фактические колонки,
   отдав flexible track описанию. Удалить orphan responsive areas/selectors и
   задать mobile order date/details → description → actor.
9. Не добавлять отдельную source cell; source/messenger остаются diagnostic
   badges в details согласно текущему контракту.
10. Обновить старые assertions/fixtures без удаления `actionType` payload.
11. Запустить focused tests, full frontend unit/raw-color/lint/build, audit and
    responsive Playwright, target iPhone WebKit/compact-height checks.

## Preferred implementation strategy
1. Semantic/geometry inventory.
2. Red exact-column + filter/modal tests.
3. Minimal JSX projection removal.
4. Four-column CSS rewrite.
5. Responsive/focus regression closure.

## Files likely to change
- `frontend/src/features/audit/AuditLogScreen.tsx`
- `frontend/src/features/audit/AuditLogScreen.test.tsx`
- `frontend/src/App.css`
- `frontend/e2e/stage12.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`
- `frontend/e2e/iphone-target-devices.spec.ts`, если он владеет итоговой
  target-device матрицей audit

## Constraints
- `actionType` остаётся в API types, request query и details modal.
- Filter, pagination, permissions и backend audit semantics не меняются.
- Table roles/column counts соответствуют DOM и CSS.
- Details trigger остаётся keyboard/touch accessible и возвращает focus.
- Не скрывать description/actor и не использовать horizontal page scrolling.
- Mantine/Onest/current audit mapping остаются.

## Out of scope
- Backend response/persistence/audit event changes.
- Удаление action-type filter или diagnostic modal badge.
- Новый source column.
- Audit permissions, pagination и filter redesign.
- Изменение словаря action labels.

## Required test coverage

### Unit/component tests
- Four headers/four row cells; no Object/Action list column.
- Date, description, actor and details preserved.
- Loading, empty, error and permission-restricted states preserved.
- Modal retains action type and diagnostic values.

### Integration tests
- Component integration proves action-type selection still reaches
  `getAuditLogEntries` with stable API value.
- Modal open/close/focus-return interaction remains.
- Backend integration tests неприменимы: API/audit semantics do not change.
- Tests are written first and exact-column/absence checks must fail on current
  JSX/CSS contract.

### UI/e2e tests
- Filter → row → details → close primary path.
- No list action column on mobile/tablet/desktop.
- Long description/actor, exact geometry and no page overflow at `360 x 780`,
  `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420`, `956 x 440`,
  `768 x 1024` and `1440 x 1200`.

## Expected initial failure verification
- Component exact-count and `Действие` absence assertions fail on current JSX.
- Browser geometry assertion identifies the extra action/orphan tracks rather
  than a fixture problem.
- Filter/modal preservation tests should remain green and protect against
  over-deletion during implementation.

## Test plan
- [ ] Написать component exact-column/filter/modal tests до production-кода.
- [ ] Обновить audit Playwright absence/geometry checks до production-кода.
- [ ] Подтвердить expected red state на action header/cell.
- [ ] `cd frontend && npm run test:unit`
- [ ] `cd frontend && npm run check:raw-colors`
- [ ] `cd frontend && npm run test:e2e -- e2e/stage12.spec.ts e2e/responsive-main-screens.spec.ts`
- [ ] `cd frontend && npm run test:e2e:iphone`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`

## Regression barrier
Component tests должны одновременно требовать четыре semantic headers/cells,
запрещать list-level `Объект`/`Действие` и сохранять filter request + modal
action type. Responsive Playwright с long content и focus return защищает
четырёхколоночную geometry от пустых tracks, overflow и потери diagnostics.

## Risks
- Удаление общего `formatActionType` сломает filter labels и details modal.
- CSS может оставить невидимую пустую track/area после удаления DOM cell.
- Global query `Действие` совпадает с `Тип действия` filter; assertions нужно
  scope к grid.
- Упрощение mobile areas может изменить порядок details/focus.

## Stop conditions
Остановиться, если:
- action type оказывается единственным источником критической диагностики и
  details modal его не сохраняет;
- final shared filter baseline после TASK-094 неясен;
- корректировка требует backend/API или permission changes;
- DOM semantics и responsive grid нельзя согласовать локально;
- task worktree/branch невалиден.

## Ready for Codex execution
yes
