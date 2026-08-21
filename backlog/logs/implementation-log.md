# 2026-08-19 22:49

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-118-attendance-start-time-snapshots.plan.md

## Skipped tasks
- TASK-118-attendance-start-time-snapshots.md — not moved: source task remains in `/backlog/risky`, is high risk and `Safe for Codex: no`; a detailed test-first plan was created for explicit review in branch `feature/TASK-118-attendance-start-time-snapshots` after TASK-117 is merged.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: plan selects one lazy occurrence-level `(GroupId, TrainingDate)` start-time snapshot shared by all client marks, preserved through `Unmarked`, and reused by web/internal-bot writes, history, audit, missed-training ordering and acknowledgement. It requires red/green PostgreSQL constraint/concurrency coverage, synchronized frontend/bot history consumers and clean-schema validation; unknown legacy time is not backfilled or presented as factual. Project code was not changed.

# 2026-08-16 17:16

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-117-group-weekday-specific-start-times.plan.md

## Skipped tasks
- TASK-117-group-weekday-specific-start-times.md — not moved: source task remains in `/backlog/risky`, is high risk and `Safe for Codex: no`; a detailed full-stack test-first plan was created for explicit review in branch `feature/TASK-117-group-weekday-specific-start-times`.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: plan proposes the breaking `scheduleEntries[{weekday,startTime}]` contract, normalized child-table persistence, atomic exact-set replacement, synchronized backend/frontend/bot consumers, planning-stage mobile form UX/UI, red/green test evidence and clean PostgreSQL/device regression barriers. Project code was not changed.

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

# 2026-07-24 13:05

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-083-membership-payment-status-simplification.plan.md

## Skipped tasks
- TASK-083-membership-payment-status-simplification.md — not moved: source task remains in `/backlog/risky`, is high risk and `Safe for Codex: no`; detailed test-first plan created for explicit product/architecture review before active implementation selection.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: plan defines `feature/TASK-083-membership-payment-status-simplification`, moves payment metadata from membership version to paid-by-definition sale, separates payment/purchase/record/validity dates, reports sales by payment date with purchase-date organizational attribution, removes unpaid web/bot/attendance semantics, and requires real-PostgreSQL atomicity/schema/report barriers plus frontend and bot red/green coverage.

# 2026-07-24 20:14

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-082-super-administrator-role.plan.md

## Skipped tasks
- TASK-082-super-administrator-role.md — not moved: source task remains in `/backlog/risky`, is high risk and `Safe for Codex: no`; detailed test-first plan created for explicit security/architecture review before active implementation selection.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: plan defines `feature/TASK-082-super-administrator-role`, one backend-owned four-role capability/actor-target/scope matrix, explicit `branchId` session contract, protected staff endpoints, atomic role/branch audit, two-branch attendance and operational access, HeadCoach-only negative barriers, TASK-080/TASK-081 boundaries and synchronized frontend/internal-bot/Python consumers.

# 2026-07-25 00:09

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-081-administrator-group-type-settings.plan.md

## Skipped tasks
- TASK-081-administrator-group-type-settings.md — not moved: source task remains in `/backlog/risky`, is high risk and `Safe for Codex: no`; detailed test-first plan created for explicit permission/regression review before active implementation selection.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: plan defines `fix/TASK-081-administrator-group-type-settings`, separates group-type visibility from staff `createRoleOptions` and neighboring settings tabs, preserves the backend `ManageSettings` role matrix, and requires frontend red/green role/edit coverage plus backend API, CSRF, linked-group and exact audit regression barriers.

# 2026-07-25 01:20

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-080-administrator-authorized-group-attendance.plan.md

## Skipped tasks
- TASK-080-administrator-authorized-group-attendance.md — not moved: source task remains in `/backlog/risky`, is high risk and `Safe for Codex: no`; detailed test-first plan created for explicit security/architecture review before active implementation selection.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: plan defines `feature/TASK-080-administrator-authorized-group-attendance`, a dedicated audited grant model, explicit session attendance scope, compare-and-swap manager updates, branch/role/group lifecycle barriers, in-transaction save reauthorization against revoke races, shared web/internal-bot filtering and frontend desktop/390 px management/recovery coverage.

# 2026-07-26 12:13

## Moved to implementation
- /backlog/implementation/TASK-090-shared-mobile-ui-system.md

## Created implementation plans
- /backlog/implementation-plans/TASK-090-shared-mobile-ui-system.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: explicit user-selected TASK-090 moved from tasks-ready under the risky-task planning policy. Plan keeps implementation test-first, isolates work to branch `feature/TASK-090-shared-mobile-ui-system`, preserves backend ownership of CRM rules, and limits the foundation to shared mobile UI, theme/background config, semantic tokens, representative migration and regression barriers without implementing dependent TASK-085-TASK-089 workflows.

# 2026-07-26 16:43

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-091-administrator-role-creation-flow.plan.md

## Skipped tasks
- TASK-091-administrator-role-creation-flow.md — not moved: source task remains in `/backlog/risky`, is high risk and `Safe for Codex: no`; detailed UX/UI and test-first plan created for explicit security/architecture review before active implementation selection.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: plan defines `feature/TASK-091-administrator-role-creation-flow`, separates administrative and trainer endpoint role families without changing the TASK-082 authorization matrix, requires backend unit/integration and frontend component/Playwright tests before functional code, preserves exact branch/global scope and audit semantics, and keeps TASK-092 in a separate branch.

# 2026-07-26 23:56

## Moved to implementation
- /backlog/implementation/TASK-084-mobile-touch-targets-compact-height.md
- /backlog/implementation/TASK-085-mobile-client-search.md
- /backlog/implementation/TASK-086-mobile-groups-search-filter-paging.md
- /backlog/implementation/TASK-087-coach-schedule-effective-scope.md
- /backlog/implementation/TASK-088-permission-redirect-feedback.md
- /backlog/implementation/TASK-089-desktop-client-list-preview-overflow.md
- /backlog/implementation/TASK-092-remove-administrator-widgets.md

## Created implementation plans
- /backlog/implementation-plans/TASK-084-mobile-touch-targets-compact-height.plan.md
- /backlog/implementation-plans/TASK-085-mobile-client-search.plan.md
- /backlog/implementation-plans/TASK-086-mobile-groups-search-filter-paging.plan.md
- /backlog/implementation-plans/TASK-087-coach-schedule-effective-scope.plan.md
- /backlog/implementation-plans/TASK-088-permission-redirect-feedback.plan.md
- /backlog/implementation-plans/TASK-089-desktop-client-list-preview-overflow.plan.md
- /backlog/implementation-plans/TASK-092-remove-administrator-widgets.plan.md

## Skipped tasks
- none

## Summary
- moved: 7
- skipped: 0
- plans created: 7
- note: user explicitly selected the seven-task batch. Every task has a dedicated branch, isolated-worktree precondition, tests-before-production red/green order and automated regression barrier. TASK-087 keeps its high-risk data-visibility classification but is marked Safe for Codex, uses the existing backend-owned `IEffectiveGroupAssignmentService`, and has explicit security/non-leakage gates. TASK-085 and TASK-089 have mandatory execution dependencies on TASK-017; TASK-089 also follows TASK-085.

# 2026-07-27 00:40

## Moved to implementation
- /backlog/implementation/TASK-093-add-button-placement.md
- /backlog/implementation/TASK-094-filter-surface-consistency.md
- /backlog/implementation/TASK-095-remove-residual-service-copy.md
- /backlog/implementation/TASK-096-trainer-list-search.md

## Created implementation plans
- /backlog/implementation-plans/TASK-093-add-button-placement.plan.md
- /backlog/implementation-plans/TASK-094-filter-surface-consistency.plan.md
- /backlog/implementation-plans/TASK-095-remove-residual-service-copy.plan.md
- /backlog/implementation-plans/TASK-096-trainer-list-search.plan.md

## Skipped tasks
- none

## Summary
- moved: 4
- skipped: 0
- plans created: 4
- note: user explicitly selected the four-task batch. UX research and UI handoff fixed the safe execution order as TASK-094 → TASK-093 → TASK-096, with TASK-095 after overlapping shared-toolbar work. TASK-086 remains owner of Groups search/filter/paging and TASK-092 remains owner of administrator widget removal. Every plan uses a separate branch/worktree, tests-before-production red/green order and automated mobile/theme/accessibility regression barrier; project code was not changed.

# 2026-07-27 20:00

## Moved to implementation
- /backlog/implementation/TASK-097-trainer-edit-single-return-action.md
- /backlog/implementation/TASK-098-trainer-list-default-badges-cleanup.md
- /backlog/implementation/TASK-099-audit-log-remove-action-column.md
- /backlog/implementation/TASK-101-remove-residual-metric-widgets-settings-group-edit.md

## Created implementation plans
- /backlog/implementation-plans/TASK-097-trainer-edit-single-return-action.plan.md
- /backlog/implementation-plans/TASK-098-trainer-list-default-badges-cleanup.plan.md
- /backlog/implementation-plans/TASK-099-audit-log-remove-action-column.plan.md
- /backlog/implementation-plans/TASK-100-membership-catalog-list-type-badges.plan.md
- /backlog/implementation-plans/TASK-101-remove-residual-metric-widgets-settings-group-edit.plan.md

## Skipped tasks
- TASK-100-membership-catalog-list-type-badges.md — not moved: source remains in `/backlog/needs-clarification`, `Safe for Codex: no`; product must decide whether the single exceptional `Профессиональный` system badge remains after generic type badges are removed. A conditional test-first plan was created with `Ready for Codex execution: no`.

## Summary
- moved: 4
- skipped: 1
- plans created: 5
- note: user explicitly selected the five-task batch. TASK-098 runs after TASK-096; TASK-101 runs after TASK-086/TASK-092; TASK-097 runs after TASK-095/TASK-101 to avoid overlapping ownership. Every executable task has a separate branch/worktree precondition, tests-before-production red/green order and automated component/Playwright/mobile regression barrier. TASK-100 was planned but not selected for execution because its TASK-070 product contract is unresolved. Project code was not changed.

# 2026-07-27 20:56

## Moved to implementation
- /backlog/implementation/TASK-017-client-list-return-state.md

## Created implementation plans
- /backlog/implementation-plans/TASK-017-client-list-return-state.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: user explicitly selected low-risk frontend TASK-017. The plan uses branch `fix/TASK-017-client-list-return-state`, a versioned per-history-entry state boundary without URL/localStorage/sessionStorage or cached client data, unit and frontend integration tests before production code, red/green Playwright coverage for browser Back and the explicit return CTA, direct-link/stale-data fallbacks, mobile WebKit checks and one reusable contract for downstream TASK-085/TASK-089. Project code was not changed.

# 2026-07-28 00:45

## Moved to implementation
- /backlog/implementation/TASK-100-membership-catalog-list-type-badges.md

## Updated implementation plans
- /backlog/implementation-plans/TASK-100-membership-catalog-list-type-badges.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans updated: 1
- note: product clarification is resolved: all behavior/type/system badges are
  removed only from membership catalog list rows, including `Professional`;
  TASK-070 semantics and other interfaces remain unchanged. TASK-100 is
  low-risk and Safe for Codex, uses dedicated branch
  `fix/TASK-100-membership-catalog-list-type-badges`, preserves tests-before-
  production order and waits for TASK-093 merge because both plans touch
  `MembershipCatalogSettings.tsx`. Project code was not changed.

# 2026-07-29 00:15

## Status reviewed
- /backlog/implementation/TASK-084-mobile-touch-targets-compact-height.md

## Result
- status remains: `implementation`
- implementation state: `not_started`
- reviewed main: `6a9d28b1131a4561d150130ec697256e30f712a0`
- merge/branch found: no TASK-084 implementation branch or merge

## Evidence
- PR #107 on current `main` belongs to TASK-091 and does not close TASK-084.
- Known undersized controls remain: `36px` locator clear, `40px` mobile client
  pagination and `42px` schedule refresh.
- Required machine-readable touch-target inventory is absent.
- No acceptance or task-specific test checklist item was marked complete.

## Summary
- moved: 0
- completed: 0
- note: TASK-084 remains selected for implementation, but execution has not
  started. The next step is the declared isolated branch/worktree and the
  approved test-first plan.

# 2026-07-31 19:22

## Moved to implementation
- /backlog/implementation/TASK-102-remove-settings-tab-title-duplication.md

## Created implementation plans
- /backlog/implementation-plans/TASK-102-remove-settings-tab-title-duplication.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: user explicitly selected low-risk frontend TASK-102. The plan uses
  dedicated branch `fix/TASK-102-remove-settings-tab-title-duplication`, an
  isolated worktree from current `origin/main`, component/Playwright tests
  before production code, expected red verification for four embedded
  `SectionHeader` instances, a standalone BranchSettings title guard, named
  tab-panel/accessibility coverage and responsive regression barriers for all
  required mobile, compact-height, tablet and desktop sizes. Project code was
  not changed.

# 2026-07-31 20:05

## Completed implementation
- /backlog/done/TASK-102-remove-settings-tab-title-duplication.md

## Completed implementation plan
- /backlog/done/TASK-102-remove-settings-tab-title-duplication.plan.md

## Evidence
- implementation commit: `f83065c`
- frontend lint, build and raw-color checks passed
- 413 unit tests passed
- 64 affected Chromium Playwright tests passed
- 32 target-iPhone WebKit tests passed
- backend and database structure were unchanged; migration was not required
- no Docker Compose task stack was created

## Summary
- moved to done: 1
- completed: 1
- note: TASK-102 removed the four duplicated embedded settings titles and
  three approved decorative descriptions while preserving named tab panels,
  toolbar operations, standalone branch title and operational state headings.

# 2026-08-02 15:22

## Moved to implementation
- /backlog/implementation/TASK-104-attendance-workbench-first-action.md

## Created implementation plans
- /backlog/implementation-plans/TASK-104-attendance-workbench-first-action.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: user explicitly selected medium-risk, Safe-for-Codex frontend TASK-104.
  UX research and UI design handoffs fixed one compact attendance workbench
  header, removal of duplicated group/date/schedule context, row-local recovery,
  readable date minimums and above-fold primary-action geometry. The plan uses
  dedicated branch `fix/TASK-104-attendance-workbench-first-action`, an isolated
  worktree from current `origin/main`, tests-before-production red/green order
  and automated portrait, compact-height and target-iPhone WebKit regression
  barriers. Project code was not changed.

# 2026-08-02 15:57

## Moved to implementation
- /backlog/implementation/TASK-106-parallel-schedule-readability.md

## Created implementation plans
- /backlog/implementation-plans/TASK-106-parallel-schedule-readability.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: user explicitly selected medium-risk, Safe-for-Codex frontend TASK-106.
  UX research and UI design handoffs fixed a desktop-only hybrid of readable
  individual overlap cards and grouped summary + Mantine Popover for dense or
  undersized clusters, with exact decision-data, keyboard/focus behavior and
  mobile timeline preservation. The plan uses dedicated branch
  `fix/TASK-106-parallel-schedule-readability`, an isolated worktree from
  current `origin/main`, unit/component/Playwright tests before production code
  and automated desktop, responsive and target-iPhone regression barriers.
  Project code was not changed.

# 2026-08-02 16:53

## Moved to implementation
- /backlog/implementation/TASK-107-audit-log-mobile-density-focus.md

## Created implementation plans
- /backlog/implementation-plans/TASK-107-audit-log-mobile-density-focus.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: user explicitly selected medium-risk, Safe-for-Codex frontend TASK-107.
  UX research and UI design handoffs fixed a `96–124px` compact mobile row,
  exact/raw technical-description handling, responsive `44 x 44px`
  pagination, timer-free Mantine modal focus return and explicit retry/stale
  states. The plan uses dedicated branch
  `fix/TASK-107-audit-log-mobile-density-focus`, an isolated worktree from
  current `origin/main`, unit/component/integration/Playwright tests before
  production code, and automated portrait, compact-height and target-iPhone
  WebKit regression barriers. Project code was not changed.

# 2026-08-02 17:00

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-108-finance-report-task-first-hierarchy.plan.md

## Skipped tasks
- TASK-108-finance-report-task-first-hierarchy.md — not moved: source task
  remains in `/backlog/risky`, is medium risk and `Safe for Codex: no`; plan
  created for human financial-trust review before active implementation in
  branch `fix/TASK-108-finance-report-task-first-hierarchy`.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: plan is frontend-only, keeps backend finance values/query params/
  permissions unchanged, requires component and Playwright red tests before
  functional code, and blocks execution on formula, attribution, stale-scope
  or financial-trust changes without review. Project code was not changed.

# 2026-08-16 17:14

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-114-membership-comment-isolation-regression.plan.md

## Skipped tasks
- TASK-114-membership-comment-isolation-regression.md — not moved: source task
  remains in `/backlog/risky`, is high risk and `Safe for Codex: no`; a
  test-first diagnostic and implementation plan was created for explicit human
  review before active execution in branch
  `fix/TASK-114-membership-comment-isolation-regression`.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: current `main` inspection already shows sale-local persistence,
  projection, frontend grouping and request identity, while existing coverage
  is mostly EF InMemory or mocked at the missing vertical boundary. The plan
  therefore requires an exact two-sale real-PostgreSQL red scenario before any
  functional change, uses component/Playwright row-local barriers, and stops
  speculative implementation if current `origin/main` is green so deployment
  or version skew can be reconciled. Project code was not changed.

# 2026-08-16 17:14

## Moved to implementation
- /backlog/implementation/TASK-116-client-profile-context-navigation.md

## Created implementation plans
- /backlog/implementation-plans/TASK-116-client-profile-context-navigation.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: user explicitly selected medium-risk, `Safe for Codex: yes`,
  frontend-only TASK-116. The plan preserves backend-owned client scope and
  existing client/group list return snapshots, introduces a versioned typed
  history-state origin for attendance/group round trips, and requires pure
  state, component, route-integration and Playwright tests before production
  code. Dedicated branch `fix/TASK-116-client-profile-context-navigation`, an
  isolated worktree, pending-save recovery, mark-first keyboard priority,
  responsive geometry and target-iPhone WebKit barriers are mandatory. Project
  code was not changed.

# 2026-08-16 17:37

## Moved to implementation
- /backlog/implementation/TASK-112-schedule-single-day-mode.md

## Created implementation plans
- /backlog/implementation-plans/TASK-112-schedule-single-day-mode.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: user explicitly selected medium-risk, `Safe for Codex: yes`,
  frontend-only TASK-112. UX research and UI-design handoffs fixed a wide-only
  `Неделя / День` switch, reusable day view, canonical
  `mode=week|day&weekday=1..7` history contract, responsive effective-mode
  policy and keyboard/focus behavior. The plan uses dedicated branch
  `feature/TASK-112-schedule-single-day-mode`, an isolated worktree,
  pure/component/integration/Playwright tests before production code and
  automated target-iPhone/overflow regression barriers. Backend/API and TASK-106
  overlap logic remain outside scope; project code was not changed.

# 2026-08-16 17:34

## Moved to implementation
- /backlog/implementation/TASK-111-ux-audit-regression-matrix.md

## Created implementation plans
- /backlog/implementation-plans/TASK-111-ux-audit-regression-matrix.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: user explicitly selected low-risk, `Safe for Codex: yes`, test-only
  TASK-111. The plan formalizes attendance/settings/audit/schedule/profile
  surface and viewport coverage, separates page overflow from decision-data
  loss, uses branch `fix/TASK-111-ux-audit-regression-matrix`, preserves
  tests-before-harness/product order and requires Chromium, touch inventory
  and target-iPhone WebKit regression barriers. Full green execution is gated
  on TASK-106/107/109/110 being merged into `origin/main`; unresolved TASK-103
  navigation naming is excluded. Project code was not changed.

# 2026-08-16 17:39

## Moved to implementation
- /backlog/implementation/TASK-110-mobile-profile-trigger-touch-target.md

## Created implementation plans
- /backlog/implementation-plans/TASK-110-mobile-profile-trigger-touch-target.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: user explicitly selected low-risk, `Safe for Codex: yes`, frontend-only
  TASK-110. The UI/React feasibility handoff localized the production fix to
  the actual profile-button border box, preserving Mantine menu semantics,
  visible icons and header rhythm. The plan uses dedicated branch
  `fix/TASK-110-mobile-profile-trigger-touch-target`, isolated worktree,
  component and Playwright tests before CSS, expected `48 x 42px` red evidence,
  machine-readable inventory and target-iPhone WebKit regression barriers.
  TASK-111 consumes the focused contract only after TASK-110 merges. Project
  code was not changed.

# 2026-08-16 17:43

## Moved to implementation
- /backlog/implementation/TASK-109-settings-scope-touch-order.md

## Created implementation plans
- /backlog/implementation-plans/TASK-109-settings-scope-touch-order.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: user explicitly selected medium-risk, `Safe for Codex: yes`,
  frontend-only TASK-109. UX/UI handoffs selected one non-wrapping catalog
  toolbar in order branch scope → refresh → primary create, with local
  `44 x 44px` touch targets, branch-load recovery and unchanged backend
  branch/payload/permission semantics. The plan uses dedicated branch
  `fix/TASK-109-settings-scope-touch-order`, an isolated worktree,
  component/Playwright tests before production code, full touch inventory and
  target-iPhone WebKit regression barriers. Project code was not changed.

# 2026-08-16 19:01

## Completed implementation
- /backlog/done/TASK-116-client-profile-context-navigation.md

## Completed implementation plan
- /backlog/done/TASK-116-client-profile-context-navigation.plan.md

## Summary
- completed: 1
- implementation commit: `afc7f5c`
- integrated into local `main`: fast-forward at `bae4d08`
- validation: frontend lint, production build, 446 unit tests, 65 affected
  Chromium Playwright tests and 34 target-iPhone WebKit tests passed
- data/runtime: no backend/API/database changes, no migration required, no
  Docker Compose task stack created
- residual device evidence: physical Safari/iOS device checks were not
  performed; target-iPhone WebKit portrait and compact-landscape profiles
  passed

# 2026-08-16 20:24

## Moved to implementation
- /backlog/implementation/TASK-113-schedule-group-type-organization.md

## Created implementation plans
- /backlog/implementation-plans/TASK-113-schedule-group-type-organization.plan.md

## Skipped tasks
- none

## Summary
- moved: 1
- skipped: 0
- plans created: 1
- note: user explicitly selected medium-risk, `Safe for Codex: yes`,
  frontend-only TASK-113. The plan adds a payload-scoped single-select group
  type filter without backend/API changes, preserves time-first ordering and
  passive visible-result legend semantics, and uses branch
  `feature/TASK-113-schedule-group-type-organization` plus an isolated
  worktree. Unit and component integration tests, wide/mobile Playwright red
  scenarios, refresh/state preservation, touch/overflow checks and
  target-iPhone WebKit barriers are required before production code. Execution
  is gated on TASK-106 and TASK-112 being merged into current `origin/main`;
  their unmerged branches must not be copied. Project code was not changed.

# 2026-08-16 21:25

## Completed implementation
- /backlog/done/TASK-110-mobile-profile-trigger-touch-target.md

## Completed implementation plan
- /backlog/done/TASK-110-mobile-profile-trigger-touch-target.plan.md

## Summary
- completed: 1
- implementation commit: `449ee76`
- integrated into local `main`: fast-forward at `449ee76`
- test-first evidence: profile trigger measured `48 x 42.375px` before the CSS fix on seven coarse-pointer viewports and both target-iPhone WebKit projects
- validation: frontend lint, production build, 449 unit tests, 12 Chromium touch-inventory tests and 36 target-iPhone WebKit tests passed on integrated `main`
- data/runtime: no backend/API/database changes, no migration required, no Docker Compose task stack created
- residual device evidence: physical Safari/iOS Simulator, dynamic chrome, actual safe area/home indicator and physical-device touch checks were not performed

# 2026-08-19 22:50

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-115-membership-target-and-overlap-model.plan.md

## Skipped tasks
- TASK-115-membership-target-and-overlap-model.md — not moved: source task
  remains in `/backlog/risky`, is high risk and `Safe for Codex: no`; a
  detailed test-first full-stack plan was created for explicit human review
  before active execution in branch
  `feature/TASK-115-membership-target-and-overlap-model`.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: the plan replaces singular current-membership assumptions with a
  target-aware collection, specifies group/coverage/overlap/attendance/report
  contracts, deterministic legacy transition, reviewed mobile-first forms and
  five independent regression barriers. Execution remains blocked on explicit
  decisions for SingleVisit restore after a later sale, attendance enforcement,
  cross-branch target scope, transfer API boundary and historical financial
  attribution. Project code was not changed.

# 2026-08-19 22:47

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-103-attendance-navigation-model.plan.md

## Skipped tasks
- /backlog/risky/TASK-103-attendance-navigation-model.md — карточка не
  перемещена: medium-risk backend session/access-scope и frontend
  route/recovery contract требуют отдельного human-reviewed execution; risky
  planning policy разрешает создать подробный план, сохранив status `risky`.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: user explicitly selected TASK-103 for planning only. UX/UI handoffs
  fixed the four-role session matrix, standalone `/attendance`, management-only
  Home, mandatory primary mobile placement, named main/hidden h1 semantics and
  client-return/recovery behavior. The plan uses branch
  `feature/TASK-103-attendance-navigation-model`, an isolated worktree, unit,
  backend integration and Playwright tests before production code, coordinated
  backend/frontend rollout and automated target-device regression barriers.
  Project code was not changed.

# 2026-08-19 23:09

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-105-trainer-access-registry-contract.plan.md

## Skipped tasks
- /backlog/risky/TASK-105-trainer-access-registry-contract.md — карточка не
  перемещена: high-risk protected trainer-management route/API contract имеет
  `Safe for Codex: no`; подробный test-first plan создан для explicit human
  review перед атомарным исполнением в branch
  `feature/TASK-105-trainer-access-registry-contract`.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: plan keeps `/coaches` as the only backend/frontend trainer route,
  preserves backend-owned access and `allowedActions`, specifies local
  exception filters, a single editable row target, workflow focus/state
  recovery, coordinated release/rollback and five automated regression
  barriers. Unit, backend integration, component/App integration and
  Playwright tests must be written and observed red before production code.
  Project code was not changed.

# 2026-08-20 00:42

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-119-full-lesson-calendar.plan.md

## Skipped tasks
- /backlog/risky/TASK-119-full-lesson-calendar.md — карточка не перемещена:
  high-risk umbrella меняет schedule domain, occurrence identity, attendance,
  migration, audit, permissions, web и bot; подробный test-first plan создан,
  но active execution требует review и отдельных child tasks/branches.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: UX/UI handoff закрепил day-first mobile calendar, visible row-level
  `Посещаемость`, preview/confirm warnings, occurrence-aware attendance route и
  target-device acceptance. План декомпозирует execution на шесть
  последовательно интегрируемых slices: calendar core, mutations/lifecycle,
  attendance migration, web, bot и release regression. Каждый slice требует
  отдельную branch/worktree, unit и integration tests до production code,
  expected-red evidence и automated regression barrier. TASK-119 остаётся в
  `/backlog/risky`; project code не изменялся.

# 2026-08-21 12:59

## Moved to implementation
- none

## Created implementation plans
- /backlog/implementation-plans/TASK-115-membership-target-and-overlap-model.plan.md

## Skipped tasks
- /backlog/risky/TASK-115-membership-target-and-overlap-model.md — карточка не
  перемещена: high-risk membership/attendance/persistence/finance contract
  имеет `Safe for Codex: no`. Superseded one-group plan полностью заменён
  detailed test-first multi-group plan для mandatory human review перед active
  execution в branch
  `feature/TASK-115-membership-target-and-overlap-model`.

## Summary
- moved: 0
- skipped: 1
- plans created: 1
- note: plan фиксирует normalized ordered targets на technical versions,
  immutable sale/refund/attendance snapshots, set-intersection overlap и
  Professional global exclusion, one backend entitlement resolver, no-sale
  target transfer, archive guard, deterministic legacy transition, atomic
  refund/report semantics и synchronized backend/frontend/bot rollout. UX/UI
  handoff определяет mobile purchase/renew/correction/transfer, cards/history,
  recovery states и target-iPhone acceptance. Unit, raw API, PostgreSQL,
  frontend/Playwright и bot tests должны быть написаны и observed red до
  production code. Project code не изменялся.
