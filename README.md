# Gym CRM для спортивного зала

## Описание проекта

MVP Gym CRM-системы для спортивного зала. Проект предназначен для ведения базы клиентов, групп и тренеров, учета абонементов и оплат, отметки посещений, хранения истории изменений и разграничения доступа по ролям.

## Структура проекта

```text
gym-crm/
  .env.example
  AGENTS.md
  README.md
  backend/
    .dockerignore
    GymCrm.slnx
    Dockerfile
    src/
      GymCrm.Api/             ASP.NET Core API
      GymCrm.Application/     прикладной слой
      GymCrm.Domain/          доменная модель
      GymCrm.Infrastructure/  инфраструктурный слой
    tests/
      GymCrm.Tests/           smoke-тесты и backend-тесты
  docs/
    AGENT_ROUTING.md
    DELIVERY_CHECKLIST.md
    IMPLEMENTATION_PLAN.md
    MVP-ТЗ.md
    MVP_SCREEN_MAP.md
    описание требований. txt
  docker-compose.yml
  frontend/
    .dockerignore
    .gitignore
    src/
      main.tsx
      App.tsx
      App.css
      index.css
    Dockerfile
    eslint.config.js
    index.html
    package-lock.json
    package.json
    tsconfig.app.json
    tsconfig.json
    tsconfig.node.json
    vite.config.ts
  global.json
```

## Используемые технологии

- Backend: `C#`, `ASP.NET Core`, `.NET 10`
- Frontend: `React 19`, `TypeScript`, `Vite`, `Mantine`, `Onest`
- База данных: `PostgreSQL 17`
- Тестирование: `xUnit`
- Контейнеризация: `Docker`, `Docker Compose`

## Docker-развертывание

1. Убедиться, что установлен `Docker` с поддержкой `docker compose`.
2. Создать `.env` на основе `.env.example` и задать как минимум `POSTGRES_PASSWORD`.
3. Для локального `http://localhost`-запуска оставить `BACKEND_AUTH_COOKIE_SECURE_POLICY=SameAsRequest`.
4. Для реального HTTPS-деплоя переключить `BACKEND_AUTH_COOKIE_SECURE_POLICY=Always`.
5. Из корня проекта выполнить:

```bash
docker compose up --build -d
```

Сервисы после запуска:

- Frontend: `http://localhost:3000`
- Backend API и health endpoints: `http://localhost:8080`
- PostgreSQL не публикуется наружу по умолчанию и доступен только внутри `docker compose`-сети.
- Telegram-бот запускается в составе `docker compose` как сервис `bot` и работает в режиме long polling (`BOT_MODE=LongPolling`).

Именованные Docker volumes:

- `postgres_data` — данные PostgreSQL;
- `backend_client_photos` — загруженные фотографии клиентов;
- `backend_logs` — технические логи backend в `/app/logs/technical`.

## Запуск Telegram-бота (MVP)

После настройки `.env` (раздел переменных ниже) поднимите стек:

```bash
docker compose up --build -d bot
```

Сервис `bot` ждёт готовности `db` и `backend`, а также использует:

- `BOT_TELEGRAM_TOKEN` — токен Telegram-бота;
- `BOT_DATABASE_URL` — база PostgreSQL для bot-owned storage (можно использовать общую базу `gym_crm`);
- `CRM_API_BASE_URL` — URL внутреннего backend API (`http://backend:8080` для compose);
- `CRM_BOT_API_TOKEN` — service token для доступа бота к internal Bot API;
- `BOT_MODE=LongPolling` — режим запуска в MVP.

Значения для внутренней проверки в backend:

- `BOT_INTERNAL_API_TOKEN` — общий service token для `/internal/bot` в backend;
- `BOT_INTERNAL_API_ENABLED` — включение internal Bot API.

### Как привязать Telegram ID в CRM

Администратор должен заполнить у пользователя CRM поля:

- `MessengerPlatform = Telegram`;
- `MessengerPlatformUserId = <Telegram user_id пользователя>`.

Пользователь бота, чей `MessengerPlatformUserId` не найден, получает подсказку с его Telegram ID и инструкцию передать его администратору для активации доступа.

Остановка и повторный запуск:

```bash
docker compose down
docker compose up -d
```

`docker compose down` сохраняет данные, фотографии и техлоги в volumes. Команда `docker compose down -v` удаляет volumes вместе с данными.

## Первый вход

- Backend автоматически создает первого пользователя с ролью `HeadCoach`.
- По умолчанию логин первого пользователя: `headcoach`.
- Стартовый пароль: `12345678`.
- После первого входа система обязательно переводит пользователя на экран смены пароля и не открывает рабочий shell, пока пароль не изменен.
- Логин bootstrap-пользователя можно переопределить через конфигурационный ключ `BootstrapUser:Login` или переменную окружения `BootstrapUser__Login`.

Дополнительно можно переопределить:

- `BootstrapUser__FullName` — имя bootstrap-пользователя;
- `BACKEND_APPLY_MIGRATIONS` — применять ли миграции при старте backend;
- `BACKEND_FAIL_ON_MIGRATION_ERROR` — падать ли при ошибке миграций;
- `BACKEND_TECHNICAL_LOG_*` — директорию, префикс файла, размер файла и срок хранения технических логов.

## Миграции базы данных

Backend использует `EF Core` и применяет ожидающие миграции при старте приложения, если `BACKEND_APPLY_MIGRATIONS=true`.

Порядок первого запуска в Docker:

1. `db` поднимается и проходит `healthcheck`.
2. `backend` подключается к `PostgreSQL` внутри Docker-сети.
3. `backend` применяет ожидающие миграции.
4. `backend` создаёт bootstrap `HeadCoach`, только если в базе ещё нет пользователей.
5. `frontend` поднимается после readiness backend и проксирует `/api/*` во внутренний сервис `backend`.

Для локальной работы с миграциями используется локальный tool manifest в `backend/dotnet-tools.json`.

Команды:

```bash
cd backend
dotnet tool restore
dotnet dotnet-ef migrations list --project src/GymCrm.Infrastructure/GymCrm.Infrastructure.csproj --startup-project src/GymCrm.Api/GymCrm.Api.csproj
dotnet dotnet-ef database update --project src/GymCrm.Infrastructure/GymCrm.Infrastructure.csproj --startup-project src/GymCrm.Api/GymCrm.Api.csproj
```

## Проверки

```bash
dotnet test backend/GymCrm.slnx
cd frontend
npm run build
npm run lint
```

Docker smoke-проверка:

```bash
docker compose up --build -d
curl http://localhost:8080/health/ready
curl http://localhost:3000/healthz
curl http://localhost:3000/api/health/ready
```
