# Implementation Plan: TASK-083 Убрать неоплаченный статус клиентского абонемента

## Source task
/backlog/done/TASK-083-membership-payment-status-simplification.md

Source status is `done`: пользователь явно одобрил high-risk execution 2026-07-24; задача была переведена из `/backlog/risky` до production-кода и завершена 2026-07-24 после test-first реализации, clean PostgreSQL deployment и полного cross-layer validation.

## Git branch
feature/TASK-083-membership-payment-status-simplification

Branch rules:
- до первого изменения project-кода подтвердить явное разрешение на исполнение этого high-risk плана;
- проверить чистый worktree, перейти на `main`, выполнить `git pull` и создать `feature/TASK-083-membership-payment-status-simplification` от актуального `main`;
- подтвердить активную task branch до первого изменения project-кода;
- не включать TASK-082, общий RBAC refactoring, redesign возвратов или production data repair;
- остановить execution, если worktree dirty, текущая ветка неясна либо branch создана не от `main`.

## Goal
Любое новое назначение, продление или создающий новую продажу перевод клиентского абонемента атомарно фиксирует состоявшуюся оплату. Пользователь выбирает фактическую дату оплаты — сегодня либо любую прошедшую дату — и может позднее исправить ошибочно введённую дату через существующий correction flow с обязательным audit. Backend больше не хранит и не распространяет paid/unpaid state, а дата оплаты остаётся отдельной от даты оформления продажи, времени записи и периода действия абонемента.

## Approved product and contract decisions

Эти решения подтверждены пользователем 2026-07-24 и являются обязательной частью implementation contract:

1. `ClientMembershipSale` становится источником истины для оплаты, потому что платёж относится к продаже, а не к каждой version назначения.
2. В sale добавляется обязательная `PaymentDate: DateOnly`. `PurchaseDate` остаётся backend business date оформления продажи; `CreatedAt` остаётся временем внесения записи; `CreatedByUserId` остаётся actor, оформившим продажу и оплату.
3. Read API возвращает для sale/current/history обязательные `paymentDate`, `paymentRecordedByUserId`, `paymentRecordedByUserName`, `paymentRecordedAt`. Последние три проецируются из `CreatedByUserId`, `CreatedByUser` и `CreatedAt`; отдельные дублирующие payment-actor/time колонки не добавляются. Это actor и время внесения оплаты в CRM, а не отдельная модель фактического кассира.
4. Из `ClientMembership` и начальной схемы удаляются `IsPaid`, `PaidByUserId`, `PaidAt`; из `User` удаляется navigation `MembershipPayments`. Correction, write-off/restore и version history больше не копируют payment state между versions.
5. Новый purchase/renew/transfer contract принимает обязательную `paymentDate` и не содержит выбираемого `paymentStatus`/`isPaid`.
6. Transitional compatibility применяется только на write boundary:
   - отсутствие/null legacy status либо `paymentStatus=Paid`/`isPaid=true` допускается на один переходный релиз;
   - наличие хотя бы одного `paymentStatus=Unpaid` или `isPaid=false`, в том числе одновременно с harmless paid marker, отклоняется до idempotency reservation и до любых записей стабильным `400 membership-payment-status-removed`;
   - неизвестный ненулевой legacy marker отклоняется обычной стабильной validation error и не преобразуется в оплату;
   - legacy paid marker не входит в semantic idempotency hash, поэтому старый и новый payload одной оплаченной операции эквивалентны;
   - frontend и bot сразу переходят на новый контракт и не отправляют legacy status.
7. `paymentDate` обязательна, имеет формат `yyyy-MM-dd` и не может быть позже backend `IBusinessDateProvider.Today`, который одновременно становится `PurchaseDate` новой sale.
8. Нижней границы для `PaymentDate` нет: пользователь может указать любой прошлый период, в том числе дату до появления клиента в CRM, до `PurchaseDate`, `IndividualValidFrom` или `IndividualValidTo`. Backdated payment не меняет срок абонемента, attendance history или effective membership.
9. Для сохраняемого при transfer активного неиспользованного `SingleVisit` новая sale не создаётся, поэтому payment fields по-прежнему запрещены; сохраняется payment metadata исходной sale.
10. Web mark-payment endpoint и internal bot mark-payment endpoint на один переходный релиз становятся защищёнными прежними `ManageClients`/service-token правилами tombstones с `410 membership-payment-action-removed`. Internal bot unpaid-list endpoint на тот же релиз возвращает `410 membership-unpaid-list-removed`. Tombstones не создают version/audit/idempotency records и физически удаляются отдельной cleanup-задачей в следующем релизе.
11. Из read contracts удаляются `isPaid` и `hasUnpaidCurrentMembership`. `hasActivePaidMembership` переименовывается в `hasActiveMembership`; `ActivePaid` переименовывается в `Active`; unpaid filters, states, warnings, attention reasons и debt lists удаляются. Любой явно переданный удалённый payment-status/state filter, включая legacy `Paid` и `Unpaid`, получает стабильный `400 membership-payment-filter-removed`, а не игнорируется и не преобразуется в пустой результат.
12. Финансовая дата sale event равна `PaymentDate`. `SoldMembershipCount`, `GrossSales` и first-sale/new-client classification попадают в период фактической оплаты.
13. Организационная атрибуция sale остаётся на `PurchaseDate`, а не на backdated `PaymentDate`: филиал, группа и тренер определяются в контексте даты оформления записи. Это предотвращает потерю backdated sale, если на фактическую дату оплаты клиента ещё не было в CRM. Financial projection должна разделять `AccountingDate` и `AttributionDate`.
14. Для refund и accounting date, и organizational attribution date равны `RefundDate`: возврат попадает в период, филиал, группу и тренера клиента на дату возврата. Существующие refund validation, суммы и cancellation не меняются.
15. Purchase, renewal и transfer сохраняют sale, assignment/version, обязательный audit и idempotency completion в одной transaction. Transfer получает тот же обязательный `Idempotency-Key`, semantic hash, replay/conflict contract и защиту от double submit, что purchase/renew. Это утверждённое расширение текущего transfer boundary, необходимое для атомарности TASK-083. Ошибка validation/audit/constraint не оставляет частичных данных.
16. `PaymentDate` можно изменить через существующий addressed correction flow с `SaleId` и `ExpectedMembershipId`. Correction обновляет sale-owned date для всех versions этой sale, требует `paymentDate <= IBusinessDateProvider.Today`, а при фактическом изменении сохраняет old/new payment date в обязательном sale audit, использует существующую correction idempotency/transaction boundary и немедленно меняет соответствующий финансовый период. Неизменившаяся дата не создаёт ложный sale transition. Payment-date correction не меняет `PurchaseDate`, membership validity, attendance history, branch/group/trainer attribution или single-visit usage.
17. Backend, frontend и bot выпускаются согласованно одним deployment; отдельный transitional read contract для старых consumers не требуется. Deployment обязан исключить обслуживание старого закешированного frontend bundle новым backend contract.
18. Все рабочие окружения и PostgreSQL data можно пересоздать с нуля; existing production rows сохранять и конвертировать не требуется. Поэтому schema меняется через воспроизводимое начальное состояние без новой migration/backfill.

## Current understanding
- Backend владеет membership lifecycle, payment semantics, business date, attendance eligibility, financial reporting, audit, validation и ProblemDetails.
- `ClientMembership` сейчас хранит version-level `IsPaid`, `PaidByUserId`, `PaidAt`, а `ClientMembershipSale` хранит `PurchaseDate`, сумму, actor и время создания. Correction, mark-payment, write-off и restore копируют payment state между versions.
- Purchase, renewal и transfer принимают `PaymentStatus` плюс условную `PaymentDate`; `Unpaid` создаёт sale и assignment без payment metadata.
- `ClientMembershipSemantics` исключает неоплаченный абонемент из active eligibility и добавляет `Unpaid` issue, из-за чего legacy state влияет на attendance, client lists, attention dashboard и bot.
- Web API содержит payment filter, `Unpaid` membership state, unpaid attention state, `hasUnpaidCurrentMembership`, `isPaid` в нескольких responses и отдельный mark-payment command.
- Internal bot API и Python bot содержат отдельное меню должников, unpaid list и mark-payment write flow.
- Financial report выбирает sales по `ClientMembershipSale.PurchaseDate`; фактическая дата оплаты сейчас не влияет на отчётный период. Один `EventDate` одновременно используется для accounting period и branch/group/trainer attribution.
- `ClientDetailsResponse.BusinessDate` уже даёт frontend backend-owned дату. Её следует использовать как default и `max` для payment input; browser clock не должен быть источником validation.
- Existing correction адресует membership через `SaleId`/`ExpectedMembershipId`, но меняет только validity. TASK-083 сохраняет targeting и расширяет correction одним sale-owned `PaymentDate` field с обязательным audit.
- Existing transfer не использует membership idempotency boundary и пишет audit после commit. Утверждённый scope TASK-083 исправляет это только настолько, насколько необходимо для атомарной sale-creating transfer.
- Runtime database признана пересоздаваемой; migration/backfill существующих unpaid rows не требуется.
- Backend, frontend и bot deploy согласован; transitional write markers и tombstones нужны для диагностируемого API cutover, но transitional read aliases не нужны.
- TASK-070 и TASK-078 остаются историческими завершёнными задачами. TASK-083 заменяет только их paid/unpaid решение и не переоткрывает catalog, lifecycle, pricing или correction targeting; утверждённые payment-date correction и transfer idempotency являются локальными исключениями, явно описанными этим планом.
- TASK-082 не реализуется в этой ветке. Если `SuperAdministrator` уже присутствует к моменту execution, доступ наследуется через существующую backend policy, а не через новую локальную role check.

## Safe decomposition and review gates

### Slice A — Red contract tests and schema decision
- Добавить unit/API/PostgreSQL tests, описывающие обязательную и корректируемую payment date, запрет future/unpaid payload, sale-owned metadata и отсутствие частичных записей.
- Зафиксировать red evidence на purchase, renewal и transfer до production changes.
- Review gate: sale-owned модель, неограниченный past backdate, accounting/attribution rules, coordinated deploy и отсутствие необходимости сохранять existing rows уже подтверждены; перед implementation сверить, что red tests точно отражают эти решения.

### Slice B — Backend write model and clean schema
- Перенести payment metadata в sale, удалить version-level status и обновить начальную EF schema без новой migration.
- Перевести purchase/renew/transfer на обязательную payment date и единый backend policy; расширить addressed correction аудируемым изменением `PaymentDate`.
- Сохранить текущие lifecycle, permissions, pricing и optimistic target; добавить утверждённый transfer idempotency boundary без общего refactoring transfer flow.
- Review gate: clean PostgreSQL schema, write integration tests и audit/atomicity tests green.

### Slice C — Backend read semantics, reports, attendance and internal bot contract
- Удалить unpaid state из client/attention/attendance projections.
- Разделить accounting и attribution dates в financial report: sale использует `PaymentDate`/`PurchaseDate`, refund использует `RefundDate`/`RefundDate`.
- Удалить unpaid/mark-payment из active internal bot contract и оставить documented tombstones.
- Review gate: backend full suite и focused report/attendance/bot contract suites green.

### Slice D — Frontend consumer and UX
- Перед production UI changes привлечь `ui-designer` для локальной проверки payment-date field, confirmation и истории, как требует repository rule для заметного UX change.
- Удалить status selectors/mark-payment/debt UI; сделать payment date обязательной и заполненной `client.businessDate`; добавить изменение payment date в существующий correction UX.
- Обновить API types/mappers, client list filters, home/attendance panels и focused Playwright.
- Review gate: component/API/e2e tests, lint и build green.

### Slice E — Python bot consumer
- Удалить unpaid menu/list/callback/write flow и legacy payment fields из models.
- Сохранить thin-adapter boundary: bot не выводит собственные membership rules.
- Review gate: ruff, pytest и backend internal-bot contract tests green.

Slices являются последовательными фазами одной cross-layer задачи и должны быть реализованы в одной task branch и выпущены согласованно, чтобы backend contract и оба consumers не разъехались. Если их позже превратить в независимые backlog TASKs, каждая получает отдельную branch и явную compatibility/deployment dependency.

## Execution steps
1. Получить отдельное явное разрешение на high-risk code execution, убедиться, что source task перемещён в `/backlog/implementation`, проверить clean `main`, выполнить pull и создать `feature/TASK-083-membership-payment-status-simplification`.
2. Зафиксировать baseline contract matrix: purchase, renewal, transfer с `Paid`/`Unpaid`, current/history reload, mark-payment, attendance, attention, client filters, internal bot и financial report.
3. Повторно проверить утверждённую runtime database policy перед schema edit: окружение действительно пересоздаётся с нуля, production backfill/upgrade не требуется. Если фактическое окружение этому противоречит, остановиться.
4. **До production-кода** добавить unit tests для required/correctable payment-date policy, legacy payload classification, sale-owned projection, status-free membership semantics и financial accounting/attribution date separation.
5. Запустить новые unit tests и подтвердить ожидаемый red из-за отсутствующей модели/семантики, а не из-за неверной test infrastructure.
6. **До production-кода** добавить real-PostgreSQL integration/API tests для purchase, renewal, transfer и correction, clean schema, idempotency, atomicity, audit, future/backdated dates, legacy payload и tombstone endpoints.
7. Запустить focused PostgreSQL tests и зафиксировать ожидаемый red. Проверки должны перечитывать данные через новый scope и считать sale/version/audit/idempotency rows.
8. **До production-кода** добавить backend integration tests для client list/details/attention, attendance eligibility/warnings, financial period/attribution и internal bot contracts без unpaid semantics.
9. Запустить их и зафиксировать ожидаемый red.
10. **До frontend production-кода** обновить/добавить API/component/Playwright tests: status selector и mark-payment отсутствуют, payment date обязательна, default/max равны `client.businessDate`, backdated value отправляется без изменения validity dates, correction меняет только payment date, backend ProblemDetails отображается.
11. Запустить frontend focused tests и зафиксировать ожидаемый red.
12. **До bot production-кода** обновить Python bot tests: unpaid menu/list/action отсутствуют, membership models не требуют `isPaid`/`hasUnpaidCurrentMembership`, attendance/expiring/search flows продолжают работать.
13. Запустить bot focused tests и зафиксировать ожидаемый red.
14. Review red evidence. Если оплата не может быть локализована на sale либо financial attribution требует production-grade reconciliation, остановиться и обновить план.
15. Реализовать минимальный backend domain/application contract: required and correctable sale `PaymentDate`, без `IsPaid` и mark-payment mutation; добавить один small payment-date policy без HTTP/EF dependencies.
16. Обновить persistence model, relationships, test seed data, `InitialCreate`, оба migration designer и model snapshot; новую migration не создавать.
17. Обновить purchase/renew/transfer/correction DTO, validation, commands, idempotency payloads и service flow. Любой `Unpaid`/`false` legacy marker, включая конфликтующий payload, отклонять до reservation/writes; отсутствующий/null или paid legacy marker не управляет backend result.
18. Обеспечить одну transaction для sale, membership assignment/version, audit и idempotency completion во всех трёх sale-creating write flows, включая transfer; применить тот же barrier к payment-date correction.
19. Удалить mark-payment service method/error/action semantics; заменить web/internal bot action endpoints на защищённые `410 membership-payment-action-removed`, а internal bot unpaid list — на защищённый `410 membership-unpaid-list-removed`.
20. Обновить read projections и semantics: убрать unpaid fields/states/reasons/filters, переименовать active contract, сохранить expiration/single-visit/professional eligibility.
21. Обновить financial report: sale selection/first-sale ordering по `PaymentDate`; sale branch/group/trainer attribution по `PurchaseDate`; refund accounting и attribution по `RefundDate`; загружать assignment history по фактическому диапазону attribution dates событий, а не только по query period.
22. Обновить backend bot contracts/service и audit snapshots; payment date/recording actor/time должны одинаково читаться в current membership и каждой history version той же sale, а correction audit — содержать old/new `PaymentDate`.
23. После backend contract green выполнить локальный `ui-designer` checkpoint и минимально обновить frontend: один required date field во всех создающих sale формах, default/max из `client.businessDate`, редактирование даты в correction flow, без paid badge/status selector/mark-payment/debt filter.
24. Обновить frontend types, endpoints, mappers, resources, home/attention/attendance/client-list consumers и confirmation/history/correction rendering.
25. Обновить Python bot menu, API client, Pydantic models, callbacks, keyboards и resources без дублирования backend business rules.
26. Рerun focused red tests до green, затем полный backend suite, frontend lint/build/tests/Playwright и bot ruff/pytest.
27. Пересоздать локальный PostgreSQL/stand из пустого состояния, проверить migrations/model drift, seed, health и smoke для today/backdated purchase, renewal, transfer, payment-date correction, report, attendance, web reload и bot reads.
28. Выполнить финальный `rg` по `IsPaid|isPaid|Unpaid|unpaid|mark-payment|HasUnpaidCurrentMembership|paymentStatus`; разрешены только явно документированные compatibility/tombstone участки и исторические backlog artifacts.
29. Сверить diff с TASK-083: не должно быть TASK-082, refund redesign, pricing changes, production data repair или несвязанного refactoring.

## Preferred implementation strategy
- Contract-first и backend-first: сначала зафиксировать sale-owned payment model и stable failures, затем менять consumers.
- Выделить маленький `ClientMembershipPaymentDatePolicy` рядом с application membership policies; он принимает `paymentDate` и backend `purchaseDate/businessDate`, не знает об HTTP, EF или UI.
- Не подставлять `isPaid=true` на frontend и не оставлять вычисляемый unpaid state. Отсутствие unpaid состояния должно быть доказано типами, schema и contract tests.
- Хранить `PaymentDate` как PostgreSQL `date`, а время записи — как существующий sale `CreatedAt`. Не превращать date-only факт оплаты в midnight timestamp.
- Сохранять `PurchaseDate` отдельно: это дата оформления sale в CRM и attribution date; `PaymentDate` — accounting date; `CreatedAt` — техническое время записи; validity — отдельный период назначения.
- Для transition принимать только harmless legacy paid marker; negative marker должен давать стабильный ProblemDetails и ноль writes. Не молча преобразовывать `Unpaid` в paid.
- Tombstones предпочтительнее silent `404` на один переходный релиз, потому что дают web/bot consumers диагностируемую судьбу удалённой команды.
- Не раздувать `ClientEndpoints.cs` и `ClientManagement.tsx`: новые policy/compatibility helpers и reusable payment-date field размещать в focused files, не выполнять общий refactor этих больших файлов.
- Делать небольшие commits по slices после green focused suite.

## Files likely to change

### Backend tests first
- `backend/tests/GymCrm.Tests/ClientMembershipPaymentSimplificationApiTests.cs` — новый focused purchase/renew/transfer/correction/legacy/tombstone/audit/idempotency suite.
- `backend/tests/GymCrm.Tests/ClientMembershipPersistenceModelTests.cs`
- `backend/tests/GymCrm.Tests/ClientMembershipWriteRegressionApiTests.cs`
- `backend/tests/GymCrm.Tests/ClientMembershipCreationPricingApiTests.cs`
- `backend/tests/GymCrm.Tests/MembershipTransferCatalogTests.cs`
- `backend/tests/GymCrm.Tests/ClientsApiTests.cs`
- `backend/tests/GymCrm.Tests/AttendanceApiTests.cs`
- `backend/tests/GymCrm.Tests/FinancialReportsApiTests.cs`
- `backend/tests/GymCrm.Tests/InternalBotApiTests.cs`
- `backend/tests/GymCrm.Tests/BootstrapSmokeTests.cs`
- `backend/tests/GymCrm.Tests/TestDataSeederTests.cs`

### Backend production after red phase
- `backend/src/GymCrm.Domain/Clients/ClientMembership.cs`
- `backend/src/GymCrm.Domain/Clients/ClientMembershipSale.cs`
- `backend/src/GymCrm.Domain/Users/User.cs`
- `backend/src/GymCrm.Application/Clients/IClientMembershipService.cs`
- `backend/src/GymCrm.Application/Clients/ClientMembershipSemantics.cs`
- `backend/src/GymCrm.Application/Clients/ClientMembershipPaymentDatePolicy.cs` — likely new focused policy.
- `backend/src/GymCrm.Infrastructure/Clients/ClientMembershipService.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/ClientMembershipConfiguration.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/ClientMembershipSaleConfiguration.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/UserConfiguration.cs`
- `backend/src/GymCrm.Api/Auth/PurchaseClientMembershipRequest.cs`
- `backend/src/GymCrm.Api/Auth/RenewClientMembershipRequest.cs`
- `backend/src/GymCrm.Api/Auth/TransferClientBranchRequest.cs`
- `backend/src/GymCrm.Api/Auth/CorrectClientMembershipRequest.cs`
- `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/ClientMembershipResponse.cs`
- `backend/src/GymCrm.Api/Auth/ClientDetailsResponse.cs`
- `backend/src/GymCrm.Api/Auth/ClientListItemResponse.cs`
- `backend/src/GymCrm.Api/Auth/ClientMembershipAuditState.cs`
- `backend/src/GymCrm.Api/Auth/ClientMembershipSaleAuditState.cs`
- `backend/src/GymCrm.Api/Auth/ClientAttentionEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/ClientAttentionMembershipResponse.cs`
- `backend/src/GymCrm.Api/Auth/AttendanceEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/AttendanceClientResponse.cs`
- `backend/src/GymCrm.Api/Auth/ClientPaymentStatus.cs` — expected deletion.
- `backend/src/GymCrm.Api/Auth/ClientMembershipState.cs`
- `backend/src/GymCrm.Api/Auth/MembershipAttentionState.cs`
- `backend/src/GymCrm.Api/Auth/MembershipAttentionListItemResponse.cs`
- `backend/src/GymCrm.Api/Auth/Resources/ClientResources.resx`
- `backend/src/GymCrm.Api/Auth/Resources/AttendanceResources.resx`
- `backend/src/GymCrm.Infrastructure/Attendance/AttendanceService.cs`
- `backend/src/GymCrm.Infrastructure/Reports/FinancialReportService.cs`
- `backend/src/GymCrm.Application/Bot/BotApiContracts.cs`
- `backend/src/GymCrm.Application/Bot/IBotApiService.cs`
- `backend/src/GymCrm.Infrastructure/Bot/BotApiService.cs`
- `backend/src/GymCrm.Api/Auth/BotInternalEndpoints.cs`
- `backend/src/GymCrm.Api/SeedData/TestDataSeeder.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.Designer.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260721210111_FixClientMembershipVersionConstraints.Designer.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/GymCrmDbContextModelSnapshot.cs`

### Frontend tests first
- `frontend/src/lib/api/clients.membership-pricing.test.ts`
- `frontend/src/lib/api/clients.test.ts`
- `frontend/src/lib/api/mappers.membership-pricing.test.ts`
- `frontend/src/features/clients/ClientManagement.test.tsx`
- `frontend/src/features/clients/ClientManagement.form.test.ts`
- `frontend/src/features/attendance/AttendanceScreen.test.tsx`
- `frontend/src/features/home/HomeDashboard.test.tsx`
- `frontend/e2e/membership-sale-pricing.spec.ts`
- `frontend/e2e/attendance.spec.ts`
- `frontend/e2e/home-dashboard.spec.ts`

### Frontend production after red phase
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/clients.ts`
- `frontend/src/lib/api/mappers.ts`
- `frontend/src/lib/api/endpoints.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/resources.ts`
- `frontend/src/features/clients/ClientManagement.tsx`
- `frontend/src/features/clients/MembershipPaymentDateField.tsx` — likely new reusable field.
- `frontend/src/features/clients/list/ClientsToolbar.tsx`
- `frontend/src/features/clients/list/clientListFilters.ts`
- `frontend/src/features/clients/list/clientListViewModel.ts`
- `frontend/src/features/attendance/AttendanceClientRow.tsx`
- `frontend/src/features/home/AttentionPanel.tsx`
- `frontend/src/features/home/MembershipsPanel.tsx`

### Bot tests first
- `bot/tests/test_crm_client.py`
- `bot/tests/test_bot_service.py`

### Bot production after red phase
- `bot/src/gym_crm_bot/crm/models.py`
- `bot/src/gym_crm_bot/crm/client.py`
- `bot/src/gym_crm_bot/core/service.py`
- `bot/src/gym_crm_bot/resources/keyboards.py`

Exact compatibility helper/resource filenames may be discovered after red tests. No production file may be edited before the corresponding automated tests exist and fail for the expected reason.

## Constraints
- Backend остаётся единственным источником истины для membership/payment/report/attendance/validation/audit.
- Frontend не отправляет hardcoded `isPaid=true` как гарантию правила.
- `PaymentDate`, `PurchaseDate`, `CreatedAt` и membership validity не объединяются и не выводятся друг из друга.
- Backdated payment не меняет `IndividualValidFrom`, `IndividualValidTo`, attendance history или single-visit usage.
- Correction может менять только sale-owned `PaymentDate` в дополнение к существующим validity fields; она не меняет `PurchaseDate`, actor/time записи, pricing, sale attribution или membership lifecycle.
- Purchase, renewal и sale-creating transfer применяют правило атомарно; preserving SingleVisit transfer не создаёт новую оплату.
- Sale-creating transfer требует `Idempotency-Key` и использует membership-compatible replay/conflict semantics; double submit не дублирует transfer, sale, membership, audit или assignments.
- Не ослаблять `ManageClients`, branch scope, HeadCoach-only Professional и иные permissions.
- Не менять catalog selection, pricing mode, gross amount, correction target/idempotency или overlap semantics из TASK-070/TASK-077/TASK-078.
- Не использовать EF InMemory как единственный regression barrier для schema, transaction, idempotency или concurrent constraints.
- Не добавлять новую migration; синхронизировать воспроизводимое initial state, оба designer и model snapshot.
- Не выполнять production data repair/backfill без отдельного утверждённого плана совместимости и rollback.
- Выпускать backend, frontend и bot согласованно; новый backend не должен обслуживать старый закешированный frontend bundle.
- Сохранить Mantine и Onest; не делать общий redesign client card.
- Bot остаётся thin adapter и не вычисляет payment/attendance rules самостоятельно.

## Out of scope
- Изменение цены, discount, pricing mode, catalog CRUD или gross/net formulas.
- Изменение refund amount/date/cancellation rules.
- Изменение membership validity, renewal duration, overlap, correction targeting или single-visit lifecycle; исключение — утверждённое аудируемое изменение sale-owned `PaymentDate`.
- Реализация TASK-082 или переработка roles/permissions.
- Массовая конвертация существующих production unpaid rows.
- Внешние платёжные провайдеры, эквайринг, reconciliation или payment reversal.
- Общий рефакторинг `ClientEndpoints.cs`, `ClientManagement.tsx`, reports или bot dialogs.
- Немедленное физическое удаление tombstone routes в том же релизе; cleanup выполняется отдельной задачей в следующем релизе.

## Required test coverage

Unit и integration tests MUST быть написаны или обновлены до functional code. Первый focused run должен падать из-за отсутствующей целевой семантики; implementation начинается только после review red phase.

### Unit tests
- Required payment date: today и прошедшая дата допустимы; future, missing и malformed отклоняются.
- Payment date может предшествовать purchase/record date и membership valid-from; validity не меняется.
- Payment-date correction принимает today/любую прошлую дату, отклоняет future/missing/malformed и не меняет purchase/validity/attribution.
- Legacy absent/null/`Paid`/`true` классифицируется как harmless compatibility marker; любой payload с `Unpaid`/`false`, включая конфликтующие markers, даёт approved stable error; разные harmless формы имеют одинаковый semantic idempotency payload.
- Membership eligibility зависит от existence/effective validity/single-visit usage/professional behavior, но не от payment status.
- Unpaid issue/state/filter/action больше не генерируются.
- Financial sale event имеет `AccountingDate=PaymentDate`, `AttributionDate=PurchaseDate`; refund имеет `AccountingDate=AttributionDate=RefundDate`.
- First sale определяется по `PaymentDate`, затем `CreatedAt`, затем `Id`.
- Current/history projection всех versions одной sale показывает одинаковые payment metadata из sale.

### Integration tests — real PostgreSQL mandatory
- Purchase, renewal и sale-creating transfer с today и backdated payment date создают ровно одну sale и одну открытую assignment version; fresh GET возвращает payment date/record actor/time.
- Future/missing/malformed payment date, legacy `Unpaid` и `isPaid=false` возвращают stable ProblemDetails и не создают sale/version/audit/idempotency completion.
- Harmless legacy paid payload и новый payload создают одинаково paid-by-definition sale; idempotent replay не дублирует данные.
- Sale-creating transfer требует `Idempotency-Key`; replay возвращает прежний результат, конфликтующий payload получает stable idempotency conflict, double submit не дублирует branch/group assignments, sale, membership или audit.
- Transfer с ошибкой payment validation/audit/constraint не меняет branch/groups/old membership; idempotency reservation очищается, audit и все writes откатываются.
- Preserved unused SingleVisit переносится без новой sale/payment; переданные sale/payment fields отклоняются без partial transfer.
- Payment-date correction меняет sale metadata для всех current/history versions, сохраняет old/new date в audit, пересчитывает financial period, поддерживает idempotent replay и не меняет purchase/validity/attendance/attribution.
- Write-off и restore не меняют sale payment metadata и не создают payment transitions.
- Mark-payment web/internal bot tombstones сохраняют прежнюю authorization boundary, возвращают `410 membership-payment-action-removed` и ничего не пишут.
- Unpaid bot list tombstone сохраняет service-token boundary, возвращает `410 membership-unpaid-list-removed`; active internal bot contracts не содержат unpaid fields/actions.
- Client list/details/attention не имеют unpaid filters/state/reasons/flags; любой supplied legacy paid/unpaid filter получает `400 membership-payment-filter-removed`, а не silent ignore или wrong result.
- Attendance больше не блокирует и не предупреждает по оплате; no-membership, future validity, expiration и used SingleVisit barriers сохраняются.
- Financial report относит gross sale в `PaymentDate`, sale branch/group/trainer в `PurchaseDate`, refund period и branch/group/trainer в `RefundDate`, а first-sale count — по первой payment date.
- Backdated payment до создания client assignment не теряется из отчёта: assignment loading покрывает attribution date, а не только accounting query range.
- Audit successful purchase/renew/transfer содержит actor, actual payment date, purchase date и recorded timestamp; обязательный audit failure откатывает membership mutation.
- Clean database создаёт required sale `PaymentDate` и не создаёт membership `IsPaid`/`PaidAt`/`PaidByUserId`; EF model не имеет pending changes.
- Seed создаёт только валидные paid-by-definition sales и запускается на чистой schema.

### Existing backend tests to update
- TASK-078 write/idempotency/target tests сохраняют свои barriers без mark-payment scenarios; их место занимают tombstone and no-transition assertions.
- Pricing tests продолжают доказывать immutable sale amount/catalog provenance.
- Refund tests подтверждают, что формулы и validation не изменились.
- Role/scope tests подтверждают Administrator/HeadCoach access, Coach denial и, если TASK-082 уже merged, policy-driven SuperAdministrator behavior.

### Frontend API/component tests
- Purchase, renewal и transfer отправляют `paymentDate` и не отправляют `paymentStatus`/`isPaid`.
- Все sale-creating формы открываются с `paymentDate=client.businessDate`; input required, `max=client.businessDate`, прошедшая дата сохраняется.
- Изменение payment date не меняет validity fields.
- Status selector, unpaid badges/reasons/filters и mark-payment action отсутствуют.
- Confirmation и history показывают actual payment date отдельно от purchase/validity date и отображают recording attribution, если она присутствует.
- Backend future/legacy ProblemDetails раскладывается в payment field/general error без потери draft.
- Correction form показывает текущую payment date, отправляет только утверждённое изменение вместе с existing optimistic target и сохраняет draft при backend error.
- Success закрывает форму и делает reload; double click создаёт один request/idempotency key.
- Home, attendance и client list не ожидают removed paid/unpaid fields.

### UI/e2e tests
- Today purchase, backdated purchase, renewal, transfer и payment-date correction проходят через UI и reload.
- После correction карточка/история показывают новую payment date, audit содержит old/new date, а validity остаётся прежней.
- Future date не отправляется при normal browser interaction; принудительный invalid backend response отображается корректно.
- В карточке, истории, home и attendance нет paid/unpaid action/status.
- Narrow-screen date input, error и confirmation остаются доступными без горизонтального overflow.

### Bot tests
- Menu literal/resources не содержат `unpaid_memberships`.
- Service не вызывает unpaid list/mark-payment, не создаёт соответствующие callbacks и buttons.
- CRM models/client успешно парсят новый status-free search/card/attendance/expiring contract.
- Оставшиеся writes сохраняют `X-Request-Id`/`Idempotency-Key` semantics.

## Test plan
- [x] Unit red/green: required/correctable payment date, legacy compatibility, status-free semantics, financial accounting/attribution projection.
- [x] Real PostgreSQL red/green: purchase, renewal, transfer, payment-date correction, atomicity, idempotency, audit, schema.
- [x] Backend contract red/green: client/attention/attendance/reports/internal bot/tombstones.
- [x] Frontend API/component red/green: payload, default/max date, errors, reload, removed status UI.
- [x] Focused Playwright: today/backdated purchase, renewal, transfer, payment-date correction, home/attendance and 320 px layout.
- [x] Bot red/green: menu, models, client calls, callbacks.
- [x] `dotnet test backend/GymCrm.slnx`.
- [x] `npm run lint` и `npm run build` в `frontend`, плюс затронутые frontend tests/Playwright.
- [x] `ruff check .` и `pytest` в `bot`.
- [x] Clean PostgreSQL migration/seed/model-drift validation и local stand smoke.
- [x] Финальный repository search не находит активной legacy unpaid семантики вне approved compatibility/tombstone и historical backlog.

## Regression barrier
Основной barrier — real-PostgreSQL API suite, который на фиксированном backend business date создаёт today/backdated purchase, renewal и transfer, выполняет payment-date correction, проверяет fresh reload, audit, idempotency и row cardinality, затем доказывает ноль writes для future/unpaid payload. Дополнительный financial test обязан показать sale в периоде `PaymentDate`, но branch/group/trainer attribution на `PurchaseDate`, refund accounting/attribution на `RefundDate` и перенос sale между периодами после audited correction. Frontend component/Playwright и bot contract suites защищают consumers от возврата status selector, debt list или mark-payment action.

## Risks
- Перенос payment metadata с version на sale затрагивает schema, audit, history и большое количество fixtures.
- Backdated accounting date и последующая payment-date correction могут изменить финансовые цифры и first-sale/new-client count в прошлых периодах.
- Purchase-date attribution sale и refund-date attribution refund требуют аккуратно разделить accounting/attribution ranges и не потерять события за пределами query period.
- Утверждённая initial-state стратегия безопасна только пока фактические runtime databases действительно можно пересоздать; существующий persisted volume нельзя обновить изменением старой migration.
- Несмотря на гарантированный coordinated deploy, старый закешированный frontend bundle нельзя допустить к новому read contract.
- Tombstone compatibility может случайно стать постоянным legacy API без follow-up cleanup.
- Большие shared files создают риск несвязанного refactoring и cross-role regressions.
- Transfer имеет сложную transaction boundary; новый idempotency barrier, audit и вложенный membership service должны участвовать в одной transaction без partial state.
- Удаление unpaid checks может по ошибке ослабить независимые expiration, future-validity или single-visit barriers.

## Stop conditions
Остановиться и не писать functional code, если:
- нет отдельного явного human approval high-risk code execution или source task не переведён в implementation;
- worktree dirty, активная branch не соответствует TASK-083 либо не создана от актуального `main`;
- фактическая среда, вопреки утверждённому решению, требует сохранить existing rows или не допускает пересоздание PostgreSQL volume;
- реализация не может сохранить утверждённые даты: sale accounting=`PaymentDate`, sale attribution=`PurchaseDate`, refund accounting/attribution=`RefundDate`;
- payment-date correction не может быть выполнена с optimistic target, idempotency, обязательным old/new audit и атомарным переносом финансового периода;
- оплата фактически должна поддерживать reversal, partial payment, external provider или reconciliation;
- нельзя атомарно объединить transfer sale/membership/audit/idempotency без более широкого redesign;
- API compatibility требует длительно сохранять writable unpaid state;
- coordinated deployment или принудительное обновление frontend bundle фактически не гарантированы;
- scope расширяется в TASK-082, refund redesign, pricing/catalog changes или system-wide finance redesign;
- backend contract нельзя определить без противоречия между web, bot, attendance и reports.

Не останавливаться только потому, что задача full-stack, затрагивает payments или требует обновить initial schema: эти риски уже локализованы фазами и regression barriers.

## Ready for Codex execution
yes

Product/architecture review завершён: sale/payment/refund dates, unlimited past backdate, audited payment-date correction, safe legacy handling, coordinated deploy, transfer idempotency, tombstones и disposable database policy подтверждены. `yes` означает готовность плана; это обновление не является разрешением писать project-код. Перед execution по-прежнему нужны отдельный явный запрос пользователя, перевод source task из `/backlog/risky` в `/backlog/implementation`, clean `main` и task branch.
