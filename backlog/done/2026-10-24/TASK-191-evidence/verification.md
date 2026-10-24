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

Candidate: `1eaa6f1a97df2236946850229bde95d7fd993be1`; tree: `73616fc4ab6b363708af58cc56be9ef2903d8ad2`.

Command: `python3 scripts/harness/verify_change.py --base origin/main --task-id TASK-191 --report .artifacts/verification/TASK-191-candidate.json`. Full task contract passed on a clean tree. [Machine evidence](harness-candidate.json).

Backend:693 tests; frontend:750 tests; bot:71 tests. Browser scope19 passed/2 intentional viewport-loop skips; origin regression and focused PostgreSQL runtime are included below. All dependency audits passed.

| Check | Outcome | Seconds |
|---|---|---|
| `requirements.agent-instructions` | passed | 0.04 |
| `requirements.architecture-decisions` | passed | 0.04 |
| `requirements.plan-readiness` | passed | 0.04 |
| `requirements.registry` | passed | 0.077 |
| `backend.restore` | passed | 0.679 |
| `backend.user-facing-text` | passed | 2.992 |
| `backend.format` | passed | 11.38 |
| `backend.build` | passed | 4.136 |
| `backend.test` | passed | 137.208 |
| `backend.audit` | passed | 2.777 |
| `frontend.install` | passed | 5.053 |
| `frontend.audit` | passed | 0.558 |
| `frontend.user-facing-text` | passed | 0.347 |
| `frontend.check` | passed | 24.572 |
| `bot.sync` | passed | 0.127 |
| `bot.lint` | passed | 0.078 |
| `bot.user-facing-text` | passed | 0.128 |
| `bot.format` | passed | 0.041 |
| `bot.types` | passed | 0.347 |
| `bot.test` | passed | 1.684 |
| `frontend.playwright.install` | passed | 0.454 |
| `frontend.e2e.administrator-client-scope` | passed | 22.309 |
| `frontend.e2e.client-origin-regression` | passed | 12.118 |
| `backend.runtime.administrator-client-scope-postgresql` | passed | 75.601 |

Integrated into local main at `1f26d270ec6c525af16f5a1e4aebbd8935b36e79` by fast-forward on 2026-10-24T15:05:19+03:00. Concurrent skills-only main changes were merged; application/runtime trees equal the fully verified candidate, with [integration knowledge checks](harness-integration.json) passed. Remaining closure changes are documentation/evidence/status only and receive knowledge checks. No external deployment or push is part of this task.
