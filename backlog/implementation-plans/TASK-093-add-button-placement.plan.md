# Implementation Plan: TASK-093 Унифицировать расположение и оформление кнопок добавления и обновления

## Source task
/backlog/implementation/TASK-093-add-button-placement.md

## Implementation branch
feature/TASK-093-add-button-placement

Branch rules:
- перед кодом использовать `.agents/skills/task-worktree/SKILL.md` и отдельный
  worktree из актуального `origin/main`;
- подтвердить clean status, ownership branch и active branch;
- не смешивать TASK-094 surface cleanup, TASK-095 copy removal или TASK-096
  trainer search с этой веткой;
- не переписывать group search/filter/paging, которым владеет TASK-086, и не
  удалять administrator widgets, которыми владеет TASK-092.

## Goal
Сделать create/add единственным визуально доминирующим primary action, а
refresh — единообразным frequent secondary action во всех list/registry и
settings workspaces, сохранив backend-owned visibility, loading и фактические
операции.

## Current understanding
- `EntityLocatorBar` уже имеет slots для frequent и primary actions, но
  `UsersListScreen` использует отдельный right-aligned wrapping `Group`,
  `GroupsSummaryBar` смешивает metrics и actions, а settings panels используют
  разные `SectionHeader` clusters.
- `Button`, `IconButton` и `RefreshButton` задают semantic variants не полностью
  единообразно: встречаются feature-specific brand colors, размеры `40/42/44/48`
  и разные mobile text/icon transitions.
- Management route matrix уже перечисляет Home, Schedule, Clients, Groups,
  Users, Audit, Finance и Settings, но не проверяет один non-wrapping action
  contract и semantic priority.
- UX/UI contract утверждён: locator → optional filters → refresh → create;
  actions без locator используют тот же shared cluster без пустой второй строки.

## UX/UI contract
- User/result: администратор, главный тренер или суперадминистратор сразу
  распознаёт create и refresh и выполняет их без переучивания между экранами.
- Primary: разрешённый create/add, видимый и единственный filled/accent action.
- Frequent: locator, filter trigger и refresh; refresh остаётся вторичным.
- Create и refresh имеют независимые backend/session permission sources:
  отсутствие create permission не скрывает разрешённый refresh.
- Visible label и accessible name остаются operation/entity-specific; shared
  recipe унифицирует semantic treatment и responsive presentation, но не
  подменяет предметную формулировку generic-текстом.
- Focus order: locator, clear, filters, refresh, create, active filters/results.
- На `360/390/420/440` и при coarse-pointer compact-height
  `912 x 420`/`956 x 440` create и refresh всегда icon-only `44 x 44px`,
  независимо от доступного свободного места; accessible name остаётся точным,
  используется один DOM control без responsive duplicate.
- На `768/1440` create и refresh показывают icon + text, когда locator сохраняет
  минимум `320/420px` и toolbar остаётся одной строкой.
- При нехватке ширины locator toolbar применяет фиксированный fallback:
  refresh теряет текст первым, затем полностью убирается из строки; create
  сохраняется видимым и только после удаления refresh может стать icon-only.
  Search не сжимается ниже установленного минимума, controls не переносятся и
  horizontal scrolling не используется.
- На no-locator mobile/compact-height screens create и refresh также всегда
  icon-only; dummy locator/filter не добавляются. На `768/1440` подписи
  возвращаются, если owning operational row остаётся одной строкой; при
  нехватке ширины refresh сворачивается раньше create.

## Dependencies and execution order
1. TASK-090 — done, shared mobile contract является source of truth.
2. TASK-084 — done; touch-target/compact-height foundation merged.
3. TASK-086 — done; эта ветка только
   адаптирует итоговый group locator к общему action recipe.
4. TASK-092 — должна быть merged до sweep administrator settings call site.
5. TASK-094 — semantic filter/locator surface baseline должна быть merged.
6. TASK-093.
7. TASK-096 использует выпущенный здесь no-filter locator/action API.
8. TASK-095 выполняется после этого sweep, чтобы copy removal не проектировал
   placement refresh заново.

## Execution steps
1. Создать isolated worktree и committed inventory
   `docs/ui-concept/TASK-093-action-inventory.md`: route/surface, owner
   `route/tab/section/recovery`, user operation, отдельные create и refresh
   permission sources, current/target visible labels и accessible names, target
   shared pattern, status `update/exclude` и причина исключения.
2. До production-кода добавить shared component tests:
   - один cluster с frequent actions перед primary;
   - один semantic primary и secondary refresh;
   - exact accessible names, loading/disabled forwarding и `44px` recipe;
   - locator с filters и без filters без dummy control;
   - single DOM/focus path при обязательном mobile/compact-height icon-only
     label;
   - `768/1440` icon + text и fallback `refresh text → refresh absent → create
     icon-only` без wrap или сжатия locator.
3. До production-кода обновить representative feature tests для Clients,
   Groups после TASK-086, Trainers, settings catalog/group types/branches/
   administrators, Schedule/Audit/Finance и Home/Attendance:
   - actions находятся в первом task area;
   - backend-denied create отсутствует;
   - refresh не меняет query/filter/permission semantics;
   - loading запрещает повторный refresh без скрытия recovery.
4. До production-кода расширить Playwright route matrix:
   - exact accessible names и semantic variants;
   - одна row по measured `y`/bounding boxes;
   - target `>=44 x 44`, gaps `>=8px`, no horizontal page scroll;
   - create/refresh icon-only на всех mobile/compact-height cases независимо от
     свободного места и восстановление подписей на `768/1440`;
   - Clients и Groups как locator cases, один no-filter list и settings tab.
5. Запустить новые tests и подтвердить ожидаемые падения из-за текущих wrapping
   groups, `40/42px` controls, feature colors и разных action hosts.
6. Добавить focused shared recipe, предпочтительно
   `TaskToolbarActions`/`TaskToolbarAction`, и подключить его в
   `EntityLocatorBar`; shared code владеет order, spacing, semantic variants,
   сохранением переданного exact accessible name в единственном DOM control и
   mobile icon-only behavior, но operation/entity-specific wording остаётся у
   owning feature.
7. Расширить `EntityLocatorBar` optional filter trigger contract: при отсутствии
   реальных filters кнопка и drawer contract не рендерятся.
8. Мигрировать inventory call sites небольшими slices:
   - locator screens используют slots shared action cluster;
   - no-locator screens используют тот же cluster в первой operational row
     своего owner;
   - только действия с одним owner и общим create/reload lifecycle объединяются
     в один cluster;
   - section-specific create/refresh operations остаются у своей section и не
     продвигаются в route header или другую вкладку;
   - route/section refresh не смешивается с error recovery `Повторить`:
     recovery остаётся в соответствующем state surface и не мигрирует в task
     toolbar;
   - empty state не дублирует уже видимый toolbar create: в одном task state
     остаётся один DOM control и один визуально доминирующий primary action.
9. Удалить только доказанно неиспользуемые feature action wrappers, sizes,
   colors и CSS exceptions; не менять domain handlers и data loading.
10. Запустить focused tests после каждого slice, затем full frontend unit,
    raw-color check, lint, build, affected Playwright и iPhone WebKit suites.

## Preferred implementation strategy
1. Executable inventory and red shared contracts.
2. Minimal shared action recipe.
3. Locator call sites.
4. No-locator/settings call sites.
5. Responsive/permission regression closure.

## Files likely to change
- `docs/ui-concept/TASK-093-action-inventory.md`
- `frontend/src/features/shared/EntityLocatorBar.tsx`
- new focused shared toolbar action file if inventory confirms the abstraction
- `frontend/src/features/shared/Button.tsx`
- `frontend/src/features/shared/IconButton.tsx`
- `frontend/src/features/shared/ux.tsx`
- `frontend/src/features/shared/ux.test.tsx`
- `frontend/src/features/clients/list/ClientsToolbar.tsx`
- `frontend/src/features/groups/GroupManagement.tsx` after TASK-086
- `frontend/src/features/users/UsersListScreen.tsx`
- `frontend/src/features/settings/MembershipCatalogSettings.tsx`
- `frontend/src/features/settings/SettingsScreen.tsx`
- `frontend/src/features/settings/BranchSettingsScreen.tsx`
- `frontend/src/features/settings/AdministratorsSettingsPanel.tsx` after TASK-092
- representative Schedule/Audit/Finance/Home/Attendance call sites from inventory
- `frontend/src/App.css`
- `frontend/e2e/responsive-main-screens.spec.ts`
- affected feature Playwright specs

## Constraints
- Backend/session/allowed-actions contracts remain the only permission source.
- Create и refresh permission/availability вычисляются независимо и не
  связываются одной frontend-веткой только из-за общего action cluster.
- One visually dominant primary action per task state.
- Один и тот же create operation не дублируется одновременно в toolbar и empty
  state.
- Primary create is never hidden in overflow/filter drawer.
- No horizontal toolbar scrolling, raw colors or feature-only geometry fixes.
- Preserve Mantine, Onest, Tabler Icons and existing handlers.
- No group search/paging, copy cleanup or settings widget removal in this branch.

## Out of scope
- Filter values/semantics and surface colors from TASK-094.
- Duplicate/service copy from TASK-095.
- Trainer search behavior from TASK-096.
- Forms, created entities, destructive/rare action redesign.
- Перенос или унификация error recovery `Повторить` как route/section refresh.
- Backend contracts, roles or permissions.

## Required test coverage

### Unit/component tests
- Shared action order, variants, labels, `44px` contract and optional filters.
- Permission-denied create при независимо доступном refresh,
  refresh loading/disabled и empty state без duplicate create.
- Representative locator, no-locator and settings action composition.

### Integration tests
- Backend integration tests are not applicable because API/business contracts do
  not change.
- Feature component tests and Playwright route matrix are the integration barrier
  for shared actions, screen state and existing handlers.
- Tests are written before production code and must first fail for the current
  placement/variant/geometry mismatch.

### UI/e2e tests
- Clients, final Groups, Trainers/no-filter representative and settings tab.
- `360 x 780`, `390 x 844`, `420 x 912`, `440 x 956`, `768 x 1024`,
  `1440 x 1200`, plus `912 x 420` and `956 x 440`.
- Focus order, exact accessible names, target/gap geometry and no overflow.
- Loading and one permission-restricted role path.

## Test plan
- [ ] Shared and representative component tests red before implementation.
- [ ] Playwright placement/geometry matrix red before implementation.
- [ ] `cd frontend && npm run test:unit`
- [ ] `cd frontend && npm run check:raw-colors`
- [ ] `cd frontend && npm run test:e2e -- <affected-specs>`
- [ ] `cd frontend && npm run test:e2e:iphone`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`

## Regression barrier
An executable route/surface inventory plus Playwright geometry matrix must fail
if create/refresh leaves the first task row, a second primary appears, a target
shrinks below `44px`, controls wrap, permission-hidden create returns, or a
feature color/size exception reappears.

## Risks
- Cross-screen sweep can accidentally absorb contextual or destructive actions.
- TASK-086/TASK-092 unmerged code would cause duplicated/conflicting work.
- A broad shared component can become an inflexible domain abstraction.
- Hiding text with duplicate responsive DOM can break focus/order; keep one DOM
  control and preserve its accessible name.

## Stop conditions
Остановиться, если:
- TASK-084, TASK-086, TASK-092 или TASK-094 required baseline is unavailable;
- inventory reveals contradictory action meaning requiring product redesign;
- a change would alter backend permission or operation semantics;
- scope expands into search/filter business logic, forms or destructive actions;
- task worktree/branch is invalid.

## Ready for Codex execution
yes, after TASK-092 and TASK-094 are merged into origin/main; TASK-084 and
TASK-086 are done
