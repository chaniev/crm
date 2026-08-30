# Implementation Plan: TASK-168 Наполнить раздел «Посещения» занятиями на сегодня

## Metadata
- source_task: /backlog/implementation/TASK-168-attendance-today-worklist.md
- requirements: REQ-ATT-006 (changes), REQ-ATT-001 (constrains), REQ-ATT-003 (constrains), REQ-GRP-005 (constrains), REQ-NFR-001 (constrains)
- branch: feature/TASK-168-attendance-today-worklist
- readiness: yes — production UI начинается только после обязательного UX/rendered-direction gate и выбора product owner
- dependencies: none
- risk: medium — новый read contract агрегирует occurrence, access scope и roster-derived count, а material change landing workflow требует отдельного design acceptance до реализации

## Goal
На `/attendance` пользователь получает backend-authorized список занятий CRM-дня `today`, видит группу, время и точное количество `Не отмечено`, открывает workbench выбранного `lessonOccurrenceId` одним действием и возвращается в сохранённый контекст списка.

## Domain/API contract
- Добавить dedicated staff read `GET /attendance/lessons/today` без browser-supplied date. Backend берёт `today` из принятого `IAttendanceDatePolicy`/CRM local-day contract и применяет тот же effective attendance scope, включая активные замещения и occurrence-scoped access, что и существующие schedule/roster reads.
- Ответ: `today` и ordered `items`; row содержит `lessonOccurrenceId`, `lessonDate`, `groupId`, `groupName`, `startTime`, `endTime`, `branchName`, `hallName`, `effectiveTrainers`, backend action decision для открытия attendance и `unmarkedClientCount`.
- Backend определяет, какие projected/materialized occurrences являются worklist items, их stable identity, порядок и allowed action; frontend не фильтрует по роли, расписанию, статусу или дате самостоятельно.
- `unmarkedClientCount` эквивалентен числу активных клиентов roster точного occurrence со state `Unmarked`: нет сохранённой `Present`/`Absent` записи для этого `lessonOccurrenceId`. Группа+дата или `hasAttendanceMarks` не заменяют occurrence identity/count.
- Contract read-only: attendance save/reset, membership entitlement, audit и date-window semantics не меняются. Partial/stale row не маскируется нулём; contract/mapping failure остаётся recoverable error state.

## UX contract and design gate
- Primary user: Coach/Administrator на mobile в начале рабочего дня; HeadCoach/SuperAdministrator открывают тот же раздел из навигации. Completion signal — открыт exact occurrence workbench; после возврата сохранены row anchor/scroll и список можно продолжить.
- Primary content сразу после persistent navigation: ordered today worklist. Каждая строка даёт decision data (группа, время, локация/тренер по выбранной иерархии), backend count `Не отмечено` и одно видимое frequent action; без дублирующего route heading/hero.
- До production code: зафиксировать UX contract и visual brief, отрендерить три различающихся направления на `390 x 844` и `1440 x 1200` с populated и consequential non-happy state, получить выбор product owner и преобразовать его в implementation-ready responsive contract.
- Design contract обязан покрыть loading, empty, full error + retry, partial/stale row, restricted action, long content, focus/back behavior и mobile/desktop transformation. Никакое направление не может добавлять frontend-owned attendance semantics.

## Scope
### In
- Dedicated backend today-worklist query/DTO, typed frontend client/mapping, `/attendance` landing, source-aware occurrence navigation/return context, component/API/backend/Playwright coverage и rendered design acceptance.

### Out
- Attendance mutations и roster composition после входа, будущие/исторические даты, schedule filters, navigation order/landing roles, новый persisted schema, bot contract.

## Implementation slices
1. Design gate: собрать rendered current-state evidence, оформить UX contract/brief, три направления, recorded selection и final responsive/interaction contract; остановить production implementation до выбора.
2. Backend RED→green: contract tests для CRM `today`, exact occurrence identity/order, role/scope/substitution boundaries и `unmarkedClientCount`; реализовать dedicated read, переиспользуя существующие occurrence/access/roster semantics вместо их копирования в endpoint.
3. Frontend client RED→green: typed endpoint, strict mapper и facade export; invalid/partial payload не превращается в пустой успешный список или нулевой count.
4. Landing RED→green: заменить placeholder today worklist, реализовать loading/empty/error/retry/restricted/partial states по выбранному contract; row action принимает только backend `lessonOccurrenceId` + `lessonDate`.
5. Return context: отличать вход из schedule от входа из `/attendance`; после workbench/browser back вернуть соответствующий origin, focus к исходной строке и прежнюю scroll position без ложного schedule snapshot.
6. Browser/rendered acceptance: primary flow и recovery/scope edges на mobile/desktop, отсутствие overflow, target-iPhone/compact-height checks и runtime comparison с выбранным направлением.

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
- Backend: `today` comes from date policy; projected and materialized same-day lessons keep unique occurrence IDs and stable time order; Coach/Administrator/management scope and active substitution are enforced; inaccessible items/actions are absent or restricted only per backend decision.
- Backend count: active roster clients without exact-occurrence marks count as `Unmarked`; `Present`/`Absent` reduce count; marks for another same-group/date occurrence do not; reset to `Unmarked` restores count; cancelled/unavailable occurrence handling matches shared backend projection rather than frontend filtering.
- API mapper: valid payload maps decision fields/count/action; missing identity/date/count or malformed row rejects/stales the response instead of inventing defaults.
- Component: populated/loading/empty/error+retry/partial/restricted and long-name states; exact row opens the expected occurrence; no legacy schedule-link placeholder.
- Navigation: entry from `/attendance` returns to saved row focus/scroll; entry from `/schedule` preserves existing schedule return snapshot; back/forward and scope refresh do not restore stale unauthorized rows.
- Playwright: Coach and Administrator primary flow landing → exact lesson → attendance → return; HeadCoach/SuperAdministrator navigation access; one API failure+retry; one empty/restricted scope; no horizontal overflow on `360/390/420/440`, tablet/desktop transformation, compact-height smoke and target-iPhone WebKit.

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
- One end-to-end target-iPhone + Chromium scenario: backend-scoped today list shows exact `unmarkedClientCount`, opens the selected `lessonOccurrenceId`, and returns to the originating row without overflow or context loss.

## Risks and stop conditions
- Stop before production UI until product owner selects/refines a rendered direction; a compile-green first layout is not design acceptance.
- Stop if implementation would derive scope, date, occurrence eligibility or count in frontend, or count by group/date instead of exact occurrence.
- Stop if the dedicated read cannot reuse a single backend occurrence/access source without diverging from schedule/roster semantics; extract a focused application query seam before continuing.
- Stop and request a product decision if existing accepted requirements do not determine whether a newly discovered occurrence state belongs in the today worklist; do not silently hide or relabel it.
- No schema migration is expected. If aggregation requires persisted counters or destructive data changes, reclassify risk and review the data plan first.
