# Implementation Plan: TASK-077 Поддержать индивидуальную сумму продажи абонемента

## Source task
/backlog/risky/TASK-077-membership-sale-amount-override.md

Source status remains `risky`: план подготовлен для product/architecture review, но задача не переводится в активную реализацию и project-код этим запуском не изменяется.

## Git branch
feature/TASK-077-membership-sale-amount-override

Branch rules:
- перед реализацией проверить чистый worktree, перейти на `main`, выполнить `git pull` и создать ветку от актуального `main`;
- подтвердить активную ветку `feature/TASK-077-membership-sale-amount-override` до первого изменения project-кода;
- не включать в ветку другие TASK, несвязанный рефакторинг или экспериментальные изменения финансовой модели;
- остановить выполнение, если worktree dirty, текущая ветка неясна или task branch создана не от `main`.

## Goal
Администратор или главный тренер может оформить продажу по каталожной цене, по индивидуальной сумме при выбранном варианте либо только по сумме без варианта каталога. Backend сохраняет фактическую валовую сумму и режим её получения в продаже, а карточка клиента, возвраты, коррекции, финансовые отчёты, аудит и internal bot-проекции используют эту продажу как единственный денежный источник.

## Current understanding
- Каноническая финансовая запись уже существует: `ClientMembershipSale.GrossAmount` используется в `FinancialReportService`, financial summary и проверке лимита возврата.
- Одновременно `ClientMembership.PaymentAmount` хранит вторую копию цены. Карточка клиента, audit state, attendance snapshot и internal bot местами читают именно её. При ручном override эти поля могут разойтись, поэтому простого добавления input-поля недостаточно.
- `MembershipCatalogItemId` сейчас обязателен и продублирован в `ClientMembershipSale` и `ClientMembership`; обе EF-связи required, а web/internal bot mappings безусловно обращаются к `MembershipCatalogItem.Name`.
- `CreateSale` и `CreateMembership` всегда копируют `MembershipCatalogItem.Price`. Продажа создаётся при обычной покупке, renewal и transfer для всех случаев, кроме переноса активного неиспользованного `SingleVisit`.
- `CorrectAsync` сейчас меняет дату/срок и payment status, но не цену продажи. Это безопасная граница сохраняется: correction не превращается в скрытый способ переписать историческую сумму.
- `MarkPaymentAsync` меняет только payment status/version. Сумма в web request формально ещё присутствует в legacy frontend type, хотя backend её не принимает; этот лишний caller-controlled input нужно удалить.
- Каталожная цена неизменяема. Для существующей продажи она может быть default/display context, но не должна повторно участвовать в расчётах после сохранения `GrossAmount`.
- Финансовый отчёт уже агрегирует `sale.GrossAmount`; ему прежде всего нужны regression tests с override и amount-only sale, а не альтернативная формула.
- Python bot не создаёт продажи и не вычисляет деньги, но backend `BotApiService` требует catalog navigation и читает дублирующий `PaymentAmount`. Internal API и typed bot tests должны остаться совместимыми для amount-only membership.
- Валюта продукта фактически единая — RUB: frontend форматирует суммы в рублях, отдельного currency-поля в модели нет. Multi-currency не должна появляться внутри этой TASK.
- Текущая early-stage schema policy допускает воспроизводимое пересоздание БД; исторический production backfill не входит в задачу.

## Product and architecture decision gate

До написания production-кода необходимо явно утвердить следующие решения. Рекомендуемые варианты ниже являются основой плана, но не считаются уже согласованными требованиями.

### 1. Behavior для продажи без каталога
Рекомендуемый локальный вариант:
- `AmountOnly` создаёт обычный `Term` membership;
- backend сам присваивает `MembershipBehaviorKind.Term` и требует `validFrom`/`validTo`;
- frontend не отправляет `behaviorKind` и не выводит его из заполненных полей;
- backend возвращает display label `Без варианта каталога` и фактический behavior в response;
- `SingleVisit` и `Professional` без каталога запрещены, пока для них не определён отдельный server-owned contract и permission rule.

Если продукту нужны amount-only `SingleVisit` или `Professional`, сначала требуется отдельное решение о validity, write-off, комментарии и HeadCoach-only границе. Нельзя принимать произвольный `behaviorKind` от frontend как обход каталожных правил.

### 2. Нулевая ручная сумма
Рекомендуемое правило:
- ручная сумма для `Term`, `SingleVisit` и `AmountOnly` строго больше нуля;
- ноль разрешён только для `Professional`, сохраняя правило TASK-070;
- положительный manual override для выбранного `Professional` допустим, если продукт подтверждает платный профессиональный абонемент;
- backend отклоняет отрицательное значение, больше двух знаков после запятой и значение вне `numeric(10,2)`; молчаливое округление запрещено.

### 3. Sale-producing operations
Рекомендуемая единая матрица:
- purchase: `Catalog`, `CatalogOverride`, `AmountOnly`;
- renewal: `Catalog` и `CatalogOverride`; `AmountOnly` допускается только для уже amount-only `Term` и наследует backend behavior/duration предыдущей продажи;
- transfer: `Catalog` и `CatalogOverride`; amount-only transfer разрешать только после утверждения behavior rule из пункта 1; перенос неиспользованного `SingleVisit` по-прежнему не создаёт sale и не принимает сумму;
- correction и mark-payment никогда не меняют `GrossAmount`, catalog link или pricing mode.

Если продукт ожидает другую матрицу, её нужно исправить в source TASK и плане до implementation. Частичное включение override только в одном sale-producing flow без явного решения запрещено.

## Proposed domain and API contract

### Canonical sale pricing
- Ввести backend enum `ClientMembershipSalePricingMode`: `Catalog`, `CatalogOverride`, `AmountOnly`.
- Сохранять `PricingMode` в `ClientMembershipSale`; ручное значение, равное каталожной цене, всё равно остаётся `CatalogOverride`, потому что provenance определяется входным сценарием, а не сравнением decimal.
- `ClientMembershipSale.GrossAmount` — единственное persisted денежное значение конкретной продажи.
- Удалить `ClientMembership.PaymentAmount` и его DB constraint/column; membership versions читают сумму только через `Sale.GrossAmount`.
- Сделать `MembershipCatalogItemId`/navigation nullable у sale и membership для `AmountOnly`; сохранить behavior snapshot в sale/membership.
- Добавить DB check, согласующий mode и catalog link: `Catalog`/`CatalogOverride` требуют catalog item, `AmountOnly` требует его отсутствия.
- Добавить DB money constraint согласно утверждённому zero rule; application validation должна выдавать стабильный ProblemDetails до DB exception.

### Write requests
- Использовать одно nullable поле `manualSaleAmount` во всех подтверждённых sale-producing requests.
- Сценарий определяется только комбинацией `membershipCatalogItemId` и наличием `manualSaleAmount`:
  - catalog id + no manual amount -> `Catalog`, `GrossAmount = item.Price`;
  - catalog id + manual amount -> `CatalogOverride`, `GrossAmount = manualSaleAmount`;
  - no catalog id + manual amount -> `AmountOnly`, `GrossAmount = manualSaleAmount`;
  - neither -> `ValidationProblem` с field errors для обоих полей.
- Не принимать caller-controlled `pricingMode`, `grossAmount`, catalog price или behavior kind. Backend вычисляет mode, amount и behavior.
- `Guid.Empty` трактовать как invalid catalog id, а не как amount-only.
- `isPaid`/payment date остаются независимыми от размера продажи: unpaid sale всё равно сохраняет `GrossAmount`.

### Read responses and audit
- Заменить неоднозначное публичное `paymentAmount` на фактическое `grossAmount`, полученное из sale; обновить все web consumers согласованно.
- Возвращать nullable `membershipCatalogItemId`, backend-owned non-empty `membershipName`, `pricingMode`, `grossAmount` и nullable `catalogPrice` для пояснения override.
- Для amount-only backend возвращает стабильный display label, а frontend/bot не придумывают название или behavior.
- Financial summary продолжает строиться из `GrossAmount`, non-cancelled refunds и их разности.
- Audit sale/membership state включает nullable catalog id, display label, behavior, `pricingMode`, `grossAmount` и catalog price when present. По audit payload должно быть однозначно видно catalog default, override или отсутствие варианта.
- Старые/seed rows в воспроизводимой schema получают `PricingMode = Catalog`; автоматического перерасчёта `GrossAmount` из текущего каталога не выполнять.

### Money and currency rules
- Валюта остаётся фиксированной RUB; не добавлять currency selector или конвертацию.
- Денежная validation policy должна быть общей для purchase/renew/transfer, а не повторяться в endpoints.
- JSON decimal проверяется до persistence: finite decimal, допустимый знак, scale `<= 2`, значение помещается в `numeric(10,2)`.
- Backend не округляет и не подменяет invalid manual value catalog price.

## Safe decomposition
1. **Pricing policy and contract:** pure resolver для трёх режимов, money validation, DTO и ProblemDetails keys.
2. **Canonical persistence:** persisted pricing mode, nullable catalog link, удаление membership-level amount, clean schema checks.
3. **Purchase/renew/transfer writes:** единый resolver, atomic sale + membership creation и сохранение существующего SingleVisit transfer exception.
4. **Read/audit consumers:** web card/history, attention, attendance, internal bot, comment/audit snapshots без required catalog navigation.
5. **Refund/correction/report barriers:** доказать неизменяемую сумму, refund ceiling и report totals на `GrossAmount`.
6. **Frontend workflow:** три явных режима, server field errors, provenance display и responsive flow.
7. **Bot compatibility and full regression:** stable label/payment status, no local financial logic, all required suites.

Каждый этап должен оставлять один канонический денежный источник. Нельзя временно записывать override только в `ClientMembership.PaymentAmount` или вычислять его на frontend.

## Execution steps
1. Создать `feature/TASK-077-membership-sale-amount-override` от чистого актуального `main`; перечитать root/backend/frontend/bot `AGENTS.md`, source TASK и этот план.
2. Закрыть decision gate: письменно зафиксировать amount-only behavior, zero rule и operation matrix. При существенном изменении формы привлечь `ui-designer`; если выбор режима/срока остаётся неочевидным — провести review с `ux-researcher` до component implementation.
3. **До production-кода** добавить backend unit tests для общей pricing policy:
   - три допустимых комбинации catalog/manual inputs;
   - manual amount equal to catalog price remains `CatalogOverride`;
   - no catalog + no amount, empty catalog id, negative/zero by behavior, scale > 2 и overflow отклоняются;
   - catalog availability/branch/Professional permission rules остаются обязательными при override;
   - amount-only behavior и validity определяются backend policy, не request enum;
   - correction/mark-payment policy не разрешает mutation суммы.
4. **До production-кода** обновить `ClientMembershipCatalogContractTests` и persistence model tests:
   - purchase/renew/transfer contracts принимают только nullable catalog id + nullable `manualSaleAmount` и не принимают mode/behavior/catalog price/gross amount;
   - response/snapshot contracts используют nullable catalog identity, `PricingMode` и `GrossAmount`;
   - `ClientMembership` больше не имеет `PaymentAmount`;
   - DB model содержит nullable catalog FKs, pricing-mode consistency check и money constraint.
5. **До production-кода** добавить backend API integration matrix для HeadCoach и Administrator:
   - catalog default сохраняет item price и `Catalog`;
   - selected catalog + different/equal manual amount сохраняет exact value и `CatalogOverride`;
   - amount-only сохраняет null catalog, backend behavior/label и `AmountOnly`;
   - neither, empty id, invalid amount/scale/range/validity возвращают единый ValidationProblem с устойчивыми field keys;
   - unavailable/cross-branch item и crafted Professional request не обходятся через manual amount;
   - Coach/anonymous/CSRF behavior остаётся прежним;
   - failed validation не создаёт sale, membership version или audit event.
6. **До production-кода** добавить integration tests для sale-producing смежных flows по утверждённой матрице:
   - renewal сохраняет новую фактическую сумму и правильный pricing mode, не меняя предыдущую sale;
   - transfer атомарно сохраняет branch/group/membership/sale с override и полностью откатывается при invalid amount;
   - amount-only path покрыт только там, где он утверждён decision gate;
   - unused `SingleVisit` transfer игнорировать сумму не должен — переданные pricing fields отклоняются, а sale остаётся прежней.
7. **До production-кода** добавить refund/correction/report integration tests:
   - partial/full/excessive refund сравнивается с override/amount-only `GrossAmount`;
   - canceled refund снова освобождает доступный лимит относительно той же суммы;
   - correction сохраняет exact `GrossAmount`, `PricingMode` и catalog link, включая crafted extra amount fields;
   - financial totals/breakdowns используют override и amount-only amounts, catalog price в итоги не попадает;
   - изменение имени/доступности каталога не меняет историческую сумму;
   - pre-existing catalog sale продолжает возвращать прежний `GrossAmount` без перерасчёта.
8. **До production-кода** добавить audit/read/internal bot tests:
   - purchase/renew/transfer audit отражает nullable catalog, mode, exact gross amount и manual/no-catalog provenance;
   - карточка, history, attention, attendance snapshots и bot card/list/mark-payment не падают при null catalog;
   - backend выдаёт amount-only label одинаково во всех projections;
   - mark-payment создаёт новую membership version, но не меняет sale amount/mode;
   - Python bot не вычисляет amount/mode; если response shape меняется, typed Pydantic tests сначала фиксируют новый contract.
9. **До production-кода** добавить frontend API/unit tests:
   - exact payload для трёх режимов и отсутствие caller-controlled mode/behavior/catalog price;
   - mapping nullable catalog id, backend label, `grossAmount`, `pricingMode`, `catalogPrice`;
   - ProblemDetails field errors сохраняются для catalog и manual amount;
   - correction/mark-payment payload не содержит суммы продажи.
10. **До production-кода** добавить frontend component tests формы и истории:
    - три понятных взаимоисключающих режима без скрытого одновременного состояния;
    - catalog default показывает read-only catalog price;
    - override показывает catalog context и редактируемую фактическую сумму;
    - amount-only не требует catalog select и рендерит backend-approved validity UX;
    - переключение режима очищает stale manual/catalog values и не отправляет скрытые поля;
    - backend field error остаётся рядом с соответствующим control и введённые данные не теряются;
    - history/card различают `Каталожная цена`, `Индивидуальная сумма` и `Без варианта каталога`, всегда показывая фактический gross amount;
    - correction остаётся amount-read-only, mark-payment не предлагает изменить сумму.
11. **До production-кода** добавить focused Playwright flow: оформить все три режима, проверить request/response rendering, server rejection, reload/history и responsive layout на существующих desktop/mobile breakpoints.
12. Запустить новые targeted backend/frontend/bot tests и подтвердить красную фазу именно из-за отсутствующих policy/schema/contract/UI. Ошибки fixture, test environment или baseline regression не считаются ожидаемым падением.
13. Реализовать минимальную domain/application pricing policy и enum. Один resolver получает catalog item/nullable manual amount/operation context, валидирует деньги и возвращает `PricingMode`, `GrossAmount`, behavior и catalog identity.
14. Обновить persistence model:
    - добавить `PricingMode` в `ClientMembershipSale`;
    - сделать catalog FKs/navigation nullable там, где они сохранены;
    - удалить `ClientMembership.PaymentAmount` и его check constraint;
    - добавить consistency/money constraints и индексы;
    - обновить текущую initial schema, designer и model snapshot по действующей early-stage policy; не добавлять несогласованную production data migration;
    - проверить воспроизводимое создание чистой PostgreSQL database.
15. Перевести `ClientMembershipService` на resolver и один sale factory для purchase/renew/transfer. `CreateMembership` получает sale/item context, но никогда не копирует отдельную денежную сумму в version row.
16. Обновить web DTO, validation resources и ProblemDetails mapping. Не оставлять silent-ignore для caller-controlled price fields, если они запрещены утверждённым contract.
17. Обновить read/audit consumers nullable catalog и canonical amount: client details/history/summary, client attention, attendance, internal bot, audit serializers. Ввести один backend display-name resolver вместо повторяющихся `MembershipCatalogItem.Name`/fallback строк.
18. Сохранить `FinancialReportService` и refund calculation на `sale.GrossAmount`; менять production code там только если source audit обнаружит чтение catalog/member amount. Добавленные tests должны быть основным regression barrier.
19. Реализовать frontend typed contract и форму тремя явными режимами. Использовать Mantine/Onest, server-owned behavior/validation, фактическую сумму и pricing provenance; не воспроизводить backend money/permission rules в UI.
20. Если internal bot response изменился, обновить `bot/src/gym_crm_bot/crm/models.py` и contract tests без добавления write flow или локальных финансовых правил. Если shape совместим, production Python files не менять.
21. Выполнить focused и full regression suites, затем финальный `rg` по `PaymentAmount`, `GrossAmount`, `MembershipCatalogItem.Price`, `MembershipCatalogItem.Name` и required catalog ids. Каждый оставшийся monetary read классифицировать как catalog management/display либо canonical sale calculation.

## Preferred implementation strategy
1. Decision-gated, test-first contract.
2. Canonical sale amount and persisted pricing provenance before UI changes.
3. Clean-schema consistency checks plus application ProblemDetails.
4. One resolver and one display-label policy shared by all backend flows.
5. Incremental web/internal bot consumer conversion before removing the duplicate column.
6. Explicit three-mode frontend workflow with small verifiable commits.
7. Full-stack merge only after refund/report/audit barriers pass.

Backend и frontend должны поставляться согласованно, потому что response/request contract меняется. Если rollout когда-либо станет раздельным, сначала нужен отдельно согласованный additive compatibility phase; не сохранять два денежных источника как временную совместимость.

## Files likely to change
- `backend/src/GymCrm.Domain/Clients/ClientMembershipSale.cs`
- `backend/src/GymCrm.Domain/Clients/ClientMembership.cs`
- `backend/src/GymCrm.Domain/Clients/ClientMembershipSalePricingMode.cs` (new)
- focused sale pricing policy under `backend/src/GymCrm.Domain/Clients/` or `backend/src/GymCrm.Application/Clients/` (new; placement to follow dependency rules)
- `backend/src/GymCrm.Application/Clients/IClientMembershipService.cs`
- `backend/src/GymCrm.Infrastructure/Clients/ClientMembershipService.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/ClientMembershipSaleConfiguration.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/ClientMembershipConfiguration.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.Designer.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/GymCrmDbContextModelSnapshot.cs`
- the follow-up membership constraint migration, if clean-schema regeneration requires reconciliation rather than an extra migration
- `backend/src/GymCrm.Api/Auth/PurchaseClientMembershipRequest.cs`
- `backend/src/GymCrm.Api/Auth/RenewClientMembershipRequest.cs`
- `backend/src/GymCrm.Api/Auth/TransferClientBranchRequest.cs`
- `backend/src/GymCrm.Api/Auth/CorrectClientMembershipRequest.cs` if forbidden extra fields are made explicit
- `backend/src/GymCrm.Api/Auth/ClientMembershipResponse.cs`
- `backend/src/GymCrm.Api/Auth/CurrentMembershipSummaryResponse.cs`
- `backend/src/GymCrm.Api/Auth/ClientMembershipAuditState.cs`
- `backend/src/GymCrm.Api/Auth/ClientMembershipSaleAuditState.cs`
- `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/ClientAttentionEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/ClientResources.cs`
- `backend/src/GymCrm.Api/Auth/Resources/ClientResources.resx`
- `backend/src/GymCrm.Infrastructure/Attendance/AttendanceService.cs`
- `backend/src/GymCrm.Application/Bot/BotApiContracts.cs`
- `backend/src/GymCrm.Infrastructure/Bot/BotApiService.cs`
- `backend/src/GymCrm.Infrastructure/Reports/FinancialReportService.cs` only if source audit finds a non-canonical path
- `backend/tests/GymCrm.Tests/ClientMembershipSalePricingPolicyTests.cs` (new)
- `backend/tests/GymCrm.Tests/ClientMembershipCatalogContractTests.cs`
- `backend/tests/GymCrm.Tests/ClientMembershipPersistenceModelTests.cs`
- `backend/tests/GymCrm.Tests/ClientsApiTests.cs` or a new focused sale-pricing API test file
- `backend/tests/GymCrm.Tests/MembershipTransferCatalogTests.cs`
- `backend/tests/GymCrm.Tests/FinancialReportsApiTests.cs`
- `backend/tests/GymCrm.Tests/InternalBotApiTests.cs`
- affected attendance/audit test files discovered by the final reference audit
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/clients.ts`
- `frontend/src/lib/api/clients.test.ts`
- `frontend/src/lib/api/mappers.ts`
- focused mapper tests under `frontend/src/lib/api/`
- `frontend/src/features/clients/ClientManagement.tsx`
- `frontend/src/features/clients/ClientManagement.test.tsx`
- preferred extracted membership sale form/components under `frontend/src/features/clients/` to avoid further growth of `ClientManagement.tsx`
- `frontend/e2e/membership-sale-pricing.spec.ts` (preferred new focused spec) or the existing client flow spec
- `frontend/e2e/responsive-main-screens.spec.ts` if layout coverage is extended there
- `bot/src/gym_crm_bot/crm/models.py` only if the internal response shape consumed by Python changes
- `bot/tests/test_crm_client.py` and `bot/tests/test_bot_service.py` for contract compatibility

## Constraints
- Backend остаётся единственным владельцем pricing mode, actual amount, behavior, validity, permissions, branch scope, audit и ProblemDetails.
- `ClientMembershipSale.GrossAmount` — единственный источник денежных расчётов; catalog price и membership version не являются fallback после сохранения sale.
- Catalog price остаётся immutable default; manual override не меняет `MembershipCatalogItem.Price`.
- Pricing provenance хранится явно и не выводится сравнением сумм.
- Amount-only membership не должен создавать synthetic catalog row или менять справочник скрытым образом.
- Null catalog navigation обрабатывается во всех projections без NRE и без frontend-derived business semantics.
- Refund sum for non-canceled rows не превышает sale gross amount.
- Correction, payment mark, attendance write-off/restore и comment update не меняют сумму/mode/catalog identity продажи.
- Existing role/branch/Professional boundaries сохраняются; override не является способом назначить недоступный вид абонемента.
- Сумма — decimal RUB с единой backend validation; binary float и silent rounding не становятся источником истины.
- Не выполнять автоматический перерасчёт исторических продаж.
- Сохранять current version uniqueness, overlap constraints и atomic transfer semantics TASK-070.

## Out of scope
- Редактирование цены варианта каталога.
- Изменение `GrossAmount` уже созданной продажи через correction или отдельный endpoint.
- Массовый backfill/repricing исторических продаж и production data migration.
- Multi-currency, exchange rates, discounts/promocodes/taxes or invoice/payment-provider integration.
- Изменение refund cancellation workflow или финансовой атрибуции по филиалам/группам/тренерам.
- Новые роли/permissions или ослабление HeadCoach-only `Professional` assignment.
- Изменение validity/write-off semantics вне необходимого amount-only behavior decision.
- Bot purchase/renew/transfer UX: текущий bot остаётся thin read/payment-status consumer.
- Рефакторинг всего `ClientEndpoints.cs`/`ClientManagement.tsx`; допустимо только локальное извлечение новых focused policy/components.

## Required test coverage

Все новые/обновлённые unit и integration tests пишутся до functional code, запускаются и сначала падают по ожидаемой причине.

### Unit tests
- Pricing resolver: all valid/invalid catalog/manual combinations and exact persisted mode.
- Money validation: zero policy by behavior, negative, scale, max precision, no rounding.
- Backend-owned amount-only behavior/validity and rejection of caller-controlled behavior.
- Display label/provenance mapper for catalog, override and no-catalog states.
- Contract reflection tests preventing reintroduction of `ClientMembership.PaymentAmount` and caller-controlled pricing mode.
- Frontend API payload/mapping and mode-switch state reset.
- Frontend component rendering of provenance and actual amount.

### Integration tests
- Purchase/renew/transfer scenario matrix with persisted sale/membership/audit assertions.
- Authorization, branch/catalog availability, Professional permission and CSRF negative matrix.
- Stable ProblemDetails fields for missing combination and invalid decimal inputs.
- Nullable catalog persistence, FK/check constraints and reproducible clean PostgreSQL setup.
- Transaction rollback: invalid transfer or failed sale creates no partial client/group/membership/sale/audit state.
- Refund ceiling/full/partial/canceled behavior against override and amount-only `GrossAmount`.
- Correction and payment mark preserve immutable sale price/mode/catalog.
- Financial report totals/breakdowns use exact stored amounts and preserve historical rows.
- Attendance/client attention/internal bot projections work with no catalog and use backend label/canonical amount.
- Existing catalog-only sales retain current behavior and financial totals.

### UI/e2e tests
- Three explicit modes, keyboard-accessible controls and deterministic value clearing.
- Exact request for each mode; stale hidden fields are absent.
- Backend field errors preserve user input and focus the relevant field.
- Card/history show actual amount and origin after reload.
- Correction and payment confirmation keep amount read-only.
- Responsive form/history on project mobile/desktop breakpoints without horizontal scroll or obscured primary actions.

### Existing tests to update
- Contract tests that currently prohibit any caller-provided amount must allow only `ManualSaleAmount` in sale-producing commands.
- Strict persistence tests/fixtures requiring catalog IDs and `PaymentAmount` on every membership.
- Client API/audit tests asserting catalog name/id and duplicated payment amount.
- Transfer tests whose payload currently requires only catalog fields.
- Frontend test `keeps catalog type and sale amount read-only` remains valid only for correction; purchase tests must cover editable override.
- Internal bot fixtures must cover backend fallback label for null catalog; do not weaken existing payment/role assertions.

### Expected initial failure verification
- Pricing-policy/contract tests fail because mode/manual amount types do not exist and current command requires catalog id.
- Persistence tests fail because catalog FKs are required and membership still stores `PaymentAmount`.
- API tests fail because amount-only/override requests are rejected or ignored and audit lacks provenance.
- Refund/report tests fail only where setup cannot create the new sale types; existing report baseline must stay green.
- Frontend tests fail because purchase UI fixes catalog price and mappings require catalog identity.
- Bot/internal tests fail because current backend dereferences catalog navigation.
- Missing PostgreSQL runtime, invalid fixture, compile error unrelated to the intended contract or existing baseline regression is not an acceptable red phase.

### Manual-only validation
- Product review of the two decision-gate questions and operation matrix.
- UX review of Russian mode labels, comparison of catalog/actual amount, decimal input and narrow-screen workflow.
- Audit/security review of crafted Professional/cross-branch requests and absence of sensitive/technical error details.
- Manual QA supplements but does not replace automated barriers.

## Test plan
- [ ] Product decisions and operation matrix are recorded before branch implementation begins.
- [ ] Unit/integration/component tests are written before production code and fail for the intended missing behavior.
- [ ] All three purchase scenarios persist exact `GrossAmount` and correct `PricingMode`.
- [ ] Renewal/transfer follow the approved matrix; failed transfer rolls back all layers.
- [ ] Missing/invalid amount combinations return stable ProblemDetails without writes/audit.
- [ ] Override cannot bypass catalog availability, branch scope or Professional permission.
- [ ] Refunds, corrections and payment mark use/preserve the immutable sale amount.
- [ ] Financial totals and breakdowns use exact override/amount-only values after reload.
- [ ] Catalog-only historical rows remain unchanged and never reprice dynamically.
- [ ] Web, attendance, attention and internal bot handle null catalog and consistent backend label.
- [ ] Frontend displays actual amount and origin for all modes and sends no hidden stale values.
- [ ] `dotnet test backend/GymCrm.slnx` passes.
- [ ] `cd frontend && npm run test:unit`, `npm run lint`, `npm run build` pass.
- [ ] Focused Playwright membership sale-pricing and responsive specs pass.
- [ ] `cd bot && ruff check . && pytest` pass.
- [ ] Clean PostgreSQL database creation and final monetary/catalog source audit pass.

## Regression barrier
Completion is blocked unless automated integration tests create all three sale modes and prove that the exact stored `ClientMembershipSale.GrossAmount` is the same value used by client history, audit, refund ceiling, correction preservation, financial report totals and internal bot projection after reload. The barrier also requires a clean-schema test for nullable catalog/pricing consistency, atomic transfer rollback coverage and frontend component/Playwright tests showing correct provenance without caller-controlled backend behavior. Any remaining `ClientMembership.PaymentAmount` or financial calculation from `MembershipCatalogItem.Price` after sale creation fails the barrier.

## Risks
- **Split-brain amount:** leaving `ClientMembership.PaymentAmount` or a UI-derived fallback creates inconsistent reports/cards/refunds. Remove the duplicate source and audit all reads.
- **Ambiguous amount-only behavior:** guessing `SingleVisit`/`Term`/`Professional` from dates or UI mode can corrupt attendance and privileges. Close the decision gate and keep behavior backend-owned.
- **Privilege bypass:** manual amount must not let Administrator assign global `Professional` or use a cross-branch/unavailable item.
- **Silent money normalization:** EF/database rounding of excessive decimal scale can change agreed price. Reject before persistence and back it with DB precision tests.
- **Lost provenance:** comparing manual and catalog values cannot distinguish an explicit equal override. Persist pricing mode.
- **Nullable navigation regressions:** web, attention, attendance and bot contain multiple direct catalog dereferences; one missed path can fail only for amount-only clients.
- **Partial transfer state:** transfer spans branch/groups/membership/sale. Pricing validation and audit must remain inside the existing atomic boundary.
- **Historical repricing:** a fallback to current catalog price would mutate old reports conceptually even without updating rows.
- **Contract drift:** renaming `paymentAmount` to `grossAmount` requires synchronized backend/frontend/internal bot fixtures; no partial consumer update.
- **Large shared files:** `ClientEndpoints.cs`, `ClientMembershipService.cs`, `BotApiService.cs` and `ClientManagement.tsx` make inline duplication likely. Use focused resolver/mapper/component extraction without broad refactor.

## Stop conditions
Остановиться и не писать production-код, если:
- task-specific branch не создана от чистого актуального `main`;
- не утверждены amount-only behavior, zero rule или operation matrix;
- реализация требует принимать caller-controlled behavior/permission semantics;
- невозможно удалить или полностью исключить `ClientMembership.PaymentAmount` из денежных расчётов;
- amount-only sale нельзя представить с nullable catalog link без synthetic catalog item или противоречивого FK state;
- correction/mark-payment должны получить право менять историческую сумму;
- refund/report contract потребует перерасчёта существующих sales из каталога;
- HeadCoach-only Professional или branch scope нельзя сохранить;
- transfer mutation/audit нельзя оставить атомарными;
- clean PostgreSQL schema нельзя воспроизвести и проверить;
- scope расширяется до production backfill, multi-currency, payment providers, RBAC redesign или финансовой атрибуции redesign.

Не останавливаться только из-за одновременных backend/frontend изменений, nullable schema, internal bot compatibility или high-risk классификации; concrete stop conditions перечислены выше.

## Ready for Codex execution
no

Причина: TASK остаётся high-risk (`Safe for Codex: no`) и меняет финансовый source of truth, nullable catalog contract и несколько sale-producing flows. План локализует модель, test-first порядок и regression barriers, но до реализации требуется явный risky-task review/перевод в implementation и утверждение amount-only behavior, zero rule и operation matrix.
