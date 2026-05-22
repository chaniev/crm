# TASK-049: Настраиваемое название клуба при деплое

## Status
risky

## Goal
При деплое CRM можно задать название клуба, и пользовательский интерфейс показывает это название вместо `Gym CRM`.

## Context
В inbox есть заметка: сейчас приложение называется `Gym CRM`, но нужно иметь возможность при деплое задавать название клуба с заменой `Gym CRM` на заданное значение.

Уточнения от 2026-05-22:
- название клуба задается через env при развертывании;
- для обновления названия допустимо требовать перезапуск backend и frontend;
- frontend/backend contract для передачи названия нужно сделать явно;
- если env не задана, значение по умолчанию - `Gym CRM`;
- значение задает администратор при развертывании, не пользователь CRM внутри интерфейса;
- длинное название в UI нужно обрезать и добавлять `...` в конце.

## User role
администратор / владелец / система

## Problem
Захардкоженное название `Gym CRM` мешает разворачивать CRM для конкретного клуба без ручных правок интерфейса или сборки.

## Scope
- Найти пользовательские места во frontend, где отображается `Gym CRM`.
- Добавить env-настройку названия клуба для deployment.
- Добавить backend config contract, который отдает frontend итоговое название клуба.
- Обеспечить fallback `Gym CRM`, если env не задана или содержит пустое значение.
- Обновить frontend consumer этого contract и использовать название в основных brand-местах интерфейса.
- Обрезать слишком длинное название в ограниченных UI-контейнерах с `...`.
- Обновить deployment/runtime configuration, чтобы администратор развертывания мог передать название клуба.
- Обновить документацию или пример env/config, если в проекте уже есть такой файл.

## Out of scope
- Полный white-label branding: логотипы, цвета, домен, email-шаблоны, favicon.
- Мультитенантность и разные названия клубов внутри одного deploy.
- Хранение названия клуба как CRM business entity в backend.
- Редактирование названия клуба из CRM-интерфейса после развертывания.
- Замена исторических упоминаний `Gym CRM` в backlog/docs/старых планах.
- Изменение прав доступа, ролей, филиалов, абонементов или расписания.

## Constraints
- Frontend не должен дублировать CRM business rules.
- Runtime/deployment config должен иметь безопасное значение по умолчанию.
- Нельзя ломать локальный dev-запуск без дополнительных обязательных переменных.
- Обновление названия может требовать перезапуск backend и frontend; hot reload/runtime update без перезапуска не требуется.
- Источник значения - env, заданная администратором при развертывании.
- Backend должен нормализовать пустое или отсутствующее значение к fallback `Gym CRM`.
- Нужно заменить только актуальные пользовательские brand-вхождения приложения, не технические исторические документы backlog.
- Frontend должен получать название через явный backend contract и не должен иметь отдельную независимую env-логику для этого значения.

## Acceptance criteria
- [ ] При заданном deploy/runtime значении в UI отображается название клуба вместо `Gym CRM`.
- [ ] При незаданной или пустой env-настройке приложение показывает fallback `Gym CRM`.
- [ ] Frontend получает название клуба из backend config contract.
- [ ] Основные пользовательские brand-вхождения `Gym CRM` в актуальном приложении используют значение из config contract.
- [ ] Длинное название клуба не ломает header/sidebar/mobile layout и визуально обрезается с `...`.
- [ ] Deployment/runtime пример показывает, какую env задать при развертывании.
- [ ] Локальный dev-запуск работает без дополнительных ручных шагов.

## Test checklist
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Проверить UI с заданным названием клуба.
- [ ] Проверить UI без заданного названия клуба.
- [ ] Проверить UI с длинным названием клуба.
- [ ] Запустить backend tests для config contract.
- [ ] Validate affected frontend/backend consumers.

## AI safety
- Safe for Codex: no
- Risk level: medium
- Reason: задача затрагивает runtime/deployment configuration и может потребовать cross-layer contract validation.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/inbox/2026-05-21.md`
- Original note: `сейчас название Gym CRM, необходима возможность при деплое задавать название клуба с заменой Gym CRM на заданное название клуба`

## Processing notes
- Created at: 2026-05-22 00:33
- Created by skill: codex-backlog-skill
- Duplicate check: active task folders and completed settings/branding-related backlog were checked; no active duplicate found. `TASK-030` is completed and covers CRM settings dictionaries/administrators, not deploy-time club name branding.
- Clarified at: 2026-05-22 16:55
- Clarification: env is the deployment-time source; backend/frontend restart is acceptable; backend config contract must be implemented; fallback is `Gym CRM`; deployment administrator sets the value; long UI names are truncated with `...`; historical backlog/docs mentions are ignored.
