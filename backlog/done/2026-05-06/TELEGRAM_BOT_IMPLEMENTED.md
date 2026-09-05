# Реализовано: Telegram-бот Gym CRM

Дата разнесения: 2026-05-06

Источник: бывшие `docs/TELEGRAM_BOT_IMPLEMENTATION_PLAN.md` и `docs/TELEGRAM_BOT_MVP_IMPLEMENTATION_PLAN.md`.

## Закрытый срез

Реализована основа Telegram MVP как отдельного Python-сервиса `bot/`:

- создан `bot/` с `pyproject.toml`, `Dockerfile`, `FastAPI` health endpoints, config/logging, `pytest` и `ruff`;
- добавлен Telegram long polling через `aiogram`, private-chat guard, нормализация command/text/callback, отправка сообщений и inline-кнопок;
- реализован `httpx` CRM client с bearer service token, `X-Request-Id`, timeout, retry для safe reads и нормализацией основных backend errors;
- добавлен bot-owned storage через PostgreSQL/SQLAlchemy async, Alembic, `bot_conversation_states` и `bot_processed_updates`;
- реализована idempotency входящих Telegram update'ов по `update_id`.

Backend foundation для бота реализован:

- создан internal Bot API `/internal/bot`;
- добавлены endpoints для resolve, меню, посещаемости, поиска клиентов, карточки клиента, списков заканчивающихся и неоплаченных абонементов, отметки оплаты и audit access denied;
- добавлена service-to-service auth;
- добавлена backend idempotency для изменяющих Bot API endpoints через `BotIdempotencyRecord`;
- добавлены CRM-owned поля `User.MessengerPlatform` и `User.MessengerPlatformUserId`;
- добавлена уникальность Telegram identity, EF configuration/migrations, user create/update endpoints и frontend-поля;
- backend остается источником ролей, access scope, правил дат, ролевого среза данных, бизнес-валидации и audit semantics.

Реализованы пользовательские сценарии MVP:

- `/start`;
- `/id`;
- безопасный ответ неизвестному Telegram ID без раскрытия CRM-данных;
- role-aware меню;
- выбор даты и группы для посещаемости;
- roster, черновик отметок и сохранение посещаемости через Bot API с `Idempotency-Key`;
- поиск клиента с пагинацией;
- открытие карточки клиента в backend role-based payload;
- списки `Заканчивающиеся` и `Неоплаченные`;
- подтверждение и отметка оплаты текущего абонемента;
- audit source `Bot`, `messengerPlatform = Telegram`, Bot action codes, backend-фильтры и frontend-фильтры журнала действий.

Инфраструктура базово подключена:

- `bot` добавлен в `docker-compose.yml`;
- переменные окружения добавлены в `.env.example`;
- README содержит базовый раздел запуска Telegram-бота.

## Проверки, зафиксированные в исходной сверке

В исходном плане зафиксировано наличие backend tests для Bot API/idempotency/audit, storage tests, fake HTTP transport tests, unit tests на `/start`, `/id`, callback/menu helpers и часть сервисных сценариев Python-бота.

При переносе документации 2026-05-06 новые проверки не запускались.
