# TASK-191 verification

Scope: accepted ADR-0003, REQ-USR-001/CLI-007; CLI-009 and BRN-001 preserved.
Branch: codex/TASK-191-administrator-client-branch-access. Base: 2462d8e.

## Regression evidence

- Backend initial isolation tests exposed foreign reads/writes. Focused suites after fixes: 128 passed; additional attention/refund actor races: 6 passed.
- PostgreSQL barriers cover transfer/reassignment vs write, durable messenger Sending and dispatch lease, unique-key race, audit rollback, photo snapshot/rollback/uncertain commit, exact transfer replay.
- Real_http_staff_and_bot_isolate_two_branches_and_transfer_without_sale uses Kestrel on an allocated TCP port plus disposable PostgreSQL17; cookie login/CSRF, A/B administrators and Telegram identities, shared query/denied card, 204/replay/new-key denial, one audit and no Sale/Refund. Passed.
- Frontend expected red: 3 tests exposed fallback GET after204 and stale title/modal on403/404. Targeted consumer run: 57 passed. Nested missing sale preserves parent/draft; late success after confirmed denial cannot restore PII.
- Browser spec: 19 passed, 2 intentional skips (the full Chromium viewport sweep does not repeat in native iPhone profiles); six behavior scenarios run in all3projects. Attention origin return initially failed and was added to existing history context; group/list origins re-fetch without old row.
- Bot stale callback tests replace card+keyboard with safe resource-unavailable text; explicit identity errors retain existing mapping.

## Review

Independent authorization review identified and corrected stale-actor secondary reads, unscoped hydration, attention mutation, refund expiry cleanup, Bot identity mismatch, final attendance Coach access, and branch response counts. Final bounded re-review found no substantial remaining defects after fresh group reload and role-safe final snapshots. Pending status-only conflict retains fresh SQL scope without waiting on the winner; Completed/expiry paths keep client locks.

## Rendered acceptance

Compared approved TASK-191 contract with implemented restricted390/420WebKit/1440 and compact912x420: generic title, safe alert, no client data/actions and visible focus on Back. Viewport sweep:360×780,390×844,420×912,440×956,912×420,956×440,768×1024,1440×1200. Native WebKit profiles420/440 retain iPhoneUA/touch/3x.

WebKit found bottom navigation covering transfer submit after validation; local modal now uses the existing layer-above-navigation pattern. Failure/retry works in all profiles.

Physical Safari, Simulator, actual browser chrome, safe-area inset hardware and software keyboard were not tested. Settled transfer success420WebKit/desktop matches the approved existing components; no old row/card/overlay remains. Weakest retained design choice: transient success notification temporarily covers the narrow list toolbar; standard close and10-second auto-dismissal remain (verified in all3projects).

## Existing regression maintenance

The context-navigation suite still targeted the pre-TASK-168 group/date attendance entry. Updated its fixtures to the current lesson occurrence route and API, asserted exact occurrence/date return and restored focus, retained pending-save denial, and checked re-enabled profile action after Show all. The scoped denial expectation now uses the approved safe message. Application attendance behavior was not changed.

## Final verification

Canonical harness, exact candidate SHA/tree, integration and resource cleanup will be recorded after completion. No external deployment or push is part of this task.
