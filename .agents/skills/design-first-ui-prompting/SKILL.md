---
name: design-first-ui-prompting
description: Use when you need design-first, spec-driven, skimmable prompts for UI generation. Covers prompt structure, constraints, variations, typography/spacing rules, and iteration workflow for consistent UI outputs.
---

# Design-First UI Prompting Skill

This skill is for **design-first prompting**: turn fuzzy ideas into a tight spec that produces consistent UI.

## Scope boundary

Use this skill for prompts that generate static visual directions, demos,
landing pages, marketing surfaces, or external UI-generator output.

For CRM product screens, `.agents/skills/crm-mobile-first-ui/SKILL.md`, the UX
contract, backend contracts, Mantine and Onest, and measurable interaction
acceptance are authoritative. Do not translate image-oriented format, imagery,
style, or negative-prompt examples into product requirements unless the
deliverable explicitly includes a generated visual artifact.

When the generated artifact depicts an operational product workflow, add an
`OPERATIONAL CONTRACT` block to every screen prompt. State which controls are
visible, disabled, absent, or deferred from supplied capabilities; preserve
supplied backend reasons verbatim; forbid inferred role, urgency, conflict, or
validation semantics. For every temporary surface or route transition, state
open/close behavior, focus return, and the exact context restored on return
(URL/query, entity or group anchor, and scroll position). Keep these behavioral
requirements in the prompt even when a static image cannot prove them; identify
them as implementation annotations rather than inventing visual decoration.

## Core principle
**Prompt like a design system, not a wish.**

## Prompt Structure (copy/paste)
Use this skeleton, then fill the blanks.

```text
GOAL
- What are we making? (e.g., landing page hero / onboarding / dashboard / carousel slide)
- Who is it for? (persona)
- What’s the success criteria? (clarity, conversion, vibe)

FORMAT
- Size/aspect: (e.g., 1080x1350)
- Safe margins: (e.g., 90px)

LAYOUT (wireframe in words)
- Grid: (e.g., Swiss 6-col)
- Placement: (e.g., type-left / image-right)
- Hierarchy: H1 → subhead → body → CTA

TYPE SYSTEM
- Font vibe: (e.g., Söhne / Neue Haas / SF Pro)
- Weights: (H1 700, body 400)
- Leading: (tight for H1, readable for body)
- Tracking: (micro labels wider)

COLOR + MATERIAL
- Background: (hex or description)
- Text: (white/ivory/charcoal)
- One accent only: (cyan/lime/purple)
- Texture: (subtle grain, no plastic HDR)

IMAGERY / UI STYLE
- UI style: (minimal / glass / editorial / playful 3D)
- If photo: lighting + crop + texture rules
- If 3D: materials + lighting + softness

COPY (render EXACTLY)
- Line 1:
- Line 2:
- ...

CONSTRAINTS (change 1–2 things only)
- FONT: ___
- STYLE: ___
- MODE: ___

NEGATIVE PROMPT
- No logos, no watermarks
- No extra text beyond provided lines
- No gibberish typography
```

## Rules that improve consistency

### 1) Lock one “system”, then iterate with variants
- First output: nail **layout + hierarchy + copy**.
- Variants: change **ONE variable** at a time:
  - angle / crop
  - accent color
  - card arrangement
  - background tone

### 2) Treat typography as fragile
If the model keeps misspelling:
- Use **2-pass workflow**:
  1) Generate without text (reserve a clean text-safe area)
  2) Typeset in Figma

### 3) Use “constraints cards”
When you want the model to obey a style:
- Add a small “Constraints” panel with explicit values.
- It anchors the output like a mini style guide.

Example:
```text
Constraints
FONT  CANELA
STYLE  MINIMAL
MODE  DARK
```

### 4) Keep a local reference pack
Don’t ask the model to “remember” taste.
- Save references into a gitignored local reference folder, such as `refs/...`
- Point prompts to the reference style

## Fast iteration checklist (what to tweak)
- Spacing: margins, leading, baseline rhythm
- Contrast: background vs text
- Hierarchy: one hero line, one support line
- One accent only (don’t rainbow)
- Texture: add grain, remove smoothing

## Questions to ask (when user is vague)
- What’s the single message of this screen?
- What’s the hierarchy (H1 / sub / CTA)?
- Which style lane: minimal editorial vs playful 3D vs glass UI?
- Any must-keep constraints (font vibe, color, spacing, grid)?
