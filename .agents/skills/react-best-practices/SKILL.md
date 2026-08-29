---
name: react-best-practices
description: Use when implementing, reviewing, profiling, or refactoring the CRM React 19 frontend built with TypeScript, Vite, and Mantine, especially for component boundaries, state flow, effects, asynchronous data loading, rendering performance, large lists, forms, bundle behavior, and frontend reliability. Do not use for UX workflow design or backend business rules.
---

# React Best Practices

Improve implementation quality without redesigning the approved CRM workflow.

## Establish the boundary

1. Read the nearest `AGENTS.md`.
2. Inspect the affected feature, shared components, API client, routes, tests,
   and nearby project conventions.
3. For responsive CRM work, read
   `.agents/skills/crm-mobile-first-ui/SKILL.md`.
4. Preserve React 19, TypeScript, Vite, Mantine, Onest, and established
   project abstractions.

Do not introduce Next.js APIs, Server Components, App Router, server actions,
Next.js caching, Tailwind, or a second component library.

## Keep state minimal

- Derive values during render when they can be computed from props or state.
- Use effects only to synchronize with external systems.
- Keep transient UI state close to the component that owns it.
- Avoid duplicated server data in unrelated local or global stores.
- Use functional state updates when the next value depends on the previous one.
- Keep form control mode deliberate; do not accidentally switch between
  controlled and uncontrolled behavior.

## Keep asynchronous behavior explicit

- Represent loading, success, empty, stale, and failure states intentionally.
- Prevent stale responses from overwriting newer user intent.
- Cancel or ignore obsolete work when navigation, filters, or search changes.
- Avoid request waterfalls when independent data can load concurrently.
- Do not use an effect to perform an action that belongs in an event handler.
- Preserve backend `ProblemDetails` and validation semantics instead of
  inventing client-side business rules.

## Control rendering cost

- Measure or identify a concrete render problem before adding memoization.
- Keep list keys stable and based on durable entity identity.
- Avoid recreating expensive derived collections on unrelated renders.
- Split components at ownership and update-frequency boundaries, not by size
  alone.
- Virtualize only when data volume and measured interaction cost justify it.
- Keep context values stable and narrow when frequent provider updates cause
  broad rendering.

## Measure user-visible performance

- Do not claim that LCP, INP, or CLS is failing from source inspection alone.
  Source can identify a risk; runtime evidence establishes a failure.
- Record equivalent conditions before and after an optimization. Distinguish a
  browser trace, a controlled lab measurement, and production field data.
- Prioritize INP for frequent CRM operations and CLS during loading, filtering,
  navigation, and operational-state changes.
- Use React profiling to identify component work before adding memoization or
  virtualization. State the interaction and data volume measured.
- Inspect production build output when changing route loading, dependencies, or
  import structure.
- Do not claim immediate field improvement from a local run; field metrics need
  new production visits.

## Protect bundle and runtime behavior

- Reuse installed dependencies and shared components before adding packages.
- Lazy-load route-level or genuinely heavy optional surfaces when it improves
  initial interaction.
- Avoid importing broad utility or icon entry points when a narrow import is
  available in the current dependency version.
- Verify production build output when changing dependency or import structure.

## Validate

Run the nearest relevant unit tests first, then:

```text
cd frontend
npm run lint
npm run build
npm run test:unit
```

When user-visible behavior changes, run affected Playwright coverage and the
mobile checks required by `crm-mobile-first-ui`.

Return:

- affected component and data-flow boundary;
- confirmed problem or risk;
- smallest compatible change;
- behavior and performance intentionally preserved;
- exact validation performed;
- remaining browser, data-volume, or environment risk.
