# Обновление удалённого стенда — 2026-10-24

## Область и состояние

Подготовка релиза; переключение сервисов ещё не выполнено.
Пользователь явно разрешил обновить стенд `84.54.59.17`, SSH user `user`.
Read-only проверка подтвердила identity `vm-chaniev`, root
`/home/user/gym-crm`, environment: существующий удалённый стенд,
Compose project `gym-crm`, платформу `linux/amd64`.
Аутентификация: интерактивный SSH prompt без сохранения секрета.

Target: `origin/main`, exact commit
`5b1e036078f22853f3fe54a3c0412bdcf4f2d07c`, tag `5b1e036-20261024-amd64`.
Чистый immutable checkout: `/private/tmp/crm-release-build-5b1e036`.
Отчёты ведутся отдельно: branch `codex/release-2026-10-24`, worktree
`/Users/muradchaniev/Documents/work/crm-worktrees/release-2026-10-24`.
Requirements: `none` — операция переносит уже принятое поведение из main,
новых продуктовых решений не вводит.

## Baseline и provenance

Remote manifests `releases/7154cee-20261009-amd64/release.json` и
`releases/c2b6cdf-20260908-amd64/release.json` сопоставлены с фактическими
immutable image IDs запущенных контейнеров.
Backend/frontend baseline: `7154cee3f88d193a66a59d18e30e363b3a709c1f`.
Bot baseline: `c2b6cdf90d9fe4b1fe633c22e7a575a48c72ab50`.

| Сервис | Baseline image ID (sha256) | Состояние |
|---|---|---|
| backend | 1f654592f3297d9d29a95b2c91fcac20d219036af7c8837640f27d615ff08b43 | healthy, restarts 0 |
| frontend | c9bec7b021e76627999ca28e350c9777b35908e3d1be8977bc3a62f4d376a302 | healthy, restarts 0 |
| bot | af2e4b9351ffd32a7a2ec8fce99297609b2423a1b3e32da20d604ab38840993f | healthy, restarts 0 |
| db | af194ccf3e2d7fe367012c7b88ce8b816c5c889b18a5b316799a1f0d7eac746a | healthy, restarts 0 |

Проверены backend readiness, frontend health и proxied readiness.
Перед подготовкой свободно около 3.6 GiB. БД занимает 12 302 003 bytes,
photos/bot directories — по 4 KiB. Других dump/restore/copy процессов нет;
release lock свободен. Перед изменениями эти условия проверяются повторно.

## Изменения приложения и runtime

Обновляются backend, frontend и bot. PostgreSQL остаётся на прежнем image/container.
Изменения включают задачи TASK-188 (время по дням недели), TASK-189
(переход к каноническому расписанию группы), TASK-190 (доступные действия с
филиалами/залами), TASK-191 (доступ администратора к клиентам своего филиала),
TASK-194 (сохранение поведения и атомарности аудита при чистке backend).
Frontend потребляет новые backend action flags, nullable client counts и
пустой успешный ответ перевода клиента. Bot обрабатывает resource 404 без
показа устаревших данных. Поэтому application services переключаются согласованно.

Compose, Dockerfiles, env contract и image scripts не изменились.
Remote server Compose SHA-256:
`3499775d4611729772c1010b58476f0f00b7b2f3491ed9bd24a7117077bb40ae`.
Сохраняется remote runtime config; меняются только три application image variables.
Bot storage/мigrations/lockfile не изменены. Запуск второго Telegram polling
instance исключён; локальный smoke использует отключённый Telegram.

## Схема и сохранённые данные

Все Domain entities, persistence configuration, migrations, designers и model
snapshot совпадают с backend baseline. Remote содержит ровно 9 ожидаемых
EF migrations, последняя `20260901120001_RequireCaseInsensitiveLoginIdentity`.
Новых или изменённых applied migrations нет. Отдельный migration script не нужен.
Существующий retained-membership compatibility script повторно не запускается.

Schema checks: 41/41 application tables плюс штатные `bot_conversation_states`
и `bot_processed_updates`; 12/12 critical columns, 17/17 indexes, 14/14 constraints.
Все compatibility tables присутствуют; прежний
`EX_ClientMemberships_ClientId_Period_NoOverlap` отсутствует. Invalid constraints
и indexes: 0. Нарушений login, role/branch, attendance identity, trainer periods
и transition mapping нет. Активных preview tokens нет.

| Контрольный агрегат | До подготовки |
|---|---:|
| Users | 14 |
| Clients | 4 |
| ClientMemberships | 4 |
| Attendance | 4 |
| TrainingGroups | 15 |
| AuditLogs | 150 |

Baseline evidence: `/private/tmp/crm-release-20261024-schema-before.txt` и
`/private/tmp/crm-release-20261024-schema-extra.txt`. Перед активацией фиксируется
повторный согласованный снимок при остановленных application writers.

## План сборки, backup и переключения

1. Выполнить diff-selected canonical harness от backend baseline и объединение
   затронутых desktop/iPhone browser scenarios. Провести независимые layer reviews.
2. Собрать exact target для `linux/amd64` проектными build/export scripts.
   Persistent cache: `/private/tmp/gym-crm-release-build-cache`, builder
   `gym-crm-release-builder`; NuGet cache mount разделён по platform.
   Отсутствующий external cache восстанавливается штатным network fallback.
3. Проверить exact images в isolated runtime, clean startup и repeated startup.
4. Под exclusive release lock создать PostgreSQL custom dump, проверить
   restore-list, сохранить защищённые config/Compose/image metadata, photos и
   bot files. Проверить SHA-256 и достаточное место для archive + unpacked images.
5. Передать release в отдельный каталог, проверить checksums, загрузить образы,
   сверить immutable IDs/platform. Не перезаписывать `.env` целиком.
6. Остановить frontend/bot/backend, сохранив db и volumes. Повторить quiescent
   backup/counts. Активировать новый backend, проверить schema/readiness, затем
   frontend и bot. При ошибке оставить application access закрытым.
7. Проверить health/restarts, image IDs, внешний HTTP, неизменность db container,
   migrations, counts и invariants. После успеха оформить пользовательские notes.

## Recovery

Схема не меняется, но возврат прежнего backend снова открывает закрытый доступ
администратора к чужим клиентам. Согласно принятым ADR-0002/ADR-0003 это не
безопасный штатный rollback. Recovery: оставить application services остановленными,
сохранить диагностику/backup, исправить причину вперёд с сохранением новой границы
авторизации и повторить validation. Старые images/config сохраняются для анализа.
Blind image rollback, DB downgrade и destructive restore не выполняются.

## Проверки и ограничения

Canonical evidence: `/private/tmp/crm-release-20261024-validation.json`.
Build log: `/private/tmp/crm-release-20261024-build.log`.
Проверки и сборка выполняются; go/no-go до их завершения не пройден.
Именованные specialist models недоступны в текущем аккаунте; независимые проверки
выполняют доступные агенты с теми же границами ответственности.
Физический iPhone, Simulator, Safari chrome и настоящая экранная клавиатура
не проверяются автоматически; WebKit emulation не заменяет эти проверки.

## Возобновление 2026-10-25 и найденный blocker

Origin/main по-прежнему 5b1e036, remote baseline/images/schema/counts неизменны.
Канонические 23/23 проверки прошли: 708 backend, 750 frontend, 71 bot,
118 harness tests; NuGet/npm audit без уязвимостей. Browser scope: 174 passed,
2 intentional iPhone geometry-loop skips (основные сценарии выполнены).
Исходный образ собран и экспортирован, но НЕ допущен к установке.

Exact-image API smoke выполнил 118 успешных assertions и воспроизвёл HTTP 500
GET /branches для HeadCoach и Administrator: Npgsql не переводит сортировку
после positional BranchResponse projection. Исправление отражено в
[TASK-195](../backlog/implementation/TASK-195-branch-list-postgresql.md);
готовый план прошёл preflight. Требуется новый проверенный target и сборка.
Удалённые данные, конфигурация и application services ещё не изменялись.

Сетевой сбой Ubuntu package index устранён отдельным временным локальным relay
к официальным package sources, без изменения Dockerfiles/исходников или
отключения проверки TLS. Runtime images не содержат proxy environment; relay
остановлен после успешной сборки. Persistent caches сохранены.
