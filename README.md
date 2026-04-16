# CRM для спортивного зала

Репозиторий MVP CRM-системы для учета клиентов спортивного зала, групп, тренеров, абонементов, оплат и посещений.

## Статус проекта

Статус: реализован `Этап 0. Подготовка проекта`.

Цель MVP:

- вести базу клиентов;
- объединять клиентов в группы;
- назначать тренеров на группы;
- учитывать абонементы и оплаты;
- отмечать посещения тренировок;
- хранить историю изменений абонементов и историю посещений;
- вести журнал действий пользователей;
- разграничивать доступ по ролям.

## Текущий стек

- backend: `C# / .NET 10`;
- frontend: `React`;
- база данных: `PostgreSQL`;
- контейнеризация: `Docker`;
- локальный запуск: `docker-compose`.

## Структура проекта

```text
crm/
  backend/
    Crm.slnx
    src/
      Crm.Api/
      Crm.Application/
      Crm.Domain/
      Crm.Infrastructure/
    tests/
      Crm.Tests/
    Dockerfile
  frontend/
    src/
    Dockerfile
  docker-compose.yml
  MVP-ТЗ.md
  IMPLEMENTATION_PLAN.md
  README.md
```

## Что уже сделано на этапе 0

- создан каркас backend с разделением на `Crm.Api`, `Crm.Application`, `Crm.Domain`, `Crm.Infrastructure`;
- создан frontend на `React + Vite`;
- добавлен `docker-compose.yml` с сервисами `frontend`, `backend`, `db`;
- PostgreSQL запускается как отдельный контейнер и использует Docker volume `postgres_data`;
- backend получает строку подключения к PostgreSQL через env-переменные;
- реализованы базовые health-check endpoints: `/health/live` и `/health/ready`;
- стартовая страница frontend запрашивает readiness backend через Vite proxy;
- добавлены `.env` и `.env.example` для локальной конфигурации.

## Локальный запуск

Требования:

- установлен Docker с поддержкой `docker compose`;
- установлен `.NET SDK 10`, если планируется запуск backend вне Docker;
- установлен `Node.js`, если планируется запуск frontend вне Docker.

Команда запуска:

```bash
docker compose up --build
```

После старта сервисы доступны по адресам:

- frontend: `http://localhost:3000`
- backend: `http://localhost:8080`
- backend live health: `http://localhost:8080/health/live`
- backend ready health: `http://localhost:8080/health/ready`
- PostgreSQL: `localhost:5432`

Запуск в фоне:

```bash
docker compose up --build -d
```

Остановка:

```bash
docker compose down
```

Остановка с удалением volume PostgreSQL:

```bash
docker compose down -v
```

## Env-конфигурация

Основные переменные находятся в корневом файле `.env`:

- `BACKEND_PORT`
- `FRONTEND_PORT`
- `POSTGRES_PORT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

Если нужны другие локальные значения, можно отредактировать `.env` или восстановить его из `.env.example`.

## Проверка после запуска

Проверить backend health:

```bash
curl http://localhost:8080/health/live
curl http://localhost:8080/health/ready
```

Проверить контейнеры:

```bash
docker compose ps
```

## Документация

- [MVP-ТЗ.md](MVP-ТЗ.md) — основной документ с требованиями к MVP;
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — этапы, архитектурные решения и порядок реализации;
- [AGENTS.md](AGENTS.md) — правила выполнения плана и маршрутизация по агентам;
- [описание требований. txt](описание%20требований.%20txt) — исходные материалы и уточнения.

`MVP-ТЗ.md` следует считать источником истины по функциональным требованиям.  
`IMPLEMENTATION_PLAN.md` описывает порядок инкрементов и технические решения.
