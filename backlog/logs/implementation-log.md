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
