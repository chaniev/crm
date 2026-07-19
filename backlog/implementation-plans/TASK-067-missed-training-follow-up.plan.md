# Implementation Plan: TASK-067 Выявлять клиентов с повторными пропусками тренировок

## Source task
/backlog/tasks-ready/TASK-067-missed-training-follow-up.md

## Git branch
feature/TASK-067-missed-training-follow-up

Ветку создать от актуальной чистой `main` до изменения production-кода. Не смешивать TASK-067 с TASK-075 или другими задачами.

## Goal
Дать Administrator и HeadCoach единый backend-owned список клиентов, требующих связи: без дублей, со всеми актуальными membership-причинами и причиной трёх и более последовательных явно сохранённых `Absent`, которую можно независимо закрыть действием `Связались`.

## Accepted product semantics
- Streak является рекомендательной подсказкой сотрудникам и не используется для финансовых или дисциплинарных решений.
- В расчёте участвуют только явно сохранённые attendance-отметки клиента.
- `Absent` продолжает streak, `Present` разрывает его.
- `Unmarked`, отсутствие отметки и отсутствие занятия в данных не участвуют в расчёте и не разрывают streak.
- Допустимо раннее попадание клиента в список при неполных или некорректных отметках сотрудников.
- Смена группы и окончание абонемента не разрывают streak.
- Заморозка абонемента не учитывается и вынесена в TASK-074.
- Функциональность `Занятие не проводилось`, `LessonOccurrence`, `Held/NotHeld`, snapshot занятия и соответствующий UI исключены из TASK-067 и вынесены в TASK-075.
- После `Связались` непрерывная старая серия не возвращает причину на четвёртом или пятом общем пропуске: нужны три новых `Absent` после acknowledgement boundary.
- Исправление attendance до acknowledgement boundary не отменяет факт `Связались`; для повторного появления учитываются только события после сохранённой границы.
- Новый `GET /clients/attention` используется unified UI. Старый `/clients/expiring-memberships` временно сохраняет membership-only контракт для bot и других consumers.
- Membership attention window задаётся startup configuration, по умолчанию `3` календарных дня, валидируется при старте и применяется после перезапуска.
- TASK-061 остаётся обязательной семантикой: `IndividualValidTo` — включительная последняя дата действия.
- Administrator видит только клиентов текущего branch scope; чтение и `Связались` проверяют текущий `Client.BranchId` на backend.
- Telegram-ссылка возвращается только для активной Telegram-привязки с нормализованным сохранённым `Username`.
- `missedCount` находится внутри typed missed-training reason.
- Идемпотентный action возвращает актуальную карточку при оставшихся причинах либо `204 No Content`.
- Membership-причины не получают отдельного acknowledgement action.

## Ordering and acknowledgement boundary
- Attendance-события упорядочиваются по `TrainingDate`, текущему `TrainingGroup.TrainingStartTime` и устойчивому `Attendance.Id`.
- Изменение времени группы может изменить исторический порядок нескольких отметок одного клиента в один день; этот остаточный риск принят для рекомендательной функции без `LessonOccurrence`.
- Boundary должна сохранять достаточный immutable cutoff для выбранного порядка, а не только дату.
- Исправление старой записи в `Unmarked` не должно переносить boundary; повторно созданная задним числом отметка до cutoff не должна считаться новой последовательностью.

## Preferred implementation strategy
1. Contract-first и test-first: сначала DTO единого списка, типы причин и команда `Связались`.
2. Выделить streak calculator в небольшой Application/Domain service; не размещать attendance semantics в endpoint или frontend.
3. Добавить отдельное acknowledgement state, связанное с клиентом и обработанной последовательностью, а не общий флаг клиента.
4. Строить один backend aggregate на клиента с `reasons[]`; сортировку и дедупликацию выполнять на backend.
5. Сохранить старый membership-only endpoint для совместимости и перевести Home на новый attention contract.
6. Выполнить UX-проверку обновлённой карточки с `ui-designer`, как требует значимое изменение интерфейса.

## Execution steps
1. Проверить чистую актуальную `main`, создать и активировать `feature/TASK-067-missed-training-follow-up`.
2. До production-кода написать unit-тесты calculator: границы 2/3, `Present`, `Absent`, `Unmarked`/отсутствие записи, несколько отметок одного дня, смена группы, окончание абонемента, correction и acknowledgement boundary.
3. До production-кода написать integration-тесты unified endpoint и `Связались`: роли, branch scope, attention window, membership compatibility, несколько причин, контакты/Telegram, идемпотентность, concurrency и audit.
4. До production-кода обновить frontend mapper/component tests и Playwright: новое название, уникальный счётчик, все причины, Telegram, `Связались`, partial removal, loading/error/empty и narrow viewport.
5. Запустить focused тесты и подтвердить ожидаемый red-state из-за отсутствующих unified contract, calculator и acknowledgement endpoint.
6. Реализовать typed attention reasons, projection уникального клиента, streak calculator и persistent acknowledgement boundary. При новой таблице обновить воспроизводимую initial schema без добавления новой migration согласно project flow.
7. Добавить `GET /clients/attention`; сохранить `/clients/expiring-memberships` с прежним membership-only контрактом.
8. Реализовать `POST /clients/{clientId}/attention/missed-training/contacted` или эквивалентный typed route: атомарно закрывать только missed-training reason, писать audit и соблюдать branch scope.
9. Обеспечить расчёт из актуальных attendance данных без stale derived flag.
10. Обновить frontend API и Home: `Клиенты, требующие внимания`, одна карточка клиента со всеми reasons, контакты, membership summary, notes, missed count, Telegram и локально блокируемое действие `Связались`.
11. После `Связались` оставлять карточку при membership-причинах; при ошибке не скрывать missed reason оптимистично.
12. Запустить focused проверки, затем `dotnet test backend/GymCrm.slnx`, frontend unit tests, `npm run lint`, `npm run build` и затронутые Playwright tests.
13. Провести smoke test для Administrator и HeadCoach, запрета Coach, branch scope, Telegram и desktop/mobile UI.

## Files likely to change
- `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs`
- backend DTO typed unified attention contract
- `backend/src/GymCrm.Application/Attendance/` — focused streak calculator/contract
- `backend/src/GymCrm.Domain/Clients/` — acknowledgement entity
- `backend/src/GymCrm.Infrastructure/Persistence/GymCrmDbContext.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/`
- backend startup options/appsettings для attention window
- initial schema migration и snapshot — только по принятому project flow
- `backend/tests/GymCrm.Tests/ClientsApiTests.cs`
- focused backend unit-test file для streak calculator
- `frontend/src/lib/api/endpoints.ts`
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/clients.ts`
- `frontend/src/lib/api/clients.test.ts`
- `frontend/src/lib/resources.ts`
- `frontend/src/features/home/HomeDashboard.tsx`
- attention-oriented replacement существующего `MembershipsPanel.tsx`
- `frontend/src/features/home/HomeDashboard.test.tsx`
- `frontend/e2e/home-dashboard.spec.ts`
- затронутые responsive/auth mocks при необходимости

## Constraints
- Attendance semantics, membership reasons, access scope, acknowledgement и дедупликация принадлежат backend.
- Frontend не вычисляет streak, attention window, роли или объединение причин.
- Только явно сохранённый `Absent` считается пропуском.
- `Present` разрывает streak; `Unmarked` и отсутствие записи игнорируются.
- Смена группы, окончание абонемента и изменение его даты окончания не разрывают streak.
- `Связались` закрывает только missed-training reason и не изменяет attendance/membership.
- Старые исправления не отменяют acknowledgement и не переносят boundary.
- Не добавлять `LessonOccurrence`, `Held/NotHeld`, отмену занятия или snapshot участников в TASK-067.
- Не менять списание посещений, автоматическую коммуникацию или CRM-воронку.
- Не ломать старый membership endpoint и его consumers без compatibility strategy.

## Required test coverage

### Unit tests — до functional code
- streak `0/1/2` не создаёт reason; `3/4` создаёт reason с точным count;
- `Present` разрывает streak;
- `Unmarked` и отсутствие attendance-записи игнорируются и не становятся `Absent`;
- смена группы и дата окончания membership не разрывают streak;
- три `Absent` после окончания membership создают reason;
- несколько отметок одного дня детерминированно упорядочиваются;
- исправление `Absent` на `Present`/`Unmarked` пересчитывает результат;
- acknowledgement закрывает текущую sequence, а reason возвращается только после трёх новых `Absent`;
- исправления до boundary не отменяют acknowledgement и не входят в новую последовательность;
- membership и missed reasons агрегируются в один client result.

### Integration tests — до functional code
- Administrator и HeadCoach получают endpoint/выполняют action; Coach и прочие роли запрещены;
- branch scope не раскрывает чужих клиентов и запрещает прямую команду для них;
- configured window `3` включает `0–3` дня и исключает `4`; другой test host проверяет override;
- Expired/Unpaid reasons сохраняются;
- один клиент с membership + missed reason возвращается один раз;
- DTO содержит ФИО, телефон, notes, membership status, missed count и optional Telegram;
- Telegram link отсутствует без сохранённого Username;
- `IndividualValidTo` трактуется включительно;
- `Связались` атомарно и идемпотентно закрывает только missed reason, сохраняет другие reasons и создаёт audit;
- после трёх новых пропусков reason появляется снова;
- double-click/concurrency не создаёт противоречивое acknowledgement state;
- clean database schema воспроизводимо содержит новую acknowledgement table/indexes.

### Frontend tests — до functional code
- mapper читает backend `reasons[]` и nullable contacts без вычислений;
- вкладка переименована, счётчик равен числу unique client items;
- карточка показывает все reasons и missed count только у соответствующей причины;
- `Связались` удаляет только missed reason;
- ошибка action оставляет причину и позволяет retry;
- Telegram открывается внешней ссылкой только при наличии link data;
- empty/loading/error относятся к unified list;
- responsive Playwright проверяет заметность reasons и доступность action.

## Required validation
- [ ] Focused unit/integration/frontend tests сначала зафиксировали ожидаемый red-state.
- [ ] `dotnet test backend/GymCrm.slnx` проходит.
- [ ] Frontend unit tests проходят.
- [ ] `npm run lint` проходит.
- [ ] `npm run build` проходит.
- [ ] Затронутые Playwright tests проходят на desktop и narrow viewport.
- [ ] Выполнен ручной smoke test ролей, scope и Telegram.

## Risks
- Неполные attendance-отметки могут привести к раннему попаданию клиента в рекомендательный список; это принято продуктом.
- Текущее изменяемое `TrainingStartTime` используется для tie-break нескольких событий одного дня; риск изменения исторического порядка принят до появления отдельной модели занятия в TASK-075.
- Boundary без occurrence требует аккуратного immutable cutoff и correction tests.
- Старый endpoint используется Home/e2e mocks и, возможно, bot; compatibility обязательна.
- Невалидный attention window должен приводить к ошибке старта, а не fallback.

## Decomposition for safe execution
1. Backend streak calculator + acknowledgement persistence/audit.
2. Unified attention API с compatibility layer и role/scope tests.
3. Frontend contract/UI/Telegram/action с responsive review.
4. Full regression и локальный runtime smoke test.

## Stop conditions
Остановиться до functional code, если:
- API требует frontend-side дедупликации или вычисления причин;
- acknowledgement нельзя сделать атомарным и устойчивым к исправлению старых attendance;
- обнаружен RBAC redesign, destructive production migration или scope вышел за TASK-067;
- невозможно сохранить compatibility существующих consumers старого endpoint.

Не останавливать реализацию из-за отсутствия модели занятия: `LessonOccurrence` и `Занятие не проводилось` явно вынесены в TASK-075.

## Ready for Codex execution
yes — расчёт основан только на явно сохранённых `Present`/`Absent`; `Unmarked`, отсутствие отметки и непроведённое занятие не участвуют. Рекомендательный характер и допустимость раннего попадания клиента в список зафиксированы.
