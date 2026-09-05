# Implementation Plan: TASK-061 Исправить дату окончания абонемента при оформлении

## Source task
/backlog/done/2026-06-29/TASK-061-membership-validity-end-date.md

Source task remains in `/backlog/risky` until explicit risky-task implementation review/selection.

## Implementation branch
fix/TASK-061-membership-validity-end-date

Branch rules:
- create this branch from `main` before writing code;
- before branch creation, run `git status`, switch to `main`, pull latest changes, and verify the worktree is clean;
- do not implement other unrelated TASKs in this branch;
- confirm the branch is active before making project code changes.

## Goal
При оформлении месячного абонемента пользователь видит и сохраняет включительный период действия: старт `2026-06-10` дает дату окончания `2026-07-09`, а не `2026-07-10`. Backend остается источником membership semantics, frontend показывает согласованную подсказку и не сохраняет значение, расходящееся с backend-правилом.

## Current understanding
- Backend сейчас рассчитывает срок в `backend/src/GymCrm.Infrastructure/Clients/ClientMembershipService.cs`:
  - `ResolvePurchaseExpirationDate`: `Monthly => purchaseDate.AddMonths(1)`, `Yearly => purchaseDate.AddYears(1)`;
  - `ResolveCorrectionExpirationDate`: тот же default, если дата окончания не передана;
  - `ResolveRenewalExpirationDateAsync`: default строится от `calculationBaseDate.AddMonths(1)` / `AddYears(1)`.
- Backend validation в `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs` проверяет формат и обязательные поля; service guard отклоняет дату окончания раньше даты покупки/продления, но не фиксирует inclusive-end default как отдельную доменную функцию.
- Frontend форма в `frontend/src/features/clients/ClientManagement.tsx` подставляет дату через `suggestPurchaseExpirationDate`, `suggestRenewalExpirationDate`, `addMonthsToDateValue`, `addYearsToDateValue`; месячный старт `2026-06-10` сейчас дает `2026-07-10`.
- `purchaseClientMembership`, `correctClientMembership`, `renewClientMembership` в `frontend/src/lib/api/clients.ts` отправляют `ExpirationDate`, поэтому одной визуальной правки недостаточно: сохраненное значение должно совпадать с отображаемым.
- Уже есть backend-owned membership attention state после TASK-060; эту задачу не нужно смешивать с home attention/list filters.
- Текущая дата окончания трактуется как последний активный день: `ClientMembershipSemantics.HasActivePaidMembership` считает абонемент истекшим только когда `ExpirationDate < referenceDate`.

## Product decisions to preserve
- Inclusive end date is the persisted `ExpirationDate`, not only display text.
- For fixed-duration memberships, default end date is the day before the same calendar day of the next period:
  - monthly: `periodStart.AddMonths(1).AddDays(-1)`;
  - yearly: `periodStart.AddYears(1).AddDays(-1)`.
- `SingleVisit` keeps its current optional expiration behavior.
- Manual expiration override in the form remains possible unless product explicitly removes it; backend should still guard contradictory ranges.
- Existing current/expired/unpaid status semantics continue to use `ExpirationDate` as an inclusive last active day.

## Execution steps
1. Prepare branch `fix/TASK-061-membership-validity-end-date` from latest clean `main`.
2. Reread `AGENTS.md`, `backend/AGENTS.md`, `frontend/AGENTS.md`, and this plan before code changes.
3. Add or extract a backend-owned expiration helper in `backend/src/GymCrm.Application/Clients` or a nearby membership semantics module:
   - provide one named function for fixed-duration inclusive end calculation;
   - support `Monthly`, `Yearly`, and `SingleVisit` explicitly;
   - keep date-only arithmetic deterministic and free of time zone conversion.
4. Replace inline backend defaults in `ClientMembershipService`:
   - `ResolvePurchaseExpirationDate` uses the helper for `Monthly` and `Yearly`;
   - `ResolveCorrectionExpirationDate` uses the helper only when `requestedExpirationDate` is absent;
   - renewal is handled deliberately: if extending from an existing inclusive `ExpirationDate`, the next period start is `currentExpirationDate.AddDays(1)` before applying the helper; if renewal falls back to `renewalDate`, use `renewalDate` as period start.
5. Keep validation semantics bounded:
   - retain invalid request guards for date before purchase/renewal;
   - if a new helper exposes expected defaults, do not reject valid manual overrides unless the existing architecture already treats them as contradictory;
   - ensure ProblemDetails/validation field names stay stable (`expirationDate`, `purchaseDate`, `renewalDate`).
6. Update backend regression tests in `backend/tests/GymCrm.Tests/ClientsApiTests.cs`:
   - purchase monthly with `PurchaseDate = 2026-06-10` and omitted `ExpirationDate` persists/returns `2026-07-09`;
   - purchase yearly with a fixed date persists/returns `start.AddYears(1).AddDays(-1)`;
   - correction default uses inclusive end only when expiration is omitted;
   - manual correction expiration remains respected if the current behavior allows it;
   - renewal from an existing inclusive monthly expiration extends to the next inclusive end without losing or duplicating a day;
   - expired/active checks still treat expiration date itself as active.
7. Update frontend expiration suggestion code:
   - move date-suggestion helpers out of `ClientManagement.tsx` if needed for focused tests, for example to `frontend/src/features/clients/membershipExpiration.ts`;
   - make purchase/correction suggestion match backend inclusive helper;
   - make renewal suggestion mirror backend renewal semantics: extend from `currentMembership.expirationDate + 1 day` when present, otherwise from selected renewal date;
   - keep `SingleVisit` suggestion empty.
8. Update frontend unit tests:
   - add focused tests for monthly `2026-06-10 -> 2026-07-09`;
   - add edge cases around month end, for example `2026-01-31` and leap-year/non-leap-year yearly dates, matching .NET `DateOnly.AddMonths/AddYears` behavior followed by `AddDays(-1)`;
   - cover renewal from existing inclusive expiration and fallback renewal date;
   - if a component-level test is added, assert that the date input and submitted payload both contain the inclusive date.
9. Update API/client tests or e2e only if implementation changes the request contract. If the frontend still sends `ExpirationDate`, no broad API contract migration is required.
10. Run validation and fix regressions.
11. Do a final source search for old default formulas (`AddMonths(1)`, `AddYears(1)`, `addMonthsToDateValue(..., 1)`, `addYearsToDateValue(..., 1)`) and classify each remaining hit as either intentionally unrelated or updated to inclusive semantics.

## Preferred implementation strategy
1. Backend first: encode inclusive period semantics in one backend helper and update service-level persistence paths.
2. Regression-first for the bug: add backend test proving `2026-06-10 -> 2026-07-09` before or together with the service change.
3. Frontend as contract consumer: update the visible suggestion to match backend and keep it covered by focused tests.
4. Renewal carefully: avoid a one-day gap or one-day overlap when current `ExpirationDate` is already inclusive.
5. Small, localized edits: do not fold this into membership attention, filtering, payment, refund, bot, or attendance redesign.

## Files likely to change
- `backend/src/GymCrm.Application/Clients/ClientMembershipSemantics.cs` or a new nearby helper file such as `ClientMembershipExpirationCalculator.cs`
- `backend/src/GymCrm.Infrastructure/Clients/ClientMembershipService.cs`
- `backend/tests/GymCrm.Tests/ClientsApiTests.cs`
- `frontend/src/features/clients/ClientManagement.tsx`
- optionally `frontend/src/features/clients/membershipExpiration.ts`
- optionally `frontend/src/features/clients/membershipExpiration.test.ts`
- optionally `frontend/src/features/clients/ClientManagement.test.tsx` if component-level coverage is added

If exact additional consumers are unclear, discover them before editing with:
`rg "AddMonths\\(1\\)|AddYears\\(1\\)|addMonthsToDateValue|addYearsToDateValue|suggestPurchaseExpirationDate|suggestRenewalExpirationDate|ExpirationDate" backend frontend`.

## Constraints
- Backend owns membership state, validation semantics, attendance implications, audit semantics, and API contracts.
- Do not fix only formatted text while persisting the old date.
- Do not move the source task out of `/backlog/risky` during implementation unless explicitly instructed.
- Do not change pricing, payments, refunds, roles/permissions, or attendance write-off rules except where tests must prove existing behavior still works with the corrected date.
- Do not mass-update existing memberships without a separate task and explicit data decision.
- Do not introduce time-zone based date arithmetic for `DateOnly`/`yyyy-MM-dd` values.
- If a backend request/response contract changes, update all frontend consumers and mocks in the same branch.

## Out of scope
- Recalculating historical memberships.
- Changing membership types or durations beyond current `Monthly`, `Yearly`, `SingleVisit`.
- Redesigning the whole membership UI.
- Changing membership attention/home dashboard behavior.
- Bot list/payment flows unless a shared backend contract change affects them.
- Schema migrations unless implementation unexpectedly requires persisted duration metadata.

## Required test coverage

### Unit tests
- Backend unit tests for the expiration helper if it is extracted into `Application`.
- Frontend unit tests for the extracted suggestion helper, including:
  - monthly `2026-06-10 -> 2026-07-09`;
  - yearly inclusive end;
  - month-end behavior matching .NET;
  - renewal from existing inclusive expiration;
  - `SingleVisit` empty expiration.

### Integration tests
- Backend API/service integration tests in `ClientsApiTests` for persisted and returned `ExpirationDate` on purchase, correction default, and renewal default.
- Existing membership state/attendance tests should remain green, proving expiration date itself is still active and the next day is expired.

### UI tests
- Add a component test for the membership edit panel only if helpers are not exported or if submit payload coverage is otherwise missing.
- E2E is optional for this bug if focused unit/backend integration tests cover visible default and persisted value; run affected e2e manually only if the implementation changes route/API behavior.

### Manual-only checks
- Manually open a client card and start a new monthly membership with date `2026-06-10`; verify the form shows `2026-07-09`.
- Submit it and verify the current membership/history show `09.07.2026`.
- Repeat around a month-end date if the UI allows it.

## Test plan
- [ ] Run `dotnet test backend/GymCrm.slnx`.
- [ ] Run `cd frontend && npm run lint`.
- [ ] Run `cd frontend && npm run build`.
- [ ] Run `cd frontend && npm run test:unit` or a focused Vitest command covering the new membership expiration helper/component tests.
- [ ] Manually verify purchase date `2026-06-10` with monthly membership shows and saves `2026-07-09`.
- [ ] Manually verify a month-end start date does not produce a nonsensical or shifted date.

## Regression barrier
No implementation is complete without automated checks proving:
- backend purchase default persists `2026-06-10 -> 2026-07-09`;
- backend correction and renewal defaults follow the same inclusive end-date semantics without breaking manual overrides;
- frontend visible suggestion uses the same inclusive date as backend persistence;
- expiration date remains inclusive for active/expired checks;
- old exclusive-looking formulas are either removed from membership default calculation or justified as unrelated.

## Risks
- Off-by-one risk: changing purchase but not renewal can create gaps/overlaps after the first renewal.
- Month-end risk: `AddMonths`/JavaScript `Date.setMonth` can diverge around dates like January 31 unless frontend tests pin the expected .NET-compatible behavior.
- Contract drift risk: frontend can appear fixed while backend still persists the old date if service defaults are not changed.
- Manual override risk: over-strict validation could block legitimate admin corrections.
- Reporting/status risk: shorter expiration by one day can change when memberships appear expired/expiring; existing semantics tests must catch unintended status regressions.
- Existing data risk: historical memberships will keep old dates unless a separate migration/backfill task is approved.

## Stop conditions
Остановиться и не писать код, если:
- implementation would require recalculating or migrating existing production membership dates;
- product decision changes from inclusive `ExpirationDate` to exclusive end boundary;
- frontend cannot show a correct default without introducing a new backend contract and the contract scope becomes unclear;
- renewal semantics cannot be made unambiguous without deciding whether the next period starts on `currentExpirationDate` or `currentExpirationDate + 1 day`;
- changes start affecting roles/permissions, payment/refund flows, or attendance write-off rules beyond regression verification;
- required API contract changes would affect bot/runtime consumers without a clear compatibility path.

Do not stop only because both backend and frontend must change.

## Ready for Codex execution
yes, after explicit risky-task implementation approval.

Reason: scope is high-risk but localized; no clarification questions are open; branch, files, tests, regression barrier, and stop conditions are defined.
