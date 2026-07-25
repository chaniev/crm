# TASK-087: Ограничить расписание тренера его effective groups

## Status
needs-clarification

## Priority
P1

## Goal
Тренер видит расписание релевантных ему групп, а не глобальную сетку всех филиалов.

## Shared mobile UI contract

- Normative contract:
  [Единый контракт мобильного интерфейса CRM](../../docs/MOBILE_UI_CONTRACT.md).
- UI foundation dependency: `TASK-090`; touch/compact-height sweep: `TASK-084`.
- Общий контракт задаёт shell, day locator, cards, states и palette, но не
  разрешает блокирующий вопрос effective scope.
- Visual concept остаётся только возможным workflow после backend/product
  clarification и не должен реализовываться через frontend filtering.

## User role
Тренер.

## Problem
Usability-аудит показал в coach schedule до 88 глобальных schedule entries. На desktop concurrent events превращаются в узкие unreadable lanes, а на mobile unrelated groups увеличивают число решений до выбора нужного занятия. UI оптимизирован под глобальный overview, а не под задачу тренера `найти моё текущее/следующее занятие`.

## Scope
- Зафиксировать backend-owned effective scope расписания тренера.
- Backend возвращает только разрешённые schedule entries и filter options.
- Day counts и type legend вычисляются из scoped response.
- Empty state сообщает, что занятий нет именно в scope тренера.
- Frontend потребляет backend scope и не фильтрует permission semantics локально.

## Out of scope
- Редактирование расписания, drag-and-drop, отмены и conflict resolution.
- Изменение attendance marking rules.
- Показ unauthorized global schedule как обход scoped API.

## Constraints
- Backend остаётся source of truth для assignment, temporary substitution, attendance access и schedule scope.
- Frontend не объединяет `assignedGroupIds`, substitutions и grants самостоятельно.
- Coach effective-scope narrowing не применяется к SuperAdministrator: session с `branchId: null` сохраняет global backend-permitted schedule и attendance scope.

## Clarification questions
- [ ] Effective groups тренера — только прямые текущие назначения?
- [ ] Должны ли входить активные временные замены из `TASK-073`?
- [ ] Должен ли schedule scope совпадать с attendance scope во всех случаях?
- [ ] Нужна ли разрешённая операция `Показать всё расписание`, и для каких ролей?

## Responsive behavior
- `360 x 780`, `390 x 844`: day navigation и day list показывают только scoped entries; empty day не выглядит global-empty.
- `420 x 912`, `440 x 956`: day counts отражают scoped entries.
- `768 x 1024`, `1440 x 1200`: calendar/grid не содержит unauthorized cards или filter options.
- `912 x 420`, `956 x 440`: compact-height day navigation и empty state остаются достижимыми.

## Operational and interaction states
- Loading: явное `Загружаем расписание`.
- Empty scoped: `Для вас занятий в расписании нет` после согласования copy.
- Error: retry; допустимый stale scoped schedule помечается как stale, а не success.
- Permission: отсутствие групп в scope показывает empty state, а не silent redirect.
- Day tabs имеют `aria-selected`; после выбора focus остаётся на выбранном дне.

## Acceptance criteria
- [ ] Coach с ограниченным effective scope не видит unassigned global groups.
- [ ] Branch/hall/trainer/group filters содержат только scoped options.
- [ ] Day counts и legend согласованы со scoped entries.
- [ ] Empty scoped schedule отличается от loading/error.
- [ ] Backend integration tests фиксируют scope; frontend tests подтверждают отсутствие чужих карточек.
- [ ] Изменения coach scope не сокращают schedule entries, counts, filter options или attendance operations SuperAdministrator.

## Test checklist
- [ ] Backend tests для coach schedule scope.
- [ ] Сценарии direct assignment, substitution и no-scope после уточнения semantics.
- [ ] Обновить affected schedule frontend/e2e tests.
- [ ] Non-regression: SuperAdministrator остаётся global и не получает coach-scoped empty copy.
- [ ] Проверить mobile, compact-height и desktop weekly grid.
- [ ] Запустить backend tests, frontend lint/build и iPhone WebKit checks.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача меняет security/data visibility contract и зависит от backend-owned определения effective scope.

## Related tasks
- `TASK-063`: head coach group assignment.
- `TASK-073`: temporary trainer substitution.
- `TASK-080`: administrator attendance group scope.

## Source notes
- Source: usability audit of the fully rebuilt and seeded local stand.
- Evidence date: 2026-07-25.

## Visual comparison
- [Сейчас / концепт после согласования scope](../mockups/usability-2026-07-25/TASK-087-comparison.png)
- [Описание преимуществ, вопросов и границ макета](../mockups/usability-2026-07-25/README.md#task-087-coach-schedule-effective-scope)
