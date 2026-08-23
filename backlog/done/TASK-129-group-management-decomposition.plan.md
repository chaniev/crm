# Implementation Plan: TASK-129 Разделить group registry и group form modules

## Metadata
- source_task: /backlog/done/TASK-129-group-management-decomposition.md
- branch: refactor/TASK-129-group-management-decomposition
- readiness: no — требуется human review schedule payload/scope characterization
- dependencies: TASK-126 — app shell/routing decomposition должна быть интегрирована
- risk: medium — group form maps weekday/time, trainers and scoped mutations

## Goal
Registry, create, edit and group form имеют отдельные state/transport owners,
а compatibility barrel не превышает 200 строк при неизменном schedule payload
и mobile workflow.

## Decisions and contracts
- Preserve current public route-screen exports through a compatibility barrel.
- Registry reuses existing `useGroupsListState`, `groupListQuery` and return-state
  helpers; split does not create a second filter/paging source.
- Create/edit screens own load/submit/pending/error orchestration; `GroupForm`
  owns controlled fields and pure request mapping only.
- Preserve exact create/full-update/trainer-only payload boundaries, field
  ordering, ProblemDetails mapping and backend-owned permissions/schedule validation.
- Member list and trainer substitutions remain focused collaborators with
  current return/focus behavior; no redesign or TASK-117 semantics enter this diff.

## Scope
### In
- Registry filters/rows, create/edit route screens, form/mapping/validation and compatibility exports.

### Out
- API/weekday model/permissions, new actions/filters, redesign, TASK-117 or generic form/global store.

## Implementation slices
1. Expand list/create/edit characterization for exact requests, operational states and return focus.
2. Extract registry composition around existing state/query helpers and row actions.
3. Extract create/edit screens plus shared controlled `GroupForm` and pure mapper.
4. Wire member/substitution sections through typed props, convert root to barrel and verify size limits.

## Likely files and layers
- `frontend/src/features/groups/GroupManagement.tsx` — compatibility barrel.
- `frontend/src/features/groups/GroupsListScreen.tsx`, `GroupCreateScreen.tsx`, `GroupEditScreen.tsx`.
- `frontend/src/features/groups/GroupForm.tsx` and `groupFormMapping.ts`.
- Existing `useGroupsListState.ts`, `groupListQuery.ts`, `groupListReturnState.ts` — reuse/verification.
- `frontend/src/features/groups/GroupManagement.test.tsx` plus focused screen/form tests.
- `frontend/e2e/groups-registry.spec.ts`, `client-profile-context-navigation.spec.ts`, `group-trainer-substitutions.spec.ts`.

## Regression specification
### Automated tests to add or update
- Registry tests preserve debounced query, filters/reset, pagination, stale
  rows/retry, empty states, row actions and branch scope.
- Create/edit forms produce byte-equivalent payloads for weekdays/times,
  trainerIds and member boundaries; backend field errors stay beside current fields.
- Dirty draft, save failure/retry, client-profile navigation/cancel/discard/save
  and focus restoration remain exact.
- Allowed/restricted role and branch paths render current states and do not send forbidden mutations.
- Browser checks cover portrait/compact-landscape action reachability and no horizontal overflow.

### Expected red evidence
- Characterization is expected green on baseline; behavior red is inapplicable
  for a no-contract-change split. Structural evidence is the 1452-line mixed
  module and absent route/form boundaries.

### Required validation
- Focused group management/query/return-state unit tests.
- The three affected group/client Playwright specs on Chromium and target-iPhone WebKit.
- Verify barrel `<= 200` and feature modules `<= 500` lines.

### Manual evidence
- Compare form labels/action priority/focus with baseline and report unverified physical Safari checks.

### Regression barrier
- Browser registry filter → edit dirty draft → client profile return → failed
  save/retry → list return sequence, plus exact create/update payload component tests.

## Risks and stop conditions
- Остановиться, если integrated TASK-126 changes route/return surface assumed here.
- Остановиться при required schedule payload/validation/permission change or
  conflict with TASK-117; resolve outside this structural task.
- Do not duplicate list state or hide current primary operations during split.
