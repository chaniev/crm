# TASK-094 Filter Surface Inventory

## Shared Paint Contract

Standard route-level locator and filter surfaces use one shared CSS recipe:

- component class: `crm-filter-surface`
- background: `var(--crm-surface-card)`
- border: `1px solid var(--crm-border-muted)`
- border radius: `10px`
- shadow: `none`

The recipe owns paint only. Component owners keep padding, row/grid layout,
control sizing, active-filter placement, ARIA semantics, drawer behavior,
query state, and reset scope.

## Standard Surfaces

| Route | Surface | Owner | Current issue | Target |
|---|---|---|---|---|
| Schedule | `data-testid="schedule-filter-panel"` | `CompactFilterPanel` in `frontend/src/features/schedule/GroupScheduleScreen.tsx` | Route CSS repeated the shared paint and older desktop wrappers neutralized inner toolbar paint. | `CompactFilterPanel` carries `crm-filter-surface`; schedule CSS keeps only schedule-specific geometry/actions. |
| Clients | `data-testid="clients-filter-panel"` locator row | `EntityLocatorBar` in `frontend/src/features/clients/list/ClientsToolbar.tsx` | Route wrapper used transparent toolbar paint and delegated locator paint to local feature CSS. | `EntityLocatorBar` carries `crm-filter-surface`; active filters remain a sibling below it; drawer keeps client filter semantics. |
| Groups | `data-testid="groups-list-controls"` locator row | `EntityLocatorBar` in `frontend/src/features/groups/GroupManagement.tsx` | Final Groups locator already uses shared component structure but had no explicit standard surface class. | `EntityLocatorBar` carries `crm-filter-surface`; active filters remain a sibling; Groups search/filter/paging behavior is unchanged. |
| Audit | `data-testid="audit-filter-panel"` | `CompactFilterPanel` in `frontend/src/features/audit/AuditLogScreen.tsx` | Route-specific selector repeated the paint contract. | `CompactFilterPanel` carries `crm-filter-surface`; audit CSS keeps no route paint override. |
| Finance | `data-testid="finance-filter-panel"` | `CompactFilterPanel` in `frontend/src/features/finance/FinanceReportsScreen.tsx` | Route-specific selector repeated the paint contract. | `CompactFilterPanel` carries `crm-filter-surface`; finance CSS keeps no route paint override. |

## Non-Standard Context Surface

| Route | Surface | Owner | Classification | Target |
|---|---|---|---|---|
| Attendance | `data-testid="attendance-toolbar"` | `AttendanceContextControls` in `frontend/src/features/attendance/AttendanceContextControls.tsx` | Operation-specific context selector/date surface, not standard search/filter. | Use `crm-context-surface` with the same semantic paint tokens, but no filter drawer, reset, active-filter, or standard `crm-filter-surface` semantics. |

## Not Migrated By TASK-094

Trainers search is intentionally left to TASK-096. It will inherit the shared
locator paint when it adopts `EntityLocatorBar`.
