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
- Membership attention window задаётся backend startup configuration. Значение по умолчанию — `3` календарных дня; изменение применяется после перезапуска сервиса.
- Отдельная модель заморозки исключена из TASK-067. Временная приостановка обслуживается изменением даты окончания абонемента и сама по себе не разрывает streak.
- Для `Связались` требуется сохраняемая backend-owned граница обработанной последовательности с аудитом и защитой от повторной/параллельной команды.
- Конкретное занятие моделируется backend-owned сущностью `LessonOccurrence` с устойчивым ID и неизменяемыми snapshot-полями даты и времени начала. Последующие изменения расписания группы не переупорядочивают исторические занятия.
- `LessonOccurrence` создаётся при первом сохранении ведомости либо при явной отметке, что занятие не проводилось. Состояние можно исправить между `held` и `not held`; изменение состояния аудитируется.
- Если для occurrence есть хотя бы одна сохранённая отметка `Present`/`Absent`, занятие считается проведённым. Если отметок нет, оно не участвует в streak и эффективно считается непроведённым.
- На проведённом занятии отсутствие отметки у конкретного клиента означает `Unmarked` и разрывает streak этого клиента.
- Administrator видит только клиентов и группы доступных ему филиалов; list и action обязаны применять backend-owned branch scope.
- Telegram-ссылка формируется только для активной Telegram-привязки с сохранённым `Username`.
- Если у клиента несколько занятий в один день, они упорядочиваются по snapshot-времени начала occurrence; при совпадении времени используется устойчивый occurrence ID. Более поздний `Present`/`Unmarked` разрывает streak после более раннего `Absent`.

## Accepted clarifications
- Добавить backend-owned состояние занятия для пары `group + training date` с явным признаком отмены/непроведения; значение по умолчанию — занятие проводится.
- Реализовать состояние как `LessonOccurrence` с устойчивым ID и snapshot даты/времени начала. Occurrence создаётся при сохранении ведомости или явной отмене; смена состояния `held`/`not held` разрешена и аудитируется.
- Эффективное состояние `not held` возникает при явной отмене либо автоматически, если для occurrence нет ни одной сохранённой отметки `Present`/`Absent`.
- Если занятие проведено, `Unmarked` конкретного клиента разрывает его streak, но не считается пропуском.
- Новый `GET /clients/attention` используется unified UI. Старый `/clients/expiring-memberships` временно сохраняет membership-only контракт для bot и других consumers.
- Порог скорого окончания берётся из backend startup configuration, по умолчанию равен `3`, валидируется при старте и не перечитывается без перезапуска.
- Branch scope обязателен для чтения attention list и команды `Связались`.
- TASK-061 остаётся обязательной семантикой: `IndividualValidTo` — включительная последняя дата действия; для месячного Term при старте 10 июня дата окончания остаётся 9 июля. Attention использует сохранённую дату без повторного расчёта.
- Telegram deep link возвращается только при наличии нормализованного сохранённого `Username`; platform user id, chat id и display name для публичной ссылки не используются.
- Заморозка абонемента в TASK-067 не учитывается и не влияет на streak; поддержку заморозки следует реализовывать отдельной задачей после появления самостоятельной доменной модели.
- Доступ к attention list, карточке и действию `Связались` определяется текущим `Client.BranchId`. Исторические занятия из прежних групп/филиалов участвуют в глобальном расчёте streak, но не предоставляют сотрудникам прежнего филиала доступ к клиенту.

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
2. Реализовать prerequisite-модель `LessonOccurrence` для пары `group + training date`: устойчивый ID, snapshot даты/времени начала, создание при сохранении ведомости или явной отмене, исправляемое состояние `held`/`not held` с аудитом; отсутствие любых сохранённых `Present`/`Absent` даёт эффективное состояние `not held`.
3. До production-кода написать unit-тесты сервиса расчёта streak: границы 2/3, `Present`, `Absent`, `Unmarked`, пропуск ожидаемого занятия, несколько занятий одного дня, смена группы, пересечение/окончание абонемента, корректировка отметки и граница acknowledgement.
4. До production-кода написать backend integration-тесты единого endpoint и action `Связались`: роли, branch/access scope чтения и команды, configured attention window и его граница, unpaid/expired compatibility, один клиент с несколькими причинами, отсутствие дублей, поля контакта/комментария/Telegram, идемпотентность и audit.
5. До production-кода обновить frontend API mapper/component tests и Playwright-сценарии так, чтобы они описывали новое название вкладки, уникальный счётчик клиентов, все причины, поля, Telegram, `Связались`, частичное удаление причины, loading/error/empty и узкие экраны.
6. Запустить новые выборочные unit/integration/frontend-тесты и подтвердить ожидаемое падение именно из-за отсутствующего unified attention contract, streak calculation и acknowledgement endpoint. Не продолжать при падении setup/fixture по посторонней причине.
7. Реализовать минимальную backend-модель: типизированные причины внимания, projection единого клиента, сервис streak и сохраняемую acknowledgement boundary. При добавлении таблицы обновить воспроизводимое начальное состояние схемы и конфигурации EF; не создавать миграцию, если принятый для текущего проекта implementation flow требует обновления initial schema.
8. Добавить `GET /clients/attention` для unified UI. Сохранить `/clients/expiring-memberships` с прежним membership-only контрактом для bot и других существующих consumers. Backend возвращает уникального клиента, `reasons[]`, missed count, phone, notes, membership summary и Telegram username/link data.
9. Реализовать `POST /clients/{clientId}/attention/missed-training/contacted` (или эквивалентный typed route): закрывать только текущую missed-training причину, сохранять boundary атомарно, писать audit и возвращать актуализированный результат/статус для безопасного UI refresh.
10. Обеспечить повторный расчёт из актуальных attendance данных: исправление отметки не должно оставлять stale derived flag; после acknowledgement учитываются только занятия новой последовательности.
11. Обновить frontend `lib/api` и панель Home: название `Клиенты, требующие внимания`, карточка одного клиента со всеми badges/reasons, ФИО, телефон, membership status, notes, missed count, внешний Telegram link и локально блокируемое действие `Связались` с повторной загрузкой.
12. Сохранить клиента после `Связались`, если остаются membership-причины; удалить карточку и уменьшить уникальный счётчик только при отсутствии остальных причин. Ошибка команды не должна оптимистично скрывать причину.
13. Запустить новые тесты до зелёного состояния, затем `dotnet test backend/GymCrm.slnx`, frontend unit tests, `npm run lint`, `npm run build` и затронутые Playwright tests.
14. Провести ручной smoke test локального стенда для Administrator и HeadCoach, проверить запрет для Coach, внешний Telegram без отправки сообщения и визуальную равнозначность follow-up причин на desktop/mobile.

## Files likely to change
- `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/MembershipAttentionListItemResponse.cs` (заменить/расширить типизированным unified contract)
- `backend/src/GymCrm.Application/Attendance/` (новый focused streak service/contract)
- `backend/src/GymCrm.Domain/Attendance/Attendance.cs`
- `backend/src/GymCrm.Domain/Clients/` (новая acknowledgement entity)
- `backend/src/GymCrm.Infrastructure/Persistence/GymCrmDbContext.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/` (новые конфигурации/индексы)
- backend typed startup options и соответствующие appsettings/deploy overrides для attention window
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
- Attendance, lesson occurrence, membership reason, access scope, acknowledgement и дедупликация принадлежат backend.
- Frontend не вычисляет streak, трёхдневный порог, роли или объединение причин.
- Только явно сохранённый `Absent` считается пропуском; `Unmarked` не считается `Absent`, но на проведённом занятии разрывает streak конкретного клиента.
- Явно отменённое занятие и занятие без единой сохранённой отметки `Present`/`Absent` считаются не проводившимися и разрывают streak.
- Смена группы, окончание абонемента и изменение его даты окончания не разрывают streak; непроведённое занятие разрывает. Заморозка в этой реализации не учитывается.
- Исторический порядок занятий опирается на snapshot даты/времени `LessonOccurrence` и устойчивый occurrence ID, а не на текущее изменяемое расписание группы.
- Branch scope чтения и команды определяется текущим `Client.BranchId`; исторические занятия других филиалов используются только в расчёте.
- `Связались` закрывает только missed-training reason и не изменяет attendance/membership.
- Не менять правила списания посещений, автоматическую коммуникацию или CRM-воронку.
- Не ломать существующие membership attention причины и внешних потребителей без явной compatibility strategy.
- Сохранить включительную семантику `IndividualValidTo` из TASK-061; attention window сравнивается с этой датой без дополнительного `+1/-1`.

## Out of scope
- Автоматическая отправка Telegram/других сообщений.
- Новые правила посещаемости или списания абонементов.
- Общая CRM-воронка и произвольные follow-up статусы.
- Переработка RBAC: используются существующие backend permissions.
- Историческая backfill-кампания вне детерминированного расчёта из имеющихся данных.

## Required test coverage

### Unit tests — написать до functional code
- streak = 0/1/2 не создаёт reason; 3 и 4 создают reason с точным count;
- `Present` разрывает streak; `Unmarked` не превращается в `Absent`, но на проведённом занятии разрывает streak клиента;
- непроведённое ожидаемое занятие разрывает streak;
- несколько занятий одного дня упорядочиваются по времени начала; более поздний `Present`/`Unmarked` разрывает streak после раннего `Absent`;
- смена группы и дата окончания membership не разрывают streak;
- три `Absent` после окончания membership создают reason;
- исправление `Absent` на `Present`/`Unmarked` пересчитывает результат;
- acknowledgement закрывает текущую sequence; только три новых последовательных `Absent` после boundary возвращают reason;
- membership reasons и missed reason агрегируются в один client result без потери причин.

### Integration tests — написать до functional code
- Administrator и HeadCoach получают endpoint/выполняют action; Coach и прочие роли запрещены;
- branch/access scope не раскрывает чужих клиентов и не позволяет закрыть их missed-training reason прямой командой;
- при configured window `3`: `0,1,2,3` дня создают backend reason скорого окончания, `4` дня — нет; отдельный test host подтверждает другое сконфигурированное значение;
- существующие Expired/Unpaid причины сохраняются;
- один клиент с membership + missed reason возвращается один раз с двумя reasons;
- DTO содержит ФИО, телефон, notes, membership status, missed count и опциональный Telegram;
- Telegram link отсутствует без сохранённого `Username`, даже если Telegram account связан по platform user id;
- дата окончания из TASK-061 трактуется включительно: в `IndividualValidTo` остаётся `0` дней, следующий день даёт `Expired`;
- `Связались` атомарно и идемпотентно закрывает только missed reason, сохраняет другие reasons и создаёт audit;
- после трёх новых пропусков reason появляется снова;
- concurrency/double-click не создаёт противоречивых acknowledgement rows;
- clean database schema содержит новые таблицы/индексы и поднимается воспроизводимо.
- создание occurrence при сохранении ведомости/явной отмене, snapshot времени, исправление `held`/`not held` и audit изменения состояния покрыты integration-тестами.

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
- [ ] `Present`, `Absent`, `Unmarked`, gap/no-lesson, несколько занятий одного дня, group change и membership expiry покрыты.
- [ ] Acknowledgement, повторное появление, исправление attendance, идемпотентность и audit покрыты.
- [ ] Дедупликация и несколько reasons одного клиента проверены API и UI тестами.
- [ ] Роли и branch scope проверены integration/e2e тестами.
- [ ] Telegram/отсутствие Telegram и все обязательные поля проверены frontend тестами.
- [ ] `dotnet test backend/GymCrm.slnx` проходит.
- [ ] Frontend tests, `npm run lint` и `npm run build` проходят.
- [ ] Затронутые Playwright tests проходят на desktop и narrow viewport.

## Regression barrier
Обязательный барьер — backend parameterized unit suite для streak state machine плюс API integration suite, которая на одной fixture одновременно доказывает unique-client aggregation, несколько reasons, role/scope, acknowledgement boundary и повторное появление. Frontend component/Playwright suite должна использовать только backend-shaped `reasons[]` и доказывать, что действие не скрывает оставшиеся причины. Эти тесты входят в стандартные backend/frontend проверки; manual QA их не заменяет.

## Risks
- Историческое расписание группы не используется для переупорядочивания уже созданных занятий: дата и время фиксируются в `LessonOccurrence`. Для данных, существовавших до появления occurrence, требуется детерминированная compatibility/backfill-стратегия из имеющихся attendance-записей.
- Сохранение только даты acknowledgement неоднозначно при нескольких занятиях в день; boundary должна опираться на occurrence, упорядоченный по дате, времени начала и устойчивому ID.
- Изменения прошлых attendance данных могут инвалидировать acknowledgement semantics; алгоритм должен быть детерминирован и покрыт correction tests.
- Старый endpoint используется Home и e2e mocks, возможно internal bot; route/contract migration требует поиска всех consumers и compatibility решения.
- Невалидное значение startup configuration для attention window должно приводить к явной ошибке запуска, а не к скрытому fallback.

## Decomposition for safe execution
1. Prerequisite: `LessonOccurrence` со snapshot даты/времени, lifecycle создания/исправления, cancellation contract, audit и правило auto-not-held при отсутствии всех отметок.
2. Backend streak calculator + acknowledgement persistence/audit.
3. Unified client attention API с compatibility layer и role/scope tests.
4. Frontend contract/UI/Telegram/action с responsive review.
5. Full regression и локальный runtime smoke test.

## Stop conditions
Остановиться и не писать functional code, если:
- историческое расписание не позволяет однозначно упорядочить занятия клиента при смене группы;
- API contract требует frontend-side дедупликации/вычисления причин;
- acknowledgement нельзя сделать атомарным и устойчивым к исправлению attendance;
- обнаружен новый системный RBAC redesign, production-destructive migration или scope вышел за TASK-067;
- невозможно определить compatibility для существующих consumers старого endpoint.

Не останавливаться только из-за одновременных backend/frontend изменений или необходимости локального schema change.

## Ready for Codex execution
yes — lesson occurrence, порядок нескольких занятий одного дня, configurable attention window, compatibility, TASK-061 regression, Telegram и branch scope уточнены; заморозка исключена из scope.
