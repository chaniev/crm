# ADR-0008: Единая серверная проекция фактического расписания

- **Статус:** Accepted (пользователь, владелец проекта, 2026-11-17)
- **Дата:** 2026-11-17
- **Автор / владелец:** Codex / пользователь проекта

## Связанные требования
- REQ-BOT-003 — implements принятую 17.11.2026 редакцию
- REQ-GRP-004 — constrains
- REQ-ATT-002 — constrains
- REQ-ATT-003 — constrains
- REQ-BOT-002 — constrains

## Контекст
ScheduleEndpoints и BotApiService повторяют recurring expansion и effective-trainer resolution. Web накладывает сохранённые занятия на серию, а Bot оставляет recurring значения и обычно не показывает one-off. Пользователь поручил общий серверный read model, затем принял единые фактические занятия и отменённые строки без кнопки.

## Критерии выбора
Одна серверная реализация дат, идентичности, materialized precedence и действующих тренеров. Сохранить scope, даты, transaction integrity и HTTP shapes. Не вводить framework, schema или concurrency mechanisms.

## Рассмотренные варианты
### Вариант A: Общая проекция фактического календаря
Выделить текущий web overlay и чтение в общий backend read model; оба consumers отображают одни факты. Соответствует принятой новой редакции REQ-BOT-003. Цена — согласованные изменения Bot list/locator и Python кнопок.
### Вариант B: Общие recurring primitives с двумя композициями
Был предложен 16.11.2026 для behavior-preserving extraction. После решения владельца о единых фактических занятиях не соответствует целевому поведению.
### Вариант C: Копировать web overlay в Bot
Может дать тот же результат сейчас, но сохраняет дублирование и не выполняет исходное поручение общего read model.

## Решение
Выбран A. Application содержит transport-free typed facts и общую проекцию: stable occurrence identity, actual date/time/duration, group/hall, status, effective trainers, source revision и attendance availability. Материализованное занятие заменяет recurring запись, перенос подавляет прежнюю дату, оставшиеся one-off/materialized записи добавляются. Infrastructure загружает scoped sources через существующий IAccessScopeService без записи при чтении.

Staff API сохраняет DTO mapping, capabilities, revisions, filterOptions до фильтрации и текущий порядок фильтров/сортировки. Bot list использует ту же проекцию и прежний DTO shape. Bot resolver подтверждает точный ID и actual date; старый locator — существующий NotFound. Cancelled write отклоняется существующим InvalidAttendanceDate, чтение roster сохраняется. Повторные проверки actor/scope в roster/save/response сохраняются. AttendanceService не переписывается: проверка actual date/status внутри mutation transaction остаётся финальной защитой записи.

Python отображает backend facts и фильтрует кнопки по canEditAttendance. Строка отменённого занятия остаётся видимой. Схема диалога и idempotency не меняются.

## Последствия
- Дублирование правил фактического расписания устраняется; Bot получает принятые переносы, отмены, one-off и замещения.
- Shared contract связывает проверки producer и обоих consumers; harness выбирает frontend и Bot проверки для новой границы.
- Риск потери web revision/filter semantics защищается existing API tests и независимым review.
- Гарантии сериализации параллельных schedule mutations не усиливаются: сохраняются транзакции и rechecks, без новых locks/leases/retries.
- Существующее ограничение Coach save по постоянному GroupTrainers (при более широком substitution read scope) не исправляется скрыто; права не расширяются.

## Cross-layer impact
- Backend: Application projection/contracts, Infrastructure reader, Staff mapping, Bot list/locator, HTTP regressions.
- Frontend: DTOs и workflow unchanged; consumer baseline обязателен.
- Bot: renderer сохраняет строки, selector использует backend flags; unit/contract regressions.
- Deploy/runtime: без изменений.
- Public or internal contracts: HTTP shape unchanged; новая shared Scheduling boundary синхронизируется с harness.

## Migration and rollback
Схема и данные не меняются; rollback через revert task commit. Чтение не материализует занятия, snapshots посещений не переписываются. Revert вернёт прежнее расхождение Bot.

## Validation
Test-first HTTP evidence: равные IDs/actual facts, moved old locator rejection, cancellation/restore, one-off, effective trainers/scope, no writes on read. Stale save после совершённого изменения не создаёт attendance/audit/pending reservation. Python mixed/all-cancelled lists без кнопок, backend flag restrictions и существующее error/idempotency behavior. Existing ScheduleLessonsApiTests, InternalBotApiTests, AttendanceApiTests и PostgreSQL suites; полный backend/frontend/bot/harness baseline.

## Open questions
- Нет.

## Approval
Основание — совокупность явных решений владельца в текущем чате: выполнить предложенный общий серверный read model; после предложения разных сборок «Сначала согласуем единое поведение бота и календаря»; затем «Принимаю эти правила» для конкретных единых фактических занятий и «Показывать „Отменено“ без кнопки». [Запрос, принятый контракт и review](/backlog/done/2026-11-17/TASK-199-schedule-read-model.md). Имена типов и DI — детали исполнения выбранной общей модели, не отдельные пользовательские решения. Независимое review 17.11.2026 не обнаружило дополнительных material choices.
