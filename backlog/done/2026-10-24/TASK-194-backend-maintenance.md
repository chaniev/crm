# TASK-194: Упростить backend по результатам maintenance-аудита

## Status
done

## Source
Прямой запрос пользователя от 24.10.2026 в текущем диалоге:
«[$code-maintenance] приведи в порядок бекенд» после аудита backend/frontend.
Аудит воспроизвёл сохранение типа группы и изменения зала при отказе аудита,
выявил неподключённые приватные обработчики и избыточный reflection в startup.

## Requirements
- REQ-AUD-001 — implements
- REQ-BRN-001 — constrains
- REQ-BRN-002 — constrains

## Scope
- Удалить доказанно недостижимые приватные методы backend после проверки регистрации,
  reflection, истории и потребителей; публичные и legacy-контракты не удалять.
- Применить существующий транзакционный шаблон создания филиала/зала к операциям
  настроек, смене пароля и привязке Telegram, которые сохраняют изменение до
  обязательного аудита без транзакции.
- Заменить reflection запуска миграций прямым обращением к единственному
  зарегистрированному GymCrmDbContext, сохранив оба конфигурационных переключателя,
  логирование, порядок startup и семантику отказа.
- Сохранить DTO, маршруты, права, бизнес-валидацию и структуру базы.

Широкий перенос бизнес-логики расписания между слоями, новые абстракции,
изменения frontend/bot, обновления зависимостей и deployment вне этой задачи.
Это отдельные архитектурные/продуктовые работы, а не локальная чистка.

## Acceptance criteria
- При ошибке записи аудита создание/изменение/удаление настроек полностью
  откатывается в PostgreSQL; сохраняются существующие audit rows.
- Отказ аудита смены пароля сохраняет прежние учётные данные; отказ привязки
  Telegram не расходует токен и не создаёт аккаунт. Повтор после отказа успешен.
- Успешные операции и отказы доступа сохраняют существующий контракт.
- Отключённые миграции не обращаются к базе; включённые применяются повторяемо;
  настройка FailStartupOnMigrationError сохраняет действие.
- Удалённые методы не были зарегистрированы и не имеют исполняемых потребителей.
- Канонические проверки и адресные регрессии проходят.

## Implementation lifecycle
- moved_to_implementation_at: 2026-10-24
- moved_from: direct-user-request
- implementation_plan: /backlog/done/2026-10-24/TASK-194-backend-maintenance.plan.md
- implementation_branch: codex/TASK-194-backend-maintenance
- dependency_base: 59765b7 — локальный main, проверенный предыдущим аудитом; при создании задачи origin/main отставал на 13 коммитов.
- base_drift: во время проверки main/origin/main продвинулись до addc759 (TASK-193,
  два коммита с изменениями harness и документации). Production/backend-файлы
  этой задачи не пересекаются; перед интеграцией main объединён в task-ветку без конфликтов.

## Maintenance evidence
- Удалены 11 приватных методов: прежние cancel/restore handlers и их helper в
  ScheduleEndpoints; два branch snapshot/map helper; четыре неиспользуемых
  membership validator/parser; по одному query в AttendanceTransitionService
  и BotApiService. Удалён также internal ScheduleLessonMutationRequest,
  использовавшийся только неподключёнными handlers.
- Основания удаления: проверены прямые вызовы, регистрации маршрутов/DI,
  reflection и история замен (`5a5cabe`, `ffac884`, `eb9d5e4`). Действующие
  preview/apply расписания и LoadAccessibleSeriesAsync сохраняются.
- Reflection discovery startup заменён явным вызовом зарегистрированного
  GymCrmDbContext. Пять characterization-проверок прошли до изменения:
  отключение, default/true/false политика ошибки, повторяемые миграции PostgreSQL
  с сохранением существующих данных.
- Десять инъекций отказа аудита сначала воспроизвели частичное сохранение;
  транзакции восстановили общий rollback. Подробности сценариев:
  [MutationAuditAtomicityPostgreSqlTests](/backend/tests/GymCrm.Tests/MutationAuditAtomicityPostgreSqlTests.cs).
- Совместимость потребителей: публичные DTO, маршруты и ProblemDetails не
  изменились; удалённый internal DTO не имел регистрации или потребителей
  frontend/bot. Frontend baseline включён harness из-за endpoint-путей;
  Python bot не затронут, его внутренний API не менялся.

## Remaining boundaries
- Перенос бизнес-логики крупных endpoint-модулей между слоями требует отдельного
  архитектурного плана и refactoring review; в эту локальную чистку не включён.
- Operational flags и retained-data compatibility paths сохранены: нет
  эксплуатационных свидетельств, позволяющих считать их устаревшими.
- Интеграция в локальную main выполнена по дополнительному запросу пользователя
  «влей в main». Публикация в origin и deployment в этот запрос не включены.

## Local validation
Локальная реализация завершена и проверена 24.10.2026; ниже сохранены
результаты до интеграции. Итоговая проверка и merge зафиксированы отдельно. Backend: 708/708 тестов (15 новых сценариев),
frontend compatibility baseline: 750/750. Сборки, форматирование, guards,
lint/typecheck, проверки требований и dependency audits прошли.
PostgreSQL-проверки покрывают отказ/повтор десяти операций и повторяемый startup
с сохранением данных; тестовые контейнеры освобождены. Команды, ограничения и
пути JSON evidence приведены в связанном implementation plan.


## Completion evidence
- completed_at: 2026-10-24
- delivered_on_main_at: 2026-10-24
- moved_to_done_at: 2026-10-24
- completion_date_evidence: main fast-forward до `852ea36d23bb61c4154d1ddd051dd0ee7266ab41`; tree `1a2afe026763b5ca36baa688d02822e7c2fc00ca` совпадает с проверенным candidate.
- Прямое разрешение интеграции: пользователь «влей в main» в текущем диалоге.
- На чистом candidate после объединения с main `addc759` выполнен полный
  diff-selected harness: 13/13 checks passed, backend 708/708, frontend 750/750,
  dependency audits passed; aggregate gate passed.
- [Итоговая проверка](TASK-194-evidence/verification.json) и
  [gate](TASK-194-evidence/gate.json). Отчёты сохранены без изменения исходных
  путей контракта и worktree на момент запуска; предыдущие локальные проверки
  сохранены в `TASK-194-evidence/history/` и не используются как merge gate.
- Постоянный runtime stack для задачи не создавался. Testcontainers освобождены.
