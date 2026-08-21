# Implementation Plan: TASK-115 Адресность и одновременное действие абонементов

## Source task
/backlog/risky/TASK-115-membership-target-and-overlap-model.md

## Planning status

- Этот документ полностью заменяет superseded one-group plan от 2026-08-19.
- План описывает подтверждённую ordered multi-group модель от 2026-08-21.
- Clarification от 2026-08-21 16:38 MSK увеличивает верхнюю границу для
  `Term`/`Professional` с двух до пяти target groups; `SingleVisit` остаётся
  одногрупповым.
- TASK-115 остаётся в `/backlog/risky`: план разрешён risky planning policy, но
  не является разрешением на автоматическую реализацию.
- До первого изменения project code обязателен human review этого документа и
  явное разрешение пользователя на выполнение high-risk TASK-115.
- На planning snapshot локальный `main` = `3458a1f`, `origin/main` = `48a57d7`;
  implementation branch нельзя создавать, пока карточка и утверждённый план не
  окажутся в актуальном `origin/main` либо пользователь не утвердит другой base.

## Implementation branch
feature/TASK-115-membership-target-and-overlap-model

Branch rules:

- перед созданием branch прочитать и выполнить
  `.agents/skills/task-worktree/SKILL.md`;
- создать отдельный worktree непосредственно от актуального `origin/main`;
- primary repository оставить на `main`; project code, tests, schema и runtime
  менять только в TASK-115 worktree;
- проверить git root, branch, clean status, worktree registration и
  `git merge-base --is-ancestor origin/main HEAD`;
- поднять отдельный Docker Compose project для PostgreSQL/runtime проверок;
- не добавлять unrelated fixes или refactoring;
- все specialist agents работают только в делегированном worktree, не создают
  и не удаляют worktree и не откатывают изменения других исполнителей;
- из-за coordinated breaking contract задача использует одну branch и
  последовательные review checkpoints. Если human review потребует независимые
  child TASKs, сначала создать их карточки, branches и dependency order, затем
  обновить этот план; не создавать несколько неучтённых branches под одним TASK.

## Goal

Администратор или главный тренер оформляет, продлевает, исправляет и переносит
абонемент с явным упорядоченным набором групп. `Term` и `Professional` имеют
от одной до пяти target groups одного филиала, `SingleVisit` — ровно одну.
Параллельные обычные абонементы разрешены только для непересекающихся sets,
`Professional` глобально исключает любой другой entitlement. Attendance без
пользовательского выбора однозначно разрешает entitlement по клиенту, группе и
дате; финансовые и attendance события сохраняют immutable ordered snapshots.

## Current understanding

- `ClientMembership` — versioned entity с одним current technical row на sale,
  но не содержит group target collection.
- `ClientMembershipService` и read projections выбирают один client-wide
  current membership. Purchase дополнительно блокируется client-wide active
  membership, renew адресует client-wide current/latest period.
- PostgreSQL exclusion constraint запрещает пересекающиеся current
  `Term`/`Professional` periods по `ClientId`, независимо от групп, и не
  моделирует `SingleVisit`.
- Attendance хранит factual `GroupId`/`TrainingDate`; для `SingleVisit` также
  хранит sale/write-off version identity. Save transaction может отметить
  посещение без entitlement и вернуть backend warning; этот operational
  mark-with-warning behavior не меняется без отдельного продуктового решения.
- Текущий client branch transfer объединяет смену филиала/группы с новой
  продажей (кроме unused `SingleVisit`). Это несовместимо с подтверждённым
  no-sale target transfer и должно быть разделено.
- Financial report атрибутирует sale/refund по client branch/group assignments
  на дату события и может размножить одно событие по нескольким группам.
- Group archive является `TrainingGroup.IsActive = false`; membership guard
  отсутствует.
- Refund register/cancel сейчас не проходят через общую membership idempotency
  boundary и не защищают concurrent refund ceiling одной явной transaction;
  это необходимо исправить вместе с immutable refund snapshot.
- Frontend и bot используют singular `currentMembership`; формы не передают
  target groups, history не показывает event snapshot, attendance UI правильно
  не отправляет membership id.
- В текущем schema нет deployed one-group membership FK. Поэтому singleton
  migration является compatibility case только для реально обнаруженного
  predecessor schema; основной current-baseline backfill использует правила
  TASK-115 для current client groups.

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

- Raw JSON request/response/ProblemDetails red tests.
- Pure target/cardinality/overlap/resolver unit matrix red tests.
- Target/version/event snapshot schema and model tests.
- Barrier: order/cardinality + exhaustive matrix + PostgreSQL concurrent write.

### Checkpoint B — transition and legacy state

- Deterministic transition fixtures before transition code.
- Clean initial state plus selected lifecycle path.
- Empty legacy read/correction/attendance isolation.
- Barrier: counts/FKs/order/rerun, unchanged assignments and money.

### Checkpoint C — membership lifecycle, transfer, archive and finance

- Purchase/renew/correct/refund/transfer/deactivate API red tests before service
  changes.
- Atomic target-aware operations and immutable event snapshots.
- Barrier: raw HTTP -> transaction -> fresh DbContext -> audit/report evidence.

### Checkpoint D — attendance entitlement

- Resolver and attendance API red tests before write-off/restore code.
- Exact snapshot, one write-off/restore, warning-only no-entitlement path.
- Barrier: concurrent attendance/purchase and atomic restore conflict.

### Checkpoint E — frontend and bot consumers

- Type/mapper/component/Playwright and Pydantic/service red tests before
  consumer implementation.
- Reviewed mobile forms/cards/transfer and thin bot rendering.
- Barrier: no singular executable selection, no attendance picker, target
  iPhone WebKit workflows and bot contract tests.

No backend-only breaking contract may be deployed while frontend/bot consume
the old shape. Checkpoint commits may remain separate in the TASK branch, but
merge/deploy is one synchronized release.

## Execution roles

1. Coordinator: risky approval, worktree/branch, dependency sequence, DB
   lifecycle, contract integration, runtime stack and final acceptance.
2. `ux-researcher`: planning contract complete; re-engage only if implementation
   discovers a material workflow conflict.
3. `ui-designer`: planning handoff complete; resolves any conflict before React
   implementation changes the approved interaction.
4. `test-automator`: writes/updates unit, raw API, PostgreSQL, frontend,
   Playwright and bot regressions before production code and records expected
   red evidence.
5. `dotnet-backend-specialist`: domain/application/API/persistence/attendance/
   report implementation after backend red tests. Before creating or
   substantially restructuring xUnit tests, read
   `.agents/skills/csharp-xunit/SKILL.md`.
6. `react-specialist`: React/Mantine implementation after frontend red tests;
   read `.agents/skills/react-best-practices/SKILL.md` and preserve approved UX.
7. `python-pro`: thin bot contract/renderer update; no CRM policy duplication.

## Execution steps

### Phase 0 — review and isolated baseline

1. Human-review this plan; explicitly approve high-risk execution and DB
   lifecycle path.
2. Integrate planning changes into current `origin/main`.
3. Read root/backend/frontend/bot AGENTS, task-worktree, crm-mobile-first-ui and
   applicable implementation/testing skills.
4. Create/verify dedicated branch, worktree and Docker Compose project.
5. Inventory singular current membership, old overlap, transfer sale path,
   report attribution, group deactivation and all bot/frontend consumers.
6. Record baseline backend/frontend/bot suites and current DB schema/version.

### Phase 1 — tests first, expected red

7. Freeze raw JSON canonical requests/responses and stable ProblemDetails in
   integration tests.
8. Add pure unit tests for ordered set/cardinality, full overlap matrix,
   inclusive boundaries, Professional global coverage, legacy empty state and
   resolver uniqueness.
9. Add PostgreSQL model/concurrency tests for target uniqueness/order, shared
   lock order, competing purchase/correction/transfer/restore/archive and fresh
   reload.
10. Add transition fixtures for prior singleton, 2–5 same-branch groups, zero,
    >5, cross-branch, all event snapshots and preserved assignments.
11. Add lifecycle/report/audit tests for purchase, renew, correction, transfer,
    refund/cancel, deactivation and canonical money.
12. Add attendance resolver/write-off/restore/warning tests.
13. Add frontend contract/component/e2e tests and bot models/service tests for
    the new canonical contract.
14. Run each new suite against baseline and record expected behavioral failing
    assertions. Compilation errors, missing fixtures, Docker failure or
    unrelated baseline failures are not valid red evidence. Minimal compile
    scaffolding may define new types only; it must not implement successful
    behavior.

### Phase 2 — domain, persistence and transition

15. Implement focused target, snapshot, overlap and entitlement policy types.
16. Add EF entities/configurations/DbSets and provider-safe locking service.
17. Update initial schema, designers/snapshot/seed and only the approved
    database lifecycle path.
18. Implement deterministic transition/legacy provenance; run the exact
    transition tests red -> green before membership mutation code.

### Phase 3 — backend lifecycle and projections

19. Replace client-wide purchase/renew/current selection with addressed
    collection and shared matrix policy.
20. Implement atomic purchase auto-assignment, renew, correction/legacy repair,
    membership target transfer and branch-transfer separation.
21. Implement refund/sale snapshots, report attribution and group deactivation
    guard.
22. Implement resolver-driven attendance, exact write-off/restore and event
    snapshot inside the existing owned transaction.
23. Update client list/detail/attention, attendance, audit, internal bot and
    ProblemDetails projections; remove singular runtime fallbacks.
24. Run all backend focused tests green, then relevant regression suite, before
    consumer production code.

### Phase 4 — frontend and bot

25. Update TypeScript API types/mappers/writes/errors to the canonical ordered
    collection and backend-owned aggregate states.
26. Implement reviewed current cards, target field, purchase/renew/correction,
    separate transfer surface, mobile history and group archive recovery.
27. Keep attendance selection unchanged; show resolver status/warnings only.
28. Update list/preview/home attention stable identities and remove arbitrary
    first-membership presentation.
29. Update Python bot models/rendering for collections/targets; preserve
    backend order and absence of attendance membership callbacks.
30. Run the exact frontend/bot red tests green without weakening assertions.

### Phase 5 — regression and runtime acceptance

31. Run full required backend/frontend/bot commands.
32. Recreate isolated PostgreSQL stack from final initial state and smoke the
    synchronized API/frontend/bot contract.
33. If a forward transition was approved, upgrade a representative predecessor
    DB and compare dry-run counts/report totals before and after.
34. Execute vertical flow: purchase `[A,B]` -> disjoint `[C]` -> conflict
    `[B,C]` -> renew/reorder -> correct -> attendance write-off/restore ->
    transfer -> refund/report -> archive block/recovery.
35. Run mobile acceptance at all required viewports and target iPhone WebKit;
    include failure recovery, stale and permission-restricted paths.
36. Report actual commands/results and every Safari/Simulator/physical-device/
    keyboard/chrome/safe-area check not performed.

## Files likely to change

Backend domain/application:

- `backend/src/GymCrm.Domain/Clients/ClientMembership.cs`
- `backend/src/GymCrm.Domain/Clients/ClientMembershipSale.cs`
- `backend/src/GymCrm.Domain/Clients/ClientMembershipRefund.cs`
- `backend/src/GymCrm.Domain/Attendance/Attendance.cs`
- new focused target/snapshot entity files, one top-level type per file
- `backend/src/GymCrm.Application/Clients/IClientMembershipService.cs`
- `backend/src/GymCrm.Application/Clients/ClientMembershipSemantics.cs`
- new focused overlap/entitlement contracts and policy files
- `backend/src/GymCrm.Application/Attendance/IAttendanceService.cs`
- `backend/src/GymCrm.Application/Bot/BotApiContracts.cs`
- `backend/src/GymCrm.Application/Reports/FinancialReportContracts.cs`

Backend infrastructure/persistence:

- `backend/src/GymCrm.Infrastructure/Clients/ClientMembershipService.cs`
- new membership lock/target repository services
- `backend/src/GymCrm.Infrastructure/Attendance/AttendanceService.cs`
- `backend/src/GymCrm.Infrastructure/Reports/FinancialReportService.cs`
- `backend/src/GymCrm.Infrastructure/Bot/BotApiService.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/GymCrmDbContext.cs`
- existing/new focused EF configurations for membership/target/snapshots/
  attendance/sale/refund
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.cs`
- matching designer(s) and `GymCrmDbContextModelSnapshot.cs`
- deterministic forward migration only if approved by Phase 0 evidence
- seed/bootstrap data

Backend API:

- `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs`
- `PurchaseClientMembershipRequest.cs`
- `RenewClientMembershipRequest.cs`
- `CorrectClientMembershipRequest.cs`
- `TransferClientBranchRequest.cs` and/or new focused membership target transfer
  request
- `ClientMembershipResponse.cs`
- `CurrentMembershipSummaryResponse.cs` replacement
- client list/detail/attention response contracts
- `AttendanceEndpoints.cs`, `AttendanceClientResponse.cs`
- `GroupEndpoints.cs`
- membership/sale/refund/attendance/group audit states
- client/attendance/group resource `.resx` files

Backend tests:

- new focused `MembershipTargetPolicyTests.cs`
- new focused raw API `ClientMembershipTargetApiTests.cs`
- new PostgreSQL `ClientMembershipTargetPostgreSqlTests.cs`
- new transition `ClientMembershipTargetDataTransitionTests.cs`
- new attendance entitlement tests
- `ClientMembershipPersistenceModelTests.cs`
- `ClientMembershipWriteRegressionApiTests.cs`
- `ClientsApiTests.cs`
- `AttendanceApiTests.cs`
- `MembershipTransferCatalogTests.cs`
- `FinancialReportsApiTests.cs`
- `GroupsApiTests.cs`
- `InternalBotApiTests.cs`
- affected fixture/seeder/bootstrap tests

Frontend:

- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/mappers.ts`
- `frontend/src/lib/api/clients.ts`
- `frontend/src/lib/api/attendance.ts`
- `frontend/src/lib/api/errors.ts`
- their focused unit tests
- `frontend/src/features/clients/ClientManagement.tsx`
- new local membership components under `features/clients/membership/`
- `ClientManagement.form.ts` and tests
- client list/preview view models and tests
- `frontend/src/features/home/MembershipsPanel.tsx`
- attendance row/screen files and tests
- `frontend/src/features/groups/GroupManagement.tsx` and tests
- finance report component tests
- `frontend/src/App.css`
- `frontend/e2e/membership-sale-pricing.spec.ts` or new focused
  `membership-target-overlap.spec.ts`
- `frontend/e2e/attendance.spec.ts`
- `frontend/e2e/groups-registry.spec.ts`
- `frontend/e2e/iphone-target-devices.spec.ts`

Bot:

- `bot/src/gym_crm_bot/crm/models.py`
- `bot/src/gym_crm_bot/core/service.py`
- `bot/tests/test_crm_client.py`
- `bot/tests/test_bot_service.py`
- `bot/tests/test_callbacks_and_menu.py`

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
- No production code changes outside the declared worktree/branch.

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

## Required test coverage

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

## Test plan

- [ ] Record human approval, DB lifecycle evidence, branch/worktree/runtime and
  baseline results.
- [ ] Add/run focused backend unit/API tests and capture expected behavioral red.
- [ ] Add/run real PostgreSQL concurrency/transition tests and capture red.
- [ ] Add/run frontend API/component/Playwright tests and capture red.
- [ ] Add/run bot Pydantic/service tests and capture red.
- [ ] Implement each checkpoint only after its red evidence.
- [ ] Rerun the identical focused tests green without weakening assertions.
- [ ] Run `dotnet test backend/GymCrm.slnx`.
- [ ] From `frontend/`: `npm run lint`, `npm run build`, `npm run test:unit`.
- [ ] Run affected Playwright specs and `npm run test:e2e:iphone`.
- [ ] From `bot/`: `ruff check .` and `pytest`.
- [ ] Recreate isolated clean PostgreSQL/runtime stack; when approved, upgrade a
  representative predecessor DB.
- [ ] Search executable code/tests for singular current-membership selection,
  client-wide overlap, targetless write and transfer-created sale.
- [ ] Record target-device evidence and all residual physical Safari checks.

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
- Local planning baseline is ahead of `origin/main`; creating worktree too early
  can omit the clarified contract/plan.

## Stop conditions

Stop and do not write/continue functional code if:

- human review/explicit high-risk execution approval is absent;
- task/plan is absent from execution base;
- branch/worktree/base, dirty changes or Docker project ownership is ambiguous;
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

## Ready for Codex execution
no

Reason: TASK-115 is high-risk and `Safe for Codex: no`. The multi-group
architecture, test-first checkpoints, UX/UI handoff and regression barriers are
prepared, but implementation requires human review, explicit execution
approval, planning changes integrated into `origin/main` and a verified target
database lifecycle.
