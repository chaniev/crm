# Implementation Plan: TASK-034 Реализовать backend-модель графика групповых занятий

## Source task
/backlog/done/2026-05-13/TASK-034-group-schedule-backend-model.md

## Implementation branch
feature/TASK-034-group-schedule-backend-model

Branch rules:
- create this branch before writing code;
- do not implement other unrelated TASKs in this branch;
- confirm the branch is active before making project code changes;
- branch must be created from `main` after pulling latest changes if implementation starts from a clean state;
- if continuing already-started work, first verify that existing dirty changes belong only to TASK-034.

## Goal
Backend должен хранить структурированный график групповых занятий и отдавать frontend/bot достаточный контракт для автоматического расписания: `groupTypeId`, `branchId`, `hallId`, `trainingStartTime`, `durationMinutes`, `weekdays`.

## Current understanding
График нужен только для групповых занятий. `scheduleText` больше не является backend source of truth и должен быть удален из доменной модели, persistence и API-контрактов. Новые поля графика:
- `durationMinutes`: обязательное целое число от 1 до 180;
- `weekdays`: обязательный ISO `number[]` со значениями `1..7`, минимум 1 день, без дублей, хранится и возвращается отсортированным.

Backend остается владельцем validation semantics и ProblemDetails. Проверка занятости зала, конфликтов времени, переносов, отмен, замен тренера, attendance auto-generation и notifications не входят в реализацию. Production backfill не нужен, деплой планируется с нуля, но seed/test data должны быть обновлены явно.

## Execution steps
1. Перед любыми изменениями проверить `git status --short --branch`, переключиться на `main`, подтянуть latest и создать/активировать `feature/TASK-034-group-schedule-backend-model`, если реализация начинается с чистого состояния.
2. Инвентаризировать все использования `ScheduleText`/`scheduleText` в backend, frontend, bot, tests и e2e, чтобы убрать поле из backend source of truth и не оставить сломанные consumers.
3. Обновить доменную модель `TrainingGroup`: удалить `ScheduleText`, добавить обязательные `DurationMinutes` и `Weekdays`, сохранить связи `Branch`, `Hall`, `GroupType` из TASK-031.
4. Обновить EF configuration и миграцию: удалить колонку `ScheduleText`, добавить `DurationMinutes` и `Weekdays` (`integer[]` для PostgreSQL), обновить `GymCrmDbContextModelSnapshot`, добавить check constraints для `DurationMinutes` 1..180 и непустого `Weekdays`.
5. Обновить group create/update request normalization и validation: обязательные `durationMinutes` и `weekdays`, диапазон длительности, ISO-диапазон дней, запрет дублей, сортировка normalized `weekdays`.
6. Обновить group list/details responses, client group summaries, attendance/client affected read models и audit state, чтобы они возвращали `durationMinutes` и отсортированные `weekdays`, но не возвращали `scheduleText`.
7. Обновить backend bot-facing contracts/service projections, если они читают группы или client group summaries.
8. Обновить frontend API-типы, мапперы и формы как consumers backend-контракта без дублирования backend validation rules; frontend может показывать поля, но backend остается источником validation semantics.
9. Обновить bot CRM models и presentation, если bot отображает расписание группы; bot должен быть thin adapter над backend response.
10. Обновить seed/test factories/fixtures во всех затронутых backend, frontend и bot тестах: каждая тестовая группа должна иметь `durationMinutes` и `weekdays`.
11. Проверить audit log scenarios: create/update группы должны включать изменения `durationMinutes` и `weekdays` в serialized state.
12. Запустить обязательные проверки backend, затем affected consumers.

## Preferred implementation strategy
1. Contract-first: начать с backend request/response DTO и доменной модели.
2. Persistence second: EF configuration + migration/snapshot для чистого deploy.
3. Validation third: ProblemDetails fields `durationMinutes` и `weekdays`, normalization in one backend validator.
4. Read-model propagation: list/details, attendance/client summaries, bot service contracts.
5. Consumer adaptation: frontend/bot только потребляют новый контракт, не переносят CRM rules из backend.
6. Tests together with feature changes, начиная с backend integration regression coverage.

## Files likely to change
- `backend/src/GymCrm.Domain/Groups/TrainingGroup.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/TrainingGroupConfiguration.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/*AddGroupScheduleBackendModel*.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/*AddGroupScheduleBackendModel*.Designer.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/GymCrmDbContextModelSnapshot.cs`
- `backend/src/GymCrm.Api/Auth/UpsertTrainingGroupRequest.cs`
- `backend/src/GymCrm.Api/Auth/NormalizedGroupRequest.cs`
- `backend/src/GymCrm.Api/Auth/GroupRequestValidator.cs`
- `backend/src/GymCrm.Api/Auth/GroupEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/GroupListItemResponse.cs`
- `backend/src/GymCrm.Api/Auth/GroupDetailsResponse.cs`
- `backend/src/GymCrm.Api/Auth/ClientGroupSummaryResponse.cs`
- `backend/src/GymCrm.Api/Auth/TrainingGroupAuditState.cs`
- `backend/src/GymCrm.Api/Auth/GroupApiConstants.cs`
- `backend/src/GymCrm.Api/Auth/GroupResources.cs`
- `backend/src/GymCrm.Api/Auth/Resources/GroupResources.resx`
- `backend/src/GymCrm.Application/Bot/BotApiContracts.cs`
- `backend/src/GymCrm.Infrastructure/Bot/BotApiService.cs`
- `backend/tests/GymCrm.Tests/GroupsApiTests.cs`
- `backend/tests/GymCrm.Tests/ClientsApiTests.cs`
- `backend/tests/GymCrm.Tests/AttendanceApiTests.cs`
- `backend/tests/GymCrm.Tests/BranchesApiTests.cs`
- `backend/tests/GymCrm.Tests/InternalBotApiTests.cs`
- `backend/tests/GymCrm.Tests/AuthorizationFlowTests.cs`
- `backend/tests/GymCrm.Tests/CsrfProtectionTests.cs`
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/groups.ts`
- `frontend/src/lib/api/attendance.ts`
- `frontend/src/lib/api/mappers.ts`
- `frontend/src/features/groups/GroupManagement.tsx`
- `frontend/src/features/attendance/AttendanceScreen.tsx`
- `frontend/src/features/clients/ClientManagement.tsx`
- `frontend/src/lib/resources.ts`
- `frontend/e2e/*.spec.ts`
- `bot/src/gym_crm_bot/crm/models.py`
- `bot/src/gym_crm_bot/core/service.py`
- `bot/tests/test_crm_client.py`
- `bot/tests/test_bot_service.py`

## Constraints
- Backend owns CRM validation semantics and group schedule contracts.
- Do not duplicate branch, hall, group type or schedule validation in frontend/bot.
- Keep `BranchId`, `HallId`, `GroupTypeId`, `TrainingStartTime`, `DurationMinutes`, `Weekdays` required for create/update.
- `weekdays` must be stored and returned sorted.
- ProblemDetails field names must be exactly `durationMinutes` and `weekdays`.
- No backward compatibility for `scheduleText` is required.
- Do not add hall occupancy/conflict validation in this task.
- Do not change roles/permissions/auth semantics.

## Out of scope
- Personal training schedule.
- Reschedules, cancellations and trainer substitutions.
- Hall occupancy checks and time conflict validation.
- Automatic attendance record creation.
- Notifications and bot notifications.
- A new frontend schedule screen.

## Required test coverage

### Unit tests
No separate unit tests are required if schedule normalization and validation remain inside the existing backend request validator and are covered by API integration tests. Add unit tests only if normalization is extracted into a standalone service/helper.

### Integration tests
Required:
- group create rejects missing `durationMinutes` and missing/empty `weekdays`;
- group create rejects `durationMinutes` 0, negative and greater than 180;
- group create rejects `weekdays` outside `1..7` and duplicates;
- group create accepts unsorted `weekdays` and returns sorted values;
- group update validates the same fields and persists changed `durationMinutes`/`weekdays`;
- group list/details responses include `durationMinutes` and sorted `weekdays`;
- affected client/attendance/group read models include updated schedule fields where they expose group schedule;
- audit create/update state contains `durationMinutes` and sorted `weekdays`;
- no hall conflict validation is introduced.

### UI tests
Update existing frontend tests/e2e fixtures that still send or expect `scheduleText`. Add or adjust Playwright coverage only for existing group/attendance/client flows affected by the contract change; do not build a new schedule screen in this task.

### Bot tests
Update bot model/client/service tests that parse or render group schedule. Bot tests should verify consuming backend-provided `durationMinutes` and `weekdays`, not revalidating them.

### Manual-only validation
Manual QA can check visual wording of schedule labels in existing frontend/bot surfaces after automated tests pass. Manual QA is not the regression barrier.

## Test plan
- [ ] Run `dotnet test backend/GymCrm.slnx`.
- [ ] Run backend integration tests for group create/update/list/details validation and response shape.
- [ ] Run backend audit log tests covering group create/update serialized state.
- [ ] Run `npm run lint` in `frontend`.
- [ ] Run `npm run build` in `frontend`.
- [ ] Run affected frontend Playwright tests if existing group/attendance/client flows are updated.
- [ ] Run `ruff check .` in `bot`.
- [ ] Run `pytest` in `bot`.
- [ ] Search repository for `ScheduleText` and `scheduleText`; only historical migrations/docs may remain.

## Regression barrier
The primary barrier is backend integration coverage in `GroupsApiTests` plus affected read-model tests, because backend owns the contract and validation. Consumer regressions are guarded by frontend build/lint and bot pytest/ruff after API model updates. A final repository search for `scheduleText` prevents accidental dependency on the removed source-of-truth field.

## Risks
- Contract changes can break frontend and bot consumers if they still expect `scheduleText`.
- EF migration/snapshot drift can make clean database startup fail.
- `weekdays` normalization may accidentally hide duplicates before validation if raw and normalized values are not kept separate.
- PostgreSQL `integer[]` mapping/check constraints must remain compatible with test/runtime DB setup.
- Existing dirty worktree changes should be reconciled carefully before continuing implementation.

## Stop conditions
Остановиться и не писать код, если:
- найдено расхождение с архитектурой backend-as-source-of-truth;
- реализация требует изменения auth/roles/permissions;
- обнаружена необходимость production data preservation/backfill beyond current clean-deploy assumption;
- scope расширяется до scheduling engine, hall conflicts, attendance generation, notifications or frontend schedule screen;
- API contract cannot be determined from task and code;
- required changes become system-wide instead of local contract/read-model propagation.

Do not stop only because backend, frontend and bot consumers are all affected. This is expected for a backend contract change.

## Ready for Codex execution
yes
