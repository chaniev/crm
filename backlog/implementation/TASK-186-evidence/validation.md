# TASK-186 — implementation and acceptance evidence

## Scope and preflight

- Base: `aa5700f0403b2648bdaef25cc4a696e61ece3ea2` (`origin/main`).
- Branch: `codex/TASK-186-audit-access-head-coach-super-admin`.
- Readiness preflight passed before production changes. REQ-AUD-001,
  REQ-USR-001 and REQ-NFR-003 are accepted; dependencies: none.
- Backend owns capability and sections. Session/public DTO shape, other
  permissions, attendance scope, audit writes and retention are preserved.
- Frontend consumes both backend capability and section. Each concurrent audit
  request observes authorization errors separately; denial clears sensitive
  state, aborts obsolete results and invokes shell session recovery once.
  Explicit retry confirms session access before a fresh, unfiltered load.
- New background polling/focus/visibility checks were not introduced.

## Test-first evidence

On the original implementation, updated targeted tests produced:

- Backend: 4 failures / 33 passes. Administrator still received `200`,
  `CanViewAuditLog=true` and the Audit section.
- Audit component: 8 failures / 19 passes. Denial retained rows/options/details
  or did not refresh the session; an absent section was also not locally gated.
- Cookie invalidation and allowed-role cases were already green.

Development checks after implementation:

- Backend role policy, AuthorizationFlow, AuditLogApi and client lifecycle:
  40 passed (before adding the existing password-change-required regression).
- Audit component, auth mapping, routes and App shell: 96 passed; the additional
  cleared-filter/fresh-session retry test subsequently passed with the 28-test
  audit component suite.
- TASK-186 browser scenarios: 21 passed across Chromium, iPhone Air WebKit and
  iPhone 17 Pro Max WebKit. API data uses deterministic fixtures; this browser
  evidence complements the real-cookie backend integration tests.
- Canonical final-candidate validation and integration identity are recorded in
  the completion entry after execution of the task verification contract.

## Rendered comparison

Reviewed the existing visual contract without selecting a new design direction.
Preserved four list columns, mobile rows, filters, details and focus return.
Before/after captures were produced from the same fixtures and viewports:

- [390 before](../TASK-186-rendered/before-390.png) /
  [390 after](../TASK-186-rendered/after-390.png).
- [1440 before](../TASK-186-rendered/before-1440.png) /
  [1440 after](../TASK-186-rendered/after-1440.png).
- [Restricted before](../TASK-186-rendered/before-restricted.png) /
  [restricted after](../TASK-186-rendered/after-restricted.png).
- [Denial before session completes](../TASK-186-rendered/after-denied.png),
  [iPhone Air denial](../TASK-186-rendered/denied-420.png),
  [iPhone 17 Pro Max denial](../TASK-186-rendered/denied-440.png).
- [iPhone Air allowed](../TASK-186-rendered/allowed-420.png) /
  [iPhone 17 Pro Max allowed](../TASK-186-rendered/allowed-440.png).

Screenshots were visually inspected, not treated as byte-identical snapshots.
The allowed views retain their hierarchy and layout. No introduced clipping or
horizontal overflow was observed. The denial view uses the existing error
surface with an explicit retry; rows, author names, filters and modal JSON are
absent while session recovery is held pending. The existing restricted route
keeps its focused heading and recovery action. The old denied-screen copy
incorrectly named Administrator and was corrected to the accepted global roles.

Behavior assertions cover 360×780, 390×844, 420×912, 440×956, 768×1024,
1440×1200, 912×420 and 956×440 geometries. The target iPhone projects also use
WebKit, touch, an iPhone user agent, 3× scale and a viewport reduced from the
logical portrait screen height. Compact-height details close and return focus.
Both read roles open details and recover from transient failures; denied roles
cannot navigate to or request audit data. A stale Administrator session clears
open details/filter surfaces before session recovery, then recovers once or
returns to login; back/forward does not restore data.

| Dimension | Score / 5 | Observed evidence |
| --- | --- | --- |
| Task hierarchy | 4 | List and details action keep existing order; denial replaces content. |
| Scanability | 4 | Four columns on desktop, compact actor/context row on mobile. |
| Density | 4 | Existing targets and spacing retained across narrow/compact geometries. |
| Typography | 4 | Onest and original hierarchy preserved; denied copy wraps on mobile. |
| Rhythm | 4 | Existing filter/list and restricted-state spacing unchanged. |
| Visual identity | 4 | Shared Mantine surfaces and semantic error treatment retained. |
| Interaction feedback | 4 | Pending retry disabled; stale 500, denial, focus return and shell recovery verified. |
| Responsive integrity | 4 | No overflow; details usable in portrait and compact-height automation. |

No supported introduced visual defects remain. Weakest remaining UX point:
while session refresh is pending the old navigation can still show Audit;
its sensitive content is already removed, and fresh session recovery removes
that navigation as required by the approved contract.

Real Safari/Responsive Design Mode, browser chrome, software keyboard, actual
safe-area insets, iOS Simulator and physical devices were not used. WebKit
emulation is not device-level evidence. Remote deployment was not performed.

## Integration preflight follow-up, 2026-10-08

The full harness on `86d4fea` first found Docker stopped; after starting Docker,
all 572 backend tests (including InternalBotApiTests and PostgreSQL cases),
Release build, formatting and NuGet audit passed. The next gate found seven
existing npm advisories (four high, three moderate) in the unchanged baseline
lockfile. `npm audit fix --package-lock-only --ignore-scripts` updated compatible
versions within the existing package.json ranges: Vitest 4.1.11 and its family,
undici 7.30.0, source-map-js 1.2.2, js-yaml 4.3.2, brace-expansion 1.1.21/5.0.12,
@humanfs/node 0.16.8 and required transitive dependencies. No audit suppression,
forced major upgrade or package.json range change was used; lockfile audit now
reports zero vulnerabilities. The final harness is repeated against the commit
containing this prerequisite dependency repair.
