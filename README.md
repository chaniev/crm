# CRM для спортивного зала

## Описание проекта

MVP CRM-системы для спортивного зала. Проект предназначен для ведения базы клиентов, групп и тренеров, учета абонементов и оплат, отметки посещений, хранения истории изменений и разграничения доступа по ролям.

## Структура проекта

```text
crm/
  .env.example
  AGENTS.md
  README.md
  backend/
    .dockerignore
    Crm.slnx
    Dockerfile
    src/
      Crm.Api/             ASP.NET Core API
      Crm.Application/     прикладной слой
      Crm.Domain/          доменная модель
      Crm.Infrastructure/  инфраструктурный слой
    tests/
      Crm.Tests/           smoke-тесты и backend-тесты
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

## Краткая инструкция по развертыванию

1. Убедиться, что установлен `Docker` с поддержкой `docker compose`.
2. При необходимости создать файл `.env` на основе `.env.example`.
3. Из корня проекта выполнить команду:

```bash
docker compose up --build -d
```

После запуска сервисы будут доступны по адресам:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8080`
- PostgreSQL: `localhost:5432`

## Первый вход

- Backend автоматически создает первого пользователя с ролью `HeadCoach`.
- По умолчанию логин первого пользователя: `headcoach`.
- Стартовый пароль: `12345678`.
- После первого входа система обязательно переводит пользователя на экран смены пароля и не открывает рабочий shell, пока пароль не изменен.
- Логин bootstrap-пользователя можно переопределить через конфигурационный ключ `BootstrapUser:Login` или переменную окружения `BootstrapUser__Login`.

## Миграции базы данных

Backend использует `EF Core` и применяет ожидающие миграции при старте приложения.

Для локальной работы с миграциями используется локальный tool manifest в `backend/dotnet-tools.json`.

Команды:

```bash
cd backend
dotnet tool restore
dotnet dotnet-ef migrations list --project src/Crm.Infrastructure/Crm.Infrastructure.csproj --startup-project src/Crm.Api/Crm.Api.csproj
dotnet dotnet-ef database update --project src/Crm.Infrastructure/Crm.Infrastructure.csproj --startup-project src/Crm.Api/Crm.Api.csproj
```

## Проверки

```bash
dotnet test backend/Crm.slnx
cd frontend
npm run build
npm run lint
```
