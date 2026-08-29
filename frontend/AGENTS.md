# Frontend Agent Rules

## Scope

Applies to all tasks inside `frontend/` together with the root `AGENTS.md`.
Frontend owns UX and typed consumption of backend contracts.

---

## Main areas

- `src/features/` -> screens and feature-oriented workflow components
- `src/features/shared/` -> reusable CRM UX/UI patterns
- `src/lib/api/**` -> typed backend API client, DTO mirrors, and error mapping
- `src/lib/api.ts` -> public API-client facade exports
- `src/lib/appRoutes.ts` -> routing and access-aware navigation
- `src/theme/` and `src/theme.ts` -> Mantine/Onest theme contracts
- `e2e/` -> Playwright workflow regression tests

---

## UX priorities

Optimize for fast, low-cognitive-load workflows for gym administrators and
coaches. Preserve clear primary actions, scanability, operational efficiency,
and narrow-screen usability.

---

## Mobile-first UX workflow

For a new screen or materially changed workflow:

1. Read `.agents/skills/crm-mobile-first-ui/SKILL.md` completely.
2. Define the UX contract before design; prefer `ux-researcher` when available.
3. Convert it into an implementation-ready specification; prefer `ui-designer`.
4. Resolve product uncertainties that change the workflow before implementation.
5. Implement the approved interaction; prefer `react-specialist`.
6. Add regression coverage for the primary mobile workflow; prefer `test-automator`.
7. Verify the result against the approved contract and the skill's acceptance criteria.

These outcomes and their order are mandatory; separate agents are not. When a
specialist is unavailable or separate delegation is disproportionate, the
implementing agent owns the same artifacts and review boundaries.

The skill is the single source for target viewport sizes, safe-area,
compact-height, Safari, software-keyboard, operational-state, and mobile
acceptance requirements. Do not restate or weaken those requirements here.

Every visible control must support a defined operation. Keep primary operations
visible and dominant; do not use horizontal scrolling of desktop content as the
default mobile adaptation. If a technical constraint changes the approved
interaction, return the conflict to `ui-designer` instead of silently changing
the workflow.

A small local visual correction that does not change the workflow may start
with `ui-designer` and still requires proportional regression coverage.

Optional visual-generation guidance:

- Read `.agents/skills/design-first-ui-prompting/SKILL.md` only when the
  deliverable includes an external UI-generator prompt, static concept, demo,
  or landing page.
- It does not override the CRM UX contract, responsive behavior, accessibility,
  Mantine/Onest patterns, or implementation acceptance criteria.

---

## React implementation skill

For React implementation, review, performance optimization, state flow, data
loading, effects, component boundaries, or frontend refactoring:

- read `.agents/skills/react-best-practices/SKILL.md`;
- apply only React 19, TypeScript, Vite, and Mantine-compatible guidance;
- do not introduce Next.js-specific APIs or assumptions;
- preserve existing API-client, routing, testing, and design-system patterns.

For an explicitly requested independent accessibility, keyboard, focus, or
interface-compliance audit, read
`.agents/skills/web-design-guidelines/SKILL.md`.

---

## Contract rules

Frontend mirrors backend contracts without defining CRM semantics or inventing
permissions, validation, fields, states, or error meaning. Backend contract
changes update the affected `src/lib/api/**` module, public facade exports in
`src/lib/api.ts`, screens/components, and consumer tests.

---

## Structural rules

Prefer:

- feature-oriented structure
- reusable CRM UX patterns
- small focused components and hooks
- typed API boundaries

Avoid:

- business logic inside `src/App.tsx`
- oversized route components
- duplicated UI patterns
- global state without a demonstrated cross-feature need

Preserve Mantine and Onest. Do not introduce a parallel design system.

---

## Required validation

Use the root verification harness. Its canonical frontend area must perform a
locked install, dependency audit, lint, type checking, raw-color checks, unit
tests, and production build. Command definitions live only in
`scripts/harness/commands.py`.

If a flow or interface changed:

- run affected Playwright tests;
- include affected target-iPhone Playwright projects in the task verification contract;
- verify the primary task, one representative failure path, and one
  permission-restricted path;
- report Safari, browser-chrome, software-keyboard, safe-area, Simulator, and
  physical-device checks that remain unverified.

Follow the viewport and compact-height matrix from
`.agents/skills/crm-mobile-first-ui/SKILL.md` rather than maintaining a second
copy here.

---

## Code review rules

Flag:

- permissions, membership, attendance, or validation rules computed in frontend
- API types or error mapping that drift from backend responses
- new workflows missing loading, empty, error, disabled, restricted, or success states
- primary operations hidden in overflow or unreachable on the mobile baseline
- fixed/sticky controls that can collide with safe areas or keyboard-reduced viewports
- duplicated feature UI that should use an established shared pattern

Prefer behavior and accessibility findings over style preferences already
enforced by lint, raw-color checks, or the design system.

---

## Preferred capabilities

When available, prefer:

- react-specialist
- ui-designer
- ux-researcher
- refactoring-specialist
- test-automator

The required UX and implementation outcomes do not depend on a particular
agent topology.
