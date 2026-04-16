# AGENT_ROUTING.md

## Назначение

Этот документ содержит детальную маршрутизацию по профильным агентам. По умолчанию для задачи подбирается подходящий агент, а если подходящего профиля нет, задача выполняется локально.

Использовать после чтения:

1. `MVP-ТЗ.md`
2. `IMPLEMENTATION_PLAN.md`
3. `../AGENTS.md`

## Выбор агента по типу задачи

| Тип задачи | Основной агент | Когда использовать |
|---|---|---|
| Доменные сущности, сервисы, async/await, DTO, транзакции, side effects, прикладная логика `.NET` | `csharp-developer` | Когда задача в основном про бизнес-логику, сервисный слой, persistence behavior или контрактную безопасность |
| `ASP.NET Core` API, middleware, auth cookie, CSRF, DI, конфигурация, hosting, pipeline запросов | `dotnet-core-expert` | Когда задача в основном про HTTP-поведение, авторизацию, политики доступа, конфигурацию окружений или API boundary |
| Компоненты `React`, формы, состояние, эффекты, маршруты, доступность, поведение экранов | `react-specialist` | Когда задача в основном про клиентский интерфейс, state flow и user interaction |
| Решения по UI/UX, иерархии, состояниям `loading/empty/error`, фокусу, keyboard navigation | `ui-designer` | Когда нужен implement-ready дизайн до начала верстки или перед переработкой экрана |
| Автотесты, regression coverage, test harness, фикстуры, стабилизация CI тестов | `test-automator` | Когда нужно покрыть риск тестами или исправить инфраструктуру тестирования |
| `Dockerfile`, `docker-compose`, контейнерный runtime, healthcheck, image hardening, startup/shutdown | `docker-expert` | Когда задача про сборку, контейнеризацию, локальный запуск и эксплуатационное поведение |

## Выбор агента по этапам плана

| Этап плана | Рекомендуемые агенты | Примечание |
|---|---|---|
| `Этап 0. Подготовка проекта` | `docker-expert`, `dotnet-core-expert`, `react-specialist` | Каркас репозитория, `docker-compose`, health checks, стартовая страница |
| `Этап 1. База данных и миграции` | `csharp-developer`, `dotnet-core-expert`, `test-automator` | Схема БД, миграции, индексы, ограничения, проверки регрессий |
| `Этап 2. Авторизация и первый вход` | `dotnet-core-expert`, `react-specialist`, `test-automator` | Cookie auth, CSRF, экран входа и смены пароля, проверка сценариев входа |
| `Этап 3. Роли и проверка прав` | `dotnet-core-expert`, `csharp-developer`, `test-automator` | Политики доступа, backend enforcement, тесты матрицы прав |
| `Этап 4. Управление пользователями` | `dotnet-core-expert`, `react-specialist`, `test-automator` | CRUD пользователей, ролевые ограничения, UI форм и списков |
| `Этап 5. Управление группами` | `dotnet-core-expert`, `react-specialist`, `test-automator` | API групп, назначение тренеров, интерфейс списков и форм |
| `Этап 6a. CRUD клиентов, контакты и группы` | `dotnet-core-expert`, `react-specialist`, `test-automator` | Карточка клиента, валидации, статус, контакты, привязка к группам |
| `Этап 6b. Абонементы и версионирование` | `csharp-developer`, `dotnet-core-expert`, `react-specialist`, `test-automator` | Самая чувствительная бизнес-логика по `ClientMembership` и оплатам |
| `Этап 6c. Фотографии клиентов` | `csharp-developer`, `dotnet-core-expert`, `docker-expert`, `react-specialist` | Загрузка файлов, storage path, volume, права доступа, UI загрузки |
| `Этап 6d. Поиск и фильтрация клиентов` | `react-specialist`, `dotnet-core-expert`, `test-automator` | Фильтры, списки, query params, производительность и UX |
| `Этап 7. Отметка посещений` | `dotnet-core-expert`, `react-specialist`, `test-automator` | Ключевой рабочий сценарий тренера и проверка ограничений по группам |
| `Этап 8. История посещений и ролевые ограничения карточки` | `dotnet-core-expert`, `react-specialist`, `test-automator` | Разные представления данных для ролей и история посещений |
| `Этап 9. Главная страница` | `react-specialist`, `dotnet-core-expert`, `ui-designer` | Информационная архитектура экрана, списки предупреждений и ролевой доступ |
| `Этап 10. Журнал действий` | `csharp-developer`, `dotnet-core-expert`, `test-automator` | Append-only аудит, структура событий, проверки полноты и безопасности |
| `Этап 11. Адаптивный интерфейс и UX-доработки` | `ui-designer`, `react-specialist`, `test-automator` | Адаптивность, порядок фокуса, keyboard flow, финальная полировка |
| `Этап 12. Тестирование` | `test-automator` + профильный агент по изменяемому слою | Выбор второго агента зависит от того, что именно тестируется |
| `Этап 13. Docker и подготовка к развертыванию` | `docker-expert`, `dotnet-core-expert`, `react-specialist` | Финальная сборка, контейнеры, env config, health checks, startup behavior |

## Быстрые правила выбора между `csharp-developer` и `dotnet-core-expert`

- Выбирать `csharp-developer`, если задача в первую очередь про доменную модель, прикладной сервис, вычисления, версионирование сущностей, запись в БД или безопасное изменение контракта между слоями.
- Выбирать `dotnet-core-expert`, если задача в первую очередь про API, middleware, cookie auth, CSRF, пайплайн запросов, конфигурацию приложения, DI и политики доступа.
- Если задача реально делится на две независимые части, backend business logic передавать `csharp-developer`, а HTTP/API boundary передавать `dotnet-core-expert`.
