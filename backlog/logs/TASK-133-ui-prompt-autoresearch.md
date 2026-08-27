# TASK-133 UI prompt autoresearch evidence

## Scope

- Target: `.agents/skills/design-first-ui-prompting/SKILL.md`.
- Dataset: dense mobile schedule, mobile deferred-action surface, dense desktop schedule and held-out operational states.
- Eval version: `task133-v1`; six binary checks covered task-first action hierarchy, exact-interval identity, responsive geometry, backend capability boundaries, interaction/return context and truthful operational states.
- Runner: three fresh candidate-level contexts for baseline and candidate with the same model and tools. Each context received the four-screen prompt pack; prompts were not isolated from one another inside a trial.

## Results

| Experiment | Development | Holdout | Decision |
|---|---:|---:|---|
| Untouched baseline | `30/33` | `12/15` | Mutate |
| Operational-contract candidate | `33/33` | `15/15` | Promote |

Baseline failures repeated in all three trials: the mobile `Ещё` prompt did not explicitly gate deferred actions through backend capabilities, and the holdout prompt did not preserve exact URL/query, group/card anchor and scroll restoration.

The promoted mutation adds one reusable `OPERATIONAL CONTRACT` paragraph requiring capability-driven visibility, verbatim backend reasons, exclusion of inferred semantics, temporary-surface close/focus behavior and exact return context. All frozen checks passed in three candidate trials with no holdout regression.

## Promotion

- Promoted into `.agents/skills/design-first-ui-prompting/SKILL.md` on 2026-08-27.
- The temporary `autoresearch-design-first-ui-prompting` bundle and raw trials were removed after promotion and validation.
- TASK-133 mockups remain under `backlog/mockups/TASK-133-schedule-task-first-cards/proposed/`.
