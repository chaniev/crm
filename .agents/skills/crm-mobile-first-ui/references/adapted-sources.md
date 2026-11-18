# Selected external design guidance

Maintenance reference for the CRM design, React, and interface-audit skills.
Reviewed on 2026-11-18. Links pin the reviewed repository revisions; they are
provenance, not runtime dependencies or authority above project contracts.
The adaptation is written for this repository rather than installing parallel
skills with overlapping names. Preserve source attribution when revising it.

| Source | Applied in CRM | Deliberately not adopted |
|---|---|---|
| [PracticalSwan frontend-design v2.0](https://github.com/PracticalSwan/agent-skills/blob/1d800c81c5af4eec2e8ed4a2bfb8adda4e76ceac/frontend-design/SKILL.md) | Working-product hierarchy, purposeful grouping and color, complete states, rendered comparisons | Universal weighted scores, unrelated marketing/immersive modes, replacement of stronger project mobile criteria |
| [Anthropic frontend-design](https://github.com/anthropics/skills/blob/e4bb5d960d87126ff3b3a8af1a104b7db67560ba/skills/frontend-design/SKILL.md) | Explicit visual thesis, intentional typography and palette, critique of decoration and templated composition | Hero-first layouts, novelty as a goal, typeface or stack replacement, arbitrary raw colors in production components |
| [Vercel React best practices](https://github.com/vercel-labs/agent-skills/blob/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62/skills/react-best-practices/SKILL.md) | Independent request concurrency, responsive interactions, measured rendering and bundle work | Next.js/RSC APIs, automatic dependency additions, unconditional memoization, bypassing project API facades |
| [Vercel composition patterns](https://github.com/vercel-labs/agent-skills/blob/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62/skills/composition-patterns/SKILL.md) | Explicit variants and composition when actual caller complexity warrants them | Blanket bans on booleans, unnecessary providers, broad component rewrites |
| [Vercel audit skill](https://github.com/vercel-labs/agent-skills/blob/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62/skills/web-design-guidelines/SKILL.md) and [interface checklist](https://github.com/vercel-labs/web-interface-guidelines/blob/434b7f91364665f2f733b310ec54809bf8f37937/command.md) | Inspect form labels, focus, recovery, long content, input methods, and layout stability | Live upstream policy replacement, English Title Case in Russian UI, blanket autocomplete/keyboard-handler rules, list-size-only virtualization |

UX content usefulness and before/after scenario evidence live in
`../../crm-ux-design/SKILL.md` and its contract reference. Visual comparisons
live in `visual-direction.md`; acceptance separates defects from opportunities
in `visual-review.md`. React mechanics and independent audits retain their own
skills. Do not copy those workflows into this provenance file.

When updating upstream revisions, inspect the changed source and retain only
guidance that improves a demonstrated CRM use case. Check local routing,
backend ownership, current components, Russian copy, and mobile acceptance for
conflicts. Updating a source link never approves a product or visual change.
