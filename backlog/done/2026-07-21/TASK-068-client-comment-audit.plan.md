# Implementation Plan: TASK-068 Показывать автора и дату изменения комментария клиента

## Source task
/backlog/done/2026-07-21/TASK-068-client-comment-audit.md

Source task and this plan were moved to `/backlog/done` after implementation commit `43cc488` was merged into `main` via merge commit `6766951` (PR #79) on 2026-07-21.

Source status remains `risky`: this plan prepares the task for explicit review and later selection; it does not move the task into active implementation.

## Git branch
feature/TASK-068-client-comment-audit

Branch rules:
- before implementation, verify a clean worktree, switch to `main`, pull the latest changes and create this branch from `main`;
- confirm this branch is active before changing project code;
- do not implement unrelated TASKs in this branch;
- stop if the worktree is dirty or the branch/base is unclear.

## Goal
Показывать в карточке клиента актуальное имя пользователя и локализованное время последнего фактического изменения рабочей заметки, сохраняя backend-owned metadata и отдельный audit event без раскрытия технических идентификаторов.

## Current understanding
- `Client.Notes` уже хранит нормализованную рабочую заметку; нормализация выполняется до create/update в `ClientEndpoints`.
- Создание и изменение клиента проходят через backend policy `ManageClients`; чтение карточки — через `ViewClients`, а для тренера `GetClientAsync` дополнительно ограничивает клиента назначенными ему группами.
- Общие события `ClientCreated` и `ClientUpdated` уже записываются после сохранения клиента. TASK-068 добавляет отдельное событие изменения заметки, не заменяя эти события.
- Metadata заметки состоит из nullable `NotesChangedByUserId` и `NotesChangedAt`; имя в response вычисляется из актуального `User.FullName`, snapshot имени не хранится.
- Сравниваются старое и новое значения после существующей нормализации. Изменение других полей metadata не затрагивает.
- Создание с непустой заметкой устанавливает metadata и после общего `ClientCreated` создаёт отдельное событие заметки с переходом `set`; создание без заметки оставляет оба поля `null` и создаёт только общее событие. Очистка заметки очищает оба поля.
- Legacy-строки сохраняют заметку и получают `null` metadata; backfill запрещён.
- Время задаёт backend через единый `now`, округлённый/нормализованный до секунд. Контракт передаёт UTC `DateTimeOffset`, UI форматирует его в локальной зоне до минут.
- Один frontend-запрос выполняет изменение клиента и всё связанное журналирование. Сначала сохраняется клиент, затем последовательно выполняются существующий общий audit и отдельный note audit. Каждый audit является независимым best-effort шагом: ошибка любого из них безопасно логируется, не отменяет изменение клиента, не препятствует попытке записать следующее событие и не меняет успешный HTTP-ответ.
- Физическое удаление пользователя находится вне scope. Деактивация пользователя сохраняет FK, актуальное `FullName` и время атрибуции заметки.
- Backend возвращает имя и время только полной парой. Если persisted metadata частичная или автор не может быть разрешён, response содержит `null` в обоих полях, а нарушение данных диагностируется безопасным структурированным логом.

## Safe decomposition
1. **Persistence and contract:** nullable metadata, связь с `User`, безопасная response-модель и загрузка актуального имени.
2. **Mutation semantics:** test-driven установка/сохранение/очистка metadata только при изменении нормализованной заметки.
3. **Audit isolation:** отдельный action/description/state, отсутствие события при no-op и безопасное логирование ошибки.
4. **Frontend presentation:** typed mapping и компактная подпись у заметки для заполненной, legacy и пустой карточки.
5. **Cross-role regression:** administrator/head coach mutation, coach scoped read, denied coach access and no technical identity leakage.

Каждый этап должен оставлять backend contract согласованным и проходить свои автоматизированные проверки до перехода к следующему.

## Execution steps
1. Создать `feature/TASK-068-client-comment-audit` от актуального чистого `main`; до этого не менять project code.
2. Зафиксировать точный additive API contract: рядом с `notes` вернуть nullable `notesLastChangedByName` и `notesLastChangedAt`; не добавлять user id/login. Подтвердить, что metadata требуется только в details response, а list/attention/bot contracts не расширяются без отдельного требования.
3. **До production-кода** добавить/обновить backend integration tests в `ClientsApiTests`:
   - create с нормализованно непустой и пустой заметкой: соответственно два audit events (`ClientCreated` + note `set`) и только `ClientCreated`;
   - `null -> text`, `text -> other text`, `text -> null`, whitespace-equivalent/no-op;
   - обновление ФИО, телефона, филиала и групп без изменения metadata;
   - два последовательных автора и `last-write-wins`;
   - legacy note без metadata и искусственно созданная частичная/неразрешимая metadata: backend возвращает оба contract fields как `null` и пишет безопасную диагностику;
   - актуальный `User.FullName`, UTC/секундная точность и отсутствие id/login в JSON;
   - administrator/head coach write, assigned coach read, unassigned coach denial;
   - отдельный audit event только при фактическом изменении и сохранение общего client audit;
   - независимые сбои общего и note audit: успешное сохранение клиента и успешный HTTP-ответ, безопасный log без note/PII и попытка следующей audit-записи даже после ошибки предыдущей.
4. **До production-кода** добавить unit tests для вынесенной чистой семантики сравнения/применения metadata и нормализации серверного времени. Если логика остаётся внутри endpoint и отдельный unit seam создаст лишнюю абстракцию, зафиксировать это решением в плане реализации и покрыть все ветви integration tests; ручная проверка заменой не является.
5. **До production-кода** добавить frontend unit/component tests:
   - mapper принимает оба nullable contract fields и не ищет технический идентификатор;
   - карточка показывает `Имя · локальная дата, HH:mm` для полной metadata;
   - legacy note показывается без ложной атрибуции, пустая note сохраняет текущий empty state;
   - форматирование проверяется с фиксированной timezone/locale и точностью до минуты.
6. **До production-кода** обновить affected Playwright fixture/contract и добавить сценарий отображения metadata в карточке доступного клиента; отдельным сценарием защитить отсутствие metadata у legacy note. Не дублировать backend permissions в UI.
7. Запустить новые backend и frontend tests и подтвердить ожидаемое падение именно из-за отсутствующих schema fields, response fields, audit action и UI metadata. Сохранить перечень падающих тестов в implementation notes/PR.
8. Реализовать минимальную persistence-модель:
   - добавить nullable `NotesChangedByUserId`, `NotesChangedAt` и navigation к `User` в `Client`;
   - настроить nullable FK/index с `DeleteBehavior.Restrict`; физическое удаление пользователя не поддерживать в рамках задачи, а деактивация не должна менять metadata или отображаемое актуальное имя;
   - обновить начальное состояние БД и model snapshot согласно текущей repository policy, без backfill существующих заметок;
   - проверить clean-database setup и nullable legacy semantics.
9. Реализовать backend mutation semantics, используя одно серверное время с секундной точностью:
   - create: установить metadata только для непустого нормализованного `Notes`;
   - update: сохранить старое нормализованное значение до присваивания и менять metadata только при ordinal-различии;
   - clear: записать `Notes = null` и очистить оба metadata fields;
   - прочие изменения клиента metadata не меняют.
10. Расширить snapshot/load queries только необходимой navigation/projection к автору и добавить nullable безопасные поля в `ClientDetailsResponse`/мапперы. Не сериализовать `NotesChangedByUserId`, `User.Id` или `User.Login`. Возвращать имя и время только полной парой; при частичной metadata или неразрешимом авторе вернуть оба значения `null` и записать безопасную диагностику нарушения данных.
11. Добавить отдельные локализованные audit constants/resources и событие изменения заметки. При create с непустой заметкой после `ClientCreated` записать note event с переходом `set`; при create без заметки note event не создавать. Audit payload не должен содержать текст заметки; достаточно client id, факта изменения и безопасной категории перехода (`set`, `changed`, `cleared`).
12. После успешного client save последовательно попытаться записать общий audit, затем note audit. Изолировать каждый audit write так, чтобы сбой первого не загрязнял EF tracking/контекст, не препятствовал попытке второго и не менял успешный HTTP-ответ. Для каждого сбоя записать структурированный `ILogger` event с action type, client id, actor id допустимым только в server log и exception metadata, но без note, full name, phone, login, serialized client state или request body. Ошибки сохранения самого клиента не скрывать.
13. Обновить frontend `ClientDetails`, payload mapping и блок «Рабочая заметка». Форматировать валидный UTC timestamp браузером в локальной зоне с минутной точностью; при неполной/legacy metadata не показывать догадок, технических fallback-значений или `Invalid Date`.
14. Запустить новые targeted tests, затем полный regression suite: backend tests, frontend lint/build и affected Playwright tests. Отдельно проверить schema recreation.
15. Провести security/privacy review JSON response и structured logs, затем ручную проверку desktop/narrow screen для длинного имени автора и переноса строки. Ручная QA дополняет, но не заменяет автоматические барьеры.

## Preferred implementation strategy
1. Contract-first additive response fields.
2. Backend-owned normalization, authorization, audit and time semantics.
3. Nullable schema with no legacy backfill.
4. Small verifiable commits by persistence, backend behavior/audit, frontend mapping/UI and regression coverage.
5. No feature flag is required if additive nullable fields preserve existing consumers; add one only if deployment compatibility analysis finds a concrete need.

## Files likely to change
- `backend/src/GymCrm.Domain/Clients/Client.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/ClientConfiguration.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.Designer.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/GymCrmDbContextModelSnapshot.cs`
- `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/ClientDetailsResponse.cs`
- `backend/src/GymCrm.Api/Auth/ClientAuditConstants.cs`
- `backend/src/GymCrm.Api/Auth/ClientAuditResources.cs`
- `backend/src/GymCrm.Api/Auth/Resources/ClientAuditResources.resx`
- `backend/src/GymCrm.Api/Auth/Resources/ClientAuditResources.ru.resx`
- `backend/tests/GymCrm.Tests/ClientsApiTests.cs`
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/clients.ts`
- `frontend/src/lib/api/clients.test.ts` or the nearest existing client mapper test file
- `frontend/src/features/clients/ClientManagement.tsx`
- `frontend/src/features/clients/ClientManagement.test.tsx`
- `frontend/e2e/stage12.spec.ts` or a focused clients Playwright spec if split during implementation

Exact migration/resource filenames must be verified before editing. Do not generate a second historical migration if repository policy still requires updating the initial database state.

## Constraints
- Backend remains the sole owner of permissions, normalization, time, audit and metadata mutation.
- Preserve the existing `Notes` field and its normalization/validation semantics.
- Do not expose author id, login or entity/navigation shapes in UI contracts.
- Use actual current `User.FullName`; do not persist a name snapshot.
- Both metadata fields are nullable and must remain mutually consistent for new writes.
- Treat physical user deletion as out of scope; user deactivation preserves note attribution and current-name resolution.
- Return note author name and timestamp only as a complete pair; normalize partial/unresolvable metadata to two `null` response values and diagnose it server-side.
- Use `DateTimeOffset` UTC with second precision; never reuse `Client.UpdatedAt`.
- Coach visibility must continue to be derived from backend-confirmed group assignment.
- Note editing remains restricted to Administrator and HeadCoach through backend authorization.
- Do not log note contents or other client PII on audit failure.
- Preserve accepted `last-write-wins` and accepted non-atomic audit behavior. Once the client is saved, failure of either audit write must not change the successful HTTP result or prevent attempting the other audit write.

## Out of scope
- Version history, multiple comments, replies or notifications.
- Optimistic concurrency or lost-update prevention.
- Transactional coupling/outbox for client and audit writes.
- Physical deletion of a user and cleanup/reassignment of historical note attribution.
- Backfilling legacy note attribution.
- Permission/RBAC redesign.
- Showing technical actor identity in the frontend.
- Expanding dashboard, bot or list contracts unless implementation proves the client card consumes one of them and contract compatibility requires it.

## Required test coverage

All new/updated unit and integration tests are written before functional code and must first fail for the expected missing behavior.

### Unit tests
- Pure transition semantics for empty/non-empty normalized notes, including clear and no-op.
- Second-precision UTC timestamp normalization with a deterministic time source or isolated helper.
- Frontend payload mapping of full, partial/legacy and absent metadata.
- Frontend localized minute-precision rendering without invalid/fabricated attribution.

### Integration tests
- Persistence and response contract for create/update/clear/no-op/other-field updates.
- Two-user last-write-wins and current `FullName` lookup.
- Nullable FK/legacy row and clean database schema recreation.
- Separate note audit cardinality and payload safety alongside existing general client audit, including two events for create with a note and one event for create without a note.
- Independent failure of the general audit and note audit: successful client persistence/HTTP response, safe logging and an attempt to write the remaining event.
- Partial or unresolvable persisted metadata normalized to two nullable response fields with safe diagnostics.
- Authorization/access matrix for Administrator, HeadCoach, assigned Coach and unassigned Coach.
- JSON allowlist assertion proving no note author id/login is returned.

### UI/e2e tests
- Visible author/time beside a note in the client card.
- Legacy note without attribution and empty-note state.
- Long author name/narrow viewport smoke coverage if existing responsive suite can express it without brittle geometry.
- No UI-derived permission decision; inaccessible coach client remains rejected by backend/mocked 403 flow.

### Existing tests to update
- Client details fixtures in `ClientManagement.test.tsx` and relevant Playwright specs.
- Client API mapper contract tests.
- Existing create/update/audit assertions in `ClientsApiTests.cs` without weakening their current general audit guarantees.

### Expected initial failure
- Backend tests fail because schema/domain/response lack note metadata and note-specific audit behavior.
- Frontend tests fail because `ClientDetails`, mapper and card do not consume/render author/time.
- A failure caused by broken test setup, locale leakage or unrelated baseline regression does not satisfy the red phase.

### Manual-only validation
- Visual rhythm and wrapping of attribution on representative desktop and narrow viewport.
- Human review that audit failure logs remain diagnostically useful without note/client PII.

## Test plan
- [ ] New backend unit/integration tests are committed before production implementation and fail for the intended missing behavior.
- [ ] New frontend unit/component/e2e tests are committed before production implementation and fail for the intended missing behavior.
- [ ] Create with note sets actor/time; create without note leaves both null.
- [ ] `null -> text`, `text -> other`, `text -> null` and normalized no-op produce exact metadata/audit results.
- [ ] Other client field changes preserve note metadata and existing general audit.
- [ ] Two users demonstrate last-write-wins and current `FullName` display.
- [ ] Legacy rows remain unchanged and render without attribution.
- [ ] API JSON contains display name/time but no author id/login.
- [ ] Administrator/HeadCoach write and assigned/unassigned Coach access cases pass.
- [ ] Create with a note writes `ClientCreated` followed by note `set`; create without a note writes only `ClientCreated`.
- [ ] Failure of either audit write is logged without note/PII, does not roll back the client, does not change the successful HTTP response and does not prevent attempting the other audit write.
- [ ] Partial/unresolvable metadata returns both response fields as `null` and produces safe server diagnostics.
- [ ] `dotnet test backend/GymCrm.slnx` passes.
- [ ] Frontend targeted tests, `npm run lint` and `npm run build` pass.
- [ ] Affected Playwright tests and clean database setup/schema verification pass.

## Regression barrier
The primary barrier is a backend integration matrix in `ClientsApiTests` that asserts note transition, metadata persistence, role/scope access, response allowlisting and exact note-audit cardinality against a real test database. It is paired with frontend mapper/component tests and a Playwright card scenario. Completion is blocked if tests can pass while returning a technical actor id/login, changing metadata on a normalized no-op/other-field edit, backfilling legacy rows, omitting the audit event, or logging note/client PII.

## Risks
- A nullable relationship to `User` can accidentally become required or cascade-delete clients; explicitly test `Restrict` configuration and preservation of attribution after user deactivation.
- Loading `User.FullName` may introduce N+1 queries or fail in coach projection; use one projection/include and cover both admin and coach details paths.
- Existing general audit state contains notes; the new audit event must not amplify sensitive content, and failure logging must never serialize request/client state.
- Two post-save audit writes create partial-success combinations. Each write must be isolated from the shared EF tracking state, attempted in the agreed order (general, then note), observable through safe logs and never disguised as a failed client update.
- Ambient `DateTimeOffset.UtcNow` and local timezone tests can be flaky; prefer deterministic time injection/seams and fixed test timezone.
- Additive fields can still break strict fixtures/consumers; update frontend and verify bot/dashboard contracts remain unaffected.

## Stop conditions
Остановиться и не писать production-код, если:
- task-specific branch не создана от чистого актуального `main`;
- невозможно сохранить backend-owned coach access without RBAC redesign;
- API contract требует раскрыть user id/login или хранить snapshot имени вопреки задаче;
- модель пользователя требует физического удаления или каскадного/`SetNull` поведения, противоречащего согласованному `Restrict` и сохранению атрибуции при деактивации;
- существующий audit service не позволяет независимо обработать ошибки общего и note audit, очистить/изолировать failed tracking state и продолжить второй write без системного redesign;
- schema change требует необратимого production backfill или разрушения legacy notes;
- scope расширяется до общей истории комментариев, optimistic concurrency, transactional outbox или системного изменения audit;
- новые tests не могут достоверно отличить note change от normalized no-op.

Backend + frontend scope, nullable schema change, shared client card, roles and audit сами по себе не являются stop condition.

## Ready for Codex execution
no

Причина: задача остаётся high-risk (`Safe for Codex: no`) из-за персональных данных, permissions и audit semantics. План готов к review; после явного перевода задачи в implementation исполнение допустимо только в указанной ветке и строго через test-first этапы.
