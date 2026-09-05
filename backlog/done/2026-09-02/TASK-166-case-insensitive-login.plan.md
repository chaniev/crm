# Implementation Plan: TASK-166 Регистронезависимый вход по логину

## Metadata
- source_task: /backlog/done/2026-09-02/TASK-166-case-insensitive-login.md
- completion: implemented and locally integrated into main on 2026-09-02
- requirements: REQ-USR-002 (changes), REQ-USR-003 (changes), REQ-NFR-003 (constrains)
- branch: feature/TASK-166-case-insensitive-login
- readiness: yes — продуктовое решение принято; backend data/security review нормализованного ключа, forward migration и retained-database collision stop зафиксирован в ADR-0001
- dependencies: none
- risk: high — authentication lookup, все пути создания пользователя и PostgreSQL unique identity меняются одним согласованным контрактом

## Goal
Пользователь с правильным паролем входит под существующей учётной записью при любом регистре введённого логина, а backend не позволяет существовать двум логинам, отличающимся только регистром, и продолжает возвращать канонический сохранённый `Login`.

## Decisions and contracts
- [ADR-0001](../../../docs/architecture/adr/0001-case-insensitive-login-identity.md) — регистронезависимая identity через сохранённый нормализованный ключ (Proposed; реализация авторизована планом TASK-166).
- Ввести единый backend `LoginIdentity` contract: после существующего trim вычислять deterministic invariant normalized key без изменения сохранённого канонического `User.Login`. Authentication, create validation, bootstrap, seed/upsert и persistence используют только этот contract для identity comparison.
- Хранить нормализованный ключ отдельно от отображаемого `Login`; lookup выполняется по ключу и остаётся индексируемым. PostgreSQL unique index на ключ является окончательным concurrency barrier. И обычная application validation, и обнаруженный через unique barrier конкурентный case-only duplicate возвращают одинаковую field-level ошибку у поля `login`: «Пользователь с таким логином уже существует.».
- Централизованно синхронизировать normalized key перед каждой вставкой пользователя, включая bootstrap и тестовые seed paths; не полагаться на frontend normalization или на то, что каждый producer вручную повторит алгоритм.
- Forward migration сначала вычисляет и проверяет normalized keys существующих строк. Если один ключ принадлежит нескольким `User`, migration останавливается до изменения uniqueness contract и сообщает конфликтные канонические логины; она не выбирает, не переименовывает и не объединяет записи.
- После успешного preflight migration backfill-ит обязательный normalized key, заменяет case-sensitive `IX_Users_Login` на case-insensitive unique barrier и синхронизирует EF model snapshot. Clean database и retained database без collision обновляются автоматически обычным startup migration flow.
- Login с неизвестным пользователем, отключённым пользователем или неверным паролем сохраняет один существующий non-enumerating `401` ProblemDetails contract. Case-collision не должен превращаться в случайный account selection или публичный provider exception.
- Claims, session/profile responses, audit descriptions и UI получают `User.Login`, найденный в БД, а не введённый или нормализованный вариант.
- Запрет изменения логина сохраняется: case-only значение в update request не переписывает канонический `Login`.

## Scope
### In
- Backend normalization/lookup, user persistence model, create/update validation, bootstrap and seed paths.
- Forward PostgreSQL migration with collision preflight, backfill and unique barrier.
- Backend/provider integration tests and a focused frontend login smoke proving pass-through input plus canonical response rendering.

### Out
- Password comparison/hashing, login rename/merge tooling, account recovery, roles/permissions/session lifetime and frontend-owned identity rules.

## Implementation slices
1. Add normalization contract tests and authentication cases for lower/upper/mixed input, canonical session/audit output and unchanged invalid-credentials behavior; capture RED on the current exact lookup.
2. Add create/update/bootstrap tests for case-only duplicates and canonical preservation, including concurrent PostgreSQL insertion; capture RED while current application checks and `IX_Users_Login` remain case-sensitive.
3. Add retained PostgreSQL migration tests: clean bootstrap, upgrade with distinct logins, and upgrade with `Coach`/`coach` that fails with actionable collision evidence and leaves existing rows unmodified.
4. Implement the shared normalized-key contract, persistence synchronization and indexed login lookup; route staff creation, bootstrap and seed/upsert identity checks through it while preserving stored `Login` in claims/audit/responses.
5. Add the forward migration and snapshot update, map the new unique constraint to the existing field-level `login` validation response «Пользователь с таким логином уже существует.» for concurrent case-only duplicates, preserve the existing bootstrap conflict behavior, and prove clean/retained/concurrent paths green on PostgreSQL.
6. Add or update the focused frontend auth test so mixed-case input is sent after trim without lower/upper conversion and the canonical login returned by backend remains the displayed/session identity.

## Likely files and layers
- `backend/src/GymCrm.Domain/Users/User.cs` and a focused `LoginIdentity` type/service under `GymCrm.Domain/Users` — canonical and normalized identity state.
- `backend/src/GymCrm.Infrastructure/Persistence/GymCrmDbContext.cs`, `Configurations/UserConfiguration.cs` — normalized-key synchronization and unique index model.
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/*CaseInsensitiveLogin*.cs` and `GymCrmDbContextModelSnapshot.cs` — retained preflight, backfill and new barrier.
- `backend/src/GymCrm.Api/Auth/AuthEndpoints.cs`, `UserRequestValidator.cs`, `StaffManagementMutationService.cs` — indexed lookup, validation and conflict mapping.
- `backend/src/GymCrm.Api/Startup/BootstrapUserStartupExtensions.cs`, `backend/src/GymCrm.Api/SeedData/**` — bootstrap/seed identity checks and normalized writes.
- `backend/tests/GymCrm.Tests/AuthFlowTests.cs`, `UsersApiTests.cs`, `StartupLoggingSmokeTests.cs`, `LeninskySeedDataTests.cs` — application and test-provider cases.
- New focused PostgreSQL login identity/migration test under `backend/tests/GymCrm.Tests/` — real unique, concurrency and retained-upgrade barrier.
- `frontend/src/app/AuthStages.tsx` tests or the nearest existing auth-stage consumer test — input pass-through and canonical response smoke; production component changes are not expected.

## Regression specification
### Automated tests to add or update
- Normalization theory covers empty/trimmed and representative Latin/Cyrillic lower, upper and mixed-case pairs; equal identity inputs produce one stable normalized key while `User.Login` remains byte-for-byte canonical after trim.
- AuthFlow theory logs into a stored mixed-case account with lower/upper/mixed inputs and asserts the same user id, stored login in session/profile/cookie claim and stored login in `Login` audit description.
- AuthFlow negative theory asserts unknown login, wrong password and inactive case-matched account keep the same status/title/detail and do not expose existence or normalized values.
- Users API rejects a case-only duplicate through every staff-create endpoint with the existing `login` validation contract; update with case-only login remains rejected as immutable and does not alter stored/audit state.
- Bootstrap started with a case variant of an existing login does not create a second user; parallel bootstrap/create attempts resolve through the new unique constraint without leaking PostgreSQL details.
- Seed tests prove repeated/upsert execution does not create case-only duplicates and every seeded user has a synchronized normalized key.
- PostgreSQL persistence test inserts concurrent case variants and proves exactly one commit succeeds under the named unique barrier; application endpoint maps the loser to the same field-level `login` error «Пользователь с таким логином уже существует.», without leaking PostgreSQL details.
- PostgreSQL migration tests cover empty clean schema, retained unique logins, and retained `Coach`/`coach`; the collision case fails before uniqueness replacement, names the conflicting canonical logins, and preserves both source rows for operator resolution.
- Frontend auth test submits mixed-case input unchanged except trim and consumes a canonical stored login returned by backend without client-side identity normalization.

### Expected red evidence
- Mixed-case AuthFlow cases return `401` because `AuthEndpoints` currently compares `candidate.Login == login`.
- Case-only staff/bootstrap duplicate cases permit a second identity or miss the existing row because validation and bootstrap use exact equality.
- PostgreSQL concurrency and retained-collision tests fail because the current unique index accepts `Coach` and `coach` and no collision preflight exists.
- The canonical-output assertions should remain green where the current flow already uses the stored `User.Login`; they are characterization coverage, not artificial RED.

### Required validation
- Focused login identity, AuthFlow, Users API, bootstrap/seed and new PostgreSQL migration/barrier tests.
- Task verification contract must run the real PostgreSQL retained-upgrade and concurrent case-only uniqueness scenarios in addition to the diff-selected backend baseline, plus the focused frontend auth smoke.

### Regression barrier
- One PostgreSQL-backed end-to-end barrier creates canonical `Coach`, rejects concurrent creation of `coach` with the field-level `login` error «Пользователь с таким логином уже существует.», authenticates as `COACH`, and asserts that session, claim and audit still expose exactly `Coach`; a paired retained-migration collision case must stop without changing either row.

## Risks and stop conditions
- Stop if the chosen .NET normalization and PostgreSQL migration/backfill produce different keys for any currently stored login; one shared observable contract must be demonstrated before the unique index is replaced.
- Stop retained upgrade on every duplicate normalized key. Resolving concrete production rows requires a separate explicit data decision and is not part of TASK-166.
- Stop if a provider-specific query cannot use the normalized unique index or if InMemory/SQLite tests pass semantics that the PostgreSQL barrier rejects; PostgreSQL evidence is authoritative for persistence.
- Do not weaken the common invalid-credentials response, expose raw constraint/migration details through HTTP, normalize passwords, or allow case-only login edits.
