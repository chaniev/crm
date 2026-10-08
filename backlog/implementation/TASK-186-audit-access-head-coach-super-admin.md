# TASK-186: Ограничить чтение журнала Главным тренером и Супер-администратором

## Status
implementation

## Requirements
- REQ-AUD-001 — changes
- REQ-USR-001 — constrains
- REQ-NFR-003 — constrains

## Requirement links
- [REQ-AUD-001](../../docs/requirements/06-аудит.md) — changes
- [REQ-USR-001](../../docs/requirements/05-пользователи-и-роли.md) — constrains
- [REQ-NFR-003](../../docs/requirements/08-нефункциональные.md) — constrains

## Goal
Журнал и его вспомогательные данные доступны только HeadCoach и SuperAdministrator.

## Context
Явная запись пользователя меняет прежний доступ Administrator. Сейчас CanViewAuditLog=true для администратора; AuditLogApiTests явно проверяет разрешённое чтение и filter options. Нужна согласованная замена нормативного правила и его тестов.

## Scope
- Запретить Administrator и Coach чтение журнала и filter options на backend; сохранить разрешение двух глобальных ролей.
- Синхронизировать session capability/allowedSections, frontend меню, direct URL и API consumer tests.
- Сохранить запись действий всех ролей и append-only историю.

## Constraints
- Backend сохраняет владение CRM-правилами; triage не разрешает реализацию.
- Перед реализацией нужен ready plan по docs/HARNESS.md; для визуальных изменений — применимый design gate.
- При завершении обновить состояние связанных требований и docs/requirements/CHANGELOG.md.

## Acceptance criteria
- [ ] HeadCoach/SuperAdministrator читают журнал и filters; Administrator/Coach получают отказ без данных.
- [ ] UI следует backend-разрешениям, включая старую сессию/открытую вкладку; скрытия меню недостаточно.
- [ ] Открытая вкладка обнаруживает отзыв при следующем запросе журнала, filter options или актуальной сессии; после отказа очищает ранее загруженные данные. Фоновая проверка без действий пользователя не требуется.
- [ ] Действия администратора по-прежнему аудируются; история не удаляется.

## Test checklist
- [ ] Матрица всех ролей для audit data/filter endpoints, anonymous и прямой API.
- [ ] Session capability и frontend direct URL, навигация, потеря доступа в открытой вкладке.

## AI safety
- Safe for autonomous implementation: yes — в границах готового плана после разрешения на реализацию
- Risk level: high
- Reason: Пропуск вспомогательного endpoint оставит утечку данных; изменение широкой role policy может затронуть независимые права.
- Required review: Security/authorization review producer и frontend consumer до ready plan: перечислить все audit-read routes, session/role refresh и матрицу отказов. Проверить bot surface impact по общему permission DTO, не вводя новых bot-команд.
- Review completed: [статический security/authorization review](../logs/TASK-186-security-review-2026-10-08.md), 08.10.2026; вопрос о моменте обнаружения отзыва закрыт явным решением пользователя ниже.
- Stop conditions: Остановить затронутый план, если найдён обход запрета, неясна семантика обновления прав текущей сессии или требуется поменять запись/retention аудита. Не удалять историю.

## Evidence
- [backend/src/GymCrm.Application/Authorization/UserRoleAuthorizationPolicy.cs](../../backend/src/GymCrm.Application/Authorization/UserRoleAuthorizationPolicy.cs)
- [backend/src/GymCrm.Api/Auth/AuditLogEndpoints.cs](../../backend/src/GymCrm.Api/Auth/AuditLogEndpoints.cs)
- [backend/tests/GymCrm.Tests/AuditLogApiTests.cs](../../backend/tests/GymCrm.Tests/AuditLogApiTests.cs)
- [frontend/src/lib/api/auth.ts](../../frontend/src/lib/api/auth.ts)
- [frontend/src/lib/appRoutes.ts](../../frontend/src/lib/appRoutes.ts)

## Source notes
- Source file: [2026-10-05.md](../processed/2026-10-05.md)
- Source items: 1 (порядок самостоятельных пунктов, без строк-продолжений).

> доступ к журналу должны иметь только главный тренер и суперадминистратор

## Processing notes
- Created at: 2026-10-05 (MSK).
- Created by skill: codex-backlog-skill.
- Mode: triage; scope: два файла inbox, без глобальной сверки статусов.
- Duplicate check: TASK-082 и TASK-105 закрепляли предыдущую матрицу; TASK-099 меняла колонки. Это новое решение о чтении, а не переоткрытие UI-задач.
- Проверены активные карточки, unfinished plans и рекурсивный done; новые ID выделены после TASK-171.

## Planning, 2026-10-08
- Запрос пользователя: создать план реализации; project code не менялся.
- План: [TASK-186 implementation plan](../implementation-plans/TASK-186-audit-access-head-coach-super-admin.plan.md), `readiness: yes` после решения пользователя ниже.
- [Security/authorization review](../logs/TASK-186-security-review-2026-10-08.md) выполнен по коду: проверены оба audit-read routes, capability probe, cookie invalidation, frontend session/recovery и bot impact. Runtime evidence будет получено при реализации.
- Найдено: текущий audit screen сохраняет same-query данные и options также после `401/403`; план включает их очистку, закрытие details и обновление session.
- На этапе черновика переносилась из `risky` в `needs-clarification` из-за вопроса о timing обнаружения отзыва в бездействующей вкладке. Вопрос закрыт ответом пользователя; матрица ролей и сохранение истории остаются принятыми.

## Product decision, 2026-10-08
- Owner: пользователь.
- Source: явный ответ в текущем обсуждении плана TASK-186 от 08.10.2026.

> открытая вкладка должна обнаруживать отзыв доступа **при следующем запросе**

Принят первый из предложенных вариантов: следующий запрос журнала/options
либо обновление session обнаруживает отзыв; серверный отказ приводит к очистке
чувствительных данных и существующему session/recovery flow. В бездействующей
вкладке отдельные polling, focus/visibility-trigger или push не добавляются.
Blocking questions: none.

## Implementation lifecycle
- moved_to_implementation_at: 2026-10-08 10:48
- moved_from: /backlog/tasks-ready
- clarification_resolved_from: /backlog/needs-clarification
- implementation_plan: /backlog/implementation-plans/TASK-186-audit-access-head-coach-super-admin.plan.md
- implementation_branch: codex/TASK-186-audit-access-head-coach-super-admin
- Planning завершено после ответа пользователя и успешного readiness preflight; functional code не менялся, branch/worktree не создавались.
