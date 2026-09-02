# ADR-0001: Регистронезависимая идентичность логина через нормализованный ключ

- **Статус:** Proposed
- **Дата:** 2026-09-01
- **Автор / владелец:** TASK-166 (реализация), владелец приёмки — пользователь проекта

## Связанные требования

- REQ-USR-002 — changes (уникальность логина без учёта регистра, field-level ошибка дубля)
- REQ-USR-003 — changes (регистронезависимое сравнение при входе, канонический логин в session/audit/UI)
- REQ-NFR-003 — constrains (backend владеет проверками; frontend не нормализует логин как security decision)

## Контекст

`/auth/login` ищет пользователя точным сравнением `candidate.Login == login`, а
уникальность `IX_Users_Login` регистрозависима. Требуется вход в любом регистре,
одна однозначная учётная запись на логин и сохранение канонического `User.Login`
во всех ответах. Изменение затрагивает authentication lookup, все пути создания
пользователя (staff create, bootstrap, seed/upsert) и PostgreSQL unique
contract, включая обновление retained-баз. Любое расхождение алгоритма
нормализации между .NET и SQL приводило бы либо к ложным конфликтам, либо к
пропуску существующей учётной записи, поэтому источник ключа должен быть
единственным.

## Критерии выбора

- Один детерминированный алгоритм identity comparison, принадлежащий backend
  Domain-слою (REQ-NFR-003; backend owns CRM rules).
- Lookup остаётся индексируемым; конкурентное создание case-only дубля
  останавливается СУБД, а не только application-проверкой.
- Канонический `User.Login` не изменяется: claims, audit, UI получают
  сохранённое значение.
- Retained-database upgrade не выполняет неоднозначных преобразований: коллизии
  — stop condition с actionable диагностикой, без слияния/переименования.
- Семантика не зависит от collation/расширений конкретного PostgreSQL-образа
  (alpine libc `C` lowercase только ASCII — кириллица `LOWER()`-ом не
  приводится).

## Рассмотренные варианты

### Вариант A: регистронезависимый запрос при прежнем уникальном индексе

`EF.Functions.ILike`/`lower(Login) == lower(input)` в lookup, `IX_Users_Login`
остаётся case-sensitive.

- Преимущества: минимальный диф, нет изменения схемы.
- Цена и риски: уникальность не фиксирует регистронезависимую identity —
  `Coach`/`coach` сосуществуют, lookup становится неоднозначным (случайный выбор
  аккаунта); нарушает REQ-USR-002 и security-инвариант non-enumerating login.

### Вариант B: тип `citext` для `Login`

- Преимущества: сравнения нечувствительны к регистру на уровне СУБД без
  отдельной колонки.
- Цена и риски: сравнение зависит от extension и collation окружения; семантика
  каждого существующего сравнения `Login` меняется неявно; EF-маппинг требует
  plugin-зависимостей; canonical display value и identity comparison слипаются в
  одну колонку.

### Вариант C: функциональный уникальный индекс по `LOWER(btrim("Login"))`

- Преимущества: нет дублирующей колонки, уникальность в СУБД.
- Цена и риски: application lookup обязан воспроизводить точное SQL-выражение,
  чтобы попадать в индекс (provider-specific coupling); `LOWER()` зависит от
  collation (в alpine `C` не приводит кириллицу) — расхождение с
  `ToLowerInvariant()` в .NET создаёт недостижимые учётные записи; backfill и
  EF-модель хрупки.

### Вариант D (выбран): сохранённый нормализованный ключ, единый .NET-контракт

Колонка `Users."LoginNormalized"` (`varchar(128) NOT NULL`), уникальный индекс
`UX_Users_LoginNormalized` как concurrency barrier; ключ вычисляет только
`LoginIdentity.NormalizeKey` в `GymCrm.Domain` (`Trim()` + `ToLowerInvariant()`);
синхронизация ключа централизована в `GymCrmDbContext.SaveChanges*` перед каждой
записью `User`; lookup — равенство по ключу; upgrade выполняется в два
миграционных шага с .NET-backfill между ними (см. Migration and rollback), при
коллизии (`Coach`/`coach`) процесс останавливается до замены uniqueness
contract с перечислением конфликтных канонических логинов.

- Преимущества: одна реализация алгоритма (нет .NET/SQL parity-риска и
  collation-зависимости); lookup — простое индексное равенство на всех
  провайдерах; PostgreSQL authoritative для барьера; миграция и runtime
  используют идентичный код — «один наблюдаемый контракт» доказывается тестом
  retained-upgrade, сравнивающим `LoginNormalized` с `LoginIdentity.NormalizeKey`
  по каждой строке.
- Цена и риски: дополнительная колонка и обязанность её синхронизации (закрыта
  центральным перехватом в DbContext, producers не повторяют алгоритм);
  upgrade-поток зависит от startup-оркестрации (backfill выполняется
  приложением, а не SQL); коллизии в retained-базе требуют отдельного решения
  оператора.

## Решение

Вариант D. Единый backend `LoginIdentity` contract; сохранённый нормализованный
ключ с уникальным барьером `UX_Users_LoginNormalized`; центральная
синхронизация ключа в persistence-слое; forward-миграция с .NET-backfill и
preflight-stop на коллизиях; канонический `User.Login` неизменен и остаётся
источником для claims/audit/UI. Пока ADR имеет статус `Proposed`, этот раздел
остаётся предложением, а не утверждённым решением.

## Последствия

- Положительные последствия: вход в любом регистре; невозможность создать
  case-only дубль ни через API, ни через bootstrap/seed, ни конкурентно;
  одинаковое поведение на чистых и существующих базах; конфликт дубля маппится в
  ту же field-level ошибку `login`, что и обычная проверка.
- Отрицательные последствия и цена: +1 колонка на `Users`; upgrade-поток
  требует startup-оркестрации (backfill приложением между двумя миграциями);
  `IX_Users_Login` заменяется (DDL + snapshot); оператор retained-базы с
  коллизией должен разрешить её вручную до upgrade.
- Риски и митигация: рассинхронизация ключа при записи в обход DbContext —
  закрыто единственной точкой записи `SaveChanges` и NOT NULL+unique в СУБД;
  обход startup-шага backfill — останавливается SQL-guard миграции барьера;
  ослабление 401-контракта — фиксируется негативными AuthFlow-теориями.

## Cross-layer impact

- Backend: Domain (`LoginIdentity`, `User.LoginNormalized`), Infrastructure
  (конфигурация, синхронизация в `GymCrmDbContext`, миграция + snapshot), Api
  (auth lookup, create/bootstrap/seed проверки, маппинг unique violation).
- Frontend: контракт не меняется; добавлен smoke-тест pass-through ввода и
  отображения канонического логина из ответа backend.
- Bot: не затронут (Internal Bot API не использует login identity).
- Deploy/runtime: образы без изменений; startup migration flow применяет
  миграцию автоматически; на retained-базе с коллизией старт останавливается с
  диагностикой до подмены uniqueness contract.
- Public or internal contracts: Staff API не меняется; текст ошибки дубля
  `login` уже существует; `401` ProblemDetails неизменен.

## Migration and rollback

Upgrade выполняется штатным startup persistence flow в три шага:

1. `20260901120000_AddNormalizedLoginKeyColumn` добавляет nullable-колонку
   `LoginNormalized` (никаких данных не трогает).
2. `LoginIdentityBackfill.ReconcileAsync` (вызывается startup-шагом
   `PrepareLoginIdentityUpgradeAsync` перед полной миграцией) вычисляет ключи
   той же доменной функцией `LoginIdentity.NormalizeKey`: сначала preflight
   группировок, при коллизии — `InvalidOperationException` с маркером
   `case-insensitive-login-collision` и списком конфликтующих канонических
   логинов до записи хоть одного значения; иначе построчный backfill.
3. `20260901120001_RequireCaseInsensitiveLoginIdentity` ставит SQL-guard
   (нет незабэкфилленных ключей; нет дублей ключей — с перечислением логинов),
   затем `NOT NULL`, drop `IX_Users_Login`, create unique
   `UX_Users_LoginNormalized`. Шаги 1–3 в транзакциях PostgreSQL; бросок guard
   или preflight оставляет строки без изменений.

Clean bootstrap и retained-базы без коллизий обновляются автоматически;
direct-вызов `MigrateAsync()` в обход startup-шага 2 останавливается guard-ом
миграции 3 с тем же маркером и указанием запустить startup flow. Rollback:
`Down` обеих миграций восстанавливает `IX_Users_Login` и удаляет колонку.
Коллизии не разрешаются автоматически — отдельное продуктовое решение по
конкретным данным. Рассмотренный и отвергнутый альтернативный механизм —
чтение данных внутри самой миграции через конструкторную инъекцию
`IRelationalConnection` — отвергнут по evidence: EF Core создаёт миграции
только через parameterless-конструктор (эксперимент TASK-166: MissingMethodException).

## Validation

- Domain-теории `LoginIdentity` (пустые/trim, Latin/Cyrillic lower/upper/mixed).
- AuthFlow: вход в lower/upper/mixed в смешанный сохранённый логин; негативные
  случаи сохраняют единый 401-контракт.
- Users API/bootstrap/seed: case-only дубли отклоняются; обновление case-only
  логина остаётся immutable.
- PostgreSQL: конкурентная вставка case-вариантов под `UX_Users_LoginNormalized`
  (ровно один коммит; проигравший endpoint возвращает ту же field-level ошибку
  без деталей PostgreSQL); retained-upgrade без коллизий бэкфиллит ключи,
  тождественные `LoginIdentity.NormalizeKey`; retained-upgrade с `Coach`/`coach`
  падает с actionable-диагностикой, не меняя строки.
- Frontend: mixed-case ввод отправляется после trim без смены регистра;
  отображается канонический логин из ответа.

## Open questions

- Формальная приёмка ADR владельцем: пользователь одобрил реализацию плана
  TASK-166 (запрос 2026-09-01), явного подтверждения именно этого ADR не было.

## Approval

Pending. Источник решения — принятые REQ-USR-002/REQ-USR-003 и implementation
plan TASK-166; запрос пользователя «реализуй TASK-166» от 2026-09-01
авторизует реализацию, но не заменяет явную приёмку ADR.
