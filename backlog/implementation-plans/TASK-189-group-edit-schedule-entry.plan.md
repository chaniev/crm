# Implementation Plan: TASK-189 Вход в редактор расписания из группы

## Metadata
- source_task: /backlog/implementation/TASK-189-group-edit-schedule-entry.md
- requirements: REQ-GRP-001 (changes), REQ-GRP-004 (constrains), REQ-NFR-001 (constrains)
- branch: codex/TASK-189-group-edit-schedule-entry
- readiness: yes
- product_decisions: accepted
- technical_decisions: none — используются существующие lookup серии, session permissions, series editor и локальные typed return patterns
- architecture_decisions: none — новая навигация не меняет API, data model, ownership или security boundary
- open_questions: none
- dependencies: none; TASK-188 не обязательна, рекомендуемый порядок интеграции TASK-188 → TASK-189 из-за общих frontend tests
- risk: medium — ошибочный group/series origin может открыть чужое расписание или потерять draft/контекст возврата

## Goal
Из карточки группы открыть её существующий редактор одним действием,
изменить расписание через preview/execute и вернуться в ту же карточку.

## Decisions and contracts
- `getGroupLessonSeries(groupId)` уже разрешает group ID и возвращает canonical
  `seriesId`/`groupId`, revision и backend date bounds. Уникальный индекс
  `LessonSeries.GroupId` гарантирует максимум одну серию: selection UI не нужен.
- Lookup имеет отдельные loading/error/empty состояния и не блокирует identity
  form. Переход возможен только для ответа с совпадающим groupId; route содержит
  настоящий seriesId. Отсутствие серии — `404 lesson-series-not-found`, не повод
  искать произвольное занятие или создавать серию автоматически.
- В DTO нет `allowedActions`. Используются backend session permissions и
  существующий route access; GET/preview/execute проверяют `ManageGroups` и
  `GroupManagementScope`. Не вводить роль-based проверки или новые DTO-поля.
- Новый вход передаёт `scope=this-and-future` и groupId без вымышленного occurrence
  или lessonDate. Existing `buildSeriesDraft` берёт
  `currentVersion.thisAndFutureMinEffectiveFrom`; scope и дата остаются видимыми.
  `entireSeriesEffectiveFrom`, revision/token, предупреждения и history protections
  остаются backend-owned; «вся серия» не означает переписывание истории.
- Dirty identity использует существующую схему перехода к клиенту:
  «Сохранить и перейти» → успешный narrow update → переход;
  «Перейти без сохранения» → явный discard без PUT;
  «Остаться»/Escape → draft и focus на trigger. Save failure оставляет форму и
  recovery, pending не допускает повторный save. Общий guard всего приложения
  и сохранение draft секции назначения тренеров не входят в эту задачу.
- Return origin — локальный проверяемый discriminated union для group-edit и
  существующего calendar/lesson origin. Не записывать `/groups/...` в
  `ScheduleReturnSnapshot`, который допускает только `/schedule`.
  Save, cancel и header back из series editor возвращают в исходную группу;
  дальнейший back сохраняет прежний group-list snapshot (фильтры/страницу/позицию).
- Origin проверяется по group/series и history entry. Reload сохраняет валидный
  origin. Без group-origin сохраняется прежняя развилка: после save при наличии
  lessonOccurrenceId/lessonDate — точное исходное занятие, иначе календарь;
  cancel без group-origin по-прежнему ведёт в календарь.
  Несовпадение IDs fail-closed: не отображать форму чужой серии, не выполнять
  mutation, не доверять произвольному return URL. Устаревший origin не переиспользуется.

## Decision evidence
- product: [Согласованный визуальный контракт](/backlog/mockups/TASK-188-189-group-schedule/brief.md) — owner: пользователь / владелец продукта; decision: 23.10.2026 ответом «выбираю вариант А А» выбран A для TASK-189: блок текущего расписания и вторичная кнопка «Изменить расписание» перед identity-полями; сохранены возврат в группу и существующий трёхвариантный dirty guard.
- [REQ-GRP-001](/docs/requirements/02-группы.md) уже содержит принятую целевую редакцию
  и реализацию «частично», поэтому дополнительное принятие требования не нужно.
- [GroupEditScreen](/frontend/src/features/groups/GroupEditScreen.tsx) и
  [component tests](/frontend/src/features/groups/GroupManagement.test.tsx)
  подтверждают существующий трёхвариантный dirty guard.
- [GroupLessonSeriesEndpoints](/backend/src/GymCrm.Api/Auth/GroupLessonSeriesEndpoints.cs)
  и [LessonSeriesConfiguration](/backend/src/GymCrm.Infrastructure/Persistence/Configurations/LessonSeriesConfiguration.cs)
  подтверждают lookup, охват и единственность серии.
- [Исходная задача](/backlog/implementation/TASK-189-group-edit-schedule-entry.md)
  сохраняет scope и исходное продуктовое решение.

## UX contract — выбранное направление A
- Перед identity-полями находится блок «Расписание занятий» со сводкой и
  «Изменить расписание». Кнопка видна без overflow-menu, вторична к «Сохранить».
  На mobile summary над кнопкой; на desktop они на одной линии.
- Сводка берётся только из прочитанной текущей версии серии, не из legacy
  `trainingStartTime`. Показывать все slots, включая несколько занятий одного дня;
  hall/duration объединять только при одинаковых значениях, иначе привязать к slot.
- Loading явно обозначает загрузку расписания; network/server failure показывает
  «Повторить», сохраняя identity draft. No series показывает «Расписание не найдено»
  без активного перехода; 403 показывает отказ без retry-loop или обходного route.
- После save identity в dirty guard заново подтвердить group/series lookup,
  если сохранение изменило контекст или прежний ответ устарел. Не переносить
  устаревшие dates/revision в новый editor.
- Return refetch показывает сохранённую группу/расписание, восстанавливает scroll
  и focus на «Изменить расписание». Dirty modal использует тот же focus/recovery
  pattern, что уже проверен для открытия клиента.
- Геометрия, состояния и focus contract зафиксированы в согласованном brief.

## Scope
### In
- Entry state, безопасный lookup, локальный dirty guard и typed navigation/return.
- Существующий series editor получает group identity check и group-origin return,
  не меняя domain mutation semantics.
- Requirement evidence REQ-GRP-001 и CHANGELOG после интеграции.
### Out
- Inline редактор, создание отсутствующей серии, выбор нескольких серий,
  новые права/API/schema, пересчёт истории, global navigation guard и TASK-188.

## Implementation slices
1. Покрыть и реализовать group→series entry/loading/recovery и переиспользование
   dirty guard в рамках выбранного UI-контракта.
2. Покрыть и провести typed group origin через route/navigation, series identity
   check и save/cancel/back return с сохранением group-list context.
3. Проверить полный переход с preview/execute, существующий calendar origin,
   runtime comparison и обновить requirement evidence.

## Likely files and layers
- `frontend/src/features/groups/GroupEditScreen.tsx` — entry и pending destination client/schedule.
- `frontend/src/features/groups/GroupManagement.test.tsx` — dirty/entry/recovery regression.
- `frontend/src/App.tsx`, `frontend/src/app/RouteViewport.tsx` — узкая wiring новых callbacks.
- `frontend/src/app/useAppReturnNavigation.ts`, `frontend/src/app/useAppRoute.ts` — history lifecycle.
- Новый узкий `frontend/src/features/groups/groupScheduleReturnState.ts` и tests —
  typed origin по существующему client profile return pattern, без global state.
- `frontend/src/features/schedule/GroupScheduleScreen.tsx` и tests — group identity guard;
  существующий editor state и payload сохраняются.
- `frontend/src/lib/appRoutes.ts` и tests — только если существующей route shape
  недостаточно; групповой origin хранить в typed history, не произвольном URL.
- `frontend/src/App.test.tsx`, `frontend/e2e/group-schedule.spec.ts`,
  `frontend/e2e/iphone-target-devices.spec.ts` — route и browser coverage.
- `frontend/src/resources/fe-13-groups-core.ts` — entry/recovery copy.

## Regression specification
### Automated tests to add or update
- Group component: lookup строго по groupId; returned seriesId отличается от
  groupId; совпадение groupId обязательно. Loading/retry/404/403 показывают разные
  состояния; identity редактируется при failed lookup; late response другой
  группы игнорируется; canManageGroups=false не получает работающее действие.
- Summary показывает все slots одного дня и разные hall/duration без ложного
  общего значения; длинный текст переносится и не прячет кнопку перехода.
- На новом schedule trigger повторить existing dirty cases: pristine,
  cancel/Escape+focus, discard без PUT, один successful identity save до перехода,
  validation/server error с сохранённым draft. Сохранить аналогичные client tests.
- Editor: mismatch route.groupId/response.groupId блокирует форму и mutation;
  date default использует backend min, без occurrence assumptions. После изменения
  slot/scope/date снимается preview; stale revision/token оставляет draft.
- Navigation/App: group A → series A → save/cancel/back → group A, focus/scroll,
  затем назад в прежний group-list; reload, direct link, чужой history entry,
  несовпадающий origin и последовательные открытия A/B. Не возвращать пользователя
  в группу A после открытия серии B.
- Сохранить `series edit route previews and applies exact backend series contract`,
  identity-only payload regression и browser case
  `series edit route previews, applies and returns to exact source lesson`.
- Playwright primary: карточка → редактор → изменить время → preview → execute →
  исходная группа → повторное открытие и календарь. Failure: save dirty identity
  отказывает, draft остаётся; retry проходит. Restricted: backend 403 на lookup
  или editor, отсутствие mutation. Проверить geometry и dirty modal на mobile.

### Expected red evidence
- Новый component test не найдёт «Изменить расписание»; App return test сейчас
  попадёт в календарь; mismatch test обнаружит отсутствие group identity check.
- Existing read/scope/token API tests уже green по текущему контракту; их не
  переписывать для создания искусственного red.

### Required validation
- Task verification contract добавляет browser group-origin cases и оба iPhone
  проекта. Нынешний `testMatch` target-iPhone не включает `group-schedule.spec.ts`:
  общий helper вызывать из `iphone-target-devices.spec.ts` либо включить task spec
  явно; пустой запуск не считается проверкой.
- Contract evidence: существующие `Lesson_series_read_returns_reload_safe_current_slots_revision_and_supports_series_id_lookup`,
  `Lesson_series_read_enforces_group_management_scope`,
  `Lesson_series_execute_rejects_stale_revision_after_concurrent_series_change`
  и `Group_update_ignores_legacy_schedule_fields`; targeted запуск при проверке
  интеграции с backend. Production backend в scope не меняется.

### Manual evidence
- Runtime comparison entry/dirty/error с выбранным концептом и возвратом focus;
  device-only ограничения mobile skill отметить отдельно без заявления о
  проверке реальной Safari-клавиатуры по одному Chromium screenshot.

### Regression barrier
App/router round-trip c различными groupId/seriesId и несовпадающим origin плюс
browser preview/execute→group защищают корректную серию и контекст возврата.

## Risks and stop conditions
- После identity save охват или branch могут измениться: lookup не должен
  продолжить переход на основании старого разрешения. Отказ остаётся видимым.
- Не расширять задачу на сохранение drafts вложенных trainer/substitution forms;
  если согласованный UI потребует такого поведения, вернуть affected plan в planning.
- Если фактический контракт больше не гарантирует одну серию или требует новых
  API/security решений, остановить dependent slice и согласовать обновлённый план.
- Если выбранный A невозможно сохранить без изменения workflow, вернуть
  затронутую часть в planning; runtime comparison проверяет уже согласованный UI.
