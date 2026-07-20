# Implementation Plan: TASK-070 Создать управляемый справочник абонементов

## Source task
/backlog/done/TASK-070-membership-catalog.md

Source task was moved to `/backlog/done` after implementation commit `43edfaa` was merged into `main` via PR #74 (`bbfb022`).

High-risk review выполнен 2026-07-19: пользователь явно разрешил реализацию. Перед выполнением задача была переведена в `/backlog/implementation`, `Safe for Codex: yes`, risk level остаётся `high`.

## Implementation branch
feature/TASK-070-membership-catalog

Branch rules:
- перед изменением project-кода проверить чистый `main`, выполнить `git pull` и создать ветку от актуального `main`;
- подтвердить активную ветку `feature/TASK-070-membership-catalog` до первого изменения кода;
- не включать в ветку другие TASK и несвязанный рефакторинг;
- при невозможности получить чистый `main` остановить реализацию.

## Goal
Администратор управляет каталогом абонементов только своего филиала, главный тренер — каталогами всех филиалов; новая продажа и перевод с `Term`/`Professional` принимают только доступный вариант нужного филиала, а историческая сумма продажи остаётся неизменной. Активный неиспользованный `SingleVisit` при переводе переносится без новой продажи. Специальный backend-owned вид `Professional` заменяет checkbox профессионального статуса клиента, а профессиональные привилегии выводятся из текущего действующего абонемента.

## Current understanding
- Backend сейчас хранит фиксированный `MembershipType` (`SingleVisit`, `Monthly`, `Yearly`) в `ClientMembership` и `ClientMembershipSale`; цена приходит из формы и сохраняется как `PaymentAmount`/`GrossAmount`.
- `MembershipType` является поведенческим признаком: от него зависят списание разового посещения, фильтры, attendance и подсказка срока. Каталожные `Name`, `Price`, `AvailableFrom`, `AvailableTo` не заменяют эту семантику автоматически.
- У продажи должна появиться ссылка на вариант каталога, но `GrossAmount` остаётся обязательным историческим snapshot цены. Историческое название читается из текущего варианта, как разрешено задачей.
- У пользователя сейчас нет привязки администратора к филиалу. Её нужно добавить в backend domain/schema, administrator API/forms и access checks; для HeadCoach branch scope отсутствует.
- Сейчас `Client.IsProfessional`, `ProfessionalComment` и отдельный `/professional-status` write flow являются независимым источником привилегий. Их нужно заменить профессиональным видом каталога и derived read model, обновив client queries, attendance, membership warnings, frontend и internal bot consumers.
- Текущая выдача профессионального статуса ограничена HeadCoach. Это security boundary сохраняется: единственный глобальный `Professional` создаётся системой, только HeadCoach изменяет его общие название/период и назначает его; Administrator не получает это право через catalog management, purchase или transfer.
- Перевод клиента сейчас меняет филиал и группы, но не оформляет абонемент. Для `Term`/`Professional` новый контракт должен включать обязательный `membershipCatalogItemId` и данные индивидуального срока/оплаты, необходимые для атомарной продажи в целевом филиале. Активный неиспользованный `SingleVisit` является исключением и переносится как существующие assignment и sale без новой продажи и выбора catalog item целевого филиала.
- Окружение пересоздаётся с нуля. Изменяется начальная схема БД и snapshot, без цепочки миграций для сохранения существующих данных.
- Согласованы системные behavior kinds: `SingleVisit`, `Term`, `Professional`; `behaviorKind` становится единственным новым контрактом, а legacy `MembershipType`/`membershipType` удаляется согласованно из backend, frontend и bot consumers чистой БД. Прежние `Monthly` и `Yearly` объединяются в `Term` без сохранения отдельного legacy-признака.
- Продление можно создать заранее только для `Term`/`Professional` с конечным `ValidTo`: оно создаёт новую продажу через доступный вариант актуального каталога, фиксирует его цену и автоматически начинает новое назначение в календарный день после включительной даты окончания последнего по дате непересекающегося назначения клиента, включая уже запланированные будущие назначения. Renewal для `SingleVisit` и открытого `Professional` запрещён. Последовательные будущие назначения разрешены, пересекающиеся запрещены. Коррекция не меняет `MembershipCatalogItemId`, историческую цену или behavior kind; redesign correction вынесен из TASK-070.
- Перевод разрешён только с backend-текущей календарной даты. Для `Term`/`Professional` он принимает catalog item, индивидуальный период согласно behavior kind, статус оплаты и дату оплаты, прекращает действие прежнего периодического абонемента накануне перевода и атомарно создаёт новую продажу и абонемент целевого филиала. Для оплаченной продажи дата оплаты обязательна, для неоплаченной отсутствует. Активный неиспользованный `SingleVisit` переносится без новой продажи/назначения и без новых payment/catalog полей.
- Индивидуальная валидность зависит от behavior kind: `SingleVisit` не принимает и не хранит `ValidFrom`/`ValidTo`; `Term` требует обе даты; `Professional` требует `ValidFrom` и допускает `ValidTo = null` как открытый срок.
- У клиента может быть только один активный абонемент. `SingleVisit` активен от продажи до первого отмеченного посещения, после списания считается истёкшим и до этого блокирует продажу/назначение любого другого абонемента.
- Обязательный `ProfessionalComment` переносится только в metadata конкретного membership assignment `Professional` и не участвует в вычислении привилегий.
- У администратора ровно один обязательный активный филиал, назначаемый только HeadCoach; смена влияет на текущий access scope и не переписывает историю.
- В initial seed автоматически создаётся ровно один глобальный системный `Professional` с общими названием и периодом доступности для всех филиалов. Он автоматически применим к существующим и новым филиалам, второй создать нельзя. Нулевая цена допустима только для `Professional`; `SingleVisit` и `Term` требуют положительную цену.
- Все calendar-date решения принимаются через единый backend `TimeProvider`; frontend date и прямые wall-clock вызовы не являются источником истины.
- Нужен PostgreSQL DB-level запрет пересекающихся включительных периодов для одинаковых `(BranchId, NormalizedName, Price)`. Предпочтительная реализация — `daterange(AvailableFrom, AvailableTo, '[]')` и exclusion constraint `EXCLUDE USING gist`, с `btree_gist`; точный SQL должен быть проверен на реальном PostgreSQL, не только EF InMemory.

## Architecture decisions — approved
1. Каталог хранит immutable behavior kind `SingleVisit`, `Term` или `Professional`; `Monthly` и `Yearly` объединяются в `Term`. Behavior snapshot сохраняется в membership/sale и никогда не выводится из отображаемого имени.
2. Продление можно создать заранее через доступный вариант актуального каталога; новое назначение начинается автоматически на следующий календарный день после включительного окончания последнего по дате непересекающегося назначения клиента, включая будущую очередь. Последовательные будущие периоды разрешены без пересечений. Коррекция сохраняет исходные catalog item, историческую цену и behavior kind; её redesign не входит в TASK-070.
3. Transfer command разрешает перевод только с текущей календарной даты backend `TimeProvider`. Для `Term`/`Professional` он принимает вариант целевого филиала либо глобальный `Professional`, индивидуальные даты согласно behavior kind, payment status и payment date; устанавливает `old.ValidTo = today - 1 day` и в одной backend transaction меняет филиал/группы, создаёт sale и новое membership. Активный неиспользованный `SingleVisit` переносится как те же assignment и sale без новой продажи/назначения, без выбора нового catalog item и без переписывания catalog item, цены или исторической атрибуции продажи.
4. `Paid` требует payment date; `Unpaid` требует отсутствия payment date. Цена всегда берётся из каталога.
5. Обязательный professional comment хранится только как metadata конкретного membership assignment `Professional`, не как поле клиента/продажи и не как privilege switch.
6. HeadCoach видит `Professional` в общем eligible list с меткой «Профессиональный»; Administrator не получает его в ответе и не может назначить crafted request.
7. Stable ProblemDetails type/code выбираются при реализации для перечисленных ошибок и фиксируются контрактными тестами.
8. Обычные `SingleVisit`/`Term` принадлежат одному филиалу; `Professional` — единственная глобальная системная запись с общими названием и периодом для всех филиалов и автоматической применимостью к новым филиалам.
9. Строгое отклонение неизвестных/immutable полей применяется локально к catalog update, не меняя JSON-совместимость остальных endpoint.
10. `behaviorKind` — единственный membership behavior contract; legacy `MembershipType`/`membershipType` удаляется из чистой модели и всех consumers без compatibility projection.
11. `SingleVisit` не имеет индивидуального периода; `Term` требует `ValidFrom` и `ValidTo`; `Professional` требует `ValidFrom` и допускает открытый `ValidTo = null`. PostgreSQL overlap constraint применяется только к `Term` и `Professional`.
12. `SingleVisit` активен до первого списанного посещения и блокирует другие активные абонементы. Renewal разрешён только для `Term`/`Professional` с конечным `ValidTo`; активный неиспользованный `SingleVisit` при переводе переносится без новой sale/assignment.

Architecture decision gate закрыт; открытых продуктовых блокеров перед test-first реализацией нет.

## Execution steps
1. Перенести утверждённые architecture decisions в итоговые DTO, выбрать и покрыть контрактными тестами stable ProblemDetails codes и transaction boundary; удалить legacy `MembershipType`/`membershipType` из чистой модели и consumers в пользу единственного `behaviorKind`.
2. На актуальном `main` создать `feature/TASK-070-membership-catalog`; провести impact inventory по membership, attendance, finance, bot/internal contracts, audit и administrator scope.
3. **До production-кода** добавить domain/unit-тесты нормализации имени, включительных периодов, открытого конца, допустимости update-полей, mapping behavior kind и derived professional state по индивидуальному периоду текущего абонемента.
4. **До production-кода** добавить PostgreSQL integration-тесты каталога/API: CRUD без delete, роли/branch scope, ProblemDetails, exclusion constraint и audit old/new state.
5. **До production-кода** добавить integration-тесты purchase/transfer/renewal transaction: branch/global scope, availability по единому backend `TimeProvider`, historical gross amount, rollback всей операции при ошибке, конкурентный конфликт, последовательные будущие назначения и HeadCoach-only назначение `Professional`.
6. **До production-кода** обновить frontend unit/component и Playwright tests для settings, purchase и transfer flows; тесты должны описывать загрузку, пустые/error states и серверные field errors.
7. Запустить новые тесты до реализации и сохранить ожидаемые падения именно из-за отсутствующего catalog contract/schema/UI, а не из-за дефектной fixture/setup.
8. Реализовать backend domain и initial persistence schema: branch-owned каталог `SingleVisit`/`Term`, единственный глобальный system-owned `Professional`, user-branch association, sale/catalog relationship, indexes/checks/exclusion/uniqueness constraints и seed data; удалить независимый professional flag как источник истины из чистой начальной модели.
9. Реализовать application/API catalog contracts и backend-owned authorization/validation; endpoints не принимают price/branch при update и не публикуют delete.
10. Перевести purchase и renewal на `membershipCatalogItemId`: в одной transaction загрузить client + item, через backend `TimeProvider` проверить branch/global scope и availability, взять цену только из item и записать её snapshot в новую sale; запретить новую purchase/assignment при активном `SingleVisit`; для заранее созданного renewal разрешить только `Term`/`Professional` с конечным `ValidTo`, вычислить начало как следующий день после включительного окончания последнего по дате непересекающегося назначения клиента и разрешить только непересекающуюся последовательность.
11. Расширить transfer contract и transaction: разрешить перевод только с текущей календарной даты backend; для `Term`/`Professional` принять item, индивидуальный период согласно behavior kind, payment status/payment date, проверить item целевого филиала либо глобальный `Professional` и доступность, прекратить прежний membership накануне перевода, закрыть/open branch assignments, заменить группы и создать новую sale/membership атомарно. Для активного неиспользованного `SingleVisit` перенести существующие assignment и sale без item/payment полей новой продажи и без переписывания исторических данных. Любой отказ откатывает всё.
12. Заменить professional-status write flow: удалить checkbox и отдельный endpoint, вычислять read-only professional state из текущего действующего membership с behavior kind `Professional`; сохранить существующие attendance/payment-warning/single-visit privileges и HeadCoach-only assignment boundary.
13. Добавить audit events создания/изменения catalog item и назначения профессионального абонемента с actor, timestamp, branch/global scope и сериализованными old/new state; для глобального `Professional` использовать явный global scope без `branchId`, rejected attempts не аудитировать.
14. Обновить frontend API types/mappers/endpoints, settings catalog panel, purchase и transfer forms. UI показывает только server-returned eligible items, не показывает professional checkbox и отображает backend-derived badge/state и ProblemDetails без локального дублирования правил.
15. Обновить administrator settings: HeadCoach назначает филиал администратору; administrator не может выбирать/подменять branch scope каталога и не может изменять/назначать глобальный `Professional`; создать второй `Professional` не может ни одна роль.
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
- Catalog read model: `id`, nullable scope fields `branchId`/`branchName` for ordinary branch-owned items, `name`, `price`, `availableFrom`, `availableTo`, explicit immutable behavior kind including global system-owned `Professional`, timestamps. `Professional` has no mutable per-branch copy or per-branch dates.
- Create: создаёт только обычные `SingleVisit`/`Term`; HeadCoach supplies branch, Administrator branch is derived/validated from authenticated user. Required name, positive price, start, optional end and ordinary behavior kind. Попытка создать `Professional` отклоняется для любой роли, поскольку он существует только как единственная system-owned seed-запись.
- Update: only `name`, `availableFrom`, `availableTo`; price, branch and behavior kind are absent from the DTO. Unknown extra immutable fields are rejected locally by this contract with the agreed ProblemDetails rather than silently ignored; global JSON behavior for unrelated endpoints remains unchanged.
- List: HeadCoach may filter/select branches; Administrator receives only own branch. Eligibility for sales comes from a dedicated server-filtered query or explicit `availableOn` parameter using server-owned date semantics.
- Purchase: replace client-supplied type/amount authority with `membershipCatalogItemId`; backend derives price and `behaviorKind`. `SingleVisit` rejects individual validity dates, `Term` requires both dates, and `Professional` requires `ValidFrom` with optional `ValidTo`; payment status remains explicit according to the accepted contract.
- Transfer: include target `branchId` and target groups. For `Term`/`Professional`, also require `membershipCatalogItemId`, behavior-dependent individual membership dates, payment status and payment date; `Paid` requires a date and `Unpaid` forbids one. Transfer date is not caller-controlled and must equal the current backend calendar date. The endpoint ends the prior periodic membership on the preceding day and creates the sale/new membership as one transactional command. For an active unused `SingleVisit`, omit new-sale fields and move the existing assignment/sale without changing its catalog item, amount or historical attribution.
- Renewal: may be created in advance only for `Term`/`Professional` with a finite `ValidTo`, always creates a new sale through an item eligible on the backend `TimeProvider` date and copies the catalog price. Its assignment starts automatically one calendar day after the inclusive end of the last dated non-overlapping assignment, including an already scheduled future assignment; sequential future assignments are allowed and overlaps are rejected. `SingleVisit` and open-ended `Professional` renewal are rejected. Correction cannot replace the catalog item, historical price or behavior kind.
- Professional authorization: `Professional` is seeded once globally and cannot be created through catalog CRUD. Its common name/availability mutation and assignment are HeadCoach-only; Administrator eligible-option responses exclude it and crafted writes return the agreed forbidden ProblemDetails.
- Professional presentation: HeadCoach receives `Professional` in the ordinary eligible list with explicit behavior data for a visible «Профессиональный» badge; UI must not compare names.
- Client/attendance/bot read models may retain `isProfessional` for compatibility only as a backend-derived projection of the membership effective on the evaluated date; no write DTO accepts that flag.
- Remove the separate professional-status mutation endpoint and frontend checkbox. Require `ProfessionalComment` for every `Professional` assignment and store it only on the membership assignment without making it a privilege switch.
- No DELETE route. Referential deletes from branch/user/sale to catalog use `Restrict`.
- Errors use stable ProblemDetails type/code plus field errors where appropriate: forbidden branch scope, item missing, branch mismatch, unavailable item, immutable field, period invalid and catalog overlap.

## Persistence and atomicity
- Ordinary catalog row: required immutable `BranchId`, `Price` and behavior kind (`SingleVisit`/`Term`); mutable display name and inclusive availability range; store `NormalizedName` using the approved normalization. `Professional` is one global system-owned row without branch-specific copies; its name and availability are common to all branches.
- Normalize name by trimming edges, collapsing any whitespace run to one space, applying invariant case normalization and mapping `ё` to `е`; application logic and persisted DB value/constraint must be equivalent.
- Checks: nonblank name, zero price only for `Professional`, positive price for `SingleVisit`/`Term`, `AvailableTo IS NULL OR AvailableTo >= AvailableFrom`.
- DB overlap barrier: GiST exclusion for ordinary branch-owned items by branch + normalized name + price equality and inclusive date-range overlap. Add a separate DB-level invariant that permits exactly one `Professional` row globally and prevents ordinary CRUD from creating another. Add the required extension deterministically in initial schema and verify actual generated SQL.
- Sale keeps `GrossAmount` and behavior snapshot; add required `MembershipCatalogItemId` FK for the clean initial database. Catalog rename affects history display; price updates are impossible.
- Membership and sale snapshots store only `behaviorKind`; clean schema and public/internal contracts do not retain legacy `MembershipType`/`membershipType`.
- Purchase and transfer execute database reads, validation and writes in one transaction. Map constraint/serialization conflicts to deterministic ProblemDetails; do not rely on prior list filtering.
- Inject/use one backend `TimeProvider` for availability, transfer, renewal and derived-state calendar decisions so tests and production semantics do not depend on direct wall-clock calls.
- Professional privilege is true only when the current membership snapshot is behavior kind `Professional` and its individual validity covers the evaluated date; catalog availability alone never grants or revokes an already assigned privilege.
- `SingleVisit` has no date range: it is active until its first attendance write-off, becomes expired after that write-off and, while active, prevents any other membership purchase or assignment. This invariant must be enforced transactionally for concurrent writes.
- Enforce concurrent overlap safety with a second PostgreSQL GiST exclusion constraint for `Term` and `Professional` assignments on client equality plus inclusive `daterange(ValidFrom, ValidTo, '[]')`; `ValidTo = null` is treated as an open end. `SingleVisit` has no validity range and is excluded from this constraint. Map its violation to a stable dedicated membership-overlap ProblemDetails type/code. Sequential future assignments are allowed; transfer closes the old periodic assignment on the day before backend today and renewal appends after the last dated non-overlapping assignment.

## Constraints
- Backend owns permission, branch scope, availability, price, membership and ProblemDetails semantics.
- Price, branch and behavior kind cannot change after create; catalog items cannot be deleted.
- No separate active flag; availability range is the sole catalog availability source.
- Both dates are inclusive; `AvailableTo = null` means open-ended.
- Sale amount is always copied from catalog at write time and never recomputed from current catalog state.
- Client membership validity depends on behavior: `SingleVisit` has no `ValidFrom`/`ValidTo`, `Term` requires both inclusive dates, and `Professional` requires `ValidFrom` with optional open-ended `ValidTo`. Catalog availability is not membership validity.
- Do not bind catalog items to halls.
- Do not implement local frontend cross-branch/availability authority.
- Preserve financial attribution by client branch assignment on event date unless the approved contract explicitly changes it.
- Do not infer professional status from catalog name. Renaming a `Professional` item must not change behavior.
- Preserve HeadCoach-only authority for issuing professional privileges; ordinary administrator catalog rights do not include `Professional` mutation or assignment.
- Administrator has exactly one required active branch assigned only by HeadCoach; changing it affects current authorization scope without rewriting historical branch attribution.
- Initial seed creates exactly one global system-owned `Professional`, automatically applicable to all existing and future branches; ordinary branch-owned catalog variants are user-managed.

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
- Name normalization collapses whitespace and treats `ё`/`е` as equivalent.
- Inclusive availability returns true on both bounds, false before/after and supports `AvailableTo = null`.
- Invalid reversed range and invalid price are rejected.
- Membership validity rejects dates for `SingleVisit`, requires both dates for `Term`, and accepts an open end only for `Professional`.
- Zero price is accepted only for `Professional`.
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
- Transfer requires an ordinary item in the target branch or the global `Professional` for HeadCoach and atomically changes branch/groups plus creates the sale/membership; every validation or constraint failure leaves branch, assignments, membership and sale unchanged.
- Transfer with `Term`/`Professional` validates `Paid` with a required payment date and `Unpaid` with no payment date, rejects a caller-selected/future transfer date, uses backend today, ends the prior periodic membership on the preceding day and prevents overlapping effective memberships.
- Transfer with an active unused `SingleVisit` preserves the same assignment and sale, requires no target catalog item/new payment fields, creates no financial event and does not rewrite catalog item, stored amount or historical branch attribution.
- Renewal requires a catalog item eligible on the backend operation date and creates a new sale using its price only for `Term`/`Professional` with finite `ValidTo`; it rejects `SingleVisit` and open-ended `Professional`. Correction cannot change catalog item, stored price or behavior kind.
- Catalog rename/end-date change leaves historical sale gross amount unchanged; history resolves the current item name and remains visible after catalog expiry.
- Renewal can be created in advance, starts automatically on the calendar day after the last dated non-overlapping assignment (including an already scheduled future assignment), permits sequential future assignments and rejects overlaps, including concurrent writes.
- PostgreSQL membership exclusion permits undated `SingleVisit` rows, rejects overlapping `Term`/`Professional` periods for one client, treats `Professional.ValidTo = null` as an open end and maps violations to the dedicated stable membership-overlap ProblemDetails.
- An unused `SingleVisit` is the client's sole active membership until the first attendance write-off; concurrent purchase/assignment attempts cannot create another active membership. The write-off transitions it to expired semantics.
- Creation and successful update write one audit event with actor, branch/global scope, time and old/new; global `Professional` update has explicit global scope without `branchId`, failed attempts write none.
- Administrator branch assignment create/update contracts validate existing active branch and do not broaden unrelated permissions.
- Financial report totals, refunds and branch attribution remain unchanged for equivalent sales.
- Attendance single-visit write-off/restore and membership filters continue to use explicit behavior semantics.
- Clean schema contains exactly one global seeded `Professional`; HeadCoach can update its common name/availability and assign it but cannot create a second, while Administrator and Coach cannot mutate or assign it through list options or crafted requests.
- Professional catalog availability controls new assignment, while individual validity controls client privileges; rename does not affect behavior.
- Every `Professional` assignment requires a comment stored only with that membership assignment; missing comment is rejected without changing professional state.
- Legacy professional write endpoint is absent, client write DTOs contain no `isProfessional`, and clean schema has no independent professional flag as authority.
- Client list/payment filters, attendance, audit and internal bot projections use the same backend-derived professional state.
- Clean PostgreSQL database creation from initial schema succeeds and contains extension, FK/check/exclusion constraints.

### UI/component tests
- Settings shows branch selector to HeadCoach and fixed branch context to Administrator; Coach cannot access it.
- Catalog covers loading, error, empty, create and edit states; edit form has no price/branch/behavior controls and no delete action.
- Purchase loads only eligible options for the client's branch, displays server price, submits item id and handles stale/unavailable ProblemDetails.
- Transfer с `Term`/`Professional` reloads eligible options for target branch, requires a choice, clears an invalid previous choice when branch changes and preserves server errors; transfer активного неиспользованного `SingleVisit` не показывает и не требует catalog/payment fields новой продажи.
- Historical membership displays current catalog name and stored sale amount.
- Client forms contain no professional checkbox; active professional membership is shown read-only and can only be assigned by HeadCoach through membership selection.
- Administrator purchase/transfer options do not expose `Professional`; HeadCoach options do.
- Administrator form requires branch assignment and displays it in list/edit states.

### UI/e2e tests
- HeadCoach manages two branch catalogs and sees isolated lists.
- Administrator manages own catalog and cannot mutate another branch through a crafted request.
- Purchase success plus future/expired/cross-branch rejection.
- Transfer with `Term`/`Professional` success and rejected transfer with no partial UI/backend state.
- Transfer of an active unused `SingleVisit` succeeds without catalog selection or a new sale and preserves its historical data.
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
- Removing legacy `MembershipType`/`membershipType` across backend, frontend and bot is a coordinated contract-change risk; no compatibility projection remains in the clean model, and implementation must never infer behavior from the name.
- Legacy `IsProfessional` is deeply consumed by client queries, attendance, frontend and bot; partial replacement could leave contradictory privilege sources.
- Allowing Administrator to issue `Professional` through ordinary catalog flows would be a privilege escalation relative to the current HeadCoach-only endpoint.
- Moving required `ProfessionalComment` from the client to membership-assignment metadata touches history and projections and must not preserve a second status switch or duplicate the comment on the sale.
- Adding administrator branch scope affects user persistence, seed data, settings contracts and authorization expectations beyond the catalog screen.
- PostgreSQL exclusion constraints are provider-specific and may not be expressible completely through standard EF fluent APIs.
- Transfer becomes a cross-aggregate financial transaction; incorrect boundaries can leave client branch and membership inconsistent.
- Current correction flow may alter sale type/amount and must be constrained so it cannot change catalog item, stored price or behavior kind.
- Renewal must be routed through the current eligible catalog item and price so it cannot bypass catalog validation.
- Renewal must reject `SingleVisit` and any assignment without a finite `ValidTo`.
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
- implementation оставляет одновременно независимый `IsProfessional` и membership-derived professional state;
- HeadCoach-only границу назначения `Professional` невозможно сохранить в backend write path;
- agreed API contract для transfer с `Term`/`Professional` не позволяет атомарно создать обязательный абонемент либо для активного `SingleVisit` не позволяет сохранить существующие assignment/sale без нового финансового события;
- DB overlap rule cannot be enforced and tested on the actual PostgreSQL provider;
- administrator branch binding requires a global RBAC redesign rather than a localized scope check;
- sale price would be read dynamically instead of stored as immutable `GrossAmount`;
- initial schema cannot be reproduced on a clean database;
- scope expands into refunds, attendance redesign, production data migration or multiple unrelated subsystems;
- current branch is not clean, task-specific and based on current `main`.

Do not stop only because backend and frontend, shared client/settings modules, prices or permissions are involved; stop only at the concrete unsafe boundaries above.

## Ready for Codex execution
yes — architecture decision gate закрыт, продуктовые вопросы решены, high-risk review выполнен и пользователь явно разрешил реализацию 2026-07-19.
