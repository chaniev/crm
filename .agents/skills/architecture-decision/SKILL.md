---
name: architecture-decision
description: Evaluate and record a significant CRM technical or architectural choice as an ADR when alternatives affect boundaries, contracts, data, security, operability, or long-term reversibility. Do not use for product decisions or routine local implementation choices.
---

# Architecture decision

Produce a reviewable Architecture Decision Record without changing product
behavior or approving the decision on behalf of its owner.

## Establish authority and evidence

1. Read the root `AGENTS.md` and every scoped `AGENTS.md` for affected producers
   and consumers.
2. Read the accepted `REQ-*` cards, source task, implementation plan, existing
   ADRs, and approved UX or architecture contracts that constrain the choice.
3. Establish current behavior from tests and public contracts first, then
   runtime/build configuration, source code, and supporting documentation.
4. Separate product uncertainty from technical uncertainty. If different
   answers change user-visible behavior, roles, business rules, or scope, stop
   and request a product decision instead of resolving it in an ADR.

An ADR may explain how accepted requirements will be implemented. It never
overrides or silently changes them.

## Decide whether an ADR is warranted

Use an ADR when the choice is material, including:

- ownership or boundaries between Domain, Application, API, Infrastructure,
  frontend, bot, or deploy;
- a public Staff API or Internal Bot API contract with lasting consumer impact;
- a database, migration, data-ownership, retention, or recovery strategy;
- an authentication, authorization, audit, privacy, or security boundary;
- a new service, runtime integration, framework, major dependency, or shared
  cross-cutting pattern;
- a deployment topology or operability choice;
- a broad structural refactor or another costly-to-reverse decision;
- two or more credible approaches with materially different consequences.

Do not create an ADR for a small, local, readily reversible implementation
choice that follows established contracts and project conventions.

Resolve material choices and obtain required acceptance during planning,
before the plan becomes executable. Discovery of a new material choice during
execution returns the affected plan to planning with `readiness: no`; it is not
an implementation slice. Link the accepted ADR and approval provenance from
the plan's readiness metadata and `Decision evidence`.

## Compare the options

State the decision that is needed now and the concrete forces that constrain
it. Compare the current approach when it is credible and at least one genuine
alternative. Do not invent weak alternatives to satisfy a count.

Evaluate only applicable criteria:

- consistency with accepted requirements and backend-owned CRM semantics;
- contract and cross-layer impact;
- authorization, audit, privacy, and security;
- data integrity, migration safety, retention, rollback, and recovery;
- operability, observability, deployment, and failure behavior;
- performance and resource cost supported by evidence;
- implementation and maintenance complexity;
- compatibility, incremental adoption, and reversibility;
- regression coverage and how the decision can be falsified.

Use relevant layer specialists for bounded evidence or review when the decision
crosses their area. The coordinating agent resolves disagreements using the
repository evidence precedence and records unresolved conflicts; a specialist
preference does not override `REQ-*` or `AGENTS.md`.

## Record the decision

Read [the ADR convention and template](../../../docs/architecture/adr/README.md),
then create the next `docs/architecture/adr/NNNN-kebab-title.md` from
`docs/architecture/adr/_template.md`.

- Use `Proposed` for an agent-authored draft.
- Use `Accepted (name, role, YYYY-MM-DD)` only when the user or named human
  owner explicitly approves this exact decision.
- Preserve accepted ADRs. Replace a changed decision with a new ADR and mark
  the old one `Superseded by ADR-NNNN`.
- Link every applicable `REQ-*`. Use `none — <specific behavior-preserving
  reason>` only when the decision cannot change product behavior.
- Record honest negative consequences, cross-layer consumers, migration and
  rollback implications, and concrete validation.
- Update the ADR index in `docs/architecture/adr/README.md` in the same change.

If an implementation plan exists, add or update one concise link in its
`Decisions and contracts` section. Do not copy the ADR into the plan.

## Stop conditions

Leave the ADR `Proposed` and stop before implementation when:

- a required product decision or accepted requirement is missing;
- the choice conflicts with an architecture, security, data-retention, or
  deployment invariant;
- data migration or rollback cannot be made safe;
- affected producer and consumer contracts cannot be coordinated;
- evidence cannot distinguish the options and the choice is costly to reverse;
- the approving owner is unknown for a decision that requires acceptance.

## Handoff

Report the ADR path and status, selected option and decisive criteria,
discarded options, affected contracts and layers, required reviewers,
validation evidence, and remaining open questions. Never report a draft as an
accepted project decision.
