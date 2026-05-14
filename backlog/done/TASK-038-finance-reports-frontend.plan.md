# Implementation Plan: TASK-038 Реализовать frontend вкладку Финансы и отчеты

## Source task
/backlog/done/TASK-038-finance-reports-frontend.md

## Implementation branch
feature/TASK-038-finance-reports-frontend

Branch rules:
- create this branch from an up-to-date `main` before writing product code;
- do not implement TASK-036, TASK-037 or other unrelated work in this branch;
- confirm the branch is active before changing frontend files;
- stop before code changes if the current worktree is dirty or the current branch is unclear.

## Goal
Главный тренер получает рабочую frontend-вкладку `Финансы` с отчетами первого релиза: быстрые периоды, произвольный диапазон, фильтры филиала и тренера, backend totals и backend breakdowns без локального пересчета финансовых формул.

## Current understanding
TASK-038 является frontend consumer task и должна выполняться после backend API из `TASK-037`. Backend владеет финансовыми формулами, sale/refund semantics, access behavior, validation semantics, ProblemDetails, branch attribution, trainer attribution и duplicated multi-group breakdown semantics.

В текущем frontend есть единый typed API слой в `frontend/src/lib/api/*`, routing/navigation в `frontend/src/lib/appRoutes.ts`, route rendering в `frontend/src/App.tsx`, shared UI primitives в `frontend/src/features/shared/ux.tsx`, e2e tests в `frontend/e2e/*`. Секция `Финансы` должна войти в эти существующие паттерны, а не добавлять отдельную навигационную систему.

Текущие session types используют `AppSection`, `allowedSections` и `AccessPermissions`. Реализация не должна выводить доступ по `user.role === 'HeadCoach'`; она должна потреблять backend access contract из `TASK-037`: `allowedSections` и, если backend добавит отдельный permission flag, typed `permissions`.

## Execution steps
1. Создать ветку `feature/TASK-038-finance-reports-frontend` от актуального `main` после `git checkout main`, `git pull` и clean status.
2. Перед кодом сверить фактический backend report contract из `TASK-037`: endpoint path, query params, response shape, section/access contract, ProblemDetails fields, branch/trainer filter support и duplicated breakdown row shape.
3. Согласовать significant UX shape с `ui-designer`: экран должен быть рабочим CRM-интерфейсом на Mantine/Onest, не landing page, с плотной сканируемой компоновкой и narrow-screen состояниями.
4. Расширить frontend contracts:
   - добавить `Finance` в `AppSection`, labels и section paths;
   - добавить finance permission только если он есть в backend session contract;
   - добавить typed DTO/request/response для report API;
   - добавить API endpoint/client function для загрузки отчета.
5. Добавить route/navigation:
   - включить `Finance` в main navigation;
   - показывать вкладку только через backend-driven access contract;
   - настроить redirect/forbidden flow по существующим frontend patterns для пользователей без доступа.
6. Реализовать `FinanceReportsScreen` как отдельную feature-секцию:
   - быстрые периоды месяц/квартал/год;
   - custom date range;
   - фильтр филиала: все филиалы или конкретный филиал;
   - фильтр тренера, если backend contract его поддерживает;
   - refresh/retry behavior по существующим UI-паттернам.
7. Отрисовать только backend response:
   - sold memberships count;
   - new clients count;
   - gross sales;
   - refund total;
   - net total;
   - group/trainer/branch breakdowns из response без дедупликации и без суммирования в canonical totals.
8. Добавить видимое пояснение рядом с group/trainer breakdowns: сумма строк может быть больше общего итога из-за дублирования одного финансового события по нескольким группам или тренерам.
9. Добавить loading, empty и error states:
   - empty state для нулевого отчета;
   - API error state с retry;
   - ProblemDetails/field errors для невалидных фильтров через существующий `ApiError`/`applyFieldErrors` pattern.
10. Обновить e2e/unit coverage:
    - navigation visibility for allowed user;
    - no tab or redirect/forbidden flow for disallowed roles;
    - report rendering from mocked backend payload;
    - duplicated breakdown rows rendered as-is;
    - canonical totals are not recomputed from breakdown rows;
    - ProblemDetails for invalid filters;
    - mobile/narrow layout smoke.
11. Run validation: `cd frontend && npm run lint`, `cd frontend && npm run build`, affected Playwright/e2e tests.

## Preferred implementation strategy
1. Contract-first frontend implementation after TASK-037 is stable.
2. Add typed API boundary before screen UI.
3. Add route/navigation access through backend session contract.
4. Build screen with backend-provided totals and passive breakdown display.
5. Add automated regression coverage before considering manual QA complete.
6. Keep frontend finance logic presentation-only: formatting, filter state and request serialization are allowed; financial formulas, attribution and refund filtering are not.

## Files likely to change
- frontend/src/lib/api/types.ts
- frontend/src/lib/api/endpoints.ts
- frontend/src/lib/api.ts
- frontend/src/lib/api/reports.ts
- frontend/src/lib/appRoutes.ts
- frontend/src/App.tsx
- frontend/src/App.css
- frontend/src/features/finance/FinanceReportsScreen.tsx
- frontend/src/features/finance/FinanceReportsScreen.test.tsx
- frontend/e2e/finance-reports.spec.ts
- frontend/e2e/home-dashboard.spec.ts
- frontend/e2e/responsive-main-screens.spec.ts

If TASK-037 exposes filter dictionaries from another endpoint, also update or add the corresponding API client file.

## Constraints
- Backend is the source of truth for gross sales, refund total, net total, sold count, new clients count, attribution and access.
- Do not calculate financial aggregates from memberships, sale contracts, `paymentAmount`, membership history or refund details.
- Do not locally exclude canceled refunds.
- Do not remove fully refunded sales from gross sales or sold membership count.
- Do not treat technical membership versions as additional sales.
- Do not deduplicate group/trainer breakdown rows.
- Do not require breakdown row sums to equal canonical totals.
- Do not add a local `Без группы` fallback.
- Do not infer finance access from `HeadCoach` role directly.
- Preserve Mantine and Onest.
- Screen must be a working CRM interface, not a landing page.

## Out of scope
- Backend report formulas.
- Backend permissions and ProblemDetails contract implementation.
- Refund registration/cancellation UI.
- Reading sale/refund history to build frontend aggregates.
- Bot consumer changes.
- Export XLS/PDF.
- Salary calculation, accounting reconciliation or payment provider logic.

## Required test coverage

### Unit tests
Add or update unit tests if implementation extracts helpers for:
- finance report request serialization;
- period filter state transitions;
- backend response mapping/normalization;
- money/count/date formatting;
- app route/access helpers for the new `Finance` section.

Unit tests must include a payload where canonical `netTotal` does not equal `grossSales - refundTotal` after frontend manipulation attempts; the UI/client should still expose the backend `netTotal` value without recomputing it.

### Integration tests
Frontend integration-level coverage should mock backend API responses and verify:
- the screen sends expected query params for quick periods and custom range according to the TASK-037 contract;
- branch and trainer filters are sent as backend contract values;
- ProblemDetails field errors are shown near the relevant filter controls;
- API 403/redirect behavior follows existing frontend access patterns.

No backend integration tests belong to this task unless TASK-037 contract changes during implementation; if it does, stop and update the backend task/contract first.

### UI tests
Add Playwright coverage for:
- `Финансы` tab is visible for a session where backend grants access;
- roles without finance access do not see the tab or are redirected/blocked according to current route patterns;
- month/quarter/year/custom range controls are usable;
- all branches and single branch filters are usable;
- trainer filter is usable if backend supports it;
- loading, empty, error and invalid filter states render;
- duplicated group/trainer rows are rendered separately;
- totals come from backend response and are not recomputed from breakdown row sums;
- narrow-screen layout has no horizontal scroll and keeps controls usable.

### Regression priority
This task touches financial display and access visibility. Automated e2e coverage for route visibility, backend-owned totals and duplicated breakdown rows is mandatory. Manual QA can supplement responsive review, but it is not enough as the main regression barrier.

### Minimum expectation
Implementation is incomplete until:
- typed report API exists;
- screen renders backend totals and breakdowns;
- finance access is backend-driven;
- duplicated rows explanation is visible near relevant breakdowns;
- lint/build pass;
- affected e2e tests cover the main finance route and no-access behavior.

## Test plan
- [ ] Run `cd frontend && npm run lint`.
- [ ] Run `cd frontend && npm run build`.
- [ ] Run affected Playwright test, preferably `cd frontend && npm run test:e2e -- finance-reports.spec.ts`.
- [ ] Check `HeadCoach` or backend-granted finance session sees `Финансы`.
- [ ] Check sessions without finance access do not see the tab or are redirected/blocked.
- [ ] Check quick month/quarter/year and custom range requests.
- [ ] Check all-branches and single-branch requests.
- [ ] Check trainer filter if supported by backend contract.
- [ ] Check empty report state.
- [ ] Check backend ProblemDetails for invalid filters.
- [ ] Check duplicated group/trainer breakdown rows are visible as distinct rows.
- [ ] Check canonical totals remain the backend totals even when mocked breakdown sums differ.
- [ ] Check sale, partial refund, full refund and canceled refund scenarios through mocked backend payloads.
- [ ] Check mobile/narrow-screen layout and no horizontal scroll.

## Regression barrier
The main regression barrier is a Playwright suite with mocked backend report payloads proving that navigation access is backend-driven, totals are displayed from the backend payload, duplicated breakdown rows are not deduplicated, and invalid filters surface backend ProblemDetails. `npm run lint` and `npm run build` are required before completion.

## Risks
- TASK-037 may still be unstable or missing required totals, filter names, access section or ProblemDetails shape.
- Existing `AppSection` and session typing may require backend/session contract updates before frontend can safely expose `Finance`.
- It is easy to accidentally derive access from `HeadCoach` or derive totals from breakdown rows; tests must block both.
- Date quick-period semantics can drift if frontend computes ranges differently from backend; prefer backend `periodPreset` contract when available.
- Duplicated breakdown rows can look like a bug to users unless the explanation is visible and close to the tables.
- Mobile filter controls may overflow if implemented as desktop-only dense toolbar.

## Stop conditions
Остановиться и не писать код, если:
- TASK-037 backend API is not implemented or its contract is not stable;
- backend response does not include sold membership count, new clients count, gross sales, refund total or net total;
- backend access contract does not expose a way to authorize the `Finance` section without frontend role inference;
- backend does not define ProblemDetails/field error shape for invalid report filters;
- trainer filter/breakdown requirements conflict with the actual TASK-037 response;
- implementation requires frontend to calculate financial formulas, attribution, canceled refund filtering or breakdown deduplication;
- scope expands into refund management, backend formulas, permissions redesign or export features.

Do not stop planning only because the task is financial or touches access. Stop only if the backend contract is unavailable or would force frontend-owned business semantics.

## Ready for Codex execution
no, for direct product-code execution until TASK-037 is complete, stable and reviewed.

yes, after TASK-037 exposes the required typed report/access contract and the executor creates `feature/TASK-038-finance-reports-frontend` from up-to-date `main`.
