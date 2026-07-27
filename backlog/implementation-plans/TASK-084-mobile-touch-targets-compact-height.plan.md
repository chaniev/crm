# Implementation Plan: TASK-084 Довести touch targets и compact-height shell до mobile acceptance

## Source task
/backlog/implementation/TASK-084-mobile-touch-targets-compact-height.md

## Implementation branch
feature/TASK-084-mobile-touch-targets-compact-height

Branch rules:
- до изменения кода использовать `.agents/skills/task-worktree/SKILL.md` и создать отдельный worktree из актуального `origin/main`;
- подтвердить branch, clean status, worktree ownership и ancestor relationship с `origin/main`;
- не включать TASK-085–TASK-089 или unrelated refactoring;
- не создавать локальную альтернативу foundation из TASK-090.

## Goal
Закрыть остаточные mobile acceptance нарушения после TASK-090: все affected
touch controls имеют measured target минимум `44 x 44 CSS px`, iPhone form
controls используют текст минимум `16px`, а coarse-pointer compact-height shell
и temporary surfaces остаются достижимыми при reduced visual viewport.

## Current understanding
- TASK-090 уже выпустил shared primitives, semantic tokens и responsive test
  infrastructure; эта задача выполняет migration/sweep всех оставшихся call sites.
- Подтверждённые дефекты находятся в `EntityLocatorBar`, `CompactFilterPanel`,
  client pagination, schedule refresh и связанных screen overrides в
  `frontend/src/App.css`.
- Новый screenshot 2026-07-27 подтверждает отдельный класс geometry-регрессии:
  видимая подпись client action `Открыть` клиппируется до неполного слова.
  Конкретную desktop split geometry исправляет TASK-089, а этот sweep защищает
  button labels на mobile/coarse и остальных inventoried routes.
- Backend contracts, роли и permissions не меняются. SuperAdministrator matrix
  используется только как regression fixture.
- UX-контракт берётся из source task, `docs/MOBILE_UI_CONTRACT.md` и
  `crm-mobile-first-ui`; перед кодом `ui-designer` уточняет только локальные
  geometry conflicts, не меняя workflow.

## Execution steps
1. Подготовить отдельный worktree/branch и зафиксировать baseline:
   - выполнить required git checks;
   - запустить существующие shared unit tests и affected responsive specs;
   - собрать machine-readable inventory интерактивных элементов по Home,
     Schedule, Clients, Groups, Settings и Audit.
2. До production-кода добавить/обновить unit/component tests:
   - shared component tests для clear/filter/close/button semantics;
   - assertions на shared touch-size ownership classes и отсутствие локальных
     `36–42px` overrides;
   - component tests focus return и Escape/back contract temporary surfaces.
3. До production-кода расширить Playwright integration/geometry tests:
   - измерять bounding boxes targets и gaps на `360 x 780`, `390 x 844`,
     `420 x 912`, `440 x 956`, `768 x 1024`;
   - проверять, что visible action labels не имеют text clipping/ellipsis,
     а разрешённый icon-only fallback сохраняет полное accessible name;
   - проверять font-size inputs/selects/textareas, page overflow, safe-area
     clearance и compact-height shell на `912 x 420`, `956 x 440`;
   - повторить matrix с SuperAdministrator fixture без Finance.
4. Запустить новые tests до реализации и сохранить ожидаемые падения на
   известных `36/40/42px` call sites, `2.5rem` pagination и clear/close targets.
5. Исправлять сначала shared primitive/theme CSS:
   - дать `EntityLocatorBar` clear control фактический target `44 x 44`;
   - привести `CompactFilterPanel` inline/sheet inputs, buttons, segmented
     controls и iPhone text к contract;
   - закрепить общий close-control и temporary-surface contract;
   - не увеличивать визуальную иерархию за пределами нужной hit area.
6. Мигрировать оставшиеся affected call sites:
   - client pagination;
   - schedule refresh;
   - group edit rows;
   - header/profile/menu, tabs, filters, settings/audit actions, если inventory
     подтверждает нарушение.
7. Исправить coarse-pointer + compact-height media behavior, dynamic viewport,
   safe-area padding и scroll ownership temporary surfaces без nested scroll trap.
8. После каждого slice повторять focused unit + Playwright tests; затем запустить
   полный frontend regression suite, lint, build и iPhone WebKit checks.
9. Отдельно записать, какие Safari chrome/software-keyboard/home-indicator и
   physical-device проверки остались недоступны; automation не выдавать за
   physical-device evidence.

## Preferred implementation strategy
1. Measured failing acceptance tests.
2. Shared primitive correction.
3. Affected call-site migration.
4. Compact-height/safe-area closure.
5. Role matrix and full regression verification.

Изменения делать малыми slices. Screen override допустим только для предметной
geometry, если shared primitive уже соответствует contract.

## Files likely to change
- `frontend/src/features/shared/EntityLocatorBar.tsx`
- `frontend/src/features/shared/ux.tsx`
- `frontend/src/features/shared/ux.test.tsx`
- `frontend/src/features/shared/TemporarySurfaceFooter.tsx`
- `frontend/src/features/schedule/GroupScheduleScreen.tsx`
- `frontend/src/features/clients/list/ClientsResults.tsx`
- `frontend/src/features/groups/GroupManagement.tsx`
- `frontend/src/App.css`
- `frontend/e2e/iphone-target-devices.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`
- additional affected component/spec files discovered by the initial inventory

## Constraints
- React 19, TypeScript, Mantine, Onest и released `--crm-*` tokens сохраняются.
- Не менять information architecture, backend permissions или domain semantics.
- Desktop density можно сохранить только без снижения touch acceptance на
  coarse-pointer profiles.
- Fixed/sticky spacing должно складывать normal spacing и safe-area inset.

## Out of scope
- Client-specific search workflow TASK-085.
- Groups search/paging TASK-086.
- Schedule effective scope TASK-087.
- Permission redirect wiring TASK-088.
- Client desktop split TASK-089.

## Required test coverage

### Unit/component tests
- Shared controls expose accessible names, correct focus behavior and ownership
  classes for minimum target sizes.
- `EntityLocatorBar` clear/filter actions and temporary-surface close/footer
  actions retain their operations and order.
- `CompactFilterPanel` keeps immediate/staged semantics unchanged while shared
  sizing changes.

### Integration tests
- Backend integration tests are not applicable because no API/domain contract
  changes.
- Frontend integration barrier is Playwright geometry/behavior coverage across
  representative routes, roles and orientation changes.
- Tests are written before CSS/production changes and must first fail on the
  named baseline violations.

### UI/e2e tests
- No target below `44 x 44`, independent gap below `8px`, or iPhone form text
  below `16px`.
- No visible action label is clipped to an incomplete word; icon-only responsive
  fallback keeps the exact operation name.
- No horizontal page overflow at `360/390/420/440`.
- Compact-height uses mobile/coarse shell and reachable dynamic-viewport surfaces.
- SuperAdministrator navigation remains Home/Schedule/Clients/Groups + allowed
  overflow, without Finance.

## Test plan
- [ ] New shared unit/component tests fail for expected baseline reasons.
- [ ] New geometry specs fail on known undersized controls.
- [ ] Focus return, Escape/back and visible focus pass.
- [ ] `npm run test:unit`
- [ ] affected Playwright specs
- [ ] `npm run test:e2e:iphone`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Simulator/physical-device residual checks documented.

## Regression barrier
Automated bounding-box/font-size/overflow/label-clipping checks in the required
viewport matrix, shared component tests and the SuperAdministrator navigation
fixture must remain green. No task completion claim without these automated
barriers and an explicit device-evidence caveat.

## Risks
- A broad CSS selector can unintentionally reduce desktop density or alter many screens.
- Enlarged hit areas can create toolbar overflow unless action collapse order is preserved.
- Browser emulation cannot prove real Safari visual viewport/home-indicator behavior.

## Stop conditions
Остановиться и не писать дальнейший код, если:
- исправление требует новой screen-specific design system;
- обнаружено противоречие approved workflow, которое должен решить `ui-designer`;
- изменение затрагивает backend roles/permissions or domain rules;
- scope выходит за acceptance sweep в redesign отдельных screens;
- task worktree или branch не соответствует declared branch.

## Ready for Codex execution
yes
