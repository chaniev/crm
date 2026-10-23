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

Полная проверка будет записана после canonical harness на committed candidate.
