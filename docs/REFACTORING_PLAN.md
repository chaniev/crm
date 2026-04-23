# План рефакторинга Gym CRM

Дата: 2026-04-23

## 1. Цель

План фиксирует технические улучшения, найденные при разборе `UserEndpoints.cs`, `UserManagement.tsx`, `HomeDashboard.tsx`, `frontend/src/lib/api.ts` и соседних backend endpoint'ов.

Цель рефакторинга: уменьшить дублирование, отделить бизнес-смысл от HTTP/UI-обвязки, централизовать пользовательские тексты и константы, а также подготовить код к более безопасному росту без изменения текущего пользовательского поведения.

## 2. Общие правила выполнения

- Двигаться небольшими PR/коммитами, каждый шаг должен оставлять приложение в рабочем состоянии.
- Не совмещать механический перенос файлов с изменением бизнес-логики.
- При изменении backend-контракта синхронно обновлять `frontend/src/lib/api.ts` и экран-потребитель.
- Для новых и извлекаемых сущностей применять принцип `один файл — один верхнеуровневый тип/сущность`.
- После backend-изменений запускать `dotnet test backend/GymCrm.slnx`.
- После frontend-изменений запускать `cd frontend && npm run lint && npm run build`.
- Если меняется поведение сквозного сценария, добавлять или обновлять точечные backend/e2e регрессии.

## 3. Этап 0. Подготовка

1. Зафиксировать baseline тестов:
   - `dotnet test backend/GymCrm.slnx`
   - `cd frontend && npm run lint`
   - `cd frontend && npm run build`
2. Не начинать крупное разбиение файлов, пока есть падающие проверки, не связанные с рефакторингом.
3. Обновлять этот план после каждого завершенного этапа.

## 4. Этап 1. Правила структуры файлов

1. Применить правило `один файл — один верхнеуровневый тип/сущность`.
2. Backend:
   - выносить `class`, `record`, `interface`, `enum`, validators, request/response DTO и audit state DTO в отдельные файлы;
   - сохранять границы слоев `Api`, `Application`, `Domain`, `Infrastructure`;
   - не переносить файлы из `src/GymCrm.Api/Auth/` без отдельной задачи на реорганизацию области.
3. Frontend:
   - выносить крупные route-level helper-компоненты, hooks, types, constants и mappers в соседние файлы фичи;
   - повторяемые UI-паттерны переносить в `src/features/shared/ux.tsx` только при реальном переиспользовании;
   - при разделении `api.ts` временно оставлять re-export, чтобы не ломать существующие импорты.
4. Правило уже добавлено в `backend/AGENTS.md` и `frontend/AGENTS.md`.

## 5. Этап 2. Пользовательские тексты и ресурсы

1. Вынести захардкоженные тексты из backend:
   - validation messages;
   - `ProblemDetails` title/detail;
   - audit descriptions;
   - повторяемые русские labels/status messages в API responses, если они появятся.
2. Целевой backend-формат:
   - `Resources/*.resx` для локализуемых строк;
   - тонкие helper-классы для доступа к ресурсам, чтобы endpoint'ы не знали о ключах напрямую;
   - отдельный ресурсный файл для audit-событий.
3. Вынести захардкоженные тексты из frontend:
   - labels, placeholders, empty/error states, notifications;
   - role labels, membership labels, status labels;
   - заголовки экранов и кнопок.
4. Целевой frontend-формат:
   - `src/lib/resources.ts` или `src/lib/i18n/resources.ts` как первый простой словарь;
   - при росте словаря разделить по доменам: `users`, `clients`, `groups`, `attendance`, `audit`, `common`.
5. Переносить тексты по фичам, начиная с users и audit, чтобы не делать один большой рискованный diff.

## 6. Этап 3. Журнал действий на русском языке

1. Централизовать типы audit-событий:
   - `UserCreated`, `UserUpdated`, `Login`, `Logout`, `PasswordChanged`;
   - client/group/attendance/membership события.
2. Вынести audit action keys и audit descriptions в ресурсный слой.
3. Перевести пользовательские описания событий на русский язык.
4. Сохранить стабильные machine-readable action codes, если они используются для фильтров или тестов.
5. Обновить `AuditLogApiTests` и связанные frontend labels, чтобы UI показывал русские названия действий, но фильтрация не зависела от текста описания.

## 7. Этап 4. Магические константы

1. Backend:
   - вынести route fragments, action type strings, entity type strings, paging defaults, max limits, date windows, header names и repeated policy names;
   - использовать отдельные `*Constants` файлы по области: auth, users, clients, groups, audit, attendance;
   - не смешивать бизнес-константы с UI/resource strings.
2. Frontend:
   - вынести числовые thresholds и page sizes;
   - централизовать route labels, role labels, status labels, membership labels;
   - разделить API endpoint constants по доменам при разбиении `api.ts`.
3. Проверить, что вынесенные константы не ухудшают читаемость: константа нужна там, где значение повторяется, имеет бизнес-смысл или участвует в контракте.

## 8. Этап 5. Backend auth/users refactoring

1. Вынести повторяемую CSRF-проверку из endpoint'ов:
   - сейчас `ValidateAntiforgeryAsync` повторяется в `AuthEndpoints`, `UserEndpoints`, `ClientEndpoints`, `GroupEndpoints`, `AttendanceEndpoints`, `ClientPhotoEndpoints`;
   - целевой вариант: общий helper/service в `GymCrm.Api/Auth`.
2. Вынести создание и синхронизацию principal/session:
   - `CreatePrincipal`;
   - sign-in/sign-out после self-update;
   - обновление `HttpContext.Items` и `HttpContext.User`.
3. Разгрузить `UserEndpoints.cs`:
   - request/response records;
   - validation;
   - audit state serialization;
   - mutation helpers.
4. Сохранить HTTP boundary в `Api`, не уводить endpoint'ы в `Application` без отдельного архитектурного решения.

## 9. Этап 6. Frontend users refactoring

1. Исправить маппинг backend validation errors:
   - сейчас `normalizeFieldPath('fullName')` в `frontend/src/lib/api.ts` всегда превращает поле в `lastName`;
   - для users это должно оставаться `fullName`;
   - целевой вариант: `applyFieldErrors(errors, aliases?)`.
2. Сделать `createUser` и `updateUser` типизированными:
   - backend возвращает `UserResponse`;
   - frontend сейчас ожидает `void`;
   - после изменения использовать серверный ответ вместо ручного локального патча.
3. Разделить `UserManagement.tsx`:
   - list screen;
   - create screen;
   - edit screen;
   - shared user form fields;
   - constants/resources;
   - payload mappers.

## 10. Этап 7. Shared frontend UI patterns

1. Вынести повторяемые `MetricCard` и management form hero из users/groups/clients.
2. Проверить, что shared-компонент не становится слишком абстрактным.
3. Оставить feature-specific layout рядом с фичей, если он используется только один раз.

## 11. Этап 8. Разделение `frontend/src/lib/api.ts`

1. Разделить файл без одновременного изменения контрактов:
   - transport/request;
   - common errors;
   - endpoint constants;
   - users API;
   - clients API;
   - groups API;
   - attendance API;
   - audit API;
   - mappers/read helpers.
2. Оставить `src/lib/api.ts` как публичный re-export на переходный период.
3. После каждого среза запускать frontend lint/build.

## 12. Этап 9. HomeDashboard и expiring memberships

1. Перевести `HomeDashboard` на уже существующий `getExpiringClientMemberships`.
2. Убрать дублирование расчета истекающих абонементов на клиенте.
3. Backend endpoint `GET /clients/expiring-memberships` оставить единым источником правды для окна "менее 10 дней".
4. Константу окна истечения вынести из кода.

## 13. Этап 10. Производительность client filters

1. Убрать загрузку всех клиентов в память при фильтрах по срокам абонемента.
2. Перенести максимум фильтрации в EF query.
3. Сохранить текущую семантику `currentMembership` и versioned memberships.
4. Добавить regression test на фильтр истечения абонемента и paging.

## 14. Рекомендуемый порядок первых задач

1. `applyFieldErrors(errors, aliases?)` и проверка users validation.
2. Общий backend helper для CSRF.
3. Общий backend helper/service для principal/session sync.
4. Типизированные `createUser/updateUser` на frontend.
5. Resource-файлы для users/audit текстов.
6. Русские audit descriptions.
7. Вынос констант users/audit.
8. Разделение `UserManagement.tsx`.
9. Разделение `UserEndpoints.cs`.
10. Постепенное разделение `frontend/src/lib/api.ts`.
