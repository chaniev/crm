# TASK-082: Добавить роль суперадминистратора

## Status
risky

## Goal
Главный тренер может создать суперадминистратора, который получает текущие права администратора, управляет созданием администраторов и тренеров и может отмечать посещения во всех филиалах.

## Context
Текущая ролевая модель содержит только `HeadCoach`, `Administrator` и `Coach`. Administrator имеет branch-scoped управление клиентами, группами и настройками, но не управляет пользователями и не отмечает посещения. Новая роль должна включать текущие права Administrator и дополнительные полномочия, при этом создавать SuperAdministrator может только HeadCoach.

Новая роль также указана как один из субъектов, способных выдавать Administrator разрешения на attendance в TASK-080.

## User role
Главный тренер / суперадминистратор / администратор / тренер.

## Problem
Между главным тренером и филиальным администратором нет роли, которой можно делегировать создание персонала и межфилиальную работу с посещаемостью без передачи полномочий HeadCoach.

## Scope
- Добавить backend-доменную роль `SuperAdministrator` и обновить сериализацию, auth/session contracts и всех потребителей.
- Зафиксировать явную матрицу прав SuperAdministrator вместо разрозненных проверок роли.
- Сохранить за SuperAdministrator все текущие возможности Administrator по клиентам, абонементам, группам, настройкам и аудиту.
- Разрешить SuperAdministrator создавать Administrator и Coach с обязательным корректным branch assignment.
- Разрешить создавать SuperAdministrator только HeadCoach.
- Запретить SuperAdministrator создавать HeadCoach или другого SuperAdministrator и повышать пользователя до этих ролей обходным редактированием.
- Дать SuperAdministrator attendance-доступ ко всем группам всех филиалов.
- После TASK-080 разрешить SuperAdministrator выдавать и отзывать Administrator групповые attendance-разрешения.
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
- Все унаследованные права Administrator сохраняют действующие ограничения, если источник явно не расширяет их; явно межфилиальным является attendance-доступ.
- Создание Administrator и Coach требует валидного филиала и не должно позволять назначить недоступный или несуществующий branch.
- Авторизация не должна строиться на frontend-only проверках строкового имени роли.
- Изменение role enum и session/API contracts требует обновить frontend, bot и seed/bootstrap сценарии.
- Существующие HeadCoach, Administrator и Coach не должны получить новые права побочным эффектом.

## Acceptance criteria
- [ ] Только HeadCoach может создать пользователя с ролью SuperAdministrator.
- [ ] SuperAdministrator не может создать или повысить пользователя до HeadCoach либо SuperAdministrator.
- [ ] SuperAdministrator может создать Administrator и Coach с валидным branch assignment.
- [ ] SuperAdministrator получает все текущие права Administrator без ослабления branch validation у унаследованных операций.
- [ ] SuperAdministrator может открыть attendance всех филиалов и сохранить отметки по любой их группе.
- [ ] Прямые API-попытки обойти матрицу создания/изменения ролей отклоняются стабильным ProblemDetails и не меняют данные.
- [ ] Auth/session, frontend и bot корректно распознают новую роль.
- [ ] Критические действия новой роли отражаются в audit с корректным actor и scope.
- [ ] Права и пользовательские сценарии существующих ролей не регрессируют.

## Test checklist
- [ ] Добавить backend role/permission matrix integration tests для всех пар actor/target role.
- [ ] Проверить создание пользователей, изменение роли, деактивацию и branch validation.
- [ ] Проверить attendance-доступ SuperAdministrator к нескольким филиалам и denial для прежних ролей.
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
