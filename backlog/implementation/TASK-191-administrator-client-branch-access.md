# TASK-191: Ограничить доступ администратора к клиентам своим филиалом

## Status
implementation

## Requirements
- REQ-USR-001 — changes
- REQ-CLI-007 — changes
- REQ-CLI-009 — constrains
- REQ-BRN-001 — constrains

## Goal
Администратор получает данные и выполняет разрешённые операции только с
клиентами своего филиала, в CRM и через Telegram-бота.

## Context
Прямое решение пользователя от 24.10.2026 подтверждает ограничение филиалом.
REQ-USR-001 уже ограничивает управление клиентами, но теперь явно закрепляет
также чтение и применение ограничения во всех каналах. Статический разбор
main `8773321` обнаружил несовпадение с этим правилом:

- `UserRoleAuthorizationPolicy.GetOperationalScopeKind` возвращает `Branch`
  для Administrator, но `ClientQueryEndpoints.ListClientsAsync` сужает выборку
  только для Coach. Чужие клиенты могут попасть в поиск, страницы и счётчики.
- В выдаче карточки любая роль с охватом, отличным от `AssignedGroups`,
  получает полную карточку без сравнения филиала администратора и клиента.
- `BotApiService.SearchClientsAsync` и `GetClientCardAsync` ограничивают
  клиентов Coach, но не применяют филиальный охват Administrator.
- `ClientPhotoService.OpenReadAsync` явно разрешает Administrator чтение фотографии
  без проверки филиала. Lifecycle loader ищет клиента только по ID; проверка
  upsert получает филиал клиента, но не филиал действующего сотрудника.
- `ClientAttentionEndpoints.ApplyScope` уже применяет ограничение филиалом;
  это пример существующего правила, а не доказательство защиты остальных путей.

Это evidence по исходному коду; воспроизведение на работающем стенде и новые
регрессионные тесты в triage не выполнялись.

## User role
Администратор; Главный тренер, Супер-администратор и Тренер — контрольные роли.

## Problem
Проверка права на действие без проверки конкретного клиента может раскрыть
ФИО, телефоны, контактных лиц, фотографии и сведения об абонементах другого
филиала. Для mutations нужно исключить изменение чужих записей по известному ID.

## Scope
- Составить матрицу всех клиентских read/write путей Staff API и Internal Bot API:
  поиск, карточка, фотографии, связанные абонементы, посещения, уведомления,
  внимание, messenger и lifecycle. Проверить также списки, содержащие клиентов.
- Исправить обходы филиального охвата на backend; фильтровать до pagination,
  подсчётов и формирования производных списков.
- Проверять филиал исходного клиента для действий по ID и целевой филиал
  обычного создания/редактирования; клиентские параметры не задают охват сотрудника.
- Сохранить согласованный перевод клиента по REQ-CLI-007; review должен отдельно
  проверить исходный/целевой филиал, ответ операции и последующие обращения
  после перевода. Не превращать обычное редактирование в обход перевода.
- Синхронизировать frontend и bot с необходимыми изменениями API/ошибок;
  обработать устаревшую ссылку или открытую карточку после утраты доступа.

## Out of scope
- Изменение охвата тренера: в [TASK-192](../done/2026-10-24/TASK-192-coach-client-branch-scope.md)
  пользователь подтвердил доступ только к клиентам своих групп;
  уточнение закрыто, новая модель филиала не требуется.
- Глобальный доступ к учётным записям Coach из TASK-187 и справочное чтение
  филиалов/залов из TASK-190; эти разрешения не дают доступа к чужим клиентам.
- Общая декомпозиция BotApiService из TASK-132, изменение схемы, deployment.

## Constraints
- Backend остаётся единственным владельцем авторизации; frontend и bot
  отображают разрешённые данные и ошибки, не фильтруют утечки самостоятельно.
- Глобальные права HeadCoach/SuperAdministrator и срез данных Coach сохраняются.
- Новые материальные решения о контракте отказов, границах авторизации или
  переводе согласовать в planning; при необходимости применить ADR workflow.
- До реализации обязателен готовый план с результатом authorization review.
- Definition of done включает состояние затронутых REQ и CHANGELOG.

## Acceptance criteria
- [ ] Администратор филиала A не получает клиентов B через поиск, фильтры,
  страницы, счётчики, карточку, фото и связанные клиентские данные в обоих API.
- [ ] Прямое обращение к чужому ID и подмена параметров не открывают доступ;
  запрещённая mutation не изменяет клиентские данные и связанные записи.
- [ ] Клиенты своего филиала доступны в рамках существующих полномочий;
  отсутствие назначенного филиала не даёт глобального доступа.
- [ ] Перевод сохраняет REQ-CLI-007; после смены филиала последующие запросы
  используют актуальный охват и не раскрывают клиента прежнему администратору.
- [ ] HeadCoach/SuperAdministrator сохраняют глобальный охват; Coach сохраняет
  доступ по назначенным группам и установленное скрытие чувствительных полей.
- [ ] Пройдена проверка матрицы прав и согласованного контракта отказов;
  frontend/bot корректно обрабатывают недоступную карточку.

## Test checklist
- [ ] Два филиала, два администратора, клиенты с группой/без группы,
  активные/архивные; успешные свои и запрещённые чужие сценарии.
- [ ] Staff API и Internal Bot API: поиск по ФИО/телефону, прямой ID, фото,
  pagination, totals/quick filters и вторичные клиентские списки.
- [ ] Create/update/archive/restore, membership/photo/messenger mutations:
  чужие идентификаторы, подмена branchId и отсутствие побочных изменений.
- [ ] Перевод из своего филиала и последующий запрос по старой ссылке;
  попытка перевести уже чужого клиента.
- [ ] Администратор без филиала и изменение назначения; контроль глобальных
  ролей, назначений Coach и активных замещений.
- [ ] Consumer regression: разрешённая карточка и корректный отказ по старой
  ссылке в frontend и Telegram; данные другого филиала не попадают в ответ.

## AI safety
- Safe for autonomous implementation: yes — в рамках принятого плана после отдельного запроса на реализацию и readiness preflight
- Risk level: high
- Reason: пропущенный путь раскрывает персональные данные или позволяет
  изменить чужого клиента; чрезмерное ограничение ломает допустимый перевод.
- Required review: явный review матрицы actor/action/client/branch для обоих
  API и всех потребителей, контракта отказов и перехода между филиалами.
- Stop conditions: не определён охват операции, предлагается изменить
  утверждённое поведение перевода/других ролей, отсутствует backend-проверка
  либо контракт потребителя не синхронизирован.

## Evidence
- [Role policy](../../backend/src/GymCrm.Application/Authorization/UserRoleAuthorizationPolicy.cs)
- [Client queries](../../backend/src/GymCrm.Api/Auth/ClientQueryEndpoints.cs)
- [Lifecycle validation](../../backend/src/GymCrm.Api/Auth/ClientLifecycleRequestValidation.cs)
- [Client photos](../../backend/src/GymCrm.Infrastructure/Clients/ClientPhotoService.cs)
- [Bot API service](../../backend/src/GymCrm.Infrastructure/Bot/BotApiService.cs)
- [Client API tests](../../backend/tests/GymCrm.Tests/ClientsApiTests.cs)
- [Internal Bot API tests](../../backend/tests/GymCrm.Tests/InternalBotApiTests.cs)
- [Frontend API client](../../frontend/src/lib/api/clients.ts)
- [Bot API client](../../bot/src/gym_crm_bot/crm/client.py)

## Source notes
- Source file: [2026-10-24.md](../processed/2026-10-24.md).
- Original note: «администратор и тренер должен иметь доступ только к клентам своего филиала».
- В этой карточке обрабатывается часть про администратора; часть про тренера — TASK-192.

## Planning lifecycle
- planned_at: 2026-10-24 11:48 MSK
- moved_from: /backlog/risky — выявлены продуктовые и технические вопросы, а не только review gate
- implementation_plan: /backlog/implementation-plans/TASK-191-administrator-client-branch-access.plan.md
- implementation_branch: codex/TASK-191-administrator-client-branch-access
- authorization_review: /backlog/logs/TASK-191-authorization-review-2026-10-24.md
- architecture_decision: /docs/architecture/adr/0003-administrator-client-branch-scope.md — Accepted (пользователь, 2026-10-24)
- readiness: yes — решения владельца записаны; technical review и rendered existing-component states завершены

## Implementation lifecycle
- moved_to_implementation_at: 2026-10-24 12:16
- moved_from: /backlog/tasks-ready (после закрытия needs-clarification)
- implementation_plan: /backlog/implementation-plans/TASK-191-administrator-client-branch-access.plan.md
- implementation_branch: codex/TASK-191-administrator-client-branch-access
- execution_started: no — подготовлен готовый план; код не менялся

## Product decisions
- 24.10.2026, пользователь, владелец продукта, ответ на перечисленные вопросы:
  «1. сохранить текущую модель
  2. согласно рекомендации
  3. согласно рекомендации».
  P1: сохранить перевод отдельно от продажи и конфликт при затрагивании
  active/future membership targets; привести REQ-CLI-007 к этой модели.
  T1: принять рекомендованный вариант B — 404 для чужого/отсутствующего клиента,
  204 после успешного перевода с утратой доступа, безопасное подтверждение
  повторного запроса без повторной операции или выдачи карточки.
  UX1: после перевода уведомление и возврат в исходный список; по устаревшей
  ссылке очистка карточки и сообщение о недоступности с возвратом.
  Техническая детализация синхронизации остаётся ответственностью Codex в
  пределах принятого контракта, без новых продуктовых разрешений.
- 24.10.2026, пользователь, владелец продукта: «Скрывать чужие клиентские
  счётчики; общий справочник сохранить (рекомендуется)». Решение относится
  также к secondary lists/counts; названия филиалов и залов остаются доступны
  существующим lookup consumers. REQ-USR-001 актуализирована, реализация частичная.
- Ограничение Administrator своим филиалом и scope Coach из TASK-192 уже
  приняты; повторного согласования не требуют.

## Open questions
Нет. P1/P2/T1/UX1 закрыты; technical review и rendered verification записаны
в plan/review/UI evidence. Планирование не запускает реализацию кода.

## Processing notes
- Created at: 2026-10-24 11:23 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: проверены active cards, unfinished plans и dated done.
  TASK-031/082 задают филиалы и роли; TASK-085 — поиск; TASK-123 — сохранение
  lifecycle при декомпозиции; TASK-190 — настройки филиалов/залов.
  Эти завершённые задачи не устраняют обнаруженные пропуски текущего main.
  TASK-132 — behavior-preserving рефакторинг Bot API, не исправление охвата;
  перед его выполнением учесть интеграцию исправления. Прямого дубля нет.
- На этапе triage реализация, implementation plan и изменение runtime не выполнялись.
- 24.10.2026 составлены draft plan, authorization review и Proposed ADR;
  текущие blockers перенесены в Open questions. Реализация не начиналась.

- 24.10.2026 уточнения завершены: принятое решение, no-sale REQ-CLI-007,
  Accepted ADR и rendered existing-component states включены в готовый план.
