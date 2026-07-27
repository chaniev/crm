# TASK-101: Удалить оставшиеся неоперационные metric-виджеты

## Status
implementation

## Implementation lifecycle
- moved_to_implementation_at: 2026-07-27 20:00
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-101-remove-residual-metric-widgets-settings-group-edit.plan.md
- implementation_branch: fix/TASK-101-remove-residual-metric-widgets-settings-group-edit

## Goal
Экраны филиалов и редактирования группы сразу показывают рабочие controls и данные без агрегатных карточек, не меняющих текущее решение пользователя.

## Context
Требование удалить оставшиеся виджеты частично уже покрыто:

- TASK-092 удаляет `MetricCard` из settings tab `Администраторы`;
- TASK-086 удаляет `GroupsSummaryBar` из registry `Группы`.

Source audit нашёл ещё два непокрытых блока: три `MetricCard` на экране `Филиалы и залы` и три `MetricCard` в форме редактирования группы.

## User role
Суперадминистратор / главный тренер / администратор с backend-разрешённым доступом.

## Problem
Карточки с агрегатами занимают первый viewport, повторяют данные списка или формы и отодвигают primary operation.

## Scope
- Удалить из `BranchSettingsScreen` карточки `Филиалы`, `Активные филиалы` и `Активные залы`.
- Удалить из group edit карточки `Клиенты`, `Тренеры` и `Назначено`.
- Удалить ставшие неиспользуемыми frontend вычисления, imports и layout wrappers.
- Если конкретное значение действительно меняет решение внутри формы, показывать его только компактно рядом с соответствующим control, без summary/stat card.
- Сохранить actions, registry/form fields, loading, error, empty, read-only и permission-restricted states.
- Обновить component и responsive Playwright regression coverage.

## Out of scope
- Administrator widgets TASK-092.
- Group registry summary TASK-086.
- Изменение branch/group CRUD, trainer assignment rules, permissions или backend contracts.
- Удаление shared `MetricCard`, пока repository search показывает других consumers.
- Удаление framed validation, error, restricted или recovery surfaces.

## Constraints
- Удаляются только aggregate/framed stat widgets, не прошедшие `decision/usefulness test`.
- Primary create/save/edit operations остаются видимыми.
- Дополнительная desktop-ширина не возвращает удалённые widgets.
- Выполнять после TASK-086 и TASK-092 либо после проверки их merged state, чтобы корректно определить оставшихся consumers.

## Acceptance criteria
- [ ] В `Филиалы и залы` отсутствуют три metric cards количества филиалов и залов.
- [ ] В group edit отсутствуют metric cards `Клиенты`, `Тренеры` и `Назначено`.
- [ ] Первый рабочий viewport начинается с actions/list или form fields, а не со summary widgets.
- [ ] Decision-changing count, если он обоснован и сохранён, находится рядом с соответствующим control без card styling и дублирования.
- [ ] Loading, error, empty, read-only и permission-restricted states сохранены.
- [ ] Нет пустых grid wrappers, лишнего вертикального отступа или неиспользуемых вычислений/imports.
- [ ] Удалённые widgets не возвращаются на 768 x 1024 и 1440 x 1200.
- [ ] На 390 x 844, 420 x 912, 440 x 956, 912 x 420 и 956 x 440 нет horizontal page scroll, clipping или недостижимых primary actions.

## Test checklist
- [ ] Обновить BranchSettings component tests: metrics отсутствуют, actions/list/states сохранены.
- [ ] Обновить GroupManagement edit tests: metrics отсутствуют, fields/save/states сохранены.
- [ ] Добавить affected Playwright absence/geometry checks на mobile, compact-height, tablet и desktop.
- [ ] Проверить repository consumers `MetricCard` после merged TASK-086/TASK-092.
- [ ] Запустить `cd frontend && npm run test:unit`.
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Запустить affected Playwright и mobile WebKit checks.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: frontend-only removal of non-operational summary blocks; domain rules, data writes and permissions remain unchanged.

## Clarification questions
Не требуется: scope ограничен найденными aggregate `MetricCard`; operational, validation и recovery surfaces сохраняются.

## Source notes
- Source file: `backlog/processed/2026-07-27-2.md`
- Original note: `Необходимо проверить все экраны и удалить оставшиеся виджеты. В частности, виджеты ещё присутствуют на экранах раздела «Настройка».`

## Processing notes
- Created at: 2026-07-27 01:04
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- Duplicate check: TASK-092 и TASK-086 покрывают administrator/group-registry widgets; BranchSettings и group edit остаются отдельными непокрытыми call sites.
- UI inventory: `BranchSettingsScreen` и group edit — единственные найденные `MetricCard` consumers вне покрытых TASK-086/TASK-092.
