# 2026-07-22 08:31

## Moved to implementation
- /backlog/implementation/TASK-077-membership-sale-amount-override.md

## Created implementation plans
- none — existing `/backlog/implementation-plans/TASK-077-membership-sale-amount-override.plan.md` was updated after product/architecture approval.

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 0
- plans updated: 1
- note: user approved active implementation status, whole-RUB-only catalog/sale/refund values, explicit confirmation of each new individual sale amount, nullable request semantics, strict preserve-SingleVisit inputs, canonical sale-owned behavior and executable assertion-based red/green testing. Project code was not changed; implementation remains isolated to `feature/TASK-077-membership-sale-amount-override`.

# 2026-07-22 00:30

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-077-membership-sale-amount-override.plan.md

## Skipped tasks
- TASK-077-membership-sale-amount-override.md — not moved: source task remains in `/backlog/risky`, is high risk and `Safe for Codex: no`; plan created for product/architecture review before active implementation in branch `feature/TASK-077-membership-sale-amount-override`.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: plan makes `ClientMembershipSale.GrossAmount` the only monetary source, removes the duplicated membership amount, introduces explicit pricing provenance and nullable catalog support, and blocks execution until amount-only behavior, zero-amount policy and the sale-producing operation matrix are approved.

# 2026-07-21 22:06

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-069-membership-comment-audit.plan.md

## Skipped tasks
- TASK-069-membership-comment-audit.md — not moved: source task remains in `/backlog/risky`, is high risk and `Safe for Codex: no`; plan created for explicit review before active implementation in branch `feature/TASK-069-membership-comment-audit`.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: stable membership identity was confirmed as `ClientMembershipSale.Id`/`saleId`; the plan keeps comment metadata on the sale, requires test-first authorization/audit/isolation coverage and blocks completion on any financial, validity, refund, write-off or versioning side effect.

# 2026-06-29 00:00

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-061-membership-validity-end-date.plan.md

## Skipped tasks
- TASK-061-membership-validity-end-date.md - not moved: source task remains in `/backlog/risky`, is high risk and `Safe for Codex: no`; plan created for explicit review before active implementation in branch `fix/TASK-061-membership-validity-end-date`.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: risky membership-semantics bugfix planned with backend-owned inclusive expiration calculation, frontend suggestion alignment, automated regression coverage for `2026-06-10 -> 2026-07-09`, and stop conditions for data migration or broader contract changes.

# 2026-06-28 23:08

## Moved to implementation
- /backlog/implementation/TASK-062-admin-active-label.md

## Created implementation plans
- /backlog/implementation-plans/TASK-062-admin-active-label.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: low-risk frontend UI-copy bugfix selected explicitly by user; plan keeps backend role semantics unchanged and defines automated regression coverage for administrator and trainer labels.

# 2026-06-12 14:06

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-060-expired-memberships-access.plan.md

## Skipped tasks
- TASK-060-expired-memberships-access.md - not moved: task is in `/backlog/risky` and touches roles, permissions and membership semantics; implementation plan created, active code execution requires explicit review and dedicated branch `feature/TASK-060-expired-memberships-access`.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: risky task planning is allowed by the skill; source task remains in `/backlog/risky`, with regression barriers and stop conditions captured in the plan.

# 2026-06-09 20:12

## Moved to implementation
- /backlog/implementation/TASK-059-merge-home-attendance.md

## Created implementation plans
- /backlog/implementation-plans/TASK-059-merge-home-attendance.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: full-stack backend/frontend task selected because clarification is complete, scope is localized to access scope, routing, navigation and the merged home/attendance screen, and the plan includes automated regression barriers.

# 2026-05-07 21:28

## Moved to implementation
- /backlog/implementation/TASK-024-left-side-main-menu.md

## Created implementation plans
- /backlog/implementation-plans/TASK-024-left-side-main-menu.plan.md

## Skipped tasks
- TASK-023-client-card-notes.md — skipped: current backend client domain/contract has no notes field, so implementation would require a DB/schema migration; skill forbids moving migration-touching tasks into implementation.
- TASK-029-rename-users-to-trainers.md — skipped: current `Users` section manages administrators and coaches, not only trainers; task constraints require stopping for IA clarification in this case.

## Summary
- moved: 1
- skipped: 2
- plans created: 1

# 2026-05-07 21:56

## Moved to implementation
- /backlog/implementation/TASK-023-client-card-notes.md

## Created implementation plans
- /backlog/implementation-plans/TASK-023-client-card-notes.plan.md

## Skipped tasks
- TASK-029-rename-users-to-trainers.md — skipped: current `Users` section manages `HeadCoach`, `Administrator` and `Coach` accounts; task constraints require stopping if the section is not trainer-only.

## Summary
- moved: 1
- skipped: 1
- plans created: 1

# 2026-05-07 22:21

## Moved to implementation
- none

## Created implementation plans
- none

## Skipped tasks
- TASK-029-rename-users-to-trainers.md — skipped: current frontend `users` resource covers `HeadCoach`, `Administrator` and `Coach`, while task constraints require stopping if the section manages not only trainers; information architecture must be clarified before implementation planning.

## Summary
- moved: 0
- skipped: 1
- plans created: 0

# 2026-05-07 23:01

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-027-professional-client-privilege.plan.md
- /backlog/implementation-plans/TASK-031-branches-backend-domain-contracts.plan.md
- /backlog/implementation-plans/TASK-032-branches-frontend-settings-and-forms.plan.md
- /backlog/implementation-plans/TASK-033-branches-bot-contract-consumer.plan.md

## Skipped tasks
- TASK-027-professional-client-privilege.md — not moved: task is in `/backlog/risky`; high-risk planning is allowed, but active implementation selection requires explicit review.
- TASK-031-branches-backend-domain-contracts.md — not moved: task is in `/backlog/risky`; high-risk planning is allowed, but active implementation selection requires explicit review.
- TASK-032-branches-frontend-settings-and-forms.md — not moved: task is in `/backlog/risky` and depends on TASK-031 backend contracts; plan created, active implementation blocked until backend contract is stable.
- TASK-033-branches-bot-contract-consumer.md — not moved: task is in `/backlog/risky` and depends on TASK-031 backend contracts; plan created, active implementation blocked until backend contract is stable.

## Summary
- moved: 0
- skipped: 4
- plans created: 4

# 2026-05-12 22:19

## Moved to implementation
- /backlog/implementation/TASK-030-crm-settings-section.md

## Created implementation plans
- /backlog/implementation-plans/TASK-030-crm-settings-section.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1

# 2026-05-13 13:30

## Moved to implementation
- /backlog/implementation/TASK-029-rename-users-to-trainers.md

## Created implementation plans
- /backlog/implementation-plans/TASK-029-rename-users-to-trainers.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1

# 2026-05-13 17:18

## Moved to implementation
- /backlog/implementation/TASK-034-group-schedule-backend-model.md

## Created implementation plans
- /backlog/implementation-plans/TASK-034-group-schedule-backend-model.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1

# 2026-05-13 18:01

## Moved to implementation
- /backlog/implementation/TASK-035-group-schedule-frontend-experience.md

## Created implementation plans
- /backlog/implementation-plans/TASK-035-group-schedule-frontend-experience.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: task is marked high risk, but has clear acceptance criteria and no unresolved clarification questions; plan includes dependency, UX and regression barriers.

# 2026-05-13 20:42

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-026-statistics-and-financial-reports.plan.md

## Skipped tasks
- TASK-026-statistics-and-financial-reports.md - not moved: task is marked high risk and its own scope is decomposition into separate implementation tasks, not direct financial report implementation; plan created for safe backlog-only decomposition.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: direct product-code execution is intentionally blocked until TASK-026 creates smaller backend/frontend implementation tasks with automated regression barriers.

# 2026-05-13 20:54

## Moved to implementation
- none

## Created implementation tasks
- /backlog/risky/TASK-036-membership-refunds-sale-semantics.md
- /backlog/risky/TASK-037-financial-reports-backend-api.md
- /backlog/risky/TASK-038-finance-reports-frontend.md

## Closed tasks
- /backlog/done/TASK-026-statistics-and-financial-reports.md

## Created implementation plans
- none

## Skipped tasks
- none

## Summary
- moved: 0
- skipped: 0
- plans created: 0
- tasks created: 3
- tasks closed: 1
- note: TASK-026 was decomposed into three risky implementation tasks; direct product-code implementation remains delegated to those smaller tasks.

# 2026-05-13 22:33

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-037-financial-reports-backend-api.plan.md

## Skipped tasks
- TASK-037-financial-reports-backend-api.md - not moved: task is in `/backlog/risky`, touches financial aggregates and access behavior, and depends on `TASK-036` sale/refund/period attribution contracts before product-code execution.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: plan created for high-risk backend report API; active implementation is conditional on completing `TASK-036` and creating a dedicated TASK-037 branch from updated `main`.

# 2026-05-13 22:32

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-036-membership-refunds-sale-semantics.plan.md

## Skipped tasks
- TASK-036-membership-refunds-sale-semantics.md - not moved: task is in `/backlog/risky`; high-risk planning is allowed, but active implementation selection requires explicit review and a dedicated implementation branch.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: plan created for phased backend implementation of membership sale/refund semantics and historical attribution periods; source task remains in `/backlog/risky`.

# 2026-05-13 22:33

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-038-finance-reports-frontend.plan.md

## Skipped tasks
- TASK-038-finance-reports-frontend.md - not moved: task is marked high risk, depends on TASK-037 backend report API, and direct frontend implementation must wait for a stable backend contract; plan created for safe implementation preparation.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: TASK-038 remains in /backlog/risky; implementation can start later in feature/TASK-038-finance-reports-frontend after TASK-037 exposes the required report and access contracts.

# 2026-05-14 13:58

## Moved to implementation
- /backlog/implementation/TASK-043-schedule-calendar-like-view.md

## Created implementation plans
- /backlog/implementation-plans/TASK-043-schedule-calendar-like-view.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: task is marked high risk because it touches backend contract, frontend schedule UI and access behavior, but it has closed clarification questions, clear acceptance criteria and a concrete automated regression strategy.

# 2026-05-14 21:17

## Moved to implementation
- /backlog/implementation/TASK-042-audit-log-grid-actor-full-name.md

## Created implementation plans
- /backlog/implementation-plans/TASK-042-audit-log-grid-actor-full-name.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: task is medium risk and localized to frontend audit presentation; backend contract changes are out of scope unless implementation discovers missing actor full name data, in which case a backend follow-up should be created.

# 2026-05-14 22:33

## Moved to implementation
- /backlog/implementation/TASK-044-hide-technical-information.md

## Created implementation plans
- /backlog/implementation-plans/TASK-044-hide-technical-information.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: task is low risk and localized to frontend route-level presentation cleanup; implementation must preserve primary actions and add a Playwright regression barrier for absence of top service intro/hero blocks.

# 2026-05-15 00:15

## Moved to implementation
- /backlog/implementation/TASK-040-notifications-auto-dismiss.md

## Created implementation plans
- /backlog/implementation-plans/TASK-040-notifications-auto-dismiss.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: task is low risk and localized to frontend in-app notification behavior; implementation should start with explicit Mantine provider `autoClose`/`limit` and add a helper only if duplicate queues still accumulate.

# 2026-05-15 14:39

## Moved to implementation
- /backlog/implementation/TASK-045-schedule-mockup-polish.md
- /backlog/implementation/TASK-046-frontend-unified-visual-style.md

## Created implementation plans
- /backlog/implementation-plans/TASK-045-schedule-mockup-polish.plan.md
- /backlog/implementation-plans/TASK-046-frontend-unified-visual-style.plan.md

## Skipped tasks
- none

## Summary
- moved: 2
- skipped: 0
- plans created: 2
- note: selected explicit frontend visual batch. `TASK-045` must execute first in its own branch and produce reusable visual baseline/handoff notes; `TASK-046` must start later from updated `main` after `TASK-045` is available.

# 2026-05-20 19:48

## Moved to implementation
- /backlog/implementation/TASK-047-mobile-left-side-menu.md

## Created implementation plans
- /backlog/implementation-plans/TASK-047-mobile-left-side-menu.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: task is low risk and localized to authenticated frontend app shell; implementation must keep navigation visibility driven by existing backend-derived user permissions and add responsive Playwright regression coverage for mobile left vertical navigation.

# 2026-05-20 23:53

## Moved to implementation
- /backlog/implementation/TASK-048-frontend-content-layout-contract.md

## Created implementation plans
- /backlog/implementation-plans/TASK-048-frontend-content-layout-contract.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: source task was explicitly selected from `/backlog/needs-clarification` but already had `Status: ready`; implementation is frontend-only, high-regression due to shared route layout, and must start with a `ui-designer` checkpoint before code migration.

# 2026-05-21 22:13

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-039-crm-messenger-chat-integration.plan.md

## Skipped tasks
- TASK-039-crm-messenger-chat-integration.md - not moved: source task remains in `/backlog/needs-clarification`, is marked high risk, and should be reviewed/decomposed before active implementation selection.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: plan created for Telegram client chat integration. Direct execution is conditional on accepting the Telegram status limitations and choosing phased single-branch implementation or separate backend/frontend/runtime subtasks.

# 2026-05-21 22:50

## Moved to implementation
- none

## Created implementation plans
- none

## Skipped tasks
- TASK-039-crm-messenger-chat-integration.md - not moved: plan updated only. MVP decision is now fixed as separate official Telegram bot with one-time QR/deep-link onboarding.

## Summary
- moved: 0
- skipped: 1
- plans created: 0
- note: updated TASK-039 source notes and implementation plan to remove Telegram Business/user-account alternatives from MVP and to keep Telegram-level delivered/read receipts out of MVP.

# 2026-05-22 17:02

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-049-deploy-club-name-branding.plan.md

## Skipped tasks
- TASK-049-deploy-club-name-branding.md - not moved: source task remains in `/backlog/risky`, is medium risk due to backend/frontend/deploy runtime configuration, and should be executed only from its dedicated branch after plan review.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: plan created for deploy-time club name branding. Implementation should be contract-first via backend-normalized config, frontend consumption without separate env logic, deployment env examples, backend contract tests, frontend bootstrap/e2e coverage and compose validation.

# 2026-05-23 12:57

## Moved to implementation
- /backlog/implementation/TASK-052-frontend-content-layout-before-clients-mockups.md

## Created implementation plans
- /backlog/implementation-plans/TASK-052-frontend-content-layout-before-clients-mockups.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: task was explicitly selected by the user from `/backlog/tasks-ready`; it is a frontend-only prerequisite gate for `TASK-050` and must reconcile the `TASK-048` shared content-layout baseline with the clients mockups before unblocking clients-specific implementation.

# 2026-05-23 13:20

## Moved to implementation
- /backlog/implementation/TASK-051-mobile-bottom-navigation.md

## Created implementation plans
- /backlog/implementation-plans/TASK-051-mobile-bottom-navigation.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: task was explicitly selected by the user from `/backlog/tasks-ready`; it is a frontend-only all-screen mobile shell task that must derive bottom navigation from existing backend/session section access, keep desktop navigation unchanged and avoid fake notifications routes.

# 2026-05-24 12:33

## Moved to implementation
- /backlog/implementation/TASK-055-schedule-screen-mockups.md

## Created implementation plans
- /backlog/implementation-plans/TASK-055-schedule-screen-mockups.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: task was explicitly selected by the user from `/backlog/tasks-ready`; it is medium risk and localized to frontend schedule UI, with backend contract changes, schedule business rules and dated event semantics explicitly blocked unless a separate contract task is created.

# 2026-05-27 19:14

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-053-hide-group-type-system-identifier.plan.md

## Skipped tasks
- TASK-053-hide-group-type-system-identifier.md - not moved: source task remains in `/backlog/risky`, is high risk and `Safe for Codex: no`; plan created for explicit review before any active implementation selection.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: plan created for full removal of group type `SystemIdentifier` from backend domain/schema/API/audit state and frontend consumers. Implementation must be contract-first in `feature/TASK-053-hide-group-type-system-identifier`, with backend tests, frontend lint/build/e2e, and final source search as regression barriers.

# 2026-05-27 23:25

## Moved to implementation
- /backlog/implementation/TASK-056-filter-panel-requirements.md

## Created implementation plans
- /backlog/implementation-plans/TASK-056-filter-panel-requirements.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: task was explicitly selected by the user from `/backlog/tasks-ready`; it is frontend-only, medium risk, and must use `feature/TASK-056-filter-panel-requirements` with `ui-designer` visual validation, `react-specialist` React structure ownership, Mantine/Onest preserved, and Playwright responsive regression coverage for all current filter screens.

# 2026-05-29 16:49

## Moved to implementation
- /backlog/implementation/TASK-057-audit-log-remove-object-column.md

## Created implementation plans
- /backlog/implementation-plans/TASK-057-audit-log-remove-object-column.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: task was explicitly selected by the user from `/backlog/tasks-ready`; it is low-risk and localized to the frontend audit log display. Implementation must use `feature/TASK-057-audit-log-remove-object-column`, keep backend audit contracts and details data unchanged, and add automated regression coverage for the removed visible title and `Объект` grid column.

# 2026-06-29 01:05

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-063-head-coach-group-assignment.plan.md

## Skipped tasks
- TASK-063-head-coach-group-assignment.md - not moved: source task remains in `/backlog/risky`, is high risk and `Safe for Codex: no`; implementation plan created for explicit review before active implementation selection.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: plan created for allowing HeadCoach to be assigned as a group trainer through backend-owned options and validation, with report consumer compatibility, frontend group-form regression coverage, and explicit permission/access-scope regression barriers.

# 2026-07-12 19:33

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-064-home-attendance-membership-tabs.plan.md

## Skipped tasks
- TASK-064-home-attendance-membership-tabs.md - not moved: source task remains in `/backlog/risky`, is high risk and `Safe for Codex: no`; implementation plan created for explicit review before active implementation selection in branch `feature/TASK-064-home-attendance-membership-tabs`.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: plan localizes tri-state attendance, exact single-visit restoration provenance, atomic attendance/membership audit, shared internal bot compatibility, permission-aware tabs, row-level retry, state preservation and six-width responsive regression coverage.

# 2026-07-13 20:22

## Moved to implementation
- /backlog/implementation/TASK-065-groups-overview-compact.md

## Created implementation plans
- /backlog/implementation-plans/TASK-065-groups-overview-compact.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: task was explicitly selected by the user from `/backlog/tasks-ready`; it is a low-risk additive full-stack task prepared for `feature/TASK-065-groups-overview-compact`, with a separate backend summary contract, independent frontend loading/error states, UI-designer responsive/accessibility review, automated >50-row aggregation protection and Playwright geometry barriers.

# 2026-07-13 20:52

## Moved to implementation
- none

## Created implementation plans
- none

## Skipped tasks
- none

## Summary
- moved: 0
- skipped: 0
- plans created: 0
- plans updated: 1 (`TASK-065-groups-overview-compact.plan.md`)
- note: plan aligned with the latest approved desktop/mobile mockups and ui-designer review: no visible `Группы`, `Обзор групп`, `Список групп` or `Активные`; the additive backend summary contains only total and active-without-trainer counts; metrics and both actions share one <=60 px row with full `Создать группу` at 320 px, immediately before titleless list rows; visually hidden H1/H2 preserve accessibility.

# 2026-07-19 12:29

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-066-attendance-unmarked-default-filter.plan.md

## Skipped tasks
- TASK-066-attendance-unmarked-default-filter.md - not moved: source task remains in `/backlog/risky`, is medium risk and `Safe for Codex: no`; implementation plan created for explicit review before active implementation selection in branch `feature/TASK-066-attendance-unmarked-default-filter`.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: plan localizes the change to a frontend derived view over the complete backend roster, removes rows only after confirmed save, preserves failed rows and retry, keeps a full-list view, and requires component, Playwright and backend attendance regression barriers.

# 2026-07-19 16:19

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-070-membership-catalog.plan.md

## Skipped tasks
- TASK-070-membership-catalog.md — not moved: source task remains in `/backlog/risky`, is high risk and `Safe for Codex: no`; implementation plan created for explicit review before active implementation selection.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: plan defines `feature/TASK-070-membership-catalog`, test-first PostgreSQL/API/UI coverage, immutable sale-price and atomic purchase/transfer barriers, administrator branch scope and audit. Updated requirement adds explicit catalog behavior kind `Professional`, removes the independent professional checkbox/write flow, derives privileges from the effective membership, preserves HeadCoach-only assignment and adds backend/frontend/bot regression coverage.

# 2026-07-19 20:15

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-067-missed-training-follow-up.plan.md

## Skipped tasks
- TASK-067-missed-training-follow-up.md — not moved: source task remains in `/backlog/tasks-ready`; risk is high and the current backend model has no canonical membership-freeze interval, while the acceptance criteria require freeze to break the missed-training sequence. Planning and safe decomposition completed pending prerequisite confirmation.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: plan defines `feature/TASK-067-missed-training-follow-up`, test-first streak and unified-attention coverage, backend-owned unique-client aggregation, an audited acknowledgement boundary, role/scope barriers, frontend/Telegram follow-up behavior, and an explicit prerequisite for freeze and lesson-occurrence semantics.

# 2026-07-21 09:18

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-068-client-comment-audit.plan.md

## Skipped tasks
- TASK-068-client-comment-audit.md — not moved: source task remains in `/backlog/risky`, is high risk and `Safe for Codex: no`; implementation plan created for explicit review before active implementation selection.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: plan defines `feature/TASK-068-client-comment-audit`, test-first nullable attribution and timestamp persistence, normalized note-transition semantics, safe current-name contract, exact note-audit cardinality, PII-free failure logging, role/scope access barriers and frontend localized rendering coverage.

# 2026-07-21 23:37

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-073-temporary-group-trainer-substitution.plan.md

## Skipped tasks
- TASK-073-temporary-group-trainer-substitution.md — not moved: source task remains in `/backlog/risky`, is high risk and `Safe for Codex: no`; implementation plan created for explicit security/architecture review before active implementation selection.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: plan defines `feature/TASK-073-temporary-group-trainer-substitution`, a separate substitution model, inclusive club-date semantics, concurrency-safe overlap protection, one backend-owned effective assignment service across web/attendance/photo/internal bot consumers, atomic audit, financial non-attribution and test-first fixed-date/backend/frontend regression barriers.

# 2026-07-23 18:08

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-078-membership-write-regressions.plan.md

## Skipped tasks
- TASK-078-membership-write-regressions.md — not moved: source task remains in `/backlog/risky`, is high risk and `Safe for Codex: no`; detailed test-first plan created for explicit review before active implementation selection.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: plan defines `fix/TASK-078-membership-write-regressions`, separates the five write symptoms, requires a real-PostgreSQL red/green barrier beyond existing EF InMemory API tests, preserves TASK-070/TASK-077 lifecycle and immutable sale semantics, and covers atomic sale/version/audit writes, stable ProblemDetails, deterministic target selection, payment attribution, membership-scoped idempotency and frontend reload/error regression.

# 2026-07-23 19:55

## Moved to implementation
- /backlog/implementation/TASK-078-membership-write-regressions.md

## Created implementation plans
- none

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 0
- note: user explicitly approved execution of the reviewed TASK-078 plan in `fix/TASK-078-membership-write-regressions`; high-risk safeguards remain test-first real-PostgreSQL coverage, atomic audit/idempotency, exact card targeting and no production data repair.

# 2026-07-23 21:22

## Completed
- /backlog/done/TASK-078-membership-write-regressions.md
- /backlog/done/TASK-078-membership-write-regressions.plan.md

## Validation
- Backend: focused real-PostgreSQL/idempotency/model tests and full `GymCrm.slnx` suite passed.
- Frontend: 47 unit/component tests, lint, build and 6 focused Playwright scenarios passed.
- Bot: ruff and 36 pytest cases passed.
- Local stand: recreated twice from empty volumes; all four services healthy; purchase, correction, mark-payment, renewal and fresh reload smoke passed.

## Summary
- TASK-078 implemented on `fix/TASK-078-membership-write-regressions`.
- No new migration was created; membership idempotency storage and its explicit PostgreSQL-safe unique index were added to `InitialCreate` and the model snapshot.
- No production data repair was performed.
# 2026-07-23 23:00

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-079-client-birth-date-profile.plan.md

## Skipped tasks
- TASK-079-client-birth-date-profile.md — not moved: source task remains in `/backlog/risky`, is high risk and `Safe for Codex: no`; detailed test-first plan created for explicit privacy/contract review before active implementation selection.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: plan defines `feature/TASK-079-client-birth-date-profile`, nullable PostgreSQL `date` storage with no backfill, exact create/update/details date-only contract, existing permissions and client-audit snapshots, explicit clear semantics, frontend full-year/leap-day calculation and API/component/Playwright regression barriers.
