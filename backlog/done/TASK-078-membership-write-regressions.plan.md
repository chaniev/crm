# Implementation Plan: TASK-078 Исправить ошибки сохранения операций с абонементом

## Source task
/backlog/done/TASK-078-membership-write-regressions.md

Source status is `done`: пользователь явно одобрил execution 2026-07-23; реализация и проверки завершены 2026-07-23. `Risk level: high` был ограничен test-first выполнением в отдельной ветке, real-PostgreSQL regression barrier и отсутствием production data repair.

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

## Approved product and contract decisions
Решения подтверждены human review 2026-07-23:

1. Correction и mark-payment адресуют именно тот абонемент, на карточке которого пользователь запустил действие. Frontend передаёт `saleId` и `expectedMembershipId` из этой карточки; backend не выбирает другой абонемент по сортировке.
2. `expectedMembershipId` является optimistic-concurrency token текущей открытой version указанной продажи. Если version уже закрыта или заменена, backend возвращает стабильный `409 membership-target-conflict` и не применяет действие к новой version автоматически.
3. Дата покупки `ClientMembershipSale.PurchaseDate` не меняется через correction. Correction принимает отдельные `validFrom`/`validTo` и изменяет только индивидуальный срок адресованного назначения в пределах существующих behavior rules.
4. Correction не меняет `IsPaid`, `PaidByUserId` или `PaidAt`. Неоплаченный абонемент отмечается оплаченным только отдельным mark-payment; обратный переход paid-to-unpaid не входит в TASK-078.
5. При действующем абонементе последовательный будущий абонемент оформляется через renewal. Direct purchase при действующем конфликтующем назначении отклоняется и не преобразуется в renewal.
6. Membership mutation, обязательный membership audit и idempotency completion сохраняются в одной transaction. Ошибка обязательного audit откатывает всю операцию.
7. Обычная validation возвращает `400`; overlap, stale target, повтор ключа с другим содержимым и незавершённая concurrent-операция возвращают отдельные стабильные `409 ProblemDetails`.
8. `Idempotency-Key` обязателен для purchase, renewal, correction и mark-payment. Ключ scoped by authenticated actor; его semantic payload включает client, action, target и нормализованный request. Completed replay заново проверяет доступ и перечитывает актуальное состояние, не создавая sale/version/audit.

## Current understanding
- Backend остаётся единственным владельцем lifecycle, пересечений периодов, статуса оплаты, версионирования, audit и ProblemDetails. Frontend должен только отправлять typed payload и отображать backend errors.
- Write endpoints находятся в `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs`; application contract — в `IClientMembershipService.cs`; persistence-операции — в `ClientMembershipService.cs`.
- Обычная покупка создаёт `ClientMembershipSale` и первую `ClientMembership` version. Renewal создаёт новую продажу и новое назначение. Correction и mark-payment закрывают текущую version через `ValidTo` и создают новую version той же продажи.
- Завершённая TASK-070 разрешает последовательные непересекающиеся будущие `Term`/конечные `Professional` назначения, запрещает пересечения, запрещает renewal для `SingleVisit` и открытого `Professional` и требует stable ProblemDetails для overlap. TASK-078 не должна менять эти правила.
- Завершённая TASK-077 сделала `ClientMembershipSale.GrossAmount` и `PricingMode` неизменяемыми для correction/mark-payment. TASK-078 не должна возвращать редактирование цены или каталожной идентичности.
- В модели уже объявлен `ClientMembershipMutationError.MembershipOverlap`, но текущий service flow его не возвращает; несколько lifecycle errors попадают в общий fallback `membership`/`MembershipChangeFailed`. Это вероятный источник неинформативных ошибок, который требуется подтвердить red tests до исправления.
- PostgreSQL защищает `Term`/`Professional` от пересечений GiST exclusion constraint и разрешает по одной открытой version на `SaleId`. Текущие membership HTTP tests используют EF InMemory и не исполняют эти ограничения. Поэтому green InMemory suite не доказывает работоспособность второго абонемента, renewal или correction на реальном runtime provider.
- `PurchaseAsync` проверяет активность на backend today, а PostgreSQL проверяет пересечение всего индивидуального периода. Между pre-check и DB constraint возможны различия и конкурентная гонка; constraint violation не должна превращаться в 500 или общую frontend error.
- `ExecuteMembershipActionAsync` пишет audit после возврата membership service. Purchase и version replacement могут к этому моменту уже зафиксировать свои transaction. Исправленный flow должен включить mutation, обязательный membership audit и idempotency completion в одну transaction; audit failure откатывает все membership writes.
- Backend service и endpoint projection выбирают одну запись под названием current membership разными сортировками. Correction/mark-payment больше не должны зависеть от этой сортировки: action с карточки передаёт `saleId` и `expectedMembershipId`, а stale version отклоняется стабильным conflict без перенаправления на другой абонемент. Read projection по-прежнему должна иметь одну backend-owned deterministic current/effective семантику.
- Текущий correction payload содержит `purchaseDate`, `expirationDate`, `isPaid`, а service использует `purchaseDate` одновременно как дату продажи и `IndividualValidFrom` новой version. Целевой correction contract заменяет это на явные `saleId`, `expectedMembershipId`, `validFrom`, `validTo`; `ClientMembershipSale.PurchaseDate` остаётся неизменной.
- Correction обязана дословно сохранять существующие `IsPaid`, `PaidByUserId` и `PaidAt`. Unpaid-to-paid выполняется только mark-payment адресованной version; paid-to-unpaid не поддерживается этой задачей.
- Web write endpoints не имеют membership-specific idempotency contract. В проекте уже используется `Idempotency-Key` с payload conflict semantics в других write flows; TASK-078 должна применить эквивалентный, но не bot-specific, barrier либо доказать другой concurrency-safe способ исключить дубли при повторной отправке.
- Frontend уже умеет разбирать `application/problem+json`, но верхний `handleMembershipAction` сохраняет только общий message, а дочерние формы отдельно раскладывают field errors. Tests должны доказать, что точный backend detail/field error остаётся видимым и draft формы не теряется.
- Значительное изменение UX не требуется: используются существующие purchase/renew/correction/mark-payment actions на конкретной карточке и confirmation modal. Технические target identifiers передаются из выбранной карточки скрыто; новый пользовательский selector продажи/version не добавляется.

## Reproduction record required before code
До написания production-кода создать в test/diagnostic notes таблицу для каждого из пяти симптомов:

| Case | Actor | Branch | Catalog behavior | Existing assignments | Requested dates/payment | HTTP status | ProblemDetails type/title/detail/errors | Persisted sales/versions/audits |
|---|---|---|---|---|---|---|---|---|
| allowed correction | Administrator и HeadCoach | exact branch | Term | paid и unpaid variants; exact card target | `saleId`, `expectedMembershipId`, `validFrom`, `validTo` | capture | capture | fresh DbContext counts and values |
| second membership | Administrator и HeadCoach | exact branch | Term plus SingleVisit/Professional controls | active, expired, future queue | direct purchase rejection plus sequential renewal | capture | capture | fresh DbContext counts and ranges |
| renewal | Administrator и HeadCoach | exact branch | finite Term; finite/open Professional; SingleVisit | current plus optional future renewal | exact payload | capture | capture | fresh DbContext counts and ranges |
| unpaid correction then payment | Administrator и HeadCoach | exact branch | Term | unpaid current/version history; exact card target | correction preserving unpaid, then addressed mark-payment | capture | capture | status/date/actor/audit/finance reload |
| term validity edit | Administrator и HeadCoach | exact branch | Term | explicit `IndividualValidFrom/To`; immutable sale purchase date | exact addressed edited range | capture | capture | response plus full reload |

Reproduction must use the same backend business date/time zone as the service and must record whether the failure occurs in request validation, application policy, EF SaveChanges, PostgreSQL constraint, audit write, response mapping or the follow-up GET.

## Contract and lifecycle decisions preserved
1. Purchase while an effective conflicting membership exists is rejected; it must not be silently converted into renewal.
2. A second assignment is allowed only when it is a valid sequential, non-overlapping lifecycle operation under TASK-070. Renewal appends after the last finite dated assignment, including an already planned future assignment.
3. Inclusive date ranges remain inclusive. Adjacent assignments use `next.ValidFrom = previous.ValidTo + 1 day`.
4. `SingleVisit` has no individual date range, cannot be renewed and blocks incompatible active assignment while unused.
5. Open-ended `Professional` cannot be renewed. Professional assignment remains HeadCoach-only.
6. Correction addresses the card-selected sale/version through `saleId` plus `expectedMembershipId` and may change only `validFrom`/`validTo` according to the existing behavior rules. It cannot change sale purchase date, catalog identity, pricing mode, gross amount, behavior or any payment field.
7. Mark-payment addresses the card-selected unpaid sale/version through `saleId` plus `expectedMembershipId`, sets payment actor/time once and cannot change the sale or validity period. Paid-to-unpaid is not supported.
8. Branch scope, `ManageClients`, HeadCoach-only Professional assignment and Coach denial remain unchanged.
9. `Idempotency-Key` is required for all four membership writes. Within the authenticated actor scope, a retry with the same key and semantically identical client/action/target/payload reauthorizes and reloads the completed result without new sale, version or audit rows. Reusing that key with different content returns `409 idempotency-conflict`; an identical request while the first is pending returns retriable `409 membership-operation-in-progress`.
10. Missing or malformed `Idempotency-Key` and ordinary field validation return `400`. Inclusive-period overlap returns `409 membership-overlap`; a missing client/target returns `404`; a target version that existed but is no longer current for the addressed sale returns `409 membership-target-conflict`.
11. Validation and conflict failures create no sale, membership version, payment change, audit entry or idempotency completion record. A failed transaction releases its pending idempotency reservation so a genuine retry can proceed.
12. Completed membership idempotency records are retained for seven days, matching the established project default, and store only the minimum mutation identity/state needed for replay; authorization and branch scope are never cached.

## Safe decomposition and review gates

### Slice A — Reproduction and PostgreSQL test harness
- No production behavior changes.
- Add a focused real-PostgreSQL fixture that starts from the repository schema/migrations and can inspect constraints and persisted rows after a fresh scope.
- Reproduce all five symptoms and record expected red failures.
- Human review gate: confirm the actual root causes and that no production-data repair is required.

### Slice B — Backend lifecycle, transaction and idempotency
- Add explicit addressed-target validation for correction/mark-payment and one backend-owned effective/current read-selection policy.
- Add stable ProblemDetails mapping, concurrency-safe overlap handling and one atomic write boundary including audit.
- Add membership-specific idempotency semantics using the project’s established `Idempotency-Key` behavior without coupling web membership writes to bot identity/storage.
- Human review gate: approve any schema/contract addition before editing the reproducible initial database state.

### Slice C — Frontend contract consumer
- Update typed requests and payloads only after backend contract tests are fixed.
- Pass `saleId` and `expectedMembershipId` from the exact card that launched correction/mark-payment; do not add a visible target selector.
- Correction sends only target plus validity fields. It displays purchase date as immutable context and does not send `purchaseDate` or `isPaid`.
- Generate one key per user submission, reuse it only for retry of that exact submission and disable accidental double-submit while pending.
- Preserve draft values and display backend detail plus field-level errors.

### Slice D — Cross-layer regression validation
- Run focused red/green suites, full backend tests, frontend lint/build/component tests and focused Playwright.
- Verify the local compose stack against PostgreSQL after clean database creation and, if relevant, upgrade from the immediately preceding schema.

If these slices are converted into independent backlog TASKs, each child must receive its own branch. Until then they are ordered phases of the single TASK-078 branch and must not be implemented independently in unrelated branches.

## Execution steps
1. Verify explicit execution approval, clean git status and create `fix/TASK-078-membership-write-regressions` from updated `main`.
2. Capture the five-case reproduction record with exact actor, branch, catalog item, date range, payment state, request JSON/header, HTTP response and before/after database counts.
3. Inspect the runtime schema and `__EFMigrationsHistory`; confirm whether the active database contains the current per-sale version index and filtered PostgreSQL overlap constraint. Do not mutate production data during diagnosis.
4. **Before functional code**, add unit tests for explicit target validation, shared read selection, inclusive-range, correction payment preservation, mark-payment transition, idempotency payload normalization and mutation-error-to-contract policies.
5. Run the new unit tests and record an expected red phase caused by missing/incorrect membership behavior, not test infrastructure or compile errors.
6. **Before functional code**, add real-PostgreSQL integration/API tests for all five symptoms, reload, atomicity, audit, retries, concurrency, role/branch scope and stable ProblemDetails.
7. Run the new PostgreSQL tests and record the expected red phase. At least one test must demonstrate the provider-specific failure/gap that existing EF InMemory tests cannot catch.
8. **Before functional code**, add frontend API/component tests for exact card target, immutable purchase date, correction validity-only payload, idempotency header, pending/double-click behavior, ProblemDetails rendering, form draft preservation, success close and mandatory reload.
9. **Before functional code**, add or extend Playwright coverage for purchase/second-membership rejection, allowed renewal, correction, unpaid-to-paid and term-date editing. First run must fail for the missing behavior.
10. Review the complete red evidence. If the five symptoms do not reduce to local membership write/consumer changes, stop and update this plan before production code.
11. Implement the minimum backend policy/contract changes needed to make the unit tests pass. Keep domain policy free of HTTP/EF concerns and transport mapping out of the domain.
12. Make the application write boundary atomic: mutation, version closing/creation, sale creation when applicable, idempotency completion and required audit entries commit together or roll back together.
13. Pre-validate known lifecycle conflicts and map them to stable field/code semantics; retain the PostgreSQL constraint as the concurrency barrier and translate its known violation without exposing database details.
14. Replace the conflated correction contract with addressed `saleId`/`expectedMembershipId` plus separate `validFrom`/`validTo`. Keep `ClientMembershipSale.PurchaseDate` and all payment fields unchanged, update all consumers together and never derive validity rules in frontend.
15. Implement idempotent replay/conflict behavior and optimistic/concurrent safety for purchase, renewal, correction and mark-payment. Release an unfinished reservation after rollback so a genuine retry can proceed.
16. Update frontend types/API calls/forms to the proven backend contract, add per-submission idempotency headers, keep controls pending during the request and render ProblemDetails without replacing it with a generic error.
17. Rerun the exact focused unit, PostgreSQL integration, frontend component and Playwright tests and obtain green without weakening assertions.
18. Run all required regression suites and validate the local compose stack from a clean PostgreSQL database.
19. Compare the final diff with TASK-078 scope; confirm no pricing-mode work from TASK-077, permission relaxation, historical data rewrite or card redesign was introduced.

## Preferred implementation strategy
- Contract-first and backend-first: encode existing TASK-070/TASK-077 lifecycle rules once, then adapt frontend.
- Use one focused policy/service for explicit target validation, effective/current read selection and interval conflict classification; do not duplicate these rules across endpoint projections and persistence service.
- Let application validation return understandable conflicts, but keep the PostgreSQL exclusion/unique constraints as the final concurrent-write barrier.
- Own the transaction at one application boundary. Nested or already-committed service transactions must not make audit failure observable as a failed HTTP response after data was saved.
- Reuse established `Idempotency-Key` and payload-hash semantics conceptually, but create membership-scoped records/keys so bot records, actor identifiers and web requests are not coupled.
- Scope idempotency by authenticated actor, retain completed records for seven days and store only the minimum result needed to replay/reload a completed mutation; never cache auth decisions or branch scope.
- Use `400` for malformed keys and field validation. Use stable `409` ProblemDetails codes `membership-overlap`, `membership-target-conflict`, `idempotency-conflict` and `membership-operation-in-progress` with field errors such as `membership`, `validFrom`, `validTo`, `expectedMembershipId`, `idempotencyKey` as appropriate. Do not expose PostgreSQL constraint names or exception text.
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
- Correction/mark-payment must act only on the `saleId`/`expectedMembershipId` from the card that launched the action; never fall back to another current/latest membership.
- Do not alter sale purchase date, price, pricing mode, catalog identity or behavior during correction/payment.
- Correction must preserve `IsPaid`, `PaidByUserId` and `PaidAt`; mark-payment is the only unpaid-to-paid transition in scope.
- Do not create duplicate sale, version, audit or completed idempotency rows under retry/double-click/concurrent requests.
- Do not return mutation failure after membership state committed without its mandatory audit, or audit success for a rolled-back mutation.
- Do not mutate or repair production data without a separate approved analysis and rollback plan.
- Keep early-stage database setup reproducible from a clean environment.
- Preserve frontend Mantine/Onest and the existing client-card structure.

## Out of scope
- TASK-077 pricing mode, manual amount and amount-only redesign.
- Allowing overlapping or multiple simultaneously effective memberships.
- Changing catalog CRUD, refunds, financial formulas or historical sale values.
- Editing `ClientMembershipSale.PurchaseDate` through correction.
- Changing payment state through correction or supporting paid-to-unpaid/reversal.
- Redesigning the client card or creating a new membership management screen.
- Mass repair of existing production rows.
- Authentication, global RBAC or branch model redesign.
- Bot membership write changes unless a shared backend contract change demonstrably affects the existing bot mark-payment consumer.

## Required test coverage

Unit and integration tests MUST be written or updated before functional code. The first focused run must fail because required behavior is absent or wrong; implementation starts only after this red phase is reviewed.

### Unit tests
- Inclusive interval policy: adjacent `Term` periods allowed; same-day and open-ended overlaps rejected.
- Effective/current/last-finite selection with active, expired and multiple sequential future assignments is deterministic.
- Purchase and renewal classification follows TASK-070. Correction and mark-payment accept only the addressed `saleId` plus open `expectedMembershipId`; stale version is conflict and never retargets.
- Correction keeps purchase date, catalog identity, behavior, pricing mode and gross amount immutable while validating independent `validFrom`/`validTo`.
- Correction preserves `IsPaid`, `PaidByUserId` and `PaidAt` byte-for-byte. Mark-payment performs unpaid-to-paid once; already-paid and paid-to-unpaid paths remain rejected.
- Idempotency normalization scopes by actor and hashes client/action/target/payload consistently; same key plus different content is conflict, pending identical request is retriable in-progress and completed identical request is replay.
- Known lifecycle, target and idempotency errors map to the approved `400`/`404`/`409` ProblemDetails codes/fields.

### Integration tests — real PostgreSQL mandatory
- Allowed addressed Term correction closes exactly the supplied `expectedMembershipId`, creates exactly one new current head for the supplied `saleId`, persists the edited individual validity range, preserves sale purchase date/payment attribution and reloads through GET.
- With an active Term, direct conflicting purchase is rejected without writes and a valid sequential future renewal persists a second sale/head without violating constraints; an overlap returns `409 membership-overlap`.
- Renewal appends after the last finite assignment, including a pre-existing future queue, and preserves exact inclusive duration required by the existing contract.
- `SingleVisit`, open-ended `Professional`, cross-branch catalog item and unauthorized actor remain rejected without writes.
- Unpaid Term can be corrected while remaining unpaid, then the returned current version can be addressed by mark-payment; fresh reads agree on `IsPaid`, `PaidAt`, `PaidByUserId`, history, audit and affected financial projection.
- Editing `validFrom`/`validTo` never changes or accepts caller control of sale purchase date. Correction requests containing legacy `purchaseDate` or `isPaid` are rejected as unknown immutable fields.
- Correction/mark-payment against another card, mismatched sale/version, or a replaced `expectedMembershipId` returns `404` or `409 membership-target-conflict` as approved and writes nothing.
- Same idempotency key plus same request, sequentially and concurrently, creates one logical mutation and one audit result. Same key plus changed payload returns conflict.
- Missing/malformed key returns `400`; pending identical request returns `409 membership-operation-in-progress`; different content returns `409 idempotency-conflict`; completed replay reauthorizes and reloads without new rows.
- Invalid replay and PostgreSQL constraint violation leave sale/version/audit/idempotency counts unchanged.
- Injected failure before commit and injected audit failure roll back all membership data. No endpoint may return failure after a committed partial mutation.
- Clean schema applies all migrations/initial state and exposes the expected per-sale current-version index plus filtered membership overlap constraint.
- Response and a new-DbContext reload select the same current/effective membership.

### Existing backend tests to update
- TASK-077 creation pricing tests continue proving immutable sale pricing for correction and mark-payment.
- Role tests continue proving Administrator/HeadCoach access and Coach denial.
- Audit tests assert one mandatory membership audit per successful logical operation, zero additional audit on replay, exact before/after state and absence of credentials/DB exception details. Correction no longer emits sale-date correction audit because the sale is immutable.
- Financial report tests only need extension if payment/correction currently changes report-visible state; no formula change is assumed.

### Frontend API/component tests
- Purchase, renewal, correction and mark-payment send exact backend-owned field names and one idempotency key per submission.
- A retry of the same pending/failed submission reuses the same key; a newly edited submission receives a new key.
- Double click while pending produces one HTTP call.
- Correction sends `saleId`, `expectedMembershipId`, `validFrom`, `validTo` from the exact card, shows purchase date as immutable context, never sends `purchaseDate`, `isPaid`, payer or price fields and preserves entered values on error.
- Mark-payment sends `saleId` and `expectedMembershipId` from the exact card plus the idempotency header and no caller-controlled payment/date/price fields.
- Backend ProblemDetails detail is shown, field errors bind to the relevant inputs and draft values remain intact.
- Successful write triggers a fresh `getClient`, displays reloaded values and only then closes the action panel.
- After correction returns a new current version, subsequent mark-payment uses that reloaded version id rather than the stale pre-correction id.

### UI/Playwright tests
- Desktop and 390 px mobile: action launched from one card changes only that card; allowed correction saves dates, leaves purchase date/payment unchanged and is visible after page reload.
- Valid sequential renewal succeeds; forbidden second/overlapping purchase shows the specific reason and keeps the form usable.
- Unpaid membership can be corrected and then marked paid, with the paid badge/history visible after reload.
- A stale card action shows a specific conflict and never changes a newer or different membership.
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
- [x] All five source symptoms have exact reproducible fixtures and expected results.
- [x] Administrator and HeadCoach allowed paths pass; Coach and branch-scope violations remain denied.
- [x] Active, expired, future, unpaid, `Term`, `SingleVisit` and `Professional` states are covered.
- [x] Sequential future assignments pass and inclusive overlaps fail with stable ProblemDetails.
- [x] Correction targets the selected card, persists individual dates, preserves payment fields and leaves purchase date/other immutable sale fields unchanged after reload.
- [x] Renewal persists sale/version/audit after reload and does not duplicate under retry.
- [x] Unpaid correction then mark-payment keeps payment date/status/actor consistent in current state and history.
- [x] Missing key, pending request, same-key replay, different-payload conflict and seven-day retention semantics are concurrency-safe.
- [x] Failure injection proves transaction rollback across sale/version/audit/idempotency state.
- [x] Real PostgreSQL clean-schema and constraint checks pass.
- [x] Frontend shows backend ProblemDetails, keeps draft values and reloads the client after success.
- [x] `dotnet test backend/GymCrm.slnx` passes.
- [x] Frontend unit/component tests, `npm run lint` and `npm run build` pass.
- [x] Focused Playwright membership write scenarios pass on desktop and mobile.
- [x] Local `deploy/docker-compose.yml` stack passes purchase/renew/correct/mark-payment smoke checks.

## Regression barrier
TASK-078 is not complete unless one focused automated suite creates membership state through real HTTP/application flows on real PostgreSQL and proves, after fresh database scopes, the five symptom scenarios, inclusive overlap behavior, exact version/sale/audit cardinality, atomic rollback and idempotent replay/concurrency. This suite must run in addition to the fast InMemory tests. The frontend barrier must prove exact payload/header generation, preserved ProblemDetails, one request per submission and visible reloaded state. A response-only assertion, mocked persistence, InMemory-only suite or manual browser check does not satisfy the barrier.

## Risks
- **Runtime schema drift:** the deployed DB may not have the constraint/index represented by current code. Diagnose `__EFMigrationsHistory` first; do not compensate with unsafe data edits.
- **Stale addressed target:** correction closes a version and changes the id needed by a later mark-payment. Frontend must reload and use the new card version; backend must reject stale identifiers without retargeting.
- **Transaction ownership:** service-local commits plus endpoint audit can produce failure-after-commit. Refactor narrowly around the membership mutation boundary.
- **Concurrent writes:** application pre-check alone cannot prevent overlap or duplicate renewal; retain PostgreSQL and unique-key barriers.
- **Payment attribution drift:** correction can accidentally replace payer/time while editing dates. Assert exact preservation; only mark-payment may create attribution.
- **Idempotency scope:** replaying cached success for another actor/client/payload is a security and data-integrity bug. Scope by actor, include client/action/target/payload in semantic content and reauthorize every replay.
- **Schema expansion:** a generic idempotency subsystem could exceed TASK-078. Prefer a small membership-scoped record/policy or stop for decomposition.
- **Frontend masking:** showing only a generic error would preserve the original UX failure even after backend correctness is fixed.

## Stop conditions
Остановиться и не писать production-код, если:
- source task не переведена из `risky` и human review не разрешил execution;
- worktree dirty, текущая ветка неясна или task branch создана не от актуального `main`;
- невозможно воспроизвести и различить пять симптомов либо red failure вызван только test infrastructure;
- фактический runtime schema/data state требует массового production repair или irreversible migration;
- существующий frontend не может передать `saleId`/`expectedMembershipId` с action выбранной карточки без видимого redesign или нового выбора пользователем;
- исправление требует ослабить roles, permissions, branch scope или HeadCoach-only Professional boundary;
- idempotency требует system-wide redesign вместо локального membership solution;
- scope выходит за membership write paths, их audit/contract consumer и необходимые regression fixtures.

Не останавливаться только из-за одновременных backend/frontend изменений, PostgreSQL schema test, shared client card или payment metadata: они допустимы при локальном contract-first выполнении.

## Ready for Codex execution
yes

Причина: product/contract decisions прошли human review 2026-07-23, пользователь явно одобрил execution, source task переведена в `/backlog/implementation`, а `fix/TASK-078-membership-write-regressions` создана от актуальной чистой `main`. Реализация выполняется test-first без изменения продуктовых правил TASK-070/TASK-077.
