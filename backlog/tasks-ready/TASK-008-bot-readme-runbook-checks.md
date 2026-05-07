# TASK-008: Обновить README и команды проверки Telegram-бота

## Status
ready

## Goal
Разработчик может настроить, запустить и проверить Telegram-бота по README без устных подсказок.

## Context
Нужно обновить README: создание Telegram-бота, настройка `.env`, запуск long polling, проверка health endpoints, типовые ошибки и troubleshooting. Также нужны явные команды проверки для `bot/` в README или `pyproject` scripts.

## User role
система

## Problem
Документация запуска и проверки бота неполная, из-за чего MVP сложнее повторно проверить и поддерживать.

## Scope
- Найти актуальные bot README/документацию.
- Добавить пошаговую настройку Telegram-бота.
- Описать `.env`, long polling, health endpoints и troubleshooting.
- Добавить явные команды проверки для `bot/`.

## Out of scope
- Изменение runtime behavior бота.
- Внедрение production webhook.

## Constraints
- Документация должна соответствовать текущим config names и scripts.
- Не документировать несуществующие команды.

## Acceptance criteria
- [ ] README содержит шаги создания Telegram-бота.
- [ ] README содержит настройку `.env` и запуск long polling.
- [ ] README описывает health endpoints и типовые ошибки.
- [ ] Команды `ruff` и `pytest` легко найти и выполнить.

## Test checklist
- [ ] Проверить команды из README локально.
- [ ] Запустить `cd bot && ruff check .`.
- [ ] Запустить `cd bot && pytest`.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: documentation-only задача с локальной проверкой команд.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/inbox/2026-05-04.md`
- Original note: `Обновить README: пошаговое создание Telegram-бота; настройка .env; запуск long polling; проверка health endpoints; типовые ошибки и troubleshooting. Добавить явные команды проверки для bot/ в README или pyproject scripts.`

## Processing notes
- Created at: 2026-05-07 11:26
- Created by skill: codex-backlog-skill
- Duplicate check: existing task folders were empty before processing; no duplicate found.
