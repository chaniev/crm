# Frontend Agent Rules

## Scope

Applies to all tasks inside `frontend/`.

Frontend is responsible for UX and contract consumption.

---

## Main areas

- `features/` -> route-level functionality
- `lib/api.ts` -> backend contracts
- `lib/appRoutes.ts` -> routing
- `shared/` -> reusable UX/UI
- `e2e/` -> Playwright regression tests

---

## UX priorities

Optimize for:
- fast workflows
- low cognitive load
- clear primary actions
- scanability
- narrow-screen usability
- operational efficiency

Primary users:
- gym admins
- coaches

---

## Mobile-first UX contract

For a new screen or substantial workflow change:
- read `.agents/skills/crm-mobile-first-ui/SKILL.md`;
- involve `ux-researcher` before design;
- involve `ui-designer` before implementation;
- design and validate 390 x 844 first as the narrow mobile stress baseline;
- validate target-device layouts at 420 x 912 for iPhone Air and 440 x 956 for iPhone 17 Pro Max;
- define compact-height behavior at 912 x 420 and 956 x 440 for shell navigation, temporary surfaces, forms, and primary actions;
- derive tablet and desktop variants from the mobile information hierarchy;
- keep one visually dominant primary action per task state;
- remove, defer, collapse, or move controls that do not support the current task;
- never use horizontal scrolling of a desktop table as the default mobile solution;
- keep fixed and sticky controls inside the safe area and usable through Safari chrome and software-keyboard changes;
- preserve loading, empty, error, disabled, permission-restricted, and success states.

An approved UX contract and UI specification are implementation inputs.
If a technical constraint requires changing the approved interaction, return the conflict to `ui-designer` instead of silently changing the workflow.

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

`crm-mobile-first-ui`, the approved UX contract, and existing project patterns
remain authoritative for CRM workflows and responsive behavior.

---

## Contract rules

Frontend must not:
- implement CRM business logic
- infer permissions independently
- duplicate validation semantics
- redefine backend contracts

Backend contract changes must update:
- `lib/api.ts`
- affected screens/components

---

## Structural rules

Prefer:
- feature-oriented structure
- reusable UX patterns
- small focused components
- typed API boundaries

Avoid:
- business logic inside `App.tsx`
- oversized route components
- duplicated UI patterns
- global state without need

---

## UI stack

Preserve:
- Mantine
- Onest

---

## Required validation

Minimum:
- `cd frontend && npm run lint`
- `cd frontend && npm run typecheck`
- `cd frontend && npm run check:raw-colors`
- `cd frontend && npm run build`
- `cd frontend && npm run test:unit`
- `cd frontend && npm run audit` when dependencies or the lockfile change

If flows/UI changed significantly:
- run affected Playwright tests
- validate at 360, 390 x 844, 420 x 912, 440 x 956, 768, and 1440 px
- run affected mobile workflows with WebKit mobile emulation and touch enabled
- smoke-test compact-height behavior at 912 x 420 and 956 x 440
- verify the primary task, one failure path, and one permission-restricted path
- report Safari, software-keyboard, safe-area, and physical-device checks that remain unverified

## Preferred specialists

Default:
- react-specialist

Additional:
- ui-designer
- ux-researcher
- refactoring-specialist
- test-automator
