# Remote release workflow

Используй этот runbook для комплексного обновления CRM с сохранением данных.
Команды выбирай из текущих repository contracts; примеры ниже определяют
проверяемые результаты, а не заменяют `deploy/SERVER_INSTALL.md` и harness.

## 1. Зафиксировать scope и рабочие области

1. Определи target branch (по умолчанию `main`) и exact `origin/<branch>` commit.
2. Изменяй reports и migration sources только в dedicated task worktree.
3. После интеграции project changes создай отдельный immutable isolated
   checkout/build directory на обновлённом exact target commit.
4. Убедись, что build checkout чистый и остаётся чистым до конца сборки.
5. Зафиксируй remote host/user/root/environment и server identity read-only
   проверкой до любых изменений.
6. Не сохраняй password или `.env` в переменных командной строки, Markdown или
   файлах release workspace.

## 2. Собрать remote baseline

Собирай только минимальные неперсональные доказательства:

- active Compose project, services, status, restart counts и resolved service
  wiring без secret values;
- active image tags, IDs, labels, digests и architecture;
- deployed commit/release metadata, если оно надёжно доступно;
- remote server Compose checksum/version и имена runtime variables без values;
- `__EFMigrationsHistory`, нужные schema objects и compatibility markers;
- агрегированные counts критичных сущностей и invariant violations;
- internal health endpoints и доступные внешние health endpoints;
- persistent paths/volumes, необходимые для backup.

Не копируй remote source tree поверх local checkout и не извлекай записи
пользователей/клиентов, контакты, токены или другие персональные данные.

## 3. Сравнить baseline с target

Определи baseline commit по immutable image/release provenance. Если exact
commit доказать нельзя, допустима только эквивалентная доказательная цепочка из
immutable image digests/labels, сохранённых release manifests и deployable
contracts, достаточная для восстановления source-level функционального diff.
Если этого недостаточно, deployment и functional release notes блокируются.

Классифицируй diff:

| Область | Что проверить | Последствие |
|---|---|---|
| backend/domain/API | contracts, permissions, persistence, startup | backend validation, consumers, migration decision |
| frontend | API facade, routes, workflows, runtime variables | frontend validation и functional notes |
| bot | Internal Bot API, storage, runtime variables | bot contract validation |
| deploy/runtime | оба Compose, env contract, health, volumes | coordinated runtime update |
| database | EF model/history, forward migrations, backfills | retained upgrade plan |

Отделяй production/runtime diff от tests, backlog и engineering docs. Проверь
accepted requirements для меняющегося поведения. Несинхронизированный contract
или непринятое продуктовое решение блокирует релиз.

## 4. Оформить технический отчёт до изменений

`docs/LOCAL_REMOTE_STAND_DIFF_<date>.md` должен включать:

1. Область сравнения: target, remote root, baseline и target commits/tags.
2. Краткий итог и список реально изменившихся deployable layers.
3. Функциональные и contract differences.
4. Compose/runtime/config differences без secret values.
5. Схему и migration decision с доказательствами.
6. Неперсональные counts/invariants до обновления.
7. План сборки, backup, staged rollout и rollback/forward recovery.
8. После выполнения — artifacts/checksums, applied steps и validation result.

Для behavior-changing release укажи принятые `REQ-*`; для чистой release
operation используй `none` с причиной, что переносится уже принятое поведение.

## 5. Принять migration decision

Штатный путь — неизменённые уже применённые migrations плюс новые forward EF
migrations. Дополнительный data/compatibility script нужен только если:

- target ожидает objects/data, добавленные изменением уже применённой migration;
- требуется backfill, который нельзя безопасно выразить штатным startup path;
- переход имеет обязательный precondition/activation sequence.

Для нового script:

1. Запиши source и target schema/data invariants.
2. Выполни validation queries до DDL/DML.
3. Прервись до writes при ambiguity.
4. Используй transaction, deterministic mapping и idempotency guards.
5. Добавь postconditions и агрегированный итог.
6. Проверь повторный запуск, failure rollback и retained-data upgrade на
   восстановленной копии либо репрезентативном изолированном scenario.
7. Получи независимый backend review и checksum.

Не выполняй destructive normalization и не подставляй догадки за ambiguous
business mapping.

## 6. Проверить target и собрать release

Запусти root verification harness с diff-выбранными областями. Если есть task
contract, используй его; иначе не выдумывай task ID. Дополнительно исполни
affected runtime/migration scenarios из scoped `AGENTS.md`.

### Локальный кеш сборки

До сборки определи стабильный cache root во временной области build host, но
вне Git repository и вне одноразового release checkout. Например:

```bash
DEPLOY_BUILD_CACHE_ROOT="${TMPDIR%/}/gym-crm-release-build-cache"
```

Точный путь может отличаться, но он обязан:

- переиспользоваться следующими release builds на этом build host;
- не попадать в Git index, Docker build context, release archive или backup;
- не содержать credentials, private NuGet source secrets или remote `.env`;
- не удаляться вместе с успешным isolated checkout;
- иметь контролируемые permissions и проверяемый лимит свободного места.

Используй раздельные cache namespaces как минимум для target platform и
dependency type, чтобы несовместимые `linux/amd64` и native-host layers не
смешивались. До сборки:

1. Проверь доступность local Docker/BuildKit cache и уже загруженных base images.
2. Импортируй сохранённый BuildKit cache; после успешной сборки экспортируй его
   обратно атомарно, не оставляя частично обновлённый cache как валидный.
3. Для backend используй persistent NuGet package cache через BuildKit cache
   mount на `/root/.nuget/packages` либо эквивалентный project-owned mechanism.
4. Сохраняй восстановленные NuGet packages между сборками; валидность определяют
   project manifests, resolved dependency graph, package integrity и sources,
   а не только совпадение имени файла.
5. Разрешай network fallback: отсутствующий base image, BuildKit layer или NuGet
   package скачивается из штатного registry/feed, после чего попадает в local
   cache для последующих сборок.
6. При повреждении удаляй/перестраивай только подтверждённо невалидную cache
   entry. Не очищай весь cache и не запускай `--no-cache` как обычный путь.

Если текущий Dockerfile или `deploy/build-images.sh` не позволяют подключить
external BuildKit/NuGet cache, не подменяй project build ad-hoc командой во время
релиза. Оформи поддержку кеша как изменение в dedicated task worktree, проверь
её, интегрируй в target branch, обнови exact target commit и только затем создай
immutable release checkout.

Кеш является ускорителем, а не источником истины. Даже при полном cache hit
сохраняются locked restore, dependency audit, image provenance, checksum и
platform validation. Если кеш отсутствует (включая очистку временной области
операционной системой), сборка должна корректно скачать зависимости из сети и
восстановить кеш без изменения release semantics.

Собери image-only release проектными scripts. Для amd64 target типовой вызов:

```bash
IMAGE_PLATFORM=linux/amd64 IMAGE_TAG=<release-tag> ./deploy/build-images.sh
IMAGE_PLATFORM=linux/amd64 IMAGE_TAG=<release-tag> ./deploy/export-images.sh
```

Проверь generated image env, archive и checksum. Передавай только необходимые
release artifacts и operational files. Не включай source credentials и local
`.env`.

## 7. Создать и проверить backup

До миграции или смены image:

- подтверди отсутствие другого release/migration/backup процесса;
- проверь свободное место с запасом для backup и новых release artifacts;
- создай PostgreSQL custom dump;
- проверь dump через `pg_restore --list`;
- сохрани копии remote `.env` и server Compose с ограниченными permissions, не
  выводя содержимое;
- сохрани image/container/Compose metadata;
- архивируй client photos и bot persistent data, если они существуют;
- вычисли checksums и запиши backup location в технический отчёт.

Backup непроверяемый или неполный для затронутого persistent data — no-go.
Недостаточное место или неразрешённая параллельная release operation — no-go.

## 8. Передать и применить release

1. Создай отдельный remote release directory.
2. Передай archive, image env, checksum и нужные migration scripts.
3. Сверь checksum на сервере.
4. Загрузить images через `deploy/load-images.sh` или документированный
   эквивалент.
5. Обнови только image variables, сохранив остальные secret/config values.
6. Выполни `docker compose ... config --quiet` до запуска.
7. Для совместимого component-only change используй scoped `up -d --no-deps`.
8. Для coordinated transition останови только application services без volumes,
   выполни migration sequence и activation checks, затем запусти dependents.

Никогда не используй `down -v` или seed на retained stand.

## 9. Проверить после обновления

Минимальная CRM-проверка:

- `docker compose ... ps`, health и restart counts;
- internal backend `/health/ready`;
- frontend `/healthz` и proxied `/api/health/ready`;
- внешние `/`, `/healthz`, `/api/health/ready`, если доступны;
- active image IDs, tags и target architecture;
- final EF history и migration postconditions;
- те же агрегированные counts/invariants, что были сняты до релиза;
- smoke затронутых critical workflows без раскрытия персональных данных.

Ожидаемые audit increments объясни. Любое необъяснимое уменьшение прикладных
counts или нарушение invariant — failure и немедленная остановка.
Remote migration, отсутствующая в target, schema ahead of target или
несоответствие фактической схемы `__EFMigrationsHistory` блокирует rollout.

## 10. Rollback и forward recovery

До rollout классифицируй переход:

- **Application-reversible:** schema совместима назад; можно вернуть previous
  image variables/config и перезапустить services.
- **Forward-only schema:** старые images несовместимы; нельзя слепо откатывать
  приложение или БД. Используй подготовленный forward fix/recovery.
- **Ambiguous/destructive:** не начинать deployment без отдельного решения
  пользователя и проверенного recovery rehearsal.

Не выполняй автоматический DB downgrade на retained data.

## 11. Сформировать пользовательский release note

`docs/RELEASE_NOTES_<date>.md` пиши на языке пользователей. Группируй по
реальным сценариям: что появилось, что стало быстрее/понятнее, что изменилось в
доступном поведении. Указывай ограничения только если они важны пользователю.

Исключи:

- commits, branches, tags, Docker и architecture;
- SQL, EF migrations, schema и service wiring;
- checksums, backup paths, тестовые totals и agent work;
- внутренние рефакторинги без наблюдаемого эффекта.

## 12. Финальный handoff

Сообщи:

- success / failed / recovered;
- target commit и фактические active images;
- какие services обновлены;
- migration: not required / applied с postconditions / blocked;
- backup и rollback/forward-recovery point;
- health, migration и data-preservation verification;
- ссылку на технический diff и, только после success, functional release notes;
- exact checks, которые не удалось выполнить, и почему.

Не удаляй failure workspace или remote evidence до завершения диагностики.
