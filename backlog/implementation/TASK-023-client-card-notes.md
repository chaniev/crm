# TASK-023: Добавить заметки в карточку клиента

## Status
implementation

## Implementation lifecycle
- moved_to_implementation_at: 2026-05-07 21:56
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-023-client-card-notes.plan.md

## Goal
Пользователь может хранить рабочие заметки по клиенту прямо в карточке клиента.

## Context
В inbox есть короткая заметка: `Добавить заметки в карточки клиентов`.

## User role
администратор / тренер

## Problem
В карточке клиента нет места для произвольных рабочих комментариев, которые помогают вести клиента.

## Scope
- Уточнить текущую модель клиента и наличие notes/comments fields.
- Если backend поле уже есть, вывести и редактировать его во frontend.
- Если backend поля нет, добавить минимальный backend contract для заметок.
- Добавить validation и tests по затронутым слоям.

## Out of scope
- Полная история комментариев или threaded discussion.
- Уведомления по заметкам.
- Audit trail заметок, если он не требуется существующими правилами.

## Constraints
- Backend владеет validation semantics.
- При backend contract changes обновить frontend consumer.
- Не хранить заметки только во frontend.

## Acceptance criteria
- [ ] В карточке клиента есть блок или поле заметок.
- [ ] Пользователь с правом редактирования может сохранить заметку.
- [ ] Сохраненная заметка видна после перезагрузки карточки.
- [ ] Ошибки сохранения отображаются через существующий error UX.

## Test checklist
- [ ] При backend изменениях запустить `dotnet test backend/GymCrm.slnx`.
- [ ] При frontend изменениях запустить `cd frontend && npm run lint`.
- [ ] При frontend изменениях запустить `cd frontend && npm run build`.
- [ ] Проверить создание, обновление и пустое значение заметки.

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: задача может быть cross-layer, но scope локальный и не относится к опасным CRM-правилам.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/inbox/2026-05-06.md`
- Original note: `Добавить заметки в карточки клиентов`

## Processing notes
- Created at: 2026-05-07 11:26
- Created by skill: codex-backlog-skill
- Duplicate check: existing task folders were empty before processing; no duplicate found.
