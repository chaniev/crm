# План доработок для реализации Telegram-бота Gym CRM на Python

Дата: 2026-04-24

Основание: [BOT-МЕССЕНДЖЕР-ТЗ.md](BOT-МЕССЕНДЖЕР-ТЗ.md), [MVP-ТЗ.md](MVP-ТЗ.md), [MVP_SCREEN_MAP.md](MVP_SCREEN_MAP.md), текущая архитектура backend/frontend.

## 1. Цель плана

План описывает доработки, необходимые для реализации Telegram-бота Gym CRM как отдельного Python-сервиса.

Бот должен закрыть быстрые мобильные сценарии:

- привязка Telegram-аккаунта к пользователю CRM;
- role-aware меню;
- отметка посещаемости;
- поиск клиента;
- просмотр заканчивающихся и неоплаченных абонементов;
- отметка оплаты;
- загрузка фотографии клиента;
- напоминания и сводки.

Telegram является первой платформенной реализацией. Бизнес-сценарии внутри Python-сервиса должны быть отделены от Telegram-адаптера, чтобы позже можно было добавить адаптер `MAX`.

## 2. Ключевые архитектурные решения

### 2.1. Новый Python-сервис

Добавить отдельный сервис:

- директория: `bot/`;
- язык: `Python`;
- запуск: отдельный контейнер `bot` в `docker-compose.yml`;
- интеграция с CRM: только через backend HTTP API;
- хранение transient-состояний бота: отдельная схема или таблицы в PostgreSQL;
- режим локальной разработки: Telegram long polling;
- production-режим: webhook, если есть публичный HTTPS endpoint.

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
- `FastAPI` + ASGI server — health endpoints и webhook endpoint;
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
- хранить пароль CRM или web-сессию пользователя.

Все бизнес-действия бот выполняет через backend:

- backend определяет CRM-пользователя по Telegram-привязке;
- backend применяет роли и access scope;
- backend возвращает role-based read model;
- backend сохраняет изменения;
- backend пишет audit event с источником `Bot` и платформой `Telegram`.

### 2.4. Внутренний Bot API в backend

Так как Python-сервис не может напрямую переиспользовать .NET `Application`-слой, backend должен предоставить внутренние endpoints для бота.

Bot API должен:

- быть доступен только из внутренней сети compose/production;
- требовать service-to-service авторизацию;
- принимать Telegram identity, а не доверять произвольному `UserId` от бота;
- внутри backend резолвить CRM-пользователя и проверять актуальные права;
- переиспользовать те же Application/use case'ы, что и web API.

Рекомендуемый способ защиты MVP:

- общий secret в env: `BOT_BACKEND_API_TOKEN`;
- заголовок: `Authorization: Bearer <token>`;
- отдельная policy/auth handler в backend;
- обязательный `X-Request-Id` для трассировки;
- опционально HMAC-подпись payload следующим этапом.

## 3. Данные

Данные делятся на CRM-owned и bot-owned.

### 3.1. CRM-owned данные в backend

Эти таблицы создаются EF Core миграциями backend, потому что они нужны web-интерфейсу и backend-проверкам.

#### `MessengerAccountLink`

Назначение: связь пользователя CRM с Telegram-аккаунтом.

Поля:

- `Id`;
- `UserId`;
- `Platform` со значением `Telegram`;
- `PlatformUserId`;
- `ChatId`;
- `Username`;
- `DisplayName`;
- `LinkedAt`;
- `LastInteractionAt`;
- `UnlinkedAt`;
- `IsActive`.

Индексы:

- уникальный активный link по `Platform + PlatformUserId`;
- индекс по `UserId`;
- индекс по `ChatId`.

#### `MessengerLinkToken`

Назначение: одноразовая привязка Telegram-аккаунта к пользователю CRM.

Поля:

- `Id`;
- `UserId`;
- `TokenHash`;
- `CreatedAt`;
- `ExpiresAt`;
- `UsedAt`;
- `IsUsed`.

Требования:

- исходный token не хранить в БД;
- срок жизни задавать конфигурацией;
- token можно использовать только один раз;
- при создании нового token старые активные token'ы пользователя можно инвалидировать.

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

- привязка;
- отметка посещаемости;
- поиск клиента;
- отметка оплаты;
- загрузка фото;
- настройки уведомлений.

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
- `MessengerLink__TokenLifetimeMinutes`.

Секреты нельзя хранить в репозитории.

## 5. Backend-доработки

### 5.1. Вынос use case'ов из endpoint'ов

Перед подключением Python-бота нужно убедиться, что backend-сценарии не завязаны на HTTP endpoint как единственное место бизнес-логики.

Кандидаты на вынос в Application-уровень:

- список доступных групп для посещаемости;
- получение roster группы на дату;
- сохранение посещаемости;
- поиск клиентов с ролевым срезом данных;
- получение карточки клиента с ролевым срезом;
- список заканчивающихся абонементов;
- список неоплаченных абонементов;
- отметка оплаты текущего абонемента;
- загрузка/замена фотографии клиента;
- запись аудита с источником действия.

Web API и Bot API должны вызывать одни и те же use case'ы.

### 5.2. User-facing endpoints для web-интерфейса

Добавить endpoints для управления привязкой Telegram из web:

- `GET /messenger-links` — список привязок текущего пользователя;
- `POST /messenger-links/telegram/token` — создать одноразовый token привязки;
- `DELETE /messenger-links/{id}` — отвязать аккаунт;
- `GET /messenger-links/settings` — получить настройки уведомлений;
- `PUT /messenger-links/settings` — изменить настройки уведомлений.

Требования:

- endpoints доступны только авторизованному пользователю CRM;
- пользователь с `MustChangePassword = true` не может создать token;
- token возвращается только один раз;
- отвязка пишет audit event;
- settings применяются при плановых уведомлениях.

### 5.3. Internal Bot API

Добавить внутренний endpoint group, например `/internal/bot`.

Минимальные endpoints:

- `POST /internal/bot/telegram/link/consume` — принять одноразовый token и Telegram identity, создать привязку;
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
- `POST /internal/bot/clients/{clientId}/photo` — загрузить фото;
- `GET /internal/bot/notifications/training-reminders` — данные для напоминаний;
- `GET /internal/bot/notifications/daily-summary` — данные для сводки;
- `POST /internal/bot/audit/access-denied` — записать запрещенную попытку, если бот получил ручную недоступную команду.

Каждый endpoint должен:

- проверять service token;
- резолвить CRM-пользователя по `platform + platformUserId`;
- проверять `IsActive`;
- проверять `MustChangePassword`;
- применять роль и group scope;
- возвращать только разрешенные данные.

### 5.4. Аудит

Расширить audit details источником действия:

- `source = Web | Bot`;
- `messengerPlatform = Telegram`;
- `platformUserIdHash` или иной безопасный технический идентификатор при необходимости.

Новые audit action codes:

- `MessengerAccountLinked`;
- `MessengerAccountUnlinked`;
- `BotAttendanceSaved`;
- `BotMembershipPaymentMarked`;
- `BotClientPhotoUploaded`;
- `BotAccessDenied`.

Пользовательские описания должны быть на русском языке через resource helpers.

## 6. Frontend-доработки

Добавить в профиль пользователя или настройки:

- блок `Мессенджер-бот`;
- статус привязки Telegram;
- кнопку `Создать код привязки`;
- отображение одноразового кода и срока действия;
- кнопку `Отвязать Telegram`;
- настройки уведомлений:
  - включены ли уведомления;
  - время ежедневной сводки;
  - за сколько минут напоминать о тренировке.

Frontend не должен знать Telegram token и другие bot secrets.

## 7. Python-сервис

### 7.1. Слои Python-сервиса

`telegram/`:

- прием Telegram updates;
- long polling runner;
- webhook route;
- callback data encoding/decoding;
- скачивание файлов;
- отправка сообщений и кнопок.

`core/`:

- маршрутизация внутренних команд;
- сценарии диалогов;
- role-aware меню;
- форматирование сообщений;
- защита от устаревшего состояния;
- общая обработка ошибок.

`crm/`:

- async client к backend Bot API;
- DTO запросов и ответов;
- retry только для безопасных read-запросов;
- request id и техническое логирование;
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

`resources/`:

- русские тексты сообщений;
- labels кнопок;
- шаблоны ошибок и пустых состояний.

### 7.2. Общий обработчик событий

Каждый входящий Telegram update должен проходить единый pipeline:

1. Прочитать update.
2. Проверить idempotency по `update_id`.
3. Нормализовать update во внутреннее событие.
4. Найти или создать conversation state.
5. Вызвать core-сценарий.
6. Выполнить backend-запросы через `crm` client.
7. Отправить ответ через Telegram adapter.
8. Сохранить новое состояние.
9. Пометить update как обработанный.

Если отправка ответа упала после backend-изменения, повторный update не должен повторно выполнить изменяющее действие.

## 8. Сценарии Telegram-бота

### 8.1. `/start` и привязка

Поток:

1. Пользователь пишет `/start`.
2. Бот проверяет Telegram `user_id`.
3. Если активной привязки нет, бот просит отправить одноразовый код из CRM.
4. Пользователь отправляет код.
5. Python-сервис вызывает `POST /internal/bot/telegram/link/consume`.
6. Backend проверяет hash, срок жизни и признак использования token.
7. Backend создает `MessengerAccountLink`.
8. Бот показывает меню доступных действий.

Ошибки:

- неверный код;
- просроченный код;
- код уже использован;
- пользователь CRM неактивен;
- пользователь должен сменить пароль в web-интерфейсе.

### 8.2. Role-aware меню

Меню строится на основе `GET /internal/bot/menu`.

Для `HeadCoach`:

- `Посещения`;
- `Поиск клиента`;
- `Заканчивающиеся`;
- `Неоплаченные`;
- `Сводка`;
- `Настройки`;
- `Отвязать Telegram`.

Для `Administrator`:

- `Поиск клиента`;
- `Заканчивающиеся`;
- `Неоплаченные`;
- `Настройки`;
- `Отвязать Telegram`.

Для `Coach`:

- `Посещения`;
- `Поиск клиента`;
- `Настройки`;
- `Отвязать Telegram`.

Ручной ввод недоступной команды должен возвращать отказ без раскрытия данных и, при необходимости, писать `BotAccessDenied`.

### 8.3. Отметка посещаемости

Поток:

1. Пользователь выбирает `Посещения`.
2. Бот предлагает дату: `Сегодня`, `Вчера`, `Выбрать дату`.
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
- `Administrator` не имеет сценария посещаемости;
- предупреждения по абонементам возвращаются backend в ролевом срезе;
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
3. Backend возвращает клиентов с текущим абонементом, который заканчивается менее чем через 10 дней.
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

Поток:

1. Пользователь находит клиента.
2. Пользователь выбирает `Загрузить фото`.
3. Бот переводит диалог в ожидание фотографии.
4. Пользователь отправляет изображение.
5. Python-сервис скачивает файл через Telegram API во временный файл или stream.
6. Python-сервис передает файл в Bot API.
7. Backend выполняет те же проверки, что и web API.
8. Если фото уже есть, бот требует подтверждение замены.
9. Backend сохраняет фото и пишет audit event.
10. Бот показывает результат.

Доступно только `HeadCoach` и `Administrator`.

### 8.9. Напоминания и сводки

Напоминания тренеру:

- scheduler Python-сервиса запрашивает у backend ближайшие тренировки;
- backend возвращает только пользователей с активной Telegram-привязкой и включенными уведомлениями;
- бот отправляет напоминание с кнопкой перехода к отметке посещаемости;
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

1. Запустить baseline:
   - `dotnet test backend/GymCrm.slnx`;
   - `cd frontend && npm run lint`;
   - `cd frontend && npm run build`.
2. Создать тестового Telegram-бота вне репозитория.
3. Сохранить token только в `.env`.
4. Зафиксировать local mode: `LongPolling`.

Результат: текущее состояние проекта проверено, секреты не попали в git.

### Этап 1. Backend use cases и Bot API foundation

1. Вынести нужные backend-сценарии в Application/use case'ы.
2. Добавить service-to-service auth для `/internal/bot`.
3. Добавить резолв Telegram identity в CRM user context.
4. Добавить базовые DTO для Bot API.
5. Покрыть auth и access tests.

Результат: backend готов безопасно обслуживать Python-бота.

Проверки:

- `dotnet test backend/GymCrm.slnx`.

### Этап 2. CRM-owned данные и web-привязка

1. Добавить `MessengerAccountLink`.
2. Добавить `MessengerLinkToken`.
3. Добавить `BotNotificationSettings`.
4. Добавить EF configurations и миграцию.
5. Добавить user-facing endpoints `/messenger-links`.
6. Добавить frontend-блок `Мессенджер-бот`.
7. Добавить tests на одноразовый token, отвязку и настройки.

Результат: пользователь может создать код привязки в web CRM.

Проверки:

- `dotnet test backend/GymCrm.slnx`;
- `cd frontend && npm run lint`;
- `cd frontend && npm run build`.

### Этап 3. Python project scaffold

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

1. Подключить PostgreSQL из Python-сервиса.
2. Добавить Alembic.
3. Создать таблицы:
   - `bot_conversation_states`;
   - `bot_processed_updates`;
   - `bot_delivery_log`.
4. Добавить repositories.
5. Добавить cleanup job для просроченных записей.

Результат: бот умеет хранить состояние диалогов и idempotency.

Проверки:

- storage tests на test database;
- Alembic migration smoke.

### Этап 5. CRM async client

1. Реализовать `CrmBotApiClient` на `httpx`.
2. Добавить bearer token auth.
3. Добавить request id.
4. Добавить timeout handling.
5. Добавить нормализацию ошибок:
   - unauthorized service token;
   - Telegram account not linked;
   - CRM user inactive;
   - must change password;
   - forbidden by role;
   - validation error;
   - temporary backend error.
6. Покрыть client tests через fake HTTP transport.

Результат: Python-сервис умеет безопасно общаться с CRM backend.

### Этап 6. Telegram adapter

1. Подключить Telegram framework.
2. Реализовать long polling runner.
3. Реализовать webhook endpoint.
4. Добавить webhook secret validation.
5. Нормализовать Telegram updates во внутренние события:
   - command;
   - text message;
   - callback button;
   - photo/document.
6. Реализовать отправку сообщений и inline-кнопок.
7. Реализовать скачивание файлов.
8. Добавить idempotency по `update_id`.

Результат: бот принимает Telegram events и может отвечать простым сообщением.

Проверки:

- adapter mapping tests;
- manual smoke через тестового Telegram-бота.

### Этап 7. Привязка и меню

1. Реализовать `/start`.
2. Реализовать ввод одноразового кода.
3. Вызвать `POST /internal/bot/telegram/link/consume`.
4. Реализовать `/unlink`.
5. Реализовать role-aware меню.
6. Реализовать обработку недоступных команд.
7. Покрыть fake Telegram adapter tests.

Результат: пользователь может безопасно привязать Telegram и увидеть меню по роли.

### Этап 8. Посещаемость

1. Реализовать команду/кнопку `Посещения`.
2. Реализовать выбор даты.
3. Реализовать выбор группы.
4. Реализовать roster с порционной выдачей клиентов.
5. Реализовать черновик отметок в storage.
6. Реализовать сохранение отметок через Bot API.
7. Реализовать итоговое сообщение.
8. Покрыть `HeadCoach`, `Coach`, forbidden для `Administrator`.

Результат: тренер может отметить посещаемость из Telegram.

Проверки:

- Python scenario tests;
- backend access tests;
- `dotnet test backend/GymCrm.slnx`.

### Этап 9. Поиск клиента и карточка

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

1. Реализовать `Заканчивающиеся`.
2. Реализовать `Неоплаченные`.
3. Реализовать переход к подтверждению оплаты.
4. Реализовать mark-payment через Bot API.
5. Добавить audit source `Bot/Telegram`.
6. Проверить идемпотентность повторного callback.

Результат: management-роли могут смотреть долги и отмечать оплату.

Проверки:

- Python scenario tests;
- backend audit tests.

### Этап 11. Загрузка фото

1. Реализовать ожидание фотографии после выбора клиента.
2. Скачать файл через Telegram API.
3. Передать файл в Bot API.
4. Реализовать подтверждение замены существующей фотографии.
5. Обработать ошибки размера, формата и загрузки.
6. Добавить audit event.

Результат: администратор или главный тренер может обновить фото клиента через Telegram.

Проверки:

- Python fake file tests;
- backend photo validation tests;
- manual smoke.

### Этап 12. Напоминания и сводки

1. Реализовать scheduler в Python-сервисе.
2. Реализовать напоминания перед тренировкой.
3. Реализовать ежедневную сводку главному тренеру.
4. Реализовать уведомление о неотмеченной посещаемости.
5. Реализовать настройки включения/отключения уведомлений.
6. Добавить `bot_delivery_log` защиту от дублей.

Результат: бот становится ассистентом по операционным событиям.

Проверки:

- scheduler tests с fake clock;
- manual smoke с сокращенными интервалами.

### Этап 13. Docker, env и документация

1. Добавить `bot/Dockerfile`.
2. Добавить сервис `bot` в `docker-compose.yml`.
3. Передать env:
   - Telegram token;
   - CRM backend URL;
   - service token;
   - database URL;
   - mode `LongPolling`/`Webhook`.
4. Обновить `.env.example`.
5. Обновить `README.md`:
   - как создать Telegram-бота;
   - какие env-переменные нужны;
   - local `LongPolling`;
   - production `Webhook`;
   - как привязать аккаунт.
6. Добавить troubleshooting.

Результат: бот можно поднять и проверить по инструкции.

Проверки:

- `docker compose up --build -d`;
- health backend/frontend/bot;
- smoke основных Telegram-команд.

### Этап 14. Финальная приемка

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
   - привязка;
   - меню по роли;
   - посещаемость тренера;
   - поиск клиента;
   - неоплаченные;
   - отметка оплаты;
   - загрузка фото;
   - отвязка.

Результат: Telegram-бот на Python готов к MVP-приемке.

## 10. Риски и решения

### 10.1. Дублирование бизнес-логики в Python

Риск: Python-сервис начнет повторять backend-правила и EF-запросы.

Решение: Python вызывает только Bot API, backend остается источником прав и бизнес-логики.

### 10.2. Утечка данных тренера

Риск: Telegram-сценарий покажет тренеру телефон, оплату или полный абонемент.

Решение: backend возвращает role-based read model, Python не фильтрует чувствительные данные самостоятельно.

### 10.3. Повторные Telegram events

Риск: повторный callback повторно отметит оплату или сохранит посещаемость.

Решение: `bot_processed_updates`, idempotent Bot API, подтверждения для рискованных действий.

### 10.4. Две системы миграций в одной БД

Риск: EF Core и Alembic конфликтуют.

Решение: EF Core владеет CRM-owned таблицами, Alembic владеет только bot-owned схемой или таблицами с префиксом `bot_`.

### 10.5. Webhook сложно запускать локально

Риск: webhook требует публичный HTTPS endpoint.

Решение: local/dev режим `LongPolling`, production режим `Webhook`.

### 10.6. Состояние диалогов устаревает

Риск: пользователь возвращается к старой кнопке и выполняет действие в неверном контексте.

Решение: TTL состояния, проверка актуальности сущностей перед изменением, сообщение `Сценарий устарел, начните заново`.

## 11. MVP-срез Telegram-бота на Python

Чтобы быстрее получить пользу, первый приемочный срез можно ограничить:

1. Backend Bot API foundation.
2. Python service scaffold.
3. Telegram long polling.
4. Привязка аккаунта.
5. Role-aware меню.
6. Отметка посещаемости.
7. Поиск клиента.
8. Заканчивающиеся и неоплаченные абонементы.
9. Отметка оплаты.

Фото, напоминания, сводки и production webhook можно делать следующим срезом, если нужен более быстрый первый релиз.
