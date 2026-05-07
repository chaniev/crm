# TASK-009: Определить политику создания таблиц Telegram-бота

## Status
needs-clarification

## Goal
Принять понятное решение, должен ли бот автосоздавать SQLAlchemy tables в dev или runtime должен строго полагаться на Alembic migrations.

## Context
В inbox есть вопрос: оставить ли автосоздание SQLAlchemy tables в `GymCrmBotApplication.start()` для dev или перевести runtime строго на Alembic migrations.

## User role
система

## Problem
Смешение dev convenience и production migration policy может привести к расхождению схемы и неожиданному поведению в runtime.

## Scope
- Зафиксировать желаемую policy для dev, test и production.
- Определить, где должны жить migrations и кто их запускает.
- После решения создать отдельную implementation task.

## Out of scope
- Немедленная реализация migration policy.
- Изменение схемы таблиц без утвержденного решения.

## Constraints
- Нельзя ломать локальный developer setup.
- Production schema changes должны быть управляемыми и проверяемыми.
- Runtime/infrastructure changes требуют validation affected services.

## Acceptance criteria
- [ ] Принято решение по dev auto-create behavior.
- [ ] Принято решение по production Alembic-only behavior.
- [ ] Определены проверки для bot runtime startup.
- [ ] Создана отдельная ready/risky implementation task после ответа на вопросы.

## Test checklist
- [ ] Проверить текущий startup path `GymCrmBotApplication.start()`.
- [ ] Проверить текущие Alembic/config механизмы.
- [ ] После реализации проверить bot tests и runtime startup.

## AI safety
- Safe for Codex: no
- Risk level: medium
- Reason: вопрос касается runtime schema policy и migrations.

## Clarification questions
- [ ] В dev нужно сохранять автосоздание таблиц для быстрого запуска?
- [ ] В production допустим ли любой schema write из приложения при старте?
- [ ] Кто отвечает за запуск Alembic migrations для bot storage?
- [ ] Нужно ли разделять policy для local, CI и production?

## Source notes
- Source file: `backlog/inbox/2026-05-04.md`
- Original note: `Решить, оставляем ли автосоздание SQLAlchemy tables в GymCrmBotApplication.start() для dev или переводим runtime строго на Alembic migrations.`

## Processing notes
- Created at: 2026-05-07 11:26
- Created by skill: codex-backlog-skill
- Duplicate check: existing task folders were empty before processing; no duplicate found.
