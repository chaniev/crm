# TASK-190: verification

## Decision and scope

Владелец в диалоге 23.10.2026 принял вариант B ADR-0002 и общее чтение.
Task branch: `codex/TASK-190-super-admin-branch-hall-creation`, base `297f001`.

## Regression evidence

- До production edits `BranchSettingsApiTests`: 18 failed / 14 passed.
  Foreign/global Administrator mutations возвращали success или field 400
  вместо scope 403; session не содержала branchSettingsActions.
- PostgreSQL red: 3 failed. Audit injector увидел уже вставленную entity;
  независимый DbContext после failure находил branch/hall. Positive create/audit
  прошли, foreign mutation завершилась 200 вместо 403.
- Frontend red после корректировки fixtures: 11 failed / 37 passed.
  Отсутствовал mapped actions contract, SA tab, independent action gates и
  parent error внутри modal. Existing tests сохраняли исходные доступные controls.
- Targeted backend после исправлений: 43 passed (до дополнительных pure-policy
  и own-missing-parent случаев). Final harness запускает весь backend suite.
- Targeted frontend auth/branches/panels: 52 passed; дополнительные action/revoke
  проверки settings: 46 passed.
- New Playwright spec: 21 passed (Chromium, Air WebKit, Pro Max WebKit), включая
  success/reload, failure/retry, focus и compact-height. Дополнительная red
  проверка hall-success focus воспроизвела удаление trigger при reload; после
  сохранения отображённых данных во время refresh все 21 passed.

## Runtime and limits

BranchSettingsPostgreSqlTests запускает изолированный PostgreSQL 17 container,
реальный ASP.NET Core backend через WebApplicationFactory, cookie login/CSRF,
два филиала и два зала, независимые GET и DbContext audit assertions, foreign
Administrator mutation rejection. Это runtime evidence отдельно от browser
fixtures. Созданные контейнеры завершаются через Testcontainers disposal.

[Visual comparison](visual-review.md). Simulator/physical Safari, настоящая
клавиатура и меняющийся viewport browser chrome не проверены.

## Final candidate

- Candidate: `6b5e39c8bb7fd0e739418d650dc6335a6cf1f2d5`; tree `17ade9d19c40226a78d6b62e8de0b3ea95b2f28f`; working tree clean.
- `python3 scripts/harness/verify_change.py --base origin/main --task-id TASK-190 --report .artifacts/verification/TASK-190.json` — passed, 25 checks; manual rendered comparison confirmed.
- Backend: format, Release build without warnings, 635 tests, dependency audit passed.
- Frontend: npm ci/audit, lint, TypeScript, resource/token guards, 745 tests in 76 files, production build passed. Audit passes the configured high-severity threshold; two existing moderate dev-dependency findings remain in Vitest/@vitest/mocker (GHSA-qxg6-89mg-rqv8, GHSA-xp26-3454-mjgp). Dependency versions were unchanged. See [audit output](dependency-audit.txt).
- [Canonical report](candidate-harness.json) preserves original candidate/contract paths before archival.
- `frontend.e2e.branch-hall-creation`: 21 passed.
- `frontend.e2e.settings-tab-title-duplication`: 6 passed.
- `frontend.e2e.settings-group-types`: 10 passed.
- `frontend.e2e.membership-catalog-settings`: 5 passed.
- `frontend.e2e.membership-sale-pricing`: 16 passed.
- `frontend.e2e.group-schedule-workflow`: 10 passed.
- `frontend.e2e.iphone-settings`: 8 passed.
- `frontend.e2e.stage12-settings`: 1 passed.
- `frontend.e2e.responsive-main-screens-settings`: 8 passed.
- `frontend.e2e.touch-target-inventory-settings`: 8 passed.

Initial full pass stopped at npm network ETIMEDOUT; retry completed. Subsequent browser checks found test-only stale selectors (Mantine listbox and identity-only group edit) and the old touch-inventory calendar fixture; these were synchronized before the final candidate. The shared lookup fixture now handles the schedule lookup and permits React request retries; an existing App session-recovery test now waits for both the URL and rendered state, eliminating the observed transition race. Final required checks have no outstanding failures.

## Integration and review

The verified candidate was fast-forwarded to local main; task commits are reachable and the candidate/main trees matched. A closure commit moves task artifacts and updates requirement evidence; application trees remain unchanged, so runtime evidence is reused. Final review covered policy/action/target matrix, saved target ownership, shared GET compatibility, transaction boundaries, action revocation, modal error placement and consumer fixtures. No unresolved in-scope findings remain.
