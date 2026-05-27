# TASK-054: Убрать поле роли из форм добавления тренера и администратора

## Status
done

## Goal
При добавлении тренера или администратора пользователь не выбирает роль вручную: роль определяется самим сценарием добавления.

## Context
В inbox есть заметка: "на форме добавления тренера и администратора удалить поле Роль, роль автоматичечки должна устанавливаеться на основе того кого сейчас добавляется". В CRM уже есть раздел управления тренерами и отдельное управление администраторами в настройках.

## Contract decision
Текущий контракт `/users` остается без изменений: create-flow тренера продолжает отправлять `role: "Coach"` в payload. Роль не выбирается пользователем, а фиксируется frontend route/use-case формы создания тренера.

Контракт `/settings/administrators` остается без поля роли: create-flow администратора отправляет payload без `role`, а backend сам устанавливает `UserRole.Administrator`.

Backend validation/authorization остается обязательной границей безопасности: `/users` продолжает запрещать создание `Administrator` и `HeadCoach`, а `/settings/administrators` продолжает создавать только администраторов.

## User role
главный тренер / администратор

## Problem
Поле `Роль` в формах добавления персонала создает лишний выбор и может позволить пользователю выбрать роль, не соответствующую текущему сценарию.

## Scope
- Проверить текущие формы добавления тренера и администратора.
- Убрать видимое поле `Роль` из create-flow тренера.
- Убрать видимое поле `Роль` из create-flow администратора.
- В create-flow тренера оставить отправку `role: "Coach"` в `/users`, но убрать пользовательский выбор роли.
- В create-flow администратора оставить отправку в `/settings/administrators` без поля `role`; роль задается backend-owned сценарием.
- Проверить, что edit-flow не получает случайного изменения роли, если роль не должна редактироваться.
- Обновить тесты и тексты ошибок, если они ссылаются на ручной выбор роли.

## Out of scope
- Изменение модели ролей CRM.
- Добавление новых ролей.
- Перенос администраторов между разделами.
- Изменение permissions/access scope за пределами create-flow.
- Переименование технических API, DTO или audit-событий без необходимости.
- Изменение `/users` create contract: `CreateUserRequest.Role` остается частью backend/frontend контракта.
- Введение отдельных backend commands/endpoints для создания тренера.

## Constraints
- Backend остается владельцем roles, permissions и validation semantics.
- Frontend не должен позволять выбрать роль, не соответствующую текущему use-case.
- Нельзя ослабить проверки создания администратора и тренера.
- Не ломать существующее разделение: тренеры управляются в trainer-management flow, администраторы - в настройках.
- Скрытие поля роли в UI не считается security boundary; backend запреты на недопустимые роли должны остаться.
- Не удалять `role` из trainer create payload: для `/users` он должен фиксированно уходить как `Coach`.
- Не добавлять `role` в administrator create payload: для `/settings/administrators` роль задает backend.

## Acceptance criteria
- [ ] В форме добавления тренера нет поля `Роль`.
- [ ] Новый тренер создается с ролью тренера через `/users` payload с фиксированным `role: "Coach"`.
- [ ] В форме добавления администратора нет поля `Роль`.
- [ ] Новый администратор создается с ролью администратора через `/settings/administrators` payload без поля `role`.
- [ ] Пользователь не может через UI создать администратора из формы тренера или тренера из формы администратора.
- [ ] Backend validation/authorization продолжает запрещать недопустимое создание ролей.
- [ ] Edit-flow тренера и администратора не меняется случайно из-за переиспользования общего `UserFormFields`.

## Test checklist
- [ ] Backend tests: создание тренера/администратора с ожидаемой ролью и запрет недопустимых ролей.
- [ ] Frontend lint + build.
- [ ] Frontend unit/e2e: create trainer form без поля роли и отправляет `role: "Coach"` в `/users`.
- [ ] Frontend unit/e2e: create administrator form без поля роли и отправляет payload без `role` в `/settings/administrators`.
- [ ] Frontend regression: edit trainer/administrator flow не теряет ожидаемое поведение роли.
- [ ] Ручная проверка create/edit trainer и administrator flows под ролями, которым доступно управление персоналом.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача касается roles, permissions и сценариев создания пользователей; ошибки могут нарушить разграничение доступа.

## Clarification questions
Закрыто: текущий `/users` контракт остается с фиксированным `role: "Coach"` в trainer create-flow. Отдельный backend command/endpoint для создания тренера в рамках этой задачи не вводится.

## Source notes
- Source file: `backlog/inbox/2026-05-23.md`
- Original note: `на форме добавления тренера и администратора удалить поле Роль, роль автоматичечки должна устанавливаеться на основе того кого сейчас добавляется`

## Processing notes
- Created at: 2026-05-23 19:09
- Created by skill: codex-backlog-skill
- Duplicate check: похожая активная задача не найдена; связано с завершенными `TASK-029-rename-users-to-trainers` и `TASK-030-crm-settings-section`, но это отдельный follow-up про role field behavior в формах.
