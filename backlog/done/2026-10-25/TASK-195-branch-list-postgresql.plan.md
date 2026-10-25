# Implementation Plan: TASK-195 PostgreSQL branch list regression

## Metadata
- source_task: /backlog/done/2026-10-25/TASK-195-branch-list-postgresql.md
- branch: codex/release-2026-10-24
- readiness: yes
- requirements: REQ-BRN-001 (implements), REQ-CLI-007 (constrains)
- product_decisions: none — восстанавливается уже принятый список филиалов с прежними полями, сортировкой и ограничением counts.
- technical_decisions: none — существующий EF query сортируется до существующей проекции; контракт, схема и ownership неизменны.
- architecture_decisions: none — локальное обратимое исправление трансляции SQL без нового механизма.
- open_questions: none

## Decisions and contracts
Сохранить принятые lookup/authorization semantics. Применить OrderBy(IsArchived),
ThenBy(Name), ThenBy(Id) к IQueryable<Branch> до ProjectBranches.
Регрессия использует PostgreSQL 17 и существующий BranchSettingsAppFactory.
Новый продуктовый или материальный технический выбор не требуется.
Remote recovery остаётся forward fix без открытия исправленного доступа к чужим клиентам.

## Decision evidence
- [Исходный запрос, доказанная ошибка и scope](/backlog/done/2026-10-25/TASK-195-branch-list-postgresql.md).
- [Действующие филиалы](/docs/requirements/09-филиалы-и-настройки.md) и
  [границы доступа клиентов](/docs/requirements/01-клиенты.md).
- [Существующий endpoint](/backend/src/GymCrm.Api/Auth/BranchEndpoints.cs) и
  [PostgreSQL fixture](/backend/tests/GymCrm.Tests/BranchSettingsPostgreSqlTests.cs).

## Implementation slices
1. Добавить PostgreSQL HTTP-регрессию списка, фильтра/порядка и scoped counts;
   проверить red на неизменённом production code.
2. Переставить сортировку до проекции; проверить regression green и review diff.
3. Обновить requirement evidence/CHANGELOG, выполнить diff-selected harness от
   5b1e036, интегрировать проверенный коммит в main, обновить exact release target.
4. Пересобрать из нового чистого checkout, повторить exact-image API smoke,
   затем продолжить авторизованный deployment с сохранением данных.

## Validation and stop conditions
Канонический harness выбирает backend/frontend/knowledge из endpoint diff.
Тест обязан доказать исходный HTTP 500 на PostgreSQL. При изменении DTO, scope,
схемы или появления нового продуктового решения остановить затронутую часть
и вернуть план к обсуждению. Не менять remote application до успешного smoke.

## Execution and integration evidence
Preflight passed до изменения production code. RED: все шесть PostgreSQL
list regression cases получили500 вместо200; GREEN: targeted fixture9/9.
Production diff переносит прежний OrderBy/ThenBy до неизменной проекции.
Чистый commit ea45076 прошёл diff-selected harness13/13 (714 backend и750
frontend tests, format/build/guards/audits), затем fast-forward main и push.
Из нового immutable checkout собраны release images; fresh-db API smoke
118/118 assertions прошёл, включая list/filter/scope/transfer/replay.
Remote deployment25.10.2026 завершён с сохранением данных.
Evidence: [canonical](TASK-195-evidence/verification.json),
[API smoke](TASK-195-evidence/api-smoke.json),
[release report](/docs/LOCAL_REMOTE_STAND_DIFF_2026-10-25.md).
