# TASK-095 authenticated copy inventory

Audit date: 2026-07-30

Decision rule: retain copy only when it names an independent task or entity,
changes a decision, states a constraint or consequence, or enables recovery.
Persistent navigation and settings tabs own top-level list context.

| Surface | Copy/context | Verdict | Reason / accessible replacement |
|---|---|---|---|
| Authenticated shell | Club name | Retain | Deployment identity. |
| Authenticated shell | Role and `стартовый раздел` below the club name | Remove | Service metadata; role remains in the profile menu. |
| Home | Hidden `Главная` h1 | Retain | Names the main landmark without repeating persistent navigation. |
| Home / `Посещения` | Field labels, loading/error/empty/recovery copy | Retain | Operational state and scope. |
| Home / `Требуют внимания` | `Клиенты, требующие внимания` and decorative description | Remove | Active tab already owns context; hidden `Список клиентов` h2 names the result list. |
| Home / `Требуют внимания` | `Проверено`, loading/error/empty/action feedback | Retain | Freshness and recovery information. |
| Schedule | Hidden route h1; date/group controls and state copy | Retain | Accessible route name and operational scope. |
| Clients list | Hidden route h1; locator/filter/range/state copy | Retain | Accessible route name and task controls. |
| Client create/detail/preview/edit | Visible entity/task title, form labels, validation and recovery | Retain | Independent operation and decision data. |
| Groups list | Hidden route h1; locator/filter/range/state copy | Retain | Accessible route name and task controls. |
| Group create/edit | Visible operation title, form labels, validation and recovery | Retain | Independent operation and decision data. |
| Trainers list | Hidden route h1; action/state copy | Retain | Accessible route name and operations. |
| Trainer create | Visible task title, form labels, validation and constraints | Retain | Independent operation. |
| Trainer edit | Visible trainer identity title | Retain | Independent entity/operation. |
| Trainer edit | `Редактирование доступа`, fixed-login intro and permissions hint card | Remove | Restates page title and field semantics. |
| Trainer edit | Readonly login, Telegram ID field consequence, validation and recovery | Retain | Constraint, consequence and recovery. |
| Audit | Hidden route h1; filters/range/error copy | Retain | Accessible route name and operational scope. |
| Finance | Hidden route h1; period/scope/error copy | Retain | Accessible route name and decision scope. |
| Settings | Hidden route h1 and active tabs | Retain | Accessible route and persistent tab context. |
| Settings / Memberships | Form labels, catalog state and branch scope | Retain | Scope, operations and recovery. |
| Settings / Group types | Form labels and operational state | Retain | Operations and recovery. |
| Settings / Branches and halls | Actions, entity labels and operational state | Retain | Operations and recovery. |
| Settings / Administrators | Locator/actions, permission and operational state | Retain | Scope, permission and recovery. |
| Password | Visible task title, security guidance, validation and recovery | Retain | Security consequence and independent operation. |
| Restricted / not found | Specific heading, explanation and recovery action | Retain | Required recovery path. |

Automated component and Playwright coverage owns the regression guarantee; this
inventory records the review rationale.
