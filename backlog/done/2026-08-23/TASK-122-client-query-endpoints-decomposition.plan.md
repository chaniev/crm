# Implementation Plan: TASK-122 Выделить read-only client query endpoints

## Metadata
- source_task: /backlog/done/2026-08-23/TASK-122-client-query-endpoints-decomposition.md
- branch: refactor/TASK-122-client-query-endpoints-decomposition
- readiness: no — требуется human review authorization/scope characterization перед исполнением
- dependencies: none
- risk: medium — перенос EF queries, coach scope и response mapping может изменить видимость персональных данных

## Goal
Read-only client routes меняются через focused query modules, а исходный
`ClientEndpoints.cs` уменьшается минимум на 1000 строк без изменения HTTP,
authorization, paging или SQL-observable поведения.

## Decisions and contracts
- Сохранить существующие GET routes для list, expiring memberships, expiration
  suggestion и details, включая endpoint metadata, query names, defaults,
  status codes и ProblemDetails.
- Один query owner хранит parsing/paging/filtering, coach scope, ordering и
  hydration. Общий read-response mapper может быть отдельным neutral internal
  type, если он нужен остающимся mutation handlers; query module не получает
  write/audit responsibilities.
- Сохранить текущую точку materialization и количество/форму paging queries;
  структурный split не разрешает новый repository или client-side filtering.
- `MapClientEndpoints` остаётся composition root и только подключает bounded
  route groups.

## Scope
### In
- List/quick filters/counts/paging, expiring list, expiration suggestion,
  client details, attendance-history hydration и response mapping.
- Characterization route/OpenAPI, raw HTTP, scope and ordering tests.

### Out
- Любые client/membership mutations, audit writes, API/SQL/schema и frontend changes.

## Implementation slices
1. Зафиксировать GET route manifest и focused HTTP matrix для filters, paging,
   detail hydration, invalid inputs и role/branch scope.
2. Выделить list/attention/suggestion registration и query pipeline, сохраняя
   текущие `IQueryable` boundaries и response bytes/semantics.
3. Выделить details loader и neutral response mapping; подключить modules из
   `MapClientEndpoints` и удалить только перенесённые read helpers.
4. Подтвердить reduction на 1000+ строк и отсутствие mutation/audit symbols в
   query modules.

## Likely files and layers
- `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs` — оставить composition и write routes.
- `backend/src/GymCrm.Api/Auth/ClientQueryEndpoints.cs` — GET registration/handlers.
- `backend/src/GymCrm.Api/Auth/ClientQueryPipeline.cs` — filters, paging, scope и hydration, если один endpoint type станет слишком широким.
- `backend/src/GymCrm.Api/Auth/ClientResponseMapper.cs` — shared read projection only, если фактические consumers подтверждены.
- `backend/tests/GymCrm.Tests/ClientsApiTests.cs` — существующие list/detail/scope regressions.
- `backend/tests/GymCrm.Tests/ClientQueryEndpointContractTests.cs` — route manifest и focused raw-contract matrix.

## Regression specification
### Automated tests to add or update
- Endpoint metadata фиксирует четыре GET templates/methods и отсутствие duplicate routes.
- List matrix фиксирует default/legacy paging, combined filters, quick-filter
  counts, deterministic order, empty page и validation field keys.
- Coach allowed scope возвращает только assigned-group clients и redacted
  fields; HeadCoach/Administrator/SuperAdministrator сохраняют current branch/global behavior.
- Details matrix фиксирует not-found/forbidden, contacts/groups/photo,
  membership history/current summary и partial attendance paging.
- Expiring/suggestion tests фиксируют role denial, ordering, dates and payload shape.

### Expected red evidence
- Behavior red неприменим: задача намеренно не добавляет observable behavior.
  Новые characterization tests должны быть green на baseline до переноса и
  оставаться green после каждого slice. Не создавать искусственный failing
  contract test; structural gap подтверждается отсутствием modules и текущими
  3951 строкой/смешанными symbols в `ClientEndpoints.cs`.

### Required validation
- Focused xUnit run по `ClientQueryEndpointContractTests` и существующим
  `ClientsApiTests` list/detail/search/scope/attention сценариям.
- Сравнить endpoint manifest до/после и проверить `ClientEndpoints.cs <= 2951` строк.

### Regression barrier
- Один raw-HTTP role/scope matrix: list с filters/paging/counts → scoped detail
  с hydration → forbidden cross-scope detail, при неизменных route metadata и
  JSON/ProblemDetails contracts.

## Risks and stop conditions
- Остановиться, если перенос требует изменить query materialization, route/API
  contract или authorization policy: сначала зафиксировать отдельное решение.
- Остановиться при расхождении list/detail scope или SQL/paging semantics с
  baseline; structural target не оправдывает behavioral change.
- Не продолжать, если shared mapper начинает владеть mutation validation/audit.
