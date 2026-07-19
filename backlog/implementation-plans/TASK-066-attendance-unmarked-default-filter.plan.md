# Implementation Plan: TASK-066 Показывать по умолчанию клиентов без отметки посещения

## Source task
/backlog/risky/TASK-066-attendance-unmarked-default-filter.md

Source task remains in `/backlog/risky`, but explicit risky-task implementation approval was received from the user on 2026-07-19.

## Implementation branch
feature/TASK-066-attendance-unmarked-default-filter

Branch rules:
- create this branch from an up-to-date `main` before writing project code;
- before branch creation, switch to `main`, run `git pull`, and verify `git status` is clean;
- stop if the base branch or worktree state is unclear;
- do not implement unrelated TASKs or attendance refactoring in this branch;
- confirm the branch is active before changing frontend, backend, tests, or other project files.

## Goal
После выбора группы и даты показывать пользователю прежде всего клиентов, которых ещё нужно обработать, убирать строку из этого представления только после подтверждённого backend сохранения и сохранять доступ к полному составу группы с актуальными тремя attendance-статусами.

## Current understanding
- `TASK-064` уже реализовала backend-owned состояния `Unmarked`, `Present`, `Absent`, reset в `Unmarked`, authoritative save response, row-level pending/error/retry и background roster refresh.
- `frontend/src/features/attendance/AttendanceScreen.tsx` хранит полный roster как `Record<string, AttendanceClientRowState>` и сейчас без фильтра рендерит `Object.values(rows)`.
- Сохранение сначала меняет `displayedState` оптимистично, но `persistedState` обновляется только после успешного ответа. При ошибке строка остаётся со `saveState = failed`, `attemptedState` и retry.
- После success `refreshRosterAfterSave` обновляет membership-derived client data, не заменяя authoritative `persistedState`; защита context/action version уже не даёт старым ответам перезаписать новую группу, дату или более новое действие.
- Backend roster уже возвращает весь доступный состав выбранной группы с состоянием каждого клиента. Новый query parameter или отдельный backend endpoint не нужен: один полный roster позволяет безопасно переключать представления без повторного запроса и не переносит access/business rules во frontend.
- Выбранный UX-вариант: клиент исчезает из default-представления сразу после успешного backend response. Во время pending и после ошибки он остаётся видимым; это исключает ложное исчезновение и сохраняет retry.
- Переключатель является presentation state текущего attendance workspace. Он не меняет группу, дату, roster и не вызывает save. При смене группы или даты default-представление снова должно быть `Не отмечено`, чтобы новый рабочий контекст начинался с необработанных клиентов.
- В представлении `Все` строки сохраняют текущий `AttendanceStateControl`, поэтому пользователь может изменить `Present`/`Absent` или сбросить значение в `Unmarked`. После reset строка остаётся в `Все` и появляется в `Не отмечено` при переключении.
- Задача не требует изменения attendance, membership, audit, permissions или access-scope contract. Backend suite нужна как regression barrier, а не как основание для проектных изменений.

## UX decisions to lock before implementation
1. Использовать два явных mutually-exclusive представления: `Не отмечено` (default) и `Все`; предпочтительно Mantine `SegmentedControl` либо доступный эквивалент с понятным label `Показывать клиентов`.
2. Фильтровать default-представление по подтверждённому `persistedState === 'Unmarked'`, а не по оптимистичному `displayedState`. Поэтому pending/failed строка не исчезает.
3. После successful save `Present`/`Absent` синхронно обновить `persistedState`; React render сам убирает строку без destructive удаления из полного roster.
4. Не удалять объект клиента из `rows`: представление `Все`, background refresh и последующий reset должны продолжать работать на едином полном roster.
5. Progress сохраняет смысл для полного roster: `Отмечено N из M` считается по всем загруженным строкам, а не только по видимому subset. Рядом с default empty state допускается отдельный текст о завершении обработки, но denominator не должен меняться при переключении.
6. Пустые состояния различать:
   - roster пуст: существующее `В выбранной группе пока нет клиентов`;
   - roster не пуст, но default subset пуст: `Все клиенты отмечены` с возможностью перейти в `Все`;
   - loading/error не маскировать фильтром.
7. Переключатель не должен сбрасывать локальные failed/pending states, группу, дату или создавать API-запросы. Не добавлять принудительное управление прокруткой: браузер сохраняет текущую позицию насколько позволяет изменившаяся высота списка. Во время pending переход в `Все` допустим; pending строка остаётся disabled и видима в полном составе.

## Confirmed implementation clarifications
- Пользователь явно разрешил выполнение medium-risk задачи 2026-07-19; дополнительное подтверждение перед созданием task-ветки не требуется.
- Для администратора, главного тренера и тренера достаточно существующего покрытия permissions. Новые отдельные role-specific e2e-сценарии в рамках TASK-066 не требуются; существующие проверки должны остаться зелёными.
- Позиция прокрутки остаётся под естественным управлением браузера. Реализация не должна вручную восстанавливать, сбрасывать или корректировать scroll position при переключении представления.

## Execution steps

### Phase 0 — execution gate and baseline
1. Использовать полученное 2026-07-19 явное разрешение на выполнение risky-задачи и создать `feature/TASK-066-attendance-unmarked-default-filter` от актуального чистого `main`.
2. Перечитать root/frontend `AGENTS.md`, source TASK, этот план и актуальные attendance component/e2e tests.
3. До изменений запустить focused baseline `cd frontend && npm run test:unit -- AttendanceScreen` и убедиться, что текущие tri-state save/error/reset сценарии проходят.
4. Проверить consumers `AttendanceWorkspace`, `AttendanceClientRowState`, `AttendanceProgress` и e2e mocks. Если полный roster перестал быть доступен либо backend больше не возвращает все три состояния, остановиться и пересмотреть contract-first scope.

### Phase 1 — view state and derived roster
5. Добавить в `AttendanceWorkspace` локальный typed view state, например `type AttendanceRosterView = 'unmarked' | 'all'`, с initial value `unmarked`.
6. При фактической смене `selectedGroupId` или `trainingDate` возвращать view в `unmarked`; manual refresh и background refresh не должны менять выбранное представление.
7. Разделить derived values:
   - `allRows = Object.values(rows)` — источник total/progress и полного представления;
   - `visibleRows` — `allRows` для `all` либо строки с `persistedState === 'Unmarked'` для `unmarked`;
   - `markedCount` — только по `allRows` и подтверждённому `persistedState`, чтобы failed optimistic choice не считался сохранённой отметкой.
8. Не мутировать и не удалять `rows` после save. Использовать существующее authoritative обновление `persistedState`; successful `Present`/`Absent` автоматически исключает строку из `visibleRows`, error оставляет `persistedState = Unmarked` и строку видимой.
9. Проверить reset в `Все`: successful `Unmarked` обновляет `persistedState`, строка остаётся в полном списке и входит в default subset при возврате в `Не отмечено`.

### Phase 2 — accessible switcher and states
10. Добавить небольшой focused component, например `AttendanceRosterViewControl.tsx`, либо локализованный блок в `AttendanceScreen.tsx`, если он остаётся компактным. Он принимает value/onChange и не содержит domain rules.
11. Разместить control рядом с progress/refresh в roster section так, чтобы desktop hierarchy и mobile wrapping оставались читаемыми. Сохранить Mantine/Onest, видимый keyboard focus и touch targets не менее 44 px.
12. Дать переключателю programmatic label и deterministic selectors/roles для component/e2e tests; выбор должен быть доступен с клавиатуры и не зависеть только от цвета.
13. Рендерить `visibleRows`, сохранив текущие `AttendanceClientRow` keys и row-level pending/error/retry state.
14. Добавить отдельное completion empty state для непустого `allRows` и пустого `visibleRows` в режиме `unmarked`; в нём дать явное действие `Показать всех`. Не показывать это состояние при roster loading/error или действительно пустой группе.
15. При переключении в `Все` отображать каждую строку и её radio state `Не отмечено`/`Был`/`Не был`; не добавлять отдельную frontend-копию status mapping.
16. При необходимости сделать только локальные CSS-изменения в attendance toolbar/empty state; проверить mobile bottom navigation и отсутствие horizontal overflow.

### Phase 3 — automated regression coverage
17. Расширить `AttendanceScreen.test.tsx` fixture минимум тремя клиентами (`Unmarked`, `Present`, `Absent`) и проверить:
   - default view показывает только `Unmarked`;
   - `Все` показывает весь roster и правильные checked radio states;
   - переключение не меняет group/date и не вызывает дополнительные GET/POST;
   - смена group/date возвращает default view.
18. Добавить focused success/error tests:
   - при pending `Present`/`Absent` строка остаётся в default view;
   - после success строка исчезает, но доступна с authoritative state в `Все`;
   - после rejected save строка остаётся, показывает ошибку и exact retry;
   - successful retry убирает строку.
19. Добавить reset regression:
   - из `Все` сохранить отмеченного клиента как `Unmarked`;
   - подтвердить, что он остаётся в `Все` с checked `Не отмечено`;
   - после переключения в default он присутствует.
20. Добавить tests для двух empty states: действительно пустая группа и `Все клиенты отмечены`; completion action открывает полный roster.
21. Обновить `frontend/e2e/attendance.spec.ts`: mock roster содержит unmarked/present/absent; проверить default subset, success disappearance, full roster/status, reset и повторное появление в default view.
22. Добавить e2e failure response для одного save либо component-level failure оставить основной regression barrier, если Playwright mock failure существенно раздувает сценарий. В любом случае automated component test ошибки обязателен.
    - Не добавлять отдельную role matrix для этой задачи: достаточно существующего automated coverage permissions для администратора, главного тренера и тренера.

### Phase 4 — validation and review
23. Запустить `cd frontend && npm run test:unit`.
24. Запустить `cd frontend && npm run lint` и `cd frontend && npm run build`.
25. Запустить `cd frontend && npm run test:e2e -- attendance.spec.ts`; при затронутой responsive разметке также `responsive-main-screens.spec.ts`.
26. Запустить `dotnet test backend/GymCrm.slnx` без изменения backend-кода, чтобы защитить attendance state, reset, access, membership write-off/restore и audit semantics.
27. Провести manual keyboard/mobile check на 390 px и desktop check: default focus, переключение, pending/error, completion empty state, отсутствие горизонтального overflow и перекрытия bottom navigation.
28. Финальным source search подтвердить, что фильтр использует `persistedState`, полный roster не уничтожается, permissions не выводятся из role и backend contract не был продублирован во frontend.

## Preferred implementation strategy
1. Оставить backend contract неизменным и реализовать локальный derived presentation filter поверх полного authoritative roster.
2. Сначала добавить component regression tests для default/all и success/error/reset, затем менять rendering.
3. Убирать строку только через подтверждённое изменение `persistedState`, сохраняя pending/failed safety.
4. Переиспользовать существующие row components, save state machine и request-version guards; не вводить новый global store или второй roster cache.
5. Делать небольшие проверяемые commits в одной TASK-ветке: view derivation/tests, control/empty states, e2e/responsive verification.

## Files likely to change
- `frontend/src/features/attendance/AttendanceScreen.tsx`
- `frontend/src/features/attendance/AttendanceScreen.test.tsx`
- likely new `frontend/src/features/attendance/AttendanceRosterViewControl.tsx`
- `frontend/src/App.css`
- `frontend/e2e/attendance.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts` only if shared responsive expectations need adjustment

Files to inspect but not expected to change:
- `frontend/src/features/attendance/AttendanceClientRow.tsx`
- `frontend/src/features/attendance/types.ts`
- `frontend/src/lib/api/attendance.ts`
- `frontend/src/lib/api/types.ts`
- `backend/tests/GymCrm.Tests/AttendanceApiTests.cs`

## Constraints
- Backend remains the source of truth for attendance states, save success, membership, audit, permissions and access scope.
- Do not add a frontend role matrix or filter clients by locally inferred access.
- A client must not disappear from `Не отмечено` before the backend confirms `Present` or `Absent`.
- Failed saves remain visible with retry; stale responses must not hide or resurrect rows in the wrong group/date.
- Keep the complete roster in memory; `Не отмечено` and `Все` are derived views, not separate server datasets.
- View switching must not save data, refresh data, change group/date or create attendance records.
- Preserve the three existing state meanings and reset behavior.
- Preserve Mantine and Onest and avoid unrelated attendance/home refactoring.
- Source task remains in `/backlog/risky` согласно backlog workflow; явное разрешение на реализацию уже получено 2026-07-19.

## Out of scope
- Backend/API filtering parameter or separate endpoint for unmarked clients.
- Changes to attendance persistence, membership write-off/restore or audit transactions.
- Roles, permissions, access-scope or group membership changes.
- Bulk attendance actions.
- Offline queue, global state or cross-device synchronization.
- Redesign of Home, Memberships or other CRM screens.

## Required test coverage

### Unit/component tests
- Update `AttendanceScreen.test.tsx` for default/all derivation, confirmed-success removal, pending/error retention, retry, reset reappearance, context change and both empty states.
- Assert progress is based on the complete confirmed roster and does not change merely because the view changes.
- Assert switching views produces no extra API mutation or roster request.

### Integration tests
- No new backend integration contract is required because API shape and domain behavior do not change.
- Run the existing full backend suite, especially `AttendanceApiTests`, as a mandatory regression barrier for tri-state/reset, access, membership and audit semantics.
- Existing frontend API mapper tests must remain green; update them only if discovery proves the contract differs from the current understanding.

### UI/e2e tests
- Update Playwright attendance flow for default unmarked roster, successful disappearance, full roster/status display, reset and return to default.
- Validate the view control and completion empty state at mobile width; run responsive attendance coverage if CSS changes.
- Manual-only: visual density, focus visibility, touch comfort and wording review. These checks supplement, not replace, automated coverage.

## Test plan
- [ ] Default `Не отмечено` shows only clients whose confirmed state is `Unmarked`.
- [ ] Pending and failed rows remain visible; failure exposes error and retry.
- [ ] Successful `Present`/`Absent` removes the row from default view only after backend response.
- [ ] `Все` shows every roster client with the correct three-state control.
- [ ] Successful reset to `Unmarked` keeps the row in `Все` and returns it to default view.
- [ ] View switching preserves group/date/state and makes no extra API calls.
- [ ] Group/date change loads the correct roster and resets the view to `Не отмечено`.
- [ ] Empty group and completed-unmarked-list states are distinct.
- [ ] Progress uses the full confirmed roster in both views.
- [ ] `npm run test:unit`, `npm run lint`, `npm run build`, affected Playwright tests and `dotnet test backend/GymCrm.slnx` pass.

## Regression barrier
The primary barrier is an automated `AttendanceScreen` component suite proving the complete state matrix: `Unmarked` default filtering, pending/error retention, confirmed-success removal, full-list visibility, reset reappearance and context preservation. A Playwright attendance scenario protects the user journey on mobile, while the unchanged backend attendance suite protects access, audit and membership semantics.

## Risks
- Filtering by `displayedState` would hide a row optimistically before save confirmation; use `persistedState` exclusively for default membership.
- Physically deleting a saved row from `rows` would break `Все`, reset and background merge; retain one complete roster.
- Recomputing progress from `visibleRows` would make progress misleading and change on view switch.
- Reset/group/date races could cause a row to appear in the wrong context if existing version guards are bypassed.
- A control placed into the compact toolbar may overflow at mobile widths or become unclear without an accessible label.
- Wording `Все клиенты отмечены` could be shown incorrectly for a truly empty group unless empty states are ordered by full roster size.

## Stop conditions
Stop and do not write project code if:
- the active branch is not `feature/TASK-066-attendance-unmarked-default-filter` or was not created from clean current `main`;
- the backend roster no longer returns the complete accessible group or cannot distinguish all three states;
- correct filtering requires changing backend attendance, membership, audit, permissions or access-scope semantics;
- the task expands into an attendance API redesign, global state rewrite or unrelated Home refactor;
- existing request-version/save guarantees cannot preserve pending/error rows without architectural changes;
- acceptance criteria cannot be met without a product decision beyond the UX choices fixed in this plan.

Do not stop merely because the attendance screen is shared by several permission-bearing roles or because both component and e2e tests must change.

## Ready for Codex execution
yes — the implementation plan is complete, and the user explicitly approved execution of the medium-risk task on 2026-07-19. Branch creation and project code changes may proceed subject to the clean-current-`main` execution gate.
