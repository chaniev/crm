# Visual direction and design gate

Use for a new screen or material redesign. The purpose is to discover a strong
direction before production code makes an early idea expensive to challenge.

## Gather evidence

Inspect:

- the current rendered screen and adjacent flows;
- `frontend/DESIGN.md`, theme tokens, and shared components;
- realistic CRM content, including long names and values;
- user-provided references and explicit likes or dislikes;
- backend capabilities and the approved UX contract.

Do not infer the owner's taste from generic words such as `modern`, `clean`, or
`professional`. When references are unavailable, preserve the established CRM
visual language and state the uncertainty.

## Write the visual brief

Record:

```text
SURFACE
- Route or component:
- Primary user and task:
- Current problem:

VISUAL INTENT
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

## Produce divergent directions

Create three directions by default. Each must differ on a named, consequential
axis such as information architecture, density, grouping, navigation model, or
interaction model. Color-only, radius-only, and spacing-only differences are
not separate directions.

Every direction must:

- preserve the same backend capabilities and UX contract;
- use Mantine, Onest, current tokens, and realistic product content;
- show the primary state at 390 x 844 and 1440 px;
- include at least the most consequential non-happy state;
- be complete enough to judge hierarchy, rhythm, density, and interaction;
- state when it is the right choice and what it costs.

Prefer a live isolated prototype using real project components. A high-fidelity
static artifact is acceptable when interaction is not the decision under
review. Do not modify production routes or components before selection.

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
- operational and interaction states;
- visual acceptance criteria;
- differences between the selected artifact and the implementation contract.

Delete temporary prototype code after promotion unless the user explicitly
asks to retain it. Preserve rendered evidence needed for review according to
the task workspace policy.
