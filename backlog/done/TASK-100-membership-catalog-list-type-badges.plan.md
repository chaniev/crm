# Implementation Plan: TASK-100 Убрать метки типа абонемента из каталога

## Source task
/backlog/done/TASK-100-membership-catalog-list-type-badges.md

## Implementation branch
fix/TASK-100-membership-catalog-list-type-badges

Branch rules:
- перед кодом использовать `.agents/skills/task-worktree/SKILL.md` и создать
  отдельный worktree от актуального `origin/main`;
- подтвердить clean status, ownership branch и active branch;
- не менять backend `behaviorKind`, Professional privileges, catalog forms,
  permissions или TASK-070 contracts;
- не распространять list-row cleanup на другие интерфейсы.

## Goal
Убрать любые badges из catalog list rows, включая специальную метку
`Professional`, не меняя backend-owned семантику или представление
`Professional` на других экранах.

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

1. `SingleVisit`, `Term` и `Professional` не показывают никаких badges в list
   rows каталога.
2. Отдельная метка не показывается независимо от display name.
3. Решение не распространяется на eligible lists продажи/перевода, карточку
   клиента и другие интерфейсы, предусмотренные TASK-070.
4. Текущий контракт запрещает все badges внутри list row. Их возможное
   возвращение или добавление в будущем требует отдельного продуктового решения.

## UX/UI contract after approval
- `SingleVisit`, `Term` и `Professional` rows не показывают никаких badges.
- Если display name равно `Профессиональный`, оно отображается один раз как
  название варианта.
- Frontend не добавляет заменяющую метку из display name, `isSystemOwned`,
  цены или role inference.
- Название, цена, availability range и edit action остаются.
- Длинное название переносится на несколько строк без clipping или horizontal
  scroll. Действие `Изменить` остаётся видимым и доступным; его placement и
  hierarchy из TASK-093 не меняются.
- Create form сохраняет visible `Поведение`; edit form не получает immutable
  control обратно.
- Loading, error, empty, branch-scope и permission behavior не меняются.
- Row не оставляет пустого badge wrapper/gap и не получает horizontal scroll.

## Dependencies and execution order
1. Product contract зафиксирован в `/backlog/implementation/TASK-100-...md`.
2. Дождаться merge TASK-093 в `origin/main`, поскольку обе задачи меняют
   `MembershipCatalogSettings.tsx`; TASK-093 владеет shared action placement,
   TASK-100 — только badge cleanup list rows.
3. Выполнить TASK-100 на dedicated branch/worktree из обновлённого
   `origin/main`.

## Execution steps
1. После merge TASK-093 создать isolated worktree, затем повторно прочитать
   merged `MembershipCatalogSettings`, TASK-070 source/plan и role-scoped
   settings tests.
2. До production-кода добавить component row matrix:
   - `SingleVisit` с произвольным именем;
   - `Term` с произвольным именем;
   - `Professional` с именем `Профессиональный`;
   - переименованный `Professional`;
   - нулевое количество любых badges внутри каждой строки.
3. До production-кода добавить negative tests: generic `Разовый`/`На срок`
   отсутствуют в list rows, но create form options `Разовое посещение` и
   `Абонемент на срок` остаются.
4. Сохранить существующий edit-form regression: price/behavior/delete остаются
   immutable/недоступными. Новые edit-flow tests в TASK-100 не добавлять.
5. До production-кода добавить отдельный
   `frontend/e2e/membership-catalog-settings.spec.ts`: branch-scoped catalog с
   тремя behavior kinds, exact zero badges, long renamed Professional,
   перенос названия, видимое действие `Изменить` и отсутствие overflow.
6. До production-кода добавить небольшой populated-catalog сценарий в
   `frontend/e2e/iphone-target-devices.spec.ts` для обоих target iPhone
   WebKit-проектов.
7. Запустить новые tests и подтвердить expected failures на current generic
   badges и двойном Professional marker.
8. Удалить list-row badge projection для всех behavior kinds. Не менять
   API/type/domain mapping или presentation на других экранах.
9. Удалить только ставшие неиспользуемыми local `behaviorLabel`/Badge paths;
   form option labels и shared client membership labels сохранить.
10. Убрать empty inline wrapper/gap, сохранив identity/action hierarchy и
    placement действия `Изменить` из TASK-093.
11. Запустить focused settings tests, full frontend unit/raw-color/lint/build,
    affected Playwright и target iPhone WebKit checks.

## Preferred implementation strategy
1. Red row-state matrix.
2. Minimal list-only projection.
3. Create selector и существующий edit immutability regression.
4. Responsive closure.

## Files likely to change
- `frontend/src/features/settings/MembershipCatalogSettings.tsx`
- `frontend/src/features/settings/MembershipCatalogSettings.test.tsx`
- `frontend/e2e/membership-catalog-settings.spec.ts`
- `frontend/e2e/iphone-target-devices.spec.ts`
- `frontend/src/App.css` только при наличии item-row-specific empty spacing

## Constraints
- Не выводить Professional semantics из отображаемого имени.
- Не менять backend behavior/privilege/role/branch contracts.
- Не удалять create-form behavior selector.
- Не возвращать immutable behavior/price controls в edit form.
- Не оставлять никаких badges в catalog list rows.
- Не менять placement или hierarchy действия `Изменить`, установленную
  TASK-093.
- Mantine, Onest и operational states сохраняются.

## Out of scope
- Backend `behaviorKind`, seed, privileges, pricing и availability validation.
- Professional assignment visibility для purchase/transfer.
- Catalog create/edit workflow redesign.
- Row fields кроме badges.
- Пересмотр TASK-070 без явного продуктового решения.

## Required test coverage

### Unit/component tests
- Matrix `SingleVisit`/`Term`/Professional/current-name/renamed-name`.
- Нулевое количество любых badges внутри каждой list row.
- Create behavior selector and edit immutability preserved.
- Loading/error/empty/branch context and edit action preserved.

### Integration tests
- Отдельные integration tests не требуются: component row matrix покрывает
  проекцию существующего API response, а backend contracts не меняются.

### UI/e2e tests
- HeadCoach catalog with ordinary and renamed Professional rows.
- Отдельный `membership-catalog-settings.spec.ts` проверяет exact zero
  list-row badge count, edit action и create behavior selector.
- `iphone-target-devices.spec.ts` содержит небольшой populated-catalog сценарий
  для обоих target iPhone WebKit-проектов.
- Длинное название переносится без clipping; действие `Изменить` остаётся
  видимым и доступным с placement из TASK-093.
- No duplicate text/empty gap/overflow at `360 x 780`, `390 x 844`,
  `420 x 912`, `440 x 956`, `912 x 420`, `956 x 440`, `768 x 1024` and
  `1440 x 1200`.

## Expected initial failure verification
- Ordinary rows fail negative assertions on current generic badges.
- Professional row fails zero-count assertion because current JSX renders two
  `Профессиональный` badges.

## Test plan
- [x] Написать component row matrix до production-кода.
- [x] Добавить settings Playwright exact-count checks до production-кода.
- [x] Подтвердить expected red state на generic/double badges.
- [x] `cd frontend && npm run test:unit`
- [x] `cd frontend && npm run check:raw-colors`
- [x] `cd frontend && npm run test:e2e -- membership-catalog-settings.spec.ts`
- [x] `cd frontend && npm run test:e2e:iphone`
- [x] `cd frontend && npm run lint`
- [x] `cd frontend && npm run build`

## Regression barrier
Одна executable matrix должна запрещать любые badges для обычного и
переименованного Professional item и одновременно сохранять create behavior
selector/edit immutability.
Browser-level check защищает от двойного текста, пустого wrapper и overflow.

## Risks
- Неограниченный cleanup может случайно удалить Professional marker из
  eligible lists продажи/перевода или других интерфейсов TASK-070.
- Проверка по display name создаст второй источник backend behavior semantics.
- Global text assertions могут спутать list marker и create-form option.
- Удаление shared labels повредит client purchase/transfer screens.

## Stop conditions
Остановиться и не писать production-код, если:
- TASK-093 не merged в `origin/main`;
- изменение требует удалить или изменить Professional marker вне catalog list rows;
- Professional presentation приходится выводить из имени или frontend role inference;
- scope расширяется в backend privileges/catalog contracts;
- task не переведена в implementation или worktree/branch невалиден.

## Ready for Codex execution
no — completed 2026-07-30 in commit `aad79ac`

## Completion record
- Source task moved to `/backlog/done/TASK-100-membership-catalog-list-type-badges.md`.
- Integrated `main` validation passed: lint, build, raw-color check, 404 unit tests and 202 Playwright tests.
- No backend or database contract changed; no migration is required.
