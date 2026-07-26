# TASK-090 — final responsive screenshots

Static mobile-first UI concept based on:

- `backlog/tasks-ready/TASK-090-shared-mobile-ui-system.md`
- `docs/MOBILE_UI_CONTRACT.md`
- current frontend routes and screen contracts

## Output contract

- iPhone 17 Pro Max: `440 x 956`;
- iPhone Air: `420 x 912`;
- desktop: `1440 x 1200`;
- full set: `default-green-v1`;
- theme-invariance subset: `test-blue-coral-v1`;
- font: Onest;
- mobile app header: `72px`;
- mobile page padding: `16px`;
- mobile fixed bottom navigation: `76px`;
- desktop app header: `76px`;
- desktop sidebar: `232px`;
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
- the fourth mobile route slot shows the exact active `Тренеры`, `Журнал`,
  `Финансы` or `Настройки` destination instead of the last primary tab; the
  displaced tab moves into the drawer and the fifth `Ещё` trigger remains;
- the groups registry starts with its locator and does not render aggregate
  summary/stat widgets on mobile, tablet or desktop;
- required validation, recovery, constraint, security/legal and
  operational-state copy is placed next to the affected field/action/section.

## Files

- `index.html` — query-driven static prototype;
- `app.js` — seeded screen fixtures and reusable render recipes;
- `styles.css` — semantic theme profiles and responsive layout;
- `manifest.json` — screenshot inventory;
- `render.mjs` — Playwright renderer and geometry checks;
- `screenshots/default-green-v1/` — complete iPhone 17 Pro Max set;
- `screenshots/iphone-air/default-green-v1/` — complete iPhone Air set;
- `screenshots/desktop/default-green-v1/` — complete desktop set;
- `screenshots/test-blue-coral-v1/` — theme-invariance subset;
- `contact-sheet-default.png` — iPhone 17 Pro Max overview;
- `contact-sheet-iphone-air.png` — iPhone Air overview;
- `contact-sheet-desktop.png` — desktop overview;
- `contact-sheet-themes.png` — theme comparison overview.

Legacy desktop PNG paths in `docs/ui-concept/mockups/` are replaced from the
same responsive source so old document links continue to resolve.

## Re-render

From the repository root:

```text
node docs/ui-concept/task-090-iphone-17-pro-max/render.mjs
```
