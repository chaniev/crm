# Implementation Plan: TASK-070 Создать управляемый справочник абонементов

## Source task
/backlog/risky/TASK-070-membership-catalog.md

Исходная задача остаётся в `/backlog/risky` до явного review: `Safe for Codex: no`, risk level `high`.

## Implementation branch
feature/TASK-070-membership-catalog

Branch rules:
- перед изменением project-кода проверить чистый `main`, выполнить `git pull` и создать ветку от актуального `main`;
- подтвердить активную ветку `feature/TASK-070-membership-catalog` до первого изменения кода;
- не включать в ветку другие TASK и несвязанный рефакторинг;
- при невозможности получить чистый `main` остановить реализацию.

## Goal
Администратор управляет каталогом абонементов только своего филиала, главный тренер — каталогами всех филиалов; новая продажа и перевод клиента принимают только доступный вариант нужного филиала, а историческая сумма продажи остаётся неизменной. Специальный backend-owned вид `Professional` заменяет checkbox профессионального статуса клиента, а профессиональные привилегии выводятся из текущего действующего абонемента.

## Current understanding
- Backend сейчас хранит фиксированный `MembershipType` (`SingleVisit`, `Monthly`, `Yearly`) в `ClientMembership` и `ClientMembershipSale`; цена приходит из формы и сохраняется как `PaymentAmount`/`GrossAmount`.
- `MembershipType` является поведенческим признаком: от него зависят списание разового посещения, фильтры, attendance и подсказка срока. Каталожные `Name`, `Price`, `AvailableFrom`, `AvailableTo` не заменяют эту семантику автоматически.
- У продажи должна появиться ссылка на вариант каталога, но `GrossAmount` остаётся обязательным историческим snapshot цены. Историческое название читается из текущего варианта, как разрешено задачей.
- У пользователя сейчас нет привязки администратора к филиалу. Её нужно добавить в backend domain/schema, administrator API/forms и access checks; для HeadCoach branch scope отсутствует.
- Сейчас `Client.IsProfessional`, `ProfessionalComment` и отдельный `/professional-status` write flow являются независимым источником привилегий. Их нужно заменить профессиональным видом каталога и derived read model, обновив client queries, attendance, membership warnings, frontend и internal bot consumers.
- Текущая выдача профессионального статуса ограничена HeadCoach. Это security boundary сохраняется: только HeadCoach создаёт/изменяет и назначает варианты вида `Professional`; Administrator не получает это право через catalog management, purchase или transfer.
- Перевод клиента сейчас меняет филиал и группы, но не оформляет абонемент. Новый контракт должен включать обязательный `membershipCatalogItemId` и данные индивидуального срока/оплаты, необходимые для атомарной продажи в целевом филиале.
- Окружение пересоздаётся с нуля. Изменяется начальная схема БД и snapshot, без цепочки миграций для сохранения существующих данных.
- Нужен PostgreSQL DB-level запрет пересекающихся включительных периодов для одинаковых `(BranchId, NormalizedName, Price)`. Предпочтительная реализация — `daterange(AvailableFrom, AvailableTo, '[]')` и exclusion constraint `EXCLUDE USING gist`, с `btree_gist`; точный SQL должен быть проверен на реальном PostgreSQL, не только EF InMemory.

## Architecture decision gate
До написания тестов зафиксировать contract decision в task/ADR или непосредственно в implementation PR:

1. Как каталожный вариант сохраняет существующую поведенческую категорию (`SingleVisit`, сроковой абонемент, `Professional`). Без этого нельзя безопасно заменить фиксированный selector: название не может определять domain behavior.
2. Сохраняется ли расширенный `MembershipType`/отдельный immutable behavior kind как поле каталога и исторический snapshot в membership/sale (предпочтительный compatibility path). Вид `Professional` обязателен и не зависит от отображаемого имени.
3. Какие поля новая операция перевода использует для индивидуального срока и оплаты. Предпочтительно переиспользовать purchase-поля и выполнить transfer + sale + current membership в одной backend transaction.
4. Применяется ли каталог к renewal/correction. Минимальный scope: purchase и transfer используют catalog item; correction сохраняет исторические возможности без смены catalog item/цены, renewal требует явного решения, если создаёт новую продажу.
5. Куда переносится существующий обязательный `ProfessionalComment`. Предпочтительно не сохранять независимый professional-status write flow: если комментарий всё ещё нужен продукту, сделать его metadata конкретного назначения/продажи `Professional`, а не полем, управляющим привилегией. Отсутствие решения по комментарию не должно возвращать checkbox или `IsProfessional` как источник истины.

Не выводить ответы из UI или названия варианта. Если решения не подтверждены текущими контрактами/владельцем продукта, остановить implementation, но не расширять TASK скрытым redesign membership model.

## Execution steps
1. Выполнить architecture decision gate и зафиксировать итоговые DTO/ProblemDetails codes, transaction boundary и compatibility mapping старого `MembershipType`.
2. На актуальном `main` создать `feature/TASK-070-membership-catalog`; провести impact inventory по membership, attendance, finance, bot/internal contracts, audit и administrator scope.
3. **До production-кода** добавить domain/unit-тесты нормализации имени, включительных периодов, открытого конца, допустимости update-полей, mapping behavior kind и derived professional state по индивидуальному периоду текущего абонемента.
4. **До production-кода** добавить PostgreSQL integration-тесты каталога/API: CRUD без delete, роли/branch scope, ProblemDetails, exclusion constraint и audit old/new state.
5. **До production-кода** добавить integration-тесты purchase/transfer transaction: branch match, availability at backend current date, historical gross amount, rollback всей операции при ошибке, конкурентный конфликт и HeadCoach-only назначение `Professional`.
6. **До production-кода** обновить frontend unit/component и Playwright tests для settings, purchase и transfer flows; тесты должны описывать загрузку, пустые/error states и серверные field errors.
7. Запустить новые тесты до реализации и сохранить ожидаемые падения именно из-за отсутствующего catalog contract/schema/UI, а не из-за дефектной fixture/setup.
8. Реализовать backend domain и initial persistence schema: каталог с immutable behavior kind включая `Professional`, user-branch association, sale/catalog relationship, indexes/checks/exclusion constraint и seed data; удалить независимый professional flag как источник истины из чистой начальной модели.
9. Реализовать application/API catalog contracts и backend-owned authorization/validation; endpoints не принимают price/branch при update и не публикуют delete.
10. Перевести purchase на `membershipCatalogItemId`: в одной transaction загрузить client + item, проверить branch/availability по серверной дате, взять цену только из item и записать её snapshot в sale.
11. Расширить transfer contract и transaction: проверить item целевого филиала и доступность, закрыть/open branch assignments, заменить группы и создать новую sale/current membership атомарно; любой отказ откатывает всё.
12. Заменить professional-status write flow: удалить checkbox и отдельный endpoint, вычислять read-only professional state из текущего действующего membership с behavior kind `Professional`; сохранить существующие attendance/payment-warning/single-visit privileges и HeadCoach-only assignment boundary.
13. Добавить audit events создания/изменения catalog item и назначения профессионального абонемента с actor, timestamp, branch и сериализованными old/new state; rejected attempts не аудитировать.
14. Обновить frontend API types/mappers/endpoints, settings catalog panel, purchase и transfer forms. UI показывает только server-returned eligible items, не показывает professional checkbox и отображает backend-derived badge/state и ProblemDetails без локального дублирования правил.
15. Обновить administrator settings: HeadCoach назначает филиал администратору; administrator не может выбирать/подменять branch scope каталога и не может создавать/изменять/назначать `Professional`.
16. Проверить downstream consumers: attendance/single-visit, client filters/history, refund/correction/renewal, financial report и internal bot. Bot/frontend получают derived `isProfessional` только как read-only backend projection и не сравнивают название каталога.
17. Запустить focused tests, полный backend suite, frontend lint/build, bot ruff/pytest при изменении bot contracts и affected Playwright; поднять чистый PostgreSQL runtime и проверить воспроизводимость initial schema.

## Preferred implementation strategy
1. Contract and behavior-kind decision first.
2. Failing backend domain/PostgreSQL/API tests.
3. Additive catalog and historical snapshot schema, with `Professional` as an explicit behavior kind.
4. Replace legacy professional status with derived membership semantics.
5. Atomic purchase, then atomic transfer.
6. Administrator branch scope and audit.
7. Incremental frontend settings/purchase/transfer integration without the checkbox.
8. Cross-layer backend/frontend/bot regression run and clean-database smoke test.

Разбивать работу на небольшие проверяемые commits внутри одной task branch; не вводить frontend feature flags, если backend contract нельзя безопасно использовать частично.

## Files likely to change
- `backend/src/GymCrm.Domain/Clients/` — catalog entity/behavior contract and sale/member relationships.
- `backend/src/GymCrm.Domain/Users/User.cs` — administrator branch association.
- `backend/src/GymCrm.Infrastructure/Persistence/GymCrmDbContext.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/` — catalog, sale and user mappings/constraints.
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.Designer.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/GymCrmDbContextModelSnapshot.cs`
- `backend/src/GymCrm.Application/Clients/IClientMembershipService.cs`
- `backend/src/GymCrm.Infrastructure/Clients/ClientMembershipService.cs`
- `backend/src/GymCrm.Domain/Clients/Client.cs` and its persistence configuration — removal of independent professional-state authority.
- `backend/src/GymCrm.Application/Clients/ClientMembershipSemantics.cs` — derived professional privileges.
- `backend/src/GymCrm.Infrastructure/Attendance/AttendanceService.cs` and attendance API projections.
- `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs` and focused request/response/resource files.
- `backend/src/GymCrm.Api/Auth/AdministratorEndpoints.cs` and administrator request/response files.
- New focused catalog endpoint/request/response/audit/resource files under `backend/src/GymCrm.Api/Auth/`.
- `backend/src/GymCrm.Api/Program.cs`, seed data and dependency registration as required.
- `backend/tests/GymCrm.Tests/ClientsApiTests.cs`
- `backend/tests/GymCrm.Tests/FinancialReportsApiTests.cs`
- `backend/tests/GymCrm.Tests/AuditLogApiTests.cs`
- New focused PostgreSQL/catalog integration tests under `backend/tests/GymCrm.Tests/`.
- `frontend/src/lib/api.ts`, `frontend/src/lib/api/types.ts`, `frontend/src/lib/api/clients.ts`, API endpoints and a focused catalog API module/tests.
- `frontend/src/features/settings/SettingsScreen.tsx` plus a focused membership catalog component/test.
- `frontend/src/features/clients/ClientManagement.tsx`, form/test files.
- Relevant `frontend/e2e/` settings/client specs.
- `bot/src/gym_crm_bot/crm/models.py` and affected bot tests if the read projection changes.

Exact generated migration artifacts and UI component split must be discovered before editing; preserve one top-level backend type per file and avoid growing existing large endpoint/screen files further.

## Contract outline
- Catalog read model: `id`, `branchId`, `branchName`, `name`, `price`, `availableFrom`, `availableTo`, explicit immutable behavior kind including `Professional`, timestamps.
- Create: HeadCoach supplies branch; Administrator branch is derived/validated from authenticated user. Required name, price, start, optional end, behavior kind.
- Update: only `name`, `availableFrom`, `availableTo`; price, branch and behavior kind are absent from the DTO. Unknown extra immutable fields must produce the agreed ProblemDetails rather than be silently applied.
- List: HeadCoach may filter/select branches; Administrator receives only own branch. Eligibility for sales comes from a dedicated server-filtered query or explicit `availableOn` parameter using server-owned date semantics.
- Purchase: replace client-supplied type/amount authority with `membershipCatalogItemId`; backend derives price and behavior. Individual membership dates/payment status remain explicit according to the accepted contract.
- Transfer: include target `branchId`, target groups, `membershipCatalogItemId` and accepted individual membership fields; the endpoint is one transactional command.
- Professional authorization: HeadCoach-only catalog mutation and assignment for behavior kind `Professional`; Administrator eligible-option responses exclude it and crafted writes return the agreed forbidden ProblemDetails.
- Client/attendance/bot read models may retain `isProfessional` for compatibility only as a backend-derived projection of the membership effective on the evaluated date; no write DTO accepts that flag.
- Remove the separate professional-status mutation endpoint and frontend checkbox. If an approved professional comment remains, store it on the professional membership assignment/sale metadata without making it a privilege switch.
- No DELETE route. Referential deletes from branch/user/sale to catalog use `Restrict`.
- Errors use stable ProblemDetails type/code plus field errors where appropriate: forbidden branch scope, item missing, branch mismatch, unavailable item, immutable field, period invalid and catalog overlap.

## Persistence and atomicity
- Catalog row: immutable `BranchId`, `Price`, behavior kind (`Professional` included); mutable display name and inclusive availability range; store `NormalizedName` using the project-agreed deterministic trim/case normalization.
- Checks: nonblank name, nonnegative/positive price per existing money policy, `AvailableTo IS NULL OR AvailableTo >= AvailableFrom`.
- DB overlap barrier: GiST exclusion for branch + normalized name + price equality and inclusive date-range overlap. Add the required extension deterministically in initial schema and verify actual generated SQL.
- Sale keeps `GrossAmount` and behavior snapshot; add required `MembershipCatalogItemId` FK for the clean initial database. Catalog rename affects history display; price updates are impossible.
- Purchase and transfer execute database reads, validation and writes in one transaction. Map constraint/serialization conflicts to deterministic ProblemDetails; do not rely on prior list filtering.
- Inject/use a time provider so inclusive-date tests do not depend on wall-clock timing.
- Professional privilege is true only when the current membership snapshot is behavior kind `Professional` and its individual validity covers the evaluated date; catalog availability alone never grants or revokes an already assigned privilege.

## Constraints
- Backend owns permission, branch scope, availability, price, membership and ProblemDetails semantics.
- Price, branch and behavior kind cannot change after create; catalog items cannot be deleted.
- No separate active flag; availability range is the sole catalog availability source.
- Both dates are inclusive; `AvailableTo = null` means open-ended.
- Sale amount is always copied from catalog at write time and never recomputed from current catalog state.
- Client membership validity remains individually supplied/calculated under the accepted existing behavior; catalog availability is not membership validity.
- Do not bind catalog items to halls.
- Do not implement local frontend cross-branch/availability authority.
- Preserve financial attribution by client branch assignment on event date unless the approved contract explicitly changes it.
- Do not infer professional status from catalog name. Renaming a `Professional` item must not change behavior.
- Preserve HeadCoach-only authority for issuing professional privileges; ordinary administrator catalog rights do not include `Professional` mutation or assignment.

## Out of scope
- Existing-data migration or backfill; the database is recreated from the new initial schema.
- Repricing or mass replacement of existing client memberships.
- Refund, freeze, write-off and financial calculation redesign.
- Audit of rejected catalog mutations.
- A parallel legacy professional checkbox/status endpoint or independent `Client.IsProfessional` authority.
- Optimistic protection against catalog deactivation after form load beyond mandatory validation in the final write transaction.
- Delete/archive endpoint or separate active flag.
- Hall-level catalog scoping.

## Required test coverage

Unit and integration tests are written/updated before functional code. The executor must run them first and confirm the expected red state.

### Unit tests
- Name normalization is deterministic for trimming/case and matches the database expression/storage strategy.
- Inclusive availability returns true on both bounds, false before/after and supports `AvailableTo = null`.
- Invalid reversed range and invalid price are rejected.
- Update command exposes/applies only name and dates; immutable values remain unchanged.
- Catalog behavior kind maps to existing single-visit/term membership semantics without name inference.
- `Professional` behavior is independent of display name and is active only within the individual membership validity interval.
- Derived professional state suppresses payment/membership warnings and single-visit write-off only while effective.
- Audit serialization contains branch and complete old/new catalog state.

### Integration tests
- HeadCoach creates/lists/updates items in any branch; Administrator only for assigned branch; Coach is forbidden.
- Administrator create/update/list ignores no caller-supplied scope and rejects another branch with agreed ProblemDetails.
- Update payload cannot change price, branch or behavior; DELETE is unavailable.
- PostgreSQL permits same normalized name/price in different branches and non-overlapping periods, but rejects all overlapping inclusive/open-ended variants in one branch, including concurrent inserts.
- Purchase accepts only an available item in the client's current branch, uses catalog price, rejects future/expired/cross-branch items and rolls back on failure.
- Boundary availability uses the backend date and is checked inside the write transaction.
- Transfer requires an item in the target branch and atomically changes branch/groups plus creates the sale/membership; every validation or constraint failure leaves branch, assignments, membership and sale unchanged.
- Catalog rename/end-date change leaves historical sale gross amount unchanged; history resolves the current item name and remains visible after catalog expiry.
- Creation and successful update write one audit event with actor/branch/time/old/new; failed attempts write none.
- Administrator branch assignment create/update contracts validate existing active branch and do not broaden unrelated permissions.
- Financial report totals, refunds and branch attribution remain unchanged for equivalent sales.
- Attendance single-visit write-off/restore and membership filters continue to use explicit behavior semantics.
- HeadCoach can create/update/assign `Professional`; Administrator and Coach cannot do so through list options or crafted requests.
- Professional catalog availability controls new assignment, while individual validity controls client privileges; rename does not affect behavior.
- Legacy professional write endpoint is absent, client write DTOs contain no `isProfessional`, and clean schema has no independent professional flag as authority.
- Client list/payment filters, attendance, audit and internal bot projections use the same backend-derived professional state.
- Clean PostgreSQL database creation from initial schema succeeds and contains extension, FK/check/exclusion constraints.

### UI/component tests
- Settings shows branch selector to HeadCoach and fixed branch context to Administrator; Coach cannot access it.
- Catalog covers loading, error, empty, create and edit states; edit form has no price/branch/behavior controls and no delete action.
- Purchase loads only eligible options for the client's branch, displays server price, submits item id and handles stale/unavailable ProblemDetails.
- Transfer reloads eligible options for target branch, requires a choice, clears an invalid previous choice when branch changes and preserves server errors.
- Historical membership displays current catalog name and stored sale amount.
- Client forms contain no professional checkbox; active professional membership is shown read-only and can only be assigned by HeadCoach through membership selection.
- Administrator purchase/transfer options do not expose `Professional`; HeadCoach options do.
- Administrator form requires branch assignment and displays it in list/edit states.

### UI/e2e tests
- HeadCoach manages two branch catalogs and sees isolated lists.
- Administrator manages own catalog and cannot mutate another branch through a crafted request.
- Purchase success plus future/expired/cross-branch rejection.
- Transfer success and rejected transfer with no partial UI/backend state.
- Professional assignment by HeadCoach, rejection for Administrator, and automatic loss of privilege after individual expiry without toggling a checkbox.
- Responsive settings, purchase and transfer dialogs at existing desktop/mobile project breakpoints.

## Expected initial failure verification
- Run focused unit/API tests after adding contracts/fixtures: failures must identify missing catalog entity/endpoints/transaction behavior.
- Run PostgreSQL constraint tests against a real database: expected failure is absent schema/constraint, not provider incompatibility.
- Run frontend component/e2e tests: expected failures must be missing catalog controls/options and new request fields.
- Record the focused red commands/results in the implementation PR before production changes.

## Test plan
- [ ] Run new catalog domain/unit tests and confirm expected red state.
- [ ] Run new PostgreSQL schema/constraint/API tests and confirm expected red state.
- [ ] Run new frontend component and Playwright tests and confirm expected red state.
- [ ] After implementation run focused catalog, client transfer/purchase, professional semantics, audit, finance and attendance tests.
- [ ] Run `dotnet test backend/GymCrm.slnx`.
- [ ] Run frontend `npm run lint` and `npm run build` from `frontend/`.
- [ ] Run affected frontend Playwright specs.
- [ ] Run `cd bot && ruff check . && pytest` if bot projection/models change.
- [ ] Recreate the local PostgreSQL database from scratch and inspect the exclusion constraint/extension.
- [ ] Manually smoke-test HeadCoach and Administrator settings, purchase and transfer at inclusive boundary dates.

## Regression barrier
The mandatory barrier is the combination of real-PostgreSQL overlap/clean-schema tests, backend API transaction/authorization tests, financial and attendance suites, frontend component tests, bot contract tests and Playwright purchase/transfer/settings flows. EF InMemory-only or manual-only verification is insufficient. Completion requires proof that failed purchase/transfer writes leave no partial branch, assignment, sale or membership changes, stored `GrossAmount` never follows later catalog changes, and professional privileges have exactly one backend source of truth: an effective membership with behavior kind `Professional`.

## Risks
- Catalog shape lacks an explicit replacement for current behavior-bearing `MembershipType`; guessing from the name would break single-visit and expiration semantics.
- Legacy `IsProfessional` is deeply consumed by client queries, attendance, frontend and bot; partial replacement could leave contradictory privilege sources.
- Allowing Administrator to issue `Professional` through ordinary catalog flows would be a privilege escalation relative to the current HeadCoach-only endpoint.
- The semantics/location of existing `ProfessionalComment` require an explicit compatibility decision, but must not preserve a second status switch.
- Adding administrator branch scope affects user persistence, seed data, settings contracts and authorization expectations beyond the catalog screen.
- PostgreSQL exclusion constraints are provider-specific and may not be expressible completely through standard EF fluent APIs.
- Transfer becomes a cross-aggregate financial transaction; incorrect boundaries can leave client branch and membership inconsistent.
- Current correction flow can alter sale type/amount, conflicting with catalog immutability unless its compatibility behavior is explicitly constrained.
- Renewal creates a new sale using current membership data; omitting it from the contract decision can bypass catalog price/availability.
- Catalog rename intentionally changes historical display, while financial exports must continue to use the stored amount.
- Large existing `ClientEndpoints.cs` and `ClientManagement.tsx` make unstructured inline expansion risky; use focused services/components.

## Safer decomposition
Keep one TASK branch and merge only after all phases pass; if separate execution tasks are required, preserve this dependency order:

1. Backend schema/catalog CRUD + DB constraint + audit + administrator branch scope + `Professional` behavior kind.
2. Derived professional semantics and removal of legacy write path across backend read models.
3. Purchase catalog integration + historical price/behavior compatibility + HeadCoach-only professional assignment.
4. Atomic transfer-with-membership command.
5. Frontend settings/catalog/administrator UI and removal of the checkbox.
6. Frontend purchase/transfer plus bot read-contract integration and full regression verification.

Do not deploy a phase that lets callers bypass backend catalog validation for newly created sales.

## Stop conditions
Остановиться и не писать production-код, если:
- architecture decision gate не определил behavior kind и renewal/correction semantics;
- implementation оставляет одновременно независимый `IsProfessional` и membership-derived professional state;
- HeadCoach-only границу назначения `Professional` невозможно сохранить в backend write path;
- не определено место `ProfessionalComment`, если продукт требует сохранить этот комментарий;
- agreed API contract для transfer не позволяет атомарно создать обязательный абонемент;
- DB overlap rule cannot be enforced and tested on the actual PostgreSQL provider;
- administrator branch binding requires a global RBAC redesign rather than a localized scope check;
- sale price would be read dynamically instead of stored as immutable `GrossAmount`;
- initial schema cannot be reproduced on a clean database;
- scope expands into refunds, attendance redesign, production data migration or multiple unrelated subsystems;
- current branch is not clean, task-specific and based on current `main`.

Do not stop only because backend and frontend, shared client/settings modules, prices or permissions are involved; stop only at the concrete unsafe boundaries above.

## Ready for Codex execution
no — detailed plan is ready, but this high-risk task requires explicit review and resolution of the architecture decision gate before it can move from `/backlog/risky` to active implementation.
