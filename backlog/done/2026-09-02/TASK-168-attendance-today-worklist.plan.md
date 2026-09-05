# Implementation Plan: TASK-168 Наполнить раздел «Посещения» занятиями на сегодня

## Metadata
- source_task: /backlog/done/2026-09-02/TASK-168-attendance-today-worklist.md
- requirements: REQ-ATT-006 (changes), REQ-ATT-001 (constrains), REQ-ATT-003 (constrains), REQ-GRP-005 (constrains), REQ-NFR-001 (constrains)
- branch: feature/TASK-168-attendance-today-worklist
- readiness: yes — production UI начинается только после обязательного UX/rendered-direction gate и выбора product owner
- dependencies: none
- risk: medium — новый read contract агрегирует occurrence, access scope и roster-derived count, а material change landing workflow требует отдельного design acceptance до реализации

## Goal
На `/attendance` пользователь получает backend-authorized список требующих действия занятий CRM-дня `today`, упорядоченный по времени начала. Каждая строка имеет `unmarkedClientCount > 0`, доступна для открытия и ведёт в workbench точного `lessonOccurrenceId`. После возврата список актуализируется с сохранением контекста.

## Domain/API contract
- Добавить dedicated staff read `GET /attendance/lessons/today` без browser-supplied date. Backend берёт `today` из принятого `IAttendanceDatePolicy`/CRM local-day contract и применяет тот же effective attendance scope, включая активные замещения и occurrence-scoped access, что и существующие schedule/roster reads.
- Ответ: `today` и ordered `items`; row содержит `lessonOccurrenceId`, `lessonDate`, `groupId`, `groupName`, `startTime`, `endTime`, `branchName`, `hallName`, `effectiveTrainers`, backend action decision для открытия attendance и `unmarkedClientCount`.
- Backend возвращает только `Scheduled` occurrences с разрешённым открытием attendance и `unmarkedClientCount > 0`; `Cancelled`, недоступные и полностью отмеченные occurrences исключаются. Принятый lifecycle остаётся `Scheduled | Cancelled`; TASK-168 не вводит `NotHeld`. Frontend не фильтрует по роли, расписанию, статусу, count или дате самостоятельно.
- Backend сортирует items по `startTime`, а при равном времени использует stable occurrence identity как deterministic tie-breaker.
- `unmarkedClientCount` эквивалентен числу активных клиентов roster точного occurrence со state `Unmarked`: нет сохранённой `Present`/`Absent` записи для этого `lessonOccurrenceId`. Группа+дата или `hasAttendanceMarks` не заменяют occurrence identity/count.
- Contract read-only: attendance save/reset, membership entitlement, audit и date-window semantics не меняются. Invalid row не маскируется нулём и не превращает весь ответ в full error: она пропускается, корректные строки сохраняются, а frontend показывает неблокирующее partial-result сообщение с retry.

## UX contract and design gate
- Primary user: Coach/Administrator на mobile в начале рабочего дня; HeadCoach/SuperAdministrator открывают тот же раздел из навигации. Completion signal — открыт exact occurrence workbench; после возврата сохранены row anchor/scroll и список можно продолжить.
- Primary content сразу после persistent navigation: ordered today worklist. Каждая строка даёт decision data (группа, время, локация/тренер по выбранной иерархии), backend count `Не отмечено` и одно видимое frequent action; без дублирующего route heading/hero.
- До production code: зафиксировать UX contract и visual brief, отрендерить три различающихся направления на `390 x 844` и `1440 x 1200` с populated и consequential non-happy state, получить выбор product owner и преобразовать его в implementation-ready responsive contract.
- Design contract обязан покрыть loading, единый empty для пустого дня/охвата, full error + retry, partial result, stale-action recovery, long content, focus/back behavior и mobile/desktop transformation. Штатного restricted-row state нет. Никакое направление не может добавлять frontend-owned attendance semantics.

## Scope
### In
- Dedicated backend today-worklist query/DTO, typed frontend client/mapping, `/attendance` landing, source-aware occurrence navigation/return context, component/API/backend/Playwright coverage и rendered design acceptance.

### Out
- Attendance mutations и roster composition после входа, будущие/исторические даты, schedule filters, navigation order/landing roles, новый persisted schema, bot contract.

## Implementation slices
1. Design gate: direction C selected by product owner on 2026-09-01; UX contract, brief, alternatives, selection record and responsive/interaction contract are stored under `backlog/mockups/TASK-168-attendance-today-worklist/`.
2. Backend RED→green: contract tests для CRM `today`, exact occurrence identity, start-time order, role/scope/substitution boundaries, excluded `Cancelled`/`NotHeld`/disallowed occurrences и `unmarkedClientCount > 0`; реализовать dedicated read, переиспользуя существующие occurrence/access/roster semantics вместо их копирования в endpoint.
3. Frontend client RED→green: typed endpoint, per-row strict mapper и facade export; invalid row пропускается с partial-result signal, не превращает count в ноль и не скрывает корректные rows.
4. Landing RED→green: заменить placeholder today worklist, реализовать loading/unified-empty/error/retry/partial-result/stale-action states по выбранному contract; row action принимает только backend `lessonOccurrenceId` + `lessonDate`.
5. Return context and refresh: отличать вход из schedule от входа из `/attendance`; после workbench/browser back вернуть соответствующий origin, автоматически актуализировать today worklist и восстановить его row anchor/scroll без ложного schedule snapshot. Если исходная строка исчезла после актуализации, final focus fallback определить в design contract.
6. Explicit refresh: добавить понятное обновление по запросу пользователя; не вводить timer/day-rollover auto-refresh.
7. Browser/rendered acceptance: primary flow и recovery/scope edges на mobile/desktop, отсутствие overflow, target-iPhone/compact-height checks и runtime comparison с выбранным направлением.

## Likely files and layers
- `backend/src/GymCrm.Api/Auth/AttendanceEndpoints.cs` и новые focused `AttendanceToday*Response.cs` — endpoint composition/DTO.
- `backend/src/GymCrm.Application/Attendance/**` или existing scheduling query seam — shared occurrence/access/count projection; точное место определить до editing, не дублировать private schedule projection.
- `backend/tests/GymCrm.Tests/AttendanceApiTests.cs` и при необходимости focused new test file — staff contract/access/count regression.
- `frontend/src/lib/api/endpoints.ts`, `frontend/src/lib/api/attendance.ts`, `frontend/src/lib/api/types.ts`, `frontend/src/lib/api.ts` — typed consumer contract/facade.
- `frontend/src/features/attendance/AttendanceScreen.tsx` и новые focused today-worklist component/state files — landing workflow.
- `frontend/src/app/useAppReturnNavigation.ts`, `frontend/src/App.tsx`, `frontend/src/app/RouteViewport.tsx` и focused route tests — source-aware navigation/return snapshot.
- `frontend/src/features/attendance/AttendanceScreen.test.tsx`, focused API tests, `frontend/e2e/attendance.spec.ts`, `frontend/e2e/iphone-target-devices.spec.ts` — component and browser barriers.
- `backlog/mockups/TASK-168-attendance-today-worklist/` — rendered alternatives, selection record и final visual contract created by executor during design gate.

## Regression specification
### Automated tests to add or update
- Backend: `today` comes from date policy; projected and materialized same-day lessons keep unique occurrence IDs and stable start-time order; Coach/Administrator/management scope and active substitution are enforced; inaccessible, disallowed and `Cancelled` items are absent.
- Backend count: active roster clients without exact-occurrence marks count as `Unmarked`; `Present`/`Absent` reduce count; marks for another same-group/date occurrence do not; reset to `Unmarked` restores count; only occurrences with count greater than zero are returned, and reaching zero removes the item on the next refresh.
- API mapper: valid payload maps decision fields/count/action; missing identity/date/count or malformed row is omitted with a partial-result signal instead of inventing defaults or discarding valid rows.
- Component: populated/loading/unified-empty/error+retry/partial-result/stale-action and long-name states; every rendered row has an enabled action and opens the expected occurrence; no legacy schedule-link placeholder.
- Navigation: entry from `/attendance` returns, refreshes data, and restores the saved row/scroll context when still present; entry from `/schedule` preserves existing schedule return snapshot; back/forward and scope refresh do not restore stale unauthorized rows; day rollover alone does not trigger refresh.
- Playwright: Coach and Administrator primary flow landing → exact lesson → attendance → return+refresh, including removal after count reaches zero; HeadCoach/SuperAdministrator navigation access; one API failure+retry; one unified empty scope; one partial-result case; no horizontal overflow on `360/390/420/440`, tablet/desktop transformation, compact-height smoke and target-iPhone WebKit.

### Expected red evidence
- Backend contract tests fail because `/attendance/lessons/today` and `unmarkedClientCount` do not exist.
- Frontend landing tests fail because top-level `AttendanceScreen` renders the schedule-link placeholder and intentionally makes no today-worklist request.
- Return-context test fails because attendance navigation currently always uses schedule return-state handling.

### Required validation
- Root verification harness for backend+frontend contract diff with `--task-id TASK-168` after adding the task verification contract; focused Attendance API tests; affected attendance Chromium flow and target-iPhone projects.

### Manual evidence
- Rendered alternatives and selected-direction record before implementation; after implementation compare populated, error/retry and long-content states at `390 x 844` and `1440 x 1200`.
- Report Simulator/physical-device gaps for Safari chrome, real safe area, home indicator and one-handed reach.

### Regression barrier
- One end-to-end target-iPhone + Chromium scenario: backend-scoped today list shows exact `unmarkedClientCount`, opens the selected `lessonOccurrenceId`, and returns to the refreshed list without overflow or context loss; if the count reaches zero, the completed row is absent.

## Risks and stop conditions
- Stop before production UI until product owner selects/refines a rendered direction; a compile-green first layout is not design acceptance.
- Stop if implementation would derive scope, date, occurrence eligibility or count in frontend, or count by group/date instead of exact occurrence.
- Stop if the dedicated read cannot reuse a single backend occurrence/access source without diverging from schedule/roster semantics; extract a focused application query seam before continuing.
- Stop and request a product decision if a newly discovered occurrence state is neither actionable `Scheduled` nor excluded `Cancelled`; do not silently include, hide or relabel it.
- No schema migration is expected. If aggregation requires persisted counters or destructive data changes, reclassify risk and review the data plan first.
