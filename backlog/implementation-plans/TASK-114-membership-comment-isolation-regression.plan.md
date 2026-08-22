# Implementation Plan: TASK-114 Исправить изоляцию комментариев абонементов

## Metadata
- source_task: /backlog/risky/TASK-114-membership-comment-isolation-regression.md
- branch: fix/TASK-114-membership-comment-isolation-regression
- readiness: no — требуется human approval и reproducible red либо proven deployment/version skew
- dependencies: none
- risk: high — membership persistence/financial adjacency; current code may already be correct

## Goal
Администратор или главный тренер может хранить разные комментарии у двух
разных продаж абонемента одного клиента. Изменение, ошибка или повторная
загрузка одной продажи не меняет комментарий, автора, время и остальные данные
другой продажи, а все технические версии одной продажи продолжают разделять
один sale-level комментарий.

## Reproduction contract
До написания исправления зафиксировать один deterministic fixture:

1. Один client и две разные `ClientMembershipSale`: `sale-A` и `sale-B`.
2. У `sale-A` минимум две технические `ClientMembership` versions с одним
   `saleId`; у `sale-B` минимум одна version с другим `saleId`.
3. Начальные комментарии различны: `Комментарий A` и `Комментарий B`, с
   разными actor/time metadata.
4. Через карточку редактируется только `sale-A`, причём request path содержит
   `clientId + sale-A`, а payload содержит только `{ comment }`.
5. Проверки выполняются на immediate PUT response, отдельном GET после reload,
   новом `DbContext`, frontend mapped model и реально отрендеренных двух sale
   blocks.
6. После success у `sale-A` новый comment/actor/time, у `sale-B` прежняя
   тройка; обе versions `sale-A` показывают одну новую тройку.
7. После validation или forbidden response обе продажи и audit остаются в
   исходном состоянии; frontend сохраняет ошибку и draft только в target row.
8. До/после сравниваются membership version ids/count, sale ids, catalog,
   gross amount, purchase/payment/refund/validity/write-off fields и persisted
   attendance records.

Для исходной пользовательской среды дополнительно сохранить без PII:
- deployed frontend/backend image or commit identifiers;
- sanitized GET response membership history with version id -> saleId mapping;
- sanitized PUT URL/body/status/response;
- значения двух sales после reload;
- browser console/network evidence и роль пользователя.

Если визуально разные строки имеют одинаковый `saleId`, это технические версии
одной продажи и общий комментарий соответствует TASK-069. Такой случай не
считается воспроизведением TASK-114.

## Safe decomposition

### Slice A — Evidence and exact red test
- Воспроизвести проблему на current `origin/main` в local PostgreSQL stack с
  fixture из двух sales.
- Добавить exact automated scenario прежде production-кода.
- Определить первый слой, где `sale-B` получает данные `sale-A`: database,
  backend response, mapper, grouping/rendering или deployment boundary.

### Slice B — Backend isolation, only if backend red is proven
- Исправить только sale lookup/persistence/read projection/transaction boundary,
  доказанную failing PostgreSQL/API test.
- Сохранить endpoint, permission, validation, normalization, metadata and audit
  contracts TASK-069.
- Не менять membership lifecycle или financial schema без отдельного доказанного
  root cause и обновления плана.

### Slice C — Frontend identity/state, only if frontend red is proven
- Исправить только API mapper, sale grouping, React identity or row-local state,
  который воспроизводит подмену.
- Получать permission и membership identity из backend contract; не создавать
  client-level comment cache и не выводить технические identifiers.
- Сохранить текущую структуру карточки и Mantine/Onest; redesign не требуется.

### Slice D — Runtime/deployment reconciliation, if current main is green
- Не придумывать functional diff ради red/green ритуала.
- Сопоставить deployed commits/images, schema snapshot, response JSON and
  static frontend assets с current `origin/main`.
- Если проблема только в rollout/version skew, оформить безопасное deployment
  correction отдельно; TASK-114 закрывать только после end-to-end regression
  barrier на фактически развернутой версии.

## Likely files and layers
- Focused PostgreSQL/API regression tests and proven backend service/projection layer only.
- Frontend membership mapper, sale grouping/row state and focused tests only if frontend red is proven.
- One vertical Playwright/runtime evidence path; no schema or membership-lifecycle changes by default.

## Constraints
- Backend owns stable sale identity, permissions, validation, audit and
  membership semantics.
- One comment belongs to one `ClientMembershipSale`; all technical versions of
  that sale share it.
- Update lookup remains scoped by exact `clientId + saleId`; no fallback to
  current/latest membership or another sale is allowed.
- Preserve `ManageClients`, Administrator/HeadCoach access, Coach denial,
  normalized no-op, max 2000 characters, actor display name, server UTC time
  and safe audit payload without comment text.
- Preserve existing best-effort/mandatory audit semantics established by
  TASK-069; do not redesign audit transactions under this task without proven
  contract failure and revised approval.
- Validation/forbidden/not-found failures write neither target nor non-target
  comment and create no comment-change audit.
- No partial frontend replacement or optimistic update may make another sale
  display target data after a failed request.
- Do not change sale, catalog, price, payment, refund, validity, write-off,
  membership version or attendance semantics.
- Do not expose `saleId`, actor id/login, raw database errors or comment text in
  audit/technical logs.

## Out of scope
- Общая заметка клиента TASK-023/TASK-068.
- `professionalComment` and Professional membership policy.
- Independent comment per technical membership version.
- New membership/card information architecture or visual redesign.
- Pricing mode, amount, payment date/status, refunds, validity, overlap,
  purchase/renew/correct/write-off behavior.
- Authentication, RBAC, branch-scope or audit architecture redesign.
- Historical data repair or production mutation. If malformed historical
  identities are found, prepare a separate analysis and rollback-safe task.
- Deployment to production; version reconciliation may be diagnosed, but any
  rollout action requires its own authorized execution workflow.

## Regression specification

Unit and integration tests MUST be written or updated before functional code.
The first focused run must demonstrate the observed missing behavior. If the
exact scenario is already green, no production code is written until deployment
or reproduction evidence identifies a different failing contract.

### Unit tests
- `ClientMembershipCommentPolicy` keeps trim/whitespace/null, 2000-character
  boundary, set/change/clear and normalized no-op behavior.
- Frontend mapper preserves distinct non-empty `saleId` values, independent
  comment/metadata pairs and identical comment projection across versions of
  the same sale.
- Grouping produces exactly two sale groups from `sale-A/version-1`,
  `sale-A/version-2`, `sale-B/version-1`; ordering does not change identity.
- If grouping remains private inside the component, cover it through component
  behavior instead of exporting implementation detail only for testing.

### Backend integration tests — real PostgreSQL mandatory
- Seed two sales with different comments and metadata; update `sale-A`; PUT
  response and fresh GET show updated A and unchanged B.
- A new `DbContext` proves separate persisted `ClientMembershipSales` rows;
  both versions of A resolve A metadata and B resolves B metadata.
- Exactly one new audit event refers to `sale-A`, target client and safe
  transition; it contains neither A/B comment text nor financial snapshot.
- Actor/time changes only for A. B retains its original actor/time byte-for-byte.
- Whitespace/no-op on A changes neither sale and adds no audit.
- Validation, forbidden, unauthorized, missing sale and cross-client sale
  cases leave both sales and audit counts unchanged.
- Before/after snapshots keep membership ids/counts, sale ids, catalog link,
  gross amount, purchase/payment dates, refunds, validity, single-visit state
  and attendance records unchanged.
- Clean initial schema contains the sale comment columns/FK/length needed by the
  current model; schema check is verification, not permission for migration.

### Frontend API/component tests
- Update from the A block calls
  `/clients/{clientId}/membership/sales/{sale-A}/comment` once with only
  `{ comment }`; B is never used as target.
- Two forms have independent drafts. Editing/canceling/saving/error in A does
  not change B input, displayed comment or attribution.
- Successful response replaces data by exact sale identity: all A versions
  show new value, B remains old, and one block per sale remains rendered.
- Rerender/refetch with a fresh server snapshot preserves the same isolation.
- Validation and forbidden ProblemDetails stay visible in A; B stays enabled
  and unchanged. Generic global error must not replace the row-local message.
- React keys remain stable under history reorder and insertion of a newer
  technical version; drafts never move from A to B.
- Coach still sees no comment blocks or metadata.

### Playwright / end-to-end
- Administrator and HeadCoach: open client with two sales, edit A, verify B,
  reload, verify both again and confirm A attribution only.
- One sale with two versions renders one comment block; the second sale renders
  a separate block.
- Failure response for A keeps A server value and B value, exposes row-local
  recovery and allows retry.
- Capture the actual request URL/body and GET/PUT response sale identities.
- Run at least desktop Chromium and one mobile WebKit target. If production UI
  code changes, also validate `390 x 844`, `420 x 912`, `440 x 956` and compact
  height `912 x 420`/`956 x 440` for reachability and no horizontal overflow.

### Existing tests to retain/update
- `ClientMembershipCommentPolicyTests`
- `ClientsApiTests.Membership_comment_enforces_sale_identity_permissions_metadata_and_safe_audit`
- `ClientsApiTests.Membership_comment_partial_or_unresolved_metadata_returns_null_pair`
- `mappers.membership-comment.test.ts`
- `clients.test.ts` update-comment contract
- `ClientManagement.test.tsx` membership sale comments
- `stage12.spec.ts` membership comment scenarios

### Manual validation only
- Reproduce the original report on an isolated local copy/fixture and compare
  deployed vs current commit/image identifiers.
- Inspect browser/network evidence and sanitized database rows.
- Verify Russian row-local error copy and attribution readability.

Manual QA supplements but does not replace PostgreSQL/API/component/end-to-end
coverage.

## Initial red-phase verification
- Backend focused run must fail on isolation, reload, metadata, audit or
  no-partial-write assertion caused by product behavior.
- Frontend focused run must fail on wrong sale target, mapped identity, React
  state reuse, non-target mutation or non-row-local error.
- Playwright red must reproduce the user-visible cross-sale substitution.
- Infrastructure/auth/fixture/compile failures must be fixed before evaluating
  red behavior.
- If all exact tests pass on current `origin/main`, record them as green
  diagnostic evidence, do not manufacture a red test, and stop production
  implementation pending version/deployment reconciliation.

Suggested focused commands after tests exist:

```text
MSBUILDDISABLENODEREUSE=1 dotnet test backend/tests/GymCrm.Tests/GymCrm.Tests.csproj -m:1 --no-restore --filter "FullyQualifiedName~ClientMembershipCommentIsolationRegressionTests|FullyQualifiedName~ClientMembershipCommentPolicyTests|FullyQualifiedName~Membership_comment"
cd frontend && npm run test:unit -- src/lib/api/mappers.membership-comment.test.ts src/lib/api/clients.test.ts src/features/clients/ClientManagement.test.tsx
cd frontend && npm run test:e2e -- membership-comment-isolation.spec.ts --project=chromium
```

For browser validation, run the focused membership-comment spec. Use the actual
focused filename if the existing `stage12.spec.ts` is extended instead of
creating a new file.

### Validation and acceptance
- [ ] Fixture contains one client, two distinct sales and two versions of A.
- [ ] Distinct A/B comments and complete attribution survive initial GET.
- [ ] Updating A changes only A in PUT response, PostgreSQL reload and GET.
- [ ] Every A version shares the updated sale-level comment.
- [ ] B comment/actor/time remain byte-for-byte unchanged.
- [ ] Validation, forbidden, unauthorized and not-found paths write nothing.
- [ ] Audit contains one safe A event and no comment text.
- [ ] Financial, payment, refund, validity, write-off, version and attendance
  snapshots remain unchanged.
- [ ] Mapper/grouping/React keys preserve distinct sale identity under reorder.
- [ ] Two drafts, success, cancel, error and retry remain row-local.
- [ ] Page reload retains A/B isolation.
- [ ] Administrator/HeadCoach allowed and Coach denied contracts remain intact.
- [ ] Focused red evidence is recorded before production code, or a documented
  green-on-main stop redirects work to deployment/version reconciliation.
- [ ] Full backend and frontend regression suites pass.

## Regression barrier
The release barrier is one automated vertical scenario using a real PostgreSQL
database and the actual HTTP contract, combined with frontend component and
browser assertions:

```text
two distinct saleId values
-> distinct persisted comments/metadata
-> update sale-A by clientId + saleId
-> unchanged sale-B and immutable membership/financial state
-> fresh GET/new DbContext
-> mapper/grouping renders two independent row-local comment blocks
-> page reload preserves both values
```

The task is not complete if only an InMemory backend test or mocked Playwright
test is green. The vertical PostgreSQL/API isolation test is the primary
production regression barrier; component/Playwright tests protect mapping,
React identity and row-local recovery.

## Risks
- Current `main` already appears to implement the intended sale-local contract;
  speculative edits could reintroduce a regression or broaden membership scope.
- User-visible rows may be technical versions sharing one valid `saleId`; a
  misleading fixture could encode a new per-version feature contrary to TASK-069.
- InMemory and mocked frontend tests can pass while deployed PostgreSQL/API or
  version skew remains broken.
- A global client snapshot replacement can hide row-local errors or move draft
  state if React identity is not stable during reorder.
- Touching membership service or sale persistence risks adjacent financial,
  validity, refund, payment and audit behavior.
- Changing endpoint/DTO identity would affect all consumers and requires a
  separate contract review; it is not expected for this regression.
- Production data repair or rollout may be required if code is already correct;
  neither is authorized by this plan.

## Stop conditions
Остановиться и не писать/не продолжать production code, если:
- два визуально разных элемента имеют одинаковый `saleId` и являются versions
  одной sale — уточнить product expectation вместо изменения contract;
- exact current-main PostgreSQL/API/frontend scenario полностью green, а
  failing deployment/version evidence отсутствует;
- root cause требует historical production data mutation, schema rewrite,
  authentication/RBAC/audit redesign or system-wide membership refactor;
- требуется изменить sale/payment/refund/validity/write-off/attendance
  semantics;
- contract перестаёт однозначно определять `clientId + saleId` target;
- scope выходит за TASK-114 или появляется необратимая production операция;

Не останавливаться только потому, что regression затрагивает backend и frontend:
локализованный cross-layer fix допустим после доказанного red scenario.
