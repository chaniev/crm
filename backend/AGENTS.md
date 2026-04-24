# AGENTS.md

## Область

Этот файл обязателен для задач внутри `backend/`.

## Структура

- `src/GymCrm.Api/` — endpoint'ы, auth, middleware, startup, health checks.
- `src/GymCrm.Application/` — интерфейсы и прикладные контракты.
- `src/GymCrm.Domain/` — сущности, enum'ы и доменные типы.
- `src/GymCrm.Infrastructure/` — `EF Core`, `DbContext`, storage, security, реализации сервисов.
- `tests/GymCrm.Tests/` — интеграционные и smoke-тесты.

## Какие агенты использовать

- `csharp-developer` — `Domain`, `Application`, `Infrastructure`, модели, сервисы и persistence.
- `dotnet-core-expert` — `Api`, auth, `CSRF`, middleware, startup, DI, конфигурация.
- `python-pro` — Python-скрипты, утилиты, генераторы, миграционные/операционные helper'ы и тестовые harness'ы внутри `backend/`.
- `test-automator` — тесты в `tests/GymCrm.Tests/`.
- `docker-expert` — `backend/Dockerfile`, runtime, volumes, readiness, логирование.

## Короткие правила

- Не смешивать слои без необходимости.
- `Domain` не должен зависеть от HTTP и UI.
- `Api` отвечает за endpoint'ы, auth и HTTP boundary.
- `Infrastructure` отвечает за БД, storage и реальные реализации сервисов.
- При новых правках и целевом рефакторинге двигаться к принципу `один файл — один верхнеуровневый тип`: `class`, `record`, `interface`, `enum` и другие самостоятельные типы выносить в отдельные файлы с совпадающим именем.
- Не добавлять новые крупные nested-типы в endpoint/service файлы; если участок уже меняется, выносить DTO, response/request records, validators и helpers в отдельные файлы в той же области ответственности.
- Не переносить файлы из `src/GymCrm.Api/Auth/` без отдельной задачи на реорганизацию.
- Не трогать миграции, если схема БД не меняется.
- Если меняется API или persistence, обновлять тесты.

## Проверки

Минимум:

- `dotnet test backend/GymCrm.slnx`

Точечные прогоны:

- `dotnet test backend/tests/GymCrm.Tests/GymCrm.Tests.csproj --filter "FullyQualifiedName~ClientsApiTests"`
- `dotnet test backend/tests/GymCrm.Tests/GymCrm.Tests.csproj --filter "FullyQualifiedName~AttendanceApiTests"`
- `dotnet test backend/tests/GymCrm.Tests/GymCrm.Tests.csproj --filter "FullyQualifiedName~AuthorizationFlowTests"`

Если меняются startup, env, `Dockerfile`, volumes, readiness или логирование:

- `docker compose up --build -d`
- `curl http://localhost:8080/health/ready`
