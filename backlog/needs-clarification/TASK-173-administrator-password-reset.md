# TASK-173: Определить восстановление пароля сотрудника

## Status
needs-clarification

## Requirements
- pending — роли инициатора/получателя, филиальный охват, доставка нового секрета и отзыв сессий.

## Requirement context
- [REQ-USR-002](../../docs/requirements/05-пользователи-и-роли.md) — constrains
- [REQ-USR-003](../../docs/requirements/05-пользователи-и-роли.md) — constrains
- [REQ-AUD-001](../../docs/requirements/06-аудит.md) — constrains
- [REQ-NFR-003](../../docs/requirements/08-нефункциональные.md) — constrains

## Goal
Восстанавливать доступ сотрудника с сохранением его учётной записи и истории.

## Context
В UpdateUserRequest нет пароля; текущая смена в AuthEndpoints требует текущий пароль. Inbox предлагает административный сброс, но не определяет матрицу прав и процедуру.

## Scope
- Определить роли и охват восстановления, обязательную смену временного пароля, обработку существующих сессий и аудит без секретов.
- После решения закрепить отдельное требование и провести security/API review; синхронизировать frontend и backend.

## Constraints
- Backend сохраняет владение CRM-правилами; triage не разрешает реализацию.
- По решению пользователя 08.10.2026 в TASK-187 сброс пароля ролью
  Administrator исключён из требований REQ-USR-002. TASK-173 не блокирует
  TASK-187 и не является основанием вернуть это право без нового решения.
- Перед реализацией нужен ready plan по docs/HARNESS.md; для визуальных изменений — применимый design gate.
- При завершении обновить состояние связанных требований и docs/requirements/CHANGELOG.md.

## Acceptance criteria
- [ ] Согласованы инициатор, целевые роли, исключения для себя/Главного тренера и способ передачи временного доступа.
- [ ] Установлены критерии сохранения identity/истории, отказа вне охвата и отсутствия секретов в аудите.

## Test checklist
- [ ] После согласования: разрешённые/запрещённые сочетания ролей и филиалов, повторный сброс, старые сессии, обязательная смена.

## AI safety
- Safe for autonomous implementation: no
- Risk level: high
- Reason: Сброс даёт контроль над чужой учётной записью; без матрицы доступа возможен захват аккаунта.

## Clarification questions
- [ ] Кто кому может сбрасывать пароль: Главный тренер, Супер-администратор?
  Для роли Administrator возможность исключена решением пользователя в TASK-187.
- [ ] Кто задаёт временный пароль, как его передают и должны ли завершаться все текущие сессии?

## Evidence
- [backend/src/GymCrm.Api/Auth/AuthEndpoints.cs](../../backend/src/GymCrm.Api/Auth/AuthEndpoints.cs)
- [frontend/src/lib/api/types.ts](../../frontend/src/lib/api/types.ts)
- [backend/src/GymCrm.Application/Authorization/UserRoleAuthorizationPolicy.cs](../../backend/src/GymCrm.Application/Authorization/UserRoleAuthorizationPolicy.cs)

## Source notes
- Source file: [2026-09-30.md](../processed/2026-09-30.md)
- Source items: 2 (порядок самостоятельных пунктов, без строк-продолжений).
- Источник наблюдений: UI-аудиты 18.09 и 30.09.2026, стенд c2b6cdf; в этом triage новый runtime-аудит не проводился.

> сброс пароля пользователя администратором: пути восстановления в UI/API нет, UpdateUserRequest не содержит пароля — если тренер забыл пароль, помогает только пересоздание учётки
>   (продуктовый пробел, требуется решение владельца)

## Processing notes
- Created at: 2026-10-05 (MSK).
- Created by skill: codex-backlog-skill.
- Mode: triage; scope: два файла inbox, без глобальной сверки статусов.
- Duplicate check: Не дублирует TASK-172 (общие правила пароля) или TASK-187 (создание тренеров).
- Проверены активные карточки, unfinished plans и рекурсивный done; новые ID выделены после TASK-171.
- 08.10.2026: учтено исключение сброса ролью Administrator из REQ-USR-002
  по запросу «убери из требований сборос пароля администратором» в TASK-187.
  Остальные вопросы восстановления доступа остаются не согласованы;
  исходная inbox-цитата выше сохранена как история, не как принятое требование.
