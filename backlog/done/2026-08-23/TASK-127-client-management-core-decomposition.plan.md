# Implementation Plan: TASK-127 Разделить core client screens и form components

## Metadata
- source_task: /backlog/done/2026-08-23/TASK-127-client-management-core-decomposition.md
- branch: refactor/TASK-127-client-management-core-decomposition
- readiness: yes
- dependencies: TASK-126 — должна быть интегрирована до начала исполнения
- risk: medium — client mutations, stale-response guards and return context can regress during component moves

## Goal
Create, edit and detail routes plus form/photo/attendance/transfer sections have
focused state owners, while the compatibility entry file is at most 250 lines
and public behavior/exports remain unchanged.

## Decisions and contracts
- Preserve current `ClientCreateScreen`, `ClientEditScreen` and
  `ClientDetailScreen` exports through `ClientManagement.tsx` compatibility barrel.
- Screen modules own only route load/submit/pending/error orchestration; form,
  photo, attendance and transfer keep local state and explicit typed callbacks.
- Existing membership subtree may move mechanically with `ClientDetailScreen`
  only as an opaque unchanged region needed to reach the barrel target. It is
  not split, generalized or behaviorally edited until TASK-128; record its new
  location for that dependency.
- Reuse current `ClientManagement.form.ts`, birth-date and return-state helpers;
  do not duplicate backend validation, permissions or API error mapping.
- Preserve visible hierarchy/actions, loading/empty/error/disabled/restricted
  states, focus and list/group/attendance return context.

## Scope
### In
- Three route screens, client form/overview, transfer, photo and attendance history boundaries.

### Out
- Membership UI decomposition, API/routes/validation/permissions, redesign,
  global client store or generic form framework.

## Implementation slices
1. Expand component characterization for create/edit/detail state, mutations,
   stale responses, API errors and return/focus behavior.
2. Extract create/edit screens and shared form/overview boundaries.
3. Extract detail shell, photo, attendance and transfer with their local async state.
4. Convert root to compatibility barrel; move membership subtree only as an
   unchanged opaque dependency and document handoff to TASK-128.

## Likely files and layers
- `frontend/src/features/clients/ClientManagement.tsx` — compatibility exports only.
- `frontend/src/features/clients/ClientCreateScreen.tsx`, `ClientEditScreen.tsx`, `ClientDetailScreen.tsx`.
- `frontend/src/features/clients/ClientForm.tsx` and existing `ClientManagement.form.ts`.
- `frontend/src/features/clients/ClientOverviewSection.tsx`, `ClientPhotoSection.tsx`, `ClientAttendanceHistorySection.tsx`, `ClientTransferModal.tsx`.
- `frontend/src/features/clients/ClientManagement.test.tsx` plus focused component test files where ownership moves.
- `frontend/e2e/client-profile-context-navigation.spec.ts` and affected client mobile specs.

## Regression specification
### Automated tests to add or update
- Create/edit submit exact payload once, preserve draft/field ProblemDetails on
  failure, prevent stale load overwrite and recover on retry.
- Detail preserves loading/not-found/forbidden/stale states and existing operations.
- Photo validation/upload/remove and attendance pagination/error recovery remain section-local.
- Transfer allowed/forbidden, confirmation, failure/retry and returned client snapshot stay exact.
- App integration retains public exports and all list/group/attendance return/focus paths.
- Component/browser viewport cases include long names, pending actions and no horizontal overflow.

### Expected red evidence
- Baseline characterization should be green; no behavior red is expected for a
  structural extraction. Structural evidence is the 3434-line current file,
  mixed screen/section ownership and absent module boundaries.

### Required validation
- Focused unit run for client form/management/return-state tests and `App.test.tsx` return scenarios.
- Affected `client-profile-context-navigation.spec.ts` and target-iPhone WebKit client workflows.
- Verify barrel `<= 250` and each feature module `<= 600` lines.

### Manual evidence
- Report residual physical Safari/keyboard checks; compare action order and focus with baseline because no UX change is authorized.

### Regression barrier
- Browser sequence list → create failure/retry → detail → edit → photo/
  attendance → transfer → exact return context, combined with component payload
  and stale-response tests on target-iPhone WebKit.

## Risks and stop conditions
- Остановиться, если TASK-126 is not integrated or changed route/return contracts assumed here.
- Остановиться, если reaching size limits requires membership behavior changes;
  keep it opaque and defer decomposition to TASK-128.
- Do not introduce shared mutable context or move backend-owned validation/permissions into components.
