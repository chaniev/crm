---
name: crm-mobile-first-ui
description: Use when analyzing, designing, implementing, reviewing, or testing CRM user interfaces, especially workflows for coaches and gym administrators on mobile devices. Enforces task-first UX, clean information hierarchy, compact controls, Mantine and Onest consistency, responsive behavior, accessibility, operational states, and measurable mobile acceptance criteria.
---

# CRM Mobile-First UI

Design the CRM as a fast working tool for coaches and gym administrators. Optimize completion of real operations before visual decoration.

## Read project context

Before acting:

1. Read the nearest `AGENTS.md`.
2. Inspect the current screen, related components, routes, API contracts, and tests.
3. Preserve React, TypeScript, Mantine, Onest, and existing design tokens.
4. Read `references/mobile-acceptance.md` when implementing, reviewing, or testing UI.
5. Read `references/mantine-patterns.md` when selecting responsive Mantine components.

Do not introduce Tailwind or another component library.

## Route the work

- New workflow or substantial redesign: `ux-researcher` → `ui-designer` → `react-specialist` → `test-automator`.
- Existing workflow analysis: `ux-researcher` → `ui-designer`.
- Local visual or interaction correction: `ui-designer` → `react-specialist`.
- Approved specification implementation: `react-specialist` → `test-automator`.

The coordinating agent owns handoffs and final verification.

## 1. Produce the UX contract

Before layout work, define:

- user and role;
- device and usage context;
- result the user needs;
- primary path and completion signal;
- required information at each decision;
- primary, frequent, secondary, and exceptional actions;
- current number of actions and decision points;
- failure and recovery paths;
- measurable success criteria;
- uncertainties requiring product input.

Classify every control:

| Class | Placement |
|---|---|
| Primary | Visible and visually dominant in the active task state |
| Frequent | Visible or reachable in one obvious interaction |
| Secondary | Lower emphasis or contextual placement |
| Exceptional/destructive | Context menu, detail surface, or explicit confirmation |
| Unmapped | Remove until a user operation justifies it |

Do not use visual preference as evidence of usability.

## 2. Design mobile first

Design at 390 x 844 first as the narrow mobile stress baseline. Then validate
360 px, the target iPhone Air 420 x 912 and iPhone 17 Pro Max 440 x 956 screen
sizes, and only then derive the 768 and 1440 px variants.

Rules:

- retain one visually dominant primary action per task state;
- keep required decision data visible;
- move rare actions out of the primary visual path;
- prefer progressive disclosure over permanently expanded controls;
- do not duplicate actions in several screen regions;
- do not show explanatory text when the control and context are already clear;
- do not preserve desktop density by shrinking text or touch targets;
- do not treat horizontal scrolling of a desktop table as mobile adaptation;
- convert dense tables into task-oriented rows, cards, or drill-down views;
- keep filters compact when closed and explicit when active;
- preserve search or current context when navigating back;
- prefer one-handed reach for the primary mobile action where practical.
- keep route headers title-and-actions-first on mobile and desktop; do not add
  subtitle, eyebrow, badge, intro, or helper copy unless its absence could
  cause a wrong action, hide a constraint or consequence, or block recovery;
- place allowed validation, recovery, security/legal, prerequisite, scope, and
  operational-state copy next to the affected field, action, section, or state
  surface instead of using it as decorative text under the route title.
- omit the visible generic label above a sole, obvious route-level search on
  mobile and desktop; keep a stable accessible name through an associated
  visually-hidden label or ARIA, and do not use placeholder as that name;
- preserve visible persistent labels for ordinary forms, multiple or ambiguous
  text fields, and period/date/scope controls.
- hide the visible route heading on a top-level list only when an active,
  persistent navigation item already names that route unambiguously; retain a
  visually-hidden `h1`, document title, named main landmark, and active-nav
  semantics;
- move actions from a hidden list header into the first locator/toolbar/summary
  row without leaving a spacer or hiding primary/frequent operations;
- keep the route-level locator field, filter trigger, and retained toolbar
  actions in one non-wrapping row on mobile, tablet, and desktop; do not create
  a second action-only line that leaves unused space beside the search field;
- under width pressure, preserve a useful search width and collapse primary
  create to an accessible `44 x 44px` icon button before wrapping the toolbar;
  desktop may restore the action text, but must keep the same single-row
  hierarchy;
- do not add aggregate summary/stat widgets to a registry list unless each
  value changes a current user decision and cannot be expressed more directly
  in locator, filter, range/status, or entity rows; extra desktop width is not
  a justification for widgets;
- do not add a section card, title widget, or standalone range/status panel
  that merely restates the selected persistent tab or names the collection
  already made obvious by that tab and its rows; start with the operational
  list/state on mobile and desktop, and retain a semantic accessible name
  without visible duplication;
- keep visible route titles for detail/create/edit/auth screens and routes
  whose active navigation is only a generic parent such as `More`; a recovery
  state with its own specific heading need not duplicate an active route name.
- when an active mobile overflow destination replaces the last primary route
  slot, derive its label/icon from the authorized current route, move the
  displaced route into the overflow drawer, keep the generic `More` trigger
  stable, and synchronize `aria-current`, popup semantics, deep links,
  back/forward, and permission redirects.
- treat configurable auth/start-page imagery as registered deployment branding:
  keep the current background as deterministic default, preserve an
  independent contrast-safe form surface, validate responsive focal-point
  cropping, and never block authentication on image resolution or loading.

Use `.agents/skills/design-first-ui-prompting/SKILL.md` only when the
deliverable includes a prompt for an external UI generator, a static visual
concept, a demo, or a landing page. It is not authoritative for CRM product
workflows, responsive behavior, accessibility, Mantine component selection, or
implementation acceptance.

## 3. Specify implementation behavior

The UI handoff must state:

- content hierarchy and component order;
- exact visible fields and hidden/deferred fields;
- primary and secondary actions;
- responsive transformation at each target width;
- safe-area behavior for fixed and sticky controls;
- compact-height behavior at 912 x 420 and 956 x 440;
- loading, empty, error, disabled, success, stale, and permission-restricted states;
- focus order and keyboard interaction;
- Safari chrome and software-keyboard behavior for full-height or bottom-anchored surfaces;
- drawer, modal, menu, and back-navigation behavior;
- validation and recovery behavior;
- component reuse and any justified new tokens;
- acceptance criteria tied to the UX contract.

Use exact values when a value is an acceptance requirement. Do not use vague terms such as “compact,” “small,” or “convenient” without a measurable rule.

## 4. Implement without redesigning

`react-specialist` must:

- treat the approved UX contract and UI specification as implementation contracts;
- keep CRM business rules in backend contracts;
- use semantic Mantine components and established shared patterns;
- preserve controlled form behavior, focus return, and async state safety;
- avoid new global state or abstractions for a local interaction;
- validate 360, 390 x 844, 420 x 912, 440 x 956, 768, and 1440 px behavior;
- validate affected mobile workflows with WebKit mobile emulation and touch enabled;
- keep full-height and bottom-anchored surfaces safe under dynamic viewport and safe-area changes;
- return material interaction conflicts to `ui-designer`.

Do not silently simplify, relocate, or hide the primary operation because implementation is difficult.

## 5. Validate the user task

Validate behavior, not just appearance:

1. Complete the primary path at the 390 x 844 stress baseline.
2. Repeat target-device acceptance at 420 x 912 and 440 x 956.
3. Smoke-test compact-height behavior at 912 x 420 and 956 x 440 when the screen can rotate.
4. Verify one failure path and recovery.
5. Verify one permission-restricted path when roles are affected.
6. Check loading, empty, error, disabled, and success states.
7. Check long names, translated text, large values, and content wrapping.
8. Check focus order, visible focus, Escape/back behavior, and focus return.
9. Confirm no unintended horizontal page scrolling.
10. Confirm safe-area clearance and that the focused field, validation or recovery feedback, and primary action remain reachable with Safari chrome or the software keyboard open.
11. Run lint, build, affected Playwright tests, and the target iPhone WebKit checks.

Use `references/mobile-acceptance.md` for measurable checks.

## Required handoff

Return:

- UX contract or the specific contract used;
- screen/component recommendation;
- responsive behavior;
- interaction and operational states;
- implementation constraints;
- measurable acceptance criteria;
- validation evidence;
- unresolved product decisions and residual risks.

Do not claim that the interface is convenient, clean, accessible, or mobile-friendly without evidence from the defined task and checks.
