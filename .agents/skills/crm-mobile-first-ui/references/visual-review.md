# Visual review and acceptance

Use after implementation or for an explicitly requested design review. Review
the rendered surface, not source code alone.

## Resolve scope and evidence

State the route, flow, states, roles, and viewports inspected. For a change,
inspect the affected runtime surface and direct consumers; expand a second hop
only for shared tokens, theme values, or primitives.

Use this evidence order:

1. approved UX and visual contracts;
2. `frontend/DESIGN.md` and explicit project rules;
3. selected rendered direction;
4. current runtime at required states and widths;
5. source code only to locate the cause.

A verified defect must pass both gates:

1. **Contract** — identify a governing decision or an observable contradiction
   within the same task.
2. **Runtime** — demonstrate that the issue reaches the rendered surface.

Describe the smallest supported correction after establishing the defect. If
several incompatible remedies remain plausible, retain the verified defect
and separately state the product or technical decision needed to choose a
remedy. Do not invent intent or discard evidence because correction needs a choice.

Attempt to falsify each finding before reporting it. Separate introduced or
regressed issues from pre-existing observations.

These gates classify defects; they do not prove that a compliant design is
useful or visually satisfying. Keep improvement opportunities separate: name
the observed surface or owner feedback, proposed change, expected task benefit,
tradeoff, and a way to compare it. Label untested benefit as a hypothesis;
do not invent a contract violation to justify exploring a better design.
Opportunities are not blockers or authorization to redesign an approved flow.

## Inspect visual quality

Score each dimension from 1 to 5 and attach concrete evidence; a number without
evidence is not a result.

| Dimension | Evidence to inspect |
|---|---|
| Task hierarchy | Primary task and required decision data are immediately distinguishable |
| Scanability | Reading order, grouping, alignment, and repeated structures support fast scanning |
| Density | Information is compact without cramped targets, labels, or recovery paths |
| Typography | Onest hierarchy, wrapping, numerals, and emphasis are consistent and readable |
| Rhythm | Spacing and alignment follow a coherent system rather than local patchwork |
| Visual identity | Surfaces, borders, color, icons, and emphasis match the selected direction and its approved changes to `frontend/DESIGN.md` |
| Interaction feedback | Focus, pending, disabled, success, error, and motion are legible |
| Responsive integrity | Mobile and desktop are deliberate transformations of the same task |

Inspect at least 390 x 844, both target iPhone portrait sizes for a significant
mobile workflow, and 1440 px. Include long realistic content and all applicable
operational states. Use behavioral assertions for semantics and interaction;
screenshots supplement rather than replace them.

For simplification, compare the UX contract's before/after task and content
decisions: confirm removed duplicates, discoverable deferred details, preserved
context, and reachable frequent actions. For palette work, compare the same
composition and data, including focus, selection, and consequential status
states. Do not infer faster work from a cleaner screenshot or accept lost
functionality in exchange for a higher visual score.

## Report

Lead with the five highest-impact supported design findings when there are
many, ordered by user impact, confidence, reach, and correction cost. Briefly
list additional material defects with location, evidence, and impact rather
than omitting them to satisfy a count:

| # | Problem | Contract | Runtime evidence | Correction | Scope | Confidence |
|---|---|---|---|---|---|---|

Then provide:

- a separate list of supported improvement opportunities when relevant to the
  requested design review; none is a valid outcome;
- the highest-leverage improvement;
- comparison with the selected direction;
- quality-rubric evidence;
- validation performed and unverified device conditions;
- one self-critique naming the weakest remaining design decision.

Do not pad a clean defect review with preferences. `No supported defects` is a
valid result and does not mean that improvement opportunities were tested or
the owner approved the design. A taste preference may guide a requested visual
comparison when clearly attributed to its owner.
