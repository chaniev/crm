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
- [ADR-0002: Backend-контракт действий и scope филиалов и залов](0002-branch-settings-action-contract.md) — Superseded by ADR-0003

- [ADR-0003: Авторизация клиентских данных по текущему филиалу администратора](0003-administrator-client-branch-scope.md) — Accepted (пользователь, владелец продукта, 2026-10-24)
- [ADR-0004: Атомарный импорт XLSX через backend и разовую CLI](0004-atomic-xlsx-client-import.md) — Superseded by ADR-0005
- [ADR-0005: Импорт XLSX из настроек с явным названием группы](0005-settings-xlsx-client-import.md) — Accepted (пользователь, владелец проекта, 2026-11-15)
- [ADR-0006: Включительная граница назначения тренера](0006-trainer-assignment-period-boundaries.md) — Accepted (пользователь, владелец проекта, 2026-11-16)

- [ADR-0007: Граница выполнения операций абонемента](0007-membership-execution-boundary.md) — Accepted (project owner, 2026-11-16)

- [ADR-0008: Shared actual schedule projection](0008-shared-schedule-projection.md) - Accepted (project owner, 2026-11-17)
- [ADR-0009: Одна запись клиента в Staff API раздела «Внимание»](0009-client-attention-response.md) — Accepted (пользователь, владелец проекта, 2026-11-21)
- [ADR-0010: Периодное основание доступа замещающего тренера](0010-substitute-group-period-access.md) — Accepted (пользователь, владелец проекта, 2026-11-22)
- [ADR-0011: Сброс пароля сотрудника и отзыв его сессий](0011-staff-password-reset.md) — Accepted (пользователь, владелец проекта, 2026-11-22)
