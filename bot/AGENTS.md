# AGENTS.md

## Область

Этот файл обязателен для задач внутри `bot/`.

`bot/` — отдельный Python runtime-сервис Telegram-бота рядом с `backend/`. Он не является частью ASP.NET Core backend-процесса.

## Источники истины

Порядок приоритета:

1. запрос пользователя;
2. этот `AGENTS.md`;
3. исходники, типы, тесты и конфигурация в `bot/`;
4. `pyproject.toml`, `Dockerfile`, `alembic.ini`, `docker-compose.yml`;
5. `docs/TELEGRAM_BOT_MVP_IMPLEMENTATION_PLAN.md` и `docs/TELEGRAM_BOT_IMPLEMENTATION_PLAN.md` — как дополнительный контекст.

## Структура исходного кода

Ожидаемый каркас:

- `Dockerfile` — сборка runtime-образа бота.
- `pyproject.toml` — зависимости, форматирование, lint, test config.
- `alembic.ini` — конфигурация миграций bot-owned storage.
- `src/gym_crm_bot/main.py` — точка входа.
- `src/gym_crm_bot/app.py` — сборка приложения, health endpoints, lifecycle.
- `src/gym_crm_bot/config.py` — env-настройки.
- `src/gym_crm_bot/telegram/` — Telegram adapter, long polling, commands, callbacks, messages.
- `src/gym_crm_bot/crm/` — клиент internal Bot API backend.
- `src/gym_crm_bot/core/` — сценарии диалогов и прикладная логика бота.
- `src/gym_crm_bot/storage/` — bot-owned storage, SQLAlchemy models, repositories, Alembic migrations.
- `src/gym_crm_bot/resources/` — тексты, клавиатуры, callback data helpers.
- `tests/` — unit и integration-style тесты Python-сервиса.

## Какие агенты использовать

- `python-pro` — Python runtime, async код, `aiogram`, `FastAPI`, `httpx`, `SQLAlchemy` async, `asyncpg`, `Alembic`, `pytest`, `ruff`.
- `docker-expert` — `bot/Dockerfile`, сервис `bot` в `docker-compose.yml`, env, health checks, runtime.
- `test-automator` — pytest, regression coverage, тестовые fixtures и idempotency-проверки.

## Короткие правила

- Python-сервис работает как тонкий клиент к backend.
- Не дублировать бизнес-правила CRM в Python: роли, access scope, даты посещаемости, состав групп и разрешенные поля проверяет backend.
- Python отвечает за Telegram events, private-chat guard, состояние диалога, отображение backend read models, idempotency по `update_id` и понятные сообщения пользователю.
- В MVP использовать Telegram long polling; production webhook не входит в MVP.
- Секреты не хранить в репозитории: Telegram token, service token и database URL только через env.
- Все вызовы internal Bot API выполнять с service token и `X-Request-Id`.
- Для изменяющих запросов в backend передавать `Idempotency-Key`.
- Retry использовать только для безопасных read-запросов.
- Bot-owned storage хранит только состояние диалога и обработанные Telegram updates.

## Проверки

Минимум:

- `cd bot && ruff check .`
- `cd bot && pytest`

Если меняются `Dockerfile`, env, health endpoints или runtime:

- `docker compose build bot`

Если меняется контракт с backend:

- `dotnet test backend/GymCrm.slnx`
- `cd bot && pytest`
