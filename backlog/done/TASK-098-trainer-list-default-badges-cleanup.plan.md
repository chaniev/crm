# Implementation Plan: TASK-098 Убрать обычные статусные метки из списка тренеров

## Source task
/backlog/done/TASK-098-trainer-list-default-badges-cleanup.md

## Implementation branch
fix/TASK-098-trainer-list-default-badges-cleanup

Branch rules:
- перед кодом использовать `.agents/skills/task-worktree/SKILL.md` и отдельный
  worktree от актуального `origin/main`;
- подтвердить clean status и active branch;
- TASK-096 находится в реализации; начинать TASK-098 только после её merge в
  `origin/main` и использовать итоговый locator/toolbar/list-state baseline;
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
- TASK-096 находится в реализации; текущий `UsersListScreen` до её merge не
  является входным baseline для TASK-098.
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
- Длинные ФИО, логин и Telegram ID переносятся без обрезки; action остаётся
  видимым и достижимым.
- При отсутствии exception role/status markers не рендерится отдельная пустая
  строка/контейнер меток и не остаётся дополнительного вертикального отступа.
  Контейнер, в котором кроме меток остаётся ФИО или другой контент, пустым
  marker container не считается.
- Статусы не передаются только цветом; доступные имена действий сохраняются.

## Dependencies and execution order
1. TASK-093/TASK-094 — shared toolbar baseline через dependency TASK-096.
2. TASK-096 находится в реализации и должна быть merged в `origin/main`,
   потому что меняет `UsersListScreen`, component tests, App route state и
   users Playwright.
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
4. После merge TASK-096 расширить её существующее component и App/route
   integration coverage, не создавая дублирующий search-flow:
   - внутри filtered normal и exceptional rows проверить тот же badge contract;
   - в существующем сценарии search→edit→back добавить row-scoped assertions
     после возврата;
   - refresh и clear могут переиспользоваться как точки проверки, но их search
     semantics не переопределяются и повторно не реализуются в TASK-098.
5. До production-кода обновить users Playwright:
   - API fixture с normal/inactive/password/read-only/non-Coach items;
   - отсутствие трёх default labels только внутри normal row;
   - сохранение exception labels/actions;
   - длинные ФИО/логины/Telegram ID переносятся без обрезки и не перекрывают
     action.
6. Запустить новые tests и подтвердить ожидаемое падение: current normal row
   рендерит все три default badges.
7. Сформировать row presentation из явных исключений: Coach role, active
   status и current-password status не добавляются в badge collection;
   non-Coach, disabled и password-rotation добавляются независимо.
8. Не выводить edit permission из role/status; оставить существующий
   `canEditUser` и `Только просмотр` без изменений.
9. Если merged row содержит отдельный project-owned wrapper только для меток,
   не рендерить его при пустой exception collection и убрать связанный
   вертикальный gap. Не удалять общий контейнер, если в нём остаётся ФИО или
   другой row content. Удалить только действительно неиспользуемые local
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
- Длинные identity values переносятся без обрезки; identity и action не
  перекрываются и не вызывают horizontal page scroll.
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
- При пустой exception collection отсутствует отдельный project-owned marker
  container; tests не привязываются к внутренней DOM-структуре Mantine и не
  считают контейнер с ФИО пустым.

### Integration tests
- Расширить merged TASK-096 component coverage badge assertions для filtered
  rows.
- Расширить существующий TASK-096 App/route search→edit→back test row-scoped
  assertions после возврата; не дублировать ownership и semantics query state
  внутри `UsersListScreen`.
- Backend integration tests неприменимы: endpoint contract, authorization and
  data semantics do not change.
- Component/integration tests are written first and must fail on the current
  unconditional badges.

### UI/e2e tests
- Normal and exceptional rows under real route composition.
- Существующий merged TASK-096 search→row→edit/back и refresh flow не
  восстанавливает default badges; TASK-098 добавляет row assertions, а не
  дублирует search behavior.
- Long identity content переносится без обрезки; action остаётся достижимым,
  без overlap и horizontal overflow на `360 x 780`, `390 x 844`, `420 x 912`,
  `440 x 956`, `912 x 420`, `956 x 440`, `768 x 1024` и `1440 x 1200`.

## Expected initial failure verification
- Normal-row component and Playwright assertions must fail on `Тренер`,
  `Активен` and `Пароль актуален`.
- Exception-preservation tests may already pass and act as a guard against
  over-deletion.
- Failure must be scoped within the row card so navigation/form text with
  `Тренер` does not create false positives.

## Test plan
- [x] Написать component truth-table tests до production-кода.
- [x] Написать users Playwright absence/exception checks до production-кода.
- [x] Подтвердить expected red state на normal row.
- [x] `cd frontend && npm run test:unit`
- [x] `cd frontend && npm run check:raw-colors`
- [x] `cd frontend && npm run test:e2e -- e2e/users.spec.ts e2e/responsive-main-screens.spec.ts`
- [x] `cd frontend && npm run test:e2e:iphone`
- [x] `cd frontend && npm run lint`
- [x] `cd frontend && npm run build`

## Regression barrier
Одна executable row-state matrix должна одновременно запрещать три
default-positive badges и требовать disabled, password-rotation, read-only и
non-Coach exception markers. Расширенный существующий route-level Playwright
TASK-096 проверяет badge contract после search/edit-back без дублирования
search semantics; long content переносится без обрезки и защищает от
permission regression, overlap и responsive clipping.

## Risks
- Глобальный text query `Тренер` может совпасть с navigation, ФИО или title.
- Скрытие всех role badges скроет редкий backend-permitted non-Coach target.
- Отдельный условный marker wrapper может оставить пустую высоту/gap; общий
  контейнер с ФИО нельзя ошибочно удалить как пустой.
- Одновременная работа до merge TASK-096 приведёт к конфликтам в row и tests.

## Stop conditions
Остановиться, если:
- merged TASK-096 row/action contract ещё не определён;
- backend-permitted exceptional role нельзя отличить по существующему `role`;
- изменение требует новой permission/status semantics;
- удаление текста делает exception state различимым только по цвету;
- task worktree/branch невалиден.

## Ready for Codex execution
no — completed 2026-07-30 in commit `f59ee8b`

## Completion record
- Source task moved to `/backlog/done/TASK-098-trainer-list-default-badges-cleanup.md`.
- TASK-096 was present in the verified `origin/main` baseline before implementation.
- Integrated `main` validation passed: lint, build, raw-color check, 412 unit tests, 35 affected Chromium Playwright tests and 32 target-iPhone WebKit tests.
- No backend or database contract changed; no migration is required.
