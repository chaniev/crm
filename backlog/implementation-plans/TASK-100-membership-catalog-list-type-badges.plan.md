# Implementation Plan: TASK-100 Уточнить отображение типа абонемента в каталоге

## Source task
/backlog/needs-clarification/TASK-100-membership-catalog-list-type-badges.md

## Implementation branch
fix/TASK-100-membership-catalog-list-type-badges

Branch rules:
- ветку и worktree не создавать, пока product decision gate ниже не закрыт и
  source task не переведена в `/backlog/implementation`;
- после уточнения использовать `.agents/skills/task-worktree/SKILL.md` и
  создать отдельный worktree от актуального `origin/main`;
- не менять backend `behaviorKind`, Professional privileges, catalog forms,
  permissions или TASK-070 contracts;
- не реализовывать один из вариантов отображения по предположению.

## Goal
Убрать generic type badges и повтор `Профессиональный` из catalog list rows,
не скрыв обязательную backend-owned системную семантику Professional.

## Current understanding
- `MembershipCatalogSettings` сейчас всегда рендерит generic
  `behaviorLabel(item.behaviorKind)`.
- Для `Professional` тот же row дополнительно рендерит второй badge
  `Профессиональный`, поэтому в DOM два одинаковых label.
- Create modal использует отдельный required select `Поведение`; его labels и
  immutable edit contract не входят в cleanup.
- TASK-070 закрепила: HeadCoach видит системный Professional как заметную метку,
  независимо от переименованного display name; Administrator не получает права
  назначать/изменять эту системную семантику.
- Полное скрытие единственной Professional badge может противоречить TASK-070,
  особенно если system-owned item переименован.

## Product decision gate
До написания production-кода пользователь/продукт должен выбрать один contract:

1. Удалить generic badges для `SingleVisit`/`Term`, но сохранить ровно одну
   exceptional system badge `Профессиональный` для `behaviorKind=Professional`
   независимо от display name.
2. Удалить все behavior/system badges, включая Professional, и явно заменить
   соответствующий visibility contract TASK-070.

Рекомендуемый безопасный вариант — **1**: он выполняет просьбу убрать обычный
тип и двойной текст, сохраняя единственный backend-owned marker системного
поведения. Нужно отдельно подтвердить, остаётся ли badge видимой, когда display
name тоже равно `Профессиональный`; для непротиворечивости TASK-070 рекомендуемо
оставлять её, потому что имя изменяемо и не является источником behavior.

Пока решение не зафиксировано в source task, план не исполняется.

## UX/UI contract after approval
- `SingleVisit` и `Term` rows не показывают generic type badge.
- `Professional` row следует ровно выбранному contract и никогда не показывает
  два одинаковых type/system badges.
- Если выбран exceptional marker, он выводится из `behaviorKind`, а не из
  display name, `isSystemOwned` inference или frontend role guess.
- Название, цена, availability range и edit action остаются.
- Create form сохраняет visible `Поведение`; edit form не получает immutable
  control обратно.
- Loading, error, empty, branch-scope и permission behavior не меняются.
- Row не оставляет пустого badge wrapper/gap и не получает horizontal scroll.

## Dependencies and execution order
1. Зафиксировать выбранный product contract в
   `/backlog/needs-clarification/TASK-100-...md`.
2. Проверить его на совместимость с completed TASK-070.
3. Перевести source task в `/backlog/tasks-ready`, затем отдельным planning run
   — в `/backlog/implementation` с lifecycle metadata.
4. Выполнить TASK-100 на dedicated branch/worktree.

## Execution steps
1. После закрытия gate создать isolated worktree и повторно прочитать merged
   `MembershipCatalogSettings`, TASK-070 source/plan и role-scoped settings
   tests.
2. До production-кода добавить component row matrix:
   - `SingleVisit` с произвольным именем;
   - `Term` с произвольным именем;
   - `Professional` с именем `Профессиональный`;
   - переименованный `Professional`;
   - exact badge count/label согласно утверждённому contract.
3. До production-кода добавить negative tests: generic `Разовый`/`На срок`
   отсутствуют в list rows, но create form options `Разовое посещение` и
   `Абонемент на срок` остаются.
4. До production-кода сохранить edit-form regression: price/behavior/delete
   остаются immutable/недоступными; name/date edit и server field errors
   работают.
5. До production-кода добавить settings Playwright:
   branch-scoped catalog с тремя behavior kinds, отсутствие duplicate marker,
   long renamed Professional, edit action and no overflow.
6. Запустить новые tests и подтвердить expected failures на current generic
   badges и двойном Professional marker.
7. Заменить unconditional generic badge projection на утверждённое явно
   именованное presentation rule. Не менять API/type/domain mapping.
8. Удалить только ставшие неиспользуемыми local `behaviorLabel`/Badge paths;
   form option labels и shared client membership labels сохранить.
9. Убрать empty inline wrapper/gap, сохранив identity/action hierarchy.
10. Запустить focused settings tests, full frontend unit/raw-color/lint/build,
    affected Playwright и target iPhone WebKit checks.

## Preferred implementation strategy
1. Product contract decision.
2. Red row-state matrix.
3. Minimal list-only projection.
4. Create/edit and TASK-070 counter-regressions.
5. Responsive closure.

## Files likely to change
- `backlog/needs-clarification/TASK-100-membership-catalog-list-type-badges.md`
  для product decision до implementation selection
- `frontend/src/features/settings/MembershipCatalogSettings.tsx`
- `frontend/src/features/settings/MembershipCatalogSettings.test.tsx`
- affected membership-catalog/settings Playwright spec
- `frontend/e2e/stage12.spec.ts`, если он остаётся owner общего Settings flow
- `frontend/e2e/iphone-target-devices.spec.ts`, если он владеет target-device
  settings checks
- `frontend/src/App.css` только при наличии item-row-specific empty spacing

## Constraints
- Не выводить Professional semantics из отображаемого имени.
- Не менять backend behavior/privilege/role/branch contracts.
- Не удалять create-form behavior selector.
- Не возвращать immutable behavior/price controls в edit form.
- Ровно один approved system marker maximum.
- Mantine, Onest и operational states сохраняются.

## Out of scope
- Backend `behaviorKind`, seed, privileges, pricing и availability validation.
- Professional assignment visibility для purchase/transfer.
- Catalog create/edit workflow redesign.
- Row fields кроме type/system badges.
- Пересмотр TASK-070 без явного продуктового решения.

## Required test coverage

### Unit/component tests
- Matrix `SingleVisit`/`Term`/Professional/current-name/renamed-name`.
- Exact absence/count of generic/system badges.
- Create behavior selector and edit immutability preserved.
- Loading/error/empty/branch context and edit action preserved.

### Integration tests
- Settings component integration с существующим API response доказывает, что
  display rule использует `behaviorKind`, не меняя request/response contracts.
- Backend integration tests неприменимы, если утверждён list-only вариант:
  backend semantics не меняются.
- Tests are written before production code and must fail on current generic
  badges/double Professional output.

### UI/e2e tests
- HeadCoach catalog with ordinary and renamed Professional rows.
- Exact marker count, edit action and create behavior selector.
- No duplicate text/empty gap/overflow at `360 x 780`, `390 x 844`,
  `420 x 912`, `440 x 956`, `912 x 420`, `956 x 440`, `768 x 1024` and
  `1440 x 1200`.

## Expected initial failure verification
- Ordinary rows fail negative assertions on current generic badges.
- Professional row fails exact-count assertion because current JSX renders two
  `Профессиональный` badges.
- TASK-070 counter-tests must stay green; если они требуют видимый marker, это
  подтверждает необходимость выбора contract 1 либо явного пересмотра.

## Test plan
- [ ] Зафиксировать product decision в source task.
- [ ] Написать component row matrix до production-кода.
- [ ] Добавить settings Playwright exact-count checks до production-кода.
- [ ] Подтвердить expected red state на generic/double badges.
- [ ] `cd frontend && npm run test:unit`
- [ ] `cd frontend && npm run check:raw-colors`
- [ ] `cd frontend && npm run test:e2e -- <membership catalog/settings affected specs>`
- [ ] `cd frontend && npm run test:e2e:iphone`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`

## Regression barrier
После product decision одна executable matrix должна запрещать generic badges,
доказывать exact Professional marker contract для обычного и переименованного
item и одновременно сохранять create behavior selector/edit immutability.
Browser-level check защищает от двойного текста, пустого wrapper и overflow.

## Risks
- Полное удаление Professional marker молча нарушит TASK-070.
- Проверка по display name создаст второй источник backend behavior semantics.
- Global text assertions могут спутать list marker и create-form option.
- Удаление shared labels повредит client purchase/transfer screens.

## Stop conditions
Остановиться и не писать production-код, если:
- product decision gate не закрыт;
- выбранный вариант противоречит TASK-070 без явного пересмотра;
- Professional marker приходится выводить из имени или frontend role inference;
- scope расширяется в backend privileges/catalog contracts;
- task не переведена в implementation или worktree/branch невалиден.

## Ready for Codex execution
no — unresolved product decision about the single Professional system marker
