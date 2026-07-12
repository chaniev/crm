# Implementation Plan: TASK-064 Разделить главную на вкладки «Посещения» и «Абонементы»

## Source task
/backlog/risky/TASK-064-home-attendance-membership-tabs.md

Source task remains in `/backlog/risky` until explicit risky-task implementation review/selection.

## Implementation branch
feature/TASK-064-home-attendance-membership-tabs

Branch rules:
- create this branch from an up-to-date `main` before writing project code;
- before branch creation, switch to `main`, run `git pull`, and verify `git status` is clean;
- stop if the base branch or worktree state is unclear;
- do not implement unrelated TASKs or broad refactoring in this branch;
- confirm the branch is active before changing backend, frontend, bot, schema, or tests.

## Goal
Сделать `Главную` компактным permission-aware рабочим экраном: по умолчанию показывать отметку посещений, вынести контроль абонементов в независимую вкладку, честно различать `Unmarked`, `Present`, `Absent`, безопасно восстанавливать связанное разовое посещение при исправлении отметки и сохранять все attendance/membership изменения вместе с аудитом.

## Current understanding
- `TASK-059` уже объединила главную и посещения: отдельный frontend-маршрут `/attendance` удалён и не должен возвращаться.
- `frontend/src/features/home/HomeDashboard.tsx` сейчас последовательно рендерит сначала большой membership attention block, затем `AttendanceWorkspace`; обе области имеют независимые запросы, но вкладок нет.
- `PageLayout` всегда показывает H1 из обязательного `title`, поэтому видимый `Главная` нельзя убрать только параметрами текущего `HomeDashboard`.
- `AttendanceWorkspace` хранит выбранные группу, дату и roster локально. Если панель оставить смонтированной, это состояние естественно сохранится при переключении вкладок без глобального store.
- На mobile группа и дата сейчас попадают в `CompactFilterPanel`/drawer, что противоречит постоянному контексту операции из acceptance criteria.
- Текущий frontend использует `Switch` и boolean `isPresent`; mapper подставляет `false` и при отсутствующей записи, поэтому `Не отмечено` и `Не был` неразличимы.
- Backend уже хранит `IsPresent = true/false`, а уникальный индекс `(ClientId, GroupId, TrainingDate)` уже существует. Целевая модель может использовать отсутствие строки как `Unmarked`, строку `true` как `Present`, строку `false` как `Absent` без nullable attendance-state колонки.
- `AttendanceService.SaveAsync` сейчас создаёт/обновляет только boolean-строки, списывает разовое посещение при переходе в `true`, но не умеет удалять отметку и восстанавливать списание.
- Текущая запись attendance/membership завершается транзакцией внутри `AttendanceService`, а web audit пишется в `AttendanceEndpoints` после возврата из service. Это не гарантирует атомарность business mutation и обязательного аудита.
- У attendance сейчас нет ссылки на конкретное разовое списание. Восстанавливать произвольный текущий `SingleVisitUsed = true` небезопасно: он мог быть списан другой отметкой или изменён позднее.
- Внутренний bot вызывает тот же `IAttendanceService` с boolean marks. Изменения shared service и error enum затронут `BotApiService`, даже если публичный Python bot contract останется boolean и не получит reset UX.
- Backend web attendance save пока не запрещает будущую дату. Bot имеет отдельный date guard, но правило должно находиться в общей backend attendance semantics.
- Backend пока не имеет единой business timezone configuration/date provider; прямое использование UTC-date в bot не соответствует согласованной календарной зоне клуба около полуночи.
- По текущим backend permissions: `canMarkAttendance` даёт вкладку посещений, `canManageClients` — вкладку абонементов. Frontend не должен выводить это из `role`.
- Уточнённая TASK является источником истины поверх раннего макета/source note: массового `Отметить всех` и перехода на будущую дату в целевой композиции нет.
- Reference mockup остаётся ориентиром композиции; обязательные текстовые требования полностью сохранены в TASK/source note и имеют приоритет при расхождении.

## Architecture decisions to lock before UI work
1. Ввести один backend-owned enum/value contract `AttendanceState` со значениями `Unmarked`, `Present`, `Absent` в Application/API и соответствующий string union во frontend.
2. Сохранять модель без отдельной строки для `Unmarked`:
   - `Unmarked` в GET — подходящая attendance-строка отсутствует;
   - `Present` — строка существует и `IsPresent = true`;
   - `Absent` — строка существует и `IsPresent = false`;
   - сохранение `Unmarked` удаляет существующую строку, но формирует change result для аудита до удаления.
3. Не восстанавливать разовый абонемент только по признаку `SingleVisitUsed`. Хранить на attendance обе nullable provenance-ссылки:
   - `SingleVisitMembershipSaleId` — stable sale lineage;
   - `SingleVisitWriteOffMembershipId` — конкретная membership-version, созданная именно этим списанием;
   - заполнять их только когда именно эта attendance mutation успешно списала разовое посещение;
   - при `Present -> Absent/Unmarked` восстанавливать только exact write-off version в той же sale lineage и только если текущая membership lineage доказуемо продолжает именно это списание без конфликтующей correction/renewal/re-write-off;
   - очищать связь после восстановления; для `Unmarked` затем удалять attendance-строку;
   - legacy/seed attendance без provenance не должна восстанавливать произвольный абонемент.
4. Добавить отдельную membership operation/reason для восстановления, например `SingleVisitRestore`, а не маскировать восстановление как `Correction`.
5. Выполнять attendance mutation, write-off/restore и обе domain audit-записи в одной database transaction. Локализовать orchestration в общем backend use case/coordinator, используемом web endpoint и internal bot; не оставлять обязательный audit после уже committed mutation.
6. Оставить coarse `BotAttendanceSaved` audit, если он нужен bot idempotency, но дополнительно гарантировать те же domain attendance и membership audit entries, что и для web mutation.
7. Ввести единую настраиваемую business timezone на backend и backend-owned business date provider поверх `TimeProvider`:
   - timezone задаётся конфигурацией приложения и валидируется при старте; начальное значение для текущего окружения — `Europe/Moscow`;
   - `today` вычисляется преобразованием `TimeProvider.GetUtcNow()` в настроенную timezone, а не через прямой `DateTime.UtcNow.Date`;
   - общий attendance use case использует этот provider для запрета будущей даты;
   - backend возвращает authoritative business `today`/`maxTrainingDate` в attendance contract, frontend использует его для initial date и navigation limits и не дублирует timezone rule;
   - web возвращает стабильный ProblemDetails field `trainingDate`, internal bot — существующую domain-ошибку.
8. Сохранить текущий уникальный индекс. Schema change нужна только для двух provenance-полей/связей; nullable `IsPresent` не вводить.

## Execution steps

### Phase 0 — execution gate and baseline
1. Получить явное разрешение на выполнение risky-задачи, затем подготовить `feature/TASK-064-home-attendance-membership-tabs` от актуального чистого `main`.
2. Перечитать `AGENTS.md`, `backend/AGENTS.md`, `frontend/AGENTS.md`, source TASK и этот план.
3. Зафиксировать baseline целевых тестов до правок:
   - `dotnet test backend/GymCrm.slnx`;
   - `cd frontend && npm run test:unit`;
   - affected Playwright attendance/home tests, если локальный стенд доступен.
4. Выполнить source search всех consumers: `AttendanceMarkCommand`, `IsPresent`, `AttendanceClientResponse`, `SingleVisitWriteOff`, `AttendanceUpdated`, internal bot save, frontend mocks/e2e. Не считать web frontend единственным потребителем shared service.

### Phase 1 — backend tri-state contract and persistence
5. Добавить `AttendanceState` в `GymCrm.Application.Attendance` и заменить boolean в `AttendanceMarkCommand`, change result и save result на явное state value.
6. Обновить web request/response DTO:
   - save mark принимает `State` (`Unmarked|Present|Absent`);
   - roster client и save response возвращают `State`;
   - malformed/unknown state даёт ValidationProblem, а не silently coerces to `Absent`;
   - если нужен краткий compatibility period, сделать его явно протестированным и удалить двойственную семантику до завершения TASK.
7. Изменить roster mapping: искать конкретную строку по group/date и map-ить отсутствие/true/false в три состояния, не использовать `Any(... && IsPresent)`.
8. Изменить mutation algorithm:
   - `Unmarked -> Present/Absent` создаёт строку;
   - `Present <-> Absent` обновляет существующую строку;
   - `Present/Absent -> Unmarked` удаляет строку;
   - same-state request idempotent: не меняет timestamp, membership и audit;
   - change result хранит nullable previous/current states и стабильный attendance id для audit reset.
9. Добавить общий `TrainingDateInFuture` mutation error и guard до любых persistence/audit effects. Использовать injected backend business date provider с фиксируемыми в тестах `TimeProvider` и timezone.

### Phase 2 — safe single-visit provenance, restore and atomic audit
10. Добавить обе nullable provenance relation в `Attendance` и EF configuration: stable `ClientMembershipSale.Id` и конкретный `ClientMembership.Id`, созданный `SingleVisitWriteOff`. Настроить явные FK delete behaviors и индексы; восстановление обязано проверять пару sale/version и отсутствие конфликтующей membership lineage после списания.
11. Обновить воспроизводимую начальную схему (`InitialCreate`, designer/model snapshot) согласно текущей early-stage repository policy. Текущую БД и production data сохранять не требуется: deployment выполняется с нуля на чистой базе. Forward migration и provenance backfill не входят в TASK.
12. Расширить `IClientMembershipService` локальными операциями:
   - write-off возвращает применённую sale lineage, ID созданной write-off membership-version и before/after snapshots;
   - restore принимает ожидаемые sale ID и write-off membership-version ID, проверяет current membership/type/used state и непрерывность допустимой lineage, затем создаёт новую membership version с `SingleVisitRestore`;
   - отсутствие provenance означает, что восстанавливать нечего; наличие provenance при несовпадении sale/version или невозможности доказать exact restore возвращает стабильную domain-ошибку `SingleVisitRestoreConflict` (точное имя зафиксировать в contract) и не считается успешным no-op.
13. При переходе в `Present` сохранять обе provenance-ссылки только если write-off действительно применён этой mutation. Не присваивать существующее ранее списание новой attendance-записи.
14. При `Present -> Absent` и `Present -> Unmarked` вызывать restore только по сохранённой паре provenance. Если provenance есть, но exact restore невозможен, откатывать attendance, membership и audit целиком и возвращать стабильную domain-ошибку. Только после успешного restore очищать provenance/удалять attendance соответственно.
15. Для legacy/seed attendance без provenance state можно исправить, но unrelated single visit не восстанавливается. Backfill не выполняется; deployment использует чистую БД, а это поведение остаётся защитой для явно созданных seed/test rows без provenance.
16. Добавить audit state с явным `State`, включая `Unmarked` как new state для reset, и отдельные constants/resources/action type для `ClientMembershipSingleVisitRestored`.
17. Перенести orchestration mutation + audit в один transaction boundary:
   - attendance audit для create/update/reset;
   - membership audit для write-off/restore;
   - commit только после успешной записи всех обязательных audit entries;
   - rollback attendance и membership при audit/persistence failure.
18. Обновить internal `BotApiService` adapter:
   - bot boolean `true/false` map-ится в `Present/Absent`;
   - shared future-date error корректно map-ится в bot error;
   - bot использует тот же backend business date provider и настроенную timezone, что и web use case;
   - shared restore-conflict error корректно map-ится в стабильную bot domain-ошибку без частичного сохранения;
   - shared mutation не теряет domain attendance/membership audit;
   - Python bot reset/tri-state UI не добавляется без отдельного product scope.

### Phase 3 — frontend typed API and local attendance state
19. Обновить `frontend/src/lib/api/types.ts` и `frontend/src/lib/api/attendance.ts`:
   - `AttendanceState = 'Unmarked' | 'Present' | 'Absent'`;
   - mapper не подставляет `false` при отсутствующем поле;
   - save/reset payload отправляет `State`;
   - response parser обрабатывает authoritative saved state;
   - добавить focused API mapper/request tests.
20. Разделить oversized attendance file на focused feature components без переноса business rules:
   - `AttendanceWorkspace` — group/date/roster/cache/request version;
   - `AttendanceContextControls` — group + date navigation;
   - `AttendanceProgress` — отмечено N из M;
   - `AttendanceClientRow`;
   - `AttendanceStateControl`;
   - `AttendanceSaveStatus`.
21. Заменить `Switch` доступным mutually-exclusive radio/segmented control с тремя текстовыми значениями. Для каждого клиента использовать доступное group label с именем; состояние показывать текстом/checked icon, не только цветом.
22. Хранить для клиента как минимум `displayedState`, `persistedState`, `saveState`, `attemptedState`:
   - optimistic choice немедленно обновляет progress;
   - pending блокирует только этого клиента;
   - success фиксирует authoritative response;
   - failure остаётся явно `Не сохранено` и даёт row-level `Повторить` для exact attempted state;
   - request/context version не позволяет старому response перезаписать новый group/date или более новое действие.
23. Не перезагружать весь roster с destructive replacement после каждого клика. Если backend response не содержит membership-derived обновление, выполнить targeted/background refresh и merge, не затирая pending/failed edits других клиентов.
24. Progress считает `Present` и `Absent` отмеченными, `Unmarked` — оставшимися; save failure отдельно показывает, что локальный выбор ещё не подтверждён.
25. Удалить массовое действие `Отметить всех` из UI, tests и mockup-derived expectations.

### Phase 4 — home tabs, memberships and header
26. Перекомпоновать `HomeDashboard` только по `user.permissions`:
   - обе области доступны: controlled Mantine Tabs, default `attendance`;
   - только attendance: прямой panel без ложного tablist;
   - только memberships: прямой panel без ложного tablist;
   - ни одной: существующий access-denied state.
27. Не использовать `keepMounted={false}` и не key-ить panels по active tab. `AttendanceWorkspace` должен остаться смонтированным, чтобы group/date/local state не сбрасывались и запросы не повторялись при каждом tab switch.
28. Выделить `MembershipAttentionPanel` с собственными loading/error/refresh/last-success state. Badge вкладки:
   - до первого ответа показывает loading placeholder, а не ложный `0`;
   - после success показывает exact `clients.length`;
   - refresh остаётся внутри membership panel.
29. Сделать compact positive state `С абонементами всё в порядке` и сохранить compact problem list с одной причиной, сроком, оплатой и действием открытия клиента.
30. Убрать видимый `Главная` через узкую явную возможность `PageLayout` (`showHeader={false}` или эквивалент с shared test), а не через случайный CSS. Название `Главная` в desktop/mobile navigation и route mapping не менять.
31. Использовать Mantine Tabs semantics и видимый `:focus-visible`; tab triggers не менее 44 px. Panel loading/error/empty не поднимать на уровень всей страницы.

### Phase 5 — responsive attendance context and date restriction
32. Убрать group/date из `CompactFilterPanel` drawer для этой feature:
   - desktop/tablet: компактный bounded context cluster;
   - mobile: группа видима постоянно, date navigation доступна одной рукой;
   - previous / `Сегодня` / next; next disabled на authoritative backend business `today`;
   - если остаётся native date input, поставить `max` из backend-provided `maxTrainingDate`.
33. На desktop держать иерархию `tabs -> context -> group/session -> progress -> roster`; не растягивать связанные controls по краям 1440/1920 px.
34. На mobile переносить client actions под identity; на 320–390 px `Не отмечено` может занимать первую строку, а `Был`/`Не был` — вторую. Все touch targets минимум 44 px, имя и secondary membership warning переносятся без page overflow.
35. Добавить compact `aria-live="polite"` save status и visible progressbar semantics. Disabled future action получает понятное accessible name/reason.
36. Сохранить padding/scroll behavior так, чтобы последняя строка и actions не перекрывались mobile bottom navigation.

### Phase 6 — validation and review
37. Выполнить backend integration/regression tests и полную backend suite.
38. Выполнить frontend unit/component tests, lint и build.
39. Выполнить Playwright home/attendance flows и responsive suite на 320, 390, 440, 768, 1440, 1920 px; проверять `scrollWidth <= clientWidth`, видимость controls и отсутствие перекрытия bottom nav.
40. Провести keyboard/accessibility check: Tab entry, ArrowLeft/ArrowRight/Home/End tabs, visible focus, radio choice, retry.
41. Провести ручную visual review desktop/mobile относительно reference mockup, учитывая TASK overrides: без bulk action и без будущей даты.
42. Финальным source search подтвердить отсутствие boolean collapse и stale consumers: `isPresent`, `IsPresent`, `AttendanceMarkCommand`, `SingleVisitWriteOff`, `Отметить всех`, old Switch labels, obsolete mock payloads.

## Preferred implementation strategy
1. Contract and transaction first: backend tri-state, provenance, restore, audit and future-date guard до UI.
2. Regression-first for the dangerous transition: automated `Present -> Absent/Unmarked` test must prove exact membership restore and both audit entries before frontend integration.
3. Shared-service consumer compatibility: update web and internal bot adapters together; do not duplicate domain rules in frontend or Python bot.
4. Typed frontend integration: API mapper/request tests before replacing the visual control.
5. Preserve component state by mounting strategy, not global state.
6. Small verifiable commits by phase in the same TASK branch; do not split backend/frontend into branches that can drift contractually.

## Files likely to change

### Backend domain/application/infrastructure
- `backend/src/GymCrm.Application/Attendance/IAttendanceService.cs`
- likely new `backend/src/GymCrm.Application/Attendance/AttendanceState.cs`
- new backend business timezone/date contracts and implementation, exact configuration path to be discovered before editing
- `backend/src/GymCrm.Application/Clients/IClientMembershipService.cs`
- `backend/src/GymCrm.Domain/Attendance/Attendance.cs`
- `backend/src/GymCrm.Domain/Clients/ClientMembershipChangeReason.cs`
- `backend/src/GymCrm.Infrastructure/Attendance/AttendanceService.cs`
- `backend/src/GymCrm.Infrastructure/Clients/ClientMembershipService.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/AttendanceConfiguration.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.Designer.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/GymCrmDbContextModelSnapshot.cs`
- localized new attendance mutation/audit coordinator files, exact path to be discovered before editing

### Backend API/internal bot contracts
- `backend/src/GymCrm.Api/Auth/AttendanceEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/AttendanceMarkRequest.cs`
- `backend/src/GymCrm.Api/Auth/AttendanceMarkResponse.cs`
- `backend/src/GymCrm.Api/Auth/AttendanceClientResponse.cs`
- `backend/src/GymCrm.Api/Auth/AttendanceAuditState.cs`
- `backend/src/GymCrm.Api/Auth/AttendanceAuditConstants.cs`
- `backend/src/GymCrm.Api/Auth/AttendanceResources.cs`
- `backend/src/GymCrm.Api/Auth/Resources/AttendanceResources.resx`
- `backend/src/GymCrm.Infrastructure/Bot/BotApiService.cs`
- audit filter/resource mappings if the new restore action/reason is enumerated explicitly

### Backend tests
- `backend/tests/GymCrm.Tests/AttendanceApiTests.cs`
- `backend/tests/GymCrm.Tests/InternalBotApiTests.cs`
- audit/client tests if membership reason or displayed audit filters change
- optional focused service tests for rollback/provenance if API tests cannot inject audit failure safely

### Frontend
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/attendance.ts`
- likely new `frontend/src/lib/api/attendance.test.ts`
- `frontend/src/lib/resources.ts`
- `frontend/src/features/home/HomeDashboard.tsx`
- `frontend/src/features/home/HomeDashboard.test.tsx`
- `frontend/src/features/attendance/AttendanceScreen.tsx` or focused files extracted beside it
- `frontend/src/features/shared/ux.tsx`
- `frontend/src/features/shared/ux.test.tsx`
- `frontend/src/App.css`

### Frontend e2e
- `frontend/e2e/attendance.spec.ts`
- `frontend/e2e/home-dashboard.spec.ts` if present/created
- `frontend/e2e/responsive-main-screens.spec.ts`
- other fixtures found by the final `isPresent`/attendance contract search

### Python bot
- No Python bot file should change if its internal HTTP contract remains boolean and future-date UI is already bounded.
- If Python bot contracts/UI are changed unexpectedly, follow `bot/AGENTS.md` and include `ruff` + `pytest` validation.

## Constraints
- Backend owns permissions, access scope, attendance state, membership write-off/restore, validation, transaction and audit semantics.
- Frontend renders backend state and permissions; it must not infer role rules or independently decide whether a membership may be restored.
- Preserve unique attendance row per client/group/date.
- `Unmarked` remains an intentional target state, not a visual alias for `Absent`.
- Never restore a single visit without persisted provenance tying it to the attendance mutation.
- Attendance, membership and mandatory audit effects must commit or roll back together.
- Future attendance save is rejected by backend even if frontend controls are bypassed; `today` is calculated only from the configured backend business timezone.
- Frontend consumes backend-provided business `today`/`maxTrainingDate` and must not independently reproduce the club timezone rule.
- Attendance with provenance may be corrected away from `Present` only when the exact sale ID + write-off membership-version ID can be restored; restore conflict rolls back the entire mutation.
- Deployment recreates the database from the updated initial schema; preserving or backfilling the current database is not required.
- Do not reintroduce `/attendance`, a navigation section, bulk marking, or page-level horizontal scroll.
- Preserve Mantine and Onest.
- Do not mix unrelated navigation/layout refactoring or other membership payment/validity changes.
- Source task remains in `/backlog/risky` until explicit implementation selection.

## Out of scope
- General offline queue/sync architecture.
- Historical inference/backfill of which old attendance consumed which single visit.
- New role/RBAC model or new frontend-only access rules.
- Changes to pricing, payment, expiration, refund, sale or renewal semantics beyond the explicit single-visit restoration version.
- Python bot tri-state/reset UX.
- Restoring the removed standalone attendance route.
- Reworking other CRM screens or the global navigation shell.
- Bulk `Отметить всех`.

## Required test coverage

### Backend unit/service tests
- State transition table: all meaningful transitions among `Unmarked`, `Present`, `Absent`, including same-state idempotency.
- Future-date guard with a fixed clock; no persistence/audit side effects.
- Business-date boundary tests around UTC midnight for configured `Europe/Moscow`, plus configuration validation for an unknown timezone.
- Restore service applies only to the expected sale lineage and is idempotent.
- Restore validates both sale ID and exact write-off membership-version ID.
- Existing provenance plus a correction, renewal, type change or conflicting re-write-off returns the stable restore-conflict error and rolls back attendance/membership/audit effects.
- Different/current unrelated single visit is never restored.
- Professional client still does not receive write-off/restore.
- Transaction rollback when mandatory audit or membership persistence fails, if practical with the repository test harness.

### Backend integration/API tests
- GET roster maps no row to `Unmarked`, false row to `Absent`, true row to `Present`.
- Unknown/malformed state returns stable ProblemDetails.
- `Unmarked -> Absent` persists false without write-off.
- `Unmarked -> Present` persists true, writes off one exact single visit, stores provenance, and writes attendance + membership audits.
- `Present -> Absent` restores that exact single visit, clears provenance, and writes attendance + restore audits.
- `Present -> Unmarked` deletes attendance, restores the exact single visit, and audits old/new states plus membership restore.
- `Absent -> Unmarked` deletes attendance and audits reset without membership restore.
- Repeated same-state save creates no duplicate attendance, write-off, restore or audit.
- Future date returns validation and leaves attendance/membership/audit unchanged.
- Attendance contract returns authoritative backend business `today`/`maxTrainingDate`; frontend date limits use it.
- Restore conflict returns the stable web ProblemDetails/domain mapping and leaves attendance, membership, provenance and audit unchanged.
- Existing permission/access-scope/client-outside-group/CSRF behavior remains green.
- Unique `(ClientId, GroupId, TrainingDate)` protection remains green.
- Internal bot `Present/Absent` path still works, maps future-date error, and receives shared domain audit semantics.

### Frontend unit/component tests
- API maps/sends exact state strings; missing/invalid state is not silently converted to `Absent`.
- Permission matrix:
  - both permissions -> two tabs, attendance selected by default;
  - attendance only -> direct attendance panel and no tablist;
  - memberships only -> direct membership panel and no tablist;
  - neither -> access denied;
  - role alone does not change visibility.
- Visible H1 `Главная` is absent while app navigation still labels the section `Главная`.
- Membership count has loading placeholder before success, exact count after success, and compact zero state.
- Tab switching preserves selected group/date/local states/progress and does not increment group/roster request count.
- Attendance control distinguishes all three states, uses row-specific pending/error/retry, and progress counts only non-`Unmarked` choices.
- Failed save is not presented as persisted; retry repeats the exact attempted transition.
- Stale response from previous group/date or older click cannot overwrite current state.
- Next date is disabled on today; date input cannot select a future date.
- Bulk action is absent.

### UI/e2e tests
- Keyboard tab switching and visible focus state.
- Select group/date, set `Present -> Absent -> Unmarked`, switch tabs and back, verify state/progress and request counts.
- Per-client save failure shows row error and retry; another client remains usable.
- Membership loading/error/empty states remain confined to membership panel; attendance stays usable.
- Responsive widths 320, 390, 440, 768, 1440, 1920 with no page-level overflow, no clipped labels, >=44 px controls and no bottom-nav overlap.
- On mobile group/date remain visible without opening `Фильтры`.
- Future navigation/save is blocked; server validation is surfaced if bypassed.

### Manual-only checks
- Visual review against the agreed mockup on desktop/mobile, applying clarified no-bulk/no-future overrides.
- Screen-reader/keyboard spot check for tab names, per-client state group, progress and polite save/error announcement.
- Verify long client/group names and membership warning text at 320 px.
- Verify compact memberships success state does not displace the attendance workflow.

## Test plan
- [ ] `dotnet test backend/GymCrm.slnx`
- [ ] `cd frontend && npm run test:unit`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:e2e -- attendance.spec.ts home-dashboard.spec.ts responsive-main-screens.spec.ts` adjusted to actual files/config
- [ ] If Python bot files change: run repository-configured `ruff` and `pytest` commands from `bot/`.
- [ ] Recreate/validate a clean database from the updated initial schema if provenance changes schema.
- [ ] Validate backend startup and attendance date boundaries with configured business timezone `Europe/Moscow`.
- [ ] Manually verify desktop/mobile visual composition and keyboard navigation.
- [ ] Run final source search for stale boolean attendance consumers and forbidden bulk action.

## Regression barrier
No implementation is complete until automated tests prove all of the following together:
- API and UI distinguish absence of row (`Unmarked`) from explicit false (`Absent`) and true (`Present`);
- `Present -> Absent/Unmarked` restores only the exact linked single visit, never an unrelated current membership;
- provenance identifies both the sale lineage and the concrete write-off membership-version, and restore conflict rolls back the complete operation;
- attendance mutation, membership mutation and both required audits share one transaction/rollback boundary;
- future-date save cannot create attendance through web or shared internal bot service and uses the configured backend business timezone;
- permission combinations render only backend-authorized areas, with attendance default when both exist;
- switching tabs does not reset group/date/local state or refetch needlessly;
- a failed client save remains visible and retryable without corrupting other rows;
- responsive tests cover all six target widths without page-level horizontal scroll or bottom-nav overlap.

## Risks
- Incorrect restoration provenance could reactivate a different purchased single visit; this is the primary production-integrity risk.
- Audit currently sits outside the service transaction. Leaving that structure unchanged can satisfy happy-path tests while violating mandatory audit on partial failure.
- Deleting the attendance row for `Unmarked` removes the entity from normal history; audit must retain the reset transition and stable entity id.
- Existing attendance rows cannot be safely linked to historical write-offs without explicit data provenance; an inferred backfill is unsafe.
- Sale ID alone is insufficient because correction mutates the sale lineage and membership versioning can create another write-off for the same sale; provenance must retain both the stable sale ID and the concrete write-off membership-version ID.
- Shared `IAttendanceService` changes can silently break internal bot error mapping or audit behavior even if the Python payload stays boolean.
- Optimistic saves plus full-roster refetch can race and overwrite newer selections.
- Unmounting Mantine panels would reset attendance state and cause repeat requests.
- Membership badge may briefly show false `0` if loading is not represented separately.
- Invalid or inconsistently deployed business timezone configuration can shift the future-date boundary; validate configuration at startup and cover UTC-midnight boundaries in tests.
- Three state controls can overflow or fall below 44 px at 320 px.
- The mockup contains obsolete bulk/future interactions; blindly copying it would violate the clarified TASK.

## Stop conditions
Остановиться и не писать/не продолжать project code, если:
- невозможно доказуемо связать восстанавливаемое разовое списание с конкретной attendance mutation;
- реализация предлагает восстанавливать любой текущий `SingleVisitUsed = true` без provenance;
- implementation introduces a forward migration/backfill requirement instead of recreating the clean deployment database from the updated initial schema;
- attendance, membership and mandatory audit cannot быть объединены в безопасный transaction boundary без system-wide redesign;
- API contract не удаётся определить однозначно без одновременной поддержки конфликтующих boolean/tri-state значений;
- backend business timezone/date provider cannot be applied consistently to web and internal bot attendance paths;
- change requires global RBAC/auth redesign rather than existing backend permissions;
- scope expands into general membership/payment/history redesign, offline sync, or unrelated layout/navigation refactoring;
- reference mockup and clarified acceptance criteria conflict in a way not already resolved by the TASK text.

Do not stop only because backend, frontend and internal bot adapter are affected. Do not stop only because schema evolution is required in the current early-stage product.

## Ready for Codex execution
yes, after explicit risky-task implementation approval.

Reason: product semantics and acceptance criteria are clear, but safe execution must use persisted write-off provenance, atomic domain audit, shared-service consumer updates and the regression barriers above. The source task intentionally remains in `/backlog/risky` until that execution is explicitly selected.
