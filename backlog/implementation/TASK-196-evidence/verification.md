# TASK-196 — verification evidence

## Scope and authority
Base: `origin/main = 9edbda275f9e7bc07de6efc245863f05f1e18c28`.
Branch: `codex/TASK-196-xlsx-client-import`. Dedicated task-worktree; primary main unchanged during implementation.
Initial plan readiness passed before code; repeated readiness passed after owner accepted ADR-0006 on 2026-11-16.

Owner authorized implementation, then inclusion of both pre-existing date defects, then explicitly accepted ADR-0006 option A. No deployment or real client import performed. XLSX fixtures are synthetic; source review contributes only non-personal row profiles.

## Test-first and iteration evidence
- Import API/session tests: initial 9 executable failures for missing route/scope, then green alongside 65 existing ordinary-create characterizations.
- Reader/mapping assertions failed against minimal seams before implementation; 114 synthetic profiles cover invalid 48/66 and corrected 48/66 rows.
- Shared create retained ordinary-create response/scope/audit behavior; PostgreSQL import tests cover late SaveChanges/ordinary audit/summary failures, zero graph delta, N/2N, actor and group-identity races.
- Initial PG fixture setup failure (zero group duration) is not claimed as red behavior evidence; corrected fixture was used for actual transactional verification.
- Import API/auth/settings tests started with executable failing assertions; final import-focused backend run: 59 passed, zero skipped. Browser host is a no-op without its explicit fixture environment; real execution is proven by the real-API/PG Playwright suite.
- Real-API import Playwright: 18 passed in Chromium, iphone-air-webkit, iphone-17-pro-max-webkit. Includes SA/Admin invalid→corrected 66 rows, HeadCoach/Coach restricted, response loss after committed 48 rows and audit correlation, one POST, tab-state retention, password/section/logout guard, safe focus.
- Original full backend run: 769 passed, 2 failed. Both reproduced unchanged on main: administrator trainer assignment history and completed client transfer history. This evidence led to the owner-approved ADR-0006 scope extension.
- Date regression red: fixed business day transfer lost history; yesterday's trainer period returned 500; same-day removal retained GroupTrainers; financial last-day attribution excluded the event. Corrected finance assertion was rerun to an actual failing assertion (initial wrong JSON key is not red evidence).
- New PostgreSQL one-day seed failed against original CHECK. After fixes, nine focused date/migration tests passed: clean bootstrap, retained upgrade, conflict refusal without changed dates, inclusive overlap rejection, safe refusal of downgrade with one-day history, current-access projection and last-day attribution.
- Independent date/migration review identified repeated business-day reads across an await. Transfer now captures one day; stepping-provider regression covers midnight during mutation.

## Runtime comparison with selected A
Compared current render with approved A ready 390/1440, error/unknown/dialog contract. Corrected missing white PageSection card and odd final mobile tab span. Form stays left-aligned at max 600px on desktop; fields, warning and primary action preserve hierarchy. Full errors and operation number wrap within mobile width. Dialog uses safe primary focus on “Остаться”, full operation number/copy and explicit leave.

Observed screenshots retained beside this report: desktop-ready, mobile-ready/errors, iPhone Air unknown/dialog and iPhone 17 Pro Max dialog. WebKit page screenshots during compositor transitions were not accepted as dialog evidence; in-viewport assertions and element renders were used. All required viewport/compact-height widths were exercised by Playwright; no page horizontal overflow, primary action can be reached and used.

Limits: Playwright WebKit is browser-engine evidence only. Native Safari chrome, real software keyboard, native file picker, dynamic safe-area and physical-device/Simulator interaction were not exercised. Available simulators were inventoried but not used. No physical-device acceptance is claimed.

## Final canonical verification
First canonical run on `d1be6cf13780ce17b6631c804232a0790cbf4e4d`: backend 780/780, frontend 769/769, bot 71/71, harness 119/119. Import 18/18, settings 30/30, access and transfer E2E passed. Registry rejected two not-yet-integrated requirement revisions still marked realized; both corrected to partial. A Chromium staffing regression had a focus timeout (29/30); unchanged main passed the isolated scenario. This run is retained as failed evidence, not merge approval.

Additional import history/reload/Admin recovery test passed in all three browser projects (3/3). Final canonical run on the updated candidate is pending; its report will be linked before integration.
