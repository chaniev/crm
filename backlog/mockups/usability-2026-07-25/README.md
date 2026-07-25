# UX mockups: local stand before / proposed after

Дата фиксации текущего состояния: `2026-07-25`.

`before` — реальные viewport screenshots полностью пересозданного локального
стенда. `after` — статические Mantine/Onest-consistent UX/UI-концепты, а не
реализованный frontend. Для каждой задачи также подготовлен единый
`comparison`-кадр с прямым side-by-side сравнением.

| Task | Viewport | Comparison | Source frames |
|---|---:|---|---|
| TASK-084 | 912 x 420 | [comparison](TASK-084-comparison.png) | [before](TASK-084-before.png) · [after](TASK-084-after.png) |
| TASK-085 | 390 x 844 | [comparison](TASK-085-comparison.png) | [before](TASK-085-before.png) · [after](TASK-085-after.png) |
| TASK-086 | 390 x 844 | [comparison](TASK-086-comparison.png) | [before](TASK-086-before.png) · [after](TASK-086-after.png) |
| TASK-087 | 390 x 844 | [comparison](TASK-087-comparison.png) | [before](TASK-087-before.png) · [after](TASK-087-after.png) |
| TASK-088 | 390 x 844 | [comparison](TASK-088-comparison.png) | [before](TASK-088-before.png) · [after](TASK-088-after.png) |
| TASK-089 | 1440 x 1200 | [comparison](TASK-089-comparison.png) | [before](TASK-089-before.png) · [after](TASK-089-after.png) |

## TASK-084: touch targets and compact-height shell

### Current state

At `912 x 420`, the application switches to its desktop shell: the persistent
left navigation consumes working width, the filter strip compresses controls,
and several inputs/actions remain below the `44 x 44 CSS px` mobile acceptance
target.

### Proposed state

The concept keeps a compact touch shell after rotation. Primary navigation
remains visible at the bottom, search and primary actions stay reachable, and
the SuperAdministrator overflow contains `Users`, `Audit`, and `Settings`.
`Finance` is explicitly absent because it is not present in the backend session
contract.

### Why the proposal is better

- It avoids the breakpoint failure where a touch device receives a squeezed
  desktop interface merely because its landscape width is large.
- Controls are designed around `44px` minimum targets, reducing touch misses.
- The first screen keeps both the locator and results usable without nested
  scrolling.
- SuperAdministrator global scope and allowed sections are visible without a
  frontend-invented branch or permission rule.
- Primary navigation remains stable while rare destinations move to one
  predictable overflow surface.

Remaining validation: `912 x 420` and `956 x 440` WebKit touch runs, Safari
chrome, software keyboard, safe areas, and a Simulator or physical device.

## TASK-085: visible mobile client search

### UX variants

- [Variant B — balanced identity-first list](TASK-085-variant-B.png)
- [Variant C — search-focused dense list](TASK-085-variant-C.png)
- [Reproducible HTML source](task-085-variants.html)

### Current state

The mobile client screen shows a single `Фильтры` button. Search by name or
phone — the primary locator for a list of 300 clients — appears only after an
extra action inside a full-screen filter surface.

### Proposed state

Search remains visible above the list. Secondary filters stay collapsed, while
their active count and removable chips remain visible. Multi-branch results
show branch context for a SuperAdministrator session with `branchId: null`.

### Why the proposal is better

- It removes one mandatory action before every client search.
- Users can see and remove active filters without reopening the drawer.
- Search, filters, and list context can be preserved through preview/detail and
  back navigation.
- Branch metadata disambiguates similarly named clients in a global result set.
- The create action can still be driven solely by backend `canManageClients`.

Implementation note: for a role without phone visibility, the placeholder must
not promise a phone search. With the iPhone keyboard open, input, feedback, and
results must remain reachable.

## TASK-086: mobile-first group locator and paging

### Current state

The group screen starts directly with 30 long cards and has no search, filters,
range, or paging. Finding one group requires scanning a document roughly
`9121px` high; the repeated `Редактировать` action is also below the required
touch height.

### Proposed state

Summary metrics are followed by visible search, frequent filter chips, and
`1–10 из 30`. Cards preserve branch, hall, schedule, trainer, and status while
using a denser task-oriented hierarchy.

### Why the proposal is better

- Users narrow the result set before scrolling through every group.
- Range and batch size create orientation in a 30+ item result.
- The first viewport contains locator controls and the beginning of results.
- Branch and hall stay readable for SuperAdministrator multi-branch work.
- The primary row action becomes a `44px` touch target instead of a small chip.

Filter options must continue to come from the backend response. No-result/reset
and state preservation after edit require behavioral coverage.

## TASK-087: coach schedule effective scope

### Current state

A coach receives the global club schedule: day counts reach 12–17 and parallel
events from unrelated branches compete in narrow lanes. The coach must separate
their own next lesson from the global overview.

### Proposed state

The concept changes the task to `Мои занятия`: scoped day counts, a prominent
next lesson, and a chronological list of relevant sessions. The screenshot is
deliberately marked `Концепт: scope требует согласования`.

### Why the proposal is better

- It reduces decisions from filtering a global calendar to choosing among the
  coach's relevant lessons.
- A visible next lesson supports the coach's immediate operational task.
- Counts, filters, and empty copy can all describe the same backend-owned scope.
- A scoped empty state can say `Для вас занятий нет` instead of implying that
  the club schedule is empty.
- Frontend no longer needs to infer assignment or access semantics.

This is not a final workflow until product/backend semantics answer whether
effective scope includes direct assignments, temporary substitutions, all
attendance grants, and any permitted `Показать всё расписание` operation.
SuperAdministrator must remain global and must not inherit coach scoping.

## TASK-088: explicit permission-restricted feedback

### Current state

Opening `/groups` as a coach silently replaces the requested URL with `/` and
shows the attendance screen. There is no indication whether the route was
unknown, loading failed, or access was denied.

### Proposed state

The restricted state names the requested destination, explains the role
restriction, and provides a valid primary recovery action plus one accessible
alternative.

### Why the proposal is better

- The user can distinguish a permission restriction from broken navigation.
- Recovery leads only to a route present in the backend session contract.
- Session loading, unknown routes, and permission restrictions can have
  separate observable states.
- The direct `/finance` case for SuperAdministrator uses the same explanation
  while `Finance` remains absent from navigation and recovery destinations.
- Forbidden staff mutations can remain absent instead of appearing as dead or
  misleading controls.

Implementation must define focus on direct URL entry and polite feedback for an
automatic replace redirect without duplicating permission rules in frontend.

## TASK-089: desktop client list and preview without overflow

### Current state

With preview open at `1440 x 1200`, the client list container is about `774px`
wide while row content is about `919px`. Primary values are clipped and the
horizontal scroll is buried inside a long list.

### Proposed state

The desktop split uses four explicit decision columns: `Клиент`, `Филиал`,
`Абонемент`, and `Следующее действие`. Long values wrap, while preview receives
a stable width and its own primary actions.

### Why the proposal is better

- Primary decision data remains visible without horizontal scrolling.
- Full names and branch context remain readable in SuperAdministrator global
  results.
- Preview no longer destroys the list's information hierarchy.
- The selected row, search, filters, and scroll position can survive preview
  open/collapse.
- Closing preview can return keyboard focus to the selected row.

Implementation acceptance needs a geometry assertion
`scrollWidth <= clientWidth` for the approved primary columns. At tablet width,
use split only while those fields remain readable; otherwise use a
single-column/drill-down path.

## Visual system and implementation boundary

- Normative source:
  [Единый контракт мобильного интерфейса CRM](../../../docs/MOBILE_UI_CONTRACT.md).
- Font: Onest.
- Shared typography, spacing, radii, control sizes, operational states and
  responsive behavior come from the normative contract, not from an individual
  screenshot.
- Deployment colors come from a registered `ThemeProfile`; screen mockups do
  not define raw brand or status colors.
- Mobile interactive target: at least `44 x 44 CSS px`.
- Mobile text inputs: at least `16px`.
- Cards and controls follow existing Mantine radius, border, and surface
  hierarchy.
- Backend remains the source of truth for scope, roles, permissions, allowed
  sections, filters, and actions.
- The screenshots define intended hierarchy and comparison evidence. They do
  not replace unit, Playwright, WebKit, focus, overflow, or physical-device
  acceptance.
