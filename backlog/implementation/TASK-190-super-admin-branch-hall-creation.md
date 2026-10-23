# TASK-190: Открыть суперадминистратору создание филиалов и залов

## Status
implementation

## Requirements
- REQ-BRN-001 — changes
- REQ-BRN-002 — changes
- REQ-USR-001 — changes
- REQ-USR-003 — constrains
- REQ-CLI-007 — constrains

## Requirement links
- [REQ-BRN-001/002](../../docs/requirements/09-филиалы-и-настройки.md)
- [REQ-USR-001/003](../../docs/requirements/05-пользователи-и-роли.md)
- [REQ-CLI-007](../../docs/requirements/01-клиенты.md) — сохранить существующих lookup consumers перевода клиента.

## Goal
Суперадминистратор создаёт филиал и зал в доступном активном филиале через
«Настройки → Филиалы и залы».

## Context
API `/branches` и `/halls` защищены `ManageSettings`; у SuperAdministrator
это разрешение уже есть. `BranchesApiTests.SuperAdministrator_can_manage_membership_catalog_in_two_branches`
уже создаёт два филиала от его имени с ответом 201.
UI скрывает вкладку через `canManageHeadCoachSettings`, вычисляемый как
`createRoleOptions.includes('SuperAdministrator')`. Право создать сотрудника
ошибочно используется для доступа к другой сущности.

## User role
Суперадминистратор; главный тренер и остальные роли — проверка отсутствия
побочного изменения доступа.

## Scope
- Сделать доступными раздел и операции создания филиала/зала для SuperAdministrator.
- Ограничить branch/hall HTTP mutations Administrator своим филиалом;
  запретить создание branch; сохранить существующие права HeadCoach/SA.
- Определить и проверить backend-owned контракт доступных действий для этой
  поверхности; UI не должен выводить branch/hall-права из createRoleOptions.
- Сохранить валидацию филиала, зала, auth/CSRF и аудит создания.
- Согласовать матрицу доступа и запрет побочного открытия остальных операций
  до ready plan; при изменении Staff API синхронизировать frontend и тесты.

## Out of scope
- Новые права Administrator/Coach, создание других SuperAdministrator.
- Расширение доступа к редактированию, архивации, восстановлению и удалению
  как самостоятельное продуктовое изменение.
- Onboarding свежей системы — [TASK-180](../needs-clarification/TASK-180-fresh-system-setup-navigation.md).

## Constraints
- По решению владельца 23.10.2026 исправить mutation scope Administrator в
  этой задаче; не переносить проблему в отдельную карточку.
- SuperAdministrator остаётся глобальной ролью без собственного филиала.
- Общий `CanManageSettings` имеется также у Administrator; не открывать ему
  глобальные действия простой заменой условия показа вкладки.
- Существующий `BranchSettingsScreen` содержит не только создание, но и
  update/archive/restore/delete: доступность каждого действия должна иметь
  собственное подтверждение backend-контрактом в согласованных границах.
- До реализации нужны review и ready plan по [HARNESS](../../docs/HARNESS.md).
- Definition of done включает состояние требований и `docs/requirements/CHANGELOG.md`.

## Acceptance criteria
- [ ] Суперадминистратор видит доступный путь к созданию филиала и зала,
  сохраняет их и видит результат после reload.
- [ ] Создание зала в несуществующем/архивном филиале отклоняется действующей
  backend-валидацией; UI сохраняет введённые данные и показывает ошибку.
- [ ] Главный тренер сохраняет свой сценарий; Administrator и Coach не получают
  новых глобальных операций из-за изменения вкладки.
- [ ] Создание сотрудников и иных сущностей не используется как источник прав
  на филиалы/залы; запрещённые запросы не обходят API-защиту.
- [ ] Открытие раздела не добавляет несогласованных destructive actions.
- [ ] Administrator не создаёт branch и не изменяет/архивирует/восстанавливает
  чужие branch/hall, не удаляет чужой hall; отказы не меняют entity/audit.
- [ ] Собственные разрешённые mutations Administrator и shared lookup
  consumers проверены отдельно от нового UI доступа SuperAdministrator.

## Test checklist
- [ ] Backend HTTP matrix: HeadCoach, SuperAdministrator, Administrator, Coach,
  anonymous; создание branch/hall, CSRF, валидный/архивный/чужой контекст.
- [ ] Отдельный positive test создания зала SuperAdministrator и проверка audit actor/entity.
- [ ] Frontend session/allowed-actions matrix, включая отсутствие или отзыв разрешения.
- [ ] Playwright mobile/desktop: настройки → филиал → зал → reload;
  negative path и сохранность остальных настроек.

## Product decisions — 23.10.2026
- На вопрос о границе UI-only и исправлении HTTP scope владелец ответил:
  «Включить исправление API-доступа в TASK-190 и расширить план».
- Исправление существующих глобальных branch/hall mutations Administrator
  входит в эту задачу; создание нового филиала ему запрещено, mutations залов
  и существующего филиала ограничены собственным филиалом. HeadCoach и
  существующие прямые HTTP-права SuperAdministrator не сужаются.
- В текущем диалоге владелец выбрал «Принять вариант B и сохранить общее чтение (рекомендуется)». Принят полный контракт ADR-0002: прежние shared GET сохраняются для существующих consumers; Administrator mutations ограничены своим филиалом.

## Planning decisions
- Блокеры закрыты прямым решением владельца 23.10.2026: принят вариант B [ADR-0002](../../docs/architecture/adr/0002-branch-settings-action-contract.md), shared GET остаются без изменений.
- Review producer/consumer завершено; новых контрактов перевода клиентов не требуется.

## AI safety
- Safe for autonomous implementation: yes — владелец принял вариант B ADR-0002 и сохранение shared reads.
- Risk level: medium
- Reason: Backend уже разрешает создание SuperAdministrator, но открытие
  существующей панели целиком может дополнительно показать архивирование/удаление;
  общий ManageSettings также допускает Administrator без локальных scope guards
  в просмотренных branch/hall handlers. Ошибка затрагивает общую структуру клуба.
- Required review: producer/consumer review выполнено и сохранено; проверить
  финальное соответствие ответа по reads, ADR и plan перед readiness preflight.
- Stop conditions: нужен новый доступ для иных ролей или destructive actions;
  нужна изоляция чтения/новый transfer API вне выбранной границы; обнаружен
  новый конфликт с branch scope сверх описанного исправления. Вернуть затронутую
  часть в planning/needs-clarification, не расширять права молча.

## Evidence
- [SettingsScreen.tsx](../../frontend/src/features/settings/SettingsScreen.tsx)
- [BranchSettingsScreen.tsx](../../frontend/src/features/settings/BranchSettingsScreen.tsx)
- [UserRoleAuthorizationPolicy.cs](../../backend/src/GymCrm.Application/Authorization/UserRoleAuthorizationPolicy.cs)
- [BranchEndpoints.cs](../../backend/src/GymCrm.Api/Auth/BranchEndpoints.cs)
- [BranchesApiTests.cs](../../backend/tests/GymCrm.Tests/BranchesApiTests.cs)

## Source notes
- Source file: [2026-10-23.md](../processed/2026-10-23.md), пункт 3.
> Создать зал и филиал может только главный тренер, надо дать возможность суперадминистратору
- Прямое решение пользователя 23.10.2026 разрешает создание обеих сущностей
  SuperAdministrator; дополнительного подтверждения этой цели не требуется.

## Processing notes
- Created at: 2026-10-23 16:47 MSK.
- Created by skill: codex-backlog-skill; mode: triage одного файла inbox.
- Duplicate check: активного дубля нет. [TASK-082](../done/2026-07-25/TASK-082-super-administrator-role.md)
  ввела роль, [TASK-109](../done/2026-08-22/TASK-109-settings-scope-touch-order.md)
  исправляла touch/scope presentation; ни одна не устраняет обнаруженный UI gate.
  TASK-180 касается onboarding, а не разрешений на создание.
- Evidence: статический анализ main `7154cee`; прочитанные тесты не запускались
  в этом triage. Это подтверждение существующего кода, не runtime stand evidence.

## Planning lifecycle
- planned_at: 2026-10-23 18:54 MSK
- moved_from: /backlog/risky
- implementation_plan: /backlog/implementation-plans/TASK-190-super-admin-branch-hall-creation.plan.md
- implementation_branch: codex/TASK-190-super-admin-branch-hall-creation
- readiness: yes — вариант B ADR-0002 принят владельцем 23.10.2026; shared reads сохранены.
- Review: [security/contract review](../logs/TASK-190-security-review-2026-10-23.md).
- Статус изменён на needs-clarification: review выявило существенный
  authorization выбор, это больше не только ожидание review в risky.
- Проверена уникальность TASK-190 среди активных и архивных карточек/планов;
  зависимости от TASK-180 или завершённых TASK-188/189 не требуется.

## Implementation lifecycle
- started_at: 2026-10-23
- Решение владельца в текущем диалоге: «Принять вариант B и сохранить общее чтение (рекомендуется)».
- Разрешена реализация исходным запросом выполнить TASK-190.
