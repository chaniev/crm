# TASK-186: Security/authorization review, 08.10.2026

- Reviewer: Codex, coordinating agent.
- Source: [TASK-186](/backlog/needs-clarification/TASK-186-audit-access-head-coach-super-admin.md).
- Scope: статическое чтение production code, публичных DTO и существующих
  backend/frontend tests; producer, frontend consumer и bot surface.
- Result: локальная реализация возможна в существующих границах. Обнаружены
  несоответствия принятой матрице и сохранение sensitive UI state после отказа.
  Timing обнаружения отзыва в бездействующей вкладке требует решения владельца.
- Runtime tests и browser inspection в рамках этого review не выполнялись;
  приведённые ниже current behaviors установлены по коду и тестовым assertions.

## Routes and expected denial matrix

| Surface | Назначение и guard | HeadCoach / SuperAdministrator | Administrator / Coach | Anonymous / invalid cookie |
| --- | --- | --- | --- | --- |
| GET `/audit-logs` | Записи, totals, author и old/new JSON; group policy ViewAuditLog | 200 | 403 без audit payload | 401 |
| GET `/audit-logs/options` | Авторы и варианты фильтров; та же group policy | 200 | 403 без options | 401 |
| GET `/access/audit-log` | Probe capability, не выдаёт записи; ViewAuditLog | 200 | 403 | 401 |

Матрица относится к активным пользователям без обязательной смены пароля.
Password-change-required продолжает давать существующий `403` без данных.
Browser `/api` — proxy prefix. Поиск `AuditLogs` в API endpoint modules не
обнаружил дополнительного reader/export endpoint; детали UI используют JSON
из ответа list, отдельного details endpoint нет.

Evidence: [audit routes](/backend/src/GymCrm.Api/Auth/AuditLogEndpoints.cs),
[route constants](/backend/src/GymCrm.Api/Auth/AuditLogApiConstants.cs),
[probe](/backend/src/GymCrm.Api/Auth/AccessEndpoints.cs),
[policy registration](/backend/src/GymCrm.Api/Auth/GymCrmAuthorizationPolicies.cs).

## Producer findings

1. `UserRoleAuthorizationPolicy.GetPermissions(Administrator)` сейчас содержит
   `CanViewAuditLog=true`. `GetRolesForCapability` из него строит endpoint policy:
   нужна локальная смена одного значения, не новая общая role policy.
2. `AccessScopeService` отдельно включает `Audit` в Administrator sections;
   одного изменения permission недостаточно для согласованного session DTO.
3. `AuditLogApiTests.HeadCoach_or_Administrator_can_read_audit_log_and_filter_options`
   закрепляет прежнее разрешение. `AuthorizationFlowTests` дополнительно
   ожидает true capability, Audit section и успешный probe Administrator.
   Положительный новый сценарий должен явно включать SuperAdministrator.
4. Cookie содержит role/user version, а не capability snapshot. Обновлённая
   policy применяется к старой Administrator cookie без re-login. Middleware
   сверяет пользователя и `UpdatedAt` до `UseAuthorization`; изменённая версия
   или inactive user инвалидируют cookie, это `401`, а не новая роль в старой
   сессии. `AuthEndpoints` формирует свежие permissions через access scope.
5. Запись выполняется отдельным `IAuditLogService`; restriction reader не
   требует менять writer, persistence model или существующие audit entries.

Evidence: [role policy](/backend/src/GymCrm.Application/Authorization/UserRoleAuthorizationPolicy.cs),
[scope](/backend/src/GymCrm.Infrastructure/Authorization/AccessScopeService.cs),
[cookie claims](/backend/src/GymCrm.Api/Auth/AuthSessionSync.cs),
[middleware](/backend/src/GymCrm.Api/Auth/AuthenticatedUserMiddleware.cs),
[pipeline](/backend/src/GymCrm.Api/Program.cs),
[session](/backend/src/GymCrm.Api/Auth/AuthEndpoints.cs),
[writer](/backend/src/GymCrm.Infrastructure/Audit/AuditLogService.cs).

## Frontend consumer findings

- `api/auth.ts` маппит backend access facts. `appRoutes.ts` учитывает capability
  и sections для navigation и route access. Запрещённый direct URL уже имеет
  recovery state; role comparisons для новой матрицы не нужны.
- `AuditLogScreen` параллельно запрашивает list/options. Catch сохраняет
  snapshot того же query при любом Error, включая `ApiError(401/403)`;
  options остаются в состоянии. При сохранённом snapshot открытая details
  modal также может продолжать отображать старые значения.
- `api/transport.ts` сохраняет HTTP status в `ApiError`, но не обновляет session.
  Audit screen не получает существующий `onRefreshSession` callback. В `App`
  уже есть recovery при переходе allowed → restricted после смены session,
  а также login для anonymous session. Его можно использовать локально.
- Автоматического refresh на focus/visibility или polling в рассмотренном
  shell нет. Нельзя обещать обнаружение серверного изменения в бездействующей
  вкладке без отдельного trigger. Вопрос владельцу задан 08.10.2026.
- Тесты должны включать оба порядка отказа list/options и поздние ответы:
  быстрый `500` одного Promise не должен замаскировать `403` второго.
  Зафиксированное удаление данных нельзя отменить obsolete response.

Evidence: [audit screen](/frontend/src/features/audit/AuditLogScreen.tsx),
[screen tests](/frontend/src/features/audit/AuditLogScreen.test.tsx),
[transport](/frontend/src/lib/api/transport.ts),
[routes](/frontend/src/lib/appRoutes.ts),
[shell state](/frontend/src/App.tsx),
[route viewport](/frontend/src/app/RouteViewport.tsx),
[direct URL tests](/frontend/e2e/route-access-feedback.spec.ts).

## Bot surface and other capabilities

`BotUserContext` содержит identity/role, но не `PermissionSet` или
`CanViewAuditLog`; Python DTO повторяет этот контракт. Bot menu не содержит
журнал. `POST /internal/bot/audit/access-denied` записывает аудит и не читает
историю. Backend BotApiService использует общий access scope для attendance,
поэтому надо сохранить его permissions и охват; новая bot-команда или Python
DTO migration для TASK-186 не требуются.

Evidence: [Bot DTO](/backend/src/GymCrm.Application/Bot/BotApiContracts.cs),
[Bot service](/backend/src/GymCrm.Infrastructure/Bot/BotApiService.cs),
[internal routes](/backend/src/GymCrm.Api/Auth/BotInternalEndpoints.cs),
[Python models](/bot/src/gym_crm_bot/crm/models.py),
[Python client](/bot/src/gym_crm_bot/crm/client.py).

## Review disposition

Перечень routes, матрица отказов, session invalidation и bot impact проверены
по коду. Исправления и automated barriers описаны в
[плане](/backlog/implementation-plans/TASK-186-audit-access-head-coach-super-admin.plan.md).
До executable readiness остаётся точное решение о timing обнаружения отзыва.
Статическая проверка не подтверждает будущую реализацию или прохождение тестов.

## 2026-10-08 — решение владельца и закрытие planning review

- Пользователь ответил: «открытая вкладка должна обнаруживать отзыв доступа
  при следующем запросе». Принят первый вариант; дополнительная фоновая
  проверка бездействующей вкладки не требуется.
- Решение зафиксировано в REQ-AUD-001 и карточке TASK-186. Исходная ссылка
  `Source` на needs-clarification выше отражает историческое положение карточки;
  текущий путь находится в `source_task` связанного плана.
- Открытых вопросов по security/authorization review больше нет. Review
  допускает реализацию описанного локального изменения; runtime-проверка
  очистки данных, матрицы отказов и session recovery остаётся частью исполнения.
