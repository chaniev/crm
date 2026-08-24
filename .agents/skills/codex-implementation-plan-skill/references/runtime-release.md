# Runtime, migrations and deployment

Читать этот файл только если меняются schema/data/runtime либо явно требуется
обновить стенд.

## Миграции

1. Определить поддерживаемую исходную schema и механизм миграций.
2. Не переписывать уже применённые migrations.
3. Для одной новой migration проверить upgrade от поддерживаемой предыдущей
   schema; отдельный прогон «каждой migration» не нужен.
4. Для нескольких новых migrations проверить их ordered chain и сериализовать
   изменения общего snapshot/metadata.
5. Проверить transformation существующих данных, required defaults,
   constraints order и сохранность данных.
6. Проверить clean bootstrap только если проект его поддерживает.

Копия deployed DB и backup нужны только для проверки сохранности реальных
данных или обновления shared environment. Для disposable task DB без ценных
данных backup не создавать.

## Task runtime

Запускать изолированный Compose/runtime stack только когда tests/build не дают
нужного evidence: меняется runtime contract, миграция, конфигурация, health или
интеграция сервисов. Для static/component-only задач stack пропускать.

Task stack должен использовать уникальные project name, ports, network и
volumes. Старую schema с representative data готовить только для migration/data
compatibility. В остальных случаях допустима clean disposable DB.

Проверять только применимое: migration history, readiness/health, ошибки в
логах, сохранность данных и основной изменённый сценарий.

## Deployment

Deployment выполнять только при явно заданном target. Production требует
отдельного явного разрешения.

Для shared DB перед потенциально необратимым действием подтвердить backup и
rollback/recovery. Использовать project strategy; по умолчанию:

`backup -> ordered migration/expand -> deploy exact image/SHA -> health -> smoke`

Если migration запускается приложением/deploy command, не применять её второй
раз; проверить migration history и фактическую schema. Для expand/contract
соблюдать предусмотренные backfill/contract phases.

После deployment зафиксировать target, exact image/SHA, schema version, health
и smoke outcome. Не продолжать destructive migration при риске потери данных
без проверяемого recovery.
