# AGENT_ROUTING.md

## Назначение

Этот документ содержит детальную маршрутизацию по профильным агентам. По умолчанию для задачи подбирается подходящий агент, а если подходящего профиля нет, задача выполняется локально.

Использовать после чтения:

1. `MVP-ТЗ.md`
2. `../backlog/done/IMPLEMENTATION_PLAN.md`
3. `../AGENTS.md`

## Выбор агента по типу задачи

| Тип задачи | Основной агент | Когда использовать |
|---|---|---|
| Доменные сущности, сервисы, DTO, транзакции, persistence, `ASP.NET Core` API, auth, DI и конфигурация | `dotnet-backend-specialist` | Когда задача затрагивает backend, доменную логику, хранение данных, API boundary, авторизацию или политики доступа |
| Анализ пользовательского сценария, препятствий, лишних действий и информационной архитектуры | `ux-researcher` | Перед новым экраном или существенным изменением workflow; результатом должен быть UX-контракт для `ui-designer` |
| Компоненты `React`, формы, состояние, эффекты, маршруты, доступность, поведение экранов | `react-specialist` | Когда задача в основном про клиентский интерфейс, state flow и user interaction |
| Решения по UI/UX, mobile-first иерархии, состояниям, фокусу и keyboard navigation | `ui-designer` | После UX-контракта, когда нужна implement-ready спецификация до начала верстки или переработки экрана |
| Автотесты, regression coverage, test harness, фикстуры, стабилизация CI тестов | `test-automator` | Когда нужно покрыть риск тестами или исправить инфраструктуру тестирования |
| `Dockerfile`, `docker-compose`, контейнерный runtime, healthcheck, image hardening, startup/shutdown | `docker-expert` | Когда задача про сборку, контейнеризацию, локальный запуск и эксплуатационное поведение |

## Маршрутизация UI-задач

| Сценарий | Последовательность агентов | Skills |
|---|---|---|
| Новый экран или существенная переработка workflow | `ux-researcher` → `ui-designer` → `react-specialist` → `test-automator` | Обязательно `crm-mobile-first-ui`; `design-first-ui-prompting` только для внешнего UI-generation prompt или статической визуальной концепции |
| Анализ проблем существующего интерфейса без реализации | `ux-researcher` → `ui-designer` | `crm-mobile-first-ui` |
| Локальная визуальная или interaction-правка | `ui-designer` → `react-specialist` | `crm-mobile-first-ui`; `design-first-ui-prompting` только если результатом является генерируемый визуальный артефакт |
| Реализация уже утвержденной UI-спецификации | `react-specialist` → `test-automator` | `crm-mobile-first-ui` |
| Mobile UX-регрессия | `test-automator` | acceptance-раздел `crm-mobile-first-ui` |

Правила:
- mobile-first применяется на каждом frontend-этапе, а не только на финальном этапе адаптивности;
- `ux-researcher` определяет задачу и препятствия, но не подменяет `ui-designer`;
- `ui-designer` не меняет бизнес-правила backend;
- `react-specialist` не меняет утвержденный workflow молча;
- `test-automator` проверяет завершение операции, а не только наличие элементов.
- 390 x 844 используется как узкий stress baseline, а не как замена target-device acceptance;
- обязательные целевые размеры: iPhone Air 420 x 912 и iPhone 17 Pro Max 440 x 956;
- для затронутых mobile workflows нужен WebKit mobile run, а 912 x 420 и 956 x 440 используются для compact-height smoke;
- safe area, Safari chrome и software keyboard входят в UI handoff; непроверенные Simulator и physical-device сценарии указываются явно.

## Выбор агента по этапам плана

| Этап плана | Рекомендуемые агенты | Примечание |
|---|---|---|
| `Этап 0. Подготовка проекта` | `docker-expert`, `dotnet-backend-specialist`, `react-specialist` | Каркас репозитория, `docker-compose`, health checks, стартовая страница |
| `Этап 1. База данных и миграции` | `dotnet-backend-specialist`, `test-automator` | Схема БД, миграции, индексы, ограничения, проверки регрессий |
| `Этап 2. Авторизация и первый вход` | `ux-researcher`, `ui-designer`, `dotnet-backend-specialist`, `react-specialist`, `test-automator` | Cookie auth, CSRF, мобильный сценарий входа и смены пароля |
| `Этап 3. Роли и проверка прав` | `dotnet-backend-specialist`, `test-automator` | Политики доступа, backend enforcement, тесты матрицы прав |
| `Этап 4. Управление пользователями` | `ux-researcher`, `ui-designer`, `dotnet-backend-specialist`, `react-specialist`, `test-automator` | CRUD пользователей, ролевые ограничения, mobile-first UI форм и списков |
| `Этап 5. Управление группами` | `ux-researcher`, `ui-designer`, `dotnet-backend-specialist`, `react-specialist`, `test-automator` | API групп, назначение тренеров, mobile-first интерфейс списков и форм |
| `Этап 6a. CRUD клиентов, контакты и группы` | `ux-researcher`, `ui-designer`, `dotnet-backend-specialist`, `react-specialist`, `test-automator` | Карточка клиента, валидации, контакты, привязка к группам |
| `Этап 6b. Абонементы и версионирование` | `ux-researcher`, `ui-designer`, `dotnet-backend-specialist`, `react-specialist`, `test-automator` | Чувствительная бизнес-логика по `ClientMembership`, оплатам и мобильным операциям |
| `Этап 6c. Фотографии клиентов` | `ui-designer`, `dotnet-backend-specialist`, `docker-expert`, `react-specialist`, `test-automator` | Загрузка файлов, storage path, права доступа и мобильный UI загрузки |
| `Этап 6d. Поиск и фильтрация клиентов` | `ux-researcher`, `ui-designer`, `react-specialist`, `dotnet-backend-specialist`, `test-automator` | Компактные фильтры, поиск, query params, производительность и UX |
| `Этап 7. Отметка посещений` | `ux-researcher`, `ui-designer`, `dotnet-backend-specialist`, `react-specialist`, `test-automator` | Ключевой мобильный сценарий тренера и ограничения по группам |
| `Этап 8. История посещений и ролевые ограничения карточки` | `ux-researcher`, `ui-designer`, `dotnet-backend-specialist`, `react-specialist`, `test-automator` | Разные представления данных для ролей и история посещений |
| `Этап 9. Главная страница` | `ux-researcher`, `ui-designer`, `react-specialist`, `dotnet-backend-specialist`, `test-automator` | Информационная архитектура, предупреждения и ролевой доступ |
| `Этап 10. Журнал действий` | `dotnet-backend-specialist`, `test-automator` | Append-only аудит, структура событий, проверки полноты и безопасности |
| `Этап 11. Сквозной аудит адаптивности и UX` | `ux-researcher`, `ui-designer`, `react-specialist`, `test-automator` | Итоговый аудит; mobile-first уже должен применяться на предыдущих этапах |
| `Этап 12. Тестирование` | `test-automator` + профильный агент по изменяемому слою | Выбор второго агента зависит от того, что именно тестируется |
| `Этап 13. Docker и подготовка к развертыванию` | `docker-expert`, `dotnet-backend-specialist`, `react-specialist` | Финальная сборка, контейнеры, env config, health checks, startup behavior |

## Граница ответственности backend-агента

- `dotnet-backend-specialist` отвечает и за доменную модель, и за `ASP.NET Core` boundary.
- Если задача затрагивает UI и backend, разделять UX/React и backend-подзадачи по агентам.
- Frontend не должен самостоятельно определять роли, права, абонементы, посещения или правила валидации.
