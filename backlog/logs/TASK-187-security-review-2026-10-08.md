# TASK-187: planning security review, 08.10.2026

- Reviewer: Codex, coordinating agent; статическое review, без запуска приложений.
- Scope: [TASK-187](/backlog/implementation/TASK-187-administrator-coach-creation-scope.md),
  backend staff/session/group boundaries и frontend consumers.
- Outcome: CRUD локализуем в существующей policy; полный план не готов из-за
  отсутствующего reset-контракта и нового UX. Это не human approval и не runtime QA.

## Evidence

| Граница | Текущее evidence | Следствие для плана |
|---|---|---|
| Actor/target authorization | `backend/src/GymCrm.Application/Authorization/UserRoleAuthorizationPolicy.cs`; exhaustive tests в `backend/tests/GymCrm.Tests/UserRoleAuthorizationPolicyTests.cs` | Administrator сейчас полностью запрещён; разрешить только Coach во всех read/create/update/action ветках, сохранить self/protected targets |
| Общий вход mutation service | `backend/src/GymCrm.Api/Auth/StaffManagementMutationService.cs`, `StaffManagementBoundary.cs` | Одного расширения CanManageStaff недостаточно: запрещённая administrative family должна отсеиваться до target lookup/validation |
| Role-family | `UserEndpoints.cs`, `AdministratorEndpoints.cs`, `StaffEndpointRoleFamilies.cs` в `backend/src/GymCrm.Api/Auth/` | Coach-only query и фильтрация create/update options уже есть; сохранить wrong-family 404 и HeadCoach-only self exception |
| Session/capability | `backend/src/GymCrm.Infrastructure/Authorization/AccessScopeService.cs`, `backend/src/GymCrm.Api/Auth/AccessEndpoints.cs` | Users отсутствует у Administrator; ManageUsers обслуживает navigation/probe, не является достаточным правом мутации произвольного target |
| UI consumers | `frontend/src/lib/appRoutes.ts`, `frontend/src/features/users/UsersListScreen.tsx`, `frontend/src/features/settings/SettingsScreen.tsx` | Trainer create питается createRoleOptions, settings admin-tab — option Administrator; при `[Coach]` admin-tab не нужен |
| Edit action fallback | `frontend/src/features/users/UserEditScreen.tsx`, функция `canMutateUser` | Missing allowedActions сейчас даёт true, в отличие от fail-closed list row и контракта TASK-105; учесть в consumer slice |
| Группы | `backend/src/GymCrm.Api/Auth/GroupManagementScope.cs`, `GroupTrainerAssignmentEndpoints.cs`; `backend/tests/GymCrm.Tests/GroupsApiTests.cs` | Branch checks существуют в preview/execute; глобальный staff access не должен их менять |
| Audit/concurrency | `StaffManagementMutationService.cs`, `UserAuditSerializer.cs`; `UsersApiTests.cs` | Create + audit сохраняются вместе; update использует transaction, lock/reload и повторную authorization; покрыть нового actor relational rollback тестом |
| Cookie lifecycle | `backend/src/GymCrm.Api/Auth/AuthenticatedUserMiddleware.cs`, `AuthSessionSync.cs` | Inactive user и mismatch UpdatedAt cookie version отзывают доступ на следующем запросе; CRUD уже меняет UpdatedAt |
| Password reset | `backend/src/GymCrm.Api/Auth/UpdateUserRequest.cs`, `AuthEndpoints.cs`; `frontend/src/features/users/UserFormFields.tsx` | Update DTO не содержит password; change-password требует currentPassword; edit UI не имеет reset operation |

## Обнаруженный блокер

TASK-187 разрешает администратору сброс пароля любого Coach, но ошибочно
предполагает сохранение существующего сценария сброса. В коде его нет.
[TASK-173](/backlog/needs-clarification/TASK-173-administrator-password-reset.md)
уже фиксирует этот пробел, процедуру передачи временного доступа и отзыв сессий.
Права Administrator → Coach не требуют повторного согласования; механизм и
граница задач требуют решения до ready plan. MustChangePassword не восстанавливает
забытый пароль: change-password всё равно проверяет текущий секрет.

Продуктовый вопрос передан пользователю 08.10.2026. Предложена процедура:
администратор задаёт временный пароль и передаёт самостоятельно; текущие сессии
отзываются, следующий вход требует смены. Предложение не считается принятым
без ответа. Scope reset не исключается из TASK-187 автоматически.

## Рекомендуемая локальная стратегия CRUD

Сохранить текущие DTO, `/coaches`, options/actions и общую модель User.
Расширить существующую центральную actor/target policy, сохранить family
admission для settings endpoints и неизменный GroupManagementScope.
Отдельные endpoints/флаг CanManageCoaches или филиальное владение Coach для
этой части не нужны: первое дублирует уже отделённый trainer transport,
второе противоречит принятому глобальному доступу. Это локальное развитие
существующих границ, а не новая security architecture.

Для полного reset нужно отдельно завершить API/auth/audit design. Наличие
UpdatedAt versioning — свидетельство существующего механизма, не разрешение
молча выбрать его для любого нового auth-сценария. Если проектируется новый
существенный контракт, нужен architecture-decision workflow и утверждение
его владельцем. Пока нет решений — нет ADR с вымышленным Accepted.

## UX/design applicability

Существующие list/create/edit переиспользуются по
[TASK-105](/backlog/done/2026-08-23/TASK-105-trainer-access-registry-contract.md).
Открытие этих экранов новой роли не требует само по себе трёх новых вариантов.
Reset — новая операция с последствиями для доступа; её interaction/visual
contract отсутствует. До executable plan требуется применимый design workflow,
rendered evidence и выбор владельца. В этом review интерфейс не запускался,
поэтому визуальная пригодность не заявлена.

## Обязательные barriers и остаточный риск

- Четыре роли, обе staff families, существующий/отсутствующий target,
  malformed/overposted role/branch; отказы не меняют state/audit.
- Два Administrator и два филиала, Coach без групп/чужой/общий/disabled;
  group preview/execute своего и чужого филиала, снятие последней группы.
- Atomically persisted audit, cookie invalidation и отсутствие секретов.
- Frontend не вычисляет права из role; отсутствующие options/actions не
  разрешают mutation. Сохранить права Audit/Finance и attendance grants.
- Расширение прав и reset глобально затрагивают тренера во всех филиалах — это
  принятое продуктовое поведение. Его нельзя «исправить» branch-фильтром Coach.

Повторное review нужно после появления reset-контракта и при изменении
названных границ. Статический результат не заменяет будущие HTTP, relational,
browser и runtime проверки из implementation plan.

## Дополнение 08.10.2026 13:42: итог после изменения scope

Пользователь прямо решил: «убери из требований сборос пароля администратором».
Это отменяет право reset из предыдущей редакции TASK-187/REQ-USR-002 и снимает
описанный выше блокер. Предложенная процедура reset не была принята и не
реализуется. Начальный пароль при создании и самостоятельная смена остаются.
Предыдущие разделы сохраняют evidence первоначального review; актуальное
заключение для нового scope приведено в этом дополнении.

- Повторно сопоставлены актуальные product decisions, CRUD contract и
  actor/target guards плана с evidence выше. В scope остались list/get/create,
  edit, deactivate/reactivate Coach и регрессия branch scope групп.
- Для этой части достаточно существующих policy, role-family/target guards,
  DTO, atomic audit и cookie versioning. Материального нового технического
  выбора, нового auth API или миграции нет; отдельный ADR не требуется.
- Сохраняются UI, layout и последовательность операций из TASK-105;
  Administrator открывает те же list/create/edit. Новый reset UI исключён,
  новый design direction не требуется. Runtime comparison сохраняется как
  проверка отсутствия визуальной регрессии при реализации.
- Блокирующих вопросов по текущему scope не осталось. Обязательные barriers
  из review остаются в плане, включая запрет administrative family, чужих
  групп, ошибочного allowedActions fallback и rollback обязательного аудита.
- Итог: security review текущего scope завершено; план может пройти executable
  preflight. Это заключение о готовности планирования, не заявление о
  реализованном поведении или пройденных runtime/tests.

Актуальные [карточка](/backlog/implementation/TASK-187-administrator-coach-creation-scope.md)
и [план](/backlog/implementation-plans/TASK-187-administrator-coach-creation-scope.plan.md).
