# TASK-011: Реализовать загрузку фото клиента через Telegram

## Status
risky

## Goal
Пользователь может заменить или добавить фото клиента из Telegram-бота с подтверждением и audit trail.

## Context
Нужно реализовать ожидание фото, скачивание файла, Bot API endpoint, подтверждение замены, audit event и tests.

## User role
администратор / тренер

## Problem
Фото клиента нельзя загрузить через Telegram-сценарий, хотя это нужно для работы с карточкой клиента.

## Scope
- Спроектировать Telegram flow ожидания фото.
- Скачать файл через Telegram Bot API.
- Добавить или использовать backend Bot API endpoint для обновления фото.
- Добавить подтверждение замены фото.
- Записать audit event и покрыть tests.

## Out of scope
- Массовый импорт фотографий.
- Изменение общей модели файлового хранилища без отдельной задачи.
- Обработка документов и видео вместо фото.

## Constraints
- Backend владеет validation и audit semantics.
- Нужно проверить права пользователя на изменение фото.
- Нельзя заменить фото без понятного подтверждения.
- Нельзя хранить лишние персональные данные в bot state.

## Acceptance criteria
- [ ] Бот переводит пользователя в состояние ожидания фото.
- [ ] Фото скачивается и передается в backend endpoint.
- [ ] Перед заменой существующего фото показывается подтверждение.
- [ ] Audit event создается один раз на успешную замену.
- [ ] Tests покрывают happy path, отмену и forbidden case.

## Test checklist
- [ ] Запустить `cd bot && ruff check .`.
- [ ] Запустить `cd bot && pytest`.
- [ ] При изменении backend запустить `dotnet test backend/GymCrm.slnx`.
- [ ] Вручную проверить Telegram upload flow.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача затрагивает персональные данные клиента, permissions, file upload и audit.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/inbox/2026-05-04.md`
- Original note: `Реализовать загрузку фото клиента через Telegram: ожидание фото; скачивание файла; Bot API endpoint; подтверждение замены; audit event; tests.`

## Processing notes
- Created at: 2026-05-07 11:26
- Created by skill: codex-backlog-skill
- Duplicate check: existing task folders were empty before processing; no duplicate found.
