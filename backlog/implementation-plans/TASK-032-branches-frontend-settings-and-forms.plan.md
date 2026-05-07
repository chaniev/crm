# Implementation Plan: TASK-032 Реализовать frontend для филиалов и залов

## Source task
/backlog/risky/TASK-032-branches-frontend-settings-and-forms.md

## Goal
Администратор управляет филиалами и залами в настройках CRM, а формы клиентов, групп и перевода клиента используют backend branch/hall contracts without duplicating CRM domain rules.

## Current understanding
Frontend currently has route sections `Home`, `Attendance`, `Clients`, `Groups`, `Users`, `Audit`; a separate settings section does not yet exist in `appRoutes.ts`. API contracts are centralized in `frontend/src/lib/api/types.ts`, endpoints in `frontend/src/lib/api/endpoints.ts`, and client/group screens are in `frontend/src/features/clients` and `frontend/src/features/groups`. This task depends on TASK-031 backend contracts and should not guess final route names or validation semantics before backend is stable.

The UI change is significant because it introduces CRM settings management. Per repository rules, implementation should include a UI checkpoint with `ui-designer` before coding, but the actual plan keeps frontend business logic thin and backend-driven.

## Execution steps
1. Wait for TASK-031 backend contracts: branch/hall DTOs, endpoints, ProblemDetails fields, client/group request fields and transfer endpoint.
2. Add frontend API types and functions for branches/halls, including archive/delete error handling through existing `ApiError` and `applyFieldErrors` patterns.
3. Add routing/navigation for settings or a settings sub-route only if backend/session permissions expose the section or existing product decision allows it. Avoid inventing permission semantics locally.
4. Build branch settings screen: list, create/edit form, archive action, archived badge/state. Keep layout operational and narrow-screen friendly.
5. Build hall management inside selected branch/details: list halls, create/edit hall, show backend ProblemDetails when archive/delete is blocked by groups/schedule.
6. Update client form values/payloads/details to include `branchId` and branch summary fields from backend.
7. Add client transfer UI: target branch select, optional group select populated from backend groups for that branch, submit through backend transfer endpoint, show client as group-less when no group selected.
8. Update group form values/payloads/details to include `branchId` and `hallId`; filter halls by selected branch using backend data, not hard-coded validation.
9. Update client and group lists/cards to display branch/hall summaries only if backend returns them and it improves scanability.
10. Update e2e fixtures and tests for new required fields.
11. Run lint/build and affected Playwright checks for settings, client form, group form and narrow layouts.

## Preferred implementation strategy
1. Backend contract consumption first: `types.ts`, endpoint constants, API clients.
2. Route/shell addition for settings with permission-driven visibility.
3. Settings branch/hall UI.
4. Client form and transfer integration.
5. Group form branch/hall integration.
6. E2E fixture updates and responsive checks.

## Files likely to change
- frontend/src/lib/api/types.ts
- frontend/src/lib/api/endpoints.ts
- frontend/src/lib/api/*
- frontend/src/lib/appRoutes.ts
- frontend/src/App.tsx
- frontend/src/features/shared/AppLayout.tsx
- frontend/src/features/shared/NavigationTabs.tsx
- frontend/src/features/settings/BranchSettingsScreen.tsx
- frontend/src/features/settings/*
- frontend/src/features/clients/ClientManagement.form.ts
- frontend/src/features/clients/ClientManagement.tsx
- frontend/src/features/clients/list/*
- frontend/src/features/groups/GroupManagement.tsx
- frontend/src/features/groups/groupManagement.constants.ts
- frontend/src/App.css
- frontend/e2e/stage12.spec.ts
- frontend/e2e/responsive-main-screens.spec.ts
- frontend/e2e/home-dashboard.spec.ts

## Constraints
- Frontend must not duplicate CRM validation semantics.
- Backend remains source of truth for cross-branch validation and permissions.
- Preserve Mantine and Onest.
- Do not break narrow-screen client/group/settings flows.
- Do not introduce settings IA beyond what is needed for branches/halls unless clarified.
- Значимое UX-изменение перед реализацией должно пройти UI checkpoint.

## Out of scope
- Backend branch/hall rules and migrations.
- Bot consumer changes.
- Financial reporting by branch.
- Schedule conflict UI.
- Full redesign of settings outside branches/halls.

## Required test coverage

### Unit tests
Add or update frontend unit tests for pure mapping/form helpers if present:
1. branch/hall payload mapping;
2. client payload includes `branchId`;
3. group payload includes `branchId` and `hallId`;
4. selecting a different branch resets incompatible hall/group selections.

### Integration tests
No backend integration tests in this task. If frontend has API integration/mocking helpers, update them to cover ProblemDetails rendering for blocked hall archive/delete and transfer validation errors.

### UI tests
Add/update Playwright coverage:
1. Admin can open settings and create/edit/archive branch.
2. Admin can create/edit hall within branch.
3. Blocked hall archive/delete shows backend error.
4. Client create/edit requires/selects branch using backend options.
5. Client transfer to another branch can choose target branch group or leave client without group.
6. Group create/edit selects branch and hall from that branch.
7. Narrow viewport keeps settings/client/group forms usable without overlap.

## Test plan
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Запустить affected Playwright tests for settings, client create/edit/transfer and group create/edit.
- [ ] Вручную проверить branch/hall settings на desktop и mobile.
- [ ] Вручную проверить ProblemDetails rendering for blocked hall actions.

## Regression barrier
Regression barrier is frontend typed contract coverage plus Playwright flows proving that branch/hall CRUD and client/group forms consume backend data correctly. Backend remains the final barrier for illegal cross-branch actions; frontend tests should assert error display rather than reimplementing the rule.

## Risks
- Settings section may conflict with TASK-030, which is still in needs-clarification.
- If frontend guesses backend route names or DTO shapes before TASK-031 is merged, rework is likely.
- Client/group forms are dense; adding branch/hall fields can degrade mobile layout.
- Filtering halls/groups in UI can accidentally become business logic if not backed by backend validation.
- Existing e2e fixtures hand-build client/group payloads and will need broad updates.

## Stop conditions
Остановиться и не писать код, если:
- TASK-031 backend contracts are not available or still unstable;
- settings information architecture is contradictory with TASK-030;
- backend permissions do not expose enough information to decide settings visibility;
- implementation requires frontend-owned branch validation semantics;
- mobile layout cannot fit required fields without a UX decision.

## Ready for Codex execution
no, blocked until TASK-031 backend contract is implemented/reviewed and UI checkpoint is done
