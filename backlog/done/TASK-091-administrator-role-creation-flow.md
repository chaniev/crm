# TASK-091: Перенести создание суперадминистратора в раздел администраторов

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-07-26
- moved_from: /backlog/risky
- implementation_plan: /backlog/done/TASK-091-administrator-role-creation-flow.plan.md
- implementation_branch: feature/TASK-091-administrator-role-creation-flow
- moved_to_done_at: 2026-07-26

## Goal
Главный тренер создаёт администратора или суперадминистратора в едином разделе управления администраторами, а раздел тренеров используется только для создания и редактирования тренеров.

## Context
Завершённая TASK-082 добавила роль `SuperAdministrator` и разрешила создавать её только главному тренеру. Сейчас frontend предлагает эту роль в общем create-flow раздела `Тренеры`, тогда как форма в настройках `Администраторы` жёстко создаёт только `Administrator`. В inbox зафиксировано требование перенести создание суперадминистратора в раздел администраторов и очистить trainer flow от других ролей.

Текущие backend role options уже различают возможности субъекта: главный тренер может создавать `SuperAdministrator`, `Administrator` и `Coach`, а суперадминистратор — `Administrator` и `Coach`. Реализация должна сохранить backend источником истины для этой матрицы.

## User role
Главный тренер / суперадминистратор.

## Problem
Сценарии управления персоналом разделены не по пользовательской задаче: суперадминистратор создаётся из раздела тренеров, а раздел администраторов не позволяет главному тренеру выбрать административную роль. Из-за этого экран тренеров показывает несвойственный ему выбор ролей и смешивает создание разных типов сотрудников.

## Scope
- До реализации подготовить UX-контракт и mobile-first спецификацию изменённого staff-management workflow по правилам репозитория.
- В разделе `Администраторы` предоставить единый create-flow для `Administrator` и `SuperAdministrator`.
- Показывать выбор административной роли только главному тренеру и только из backend-разрешённых `createRoleOptions`.
- Для пользователя, которому backend разрешает создать только `Administrator`, не показывать лишний выбор и создавать администратора по существующему разрешённому сценарию.
- Для `Administrator` требовать активный филиал; для `SuperAdministrator` не показывать филиал и передавать глобальный scope без `branchId`.
- Отображать и редактировать допустимые административные учётные записи в разделе `Администраторы` с действиями, полученными из backend contract.
- Оставить в разделе `Тренеры` только список, создание и редактирование пользователей с ролью `Coach`.
- Исключить выбор `Administrator` и `SuperAdministrator` из trainer create/edit flow.
- При необходимости скорректировать backend read/create contracts так, чтобы frontend не фильтровал роли и не вычислял permissions самостоятельно.
- Сохранить существующие authorization, validation, ProblemDetails и audit semantics для создания и изменения ролей.
- Обновить затронутые frontend, backend и bot contract tests, если публичный staff contract изменится.

## Out of scope
- Изменение полномочий `HeadCoach`, `SuperAdministrator`, `Administrator` или `Coach`.
- Разрешение суперадминистратору создавать другого суперадминистратора или главного тренера.
- Изменение глобального scope суперадминистратора или branch scope администратора.
- Объединение всех экранов персонала в один общий список.
- Редизайн остальных вкладок настроек.

## Constraints
- Backend остаётся единственным источником истины для ролей, разрешённых role transitions, access scope, validation и audit.
- Выбор роли на frontend не является security boundary; прямой API-запрос с запрещённой ролью должен быть отклонён без мутации данных.
- `SuperAdministrator` остаётся глобальной ролью с `branchId: null`.
- `Administrator` создаётся только с существующим активным филиалом.
- `Coach` не получает прямой `branchId`; его рабочий scope определяется назначениями в группы.
- Frontend должен потреблять backend-provided `createRoleOptions` и `allowedActions`, а не выводить возможности из строкового имени текущей роли.
- Новый или существенно изменённый workflow должен пройти обязательные UX, UI и mobile acceptance этапы из `AGENTS.md`.

## Acceptance criteria
- [x] Главный тренер открывает раздел `Администраторы` и может выбрать создание администратора или суперадминистратора.
- [x] Выбор роли содержит только backend-разрешённые административные роли и виден только когда доступно больше одного варианта.
- [x] Суперадминистратор в том же разделе может создать только администратора и не видит возможности создать суперадминистратора.
- [x] При выборе администратора форма требует активный филиал; при выборе суперадминистратора поле филиала скрыто, очищено и в сохранённой записи `branchId` равен `null`.
- [x] Запрещённая попытка создать или изменить роль прямым API-запросом возвращает стабильный ProblemDetails, не создаёт пользователя и не пишет ложный success audit.
- [x] Раздел `Тренеры` показывает и позволяет создавать/редактировать только тренеров (`Coach`) без выбора административных ролей.
- [x] Существующие правила редактирования суперадминистраторов, администраторов и тренеров не ослаблены.
- [x] Успешное создание каждой разрешённой роли сохраняет корректные audit actor, target role и scope.
- [x] Primary create-flow остаётся достижимым и понятным на 390 x 844, 420 x 912, 440 x 956 и в compact-height 912 x 420 / 956 x 440.

## Test checklist
- [x] До production-кода добавить backend integration tests для матрицы actor × target role через используемые staff endpoints.
- [x] Проверить HeadCoach: создание `Administrator` с филиалом и `SuperAdministrator` без филиала.
- [x] Проверить SuperAdministrator: создание `Administrator` разрешено, создание `SuperAdministrator` и `HeadCoach` запрещено.
- [x] Проверить, что trainer list/create/edit contract возвращает и изменяет только допустимых `Coach`, без frontend-only фильтрации.
- [x] Добавить frontend component tests раздела администраторов для одно- и двухвариантных `createRoleOptions`, branch field и payload.
- [x] Добавить frontend regression tests, что раздел тренеров не показывает выбор административной роли.
- [x] Добавить Playwright-покрытие основного mobile workflow и permission-restricted варианта.
- [x] Запустить backend tests.
- [x] Запустить frontend lint, unit tests и build.
- [x] Подтвердить поиском, что bot не потребляет изменённые staff transports; bot code/contract не изменён, поэтому отдельный ruff/pytest не требовался.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача меняет UI и, возможно, transport contract привилегированного создания пользователей; ошибка может нарушить role/permission boundary или scope филиала.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/processed/2026-07-26.md`
- Original note: `создание супер администратора надо перенести в раздел создания Администраторов, там необходимо реализовать выбор какого пользователя надо добавить Администратор или СуперАдминистратор, этот выбор доступ только  для главного тренера, все остальные могут создать только администратора, также приведи в порядок окно создание тренера, там должно остаться только создание -редактирование тренеров`

## Processing notes
- Created at: 2026-07-26 16:28
- Created by skill: codex-backlog-skill
- Duplicate check: завершённая TASK-082 реализовала роль и authorization matrix, а TASK-054 убрала ручной выбор роли из прежних раздельных форм; новая заметка является отдельным follow-up по переносу SuperAdministrator flow и очистке trainer workflow.
- Approved for risky implementation by the user: 2026-07-26
- Implementation branch: `feature/TASK-091-administrator-role-creation-flow`

## Completion notes
- Backend staff transports разделены на административную и trainer role family с повторной проверкой target family после locked reload.
- `/settings/administrators` управляет `Administrator | SuperAdministrator`; `/users` остаётся Coach-only с точным HeadCoach self-update compatibility exception.
- Административная панель вынесена из `SettingsScreen`, использует backend role/options/actions, controlled role/branch state и mobile temporary-surface contract.
- Новых миграций и изменений схемы БД нет.
- Проверено: backend 394/394; frontend unit 285/285; Chromium E2E 111/111; iPhone WebKit 10/10; lint и build.
- Compose-стенд развёрнут с нуля после удаления named volumes, затем пересобран из финального рабочего дерева; db/backend/frontend/bot healthy, health checks возвращают 200.
