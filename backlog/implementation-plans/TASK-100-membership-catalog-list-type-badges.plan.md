# Implementation Plan: TASK-100 Убрать метки типа абонемента из каталога

## Source task
/backlog/tasks-ready/TASK-100-membership-catalog-list-type-badges.md

## Implementation branch
fix/TASK-100-membership-catalog-list-type-badges

Branch rules:
- ветку и worktree не создавать, пока source task не выбрана для реализации и
  не переведена в `/backlog/implementation`;
- после выбора задачи использовать `.agents/skills/task-worktree/SKILL.md` и
  создать отдельный worktree от актуального `origin/main`;
- не менять backend `behaviorKind`, Professional privileges, catalog forms,
  permissions или TASK-070 contracts;
- не распространять list-row cleanup на другие интерфейсы.

## Goal
Убрать все behavior/type/system badges из catalog list rows, включая
специальную метку `Professional`, не меняя backend-owned семантику или
представление `Professional` на других экранах.

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
- Продуктовое решение от 2026-07-27 ограничивает удаление меток list rows
  каталога настроек; eligible lists продажи/перевода и другие интерфейсы
  сохраняют предусмотренное TASK-070 представление `Professional`.

## Product decision
Gate закрыт 2026-07-27:

1. `SingleVisit`, `Term` и `Professional` не показывают behavior/type/system
   badges в list rows каталога.
2. Отдельная метка не показывается независимо от display name.
3. Решение не распространяется на eligible lists продажи/перевода, карточку
   клиента и другие интерфейсы, предусмотренные TASK-070.

## UX/UI contract after approval
- `SingleVisit`, `Term` и `Professional` rows не показывают
  behavior/type/system badges.
- Если display name равно `Профессиональный`, оно отображается один раз как
  название варианта.
- Frontend не добавляет заменяющую метку из display name, `isSystemOwned`,
  цены или role inference.
- Название, цена, availability range и edit action остаются.
- Create form сохраняет visible `Поведение`; edit form не получает immutable
  control обратно.
- Loading, error, empty, branch-scope и permission behavior не меняются.
- Row не оставляет пустого badge wrapper/gap и не получает horizontal scroll.

## Dependencies and execution order
1. Product contract зафиксирован в `/backlog/tasks-ready/TASK-100-...md`.
2. Отдельным planning run выбрать задачу и перевести source task в
   `/backlog/implementation` с lifecycle metadata.
3. Выполнить TASK-100 на dedicated branch/worktree.

## Execution steps
1. После выбора задачи и перевода в implementation создать isolated worktree,
   затем повторно прочитать merged `MembershipCatalogSettings`, TASK-070
   source/plan и role-scoped settings tests.
2. До production-кода добавить component row matrix:
   - `SingleVisit` с произвольным именем;
   - `Term` с произвольным именем;
   - `Professional` с именем `Профессиональный`;
   - переименованный `Professional`;
   - нулевое количество behavior/type/system badges внутри каждой строки.
3. До production-кода добавить negative tests: generic `Разовый`/`На срок`
   отсутствуют в list rows, но create form options `Разовое посещение` и
   `Абонемент на срок` остаются.
4. До production-кода сохранить edit-form regression: price/behavior/delete
   остаются immutable/недоступными; name/date edit и server field errors
   работают.
5. До production-кода добавить settings Playwright:
   branch-scoped catalog с тремя behavior kinds, отсутствие type/system badges,
   long renamed Professional, edit action and no overflow.
6. Запустить новые tests и подтвердить expected failures на current generic
   badges и двойном Professional marker.
7. Удалить list-row badge projection для всех behavior kinds. Не менять
   API/type/domain mapping или presentation на других экранах.
8. Удалить только ставшие неиспользуемыми local `behaviorLabel`/Badge paths;
   form option labels и shared client membership labels сохранить.
9. Убрать empty inline wrapper/gap, сохранив identity/action hierarchy.
10. Запустить focused settings tests, full frontend unit/raw-color/lint/build,
    affected Playwright и target iPhone WebKit checks.

## Preferred implementation strategy
1. Red row-state matrix.
2. Minimal list-only projection.
3. Create/edit and TASK-070 counter-regressions.
4. Responsive closure.

## Files likely to change
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
- Не оставлять behavior/type/system badge ни для одного behavior kind в
  catalog list rows.
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
- Нулевое количество behavior/type/system badges внутри каждой list row.
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
- Exact zero list-row badge count, edit action and create behavior selector.
- No duplicate text/empty gap/overflow at `360 x 780`, `390 x 844`,
  `420 x 912`, `440 x 956`, `912 x 420`, `956 x 440`, `768 x 1024` and
  `1440 x 1200`.

## Expected initial failure verification
- Ordinary rows fail negative assertions on current generic badges.
- Professional row fails zero-count assertion because current JSX renders two
  `Профессиональный` badges.
- TASK-070 counter-tests для eligible lists и других интерфейсов должны
  оставаться зелёными.

## Test plan
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
Одна executable matrix должна запрещать любые list-row behavior/type/system
badges для обычного и переименованного Professional item и одновременно
сохранять create behavior selector/edit immutability.
Browser-level check защищает от двойного текста, пустого wrapper и overflow.

## Risks
- Неограниченный cleanup может случайно удалить Professional marker из
  eligible lists продажи/перевода или других интерфейсов TASK-070.
- Проверка по display name создаст второй источник backend behavior semantics.
- Global text assertions могут спутать list marker и create-form option.
- Удаление shared labels повредит client purchase/transfer screens.

## Stop conditions
Остановиться и не писать production-код, если:
- изменение требует удалить или изменить Professional marker вне catalog list rows;
- Professional presentation приходится выводить из имени или frontend role inference;
- scope расширяется в backend privileges/catalog contracts;
- task не переведена в implementation или worktree/branch невалиден.

## Ready for Codex execution
no — product decision resolved; task awaits separate implementation selection
