# План доработок для реализации Telegram-бота Gym CRM на Python

Дата: 2026-04-24

Основание: [BOT-МЕССЕНДЖЕР-ТЗ.md](BOT-МЕССЕНДЖЕР-ТЗ.md), [MVP-ТЗ.md](MVP-ТЗ.md), [MVP_SCREEN_MAP.md](MVP_SCREEN_MAP.md), текущая архитектура backend/frontend.

## 0. Статус сверки текущей реализации

Дата сверки: 2026-04-26.

Легенда:

- `[x]` — реализовано в текущем репозитории;
- `[~]` — реализовано частично или есть важные отличия от плана;
- `[ ]` — не найдено в текущей реализации.

Сверка выполнена по исходникам `backend/`, `frontend/`, `bot/`, тестам, `docker-compose.yml`, `.env.example` и `README.md`.

### 0.1. Сводка по крупным блокам

- `[x]` Отдельный Python-сервис `bot/` создан: есть `pyproject.toml`, `Dockerfile`, `FastAPI` health endpoints, `aiogram` long polling, `httpx` CRM client, `SQLAlchemy` async storage, `Alembic`, `pytest` и `ruff`.
- `[x]` Internal Bot API в backend создан: `/internal/bot` содержит MVP endpoints для resolve, меню, посещаемости, поиска клиентов, списков абонементов, отметки оплаты и audit access denied.
- `[x]` Service-to-service auth, `X-Request-Id` и `Idempotency-Key` для изменяющих Bot API endpoints реализованы.
- `[x]` CRM-owned поля `User.MessengerPlatform` и `User.MessengerPlatformUserId`, уникальность Telegram identity, user-facing create/update endpoints и frontend-поля реализованы.
- `[x]` Backend `BotIdempotencyRecord` реализован с hash Telegram user id, payload hash, сохранением response и TTL.
- `[x]` Audit source `Bot`, `messengerPlatform = Telegram`, Bot action codes, backend-фильтры и frontend-фильтры журнала действий реализованы.
- `[x]` Bot-owned storage для `bot_conversation_states` и `bot_processed_updates` реализован через SQLAlchemy models, repositories и Alembic migration.
- `[x]` Сценарии `/start`, `/id`, role-aware меню, посещаемость, поиск клиента, заканчивающиеся и неоплаченные абонементы, подтверждение и отметка оплаты реализованы в Python-сервисе.
- `[~]` Python-клиент вызывает `POST /internal/bot/audit/access-denied` без `Idempotency-Key`, а backend endpoint требует этот заголовок. Поэтому audit access denied из Python сейчас, вероятно, не записывается, хотя backend endpoint и backend tests реализованы.
- `[~]` Backend Bot API реализован как `IBotApiService`/`BotApiService`; часть read models собирается запросами в `GymCrm.Infrastructure/Bot/BotApiService.cs`, а не отдельными именованными use case'ами из списка плана.
- `[~]` Посещаемость в боте реализована без произвольного выбора даты в прошлом: для `HeadCoach`/`Administrator` кнопками доступны сегодня, вчера, позавчера и дата минус 7 дней. Roster выводится одной порцией, без разбиения клиентов на страницы.
- `[~]` Списки абонементов реализованы, но Python-отображение заканчивающихся абонементов не показывает количество дней до окончания, хотя backend DTO это поле возвращает.
- `[~]` Подтверждение оплаты в Python показывает ФИО и тип абонемента, но не показывает дату покупки и дату окончания, как указано в полном сценарии.
- `[~]` Конфигурация покрывает MVP-переменные, но не все будущие переменные из полного плана: нет webhook secret/path/allowed updates, public base URL, retention days для processed updates, reminder/daily summary/timezone настроек.
- `[~]` Документация и compose обновлены для запуска бота, но README не описывает полный troubleshooting и создание Telegram-бота пошагово.
- `[ ]` `bot_delivery_log`, scheduler, cleanup job для просроченных bot-owned записей, плановые уведомления, ежедневные сводки, photo upload, production webhook и MAX не реализованы.
- `[ ]` `BotNotificationSettings` не реализован.

### 0.2. Дальнейшие шаги реализации

Приоритет `P0` — закрыть перед приемкой текущего Telegram MVP:

- `[ ]` Исправить запись `BotAccessDenied` из Python-сервиса: передавать `Idempotency-Key` в `CrmBotApiClient.audit_access_denied`, строить стабильный ключ в `BotService` и добавить regression tests на заголовок и успешную запись audit.
- `[ ]` Довести отображение абонементов до сценариев плана: в списке заканчивающихся показывать количество дней до окончания, а в подтверждении оплаты показывать ФИО, тип абонемента, дату покупки и дату окончания.
- `[ ]` Довести сценарий посещаемости для `HeadCoach` и `Administrator`: добавить реальный выбор произвольной даты в прошлом или явно зафиксировать продуктово упрощенный набор дат, если оставляем только быстрые кнопки.
- `[ ]` Добавить порционную выдачу roster посещаемости, чтобы большие группы не упирались в лимиты Telegram-сообщений и callback-кнопок.
- `[ ]` Расширить Python scenario tests: роли `HeadCoach`/`Administrator`/`Coach`, ограничения дат, forbidden responses, search pagination, membership lists, mark-payment idempotency и private-chat/idempotency pipeline.
- `[ ]` Запустить обязательные проверки MVP: `cd bot && ruff check .`, `cd bot && pytest`, `dotnet test backend/GymCrm.slnx`, `cd frontend && npm run lint`, `cd frontend && npm run build`.
- `[ ]` Провести ручной smoke в Telegram для неизвестного и известного Telegram ID, меню по ролям, группового чата, посещаемости, поиска, списков абонементов и отметки оплаты.

Приоритет `P1` — техническое доведение после MVP-smoke, но до стабильного использования:

- `[ ]` Добавить cleanup job для истекших `bot_conversation_states` и старых `bot_processed_updates`, а также env-настройку retention периода.
- `[ ]` Обновить README: пошаговое создание Telegram-бота, настройка `.env`, запуск long polling, проверка health endpoints, типовые ошибки и troubleshooting.
- `[ ]` Добавить команды проверки для `bot/` в README или `pyproject` scripts, чтобы локальный запуск `ruff`/`pytest` был очевидным.
- `[ ]` Решить, оставляем ли автосоздание SQLAlchemy tables в `GymCrmBotApplication.start()` для dev или переводим runtime строго на Alembic migrations.

Приоритет `P2` — следующие функциональные срезы после приемки Telegram MVP:

- `[ ]` Реализовать загрузку фото клиента через Telegram: ожидание фото, скачивание файла, Bot API endpoint, подтверждение замены, audit event и tests.
- `[ ]` Спроектировать `BotNotificationSettings`, `bot_delivery_log` и scheduler только после уточнения backend-модели расписаний тренировок.
- `[ ]` Реализовать напоминания, ежедневные сводки и уведомления о неотмеченной посещаемости с защитой от дублей.
- `[ ]` Реализовать production webhook: public base URL, webhook endpoint, secret validation, allowed updates и deployment-инструкцию.
- `[ ]` После стабилизации Telegram-сценариев выделить абстракции adapter/core для будущего `MAX`.

## 1. Цель плана

План описывает доработки, необходимые для реализации Telegram-бота Gym CRM как отдельного Python-сервиса.

Бот должен закрыть быстрые мобильные сценарии:

- административная настройка Telegram ID в карточке пользователя CRM;
- role-aware меню;
- отметка посещаемости;
- поиск клиента;
- просмотр заканчивающихся и неоплаченных абонементов;
- отметка оплаты.

Первый MVP-срез реализуется только для `Telegram` и только для личных чатов пользователя с ботом. `MAX`, загрузка фотографий, плановые напоминания, ежедневные сводки и production webhook относятся к следующим срезам.

Бизнес-сценарии внутри Python-сервиса должны быть отделены от Telegram-адаптера, чтобы позже можно было добавить адаптер `MAX`.

## 2. Ключевые архитектурные решения

### 2.1. Новый Python-сервис

Добавить отдельный сервис:

- директория: `bot/`;
- язык: `Python`;
- запуск: отдельный контейнер `bot` в `docker-compose.yml`;
- интеграция с CRM: только через backend HTTP API;
- хранение transient-состояний бота: отдельная схема или таблицы в PostgreSQL;
- режим локальной разработки и первого MVP: Telegram long polling;
- production webhook: отдельный следующий срез, если есть публичный HTTPS endpoint.

Предлагаемая структура:

```text
bot/
  Dockerfile
  pyproject.toml
  alembic.ini
  src/
    gym_crm_bot/
      __init__.py
      main.py
      config.py
      logging.py
      app.py
      core/
      telegram/
      crm/
      storage/
      scheduling/
      resources/
  tests/
```

Сервис бота должен иметь health endpoints:

- `GET /health/live`;
- `GET /health/ready`.

### 2.2. Рекомендуемый Python stack

Рекомендуемый стек:

- `aiogram` — Telegram adapter, handlers, callback buttons, long polling/webhook;
- `FastAPI` + ASGI server — health endpoints, а в следующем срезе webhook endpoint;
- `httpx` — async HTTP-клиент к CRM backend;
- `pydantic-settings` — конфигурация из env;
- `SQLAlchemy` async + `asyncpg` — bot-owned storage в PostgreSQL;
- `Alembic` — миграции bot-owned таблиц;
- `pytest` + async test helpers — тесты сценариев;
- `ruff` — lint/format для Python-кода.

Версии библиотек нужно зафиксировать в `pyproject.toml` после технического spike. План не должен зависеть от конкретной minor-версии Telegram-библиотеки.

### 2.3. Backend остается источником бизнес-правил

Python-бот не должен:

- напрямую читать или писать CRM-таблицы клиентов, групп, абонементов, посещаемости и аудита;
- повторять EF-запросы из backend;
- самостоятельно принимать решения по правам пользователя;
- самостоятельно применять правила дат, ролевой срез данных или бизнес-валидацию CRM;
- фильтровать чувствительные поля как последний рубеж защиты;
- хранить пароль CRM или web-сессию пользователя.

Все бизнес-действия бот выполняет через backend:

- backend определяет CRM-пользователя по Telegram `user_id`, указанному в карточке пользователя CRM;
- backend применяет роли и access scope;
- backend применяет правила доступных дат и запрет будущих дат;
- backend возвращает готовые role-based read models для конкретного экрана или шага диалога;
- backend сохраняет изменения;
- backend пишет audit event с источником `Bot` и платформой `Telegram`.

Python-сервис отвечает за транспорт, состояние диалога, отображение backend read model в Telegram-сообщения и кнопки, idempotency входящих Telegram events и техническую обработку ошибок.

### 2.4. Внутренний Bot API в backend

Так как Python-сервис не может напрямую переиспользовать .NET `Application`-слой, backend должен предоставить внутренние endpoints для бота.

Bot API должен:

- быть доступен только из внутренней сети compose/production;
- требовать service-to-service авторизацию;
- принимать Telegram identity, а не доверять произвольному `UserId` от бота;
- внутри backend резолвить CRM-пользователя и проверять актуальные права;
- переиспользовать те же Application/use case'ы, что и web API;
- для изменяющих операций принимать `Idempotency-Key`, чтобы повторный Telegram callback не создавал повторную запись даже при повторном HTTP-вызове.

Рекомендуемый способ защиты MVP:

- общий secret в env: `BOT_BACKEND_API_TOKEN`;
- заголовок: `Authorization: Bearer <token>`;
- отдельная policy/auth handler в backend;
- обязательный `X-Request-Id` для трассировки;
- обязательный `Idempotency-Key` для изменяющих endpoints;
- опционально HMAC-подпись payload следующим этапом.

## 3. Данные

Данные делятся на CRM-owned и bot-owned.

### 3.1. CRM-owned данные в backend

Эти таблицы создаются EF Core миграциями backend, потому что они нужны web-интерфейсу и backend-проверкам.

#### Поля мессенджера в `User`

В первом MVP связь Telegram и CRM задается прямо в карточке пользователя CRM.

Добавить поля пользователя:

- `MessengerPlatform` со значением `Telegram`;
- `MessengerPlatformUserId` — Telegram `user_id`.

Индексы и ограничения:

- уникальный индекс по `MessengerPlatform + MessengerPlatformUserId`;
- если `MessengerPlatform = Telegram`, `MessengerPlatformUserId` обязателен;
- один Telegram `user_id` может быть указан только у одного пользователя CRM;
- один пользователь CRM может иметь только один Telegram `user_id`.

Отдельные таблицы `MessengerAccountLink` и `MessengerLinkToken` в MVP не нужны. Одноразовые коды и ссылки можно рассмотреть следующим срезом, если понадобится self-service привязка.

#### `BotNotificationSettings`

Назначение: настройки уведомлений пользователя.

Поля:

- `Id`;
- `UserId`;
- `Platform`;
- `NotificationsEnabled`;
- `TrainingReminderMinutesBefore`;
- `DailySummaryTime`;
- `LastSummarySentAt`;
- `CreatedAt`;
- `UpdatedAt`.

`BotNotificationSettings` можно добавить в следующем срезе вместе с уведомлениями. Значение по умолчанию для напоминания о тренировке — 15 минут до начала.

#### `BotIdempotencyRecord`

Назначение: backend-защита изменяющих Bot API команд от повторного выполнения.

Поля:

- `Id`;
- `Platform`;
- `PlatformUserIdHash`;
- `IdempotencyKey`;
- `ActionType`;
- `PayloadHash`;
- `ResponseJson`;
- `Status`;
- `CreatedAt`;
- `ExpiresAt`.

Индексы:

- уникальный индекс по `Platform + IdempotencyKey`;
- индекс по `ExpiresAt` для очистки.

Эта таблица принадлежит backend, потому что защищает CRM-изменения и audit от повторного выполнения даже при повторном HTTP-вызове из Python-сервиса.

### 3.2. Bot-owned данные в Python-сервисе

Эти таблицы создаются Alembic-миграциями бота в отдельной схеме, например `bot`, или с префиксом `bot_`.

Python-сервис может писать только в bot-owned таблицы.

#### `bot_conversation_states`

Назначение: состояние многошаговых сценариев.

Поля:

- `id`;
- `platform`;
- `chat_id`;
- `platform_user_id`;
- `scenario`;
- `state_json`;
- `created_at`;
- `updated_at`;
- `expires_at`.

Сценарии:

- отметка посещаемости;
- поиск клиента;
- отметка оплаты;
- настройки уведомлений.

Состояния загрузки фото и плановых уведомлений добавляются в следующих срезах, когда эти сценарии включаются в реализацию.

#### `bot_processed_updates`

Назначение: idempotency для повторно доставленных Telegram events.

Поля:

- `id`;
- `platform`;
- `update_id`;
- `event_key`;
- `processed_at`;
- `result`;

Индексы:

- уникальный индекс по `platform + update_id`;
- индекс по `processed_at` для очистки.

#### `bot_delivery_log`

Назначение: защита от дублей плановых уведомлений.

Поля:

- `id`;
- `platform`;
- `crm_user_id`;
- `chat_id`;
- `notification_type`;
- `business_key`;
- `sent_at`;
- `status`;
- `error_message`.

Пример `business_key`:

- `daily-summary:2026-04-24:user-id`;
- `training-reminder:2026-04-24:group-id:user-id`.

`bot_delivery_log` нужен для среза с плановыми уведомлениями. В первом Telegram MVP его можно создать заранее или отложить до этапа напоминаний.

## 4. Конфигурация

Добавить env-переменные для Python-сервиса:

- `BOT_ENABLED`;
- `BOT_PLATFORM=Telegram`;
- `BOT_PUBLIC_BASE_URL`;
- `BOT_MODE=LongPolling|Webhook`;
- `BOT_DATABASE_URL`;
- `BOT_LOG_LEVEL`;
- `BOT_CONVERSATION_STATE_TTL_MINUTES`;
- `BOT_PROCESSED_UPDATE_RETENTION_DAYS`;
- `BOT_DEFAULT_TRAINING_REMINDER_MINUTES_BEFORE`;
- `BOT_DAILY_SUMMARY_TIME`;
- `BOT_TIMEZONE`;

Для первого MVP `BOT_MODE=LongPolling`. `Webhook`, `BOT_PUBLIC_BASE_URL` и настройки планировщика нужны для следующих срезов.

Telegram:

- `BOT_TELEGRAM_TOKEN`;
- `BOT_TELEGRAM_WEBHOOK_SECRET`;
- `BOT_TELEGRAM_WEBHOOK_PATH`;
- `BOT_TELEGRAM_ALLOWED_UPDATES`;
- `BOT_TELEGRAM_REQUEST_TIMEOUT_SECONDS`;

CRM backend:

- `CRM_API_BASE_URL`;
- `CRM_BOT_API_TOKEN`;
- `CRM_REQUEST_TIMEOUT_SECONDS`;

Для backend добавить:

- `BotInternalApi__Token`;
- `BotInternalApi__Enabled`;
- `BotIdempotency__RetentionDays`;
- `BotAudit__PlatformUserHashSalt`.

Секреты нельзя хранить в репозитории.

## 5. Backend-доработки

### 5.1. Вынос use case'ов из endpoint'ов

Перед подключением Python-бота нужно убедиться, что backend-сценарии не завязаны на HTTP endpoint как единственное место бизнес-логики.

Цель доработки: Python-сервис не должен знать SQL/EF, внутренние статусы CRM, правила доступа, ограничения по датам, состав чувствительных полей и правила аудита. Он должен вызывать backend-команды и показывать пользователю готовые backend read models.

Кандидаты на вынос в Application-уровень:

- список доступных групп для посещаемости;
- получение roster группы на дату;
- сохранение посещаемости;
- поиск клиентов с ролевым срезом данных;
- получение карточки клиента с ролевым срезом;
- список заканчивающихся абонементов;
- список неоплаченных абонементов;
- отметка оплаты текущего абонемента;
- загрузка/замена фотографии клиента в следующем срезе;
- запись аудита с источником действия.

Web API и Bot API должны вызывать одни и те же use case'ы.

Рекомендуемые Application/use case контракты:

- `ResolveBotUserContextQuery` — резолв Telegram `user_id` в CRM user context;
- `GetBotMenuQuery` — меню, доступное пользователю с учетом роли и состояния аккаунта;
- `ListAttendanceGroupsQuery` — группы для отметки посещаемости;
- `GetAttendanceRosterQuery` — roster группы на дату с предупреждениями в ролевом срезе;
- `SaveAttendanceCommand` — сохранение отметок с проверкой группы, даты, роли и idempotency;
- `SearchBotClientsQuery` — поиск клиентов с запретом phone-search для `Coach`;
- `GetBotClientCardQuery` — карточка клиента в ролевом срезе;
- `ListExpiringMembershipsQuery` — абонементы, заканчивающиеся с сегодняшнего дня по 10-й календарный день включительно;
- `ListUnpaidMembershipsQuery` — текущие неоплаченные абонементы;
- `MarkMembershipPaymentCommand` — отметка оплаты текущего абонемента с idempotency;
- `WriteBotAccessDeniedAuditCommand` — аудит ручной недоступной команды.

Правила, которые должны жить в backend use case'ах:

- `HeadCoach` видит все группы и может отмечать посещаемость за сегодня и любую дату в прошлом;
- `Administrator` видит все группы и может отмечать посещаемость за сегодня и любую дату в прошлом;
- `Coach` видит только назначенные группы и может отмечать посещаемость только за сегодня, вчера и позавчера;
- будущие даты посещаемости запрещены всем ролям;
- отдельное подтверждение списания разового посещения в боте не требуется;
- `Coach` не получает телефон, контакты, сумму оплаты и полные данные абонемента;
- заканчивающиеся абонементы считаются в окне `today..today+10 days` включительно, без просроченных абонементов;
- все изменяющие команды пишут audit с `source = Bot` и `messengerPlatform = Telegram`.

Read models для Bot API должны быть отдельными DTO, оптимизированными под короткий Telegram-сценарий. Python не должен собирать карточку клиента из нескольких web DTO и не должен удалять запрещенные поля из ответа.

### 5.2. Backend idempotency для Bot API

Помимо `bot_processed_updates` в Python-сервисе backend должен защищать изменяющие операции от повторного HTTP-вызова.

Добавить backend-механику idempotency для Bot API:

- обязательный заголовок `Idempotency-Key` для сохранения посещаемости, отметки оплаты, загрузки фото в следующем срезе и других изменяющих команд;
- ключ должен быть связан с `platform`, `platformUserId`, action type и payload hash;
- повтор с тем же ключом и тем же payload возвращает сохраненный результат;
- повтор с тем же ключом и другим payload возвращает конфликт;
- срок хранения idempotency records задается конфигурацией;
- idempotency должна работать внутри backend transaction там, где команда меняет CRM-данные и пишет audit.

### 5.3. User-facing доработки web-интерфейса

Доработать существующие endpoints создания и редактирования пользователей:

- принимать `MessengerPlatform`;
- принимать `MessengerPlatformUserId`;
- валидировать уникальность Telegram `user_id`;
- писать audit через существующий сценарий изменения пользователя.

Требования:

- endpoints доступны только авторизованному пользователю CRM;
- управлять пользователями может только роль, которой это разрешено текущими backend-политиками;
- если `MessengerPlatform = Telegram`, Telegram `user_id` обязателен;
- Telegram `user_id` нельзя указать двум пользователям CRM;
- очистка Telegram `user_id` отключает доступ пользователя к боту.

### 5.4. Internal Bot API

Добавить внутренний endpoint group, например `/internal/bot`.

Минимальные endpoints:

- `POST /internal/bot/telegram/session/resolve` — проверить Telegram identity и вернуть CRM user context;
- `GET /internal/bot/menu` — вернуть доступные действия для Telegram identity;
- `GET /internal/bot/attendance/groups` — доступные группы для посещаемости;
- `GET /internal/bot/attendance/groups/{groupId}/clients` — roster группы на дату;
- `POST /internal/bot/attendance/groups/{groupId}` — сохранить отметки;
- `GET /internal/bot/clients` — поиск клиентов;
- `GET /internal/bot/clients/{clientId}` — карточка клиента в ролевом срезе;
- `GET /internal/bot/clients/expiring-memberships` — заканчивающиеся абонементы;
- `GET /internal/bot/clients/unpaid-memberships` — неоплаченные абонементы;
- `POST /internal/bot/clients/{clientId}/membership/mark-payment` — отметить оплату;
- `POST /internal/bot/audit/access-denied` — записать запрещенную попытку, если бот получил ручную недоступную команду.

Следующие endpoints добавляются не в первый Telegram MVP, а в соответствующих следующих срезах:

- `POST /internal/bot/clients/{clientId}/photo` — загрузить фото;
- `GET /internal/bot/notifications/training-reminders` — данные для напоминаний;
- `GET /internal/bot/notifications/daily-summary` — данные для сводки.

Каждый endpoint должен:

- проверять service token;
- резолвить CRM-пользователя по `User.MessengerPlatform + User.MessengerPlatformUserId`;
- проверять `IsActive`;
- проверять `MustChangePassword`;
- применять роль и group scope;
- применять ограничения по датам;
- возвращать только разрешенные данные.

Bot API не должен принимать `crmUserId` от Python-сервиса как источник прав. Допустимы только Telegram identity, request id, idempotency key и данные конкретной команды.

### 5.5. Аудит

Расширить audit details источником действия:

- `source = Web | Bot`;
- `messengerPlatform = Telegram`;
- `platformUserIdHash` или иной безопасный технический идентификатор при необходимости.

Расширить web-журнал действий:

- показывать источник действия;
- показывать платформу для действий из мессенджера;
- добавить фильтр по `source`;
- добавить фильтр по `messengerPlatform`;
- не показывать raw Telegram user id и chat id без отдельной технической необходимости.

Новые audit action codes:

- `BotAttendanceSaved`;
- `BotMembershipPaymentMarked`;
- `BotAccessDenied`.

Изменение Telegram `user_id` у пользователя фиксируется существующим audit-сценарием изменения пользователя.

`BotClientPhotoUploaded` добавляется в срезе загрузки фото.

Пользовательские описания должны быть на русском языке через resource helpers.

## 6. Frontend-доработки

Доработать создание и редактирование пользователя:

- поле `MessengerPlatform`, в MVP доступно только `Telegram`;
- поле `MessengerPlatformUserId`, Telegram `user_id`;
- подсказку, что пользователь может узнать Telegram ID через `/start` или `/id` в боте;
- отображение ошибки, если Telegram ID уже указан у другого пользователя.

В следующем срезе с уведомлениями добавить настройки:

- настройки уведомлений:
  - включены ли уведомления;
  - время ежедневной сводки;
  - за сколько минут напоминать о тренировке, по умолчанию 15 минут.

Frontend не должен знать Telegram token и другие bot secrets.

## 7. Python-сервис

### 7.1. Слои Python-сервиса

`telegram/`:

- прием Telegram updates;
- long polling runner;
- webhook route в следующем срезе;
- фильтрация событий не из личных чатов;
- callback data encoding/decoding;
- скачивание файлов в срезе загрузки фото;
- отправка сообщений и кнопок.

`core/`:

- маршрутизация внутренних команд;
- сценарии диалогов;
- role-aware меню;
- форматирование сообщений;
- защита от устаревшего состояния;
- общая обработка ошибок.

`core/` не должен решать, какие CRM-данные доступны роли, какие даты разрешены или какие поля нужно скрыть. Эти решения приходят из backend read model или backend error code.

`crm/`:

- async client к backend Bot API;
- DTO запросов и ответов;
- retry только для безопасных read-запросов;
- request id и техническое логирование;
- idempotency key для изменяющих запросов;
- нормализация backend errors.

`storage/`:

- conversation state repository;
- processed update repository;
- delivery log repository;
- Alembic migrations.

`scheduling/`:

- periodic jobs;
- training reminders;
- daily summary;
- attendance missing notifications;
- cleanup expired states/processed updates.

`scheduling/` реализуется в следующем срезе после расширения или уточнения модели расписаний тренировок в backend.

`resources/`:

- русские тексты сообщений;
- labels кнопок;
- шаблоны ошибок и пустых состояний.

### 7.2. Общий обработчик событий

Каждый входящий Telegram update должен проходить единый pipeline:

1. Прочитать update.
2. Проверить, что update пришел из личного чата Telegram.
3. Проверить idempotency по `update_id`.
4. Нормализовать update во внутреннее событие.
5. Найти или создать conversation state.
6. Вызвать core-сценарий.
7. Выполнить backend-запросы через `crm` client.
8. Для изменяющих backend-запросов передать стабильный `Idempotency-Key`.
9. Отправить ответ через Telegram adapter.
10. Сохранить новое состояние.
11. Пометить update как обработанный.

Если отправка ответа упала после backend-изменения, повторный update не должен повторно выполнить изменяющее действие.

## 8. Сценарии Telegram-бота

### 8.1. `/start` и `/id`

Поток для известного Telegram ID:

1. Пользователь пишет `/start`.
2. Бот проверяет Telegram `user_id`.
3. Python-сервис вызывает `POST /internal/bot/telegram/session/resolve`.
4. Backend находит CRM-пользователя по `MessengerPlatform = Telegram` и `MessengerPlatformUserId`.
5. Бот показывает меню доступных действий.

Поток для неизвестного Telegram ID:

1. Пользователь пишет `/start` или `/id`.
2. Backend не находит CRM-пользователя.
3. Бот отвечает без CRM-данных: `Ваш Telegram ID: <id>. Передайте его администратору CRM для подключения бота.`

Ошибки для известного Telegram ID:

- пользователь CRM неактивен;
- пользователь должен сменить пароль в web-интерфейсе.

### 8.2. Role-aware меню

Меню строится на основе `GET /internal/bot/menu`.

Для `HeadCoach`:

- `Посещения`;
- `Поиск клиента`;
- `Заканчивающиеся`;
- `Неоплаченные`.

Для `Administrator`:

- `Посещения`;
- `Поиск клиента`;
- `Заканчивающиеся`;
- `Неоплаченные`.

Для `Coach`:

- `Посещения`;
- `Поиск клиента`.

`Сводка`, `Настройки` и `Отвязать Telegram` не входят в MVP.

Ручной ввод недоступной команды должен возвращать отказ без раскрытия данных и, при необходимости, писать `BotAccessDenied`.

### 8.3. Отметка посещаемости

Поток:

1. Пользователь выбирает `Посещения`.
2. Бот предлагает дату с учетом роли:
   - `Coach`: `Сегодня`, `Вчера`, `Позавчера`;
   - `HeadCoach` и `Administrator`: `Сегодня`, `Вчера`, `Выбрать дату в прошлом`.
3. Бот загружает доступные группы через backend.
4. Пользователь выбирает группу.
5. Бот загружает roster клиентов.
6. Бот показывает клиентов порциями.
7. Для каждого клиента доступны кнопки `Был` / `Не был`.
8. Python-сервис хранит черновик отметок в `bot_conversation_states`.
9. Пользователь нажимает `Сохранить`.
10. Python-сервис вызывает Bot API сохранения посещаемости.
11. Backend сохраняет отметки и пишет аудит.
12. Бот показывает итоговое сообщение.

Важно:

- `Coach` видит только назначенные группы;
- `HeadCoach` видит все группы;
- `Administrator` видит все группы;
- будущая дата запрещена всем ролям;
- `Coach` может сохранять отметки только за сегодня, вчера и позавчера;
- `HeadCoach` и `Administrator` могут сохранять отметки за сегодня и любую дату в прошлом;
- предупреждения по абонементам возвращаются backend в ролевом срезе;
- отдельное подтверждение списания разового посещения не требуется;
- повторное нажатие `Сохранить` не должно создавать дубли.

### 8.4. Поиск клиента

Поток:

1. Пользователь выбирает `Поиск клиента`.
2. Бот просит ввести ФИО или телефон.
3. Python-сервис отправляет запрос в Bot API.
4. Backend применяет роль пользователя.
5. Бот показывает первые результаты.
6. Пользователь выбирает клиента.
7. Бот показывает карточку в ролевом срезе.

Для `Coach` backend не должен искать по телефону и не должен возвращать телефон, контакты, сумму оплаты или полные данные абонемента.

Для длинного списка добавить пагинацию кнопками `Еще` / `Назад`.

### 8.5. Заканчивающиеся абонементы

Поток:

1. Пользователь выбирает `Заканчивающиеся`.
2. Python-сервис вызывает Bot API.
3. Backend возвращает клиентов с текущим абонементом, который заканчивается в окне с сегодняшнего дня по 10-й календарный день включительно.
4. Бот показывает ФИО, тип абонемента, дату окончания, количество дней и признак оплаты.
5. Пользователь может открыть карточку клиента.

Доступно только `HeadCoach` и `Administrator`.

### 8.6. Неоплаченные абонементы

Поток:

1. Пользователь выбирает `Неоплаченные`.
2. Python-сервис вызывает Bot API.
3. Backend возвращает клиентов с текущим неоплаченным абонементом.
4. Бот показывает краткий список.
5. Пользователь может открыть карточку клиента или перейти к отметке оплаты.

Доступно только `HeadCoach` и `Administrator`.

### 8.7. Отметка оплаты

Поток:

1. Пользователь выбирает клиента из списка неоплаченных или карточки.
2. Бот показывает подтверждение: ФИО, тип абонемента, дата покупки, дата окончания.
3. Пользователь нажимает `Подтвердить оплату`.
4. Python-сервис вызывает Bot API отметки оплаты.
5. Backend проверяет права, сохраняет изменение и пишет audit event с источником `Bot`.
6. Бот показывает результат.

Доступно только `HeadCoach` и `Administrator`.

### 8.8. Загрузка фотографии клиента

Сценарий не входит в первый Telegram MVP и реализуется следующим срезом.

Поток:

1. Пользователь находит клиента.
2. Пользователь выбирает `Загрузить фото`.
3. Бот переводит диалог в ожидание фотографии.
4. Пользователь отправляет изображение обычным Telegram `photo`; несжатый файл не обязателен.
5. Python-сервис скачивает файл через Telegram API во временный файл или stream.
6. Python-сервис передает файл в Bot API.
7. Backend выполняет те же проверки, что и web API.
8. Если фото уже есть, бот требует подтверждение замены.
9. Backend сохраняет фото и пишет audit event.
10. Бот показывает результат.

Доступно только `HeadCoach` и `Administrator`.

### 8.9. Напоминания и сводки

Сценарий не входит в первый Telegram MVP. Перед реализацией напоминаний нужно расширить или уточнить модель расписаний тренировок в backend, потому что текстовое расписание группы недостаточно надежно для планировщика.

Напоминания о тренировках:

- scheduler Python-сервиса запрашивает у backend ближайшие тренировки;
- backend возвращает только пользователей с указанным Telegram ID и включенными уведомлениями;
- backend возвращает только пользователей с ролями `HeadCoach` и `Administrator`;
- бот отправляет напоминание за 15 минут до начала тренировки с кнопкой перехода к отметке посещаемости;
- `bot_delivery_log` защищает от повторной отправки.

Сводка главному тренеру:

- scheduler отправляет ежедневную сводку в заданное время;
- backend формирует агрегированные данные;
- бот отправляет сводку активным `HeadCoach` с включенными уведомлениями.

Уведомление о неотмеченной посещаемости:

- scheduler после времени тренировки запрашивает неотмеченные группы;
- бот уведомляет ответственного тренера и, при необходимости, главного тренера.

## 9. Этапы реализации

### Этап 0. Подготовка и baseline

Статус сверки: `[~]` частично. В репозитории зафиксирован `LongPolling` и обновлены env/README для локального запуска, но выполнение baseline-команд и создание тестового Telegram-бота вне репозитория не фиксируются в коде.

1. Запустить baseline:
   - `dotnet test backend/GymCrm.slnx`;
   - `cd frontend && npm run lint`;
   - `cd frontend && npm run build`.
2. Создать тестового Telegram-бота вне репозитория.
3. Сохранить token только в `.env`.
4. Зафиксировать local mode: `LongPolling`.

Результат: текущее состояние проекта проверено, секреты не попали в git.

### Этап 1. Backend use cases и Bot API foundation

Статус сверки: `[x]` реализовано для MVP. Есть `IBotApiService`, `/internal/bot`, service token auth, role-based read models, date rules, окно `today..today+10 days`, backend idempotency и regression tests. Отличие от плана: часть read models собирается в `BotApiService`, а не в отдельных именованных query/use case классах.

1. Вынести нужные backend-сценарии в Application/use case'ы.
2. Добавить service-to-service auth для `/internal/bot`.
3. Добавить резолв Telegram identity в CRM user context.
4. Добавить Bot API read models, которые уже содержат ролевой срез данных.
5. Добавить backend idempotency для изменяющих Bot API команд.
6. Добавить правила дат посещаемости:
   - `Coach`: сегодня, вчера, позавчера;
   - `HeadCoach` и `Administrator`: сегодня и любая дата в прошлом;
   - будущие даты запрещены всем.
7. Добавить доступ `Administrator` к bot-сценарию посещаемости по всем группам.
8. Добавить окно заканчивающихся абонементов `today..today+10 days` включительно.
9. Покрыть auth, idempotency, role-based payload и access tests.

Результат: backend готов безопасно обслуживать Python-бота.

Проверки:

- `dotnet test backend/GymCrm.slnx`.

### Этап 2. CRM-owned данные и Telegram ID в пользователе

Статус сверки: `[x]` реализовано. В backend добавлены `MessengerPlatform`, `MessengerPlatformUserId`, `BotIdempotencyRecord`, EF configurations/migrations, user create/update endpoints, frontend-формы и tests на Telegram ID/дубли.

1. Добавить в пользователя `MessengerPlatform`.
2. Добавить в пользователя `MessengerPlatformUserId`.
3. Добавить `BotIdempotencyRecord`.
4. Добавить EF configurations и миграцию.
5. Доработать user-facing endpoints создания и редактирования пользователей.
6. Доработать frontend-формы создания и редактирования пользователей.
7. Добавить уникальность Telegram `user_id`.
8. Добавить tests на создание, редактирование и дублирование Telegram `user_id`.

Результат: администратор может указать Telegram ID в карточке пользователя CRM.

Проверки:

- `dotnet test backend/GymCrm.slnx`;
- `cd frontend && npm run lint`;
- `cd frontend && npm run build`.

### Этап 3. Python project scaffold

Статус сверки: `[~]` почти реализовано. Каркас `bot/`, config, logging, FastAPI health endpoints, Dockerfile и базовые pytest tests есть. Отдельных Make/npm-like scripts для команд проверки в `pyproject.toml` или README не найдено.

1. Создать `bot/pyproject.toml`.
2. Создать Python package `src/gym_crm_bot`.
3. Добавить config через env.
4. Добавить logging.
5. Добавить FastAPI app с health endpoints.
6. Добавить Dockerfile.
7. Добавить Make/npm-like команды в README или `pyproject` scripts.
8. Добавить базовые pytest tests.

Результат: Python-сервис запускается без Telegram-интеграции.

Проверки:

- `cd bot && pytest`;
- `cd bot && ruff check .`;
- `docker compose build bot`.

### Этап 4. Bot-owned storage

Статус сверки: `[~]` частично. PostgreSQL/SQLAlchemy async, Alembic, `bot_conversation_states`, `bot_processed_updates`, repositories и storage tests есть. `bot_delivery_log` и cleanup job для просроченных записей не реализованы.

1. Подключить PostgreSQL из Python-сервиса.
2. Добавить Alembic.
3. Создать таблицы:
   - `bot_conversation_states`;
   - `bot_processed_updates`;
   - `bot_delivery_log`, если не откладываем плановые уведомления до следующего среза.
4. Добавить repositories.
5. Добавить cleanup job для просроченных записей.

Результат: бот умеет хранить состояние диалогов и idempotency.

Проверки:

- storage tests на test database;
- Alembic migration smoke.

### Этап 5. CRM async client

Статус сверки: `[~]` почти реализовано. `CrmBotApiClient` использует `httpx`, bearer token, `X-Request-Id`, timeout, retry только для safe reads и нормализацию основных backend errors; покрыт fake HTTP transport tests. `Idempotency-Key` передается для посещаемости и отметки оплаты, но не передается для `audit/access-denied`, хотя backend требует его для этого mutation endpoint.

1. Реализовать `CrmBotApiClient` на `httpx`.
2. Добавить bearer token auth.
3. Добавить request id.
4. Добавить timeout handling.
5. Добавить нормализацию ошибок:
   - unauthorized service token;
   - Telegram user is not configured in CRM;
   - CRM user inactive;
   - must change password;
   - forbidden by role;
   - duplicate Telegram user id;
   - invalid attendance date;
   - idempotency conflict;
   - validation error;
   - temporary backend error.
6. Покрыть client tests через fake HTTP transport.

Результат: Python-сервис умеет безопасно общаться с CRM backend.

### Этап 6. Telegram adapter

Статус сверки: `[x]` реализовано для MVP. Есть `aiogram` long polling, private-chat guard, нормализация command/text/callback, отправка сообщений и inline-кнопок, idempotency по `update_id`. Webhook, secret validation, files/photo/document ожидаемо не реализованы.

1. Подключить Telegram framework.
2. Реализовать long polling runner.
3. Отфильтровать события из групп, супергрупп и каналов без раскрытия данных CRM.
4. Нормализовать Telegram updates во внутренние события:
   - command;
   - text message;
   - callback button.
5. Реализовать отправку сообщений и inline-кнопок.
6. Добавить idempotency по `update_id`.

Webhook endpoint, webhook secret validation, скачивание файлов и обработка photo/document реализуются в следующих срезах.

Результат: бот принимает Telegram events и может отвечать простым сообщением.

Проверки:

- adapter mapping tests;
- manual smoke через тестового Telegram-бота.

### Этап 7. Resolve и меню

Статус сверки: `[~]` почти реализовано. `/start`, `/id`, безопасный ответ неизвестному Telegram ID и role-aware меню реализованы; есть unit tests на `/start`, `/id`, callback/menu helpers. Отказ при forbidden backend responses есть, но запись `BotAccessDenied` из Python неполная из-за отсутствующего `Idempotency-Key` в CRM client.

1. Реализовать `/start`.
2. Реализовать `/id`.
3. Реализовать ответ с Telegram ID для неизвестного пользователя.
4. Реализовать role-aware меню.
5. Учесть, что `Administrator` видит `Посещения`, а `HeadCoach` не видит `Сводка` до среза сводок.
6. Реализовать обработку недоступных команд.
7. Покрыть fake Telegram adapter tests.

Результат: известный Telegram ID получает меню по роли, неизвестный Telegram ID получает только свой идентификатор и инструкцию.

### Этап 8. Посещаемость

Статус сверки: `[~]` частично. Основной сценарий посещаемости реализован: выбор даты кнопками, выбор группы, roster, черновик в storage, save через Bot API с `Idempotency-Key`, итоговое сообщение, backend rules/tests для ролей и дат. Не реализованы произвольный выбор даты в прошлом для `HeadCoach`/`Administrator`, порционная выдача roster и полноценные Python scenario tests на все роли.

1. Реализовать команду/кнопку `Посещения`.
2. Реализовать выбор даты.
3. Реализовать выбор группы.
4. Реализовать roster с порционной выдачей клиентов.
5. Реализовать черновик отметок в storage.
6. Реализовать сохранение отметок через Bot API с `Idempotency-Key`.
7. Реализовать итоговое сообщение.
8. Покрыть `HeadCoach`, `Administrator` и `Coach`.
9. Покрыть запрет будущих дат и ограничения дат для `Coach`.

Результат: тренер, администратор и главный тренер могут отметить посещаемость из Telegram в разрешенных рамках.

Проверки:

- Python scenario tests;
- backend access tests;
- `dotnet test backend/GymCrm.slnx`.

### Этап 9. Поиск клиента и карточка

Статус сверки: `[~]` частично. Поиск, ввод запроса, пагинация результатов, открытие карточки и backend role-based payload для `Coach` реализованы. Python tests покрывают только часть сервисного поведения, не полный сценарий на все роли.

1. Реализовать команду/кнопку `Поиск клиента`.
2. Реализовать ввод запроса.
3. Реализовать выдачу результатов с пагинацией.
4. Реализовать карточку клиента в ролевом срезе.
5. Проверить, что `Coach` не получает телефон, контакты, сумму и полные данные абонемента.

Результат: Telegram дает быстрый безопасный поиск клиента.

Проверки:

- Python scenario tests на все роли;
- backend tests на role-based payload.

### Этап 10. Абонементы и оплата

Статус сверки: `[~]` частично. `Заканчивающиеся`, `Неоплаченные`, подтверждение оплаты, mark-payment через Bot API с `Idempotency-Key`, audit `Bot/Telegram`, web-фильтры audit и backend tests на окно/idempotency реализованы. Python-отображение не показывает все поля из сценария подтверждения оплаты и не показывает days until expiration в списке заканчивающихся.

1. Реализовать `Заканчивающиеся`.
2. Реализовать `Неоплаченные`.
3. Реализовать переход к подтверждению оплаты.
4. Реализовать mark-payment через Bot API с `Idempotency-Key`.
5. Добавить audit source `Bot/Telegram`.
6. Добавить отображение и фильтр источника `Bot/Telegram` в web-журнале действий.
7. Проверить идемпотентность повторного callback.
8. Проверить окно заканчивающихся абонементов с включением сегодняшнего дня и 10-го дня.

Результат: management-роли могут смотреть долги и отмечать оплату.

Проверки:

- Python scenario tests;
- backend audit tests.

### Этап 11. Загрузка фото, следующий срез

Статус сверки: `[ ]` не реализовано. В Python-боте нет ожидания/скачивания фото и Bot API endpoint для загрузки фото не добавлен.

1. Реализовать ожидание фотографии после выбора клиента.
2. Скачать файл через Telegram API.
3. Передать файл в Bot API.
4. Реализовать подтверждение замены существующей фотографии.
5. Обработать ошибки размера, формата и загрузки.
6. Добавить audit event.
7. Принимать обычный сжатый Telegram `photo`; несжатый файл не обязателен.

Результат: администратор или главный тренер может обновить фото клиента через Telegram.

Проверки:

- Python fake file tests;
- backend photo validation tests;
- manual smoke.

### Этап 12. Напоминания и сводки, следующий срез

Статус сверки: `[ ]` не реализовано. Scheduler, уведомления, ежедневная сводка, настройки уведомлений и `bot_delivery_log` отсутствуют.

1. Расширить или уточнить backend-модель расписаний тренировок.
2. Реализовать scheduler в Python-сервисе.
3. Реализовать напоминания за 15 минут до начала тренировки для `HeadCoach` и `Administrator`.
4. Реализовать ежедневную сводку главному тренеру.
5. Реализовать уведомление о неотмеченной посещаемости.
6. Реализовать настройки включения/отключения уведомлений.
7. Добавить `bot_delivery_log` защиту от дублей.

Результат: бот становится ассистентом по операционным событиям.

Проверки:

- scheduler tests с fake clock;
- manual smoke с сокращенными интервалами.

### Этап 13. Docker, env и документация

Статус сверки: `[~]` частично. `bot/Dockerfile`, сервис `bot` в `docker-compose.yml`, env в `.env.example` и README-раздел запуска Telegram-бота реализованы. README не содержит полного troubleshooting и пошагового создания Telegram-бота.

1. Добавить `bot/Dockerfile`.
2. Добавить сервис `bot` в `docker-compose.yml`.
3. Передать env:
   - Telegram token;
   - CRM backend URL;
   - service token;
   - database URL;
   - mode `LongPolling`.
4. Обновить `.env.example`.
5. Обновить `README.md`:
   - как создать Telegram-бота;
   - какие env-переменные нужны;
   - local `LongPolling`;
   - как узнать Telegram ID через бот;
   - как указать Telegram ID в карточке пользователя CRM.
6. Описать, что production `Webhook`, фото, напоминания и сводки реализуются следующими срезами.
7. Добавить troubleshooting.

Результат: бот можно поднять и проверить по инструкции.

Проверки:

- `docker compose up --build -d`;
- health backend/frontend/bot;
- smoke основных Telegram-команд.

### Этап 14. Финальная приемка

Статус сверки: `[ ]` не подтверждено. В рамках сверки код и тесты были прочитаны, но финальные команды приемки и ручной smoke в Telegram не запускались.

1. Запустить backend checks:
   - `dotnet test backend/GymCrm.slnx`.
2. Запустить frontend checks:
   - `cd frontend && npm run lint`;
   - `cd frontend && npm run build`.
3. Запустить Python checks:
   - `cd bot && ruff check .`;
   - `cd bot && pytest`.
4. Провести ручной smoke в Telegram:
   - `/start`;
   - неизвестный Telegram ID получает только свой ID и инструкцию;
   - известный Telegram ID получает меню;
   - отказ или игнорирование группового чата без раскрытия данных;
   - меню по роли;
   - посещаемость тренера, администратора и главного тренера;
   - поиск клиента;
   - заканчивающиеся абонементы;
   - неоплаченные;
   - отметка оплаты;
   - отвязка.

Результат: первый Telegram MVP-срез бота на Python готов к приемке.

## 10. Риски и решения

### 10.1. Дублирование бизнес-логики в Python

Риск: Python-сервис начнет повторять backend-правила и EF-запросы.

Решение: Python вызывает только Bot API, backend остается источником прав и бизнес-логики. Backend возвращает готовые Bot read models, а Python только ведет диалог и отображает данные.

### 10.2. Утечка данных тренера

Риск: Telegram-сценарий покажет тренеру телефон, оплату или полный абонемент.

Решение: backend возвращает role-based read model, Python не фильтрует чувствительные данные самостоятельно.

### 10.3. Повторные Telegram events

Риск: повторный callback повторно отметит оплату или сохранит посещаемость.

Решение: `bot_processed_updates`, обязательный `Idempotency-Key` для изменяющих Bot API команд, backend idempotency records, подтверждения для рискованных действий.

### 10.4. Две системы миграций в одной БД

Риск: EF Core и Alembic конфликтуют.

Решение: EF Core владеет CRM-owned таблицами, Alembic владеет только bot-owned схемой или таблицами с префиксом `bot_`.

### 10.5. Webhook сложно запускать локально

Риск: webhook требует публичный HTTPS endpoint.

Решение: первый Telegram MVP запускается в режиме `LongPolling`, production `Webhook` выносится в следующий срез.

### 10.6. Состояние диалогов устаревает

Риск: пользователь возвращается к старой кнопке и выполняет действие в неверном контексте.

Решение: TTL состояния, проверка актуальности сущностей перед изменением, сообщение `Сценарий устарел, начните заново`.

### 10.7. Bot API станет копией web endpoint'ов

Риск: backend добавит thin wrapper над текущими web endpoint'ами, и Python начнет собирать нужные ответы из нескольких web DTO.

Решение: сначала выделить Application/use case'ы и отдельные Bot read models. Web API и Bot API должны вызывать общие use case'ы, но иметь свои HTTP DTO.

### 10.8. Расписание тренировок неструктурировано

Риск: текстовое поле расписания группы нельзя надежно использовать для напоминаний и уведомлений о неотмеченной посещаемости.

Решение: не включать напоминания в первый MVP. Перед срезом уведомлений расширить или уточнить backend-модель расписаний тренировок.

### 10.9. Права администратора на посещаемость расходятся с текущим backend

Риск: текущие web/backend политики могут не давать `Administrator` доступ к отметке посещаемости, а бот по ТЗ должен давать.

Решение: в backend use case'ах и access tests явно зафиксировать, что для bot-сценария `Administrator` может отмечать все группы за любую дату в прошлом. Если web-интерфейс должен соответствовать этому правилу, синхронно обновить web policy и UI.

## 11. MVP-срез Telegram-бота на Python

Первый приемочный срез ограничивается:

- `[x]` Backend Bot API foundation.
- `[x]` Python service scaffold.
- `[x]` Telegram long polling только для личных чатов.
- `[x]` Настройка Telegram ID в карточке пользователя CRM.
- `[x]` Role-aware меню.
- `[~]` Отметка посещаемости для `HeadCoach`, `Administrator` и `Coach` с ограничениями по датам: backend-правила реализованы, но в Python UI нет произвольного выбора даты в прошлом и порционной выдачи roster.
- `[x]` Поиск клиента.
- `[~]` Заканчивающиеся и неоплаченные абонементы: сценарии реализованы, но отображение заканчивающихся не выводит количество дней до окончания.
- `[~]` Отметка оплаты: изменение реализовано, но экран подтверждения в Python показывает не все поля из сценария.
- `[x]` Audit source `Bot/Telegram` с отображением и фильтрацией в web-журнале.

В первый срез не входят `MAX`, загрузка фото, напоминания, сводки и production webhook. Эти сценарии делаются следующими срезами.
