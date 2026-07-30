# TASK-087: Ограничить расписание тренера его effective groups

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-07-26 23:56
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/TASK-087-coach-schedule-effective-scope.plan.md
- implementation_branch: fix/TASK-087-coach-schedule-effective-scope
- implementation_state: completed
- implementation_commit: 9aef59282dfd72a7bbb4d6c775b613c9bc3ee42d
- integration_commit: 7e386d1d3b412f94968e707778e2adffa76e0901
- delivered_on_main_at: 2026-07-30
- moved_to_done_at: 2026-07-30
- last_status_reviewed_at: 2026-07-30 19:33 MSK
- reviewed_main_commit: c69f47b9a91d09363577406052cf8d36633726b3

## Priority
P1

## Goal
Тренер видит расписание релевантных ему групп, а не глобальную сетку всех филиалов.

## Shared mobile UI contract

- Normative contract:
  [Единый контракт мобильного интерфейса CRM](../../docs/MOBILE_UI_CONTRACT.md).
- UI foundation dependency: `TASK-090`; touch/compact-height sweep: `TASK-084`.
- Общий контракт задаёт shell, day locator, cards, states и palette, но не
  переопределяет backend-owned effective scope.
- Visual concept задаёт scoped workflow, но не должен реализовываться через
  frontend filtering.

## User role
Тренер.

## Problem
Usability-аудит показал в coach schedule до 88 глобальных schedule entries. На desktop concurrent events превращаются в узкие unreadable lanes, а на mobile unrelated groups увеличивают число решений до выбора нужного занятия. UI оптимизирован под глобальный overview, а не под задачу тренера `найти моё текущее/следующее занятие`.

## Scope
- Применить существующий backend-owned effective scope к `/schedule/groups`
  для роли Coach.
- Effective groups Coach на business date:
  - постоянные назначения из `GroupTrainers`;
  - union активных, не отменённых временных замен из `TASK-073`, где
    `StartsOn <= businessDate <= EndsOn`.
- Использовать `IEffectiveGroupAssignmentService`; не копировать date/substitution
  query в endpoint.
- Фильтровать backend query до `totalCount` и paging.
- Backend возвращает только разрешённые schedule entries и scoped filter
  options/data.
- Day counts и type legend вычисляются из scoped response.
- Empty state сообщает, что занятий нет именно в scope тренера.
- Frontend потребляет backend scope и не фильтрует permission semantics локально.

## Out of scope
- Редактирование расписания, drag-and-drop, отмены и conflict resolution.
- Изменение attendance marking rules.
- Показ unauthorized global schedule как обход scoped API.
- Операция `Показать всё расписание` для Coach; elevated роли уже получают
  свой backend-permitted global response без отдельного toggle.
- Исторический или будущий entitlement preview: scope определяется на текущую
  business date тем же контрактом, что session и attendance.

## Constraints
- Backend остаётся source of truth для assignment, temporary substitution, attendance access и schedule scope.
- Frontend не объединяет `assignedGroupIds`, substitutions и grants самостоятельно.
- Coach schedule scope совпадает с `attendanceScope=TrainerAssignments` и
  session `assignedGroupIds`, потому что все три consumers используют один
  `IEffectiveGroupAssignmentService`.
- Coach effective-scope narrowing не применяется к SuperAdministrator: session с `branchId: null` сохраняет global backend-permitted schedule и attendance scope.
- HeadCoach, SuperAdministrator и Administrator сохраняют текущий
  backend-permitted schedule contract; задача не расширяет и не сужает их
  scope.

## Resolved decisions
- [x] Scope не ограничивается прямыми назначениями: он включает активные
      временные замены из `TASK-073`.
- [x] Для Coach schedule scope совпадает с текущим effective assignment,
      используемым attendance/session.
- [x] Границы временной замены inclusive и вычисляются по backend business
      date; отменённая, ещё не начавшаяся и завершившаяся замена не даёт scope.
- [x] `Показать всё расписание` для Coach отсутствует.

## Responsive behavior
- `360 x 780`, `390 x 844`: day navigation и day list показывают только scoped entries; empty day не выглядит global-empty.
- `420 x 912`, `440 x 956`: day counts отражают scoped entries.
- `768 x 1024`, `1440 x 1200`: calendar/grid не содержит unauthorized cards или filter options.
- `912 x 420`, `956 x 440`: compact-height day navigation и empty state остаются достижимыми.

## Operational and interaction states
- Loading: явное `Загружаем расписание`.
- Empty scoped: `Для вас занятий в расписании нет`.
- Error: retry; допустимый stale scoped schedule помечается как stale, а не success.
- Permission: отсутствие групп в scope показывает empty state, а не silent redirect.
- Day tabs имеют `aria-selected`; после выбора focus остаётся на выбранном дне.

## Acceptance criteria
- [ ] Coach с ограниченным effective scope не видит unassigned global groups.
- [ ] `/schedule/groups` применяет Coach scope до `totalCount` и paging.
- [ ] Постоянное назначение и активная временная замена входят в scope;
      future, expired и cancelled substitution не входят.
- [ ] Branch/hall/trainer/group filters содержат только scoped options.
- [ ] Day counts и legend согласованы со scoped entries.
- [ ] Empty scoped schedule отличается от loading/error.
- [ ] Backend integration tests фиксируют scope; frontend tests подтверждают отсутствие чужих карточек.
- [ ] Изменения coach scope не сокращают schedule entries, counts, filter options или attendance operations SuperAdministrator.

## Test checklist
- [ ] Backend tests для coach schedule scope.
- [ ] Заменить regression
      `Coach_can_view_all_seeded_schedule_groups_without_group_management_access`
      на scoped contract.
- [ ] Сценарии direct assignment, active/future/expired/cancelled substitution,
      inclusive date boundaries и no-scope.
- [ ] Обновить affected schedule frontend/e2e tests.
- [ ] Non-regression: SuperAdministrator остаётся global и не получает coach-scoped empty copy.
- [ ] Проверить mobile, compact-height и desktop weekly grid.
- [ ] `dotnet test backend/GymCrm.slnx`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:unit`
- [ ] Запустить affected Playwright и iPhone WebKit checks.

## AI safety
- Safe for Codex: yes
- Risk level: high
- Reason: задача меняет security/data visibility contract, но определение
  effective scope уже централизовано в backend и зафиксировано integration
  tests; frontend не принимает domain decisions.

## Related tasks
- `TASK-063`: head coach group assignment.
- `TASK-073`: temporary trainer substitution.
- `TASK-080`: administrator attendance group scope.

## Source notes
- Source: usability audit of the fully rebuilt and seeded local stand.
- Evidence date: 2026-07-25.

## Visual comparison
- [Сейчас / scoped workflow](../mockups/usability-2026-07-25/TASK-087-comparison.png)
- [Описание преимуществ, вопросов и границ макета](../mockups/usability-2026-07-25/README.md#task-087-coach-schedule-effective-scope)

## Processing notes

- Reviewed at: 2026-07-26 after TASK-090 was merged to `main`.
- UI foundation dependency is complete, but TASK-090 did not change schedule
  authorization or effective-scope semantics.
- Revalidated against backend source of truth:
  `EffectiveGroupAssignmentService` already defines permanent + active
  non-cancelled substitutions, and `AccessScopeService` uses it for Coach
  attendance/session scope. `/schedule/groups` and its current regression
  still return the global list.
- Status changed to `ready`: the existing effective-assignment semantics are
  now the required schedule contract, and global view for Coach is explicitly
  out of scope.

## Completion notes

- Implementation commit `9aef59282dfd72a7bbb4d6c775b613c9bc3ee42d`
  is an ancestor of current `origin/main` through integration commit
  `7e386d1d3b412f94968e707778e2adffa76e0901`.
- `/schedule/groups` applies the existing backend effective-assignment service
  before count and paging for Coach, including permanent and active temporary
  assignments without leaking unrelated groups.
- Frontend renders the backend-scoped response, role-specific empty states and
  focus behavior without reproducing authorization semantics.
- Validation on 2026-07-30: backend tests `420/420`; frontend lint and build
  passed; unit tests `367/367`; targeted Chromium flows `46/46`; target iPhone
  WebKit `20/20`.
- Simulator/physical-device evidence remains unverified.
