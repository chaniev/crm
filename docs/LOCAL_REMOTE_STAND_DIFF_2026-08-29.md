# Различия локального и удалённого стендов на 2026-08-29

## Область сравнения

- Удалённый стенд: `84.54.59.17`, `/home/user/gym-crm`.
- Удалённая версия до обновления: backend, frontend и bot с tag
  `15737da-20260731-amd64`, baseline commit
  `15737da3d9d9041abcec1ab1426a07c65d6f2cc7`.
- Целевая версия: `origin/main`, commit
  `390b21c0c4ad9f27f1391d615297e58e0aa805b4`.
- Требования релизной операции: `none` — отчёт, compatibility migration и
  выкладка не меняют принятые продуктовые решения; они переносят уже принятую
  функциональность `REQ-ATT-*`, `REQ-GRP-*`, `REQ-SUB-*`, `REQ-USR-*`,
  `REQ-AUD-*`, `REQ-BRN-*` и `REQ-NFR-*` на retained database.

Сравнение выполнено по Git diff, production-коду и контрактам, EF migrations,
resolved Compose, активным Docker images, migration history, агрегированным
счётчикам данных и health endpoints. Персональные данные не извлекались.

## Краткий итог

1. Между версиями изменено 615 файлов: `+103056/-20198`, включая production-код,
   тесты, generated migrations, backlog и инженерную документацию.
2. Изменения production-слоёв: backend — 193 файла (`+39181/-7105`), frontend —
   165 (`+35858/-11993`), bot — 38 (`+3147/-808`).
3. Главные функциональные изменения: полноценный календарь занятий,
   occurrence-based посещаемость, отдельные разделы «Посещения» и «Внимание»,
   адресные и одновременно действующие абонементы, улучшения реестра тренеров,
   финансов, аудита, настроек и мобильной работы.
4. Новый frontend и bot несовместимы со старым backend: контракт расписания,
   посещаемости, тренеров, session access и абонементов меняется согласованно.
5. Для retained database обязательны отдельный compatibility transition для
   абонементов и staged calendar/attendance cutover. Простой запуск нового
   backend заблокирован защитной EF migration.
6. Обновление выполняется без `down -v`: PostgreSQL и все named volumes
   сохраняются, перед изменениями создаётся проверенный backup.

## Функциональные изменения

### Календарь занятий и посещаемость

- Недельный шаблон заменён датированными занятиями со стабильным
  `LessonOccurrenceId`.
- Добавлены день/неделя, URL-backed дата и фильтры, несколько занятий группы в
  день и разные время, длительность и зал по дням недели.
- Поддержаны разовые занятия, перенос, изменение одного занятия, будущей части
  или всей серии, отмена и восстановление.
- Постоянные назначения и точечные замещения тренеров применяются к конкретным
  занятиям.
- Посещение связано с конкретным занятием; web и bot используют одну
  backend-семантику.
- «Посещения» вынесены на `/attendance`, управленческий inbox переименован в
  «Внимание» и перенесён на `/attention`.

### Абонементы

- Абонемент получает упорядоченный набор целевых групп: 1–5 для Term и
  Professional, ровно одна для SingleVisit.
- Разрешены одновременно действующие абонементы, если их целевые группы не
  конфликтуют.
- Attendance entitlement, SingleVisit write-off/restore, перевод между
  группами и bot работают с точной группой и конкретным занятием.
- Карточка клиента возвращает коллекцию текущих абонементов вместо единственного
  `currentMembership`.
- Продажи, возвраты и использование абонемента сохраняют исторические target
  snapshots.
- Изолировано сохранение комментариев разных продаж.

### Остальные интерфейсы

- Канонический API реестра тренеров изменён с `/users` на `/coaches`; добавлены
  фильтры отключённых аккаунтов и обязательной смены пароля.
- Финансовый отчёт показывает выбранный scope до фильтров, различает пустой
  результат и ошибку и помечает stale data.
- Журнал действий стал компактнее на мобильных устройствах, улучшены пагинация
  и возврат фокуса.
- В настройках убраны повторяющиеся заголовки и улучшены scope/touch states.
- Централизованы browser history, route title и auth-stage title; исправлены
  stale-response сценарии карточки клиента и каталога перевода.

## Изменения контрактов

- Session access: `Home` заменён на `Attention`, добавлен `Attendance`, изменены
  `allowedSections` и `landingScreen`.
- Trainer CRUD: `/users*` заменён на `/coaches*` без compatibility alias.
- Schedule API использует dated occurrences, series, one-off lessons,
  preview/execute mutations и confirmation tokens.
- Attendance API использует `LessonOccurrenceId`; прежний ключ
  `GroupId + TrainingDate` больше не является identity.
- Client API возвращает `currentMemberships`; singular contract удалён.
- Membership mutations принимают ordered target group IDs.
- Internal Bot API синхронно переведён на occurrences и множественные
  абонементы.

## Схема и миграция сохранённых данных

### Compatibility transition абонементов

TASK-115 добавил четыре таблицы и снял старый запрет пересечений через изменение
уже применённых migrations `20260513165936_InitialCreate` и
`20260721210111_FixClientMembershipVersionConstraints`. EF не выполняет их
повторно на сохранённой базе, поэтому подготовлен отдельный migration script
с idempotent SQL-блоком:

`deploy/migrations/2026-08-29-retained-membership-transition.sql`.

Скрипт:

- создаёт `ClientMembershipTargetGroups`,
  `ClientMembershipSaleTargetSnapshots`,
  `ClientMembershipRefundTargetSnapshots` и
  `AttendanceEntitlementTargetSnapshots`;
- переносит существующие абонементы и snapshots продаж/возвратов на активные
  группы клиента;
- удаляет старый `EX_ClientMemberships_ClientId_Period_NoOverlap`;
- идемпотентен и прерывается до изменения данных при неоднозначной привязке.

На удалённом стенде до обновления: 1 абонемент Term, 0 возвратов и 1 запись
посещаемости без SingleVisit-связи. У абонемента две активные группы в одном
филиале, поэтому backfill target groups однозначен. Персональные поля не
читались.

### Calendar/attendance cutover

Добавлены EF migrations:

- `20260823143000_AddLessonCalendarSchema`;
- `20260823153131_AddScheduleMutationConfirmationTokens`;
- `20260823162000_AddAttendanceOccurrenceTransition`;
- `20260823163000_RequireAttendanceOccurrenceIdentity`;
- `20260823173644_AddLessonOccurrenceTrainerSubstitutions`.

Выкладка выполняется staged flow:

1. остановить `bot`, `frontend`, `backend`, не удаляя volumes;
2. применить compatibility SQL для retained membership target tables;
3. применить EF migrations по `20260823162000` включительно;
4. новым backend image выполнить `--attendance-transition ensure-run` с
   фиксированной cutover date и source version;
5. получить durable report и добиться `unresolvedCount = 0`;
6. подтвердить `activation-check`;
7. применить required-FK migration и trainer-substitution migration;
8. только затем запускать новый backend, frontend и bot.

## Данные удалённого стенда до обновления

| Сущность | Количество |
|---|---:|
| Пользователи | 13 |
| Филиалы | 1 |
| Залы | 5 |
| Типы групп | 5 |
| Группы | 14 |
| Клиенты | 4 |
| Абонементы | 1 |
| Посещения | 1 |
| Записи аудита | 76 |

## Валидация и обновление стенда

Стенд обновлён 2026-08-29 на release tag
`390b21c-20260829-amd64`.

- Проверенный backup сохранён в
  `/home/user/gym-crm/backups/pre-update-20260829-1615`: два PostgreSQL custom
  dumps с проверенными restore lists, исходные `.env` и server Compose,
  container metadata, а также архивы client photos, backend logs и bot data.
- Release artifacts и SQL checksums сохранены в
  `/home/user/gym-crm/releases/390b21c-20260829-amd64`.
- Membership transition создал 2 target rows и 2 sale snapshot rows; возвраты
  и entitlement-linked attendance отсутствовали, поэтому для них создано 0
  строк.
- Attendance transition run `70177617-b757-4244-af47-132be60d2607` завершён с
  `canActivate = true`, `unresolvedCount = 0`; единственная старая запись
  посещаемости сохранена и привязана к созданному legacy occurrence.
- В БД применены 7 migrations; последняя —
  `20260823173644_AddLessonOccurrenceTrainerSubstitutions`.
- Backend, frontend, bot и PostgreSQL имеют статус `healthy`, restart count 0.
  Внешние проверки: `/` — HTTP 200, `/healthz` — `ok`,
  `/api/health/ready` — `Healthy`.
- Новые server image IDs: backend `7412f1a00108`, frontend `9a6564a88a07`,
  bot `f8bf3cf96e0d`; все application images — `linux/amd64`.

### Сохранность данных после обновления

| Сущность | До | После |
|---|---:|---:|
| Пользователи | 13 | 13 |
| Филиалы | 1 | 1 |
| Залы | 5 | 5 |
| Типы групп | 5 | 5 |
| Группы | 14 | 14 |
| Клиенты | 4 | 4 |
| Абонементы | 1 | 1 |
| Посещения | 1 | 1 |
| Записи аудита | 76 | 78 |

Рост журнала аудита на 2 записи ожидаем: зафиксированы операции перехода; ни
одна прикладная сущность не удалена. После перехода осталось 0 посещений без
`LessonOccurrenceId` и 0 нерешённых transition items.

### Локальная проверка целевой версии

- backend Release build и тесты: 512/512;
- frontend canonical check, unit tests и production build: 580/580;
- bot lint, format, mypy и тесты: 65/65;
- обе Compose-конфигурации проходят `config --quiet`, deploy shell scripts —
  `bash -n`;
- release archive 532 МБ проверен по SHA-256 до и после передачи.

## Известная несогласованность документации

`REQ-ATT-004` упоминает состояние `Held/NotHeld`, но фактическая модель и
TASK-119 используют только `Scheduled/Cancelled`. Состояние «занятие не
проводилось» в этот release note не включено и требует отдельного решения в
реестре требований.
