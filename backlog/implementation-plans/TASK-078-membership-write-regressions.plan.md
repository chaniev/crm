# Implementation Plan: TASK-078 Исправить ошибки сохранения операций с абонементом

## Source task
/backlog/risky/TASK-078-membership-write-regressions.md

Source status remains `risky`: задача имеет `Risk level: high` и `Safe for Codex: no`, поэтому этим planning-run она не перемещается в `/backlog/implementation`. План разрешает диагностику, test-first локализацию и human review, но не разрешает автоматически начинать production-код.

## Git branch
fix/TASK-078-membership-write-regressions

Branch rules:
- перед реализацией убедиться, что план явно одобрен для исполнения, а source task переведён из `risky` в `/backlog/implementation`;
- проверить чистый worktree, перейти на `main`, выполнить `git pull` и создать `fix/TASK-078-membership-write-regressions` от актуального `main`;
- подтвердить активную task branch до первого изменения project-кода;
- не включать TASK-077, redesign membership lifecycle, исторический data repair или несвязанный рефакторинг;
- остановить выполнение, если worktree dirty, текущая ветка неясна либо branch создана не от `main`.

## Goal
Разрешённые purchase, renewal, correction и mark-payment надёжно сохраняют продажу, версию абонемента, оплату и audit trail; запрещённые или повторные операции возвращают стабильный понятный ProblemDetails и не оставляют частичных или дублирующих данных. Пользователь может задать срок срочного абонемента через существующий backend-owned flow и после ответа увидеть сохранённое состояние при новой загрузке карточки.

## Current understanding
- Backend остаётся единственным владельцем lifecycle, пересечений периодов, статуса оплаты, версионирования, audit и ProblemDetails. Frontend должен только отправлять typed payload и отображать backend errors.
- Write endpoints находятся в `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs`; application contract — в `IClientMembershipService.cs`; persistence-операции — в `ClientMembershipService.cs`.
- Обычная покупка создаёт `ClientMembershipSale` и первую `ClientMembership` version. Renewal создаёт новую продажу и новое назначение. Correction и mark-payment закрывают текущую version через `ValidTo` и создают новую version той же продажи.
- Завершённая TASK-070 разрешает последовательные непересекающиеся будущие `Term`/конечные `Professional` назначения, запрещает пересечения, запрещает renewal для `SingleVisit` и открытого `Professional` и требует stable ProblemDetails для overlap. TASK-078 не должна менять эти правила.
- Завершённая TASK-077 сделала `ClientMembershipSale.GrossAmount` и `PricingMode` неизменяемыми для correction/mark-payment. TASK-078 не должна возвращать редактирование цены или каталожной идентичности.
- В модели уже объявлен `ClientMembershipMutationError.MembershipOverlap`, но текущий service flow его не возвращает; несколько lifecycle errors попадают в общий fallback `membership`/`MembershipChangeFailed`. Это вероятный источник неинформативных ошибок, который требуется подтвердить red tests до исправления.
- PostgreSQL защищает `Term`/`Professional` от пересечений GiST exclusion constraint и разрешает по одной открытой version на `SaleId`. Текущие membership HTTP tests используют EF InMemory и не исполняют эти ограничения. Поэтому green InMemory suite не доказывает работоспособность второго абонемента, renewal или correction на реальном runtime provider.
- `PurchaseAsync` проверяет активность на backend today, а PostgreSQL проверяет пересечение всего индивидуального периода. Между pre-check и DB constraint возможны различия и конкурентная гонка; constraint violation не должна превращаться в 500 или общую frontend error.
- `ExecuteMembershipActionAsync` пишет audit после возврата membership service. Purchase и version replacement могут к этому моменту уже зафиксировать свои transaction. Необходимо test-first доказать, что ошибка audit/persistence не оставляет успешную domain mutation без обязательной audit-записи.
- Backend service и endpoint projection выбирают одну запись под названием current membership разными сортировками. При очереди будущих назначений это может направить correction/mark-payment не в ту продажу. Должен существовать один backend-owned способ выбрать effective/current либо явно адресовать target version; frontend не должен угадывать его.
- Текущий correction payload содержит `purchaseDate`, `expirationDate`, `isPaid`, а service использует `purchaseDate` одновременно как дату продажи и `IndividualValidFrom` новой version. Дата продажи и индивидуальное начало срока — разные понятия; точный симптом и требуемый contract следует зафиксировать red test, не сохраняя их неявное смешение.
- Correction вычисляет сохраняемую payment attribution, а затем создаёт version через общий factory. Tests должны отдельно доказать сохранение либо намеренное изменение `PaidByUserId`/`PaidAt`, чтобы correction неоплаченного/оплаченного абонемента не переписывала финансовую семантику случайно.
- Web write endpoints не имеют membership-specific idempotency contract. В проекте уже используется `Idempotency-Key` с payload conflict semantics в других write flows; TASK-078 должна применить эквивалентный, но не bot-specific, barrier либо доказать другой concurrency-safe способ исключить дубли при повторной отправке.
- Frontend уже умеет разбирать `application/problem+json`, но верхний `handleMembershipAction` сохраняет только общий message, а дочерние формы отдельно раскладывают field errors. Tests должны доказать, что точный backend detail/field error остаётся видимым и draft формы не теряется.
- Значительное изменение UX не требуется: используются существующие purchase/renew/correction/mark-payment panels и confirmation modal. Если диагностика потребует нового выбора конкретной продажи/version, это становится UX decision gate и требует `ui-designer`.

## Reproduction record required before code
До написания production-кода создать в test/diagnostic notes таблицу для каждого из пяти симптомов:

| Case | Actor | Branch | Catalog behavior | Existing assignments | Requested dates/payment | HTTP status | ProblemDetails type/title/detail/errors | Persisted sales/versions/audits |
|---|---|---|---|---|---|---|---|---|
| allowed correction | Administrator и HeadCoach | exact branch | Term | paid и unpaid variants | exact payload | capture | capture | fresh DbContext counts and values |
| second membership | Administrator и HeadCoach | exact branch | Term plus SingleVisit/Professional controls | active, expired, future queue | exact payload | capture | capture | fresh DbContext counts and ranges |
| renewal | Administrator и HeadCoach | exact branch | finite Term; finite/open Professional; SingleVisit | current plus optional future renewal | exact payload | capture | capture | fresh DbContext counts and ranges |
| unpaid correction then payment | Administrator и HeadCoach | exact branch | Term | unpaid current/version history | exact two requests | capture | capture | status/date/actor/audit/finance reload |
| term validity edit | Administrator и HeadCoach | exact branch | Term | explicit `IndividualValidFrom/To` | exact edited range | capture | capture | response plus full reload |

Reproduction must use the same backend business date/time zone as the service and must record whether the failure occurs in request validation, application policy, EF SaveChanges, PostgreSQL constraint, audit write, response mapping or the follow-up GET.

## Contract and lifecycle decisions preserved
1. Purchase while an effective conflicting membership exists is rejected; it must not be silently converted into renewal.
2. A second assignment is allowed only when it is a valid sequential, non-overlapping lifecycle operation under TASK-070. Renewal appends after the last finite dated assignment, including an already planned future assignment.
3. Inclusive date ranges remain inclusive. Adjacent assignments use `next.ValidFrom = previous.ValidTo + 1 day`.
4. `SingleVisit` has no individual date range, cannot be renewed and blocks incompatible active assignment while unused.
5. Open-ended `Professional` cannot be renewed. Professional assignment remains HeadCoach-only.
6. Correction may change only fields explicitly owned by correction. It cannot change sale catalog identity, pricing mode, gross amount or behavior.
7. Mark-payment changes only payment state/attribution of the addressed membership version; it cannot change the sale.
8. Branch scope, `ManageClients`, HeadCoach-only Professional assignment and Coach denial remain unchanged.
9. A retry with the same idempotency key and semantically identical payload returns/reloads the original completed result without new sale, version or audit rows. Reusing that key with a different operation, client, target or payload returns a stable conflict ProblemDetails.
10. Validation and conflict failures create no sale, membership version, payment change, audit entry or idempotency completion record.

## Safe decomposition and review gates

### Slice A — Reproduction and PostgreSQL test harness
- No production behavior changes.
- Add a focused real-PostgreSQL fixture that starts from the repository schema/migrations and can inspect constraints and persisted rows after a fresh scope.
- Reproduce all five symptoms and record expected red failures.
- Human review gate: confirm the actual root causes and that no production-data repair is required.

### Slice B — Backend lifecycle, transaction and idempotency
- Add one backend-owned membership target/effective-selection policy.
- Add stable ProblemDetails mapping, concurrency-safe overlap handling and one atomic write boundary including audit.
- Add membership-specific idempotency semantics using the project’s established `Idempotency-Key` behavior without coupling web membership writes to bot identity/storage.
- Human review gate: approve any schema/contract addition before editing the reproducible initial database state.

### Slice C — Frontend contract consumer
- Update typed requests and payloads only after backend contract tests are fixed.
- Generate one key per user submission, reuse it only for retry of that exact submission and disable accidental double-submit while pending.
- Preserve draft values and display backend detail plus field-level errors.
- If explicit sale/version targeting changes the visible workflow, stop for `ui-designer` review.

### Slice D — Cross-layer regression validation
- Run focused red/green suites, full backend tests, frontend lint/build/component tests and focused Playwright.
- Verify the local compose stack against PostgreSQL after clean database creation and, if relevant, upgrade from the immediately preceding schema.

If these slices are converted into independent backlog TASKs, each child must receive its own branch. Until then they are ordered phases of the single TASK-078 branch and must not be implemented independently in unrelated branches.

## Execution steps
1. Verify explicit execution approval, clean git status and create `fix/TASK-078-membership-write-regressions` from updated `main`.
2. Capture the five-case reproduction record with exact actor, branch, catalog item, date range, payment state, request JSON/header, HTTP response and before/after database counts.
3. Inspect the runtime schema and `__EFMigrationsHistory`; confirm whether the active database contains the current per-sale version index and filtered PostgreSQL overlap constraint. Do not mutate production data during diagnosis.
4. **Before functional code**, add unit tests for the shared lifecycle/target-selection, inclusive-range, payment-transition, idempotency payload normalization and mutation-error-to-contract policies.
5. Run the new unit tests and record an expected red phase caused by missing/incorrect membership behavior, not test infrastructure or compile errors.
6. **Before functional code**, add real-PostgreSQL integration/API tests for all five symptoms, reload, atomicity, audit, retries, concurrency, role/branch scope and stable ProblemDetails.
7. Run the new PostgreSQL tests and record the expected red phase. At least one test must demonstrate the provider-specific failure/gap that existing EF InMemory tests cannot catch.
8. **Before functional code**, add frontend API/component tests for the exact payload/header, date fields, pending/double-click behavior, ProblemDetails rendering, form draft preservation, success close and mandatory reload.
9. **Before functional code**, add or extend Playwright coverage for purchase/second-membership rejection, allowed renewal, correction, unpaid-to-paid and term-date editing. First run must fail for the missing behavior.
10. Review the complete red evidence. If the five symptoms do not reduce to local membership write/consumer changes, stop and update this plan before production code.
11. Implement the minimum backend policy/contract changes needed to make the unit tests pass. Keep domain policy free of HTTP/EF concerns and transport mapping out of the domain.
12. Make the application write boundary atomic: mutation, version closing/creation, sale creation when applicable, idempotency completion and required audit entries commit together or roll back together.
13. Pre-validate known lifecycle conflicts and map them to stable field/code semantics; retain the PostgreSQL constraint as the concurrency barrier and translate its known violation without exposing database details.
14. Separate sale purchase date from membership validity dates in correction semantics if the red test confirms the current conflation. Update all consumers together; never derive validity rules in frontend.
15. Implement idempotent replay/conflict behavior and optimistic/concurrent safety for purchase, renewal, correction and mark-payment. Release an unfinished reservation after rollback so a genuine retry can proceed.
16. Update frontend types/API calls/forms to the proven backend contract, add per-submission idempotency headers, keep controls pending during the request and render ProblemDetails without replacing it with a generic error.
17. Rerun the exact focused unit, PostgreSQL integration, frontend component and Playwright tests and obtain green without weakening assertions.
18. Run all required regression suites and validate the local compose stack from a clean PostgreSQL database.
19. Compare the final diff with TASK-078 scope; confirm no pricing-mode work from TASK-077, permission relaxation, historical data rewrite or card redesign was introduced.

## Preferred implementation strategy
- Contract-first and backend-first: encode existing TASK-070/TASK-077 lifecycle rules once, then adapt frontend.
- Use one focused policy/service for membership target selection and interval conflict classification; do not duplicate selection queries across endpoint projections and persistence service.
- Let application validation return understandable conflicts, but keep the PostgreSQL exclusion/unique constraints as the final concurrent-write barrier.
- Own the transaction at one application boundary. Nested or already-committed service transactions must not make audit failure observable as a failed HTTP response after data was saved.
- Reuse established `Idempotency-Key` and payload-hash semantics conceptually, but create membership-scoped records/keys so bot records, actor identifiers and web requests are not coupled.
- Store only the minimum idempotency result needed to replay/reload a completed mutation; never cache auth decisions across actors or branch scope.
- Prefer stable ProblemDetails `type`/code plus field errors such as `membership`, `validFrom`, `validTo`, `currentMembership`, `idempotencyKey` as appropriate. Do not expose PostgreSQL constraint names or exception text.
- Keep successful response and follow-up GET consistent by using the same backend-owned current/effective selection semantics.
- Use small commits by slice after each focused suite is green.

## Files likely to change

### Backend tests first
- `backend/tests/GymCrm.Tests/ClientMembershipWriteRegressionApiTests.cs` — new focused five-symptom and idempotency suite.
- `backend/tests/GymCrm.Tests/ClientMembershipPersistenceModelTests.cs` — actual schema/index/constraint regression checks.
- `backend/tests/GymCrm.Tests/ClientMembershipCreationPricingApiTests.cs` — keep TASK-077 price immutability barriers while extending correction/payment reload assertions.
- `backend/tests/GymCrm.Tests/ClientsApiTests.cs` — only shared role/audit/read-projection cases that do not belong in the focused file.
- `backend/tests/GymCrm.Tests/GymCrm.Tests.csproj` — only if a real-PostgreSQL fixture requires a test-container dependency.

### Backend production after red phase
- `backend/src/GymCrm.Application/Clients/IClientMembershipService.cs`
- `backend/src/GymCrm.Application/Clients/ClientMembershipSemantics.cs` or a new small membership lifecycle/selection policy beside it.
- `backend/src/GymCrm.Infrastructure/Clients/ClientMembershipService.cs`
- `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/PurchaseClientMembershipRequest.cs`
- `backend/src/GymCrm.Api/Auth/RenewClientMembershipRequest.cs`
- `backend/src/GymCrm.Api/Auth/CorrectClientMembershipRequest.cs`
- `backend/src/GymCrm.Api/Auth/MarkMembershipPaymentRequest.cs`
- `backend/src/GymCrm.Api/Auth/ClientResources.cs` and its resource file if new stable user-facing messages are required.
- `backend/src/GymCrm.Application/Audit/IAuditLogService.cs` and `backend/src/GymCrm.Infrastructure/Audit/AuditLogService.cs` only if audit staging must change to participate in the caller-owned transaction.
- `backend/src/GymCrm.Infrastructure/Persistence/GymCrmDbContext.cs`, a focused domain record/configuration and the reproducible initial schema only if membership idempotency needs persistence.
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/ClientMembershipConfiguration.cs` only if red PostgreSQL evidence proves the current model constraint is incorrect.
- Existing migration/initial schema artifacts only after the schema root cause is confirmed; do not add or edit schema for an application-only bug.

### Frontend tests first
- `frontend/src/lib/api/clients.membership-write.test.ts` — new typed request, idempotency header and ProblemDetails contract tests, or a focused extension of `clients.membership-pricing.test.ts`.
- `frontend/src/features/clients/ClientManagement.test.tsx`
- `frontend/e2e/membership-write-regressions.spec.ts`

### Frontend production after red phase
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/clients.ts`
- `frontend/src/lib/api/transport.ts` only if the existing request helper cannot pass a caller-provided idempotency header.
- `frontend/src/features/clients/ClientManagement.tsx`

### Runtime only if diagnosis proves it is affected
- `backend/src/GymCrm.Api/Startup/PersistenceStartupExtensions.cs`
- `deploy/docker-compose.yml`
- `deploy/docker-compose.server.yml`

Exact schema/idempotency filenames may be discovered after Slice A. No application file may be edited before the corresponding red tests exist and fail for the expected reason.

## Constraints
- Backend owns membership rules, business date, overlap, target selection, payment semantics, audit and validation.
- Do not weaken `ManageClients`, branch scope or HeadCoach-only `Professional`.
- Do not replace a stable validation conflict with a caught generic 500.
- Do not rely on EF InMemory to verify PostgreSQL exclusion, unique index, transaction or concurrency behavior.
- Do not silently alter sale price, pricing mode, catalog identity or behavior during correction/payment.
- Do not create duplicate sale, version, audit or completed idempotency rows under retry/double-click/concurrent requests.
- Do not mutate or repair production data without a separate approved analysis and rollback plan.
- Keep early-stage database setup reproducible from a clean environment.
- Preserve frontend Mantine/Onest and the existing client-card structure.

## Out of scope
- TASK-077 pricing mode, manual amount and amount-only redesign.
- Allowing overlapping or multiple simultaneously effective memberships.
- Changing catalog CRUD, refunds, financial formulas or historical sale values.
- Redesigning the client card or creating a new membership management screen.
- Mass repair of existing production rows.
- Authentication, global RBAC or branch model redesign.
- Bot membership write changes unless a shared backend contract change demonstrably affects the existing bot mark-payment consumer.

## Required test coverage

Unit and integration tests MUST be written or updated before functional code. The first focused run must fail because required behavior is absent or wrong; implementation starts only after this red phase is reviewed.

### Unit tests
- Inclusive interval policy: adjacent `Term` periods allowed; same-day and open-ended overlaps rejected.
- Effective/current/last-finite selection with active, expired and multiple sequential future assignments is deterministic.
- Purchase, renewal, correction and mark-payment target classification follows TASK-070 without frontend-derived rules.
- Correction keeps catalog identity, behavior, pricing mode and gross amount immutable.
- Correction preserves existing paid attribution when payment state is unchanged; unpaid-to-paid creates the agreed attribution once; paid-to-unpaid behavior is either explicitly supported by existing rules or rejected.
- Idempotency normalization hashes actor/client/action/target/payload consistently; same key plus different content is conflict.
- Known lifecycle and idempotency errors map to stable ProblemDetails codes/fields.

### Integration tests — real PostgreSQL mandatory
- Allowed Term correction closes exactly one prior version, creates exactly one new current head for the same sale, persists the edited individual validity range and reloads through GET.
- A valid second sequential future membership/renewal persists a second sale/head without violating constraints; an overlap returns a stable ProblemDetails and writes nothing.
- Renewal appends after the last finite assignment, including a pre-existing future queue, and preserves exact inclusive duration required by the existing contract.
- `SingleVisit`, open-ended `Professional`, cross-branch catalog item and unauthorized actor remain rejected without writes.
- Unpaid Term can be corrected while still unpaid, then marked paid; fresh reads agree on `IsPaid`, `PaidAt`, `PaidByUserId`, history, audit and affected financial projection.
- Term `validFrom`/`validTo` edits are not conflated with sale purchase date unless the approved correction contract explicitly changes both.
- Same idempotency key plus same request, sequentially and concurrently, creates one logical mutation and one audit result. Same key plus changed payload returns conflict.
- Invalid replay and PostgreSQL constraint violation leave sale/version/audit/idempotency counts unchanged.
- Injected failure before commit and injected audit failure roll back all membership data. No endpoint may return failure after a committed partial mutation.
- Clean schema applies all migrations/initial state and exposes the expected per-sale current-version index plus filtered membership overlap constraint.
- Response and a new-DbContext reload select the same current/effective membership.

### Existing backend tests to update
- TASK-077 creation pricing tests continue proving immutable sale pricing for correction and mark-payment.
- Role tests continue proving Administrator/HeadCoach access and Coach denial.
- Audit tests assert exact cardinality, before/after state and absence of credentials/DB exception details.
- Financial report tests only need extension if payment/correction currently changes report-visible state; no formula change is assumed.

### Frontend API/component tests
- Purchase, renewal, correction and mark-payment send exact backend-owned field names and one idempotency key per submission.
- A retry of the same pending/failed submission reuses the same key; a newly edited submission receives a new key.
- Double click while pending produces one HTTP call.
- Correction exposes and sends the proven validity fields, keeps sale/catalog/price immutable and preserves entered values on error.
- Backend ProblemDetails detail is shown, field errors bind to the relevant inputs and draft values remain intact.
- Successful write triggers a fresh `getClient`, displays reloaded values and only then closes the action panel.
- Unpaid correction followed by mark-payment uses `{}` body semantics plus the idempotency header and never reintroduces caller-controlled price/payment fields.

### UI/Playwright tests
- Desktop and 390 px mobile: allowed correction saves dates and is visible after page reload.
- Valid sequential renewal succeeds; forbidden second/overlapping purchase shows the specific reason and keeps the form usable.
- Unpaid membership can be corrected and then marked paid, with the paid badge/history visible after reload.
- Slow response/double click produces one logical operation.
- No horizontal overflow or inaccessible confirmation controls are introduced.

### Manual validation only
- Capture the original five production-like request/response traces on the local compose stand.
- Confirm Russian copy is understandable for Administrator and HeadCoach.
- Inspect technical logs to ensure correlation is possible and PostgreSQL details/PII are not exposed.

Manual QA is supplementary and cannot replace automated PostgreSQL/API/component coverage.

## Initial red-phase verification
- Run the focused unit tests and show at least one assertion failure in lifecycle/selection/payment/idempotency behavior.
- Run the focused API suite against a real PostgreSQL database created from repository schema. Infrastructure startup failure, missing Docker, compile error or test data bug does not count as red behavior.
- Run focused frontend tests and Playwright with the new cases; confirm failure at the missing payload/error/reload/dedup behavior.
- Save the failing test names and causes in the implementation execution notes before editing production code.
- Do not weaken assertions or switch the PostgreSQL tests to InMemory to obtain green.

## Test plan
- [ ] All five source symptoms have exact reproducible fixtures and expected results.
- [ ] Administrator and HeadCoach allowed paths pass; Coach and branch-scope violations remain denied.
- [ ] Active, expired, future, unpaid, `Term`, `SingleVisit` and `Professional` states are covered.
- [ ] Sequential future assignments pass and inclusive overlaps fail with stable ProblemDetails.
- [ ] Correction persists individual dates and immutable sale fields survive reload.
- [ ] Renewal persists sale/version/audit after reload and does not duplicate under retry.
- [ ] Unpaid correction then mark-payment keeps payment date/status/actor consistent in current state and history.
- [ ] Same-key replay and different-payload conflict are concurrency-safe.
- [ ] Failure injection proves transaction rollback across sale/version/audit/idempotency state.
- [ ] Real PostgreSQL clean-schema and constraint checks pass.
- [ ] Frontend shows backend ProblemDetails, keeps draft values and reloads the client after success.
- [ ] `dotnet test backend/GymCrm.slnx` passes.
- [ ] Frontend unit/component tests, `npm run lint` and `npm run build` pass.
- [ ] Focused Playwright membership write scenarios pass on desktop and mobile.
- [ ] Local `deploy/docker-compose.yml` stack passes purchase/renew/correct/mark-payment smoke checks.

## Regression barrier
TASK-078 is not complete unless one focused automated suite creates membership state through real HTTP/application flows on real PostgreSQL and proves, after fresh database scopes, the five symptom scenarios, inclusive overlap behavior, exact version/sale/audit cardinality, atomic rollback and idempotent replay/concurrency. This suite must run in addition to the fast InMemory tests. The frontend barrier must prove exact payload/header generation, preserved ProblemDetails, one request per submission and visible reloaded state. A response-only assertion, mocked persistence, InMemory-only suite or manual browser check does not satisfy the barrier.

## Risks
- **Runtime schema drift:** the deployed DB may not have the constraint/index represented by current code. Diagnose `__EFMigrationsHistory` first; do not compensate with unsafe data edits.
- **Ambiguous current target:** multiple future assignments make client-only correction/payment endpoints potentially ambiguous. If existing TASK-070 semantics cannot identify one target deterministically, require an explicit version/sale contract and UX review.
- **Transaction ownership:** service-local commits plus endpoint audit can produce failure-after-commit. Refactor narrowly around the membership mutation boundary.
- **Concurrent writes:** application pre-check alone cannot prevent overlap or duplicate renewal; retain PostgreSQL and unique-key barriers.
- **Payment attribution drift:** correction can accidentally replace payer/time while editing dates. Fix only according to explicit tests.
- **Idempotency scope:** replaying cached success for another actor/client/payload is a security and data-integrity bug. Include identity and payload in the key scope.
- **Schema expansion:** a generic idempotency subsystem could exceed TASK-078. Prefer a small membership-scoped record/policy or stop for decomposition.
- **Frontend masking:** showing only a generic error would preserve the original UX failure even after backend correctness is fixed.

## Stop conditions
Остановиться и не писать production-код, если:
- source task не переведена из `risky` и human review не разрешил execution;
- worktree dirty, текущая ветка неясна или task branch создана не от актуального `main`;
- невозможно воспроизвести и различить пять симптомов либо red failure вызван только test infrastructure;
- фактический runtime schema/data state требует массового production repair или irreversible migration;
- correction/mark-payment target при будущей очереди невозможно определить из утверждённых TASK-070 semantics без нового продуктового решения;
- исправление требует ослабить roles, permissions, branch scope или HeadCoach-only Professional boundary;
- idempotency требует system-wide redesign вместо локального membership solution;
- scope выходит за membership write paths, их audit/contract consumer и необходимые regression fixtures.

Не останавливаться только из-за одновременных backend/frontend изменений, PostgreSQL schema test, shared client card или payment metadata: они допустимы при локальном contract-first выполнении.

## Ready for Codex execution
no

Причина: detailed implementation plan и regression strategy готовы, но source task остаётся high-risk в `/backlog/risky` с `Safe for Codex: no`. Сначала обязательны явное human approval для перевода в implementation, создание task branch и reviewed red phase на real PostgreSQL. После этих gates план может исполняться test-first без изменения продуктовых правил TASK-070/TASK-077.
