# Implementation Plan: TASK-128 Выделить membership UI из ClientManagement

## Metadata
- source_task: /backlog/done/TASK-128-client-membership-ui-decomposition.md
- branch: refactor/TASK-128-client-membership-ui-decomposition
- readiness: done — human review approved 2026-08-23; implemented and locally validated
- dependencies: TASK-127 — должна быть интегрирована, а location opaque membership subtree подтверждён
- risk: high — UI управляет money/membership mutations, confirmation and retry identity

## Goal
Membership snapshot/history/comment/financial presentation and purchase/renew/
correct/payment/refund operations имеют focused typed modules не более 500
строк при неизменном пользовательском and backend contract.

## Decisions and contracts
- Создать client-local membership feature; общий barrel не более 150 строк и
  не экспортирует frontend domain service.
- Detail screen остаётся owner актуального `ClientDetails` snapshot and refresh/
  replacement callback. Каждый operation panel владеет только своей form,
  confirmation, pending/error and submit lifecycle.
- Exact API request bodies, sale/membership/refund identity and backend
  ProblemDetails field keys остаются единственным contract; permissions,
  prices and validity не вычисляются во frontend.
- Idempotency key создаётся текущим confirmed-submit boundary, не меняется
  внутри pending request and follows characterized retry lifecycle. Double-click
  never produces a second request/key.
- History grouping remains sale-based; comment/refund/payment attribution and
  deterministic history order must not depend on React array position.

## Scope
### In
- Membership snapshot/history/financial/comment presentation; purchase, renew,
  correction, confirmation, payment tombstone and refund/cancel surfaces; formatting/form helpers.

### Out
- Any workflow, API/DTO/backend/pricing/target/permission change, profile redesign or universal dynamic form.

## Implementation slices
1. Extend component/API/browser characterization for payloads, idempotency,
   confirmation, errors, attribution and history identity.
2. Extract read-only snapshot/history/comment/financial modules and pure formatting helpers.
3. Extract purchase/renew/correct forms by independent state/submit ownership.
4. Extract confirmation/refund/payment surfaces, wire barrel into detail screen
   and remove only transferred membership code from TASK-127 output.

## Likely files and layers
- TASK-127 output containing the opaque membership subtree — source to be discovered before editing.
- `frontend/src/features/clients/membership/index.ts` — bounded public exports.
- `frontend/src/features/clients/membership/ClientMembershipSection.tsx` and `MembershipHistory.tsx`.
- `frontend/src/features/clients/membership/PurchasePanel.tsx`, `RenewPanel.tsx`, `CorrectionPanel.tsx`.
- `frontend/src/features/clients/membership/MembershipConfirmation.tsx`, `RefundActions.tsx`, `MembershipSaleComment.tsx`.
- `frontend/src/features/clients/membership/membershipForms.ts` and `membershipFormatting.ts` for pure local helpers.
- `frontend/src/features/clients/ClientManagement.test.tsx`, `frontend/src/lib/api/clients.test.ts`.
- `frontend/e2e/membership-sale-pricing.spec.ts` and existing membership/comment browser scenarios.

## Regression specification
### Automated tests to add or update
- Purchase/renew/correct assert exact API body, addressed ids, business/payment
  dates and backend field-error placement with draft preservation.
- Confirm/cancel/double-click/retry cases assert one pending request and one
  idempotency key per characterized operation lifecycle.
- Refund/cancel/comment/payment tombstone assert exact target and preserve
  non-target sale data, attribution and history order across refresh/reorder.
- Permission-restricted users see no actions; backend 400/403/409 and network
  failure preserve current recovery and no optimistic cross-sale mutation.
- Browser flows cover success/failure/reload at target portrait and compact landscape sizes.

### Expected red evidence
- Behavior tests should be green before the move and remain green. Structural
  red is not a product requirement; baseline evidence is the unsplit membership
  subtree and mixed operation state in the TASK-127 output. Do not invent a
  changed workflow merely to obtain red.

### Required validation
- Focused unit run for membership sections/forms plus `clients.test.ts` payload contracts.
- Affected membership Playwright specs on Chromium and target-iPhone WebKit.
- Verify every membership module `<= 500` and barrel `<= 150` lines.

### Manual evidence
- Compare confirmation/action order and error recovery with baseline; report
  physical Safari/software-keyboard checks not performed.

### Regression barrier
- One browser sequence purchase → reload → correct → comment → refund/cancel,
  with intercepted exact payload/idempotency assertions and component tests for
  row-local failure/retry and stable sale identity.

## Completion notes
- Completed at: 2026-08-23.
- Entry boundary preserved:
  `ClientDetailScreen -> ClientMembershipSection -> handleMembershipAction -> frontend API client`.
- Public frontend import moved to the one-export `./membership` barrel; the
  unchanged transfer/membership submit-key helper remains neutral and no
  backend/API DTO, pricing, permission or workflow contract changed.
- Added/strengthened regressions for confirm/cancel, purchase/renew/correct
  exact retry identity and payloads, duplicate pending guard, ProblemDetails
  draft recovery, deterministic sale/version ordering and restricted roles.
- Validation: lint, typecheck, raw-color scanner, `528/528` unit tests, build,
  Chromium membership `15/15` and target-iPhone WebKit membership `24/24`
  passed. Full WebKit spec was `27/30`; only unrelated transfer-modal bottom
  navigation interception cases failed.

## Risks and stop conditions
- Остановиться, если TASK-127 moved or changed membership behavior beyond the
  declared opaque relocation; reconcile dependency before editing.
- Остановиться при any API payload, backend validation/permission or visible
  confirmation workflow change; it needs a separate contract/UX decision.
- Do not create a generic form engine or client-wide idempotency cache.
