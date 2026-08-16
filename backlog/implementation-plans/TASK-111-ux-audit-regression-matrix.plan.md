# Implementation Plan: TASK-111 Расширить Playwright-регрессию по UX-аудиту 2026-08-02

## Source task
/backlog/implementation/TASK-111-ux-audit-regression-matrix.md

## Implementation branch
fix/TASK-111-ux-audit-regression-matrix

Branch rules:
- перед изменением test-кода применить `task-worktree` и создать отдельный
  worktree с этой branch напрямую от актуального `origin/main`;
- primary repository оставить на `main`; до первой правки подтвердить repo
  root, active branch, clean status, worktree list и
  `git merge-base --is-ancestor origin/main HEAD`;
- не брать test/UI-код из незамерженных TASK-106, TASK-107, TASK-109 или
  TASK-110 и не основывать branch на их ветках;
- не включать в branch UI-исправления, backend-код, новые permissions либо
  unrelated test refactoring;
- до project-code changes подтвердить, что active branch —
  `fix/TASK-111-ux-audit-regression-matrix`.

## Goal
Сделать UX-аудит 2026-08-02 исполняемым regression contract: Playwright и
machine-readable touch inventory должны падать при возврате подтверждённых
attendance, settings, audit, desktop schedule и shared profile regressions,
различать page overflow и потерю decision-data и честно отделять browser
emulation от device-only acceptance.

## Planning eligibility and risk
- Задача low risk и `Safe for Codex: yes`: меняется только frontend test
  harness и automated regression coverage.
- Scope локализован в `frontend/e2e`, test-only fixtures/helpers и, если
  понадобится machine-readable matrix validator, `frontend/src/test`.
- Backend/API/domain/permissions contracts не меняются; существующие role
  fixtures должны следовать текущим session/backend contracts.
- Critical clarification questions отсутствуют. Нерешённая navigation naming
  decision из TASK-103 явно исключена из assertions.
- Реалистичный regression barrier есть: focused Chromium suites, полный touch
  inventory, target-iPhone WebKit projects, lint/build/unit и negative-control
  проверки test-only geometry/matrix helpers.

## Current understanding
- Planning baseline: `main == origin/main` at
  `d0d65dc19411e8ed9c12c3ef0844910a09bea0ea`.
- TASK-104 уже merged и добавил attendance assertions для readable date,
  `44px` controls, above-fold first action, overflow и target iPhone WebKit.
  TASK-111 расширяет этот contract на полную заданную matrix, не переписывая
  TASK-104.
- TASK-106 и TASK-107 находятся в `/backlog/implementation`; их планы уже
  определяют будущие schedule decision-data и audit pagination/focus names.
- TASK-109 и TASK-110 пока находятся в `/backlog/tasks-ready`; TASK-111 не
  должен реализовывать их settings/profile UI fixes вместо owning tasks.
- `frontend/playwright.config.ts` уже содержит отдельные WebKit projects
  `iphone-air-webkit` (`420 x 912`) и `iphone-17-pro-max-webkit`
  (`440 x 956`) на iPhone profile с touch и `deviceScaleFactor: 3`.
- `frontend/e2e/touch-target-inventory.spec.ts` уже выполняет матрицу
  `360x780`, `390x844`, `420x912`, `440x956`, `768x1024`, `1440x1200`,
  `912x420`, `956x440`, измеряет `44 x 44px`, gaps, input font size,
  label clipping и page overflow, но route inventory перечисляет только
  representative controls.
- Settings inventory сейчас включает только `Добавить абонемент` и
  `Обновить`; tabs, branch/catalog select и edit controls не перечислены.
- Audit inventory сейчас включает только `Обновить` и `Фильтры`; pagination
  controls и three modal close paths отсутствуют. Current app baseline ещё
  использует default Mantine pagination и timer-owned focus recovery; TASK-107
  является source task для UI correction.
- Shared header profile trigger находится в
  `frontend/src/features/shared/Header.tsx`, но не входит в inventory.
- `group-schedule.spec.ts` уже проверяет несколько overlapping cards и
  document overflow, но не доказывает доступность полного start/end,
  group и hall/trainer decision-data для dense parallel fixture.
- Existing suites дублируют локальные `expectNoHorizontalScroll` и geometry
  snippets. TASK-111 не должен превращаться в общий refactor; extraction
  допускается только для маленького test-only contract, который напрямую
  нужен полной matrix.

## UX regression contract

### Users and roles
- Attendance: `Coach` как основной task user; один smoke под
  `Administrator` или `HeadCoach` использует уже разрешённый backend scope и
  не создаёт локальную permission matrix.
- Settings: `HeadCoach`/`Administrator` только для доступных им tabs/actions;
  не делать вывод о доступе по названию role или tab.
- Audit: `SuperAdministrator`, `HeadCoach` или `Administrator` с
  `canViewAuditLog`; permission-restricted user не должен отправлять audit
  requests.
- Schedule: `Coach` и/или `HeadCoach` с response, полученным через существующий
  `/api/schedule/groups` contract.
- Profile trigger: любой authenticated user; semantics не зависят от role.

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

| Surface | Required regression contract | Owning suite |
|---|---|---|
| Attendance | readable selected date; group/date/previous/today/next/refresh and first mark action `>=44px`; first mark action above bottom navigation or inside compact viewport; no page overflow | `attendance.spec.ts` plus `iphone-target-devices.spec.ts` |
| Settings | every visible tab, scope/branch select, refresh, create and representative edit `>=44px`; visual/task focus order is scope → actions → content; no action-only wrapped row or page overflow | existing TASK-109 settings Playwright spec plus touch inventory |
| Audit | pager nav and stable previous/next/page names; each pager control `>=44px`; Escape, overlay and explicit close return focus to exact details trigger without arbitrary timeout; no pager/page overflow | TASK-107 audit specs plus target-iPhone/touch inventory |
| Desktop schedule | for each event in dense parallel fixture, start/end, group and hall/trainer are readable directly or available through one obvious keyboard-operable disclosure; no page overflow | `group-schedule.spec.ts` at `1440 x 1200` |
| Shared profile | profile trigger `>=44 x 44px`, stable accessible name, popup/expanded semantics, keyboard activation, Escape focus return and no overlap/focus clipping | TASK-110 affected spec plus touch inventory |
| Cross-cutting | page overflow and internal decision-data/clipping are reported as different criteria; device-only gaps are emitted explicitly | matrix validator and affected suites |

## Dependencies and sequencing
- TASK-104 is merged and is a hard regression baseline.
- TASK-106, TASK-107, TASK-109 and TASK-110 own the corresponding product/UI
  behavior. TASK-111 may formalize coverage only after each required contract
  is merged into `origin/main`, or may land compatible test-only coverage in
  the same integration sequence after those branches merge.
- Never cherry-pick product code from an unmerged dependency branch into
  TASK-111. If a required dependency is not on `origin/main`, mark only that
  matrix row pending and stop before claiming a green full matrix.
- TASK-103 remains in `needs-clarification`. Do not add assertions for new
  attendance route/navigation naming until that product decision is resolved;
  this does not block the geometry/task-flow matrix listed above.
- If the dependency implementation creates a dedicated, narrower spec, extend
  that final spec rather than duplicating its mocks in a second large suite.
- TASK-111 does not add or modify database schema, backend tests, Docker stack
  or deployment configuration.

## Execution roles
1. Coordinating agent applies `task-worktree`, verifies dependencies and owns
   the branch/worktree lifecycle.
2. `test-automator` owns the test-only matrix, unit contract for any extracted
   helper, Playwright additions, expected-red evidence and flake review.
3. `react-specialist` is not needed unless a new test exposes a product defect;
   that defect must remain in its owning TASK rather than be fixed silently in
   TASK-111.
4. Coordinating agent verifies the final suite against this plan and
   `crm-mobile-first-ui` mobile acceptance criteria.

## Execution steps

### Phase 0 — isolated workspace and dependency gate
1. Read root/frontend `AGENTS.md`, source TASK, this plan,
   `crm-mobile-first-ui`, `react-best-practices` only if React code becomes
   relevant, and `task-worktree`.
2. Verify TASK-104 is present on `origin/main`; verify whether TASK-106,
   TASK-107, TASK-109 and TASK-110 are merged. Record exact commits and the
   final owning spec filenames after merge.
3. Create/resume the declared worktree and branch from current `origin/main`.
   Stop if the branch/worktree is ambiguous or dirty.
4. Run focused baseline before editing:
   - `cd frontend && npm run test:unit`;
   - `npm run test:e2e -- e2e/attendance.spec.ts e2e/group-schedule.spec.ts e2e/touch-target-inventory.spec.ts`;
   - final merged settings and audit owning specs;
   - `npm run test:e2e:iphone`.
5. Record baseline counts and failures. A dependency regression, browser
   installation problem, stale mock or port collision is not TASK-111 red
   evidence.

### Phase 1 — machine-readable test contract before harness changes
6. Before changing inventory/helpers, add a small unit-level matrix contract
   only if it directly drives the suites. Preferred shape:
   `frontend/e2e/ux-audit-regression-matrix.ts` plus
   `frontend/src/test/uxAuditRegressionMatrix.test.ts`.
7. The matrix must have stable requirement ids and directly shared viewport,
   surface and evidence metadata. Unit tests must reject:
   - a missing attendance/settings/audit/schedule/profile surface;
   - omission of `390x844`, `420x912`, `440x956`, `912x420` or `956x440`
     from a requirement that mandates it;
   - duplicate requirement ids;
   - physical-device-only checks marked as automated/pass;
   - conflation of `page-overflow` and `decision-data` criteria.
8. Run this unit test before implementing the manifest/helper and retain the
   expected failure for missing/incomplete matrix entries. Then implement only
   the smallest test-only data/helper needed to make the unit contract pass.
9. If no shared matrix/helper is introduced, unit tests are genuinely not
   applicable because TASK-111 changes no production/pure business logic.
   Document that decision before E2E edits; do not add empty or tautological
   unit tests. Integration/Playwright coverage below remains mandatory and is
   the primary regression barrier.

### Phase 2 — integration/Playwright assertions before any product code
10. Expand `touch-target-inventory.spec.ts` so the route inventory enumerates
    all applicable controls, not only representatives:
    - settings tabs, branch/catalog scope select, refresh, create and a
      representative visible edit action;
    - audit previous/next/current-page controls using TASK-107 stable names;
    - shared profile trigger on authenticated routes;
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
17. Add the shared profile trigger to inventory and extend the final TASK-110
    test for `360/390/420/440px` plus compact landscape: actual hit area,
    no overlap, unclipped visible focus, stable accessible name,
    `aria-haspopup`/`aria-expanded`, Enter/Space and Escape focus return.
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

### Phase 3 — green and regression closure
21. Rerun the matrix unit test, affected Chromium specs, full touch inventory
    and both target-iPhone WebKit projects. Remove duplicated assertions only
    when one owning test still proves the exact criterion and the matrix points
    to it.
22. Run mandatory frontend validation from the TASK worktree:
    - `cd frontend && npm run test:unit`;
    - `npm run lint`;
    - `npm run build`;
    - `npm run test:e2e -- <all affected Chromium specs>`;
    - `npm run test:e2e:iphone`.
23. Run the focused suites at least twice after green to detect focus/geometry
    flake. No arbitrary timeout or broad retry increase may be used to hide a
    race.
24. Inspect generated touch-inventory JSON artifacts and confirm that every
    added control has route, role, state, viewport, pointer mode, measured box,
    gap and exception metadata. Any allowlist entry requires a named owner TASK
    and cannot hide TASK-111 acceptance failures.
25. Review the diff: only test code/test fixtures/test-only helpers and task
    artifacts may change; no frontend production, backend, bot, deploy,
    database or permission files.
26. Report device-only residual checks explicitly: Safari chrome expansion,
    software keyboard, safe-area/home-indicator interaction, Dynamic Island,
    one-handed reach and actual physical tap behavior remain unverified unless
    supported by iOS Simulator or physical-device evidence.

## Preferred implementation strategy
1. Dependency and baseline verification.
2. Test-only matrix/helper unit contract in red, if a shared helper is useful.
3. Touch inventory completeness and per-surface Playwright assertions.
4. Expected-red verification without product changes.
5. Green only on merged owning UI contracts.
6. Full Chromium/WebKit regression, flake rerun and artifact inspection.

## Files likely to change
- `frontend/e2e/touch-target-inventory.spec.ts`
- `frontend/e2e/attendance.spec.ts`
- `frontend/e2e/iphone-target-devices.spec.ts`
- `frontend/e2e/group-schedule.spec.ts`
- final TASK-109 settings Playwright spec, to be discovered after merge
- final TASK-107 audit Playwright spec(s), to be discovered after merge
- final TASK-110 profile-trigger Playwright spec, to be discovered after merge

Optional only when the data/helper directly drives tests and has meaningful
negative-control coverage:
- `frontend/e2e/ux-audit-regression-matrix.ts`
- `frontend/src/test/uxAuditRegressionMatrix.test.ts`

Files to inspect but not expected to change:
- `frontend/playwright.config.ts`
- `frontend/src/features/attendance/**`
- `frontend/src/features/settings/**`
- `frontend/src/features/audit/**`
- `frontend/src/features/schedule/**`
- `frontend/src/features/shared/Header.tsx`
- backend authorization/API/domain code and tests

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
- Do not add assertions for unresolved TASK-103 navigation naming.
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

## Required test coverage

### Unit tests — before test-helper implementation
- If a machine-readable matrix/helper is extracted, add its unit test first
  and prove the incomplete/missing matrix fails.
- Cover required surface ids, viewport completeness, uniqueness, automated vs
  device-only classification and distinct overflow/decision-data criteria.
- Cover synthetic undersized target and compressed-decision-data negative
  controls.
- If no pure helper is introduced, record unit tests as not applicable because
  production/business logic is unchanged; do not create tautological tests.

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
- Final TASK-110 profile trigger scenario.

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

## Test plan
- [ ] TASK-104/106/107/109/110 dependency state and owning specs are recorded.
- [ ] Optional matrix/helper unit test is red before helper implementation and
      green afterward, or unit N/A is justified.
- [ ] Attendance passes the five-size Chromium matrix.
- [ ] Both target-iPhone WebKit projects pass with touch/iPhone/DPR evidence.
- [ ] Settings tabs/select/actions/edit pass geometry and focus/task order.
- [ ] Audit pager passes names, size, gap, state and three close-path focus.
- [ ] Dense desktop schedule exposes all required decision-data.
- [ ] Shared profile trigger is present in inventory and detects `<44px`.
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
unit validation is preferred when it directly parameterizes or indexes the
suites. It prevents the inventory from silently returning to a representative
subset and keeps device-only claims separate from automated evidence.

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

## Ready for Codex execution
yes — dependency-gated: full green completion waits for TASK-106, TASK-107,
TASK-109 and TASK-110 contracts to be merged into `origin/main`; TASK-103
navigation naming remains explicitly excluded.
