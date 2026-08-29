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

A finding must pass all three gates:

1. **Contract** — identify a governing decision or an observable contradiction
   within the same task.
2. **Runtime** — demonstrate that the issue reaches the rendered surface.
3. **Correction** — name one deterministic smallest correction. If several
   incompatible corrections remain plausible, report a product decision rather
   than a defect.

Attempt to falsify each finding before reporting it. Separate introduced or
regressed issues from pre-existing observations.

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
| Visual identity | Surfaces, borders, color, icons, and emphasis match `frontend/DESIGN.md` |
| Interaction feedback | Focus, pending, disabled, success, error, and motion are legible |
| Responsive integrity | Mobile and desktop are deliberate transformations of the same task |

Inspect at least 390 x 844, both target iPhone portrait sizes for a significant
mobile workflow, and 1440 px. Include long realistic content and all applicable
operational states. Use behavioral assertions for semantics and interaction;
screenshots supplement rather than replace them.

## Report

Report no more than five supported design findings, ordered by user impact,
confidence, reach, and correction cost:

| # | Problem | Contract | Runtime evidence | Correction | Scope | Confidence |
|---|---|---|---|---|---|---|

Then provide:

- the highest-leverage improvement;
- comparison with the selected direction;
- quality-rubric evidence;
- validation performed and unverified device conditions;
- one self-critique naming the weakest remaining design decision.

Do not pad a clean review with preferences. `No supported findings` is a valid
result.
