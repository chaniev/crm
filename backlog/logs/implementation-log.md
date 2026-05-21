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
