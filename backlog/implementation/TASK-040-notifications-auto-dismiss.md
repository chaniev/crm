# TASK-040: Добавить автоматическое скрытие frontend-уведомлений

## Status
implementation

## Implementation lifecycle
- moved_to_implementation_at: 2026-05-15 00:15
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-040-notifications-auto-dismiss.plan.md
- implementation_branch: feature/TASK-040-notifications-auto-dismiss

## Goal
Уведомления в CRM автоматически скрываются через понятный общий интервал и не требуют от пользователя ручного закрытия в обычных success/error сценариях.

## Context
В inbox есть заметка: "автоматичское скрытие уведомлений". Во frontend уже используется `@mantine/notifications`, а глобальный контейнер подключен в `frontend/src/main.tsx`.

## User role
все пользователи CRM

## Problem
Если уведомления остаются на экране слишком долго или накапливаются, они мешают работе и могут перекрывать интерфейс.

## Scope
- Проверить текущие вызовы `notifications.show` во frontend.
- Ввести единый auto-close behavior для обычных in-app уведомлений.
- Настроить общий интервал скрытия на уровне `Notifications` или через локальный helper, если так принято в коде.
- Оставить возможность явно делать уведомление постоянным только для критичных случаев, если такие есть.
- Проверить, что уведомления не перекрывают важные действия на desktop и mobile.

## Out of scope
- Bot-уведомления, scheduler, delivery log и напоминания.
- Изменение backend event/notification semantics.
- Push-уведомления и внешние каналы доставки.

## Constraints
- Задача относится к frontend in-app notifications, не к Telegram-боту.
- Не ломать текущие тексты уведомлений и обработку ошибок.
- Если будет добавлен helper, не превращать задачу в широкий рефактор всех feature-модулей без необходимости.

## Acceptance criteria
- [ ] Обычные frontend-уведомления автоматически скрываются через единый интервал.
- [ ] Ошибки, success-сообщения и информационные уведомления сохраняют текущий смысл.
- [ ] Нет накопления уведомлений после повторных действий пользователя.
- [ ] Поведение проверено на desktop и mobile viewport.
- [ ] Задача не меняет bot notification scheduler и backend notification rules.

## Test checklist
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Вручную проверить несколько уведомлений в клиентах, группах, посещаемости и настройках.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: локальное frontend UX-изменение вокруг существующего Mantine notifications provider.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/inbox/2026-05-14.md`
- Original note: `автоматичское скрытие уведомлений`

## Processing notes
- Created at: 2026-05-14 13:01
- Created by skill: codex-backlog-skill
- Duplicate check: не дубликат `TASK-012-bot-notification-scheduler-design`, потому что текущая заметка относится к frontend in-app уведомлениям, а `TASK-012` - к Telegram bot scheduler and delivery correctness.
