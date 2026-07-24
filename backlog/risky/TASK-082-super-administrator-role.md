# TASK-082: Добавить роль суперадминистратора

## Status
risky

## Goal
Главный тренер может создать суперадминистратора без привязки к филиалу. Суперадминистратор получает текущие права администратора в глобальном scope, управляет администраторами и тренерами во всех филиалах и может отмечать посещения в любой группе.

## Context
Текущая ролевая модель содержит только `HeadCoach`, `Administrator` и `Coach`. Administrator имеет branch-scoped управление клиентами, группами и настройками, но не должен управлять пользователями и не отмечает посещения. Новая роль является глобальной организационной ролью: она включает текущие возможности Administrator, распространяет их на все филиалы и добавляет управление Administrator и Coach, при этом создавать или назначать SuperAdministrator может только HeadCoach.

Новая роль также указана как один из субъектов, способных выдавать Administrator разрешения на attendance в TASK-080.

## User role
Главный тренер / суперадминистратор / администратор / тренер.

## Problem
Между главным тренером и филиальным администратором нет глобальной роли, которой можно делегировать работу с филиалами, создание персонала и межфилиальную работу с посещаемостью без передачи исключительных полномочий HeadCoach.

## Scope
- Добавить backend-доменную роль `SuperAdministrator` и обновить сериализацию, auth/session contracts и всех потребителей.
- Зафиксировать явную матрицу прав SuperAdministrator вместо разрозненных проверок роли.
- Сохранить за SuperAdministrator все текущие возможности Administrator по клиентам, абонементам, группам, настройкам и аудиту и распространить их на все филиалы.
- Не привязывать SuperAdministrator к филиалу: его `BranchId` должен быть `null`.
- Разрешить SuperAdministrator создавать Administrator для любого активного филиала с обязательным валидным `BranchId`.
- Разрешить SuperAdministrator создавать Coach без прямого branch assignment и управлять его назначениями в группы любых филиалов в пределах действующих правил групп.
- Разрешить создавать или назначать роль SuperAdministrator только HeadCoach.
- Запретить SuperAdministrator создавать HeadCoach или другого SuperAdministrator и повышать пользователя до этих ролей обходным редактированием.
- Дать SuperAdministrator attendance-доступ ко всем группам всех филиалов.
- После TASK-080 разрешить SuperAdministrator выдавать и отзывать Administrator групповые attendance-разрешения.
- Отделить управление Administrator от общего permission управления настройками, чтобы обычный Administrator не мог создавать или изменять других администраторов прямым API-запросом.
- Отразить роль в управлении пользователями и других затронутых UI.
- Аудировать создание пользователей и чувствительные изменения ролей с actor, target, old/new role и branch scope.

## Out of scope
- Передача SuperAdministrator bootstrap-функций или возможности создавать/заменять HeadCoach.
- Неограниченное изменение собственной роли или роли другого SuperAdministrator.
- Изменение бизнес-правил memberships, attendance и расписания.
- Предоставление Administrator или Coach новых полномочий вне TASK-080.
- Не связанный с новой ролью рефакторинг авторизации.

## Constraints
- Backend остаётся единственным источником истины для ролей, permissions, branch scope и audit semantics.
- SuperAdministrator является глобальной ролью без собственного филиала; его права на клиентов, абонементы, группы, настройки, аудит, управление персоналом и attendance распространяются на все филиалы.
- Глобальный scope SuperAdministrator не передаёт ему исключительные возможности HeadCoach, включая bootstrap-функции, создание или замену HeadCoach и создание другого SuperAdministrator.
- Только создаваемый Administrator требует прямого branch assignment; филиал должен существовать и быть активным.
- Coach не получает прямой `BranchId`; его рабочий scope по-прежнему определяется назначениями в группы.
- Создание Administrator и назначение Coach в группы доступны SuperAdministrator во всех филиалах, но не должны обходить действующие проверки существования, активности и согласованности филиала, группы и пользователя.
- Авторизация не должна строиться на frontend-only проверках строкового имени роли.
- Изменение role enum и session/API contracts требует обновить frontend, bot и seed/bootstrap сценарии.
- Существующие HeadCoach, Administrator и Coach не должны получить новые права побочным эффектом.

## Acceptance criteria
- [ ] Только HeadCoach может создать пользователя с ролью SuperAdministrator.
- [ ] SuperAdministrator не может создать или повысить пользователя до HeadCoach либо SuperAdministrator.
- [ ] SuperAdministrator не имеет собственного филиала, а auth/session и API возвращают для него `branchId: null`.
- [ ] SuperAdministrator может создать Administrator для любого активного филиала; несуществующий или архивный филиал отклоняется.
- [ ] SuperAdministrator может создать Coach без прямого branch assignment и управлять его назначениями в группы любых филиалов.
- [ ] SuperAdministrator получает все текущие права Administrator и может выполнять соответствующие операции во всех филиалах.
- [ ] SuperAdministrator может открыть attendance всех филиалов и сохранить отметки по любой их группе.
- [ ] Обычный Administrator не может создавать или изменять других Administrator и Coach через UI или прямые API-запросы.
- [ ] Прямые API-попытки обойти матрицу создания/изменения ролей отклоняются стабильным ProblemDetails и не меняют данные.
- [ ] Auth/session, frontend и bot корректно распознают новую роль.
- [ ] Критические действия новой роли отражаются в audit с корректным actor и scope.
- [ ] Права и пользовательские сценарии существующих ролей не регрессируют.

## Test checklist
- [ ] Добавить backend role/permission matrix integration tests для всех пар actor/target role.
- [ ] Проверить создание пользователей, изменение роли, деактивацию, запрет self-escalation и ограничения на управление HeadCoach и SuperAdministrator.
- [ ] Проверить `BranchId = null` у SuperAdministrator и Coach.
- [ ] Проверить создание Administrator для разных активных филиалов и отказ для несуществующего или архивного филиала.
- [ ] Проверить создание Coach без филиала и его назначения в группы разных филиалов.
- [ ] Проверить глобальный доступ SuperAdministrator к клиентам, абонементам, группам, настройкам, аудиту и attendance минимум в двух филиалах.
- [ ] Проверить denial для обычного Administrator на создание и изменение Administrator и Coach.
- [ ] Проверить audit успешных и, если предусмотрено действующим контрактом, отклонённых чувствительных операций.
- [ ] Обновить frontend auth, routing, user-management и action-visibility tests.
- [ ] Обновить bot role parsing/contract tests и seed/bootstrap tests.
- [ ] Запустить backend tests, frontend lint + build, bot ruff + pytest.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача вводит привилегированную роль, меняет authorization matrix и межфилиальный доступ к attendance.

## Source notes
- Source file: `backlog/processed/2026-07-24.md`
- Original note: `добавить роль суперадминистратора - будет иметь возможность заводить других админов, тренеров, отмечать посещение в группах во всех филиалах, заводить клиентов, отмечать абрнементы, суперадминистратора может создавать только.главный тренер, получает также все текущие права администратора`

## Processing notes
- Created at: 2026-07-24 12:46
- Created by skill: codex-backlog-skill
- Duplicate check: активных задач про роль SuperAdministrator и соответствующую матрицу создания пользователей не найдено; связь с обновлённой TASK-080 зафиксирована без объединения разных authorization-сценариев.
- Clarified at: 2026-07-24
- Clarification: SuperAdministrator не имеет собственного филиала и работает глобально во всех филиалах; Administrator создаётся с филиалом, Coach — без прямого branch assignment.
