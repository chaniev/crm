# TASK-049: Настраиваемое название клуба при деплое

## Status
risky

## Goal
При деплое CRM можно задать название клуба, и пользовательский интерфейс показывает это название вместо `Gym CRM`.

## Context
В inbox есть заметка: сейчас приложение называется `Gym CRM`, но нужно иметь возможность при деплое задавать название клуба с заменой `Gym CRM` на заданное значение.

## User role
администратор / владелец / система

## Problem
Захардкоженное название `Gym CRM` мешает разворачивать CRM для конкретного клуба без ручных правок интерфейса или сборки.

## Scope
- Найти пользовательские места во frontend, где отображается `Gym CRM`.
- Добавить единый источник конфигурации для названия клуба на deploy/runtime уровне.
- Обеспечить fallback на текущее название, если значение не задано.
- Обновить deployment/runtime configuration, чтобы название можно было передать при деплое.
- Обновить документацию или пример env/config, если в проекте уже есть такой файл.

## Out of scope
- Полный white-label branding: логотипы, цвета, домен, email-шаблоны, favicon.
- Мультитенантность и разные названия клубов внутри одного deploy.
- Хранение названия клуба как CRM business entity в backend.
- Изменение прав доступа, ролей, филиалов, абонементов или расписания.

## Constraints
- Frontend не должен дублировать CRM business rules.
- Runtime/deployment config должен иметь безопасное значение по умолчанию.
- Нельзя ломать локальный dev-запуск без дополнительных обязательных переменных.
- Нужно заменить только пользовательские brand-вхождения, не технические исторические документы backlog.
- Если название приходит из backend, контракт должен быть явно покрыт и обновлен у потребителей.

## Acceptance criteria
- [ ] При заданном deploy/runtime значении в UI отображается название клуба вместо `Gym CRM`.
- [ ] При незаданном значении приложение продолжает показывать корректный fallback.
- [ ] Все пользовательские вхождения `Gym CRM` во frontend либо заменены на конфиг, либо явно оставлены как технические/исторические.
- [ ] Deployment/runtime пример показывает, как задать название клуба.
- [ ] Локальный dev-запуск работает без дополнительных ручных шагов.

## Test checklist
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Проверить UI с заданным названием клуба.
- [ ] Проверить UI без заданного названия клуба.
- [ ] Если изменен backend/config contract, запустить backend tests и validate affected consumers.

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
