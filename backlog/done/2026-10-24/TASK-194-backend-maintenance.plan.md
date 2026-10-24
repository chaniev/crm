# Implementation Plan: TASK-194 Backend maintenance

## Metadata
- source_task: /backlog/done/2026-10-24/TASK-194-backend-maintenance.md
- requirements: REQ-AUD-001 (implements), REQ-BRN-001 (constrains), REQ-BRN-002 (constrains)
- branch: codex/TASK-194-backend-maintenance
- readiness: yes
- product_decisions: none — восстанавливается обязательная согласованность аудита, действующие права и контракты сохраняются.
- technical_decisions: none — используются уже применяемые EF-транзакции и зарегистрированный контекст без новых механизмов или границ.
- architecture_decisions: none — локальные обратимые изменения в существующих модулях; широкая перестройка слоёв исключена.
- open_questions: none
- dependencies: локальный main 59765b7, включая интегрированную TASK-191; это база сравнения maintenance diff.
- risk: medium — транзакции настроек и startup миграций требуют проверки PostgreSQL и отказов.

## Goal
Удалить остатки заменённых реализаций и избыточный runtime-discovery,
устранить подтверждённую возможность сохранения настроек без обязательного аудита.

## Decisions and contracts
- Существующий шаблон BranchEndpoints.CreateBranchAsync/CreateHallAsync:
  mutation SaveChanges, audit WriteAsync, commit общей транзакции;
  тестовый InMemory-провайдер остаётся без транзакций.
- Распространить этот шаблон на изменение филиала, изменение/архивацию/
  восстановление/удаление зала, создание/изменение/удаление типа группы,
  смену пароля и привязку клиентского Telegram по одноразовому токену.
  Новые locks, retries, isolation levels и формы ProblemDetails не вводятся.
- Persistence startup использует GymCrmDbContext и Database.MigrateAsync.
  ApplyMigrationsOnStartup и FailStartupOnMigrationError сохраняются,
  PrepareLoginIdentityUpgradeAsync по-прежнему выполняется раньше.
- Удаление ограничивается приватными методами с подтверждённой недостижимостью
  и internal ScheduleLessonMutationRequest, обслуживавшим только неподключённые handlers.
  API/CLI, переходы retained-data, operational flags и общие ресурсы сохраняются.

## Decision evidence
- [Исходный запрос и ограниченный scope](/backlog/done/2026-10-24/TASK-194-backend-maintenance.md).
- [Обязательные audit/persistence-инварианты](/backend/AGENTS.md) и
  [принятый журнал действий](/docs/requirements/06-аудит.md).
- Существующий транзакционный шаблон:
  [BranchEndpoints](/backend/src/GymCrm.Api/Auth/BranchEndpoints.cs),
  [проверка отката создания](/backend/tests/GymCrm.Tests/BranchSettingsPostgreSqlTests.cs).

## Implementation slices
1. Добавить PostgreSQL-регрессии отказа аудита для восьми операций настроек;
   подтвердить red на неизменённой реализации. Добавить characterization startup
   (отключение, ошибка с разной политикой, успешный повторный запуск), получить green.
2. Добавить недостающие транзакции в существующие обработчики; получить green.
3. Удалить подтверждённые dead private methods; заменить discovery миграций
   типизированным вызовом и повторить startup/scenario-проверки.
4. Проверить итоговый diff, актуализировать evidence и реестр требований,
   выполнить diff-selected harness от dependency base. Сохранить коммит в task-ветке.

Второй проход обнаружил тот же разрыв между сохранением и аудитом в
AuthEndpoints.ChangePasswordAsync и ClientMessengerService.HandleStartTokenAsync.
Вызывающий polling worker также не открывает транзакцию. До исправления этих двух
операций добавить PostgreSQL-регрессии: отказ аудита сохраняет прежний пароль,
не расходует link token и не создаёт привязку; повтор после устранения отказа
успешен и создаёт одну audit row. Это применение того же инварианта, без новой
политики безопасности, протокола Telegram или изменений Python bot.

## Likely files and layers
- backend/src/GymCrm.Api/Auth/BranchEndpoints.cs — транзакции и неиспользуемые snapshots.
- backend/src/GymCrm.Api/Auth/GroupTypeEndpoints.cs — транзакции CRUD.
- backend/src/GymCrm.Api/Auth/AuthEndpoints.cs — атомарность смены пароля и аудита.
- backend/src/GymCrm.Infrastructure/Messenger/ClientMessengerService.cs — атомарность привязки и аудита.
- backend/src/GymCrm.Api/Auth/ScheduleEndpoints.cs — неподключённые старые handlers.
- backend/src/GymCrm.Api/Auth/ScheduleLessonResponses.cs — их неиспользуемый internal request.
- backend/src/GymCrm.Api/Auth/ClientMembershipRequestValidation.cs — приватные остатки прежней валидации.
- backend/src/GymCrm.Infrastructure/Attendance/AttendanceTransitionService.cs — недостижимый private query.
- backend/src/GymCrm.Infrastructure/Bot/BotApiService.cs — недостижимый private query; Bot API сохраняется.
- backend/src/GymCrm.Api/Startup/PersistenceStartupExtensions.cs — явный контекст и миграции.
- backend/tests/GymCrm.Tests — failure regressions и startup characterization.

## Regression specification
- Отказ вставки соответствующей audit row через SaveChangesInterceptor:
  HTTP 500, неизменный полный snapshot настроек, отсутствие частично сохранённых
  новых audit rows; ранее сохранённый аудит входа остаётся. После отключения
  инъекции отказа повтор проходит; новый DbContext видит изменение и одну audit row.
- Startup disabled не разрешает DbContext; default/true failure policy пробрасывает
  ошибку и пишет error log; false логирует и продолжает; реальная PostgreSQL после
  повторного startup сохраняет данные и набор применённых миграций.
- Expected red: восемь настроечных операций сейчас оставляют сохранённое изменение.
  Для dead-code cleanup и startup characterization искусственный red неприменим:
  наблюдаемое поведение до рефакторинга должно проходить новые проверки.
- Regression barrier: существующие auth/CSRF/settings/schedule/migration тесты плюс
  новые PostgreSQL/startup проверки. Дополнительный ручной UI-check не требуется:
  UI и публичные контракты не меняются.

## Risks and stop conditions
- Обнаружение исполняемого/внешнего потребителя исключает метод из удаления.
- Новый технический или продуктовый выбор возвращает только зависимую часть
  в planning; текущие права и migration/rollback semantics не расширяются.

## Execution evidence
- Preflight принятого scope прошёл до изменений, включая дополнительный проход
  двух операций с тем же нарушением audit-инварианта.
- Red: восемь операций настроек оставляли сохранённые изменения при отказе аудита;
  отдельно воспроизведены сохранённый новый пароль и израсходованный токен Telegram.
- Startup characterization: 5/5 green до удаления reflection.
- Первый полный запуск выявил внесённую несовместимость IsRelational с конфигурацией
  старого InMemory test host. Использована уже принятая проверка ProviderName;
  исходные assertions и test host сохранены, сценарий успешно повторён.
- Diff-selected harness: backend 708/708, frontend 750/750, Release build,
  format, lint, typecheck, guards, frontend production build, dependency audits
  и knowledge validators прошли. Frontend build сохранил предупреждение о chunk >500 kB.
- После этого дополнены успешные PostgreSQL-повторы для восьми настроечных операций;
  полный backend baseline и knowledge validators прошли на итоговом тесте:
  708/708, без пропусков, Release build без предупреждений, dependency audit без уязвимостей.
- Результаты локальных запусков: [initial baseline](TASK-194-evidence/history/initial-baseline.json),
  [final backend](TASK-194-evidence/history/final-backend.json).
- База не менялась: 59765b7. За время работы main/origin/main продвинулись до
  addc759 через TASK-193 (harness/docs); production code не пересекается с этой задачей.

Команды итоговой проверки из корня task worktree:

```sh
python3 scripts/harness/verify_change.py --base 59765b7 --task-id TASK-194
python3 scripts/harness/verify_change.py --profile full --area backend --area requirements --base 59765b7 --task-id TASK-194 --report .artifacts/verification/TASK-194-final-backend.json
```

Повтор ограничен backend/requirements, поскольку после первого полного baseline
менялись только PostgreSQL assertions и описание evidence. Frontend и production
код сохраняют проверенный вариант. Реальные миграции и HTTP/service-сценарии
проверены с PostgreSQL 17 в изолированных Testcontainers; постоянный Compose stack
для задачи не создавался. Playwright не запускался: UI и публичные контракты
не изменены. Финальный diff просмотрен, `git diff --check` пройден.


## Integration completion
24.10.2026 пользователь запросил «влей в main». Main `addc759` объединён в
ветку задачи без конфликтов; подготовлен чистый candidate `852ea36`.

```sh
python3 scripts/harness/verify_change.py --base addc759 --task-id TASK-194 --report .artifacts/verification/TASK-194-integration/verification.json
python3 scripts/harness/aggregate_evidence.py --input-dir .artifacts/verification/TASK-194-integration --report .artifacts/verification/TASK-194-integration/gate.json --require-task-id TASK-194 --require-report verification.json
```

13/13 checks и gate прошли. Main fast-forward до проверенного commit/tree;
backend 708/708 и frontend 750/750. [Evidence](TASK-194-evidence/verification.json)
сохранено вместе с [gate](TASK-194-evidence/gate.json). Последующее закрытие
карточки меняет только knowledge artifacts; application code остаётся проверенным.
