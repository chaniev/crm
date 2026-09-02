# Architecture Decision Records

This directory records significant technical and architectural choices for the
CRM. Product behavior remains normative in `docs/requirements/**`; an ADR
explains how accepted requirements are implemented and cannot override them.

## When an ADR is required

Create an ADR for a material choice involving system or layer boundaries,
shared contracts, data ownership or migration, authentication or security,
deployment topology, a new service or foundational technology, a broad
structural refactor, or another costly-to-reverse decision.

Routine local implementation choices that follow established contracts do not
need an ADR.

## Lifecycle

```text
Proposed -> Accepted (name, role, YYYY-MM-DD)
         -> Deprecated
Accepted -> Superseded by ADR-NNNN
```

An agent creates `Proposed` drafts. Only an explicit user decision or a named
human owner may set `Accepted`. Accepted ADRs are immutable except for status
and links required to supersede them; a changed decision is recorded in a new
ADR.

## Naming and traceability

- File: `NNNN-kebab-title.md`.
- Title: `# ADR-NNNN: Short title`.
- Start from [`_template.md`](_template.md).
- Link applicable accepted `REQ-*` cards. Use
  `none — <specific behavior-preserving reason>` only when product behavior is
  unaffected.
- Link an accepted ADR from the implementation plan's `Decisions and contracts`
  section when a plan exists.
- Use `.agents/skills/architecture-decision/SKILL.md` to evaluate and draft the
  decision.

## Index

- [ADR-0001: Регистронезависимая идентичность логина через нормализованный ключ](0001-case-insensitive-login-identity.md) — Proposed
