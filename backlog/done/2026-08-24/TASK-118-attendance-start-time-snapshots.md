# TASK-118: Зафиксировать историческое время занятия в посещении

## Status
done

## Goal
Историческое посещение использует время фактически зафиксированного занятия и
не меняет порядок, отображение или acknowledgement boundary после последующих
изменений расписания группы.

## Context
TASK-117 вводит отдельное время начала для каждого weekday, но намеренно
сохраняет текущую mutable-семантику: время старого attendance event вычисляется
по актуальному расписанию группы, а для удалённого weekday используется самое
раннее текущее время. Это совместимо с текущей моделью, но не даёт неизменяемой
истории.

## User role
Администратор / главный тренер / тренер отмечает посещение; система использует
историческое время для attendance history, пропусков и acknowledgement boundary.

## Problem
Если после занятия изменить или удалить weekday/time группы, старые attendance
rows начинают получать другое вычисленное время. Это может изменить порядок
исторических событий и представление фактически прошедшего занятия.

## Scope
- Определить backend-owned snapshot времени начала для attendance/session и
  выбрать минимальную persistence-модель без дублирования schedule rules.
- При первом создании attendance event разрешать время по authoritative
  расписанию группы и `TrainingDate`, затем сохранять нормализованный local
  `TimeOnly` snapshot.
- Не изменять snapshot при повторной отметке present/absent, редактировании
  группы или удалении weekday из актуального расписания.
- Использовать snapshot в attendance history, client-attention ordering,
  missed-training calculations и acknowledgement boundary.
- Обеспечить одинаковую семантику для web и internal bot write paths.
- Обновить clean initial schema, EF model/snapshot и seed/test fixtures.
- Если требуется сохранить существующую БД, добавить forward migration и
  явно документированный deterministic backfill. Старое фактическое время,
  которого нет в данных, нельзя выдавать за восстановленное.
- Добавить audit/contract/persistence regressions на неизменность истории после
  изменения расписания.

## Out of scope
- Несколько занятий одной группы в один weekday.
- Calendar exceptions, переносы, отмены и общий session-generation subsystem
  за пределами минимальной persistence-модели snapshot.
- Изменение attendance eligibility, permissions или trainer substitution rules.
- Восстановление неизвестного фактического времени старых rows без достоверного
  источника данных.
- Реализация TASK-117 или изменение её group schedule contract.

## Constraints
- Backend остаётся единственным владельцем разрешения schedule entry по дате.
- Snapshot является local wall-clock `HH:mm` без timezone conversion.
- Одна и та же attendance row не получает новое snapshot-время при повторной
  записи или изменении текущего расписания.
- Existing acknowledgement idempotency и `MarkedAt` protection сохраняются.
- Migration/backfill не должен молча представлять вычисленное текущее время как
  достоверное историческое время.
- Backend contract changes обновляют frontend и bot consumers синхронно.

## Acceptance criteria
- [ ] Новое посещение сохраняет start-time snapshot, соответствующий weekday его
  `TrainingDate` на момент первого создания.
- [ ] Последующее изменение или удаление schedule entry группы не меняет
  snapshot существующего посещения.
- [ ] Повторное сохранение present/absent не перезаписывает snapshot.
- [ ] Attendance history и client-attention ordering используют snapshot, а не
  текущее расписание группы.
- [ ] Acknowledgement boundary остаётся стабильной после изменения расписания.
- [ ] Web и bot создают одинаковые snapshots через backend-owned логику.
- [ ] Clean schema воспроизводима; при необходимости forward migration/backfill
  имеет явную проверяемую политику для legacy rows.
- [ ] Permissions, attendance idempotency и unrelated membership/financial
  semantics не меняются.

## Test checklist
- [ ] Добавить unit tests date-to-entry resolution и snapshot immutability.
- [ ] Добавить integration tests create/re-mark attendance, затем изменить и
  удалить weekday/time группы и проверить неизменность истории.
- [ ] Проверить missed-training ordering и acknowledgement boundary до/после
  изменения расписания.
- [ ] Проверить одинаковое поведение web и internal bot attendance writes.
- [ ] Проверить clean PostgreSQL schema и conditional migration/backfill path.
- [ ] Запустить полный backend regression и затронутые frontend/bot tests.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача меняет историческую attendance-семантику, persistence,
  migration/backfill и границы расчёта пропусков; неверный snapshot может
  исказить историю посещений.

## Source notes
- Source file:
  `backlog/done/2026-08-24/TASK-117-group-weekday-specific-start-times.plan.md`
- Original note: по итогам review TASK-117 пользователь принял текущий mutable
  fallback для TASK-117 и отдельно запросил задачу на immutable historical
  start-time snapshots.

## Processing notes
- Created at: 2026-08-16 18:07 MSK
- Created by skill: codex-backlog-skill
- Duplicate check: активного дубликата не найдено; TASK-067 хранит только
  acknowledgement boundary для пропусков, а TASK-117 меняет group schedule и
  явно оставляет snapshots за пределами своего scope.

## Completion record
- Completed by superseding implementation: TASK-119, candidate `5a5cabe`.
- Historical time is preserved on the materialized `LessonOccurrence` together
  with duration, hall, source identity and effective trainers; attendance has a
  required occurrence FK instead of a separate mutable group/date snapshot.
- Ambiguous legacy rows are blocked by a durable report/manual-resolution gate;
  clean bootstrap and PostgreSQL transition/concurrency regressions passed.
- moved_to_done_at: 2026-08-24
- last_status_reviewed_at: 2026-08-24
