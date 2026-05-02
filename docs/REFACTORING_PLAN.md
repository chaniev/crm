# План рефакторинга Gym CRM

Дата создания: 2026-04-23
Последнее обновление: 2026-05-02

## Статус реализации

Обновлено после сверки с текущей кодовой базой 2026-05-02.

Выполнено:

- baseline и финальные проверки зафиксированы;
- общий backend CSRF-helper подключен к auth/users/clients/groups/attendance/client photo endpoint'ам;
- создание principal, sign-in/sign-out и self-update session sync вынесены в общий auth helper;
- `UserEndpoints.cs` разгружен: request/response DTO, validation, audit state serialization, resources и action/entity constants вынесены в соседние файлы;
- backend users/auth audit descriptions переведены на русский, action/entity codes сохранены стабильными;
- users/auth resources заведены через `Auth/Resources/*.resx` и тонкие helper-классы;
- `createUser`/`updateUser` на frontend возвращают типизированный user response;
- `applyFieldErrors(errors, aliases?)` исправлен: users сохраняют `fullName`, clients явно алиасят `fullName -> lastName`;
- `UserManagement.tsx` разделен на list/create/edit/shared form/constants/mappers;
- первый frontend resource dictionary добавлен для users/common/audit текстов;
- `HomeDashboard` переведен на `GET /clients/expiring-memberships`;
- фильтр `membershipExpiresFrom/membershipExpiresTo` и public endpoint истекающих абонементов перенесены на EF query boundary;
- повторяемый frontend `MetricCard` вынесен в `src/features/shared/ux.tsx`;
- client/group/attendance/membership audit action/entity constants централизованы;
- client/group/attendance/membership audit descriptions переведены на русский через `Auth/Resources/*.resx`;
- client/group/attendance/client-photo validation и user-facing API messages вынесены в resource helpers;
- `frontend/src/lib/api.ts` разделен на доменные модули `src/lib/api/*`, а публичный `src/lib/api.ts` оставлен re-export'ом;
- добавлены точечные regression tests для self-update session sync, русских audit descriptions и paging после membership-expiration filter;
- backend tests расширены assertions на стабильные audit action/entity codes и русские descriptions для clients/groups/attendance.

Частично выполнено и требует уточнения:

- backend resources уже заведены, но hardcoded тексты остаются в `AuthEndpoints`, `AuditLogEndpoints`, `AccessEndpoints`, `AuthConstants`, startup-level коде и `BotInternalEndpoints`;
- audit resources сейчас смешаны: `auth/clients` используют отдельные audit helpers, а `users/groups/attendance` держат audit descriptions рядом с обычными domain resources;
- `frontend/src/lib/api.ts` разделен, но `src/lib/api/types.ts`, `mappers.ts`, `read-helpers.ts` и `endpoints.ts` остаются крупными shared-модулями;
- frontend resource dictionary есть, но `AuditLogScreen`, `HomeDashboard`, clients/groups/attendance экраны используют его неполно;
- `MetricCard` вынесен, но page header/hero паттерны еще дублируются в users/groups/clients/audit;
- `ClientEndpoints.cs`, `ClientManagement.tsx`, `GroupManagement.tsx` и `AuditLogScreen.tsx` остаются главными монолитными участками.

Новые замечания после сверки 2026-05-02:

- семантика `currentMembership` повторяется в public API, application/infrastructure сервисах и internal bot API; перед механическим разносом файлов нужно закрепить единый read/write invariant;
- public `GET /clients/expiring-memberships`, frontend текст "10 дней" и internal bot список истекающих абонементов расходятся по источнику и границам окна;
- `bot/` вне скоупа только пока не меняются `/internal/bot/*`, bot DTO, bot error `title/code` и membership-list semantics;
- `AccessEndpoints` возвращает `GrantedBy` как display/pseudo-policy values; план должен явно решить, это contract field или user-facing display text;
- дальнейший refactoring должен начинаться с незакрытых зон, а не с уже выполненных users/auth/API-split задач.

## 1. Цель

План фиксирует технические улучшения, найденные при разборе `UserEndpoints.cs`, `UserManagement.tsx`, `HomeDashboard.tsx`, `frontend/src/lib/api.ts` и соседних backend endpoint'ов.

Цель рефакторинга: уменьшить дублирование, отделить бизнес-смысл от HTTP/UI-обвязки, централизовать пользовательские тексты и константы, а также подготовить код к более безопасному росту без изменения текущего пользовательского поведения.

## 2. Общие правила выполнения

- Двигаться небольшими PR/коммитами, каждый шаг должен оставлять приложение в рабочем состоянии.
- Не совмещать механический перенос файлов с изменением бизнес-логики.
- При изменении backend-контракта синхронно обновлять `frontend/src/lib/api.ts` и экран-потребитель.
- Для новых и извлекаемых сущностей применять принцип `один файл — один верхнеуровневый тип/сущность`.
- Не начинать механический split кода, если участок содержит повторенную бизнес-семантику без зафиксированного invariant'а.
- При изменении `currentMembership`, membership window, audit action/entity codes, `ProblemDetails` title/code или internal Bot API проверять все потребители: public frontend, backend tests и `bot/`.
- После backend-изменений запускать `dotnet test backend/GymCrm.slnx`.
- После frontend-изменений запускать `cd frontend && npm run lint && npm run build`.
- После изменений в `bot/` или `/internal/bot/*` запускать `cd bot && ruff check .`, `cd bot && pytest`; если меняется runtime/Dockerfile/env — `docker compose build bot`.
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

1. Backend: закрыть оставшиеся hardcoded user-facing тексты по конкретным областям:
   - `AuthEndpoints`: login/change-password validation и problem details;
   - `AuthConstants` и `AuthenticatedUserMiddleware`: forced password/CSRF/session messages;
   - `AuditLogEndpoints`: validation messages, paging/date filter errors;
   - `AccessEndpoints`: capability `Detail` и display-only тексты;
   - startup-level код: `ApiHostingConstants`, `BootstrapUserStartupExtensions`, health/service metadata, если текст виден оператору или клиенту;
   - `BotInternalEndpoints` и `GymCrm.Infrastructure/Bot` только если internal Bot API включается в текущий срез.
2. Целевой backend-формат:
   - `Resources/*.resx` для локализуемых строк;
   - тонкие helper-классы для доступа к ресурсам, чтобы endpoint'ы не знали о ключах напрямую;
   - audit descriptions допускается держать рядом с domain resources, если это уже локальный паттерн области;
   - отдельные `*AuditResources` заводить только в новом normalization-срезе, чтобы не смешивать механический перенос с изменением ресурсов.
3. Frontend: расширить adoption `src/lib/resources.ts`:
   - перенести audit action/entity/source labels из `AuditLogScreen`;
   - перенести membership/status labels и empty/error states из `HomeDashboard`, clients/groups/attendance экранов;
   - убрать дублирование `UserUpdated`/audit labels между resources и экраном.
4. При росте словаря разделить его по доменам: `users`, `clients`, `groups`, `attendance`, `audit`, `home`, `common`.
5. Не переносить в resources machine-readable codes, route paths и API enum values; это contract constants, а не пользовательские тексты.

## 6. Этап 3. Журнал действий и стабильные audit-контракты

1. Уже выполнено:
   - action/entity constants централизованы для auth/users/clients/groups/attendance/membership;
   - русские audit descriptions заведены для основных web-сценариев;
   - backend tests проверяют стабильные action/entity codes и русские descriptions.
2. Оставшиеся задачи:
   - перенести frontend audit label dictionaries из `AuditLogScreen` в `resources.audit`;
   - сохранить фильтрацию UI по stable `actionType`/`entityType`, а не по русскому description;
   - описать отдельный статус bot audit actions: `BotAttendanceSaved`, `BotMembershipPaymentMarked`, `BotAccessDenied`;
   - если bot audit descriptions ресурсируются, добавить это как отдельный срез с `InternalBotApiTests`.
3. Не переименовывать action/entity codes без миграционного решения и обновления tests/frontend filters.

## 7. Этап 4. Магические константы и contract tokens

1. Backend:
   - уже вынесены auth/client/audit constants для части областей;
   - следующим срезом вынести paging/date/filter constants из `GroupEndpoints` и `AuditLogEndpoints`;
   - явно описать `AccessEndpoints.Capability/GrantedBy`: либо привязать `GrantedBy` к реальным `GymCrmAuthorizationPolicies`, либо объявить display-only полем и вынести display texts в resources;
   - не полагаться на `Enum.ToString()` как на неявный публичный контракт без теста и documented constant;
   - route fragments, header names, policy names, paging defaults, max limits и date windows держать в `*Constants` рядом с областью.
2. Frontend:
   - централизовать page sizes, route labels, role labels, status labels, membership labels;
   - оставить `src/lib/api/endpoints.ts` как contract layer, но при росте разделить endpoint/query constants по доменам;
   - не смешивать API constants с `resources`.
3. Константа нужна там, где значение повторяется, имеет бизнес-смысл или участвует в контракте. Одноразовые локальные значения можно оставлять рядом с кодом.

## 8. Этап 5. Backend auth/users refactoring

1. Считать основной auth/users refactoring выполненным:
   - CSRF helper вынесен;
   - principal/session sync вынесен;
   - `UserEndpoints.cs` разгружен;
   - `create/update user` возвращают typed response для frontend.
2. Оставшиеся проверки и улучшения:
   - добавить negative CSRF regressions не только для `/auth/change-password`, но и для `/users`, `/clients`, `/groups`, `/attendance/groups/{id}`, `/clients/{id}/photo`;
   - добавить users validation regressions на `fullName`, `login`, `password`, `role`, запрет создания/назначения `HeadCoach`, partial messenger identity и слишком длинный `messengerPlatformUserId`;
   - зафиксировать, что backend users validation возвращает `errors.fullName`, а не `errors.lastName`;
   - не переносить endpoint'ы из `GymCrm.Api/Auth` в другие папки без отдельной задачи на реорганизацию области.

## 9. Этап 6. Frontend users refactoring

1. Считать основной users frontend refactoring выполненным:
   - `applyFieldErrors(errors, aliases?)` реализован;
   - users сохраняют `fullName`, clients явно алиасят `fullName -> lastName`;
   - `createUser`/`updateUser` возвращают `UserDetails`;
   - `UserManagement.tsx` стал barrel export'ом, экраны и form pieces разделены.
2. Оставшиеся проверки:
   - e2e на backend `errors.fullName` под полем `ФИО` в users;
   - e2e на сохранение client alias behavior `fullName -> lastName`;
   - e2e на self-session sync после редактирования текущего пользователя.

## 10. Этап 7. Shared frontend UI patterns

1. Уже выполнено:
   - повторяемый `MetricCard` вынесен в `src/features/shared/ux.tsx`.
2. Оставшиеся задачи:
   - унифицировать page header/hero pattern для users/groups/clients/audit без вложенных card-in-card layout;
   - не делать слишком общий компонент, если различия экранов несут бизнес-смысл;
   - следующим frontend hotspot считать `ClientManagement.tsx`, затем `AuditLogScreen.tsx` и `GroupManagement.tsx`.

## 11. Этап 8. Разделение frontend API layer

1. Уже выполнено:
   - `frontend/src/lib/api.ts` оставлен публичным barrel re-export'ом;
   - доменные API-модули вынесены в `src/lib/api/*`.
2. Оставшиеся задачи:
   - при дальнейшем росте разделить `types.ts` по доменам;
   - отделить shared mappers/read helpers от domain-specific mappers;
   - сохранить backward-compatible exports из `src/lib/api.ts` до отдельного migration-среза;
   - после каждого среза запускать `cd frontend && npm run lint && npm run build`;
   - для крупных переносов добавить smoke e2e по основным экранам, чтобы barrel export не сломал runtime imports.

## 12. Этап 9. HomeDashboard, expiring memberships и bot scope

1. Уже выполнено:
   - `HomeDashboard` получает список через `getExpiringClientMemberships`;
   - локальная фильтрация истекающих абонементов на клиенте убрана;
   - public endpoint считает список на backend.
2. Оставшиеся задачи:
   - устранить дублирование числа `10` между backend `ClientApiConstants`, frontend `resources.common.membership.expiringWindowDays` и internal bot service;
   - решить границу окна единообразно: `< today + N` или `<= today + N`, и зафиксировать это тестом;
   - либо возвращать window metadata из backend, либо убрать число из UI-текста, чтобы frontend не становился вторым источником правды;
   - если меняется internal bot behavior, обновить `InternalBotApiTests`, `bot` models/client expectations и выполнить bot-проверки.
3. `bot/` вне скоупа этого плана только пока не меняются:
   - `/internal/bot/*`;
   - `GymCrm.Application/Bot/*` DTO;
   - bot error `title/code`;
   - membership-list semantics.

## 13. Этап 10. Производительность client filters и currentMembership

1. Уже выполнено:
   - `membershipExpiresFrom/membershipExpiresTo` перенесены в EF query;
   - regression test на фильтр истечения абонемента и paging добавлен.
2. Оставшиеся задачи перед структурным split:
   - закрепить единый invariant `currentMembership = membership.ValidTo == null`;
   - описать tie-breaker для read-моделей, если в projection используется `OrderByDescending(ValidFrom).ThenByDescending(CreatedAt)`, несмотря на unique filtered index;
   - убрать расхождения между inline EF subqueries, `GetCurrentMembership` в API и `GetCurrentMembership` в bot;
   - не менять `MembershipType`, `ClientStatus`, `ClientMembershipState` string values без contract tests и frontend update;
   - уменьшить дублирование list projection/hydration в `ClientEndpoints` перед дальнейшим DTO split.

## 14. Этап 11. Backend structural split после фиксации семантики

1. Приоритетные backend hotspots:
   - `ClientEndpoints.cs`;
   - `GroupEndpoints.cs`;
   - `AttendanceEndpoints.cs`;
   - `AuditLogEndpoints.cs`;
   - `BotInternalEndpoints.cs`, только если bot включен в скоуп.
2. Разделять не только request/response DTO, но и:
   - validators;
   - audit state DTO;
   - query parameter/paging models;
   - projection/read model helpers;
   - application contracts, если один файл держит interface, commands, result DTO и enums.
3. Не превращать split в косметический перенос: если файл содержит read-side business logic, сначала выделить и протестировать query boundary.

## 15. Этап 12. Frontend feature hotspots

1. Приоритетные frontend hotspots после users:
   - `ClientManagement.tsx`;
   - `AuditLogScreen.tsx`;
   - `GroupManagement.tsx`;
   - `AttendanceScreen.tsx`.
2. Для `ClientManagement.tsx` выделять безопасными срезами:
   - list state/hooks;
   - filters/query params;
   - membership actions/forms;
   - photo upload state;
   - local dictionaries/constants;
   - mappers/payload builders.
3. Для `AuditLogScreen.tsx`:
   - вынести resource labels;
   - отделить filters state от rendering;
   - добавить e2e на stable action/entity filter values.
4. Для shared UI:
   - переиспользовать только реальные повторяющиеся паттерны;
   - feature-specific layout оставлять рядом с фичей, если он используется один раз.

## 16. Обновленный рекомендуемый порядок следующих задач

1. Backend resource cleanup: `AuthEndpoints`, `AuthConstants`, `AuthenticatedUserMiddleware`, `AccessEndpoints`, `AuditLogEndpoints`, startup-level тексты.
2. Решить модель audit resources: оставить domain co-location или отдельным normalization-срезом сделать `UserAuditResources`, `GroupAuditResources`, `AttendanceAuditResources`.
3. Вынести constants для `groups`, `audit-log`, `access` и явно определить контракт `Capability/GrantedBy`.
4. Синхронизировать expiring memberships window между public API, frontend текстом и internal bot behavior.
5. Зафиксировать `currentMembership` invariant и убрать дублирование read-семантики в public API/bot/infrastructure.
6. Добавить недостающие backend regressions: CSRF negative cases, users validation keys, membership window boundary.
7. Добавить недостающие frontend e2e: users `fullName` errors, clients alias behavior, audit stable filters, client filters/paging.
8. Перенести audit/home/client/group labels в frontend resources.
9. Декомпозировать `ClientManagement.tsx` безопасными feature-срезами.
10. После фиксации семантики продолжить split `ClientEndpoints.cs`, затем `GroupEndpoints.cs`, `AttendanceEndpoints.cs`, `AuditLogEndpoints.cs`.
