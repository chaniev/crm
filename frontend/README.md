# Gym CRM frontend

React 19 client for administrators and coaches. The frontend consumes typed
backend contracts and must not reproduce CRM permissions, membership,
attendance or validation rules.

## Stack and structure

- React 19 and TypeScript.
- Vite for development and production builds.
- Mantine with Onest and project theme tokens.
- Vitest and Testing Library for unit/component tests.
- Playwright for browser and target-iPhone regression coverage.

Main code areas:

- `src/features` — route-level workflows and feature components;
- `src/lib/api` — typed backend transport and contracts;
- `src/lib/appRoutes.ts` — access-aware application routes;
- `src/theme.ts` and `src/theme/` — Mantine theme and CRM design tokens;
- `e2e` — browser regression tests.

Repository-specific React and mobile rules live in [`AGENTS.md`](AGENTS.md).

## Local development

```bash
cd frontend
npm ci
npm run dev
```

Vite proxies `/api` to `http://localhost:8080` by default. Override it with
`VITE_API_PROXY_TARGET` when the backend uses another address.

## Quality checks

```bash
cd frontend
npm run lint
npm run typecheck
npm run check:raw-colors
npm run test:unit
npm run build
npm run audit
```

`npm run check` runs the complete static, unit and production-build baseline.
The dependency audit fails for high and critical vulnerabilities and requires
registry access, so it is kept separate from the offline-capable `check` script.

For user-visible workflow changes also run the affected Playwright tests. The
target-device suite is:

```bash
npm run test:e2e:iphone
```

Do not add a second component library or infer backend-owned permissions in UI
state. Preserve explicit loading, empty, error, disabled and restricted states.
