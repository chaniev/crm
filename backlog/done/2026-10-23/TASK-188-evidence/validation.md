# TASK-188 validation and runtime comparison

Approved direction: [A/A brief](../../../mockups/TASK-188-189-group-schedule/brief.md).
The implementation keeps weekday selection above persistent, ISO-ordered day/time
rows; mobile common duration/dates follow below and desktop puts them on the right.
Identity, trainer controls and existing shell/actions are retained.

Focused mapper/component tests: 34 passed. Initial red: 6 failures/25 passes.
Backend public preview → create → series read → calendar read with 1/3/6 and
18:00/18:00/10:00 passed, alongside atomic creation/token/no-partial-create cases (3).
Full frontend check: 74 files/696 tests, lint, types, guards and production build passed.
Task browser tests: 12 passed across Chromium and both target iPhone WebKit projects.
API fixtures prove frontend payload/navigation; the independent API test proves persistence.

Runtime inspected: create with seven days, three distinct day/time pairs, long
Saturday error, corrected retry, preview invalidation and session permission denial.
Geometry: 360×780, 390×844, 420×912, 440×956, 768×1024, 1440×1200,
912×420 and 956×440. Seven checkbox hit regions are >=44×44, group gap is 8px
or greater, input font >=16px, no page overflow. Space toggles the focused day
and restores its draft. Error submit focuses the corresponding invalid input.

Rendered evidence: [390](chromium-weekdays-390.png), [desktop](chromium-weekdays-1440.png),
[iPhone Air](iphone-air-webkit-weekdays-iphone.png),
[iPhone 17 Pro Max](iphone-17-pro-max-webkit-weekdays-iphone.png),
[field error](iphone-17-pro-max-webkit-weekday-error.png).
Full-page screenshots capture fixed shell/actions at the current scroll offset;
these are not extra inline form rows. Native time presentation follows browser
locale; the stored/input values remain local HH:mm without timezone conversion.

| Dimension | Score | Evidence |
|---|---|---|
| Task hierarchy | 4/5 | Persistent weekday rows and one preview/create primary action |
| Scanability | 4/5 | Monday–Sunday ordering and aligned time column |
| Density | 4/5 | Only selected rows; all seven targets wrap without horizontal scrolling |
| Typography | 4/5 | Onest; new day labels, time fields and error text >=16px |
| Rhythm | 4/5 | Shared Mantine spacing; stable row gap and common-parameter column |
| Visual identity | 4/5 | Existing form surface and semantic green selection |
| Interaction feedback | 4/5 | Saturday-bound error, focus, preserved draft, explicit re-preview |
| Responsive integrity | 4/5 | One mobile column, two desktop columns, required geometry matrix |

No supported deviation from selected A remains. Weakest design decision remains
separate weekday selection and rows; regression checks removal/restoration and error mapping.

Device-only limits: no physical iPhone/iOS Simulator validation of Safari browser
chrome, software keyboard, Dynamic Island, home indicator or one-handed reach.
WebKit emulation and compact-height geometry do not establish those conditions.
REQ-NFR-001 remains partial.

Security validation prerequisite: pinned System.Security.Cryptography.Pkcs 9.0.21
in the two EF-design consumers after NU1902/NU1903; Vite updated from 8.2.2 to
8.3.5 within existing package range. Backend API/domain/schema unchanged.
Canonical npm audit (high threshold unchanged) passes with two existing moderate
Vitest 4.1.11/mocker advisories still reported; no audit suppression or major test
framework migration was introduced. Full harness evidence is recorded in the
implementation log and final closure.

Final focus correction: post-commit recovery replaces pre-commit animation-frame
focus. Frontend harness at `d17baff` and 10 repeated Chromium field-error runs
passed; [focus harness](focus-harness.json). The combined task contract later
passed all 27 creation/edit scenarios including both WebKit profiles at `6aeefcb`.

Aggregate regression on clean main `6aeefcb` passed after the last code merge:
590 backend tests plus restore/format/Release build/audit, 719 frontend unit tests
plus install/audit/lint/types/guards/build and repository knowledge checks.
[Integration harness](integration-harness.json) records commands and exact tree.
