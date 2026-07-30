# TASK-093 Action Inventory

## Shared Contract

Target order for route/task rows:

1. locator/search
2. optional filter trigger
3. refresh as frequent secondary action
4. create/add as the sole primary action

Create/add and refresh remain independently rendered by the owning feature
based on backend/session permissions and loading state. The shared action
recipe owns order, gap, semantic variant, single DOM control, accessible name,
minimum `44 x 44px` target, and mobile/coarse compact icon-only presentation.

## Standard Locator Rows

| Route | Owner | Operation | Permission source | Current | Target | Status |
|---|---|---|---|---|---|---|
| Clients | `ClientsToolbar` | refresh list | list state always exposes reload | ghost icon button before colored create | `EntityLocatorBar`: search, filters, refresh, create | update |
| Clients | `ClientsToolbar` | create client | `canManage` from session/backend | feature-colored button and duplicate empty-state create | shared primary action, no duplicate first-run empty create | update |
| Groups | `GroupsListScreen` | refresh list | list state always exposes reload | ghost icon button and feature create sizing | `EntityLocatorBar`: search, filters, refresh, create | update |
| Groups | `GroupsListScreen` | create group | screen route permission/handler | shared slot but duplicate first-run empty create | shared primary action, no duplicate first-run empty create | update |

## Filter Rows With Refresh Only

| Route | Owner | Operation | Permission source | Current | Target | Status |
|---|---|---|---|---|---|---|
| Schedule | `ScheduleFiltersToolbar` | refresh schedule | screen handler/loading state | icon button inside filter panel | shared refresh action in filter panel action slot | update |
| Audit | `AuditLogScreen` | refresh audit log | `canViewAuditLog` screen access | shared refresh button | shared refresh action in filter panel action slot | update |
| Finance | `FinanceReportsScreen` | refresh report | `canViewFinancialReports` screen access | shared refresh button | shared refresh action in filter panel action slot | update |

## No-Locator And Settings Rows

| Route/tab | Owner | Operation | Permission source | Current | Target | Status |
|---|---|---|---|---|---|---|
| Trainers | `UsersListScreen` | create trainer | route access/handler | right-aligned wrapping group with colored create | first task row shared action cluster | update |
| Trainers | `UsersListScreen` | refresh trainers | route access/handler | right-aligned wrapping group | first task row shared action cluster | update |
| Settings / Membership catalog | `MembershipCatalogSettings` | add membership | selected branch controls disabled state | `ResponsiveButtonGroup`, duplicate empty-state create | shared action cluster, no duplicate empty-state create | update |
| Settings / Membership catalog | `MembershipCatalogSettings` | refresh catalog | selected branch and loading lifecycle | `ResponsiveButtonGroup` | shared action cluster | update |
| Settings / Group types | `SettingsScreen` | add group type | `canManageSettings` screen/tab access | `ResponsiveButtonGroup` | shared action cluster | update |
| Settings / Group types | `SettingsScreen` | refresh group types | `canManageSettings` screen/tab access | `ResponsiveButtonGroup` | shared action cluster | update |
| Settings / Branches | `BranchSettingsScreen` | add branch | head coach/settings route access | `ResponsiveButtonGroup`, colored create | shared action cluster | update |
| Settings / Branches | `BranchSettingsScreen` | refresh branches | route access/loading state | `ResponsiveButtonGroup` | shared action cluster | update |
| Settings / Administrators | `AdministratorsSettingsPanel` | add administrator | `createRoleOptions` | refresh hidden when create denied | shared cluster with conditional primary and independent refresh | update |
| Settings / Administrators | `AdministratorsSettingsPanel` | refresh administrators | panel access/loading state | nested with create permission branch | shared secondary action always available in panel | update |

## Refresh-Only Operational Rows

| Route/section | Owner | Operation | Permission source | Current | Target | Status |
|---|---|---|---|---|---|---|
| Home / memberships | `MembershipsPanel` | refresh expiring memberships | dashboard permission/data path | header group with refresh | no-locator shared action cluster, recovery retry unchanged | update |
| Home / attention | `AttentionPanel` | refresh attention list | dashboard permission/data path | header group with refresh | no-locator shared action cluster, recovery retry unchanged | update |
| Attendance roster | `AttendanceScreen` | refresh roster | `canMarkAttendance`, selected group, pending-save state | section toolbar item | shared refresh action in roster toolbar | update |

## Exclusions

| Surface | Reason |
|---|---|
| Error recovery `Повторить` buttons | Recovery belongs to the error state surface, not route/section refresh. |
| Row edit/detail/destructive actions | Contextual row operations are outside create/refresh toolbar placement. |
| Group trainer substitutions create/edit | Section-specific workflow; not a route/list create action for this sweep. |
