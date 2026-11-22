# TASK-226. Изменение логинов в полном тестовом наборе

## Metadata

- source_task: /backlog/done/2026-11-22/TASK-226-local-seed-admin-login.md
- branch: fix/TASK-226-local-seed-admin-login
- readiness: yes
- requirements: REQ-NFR-004 (changes)
- product_decisions: accepted
- technical_decisions: none — меняется только строковый шаблон в существующем генераторе.
- architecture_decisions: none — используются существующие механизм заполнения и схема данных.
- open_questions: none

## Decisions and contracts

Убрать префикс `seed.` у администраторов в полном тестовом наборе. Существующая нумерация даёт логины от `admin01` до `admin05`.

## Decision evidence

- product: [Запрос владельца](/backlog/done/2026-11-22/TASK-226-local-seed-admin-login.md) — owner: владелец CRM; decision: убрать префикс у логинов администраторов при создании тестовых данных.

## Реализация и проверка

В тесте заполнения PostgreSQL проверить пять сохранённых логинов после первого и повторного запуска. Затем исправить шаблон логина в TestDataSeeder, обновить пример входа в README и выполнить обязательные проверки.
