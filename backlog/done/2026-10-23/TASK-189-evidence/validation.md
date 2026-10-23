# TASK-189 validation and runtime comparison

Approved direction: [A/A brief](../../../mockups/TASK-188-189-group-schedule/brief.md).
The read-only series summary and secondary entry precede identity fields. Mobile
places the action below all slots; desktop keeps it alongside. Hall/duration are
shared only when every slot agrees. Loading, missing series, denied access and
retry are independent of the identity form.

Initial red: 14 focused component failures/60 passes (missing entry/dirty actions,
series identity guard). Group-origin App reload then exposed bootstrap history
clearing before the session transition committed; the guard now waits for an
actual session result. Typed origin validates group, series and history entry,
preserves the existing group-list snapshot, and cannot supply a return URL.

Focused component/router/series suite: 110 tests passed. Cases include all slots,
multiple slots per day, mixed hall/duration, loading/404/403/retry, identity draft,
dirty stay/Escape/discard/save/error/duplicate protection, post-save lookup denial,
late group response, mismatched series response, reload/history mismatch and
stale origin A when opening B. Series tests cover backend date minima, slot/scope/
date invalidation, stale-token draft recovery and an execute resolving after unmount.

Browser group workflow passed on Chromium and both target iPhone WebKit profiles:
filtered list → group → distinct canonical series ID → reload → preview/execute →
group/refetch/focus → reopen/cancel/header back → previous filtered list → calendar.
Identity-save recovery and lookup/editor 403 make no unintended series mutation.
Long seven-slot summary and lookup retry retain the draft and full action labels.

Geometry inspected: 360×780, 390×844, 420×912, 440×956, 768×1024, 1440×1200,
912×420 and 956×440; both configured iPhone profiles. No horizontal overflow;
entry action >=44×44; all dirty-dialog choices visible at compact height; Escape
restores the trigger. Render review was performed separately from implementation.
Examples: [360 summary](chromium-schedule-long-360.png),
[desktop](chromium-schedule-long-1440.png), [compact modal](chromium-schedule-modal-912.png),
[iPhone Air modal](iphone-air-webkit-schedule-modal-iphone.png),
[iPhone Pro Max modal](iphone-17-pro-max-webkit-schedule-modal-iphone.png).

| Dimension | Score | Evidence |
|---|---|---|
| Task hierarchy | 4/5 | Secondary schedule entry before identity fields |
| Scanability | 4/5 | All day/time pairs and accurate shared metadata |
| Density | 4/5 | Compact wrapping summary, no extra editor inside the card |
| Typography | 4/5 | Existing Onest body and button styles |
| Rhythm | 4/5 | Shared Stack gaps and consistent action spacing |
| Visual identity | 4/5 | Existing surfaces and secondary action style |
| Interaction feedback | 4/5 | Explicit retry, denial, dirty options and focus recovery |
| Responsive integrity | 4/5 | Required geometry matrix and WebKit profiles |

No material deviation from selected A. The weakest design constraint is the long
summary in groups with many slots; every slot wraps without hiding the action.
Physical iPhone/iOS Simulator checks of Safari chrome, keyboard, safe areas and
one-handed reach were not performed. WebKit emulation does not establish those;
REQ-NFR-001 remains partial.

Existing group→client browser scenarios pass with explicit group-summary/no-series
fixtures and a committed input value before navigation. A broad exploratory run
also found four pre-existing attendance cases in client-profile-context-navigation
using the retired /attendance group-roster entry: their fixtures omit
GET /api/attendance/lessons/today. Those unrelated cases were not rewritten or
reported green; the contract selects the three affected group-origin cases.
Canonical aggregate checks and exact candidate SHAs are recorded in the batch log.

Final task harness at `6aeefcb` passed: 75 unit files/719 tests; 27 workflow browser
cases across three projects, 18 schedule, 11 registry, 6 trainer-substitution and
3 group→client cases (65 browser cases total); lint/types/build/audit and knowledge
checks. Baseline attendance fixture failure was reproduced independently on
`d17baff`, before TASK-189, with the same missing today-worklist API request.

Aggregate regression on clean main `6aeefcb` passed after the last code merge:
590 backend tests plus restore/format/Release build/audit, 719 frontend unit tests
plus install/audit/lint/types/guards/build and repository knowledge checks.
[Integration harness](integration-harness.json) records commands and exact tree.
