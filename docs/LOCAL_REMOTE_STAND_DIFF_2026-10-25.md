# Обновление удалённого стенда — 2026-10-25

## Область и exact target

SUCCESS: активировано 25.10.2026 около 17:12 Europe/Moscow. Backend, frontend
и bot обновлены; PostgreSQL не перезапускался; данные сохранены.
Все обязательные автоматические проверки, backup и activation gates пройдены.
Пользователь явно разрешил обновление 24.10.2026 и возобновил запрос 25.10.2026.
Host `84.54.59.17`, SSH user `user`, identity `vm-chaniev`, environment: существующий
удалённый стенд, root `/home/user/gym-crm`, Compose project `gym-crm`, `linux/amd64`.
SSH authentication выполнена через интерактивный prompt без сохранения секрета.

Target `main`/`origin/main`: `ea450769080ebac349668069f8216ed5889950eb`; tag `ea45076-20261025-amd64`.
Чистый immutable build checkout `/private/tmp/crm-release-build-ea45076`.
Отчёты ведутся отдельно в task worktree `release-2026-10-24`, branch
`codex/release-2026-10-24`. Requirements: `none` для операции переноса уже принятого
поведения; исправление обнаруженного release blocker оформлено
[TASK-195](../backlog/done/2026-10-25/TASK-195-branch-list-postgresql.md).

## Baseline и изменения

Remote release manifests сопоставлены с реально запущенными immutable image IDs.
Backend/frontend baseline `7154cee3f88d193a66a59d18e30e363b3a709c1f`;
bot baseline `c2b6cdf90d9fe4b1fe633c22e7a575a48c72ab50`.

| Сервис | Baseline image ID (sha256) |
|---|---|
| backend | 1f654592f3297d9d29a95b2c91fcac20d219036af7c8837640f27d615ff08b43 |
| frontend | c9bec7b021e76627999ca28e350c9777b35908e3d1be8977bc3a62f4d376a302 |
| bot | af2e4b9351ffd32a7a2ec8fce99297609b2423a1b3e32da20d604ab38840993f |
| db | af194ccf3e2d7fe367012c7b88ce8b816c5c889b18a5b316799a1f0d7eac746a |

Перед возобновлением все healthy, restart counts 0. DB container
`aec1edae6487f7dd9db0cd32aeb7238153498f9b2e33379fa34b50a766537d28`,
StartedAt `2026-07-26T19:27:32.079667654Z`.

Обновляются backend/frontend/bot. Изменения: время занятий по дням недели,
переход из группы к каноническому расписанию, действия Супер-администратора
с филиалами и залами, доступ администратора к клиентам своего текущего филиала.
Принятые requirements: REQ-GRP-001/003/004, REQ-BRN-001/002, REQ-USR-001,
REQ-CLI-007; REQ-CLI-009 ограничивает неизменный coach access.
Backend-owned action flags, nullable clientCount, transfer 204 и resource 404
синхронизированы с frontend и bot. Сервисы переключаются согласованно.

Compose/Dockerfiles/env contract/bot storage не изменены. Server Compose SHA-256
`3499775d4611729772c1010b58476f0f00b7b2f3491ed9bd24a7117077bb40ae`.
Меняются только BACKEND_IMAGE/FRONTEND_IMAGE/BOT_IMAGE; PostgreSQL container,
volumes и остальные строки конфигурации сохраняются. Bot на стенде отключён
`BOT_ENABLED=false`; эта настройка сохраняется. Bot storage использует ту же БД.
Экспорт включает PostgreSQL, но его образ не активируется; mutable tag после
загрузки возвращается к прежнему значению.

## Миграции и данные

Migration decision: NOT REQUIRED. Domain/persistence/migrations/model snapshot
не изменились; независимый backend review подтвердил идентичность persistence
Git tree `8f416b487300e18579656f350028680cad116658` и compatibility SQL tree
`85a02d3c4561fb1563a25e0794cb2ccdb97d4741`. Remote EF history ровно 9/9,
последняя `20260901120001_RequireCaseInsensitiveLoginIdentity`.
Старый compatibility script не перезапускается.

Проверены 41 application table плюс две штатные bot tables, 12 critical columns,
17 indexes и 14 constraints. Invalid constraints/indexes 0; отсутствуют
нарушения login, role/branch, attendance identity, trainer periods и transition
mapping. Дополнительные missing membership targets/sale snapshots, duplicate
current sale versions, orphan attendance и legacy exclusion count — все 0.

При возобновлении Users 14, Clients 4, ClientMemberships 4, Attendance 4,
TrainingGroups 15, AuditLogs 150. Снимаются counts всех 44 таблиц (включая EF history)
до переключения, после backend startup/restart и после активации consumers.

## Проверки и исправление blocker

[Подготовка 24 октября](LOCAL_REMOTE_STAND_DIFF_2026-10-24.md) сохранила исходное
сравнение и отказ candidate 5b1e036. Canonical baseline 23/23 passed: 708 backend,
750 frontend, 71 bot, 118 harness. Browser regressions 174 passed и 2 intentional
geometry-loop skips на iPhone; основные сценарии выполнены на обоих профилях.

Exact-image API smoke выявил PostgreSQL HTTP 500 списка филиалов после positional
projection. TASK-195 прошла readiness preflight; шесть новых PostgreSQL проверок
воспроизвели ошибку до исправления и прошли после переноса прежней сортировки
до проекции. Target ea45076 прошёл 13/13 diff-selected checks: 714 backend,
750 frontend, Release/format/guards/lint/typecheck/build и NuGet/npm audit.
Уязвимостей не найдено. Прежнее предупреждение frontend chunk > 500 kB неблокирующее.
Исправление интегрировано и опубликовано в main перед новой чистой сборкой.

Сборка uses project build/export/load scripts; persistent cache
`/private/tmp/gym-crm-release-build-cache`, builder `gym-crm-release-builder`.
Первоначальный сетевой отказ Ubuntu repository устранён временным локальным
relay к официальным package sources. TLS/package integrity не отключались,
Dockerfiles/исходники/global Docker config не менялись. Proxy environment
отсутствует в runtime images; cache сохранён вне checkout.

На initial exact images прошли clean bootstrap, bot service auth (401 без/с
неверным token; 404 для синтетического незарегистрированного identity с верным),
backend dependency failure и восстановление: bot temporary error, frontend
liveness 200 / proxy 502, затем успешное recovery. Итоговый API smoke повторяется
на новой чистой БД и окончательном image.

## Backup, rollout и recovery

Перед remote changes повторно проверяются identity, baseline, lock, свободное
место и отсутствие другого backup/release. Available before update 3,833,901,056 B;
архив около 558 MB, conservative loaded-image budget 1.1 GB, два малых backup и
1 GB reserve помещаются без удаления старых ресурсов.

Backup target `/home/user/gym-crm/backups/pre-update-ea45076-20261025`.
Custom dump проверяется pg_restore--list; config/Compose/image/container metadata
хранятся с permissions 0700/0600; photos/bot file archives и SHA-256 проверяются.
После остановки frontend/bot/backend повторяются согласованные dump/file snapshots,
restore-list и checksums до изменения .env или запуска backend.

Release target `/home/user/gym-crm/releases/ea45076-20261025-amd64`.
Под exclusive flock проверяются manifest hashes, images/platform/rootfs,
запускается backend, проверяются schema/counts, выполняется повторный startup;
затем frontend/bot, internal/external health и synthetic Bot API read.
Strict counts сравниваются до открытия frontend/bot; после открытия сохраняются
deltas, нарушения invariants/необъяснимые потери блокируют успех.

ADR-0003 запрещает обычный возврат старого backend, открывающий исправленный
доступ к чужим клиентам. Recovery: проверяемая остановка application services,
сохранение данных/diagnostics, forward fix с текущей границей авторизации.
DB downgrade/destructive restore не выполняются. Operational scripts независимо
проверены; signal handling завершает дочерние processes и восстанавливает DB tag,
ошибка закрывает доступ с проверкой фактической остановки. Старые образы/config
сохранены для recovery анализа.

## Evidence и ограничения

Canonical baseline `/private/tmp/crm-release-20261024-validation.json`,
fix validation `/private/tmp/crm-task195-validation.json`,
red/green `/private/tmp/crm-task195-test-result.txt`,
final build `/private/tmp/crm-release-20261025-build.log`.

Физический iPhone, Simulator, реальный Safari chrome/keyboard/safe-area не
проверялись. Реальных Telegram сообщений и пользовательских записей на стенде
в smoke не создаётся. Именованные specialist models недоступны; независимые
проверки выполнены доступными агентами с соответствующей ответственностью.

## Окончательные артефакты

Archive `gym-crm-images-ea45076-20261025-amd64.tar`, 551,496,192 bytes,
SHA-256 `a8e3adec882b1fa833c83d45b29c2055bb8504fa727297cfaaa62a99c45d949d`.
11 artifacts включены в SHA256SUMS. Все application images linux/amd64,
source checkout чистый, runtime proxy environment отсутствует.

| Сервис | Target image ID (sha256) |
|---|---|
| backend | 4b7114b61c4b3bd9d5e518aa9ba6f9e705c8e6d32b6b59ee1f2022eebb3f539a |
| frontend | 8aa3b51e769f3bda8e6225910cccc735aecfb7b6f0a0ee59fff6074eb459458e |
| bot | f260623b20e08ce42b22d0fc83ae9ca8ee50e9a085801242bc6a412274677dfa |

Новый exact-image API smoke: 118 assertions / 72 HTTP requests passed,
включая ранее сломанный список филиалов, role actions, own/foreign client scope,
transfer 204, idempotent replay и отсутствие audit side effects при отказе.
Evidence `/private/tmp/crm-release-20261025-api-smoke-result.json`.

## Backup и activation gate

Protected backup создан и проверен 25.10.2026:
`/home/user/gym-crm/backups/pre-update-ea45076-20261025`. Custom dump restore-list,
file archive inventories и все initial checksums passed. Baseline images/healthy
state/config повторно подтверждены под exclusive lock. Exact final images прошли
повтор dependency failure/recovery и restart с сохранением counts всех таблиц.
После передачи требуется server checksum check; затем activation gate полностью
удовлетворён. Remote .env/applications пока не переключены.

Server transfer checksum: 11/11 passed. Свободно после передачи 3,281,121,280 B.
Activation gate пройден, запуск reviewed activation script выполняется под lock.

## Результат активации

Reviewed script завершился SUCCESS. Все три active application image IDs
совпадают с manifest, платформа linux/amd64; healthy, restart counts 0.
DB image/container/StartedAt/restarts совпадают с baseline, DB healthy.
Runtime .env отличается ровно тремя application image variables. Bot остаётся
выключен. PostgreSQL tag восстановлен к прежнему значению после загрузки.

Согласованный backup содержит database.quiescent.dump/restore-list,
client-photos.quiescent.tar и bot-data.quiescent.tar; четыре quiescent checksum
проверены до запуска backend и повторно после успеха. Initial backup 10/10
checksums passed. Старые images/config сохранены; recovery не понадобился.

Migration outcome: NOT REQUIRED; EF history 9/9, новые migrations не применялись.
Schema/invariant checks прошли после первого старта backend, повторного старта
и полной активации. Все 44 table counts совпали; data-deltas.json пуст.

| Контрольный агрегат | До | После |
|---|---:|---:|
| Users |14|14|
| Clients |4|4|
| ClientMemberships |4|4|
| Attendance |4|4|
| TrainingGroups |15|15|
| AuditLogs |150|150|

Internal backend readiness, frontend health/proxy readiness и bot health/API
probe passed. External /, /healthz, /api/health/ready, /api/auth/session: 200;
protected /api/branches и /api/clients без авторизации: 401. Main JS asset
совпадает с exact frontend image (SHA-256
`b3e34e812bec8c129a90c2c09a58b323aaa49d9753c1bac21d25f023d12725f3`).

Remote evidence находится в release directory: activation-result.txt,
active-state.json, schema-check-before/after.txt, counts-before/after.txt,
compatibility-check-after.txt, data-deltas.json. Local external evidence:
`/private/tmp/crm-release-20261025-external-checks.json`.
После установки свободно 1,627,361,280 B (около 1.5 GiB); старые релизы и volumes
не удалялись. Это ограничение доступного диска сохранено в handoff.

Все обязательные автоматические проверки завершены. Ограничения физического
iPhone/Safari и отсутствие реального Telegram обмена перечислены выше.
[Пользовательские изменения](RELEASE_NOTES_2026-10-25.md).
