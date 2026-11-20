# Обновление удалённого стенда — 2026-11-20

## Область и версия

Статус: SUCCESS. Backend, frontend и bot обновлены до выбранного коммита;
база и постоянные данные сохранены. PostgreSQL не перезапускался.
Пользователь явно разрешил обновить стенд `84.54.59.17` и выбрал текущую локальную
`main` с последними изменениями создания групп. Точная цель:
`c97826fc1f769b85ce6ef79966a7f6a87b8373ad`; после выбора `origin/main` также указывает
на этот коммит. SSH user `user`, host identity `vm-chaniev`, root
`/home/user/gym-crm`, существующий тестовый стенд, Compose project `gym-crm`,
платформа `linux/amd64`. Аутентификация через интерактивный SSH prompt.
Requirements: `none` — операция переноса уже принятого поведения без новых
продуктовых решений.

Отчёты: рабочая копия `crm-worktrees/release-2026-11-20`, ветка
`codex/release-2026-11-20`, база и HEAD `c97826f`. Чистая сборочная копия:
`/private/tmp/crm-release-build-c97826f`; постоянный кэш вне Git:
`/private/tmp/gym-crm-release-build-cache`.

## Исходное состояние

Развёрнутый коммит `ea450769080ebac349668069f8216ed5889950eb` подтверждён manifest
прошлого выпуска и совпадением фактических immutable image IDs:

| Сервис | ID sha256 |
|---|---|
| backend | 4b7114b61c4b3bd9d5e518aa9ba6f9e705c8e6d32b6b59ee1f2022eebb3f539a |
| frontend | 8aa3b51e769f3bda8e6225910cccc735aecfb7b6f0a0ee59fff6074eb459458e |
| bot | f260623b20e08ce42b22d0fc83ae9ca8ee50e9a085801242bc6a412274677dfa |
| db | af194ccf3e2d7fe367012c7b88ce8b816c5c889b18a5b316799a1f0d7eac746a |

Все четыре сервиса healthy, перезапусков 0. Серверный Compose SHA-256
`3499775d4611729772c1010b58476f0f00b7b2f3491ed9bd24a7117077bb40ae`.
Compose, Dockerfiles, runtime environment contract не изменились.
Цель обновляет backend/frontend/bot согласованно; PostgreSQL не пересоздаётся.

## Изменения и совместимость

Импорт клиентов из XLSX в настройках, обработка пустого телефона при импорте,
создание группы одним действием с доступными филиалами/залами, согласованное
расписание в web и bot, включительные границы периодов тренеров. Внутренняя
декомпозиция календаря и операций абонементов сохраняет прежние контракты.
Принятые требования: REQ-CLI-010, REQ-BRN-002, REQ-USR-001, REQ-GRP-002,
REQ-GRP-008, REQ-GRP-004, REQ-BOT-003. Совместимость независимо проверена;
применимы ADR-0005/0006/0007/0008. Блокирующих замечаний к переходу нет.
Именованные specialist models недоступны в текущем аккаунте; проверки делегированы
доступным независимым агентам с теми же зонами ответственности.

## Миграция и данные

Исходная EF history: 9 миграций, последняя
`20260901120001_RequireCaseInsensitiveLoginIdentity`. Ранее применённые миграции
не изменены. Цель добавляет `20261116010000_UseInclusiveTrainerPeriods`:
транзакционный lock/preflight и замена двух ограничений без изменения строк.
ADR-0006 запрещает автоматическое исправление пересекающейся истории.
Read-only preflight: inclusive_overlap_pairs = 0. Дополнительный SQL-скрипт
совместимости не требуется; старые compatibility migrations не повторяются.
После перехода используется прямое исправление; автоматическое понижение схемы
или возврат прежнего backend не допускается без отдельной проверки совместимости.

Сняты агрегаты всех 44 таблиц. Users 18, Clients 90, TrainingGroups 24,
ClientMemberships 5, Attendance 21, GroupTrainerAssignments 21, AuditLogs 394.
Проверки целостности текущей схемы и пяти дополнительных инвариантов прошли.
Перед остановкой и после миграции агрегаты повторяются; ожидаемое изменение
только числа строк EF history с 9 до 10.

## План выпуска и восстановления

1. Полная выбранная harness baseline, затронутые desktop/iPhone Playwright,
   сборка точного коммита проектными скриптами и проверка linux/amd64.
2. Обеспечить запас места: исходно доступно 1,321,775,104 B, этого недостаточно.
   Сохранять все данные, backup и активные образы; допустимое освобождение места
   ограничить воспроизводимыми старыми артефактами после проверки копий.
3. Под exclusive release lock повторно подтвердить baseline и отсутствие другой
   операции. Создать custom dump и проверить pg_restore --list, сохранить env,
   Compose и metadata в защищённой серверной копии. Сохранить photo/bot volumes.
4. Проверить миграцию на восстановленной изолированной копии и clean bootstrap.
5. Передать точные release artifacts, сравнить SHA-256, загрузить проектным
   load-images.sh, сохранить исходный DB image reference.
6. Остановить прикладные сервисы, обновить согласованный backup, заменить только
   три application image variables. Запустить backend без зависимостей, проверить
   миграцию, схему и counts, затем frontend/bot.
7. Проверить внешние/внутренние health, image IDs/platform, restart counts,
   неизменность DB container и прикладных данных. При критичном сбое закрыть
   прикладной доступ и выполнить совместимое прямое восстановление; не
   восстанавливать старую БД поверх новых данных автоматически.

## Доказательства и ограничения

Локальные evidence: `/private/tmp/crm-release-20261120/`, canonical validation
`/private/tmp/crm-release-20261120-validation.json`, build log
`/private/tmp/crm-release-20261120-build.log`. Пользовательское описание выпуска
создаётся только после успешной активации. Физический iPhone и реальный Safari
с системной клавиатурой пока не проверены; реальные Telegram сообщения не отправляются.

## Завершённая подготовка

Canonical baseline: 23/23 checks passed; backend 826, frontend 776, bot 73,
harness 120 tests passed. NuGet audit passed. npm audit прошёл установленный
порог high; 7 moderate advisories остаются в неизменённых зависимостях и не
подавлялись. Браузерная совокупность выпуска: 329 passed, 2 заранее предусмотренных
пропуска общей viewport-матрицы в iPhone-профилях, 0 failed/flaky. Сами мобильные
сценарии выполнены. Все 10 XLSX fixtures неизменны, сборочная копия чистая.

Backup `/home/user/gym-crm/backups/pre-update-c97826f-20261120` создан без остановки
сервисов; dump/list, photo/bot tar inventories, 10 SHA256SUMS passed. База до
копирования 12,916,403 B; файловые каталоги по 4 KiB. Дамп с совпавшей SHA-256
восстановлен в отдельный локальный PostgreSQL для пробного обновления.
Release directory `/home/user/gym-crm/releases/c97826f-20261120-amd64` подготовлен.

Дополнительный preflight: 21 период тренера, все открытые; invalid periods,
inclusive overlaps, duplicate open pairs, orphans и current access drift — 0.
Подтверждены baseline constraints и fingerprint истории. До и после миграции
проверяются точные 9/10 migration IDs, ограничения, fingerprint и все 44 counts.

При активации временный Compose override отключает опубликованный порт backend
и ClientTelegram polling, чтобы строгие проверки проходили без внешних записей.
После migration/restart gates возвращаются исходный порт и polling; их совпадение
проверяется. Staff bot остаётся выключен. После открытия доступа изменения counts
регистрируются отдельно: кроме EF+1 любое изменение требует разбора координатором,
а не предположения об утрате данных. Успех не определяется одним exit code.

Операционные скрипты и SQL прошли независимые ревью. Они проверяют ownership томов,
существование каждого volume, точный commit/service/platform manifest, private
runtime до открытия, неизменность DB container и итоговый healthy. Прежние
прикладные образы и конфигурация сохраняются; после миграции recovery — forward fix.

Место освобождено только удалением девяти неиспользуемых image tags выпусков
7154cee-20261009, c2b6cdf-20260908 и 390b21c-20260829. Перед операцией проверены
SHA архивов и точная цепочка OCI descriptor/config/rootfs, отсутствие этих IDs
во всех контейнерах. Все три архива сохранены на сервере; текущие приложения,
PostgreSQL, данные и backup не затронуты. После операции доступно 5,759,844,352 B.
Evidence: reclaim-plan.json/reclaim-result.log в локальном каталоге выпуска.

Пробный переход восстановленной сохранённой БД на точный backend image
`sha256:a580061b93e6bb4db060c12db305b23dab1b7ae9222a63d59725e8af8b0dd660`
прошёл, включая повторный startup: EF 9→10, все прикладные counts и fingerprint
21 записей истории неизменны, новые ограничения включительных дат валидны.
Evidence: `rehearsal-results/backend-phase.json` и pre/post SQL snapshots.

Полная проверка точных application images прошла: retained upgrade, повторный
startup, frontend/backend health, read-only Bot API 401/404 и request correlation,
401 закрытых Staff API, clean bootstrap, dependency failure/recovery. При
отключённом backend frontend liveness остаётся 200, proxy возвращает 502,
bot представляет temporary error; после запуска все проверки снова проходят.
Первичный 10-секундный timeout внешнего probe был короче штатного proxy timeout;
повтор с 75 секундами подтвердил ожидаемый ответ без изменения приложения.
Обе локальные тестовые среды остановлены, volumes не удалены.
Evidence: `rehearsal-results/result.json`, SQL snapshots и `rehearsal.log`.

## Готовый выпуск и activation gate

Чистая проектная сборка и экспорт завершились успешно. Archive 570435072 B,
SHA-256 `5d5b9cffee4e8bc1f6047fbc9a66dc1a9807e5edbba220749facee2cbef06b24`. Все 14 артефактов проверены, включая
операционные скрипты, maintenance override, SQL и exact manifest. Все images
linux/amd64; RootFS и OCI provenance подтверждены по архиву. Пространство после
передачи должно превышать 3069701120 B; перед передачей
измерено 5,759,496,192 B, gate пройден с запасом. Runtime PostgreSQL не обновляется.

| Сервис | Target image ID |
|---|---|
| backend | sha256:a580061b93e6bb4db060c12db305b23dab1b7ae9222a63d59725e8af8b0dd660 |
| frontend | sha256:32b99b319304695a358d065b6d56ba2c13cbf73969560825f9c92ac5bb82b59e |
| bot | sha256:61207035034c7147b3e9da76991f6fdc0077482f75ec2526c3c2939c8c97c071 |

Кэш BuildKit/NuGet сохранён вне Git; исходная сборочная копия остаётся чистой.

## Результат активации

SUCCESS подтверждён 20.11.2026 18:40 MSK. Server transfer SHA256SUMS: 14/14 passed.
Activation script прошёл initial и quiescent backup gates, миграцию, strict
snapshot после первого запуска и повторного startup, восстановление обычных
портов/настроек, запуск потребителей и финальные проверки.

Три application image IDs совпадают с итоговым manifest; платформа linux/amd64,
все сервисы healthy, restart counts 0. DB container/image/StartedAt/restarts
побайтово совпадают с baseline, DB healthy. Runtime .env изменён только в
BACKEND_IMAGE/FRONTEND_IMAGE/BOT_IMAGE. Staff bot остаётся выключенным;
ClientTelegram polling возвращён в исходное включённое состояние. Mutable
PostgreSQL tag восстановлен после загрузки архива.

Миграция `20261116010000_UseInclusiveTrainerPeriods` применена штатно:
EF history 9→10, новые constraints validated, overlap/orphan/access drift = 0.
Все 44 табличных счётчика сохранены, кроме ожидаемой новой строки EF history;
21 запись истории назначений и её fingerprint неизменны. Рост audit отсутствует.

| Контрольный агрегат | До | После |
|---|---:|---:|
| Users | 18 | 18 |
| Clients | 90 | 90 |
| ClientMemberships | 5 | 5 |
| Attendance | 21 | 21 |
| TrainingGroups | 24 | 24 |
| GroupTrainerAssignments | 21 | 21 |
| AuditLogs | 394 | 394 |

Внешние `/`, `/healthz`, `/api/health/ready`, `/api/auth/session`: 200.
Закрытые `/api/branches`, `/api/clients`, `/api/groups/options/create`: 401 без
авторизации. Main JS `/assets/index-QXlo2AeF.js` совпадает с exact frontend image,
SHA-256 `43c60e04ca8041097d18e4d23eee85c98d3541e31042e7c8f9d623683b1286e7`.
Internal backend readiness, frontend liveness/proxy readiness и Bot API probe passed.

Согласованный backup находится в
`/home/user/gym-crm/backups/pre-update-c97826f-20261120`: database.quiescent.dump,
restore-list, photo/bot archives, исходные env/Compose и image/container metadata.
Проверки quiescent SHA пройдены до переключения и после успеха. Прежние active
images сохранены как доказательство исходной версии; после новой схемы обычный
binary/DB downgrade не применяется, recovery предусматривает forward fix.
Откат или восстановление не потребовались.

Remote evidence: `/home/user/gym-crm/releases/c97826f-20261120-amd64`, включая
activation-result.txt, active-state.json, data-deltas.json, SQL snapshots и
activation.log. Единственная delta — `__EFMigrationsHistory: +1`.
После активации свободно 3,350,941,696 B. Никакие данные, backup или старые
release archives не удалены. Все обязательные автоматические проверки завершены.
Физический iPhone/Simulator, реальный Safari chrome/keyboard/safe-area/VoiceOver
и отправка реальных Telegram сообщений не проверялись.

[Пользовательские изменения](RELEASE_NOTES_2026-11-20.md).
