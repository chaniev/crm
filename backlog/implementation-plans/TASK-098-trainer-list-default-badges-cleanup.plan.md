# Implementation Plan: TASK-098 Убрать обычные статусные метки из списка тренеров

## Source task
/backlog/implementation/TASK-098-trainer-list-default-badges-cleanup.md

## Implementation branch
fix/TASK-098-trainer-list-default-badges-cleanup

Branch rules:
- перед кодом использовать `.agents/skills/task-worktree/SKILL.md` и отдельный
  worktree от актуального `origin/main`;
- подтвердить clean status и active branch;
- выполнять после merged TASK-096 и использовать её locator/toolbar/list-state
  baseline;
- не менять backend `/users`, search semantics, create/edit forms или allowed
  actions.

## Goal
Обычная строка активного Coach показывает identity и доступное действие без
меток `Тренер`, `Активен` и `Пароль актуален`, а исключительные состояния
остаются заметными и текстовыми.

## Current understanding
- `UsersListScreen` сейчас безусловно рендерит role badge, active/disabled
  badge и password-rotation/password-actual badge для каждой строки.
- Backend list item уже содержит `role`, `isActive`, `mustChangePassword` и
  `allowedActions`; задача меняет только presentation этих известных данных.
- `canEditUser` уже опирается на backend `allowedActions`; `Только просмотр`
  остаётся отдельным decision-changing marker.
- Backend-permitted list может содержать non-Coach exceptional item. Его role
  marker нельзя скрывать как default Coach label.
- После TASK-096 list будет иметь search/return-state behavior; badge cleanup
  не должна менять query, ordering или action visibility.

## UX/UI contract
- Default Coach + active + current password: видимых status/role badges нет.
- `isActive=false`: одна явная текстовая метка `Отключен`.
- `mustChangePassword=true`: одна метка `Требуется смена пароля`.
- Нет mutation action: `Только просмотр` остаётся возле action area.
- `role !== Coach`: сохранить role marker, потому что это исключение в
  trainer-only list и оно может изменить решение пользователя.
- ФИО, логин, optional Telegram ID и edit/read-only action сохраняются.
- При отсутствии inline badges не остаётся пустого badge container/gap.
- Статусы не передаются только цветом; доступные имена действий сохраняются.

## Dependencies and execution order
1. TASK-093/TASK-094 — shared toolbar baseline через dependency TASK-096.
2. TASK-096 должна быть merged, потому что меняет `UsersListScreen`,
   component tests, App route state и users Playwright.
3. TASK-098 выполняется как локальная row-hierarchy correction поверх merged
   search flow.

## Execution steps
1. Создать isolated worktree и проверить итоговую структуру trainer row после
   TASK-096, включая long-content и filtered-empty states.
2. До production-кода добавить component fixtures для:
   - normal active Coach/current password;
   - inactive Coach;
   - password-rotation Coach;
   - inactive + password-rotation combination;
   - read-only item;
   - backend-permitted non-Coach exceptional item.
3. До production-кода закрепить negative/positive assertions внутри конкретной
   row card:
   - default labels отсутствуют;
   - exception labels имеют точное количество;
   - fullName/login/Telegram/edit или read-only action остаются.
4. До production-кода добавить integration case с TASK-096 search:
   filtered normal и exceptional rows сохраняют одинаковый badge contract,
   clear/refresh/edit-back не меняют semantics.
5. До production-кода обновить users Playwright:
   - API fixture с normal/inactive/password/read-only/non-Coach items;
   - отсутствие трёх default labels только внутри normal row;
   - сохранение exception labels/actions;
   - длинные ФИО/логины/Telegram ID не перекрывают action.
6. Запустить новые tests и подтвердить ожидаемое падение: current normal row
   рендерит все три default badges.
7. Сформировать row presentation из явных исключений: Coach role, active
   status и current-password status не добавляются в badge collection;
   non-Coach, disabled и password-rotation добавляются независимо.
8. Не выводить edit permission из role/status; оставить существующий
   `canEditUser` и `Только просмотр` без изменений.
9. Удалить empty wrapper/spacing и только действительно неиспользуемые local
   imports/constants. Shared labels/resources удалять лишь при repository-wide
   zero-consumer proof.
10. Запустить focused tests, full frontend unit/raw-color/lint/build, affected
    responsive Playwright и target iPhone WebKit suites.

## Preferred implementation strategy
1. Row-state truth table in tests.
2. Red negative assertions.
3. Small explicit exception-badge projection.
4. Preserve backend-owned actions and search state.
5. Responsive regression closure.

## Files likely to change
- `frontend/src/features/users/UsersListScreen.tsx`
- `frontend/src/features/users/UserManagement.test.tsx`
- `frontend/src/features/users/UserManagement.constants.ts` only if merged code
  leaves a proven unused local role mapping path
- `frontend/src/lib/resources.ts` only for repository-wide dead labels
- `frontend/e2e/users.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`
- `frontend/e2e/iphone-target-devices.spec.ts`, if it owns merged trainer
  target-device checks
- `frontend/src/App.css` only if a row-specific empty badge spacing rule exists

## Constraints
- Frontend does not infer permissions or filter backend-permitted entities.
- Non-Coach exception role remains visible.
- Disabled/password-rotation/read-only states remain explicit text.
- Identity and action do not clip or cause horizontal page scroll.
- No backend/API/type changes and no card/search redesign.
- Mantine, Onest and merged TASK-096 structure remain authoritative.

## Out of scope
- Trainer search and return state from TASK-096.
- Create/edit forms.
- Backend roles, user list response and allowed actions.
- Removing exception badges or replacing text with icon/color only.
- General badge cleanup outside trainer list.

## Required test coverage

### Unit/component tests
- Truth table for normal, inactive, password-rotation, combined, read-only and
  non-Coach rows.
- Exact absence of default labels scoped to the normal row.
- Identity/Telegram/edit and read-only behavior preserved.
- No empty badge wrapper in the normal row.

### Integration tests
- `UsersListScreen` component integration with mocked backend response and
  merged TASK-096 search/refresh/edit-back state.
- Backend integration tests неприменимы: endpoint contract, authorization and
  data semantics do not change.
- Component/integration tests are written first and must fail on the current
  unconditional badges.

### UI/e2e tests
- Normal and exceptional rows under real route composition.
- Search→row→edit/back and refresh do not restore default badges.
- Long identity content, action reachability and no overflow at `360 x 780`,
  `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420`, `956 x 440`,
  `768 x 1024` and `1440 x 1200`.

## Expected initial failure verification
- Normal-row component and Playwright assertions must fail on `Тренер`,
  `Активен` and `Пароль актуален`.
- Exception-preservation tests may already pass and act as a guard against
  over-deletion.
- Failure must be scoped within the row card so navigation/form text with
  `Тренер` does not create false positives.

## Test plan
- [ ] Написать component truth-table tests до production-кода.
- [ ] Написать users Playwright absence/exception checks до production-кода.
- [ ] Подтвердить expected red state на normal row.
- [ ] `cd frontend && npm run test:unit`
- [ ] `cd frontend && npm run check:raw-colors`
- [ ] `cd frontend && npm run test:e2e -- e2e/users.spec.ts e2e/responsive-main-screens.spec.ts`
- [ ] `cd frontend && npm run test:e2e:iphone`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`

## Regression barrier
Одна executable row-state matrix должна одновременно запрещать три
default-positive badges и требовать disabled, password-rotation, read-only и
non-Coach exception markers. Route-level Playwright с search/edit-back и long
content защищает от возврата визуального шума, permission regression и
responsive clipping.

## Risks
- Глобальный text query `Тренер` может совпасть с navigation, ФИО или title.
- Скрытие всех role badges скроет редкий backend-permitted non-Coach target.
- Условный badge wrapper может оставить пустую высоту/gap.
- Одновременная работа до merge TASK-096 приведёт к конфликтам в row и tests.

## Stop conditions
Остановиться, если:
- merged TASK-096 row/action contract ещё не определён;
- backend-permitted exceptional role нельзя отличить по существующему `role`;
- изменение требует новой permission/status semantics;
- удаление текста делает exception state различимым только по цвету;
- task worktree/branch невалиден.

## Ready for Codex execution
yes, after TASK-096 is merged into origin/main
