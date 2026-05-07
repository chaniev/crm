# Implementation Plan: TASK-027 Реализовать признак профессионал

## Source task
/backlog/risky/TASK-027-professional-client-privilege.md

## Goal
Клиент с признаком `профессионал` отображается как льготный оплаченный клиент: он не попадает в должники, не списывает лимит посещений, не увеличивает выручку и имеет понятный audit trail включения/отключения признака.

## Current understanding
Задача затрагивает backend-домен клиента, memberships, attendance write-off, должников, финансовую семантику и audit. В текущей модели `Client` содержит базовые поля, contacts, memberships, groups и attendance, но не содержит признака льготного статуса. Текущий статус оплаты считается по последнему активному `ClientMembership`, а списание разового посещения происходит в `ClientMembershipService.WriteOffSingleVisitAsync`, который вызывается из `AttendanceService.SaveAsync`.

Frontend и bot уже потребляют backend-флаги `hasActivePaidMembership`, `hasUnpaidCurrentMembership`, `membershipWarning` и списки unpaid memberships. Поэтому правило `профессионал = не должник` должно быть реализовано в backend responses, а frontend/bot должны только отобразить новые поля или обновленные флаги.

## Execution steps
1. Зафиксировать backend contract: поля клиента `isProfessional`/`professionalComment` в details/list responses и отдельный mutation endpoint для переключения признака, например `PUT /clients/{id}/professional-status`.
2. Добавить в domain/persistence клиента поля признака и комментария: boolean, nullable comment, timestamps/actor fields при необходимости для audit snapshot. Сделать EF configuration и migration.
3. Реализовать backend validation: комментарий обязателен при включении, ограничен по длине; отключение не требует нового комментария, если задача не потребует обратного основания.
4. Ограничить mutation только ролью `HeadCoach`. Не расширять общий permission model, если достаточно локальной проверки роли в endpoint с ProblemDetails.
5. Обновить backend membership/payment projections: клиент с `isProfessional=true` должен возвращать paid/active semantics, не попадать в `paymentStatus=Unpaid`, `membershipState=Unpaid`, unpaid lists и bot unpaid memberships.
6. Обновить attendance write-off: посещения клиента-профессионала фиксируются, но `WriteOffSingleVisitAsync` не должен списывать single visit и не должен создавать предупреждение об оплате.
7. Обновить финансовые/reporting запросы, если они есть в коде на момент реализации; если отчетов еще нет, явно не добавлять новый отчетный модуль, а оставить backend helper/contract так, чтобы будущая выручка исключала professional memberships.
8. Записать audit events для включения и отключения: action type, actor, дата/время, old/new state, comment при включении.
9. Обновить frontend API types/mappers и карточку клиента: показать признак как льготный оплаченный статус, добавить контрол включения/отключения только для главного тренера по backend/session permissions или role display без дублирования domain rules.
10. Обновить bot contracts/models: не показывать professional-клиента в unpaid memberships, не показывать warning при attendance save, при необходимости показать мягкую метку в карточке клиента.
11. Добавить regression tests на backend сначала, затем обновить frontend/bot fixtures и consumer tests.

## Preferred implementation strategy
1. Contract-first backend implementation.
2. Persistence migration and backend integration tests for professional semantics.
3. Backend compatibility response fields so existing consumers keep working through `hasActivePaidMembership=false/true` transitions without local rules.
4. Incremental frontend integration in client details/forms and membership badges.
5. Bot DTO update after backend contract is stable.
6. Small verifiable commits by layer: backend, frontend, bot.

## Files likely to change
- backend/src/GymCrm.Domain/Clients/Client.cs
- backend/src/GymCrm.Infrastructure/Persistence/Configurations/ClientConfiguration.cs
- backend/src/GymCrm.Infrastructure/Persistence/Migrations/*
- backend/src/GymCrm.Api/Auth/ClientEndpoints.cs
- backend/src/GymCrm.Api/Auth/ClientDetailsResponse.cs
- backend/src/GymCrm.Api/Auth/ClientListItemResponse.cs
- backend/src/GymCrm.Api/Auth/ClientAuditConstants.cs
- backend/src/GymCrm.Api/Auth/ClientAuditState.cs
- backend/src/GymCrm.Api/Auth/ClientResources.cs
- backend/src/GymCrm.Api/Auth/Resources/ClientResources.resx
- backend/src/GymCrm.Infrastructure/Clients/ClientMembershipService.cs
- backend/src/GymCrm.Infrastructure/Attendance/AttendanceService.cs
- backend/src/GymCrm.Infrastructure/Bot/BotApiService.cs
- backend/src/GymCrm.Application/Bot/BotApiContracts.cs
- backend/tests/GymCrm.Tests/ClientsApiTests.cs
- backend/tests/GymCrm.Tests/AttendanceApiTests.cs
- backend/tests/GymCrm.Tests/AuditLogApiTests.cs
- backend/tests/GymCrm.Tests/InternalBotApiTests.cs
- frontend/src/lib/api/types.ts
- frontend/src/lib/api/clients.ts
- frontend/src/features/clients/ClientManagement.tsx
- frontend/src/features/clients/ClientManagement.form.ts
- frontend/src/features/clients/list/*
- frontend/e2e/stage12.spec.ts
- bot/src/gym_crm_bot/crm/models.py
- bot/src/gym_crm_bot/resources/messages.py
- bot/tests/test_crm_client.py
- bot/tests/test_bot_service.py

## Constraints
- Backend owns debtor, membership, attendance, audit and validation semantics.
- Frontend and bot must not infer whether a professional client is a debtor.
- Only `HeadCoach` can switch the flag.
- Existing ProblemDetails contracts must remain consistent for validation and permission errors.
- Professional attendance is still attendance and must remain visible in attendance history.
- Do not model tournaments, documents or achievement history in this task.

## Out of scope
- Tournament/achievement records.
- File attachments as privilege evidence.
- Automatic assignment of professional status.
- Discounts, refunds, compensation or payment provider logic.
- Full financial reporting module if it does not already exist.

## Required test coverage

### Unit tests
Add focused tests only if business logic is extracted into a domain/application helper, for example professional membership status evaluation or warning evaluation. If logic remains inside API queries, cover it through backend integration tests instead of introducing a new unit harness.

### Integration tests
Update backend integration tests:
1. `HeadCoach` can enable professional status with comment and details/list responses include the flag/comment.
2. `Administrator` and `Coach` cannot switch the flag and receive the agreed ProblemDetails/forbid response.
3. Professional client is not returned by unpaid membership queries and `paymentStatus=Unpaid`.
4. Professional client returns paid/active semantics even with no paid current membership or with a zero-price professional representation.
5. Attendance save records presence for professional client but does not write off single visit and does not return unpaid warning.
6. Audit log contains enable/disable events with actor and timestamp.
7. Bot internal unpaid memberships and attendance warnings exclude professional clients.

### UI tests
Update Playwright fixtures in `frontend/e2e/stage12.spec.ts` or add an affected client-flow spec:
1. Client card shows professional status as льготный/оплаченный, not unpaid.
2. HeadCoach sees and can submit the switch form with comment.
3. Non-HeadCoach does not see the switch action or receives backend error if manually attempted.
4. Unpaid filters/lists do not mark professional client as debtor.

### Bot tests
Update `bot/tests/test_crm_client.py` and service/message tests so professional response payloads parse without local validation rules and unpaid membership lists omit professional clients.

## Test plan
- [ ] Запустить `dotnet test backend/GymCrm.slnx`.
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Запустить affected frontend Playwright checks for client card/list/payment filters.
- [ ] Запустить `cd bot && ruff check .`.
- [ ] Запустить `cd bot && pytest`.
- [ ] Вручную проверить обычного должника и клиента-профессионала в карточке, списке, посещаемости и unpaid flows.

## Regression barrier
Главный regression barrier: backend integration tests must prove that the professional flag changes the authoritative payment/debtor/attendance semantics and audit trail. Frontend and bot tests should only verify contract consumption, ensuring no consumer reimplements the professional rule locally.

## Risks
- Высокий риск размазать правило по frontend/bot; реализация должна держать debtor/payment semantics в backend.
- Если текущая система не имеет финансового отчета, попытка реализовать отчетность в этой задаче расширит scope.
- Zero-price professional representation can conflict with existing membership model if implemented as a fake membership instead of client-level status.
- Role check for `HeadCoach` must avoid accidental privilege escalation for `Administrator`.
- Existing client payload fixtures are hand-written and will need careful updates.

## Stop conditions
Остановиться и не писать код, если:
- требуется redesign auth/roles/permissions model instead of local HeadCoach-only mutation;
- невозможно определить backend contract for professional status without changing multiple unrelated CRM concepts;
- financial report implementation is not present and scope expands into a new reporting subsystem;
- production data preservation requires irreversible destructive migration;
- acceptance criteria cannot be satisfied without deciding whether professional status should create a real membership row or remain client-level virtual semantics.

## Ready for Codex execution
yes, after explicit review of this high-risk plan
