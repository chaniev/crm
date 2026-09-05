# Implementation Plan: TASK-115 Адресность и одновременное действие абонементов

## Metadata
- source_task: /backlog/done/2026-08-23/TASK-115-membership-target-and-overlap-model.md
- branch: feature/TASK-115-membership-target-and-overlap-model
- readiness: done — explicit high-risk execution approved 2026-08-23; recreatable DB lifecycle verified; implemented and locally validated
- dependencies: none; if batched with TASK-119, TASK-115 must integrate first
- risk: high — membership/attendance/finance semantics, concurrency and schema transition

## Contract revision

- Этот документ полностью заменяет superseded one-group plan от 2026-08-19.
- План описывает подтверждённую ordered multi-group модель от 2026-08-21.
- Clarification от 2026-08-21 16:38 MSK увеличивает верхнюю границу для
  `Term`/`Professional` с двух до пяти target groups; `SingleVisit` остаётся
  одногрупповым.

## Goal

Администратор или главный тренер оформляет, продлевает, исправляет и переносит
абонемент с явным упорядоченным набором групп. `Term` и `Professional` имеют
от одной до пяти target groups одного филиала, `SingleVisit` — ровно одну.
Параллельные обычные абонементы разрешены только для непересекающихся sets,
`Professional` глобально исключает любой другой entitlement. Attendance без
пользовательского выбора однозначно разрешает entitlement по клиенту, группе и
дате; финансовые и attendance события сохраняют immutable ordered snapshots.

## Confirmed implementation contract

Этот раздел фиксирует executable engineering interpretation подтверждённых
product decisions. Frontend и bot не должны вычислять эти правила сами.

### Ordered target model

- Добавить отдельную ordered child collection технической версии membership,
  например `ClientMembershipTargetGroup`:
  - `ClientMembershipId`;
  - `GroupId`;
  - `Position` (`0..4`).
- Database invariants:
  - unique `(ClientMembershipId, GroupId)` — set не содержит дублей;
  - unique `(ClientMembershipId, Position)` — порядок однозначен;
  - `Position` ограничен `0..4`;
  - FK на membership и group использует restrictive delete semantics.
- Application/domain policy валидирует cardinality и same-branch invariant:
  - `Term`: 1–5;
  - `SingleVisit`: 1;
  - `Professional`: 1–5;
  - legacy technical versions могут иметь 0 targets только с явным
    `LegacyTargetMissing` state.
- Position `0` является reporting group. Отдельный mutable
  `ReportingGroupId` не создаётся как второй source of truth.
- `Professional` хранит target set для адресности/reporting, но resolver имеет
  `coverageKind = AllGroups`; `Term`/`SingleVisit` имеют
  `coverageKind = TargetGroups`.
- Новые и исправленные versions копируют ordered collection явно; порядок не
  сортируется по GUID/имени во время normal write.

### Immutable event snapshots

- Membership target rows описывают technical version, но не заменяют event
  snapshots.
- Добавить focused immutable snapshot rows для:
  - `ClientMembershipSale`;
  - `ClientMembershipRefund`;
  - eligibility, выбранного при `Attendance` transition в `Present`.
- Attendance snapshot должен принадлежать append-only attendance entitlement/
  state event, а не быть cascade-child mutable `Attendance` row: текущий
  transition в `Unmarked` удаляет row, но не имеет права удалять исторический
  snapshot. Допустима существующая transactional audit event как owner только
  если schema/query tests доказывают append-only persistence и доступность
  ordered target data; иначе добавить focused event entity.
- Каждый snapshot хранит owner id, `GroupId`, `BranchId` и `Position`.
  Historical display names разрешаются через существующие non-deletable group/
  branch entities; если текущий report contract требует историческое имя,
  добавить name snapshot только после отдельного raw-contract test, не как
  скрытую UI догадку.
- Sale snapshot создаётся из target set в момент purchase/renew.
- Refund snapshot создаётся из current target set адресованной sale в момент
  refund; последующие correction/transfer его не меняют.
- Attendance snapshot создаётся из resolver result в момент успешного
  `Present`; factual `Attendance.GroupId` остаётся группой занятия. Позднее
  `Absent`/`Unmarked` создаёт новый state/audit event, но не обновляет и не
  удаляет прежний snapshot.
- Audit old/new state сериализует ordered targets, coverage, membership/sale
  identity и snapshot provenance.
- Canonical sale/refund totals считают событие один раз; branch/group/trainer
  breakdown использует только Position `0` соответствующего event snapshot.

### Canonical HTTP/read contract

- Write requests получают `targetGroupIds` как ordered array:
  - purchase: required explicit array, без неявного default по client groups;
  - renew: `saleId`, `expectedMembershipId`, editable `targetGroupIds`;
  - correction: существующие `saleId` + `expectedMembershipId` и editable
    `targetGroupIds`;
  - membership target transfer: `sourceGroupId`, `targetGroupId` и bounded
    expected current version identities/ETag-equivalent token.
- `AmountOnly` сохраняет текущую backend semantics `Term`; UI не вводит новый
  behavior selector в рамках TASK-115.
- `targetGroupIds` входит в idempotency payload hash с сохранением order.
- Membership read model содержит ordered `targetGroups` objects:
  `groupId`, `groupName`, `branchId`, `branchName`, `position`, `isActive`.
- Membership read model также содержит backend-owned `coverageKind` и
  `entitlementState`: `Active`, `Future`, `Expired`, `UsedSingleVisit`,
  `LegacyTargetMissing`.
- Client details/list переходят на canonical `currentMemberships` collection.
  `membershipHistory` остаётся collection technical versions и содержит
  immutable target snapshot каждой version/sale.
- Backend задаёт deterministic collection order и aggregate list fields:
  `hasActiveMembership`, `hasCurrentMembership`, `isProfessional`,
  `membershipState`, warnings и allowed actions. Consumers не выбирают
  произвольный first membership и не выводят state локально.
- Singular `currentMembership`/`currentMembershipSummary` не остаётся вторым
  source of truth. Допустим только явно ограниченный compatibility adapter в
  одном rollout, который удаляется до TASK completion; canonical tests не
  должны зависеть от него.
- Expiring/attention items получают `membershipId`/`saleId` и target summary,
  чтобы несколько memberships одного клиента имели разные stable identities.
- Internal bot card получает canonical collection и backend ordering. Bot
  форматирует данные, но не вычисляет overlap/eligibility.

### Validation and ProblemDetails

- `targetGroupIds` missing/empty/too many/duplicate, cross-branch target,
  inactive/missing/inaccessible group и `SingleVisit` cardinality возвращают
  `400 ValidationProblem`; field keys стабильны: `targetGroupIds` и при
  необходимости `targetGroupIds[0]`/`targetGroupIds[1]`.
- `membership-overlap` возвращает `409` с backend-owned reason
  (`target-intersection` или `professional-global`) и bounded `conflicts[]`.
  Conflict metadata раскрывает только данные, доступные actor.
- Stale `expectedMembershipId`/expected set возвращает существующий
  `membership-target-conflict` (`409`) без частичной mutation.
- Legacy empty set при operation, требующей entitlement, возвращает
  `membership-target-missing` (`409`) с recovery action на correction.
- Transfer, который создаёт duplicate set (`[A,C]`, `A -> C`) или нарушает
  same-branch invariant, возвращает stable transfer conflict и не меняет ни
  memberships, ни assignments.
- Group deactivation с blocking targets возвращает
  `group-active-memberships` (`409`) с bounded affected membership summaries.
- Cancellation of attendance, при которой восстановление `SingleVisit`
  создаст новый overlap, возвращает `single-visit-restore-conflict` (`409`) и
  атомарно сохраняет прежние attendance/membership states.
- Raw JSON tests фиксируют status, type/code, field paths, extensions и Russian
  recovery copy; тесты только CLR records недостаточны.

## Overlap and entitlement policy

### Effective periods

- `Term`/`Professional`: inclusive `[IndividualValidFrom, IndividualValidTo]`;
  same-day end/start пересекаются, следующий membership той же группы может
  начаться не раньше следующего дня.
- Unused `SingleVisit`: inclusive `[PurchaseDate, infinity)` до write-off.
- Used `SingleVisit`, expired versions и closed technical versions не являются
  current entitlements.
- Empty legacy target set никогда не является entitlement.

### Matrix

| Existing | Requested | Target sets intersect | Target sets disjoint |
|---|---:|---:|---:|
| `Term` | `Term` | deny | allow |
| `Term` | `SingleVisit` | deny | allow |
| `SingleVisit` | `Term` | deny | allow |
| `SingleVisit` | `SingleVisit` | deny | allow |
| `Professional` | any membership | deny | deny |
| any membership | `Professional` | deny | deny |

- Matrix применяется только когда effective periods пересекаются.
- `[A,B]` конфликтует с `[B,C]`, но совместим с `[C]`.
- `Professional` globally exclusive независимо от stored target set.

### Concurrency boundary

- В Domain/Application добавить одну pure policy для cardinality, set
  intersection, coverage, period overlap и entitlement selection.
- Все purchase/renew/correct/transfer/write-off/restore/backfill/archive paths
  вызывают одну policy; endpoint-specific copies запрещены.
- PostgreSQL join collection не позволяет надёжно выразить всю matrix одним
  exclusion constraint, особенно `Professional` wildcard. Поэтому transaction
  serialization является primary invariant, а DB unique/FK/check constraints —
  defense in depth.
- Зафиксировать один lock order для всех затронутых операций:
  1. branch/group rows в stable GUID order;
  2. client rows в stable GUID order;
  3. current membership/sale/attendance rows.
- После locks обязательно reload expected versions и повторная policy check.
- Attendance batch блокирует затронутых clients в stable order до resolver/
  write-off; purchase и attendance не могут выбрать entitlement конкурентно.
- Non-Npgsql provider path не выполняет PostgreSQL SQL; real concurrency
  barrier всё равно обязан работать на PostgreSQL.
- Constraint/serialization failures маппятся в stable ProblemDetails; raw
  `23P01`, duplicate-key или provider exception наружу не уходят.

### Entitlement resolver

- Добавить один backend service/policy entry point:
  `ResolveEntitlement(clientId, groupId, trainingDate)`.
- Resolver:
  1. исключает empty legacy, used/expired/closed versions;
  2. выбирает active `Professional` для любой group;
  3. иначе выбирает ordinary membership, target set которого содержит group;
  4. возвращает exact membership/sale identity, ordered target snapshot,
     coverage и backend warning/state.
- Если corrupted data даёт более одного match, resolver не выбирает first row:
  операция завершается invariant conflict и пишет diagnostic log.
- Attendance GET, POST, web и internal bot projections используют один result.
- Attendance request по-прежнему содержит client/state, group/date context, но
  никогда пользовательский membership id.
- При отсутствии entitlement factual attendance может быть сохранён с
  backend warning, как в текущем workflow; write-off/snapshot entitlement не
  создаются. `LegacyTargetMissing` не считается доступом.

## Membership lifecycle semantics

### Purchase

- Explicit target set обязателен и валидируется по actor-visible backend scope.
- Все targets одного филиала; branch-scoped catalog должен соответствовать
  target branch. `Professional` сохраняет существующий system catalog/zero-price
  contract и global coverage.
- Missing client-group rows/active assignments добавляются атомарно; другие
  assignments не удаляются и не сортируются.
- Sale, sale snapshot, current membership version, target rows, assignment,
  idempotency record и audit образуют одну transaction boundary.
- Purchase target branch не переписывает `Client.BranchId`; изменение primary
  client branch остаётся отдельной явной operation.
- Удалить client-wide `HasActiveMembershipAsync` guard; заменить matrix check.

### Renew

- Renew открывается из конкретной current membership card и адресует
  `saleId + expectedMembershipId`.
- UI наследует ordered set, backend требует его явную передачу.
- Period вычисляется от адресованной membership/sale, не от client-wide max.
- Renewal создаёт новую sale с новым immutable snapshot; source history не
  переписывается.

### Correction and legacy repair

- Correction закрывает current technical version и создаёт новую с новым
  ordered set/order, validity/payment corrections и existing sale identity.
- Type/price остаются immutable sale fields.
- Previous sale/refund/attendance snapshots не меняются.
- Empty legacy membership исправляется через эту же authorized operation.
- Used `SingleVisit` может получить corrected current target set; если позже
  отменяется связанное attendance, restore создаёт unused version из
  corrected current set после overlap preflight. При конфликте отмена целиком
  отклоняется.

### Membership target transfer

- Ввести отдельную membership operation `sourceGroupId -> targetGroupId` с
  preview и optimistic identities.
- Она заменяет source на target в той же Position во всех current technical
  versions, которые являются Active или Future и содержат source.
- Expired/used membership versions и event snapshots не меняются.
- Все affected sets preflight-валидируются до mutation. Duplicate/same-branch/
  overlap failure откатывает всю operation.
- `Professional` сохраняет global coverage; меняется только target/reporting
  set для новых событий.
- Target client-group assignment создаётся при отсутствии. Source assignment
  закрывается только если он больше не нужен ни одному active/future target и
  это соответствует явному group-transfer workflow; unrelated assignments
  сохраняются.
- Transfer не создаёт sale/refund, не меняет amount/payment/catalog и не
  переатрибутирует прошлые события.
- Текущий sale-producing client branch transfer разделить:
  - membership target transfer использует отдельный endpoint/command;
  - branch/group assignment transfer не продаёт membership;
  - если branch transfer затрагивает active/future targets без явного mapping,
    backend возвращает recovery conflict, а не закрывает/создаёт sale скрыто.

### SingleVisit write-off and restore

- Write-off вызывается resolver с `clientId + groupId + trainingDate`, а не
  через client-wide current membership.
- Attendance сохраняет exact sale/version identity и ordered target snapshot;
  one Present transition создаёт не более одного write-off.
- Repeated identical save идемпотентен.
- Restore адресует linked attendance/sale, проверяет current sale version и
  создаёт новую unused version из current corrected targets.
- Cancellation attendance + restore + audit коммитятся вместе либо не меняют
  ничего. Later same-group membership вызывает stable restore conflict, а не
  двойной entitlement.

### Refund, reports and audit

- Refund адресует sale; snapshot берётся из target set current version этой
  sale на момент refund. Position `0` — reporting group.
- Register/cancel refund получают idempotency key, блокируют sale/refund rows,
  повторно проверяют cumulative ceiling и коммитят refund, snapshot,
  idempotency record и audit в одной transaction.
- Cancel refund сохраняет original snapshot.
- FinancialReportService больше не использует все client group assignments для
  membership sale/refund attribution. Branch/group breakdown берёт единственный
  Position `0` event snapshot; trainer attribution разрешается через эту группу
  на event date.
- Canonical gross/refund/net totals и first-sale semantics не меняются.
- Audit показывает ordered before/after sets, actor, reason и event snapshot;
  failed atomic operations не пишут success audit.

### Group deactivation

- Existing `IsActive=false` update получает backend guard.
- Блокируют current technical versions, где target set содержит group и
  entitlement state Active или Future, включая reporting target Professional.
- Expired/used memberships и event snapshots не блокируют.
- Guard и update выполняются после locks и повторной проверки в одной
  transaction; race с purchase/transfer невозможна.
- UI показывает server-owned affected count/preview и recovery через
  correction/transfer, не вычисляет blockers локально.

## Data transition and database lifecycle

1. В Phase 0 зафиксировать evidence для target environments:
   - все БД recreatable;
   - либо конкретная predecessor DB должна сохраняться.
2. Всегда обновить reproducible initial database state, EF model snapshot,
   designers, seed/bootstrap data и clean PostgreSQL creation.
   Отдельно устранить текущий drift: `InitialCreate.cs` всё ещё содержит старый
   per-client current constraint/index, тогда как later fix migration/designer
   отражают per-sale version model. Final clean schema, designers и runtime
   migrations должны описывать один и тот же target-aware invariant.
3. По `backend/AGENTS.md` не создавать speculative incremental migration. Если
   сохранение predecessor DB подтверждено как обязательная часть TASK-115,
   создать deterministic forward transition от фактически deployed version;
   иначе environments пересоздать из final initial state.
4. Transition algorithm:
   - если predecessor действительно содержит one-group membership link,
     преобразовать его в singleton Position `0`;
   - иначе выбрать текущие active client group assignments;
   - если групп 1–5 и они одного филиала, использовать весь set;
   - deterministic legacy order: assignment `ValidFrom`, затем `CreatedAt`,
     затем `GroupId`;
   - при 0, >5 или cross-branch groups оставить empty target set;
   - применить выбранный set ко всем technical versions соответствующей sale
     и создать sale/refund backfill snapshots с явным `LegacyBackfill`
     provenance;
   - existing `ClientGroup` и `ClientGroupAssignment` rows не удалять, не
     закрывать и не перестраивать.
5. Historical attendance entitlement нельзя угадывать:
   - exact SingleVisit sale/version link можно backfill из известного set;
   - rows без exact membership identity сохраняют factual Attendance.GroupId и
     получают `LegacyUnresolved`/empty entitlement snapshot, а не случайный
     client membership.
6. Validate before/after counts, unique positions, same-branch sets, FK
   integrity, rerun safety, rollback on injected failure и fresh DbContext
   reload.
7. Dry-run report фиксирует: singleton, 2–5-group, empty reason buckets,
   backfilled event counts и неизменные assignment/canonical money counts.
8. Deterministic legacy order (`ValidFrom`, `CreatedAt`, `GroupId`) становится
   финансово значимым из-за Position `0`; human review плана обязан явно
   принять его до запуска transition на сохраняемой БД.

## UX contract and implementation-ready UI specification

Planning-stage `ux-researcher` и `ui-designer` handoffs выполнены 2026-08-21.
Device testing не выполнялось; все viewport/Safari checks остаются execution
work.

### Primary workflows

- Purchase: выбрать catalog/pricing, затем ordered target groups, validity,
  payment/comment, проверить confirmation с reporting group, submit.
- Renew: открыть конкретную membership card, увидеть source summary, получить
  inherited ordered set, при необходимости изменить set/order, submit.
- Correction: открыть конкретную card, изменить target set/order и разрешённые
  dates/payment; type/price показаны read-only.
- Transfer: выбрать source и target group, увидеть before/after preview всех
  active/future memberships, подтвердить no-sale operation.
- Attendance: выбрать group/date и отметить state; membership picker отсутствует,
  backend status/warning остаётся read-only.

### Components and controls

- Выделить focused membership components из большого
  `ClientManagement.tsx`, без нового global state.
- `MembershipTargetGroupsField` является единым ordered selector, а не пятью
  заранее раскрытыми или primary/secondary selects:
  - `fieldset` с legend `Группы абонемента`;
  - для `Term`/`Professional` decision copy:
    `Выберите от 1 до 5 групп одного филиала. Первая группа используется в финансовой разбивке.`;
  - для `SingleVisit`: `Разовое посещение действует только в выбранной группе.`;
  - для `Professional` дополнительно:
    `Доступ остаётся ко всем группам; выбранные группы нужны для отчётности.`;
  - Mantine `Select`/`Combobox` `Добавить группу` с placeholder
    `Найдите группу`, исключающий уже выбранные groups;
  - add control disabled при пяти groups с состоянием `Выбрано 5 групп`;
  - добавление всегда append в конец; submit отправляет displayed order без
    auto-sort.
- Selected target list содержит 1–5 rows/cards:
  - position badge `1..5`, group name/metadata и `Отчётность` на первой row;
  - visible `44x44px` actions `Вверх`, `Вниз`, `Удалить` с group-specific
    accessible names;
  - `Вверх` disabled на первой, `Вниз` на последней; remove сохраняет порядок
    остальных;
  - reorder выполняется по одной позиции; drag-only interaction запрещён;
  - `SingleVisit` показывает одну row без reorder actions;
  - `aria-live=polite` объявляет add/remove/new position;
  - после remove focus переходит к next/previous remove, а при empty — к add
    combobox.
- Keyboard order: description, add combobox, затем row actions по displayed
  order. Mantine combobox сохраняет typing/arrows/Enter/Escape; optional
  `Alt+ArrowUp/Down` допустим только вместе с visible/button-equivalent path.
- Field errors агрегируются из `targetGroupIds`, `targetGroups`,
  `targetGroupIds[0..4]` и PascalCase aliases. Count copy:
  `Выберите хотя бы одну группу` / `Можно выбрать не больше 5 групп`.
  Branch/scope/overlap остаются backend messages в Alert перед actions.
- Long names используют `min-width:0`/wrapping; action column не переносится.
  Полное имя остаётся доступно screen reader и через accessible disclosure/
  title, если visual label ограничен двумя строками.
- Options загружаются через backend-scoped/paged contract; запрещено молча
  ограничивать выбор первыми `take:100` или current client assignments.
- Current membership section показывает collection cards. Каждая card:
  name/type, state, до пяти ordered target chips/rows, reporting marker,
  Professional global badge, period/use state, amount/payment и visible
  primary/frequent actions.
- Legacy empty card показывает `Абонемент без групп`, объясняет отсутствие
  entitlement и даёт authorized action `Исправить группы`.
- History:
  - `<768px` — stacked version cards;
  - `768..1023px` — list/two-column cards only when content fits;
  - `>=1024px` — optional table with `Группы` column;
  - mobile не использует existing horizontal `min-width: 46rem` table.
- `MembershipGroupTransferSurface` является отдельной secondary operation:
  title, no-finance alert, source select, target select, async preview cards,
  cancel и primary `Перенести группу`. Pricing/payment/catalog controls
  отсутствуют.
- Confirmation purchase/renew/correction показывает exact final order до пяти
  groups (`1 Отчётность`, `2..5`). Transfer preview показывает ordered
  `Было`/`Станет` с replacement в той же position. History хранит/показывает
  immutable ordered snapshots до пяти groups.
- Group deactivate error surface показывает backend blockers и recovery.
- Attendance row не получает selector/callback membership. Local fallback,
  который выводит eligibility из singular membership/Professional flag,
  удаляется; отображается backend-owned state/warning.

### Operational states and interaction

- Loading группы/catalog/preview отличается от empty; submit disabled.
- Empty group scope: `Нет доступных групп для этого филиала` и recovery, если
  разрешён.
- Array field errors агрегируются в соответствующий visible select; global
  overlap/stale/permission conflict отображается в Alert перед actions.
- Draft, ordered set и pricing/date values сохраняются после recoverable
  errors.
- Stale action предлагает `Обновить`, затем повторное открытие из актуальной
  card.
- `canManage=false`: write actions отсутствуют, а не показаны fake-disabled.
- Opening inline panel focuses heading (`tabIndex=-1`); validation focuses first
  invalid field либо global alert; close/success возвращает focus к trigger или
  updated card heading.
- Escape/back закрывает temporary surface только вне pending submit.
- Duplicate submit заблокирован; success names exact operation and target set.

### Responsive acceptance

- `360x780`, `390x844`, `420x912`, `440x956`: single-column forms/cards,
  `44x44px` minimum targets, `8px` separation, inputs/selects `>=16px`, no
  horizontal page/history scroll.
- `390x844` is stress baseline; primary five-group purchase, renew, correction
  and transfer preview must complete without hidden action.
- На `390x844` add combobox занимает полную ширину, каждая selected row
  использует grid `minmax(0, 1fr) 44px 44px 44px`; reorder/remove actions не
  скрываются в overflow.
- `420x912` and `440x956` preserve the same hierarchy; long names wrap or have
  accessible full value, confirmation wraps up to five chips без horizontal
  scroll, no summary widgets appear just from extra width.
- `768x1024`: date/payment fields may use two columns; target selector keeps
  ordered vertical semantics.
- `1440x1200`: history may become table, but target set/order and actions stay
  equivalent; no duplicate hero/helper copy.
- `912x420` and `956x440`: temporary transfer/confirmation surfaces use
  dynamic viewport height, one scrollable body, sticky in-surface footer,
  visible close, no nested scroll trap. Selected rows may use `8px` vertical
  padding but keep `44x44px` actions; focus/error scrolls above sticky footer.
- Sticky footer combines normal spacing with `env(safe-area-inset-bottom)`;
  focused field/error/primary action remain reachable with software keyboard
  within one intentional scroll. Do not claim physical Safari acceptance from
  desktop viewport geometry alone.

## Safe decomposition and review checkpoints

TASK-115 remains one coordinated release because every consumer must switch to
the canonical contract together. Work is divided into bounded red/green
checkpoints; each checkpoint must pass review before the next functional slice.

### Checkpoint A — contract, policy and additive persistence

- Raw JSON request/response/ProblemDetails tests.
- Pure target/cardinality/overlap/resolver unit matrix.
- Target/version/event snapshot schema and model tests.
- Barrier: order/cardinality + exhaustive matrix + PostgreSQL concurrent write.

### Checkpoint B — transition and legacy state

- Deterministic transition fixtures.
- Clean initial state plus selected lifecycle path.
- Empty legacy read/correction/attendance isolation.
- Barrier: counts/FKs/order/rerun, unchanged assignments and money.

### Checkpoint C — membership lifecycle, transfer, archive and finance

- Purchase/renew/correct/refund/transfer/deactivate API contract tests.
- Atomic target-aware operations and immutable event snapshots.
- Barrier: raw HTTP -> transaction -> fresh DbContext -> audit/report evidence.

### Checkpoint D — attendance entitlement

- Resolver and attendance API contract tests.
- Exact snapshot, one write-off/restore, warning-only no-entitlement path.
- Barrier: concurrent attendance/purchase and atomic restore conflict.

### Checkpoint E — frontend and bot consumers

- Type/mapper/component/Playwright and Pydantic/service contract tests.
- Reviewed mobile forms/cards/transfer and thin bot rendering.
- Barrier: no singular executable selection, no attendance picker, target
  iPhone WebKit workflows and bot contract tests.

No backend-only breaking contract may be deployed while frontend/bot consume
the old shape. Checkpoint commits may remain separate in the TASK branch, but
merge/deploy is one synchronized release.

## Likely files and layers
- Backend membership target/domain policy, lifecycle services, EF schema/migrations, API projections and tests.
- Attendance entitlement, reports/audit and internal-bot contract consumers.
- Frontend membership API/forms/cards/transfer flows and responsive tests.
- Python bot models/rendering/tests plus synchronized runtime/release configuration.

## Constraints

- Backend is the only source of membership, target, overlap, entitlement,
  permission, validation, audit and reporting rules.
- Ordered target set is not client group assignment and must not reuse a
  serializer that sorts ids.
- New writes never persist empty targets; empty is legacy-only and ineligible.
- No attendance membership selector or caller-provided entitlement id.
- No hidden sale/payment/price mutation during group transfer.
- No double SingleVisit write-off/restore and no partial attendance cancel.
- No duplicate canonical money across group breakdowns.
- Historical event snapshots are immutable under correction/transfer.
- Idempotency and audit stay inside mutation transaction.
- Mantine, Onest, existing design tokens and shared patterns remain.

## Out of scope

- Price changes based on group count, discounts or external payment processing.
- Multiple groups for `SingleVisit`.
- Limiting actual `Professional` coverage to stored target groups.
- General membership catalog redesign or per-group catalog ownership.
- Arbitrary user priority/choice among overlapping entitlements.
- Automatic deletion/reordering of existing client group assignments.
- Schedule, hall capacity/conflict or membership freeze semantics.
- General RBAC/client branch redesign beyond target validation and safe transfer
  boundary required by TASK-115.
- Reconstructing unknown historical attendance entitlement by heuristic.

## Regression specification

### Unit tests — written before functional code

- Ordered set duplicate/cardinality/same-branch validation and preserved order.
- Complete overlap matrix, inclusive boundaries and future/non-overlap cases.
- `Professional` global coverage vs reporting Position `0`.
- Resolver uniqueness and legacy/no-entitlement states.
- Addressed renew period calculation and correction/transfer set transforms.
- `[A,B] A->C`, duplicate `[A,C] A->C` and cross-branch transfer failure.
- SingleVisit write-off/restore transition policy.
- One-event/one-reporting-group financial attribution.
- Stable error mapping and idempotency payload order.

### Integration/PostgreSQL — written before functional code

- Purchase/renew/correction accept valid 1–5 group arrays and preserve order
  after fresh DbContext/API reload.
- Sixth group and Position `5` are rejected with stable validation and no
  partial persistence/audit.
- `[A,B]` vs `[B,C]`, `[C]`, every Professional direction and same-day range.
- Concurrent purchase/correction/transfer/archive/attendance yield one valid
  result and stable conflict, never raw DB exception.
- Concurrent refund requests cannot jointly exceed gross amount; retries and
  cancel are idempotent and audit failure rolls back refund plus snapshot.
- Auto-add assignments is atomic/idempotent and preserves all unrelated rows.
- Transfer affects active/future only and preserves historical snapshots.
- Refund after transfer uses operation-time set; cancel keeps snapshot.
- Archive blocks active/future target, ignores expired/used/history.
- SingleVisit exact write-off/restore, repeat, later-overlap conflict and
  transaction rollback.
- Mark-with-warning no-entitlement/legacy path creates no write-off entitlement.
- Migration/transition cases, counts/FKs/rerun/failure rollback.
- Raw JSON collection/order, ProblemDetails and conflict redaction.
- Canonical finance totals unchanged; group breakdown only Position `0`.

### Frontend/UI/e2e — written before React code

- Exact ordered request bodies and collection mapping without singular
  fallbacks.
- Purchase one/five groups; sixth-group rejection; SingleVisit one; renewal
  inheritance/reorder across all five positions;
- Ordered selector append/remove/up/down preserves displayed order, max-five
  disabled state, focus recovery, `aria-live` announcements and `44x44px`
  touch actions without drag-only dependency.
  correction including Professional/legacy recovery.
- Conflict/stale/permission errors preserve draft and focus recovery.
- Multiple cards/list/attention stable identity and no arbitrary first row.
- Transfer before/after preview contains no finance controls.
- History cards show immutable snapshot without horizontal page scroll.
- Attendance has no membership picker and renders backend status/retry.
- Group deactivate blocker and recovery.
- Long names, touch targets, focus return and mandatory viewports/WebKit.

### Bot — written before Python consumer code

- Parse/render ordered targets and multiple membership identities.
- Distinguish targets from client group assignments.
- Professional global/reporting wording and legacy warning are backend-driven.
- Multiple expiring memberships of one client remain distinct.
- No attendance membership-selection callbacks; save keeps group/date/client
  and idempotency only.

### Manual-only evidence

- Actual Safari dynamic chrome, native select/date behavior, software keyboard,
  safe area, home indicator and one-handed reach require Simulator/physical
  device evidence.
- Human review of transition dry-run and financial attribution diff is required
  before modifying a preserved DB.

### Validation and acceptance

- [x] Record human approval, DB lifecycle evidence, runtime and baseline
  results.
- [x] Run affected Playwright specs and `npm run test:e2e:iphone`.
- [x] Recreate isolated clean PostgreSQL/runtime stack; predecessor DB upgrade
  is not required for the confirmed recreatable lifecycle.
- [x] Search executable code/tests for singular current-membership selection,
  client-wide overlap, targetless write and transfer-created sale.
- [x] Record target-device evidence and all residual physical Safari checks.

## Regression barriers

### Barrier A — target/order/matrix/concurrency

Pure exhaustive policy tests plus real PostgreSQL competing writes prove
cardinality, order, intersecting/disjoint sets and Professional global exclusion
without provider exceptions or ambiguous entitlement.

### Barrier B — transition and legacy

Clean schema plus deterministic representative transition proves singleton/
2–5-group/empty buckets, immutable backfill, unchanged assignments/canonical
money, FK/count integrity and fresh reload.

### Barrier C — lifecycle, events and finance

Raw HTTP -> transaction -> fresh DbContext -> audit/report tests prove purchase,
renew, correction, transfer, refund and archive atomicity, immutable snapshots
and exactly one reporting attribution per financial event.

### Barrier D — attendance

Group/date resolver -> exact sale/version -> Present -> snapshot/write-off ->
cancel -> restore proves no user choice, one write-off/restore, warning-only
no-entitlement behavior and full rollback on restore conflict/race.

### Barrier E — consumers/mobile

Type/mapper/component/Playwright and internal bot/Python suites prove canonical
collections, ordered targets, recoverable forms, no transfer finance fields, no
attendance selector and required target-iPhone WebKit behavior.

TASK-115 cannot complete on InMemory-only backend tests, mocked UI-only tests or
manual QA. All five barriers and full required suites must pass.

## Completion notes

- Completed at: 2026-08-23; rebased implementation candidate: `2715554`.
- The user invocation provided explicit high-risk execution approval. Preflight
  confirmed no task dependency and a recreatable database lifecycle, so the
  approved schema path was a fresh initial-state migration rather than an
  upgrade of a preserved predecessor database.
- Barriers A–D passed through the full `452/452` backend suite plus the focused
  seven-test PostgreSQL concurrency barrier. A clean PostgreSQL volume applied
  the initial schema, exposed the target/snapshot tables and target indexes,
  omitted the old client-wide exclusion, and reported healthy readiness.
- Barrier E passed frontend lint, typecheck, raw-color, build, `545/545` unit
  tests, Chromium `15/15`, target-iPhone WebKit `44/44`, and bot locked sync,
  Ruff, mypy and `61/61` tests.
- Backend format, warnings-as-errors build and transitive vulnerability audit
  passed. Source scans found no production singular current-membership field,
  client-wide overlap constraint or transfer-created sale path; compatibility
  normalization remains test-only.
- Physical Safari dynamic chrome, native controls, software keyboard and real
  safe-area insets remain manual-only residual evidence and are not claimed as
  tested.

## Risks

- Join-based target sets plus global `Professional` cannot be fully guarded by
  one exclusion constraint; any mutation path that skips common locks/policy
  can admit invalid overlap.
- Restore after a later same-group sale must reject the whole attendance cancel;
  weakening this produces either lost restore or two active entitlements.
- Singular assumptions exist in list filters, attention keys, action hints,
  reports, attendance and bot; one missed fallback can silently pick wrong data.
- Current transfer couples branch/group assignments and finance; partial
  refactoring may leave a hidden sale path.
- Event snapshot backfill can invent history if it heuristically selects a
  membership for old attendance; unresolved history must stay explicit.
- Current report attribution by assignments may change historical breakdowns;
  canonical totals must be diffed separately from intended attribution changes.
- Backend/frontend/bot partial rollout is breaking.

## Stop conditions

Stop and do not write/continue functional code if:

- human review/explicit high-risk execution approval is absent;
- task/plan is absent from execution base;
- target DB lifecycle is unknown or transition would require uncontrolled data
  cleanup;
- common lock order cannot cover every membership/attendance/archive mutation;
- API cannot expose one canonical collection without an unidentified external
  consumer break;
- transfer cannot be separated from hidden sale/payment mutation;
- resolver can return more than one entitlement after policy/constraints;
- financial canonical totals change unexpectedly;
- required target scope implies a global RBAC/security redesign;
- a material frontend constraint conflicts with the reviewed UX/UI contract;
- scope expands into pricing, payments, schedule, freeze or unrelated client/
  catalog redesign.

Do not stop only because backend, frontend and bot change together; coordinated
cross-layer work is expected. Stop only for an unresolved invariant, unsafe
rollout/data path or scope expansion.
