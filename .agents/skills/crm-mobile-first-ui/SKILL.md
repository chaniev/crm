---
name: crm-mobile-first-ui
description: Design, implement, review, or test CRM interfaces for coaches and gym administrators. Use for new screens, workflow redesigns, responsive behavior, interaction design, visual quality, and mobile acceptance in the React 19, Mantine, and Onest frontend. Preserve backend-owned CRM rules and use a rendered design gate before implementing material visual changes.
---

# CRM UI design and implementation

Create a fast operational tool whose interaction and visual quality are both
demonstrated. A correct UX contract is necessary, but it is not evidence that
the resulting interface is visually strong.

## Establish authority and context

1. Read the nearest `AGENTS.md`.
2. Inspect the affected route, components, API contracts, tests, and current
   rendered interface when it exists.
3. Read `frontend/DESIGN.md` for the product's visual language.
4. Preserve React 19, TypeScript, Mantine, Onest, existing theme tokens, and
   shared CRM components. Do not introduce Tailwind or another component
   library.
5. Keep roles, permissions, validation, membership, attendance, audit, and
   other CRM semantics in backend contracts.

Read only the references needed for the current mode:

- new screen or material redesign: `references/visual-direction.md`,
  `references/mobile-acceptance.md`, and `references/mantine-patterns.md`;
- responsive implementation or correction: `references/mobile-acceptance.md`
  and `references/mantine-patterns.md`;
- interaction copy, errors, empty states, or confirmations:
  `references/ux-writing.md`;
- animation or transition work: `references/motion.md`;
- implementation review or final design acceptance:
  `references/visual-review.md` and `references/mobile-acceptance.md`.

## Choose the mode

### New screen or material redesign

Use this sequence:

1. Define the UX contract without prematurely choosing a layout; prefer
   `ux-researcher` when available.
2. Create a visual brief and three meaningfully different rendered directions
   using `references/visual-direction.md`; prefer `ui-designer`.
3. Present the directions with their tradeoffs. A product owner selects or
   refines one direction before production implementation begins.
4. Turn the selected direction into an implementation contract; prefer
   `ui-designer`.
5. Implement that contract without silently redesigning it; prefer
   `react-specialist`.
6. Add regression coverage for the primary mobile workflow; prefer
   `test-automator`.
7. Independently compare runtime output with the selected direction and UX
   contract using `references/visual-review.md`.

If the user supplies an already approved design, the three-direction step is
unnecessary. Validate that design against the UX contract, project visual
language, backend capabilities, and mobile acceptance before implementation.

### Existing workflow analysis

Identify task and recovery problems, then inspect the rendered hierarchy.
Prefer `ux-researcher` for the first outcome and `ui-designer` for the second
when those capabilities are available. Do not infer usability from source code
or visual preference alone.

### Local visual or interaction correction

Keep the brief proportional, render the affected state at its narrowest
relevant width, and compare before and after. Prefer `ui-designer` for the
design correction and `react-specialist` for implementation when available. Do
not generate three variants when the requested correction and correct result
are already deterministic.

### Approved specification implementation

Implement then add regression coverage; prefer `react-specialist` and
`test-automator` when available. Return material conflicts to the design owner
instead of improvising a different workflow or visual hierarchy.

The coordinating agent owns the handoffs, selected direction, final evidence,
and unresolved product decisions.

The outcomes and their order are mandatory; separate agents are not. When a
specialist is unavailable or delegation is disproportionate, the implementing
agent owns the same artifacts and review boundaries.

## Define the UX contract

Before visual design, state:

- user, role, device, and usage context;
- result the user needs and the completion signal;
- primary path and required information at each decision;
- primary, frequent, secondary, and exceptional actions;
- current action count and decision points when redesigning;
- loading, empty, failure, stale, restricted, and recovery paths;
- measurable task-success criteria;
- backend capabilities and product uncertainties.

Classify every control:

| Class | Placement |
|---|---|
| Primary | Visible and visually dominant in the active task state |
| Frequent | Visible or reachable in one obvious interaction |
| Secondary | Lower emphasis or contextual placement |
| Exceptional or destructive | Context surface or explicit confirmation |
| Unmapped | Remove until a user operation justifies it |

Do not use visual preference as evidence of usability, and do not use a UX
contract as evidence of visual quality.

## Require a visual contract

The selected direction becomes a contract. Record:

- content hierarchy and component order;
- exact visible, hidden, and deferred fields;
- typography, density, grouping, surface, and emphasis decisions;
- primary and secondary actions;
- responsive transformation at required widths;
- loading, empty, error, disabled, stale, success, and restricted states;
- focus order, keyboard, modal/drawer/menu, and back-navigation behavior;
- safe-area, dynamic viewport, compact-height, and software-keyboard behavior;
- reused components and tokens, plus any justified additions;
- implementation and visual acceptance criteria.

Use exact values only when they are real acceptance requirements. Terms such
as `clean`, `compact`, `premium`, `intuitive`, or `mobile-friendly` are not
requirements unless translated into observable decisions.

## Implement and validate the selected direction

The implementer must preserve controlled form behavior, focus return, async
state safety, backend ProblemDetails semantics, and shared Mantine patterns.
Avoid new global state or abstractions for a local interaction.

Validate both behavior and appearance:

1. Complete the primary task at the 390 x 844 stress baseline.
2. Verify the target iPhone sizes and desktop transformation defined in
   `references/mobile-acceptance.md`.
3. Verify one failure and recovery path and one restricted path when roles are
   affected.
4. Inspect long real content and every applicable operational state.
5. Compare rendered runtime with the selected direction rather than judging
   source code alone.
6. Run the required frontend checks and affected Playwright coverage.

Do not claim that a result is polished, clear, accessible, or mobile-friendly
without rendered and behavioral evidence.

## Required handoff

Return:

- UX contract;
- visual brief and explored directions, or the approved design supplied;
- selected direction and product-owner feedback;
- implementation contract and responsive behavior;
- operational and interaction states;
- before/after or concept/runtime rendered evidence;
- validation commands and results;
- unresolved decisions and residual risks;
- a short self-critique naming the weakest remaining design decision.
