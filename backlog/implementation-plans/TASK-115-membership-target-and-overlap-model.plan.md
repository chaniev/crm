# Implementation Plan: TASK-115 Адресность и одновременное действие абонементов

## Source task
/backlog/risky/TASK-115-membership-target-and-overlap-model.md

> **Superseded 2026-08-21 — do not execute.** Multi-group clarification
> завершён, TASK-115 возвращена в `/backlog/risky`, но этот документ описывает
> прежнюю one-group модель. Он сохраняется только для traceability и должен
> быть полностью заменён новым multi-group implementation plan.

TASK-115 не готова к human implementation review или изменению
code/schema/runtime. Ни один контракт, этап, файл или acceptance barrier ниже
не является актуальным execution instruction до публикации нового плана.

## Implementation branch
feature/TASK-115-membership-target-and-overlap-model

Branch rules:
- перед первым изменением кода прочитать и выполнить
  .agents/skills/task-worktree/SKILL.md;
- создать или безопасно возобновить отдельный worktree, например
  ../crm-worktrees/TASK-115-membership-target-and-overlap-model;
- создавать branch непосредственно от актуального origin/main после fetch;
- primary repository оставить на main; код, tests, schema и runtime changes
  выполнять только в TASK-115 worktree;
- проверить git root, branch, clean status, worktree registration и
  git merge-base --is-ancestor origin/main HEAD;
- не смешивать TASK-115 с TASK-074, TASK-103, TASK-114, TASK-117, TASK-118,
  общим redesign карточки клиента или изменением membership catalog pricing.

Planning baseline 2026-08-19 22:50 MSK:
- primary repository: main, HEAD 781aa86ed9a53b872716021413a6355c31c75ab3;
- local origin/main: 921e17340922ebdab701d76fa671387e57577115;
- main ahead of origin/main by seven commits, включая уточнения TASK-115;
- TASK-115 branch/worktree не найдены.

Исполнитель обязан повторить проверку после fetch. Нельзя создавать
implementation branch, пока карточка и этот план не попали в актуальный
origin/main либо пока пользователь явно не утвердил другой base. Planning
snapshot не является гарантированным execution base.

## Goal
Администратор или главный тренер оформляет, продлевает, исправляет и переносит
абонементы с обязательной группой. Одновременно могут действовать несколько
обычных абонементов разных групп, но не пересекающиеся абонементы одной группы
и не Professional вместе с любым другим entitlement. Тренер отмечает
посещение без выбора абонемента: backend однозначно разрешает entitlement по
группе и дате, списывает или восстанавливает нужный SingleVisit ровно один раз.

## Current understanding
- ClientMembership сейчас не хранит группу; purchase, renew и correction
  requests также не содержат target group.
- ClientMembership — versioned row: один текущий technical version на sale
  защищён partial unique index по SaleId при ValidTo IS NULL.
- PostgreSQL exclusion constraint запрещает пересекающиеся Term/Professional
  по ClientId независимо от группы и не моделирует SingleVisit.
- ClientMembershipService и все read consumers выбирают один
  CurrentMembership, хотя после TASK-115 текущих technical versions и
  действующих entitlements может быть несколько.
- Purchase дополнительно блокируется глобальным HasActiveMembershipAsync;
  renew вычисляет период от client-wide latest end; correction адресует
  saleId + expectedMembershipId, но не меняет target.
- Attendance читает один current membership и при Present пытается списать
  один client-wide SingleVisit. Отметка attendance и audit уже транзакционны,
  а attendance row хранит sale/version write-off identity для restore.
- Existing client transfer закрывает текущий membership или создаёт новую
  sale; это не соответствует решению переносить действующие и будущие
  memberships старой группы без новой продажи.
- Group archive как отдельная сущность отсутствует: operational equivalent —
  перевод TrainingGroup.IsActive в false через group update.
- FinancialReportService атрибутирует sale/refund через client group
  assignments на дату события. При нескольких группах один financial event
  может попасть в несколько group breakdown rows; target-aware event
  attribution должна стать явной.
- Frontend client details, list preview, forms и bot contract используют
  singular currentMembership. Purchase/renew/correction UI не содержит группу.
- Membership history на mobile отображается через desktop-like table wrapper;
  несколько target-aware memberships потребуют task-oriented cards.
- Product decisions из TASK-115 определяют основную matrix, transfer,
  backfill, archive, legacy и refund semantics, но execution gates ниже
  фиксируют найденные boundary cases, которые нельзя безопасно угадать.

## Approval gates before executable work
До изменения schema или production code явно подтвердить:

1. SingleVisit restore after a later sale.
   Если SingleVisit был списан, затем для той же группы продан пересекающийся
   Term/SingleVisit, последующая отмена attendance должна восстановить старый
   SingleVisit, но это нарушит overlap matrix. Нужно выбрать одно правило:
   блокировать последующую продажу, ограничить restore или определить иной
   effective period. План не назначает финансово-аудиторскую семантику сам.
2. Attendance without eligible entitlement.
   Уточнить, запрещает ли отсутствие подходящего entitlement сам Present write
   или сохраняется текущая mark-with-warning модель. В любом варианте legacy
   membership без target не считается entitlement и не списывается.
3. Cross-branch target.
   Уточнить, может ли ordinary membership выбирать группу не из primary
   Client.BranchId, и меняет ли auto-add primary branch. Для Professional
   отдельно подтвердить scope reporting target и role-based group visibility.
4. Transfer API boundary.
   Утвердить dedicated membership-target transfer либо изменение существующего
   client branch transfer; pricing/payment fields не должны создавать
   скрытую sale во время простого переноса target.
5. Correction and historical finance.
   Уточнить, исправляет ли ошибочный target только новые events после
   correction либо также переатрибутирует исходную sale. Transfer точно не
   переписывает прошлые attendance/report events.
6. Refund attribution.
   Подтвердить, что refund сохраняет immutable group snapshot, выбранный из
   актуального target sale на момент refund operation, и UI показывает его
   перед подтверждением.

Эти gates не мешают review плана, созданию red contract tests и подготовке
fixtures. Они блокируют functional/schema implementation.

## Proposed backend contract

### Target and coverage
- Каждый новый current ClientMembership version имеет required targetGroupId.
- Storage остаётся nullable только для явно разрешённых legacy rows без групп.
- Response содержит typed target:
  - groupId;
  - groupName;
  - branchId;
  - branchName;
  - groupIsActive.
- Response содержит backend-owned coverageKind:
  - TargetGroup для Term и SingleVisit;
  - AllGroups для Professional.
- Frontend и bot показывают coverageKind, но не выводят scope из behaviorKind
  самостоятельно.
- Membership response содержит backend-owned entitlementState:
  Active, Future, Expired, Used, LegacyTargetMissing.
- LegacyTargetMissing не даёт eligibility, не выбирается для attendance и не
  участвует в write-off/restore.

### Parallel read shape
ClientDetailsResponse и application result переходят от singular
CurrentMembership к:

~~~json
{
  "currentMemberships": [
    {
      "id": "...",
      "saleId": "...",
      "target": {
        "groupId": "...",
        "groupName": "Старшая группа",
        "branchId": "...",
        "branchName": "Ленинский"
      },
      "coverageKind": "TargetGroup",
      "entitlementState": "Active"
    }
  ],
  "membershipHistory": []
}
~~~

- currentMemberships означает один open technical version на каждую sale,
  включая Active, Future, Expired, Used и LegacyTargetMissing.
- Сортировка backend: Active Professional, затем Active/Future обычные по
  branch/group, затем остальные по period/created/id.
- Client list response возвращает bounded collection typed summaries и
  backend-owned aggregate fields hasActiveMembership/isProfessional/
  membershipState; frontend не выбирает произвольный first row.
- Membership state filter semantics должны быть зафиксированы raw-JSON tests:
  Active, если есть хотя бы один active entitlement; Expired/Used только когда
  active entitlement отсутствует; behavior filter совпадает с любым current
  membership соответствующего kind.
- Internal bot card заменяет CurrentMembership коллекцией
  CurrentMemberships; expiring list формирует отдельный item на target-aware
  expiring Term/Professional, а не один item на client.
- Старый singular alias допустим только как короткая read-only rollout
  compatibility projection из canonical collection и должен быть удалён в
  этой же coordinated release. Он не может быть вторым source of truth.

### Write requests
- PurchaseClientMembershipRequest получает required targetGroupId.
- RenewClientMembershipRequest получает saleId, expectedMembershipId и
  required targetGroupId. UI заполняет исходную группу по умолчанию, но backend
  требует явное значение и продлевает адресованную sale, а не client-wide
  latest membership.
- CorrectClientMembershipRequest получает required targetGroupId и сохраняет
  существующую optimistic identity saleId + expectedMembershipId.
- Transfer contract получает sourceGroupId, targetGroupId и explicit expected
  current version identities либо equivalent optimistic token.
- Refund request не принимает произвольную reporting group: backend разрешает
  её из актуального current version соответствующей sale и возвращает
  сохранённую attribution group.
- targetGroupId включается в idempotency payload hash всех affected writes.
- Missing/empty targetGroupId: 400 ValidationProblem, errors.targetGroupId.
- Missing, inactive or inaccessible group: 400 with targetGroupId error; role
  and scope checks остаются backend-owned.

### Stable ProblemDetails
- membership-overlap, HTTP 409:
  errors targetGroupId и/или validFrom/validTo;
  extension reason = same-group или professional-global;
  extension conflicts[] содержит только разрешённые для actor данные:
  membershipId, saleId, membershipName, behaviorKind, targetGroupId,
  targetGroupName, branchName, coverageKind, validFrom, validTo.
- membership-target-conflict, HTTP 409: expected version stale; сохранить
  существующий code и адресовать expectedMembershipId.
- membership-target-missing, HTTP 409: legacy row нельзя использовать в
  mutation/attendance до назначения группы.
- group-active-memberships, HTTP 409: isActive=false блокирован; extension
  blockingMembershipCount и bounded blockingTargets[] для recovery.
- single-visit-restore-conflict, HTTP 409: оставить atomic no-change; итоговая
  семантика boundary case зависит от approval gate 1.
- Problem types, field keys, Russian resource strings и extensions проверяются
  raw JSON, а не только CLR records.

## Overlap and entitlement contract

### Date ranges
- Term и Professional используют inclusive business range
  [IndividualValidFrom, IndividualValidTo], где null end означает infinity.
- SingleVisit не имеет отображаемой expiration date. Для overlap нужен
  backend-owned effective start, предлагаемый baseline — PurchaseDate, и
  открытый end до write-off.
- Used SingleVisit не является active entitlement.
- Closed technical versions ValidTo != null не участвуют в current overlap;
  они остаются историей.
- Граница end/start в один день считается overlap. Следующий membership той же
  группы может начаться только на следующий день.

### Matrix

| Existing | Requested | Same group, overlapping | Different group, overlapping |
|---|---|---:|---:|
| Term | Term | deny | allow |
| Term | SingleVisit | deny | allow |
| SingleVisit | Term | deny | allow |
| SingleVisit | SingleVisit | deny | allow |
| Professional | Term/SingleVisit | deny | deny |
| Term/SingleVisit | Professional | deny | deny |
| Professional | Professional | deny | deny |

Non-overlapping future periods одной группы разрешены.

### Selection for attendance
- Добавить один backend/application resolver:
  ResolveEntitlement(clientId, groupId, trainingDate).
- Сначала найти active Professional; matrix гарантирует не более одного.
- Иначе найти active unused target-group entitlement для groupId/date; matrix
  гарантирует не более одного.
- Resolver возвращает selected membership/sale, coverage, state и stable
  failure reason. Он используется одинаково в attendance GET, POST,
  write-off, restore и internal bot projections.
- Attendance POST никогда не принимает membershipId, выбранный пользователем.
- SingleVisit write-off получает groupId, trainingDate и expected selected
  identity, а attendance row сохраняет exact sale/version identity.
- Restore выполняется в той же attendance transaction и обновляет только
  записанный SingleVisit.

## Persistence and concurrency strategy
- Добавить nullable TargetGroupId/FK/navigation к ClientMembership; application
  запрещает null для всех новых versions.
- Добавить immutable AttributionGroupId snapshot к ClientMembershipSale и
  ClientMembershipRefund, если approval gates 5–6 подтверждают event snapshot
  модель. Financial reports читают его вместо client-wide group assignments.
- Сохранить current-version unique index по SaleId.
- Заменить текущий client-wide exclusion constraint:
  - ordinary target-aware exclusion по ClientId + TargetGroupId + inclusive
    range для active Term/unused SingleVisit;
  - отдельный Professional-vs-Professional exclusion по ClientId + range.
- Professional-vs-ordinary нельзя надёжно выразить простым equality-based
  exclusion constraint без wildcard operator. Поэтому все membership writes,
  transfer, correction, write-off/restore и target backfill сериализуются
  client-scoped PostgreSQL row lock, затем выполняют одну shared overlap
  policy. Constraints остаются defense in depth.
- Provider capability path не должен выполнять PostgreSQL SQL в InMemory/
  SQLite tests.
- Concurrent requests с разными idempotency keys дают один success и один
  stable membership-overlap, без 23P01/constraint leakage.
- Sale, current version, group auto-assignment, idempotency record и audit
  коммитятся или откатываются как одна operation boundary.
- Group deactivation блокирует только memberships, active на backend business
  date. Future memberships не блокируют и остаются linked к inactive group.

## Operation semantics

### Purchase
- Validate actor, active/visible target group and catalog against approved
  branch policy.
- Validate overlap under client lock.
- Create sale attribution snapshot, target-aware membership version and
  missing ClientGroup/active assignment atomically.
- Remove global HasActiveMembershipAsync block.
- SingleVisit имеет no expiration UI/response и действует до write-off.

### Renew
- Address source by saleId + expectedMembershipId.
- Inherit its group in UI, but require explicit targetGroupId.
- Calculate period from addressed source duration/end, not Max across client.
- Validate selected target and matrix; create a new sale with its own
  attribution snapshot.

### Correction and legacy repair
- Address one sale/current version.
- Allow target, validity and payment date correction; type/price remain fixed.
- Create a new technical version so old target remains in audit/version
  history.
- LegacyTargetMissing repair uses the same correction endpoint and existing
  membership-management permission; it is not a direct database edit.
- Historical financial reattribution follows approval gate 5.

### Transfer
- Transfer active and future current versions from sourceGroupId to
  targetGroupId by closing old versions and creating new target versions with a
  transfer change reason.
- Do not create sale/payment/refund events.
- Past attendance, sale/refund snapshots and audit retain the old group.
- Update current client group membership/assignment atomically; retain
  unrelated groups required by other memberships.
- Preflight all moved versions against target matrix before any mutation.

### Refund
- Resolve the addressed sale current target at operation time.
- Persist refund AttributionGroupId and include it in response/audit.
- Later transfer never rewrites an existing refund snapshot.
- Canceling refund keeps the original target snapshot.

### Group deactivation
- Map product archive wording to current IsActive=false unless a separate
  archive model is explicitly approved.
- Lock group/membership decision rows; reject when active target memberships
  remain; no state or audit partial write.
- Future memberships do not block and are displayed as Future/Inactive target
  so an administrator can transfer or correct them later.

## Data transition
1. Before editing schema, determine whether every target DB can be recreated.
2. Always update reproducible initial schema, designers, snapshot, seed data
   and clean PostgreSQL creation.
3. If an applied DB must be preserved, add a deterministic forward data
   transition before non-null-on-write enforcement:
   - for each client with memberships and current groups, select group by
     normalized group name in deterministic database collation, then GroupId
     tie-break;
   - assign that group to every existing membership technical version;
   - backfill sale/refund attribution snapshots consistently;
   - keep only selected current ClientGroup row for clients with multiple
     groups and close other active ClientGroupAssignments on transition date;
   - preserve historical closed assignments;
   - clients without groups remain TargetGroupId null as
     LegacyTargetMissing;
   - never synthesize a group.
4. Validate counts before/after, FK validity, deterministic rerun/no duplicate
   assignments and rollback/failure behavior.
5. Do not silently update a preserved production database by editing an
   already-applied migration. Follow backend/AGENTS.md and select an explicit
   forward transition only after lifecycle evidence.

## Reporting and audit
- Membership audit state includes target group identity, coverageKind,
  entitlementState and transfer/correction reason.
- Sale and refund audit states include immutable attribution group snapshot.
- Attendance write-off/restore audit includes target group and exact
  membership version.
- Group deactivation failure writes no successful update audit.
- Financial canonical totals remain unchanged; only branch/group/trainer
  attribution becomes one explicit target per event.
- Professional sale/refund uses reporting target even though entitlement scope
  is AllGroups.
- Transfer does not rewrite old financial/attendance events.
- Reports add regressions proving one sale is not duplicated across every
  current client group.

## UX contract and UI specification
Planning-stage UX research and UI-design handoff are complete. Device testing
was not performed; all viewport and Safari checks remain implementation work.

### Membership section
1. Header title Абонементы, active count badge and one filled
   Оформить абонемент action for authorized users.
2. Permission, legacy, stale or conflict Alert.
3. Open action panel directly after header.
4. Current membership cards:
   - group/branch and backend state badge;
   - membership name and behavior;
   - TargetGroup coverage or Professional all-groups coverage plus reporting
     group;
   - period or SingleVisit до использования/Использован;
   - amount/payment/actor summary;
   - named warning;
   - visible Продлить and lower-emphasis Исправить.
5. History uses cards/structured rows on mobile and may become a table only on
   desktop from the same typed data.

Remove singular Абонемент и оплата snapshot. Overview may show active count,
Professional coverage and first two groups, but must not choose one arbitrary
membership or duplicate write actions.

### Purchase, renew and correction forms
- Embedded Paper/Stack panel; no new route.
- Target group is the first required decision before catalog/pricing.
- Catalog loads after target selection.
- Purchase order: target, pricing/catalog, validity where applicable,
  Professional comment, payment date, confirmation.
- Renew opens from a specific card, shows source summary, defaults target to
  source but allows change, then pricing/dates/payment/comment.
- Correction shows immutable type/price/sale context and edits target,
  payment date and applicable validity fields.
- Confirmation includes target group/branch, coverage, catalog, period,
  amount/payment and Professional comment.
- Conflict preserves all values, sets field errors, names the conflicting
  group/period and focuses the first invalid control.

### Transfer
- Current target and destination first.
- Show affected active/future memberships old target -> new target and periods.
- Professional explicitly says only reporting target changes.
- Remove catalog, price, payment and sale controls from pure transfer.
- Submit text Перевести клиента; success names target and affected count.

### Attendance
- Never show a membership selector.
- Display backend entitlement label/status; Professional shows all-groups scope
  and reporting target.
- Warning/legacy reason remains backend-provided.
- Preserve row-local save status and retry. If Present is disabled by the
  approved contract, expose accessible reason; otherwise show atomic backend
  error after attempt without changing local membership rules.

### Responsive and operational behavior
- 360x780, 390x844, 420x912 and 440x956: single-column forms/cards, no
  horizontal history/page scroll, 44x44 targets and 8px separation.
- 768x1024: two-card grid; target/catalog full width, date/payment fields may
  use two columns.
- 1440x1200: two/three-card grid and optional desktop history table; no
  duplicate hero/helper copy.
- 912x420 and 956x440: dynamic viewport modal body, sticky in-surface footer,
  visible close action, no nested scroll trap.
- Sticky/footer spacing combines normal token spacing with safe-area inset;
  do not rely on 100vh.
- Inputs/selects remain at least 16px on iPhone.
- Loading is not empty; target/catalog load failures have retry; submit
  failure preserves values; refresh-after-success failure shows saved-but-stale
  recovery.
- Opening purchase focuses target group; renew/correction focus first editable
  field; invalid submit scrolls/focuses first error; modal close returns focus.
- Permission-restricted users do not see fake disabled write controls.

## Safe decomposition
TASK-115 remains one coordinated branch and rollout, but code work is divided
into independently reviewable slices with separate red/green barriers:

### Slice A — contract, policy and additive persistence
- Raw JSON request/response/ProblemDetails red tests.
- Pure overlap/entitlement policy unit tests.
- Target and attribution fields, indexes, locks and additive typed contracts.
- Barrier A: matrix + PostgreSQL concurrent conflict + schema model tests.

### Slice B — deterministic data transition and legacy mode
- Transition fixtures for zero/one/multiple groups.
- Initial DB state plus conditional forward transition.
- LegacyTargetMissing read/repair behavior.
- Barrier B: clean create, transition counts/FKs/rerun and no-group isolation.

### Slice C — membership lifecycle, transfer, archive and finance
- Purchase/renew/correction/refund/transfer/deactivation red integration tests.
- Atomic target-aware operations and event snapshots.
- Barrier C: PostgreSQL API atomicity, idempotency, concurrency, fresh reload,
  immutable historical attribution and unchanged canonical totals.

### Slice D — attendance allocation
- Resolver unit matrix and attendance API red tests.
- Exact SingleVisit write-off/restore and no-choice selection.
- Barrier D: group/date resolver uniqueness, one write-off, one restore,
  rollback and concurrent attendance/purchase behavior.

### Slice E — frontend and bot consumers
- Frontend API/component/e2e tests and Python Pydantic/service tests before
  consumer code.
- Replace singular presentation, implement reviewed mobile forms/cards and
  thin bot rendering.
- Barrier E: target iPhone WebKit workflows, bot contract tests and no legacy
  singular executable consumers.

No backend-only breaking contract may be deployed while frontend/bot consume
the old shape. Slices can be committed separately inside the TASK-115 branch,
but merge/deploy is one coordinated contract release.

## Preferred implementation strategy
1. Resolve approval gates and freeze raw JSON contracts before schema work.
2. Write or update unit tests and integration tests before every corresponding
   functional/production-code slice, then prove the expected behavioral red.
3. Introduce additive nullable persistence and deterministic transition before
   enforcing target-required writes.
4. Centralize overlap and entitlement resolution in backend policy; serialize
   every membership mutation per client and keep PostgreSQL constraints as
   defense in depth.
5. Complete backend lifecycle/attendance/report behavior before switching
   frontend and bot to the canonical collection contract.
6. Use small slice-specific commits and the five barriers above, but merge and
   deploy the breaking contract only as one synchronized release.

Do not use frontend validation, arbitrary first-membership selection, a second
compatibility source of truth or manual-only QA as shortcuts.

## Execution roles
1. Coordinator owns risky approval, worktree, contract, integration sequence,
   database lifecycle, runtime stack and final acceptance.
2. ux-researcher contract: complete at planning stage.
3. ui-designer handoff: complete at planning stage.
4. test-automator adds raw JSON, PostgreSQL, frontend component/Playwright and
   bot regressions before functional code.
5. dotnet-backend-specialist implements domain/application/API/persistence/
   reports only after corresponding red tests; before creating or
   substantially restructuring xUnit tests read
   .agents/skills/csharp-xunit/SKILL.md.
6. react-specialist implements the approved React/Mantine contract only after
   frontend red tests and reads .agents/skills/react-best-practices/SKILL.md.
7. python-pro adapts the thin bot consumer without copying CRM policy.

All specialists work in the coordinator-delegated TASK-115 worktree, do not
create/remove worktrees and do not revert other agents.

## Execution steps

### Phase 0 — review, workspace and executable contract
1. Obtain explicit approval to execute risky TASK-115 and resolve all approval
   gates.
2. Re-read root/backend/frontend/bot AGENTS.md, this plan, task-worktree,
   crm-mobile-first-ui and applicable testing/implementation skills.
3. Fetch origin; ensure TASK-115 planning commits are in current origin/main;
   create and verify dedicated worktree/branch.
4. Inventory every singular CurrentMembership/currentMembership,
   HasActiveMembershipAsync, overlap constraint, SingleVisit write-off/restore,
   financial group attribution and transfer consumer.
5. Record baseline focused/full suite results and target DB lifecycle.

### Phase 1 — all red tests before functional code
6. Add raw JSON API tests for required target, parallel currentMemberships,
   target metadata, stable codes/extensions and removal of arbitrary singular
   selection. Run against old server and record behavioral assertion failures.
7. Add pure unit tests for complete matrix, inclusive boundaries, future
   non-overlap, Professional global scope, legacy exclusion and resolver
   uniqueness. Minimal compile scaffolding may precede these tests, but no
   successful behavior.
8. Add PostgreSQL model/integration tests for FKs, constraints, client lock,
   concurrent purchase/correction/transfer/restore and fresh DbContext reload.
9. Add transition tests for deterministic alphabetical choice, GroupId
   tie-break, removal/closure of extra current assignments, preserved history,
   no-group legacy and attribution snapshot backfill.
10. Add operation tests for purchase/renew/correction/transfer/refund/group
    deactivation and financial reports, including failure atomicity/audit.
11. Add attendance tests for group/date resolver, no user choice, Professional,
    SingleVisit write-off/restore, idempotent repeat, concurrent writes and the
    approved restore boundary.
12. Add frontend mapper/form/card/attendance tests and Playwright scenarios
    using only the new contract.
13. Add internal bot raw JSON plus Python models/service tests for collection
    shape and target labels.
14. Run every new suite and preserve executed count/failing assertion. Compile,
    Docker, fixture or unrelated baseline failures are not valid red evidence.

### Phase 2 — policy, domain and persistence
15. Implement shared membership date/coverage/overlap policy and entitlement
    resolver in Domain/Application without HTTP/EF dependencies.
16. Add target/attribution fields, navigations/configurations/indexes and
    provider-safe client lock.
17. Update initial migration, required designers and snapshot. Implement only
    the data-transition path selected in Phase 0.
18. Implement deterministic transition and legacy state; prove clean create
    and, when required, forward upgrade before operation cutover.

### Phase 3 — backend mutations and projections
19. Replace client-wide purchase/renew/current selection with addressed,
    target-aware collections and overlap checks.
20. Implement atomic purchase auto-assignment, renew, correction/legacy repair,
    pure transfer, refund snapshot and group deactivation guard.
21. Implement attendance resolver/write-off/restore inside existing owned
    transaction and propagate target-aware warning/status DTOs.
22. Update client list/details/attention, attendance, audit, reports and
    internal bot projections. Remove accidental group duplication in financial
    breakdown without changing canonical amounts.
23. Update seeders and every backend fixture; rerun identical backend red suites
    to green before consumer implementation.

### Phase 4 — frontend and bot
24. Replace frontend typed singular membership contract with canonical
    collection, target/coverage/state and ProblemDetails conflict metadata.
25. Implement ActiveMembershipCard, target select, action panels, conflict
    alert, mobile history cards and reviewed purchase/renew/correction/transfer
    flows with React/Mantine existing patterns.
26. Adapt client overview/list filters and attendance rows without local domain
    rules or membership selector.
27. Adapt Python bot collection models and formatting; preserve backend order
    and status text.
28. Remove legacy aliases/fixtures from executable consumers and run focused
    frontend/bot red suites to green.

### Phase 5 — regression and runtime acceptance
29. Run full backend/frontend/bot validation commands.
30. Recreate isolated PostgreSQL stack from final initial schema, seed, start
    backend/frontend/bot as applicable and smoke raw synchronized contract.
31. If forward transition is required, upgrade representative preceding DB and
    verify counts, target choice, legacy rows, constraints and reports.
32. Execute primary purchase -> second different-group purchase -> same-group
    conflict -> renew/correct -> attendance write-off/restore -> transfer ->
    refund/report flow.
33. Execute mobile workflows at 390x844, 420x912, 440x956, 360x780,
    768x1024, 1440x1200 and compact 912x420/956x440; include failure recovery
    and permission-restricted path.
34. Report all Safari Responsive Design Mode, Simulator, physical-device,
    software-keyboard, dynamic chrome, safe-area and one-handed checks not
    actually performed.

## Files likely to change

Backend domain/application:
- backend/src/GymCrm.Domain/Clients/ClientMembership.cs
- backend/src/GymCrm.Domain/Clients/ClientMembershipSale.cs
- backend/src/GymCrm.Domain/Clients/ClientMembershipRefund.cs
- backend/src/GymCrm.Domain/Clients/ClientMembershipChangeReason.cs
- new focused membership overlap/entitlement policy files
- backend/src/GymCrm.Application/Clients/IClientMembershipService.cs
- backend/src/GymCrm.Application/Clients/ClientMembershipSemantics.cs
- backend/src/GymCrm.Application/Bot/BotApiContracts.cs

Backend persistence/services:
- backend/src/GymCrm.Infrastructure/Clients/ClientMembershipService.cs
- backend/src/GymCrm.Infrastructure/Attendance/AttendanceService.cs
- backend/src/GymCrm.Infrastructure/Reports/FinancialReportService.cs
- backend/src/GymCrm.Infrastructure/Bot/BotApiService.cs
- backend/src/GymCrm.Infrastructure/Persistence/GymCrmDbContext.cs
- membership/sale/refund EF configurations
- backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.cs
- backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.Designer.cs
- later migration designer(s) and GymCrmDbContextModelSnapshot.cs
- conditional new forward transition and designer only when Phase 0 requires it

Backend API:
- PurchaseClientMembershipRequest.cs
- RenewClientMembershipRequest.cs
- CorrectClientMembershipRequest.cs
- TransferClientBranchRequest.cs or new dedicated target-transfer request
- ClientMembershipResponse.cs
- CurrentMembershipSummaryResponse.cs or its collection replacement
- ClientDetailsResponse.cs
- ClientListItemResponse.cs
- AttendanceClientResponse.cs
- ClientMembershipAuditState.cs
- ClientMembershipSaleAuditState.cs
- ClientMembershipRefundAuditState.cs
- ClientEndpoints.cs
- AttendanceEndpoints.cs
- GroupEndpoints.cs
- ClientResources.cs/resx, AttendanceResources.cs/resx and GroupResources.cs/resx
- seed data files

Backend tests:
- new MembershipTargetOverlapPolicyTests.cs
- new ClientMembershipTargetApiTests.cs
- new ClientMembershipTargetPostgreSqlTests.cs
- new ClientMembershipTargetDataTransitionTests.cs
- new AttendanceMembershipEntitlementTests.cs
- ClientMembershipPersistenceModelTests.cs
- ClientMembershipWriteRegressionApiTests.cs
- ClientsApiTests.cs
- AttendanceApiTests.cs
- MembershipTransferCatalogTests.cs
- FinancialReportsApiTests.cs
- InternalBotApiTests.cs
- seeder/bootstrap tests and affected fixtures

Frontend:
- frontend/src/lib/api/types.ts
- frontend/src/lib/api/clients.ts
- frontend/src/lib/api/attendance.ts
- frontend/src/lib/api/mappers.ts
- their unit tests
- frontend/src/features/clients/ClientManagement.tsx
- ClientManagement.form.test.ts and ClientManagement.test.tsx
- frontend/src/features/attendance/AttendanceClientRow.tsx
- AttendanceClientRow.test.tsx
- AttendanceScreen.tsx/test
- affected client list/preview view models and tests
- group management error handling for IsActive=false
- frontend/src/App.css
- frontend/e2e/membership-target-overlap.spec.ts (new preferred)
- frontend/e2e/membership-sale-pricing.spec.ts
- frontend/e2e/attendance.spec.ts
- frontend/e2e/iphone-target-devices.spec.ts

Bot:
- bot/src/gym_crm_bot/crm/models.py
- bot/src/gym_crm_bot/core/service.py
- bot/tests/test_crm_client.py
- bot/tests/test_bot_service.py

## Constraints
- Backend remains sole owner of targets, coverage, overlap, entitlement
  selection, permissions, validation, audit and finance attribution.
- New membership versions never persist null TargetGroupId.
- Legacy null rows are explicit state, never silently treated as client first
  group at runtime.
- No user-selected membership id in attendance.
- No double write-off/restore or duplicate financial group attribution.
- Current inclusive validity semantics remain explicit.
- Pricing, RUB, payment, refund amount and catalog semantics do not change
  except required group attribution.
- Mutation, idempotency record and audit remain atomic.
- Historical attendance and financial events are not rewritten by transfer.
- Initial DB state is reproducible; no speculative migration of an unknown
  preserved database.
- Mantine, Onest and existing shared components/tokens are preserved.
- Project code changes happen only in the declared worktree.

## Out of scope
- General membership catalog redesign or per-group catalog ownership.
- Prices, discounts, refund amount rules or external payments.
- Multiple target groups on one membership.
- User choice/priority among overlapping entitlements.
- Session capacity, hall conflicts or schedule redesign.
- General client branch/RBAC redesign beyond explicitly approved target scope.
- TASK-074 freeze semantics and TASK-118 attendance time snapshots.
- Production data cleanup not covered by the deterministic approved transition.

## Required test coverage

### Unit
- Complete matrix, inclusive boundaries and non-overlapping future periods.
- Professional global coverage and reporting target separation.
- Backend entitlement state and deterministic resolver.
- Renew source-period calculation for addressed sale.
- Target-aware report attribution and no duplication.
- Validation normalization and stable error mapping.

### Integration/PostgreSQL
- Purchase allowed for different groups, denied for same-group overlap.
- Every Professional conflict direction and Professional + Professional.
- SingleVisit same/different group behavior, write-off and restore.
- Atomic auto-add to group and idempotent replay.
- Concurrent purchases/corrections/transfers/restores.
- Correction stale target and no partial audit.
- Transfer affects active/future only and preserves old events.
- Deactivation blocks active, ignores future, retains future link.
- Refund snapshot uses operation-time target and survives later transfer.
- Data transition 0/1/many/no-group fixtures and clean/upgrade schema.
- Fresh DbContext reload and raw JSON contracts.

### Frontend/UI/e2e
- Purchase requires target before catalog and preserves values on conflict.
- Renew opens from exact card, inherits and can change target.
- Correction changes target and maps stale/overlap errors.
- Parallel cards and Professional coverage/reporting target.
- Mobile history has no horizontal page scroll.
- Transfer shows exact affected entitlements and no sale controls.
- Attendance contains no selector and preserves row-local retry.
- Permission-restricted and saved-but-refresh-failed recovery.
- Long group/branch/membership names and mandatory viewports.

### Bot
- Collection parsing, ordering and target labels.
- Professional all-groups/reporting target wording.
- Multiple expiring memberships for one client.
- Legacy/no-entitlement warning remains backend-provided.

### Manual only
- Actual Safari chrome, native selects/date inputs, software keyboard, safe
  areas, home indicator and one-handed reach need Simulator/physical device.
- Human review of transition dry-run and financial attribution diff is required
  before any preserved database change.

## Test plan
- [ ] Record approval-gate decisions and baseline results.
- [ ] Run focused red backend tests:
  dotnet test backend/tests/GymCrm.Tests/GymCrm.Tests.csproj --filter
  FullyQualifiedName~MembershipTarget|FullyQualifiedName~MembershipEntitlement
- [ ] Run PostgreSQL transition/concurrency tests and record exact red reasons.
- [ ] Run frontend target/form/card/attendance unit/component red tests.
- [ ] Run bot Pydantic/service red tests.
- [ ] Rerun identical focused suites to green without weakening assertions.
- [ ] Run dotnet test backend/GymCrm.slnx.
- [ ] From frontend run npm run lint, npm run build and npm run test:unit.
- [ ] Run affected Playwright specs plus npm run test:e2e:iphone.
- [ ] From bot run ruff check . and pytest.
- [ ] Recreate isolated clean DB/runtime stack and, when selected, upgrade
  representative preceding DB.
- [ ] Search executable code/tests for singular currentMembership selection,
  old client-wide overlap and targetless membership writes.
- [ ] Record automated device evidence and residual physical Safari checks.

## Regression barriers

Barrier A — matrix and concurrency:
one pure exhaustive matrix suite plus real PostgreSQL concurrent writes proves
same-group denial, different-group allowance and Professional global exclusion
without raw constraint leakage.

Barrier B — data:
clean schema plus deterministic transition fixture proves group selection,
assignment cleanup, legacy no-group preservation, event snapshot backfill and
fresh reload.

Barrier C — lifecycle/finance:
vertical raw HTTP -> transaction -> new DbContext -> audit/report tests prove
purchase, renew, correction, transfer, refund and deactivation atomicity while
canonical money is unchanged and one event has one target attribution.

Barrier D — attendance:
group/date resolver -> exact selected sale/version -> attendance write ->
SingleVisit write-off -> cancel -> restore proves no user choice, no double
write and full rollback on conflict.

Barrier E — consumers:
frontend component/Playwright and internal bot/Python tests prove parallel
target display, field recovery, no attendance selector and synchronized
collection contract at required devices.

TASK-115 cannot complete on InMemory-only tests, mocked UI-only tests or
manual QA. All five barriers and full suites must be green.

## Risks
- Wildcard Professional overlap is not fully protected by a simple group-key
  exclusion constraint; any mutation path that skips client lock can admit an
  invalid race.
- SingleVisit restore after a later same-group sale is currently
  under-specified and can violate either restore or overlap guarantees.
- Singular current membership assumptions exist in list filters, action hints,
  attendance, reports, bot and UI, so a missed consumer may silently select a
  different sale.
- Group target and Client.BranchId/access scope can conflict across branches.
- Updating client group assignments during backfill or transfer can distort
  historical report attribution if closed periods are deleted.
- Correction semantics can accidentally rewrite past finance when only future
  target behavior was intended.
- Future membership linked to inactive group needs visible recovery or it can
  become unusable without warning.
- A partial backend/frontend/bot rollout breaks writes or hides entitlements.
- Local main is ahead of origin/main; branching too early can omit the planning
  contract and recent baseline code.

## Stop conditions
Stop and do not write/continue functional code if:
- any approval gate remains unresolved;
- source plan/task is absent from execution base;
- branch/worktree/base or dirty changes are ambiguous;
- target group scope requires RBAC/security architecture redesign;
- safe client-scoped serialization cannot cover every write/restore path;
- SingleVisit restore rule cannot satisfy approved matrix atomically;
- data transition cannot produce deterministic counts/FKs or would require
  uncontrolled production cleanup;
- correction/transfer/refund historical attribution is not agreed;
- API cannot expose a canonical collection without an uncontrolled external
  consumer break;
- financial canonical totals change unexpectedly;
- scope expands into pricing, payments, schedule, freeze or unrelated client
  redesign;
- a material frontend constraint conflicts with the reviewed UX/UI contract.

Do not stop only because backend, frontend and bot change together; that
coordinated scope is expected after the gates are approved.

## Ready for Codex execution
no

Reason: source remains high-risk and Safe for Codex: no. The architecture,
test-first phases, UI contract and regression barriers are prepared, but
active execution requires explicit user approval, current origin/main
integration and decisions for SingleVisit restore, attendance enforcement,
cross-branch target, transfer boundary and historical financial attribution.
