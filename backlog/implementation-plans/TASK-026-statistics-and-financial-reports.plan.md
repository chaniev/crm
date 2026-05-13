# Implementation Plan: TASK-026 Уточнить статистику и финансовые отчеты

## Source task
/backlog/done/TASK-026-statistics-and-financial-reports.md

## Implementation branch
feature/TASK-026-statistics-and-financial-reports

Branch rules:
- create this branch before changing backlog task files for this decomposition;
- do not implement product code in this branch;
- do not implement other unrelated TASKs in this branch;
- confirm the branch is active before making repository changes.

## Goal
Разложить уточненный запрос на статистику и финансовые отчеты первого релиза на отдельные implementation tasks с четкими backend contracts, frontend scope, test strategy и regression barriers.

## Current understanding
TASK-026 уже содержит закрытые уточнения по отчетам: проданные абонементы по периодам с учетом филиалов и тренеров, новые клиенты с выбранной даты, быстрые периоды месяц/квартал/год и произвольный диапазон, фильтр одного филиала или всех филиалов, отдельная вкладка `Финансы`, финансовые показатели `gross sales`, `refund total`, `net total`.

Филиальная зависимость закрыта через `TASK-031`: backend уже содержит `Branch`, `Hall`, `Client.BranchId`, branch-aware groups, запрет cross-branch client/group assignment и правило, что у тренера нет прямой связи с филиалом. Для отчетов это означает: филиал берется через клиента, тренер выводится через группы, которые он ведет.

Текущая membership-модель уже имеет `PurchaseDate`, `PaymentAmount`, `IsPaid`, `ClientMembershipChangeReason`, историю версий абонемента и связь клиента с группами. При этом явной модели возврата с `refund amount` и `refund date` нет, а история абонемента хранит технические версии (`Correction`, `PaymentUpdate`, `SingleVisitWriteOff`), поэтому прямой подсчет строк `ClientMemberships` может дать двойной учет. Это главный backend-риск будущих задач.

Сама TASK-026 не должна напрямую реализовывать отчеты: ее acceptance criteria требует создать отдельные implementation tasks. Поэтому этот план готовит безопасную декомпозицию, а не код отчетности.

## Execution steps
1. Создать task-specific branch `feature/TASK-026-statistics-and-financial-reports` от актуального `main`.
2. Проверить, что `TASK-026` остается задачей декомпозиции, а не прямой реализации отчетов.
3. Определить следующие свободные TASK numbers и создать 3 отдельные risky implementation tasks:
   - backend refund model and membership sale semantics;
   - backend statistics/financial reports API;
   - frontend `Финансы` navigation and report UI.
4. Для backend refund task зафиксировать, как вводится сумма и дата возврата, как возврат аудируется, как не ломается текущая история абонемента и как не появляется двойной учет.
5. Для backend reports API task зафиксировать contracts: period preset/custom range, branch filter, trainer filter, sold memberships count, new clients count, gross sales, refund total, net total.
6. Для frontend task зафиксировать, что frontend только потребляет backend totals и breakdowns, не пересчитывает финансовые формулы локально.
7. В каждой созданной задаче явно указать dependencies: refund task -> reports API task -> frontend task.
8. В каждой созданной задаче добавить automated regression strategy: backend integration tests для расчетов и прав доступа, frontend lint/build и UI/e2e coverage для вкладки `Финансы`.
9. Обновить `TASK-026`: отметить, что отдельные implementation tasks созданы, добавить ссылки на них и перевести исходную задачу в `done` только после создания подзадач.
10. Обновить backlog log с перечнем созданных задач.

## Preferred implementation strategy
1. Decomposition-first implementation.
2. Backend contracts before frontend screens.
3. Refund/sale semantics before aggregate financial reports.
4. Backend-owned formulas and permissions.
5. Incremental frontend integration against typed API contracts.
6. Small task boundaries with separate branches for each generated implementation task.

## Proposed decomposition
- `TASK-0XX-membership-refunds-and-sale-semantics.md`: добавить backend-модель возвратов или эквивалентный safe contract, определить sale event semantics, защититься от двойного учета history rows.
- `TASK-0XY-statistics-financial-reports-backend-api.md`: добавить backend report API, фильтры, агрегаты, permissions для `HeadCoach`, integration tests на расчеты.
- `TASK-0XZ-finance-reports-frontend.md`: добавить секцию `Финансы`, route/navigation, filters, empty states, totals and breakdown UI, typed API consumer, UI/e2e regression.

## Files likely to change
- backlog/done/TASK-026-statistics-and-financial-reports.md
- backlog/risky/TASK-0XX-membership-refunds-and-sale-semantics.md
- backlog/risky/TASK-0XY-statistics-financial-reports-backend-api.md
- backlog/risky/TASK-0XZ-finance-reports-frontend.md
- backlog/logs/implementation-log.md

Future product-code tasks are likely to touch:
- backend/src/GymCrm.Domain/Clients/ClientMembership.cs
- backend/src/GymCrm.Application/Authorization/AppSection.cs
- backend/src/GymCrm.Application/Authorization/PermissionSet.cs
- backend/src/GymCrm.Infrastructure/Authorization/AccessScopeService.cs
- backend/src/GymCrm.Infrastructure/Persistence/GymCrmDbContext.cs
- backend/src/GymCrm.Infrastructure/Persistence/Configurations/ClientMembershipConfiguration.cs
- backend/src/GymCrm.Api/Auth/*
- backend/tests/GymCrm.Tests/*
- frontend/src/lib/api.ts
- frontend/src/lib/api/endpoints.ts
- frontend/src/lib/api/types.ts
- frontend/src/lib/appRoutes.ts
- frontend/src/features/*
- frontend/e2e/*

## Constraints
- Backend owns financial report semantics, permissions, validation and ProblemDetails contracts.
- Frontend must not duplicate financial formulas, trainer attribution rules or access rules.
- First release ignores cancellations and freezes.
- Zero-price memberships count as sold memberships but contribute `0` to gross sales.
- Refunds are counted by refund date, not purchase date.
- New clients are counted by first new membership purchase date.
- Branch filter must support one branch and all branches.
- Trainer attribution must follow backend group/trainer relationships, with no direct trainer-branch link.
- Direct implementation of reports is out of scope for TASK-026.

## Out of scope
- Writing backend report code inside TASK-026.
- Writing frontend `Финансы` UI inside TASK-026.
- Changing payment provider or real financial reconciliation.
- Adding cancellation/freeze accounting.
- Redesigning roles beyond the minimum report visibility decision already captured in the task.
- Duplicating backend financial calculations in frontend.

## Required test coverage

Determine the automated tests in the generated implementation tasks before any product-code implementation starts.

### Unit tests
Generated backend tasks should add or update unit tests if they extract:
- date range preset/custom period parsing;
- refund validation rules;
- sale event/membership history classification;
- report DTO mapping or aggregation helpers.

### Integration tests
Generated backend tasks must add integration tests for:
- sold memberships counted by purchase date;
- zero-price memberships counted in quantity and `0` in gross sales;
- refunds counted by refund date and excluded from gross sales;
- net total equals gross sales minus refund total for the selected period;
- new clients counted by first new membership purchase date;
- branch filter for one branch and all branches;
- trainer aggregation through `ClientGroup -> TrainingGroup -> GroupTrainer`;
- corrections/payment updates/single-visit write-offs do not double-count sales;
- financial reports are visible only to the agreed role, currently `HeadCoach`;
- non-authorized roles receive the expected backend response.

### UI tests
Generated frontend task should add or update UI/e2e coverage for:
- `Финансы` tab visibility for allowed users;
- absence or redirect for users without finance access;
- preset periods and custom date range;
- branch/trainer filters;
- empty data state;
- gross/refund/net totals rendered from backend payload without frontend recomputation.

### Regression priority
Because the task touches financial reports and access, every generated implementation task needs automated regression protection. Manual QA can supplement but must not be the only barrier.

### Minimum expectation
Each generated task must explicitly state:
- exact backend or frontend contracts it owns;
- tests to add;
- existing tests likely to update;
- manual checks that remain useful after automated tests pass;
- the regression barrier that blocks accidental formula, permission or filter regressions.

## Test plan
- [ ] Verify the generated tasks cover refund capture, report API, and frontend finance UI separately.
- [ ] Verify each generated task has its own branch name.
- [ ] Verify each generated task has dependencies and does not require simultaneous unbounded full-stack work.
- [ ] Verify backend calculation tests are required before frontend UI acceptance.
- [ ] Verify frontend task says UI consumes backend totals and never recalculates financial formulas.
- [ ] Verify TASK-026 is marked complete only after links to the generated tasks are added.

## Regression barrier
For TASK-026 itself, the regression barrier is backlog traceability: generated tasks must cover every accepted report definition from TASK-026 and each generated task must include automated backend/frontend validation requirements.

For future product-code work, the main regression barrier is backend integration coverage proving formula correctness, filter behavior and report permissions, plus frontend lint/build/e2e coverage proving the `Финансы` tab consumes backend contracts correctly.

## Risks
- Current `ClientMemberships` history contains technical versions, so naive aggregation can double-count purchases.
- There is no current refund amount/date model; adding it may require schema and API changes.
- Trainer attribution through current groups can become historically ambiguous if clients move between groups after purchase.
- Branch attribution through current client branch may be insufficient if later product expectations require historical branch snapshotting.
- Financial access wording mentions `главный тренер`; if administrators or owners also need access, permission scope must be clarified before code.
- Full-stack implementation in one large task would mix semantics, persistence, API and UI risks.

## Stop conditions
Остановиться и не писать продуктовый код, если:
- TASK-026 пытаются исполнить как прямую реализацию отчетов вместо декомпозиции;
- невозможно определить безопасную модель sale/refund event без отдельного backend task;
- требуется исторический snapshot филиала, группы или тренера, но это не зафиксировано в acceptance criteria;
- финансовый доступ должен быть шире `HeadCoach`, но это не подтверждено отдельным решением;
- scope превращается в redesign платежей, ролей, расписания или финансовой сверки;
- будущие задачи не могут получить automated regression barrier.

Do not stop planning only because backend and frontend are both involved. The correct response is phased decomposition with backend-owned contracts first.

## Decomposition result
- `backlog/risky/TASK-036-membership-refunds-sale-semantics.md`
- `backlog/risky/TASK-037-financial-reports-backend-api.md`
- `backlog/risky/TASK-038-finance-reports-frontend.md`

`TASK-026` is closed and moved to `backlog/done`.

## Ready for Codex execution
completed for backlog-only decomposition into separate implementation tasks.

no, for direct product-code implementation of reports from TASK-026.
