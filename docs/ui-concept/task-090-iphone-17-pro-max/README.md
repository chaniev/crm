# TASK-090 — iPhone 17 Pro Max screenshots

Static mobile-first UI concept based on:

- `backlog/tasks-ready/TASK-090-shared-mobile-ui-system.md`
- `docs/MOBILE_UI_CONTRACT.md`
- current frontend routes and screen contracts

## Output contract

- logical viewport: `440 x 956`;
- full set: `default-green-v1`;
- theme-invariance subset: `test-blue-coral-v1`;
- font: Onest;
- app header: `72px`;
- page padding: `16px`;
- fixed bottom navigation: `76px`;
- minimum control target: `44 x 44px`;
- mobile input text: at least `16px`.

The screenshots are design artifacts, not evidence of iOS Simulator or physical
device acceptance. Safari chrome, Dynamic Island, software keyboard and actual
safe-area behavior still require Simulator or physical-device validation.

## Explanatory-copy rule

The rendered screenshots follow the cross-device explanatory-copy rule in
`docs/MOBILE_UI_CONTRACT.md`:

- route headers default to title plus actions, without decorative subtitle,
  eyebrow, badge, intro or helper copy;
- form/auth screens do not use pre-title badges or generic lead text that
  repeats the primary action;
- a sole primary search does not show a generic label above the field, while
  retaining a stable accessible name independent of placeholder;
- top-level lists omit a visible route title when active persistent navigation
  already names the route; semantic `h1` and relocated actions remain;
- required validation, recovery, constraint, security/legal and
  operational-state copy is placed next to the affected field/action/section.

## Files

- `index.html` — query-driven static prototype;
- `app.js` — seeded screen fixtures and reusable render recipes;
- `styles.css` — semantic theme profiles and mobile layout;
- `manifest.json` — screenshot inventory;
- `render.mjs` — Playwright renderer and geometry checks;
- `screenshots/default-green-v1/` — complete screen set;
- `screenshots/test-blue-coral-v1/` — theme-invariance subset;
- `contact-sheet-default.png` — review overview;
- `contact-sheet-themes.png` — theme comparison overview.

## Re-render

From the repository root:

```text
node docs/ui-concept/task-090-iphone-17-pro-max/render.mjs
```
