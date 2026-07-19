# Implementation Plan: TASK-067 Выявлять клиентов с повторными пропусками тренировок

## Source task
/backlog/tasks-ready/TASK-067-missed-training-follow-up.md

## Implementation branch
feature/TASK-067-missed-training-follow-up

Branch rules:
- создать ветку от актуальной чистой `main` до изменения кода;
- не реализовывать другие TASK в этой ветке;
- перед каждым изменением кода подтвердить, что активна указанная ветка.

## Goal
Дать администратору и главному тренеру единый backend-owned список клиентов, требующих связи: без дублей, со всеми актуальными причинами, включая три и более последовательных `Absent`, и с независимым закрытием причины пропусков действием `Связались`.

## Current understanding
- Существующий `GET /clients/expiring-memberships` и `MembershipAttentionListItemResponse` возвращают одну membership-причину на строку и должны эволюционировать в единый контракт причин внимания.
- Доступ к endpoint уже ограничен политикой `ManageClients`; frontend показывает панель по `canManageClients`. Нужно регрессионно подтвердить точные роли Administrator/HeadCoach и запрет остальным ролям.
- Явные отметки хранятся в `Attendance`: `IsPresent = false` соответствует `Absent`; отсутствие записи соответствует `Unmarked` и не является пропуском.
- Последовательность считается глобально по клиенту и хронологии занятий, а не по одной группе или одному абонементу. Смена группы и окончание абонемента её не разрывают.
- Текущий membership attention window равен 10 дням. Для отдельной причины обязательного follow-up нужен backend-owned порог `0–3` календарных дня включительно; существующие причины нельзя потерять.
- Текущее хранилище не содержит канонической модели заморозки абонемента. До реализации следует определить или отдельно добавить backend-owned freeze interval; вычислять заморозку из UI/косвенных признаков запрещено.
- Для `Связались` требуется сохраняемая backend-owned граница обработанной последовательности с аудитом и защитой от повторной/параллельной команды.

## Preferred implementation strategy
1. Contract-first и test-first: сначала зафиксировать DTO единого списка, типы причин и команду закрытия причины тестами.
2. Выделить расчёт streak в небольшой Application/Domain service, не размещать attendance semantics в endpoint или frontend.
3. Добавить отдельное состояние follow-up acknowledgement, связанное с клиентом и обработанной последовательностью, а не общий флаг клиента.
4. Строить один агрегат на клиента с коллекцией причин; сортировку и дедупликацию выполнять на backend.
5. Сохранить переходный alias старого frontend API только при необходимости, но перевести экран на явно названный attention contract.
6. Интегрировать frontend после стабилизации backend-контракта; UX-проверку карточки, причин и действий выполнить с `ui-designer`, как требует значимое изменение интерфейса.
7. Делать небольшие проверяемые коммиты: prerequisite semantics/schema, failing tests, backend calculation/API, acknowledgement, frontend contract/UI, regression fixes.

## Execution steps
1. Проверить чистую актуальную `main`, создать и активировать `feature/TASK-067-missed-training-follow-up`.
2. Выполнить prerequisite discovery без production-изменений: определить источник факта состоявшегося занятия и канонический freeze interval. Если freeze semantics отсутствует, сначала локально декомпозировать/реализовать backend-owned модель заморозки с отдельными acceptance criteria; не подменять её датами абонемента или frontend-флагом.
3. До production-кода написать unit-тесты сервиса расчёта streak: границы 2/3, `Present`, `Absent`, `Unmarked`, пропуск ожидаемого занятия, freeze interval, смена группы, пересечение/окончание абонемента, корректировка отметки и граница acknowledgement.
4. До production-кода написать backend integration-тесты единого endpoint и action `Связались`: роли, branch/access scope, причины `0–3` и `4` дня, unpaid/expired compatibility, один клиент с несколькими причинами, отсутствие дублей, поля контакта/комментария/Telegram, идемпотентность и audit.
5. До production-кода обновить frontend API mapper/component tests и Playwright-сценарии так, чтобы они описывали новое название вкладки, уникальный счётчик клиентов, все причины, поля, Telegram, `Связались`, частичное удаление причины, loading/error/empty и узкие экраны.
6. Запустить новые выборочные unit/integration/frontend-тесты и подтвердить ожидаемое падение именно из-за отсутствующего unified attention contract, streak calculation и acknowledgement endpoint. Не продолжать при падении setup/fixture по посторонней причине.
7. Реализовать минимальную backend-модель: типизированные причины внимания, projection единого клиента, сервис streak и сохраняемую acknowledgement boundary. При добавлении таблицы обновить воспроизводимое начальное состояние схемы и конфигурации EF; не создавать миграцию, если принятый для текущего проекта implementation flow требует обновления initial schema.
8. Эволюционировать `GET /clients/expiring-memberships` в явно именованный unified endpoint (предпочтительно `GET /clients/attention`) с временной совместимостью старого route, если он нужен существующим потребителям. Backend возвращает уникального клиента, `reasons[]`, missed count, phone, notes, membership summary и Telegram username/link data.
9. Реализовать `POST /clients/{clientId}/attention/missed-training/contacted` (или эквивалентный typed route): закрывать только текущую missed-training причину, сохранять boundary атомарно, писать audit и возвращать актуализированный результат/статус для безопасного UI refresh.
10. Обеспечить повторный расчёт из актуальных attendance/freeze данных: исправление отметки или freeze interval не должно оставлять stale derived flag; после acknowledgement учитываются только занятия новой последовательности.
11. Обновить frontend `lib/api` и панель Home: название `Клиенты, требующие внимания`, карточка одного клиента со всеми badges/reasons, ФИО, телефон, membership status, notes, missed count, внешний Telegram link и локально блокируемое действие `Связались` с повторной загрузкой.
12. Сохранить клиента после `Связались`, если остаются membership-причины; удалить карточку и уменьшить уникальный счётчик только при отсутствии остальных причин. Ошибка команды не должна оптимистично скрывать причину.
13. Запустить новые тесты до зелёного состояния, затем `dotnet test backend/GymCrm.slnx`, frontend unit tests, `npm run lint`, `npm run build` и затронутые Playwright tests.
14. Провести ручной smoke test локального стенда для Administrator и HeadCoach, проверить запрет для Coach, внешний Telegram без отправки сообщения и визуальную равнозначность follow-up причин на desktop/mobile.

## Files likely to change
- `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/MembershipAttentionListItemResponse.cs` (заменить/расширить типизированным unified contract)
- `backend/src/GymCrm.Application/Attendance/` (новый focused streak service/contract)
- `backend/src/GymCrm.Domain/Attendance/Attendance.cs`
- `backend/src/GymCrm.Domain/Clients/` (новая acknowledgement entity и, при согласованном prerequisite, freeze model)
- `backend/src/GymCrm.Infrastructure/Persistence/GymCrmDbContext.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/` (новые конфигурации/индексы)
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.cs` и snapshot — только если принят flow обновления initial schema
- `backend/tests/GymCrm.Tests/ClientsApiTests.cs`
- новый focused backend unit-test файл для streak calculator
- `frontend/src/lib/api/endpoints.ts`
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/clients.ts`
- `frontend/src/lib/api/clients.test.ts`
- `frontend/src/lib/resources.ts`
- `frontend/src/features/home/HomeDashboard.tsx`
- `frontend/src/features/home/MembershipsPanel.tsx` (предпочтительно переименовать в attention-oriented component)
- `frontend/src/features/home/HomeDashboard.test.tsx`
- `frontend/e2e/home-dashboard.spec.ts`
- при необходимости `frontend/e2e/responsive-main-screens.spec.ts`, `frontend/e2e/auth.spec.ts` и mock routes старого endpoint

## Constraints
- Attendance, freeze, membership reason, access scope, acknowledgement и дедупликация принадлежат backend.
- Frontend не вычисляет streak, трёхдневный порог, роли или объединение причин.
- Только явно сохранённый `Absent` считается пропуском; `Unmarked` не считается `Absent`.
- Смена группы и окончание абонемента не разрывают streak; отсутствие занятия и freeze interval разрывают.
- `Связались` закрывает только missed-training reason и не изменяет attendance/membership.
- Не менять правила списания посещений, автоматическую коммуникацию или CRM-воронку.
- Не ломать существующие membership attention причины и внешних потребителей без явной compatibility strategy.

## Out of scope
- Автоматическая отправка Telegram/других сообщений.
- Новые правила посещаемости или списания абонементов.
- Общая CRM-воронка и произвольные follow-up статусы.
- Переработка RBAC: используются существующие backend permissions.
- Историческая backfill-кампания вне детерминированного расчёта из имеющихся данных.

## Required test coverage

### Unit tests — написать до functional code
- streak = 0/1/2 не создаёт reason; 3 и 4 создают reason с точным count;
- `Present` разрывает streak, `Unmarked` не превращается в `Absent`;
- пропущенное/несостоявшееся ожидаемое занятие и freeze interval разрывают streak;
- смена группы и дата окончания membership не разрывают streak;
- три `Absent` после окончания membership создают reason;
- исправление `Absent` на `Present`/`Unmarked` и изменение freeze пересчитывают результат;
- acknowledgement закрывает текущую sequence; только три новых последовательных `Absent` после boundary возвращают reason;
- membership reasons и missed reason агрегируются в один client result без потери причин.

### Integration tests — написать до functional code
- Administrator и HeadCoach получают endpoint/выполняют action; Coach и прочие роли запрещены;
- branch/access scope не раскрывает чужих клиентов;
- `0,1,2,3` дня создают backend reason скорого окончания, `4` дня — нет;
- существующие Expired/Unpaid причины сохраняются;
- один клиент с membership + missed reason возвращается один раз с двумя reasons;
- DTO содержит ФИО, телефон, notes, membership status, missed count и опциональный Telegram;
- `Связались` атомарно и идемпотентно закрывает только missed reason, сохраняет другие reasons и создаёт audit;
- после трёх новых пропусков reason появляется снова;
- concurrency/double-click не создаёт противоречивых acknowledgement rows;
- clean database schema содержит новые таблицы/индексы и поднимается воспроизводимо.

### Frontend tests — написать до functional code
- mapper строго читает backend reasons и nullable contact fields без клиентских вычислений;
- вкладка и заголовок переименованы, счётчик равен количеству уникальных client items;
- карточка показывает все причины и обязательные поля, missed count только для соответствующей причины;
- `Связались` закрывает только missed reason; карточка остаётся с membership reason или исчезает без других reasons;
- при ошибке action причина остаётся и доступен retry;
- Telegram открывается внешней ссылкой только при наличии username/link data и не отправляет сообщение;
- empty/loading/error states относятся к единому списку;
- responsive Playwright проверяет заметность причин и доступность primary action на узком экране.

### Expected initial failure
- Сначала запустить focused новые тесты отдельно по слоям.
- Зафиксировать red-state: backend tests должны падать из-за отсутствующих calculator/DTO/action/schema, frontend tests — из-за старого membership-only контракта и UI.
- Если тест падает из-за неверной fixture, времени/таймзоны или инфраструктуры, исправить тестовый setup и повторить red-state до изменения production-кода.

### Manual-only validation
- Визуальная равнозначность badges/actions и сканируемость длинных notes на поддерживаемых ширинах.
- Фактическое открытие внешнего Telegram-клиента в браузере без автоматической отправки.
- Screen-reader/keyboard smoke test вкладки, badges и действия.

## Test plan
- [ ] Unit и integration tests добавлены до functional code и ожидаемо упали.
- [ ] Границы 2/3 пропуска и `0–3`/`4` дня покрыты автоматически.
- [ ] `Present`, `Absent`, `Unmarked`, gap/no-lesson, freeze, group change и membership expiry покрыты.
- [ ] Acknowledgement, повторное появление, исправление attendance/freeze, идемпотентность и audit покрыты.
- [ ] Дедупликация и несколько reasons одного клиента проверены API и UI тестами.
- [ ] Роли и branch scope проверены integration/e2e тестами.
- [ ] Telegram/отсутствие Telegram и все обязательные поля проверены frontend тестами.
- [ ] `dotnet test backend/GymCrm.slnx` проходит.
- [ ] Frontend tests, `npm run lint` и `npm run build` проходят.
- [ ] Затронутые Playwright tests проходят на desktop и narrow viewport.

## Regression barrier
Обязательный барьер — backend parameterized unit suite для streak state machine плюс API integration suite, которая на одной fixture одновременно доказывает unique-client aggregation, несколько reasons, role/scope, acknowledgement boundary и повторное появление. Frontend component/Playwright suite должна использовать только backend-shaped `reasons[]` и доказывать, что действие не скрывает оставшиеся причины. Эти тесты входят в стандартные backend/frontend проверки; manual QA их не заменяет.

## Risks
- В текущей модели нет freeze interval; реализация без prerequisite нарушит acceptance criteria.
- Историческое расписание/назначения групп могут быть недостаточны для точного определения «занятие состоялось/не состоялось»; это нужно доказать discovery и тестовыми fixtures.
- Сохранение только даты acknowledgement может быть неоднозначно при нескольких группах/занятиях в день; boundary должна опираться на устойчивую идентичность/упорядоченный sequence token.
- Изменения прошлых attendance/freeze данных могут инвалидировать acknowledgement semantics; алгоритм должен быть детерминирован и покрыт correction tests.
- Старый endpoint используется Home и e2e mocks, возможно internal bot; route/contract migration требует поиска всех consumers и compatibility решения.
- Порог 10 дней существующей `ExpiringSoon` причины и новый обязательный outreach порог 3 дня нельзя неявно смешать: причины должны быть явно типизированы.

## Decomposition for safe execution
1. Prerequisite: канонический lesson occurrence/gap и membership freeze contract с тестами, если их нельзя вывести из текущей модели без неоднозначности.
2. Backend streak calculator + acknowledgement persistence/audit.
3. Unified client attention API с compatibility layer и role/scope tests.
4. Frontend contract/UI/Telegram/action с responsive review.
5. Full regression и локальный runtime smoke test.

## Stop conditions
Остановиться и не писать functional code, если:
- не найден backend-owned источник freeze intervals или факта состоявшегося занятия;
- историческое расписание не позволяет однозначно упорядочить занятия клиента при смене группы;
- API contract требует frontend-side дедупликации/вычисления причин;
- acknowledgement нельзя сделать атомарным и устойчивым к исправлению attendance;
- обнаружен новый системный RBAC redesign, production-destructive migration или scope вышел за TASK-067;
- невозможно определить compatibility для существующих consumers старого endpoint.

Не останавливаться только из-за одновременных backend/frontend изменений или необходимости локального schema change.

## Ready for Codex execution
no — план готов, но до переноса задачи в активную implementation необходимо закрыть prerequisite по канонической модели заморозки и подтвердить источник lesson occurrence/gap. После этого план допускает phased execution в указанной отдельной ветке.
