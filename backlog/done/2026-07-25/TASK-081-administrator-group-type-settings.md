# TASK-081: Вернуть администратору редактирование типов групп

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-07-25
- implementation_plan: /backlog/done/2026-07-25/TASK-081-administrator-group-type-settings.plan.md
- implementation_branch: fix/TASK-081-administrator-group-type-settings
- moved_to_done_at: 2026-07-25

## Goal
Администратор снова может открыть глобальный справочник типов групп и редактировать существующие типы в пределах действующего backend-контракта.

## Context
В inbox зафиксировано отсутствие у администратора доступа к редактированию типов групп.

Завершённая TASK-030 явно закрепила доступ к настройкам и глобальному справочнику типов групп для HeadCoach и Administrator, а TASK-053 сохранила create/edit flow после удаления `SystemIdentifier`. Текущий backend policy `ManageSettings` разрешает endpoints типов групп обеим ролям, но frontend `SettingsScreen` показывает вкладку `Типы групп` только при `user.role === 'HeadCoach'`. Это указывает на регрессию или рассинхронизацию consumer с действующим permission contract.

## User role
Администратор.

## Problem
Backend разрешает администратору управлять типами групп, но frontend скрывает точку входа. В результате согласованный сценарий настроек недоступен, хотя API и audit semantics существуют.

## Scope
- Восстановить доступ Administrator к вкладке и списку `Типы групп`.
- Разрешить редактирование существующего типа группы через действующий backend endpoint.
- Сохранить существующие create/delete действия панели только в пределах backend `ManageSettings` и текущих validation rules.
- Синхронизировать frontend visibility с авторитетным backend permission contract.
- Сохранить HeadCoach flow без регрессий.
- Добавить role-matrix regression tests для frontend и backend-контракта.

## Out of scope
- Изменение полей или схемы типа группы.
- Возврат `SystemIdentifier`.
- Изменение глобальности справочника типов групп.
- Предоставление Administrator доступа к другим вкладкам настроек, не требуемым этой заметкой.
- Общая переработка ролей CRM.

## Constraints
- Backend остаётся источником истины для authorization, validation, audit и ProblemDetails.
- Frontend не должен расширять доступ сверх действующего `ManageSettings`.
- Coach и остальные неразрешённые роли не получают доступ к справочнику.
- Редактирование не должно ломать существующие группы, связанные с типом.
- Create/update/delete продолжают проходить CSRF, audit и действующие проверки уникальности/связей.

## Acceptance criteria
- [x] Administrator видит вкладку `Типы групп` в настройках.
- [x] Administrator может загрузить список и открыть форму редактирования существующего типа.
- [x] Допустимое изменение сохраняется через backend и видно после повторной загрузки.
- [x] Backend validation/ProblemDetails отображаются в форме без дублирования доменных правил.
- [x] HeadCoach сохраняет текущий доступ.
- [x] Coach и другие неразрешённые роли не получают UI- или API-доступ.
- [x] Доступ к другим вкладкам настроек не расширяется неявно.
- [x] Изменение типа группы продолжает записываться в audit trail.

## Test checklist
- [x] Добавить frontend test для видимости вкладки и успешного edit flow под Administrator.
- [x] Добавить negative frontend test для Coach.
- [x] Проверить backend integration tests `GET`/`PUT /group-types` для Administrator, HeadCoach и запрещённой роли.
- [x] Проверить validation error, CSRF и audit payload при редактировании.
- [x] Проверить связанную группу после изменения названия/описания типа.
- [x] Запустить backend tests, frontend lint + build и затронутый Playwright settings flow.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: исправление касается ролей, permissions и глобального справочника, даже если подтверждённая рассинхронизация находится во frontend.

## Clarification questions
Не требуются: завершённая TASK-030 уже закрепила доступ Administrator к глобальному справочнику типов групп.

## Source notes
- Source file: `backlog/processed/2026-07-23.md`
- Original note: `Доступа к редактированию типов групп тоже нет`
- Related completed task: `backlog/done/2026-05-13/TASK-030-crm-settings-section.md`
- Related completed task: `backlog/done/2026-05-27/TASK-053-hide-group-type-system-identifier.md`

## Processing notes
- Created at: 2026-07-23 17:57
- Created by skill: codex-backlog-skill
- Duplicate check: активного дубликата нет. TASK-030 и TASK-053 завершены и описывают целевой доступ/flow; новая задача является regression follow-up к текущему рассогласованию frontend и backend.
- Implemented at: 2026-07-25 in `fix/TASK-081-administrator-group-type-settings`, commit `eedc10f`, merged to `main` by PR #91.
