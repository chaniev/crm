# TASK-187: Уточнить создание тренеров администратором филиала

## Status
needs-clarification

## Requirements
- pending — доступ к создаваемому тренеру до назначения и после него, чтение/редактирование общей учётной записи.

## Requirement context
- [REQ-USR-001](../../docs/requirements/05-пользователи-и-роли.md) — constrains
- [REQ-USR-002](../../docs/requirements/05-пользователи-и-роли.md) — constrains
- [REQ-USR-004](../../docs/requirements/05-пользователи-и-роли.md) — constrains
- [REQ-GRP-001](../../docs/requirements/02-группы.md) — verifies
- [REQ-GRP-002](../../docs/requirements/02-группы.md) — verifies
- [REQ-BRN-001](../../docs/requirements/09-филиалы-и-настройки.md) — constrains
- [REQ-NFR-003](../../docs/requirements/08-нефункциональные.md) — constrains

## Goal
Администратор создаёт тренера и назначает его на группу своего филиала без расширения доступа к чужим данным.

## Context
Создание групп и назначение тренеров в своём филиале уже разрешены GroupManagementScope; GroupsApiTests проверяют запрет чужого филиала. Создание сотрудника Administrator запрещено UserRoleAuthorizationPolicy. REQ-USR-004 допускает в «Тренеры» только HeadCoach/SuperAdministrator. По REQ-BRN-001 у Coach нет собственной привязки к филиалу: филиалы получаются из групп.

## Scope
- Сохранить traceability трёх частей запроса: создание группы и назначение — проверка действующего контракта; создание тренера — новое право.
- Определить минимальный API/UI create/read scope и судьбу нового тренера без групп; не выдавать общий CanManageUsers без отдельного решения.
- После уточнения изменить REQ-USR-001/004 и нужные связанные карточки; провести security review.

## Constraints
- Backend сохраняет владение CRM-правилами; triage не разрешает реализацию.
- Перед реализацией нужен ready plan по docs/HARNESS.md; для визуальных изменений — применимый design gate.
- При завершении обновить состояние связанных требований и docs/requirements/CHANGELOG.md.

## Acceptance criteria
- [ ] Определено, видит ли администратор весь реестр, тренеров своих групп или только результат создания; определены разрешённые мутации.
- [ ] В плане есть разрешённое создание Coach, запрет создания привилегированных ролей и межфилиальных мутаций.
- [ ] Создание группы и назначение в своём филиале проверены end-to-end; существующие возможности не реализуются повторно.

## Test checklist
- [ ] После решения: новый тренер без групп, совместный тренер двух филиалов, перенос/снятие назначения, create role tampering.
- [ ] Регрессия создания группы/назначения в своём филиале и отказ для чужого, UI и API.

## AI safety
- Safe for autonomous implementation: no
- Risk level: high
- Reason: Общий флаг управления сотрудниками может открыть чужие аккаунты и привилегированные роли; филиал тренера не является отдельным сохранённым полем.

## Clarification questions
- [ ] Администратор только создаёт тренера или также видит/редактирует/отключает его учётную запись?
- [ ] Каких тренеров он видит, включая ещё не назначенных ни в одну группу и работающих в нескольких филиалах?

## Evidence
- [backend/src/GymCrm.Application/Authorization/UserRoleAuthorizationPolicy.cs](../../backend/src/GymCrm.Application/Authorization/UserRoleAuthorizationPolicy.cs)
- [backend/src/GymCrm.Api/Auth/GroupManagementScope.cs](../../backend/src/GymCrm.Api/Auth/GroupManagementScope.cs)
- [backend/src/GymCrm.Api/Auth/GroupTrainerAssignmentEndpoints.cs](../../backend/src/GymCrm.Api/Auth/GroupTrainerAssignmentEndpoints.cs)
- [backend/tests/GymCrm.Tests/GroupsApiTests.cs](../../backend/tests/GymCrm.Tests/GroupsApiTests.cs)
- [docs/requirements/09-филиалы-и-настройки.md](../../docs/requirements/09-филиалы-и-настройки.md)

## Source notes
- Source file: [2026-10-05.md](../processed/2026-10-05.md)
- Source items: 2 (порядок самостоятельных пунктов, без строк-продолжений).

> администратор должен иметь возможность добавлять группу в своем филиале, тренера, назначать тренера на группу в своем филиале

## Processing notes
- Created at: 2026-10-05 (MSK).
- Created by skill: codex-backlog-skill.
- Mode: triage; scope: два файла inbox, без глобальной сверки статусов.
- Duplicate check: TASK-081 относится к типам групп, TASK-082 — прежним правам SuperAdministrator, TASK-105 — реестру тренеров. Новое право Administrator не покрыто; исходные группы/назначения частично уже покрыты.
- Проверены активные карточки, unfinished plans и рекурсивный done; новые ID выделены после TASK-171.
