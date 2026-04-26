# План внедрения UI V7 для окна "Клиенты"

Основание: [CLIENTS_WINDOW_TARGET_MOCKUP_V7_SPEC.md](CLIENTS_WINDOW_TARGET_MOCKUP_V7_SPEC.md) и текущая реализация в `frontend/src/features/clients/ClientManagement.tsx`.

## 1. Цель

Перевести раздел "Клиенты" из режима большой карточной страницы в рабочий list-first экран:

- быстрый поиск клиента по имени или телефону;
- частые фильтры в верхней панели списка;
- плотный список с одним понятным следующим шагом в строке;
- короткий контекстный preview выбранного клиента;
- переход в полную карточку только для редактирования, истории и редких сценариев.

## 2. Текущее состояние

Сейчас список клиентов находится в большом модуле `ClientManagement.tsx` вместе с create/edit/detail сценариями. Верх экрана состоит из hero-блока, трех `MetricCard`, расширенной формы фильтров и карточек клиентов.

Что уже можно переиспользовать:

- маршруты `/clients`, `/clients/new`, `/clients/:id`, `/clients/:id/edit`;
- загрузка клиентов, групп, пагинация и reload;
- фильтры `fullName`, `phone`, `groupId`, `status`, `paymentStatus`, `membershipExpiresFrom/To`, `hasGroup`, `hasActivePaidMembership`;
- данные строки: ФИО, телефон, статус, группы, фото, membership-warning флаги;
- `getClient(clientId)` для lazy-load preview с текущим абонементом, membership history и attendance history.

Главные расхождения с V7:

- верх работает как мини-дашборд, а не как панель управления списком;
- поиск имени и телефона разделен на два поля;
- фильтры применяются через submit формы;
- список сделан карточками, без выбранной строки и правого preview;
- нет точного поля последнего визита в list payload;
- в текущем list payload нет `currentMembership`, поэтому строка списка не может точно показать тип абонемента, дату окончания и остаток/статус без дополнительного запроса;
- нет точной семантики quick-фильтров `Без абонемента` и `Пробные`;
- текущий `/clients` возвращает массив, а не envelope с `totalCount`, `activeCount` и `archivedCount`, поэтому заголовок `48 активных из 312` нельзя собрать точно;
- loading/error/empty состояния не соответствуют V7 copy и поведению.

Что важно про текущий backend:

- публичный `GET /clients` находится в `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs`;
- текущие query params: `page`, `pageSize`, `skip`, `take`, `status`, `isArchived`, `fullName`, `phone`, `groupId`, `paymentStatus`, `membershipExpiresFrom`, `membershipExpiresTo`, `hasPhoto`, `hasGroup`, `hasActivePaidMembership`;
- `Coach` может смотреть только клиентов своих групп, не может искать по `phone`, а телефон в list/details для него маскируется пустой строкой;
- `GET /clients/{id}` уже отдает `currentMembership`, `membershipHistory` и paged `attendanceHistory`, поэтому preview можно делать через lazy-load без нового detail endpoint;
- internal Bot API уже имеет свой `GET /internal/bot/clients?q=...` и не должен меняться ради frontend V7.

## 3. Принципы реализации

- Не расширять дальше монолит `ClientManagement.tsx`; сначала вынести list-срез в отдельные файлы.
- Сохранять стек `Mantine + Onest`.
- Не менять create/edit/detail сценарии без необходимости.
- Не добавлять долг и заморозку в новый UI: V7 явно исключает эти сценарии из окна.
- Строить `Следующий шаг` как один главный вывод, без набора равнозначных кнопок в строке.
- Делать точные backend-contract изменения до этапов с quick-фильтрами, 5-колоночным списком и точным счетчиком.
- Сохранять role-scoped contract: `Coach` не получает телефон, payment amount и историю абонемента сверх уже разрешенного backend-среза.
- Не менять `/internal/bot/*` ради frontend V7; bot проверять регрессией только если backend-рефакторинг затрагивает общие клиентские выборки или маппинг.

## 4. Целевая структура frontend

Создать рядом с текущей фичей срез:

- `frontend/src/features/clients/list/ClientsListScreen.tsx`;
- `frontend/src/features/clients/list/useClientsListState.ts`;
- `frontend/src/features/clients/list/clientListFilters.ts`;
- `frontend/src/features/clients/list/clientListViewModel.ts`;
- `frontend/src/features/clients/list/ClientsToolbar.tsx`;
- `frontend/src/features/clients/list/ClientsQuickFilters.tsx`;
- `frontend/src/features/clients/list/ClientsResults.tsx`;
- `frontend/src/features/clients/list/ClientPreviewPanel.tsx`.

В `ClientManagement.tsx` оставить create/edit/detail и временный re-export list screen либо постепенно вынести остальные крупные сущности позже.

## 5. Этапы внедрения

### Этап 1. Архитектурное разделение списка

1. Вынести `ClientsListScreen` и связанные list-only типы/хелперы из `ClientManagement.tsx`.
2. Оставить внешний контракт компонента прежним: `canManage`, `onCreate`, `onOpen`.
3. Перенести нормализацию фильтров, подсчет активных фильтров и сбор query params в `clientListFilters.ts`.
4. Вынести derived presentation-логику в `clientListViewModel.ts`:
   - статус и абонемент;
   - следующий шаг;
   - факты preview;
   - последние события preview.

Результат этапа: поведение старого экрана сохранено, но list-срез готов к V7 без дальнейшего раздувания route-level файла.

### Этап 1B. Backend-контракт V7 для списка клиентов

Этот этап нужен до точной реализации V7-таблицы. Без него frontend может собрать только приближение: поиск имени/телефона будет эвристикой, quick-фильтры `Без абонемента` и `Пробные` будут неточными, а колонка `Визит` останется пустой или будет требовать lazy-load каждого клиента.

Изменения backend:

1. Расширить публичный `GET /clients` в `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs`:
   - добавить unified search param `query` как основной;
   - опционально поддержать `search` как временный alias;
   - для `HeadCoach`/`Administrator` искать `OR` по ФИО и телефону;
   - для `Coach` искать только по ФИО и не раскрывать телефон;
   - оставить `fullName` и `phone` для backward compatibility, пока frontend полностью не перейдет на unified search;
   - явно не отправлять `fullName` и `phone` одновременно из V7 UI: legacy-параметры сейчас работают как `AND`, а не как единый поиск.
2. Вернуть envelope вместо простого массива:
   - `items`;
   - `totalCount`, `skip`, `take`, `page`, `pageSize`, `hasNextPage`;
   - `activeCount`, `archivedCount` для segmented status/header;
   - считать это breaking contract change для внешних web-клиентов и выполнять синхронно с frontend, либо вводить через version/feature flag.
3. Расширить list item полями, нужными V7:
   - lightweight `currentMembershipSummary`, а не полный detail/history payload;
   - `membershipState` или `hasCurrentMembership` для точного `Без абонемента`;
   - `lastVisitDate` или `lastAttendance` для колонки `Визит`;
   - опционально `nextAction`, только если правило должно стать единым backend contract;
   - для `Coach` либо оставить membership-зону урезанной, либо отдать coach-safe summary без `paymentAmount`, `paidBy`, contacts и истории изменений.
4. Зафиксировать фильтры:
   - `Без абонемента` -> `membershipState=None` или `hasCurrentMembership=false`;
   - `Пробные` -> `membershipType=SingleVisit`, если продуктово "пробный" равен разовому визиту;
   - если "пробный" не равен `SingleVisit`, добавить отдельный доменный признак `isTrial`/новый `MembershipType` и только тогда планировать EF migration.
5. `lastVisitDate` считать по `Attendance`:
   - по умолчанию как последний `IsPresent=true`;
   - для `Coach` учитывать только посещения в доступных ему группах.
6. Перевести list query на явную SQL-проекцию:
   - не грузить full entity graph через `Include(...).ToArray()` только ради списка;
   - отдельно оценить индексы для `Attendance(ClientId, TrainingDate)` или эквивалентного запроса last visit;
   - отдельно оценить нормализованный phone search, потому что текущий `Replace(...).Contains(...)` плохо использует индекс по `Phone`.
7. Обновить backend tests в `backend/tests/GymCrm.Tests/ClientsApiTests.cs`:
   - unified search name/phone, alias `search` если поддерживается, и запрет phone-search для `Coach`;
   - exact envelope shape и pagination/counts;
   - `membershipState`/`hasCurrentMembership` и trial/single-visit фильтр;
   - `lastVisitDate` с учетом role scope;
   - отсутствие утечки телефона и чувствительных payment-полей для `Coach`;
   - не полагаться только на permissive helper, который ищет массив в `data/items/clients`; добавить assertions на конкретные поля envelope.

Persistence:

- миграции не нужны, если `Пробные` маппятся на существующий `MembershipType.SingleVisit`, а `lastVisitDate` считается query-time;
- миграция нужна при отдельном trial-признаке, кешировании last visit в `Client`, добавлении нормализованного phone-search поля или новых индексов под list projection.

Синхронизация frontend после backend:

- `frontend/src/lib/api/types.ts` — добавить `query/search`, envelope counts, membership state, last visit поля;
- `frontend/src/lib/api/endpoints.ts` — добавить query key;
- `frontend/src/lib/api/clients.ts` — отправлять unified search и маппить новые поля;
- e2e mocks в `frontend/e2e/stage12.spec.ts` и `frontend/e2e/responsive-main-screens.spec.ts`;
- для роли `Coach` placeholder и поведение поиска не должны обещать поиск по телефону, пока access policy не изменена.

Влияние на bot:

- функциональных изменений в `bot/` не требуется, пока меняется только публичный `/clients`;
- если backend-рефакторинг выносит общую логику поиска/маппинга и затрагивает `/internal/bot/clients*`, прогнать `cd bot && ruff check .` и `cd bot && pytest`.

### Этап 2. Верх экрана и toolbar V7

1. Заменить hero на компактный page header:
   - `Клиенты`;
   - счетчик результата, например `48 активных из 312`;
   - primary action `Новый клиент`.
2. Убрать `MetricCard`-сводки и пассивные badges `Активные`, `Архив`, `Фильтров`.
3. Сделать toolbar списка:
   - единый search input с placeholder `Имя или телефон`;
   - segmented status control `Активные / Все / Архив`;
   - select `Группа`;
   - action `Еще фильтры`;
   - quiet action `Обновить`.
4. Перевести фильтры с `Применить` на apply-on-change:
   - search через debounce 300-400 ms;
   - Enter применяет поиск сразу;
   - status/group/quick filters применяются мгновенно.
5. Перенести старые расширенные фильтры в `Еще фильтры`:
   - диапазон окончания абонемента;
   - без фото, если нужен;
   - размер страницы, если остается пользовательской настройкой.
6. Не показывать строку активных фильтров, если нестандартных фильтров нет.

Ограничение: пока нет backend unified search, фронт должен либо определять телефон по вводу, либо временно отправлять поиск только как `fullName`. Отправлять одно значение одновременно в `fullName` и `phone` нельзя без проверки backend-семантики, потому что фильтры могут работать как `AND`.

### Этап 3. Quick-фильтры

Добавить вторую строку quick-фильтров:

- `Без абонемента`;
- `Скоро закончится`;
- `Без группы`;
- `Пробные`.

Реализация по текущему API:

- `Без группы` -> `hasGroup=false`;
- `Скоро закончится` -> `membershipExpiresTo=today+7d` и статус активных;
- `Без абонемента` -> временно `hasActivePaidMembership=false`, но это шире V7-смысла;
- `Пробные` -> заблокировано до контрактного решения или временно только client-side на текущей странице по `currentMembership.membershipType === 'SingleVisit'`.

После backend-этапа 1B:

- `Без абонемента` должен использовать `membershipState=None` или `hasCurrentMembership=false`;
- `Пробные` должен использовать backend filter `membershipType=SingleVisit` или `isTrial=true`;
- `Скоро закончится` остается `membershipExpiresTo=today+7d`, если backend не добавит отдельный `membershipExpiresWithinDays`.
- Не использовать `GET /clients/expiring-memberships` как источник quick-фильтра V7 без отдельного решения: его окно задается backend-константой и сейчас не совпадает с предлагаемыми 7 днями.

Нужное продуктовое решение: зафиксировать, что считается "скоро закончится" (предлагаемый дефолт: 7 дней) и что именно означает "Пробные".

### Этап 4. Плотный список с 5 колонками

Заменить карточки клиентов на desktop/tablet structured list или table с колонками:

1. `Клиент`: фото/инициалы, ФИО, телефон при наличии права.
2. `Статус и абонемент`: активный/архивный статус, тип абонемента, дата окончания, остаток занятий если доступен.
3. `Следующий шаг`: один action/state.
4. `Группа`: основная группа или `Без группы`.
5. `Визит`: последний визит или нейтральное `Нет визитов`.

Точные значения для колонок `Статус и абонемент` и `Визит` зависят от backend-этапа 1B. До него можно показывать только безопасный fallback из текущих boolean-флагов и `Нет данных`, но это не считается полным V7.

Правила `Следующий шаг` для первой итерации:

- нет текущего абонемента -> `Оформить`;
- абонемент скоро истекает -> `Продлить`;
- текущий абонемент не оплачен -> `Предложить`;
- нет группы -> `В группу`;
- иначе -> `Планово`.

Что убрать из строки:

- дубли `Статус: ...`;
- `Контактов: ...`;
- `Групп: ...`;
- `Только просмотр`;
- оплату как отдельный шумный сигнал, если она не является выбранным `Следующий шаг`.

### Этап 5. Preview выбранного клиента

На desktop добавить правую sticky-панель:

- клиент;
- телефон, если роль позволяет;
- статус;
- блок `Нужно сейчас`;
- 4-5 ключевых фактов;
- 3 последних события;
- действия `Открыть карточку`, `Визит`, `Редактировать`.

Технически:

- держать локальный `selectedClientId`;
- по умолчанию выбирать первого клиента после загрузки;
- lazy-load `getClient(selectedClientId)` только для preview;
- кэшировать загруженные preview details по `clientId`;
- выбор строки не должен сбрасывать search, filters, page или scroll.

Если срочного действия нет, показывать `Планово` или `Ничего срочного`.

### Этап 6. Состояния V7

Loading:

- toolbar сохраняет высоту;
- список показывает skeleton rows;
- счетчик обновляется через `aria-live="polite"`.

Empty после поиска или фильтров:

- заголовок `Клиенты не найдены`;
- текст `Попробуйте изменить поиск или сбросить фильтры.`;
- действие `Сбросить фильтры`.

Empty first-run:

- заголовок `Клиентов пока нет`;
- текст `Создайте первую карточку клиента.`;
- действие `Новый клиент`.

Error:

- inline alert над списком;
- текст `Не удалось загрузить клиентов`;
- действие `Повторить`.

### Этап 7. Responsive

Desktop:

- header в 1 ряд;
- toolbar в 1 ряд;
- quick-фильтры второй строкой;
- preview справа;
- таблица без горизонтального page-scroll.

Tablet:

- toolbar переносится в 2 ряда;
- preview скрывается или открывается отдельной панелью;
- список остается главным рабочим слоем.

Mobile:

- `Клиенты` и `Новый клиент` сверху;
- поиск на всю ширину;
- статус отдельной строкой;
- quick-фильтры горизонтальным скроллом;
- список карточками;
- выбранный клиент открывается через существующий `/clients/:id` или sheet, а не длинным preview под таблицей.

Accessibility:

- quick-фильтры с `aria-pressed`;
- счетчик результатов с `aria-live="polite"`;
- строки доступны с клавиатуры;
- на desktop выбор строки не уводит фокус в preview;
- на mobile sheet должен возвращать фокус на исходную строку.

## 6. Контрактные решения

Обязательные решения для полного V7:

- имя unified search param: `query` как canonical, `search` только как временный alias при необходимости;
- legacy `fullName`/`phone` сохранить, но V7 UI должен использовать только `query`, потому что одновременные `fullName` и `phone` сейчас дают пересечение фильтров;
- для `Coach` либо менять placeholder на `Имя`, либо отдельно принимать продуктово-безопасностное решение о праве искать по телефону;
- формат list response envelope и семантика счетчиков:
  - `totalCount` — количество после всех выбранных фильтров;
  - `activeCount`/`archivedCount` — количество в текущем access scope и текущем search/group/quick-срезе до применения status segment;
- формат membership summary:
  - рекомендуется отдельный `CurrentMembershipSummaryResponse`, чтобы не раскрывать `paymentAmount` и audit-поля для `Coach`;
  - старые `hasActivePaidMembership` и `hasUnpaidCurrentMembership` оставить рядом с новыми полями на время rollout;
- точная семантика `Без абонемента`:
  - рекомендуется "нет текущего membership с `ValidTo == null`";
  - не использовать `hasActivePaidMembership=false`, потому что туда попадают неоплаченные, истекшие и использованные разовые визиты;
- точная семантика `Пробные`:
  - если это `MembershipType.SingleVisit`, schema changes не нужны;
  - если это отдельный trial-статус, нужен доменный признак и миграция;
- `lastVisitDate` считать только по фактическим присутствиям (`IsPresent=true`), иначе колонку назвать не `Визит`, а `Последняя отметка`;
- `nextAction` оставить frontend-derived на первой итерации, пока нет требования использовать то же правило в bot/backend;
- performance/persistence решение: list endpoint должен строить projection под V7-строку, а не загружать полные entity graphs; индексы и нормализованный phone-search проверять как часть backend-этапа.

Синхронно обновлять:

- backend endpoint `/clients`;
- backend tests `backend/tests/GymCrm.Tests/ClientsApiTests.cs`;
- `frontend/src/lib/api/types.ts`;
- `frontend/src/lib/api/endpoints.ts`;
- `frontend/src/lib/api/clients.ts`;
- e2e mocks в `frontend/e2e/stage12.spec.ts` и `frontend/e2e/responsive-main-screens.spec.ts`.

Bot:

- текущий bot использует отдельные `/internal/bot/*` endpoints, поэтому V7 `/clients` не требует изменений в `bot/`;
- если в backend появится shared mapper/query для web и bot, добавить bot regression run в проверочный набор.

## 7. Проверки

После backend-контрактного этапа:

```bash
dotnet test backend/GymCrm.slnx
dotnet test backend/tests/GymCrm.Tests/GymCrm.Tests.csproj --filter "FullyQualifiedName~ClientsApiTests"
```

Минимум после frontend-этапов:

```bash
cd frontend && npm run lint
cd frontend && npm run build
```

Точечные e2e:

```bash
cd frontend && npm run test:e2e -- e2e/stage12.spec.ts
cd frontend && npm run test:e2e -- e2e/responsive-main-screens.spec.ts
```

Новые или обновленные Playwright-сценарии:

- desktop toolbar и quick-фильтры отправляют ожидаемые query params;
- поиск по имени/телефону;
- empty после фильтров;
- empty first-run;
- error + retry;
- выбор строки обновляет preview;
- переход в полную карточку и возврат сохраняют состояние списка;
- mobile не показывает desktop preview и не дает horizontal scroll;
- trainer/coach роль не видит management-only действия.

Если backend-рефакторинг затронул `/internal/bot/*` или shared bot-facing маппинг:

```bash
cd bot && ruff check .
cd bot && pytest
```

## 8. Рекомендуемый порядок работ

1. Вынести list-срез из `ClientManagement.tsx`.
2. Реализовать backend-контракт V7 для `/clients` или явно зафиксировать frontend fallback как временный.
3. Синхронизировать `frontend/src/lib/api/*` с новым контрактом.
4. Внедрить компактный header, toolbar и quick-фильтры.
5. Перевести карточки списка в 5-колоночный structured list.
6. Добавить derived `Следующий шаг`.
7. Добавить desktop preview с lazy-load details.
8. Довести loading/empty/error состояния.
9. Закрыть responsive и accessibility.
10. Добавить e2e на новые сценарии.
