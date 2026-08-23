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
2. Have `ux-researcher` define the UX contract before design.
3. Have `ui-designer` convert it into an implementation-ready specification.
4. Resolve product uncertainties that change the workflow before implementation.
5. Have `react-specialist` implement the approved interaction.
6. Have `test-automator` add regression coverage for the primary mobile workflow.
7. Verify the result against the approved contract and the skill's acceptance criteria.

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

Frontend mirrors and consumes backend contracts; it does not define their CRM
semantics.

Frontend must not:

- implement backend-owned business rules
- infer permissions independently of backend responses
- duplicate backend validation semantics
- invent fields, states, or error meaning absent from the backend contract

Backend contract changes must update:

- the affected module under `src/lib/api/**`;
- facade exports in `src/lib/api.ts` when the public frontend API changes;
- affected screens/components and consumer tests.

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

Run from the repository root.

Minimum:

- `cd frontend && npm run check`
- `cd frontend && npm run audit` when dependencies or `package-lock.json` change

Run `cd frontend && npm ci` first when locked dependencies are unavailable or
the lockfile changed.

If a flow or interface changed:

- run affected Playwright tests;
- run `cd frontend && npm run test:e2e:iphone` for affected target-device flows;
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

## Preferred specialists

Default:

- react-specialist

Additional:

- ui-designer
- ux-researcher
- refactoring-specialist
- test-automator
