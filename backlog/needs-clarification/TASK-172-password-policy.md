# TASK-172: Определить минимальную политику паролей

## Status
needs-clarification

## Requirements
- pending — длина, допустимые символы, переход для существующих пользователей и bootstrap-пароль.

## Requirement context
- [REQ-USR-002](../../docs/requirements/05-пользователи-и-роли.md) — constrains
- [REQ-USR-003](../../docs/requirements/05-пользователи-и-роли.md) — constrains
- [REQ-NFR-003](../../docs/requirements/08-нефункциональные.md) — constrains

## Goal
Создание и смена пароля применяют одну принятую backend-политику, понятную пользователю до отправки формы.

## Context
UserRequestValidator проверяет непустой пароль; AuthEndpoints при смене — непустой и отличный от текущего. Это соответствует REQ-USR-002, где сложность не задана. Новый минимум является изменением требований, а не уже подтверждённой ошибкой реализации.

## Scope
- Согласовать политику для создания сотрудников, самостоятельной/обязательной смены и будущего сброса пароля.
- После решения обновить REQ-USR-002/003 и CHANGELOG; UI получает согласованные подсказки и field-level ошибки от backend-контракта.

## Constraints
- Backend сохраняет владение CRM-правилами; triage не разрешает реализацию.
- Перед реализацией нужен ready plan по docs/HARNESS.md; для визуальных изменений — применимый design gate.
- При завершении обновить состояние связанных требований и docs/requirements/CHANGELOG.md.

## Acceptance criteria
- [ ] Утверждены правила и переход для существующих паролей; bootstrap не создаёт недоступную систему.
- [ ] Все входы установки пароля следуют одной политике; frontend не становится её независимым владельцем.

## Test checklist
- [ ] После согласования: граничные длины, пустые/Unicode/пробельные значения, первый вход и смена; секреты отсутствуют в ответах и логах.

## AI safety
- Safe for autonomous implementation: no
- Risk level: high
- Reason: Несогласованный переход может заблокировать вход; правила безопасности и совместимость требуют review до готовности.

## Clarification questions
- [ ] Какая минимальная длина и нужны ли требования к составу пароля?
- [ ] Применять правила только при установке нового пароля или требовать смену у существующих пользователей; как поступить с bootstrap-паролем?

## Evidence
- [backend/src/GymCrm.Api/Auth/UserRequestValidator.cs](../../backend/src/GymCrm.Api/Auth/UserRequestValidator.cs)
- [backend/src/GymCrm.Api/Auth/AuthEndpoints.cs](../../backend/src/GymCrm.Api/Auth/AuthEndpoints.cs)

## Source notes
- Source file: [2026-09-30.md](../processed/2026-09-30.md)
- Source items: 1 (порядок самостоятельных пунктов, без строк-продолжений).
- Источник наблюдений: UI-аудиты 18.09 и 30.09.2026, стенд c2b6cdf; в этом triage новый runtime-аудит не проводился.

> ввести минимальную политику паролей и показать требования в UI: сейчас при смене пароля принимается «123», при создании тренера — пароль из одного символа, подсказок о требованиях нет
>   (контракт: backend UserRequestValidator.cs проверяет только «не пустой», AuthEndpoints.cs — «не пустой и отличается»; продуктовое решение о минимальной длине/сложности принадлежит backend'у)

## Processing notes
- Created at: 2026-10-05 (MSK).
- Created by skill: codex-backlog-skill.
- Mode: triage; scope: два файла inbox, без глобальной сверки статусов.
- Duplicate check: Отдельной задачи нет. TASK-166/171 касались login identity и startup; TASK-173 будет потребителем общей политики.
- Проверены активные карточки, unfinished plans и рекурсивный done; новые ID выделены после TASK-171.
