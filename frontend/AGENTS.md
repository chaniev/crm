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
- `npm run lint`
- `npm run build`

If flows/UI changed significantly:
- run affected Playwright tests

## Preferred specialists

Default:
- react-specialist

Additional:
- ui-designer
- ux-researcher
- refactoring-specialist
- test-automator