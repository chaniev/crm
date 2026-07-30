# Implementation Plan: TASK-097 Оставить одно действие возврата на экранах редактирования

## Source task
/backlog/done/TASK-097-trainer-edit-single-return-action.md

## Implementation branch
fix/TASK-097-trainer-edit-single-return-action

Branch rules:
- TASK-095 и TASK-101 являются обязательными блокирующими зависимостями:
  не создавать task worktree и не менять project-код TASK-097, пока обе задачи
  не merged в актуальный `origin/main`;
- перед изменением project-кода использовать
  `.agents/skills/task-worktree/SKILL.md` и создать отдельный worktree от
  актуального `origin/main`;
- подтвердить clean status, active branch и отсутствие другого worktree для
  этой ветки;
- не включать TASK-095 service-copy cleanup, TASK-101 metric removal или
  create-flow redesign;
- не изменять destinations, backend permissions и unsaved-changes contract.

## Goal
На каждом route-level edit screen оставить одно понятное действие возврата в
header, а в footer editable form — только визуально доминирующее сохранение.

## Current understanding
- `appRoutes.ts` определяет ровно три route-level edit kind:
  `clientEdit`, `groupEdit` и `userEdit`.
- `UserEditScreen` вызывает один `onBack` из header `Назад к списку` и из
  footer `К списку`; это точный дубль destination и результата.
- `ClientEditScreen` сохраняет header `К карточке клиента`, но общий
  `ClientForm` также вызывает тот же `onBack` через footer `Отменить`.
- `GroupEditScreen` сохраняет header `К списку групп`, но общий `GroupForm`
  также вызывает тот же `onBack` через footer `Отменить`.
- `ClientForm` и `GroupForm` используются create и edit flows. Create-flow
  остаётся вне scope и должен сохранить своё footer-действие отмены.
- Header return уже находится вне loading/error/editable branching, поэтому
  остаётся recovery path в loading, error и user read-only states.
- Destination matrix уже определена существующим routing contract:
  `clientEdit` → карточка этого клиента, `groupEdit` → список групп,
  `userEdit` → список тренеров.
- В тестах route return означает только действие в route-level header текущего
  edit screen. Browser back, shell navigation и cancel внутри modal/drawer не
  входят в этот count.

## UX/UI contract
- Route/header return — единственное действие выхода из edit route.
- Accessible name единственного route return сохраняет текущий destination:
  `К карточке клиента`, `К списку групп` или `Назад к списку` на trainer edit.
- Editable footer содержит только submit; submit остаётся primary и доступен
  после прохождения формы с клавиатуры.
- User read-only state содержит header return, но не получает фиктивный footer.
- Loading и load-error state сохраняют header return.
- Create forms сохраняют footer `Отменить`; cancel внутри modal/drawer не
  меняется, потому что закрывает temporary surface, а не дублирует route return.
- Визуальный и keyboard focus order: header return → поля/состояние → submit.
- Ни одно удалённое действие не заменяется overflow/menu action.
- Единственный submit использует существующее responsive-поведение
  `ResponsiveButtonGroup`: full-width при `max-width: 48em` и выравнивание
  вправо выше этого breakpoint. Пустой footer/wrapper не рендерится.
- Operational-state matrix: user edit — editable, loading, load-error и
  read-only; client/group edit — editable, loading и load-error. TASK-097 не
  создаёт отсутствующий client/group read-only contract.

## Dependencies and execution order
1. TASK-095 должна быть merged в `origin/main`: она владеет
   service/decorative copy и imports в `UserEditScreen`.
2. TASK-101 должна быть merged в `origin/main`: она владеет metric
   block/state/imports в `GroupEditScreen`.
3. Обе зависимости — hard blockers. Параллельная реализация TASK-097 с
   TASK-095 или TASK-101 не разрешена даже при разделённом ownership.
4. После merge обеих зависимостей обновить `origin/main`, подтвердить наличие
   их изменений в baseline и только затем создать task worktree TASK-097.
5. В новом worktree повторить inventory трёх edit routes до red tests.

## Execution steps
1. Проверить, что TASK-095 и TASK-101 merged в актуальный `origin/main`.
   Если хотя бы одной зависимости нет, остановить TASK-097 до её merge.
2. Создать isolated worktree и проверить фактический route inventory по
   `AppRoute`, `RouteViewport`, `ClientEditScreen`, `GroupEditScreen` и
   `UserEditScreen`.
3. До production-кода расширить `UserManagement` component tests:
   - editable state содержит один header return, не содержит `К списку` в
     footer и сохраняет submit;
   - read-only, loading и load-error states содержат один доступный return;
   - read-only state не рендерит пустой footer/wrapper;
   - header return вызывает `onBack` ровно один раз.
4. До production-кода расширить client component tests:
   - edit screen содержит `К карточке клиента`, не содержит footer
     `Отменить`, сохраняет submit и validation/error behavior;
   - loading и load-error сохраняют header return;
   - create screen по-прежнему содержит footer `Отменить`.
5. До production-кода расширить group component tests:
   - edit screen содержит `К списку групп`, не содержит footer `Отменить`,
     сохраняет submit, substitutions и group-client sections;
   - loading и load-error сохраняют header return;
   - create screen по-прежнему содержит footer `Отменить`.
6. До production-кода добавить route/component integration regression:
   - inventory закрепляет ровно три edit kinds;
   - `App` routing закрепляет destination matrix:
     client edit → client details, group edit → groups list,
     user edit → users list;
   - exact count применяется только к route-level header return, а отсутствие
     edit footer cancel проверяется отдельно внутри формы.
7. До production-кода добавить focused Playwright regression:
   - trainer edit: открыть → вернуться; открыть повторно → сохранить;
   - representative client/group edit проверяют единственный route return и
     существующий destination;
   - user load-error и read-only fixtures не теряют recovery path;
   - create counter-case подтверждает сохранение footer `Отменить`;
   - modal/drawer cancel, browser back и shell navigation исключены из count.
8. Запустить новые focused tests и подтвердить ожидаемое падение: current
   trainer footer показывает второй return, а shared client/group forms
   показывают `Отменить` и в edit mode.
9. Удалить footer `listAction` из `UserEditScreen`, сохранить full-width
   mobile submit и выровнять single submit вправо выше mobile breakpoint.
   Удалить только ставшие локально неиспользуемыми resource/import paths из
   baseline после merged TASK-095.
10. Сделать footer cancel shared `ClientForm`/`GroupForm` явно управляемым
   режимом: create включает cancel, edit не рендерит его. Не выводить режим из
   текста submit label или URL.
11. Убрать пустые action slots/wrappers и убедиться, что single-submit footer
    не получает лишний gap или width constraint.
12. Обновить старые assertions, которые ожидали дублирующее действие, не
    ослабляя проверки submit, validation, operational states и create cancel.
13. Запустить focused component/Playwright tests, полный frontend unit suite,
    lint, build и target iPhone WebKit checks. `check:raw-colors` запускать,
    если implementation затрагивает CSS, tokens или color values.

## Preferred implementation strategy
1. Executable edit-route inventory.
2. Red component tests для edit и create counter-cases.
3. Минимальный explicit form-mode contract.
4. Удаление дубликатов без изменения navigation.
5. Route/mobile regression closure.

## Files likely to change
- `frontend/src/features/users/UserEditScreen.tsx`
- `frontend/src/features/users/UserManagement.test.tsx`
- `frontend/src/features/clients/ClientManagement.tsx`
- `frontend/src/features/clients/ClientManagement.test.tsx`
- `frontend/src/features/groups/GroupManagement.tsx`
- `frontend/src/features/groups/GroupManagement.test.tsx`
- `frontend/src/lib/resources.ts` только для доказанно неиспользуемого
  `resources.users.edit.listAction`
- `frontend/src/App.test.tsx`
- `frontend/src/lib/appRoutes.test.ts`
- `frontend/e2e/users.spec.ts`
- affected client/group Playwright specs
- `frontend/e2e/responsive-main-screens.spec.ts`
- `frontend/e2e/iphone-target-devices.spec.ts`, если это итоговый merged
  target-device inventory

## Constraints
- Ровно один route-level header return должен существовать во всех применимых
  operational states из зафиксированной state matrix.
- Create-flow, modal/drawer cancel и destinations не меняются.
- Не добавлять unsaved-changes confirmation.
- Не выводить permission/business semantics во frontend.
- Submit остаётся visible primary action, минимум `44 x 44px`, без overflow.
- Сохраняются Mantine, Onest, PageLayout и существующий routing contract.

## Out of scope
- Decorative trainer edit copy из TASK-095.
- Metric widgets из TASK-101.
- Create-form action redesign.
- Browser-native back behavior или сохранение dirty form.
- Полная переработка read-only affordances полей `UserEditScreen`; TASK-097
  проверяет только отсутствие фиктивного footer и наличие recovery return.
- Backend validation, roles, permissions и allowed actions.

## Required test coverage

### Unit/component tests
- User editable/read-only/loading/error states: один return и корректный submit.
- Client/group editable/loading/error states: header return без footer cancel
  в editable state.
- Client/group create: footer cancel сохранён.
- Submit error/validation и pending state не меняются.

### Integration tests
- Component-level route integration проверяет, что единственный control вызывает
  существующий callback/destination и что save продолжает вызывать update API.
- `appRoutes` test закрепляет inventory трёх edit kinds.
- `App`/`RouteViewport` test закрепляет destination matrix:
  `clientEdit` → client details, `groupEdit` → groups list,
  `userEdit` → users list.
- Backend integration tests неприменимы: API, validation и permissions не
  меняются.
- Все component/route integration tests пишутся до production-кода и сначала
  падают на текущих дублирующих controls.

### UI/e2e tests
- Trainer open → return → reopen → save.
- Representative client/group edit и create counter-case.
- User load-error и permission-restricted/read-only recovery; exhaustive
  operational-state matrix остаётся в component tests.
- No overflow, exact accessible name, один route header return и достижимый
  submit проверяются на `360 x 780`, `390 x 844`, `420 x 912`, `440 x 956`,
  `912 x 420`, `956 x 440`, `768 x 1024` и `1440 x 1200`.
- Keyboard focus order и visible focus проверяются в primary mobile path и
  desktop keyboard path; compact-height размеры получают отдельный smoke.
- `420 x 912` и `440 x 956` проходят WebKit mobile emulation с touch,
  iPhone user agent и `3x` device scale factor. Геометрический Chromium
  viewport не считается iPhone Safari acceptance.
- Не строить полный route × state × viewport Cartesian product: component
  tests владеют state matrix, focused Playwright — user flow и destinations,
  responsive/target-device specs — layout и mobile acceptance.

## Expected initial failure verification
- `UserEditScreen` test должен увидеть два controls с одинаковым return result.
- Client/group edit tests должны найти существующий footer `Отменить`.
- Playwright exact-count assertions должны падать до удаления дубликатов.
- Create counter-tests уже могут быть зелёными и служат барьером от
  чрезмерного удаления.

## Test plan
- [x] Написать component и route integration tests до production-кода.
- [x] Добавить Playwright exact-count/primary-flow checks до production-кода.
- [x] Подтвердить ожидаемый red state на трёх edit routes.
- [x] `cd frontend && npm run test:unit`
- [x] `cd frontend && npm run check:raw-colors`, если изменены CSS/tokens/colors
- [x] `cd frontend && npm run test:e2e -- <users/client/group affected specs>`
- [x] `cd frontend && npm run test:e2e:iphone`
- [x] `cd frontend && npm run lint`
- [x] `cd frontend && npm run build`

## Regression barrier
Автоматизированная матрица трёх route-level edit screens должна одновременно
доказывать: один header return во всех применимых состояниях, отсутствие
footer duplicate в edit mode, наличие submit в editable state и сохранение
footer cancel в create mode. Playwright path return→reopen→save защищает
реальную navigation и mutation, а не только текст кнопок.

## Risks
- Общий `ClientForm`/`GroupForm` легко изменить так, что cancel исчезнет и в
  create-flow.
- Поиск только по label может спутать route return с modal cancel.
- Worktree, созданный до merge TASK-095/TASK-101, даст устаревший baseline и
  ложный clean diff; hard gates запрещают такой старт.
- Удаление единственного footer control без выравнивания может оставить пустой
  слот или неправильный focus order.

## Stop conditions
Остановиться, если:
- TASK-095 или TASK-101 ещё не merged в актуальный `origin/main`;
- повторный inventory находит edit route с отличающимся cancel result;
- удаление требует менять destination, dirty-form semantics или backend rules;
- merged baseline TASK-095/TASK-101 в overlapping files неясен;
- единственный recovery path исчезает в loading/error/read-only state;
- task worktree/branch невалиден.

## Ready for Codex execution
no — completed 2026-07-30 in commit `0f22419`

## Completion record
- Source task moved to `/backlog/done/TASK-097-trainer-edit-single-return-action.md`.
- Dependencies TASK-095 and TASK-101 were present in the verified `origin/main` baseline before implementation.
- Integrated `main` validation passed: lint, build, raw-color check, 412 unit tests, 35 affected Chromium Playwright tests and 32 target-iPhone WebKit tests.
- No backend or database contract changed; no migration is required.
