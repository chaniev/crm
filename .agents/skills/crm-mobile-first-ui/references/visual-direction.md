# Visual direction and design gate

Use for a new screen, material redesign, or an explicitly requested palette
change. Resolve task structure and color as separate decisions so the owner
can tell what improved the result.

## Gather evidence

Inspect:

- the current rendered screen and adjacent flows;
- `frontend/DESIGN.md`, theme tokens, and shared components;
- realistic CRM content, including long names and values;
- user-provided references and explicit likes or dislikes;
- backend capabilities and the approved UX contract.

Do not infer the owner's taste from generic words such as `modern`, `clean`, or
`professional`. When references are unavailable, preserve the established CRM
visual language unless its replacement is the requested scope. In that case,
propose bounded alternatives and state the uncertainty without treating the
current colors as immutable or inventing a preferred style for the owner.

## Write the visual brief

Record:

```text
SURFACE
- Route or component:
- Primary user and task:
- Current problem:

VISUAL INTENT
- One-sentence visual thesis tied to the user's task:
- Fixed properties and properties open for redesign:
- Desired character:
- Density:
- Hierarchy:
- Acceptable novelty:
- Existing successful exemplar:
- References and the exact property taken from each:
- Directions to avoid:

CONSTRAINTS
- Required content and actions:
- Backend-supplied states and reasons:
- Shared components and tokens:
- Target viewports:

SELECTION CRITERIA
- What must become faster to understand or operate:
- What visual qualities distinguish a strong result:
```

## Compare task structure

Create three directions by default. Each must differ on a named, consequential
axis such as information architecture, density, grouping, navigation model, or
interaction model, within the agreed UX contract. Color-only, radius-only,
and spacing-only differences do not demonstrate an alternative task structure.
Keep the palette stable during this comparison. Do not reopen an approved
workflow merely to manufacture three options; a palette-only request skips
this comparison. Resolve proposed changes to the UX contract before treating
them as implementation-ready.

Every direction must:

- preserve the same backend capabilities and UX contract;
- use Mantine, Onest, shared token roles, and realistic product content;
- show the primary state at 390 x 844 and 1440 px;
- include at least the most consequential non-happy state;
- be complete enough to judge hierarchy, rhythm, density, and interaction;
- state when it is the right choice and what it costs.

Prefer a live isolated prototype using real project components. A high-fidelity
static artifact is acceptable when interaction is not the decision under
review. Do not modify production routes or components before selection.

## Compare palettes on one composition

When color is unresolved, show three palette candidates by default on the
same selected or existing composition. Reuse an already selected palette;
a deterministic local color fix needs before/after evidence, not alternatives.
Hold text, data, actions, density, typography, states, and viewport constant.
Show mobile and desktop plus a consequential error, selected, or restricted
state. A row of color swatches alone does not establish interface quality.

Describe candidates by their intended effect on this workspace rather than
marketing names. For each, define page and raised surfaces, primary/secondary
text, borders, action accent, selection, focus, and their interactive states.
Neutral surfaces with an accent are a useful candidate, not a mandatory style;
do not impose a universal color ratio or a predetermined winning hue.

Preserve functional status meanings and non-color cues. Check action versus
status distinction, actual foreground/background contrast, and whether
decorative tinting competes with data. Inspect both profile-driven and fixed
semantic values before promising a complete theme change. The design contract
must identify the shared values affected, including fallback/customer-branding
compatibility when relevant; changing only the primary hue may be insufficient.

Prototype proposed values in an isolated artifact without changing production
tokens. Choosing a palette does not authorize changing business status semantics,
branding API contracts, or persistence; route any such dependency to planning.

## Critique hierarchy and visual character

Use a working-product composition: a clear locator, task content, and contextual
actions. Cards, badges, separators, icons, and helper copy need a grouping,
recognition, decision, or feedback purpose. Compare removal or consolidation
of a questionable element before adding more styling. Preserve labels, frequent
actions, consequences, and recovery information required by the UX contract.

Use Onest weight, scale, alignment, and spacing to establish hierarchy before
adding color. Keep intentional identity where it helps recognition without
requiring novelty, a hero, ornamental typography, or animation. Review the
rendered screen for competing accents and fragmented groups; identify the
weakest remaining choice and what evidence would justify changing it.

## Present and select

Use a comparison table:

| Direction | Design axis | Main advantage | Cost or risk | UX-contract fit |
|---|---|---|---|---|

Do not preselect a winner merely because it is visually expressive. Recommend
one only when the recommendation is tied to task frequency, product character,
content, and selection criteria.

The user may select one direction, combine compatible parts, or request another
round. Record the feedback and produce one refined direction. This is a
meaningful product choice; do not silently choose on the user's behalf.

## Promote the selected direction

Before implementation, record:

- selected direction and rejected alternatives;
- user feedback incorporated;
- exact hierarchy and responsive transformations;
- selected palette, its semantic role mapping, and authorized deviations from
  current visual values when those were part of the requested redesign;
- operational and interaction states;
- visual acceptance criteria;
- differences between the selected artifact and the implementation contract.

Delete temporary prototype code after promotion unless the user explicitly
asks to retain it. Preserve rendered evidence needed for review according to
the task workspace policy.
