---
name: web-design-guidelines
description: Use only when an independent audit is explicitly requested for an implemented CRM interface, accessibility, semantic structure, keyboard behavior, focus management, forms, dialogs, navigation, responsive overflow, or general web-interface compliance. Report findings without redesigning the CRM workflow or overriding crm-mobile-first-ui.
---

# Web Design Guidelines Audit

Audit implemented behavior independently. Do not use this skill to invent a
new CRM workflow.

## Source priority

1. User request.
2. Nearest `AGENTS.md`.
3. Existing code, tests, and backend contracts.
4. Approved UX contract and
   `.agents/skills/crm-mobile-first-ui/SKILL.md`.
5. This audit checklist.

Report conflicts instead of silently replacing project requirements.

## Inspect

- semantic page structure, landmarks, headings, and accessible names;
- keyboard order, visible focus, focus trapping, focus return, and Escape/back
  behavior;
- button, link, menu, tab, dialog, drawer, table, list, and form semantics;
- persistent form labels, validation association, error recovery, and status
  announcements;
- contrast, zoom, text wrapping, long content, and reduced-motion behavior;
- touch target reachability and unintended horizontal page overflow;
- loading, empty, error, disabled, stale, success, and permission-restricted
  states;
- narrow and compact-height behavior required by `crm-mobile-first-ui`;
- Safari visible viewport, software keyboard, and safe-area risk where
  applicable.

Do not treat placeholder text as an accessible name. Do not require visible
labels where the approved project skill explicitly permits a visually hidden
label and the accessible name remains stable.

## Classify findings

For each finding provide:

- location;
- affected user and task;
- reproducible evidence;
- severity: blocker, high, medium, or low;
- violated project contract or web principle;
- smallest remediation;
- recommended automated and manual validation.

Separate verified defects from assumptions and cosmetic preferences. Do not
report generic advice without a concrete affected interaction.

## Validate

Prefer semantic and behavior assertions over screenshot-only checks. Run
affected lint, build, unit, and Playwright checks when modification is in
scope. Clearly report checks requiring Simulator, physical iPhone, assistive
technology, or manual browser verification.
