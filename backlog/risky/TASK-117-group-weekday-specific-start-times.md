# TASK-117: Поддержать разное время занятий группы по дням недели

## Status
risky

## Goal
Одна группа может заниматься в разные дни недели в разное время, например по будням вечером, а в субботу утром.

## Context
Завершённая TASK-034 ввела одну `trainingStartTime`, общий `durationMinutes` и набор `weekdays` для группы. Schedule API и frontend размножают это одно время по выбранным дням.

Новая заметка требует как минимум одно отдельное время начала для каждого выбранного weekday внутри той же группы.

## User role
Администратор / главный тренер создаёт и редактирует группу; тренер просматривает расписание и отмечает посещение.

## Problem
Текущая модель не может выразить обычное расписание группы с отличающимся субботним временем без создания отдельной группы или неверного отображения.

## Scope
- Заменить пару `trainingStartTime + weekdays` структурированными weekday schedule entries с одним start time на weekday.
- Сохранить общий `durationMinutes` для группы; разная длительность по дням не входит в эту задачу.
- Определить backend contract, validation, deterministic ordering и persistence для непустого уникального набора weekdays.
- Обновить reproducible initial DB state, model snapshot и seed data; если при
  реализации обнаружится сохраняемая БД, добавить forward migration с
  детерминированным переносом legacy weekdays на прежнее общее время.
- Обновить create/edit group forms и schedule read model/consumer.
- При выборе нового weekday автоматически копировать время ближайшего ранее
  выбранного ISO-дня с непустым временем; если такого дня нет, оставлять поле
  пустым. После копирования значения редактируются независимо.
- Обновить bot и другие consumers, если они читают изменённый group schedule contract.
- Сохранить permissions, audit и ProblemDetails semantics.
- Добавить regression tests на round-trip и отображение разных времён одной группы.

## Out of scope
- Несколько занятий одной группы в один weekday.
- Разная длительность занятия по дням.
- Календарные исключения, праздники, переносы, отмены и замены тренера.
- Редактирование из schedule calendar.
- Новая conflict-resolution или hall-capacity logic.
- Неизменяемые snapshots времени исторических занятий; это отдельная TASK-118.

## Constraints
- Backend владеет schedule validation и contract semantics.
- Weekday uses ISO `1..7`; entries уникальны по weekday и возвращаются в стабильном порядке.
- Каждый `startTime` остаётся local `HH:mm` без timezone conversion.
- Изменение contract требует обновить всех consumers и affected tests.
- Existing attendance, historical financial data и group permissions не должны меняться побочно.
- Историческое attendance-время в рамках TASK-117 продолжает вычисляться по
  текущему расписанию с fallback на самое раннее время, если weekday удалён.
- Create/full update/trainer-only update используют общую сериализацию
  group-агрегата и атомарно сохраняют CRM state вместе с audit.
- Общей между слоями является JSON-схема `{ weekday, startTime }`, а не API CLR
  type; DTO принадлежат своим слоям и явно маппятся.
- Frontend не должен выводить расписание из display strings или дублировать validation rules.

## Acceptance criteria
- [ ] Одна группа сохраняет, например, `Пн 18:00`, `Ср 18:00`, `Сб 10:00` и возвращает те же entries после reload.
- [ ] Create/edit form позволяет задать одно время для каждого выбранного weekday без дублирования дня.
- [ ] Новый выбранный день копирует время ближайшего ранее выбранного
  заполненного ISO-дня, после чего оба значения остаются независимыми.
- [ ] Schedule API и `/schedule` показывают каждое занятие в правильном дне и времени.
- [ ] Общая длительность применяется к каждому entry и не меняется побочно.
- [ ] Пустой набор, duplicate weekday и невалидное время возвращают стабильный ProblemDetails без частичной записи.
- [ ] Permission, audit, idempotency и concurrent update behavior остаются согласованными.
- [ ] Чистая БД создаётся из initial schema; если требуется сохранить
  существующую БД, forward migration переносит legacy equal-time rows без
  потери данных до удаления старых колонок.
- [ ] Затронутые backend/frontend/bot consumers компилируются и проходят tests.

## Test checklist
- [ ] Добавить domain/validation tests на unique ISO weekdays, ordering и time round-trip.
- [ ] Добавить backend integration tests create/update/reload и atomic validation failure.
- [ ] Добавить frontend form tests и schedule unit/e2e scenario с разным субботним временем.
- [ ] Проверить existing equal-time schedule и long group names на обязательных viewports.
- [ ] Запустить backend tests, frontend lint/build/unit/e2e и bot ruff/pytest, если contract затрагивает bot.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача меняет backend schedule contract, persistence и всех потребителей; ошибка может исказить расписание и attendance context.

## Clarification questions
Не требуется для заявленного минимального scope: одно время на weekday при общей длительности. Несколько занятий в день и разная длительность вынесены за границы задачи.

## Source notes
- Source file: `backlog/inbox/2026-08-16.md`
- Original note: `Нет возможности поставить разное время начала тренировки в группе: допустим, в будни время одно, а в субботу у этой же группы время начала другое`

## Processing notes
- Created at: 2026-08-16 16:45
- Created by skill: codex-backlog-skill
- Duplicate check: активного дубликата нет; завершённые TASK-034/TASK-043 являются single-time baseline, а TASK-073 меняет только временную замену тренера.
- Clarified at: 2026-08-16 18:07 MSK — приняты mutable-history fallback,
  общий group-mutation lock, атомарный state+audit, layer-owned DTOs,
  conditional forward migration, copy-from-previous-day UX, удаление дня без
  подтверждения и контекстные имена schedule fields; immutable snapshots
  вынесены в TASK-118.
