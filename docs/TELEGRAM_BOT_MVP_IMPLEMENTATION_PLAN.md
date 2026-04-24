# MVP-план доработок для Telegram-бота Gym CRM

Дата: 2026-04-24

Основание: [BOT-МЕССЕНДЖЕР-ТЗ.md](BOT-МЕССЕНДЖЕР-ТЗ.md), [TELEGRAM_BOT_IMPLEMENTATION_PLAN.md](TELEGRAM_BOT_IMPLEMENTATION_PLAN.md), текущая реализация Gym CRM.

## 1. Цель MVP

Первый MVP должен дать рабочий Telegram-бот для быстрых операционных сценариев без замены web-интерфейса.

В MVP входит:

- Telegram long polling;
- работа только в личных чатах Telegram;
- административная привязка Telegram ID в карточке пользователя CRM;
- role-aware меню;
- отметка посещаемости;
- поиск клиента;
- списки заканчивающихся и неоплаченных абонементов;
- отметка оплаты текущего абонемента;
- audit source `Bot/Telegram`.

В MVP не входит:

- `MAX`;
- production webhook;
- одноразовые коды и ссылки привязки;
- самостоятельная привязка или отвязка Telegram из бота;
- загрузка или замена фотографии клиента через бот;
- плановые напоминания;
- ежедневные сводки;
- расширение модели расписаний тренировок;
- создание или редактирование CRM-сущностей через бот.

## 2. Упрощенная идентификация Telegram-пользователя

В MVP связь CRM-пользователя и Telegram-пользователя задается администратором в CRM.

При создании или редактировании пользователя CRM нужно указать:

- `MessengerPlatform` — для MVP только `Telegram`;
- `MessengerPlatformUserId` — Telegram `user_id` пользователя.

Backend резолвит входящее событие бота по паре:

- `platform = Telegram`;
- `platformUserId = Telegram user_id` из Telegram update.

Если пользователь пишет боту, но его Telegram ID не указан ни в одной активной CRM-учетке, бот не показывает CRM-данные. Вместо этого он сообщает пользователю его Telegram ID и просит передать его администратору CRM.

Ограничения:

- один Telegram ID может быть указан только у одного пользователя CRM;
- пользователь CRM может иметь только один Telegram ID для одной платформы;
- неактивный пользователь CRM не может работать с ботом;
- пользователь с `MustChangePassword = true` должен сначала сменить пароль в web-интерфейсе.

## 3. Архитектурный принцип MVP

Python-сервис должен быть тонким клиентом к backend.

Python-сервис отвечает за:

- прием Telegram events;
- проверку личного чата;
- состояние диалога;
- отображение backend read models в сообщения и кнопки;
- idempotency Telegram update'ов;
- вызовы internal Bot API;
- понятные пользовательские сообщения об ошибках.

Backend отвечает за:

- резолв Telegram identity в CRM-пользователя;
- роли и access scope;
- правила дат посещаемости;
- ролевой срез данных;
- бизнес-валидацию;
- сохранение CRM-данных;
- backend idempotency изменяющих команд;
- аудит с источником `Bot/Telegram`.

Python не должен фильтровать чувствительные поля как последний рубеж защиты и не должен собирать карточку клиента из нескольких web DTO.

## 4. Backend MVP

### 4.1. User model

Добавить в backend-модель пользователя поля:

- `MessengerPlatform`;
- `MessengerPlatformUserId`.

Для MVP допустимые значения:

- `MessengerPlatform = Telegram`;
- `MessengerPlatformUserId` — строковое представление Telegram `user_id`.

Валидация:

- если `MessengerPlatform = Telegram`, `MessengerPlatformUserId` обязателен;
- `MessengerPlatformUserId` должен быть непустым;
- пара `MessengerPlatform + MessengerPlatformUserId` должна быть уникальной;
- формат Telegram ID лучше хранить строкой, чтобы не зависеть от размера числового идентификатора и особенностей платформы.

Эти поля редактируются через существующие сценарии создания и редактирования пользователей. Отдельные `MessengerAccountLink` и `MessengerLinkToken` для MVP не нужны.

### 4.2. Application/use case слой

Выделить или добавить backend use case'ы, которые могут вызываться и web API, и Bot API:

- `ResolveBotUserContextQuery`;
- `GetBotMenuQuery`;
- `ListAttendanceGroupsQuery`;
- `GetAttendanceRosterQuery`;
- `SaveAttendanceCommand`;
- `SearchBotClientsQuery`;
- `GetBotClientCardQuery`;
- `ListExpiringMembershipsQuery`;
- `ListUnpaidMembershipsQuery`;
- `MarkMembershipPaymentCommand`;
- `WriteBotAccessDeniedAuditCommand`.

Правила внутри backend:

- `HeadCoach` видит все группы и может отмечать сегодня и любую дату в прошлом;
- `Administrator` видит все группы и может отмечать сегодня и любую дату в прошлом;
- `Coach` видит только назначенные группы и может отмечать только сегодня, вчера и позавчера;
- будущие даты запрещены всем;
- `Coach` не получает телефон, контакты, сумму оплаты и полные данные абонемента;
- заканчивающиеся абонементы считаются в окне `today..today+10 days` включительно;
- просроченные абонементы не входят в список заканчивающихся;
- изменяющие действия пишут audit с `source = Bot` и `messengerPlatform = Telegram`.

### 4.3. CRM-owned данные

Добавить backend-сущность:

- `BotIdempotencyRecord`.

Поля:

- `Platform`;
- `PlatformUserIdHash`;
- `IdempotencyKey`;
- `ActionType`;
- `PayloadHash`;
- `ResponseJson`;
- `Status`;
- `CreatedAt`;
- `ExpiresAt`.

`BotNotificationSettings` можно добавить позже вместе со срезом уведомлений.

### 4.4. Internal Bot API

Добавить `/internal/bot` endpoints:

- `POST /internal/bot/telegram/session/resolve`;
- `GET /internal/bot/menu`;
- `GET /internal/bot/attendance/groups`;
- `GET /internal/bot/attendance/groups/{groupId}/clients`;
- `POST /internal/bot/attendance/groups/{groupId}`;
- `GET /internal/bot/clients`;
- `GET /internal/bot/clients/{clientId}`;
- `GET /internal/bot/clients/expiring-memberships`;
- `GET /internal/bot/clients/unpaid-memberships`;
- `POST /internal/bot/clients/{clientId}/membership/mark-payment`;
- `POST /internal/bot/audit/access-denied`.

Все endpoints:

- требуют service token;
- принимают Telegram identity, а не `crmUserId`;
- резолвят CRM-пользователя по `User.MessengerPlatform + User.MessengerPlatformUserId`;
- проверяют `IsActive` и `MustChangePassword`;
- возвращают готовые Bot read models;
- для изменяющих команд требуют `Idempotency-Key`.

### 4.5. Audit

Расширить audit:

- `source = Web | Bot`;
- `messengerPlatform = Telegram`;
- безопасный hash Telegram user id при необходимости;
- фильтр по source в web-журнале;
- фильтр по messenger platform в web-журнале.

Audit action codes MVP:

- `BotAttendanceSaved`;
- `BotMembershipPaymentMarked`;
- `BotAccessDenied`.

Изменение Telegram ID у пользователя фиксируется существующим audit-сценарием изменения пользователя.

### 4.6. Backend tests

Покрыть:

- создание пользователя с `MessengerPlatform = Telegram` и Telegram ID;
- редактирование Telegram ID пользователя;
- запрет дублирующего Telegram ID;
- service-to-service auth;
- resolve Telegram identity в CRM user context;
- неизвестный Telegram ID не получает CRM-данные;
- inactive user;
- `MustChangePassword`;
- меню по ролям;
- доступ `Administrator` к посещаемости;
- ограничения дат для `Coach`;
- запрет будущих дат;
- role-based client payload для `Coach`;
- окно заканчивающихся абонементов с включением сегодняшнего и 10-го дня;
- mark-payment idempotency;
- audit source `Bot/Telegram`.

## 5. Frontend MVP

Доработать создание и редактирование пользователя.

Добавить поля:

- `MessengerPlatform` — пока только `Telegram`;
- `MessengerPlatformUserId` — Telegram ID пользователя.

Технические frontend-правки:

- обновить API-типы пользователя, create request и update request;
- добавить поля в форму создания пользователя;
- добавить поля в форму редактирования пользователя;
- отображать Telegram ID в карточке или списке пользователей, если в текущем UI есть место для служебных параметров пользователя;
- поддержать очистку Telegram ID при редактировании пользователя;
- передавать пустое значение как отсутствие Telegram-настройки, а не как строку с пробелами;
- показать backend validation error при дублирующемся Telegram ID;
- не добавлять отдельный экран самостоятельной привязки Telegram в MVP.

UX:

- объяснить, что Telegram ID можно узнать у пользователя из сообщения бота `/start` или `/id`;
- показать понятную ошибку, если Telegram ID уже указан у другого пользователя;
- отображать Telegram ID в карточке или форме пользователя;
- при очистке Telegram ID пользователь теряет доступ к боту.

Отдельный блок самостоятельной привязки, одноразовые коды, ссылки и отвязка из профиля не нужны для MVP.

## 6. Python-сервис MVP

### 6.1. Каркас

Создать сервис `bot/`:

```text
bot/
  Dockerfile
  pyproject.toml
  alembic.ini
  src/gym_crm_bot/
    main.py
    config.py
    logging.py
    app.py
    telegram/
    core/
    crm/
    storage/
    resources/
  tests/
```

Стек MVP:

- `aiogram`;
- `FastAPI` для health endpoints;
- `httpx`;
- `pydantic-settings`;
- `SQLAlchemy` async + `asyncpg`;
- `Alembic`;
- `pytest`;
- `ruff`.

### 6.2. Bot-owned storage

Добавить таблицы:

- `bot_conversation_states`;
- `bot_processed_updates`.

`bot_delivery_log` не нужен для MVP, если плановые уведомления отложены.

### 6.3. Telegram adapter

Реализовать:

- long polling;
- прием command/text/callback;
- отказ или игнорирование групп, супергрупп и каналов без раскрытия данных CRM;
- отправку сообщений;
- inline-кнопки;
- callback data encoding/decoding;
- idempotency по `update_id`.

Webhook и скачивание файлов не входят в MVP.

### 6.4. CRM client

Реализовать `CrmBotApiClient`:

- bearer service token;
- `X-Request-Id`;
- `Idempotency-Key` для изменяющих запросов;
- timeout handling;
- retry только для безопасных read-запросов;
- нормализация backend errors.

Ошибки MVP:

- Telegram user is not configured in CRM;
- CRM user inactive;
- must change password;
- forbidden by role;
- invalid attendance date;
- idempotency conflict;
- validation error;
- temporary backend error.

## 7. Bot UX MVP

### 7.1. `/start` и `/id`

Поток для известного Telegram ID:

1. Пользователь пишет `/start` в личный чат.
2. Бот вызывает `session/resolve`.
3. Backend находит CRM-пользователя по Telegram ID.
4. Бот показывает меню.

Поток для неизвестного Telegram ID:

1. Пользователь пишет `/start` или `/id`.
2. Backend не находит CRM-пользователя.
3. Бот отвечает без CRM-данных: `Ваш Telegram ID: <id>. Передайте его администратору CRM для подключения бота.`

### 7.2. Меню

`HeadCoach`:

- `Посещения`;
- `Поиск клиента`;
- `Заканчивающиеся`;
- `Неоплаченные`.

`Administrator`:

- `Посещения`;
- `Поиск клиента`;
- `Заканчивающиеся`;
- `Неоплаченные`.

`Coach`:

- `Посещения`;
- `Поиск клиента`.

`Сводка`, `Настройки` и `Отвязать Telegram` не входят в MVP.

### 7.3. Посещаемость

Поток:

1. Выбор `Посещения`.
2. Выбор даты:
   - `Coach`: сегодня, вчера, позавчера;
   - `HeadCoach` и `Administrator`: сегодня, вчера, выбрать дату в прошлом.
3. Выбор группы из backend read model.
4. Получение roster группы.
5. Отметка `Был` / `Не был`.
6. Сохранение одним действием через Bot API с `Idempotency-Key`.
7. Итоговое сообщение.

Python хранит только черновик диалога. Backend проверяет дату, роль, группу и состав клиентов.

### 7.4. Поиск клиента

Поток:

1. Выбор `Поиск клиента`.
2. Ввод ФИО или телефона.
3. Backend применяет role-based search.
4. Бот показывает результаты с пагинацией.
5. Пользователь открывает карточку.

Для `Coach` backend не ищет по телефону и не возвращает запрещенные поля.

### 7.5. Абонементы и оплата

Сценарии:

- `Заканчивающиеся` — окно `today..today+10 days` включительно;
- `Неоплаченные` — текущие неоплаченные абонементы;
- `Подтвердить оплату` — явное подтверждение и вызов mark-payment с `Idempotency-Key`.

Доступно только `HeadCoach` и `Administrator`.

## 8. Docker и конфигурация

Добавить:

- `bot/Dockerfile`;
- сервис `bot` в `docker-compose.yml`;
- env для Telegram token;
- env для CRM backend URL;
- env для service token;
- env для bot database URL;
- `BOT_MODE=LongPolling`;
- `.env.example`;
- README-раздел по запуску и настройке Telegram ID у пользователя.

Секреты не хранить в репозитории.

## 9. Порядок реализации MVP

### Этап 0. Baseline

1. Запустить `dotnet test backend/GymCrm.slnx`.
2. Запустить `cd frontend && npm run lint`.
3. Запустить `cd frontend && npm run build`.
4. Создать тестового Telegram-бота вне репозитория.
5. Сохранить token только в локальном `.env`.

### Этап 1. Backend foundation

1. Добавить поля `MessengerPlatform` и `MessengerPlatformUserId` в пользователя.
2. Добавить EF migration и уникальный индекс.
3. Выделить Application/use case'ы.
4. Добавить internal Bot API auth.
5. Добавить Bot read models.
6. Добавить backend idempotency.
7. Добавить audit source/platform.
8. Покрыть backend tests.

### Этап 2. User management UI

1. Обновить frontend API-типы пользователя и request payloads.
2. Добавить `MessengerPlatform` и `MessengerPlatformUserId` в create user form.
3. Добавить `MessengerPlatform` и `MessengerPlatformUserId` в edit user form.
4. Отобразить Telegram ID в user UI, где пользовательские служебные поля уже показываются.
5. Добавить frontend-нормализацию пустого Telegram ID.
6. Показать backend-ошибку дублирующего Telegram ID.
7. Покрыть backend и frontend checks.

### Этап 3. Python scaffold

1. Создать `bot/`.
2. Добавить config/logging/health.
3. Добавить storage и Alembic.
4. Добавить CRM client.
5. Добавить базовые pytest и ruff.

### Этап 4. Telegram adapter

1. Добавить long polling.
2. Добавить private-chat guard.
3. Нормализовать command/text/callback.
4. Добавить отправку сообщений и кнопок.
5. Добавить processed update storage.

### Этап 5. Resolve и меню

1. Реализовать `/start`.
2. Реализовать `/id`.
3. Реализовать ответ с Telegram ID для неизвестного пользователя.
4. Реализовать role-aware меню для известного пользователя.
5. Реализовать отказ по недоступным командам.

### Этап 6. Посещаемость

1. Реализовать выбор даты.
2. Реализовать выбор группы.
3. Реализовать roster.
4. Реализовать черновик отметок.
5. Реализовать сохранение с `Idempotency-Key`.
6. Реализовать итоговое сообщение.

### Этап 7. Поиск и карточка

1. Реализовать поиск.
2. Реализовать пагинацию.
3. Реализовать карточку клиента.
4. Проверить role-based payload для `Coach`.

### Этап 8. Абонементы и оплата

1. Реализовать `Заканчивающиеся`.
2. Реализовать `Неоплаченные`.
3. Реализовать подтверждение оплаты.
4. Реализовать mark-payment.
5. Проверить audit и idempotency.

### Этап 9. Docker, документация и приемка

1. Добавить `bot` в `docker-compose.yml`.
2. Обновить `.env.example`.
3. Обновить README.
4. Запустить все проверки.
5. Провести ручной smoke в Telegram.

## 10. Проверки MVP

Обязательные проверки:

- `dotnet test backend/GymCrm.slnx`;
- `cd frontend && npm run lint`;
- `cd frontend && npm run build`;
- `cd bot && ruff check .`;
- `cd bot && pytest`;
- `docker compose build bot`.

Ручной smoke:

- `/start` для неизвестного Telegram ID показывает ID и не раскрывает CRM-данные;
- указание Telegram ID в карточке пользователя CRM;
- редактирование Telegram ID в карточке пользователя CRM;
- очистка Telegram ID отключает доступ к боту;
- дублирующий Telegram ID показывает понятную ошибку в user UI;
- `/start` для известного Telegram ID показывает меню;
- отказ или игнорирование группового чата;
- меню `HeadCoach`;
- меню `Administrator`;
- меню `Coach`;
- посещаемость `Coach` за сегодня, вчера, позавчера;
- запрет будущей даты;
- посещаемость `Administrator`;
- поиск клиента;
- проверка, что `Coach` не видит запрещенные поля;
- заканчивающиеся абонементы;
- неоплаченные абонементы;
- отметка оплаты с подтверждением;
- повторный callback не создает дубль.

## 11. Критерии готовности MVP

MVP готов, если:

- бот работает в Telegram long polling;
- бот не раскрывает данные в группах, супергруппах и каналах;
- неизвестный Telegram ID получает только собственный Telegram ID и инструкцию обратиться к администратору;
- CRM-пользователь создается или редактируется с `MessengerPlatform = Telegram` и Telegram ID;
- один Telegram ID не может быть указан двум CRM-пользователям;
- меню строится по роли;
- посещаемость работает для `HeadCoach`, `Administrator` и `Coach`;
- правила дат соблюдаются backend'ом;
- поиск и карточка клиента возвращают role-based read model;
- `Coach` не получает запрещенные данные;
- заканчивающиеся абонементы считаются с включением сегодняшнего и 10-го дня;
- отметка оплаты требует подтверждения;
- изменяющие операции идемпотентны;
- audit показывает `Bot/Telegram`;
- Python-сервис не содержит бизнес-правил CRM и работает как тонкий клиент.
