---
name: deploy-project
description: Reconcile the local CRM release with a retained-data remote stand, prepare any required compatibility migration, deploy verified Docker images without deleting data, and produce technical and user-facing release notes. Use only for an explicitly authorized deployment to an identified server.
---

# Комплексный деплой CRM на удалённый стенд

Выполняй релиз как управляемый переход от фактически запущенной remote baseline
к выбранному commit целевой ветки. Не считай Git branch, каталог сервера или
старый отчёт достаточным доказательством текущего состояния.

Для полного порядка действий и форматов артефактов прочитай
[references/remote-release-workflow.md](references/remote-release-workflow.md).

## Границы авторизации

- Используй скилл только после явного запроса обновить конкретный сервер.
- До первого изменения remote state зафиксируй host, SSH user, environment,
  deployment root, target branch/commit и способ аутентификации.
- Известный remote target этого проекта: host `84.54.59.17`, user `user`,
  deployment root `/home/user/gym-crm`, если пользователь не указал иное.
- Не считай наличие адреса или credentials разрешением на другой сервер,
  production или очистку данных.
- Пароль, token, private key, cookies и содержимое `.env` не сохраняй, не
  повторяй и не помещай в команды, отчёты, shell history или артефакты.
  Предпочитай SSH agent/key. Для password-only доступа используй только
  защищённый интерактивный канал, если среда его поддерживает; не используй
  `sshpass` или password в command arguments. Иначе остановись.
- Не передавай credentials субагентам. Только координатор выполняет SSH-команды,
  принимает go/no-go решение, переключает сервисы и выполняет rollback.

## Обязательная маршрутизация по агентам

Сначала прочитай root `AGENTS.md`, затем каждый scoped `AGENTS.md` для
изменившихся producers и consumers. Делегируй независимые bounded-проверки,
когда соответствующие агенты доступны:

- `docker-expert`: Compose parity, image build/export, platform, backup,
  service update, healthchecks и rollback plan;
- `dotnet-backend-specialist`: EF history, schema/data compatibility, решение о
  data migration и review любого migration script;
- `react-specialist`: frontend impact, обязательная проверка и наблюдаемые
  пользовательские изменения;
- `python-pro`: bot impact и его runtime/data compatibility;
- `test-automator`: migration/runtime regression coverage при повышенном риске.

Не запускай параллельные remote mutations. Координатор сводит выводы агентов,
разрешает конфликты по evidence precedence из `AGENTS.md` и выполняет серверные
шаги последовательно. Недоступность роли не уменьшает обязательные проверки.

## Обязательные артефакты

Изменения repository artifacts выполняй в отдельном task worktree по
`task-worktree`; isolated release checkout оставляй immutable и чистым. Не
смешивай подготовку отчётов/миграции со сборочной рабочей областью.

До деплоя создай или обнови технический отчёт:

```text
docs/LOCAL_REMOTE_STAND_DIFF_<YYYY-MM-DD>.md
```

Он содержит доказательства baseline/target, layer и contract impact, Compose и
runtime различия, migration decision, backup/rollback plan и результаты
проверок. Не включай персональные строки данных и секреты.

После успешного деплоя создай:

```text
docs/RELEASE_NOTES_<YYYY-MM-DD>.md
```

Release notes описывают только доступные пользователю функции, изменившиеся
сценарии и заметное поведение. Не включай commits, image tags, SQL/EF, пути,
checksums, тесты, backup и внутреннюю реализацию. Если пользовательская
функциональность не изменилась, напиши это прямо и кратко.

## Решение о миграции сохранённых данных

Сравни target migrations/model с remote `__EFMigrationsHistory`, реальной
схемой и необходимыми compatibility objects. Не делай вывод только по списку
новых EF files: уже применённая migration могла быть изменена, а startup
`MigrateAsync` не воспроизводит её повторно.

Создавай отдельный script в `deploy/migrations/` только когда baseline → target
нельзя безопасно выполнить штатными forward migrations. Скрипт обязан:

- сохранять все существующие прикладные данные;
- использовать `ON_ERROR_STOP`, transaction и validation до первых writes;
- быть идемпотентным либо иметь строгую single-run guard;
- завершаться без изменений при неоднозначном mapping;
- иметь postconditions, агрегированный результат и понятный failure signal;
- не редактировать migration, уже применённую на retained database.

Проверь script на совместимой копии/backup восстановлением или эквивалентном
изолированном retained-data scenario. Зафиксируй checksum. Не запускай script
на стенде до завершения backup и review `dotnet-backend-specialist`.

Новый script является project change: создай и проверь его в task worktree,
добейся review и интеграции в target branch, затем обнови exact target commit и
собери release заново из чистого checkout. Никогда не передавай на сервер
незакоммиченную migration из ad-hoc workspace.

Если script не нужен, запиши доказательство этого решения в технический отчёт.
Не перезапускай старую compatibility migration только потому, что она есть.

## Инварианты деплоя

- Собирай release из чистого isolated checkout target branch; зафиксируй exact
  commit. Не выкладывай uncommitted local state.
- Используй проектные `deploy/build-images.sh`, `export-images.sh`,
  `load-images.sh` и `deploy/docker-compose.server.yml`.
- Сверь server architecture; для известного стенда ожидается `linux/amd64`, но
  проверь это в каждом релизе.
- До изменений создай проверенный backup БД и persistent file data, сохрани
  runtime config и active image/container metadata без вывода секретов.
- Проверяй database dump через restore-list и release artifacts по SHA-256 до
  и после передачи.
- Никогда не выполняй `docker compose down -v`, `docker volume rm`, reset/seed
  или очистку persistent directories для retained-data deployment.
- Не перезаписывай remote `.env` целиком и не используй sync с `--delete`
  против runtime root.
- Обновляй только изменившиеся сервисы, если contracts совместимы. Для
  несовместимого cross-layer перехода используй задокументированный staged
  stop → migration → activation checks → start.
- Сохрани previous image tags/config как rollback point. После необратимого
  schema change rollback старого image может быть небезопасен; планируй
  forward recovery и не выполняй blind DB downgrade.

## Go/no-go и остановка

Не начинай remote mutation, если отсутствует хотя бы одно:

- достоверная remote baseline и target commit;
- чистая целевая сборка и обязательная validation;
- проверенный backup и restore evidence;
- migration decision и, если нужен, проверенный script;
- release artifacts/checksums;
- rollback или forward-recovery plan;
- достаточная совместимость изменившихся producers/consumers;
- достаточно места для backup, release artifacts и безопасной операции;
- подтверждение, что другой release, migration или backup не выполняется.

Остановись без дальнейших изменений при неоднозначной migration, несовпадении
server identity/path, неожиданном dirty runtime state, failed backup/checksum,
непринятом поведении, failed build/audit/test или конфликтующих выводах агентов.
Remote migrations, которых нет в target, remote schema ahead of target или
расхождение реальной схемы с migration history также являются no-go.

## Проверка результата

После запуска проверь Compose status, health и restart counts, фактические image
IDs/platform, migration/schema postconditions, внешние и внутренние health
endpoints и безопасные агрегированные data counts до/после. Рост audit rows
допустим только когда объяснён ожидаемыми migration/release operations.

Если critical check не прошёл, не объявляй успех. Останови rollout, сохрани
диагностику без секретов и выполни только заранее проверенный rollback либо
forward recovery, совместимый с текущей схемой.

В финале сообщи результат, target commit, обновлённые сервисы, migration outcome,
backup/rollback location, health/data verification и ссылки на оба Markdown
артефакта после успешного релиза. При failure дай ссылку только на технический
отчёт и явно укажи, что release notes не опубликованы. Отдельно перечисли
проверки, которые не удалось выполнить.
