# Implementation Plan: TASK-084 Довести touch targets и compact-height shell до mobile acceptance

## Source task
/backlog/done/2026-07-29/TASK-084-mobile-touch-targets-compact-height.md

Source status is `done`: implementation commit `3e20367` is present on
`origin/main`; the required lint, build, unit, Chromium inventory and target
iPhone WebKit barriers passed during the 2026-07-30 status audit. Real
Simulator/physical-device evidence remains explicitly unverified.

## Implementation status

Done. The implementation landed directly on `main` instead of the declared
task branch. Automated code acceptance is complete; this plan does not claim
physical-device Safari chrome, software-keyboard, home-indicator or safe-area
acceptance.

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
- Требование из backlog intake 2026-07-28 к machine-readable inventory
  полностью принадлежит TASK-084 и реализуется в рамках этого плана; отдельная
  follow-up task для него не создаётся.
- Подтверждённые дефекты находятся в `EntityLocatorBar`, `CompactFilterPanel`,
  client pagination, schedule refresh и связанных screen overrides в
  `frontend/src/App.css`.
- Новый screenshot 2026-07-27 подтверждает отдельный класс geometry-регрессии:
  видимая подпись client action `Открыть` клиппируется до неполного слова.
  Конкретную desktop split geometry исправляет TASK-089, а этот sweep защищает
  button labels на mobile/coarse и остальных inventoried routes.
- На `912 x 420` и `956 x 440` при coarse pointer используется именно mobile
  shell: desktop navbar скрыт, mobile bottom navigation видима, main резервирует
  её высоту вместе с safe-area inset, а secondary brand copy может скрываться.
- Известные clipping/horizontal-overflow нарушения client preview-open split на
  `1440 x 1200` не исправляются и не блокируют TASK-084: inventory записывает
  точечное исключение с `ownerTask: TASK-089`. Все остальные inventoried
  desktop routes/states остаются в clipping/focus/overflow barrier.
- Backend contracts, роли и permissions не меняются. SuperAdministrator matrix
  используется только как regression fixture.
- Geometry matrix выполняется по одному representative fixture для каждого
  уникального layout/state варианта; navigation/access semantics отдельно
  проверяются для SuperAdministrator, Administrator, HeadCoach и Coach без
  полного декартова произведения ролей, routes и viewports.
- UX-контракт берётся из source task, `docs/MOBILE_UI_CONTRACT.md` и
  `crm-mobile-first-ui`; перед кодом `ui-designer` уточняет только локальные
  geometry conflicts, не меняя workflow.
- Задача может завершить automated code acceptance без Simulator/physical
  iPhone только с явной caveat; в этом случае запрещено заявлять
  device-level acceptance для Safari chrome, keyboard, safe area и home
  indicator.

## Execution steps
1. Подготовить отдельный worktree/branch и зафиксировать baseline:
   - выполнить required git checks;
   - запустить существующие shared unit tests и affected responsive specs;
   - собрать machine-readable inventory интерактивных элементов по Home,
     Schedule, Clients, Groups, Settings и Audit в формате из раздела
     `Measurement and inventory contract`.
2. До production-кода добавить/обновить unit/component tests:
   - shared component tests для clear/filter/close/button semantics;
   - assertions на shared touch-size ownership classes и отсутствие локальных
     `36–42px` overrides;
   - component tests focus return и Escape/back contract temporary surfaces.
3. До production-кода расширить Playwright integration/geometry tests:
   - измерять bounding boxes targets и gaps на `360 x 780`, `390 x 844`,
     `420 x 912`, `440 x 956`, `768 x 1024`;
   - на `1440 x 1200` проверять clipping, visible focus и page/container
     overflow без требования mobile target size для fine-pointer desktop;
   - проверять, что visible action labels не имеют text clipping/ellipsis,
     а разрешённый icon-only fallback сохраняет полное accessible name;
   - проверять font-size inputs/selects/textareas, page overflow, safe-area
     clearance и compact-height shell на `912 x 420`, `956 x 440`;
   - выполнить geometry checks на representative fixtures для уникальных
     layouts/states;
   - отдельно проверить navigation/access matrix для SuperAdministrator,
     Administrator, HeadCoach и Coach; SuperAdministrator fixture не содержит
     Finance.
4. Запустить новые tests до реализации и сохранить ожидаемые падения на
   известных `36/40/42px` call sites, `2.5rem` pagination и clear/close targets.
   Известный client preview-open desktop split записать как исключение
   `TASK-089`, а не как TASK-084 failure.
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
7. Исправить coarse-pointer + compact-height media behavior: скрыть desktop
   navbar, сохранить mobile bottom navigation и её safe-area reservation,
   обеспечить dynamic viewport, safe-area padding и scroll ownership temporary
   surfaces без nested scroll trap.
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

## Measurement and inventory contract

Playwright формирует machine-readable JSON inventory и прикладывает его к test
artifacts. Реализация inventory, tracked allowlist и regression assertions
входит в обязательный scope TASK-084. Одна запись имеет формат:

```json
{
  "route": "/clients",
  "state": "preview-open",
  "role": "SuperAdministrator",
  "pointerMode": "fine",
  "viewport": { "width": 1440, "height": 1200 },
  "locator": "role=button[name='Открыть']",
  "measuredBox": { "x": 0, "y": 0, "width": 0, "height": 0 },
  "gap": {
    "nearestLocator": "role=button[name='Ещё']",
    "distancePx": 0,
    "kind": "independent"
  },
  "fontSizePx": 14,
  "exception": {
    "criterion": "label-clipping",
    "reason": "Known client preview-open desktop split geometry",
    "ownerTask": "TASK-089"
  }
}
```

Rules:
- `locator` использует stable role/name или test id, а не CSS hierarchy;
- `measuredBox` относится к effective target, который получает операцию:
  button/link/input либо полная associated label area, если вся она
  действительно активирует control;
- `44 x 44` и independent `8px` применяются к mobile/coarse profiles и touch
  tablet `768 x 1024`; fine-pointer `1440 x 1200` сохраняет desktop density и
  проверяется на clipping, focus и overflow;
- расстояние independent targets — кратчайшее edge-to-edge расстояние между
  measured rectangles; overlapping independent hit areas дают `0px`;
- отдельные операции требуют gap минимум `8px`; настоящий composite control
  (`tablist`, segmented control, pagination или поле со встроенным clear)
  может не иметь внутреннего gap, но каждый target остаётся минимум `44 x 44`,
  операции не имеют неоднозначного hit ownership, а `gap.kind` равен
  `composite`;
- `fontSizePx` обязателен для input/select/textarea и равен `null` для
  неприменимых controls;
- `exception` равен `null` для прошедшей записи. Любое исключение называет
  criterion, конкретную причину и owning task; exception берётся только из
  tracked Playwright allowlist, попадает в runtime inventory и не создаётся
  динамически из результата измерения; silent skips запрещены.

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
- Client desktop split TASK-089, включая известные `1440 x 1200`
  preview-open clipping/horizontal-overflow нарушения; они остаются явным
  inventory exception до реализации TASK-089.

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
  fallback keeps the exact operation name, кроме явного `TASK-089` exception
  для client preview-open desktop split.
- No horizontal page overflow at `360/390/420/440`.
- At `1440 x 1200`, inventoried states pass clipping, visible-focus and
  page/container-overflow checks, кроме явного client preview-open exception
  owned by `TASK-089`.
- Compact-height hides desktop navbar, keeps mobile bottom navigation and
  provides reachable dynamic-viewport surfaces.
- SuperAdministrator navigation remains Home/Schedule/Clients/Groups + allowed
  overflow, without Finance.
- Administrator, HeadCoach and Coach navigation/access semantics remain
  consistent with their backend session fixtures.

## Test plan
- [x] New shared unit/component tests cover the corrected shared contracts.
- [x] New geometry specs cover the known undersized-control baseline.
- [x] Focus return, Escape/back and visible focus pass.
- [x] `npm run test:unit`
- [x] affected Playwright specs
- [x] `npm run test:e2e:iphone`
- [x] `1440 x 1200` clipping/focus/overflow matrix
- [x] navigation/access fixtures for all four roles
- [x] `npm run lint`
- [x] `npm run build`
- [x] Simulator/physical-device residual checks documented as unverified.

## Regression barrier
Automated bounding-box/font-size/overflow/label-clipping checks in the required
viewport matrix, shared component tests and the SuperAdministrator navigation
fixture must remain green. The only predeclared desktop exception is the
client preview-open split owned by `TASK-089`; it must remain visible in the
inventory and cannot become a broad route skip. Automated barriers plus an
explicit device-evidence caveat allow code completion, but not a claim of
Simulator/physical-device acceptance.

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
no — implementation completed
