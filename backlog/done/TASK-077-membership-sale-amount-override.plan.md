# Implementation Plan: TASK-077 Поддержать индивидуальную сумму продажи абонемента

## Source task
/backlog/done/TASK-077-membership-sale-amount-override.md

Source status is `done`: implementation commit `b00d22c` merged into `main` via merge commit `51720d3` (PR #83).

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
- `MembershipCatalogItemId` сейчас обязателен и продублирован в `ClientMembershipSale` и `ClientMembership`; обе EF-связи required, а web/internal bot mappings безусловно обращаются к `MembershipCatalogItem.Name`. Согласовано удалить membership-level копию и получать catalog identity только через `Sale`.
- `CreateSale` и `CreateMembership` всегда копируют `MembershipCatalogItem.Price`. Продажа создаётся при обычной покупке, renewal и transfer для всех случаев, кроме переноса активного неиспользованного `SingleVisit`.
- `CorrectAsync` сейчас меняет дату/срок и payment status, но не цену продажи. Это безопасная граница сохраняется: correction не превращается в скрытый способ переписать историческую сумму.
- `MarkPaymentAsync` меняет только payment status/version. Сумма в web request формально ещё присутствует в legacy frontend type, хотя backend её не принимает; этот лишний caller-controlled input нужно удалить.
- Каталожная цена неизменяема. Для существующей продажи она может быть default/display context, но не должна повторно участвовать в расчётах после сохранения `GrossAmount`.
- Финансовый отчёт уже агрегирует `sale.GrossAmount`; ему прежде всего нужны regression tests с override и amount-only sale, а не альтернативная формула.
- Python bot не создаёт продажи и не вычисляет деньги, но backend `BotApiService` требует catalog navigation и читает дублирующий `PaymentAmount`. Internal API и typed bot tests должны остаться совместимыми для amount-only membership.
- Валюта продукта фактически единая — RUB: frontend форматирует суммы в рублях, отдельного currency-поля в модели нет. Multi-currency не должна появляться внутри этой TASK.
- Текущая early-stage schema policy допускает воспроизводимое пересоздание БД; исторический production backfill не входит в задачу.

## Approved product and architecture decisions

Следующие решения явно согласованы пользователем 2026-07-22 и больше не являются decision gate. Изменение любого из них требует обновления source TASK и этого плана до production-кода.

### 1. Behavior для продажи без каталога
- `AmountOnly` создаёт обычный `Term` membership;
- backend сам присваивает `MembershipBehaviorKind.Term` и требует `validFrom`/`validTo`;
- frontend не отправляет `behaviorKind` и не выводит его из заполненных полей;
- backend возвращает display label `Без варианта каталога` и фактический behavior в response;
- `SingleVisit` и `Professional` без каталога запрещены;
- caller-controlled `behaviorKind` запрещён во всех sale-producing requests.

### 2. Целые рубли и нулевая ручная сумма
- ручная сумма для `Term`, `SingleVisit` и `AmountOnly` — строго положительное целое количество рублей;
- `Professional` сохраняет только текущую нулевую каталожную цену и режим `Catalog`;
- любой `manualSaleAmount` вместе с выбранным `Professional` отклоняется с `ValidationProblem`; `CatalogOverride` для `Professional` запрещён;
- каталог, продажа и возврат принимают только целое количество RUB: любое значение с ненулевой дробной частью отклоняется до persistence, молчаливое округление или отбрасывание копеек запрещено;
- значения `100`, `100.0` и `100.00` эквивалентны целым 100 RUB; `100.01` и `100.50` недопустимы;
- единый persisted диапазон каталожной цены, продажи и возврата ограничен `numeric(10,2)`, при этом DB/application checks дополнительно требуют математически целое значение. Текущий catalog `numeric(18,2)` нужно согласованно сузить до `numeric(10,2)`, чтобы catalog price всегда помещалась в sale/refund money contract.

### 3. Sale-producing operations
- purchase поддерживает `Catalog`, `CatalogOverride` и `AmountOnly`; выбранный `Professional` — только `Catalog` с нулевой ценой;
- renewal конечного `Term`, независимо от того, была ли предыдущая sale каталожной или amount-only, поддерживает все три режима; выбранный catalog item должен иметь behavior `Term`;
- renewal начинается на следующий день после последнего конечного membership и наследует его точную inclusive-длительность из membership version, а не из sale;
- renewal конечного `Professional` допускает только HeadCoach через `Professional` catalog item в режиме `Catalog`; `SingleVisit` и open-ended `Professional` renewal остаются запрещены;
- transfer без preserve-исключения для active unused `SingleVisit` поддерживает все три режима, в том числе для клиента без текущего membership;
- amount-only transfer создаёт `Term`, требует `validFrom`, равный backend business date, и обязательный `validTo`; такой transfer может заменить текущий `Professional` на `Term`;
- transfer с выбранным `Professional` допускается только для HeadCoach, только в `Catalog` и с нулевой ценой;
- перенос active unused `SingleVisit` по-прежнему сохраняет исходные assignment/sale, не создаёт sale и отклоняет все поля новой продажи: `membershipCatalogItemId`, `manualSaleAmount`, `validFrom`, `validTo`, `paymentStatus`, `paymentDate`, `professionalComment` и forbidden pricing/behavior aliases, включая явно переданный JSON `null`;
- correction и mark-payment никогда не меняют `GrossAmount`, catalog link или pricing mode; correction отклоняет forbidden pricing/catalog identity fields, а mark-payment принимает только пустой `{}` и отклоняет любой non-empty object с `400 ValidationProblem`.

### 4. Override authority and provenance
- Administrator и HeadCoach могут уменьшать или увеличивать цену обычного каталожного варианта без discount/markup limit и без обязательной причины;
- единственные границы суммы — утверждённые sign/integer-RUB/`numeric(10,2)` rules; catalog availability, branch scope и HeadCoach-only `Professional` остаются обязательными;
- явно введённая ручная сумма, равная каталожной, всё равно сохраняется как `CatalogOverride`.
- индивидуальная сумма не наследуется молча между продажами: purchase, renewal и sale-producing transfer каждый раз требуют видимого выбора режима и подтверждения фактической суммы пользователем; предыдущие mode/amount можно показывать только как контекст.

### 5. Compatibility and data policy
- внешние API consumers отсутствуют; breaking rename `paymentAmount` -> `grossAmount` разрешён при согласованной поставке backend/frontend/bot;
- чистое пересоздание PostgreSQL database допустимо; production backfill/data migration не требуются.

## Proposed domain and API contract

### Canonical sale pricing
- Ввести backend enum `ClientMembershipSalePricingMode`: `Catalog`, `CatalogOverride`, `AmountOnly`.
- Сохранять `PricingMode` в `ClientMembershipSale`; ручное значение, равное каталожной цене, всё равно остаётся `CatalogOverride`, потому что provenance определяется входным сценарием, а не сравнением decimal.
- `ClientMembershipSale.GrossAmount` — единственное persisted денежное значение конкретной продажи.
- Удалить `ClientMembership.PaymentAmount` и его DB constraint/column; membership versions читают сумму только через `Sale.GrossAmount`.
- Сделать `ClientMembershipSale.MembershipCatalogItemId`/navigation nullable для `AmountOnly`.
- Удалить `ClientMembership.MembershipCatalogItemId`/navigation; membership versions получают catalog identity/name/price только через `Sale`, не хранят вторую копию связи.
- Сохранить backend-owned behavior snapshot в sale/membership для исторической и membership-version семантики.
- `ClientMembershipSale.BehaviorKind` является каноническим immutable behavior snapshot продажи; каждая `ClientMembership` version получает `BehaviorKind` только из связанной sale через общий factory. Запрещены command/factory paths, позволяющие передать для membership version отличающийся behavior; contract/integration tests фиксируют равенство.
- Добавить DB check на sale, согласующий mode и catalog link: `Catalog`/`CatalogOverride` требуют catalog item, `AmountOnly` требует его отсутствия.
- Добавить DB money constraints согласно утверждённым zero/integer-RUB rules; application validation должна выдавать стабильный ProblemDetails до DB exception.

### Write requests
- Использовать одно nullable поле `manualSaleAmount` во всех подтверждённых sale-producing requests.
- Для разрешённых nullable полей JSON `null` эквивалентен отсутствующему значению: `manualSaleAmount: null` означает no override, `membershipCatalogItemId: null` означает отсутствие catalog selection. Amount-only возникает только при null/omitted catalog id и допустимой non-null ручной сумме; если оба значения null/omitted, возвращается missing-combination `ValidationProblem`.
- Сценарий определяется только комбинацией `membershipCatalogItemId` и наличием `manualSaleAmount`:
  - catalog id + no manual amount -> `Catalog`, `GrossAmount = item.Price`;
  - catalog id + manual amount -> `CatalogOverride`, `GrossAmount = manualSaleAmount`;
  - no catalog id + manual amount -> `AmountOnly`, `GrossAmount = manualSaleAmount`;
  - neither -> `ValidationProblem` с field errors для обоих полей.
- Не принимать caller-controlled `pricingMode`, `grossAmount`, catalog price или behavior kind. Backend вычисляет mode, amount и behavior.
- Для выбранного `Professional` отсутствие `manualSaleAmount` обязательно; backend сохраняет catalog zero и `Catalog`.
- `Guid.Empty` трактовать как invalid catalog id, а не как amount-only.
- `isPaid`/payment date остаются независимыми от размера продажи: unpaid sale всё равно сохраняет `GrossAmount`.
- Sale-producing requests явно отклоняют присутствие forbidden pricing fields (`paymentAmount`, `pricingMode`, `grossAmount`, `catalogPrice`, `behaviorKind`) с `400 ValidationProblem`, а не игнорируют их.
- Correction request явно отклоняет присутствие `paymentAmount`, `manualSaleAmount`, `grossAmount`, `pricingMode`, `catalogPrice`, `membershipCatalogItemId` и `behaviorKind` с `400 ValidationProblem`; для этих полей не допускается silent-ignore, даже если JSON-значение `null`.
- Mark-payment принимает только пустой JSON object `{}`. Любое переданное свойство, включая legacy `paymentAmount`/`isPaid`, pricing/catalog/behavior fields, неизвестное поле или JSON `null`, отклоняется с `400 ValidationProblem`; endpoint action сама однозначно означает перевод текущей версии в paid state.

### Read responses and audit
- Заменить неоднозначное публичное `paymentAmount` на фактическое `grossAmount`, полученное из sale; обновить все web consumers согласованно.
- Возвращать nullable `membershipCatalogItemId`, backend-owned non-empty `membershipName`, `pricingMode`, `grossAmount` и nullable `catalogPrice` для пояснения override.
- Catalog identity/name/price во всех response/audit projections получать через sale; membership version не является вторым catalog source.
- Для amount-only backend возвращает стабильный display label, а frontend/bot не придумывают название или behavior.
- Financial summary продолжает строиться из `GrossAmount`, non-cancelled refunds и их разности.
- Audit sale/membership state включает nullable catalog id, display label, behavior, `pricingMode`, `grossAmount` и catalog price when present. По audit payload должно быть однозначно видно catalog default, override или отсутствие варианта.
- Старые/seed rows в воспроизводимой schema получают `PricingMode = Catalog`; автоматического перерасчёта `GrossAmount` из текущего каталога не выполнять.

### Money and currency rules
- Валюта остаётся фиксированной RUB; не добавлять currency selector или конвертацию.
- Денежная validation policy должна быть общей для catalog creation, purchase/renew/transfer и refund, а не повторяться в endpoints.
- JSON decimal проверяется до persistence: finite decimal, допустимый знак, отсутствие ненулевой дробной части и попадание в единый persisted диапазон `numeric(10,2)`.
- Catalog, sale и refund DB columns используют согласованный `numeric(10,2)` storage contract плюс check целого RUB; `Professional` остаётся единственным разрешённым нулём.
- Backend не округляет, не отбрасывает копейки и не подменяет invalid manual value catalog price.

### Frontend interaction contract
- Три режима доступны в web purchase, renewal и sale-producing transfer; active unused `SingleVisit` transfer не показывает и не отправляет новую pricing форму.
- Для каждой новой продажи пользователь заново выбирает/подтверждает pricing mode и фактическую сумму. Предыдущие catalog/mode/gross amount могут отображаться как read-only context, но не попадают в новый request без явного выбора/подтверждения.
- Catalog mode показывает целую read-only catalog price; override и amount-only используют ввод только целых рублей (`step=1`, без UI-округления дробных значений).
- Frontend очищает stale catalog/manual values при смене режима и не вычисляет backend-owned `PricingMode`, behavior, permissions или денежную допустимость.

## Safe decomposition
1. **Pricing policy and contract:** pure resolver для трёх режимов, money validation, DTO и ProblemDetails keys.
2. **Canonical persistence:** persisted pricing mode, nullable sale-level catalog link, удаление membership-level amount и catalog link, clean schema checks.
3. **Purchase/renew/transfer writes:** единый resolver, atomic sale + membership creation и сохранение существующего SingleVisit transfer exception.
4. **Read/audit consumers:** web card/history, attention, attendance, internal bot, comment/audit snapshots без required catalog navigation.
5. **Refund/correction/report barriers:** доказать неизменяемую сумму, refund ceiling и report totals на `GrossAmount`.
6. **Frontend workflow:** три явных режима, server field errors, provenance display и responsive flow.
7. **Bot compatibility and full regression:** stable label/payment status, no local financial logic, all required suites.

Каждый этап должен оставлять один канонический денежный источник. Нельзя временно записывать override только в `ClientMembership.PaymentAmount` или вычислять его на frontend.

## Execution steps
1. Создать `feature/TASK-077-membership-sale-amount-override` от чистого актуального `main`; перечитать root/backend/frontend/bot `AGENTS.md`, source TASK и этот план.
2. Подтвердить, что source TASK уже находится в `/backlog/implementation`, и не переоткрывать согласованные behavior, whole-RUB, operation, authority, compatibility, data-policy и explicit-confirmation decisions. Изменение формы является существенным: до component implementation обязательно привлечь `ui-designer`; если выбор режима/срока остаётся неочевидным — провести review с `ux-researcher`.
3. **До behavioral production-кода** добавить focused backend HTTP creation tests на старом компилируемом контракте, отправляя raw JSON для `Catalog`, `CatalogOverride`, `AmountOnly` и representative invalid cases. Этот suite является обязательным executable red/green barrier: до реализации он должен собраться, запустить тесты и упасть на assertions из-за отсутствующей functionality, а не на compile/fixture/test-host ошибке.
4. После зафиксированной executable HTTP red-фазы разрешено добавить минимальный compile-only scaffold новых enum/policy/DTO signatures без functional behavior. Затем **до behavioral production-кода** добавить backend unit tests для общей pricing policy:
   - три допустимых комбинации catalog/manual inputs;
   - manual amount equal to catalog price remains `CatalogOverride`;
   - no catalog + no amount, empty catalog id, negative/zero by behavior, non-zero fractional RUB и overflow отклоняются; integral representations `100`, `100.0`, `100.00` принимаются одинаково;
   - catalog availability/branch/Professional permission rules остаются обязательными при override;
   - любой manual amount для `Professional` отклоняется, а catalog zero сохраняет `Catalog`;
   - amount-only behavior и validity определяются backend policy, не request enum;
   - sale behavior является immutable canonical snapshot, а membership version не может получить отличающийся `BehaviorKind`;
   - correction policy не разрешает mutation суммы и требует `ValidationProblem` при presence forbidden pricing/catalog fields; mark-payment принимает только `{}`.
5. **До behavioral production-кода** обновить `ClientMembershipCatalogContractTests` и persistence model tests:
   - purchase/renew/transfer contracts принимают только nullable catalog id + nullable `manualSaleAmount` и не принимают mode/behavior/catalog price/gross amount;
   - nullable request semantics фиксируют equivalence omitted и explicit JSON `null`, сохраняя missing-combination error when both are absent;
   - response/snapshot contracts используют nullable catalog identity, `PricingMode` и `GrossAmount`;
   - sale-producing/correction contracts отклоняют legacy `paymentAmount` и остальные forbidden fields, включая JSON `null`; mark-payment отклоняет любой non-empty object, включая legacy `paymentAmount`/`isPaid`;
   - `ClientMembership` больше не имеет `PaymentAmount` и `MembershipCatalogItemId`/navigation;
   - DB model содержит nullable catalog FK только на sale, pricing-mode/behavior consistency barriers и integral-RUB money constraints;
   - catalog/sale/refund используют согласованный `numeric(10,2)` storage range, а catalog больше не допускает значения, которое не помещается в sale.
6. **До behavioral production-кода** расширить backend API integration matrix для HeadCoach и Administrator:
   - catalog default сохраняет item price и `Catalog`;
   - selected catalog + different/equal manual amount сохраняет exact value и `CatalogOverride`;
   - amount-only сохраняет null catalog, backend behavior/label и `AmountOnly`;
   - `Professional` без manual amount сохраняет zero/`Catalog`, а любой manual amount отклоняется;
   - neither, empty id, fractional amount/range/validity errors возвращают единый ValidationProblem с устойчивыми field keys;
   - unavailable/cross-branch item и crafted Professional request не обходятся через manual amount;
   - Coach/anonymous/CSRF behavior остаётся прежним;
   - failed validation не создаёт sale, membership version или audit event.
   - тесты успешного создания проходят через реальный purchase HTTP endpoint/application flow, а не через прямую вставку `ClientMembership`/`ClientMembershipSale` в fixture; напрямую разрешено создавать только prerequisites (client, branch, group, catalog item, user/session);
   - каждый успешный сценарий после нового запроса к БД подтверждает создание ровно одной `ClientMembershipSale`, одной согласованной current membership version и одного purchase audit event, их связь с тем же client/branch/actor, а также exact `GrossAmount`, `PricingMode`, nullable catalog identity, behavior, validity и payment state;
   - выделить focused test class `ClientMembershipCreationPricingApiTests` (или эквивалентный класс с устойчивым filter name), чтобы creation matrix можно было запускать отдельно от полного backend suite.
7. **До behavioral production-кода** добавить integration tests для sale-producing смежных flows по утверждённой матрице:
   - renewal конечного `Term` покрывает переходы catalog -> amount-only, amount-only -> catalog, amount-only -> override и amount-only -> amount-only, не меняя предыдущую sale;
   - renewal наследует exact inclusive duration последней membership version; `Professional` покрыт только в zero-price `Catalog`;
   - transfer атомарно сохраняет branch/group/membership/sale для catalog/override/amount-only и полностью откатывается при invalid amount;
   - amount-only transfer покрыт для client without current membership и для замены current `Professional` на `Term`;
   - unused `SingleVisit` transfer отклоняет все поля новой продажи, включая explicit null, а assignment/sale/membership остаются прежними.
8. **До behavioral production-кода** добавить refund/correction/report integration tests:
   - partial/full/excessive refund сравнивается с override/amount-only `GrossAmount`;
   - fractional refund отклоняется без rounding/write/audit; integral representations проходят в одном whole-RUB contract;
   - canceled refund снова освобождает доступный лимит относительно той же суммы;
   - correction сохраняет exact `GrossAmount`, `PricingMode` и catalog link; crafted pricing/catalog identity fields возвращают `400 ValidationProblem` без mutation/audit;
   - financial totals/breakdowns используют override и amount-only amounts, catalog price в итоги не попадает;
   - изменение имени/доступности каталога не меняет историческую сумму;
   - pre-existing catalog sale продолжает возвращать прежний `GrossAmount` без перерасчёта.
9. **До behavioral production-кода** добавить audit/read/internal bot tests:
   - purchase/renew/transfer audit отражает nullable catalog, mode, exact gross amount и manual/no-catalog provenance;
   - карточка, history, attention, attendance snapshots и bot card/list/mark-payment не падают при null catalog;
   - backend выдаёт amount-only label одинаково во всех projections;
   - mark-payment создаёт новую membership version, но не меняет sale amount/mode; crafted pricing/catalog identity fields возвращают `400 ValidationProblem` без новой version/audit;
   - Python bot не вычисляет amount/mode; если response shape меняется, typed Pydantic tests сначала фиксируют новый contract.
10. **До behavioral production-кода** добавить frontend API/unit tests:
   - exact payload для трёх режимов и отсутствие caller-controlled mode/behavior/catalog price;
   - mapping nullable catalog id, backend label, `grossAmount`, `pricingMode`, `catalogPrice`;
   - ProblemDetails field errors сохраняются для catalog и manual amount;
   - correction payload не содержит pricing/catalog identity fields; mark-payment отправляет ровно `{}`, а backend contract tests проверяют явное отклонение legacy/non-empty payload.
11. **До behavioral production-кода** добавить frontend component tests формы и истории:
    - purchase, renewal и sale-producing transfer имеют три понятных взаимоисключающих режима без скрытого одновременного состояния;
    - catalog default показывает read-only catalog price;
    - override показывает catalog context и редактируемую фактическую сумму;
    - amount-only не требует catalog select и рендерит backend-approved validity UX;
    - переключение режима очищает stale manual/catalog values и не отправляет скрытые поля;
    - новая продажа никогда молча не наследует manual amount: предыдущее значение показывается только как context, а фактический mode/amount пользователь подтверждает заново;
    - fractional RUB нельзя отправить; UI использует whole-ruble input без округления;
    - backend field error остаётся рядом с соответствующим control и введённые данные не теряются;
    - history/card различают `Каталожная цена`, `Индивидуальная сумма` и `Без варианта каталога`, всегда показывая фактический gross amount;
    - correction остаётся amount-read-only, mark-payment не предлагает изменить сумму.
12. **До behavioral production-кода** добавить focused Playwright flows: purchase, renewal и sale-producing transfer подтверждают pricing заново; покрыть три режима, request/response rendering, fractional server rejection, reload/history и responsive layout на существующих desktop/mobile breakpoints. Preserve-SingleVisit transfer не показывает pricing controls.
13. Зафиксировать результаты executable HTTP red-фазы из шага 3, затем запустить все добавленные unit/integration/frontend tests после compile-only scaffold и подтвердить ожидаемые assertion failures именно из-за отсутствующих policy/schema/contract/UI behavior. Focused backend-команда: `dotnet test backend/tests/GymCrm.Tests/GymCrm.Tests.csproj --filter "FullyQualifiedName~ClientMembershipCreationPricingApiTests"` (имя фильтра синхронизировать с фактически созданным классом). Записать executed/failed counts и assertions для `Catalog`, `CatalogOverride`, `AmountOnly` и invalid/no-write scenarios; compile failure, fixture/test environment error или baseline regression не считаются red-фазой.
14. Реализовать минимальную domain/application pricing policy и enum. Один resolver получает catalog item/nullable manual amount/operation context, валидирует whole-RUB деньги и возвращает `PricingMode`, `GrossAmount`, canonical sale behavior и catalog identity.
15. Обновить persistence model:
    - добавить `PricingMode` в `ClientMembershipSale`;
    - сделать `ClientMembershipSale.MembershipCatalogItemId`/navigation nullable;
    - удалить `ClientMembership.PaymentAmount`, `ClientMembership.MembershipCatalogItemId`/navigation, их columns/FK/index/check constraint;
    - согласовать catalog/sale/refund на `numeric(10,2)`, добавить pricing/behavior/integer-RUB consistency constraints и индексы;
    - обновить текущую initial schema, designer и model snapshot по действующей early-stage policy; не добавлять несогласованную production data migration;
    - проверить воспроизводимое создание чистой PostgreSQL database.
16. Перевести `ClientMembershipService` на resolver, один sale factory и version factory для purchase/renew/transfer. `CreateMembership` получает canonical sale context, копирует только sale-owned `BehaviorKind`, но никогда не принимает отдельную денежную сумму, catalog identity или caller-owned behavior.
17. Обновить web DTO, validation resources и ProblemDetails mapping. В рамках endpoint-local transport validation обнаруживать presence явно запрещённых fields, включая `null`; mark-payment валидировать как strict empty object. Не менять глобальную unknown-field policy для несвязанных endpoints.
18. Обновить read/audit consumers nullable catalog и canonical amount: client details/history/summary, client attention, attendance, internal bot, audit serializers. Ввести один backend display-name resolver вместо повторяющихся `MembershipCatalogItem.Name`/fallback строк.
19. Сохранить `FinancialReportService` и refund calculation на `sale.GrossAmount`; добавить whole-RUB refund validation. Менять report production code только если source audit обнаружит чтение catalog/member amount.
20. Реализовать frontend typed contracts и три явных режима во всех web sale-producing flows. Использовать Mantine/Onest, явное подтверждение каждой новой individual amount, whole-RUB input, server-owned behavior/validation, фактическую сумму и pricing provenance; не воспроизводить backend money/permission rules в UI.
21. Если internal bot response изменился, обновить `bot/src/gym_crm_bot/crm/models.py` и contract tests без добавления write flow или локальных финансовых правил. Если shape совместим, production Python files не менять.
22. После реализации повторно выполнить тот же focused backend HTTP creation suite до полностью зелёного результата, затем focused frontend unit/Playwright sale-producing flows и полный `dotnet test backend/GymCrm.slnx`. Только после зелёной creation matrix выполнить остальные full regression suites и финальный `rg` по `PaymentAmount`, `GrossAmount`, `MembershipCatalogItem.Price`, `MembershipCatalogItem.Name` и required catalog ids. Каждый оставшийся monetary read классифицировать как catalog management/display либо canonical sale calculation.

## Preferred implementation strategy
1. Approved decision record and test-first contract.
2. Canonical sale amount and persisted pricing provenance before UI changes.
3. Clean-schema consistency checks plus application ProblemDetails.
4. One resolver and one display-label policy shared by all backend flows.
5. Incremental web/internal bot consumer conversion before removing the duplicate column.
6. Explicit three-mode frontend workflow with small verifiable commits.
7. Full-stack merge only after refund/report/audit barriers pass.

Backend, frontend и bot должны поставляться согласованно, потому что response/request contract меняется. Внешние consumers отсутствуют, поэтому additive compatibility phase и legacy `paymentAmount` alias не нужны; не сохранять два денежных источника как временную совместимость.

## Files likely to change
- `backend/src/GymCrm.Domain/Clients/ClientMembershipSale.cs`
- `backend/src/GymCrm.Domain/Clients/ClientMembership.cs`
- `backend/src/GymCrm.Domain/Clients/ClientMembershipSalePricingMode.cs` (new)
- focused sale pricing policy under `backend/src/GymCrm.Domain/Clients/` or `backend/src/GymCrm.Application/Clients/` (new; placement to follow dependency rules)
- `backend/src/GymCrm.Application/Clients/IClientMembershipService.cs`
- `backend/src/GymCrm.Infrastructure/Clients/ClientMembershipService.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/ClientMembershipSaleConfiguration.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/ClientMembershipConfiguration.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/ClientMembershipRefundConfiguration.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/MembershipCatalogItemConfiguration.cs`
- `backend/src/GymCrm.Domain/Memberships/MembershipCatalogItem.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.Designer.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/GymCrmDbContextModelSnapshot.cs`
- the follow-up membership constraint migration, if clean-schema regeneration requires reconciliation rather than an extra migration
- `backend/src/GymCrm.Api/Auth/PurchaseClientMembershipRequest.cs`
- `backend/src/GymCrm.Api/Auth/RenewClientMembershipRequest.cs`
- `backend/src/GymCrm.Api/Auth/TransferClientBranchRequest.cs`
- `backend/src/GymCrm.Api/Auth/CorrectClientMembershipRequest.cs`
- `backend/src/GymCrm.Api/Auth/MarkMembershipPaymentRequest.cs`
- `backend/src/GymCrm.Api/Auth/MembershipCatalogEndpoints.cs`
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
- `ClientMembershipSale` — единственный persisted владелец catalog identity; `ClientMembership` не дублирует catalog FK/navigation.
- `ClientMembershipSale.BehaviorKind` — canonical immutable behavior snapshot; membership versions получают совпадающий behavior только из sale factory.
- Catalog price остаётся immutable default; manual override не меняет `MembershipCatalogItem.Price`.
- Pricing provenance хранится явно и не выводится сравнением сумм.
- Amount-only membership не должен создавать synthetic catalog row или менять справочник скрытым образом.
- Null catalog navigation обрабатывается во всех projections без NRE и без frontend-derived business semantics.
- Refund sum for non-canceled rows не превышает sale gross amount.
- Correction, payment mark, attendance write-off/restore и comment update не меняют сумму/mode/catalog identity продажи.
- Existing role/branch/Professional boundaries сохраняются; override не является способом назначить недоступный вид абонемента.
- `Professional` всегда оформляется по нулевой каталожной цене в `Catalog`; manual override для него запрещён.
- Administrator и HeadCoach могут задать любое положительное целое число RUB для ordinary override/amount-only в persisted диапазоне `numeric(10,2)` без discount/markup cap и без обязательной причины.
- Catalog price, sale gross amount и refund amount используют один `numeric(10,2)` storage range и принимают только математически целые RUB; binary float, копейки, silent rounding и truncation не становятся источником истины.
- Каждая новая web purchase/renewal/sale-producing transfer требует явного подтверждения mode/actual amount; previous manual amount не наследуется и не отправляется молча.
- Correction отклоняет forbidden pricing/catalog identity JSON fields; mark-payment принимает только `{}`; silent-ignore запрещён.
- Active unused `SingleVisit` transfer отклоняет любые поля новой продажи и сохраняет исходную sale/membership.
- Не выполнять автоматический перерасчёт исторических продаж.
- Clean database recreation и synchronized breaking API rollout разрешены; external API consumers и production data backfill отсутствуют.
- Сохранять current version uniqueness, overlap constraints и atomic transfer semantics TASK-070.

## Out of scope
- Редактирование цены варианта каталога.
- Изменение `GrossAmount` уже созданной продажи через correction или отдельный endpoint.
- Массовый backfill/repricing исторических продаж и production data migration.
- Multi-currency, exchange rates, discounts/promocodes/taxes or invoice/payment-provider integration.
- Изменение refund cancellation workflow или финансовой атрибуции по филиалам/группам/тренерам.
- Новые роли/permissions или ослабление HeadCoach-only `Professional` assignment.
- Изменение validity/write-off semantics вне утверждённого `AmountOnly = Term` behavior.
- Bot purchase/renew/transfer UX: текущий bot остаётся thin read/payment-status consumer.
- Рефакторинг всего `ClientEndpoints.cs`/`ClientManagement.tsx`; допустимо только локальное извлечение новых focused policy/components.

## Required test coverage

Focused raw-JSON HTTP integration suite пишется первым и обязан дать executable assertion-based red-фазу на старом компилируемом контракте. После этого допускается только минимальный compile-only scaffold signatures; все остальные новые/обновлённые unit и integration tests пишутся и запускаются до behavioral functional code.

### Unit tests
- Pricing resolver: all valid/invalid catalog/manual combinations and exact persisted mode.
- Money validation: zero policy by behavior, negative, non-zero fractional RUB, integral decimal representations, max precision, no rounding/truncation.
- Backend-owned amount-only behavior/validity and rejection of caller-controlled behavior.
- Canonical sale behavior and rejection/impossibility of a differing membership-version behavior.
- `Professional` manual override rejection and preservation of catalog zero/`Catalog`.
- Display label/provenance mapper for catalog, override and no-catalog states.
- Contract reflection tests preventing reintroduction of `ClientMembership.PaymentAmount`, membership-level catalog identity and caller-controlled pricing mode.
- Nullable-field semantics for omitted/explicit `null`, forbidden-field validation for sale-producing/correction, and strict-empty mark-payment including legacy `paymentAmount`/`isPaid`.
- Frontend API payload/mapping and mode-switch state reset.
- Frontend component rendering of provenance and actual amount.

### Integration tests
- Purchase/renew/transfer scenario matrix with persisted sale/membership/audit assertions.
- Authorization, branch/catalog availability, Professional permission and CSRF negative matrix.
- Stable ProblemDetails fields for missing combination, fractional RUB and range errors.
- Nullable sale-level catalog persistence, absence of membership-level catalog FK, canonical behavior/version equality, sale mode/FK and integral-RUB check constraints, aligned catalog/sale/refund precision, and reproducible clean PostgreSQL setup.
- Transaction rollback: invalid transfer or failed sale creates no partial client/group/membership/sale/audit state.
- Refund ceiling/full/partial/canceled behavior against override and amount-only `GrossAmount`.
- Correction rejects forbidden pricing/catalog fields; payment mark rejects every non-empty object; both preserve immutable sale price/mode/catalog without unintended writes/audit.
- Financial report totals/breakdowns use exact stored amounts and preserve historical rows.
- Attendance/client attention/internal bot projections work with no catalog and use backend label/canonical amount.
- Existing catalog-only sales retain current behavior and financial totals.

### Обязательные тесты создания абонемента и порядок их прогона
- До behavioral production-кода создать focused backend raw-JSON integration suite для purchase/create flow: `Catalog`, `CatalogOverride` с отличающейся суммой, `CatalogOverride` с суммой, равной каталожной, `AmountOnly`, допустимый zero-price `Professional`, fractional RUB и representative invalid/no-write cases. Suite не должен ссылаться на ещё не существующие CLR signatures.
- Успешные тесты обязаны вызывать публичный HTTP/API flow создания абонемента. Прямая вставка sale/membership в БД не засчитывается как проверка creation flow и допускается только в тестах read/report/refund consumers, где создание не является предметом проверки.
- После каждого успешного API-вызова перечитать данные новым `DbContext` и проверить согласованность sale, current membership version и audit event; response-only assertions недостаточны.
- До реализации запустить focused creation suite и подтвердить ожидаемую red-фазу через реально выполненные failing assertions из-за отсутствующей pricing/schema/contract functionality. Любой compile error, неработающий test host, fixture/setup error или существующая baseline-регрессия не засчитываются.
- После реализации повторить идентичный focused-прогон без ослабления assertions и добиться green-фазы; запрещено заменять integration assertions mocks или прямым seed готового membership.
- После зелёного focused backend-прогона запустить frontend component/API tests purchase/renew/transfer, focused Playwright flows явного подтверждения трёх режимов и затем полный backend regression suite.
- Обязательная focused-команда: `dotnet test backend/tests/GymCrm.Tests/GymCrm.Tests.csproj --filter "FullyQualifiedName~ClientMembershipCreationPricingApiTests"`; если выбран другой class name, обновить команду в плане одновременно с тестом, сохранив отдельный стабильный filter.
- Результаты red и green прогонов должны быть отражены в implementation handoff: команда, число выполненных/упавших тестов и ожидаемая причина initial failure.

### UI/e2e tests
- Three explicit modes in purchase, renewal and sale-producing transfer, keyboard-accessible controls and deterministic value clearing.
- Exact request for each mode; stale hidden fields are absent.
- Previous manual amount is context only and is never silently inherited; the user confirms mode/amount for every new sale.
- Whole-ruble input uses step 1 and fractional values are rejected without rounding.
- Backend field errors preserve user input and focus the relevant field.
- Card/history show actual amount and origin after reload.
- Correction and payment confirmation keep amount read-only.
- Responsive form/history on project mobile/desktop breakpoints without horizontal scroll or obscured primary actions.

### Existing tests to update
- Contract tests that currently prohibit any caller-provided amount must allow only `ManualSaleAmount` in sale-producing commands.
- Strict persistence tests/fixtures requiring membership-level catalog IDs and `PaymentAmount` on every membership.
- Client API/audit tests asserting catalog name/id and duplicated payment amount.
- Transfer tests whose payload currently requires only catalog fields.
- Frontend test `keeps catalog type and sale amount read-only` remains valid only for correction; purchase tests must cover editable override.
- Internal bot fixtures must cover backend fallback label for null catalog; do not weaken existing payment/role assertions.

### Expected initial failure verification
- Первый raw-JSON HTTP creation suite компилируется и выполняется, но assertions fail because override/amount-only contract and persistence behavior отсутствуют.
- После compile-only scaffold pricing-policy/contract tests выполняются и падают из-за отсутствующего resolver behavior, а не из-за отсутствующих CLR types.
- Persistence tests fail because sale/member catalog FKs are required and membership still stores `PaymentAmount` plus duplicated catalog identity.
- API tests fail because amount-only/override requests are rejected or ignored and audit lacks provenance.
- Refund/report tests fail only where setup cannot create the new sale types; existing report baseline must stay green.
- Frontend tests fail because purchase UI fixes catalog price and mappings require catalog identity.
- Bot/internal tests fail because current backend dereferences catalog navigation.
- Missing PostgreSQL runtime, invalid fixture, любой compile error или existing baseline regression is not an acceptable red phase.

### Manual-only validation
- Confirm source remains in `/backlog/implementation` and the approved decision record is unchanged before branch execution.
- UX review with `ui-designer` of Russian mode labels, explicit per-sale confirmation, comparison of catalog/actual amount, whole-ruble input and narrow-screen workflow.
- Audit/security review of crafted Professional/cross-branch requests and absence of sensitive/technical error details.
- Manual QA supplements but does not replace automated barriers.

## Test plan
- [x] Product decisions and operation matrix are recorded before branch implementation begins.
- [x] Source TASK is formally moved to `/backlog/implementation` with `Safe for Codex: yes` and a dedicated branch recorded.
- [x] Raw-JSON HTTP suite gives an executable assertion-based red phase before behavioral production code; remaining unit/integration/component tests are added after compile-only scaffold and fail for intended missing behavior.
- [x] Focused API tests создают абонементы через production purchase flow во всех разрешённых pricing modes и проверяют persisted sale + current membership version + audit после reload.
- [x] Focused creation suite запущен до реализации в red-фазе и после реализации в green-фазе одной и той же filter-командой; оба результата записаны в handoff.
- [x] All three purchase scenarios persist exact `GrossAmount` and correct `PricingMode`.
- [x] Renewal/transfer follow the approved matrix, require explicit pricing confirmation, and failed transfer rolls back all layers.
- [x] Missing/invalid amount combinations return stable ProblemDetails without writes/audit.
- [x] Catalog, sale and refund accept only whole RUB in the aligned range; fractional values never round or persist.
- [x] Override cannot bypass catalog availability, branch scope or Professional permission.
- [x] Refunds, corrections and payment mark use/preserve the immutable sale amount.
- [x] Financial totals and breakdowns use exact override/amount-only values after reload.
- [x] Catalog-only historical rows remain unchanged and never reprice dynamically.
- [x] Web, attendance, attention and internal bot handle null catalog and consistent backend label.
- [x] Frontend purchase/renew/transfer display actual amount and origin for all modes, require per-sale confirmation and send no inherited/hidden stale values.
- [x] `dotnet test backend/GymCrm.slnx` passes.
- [x] `cd frontend && npm run test:unit`, `npm run lint`, `npm run build` pass.
- [x] Focused Playwright membership sale-pricing and responsive specs pass.
- [x] `cd bot && ruff check . && pytest` pass.
- [x] Clean PostgreSQL database creation and final monetary/catalog source audit pass.

## Implementation handoff
- Branch: `feature/TASK-077-membership-sale-amount-override` from updated `main`.
- Backend red: `dotnet test backend/tests/GymCrm.Tests/GymCrm.Tests.csproj --filter "FullyQualifiedName~ClientMembershipCreationPricingApiTests"` executed 7 tests and failed 7 assertions because override/amount-only pricing and provenance were not implemented; the host, fixture and compilation were green.
- Backend green: the same filter command now executes 12 tests and passes 12; the suite was expanded without weakening the original assertions.
- Additional red barriers: pricing/catalog/persistence executed 25 tests (20 expected failures, 5 baseline passes); frontend focused unit executed 37 tests (16 expected failures); bot typed-contract suite executed 7 tests (1 expected failure).
- Final automated checks: backend 231/231; frontend 160/160 plus lint/build; focused Playwright pricing 9/9 and transfer 1/1; bot 36/36 plus ruff.
- Database: no new migration was added. The existing initial migration, its designer, the existing follow-up designer and the model snapshot were updated. A fresh `gym-crm_postgres_data` deployment applied the two existing migrations and passed schema, constraint, seed, health and restart checks.

## Regression barrier
Completion is blocked unless the same raw-JSON focused integration suite compiles, executes and fails by assertions in the expected red phase before behavioral production code, then passes in a green phase after implementation. It creates memberships through the real purchase HTTP/application flow for all three sale modes and proves after a fresh database read that sale, current membership version and audit were created atomically. Tests must prove that the exact whole-RUB `ClientMembershipSale.GrossAmount` is the value used by client history, audit, refund ceiling, correction preservation, financial report totals and internal bot projection after reload; fractional catalog/manual/refund values must fail without rounding or writes. The barrier also requires invalid/no-write creation coverage, clean-schema tests for nullable sale-level catalog/pricing consistency, canonical sale/membership behavior equality, aligned catalog/sale/refund money constraints, absence of membership-level catalog identity, strict-empty mark-payment, complete new-sale-field rejection for preserve-SingleVisit transfer, atomic transfer rollback and frontend component/Playwright tests for explicit pricing confirmation in purchase/renew/transfer. Directly seeding a ready sale/membership cannot satisfy the creation barrier. Any remaining `ClientMembership.PaymentAmount`, `ClientMembership.MembershipCatalogItemId`/navigation or financial calculation from `MembershipCatalogItem.Price` after sale creation fails the barrier.

## Risks
- **Split-brain amount:** leaving `ClientMembership.PaymentAmount` or a UI-derived fallback creates inconsistent reports/cards/refunds. Remove the duplicate source and audit all reads.
- **Amount-only behavior regression:** despite the approved `AmountOnly = Term` rule, guessing behavior from dates or UI mode can corrupt attendance and privileges. Keep behavior backend-owned and test the fixed rule.
- **Split catalog identity:** retaining `ClientMembership.MembershipCatalogItemId` alongside the sale-level link can create contradictory null/catalog states. Remove the membership-level copy and route all projections through sale.
- **Privilege bypass:** manual amount must not let Administrator assign global `Professional` or use a cross-branch/unavailable item.
- **Silent money normalization:** EF/database rounding or truncation of kopecks can change the agreed price. Reject every non-zero fractional RUB before persistence and back it with aligned catalog/sale/refund DB checks.
- **Silent override inheritance:** reusing the previous manual amount in renewal/transfer without visible confirmation can create an unintended new sale. Previous pricing is context only until explicitly confirmed.
- **Split behavior snapshot:** retaining behavior on both sale and membership without a one-way factory invariant can produce contradictory access semantics. Sale owns the immutable snapshot; versions copy it only from sale.
- **Lost provenance:** comparing manual and catalog values cannot distinguish an explicit equal override. Persist pricing mode.
- **Nullable navigation regressions:** web, attention, attendance and bot contain multiple direct catalog dereferences; one missed path can fail only for amount-only clients.
- **Partial transfer state:** transfer spans branch/groups/membership/sale. Pricing validation and audit must remain inside the existing atomic boundary.
- **Historical repricing:** a fallback to current catalog price would mutate old reports conceptually even without updating rows.
- **Contract drift:** renaming `paymentAmount` to `grossAmount` requires synchronized backend/frontend/internal bot fixtures; no partial consumer update.
- **Large shared files:** `ClientEndpoints.cs`, `ClientMembershipService.cs`, `BotApiService.cs` and `ClientManagement.tsx` make inline duplication likely. Use focused resolver/mapper/component extraction without broad refactor.

## Stop conditions
Остановиться и не писать production-код, если:
- task-specific branch не создана от чистого актуального `main`;
- реализация требует отступить от утверждённых amount-only behavior, whole-RUB/zero/Professional rule, explicit per-sale confirmation, operation matrix, authority, compatibility и data policy;
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
yes

Причина: product/architecture review и follow-up questions закрыты пользователем 2026-07-22; source TASK перемещена в `/backlog/implementation`, помечена `Safe for Codex: yes`, отдельная branch и executable test-first regression barrier зафиксированы. Production-код в рамках planning turn не изменялся.
