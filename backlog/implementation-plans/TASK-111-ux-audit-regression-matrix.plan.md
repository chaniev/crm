# Implementation Plan: TASK-111 Расширить Playwright-регрессию по UX-аудиту 2026-08-02

## Metadata
- source_task: /backlog/implementation/TASK-111-ux-audit-regression-matrix.md
- branch: fix/TASK-111-ux-audit-regression-matrix
- readiness: yes — dependency-free work may start; completion remains dependency-gated
- dependencies: TASK-106 for dense-schedule evidence; completed TASK-104/107/109/110 are baseline
- risk: low — test harness/evidence changes; product code only after a proven defect

## Goal
Сделать UX-аудит 2026-08-02 исполняемым regression contract: Playwright и
machine-readable touch inventory должны падать при возврате подтверждённых
attendance, settings, audit, desktop schedule и shared profile regressions,
различать page overflow и потерю decision-data и честно отделять browser
emulation от device-only acceptance.

## Planning eligibility and risk
- Задача low risk и `Safe for Codex: yes`: меняется только frontend test
  harness и automated regression coverage.
- Scope локализован в `frontend/e2e`, test-only fixtures/helpers и
  обязательный machine-readable matrix validator в `frontend/src/test`.
- Backend/API/domain/permissions contracts не меняются; существующие role
  fixtures должны следовать текущим session/backend contracts.
- Critical clarification questions отсутствуют. Navigation naming decision
  TASK-103 утверждена 2026-08-19, но остаётся исключена из TASK-111 до
  реализации target route/navigation contract.
- Реалистичный regression barrier есть: focused Chromium suites, полный touch
  inventory, target-iPhone WebKit projects, lint/build/unit и negative-control
  проверки test-only geometry/matrix helpers.

## UX regression contract

### Экраны, роли и обязательные viewport

| Экран или область | Основной профиль | Дополнительные role/scope checks | Restricted/edge contract | Обязательная automated matrix |
|---|---|---|---|---|
| **Экран «Посещения»** | `Coach` с назначенной группой | `Administrator` с backend-issued group grant даёт один scope smoke | Backend разрешает attendance всем текущим ролям, поэтому role-denied case нет; Coach без assignment или Administrator без grant проверяют empty/restricted scope | Coach: Chromium `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420`, `956 x 440`; WebKit `420 x 912`, `440 x 956`. Administrator smoke: Chromium `390 x 844` |
| **Экран «Настройки»** (`/settings`) | `HeadCoach` с backend `createRoleOptions=[Administrator, SuperAdministrator]`: все четыре вкладки и global branch selector | `SuperAdministrator`: три разрешённые вкладки и global selector; `Administrator`: две вкладки и fixed assigned branch | `Coach`: route недоступен и settings API requests не отправляются | HeadCoach: Chromium `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420`, `956 x 440`. SuperAdministrator/Administrator: Chromium `390 x 844`, `912 x 420`, `956 x 440`. Coach denial: Chromium `390 x 844` |
| **Экран «Журнал»** (`/audit`) | `Administrator` с backend `canViewAuditLog` | `HeadCoach` и `SuperAdministrator` проходят access-parity smoke без дублирования всей geometry matrix | `Coach`: route недоступен, `/api/audit-logs` и options requests не отправляются | Administrator: Chromium `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420`, `956 x 440`; WebKit `420 x 912`, `440 x 956`. Role parity/denial: Chromium `390 x 844` |
| **Экран «Расписание»** (`/schedule`) | `HeadCoach` с global dense parallel fixture | Coach scope behavior остаётся в owning TASK-106 tests | Role-denied case нет: Schedule доступен всем текущим ролям | Desktop Chromium `1440 x 1200` |
| **Шапка авторизованного приложения — меню профиля** | Любой authenticated user; current target-iPhone owning fixture — `HeadCoach` | Touch inventory может выполняться под `SuperAdministrator`; semantics role-invariant | Unauthenticated shell не показывает trigger | Existing eight-case touch inventory; WebKit `420 x 912`, `440 x 956` |
| **Все перечисленные экраны — сквозной regression contract** | Test system | — | Device-only criteria не могут иметь status `automated-pass` | Каждый requirement использует matrix своего экрана |

Таблица фиксирует test profiles, но не создаёт вторую
permission model. Manifest хранит `roleProfileId`/ссылку на owning
session fixture, а не копию всех permission booleans. Фактический
access и visible controls по-прежнему берутся из текущих backend/session
contracts (`permissions`, `allowedSections`, `createRoleOptions`, `branchId`,
attendance scope/grants), а не выводятся из имени роли.

### Automated viewport taxonomy

| Check | Required automated environment |
|---|---|
| Narrow guardrail | Chromium `360 x 780` where the owning task includes it |
| Attendance stress baseline | Chromium `390 x 844` |
| Target iPhone portrait | WebKit device projects at `420 x 912` and `440 x 956` |
| Portrait geometry cross-check | Chromium `420 x 912` and `440 x 956` |
| Compact height | Chromium/touch `912 x 420` and `956 x 440` |
| Settings required matrix | `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420`, `956 x 440` |
| Desktop schedule | Desktop Chromium `1440 x 1200` |
| Touch inventory | Existing eight-case `VIEWPORT_MATRIX` |

`page.setViewportSize()` in desktop Chromium is geometry coverage only. Only
the configured WebKit iPhone projects may be reported as target-iPhone
emulation; neither is physical iPhone/Safari acceptance.

### Evidence semantics
- Geometry assertions use the actual interactive hit box, not icon glyph or
  internal Mantine class dimensions.
- Touch targets are at least `44 x 44 CSS px`; independent adjacent targets
  retain at least `8px` measured separation.
- Focus assertions use role/name and `toBeFocused()` after observable close;
  no arbitrary timeout, sleep or fake success through delayed polling.
- Page overflow is measured through document/body scroll width versus
  viewport width. Decision-data loss is checked separately through complete
  accessible/visible data or one obvious disclosure action. A green overflow
  assertion must never imply that compressed content is readable.
- Screenshots may supplement diagnostics but never replace behavior,
  accessibility, focus, geometry or data assertions.
- Role/routes/allowed operations come from existing session/API test fixtures;
  no second permission model is introduced in Playwright.

### Required surface matrix

| Экран или область | Required regression contract | Owning suite |
|---|---|---|
| **Экран «Посещения»** | readable selected date; group/date/previous/today/next/refresh and first mark action `>=44px`; first mark action above bottom navigation or inside compact viewport; no page overflow | `attendance.spec.ts` plus `iphone-target-devices.spec.ts` |
| **Экран «Настройки»** | every visible tab, scope/branch select, refresh, create and representative edit `>=44px`; visual/task focus order is scope → actions → content; no action-only wrapped row or page overflow | existing TASK-109 settings Playwright spec plus touch inventory |
| **Экран «Журнал»** | pager nav and stable previous/next/page names; each pager control `>=44px`; Escape, overlay and explicit close return focus to exact details trigger without arbitrary timeout; no pager/page overflow | TASK-107 audit specs plus target-iPhone/touch inventory |
| **Экран «Расписание»** | for each event in dense parallel fixture, start/end, group and hall/trainer are readable directly or available through one obvious keyboard-operable disclosure; no page overflow | `group-schedule.spec.ts` at `1440 x 1200` |
| **Шапка авторизованного приложения — меню профиля** | profile trigger `>=44 x 44px`, stable accessible name, popup/expanded semantics, keyboard activation, Escape focus return and no overlap/focus clipping | existing TASK-110 evidence in `App.test.tsx`, `iphone-target-devices.spec.ts` and touch inventory; extend only for a proven uncovered criterion |
| **Все перечисленные экраны** | page overflow and internal decision-data/clipping are reported as different criteria; device-only gaps are emitted explicitly | mandatory matrix validator and affected suites |

## Dependencies and sequencing
- TASK-104 is merged and is a hard regression baseline.
- TASK-106, TASK-107, TASK-109 and TASK-110 own the corresponding product/UI
  behavior. TASK-111 may start in parallel and formalize the complete screen
  matrix immediately; dependency-sensitive executable evidence remains
  `dependency-pending` until the corresponding contract is stable and merged
  into `origin/main`.
- Never cherry-pick product code from an unmerged dependency branch into
  TASK-111. If a required dependency is not on `origin/main`, mark only that
  matrix row pending and stop before claiming a green full matrix.
- TASK-103 moved to `risky` with an approved standalone `/attendance`
  route/navigation model. Do not add assertions for that target model until
  TASK-103 implementation is integrated; this does not block the
  geometry/task-flow matrix listed above.
- If the dependency implementation creates a dedicated, narrower spec, extend
  that final spec rather than duplicating its mocks in a second large suite.
- TASK-111 does not add or modify database schema, backend tests, Docker stack
  or deployment configuration.

### Parallel implementation contract
- Simultaneous development of TASK-106, TASK-107, TASK-109, TASK-110 and
  TASK-111 is allowed. The dependency gate controls final integration order,
  not whether work may start in parallel.
- TASK-111 never depends on or cherry-picks product code from an unmerged task;
  it consumes only contracts integrated into `origin/main`.
- While owning tasks are in progress, TASK-111 may implement dependency-free
  work: the mandatory matrix/validator, attendance expansion and registration
  of already integrated TASK-110 profile evidence.
- Settings, audit and schedule entries may be declared in the manifest while
  their evidence is `dependency-pending`, but this status is not a pass and
  cannot satisfy the release barrier. Dependency-sensitive locators and final
  owning spec names are bound only to an approved stable contract or after the
  owning task is merged.
- Owning tasks retain responsibility for product code and their focused RED/
  GREEN regression. TASK-111 adds cross-screen completeness and may edit their
  final test spec after integration, but does not duplicate an already exact
  scenario and never fixes product behavior in its own branch.
- Expected concurrent conflicts are limited primarily to
  `touch-target-inventory.spec.ts`, `iphone-target-devices.spec.ts` and final
  owning specs. After each dependency reaches `origin/main`, update the
  TASK-111 baseline, resolve only test-contract conflicts and rerun the
  affected checks.
- Merge/closure order remains dependency-gated: TASK-111 may not be reported
  fully green, merged or moved to `done` until every required owning contract
  is integrated and every non-device-only matrix entry has executable passing
  evidence.

## Implementation sequence

### machine-readable test contract before harness changes
6. Before changing inventory/helpers, add the mandatory unit-level matrix
   contract. Required shape unless an equally small existing test-only module
   is proved to be a better direct owner:
   `frontend/e2e/ux-audit-regression-matrix.ts` plus
   `frontend/src/test/uxAuditRegressionMatrix.test.ts`.
7. The matrix must have stable requirement ids and directly shared screen,
   `roleProfileId`, viewport, evidence kind, owning spec and automation-status
   metadata. It references owning session fixtures/contracts instead of copying
   permission booleans. Unit tests must reject:
   - a missing attendance/settings/audit/schedule/profile surface;
   - omission of `390x844`, `420x912`, `440x956`, `912x420` or `956x440`
     from a requirement that mandates it;
   - duplicate requirement ids;
   - physical-device-only checks marked as automated/pass;
   - conflation of `page-overflow` and `decision-data` criteria.
8. Run this unit test before implementing the manifest/helper and retain the
   expected failure for missing/incomplete matrix entries. Then implement only
   the smallest test-only data/helper needed to make the unit contract pass.
9. The matrix/validator is not optional. It must reject a required
   `dependency-pending` entry at release validation, while allowing the entry
   to exist during parallel development without claiming automated pass.
   Integration/Playwright coverage below remains the primary rendered-behavior
   barrier.

### integration/Playwright assertions before any product code
10. Expand `touch-target-inventory.spec.ts` so the route inventory enumerates
    all applicable controls, not only representatives:
    - settings tabs, branch/catalog scope select, refresh, create and a
      representative visible edit action;
    - audit previous/next/current-page controls using TASK-107 stable names;
    - retain the existing shared profile trigger entry on authenticated routes
      and map it to TASK-110 evidence without duplicating the scenario;
    - retain existing routes, role/access checks, machine-readable JSON and
      empty allowlist policy.
11. Keep touch inventory measurement generic: actual target box, input font
    size, visible-label clipping, `44px` minimum, `8px` independent gap and
    page overflow. Do not locate by Mantine/CSS implementation classes when a
    role/name contract exists.
12. Make attendance coverage table-driven for Chromium geometry at
    `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420` and `956 x 440` while
    reusing existing API fixture and locators. For every case assert:
    - selected date remains complete/readable;
    - required controls and first mark action have `44 x 44px` hit areas;
    - first action is above mobile navigation in portrait or fully reachable
      inside the compact-height viewport;
    - document/body have no horizontal page overflow.
13. Preserve target-iPhone acceptance in
    `iphone-target-devices.spec.ts` for the two WebKit projects. Assert
    `hasTouch`, iPhone user agent, DPR and logical width before reporting these
    checks as target-device emulation. Do not run the entire Chromium matrix
    by repeatedly overriding the device project into desktop semantics.
14. Extend the final TASK-109 settings spec rather than copying its complete
    API mock. Across the required five sizes verify tabs/select/actions/edit
    geometry, scope → actions → content keyboard order, long scope label,
    compact-height reachability and absence of action-only wrap/overflow.
15. Extend the final TASK-107 audit specs:
    - stable pager navigation/control names, current and disabled semantics;
    - `44 x 44px` pager controls and `8px` gaps at mobile sizes;
    - Escape, overlay click and explicit close each return focus to the exact
      row trigger without arbitrary timeout;
    - page/filter state persists through open/close;
    - pager overflow and page overflow remain absent.
16. Extend `group-schedule.spec.ts` with a deterministic `1440 x 1200` dense
    parallel fixture. For every event assert a complete time range, group and
    hall/trainer either in the card or after one obvious disclosure action.
    If TASK-106 uses summary/Popover, verify accessible name, Enter/Space,
    visible focus, Escape/close focus return and every detail row; do not
    couple to private CSS classes or a chosen layout threshold.
17. Register existing TASK-110 profile evidence in the mandatory matrix:
    touch inventory owns actual hit area across its eight viewports;
    `iphone-target-devices.spec.ts` owns target-iPhone touch, popup semantics,
    Enter/Space, Escape and exact focus return; `App.test.tsx` owns the focused
    component semantics. Do not copy these scenarios. Extend the existing
    owning test only if comparison with the matrix proves a specific uncovered
    criterion such as overlap or focus clipping at a required viewport.
18. Add explicit negative controls for test-only geometry/matrix helpers:
    synthetic `32 x 32px` pager and `48 x 42px` profile boxes must produce
    `insufficient-target`; a document with no overflow but missing/truncated
    schedule decision-data must fail `decision-data`, not pass because the
    page fits.
19. Run all new focused tests before any product/React/CSS change. Valid red
    evidence is a missing matrix entry, undersized live control, missing
    stable name/focus return or absent decision-data. Broken mocks, missing
    selectors, arbitrary timing and unrelated baseline failures are invalid.
20. TASK-111 contains no product implementation phase. If a browser test is
    red because the merged UI contract is still wrong, stop and return the
    defect to TASK-106/107/109/110 (or create a separate backlog item); do not
    weaken the assertion or edit product code in this branch.

## Likely files and layers
- Playwright projects/config, UX inventory helpers and machine-readable evidence artifacts.
- Owning attendance/settings/audit/schedule/profile specs and validator unit tests.
- Product components only when a new regression proves a remaining implementation defect.

## Constraints
- Preserve React 19, TypeScript, Vite, Mantine 9 and Onest; do not add a test
  framework, browser library or component library.
- Reuse current Playwright fixtures/helpers and stable role/name/test-id
  contracts. Avoid private CSS class names except where an existing public
  test contract has no semantic locator.
- Backend owns roles, permissions, access scope, schedule data and audit
  semantics. Playwright must not derive or redefine them.
- Do not claim physical iPhone/Safari acceptance from emulation.
- Do not replace behavior/geometry assertions with screenshots.
- Do not equate no horizontal page overflow with readable decision-data.
- Do not add arbitrary sleeps/timeouts; wait for observable state.
- Do not add assertions for the approved but not yet implemented TASK-103
  navigation naming.
- Keep primary/frequent controls visible; inventory must not bless hidden
  overflow as a workaround for source-task acceptance.
- TASK-111 branch must remain test-only. A required product change is a stop
  condition, not implicit scope expansion.

## Out of scope
- UI/CSS/React fixes from TASK-103–TASK-110.
- Backend/domain/API/persistence/permission changes and backend tests.
- Component-test duplication of behavior already owned by TASK-104/106/107/
  109/110.
- New navigation naming or attendance route model.
- Screenshot baselines as the only regression signal.
- CI pipeline redesign, global fixture framework refactor or Playwright config
  replacement.
- Claims about physical Safari browser chrome, keyboard, safe areas or real
  tap accuracy without device evidence.

## Regression specification

### Unit tests — before test-helper implementation
- Add the mandatory machine-readable matrix/validator unit test first and
  prove the incomplete/missing matrix fails.
- Cover required surface ids, viewport completeness, uniqueness, automated vs
  device-only classification and distinct overflow/decision-data criteria.
- Cover synthetic undersized target and compressed-decision-data negative
  controls.
- The matrix unit contract is required even though production/business logic
  is unchanged; do not replace it with an empty or tautological test.

### Integration tests — before any product code
- Playwright is the mandatory integration layer for rendered geometry,
  accessible names, focus recovery, API-backed role routes and viewport
  behavior.
- Write/extend all affected Playwright scenarios before any product code. In
  this test-only TASK, product code must remain unchanged throughout.
- Run new scenarios against the baseline and record only criterion-specific
  expected failures.

### UI/e2e tests
- Attendance five-size Chromium matrix plus both target-iPhone WebKit projects.
- Settings tabs/select/actions/edit geometry and task/focus order.
- Audit pager naming/geometry and all three modal close paths.
- Desktop dense schedule full decision-data at `1440 x 1200`.
- Shared profile trigger geometry, semantics and focus recovery.
- Machine-readable touch inventory and separate page-overflow checks.

### Existing tests to update, not duplicate
- TASK-104 attendance workbench scenarios.
- Final TASK-106 schedule readability scenario.
- Final TASK-107 audit component/Playwright scenarios.
- Final TASK-109 settings scope/touch-order scenario.
- Existing TASK-110 profile trigger scenarios are mapped as evidence and are
  changed only for a proven uncovered criterion.

### Expected initial failure
- Matrix/helper unit test fails before missing requirements are registered.
- On a pre-fix dependency baseline, browser tests fail specifically on
  `32 x 32px` audit pagination, timer/incomplete close-path focus, undersized
  settings/profile controls or missing schedule decision-data.
- If the owning fixes are already merged, use test-only negative controls to
  prove sensitivity; do not damage production code merely to manufacture red.
- Mock/setup/browser failures do not satisfy the red phase.

### Manual-only checks
- Physical touch accuracy and one-handed reach.
- Safari chrome expand/collapse, software keyboard, safe-area/home-indicator
  and Dynamic Island behavior.
- Final visual scan quality at 200% zoom where automation cannot establish
  human readability. Manual checks supplement but never replace automated
  barriers.

### Validation and acceptance
- [ ] TASK-104/106/107/109/110 dependency state and owning specs are recorded.
- [ ] Mandatory matrix/validator unit test is red before implementation and
      green afterward; release validation rejects every required pending row.
- [ ] Attendance passes the five-size Chromium matrix.
- [ ] Both target-iPhone WebKit projects pass with touch/iPhone/DPR evidence.
- [ ] Settings tabs/select/actions/edit pass geometry and focus/task order.
- [ ] Audit pager passes names, size, gap, state and three close-path focus.
- [ ] Dense desktop schedule exposes all required decision-data.
- [ ] Existing TASK-110 profile evidence is mapped without duplication;
      inventory still detects a profile trigger `<44px`.
- [ ] Page overflow and internal decision-data failure are separate criteria.
- [ ] Touch inventory artifacts contain complete metadata and no unjustified
      allowlist entries.
- [ ] Full unit, lint, build, affected Chromium and iPhone WebKit commands pass.
- [ ] Focus/geometry suites pass on a second run without timeout/retry masking.
- [ ] Device-only residual checks are listed without false pass claims.

## Regression barrier
Primary barrier: the affected Playwright suites plus
`touch-target-inventory.spec.ts` must execute the explicit surface/viewport
matrix and fail on undersized controls, broken focus return, unreadable/missing
decision-data or page overflow.

Coverage-completeness barrier: a machine-readable requirement matrix with
unit validation is mandatory and indexes every required screen/criterion to
owning executable evidence. It prevents the inventory from silently returning
to a representative subset, rejects required pending rows at release and keeps
device-only claims separate from automated evidence.

Release barrier: full frontend unit/lint/build, affected Chromium specs and
both target-iPhone WebKit projects are green twice; generated inventory JSON
is reviewed; no product/backend files changed in TASK-111.

## Risks
- **Dependency drift:** locators/contracts may change while TASK-106/107/109/
  110 are implemented. Discover final semantic names after merge; never bind
  TASK-111 to an obsolete draft selector.
- **Duplicate coverage without completeness:** several green specs may still
  omit a surface. Keep one explicit matrix and map every criterion to an
  owning executable test.
- **Flaky focus checks:** async modal teardown can create false failures or
  false passes. Wait for dialog hidden and assert exact trigger focus without
  sleep or app-owned timeout.
- **Geometry false positives:** measuring glyph/span instead of interactive
  element gives wrong sizes. Measure the role-bearing target.
- **Viewport false claims:** desktop Chromium resized to iPhone dimensions is
  not WebKit touch acceptance. Keep reports and project selection explicit.
- **Permission duplication:** copied sessions can drift from backend. Reuse
  existing role fixtures and assert only backend-authorized routes.
- **Test suite bloat:** copying large API mocks across new specs increases
  maintenance. Extend the owning specs and use small local helpers only.
- **Masked internal clipping:** a page can have no horizontal scroll while
  schedule data is unreadable. Keep decision-data assertions independent.

## Stop conditions
Stop and do not write product code if:
- a required source-task contract is not merged into `origin/main` and green
  completion would require borrowing its unmerged branch;
- a new regression test exposes an actual UI defect that belongs to
  TASK-106/107/109/110;
- the final accessible name/task order differs from an approved source-task
  contract and cannot be derived from current code/tests;
- role or allowed-route fixtures conflict with backend session contracts;
- the test can pass only by weakening `44px`, focus, decision-data or overflow
  acceptance;
- scope expands into global Playwright/fixture/CI refactoring;
- a required claim needs physical-device evidence unavailable to automation.

Do not stop only because multiple frontend suites share fixtures or because
the matrix spans several roles and viewports; keep changes test-only and
phased.
