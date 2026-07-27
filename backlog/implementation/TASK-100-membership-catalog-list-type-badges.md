# TASK-100: Убрать метки типа абонемента из каталога

## Status
implementation

## Goal
Строки каталога абонементов показывают только данные, необходимые для просмотра и редактирования варианта, без behavior/type/system badges.

## Context
В строке каталога рядом с названием выводится generic behavior badge (`Разовый`, `На срок` или `Профессиональный`). Для `Professional` дополнительно выводится ещё одна метка `Профессиональный`, поэтому текст повторяется.

Продуктовое решение от 2026-07-27: убрать из list rows каталога все такие метки, включая специальную метку `Professional`, потому что они создают визуальный шум. Решение относится только к каталогу настроек и не меняет отображение `Professional` в eligible lists продажи/перевода или на других экранах.

## User role
Суперадминистратор / главный тренер / администратор с доступом к каталогу своего филиала.

## Problem
Метки повторяют тип рядом с названием, засоряют строку и для `Professional` выводят одинаковый текст дважды.

## Scope
- убрать все behavior/type/system badges из list rows каталога для `SingleVisit`, `Term` и `Professional`;
- не оставлять после удаления пустой badge wrapper или лишний отступ;
- обновить row hierarchy и component regression tests;
- сохранить название, цену, период доступности и edit action.

## Out of scope
- Удаление выбора `Поведение` из create form.
- Изменение backend `behaviorKind`, Professional privileges, seed, permissions или contracts.
- Изменение отображения `Professional` в eligible lists продажи/перевода, карточке клиента и других интерфейсах.
- Разрешение администратору создавать/редактировать системный `Professional`.
- Изменение immutable behavior semantics в edit flow.

## Constraints
- Решение применяется только к list rows в каталоге настроек.
- Frontend не выводит Professional semantics из названия и не заменяет удалённую метку условной логикой по имени.
- Backend-owned membership behavior и продуктовый контракт TASK-070 вне каталожных строк не меняются.

## Acceptance criteria
- [ ] Строки `SingleVisit`, `Term` и `Professional` не содержат behavior/type/system badges.
- [ ] Если название варианта равно `Профессиональный`, оно отображается один раз как название и не дублируется меткой.
- [ ] Отсутствие меток для всех трёх behavior kinds закреплено component test.
- [ ] Название, цена, период доступности и edit action сохранены.
- [ ] Create/edit forms и backend behavior contracts не изменены.
- [ ] На 390 x 844, 420 x 912, 440 x 956, 768 x 1024 и 1440 x 1200 строка не получает horizontal scroll или clipping.

## Test checklist
- [ ] Добавить list-row cases для `SingleVisit`, `Term` и `Professional`.
- [ ] Проверить нулевое количество behavior/type/system badges внутри каждой строки.
- [ ] Проверить, что create form по-прежнему содержит выбор поведения для разрешённых типов.
- [ ] При реализации запустить frontend unit tests, lint и build.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: продуктовое решение зафиксировано; изменение ограничено presentation layer строк каталога и не затрагивает backend-семантику или другие интерфейсы.

## Clarification decision
- [x] Удалить из list rows все behavior/type/system badges, включая специальную метку `Профессиональный`.
- [x] Не показывать отдельную метку, даже если название варианта отличается от `Профессиональный`.
- [x] Сохранить системную семантику `Professional` в backend-контрактах и на остальных предусмотренных TASK-070 интерфейсах.

## Implementation lifecycle
- moved_to_implementation_at: 2026-07-28 00:45
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-100-membership-catalog-list-type-badges.plan.md
- implementation_branch: fix/TASK-100-membership-catalog-list-type-badges

## Source notes
- Source file: `backlog/processed/2026-07-27-2.md`
- Original note: `В списке абонементов рядом с названием отображается тип абонемента. Этот текст лишний и должен быть удалён.`
- Original note: `Рядом с названием профессионального абонемента текст «Профессиональный» отображается два раза — повтор необходимо удалить.`
- Related completed task: `backlog/done/TASK-070-membership-catalog.md`.

## Processing notes
- Created at: 2026-07-27 01:04
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- Duplicate check: TASK-070 определяет domain/UI visibility системного Professional, но не устраняет текущий двойной badge; возможный конфликт требует продуктового ответа.
- Clarified at: 2026-07-27
- Product decision: все метки типов и системного поведения удаляются только из list rows каталога.
