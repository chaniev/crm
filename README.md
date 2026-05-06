# Gym CRM для спортивного зала

## Описание

Gym CRM - рабочая CRM-система для спортивного зала. Проект закрывает основные операционные сценарии: клиентская база, группы и тренеры, абонементы и оплаты, посещаемость, аудит изменений, разграничение доступа по ролям и Telegram-интерфейс для тренеров.

Backend является источником истины для бизнес-правил CRM: ролей, прав, областей доступа, абонементов, посещаемости, аудита и валидации. Frontend и Telegram-бот только потребляют backend-контракты и не дублируют доменную логику.

## Возможности

- Аутентификация через cookie-сессию, CSRF-защита и обязательная смена стартового пароля.
- Роли `HeadCoach`, `Administrator`, `Coach` с разными доступными разделами и правами.
- Управление клиентами: карточка клиента, контакты, группы, архивирование, восстановление, фото, абонементы, продление, корректировка и отметка оплаты.
- Управление группами и назначением тренеров.
- Управление пользователями CRM и привязкой Telegram ID.
- Отметка посещений по группам и датам с учетом области доступа тренера.
- Журнал аудита для действий с пользователями, клиентами, группами, посещениями и авторизацией.
- Telegram-бот в режиме long polling: меню по правам пользователя, посещаемость, поиск клиентов, списки истекающих и неоплаченных абонементов, отметка оплаты.
- Health endpoints для backend, frontend и bot runtime.

## Структура

```text
crm/
  AGENTS.md
  README.md
  global.json
  backend/
    AGENTS.md
    GymCrm.slnx
    Dockerfile
    dotnet-tools.json
    src/
      GymCrm.Api/             ASP.NET Core API, auth, endpoints, health checks
      GymCrm.Application/     use cases, contracts, permissions, bot API contracts
      GymCrm.Domain/          domain entities and enums
      GymCrm.Infrastructure/  EF Core, PostgreSQL, audit, photos, services
    tests/
      GymCrm.Tests/           integration and regression tests
  frontend/
    AGENTS.md
    Dockerfile
    nginx.conf
    package.json
    vite.config.ts
    src/
      features/               app screens and route-level UX
      lib/api/                typed backend API client
      lib/appRoutes.ts        app routing and access-aware navigation
      theme.ts
  bot/
    AGENTS.md
    Dockerfile
    pyproject.toml
    src/gym_crm_bot/
      telegram/               Telegram adapters
      crm/                    backend Bot API client
      core/                   dialog flows and idempotency
      storage/                bot-owned runtime state
    tests/
  backlog/
    README.md
    inbox/                    входящие запросы
    tasks/                    задачи на доработку
    done/                     реализованные задачи на доработку
  deploy/
    .env.example
    docker-compose.yml
  docs/
    MVP-ТЗ.md
    MVP_SCREEN_MAP.md
    TELEGRAM_BOT_IMPLEMENTATION_PLAN.md
    ui-concept/
```

## Технологии

- Backend: `C#`, `ASP.NET Core`, `.NET 10`, `EF Core`, `Serilog`, `Magick.NET`.
- Frontend: `React 19`, `TypeScript`, `Vite`, `Mantine 9`, `Onest`, `Vitest`, `Playwright`.
- Bot: `Python 3.13`, `aiogram`, `FastAPI`, `SQLAlchemy asyncio`, `asyncpg`, `Telethon` для MTProxy/MTProto-сценариев.
- База данных: `PostgreSQL 17`.
- Тестирование: `xUnit`, `Vitest`, `Playwright`, `pytest`, `ruff`.
- Инфраструктура: `Docker`, `Docker Compose`, `nginx`.

## Быстрый запуск в Docker

Команды ниже выполняются из корня репозитория.

1. Создать локальный env-файл:

```bash
cp deploy/.env.example .env
```

2. Заполнить секреты и обязательные значения в `.env`:

- `POSTGRES_PASSWORD`;
- `BOT_TELEGRAM_TOKEN`, если нужен Telegram-бот;
- `CRM_BOT_API_TOKEN` и `BOT_INTERNAL_API_TOKEN` - одинаковый service token для связи bot -> backend;
- для локального HTTP оставить `BACKEND_AUTH_COOKIE_SECURE_POLICY=SameAsRequest`;
- для HTTPS-деплоя переключить `BACKEND_AUTH_COOKIE_SECURE_POLICY=Always`.

3. Поднять весь стек:

```bash
docker compose --project-directory . --env-file .env -f deploy/docker-compose.yml up --build -d
```

После запуска доступны:

- Frontend: `http://localhost:3000`;
- Backend API: `http://localhost:8080`;
- Backend readiness: `http://localhost:8080/health/ready`;
- Frontend health: `http://localhost:3000/healthz`;
- Backend через frontend proxy: `http://localhost:3000/api/health/ready`.

PostgreSQL не публикуется наружу и доступен внутри compose-сети. Бот не публикует порт наружу, но внутри контейнера держит health endpoints на `8080`.

Именованные Docker volumes:

- `postgres_data` - данные PostgreSQL;
- `backend_client_photos` - загруженные фотографии клиентов;
- `backend_logs` - технические логи backend;
- `bot_data` - bot-owned runtime state и MTProto session files.

Остановка без удаления данных:

```bash
docker compose --project-directory . --env-file .env -f deploy/docker-compose.yml down
```

Удаление вместе с volumes:

```bash
docker compose --project-directory . --env-file .env -f deploy/docker-compose.yml down -v
```

## Telegram-бот

Бот запускается сервисом `bot` в составе compose-стека и работает только в режиме `BOT_MODE=LongPolling`.

Основные переменные:

- `BOT_ENABLED` - включает runtime бота;
- `BOT_TELEGRAM_TOKEN` - токен Telegram Bot API;
- `BOT_DATABASE_URL` - база для bot-owned storage;
- `CRM_API_BASE_URL` - backend API, в compose обычно `http://backend:8080`;
- `CRM_BOT_API_TOKEN` - service token, который бот отправляет в backend;
- `BOT_INTERNAL_API_TOKEN` - token, который backend проверяет для `/internal/bot`;
- `BOT_TELEGRAM_PROXY_URL` - HTTP/SOCKS proxy для Telegram;
- `BOT_TELEGRAM_MTPROXY_URLS`, `BOT_TELEGRAM_API_ID`, `BOT_TELEGRAM_API_HASH` - MTProxy/MTProto fallback.

Для привязки пользователя Telegram администратор CRM должен заполнить у пользователя:

- `MessengerPlatform = Telegram`;
- `MessengerPlatformUserId = <Telegram user_id пользователя>`.

Если пользователь не привязан, бот показывает его Telegram ID и просит передать ID администратору.

## Первый вход

При старте backend применяет миграции, если `BACKEND_APPLY_MIGRATIONS=true`, и создает bootstrap-пользователя, если база пользователей пуста.

- Роль первого пользователя: `HeadCoach`.
- Логин по умолчанию: `headcoach`.
- Пароль по умолчанию: `12345678`.
- После первого входа система обязательно переводит пользователя на смену пароля.

Параметры bootstrap-пользователя:

- `BOOTSTRAP_USER_LOGIN`;
- `BOOTSTRAP_USER_FULL_NAME`.

## Локальная разработка

Backend по умолчанию ожидает PostgreSQL на `localhost:5432` с базой `gym_crm`, пользователем `gym_crm` и паролем `gym_crm`.

```bash
ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://localhost:8080 dotnet run --no-launch-profile --project backend/src/GymCrm.Api/GymCrm.Api.csproj
```

Frontend в dev-режиме проксирует `/api` на `http://localhost:8080`, если не задан `VITE_API_PROXY_TARGET`.

```bash
cd frontend
npm ci
npm run dev
```

Bot можно запускать локально после настройки переменных окружения:

```bash
cd bot
python -m venv .venv
. .venv/bin/activate
pip install -e '.[dev]'
python -m gym_crm_bot.main
```

## Миграции

Для локальной работы с миграциями используется tool manifest в `backend/dotnet-tools.json`.

```bash
cd backend
dotnet tool restore
dotnet dotnet-ef migrations list --project src/GymCrm.Infrastructure/GymCrm.Infrastructure.csproj --startup-project src/GymCrm.Api/GymCrm.Api.csproj
dotnet dotnet-ef database update --project src/GymCrm.Infrastructure/GymCrm.Infrastructure.csproj --startup-project src/GymCrm.Api/GymCrm.Api.csproj
```

Порядок первого запуска в Docker:

1. `db` поднимается и проходит `healthcheck`.
2. `backend` подключается к PostgreSQL внутри Docker-сети.
3. `backend` применяет ожидающие миграции.
4. `backend` создает bootstrap `HeadCoach`, если в базе еще нет пользователей.
5. `frontend` стартует после readiness backend и проксирует `/api/*` во внутренний сервис `backend`.
6. `bot` стартует после readiness `db` и `backend`.

## Проверки

Backend:

```bash
dotnet test backend/GymCrm.slnx
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
npm run test:unit
```

Bot:

```bash
cd bot
ruff check .
pytest
```

Docker smoke-проверка:

```bash
docker compose --project-directory . --env-file .env -f deploy/docker-compose.yml up --build -d
curl http://localhost:8080/health/ready
curl http://localhost:3000/healthz
curl http://localhost:3000/api/health/ready
docker compose --project-directory . --env-file .env -f deploy/docker-compose.yml exec -T bot curl -fsS http://localhost:8080/health/ready
```
