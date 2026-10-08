# Implementation Plan: TASK-186 Доступ к журналу только для глобальных ролей

## Metadata
- source_task: /backlog/implementation/TASK-186-audit-access-head-coach-super-admin.md
- requirements: REQ-AUD-001 (changes), REQ-USR-001 (constrains), REQ-NFR-003 (constrains)
- branch: codex/TASK-186-audit-access-head-coach-super-admin
- readiness: yes
- product_decisions: accepted
- technical_decisions: none — сохраняются существующие authorization policy, cookie/session DTO, маршрутизация и хранилище аудита; локальная обработка отказов не создаёт новой архитектурной границы
- architecture_decisions: none — локальное сужение существующей capability без нового транспорта, схемы данных, security boundary или изменения хранения
- open_questions: none
- dependencies: none — TASK-082, TASK-099 и TASK-105 используются как исторический контекст, не переоткрываются
- risk: high — вспомогательные данные и ранее загруженные записи могут остаться доступны при неполном запрете; общая role policy обслуживает другие права

## Goal
HeadCoach и SuperAdministrator продолжают читать журнал и фильтры;
Administrator и Coach не получают эти данные через API и UI. Запись действий
всех ролей и существующая история сохраняются.

## Decisions and contracts
- Единственный источник разрешения — `UserRoleAuthorizationPolicy`.
  У Administrator меняется только `CanViewAuditLog`; остальные permissions,
  attendance scope и landing screen сохраняются. `AccessScopeService` убирает
  `Audit` из `AllowedSections` Administrator.
- Защищаемые GET: `/audit-logs`, `/audit-logs/options`, capability probe
  `/access/audit-log`. Browser proxy добавляет `/api`, backend routes этого
  префикса не содержат. Общая policy остаётся на группе audit endpoints.
- Авторизованные HeadCoach/SuperAdministrator получают `200`,
  Administrator/Coach — `403`, anonymous/invalidated cookie — `401`, без
  записей, счётчиков, имён авторов или вариантов фильтров. Существующий
  password-change-required `403` сохраняется. Новый ProblemDetails contract
  не вводится; клиент использует `ApiError.status`.
- Форма session DTO и экспортируемых TS-типов сохраняется. UI использует
  backend `permissions` и `allowedSections`, не сравнивает роли для вычисления
  доступа. Старая cookie не содержит permission snapshot: после обновления
  backend новая policy применяется на первом запросе без повторного входа.
- Изменение версии/активности сотрудника сохраняет существующую инвалидацию
  cookie через `AuthenticatedUserMiddleware`. Отдельной схемы live role
  updates или ослабления проверки `UpdatedAt` не добавлять.
- Открытая вкладка обнаруживает отзыв при следующем запросе журнала/options
  или обновлении session. Новый серверный отказ обрабатывается сразу после
  получения ответа; отдельные polling, focus/visibility-trigger или push для
  бездействующей вкладки не добавляются. Это решение пользователя от 08.10.2026.
- `401/403` любого запроса журнала — отказ в доступе, а не временный stale
  result: очистить записи, options, выбранные фильтры с чувствительными
  значениями и открытые детали до ожидания обновления сессии. Поздний ответ
  предыдущей загрузки не восстанавливает очищенные данные.
- После отказа обновить сессию через существующий callback shell. Сессия без
  Audit запускает существующий route-access-loss recovery; anonymous session
  возвращает существующий login flow. Пока refresh сессии не завершён или
  завершился ошибкой, ранее загруженные audit-данные недоступны. Повторный
  отказ не создаёт цикл refresh/retry; восстановление требует успешного
  подтверждения session access и новой загрузки данных.
- Обычные сетевые ошибки/`5xx` при сохранённом доступе продолжают использовать
  существующий same-query stale state. Первый неавторизационный сбой одного
  из параллельных запросов не должен скрывать последующий `401/403` другого.
- Bot API не публикует `PermissionSet` и не имеет audit-read routes; его
  `/internal/bot/audit/access-denied` остаётся операцией записи. Схема БД,
  аудитирующие mutation flows и retention не меняются. Миграция не нужна.
  Откат на старую backend policy вернёт доступ Administrator, поэтому такой
  откат требует отдельного решения о доступе, а не автоматического rollback.

## Decision evidence
- product: [REQ-AUD-001](/docs/requirements/06-аудит.md) — owner: пользователь, исходная запись от 05.10.2026; decision: чтение журнала и filter options только HeadCoach/SuperAdministrator, запрет через UI и API, сохранение записи действий всех ролей и истории.
- product: [Решение об открытой вкладке](/backlog/implementation/TASK-186-audit-access-head-coach-super-admin.md#product-decision-2026-10-08) — owner: пользователь, явный ответ в обсуждении 08.10.2026; decision: открытая вкладка обнаруживает отзыв доступа при следующем запросе; отдельная фоновая проверка не требуется.
- source: [Исходная запись](/backlog/processed/2026-10-05.md); детали сценария старой сессии — в [source task](/backlog/implementation/TASK-186-audit-access-head-coach-super-admin.md).
- review: [Security/authorization review](/backlog/logs/TASK-186-security-review-2026-10-08.md) — Codex, статическая проверка producer, frontend consumer и bot surface; runtime-подтверждения ещё нет.
- technical: существующие [cookie middleware](/backend/src/GymCrm.Api/Auth/AuthenticatedUserMiddleware.cs), [role policy](/backend/src/GymCrm.Application/Authorization/UserRoleAuthorizationPolicy.cs) и [route recovery](/frontend/src/App.tsx) — сохраняемые механизмы, не новое человеческое согласование.

## Scope
Включены backend policy/session, существующие UI access/recovery states и
consumer regression tests. Новые экраны, визуальный редизайн, bot-команды,
глобальная переработка auth/transport и deployment в scope не входят.

## UX contract
- Для разрешённых ролей сохраняются текущие четыре колонки, фильтры,
  пагинация, details modal, responsive layout и focus behavior.
- Для запрещённой session журнал отсутствует в desktop/mobile navigation и
  overflow. Прямой `/audit` показывает существующий restricted route с
  разрешённым recovery destination; audit API не вызывается.
- При обнаруженном отказе в открытом журнале модальные детали и выпадающие
  варианты с audit-данными закрываются; активные фильтры/строки очищаются.
  После свежей запрещённой session действуют существующие notification и
  replace-navigation shell. Back/forward не возвращает данные или циклы.
- Это локальная коррекция существующих restricted/recovery состояний.
  Новое визуальное направление не выбирается; перед/после реализации снять
  сравнимые rendered состояния и проверить их по существующему контракту.
  Если понадобится новый экран или существенно другой recovery flow,
  вернуть задачу к design planning до соответствующего production change.

## Implementation slices
1. **Backend restriction.** Сначала обновить role/session/API regression cases
   ниже и получить ожидаемый red; затем изменить одну capability и набор
   sections Administrator. Проверить policy probe, обе точки чтения, старую
   cookie и независимость audit writes от права чтения.
2. **UI access loss.** Сначала добавить tests для очистки данных и session
   recovery, включая гонки обоих запросов; затем передать существующий
   `onRefreshSession` в audit screen и локально разделить authorization denial
   и transient error. Обновить session fixtures и route/navigation assertions
   по backend contract; отзыв обнаруживается на следующем серверном запросе
   согласно принятому контракту.
3. **Consumer acceptance и интеграция.** Добавить browser regression flows и
   task verification contract, выполнить проверку существующего UI с новым
   access behavior. При завершении связать evidence с REQ-AUD-001, обновить
   состояние реализации требования и `docs/requirements/CHANGELOG.md`.

## Likely files and layers
- `backend/src/GymCrm.Application/Authorization/UserRoleAuthorizationPolicy.cs`
  и `backend/src/GymCrm.Infrastructure/Authorization/AccessScopeService.cs` —
  capability и session sections.
- `backend/tests/GymCrm.Tests/{UserRoleAuthorizationPolicyTests,AuthorizationFlowTests,AuditLogApiTests}.cs`
  — permissions, session/probe, чтение/отказы и сохранение audit writes.
- `frontend/src/features/audit/AuditLogScreen.tsx` и `.test.tsx` — sensitive
  state, authorization denial, request races и bounded session refresh.
- `frontend/src/app/RouteViewport.tsx`, `frontend/src/App.test.tsx` — передача
  существующего callback и shell integration; `App.tsx` только при необходимости
  локального исправления передачи session, без нового global auth framework.
- `frontend/src/lib/api/auth.test.ts`, `frontend/src/lib/appRoutes.test.ts` —
  mapping и согласованность navigation/direct URL. `auth.ts`, `types.ts`,
  `frontend/src/lib/api.ts` проверить; менять только если выявлен реальный
  consumer defect, публичная форма DTO/exports остаётся прежней.
- `frontend/e2e/route-access-feedback.spec.ts`,
  `frontend/e2e/iphone-target-devices.spec.ts` — browser scenarios; существующие
  Administrator fixtures корректировать адресно, без замены role checks на UI.

## Regression specification
### Automated tests to add or update
- Backend theory для всех четырёх ролей: permissions и login/session sections
  согласованы, audit policy probe и оба GET дают требуемую матрицу; остальные
  permissions Administrator и его branch/attendance scope не изменились.
- `AuditLogApiTests`: заменить разрешённый Administrator на SuperAdministrator
  в позитивном сценарии, сохранив проверку фильтрации и sanitized JSON. Добавить
  Administrator/Coach/anonymous отрицательные случаи для обоих GET, включая
  невалидные query params: отказ до обработки фильтров, никаких audit payloads.
- Cookie lifecycle: без повторного входа Administrator получает актуальную
  session без Audit и `403` на чтение; version mismatch/deactivation у ранее
  разрешённого пользователя дают `401` на обе точки чтения. Использовать
  реальный cookie client и поддержанный user update, не добавлять разрешённый
  production downgrade SuperAdministrator ради fixture.
- Audit write regression: Administrator выполняет разрешённую mutation в своём
  scope; HeadCoach читает её audit entry с actor/old/new. Ранее сохранённая
  запись остаётся доступна разрешённой роли, Administrator её не читает.
- Frontend auth mapping + routes: все четыре роли как backend fixtures;
  false capability или отсутствие Audit section запрещают navigation/direct
  URL, без самостоятельного вычисления матрицы по `role`.
- Audit component: после успешной загрузки `401/403` от list или options
  очищает rows/options/filter values/details; отдельные случаи для первой
  загрузки, открытого modal, обновившихся permission props, session refresh
  failure и запоздалого успешного ответа. Отдельно проверить `500` первого
  запроса перед `403` второго; обычный `500` без отказа сохраняет stale recovery.
- App/browser: старая Administrator session с Audit → list/options `403` →
  свежая session без Audit → однократное recovery и исчезновение навигации.
  `401` → anonymous session → login. Свежие Administrator/Coach direct URL
  не запускают audit запросов; HeadCoach/SuperAdministrator читают и открывают
  детали. После возврата Back запрещённые данные отсутствуют.
- Бездействующая открытая вкладка не запускает новые фоновые audit/session
  запросы ради проверки отзыва; после действия «Обновить» первый `401/403`
  сразу удаляет чувствительные данные до завершения session refresh.

### Expected red evidence
- Сейчас Administrator получает `200`, `CanViewAuditLog=true` и section Audit:
  новые отрицательные backend assertions должны упасть на этом поведении.
- Сейчас same-query catch в `AuditLogScreen` сохраняет snapshot независимо от
  HTTP status и не обновляет shell session: tests очистки и recovery должны
  упасть на retained rows/options/modal или отсутствии refresh.
- Уже реализованные Coach guard, `401` middleware, positive read и обычный
  stale recovery могут сразу быть green; искусственный red для них не нужен.

### Required validation
- Task contract при реализации добавляет `route-access-feedback.spec.ts` на
  `chromium` и `iphone-target-devices.spec.ts` на `iphone-air-webkit` и
  `iphone-17-pro-max-webkit`; target projects сейчас принимают только
  ограниченный набор specs, одного добавления нового desktop spec недостаточно.
- Проверить primary read/details, denial/recovery и transient failure; выполнить
  применимую mobile/desktop матрицу из
  [mobile acceptance](/.agents/skills/crm-mobile-first-ui/references/mobile-acceptance.md).
- Проверить существующие InternalBotApiTests для доступных attendance/menu
  операций и записи access-denied audit: shared policy/access-scope изменения
  не должны менять эти результаты. Python DTO не меняется.

### Manual evidence
Сравнить rendered разрешённый журнал и существующие restricted/recovery states
до/после, включая закрытие details/filter surface при отказе. Реальный Safari,
browser chrome и физические устройства отмечать непроверенными, если их не
использовали; автоматизация WebKit не подменяет эти свидетельства.

### Regression barrier
Backend role × route matrix и browser сценарий старой session с удалением
чувствительного состояния вместе защищают цель: скрытое меню не заменяет
серверный запрет, а серверный запрет не оставляет сохранённые данные в UI.

## Risks and stop conditions
- Если понадобится обнаружение отзыва в бездействующей вкладке без нового
  запроса — это изменение принятого контракта, требующее возврата в planning.
- Если найдена дополнительная точка чтения/экспорта аудита, потребитель общего
  DTO или обход запрета — расширить review и вернуть plan в non-ready.
- Если реализация требует новой auth-семантики, изменений других permissions,
  UI workflow, хранения или retention — остановить затронутый slice и
  согласовать изменение scope. Историю не удалять.
- Backend restriction обязателен при выпуске: frontend-only delivery или
  rollback backend на прежнюю разрешающую policy не выполняет REQ-AUD-001.
