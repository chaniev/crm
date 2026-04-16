# CRM для спортивного зала

## Описание проекта

MVP CRM-системы для спортивного зала. Проект предназначен для ведения базы клиентов, групп и тренеров, учета абонементов и оплат, отметки посещений, хранения истории изменений и разграничения доступа по ролям.

## Структура исходных кодов

```text
crm/
  backend/
    Crm.slnx
    src/
      Crm.Api/             ASP.NET Core API и точка входа приложения
      Crm.Application/     прикладной слой и конфигурация зависимостей
      Crm.Domain/          доменная модель и общие контракты
      Crm.Infrastructure/  инфраструктурные реализации и интеграции
    tests/
      Crm.Tests/           автотесты backend
    Dockerfile
  frontend/
    src/
      main.tsx             точка входа frontend
      App.tsx              корневой React-компонент
      App.css
      index.css
    Dockerfile
    package.json
  docker-compose.yml
```

## Используемые технологии

- Backend: `C#`, `ASP.NET Core`, `.NET 10`
- Frontend: `React 19`, `TypeScript`, `Vite`
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
