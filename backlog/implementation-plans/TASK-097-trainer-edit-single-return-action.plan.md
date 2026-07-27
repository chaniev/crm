# Implementation Plan: TASK-097 Оставить одно действие возврата на экранах редактирования

## Source task
/backlog/implementation/TASK-097-trainer-edit-single-return-action.md

## Implementation branch
fix/TASK-097-trainer-edit-single-return-action

Branch rules:
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

## UX/UI contract
- Route/header return — единственное действие выхода из edit route.
- Editable footer содержит только submit; submit остаётся primary и доступен
  после прохождения формы с клавиатуры.
- User read-only state содержит header return, но не получает фиктивный footer.
- Loading и load-error state сохраняют header return.
- Create forms сохраняют footer `Отменить`; cancel внутри modal/drawer не
  меняется, потому что закрывает temporary surface, а не дублирует route return.
- Визуальный и keyboard focus order: header return → поля/состояние → submit.
- Ни одно удалённое действие не заменяется overflow/menu action.

## Dependencies and execution order
1. TASK-095 должна быть merged: она владеет service/decorative copy и imports
   в `UserEditScreen`.
2. TASK-101 должна быть merged: она владеет metric block/imports в
   `GroupEditScreen`.
3. Выполнить TASK-097 на обновлённом `origin/main` и повторить inventory трёх
   edit routes перед red tests.
4. При параллельном выполнении разрешён только явно разделённый ownership:
   TASK-097 — route/footer actions; TASK-095 — copy; TASK-101 — metrics.

## Execution steps
1. Создать isolated worktree и проверить фактический route inventory по
   `AppRoute`, `RouteViewport`, `ClientEditScreen`, `GroupEditScreen` и
   `UserEditScreen`.
2. До production-кода расширить `UserManagement` component tests:
   - editable state содержит один header return, не содержит `К списку` в
     footer и сохраняет submit;
   - read-only, loading и load-error states содержат один доступный return;
   - return вызывает `onBack` ровно один раз.
3. До production-кода расширить client component tests:
   - edit screen содержит `К карточке клиента`, не содержит footer
     `Отменить`, сохраняет submit и validation/error behavior;
   - create screen по-прежнему содержит footer `Отменить`.
4. До production-кода расширить group component tests:
   - edit screen содержит `К списку групп`, не содержит footer `Отменить`,
     сохраняет submit, substitutions и group-client sections;
   - create screen по-прежнему содержит footer `Отменить`.
5. До production-кода добавить route-level Playwright regression:
   - trainer edit: открыть → вернуться; открыть повторно → сохранить;
   - representative client/group edit проверяют единственный route return;
   - loading/error/read-only fixtures не теряют recovery path;
   - exact count доступных return controls равен одному.
6. Запустить новые focused tests и подтвердить ожидаемое падение: current
   trainer footer показывает второй return, а shared client/group forms
   показывают `Отменить` и в edit mode.
7. Удалить footer `listAction` из `UserEditScreen`, выровнять единственный
   submit по правому краю и удалить только ставшие локально неиспользуемыми
   resource/import paths после merged TASK-095.
8. Сделать footer cancel shared `ClientForm`/`GroupForm` явно управляемым
   режимом: create включает cancel, edit не рендерит его. Не выводить режим из
   текста submit label или URL.
9. Убрать пустые action slots/wrappers и убедиться, что single-submit footer не
   получает лишний gap или width constraint.
10. Обновить старые assertions, которые ожидали дублирующее действие, не
    ослабляя проверки submit, validation, operational states и create cancel.
11. Запустить focused component/Playwright tests, полный frontend unit suite,
    raw-color check, lint, build и target iPhone WebKit checks.

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
- `frontend/e2e/users.spec.ts`
- affected client/group Playwright specs
- `frontend/e2e/responsive-main-screens.spec.ts`
- `frontend/e2e/iphone-target-devices.spec.ts`, если это итоговый merged
  target-device inventory

## Constraints
- Ровно один route return должен существовать во всех operational states.
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
- Backend validation, roles, permissions и allowed actions.

## Required test coverage

### Unit/component tests
- User editable/read-only/loading/error states: один return и корректный submit.
- Client/group edit: header return без footer cancel.
- Client/group create: footer cancel сохранён.
- Submit error/validation и pending state не меняются.

### Integration tests
- Component-level route integration проверяет, что единственный control вызывает
  существующий callback/destination и что save продолжает вызывать update API.
- App route test закрепляет три edit kinds и их parent/detail destination.
- Backend integration tests неприменимы: API, validation и permissions не
  меняются.
- Все component/route integration tests пишутся до production-кода и сначала
  падают на текущих дублирующих controls.

### UI/e2e tests
- Trainer open → return → reopen → save.
- Representative client/group edit и create counter-case.
- Loading, error и permission-restricted/read-only recovery.
- Focus order, visible focus, exact accessible names и no overflow на
  `360 x 780`, `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420`,
  `956 x 440`, `768 x 1024` и `1440 x 1200`.

## Expected initial failure verification
- `UserEditScreen` test должен увидеть два controls с одинаковым return result.
- Client/group edit tests должны найти существующий footer `Отменить`.
- Playwright exact-count assertions должны падать до удаления дубликатов.
- Create counter-tests уже могут быть зелёными и служат барьером от
  чрезмерного удаления.

## Test plan
- [ ] Написать component и route integration tests до production-кода.
- [ ] Добавить Playwright exact-count/primary-flow checks до production-кода.
- [ ] Подтвердить ожидаемый red state на трёх edit routes.
- [ ] `cd frontend && npm run test:unit`
- [ ] `cd frontend && npm run check:raw-colors`
- [ ] `cd frontend && npm run test:e2e -- <users/client/group affected specs>`
- [ ] `cd frontend && npm run test:e2e:iphone`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`

## Regression barrier
Автоматизированная матрица трёх route-level edit screens должна одновременно
доказывать: один header return во всех состояниях, отсутствие footer duplicate
в edit mode, наличие submit в editable state и сохранение footer cancel в
create mode. Playwright path return→reopen→save защищает реальную navigation и
mutation, а не только текст кнопок.

## Risks
- Общий `ClientForm`/`GroupForm` легко изменить так, что cancel исчезнет и в
  create-flow.
- Поиск только по label может спутать route return с modal cancel.
- TASK-095/TASK-101 меняют те же файлы и могут дать ложный clean merge.
- Удаление единственного footer control без выравнивания может оставить пустой
  слот или неправильный focus order.

## Stop conditions
Остановиться, если:
- повторный inventory находит edit route с отличающимся cancel result;
- удаление требует менять destination, dirty-form semantics или backend rules;
- merged baseline TASK-095/TASK-101 в overlapping files неясен;
- единственный recovery path исчезает в loading/error/read-only state;
- task worktree/branch невалиден.

## Ready for Codex execution
yes, after TASK-095 and TASK-101 are merged into origin/main
