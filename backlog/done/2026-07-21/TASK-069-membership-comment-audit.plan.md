# Implementation Plan: TASK-069 Добавить комментарий к абонементу с автором и датой

## Source task
/backlog/done/2026-07-21/TASK-069-membership-comment-audit.md

Source task and this plan were moved to `/backlog/done` after implementation commit `a4f083e` was merged into `main` via merge commit `b0de5f6` (PR #80) on 2026-07-21.

Source status remains `risky`: this plan prepares the task for explicit review and later selection; it does not move the task into active implementation.

## Git branch
feature/TASK-069-membership-comment-audit

Branch rules:
- before implementation, verify a clean worktree, switch to `main`, pull the latest changes and create this branch from `main`;
- confirm this branch is active before changing project code;
- do not implement unrelated TASKs in this branch;
- stop if the worktree is dirty or the branch/base is unclear.

## Goal
Дать администратору и главному тренеру возможность сохранять отдельный рабочий комментарий для конкретной покупки абонемента и показывать в карточке клиента актуальное имя последнего редактора и локализованное время изменения, не затрагивая финансовые, платежные, refund, validity и write-off semantics.

## Current understanding
- `ClientMembership.Id` является identity технической версии: correction, payment update, single-visit write-off и restore закрывают текущую строку и создают новую с новым `Id`.
- `ClientMembershipSale.Id` (`saleId`) является стабильной identity одной покупки абонемента: версии correction/payment/write-off сохраняют тот же `SaleId`, а новая покупка/продление создаёт новый sale. Поэтому комментарий и его metadata должны храниться на `ClientMembershipSale`, а не копироваться по версиям `ClientMembership`.
- Один sale принадлежит одному client; endpoint обязан искать пару `clientId + saleId`, чтобы комментарий нельзя было изменить через карточку другого клиента.
- Backend уже отдаёт `SaleId` в `ClientMembershipResponse`, но frontend mapper/type его не сохраняет. Контракт следует расширить/исправить так, чтобы `saleId` использовался как непрозрачный ключ запроса и не показывался пользователю.
- Комментарий и его metadata доступны на чтение и изменение только под `ManageClients`, то есть Administrator/HeadCoach. Сам факт доступа Coach к карточке клиента через `ViewClients` не должен раскрывать ему текст комментария, автора или время изменения; backend обязан исключить эти данные из доступного Coach read contract без frontend-only проверки прав.
- Нужен отдельный endpoint изменения только комментария, например `PUT /clients/{clientId}/membership/sales/{saleId}/comment` с `{ "comment": string | null }`. Он не должен принимать или сохранять membership/sale financial fields.
- Комментарий нормализуется backend-ом: trim, whitespace-only → `null`, максимальная длина доменного контракта — 2000 символов. Сравнение выполняется после нормализации; no-op не меняет metadata и не создаёт audit event.
- При любом реальном переходе (`null -> text`, `text -> changed text`, `text -> null`) сохраняются actor и одно серверное UTC-время. Очистка равносильна сохранению пустого текста: `Comment` становится `null`, но `CommentChangedByUserId` и `CommentChangedAt` фиксируют, кто и когда очистил комментарий. Metadata состоит из nullable `CommentChangedByUserId` и `CommentChangedAt`; для новых записей после первой реальной mutation она хранится полной парой даже при пустом комментарии.
- Имя автора в response вычисляется из актуального `User.FullName`; snapshot имени не хранится. Legacy sale без комментария/metadata остаётся nullable и не требует backfill.
- Audit event создаётся только после успешного сохранения комментария. Payload не содержит текст комментария или финансовое состояние; достаточно `saleId`, `clientId` и безопасного transition (`set`, `changed`, `cleared`).
- Карточка клиента уже показывает текущий абонемент и таблицу версий. UI должен показывать один компактный comment block внутри каждой пользовательской карточки покупки, группируя технические версии по `saleId`; несколько версий одной покупки не создают дополнительные блоки или edit controls. Блок целиком, включая empty state и metadata, виден только Administrator/HeadCoach на основании backend-owned permission contract.
- TASK-068 уже внедрил безопасный паттерн полной пары metadata, локального форматирования времени и best-effort audit для заметки клиента. Его можно переиспользовать как технический ориентир, но membership comment остаётся отдельным contract/persistence/audit flow.

## Safe decomposition
1. **Stable identity and persistence:** добавить комментарий и nullable metadata к `ClientMembershipSale`, FK автора с `DeleteBehavior.Restrict`, без изменений денежных колонок.
2. **Application contract:** добавить command/result для update по паре `clientId + saleId`, нормализацию и no-op semantics.
3. **HTTP and audit:** отдельный `ManageClients` endpoint, validation/ProblemDetails, безопасное событие `ClientMembershipCommentChanged`.
4. **Read model:** вернуть `saleId`, comment и полную пару display-name/time во всех membership snapshots одной sale без раскрытия actor id для comment metadata.
5. **Frontend UX:** редактирование и отображение комментария по purchase/sale, корректное поведение для нескольких версий и нескольких абонементов.
6. **Regression:** доказать, что comment update не меняет sale/payment/refund/validity/write-off state и не переносит comment на другую sale.

Каждый этап должен быть локальным и проверяемым. Persistence/application/API этапы выполняются до frontend integration, но тесты соответствующего этапа пишутся до production-кода.

## Execution steps
1. Создать `feature/TASK-069-membership-comment-audit` от актуального чистого `main`; до этого не менять project code.
2. Зафиксировать additive contract до реализации:
   - stable identity комментария — `ClientMembershipSale.Id`/`saleId`;
   - `PUT /clients/{clientId}/membership/sales/{saleId}/comment`;
   - request `{ comment: string | null }`;
   - membership response содержит `saleId`, `comment`, `commentLastChangedByName`, `commentLastChangedAt`;
   - comment fields выдаются только пользователю с `ManageClients`; Coach не получает текст комментария или metadata через client details response;
   - actor id/login не входят в новые comment metadata поля и не показываются в UI;
   - response возвращает имя и время только полной парой, иначе оба значения `null` и backend пишет безопасную диагностику.
3. **До production-кода** добавить domain/application unit tests:
   - нормализация trim/whitespace/null и boundary максимальной длины;
   - переходы `null -> text`, `text -> changed`, `text -> null`, normalized no-op;
   - no-op сохраняет прежние actor/time;
   - update использует `saleId`, а не version `membershipId`;
   - deterministic `TimeProvider` задаёт UTC timestamp с согласованной точностью.
4. **До production-кода** добавить backend integration tests в `ClientsApiTests` или отдельный focused test class:
   - Administrator и HeadCoach могут прочитать, установить, изменить и очистить comment;
   - Coach не получает comment/metadata при чтении карточки и получает штатный forbid при mutation; unauthenticated request получает unauthorized, запись и audit не меняются;
   - чужая пара `clientId + saleId` и отсутствующий sale возвращают одинаковый `404`, не раскрывая принадлежность;
   - invalid length даёт существующий ValidationProblem contract;
   - два sale одного клиента сохраняют независимые comments;
   - correction, payment update, write-off/restore создают новую membership version с тем же `saleId`, а comment/metadata остаются доступны;
   - renewal/new purchase создаёт новый `saleId` без наследования comment;
   - comment mutation не меняет `GrossAmount`, `PurchaseDate`, refunds, `PaymentAmount`, `IsPaid`, `PaidAt`, validity, `SingleVisitUsed`, version cardinality или current-membership selection;
   - полная metadata возвращает актуальный `User.FullName`; legacy/partial/unresolvable metadata возвращает два `null` и безопасный diagnostic log;
   - JSON содержит display name/time, но не comment actor id/login;
   - audit event имеет правильные entity/id/transition и не содержит comment text, client PII или financial snapshot;
   - normalized no-op не создаёт audit event и не меняет timestamp.
   - `text -> null` сохраняет actor/time очистки и создаёт ровно один audit transition `cleared`; повторное сохранение пустого значения является no-op.
5. **До production-кода** добавить frontend mapper/API tests:
   - `mapClientMembership` сохраняет обязательный `saleId` из response и полную nullable metadata pair;
   - partial metadata нормализуется в два `null`;
   - update function отправляет только `{ comment }` на URL с `clientId + saleId` и корректно обрабатывает ProblemDetails/403/404;
   - технический `saleId` не рендерится как пользовательский текст.
6. **До production-кода** добавить frontend component tests:
   - comment и `Имя · локальная дата, HH:mm` отображаются одним блоком внутри каждой доступной пользователю purchase card;
   - несколько versions с одним `saleId` не создают противоречащих друг другу comment blocks;
   - разные sale показывают независимые значения;
   - legacy empty state не фабрикует автора или `Invalid Date`, а очищенный comment показывает автора и время последней очистки без текста;
   - Coach не видит comment block, empty state или attribution;
   - успешное сохранение обновляет details response, validation/403 остаются видимыми и не меняют локально финансовые данные;
   - edit control не становится источником permission semantics: фактический запрет проверяет backend.
7. **До production-кода** добавить affected Playwright scenario для клиента с двумя покупками и несколькими версиями одной покупки: открыть нужный абонемент, изменить comment, увидеть actor/time, перезагрузить карточку и убедиться в устойчивой привязке. Зафиксировать отдельный denied response для роли без права mutation, если существующая e2e auth fixture это поддерживает.
8. Запустить новые unit/integration/component/e2e tests и подтвердить ожидаемое падение из-за отсутствующих sale fields, update command/endpoint, response mapping, audit action и UI. Не считать red phase валидной при падении baseline, fixture setup, locale/timezone или auth harness.
9. Реализовать persistence минимально:
   - добавить в `ClientMembershipSale` nullable `Comment`, `CommentChangedByUserId`, `CommentChangedAt` и navigation автора;
   - настроить `Comment` max length, nullable FK/index к `User` и `DeleteBehavior.Restrict`;
   - обновить начальное состояние БД, designer и model snapshot по repository policy, не создавая отдельную историческую migration и не выполняя backfill;
   - не менять money/check constraints и существующие sale/membership relationships.
10. Реализовать application command/result в `IClientMembershipService` и `ClientMembershipService`:
   - lookup строго по `sale.Id == saleId && sale.ClientId == clientId`;
   - backend normalization/validation;
   - одно значение `TimeProvider.GetUtcNow()` для actor/time;
   - no-op возвращает актуальные details без `SaveChanges` и audit transition;
   - change/clear обновляют только три comment fields и возвращают transition для endpoint audit; clear устанавливает `Comment = null`, но сохраняет actor/time текущей операции;
   - существующие purchase/correct/payment/refund/write-off методы не должны копировать или изменять comment metadata.
11. Расширить membership load/projection paths (`ClientMembershipSnapshotResult`, `ClientMembershipResponse`, `MapMembership`) данными sale comment. Загрузить comment author одной projection/include без N+1. Для всех versions одной sale возвращать согласованные значения; полную пару name/time выдавать только при разрешимом авторе и наличии `ManageClients`. Coach не должен получать comment/metadata через client details read model.
12. Реализовать HTTP endpoint под `ManageClients`, CSRF и существующим ProblemDetails стилем. Не принимать membership version id и не выполнять lookup через «текущую» версию. Возвращать обновлённый `ClientDetailsResponse`, чтобы frontend заменил весь details snapshot согласованно.
13. Добавить `ClientMembershipCommentChanged` в audit constants/resources и frontend audit label resources. Entity type/id должны однозначно ссылаться на стабильную sale identity; рекомендуемый вариант — `ClientMembershipSale` + `saleId`. Audit JSON содержит только `{ clientId, saleId, transition }`, без comment, имени клиента, телефона, login и financial state.
14. Реализовать audit failure semantics по паттерну TASK-068: comment persistence остаётся успешной, а audit write выполняется через локализованный best-effort helper с безопасным structured log. Не расширять задачу до outbox/общего redesign.
15. Обновить frontend type/mapper/client API: сделать `saleId` обязательной stable identity для membership response, добавить comment fields и mutation function. Не использовать fallback-сгенерированный membership `id` для update.
16. Реализовать компактный UI в `ClientMembershipSection`: показать один comment block внутри каждой пользовательской карточки purchase/sale и дать Administrator/HeadCoach action редактирования без дублирования на каждой технической версии. Для Coach блок не рендерить. Переиспользовать backend-owned permission contract, Mantine/Onest и существующие form/notification patterns; проверить длинный текст/имя и narrow viewport.
17. Запустить targeted tests, затем полный regression suite: `dotnet test backend/GymCrm.slnx`, frontend unit tests, `npm run lint`, `npm run build`, affected Playwright. Отдельно проверить clean database setup/schema model.
18. Провести security/privacy review request/response/audit/logs и ручную проверку desktop/narrow viewport. Ручная QA дополняет, но не заменяет автоматические regression barriers.

## Preferred implementation strategy
1. Contract-first с явно закреплённой sale identity.
2. Backend-owned authorization, normalization, timestamp и audit semantics.
3. Additive nullable persistence на `ClientMembershipSale` без backfill.
4. Малые проверяемые commits: tests/contracts, persistence/application, endpoint/audit, frontend mapping/UI, regression.
5. Feature flag не требуется, если additive nullable response совместим с потребителями; добавить его только при обнаруженной реальной deployment incompatibility.

## Files likely to change
- `backend/src/GymCrm.Domain/Clients/ClientMembershipSale.cs`
- `backend/src/GymCrm.Domain/Users/User.cs`
- `backend/src/GymCrm.Application/Clients/IClientMembershipService.cs`
- `backend/src/GymCrm.Infrastructure/Clients/ClientMembershipService.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/ClientMembershipSaleConfiguration.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/UserConfiguration.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.Designer.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/GymCrmDbContextModelSnapshot.cs`
- `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/ClientMembershipResponse.cs`
- `backend/src/GymCrm.Api/Auth/ClientAuditConstants.cs`
- `backend/src/GymCrm.Api/Auth/ClientAuditResources.cs`
- `backend/src/GymCrm.Api/Auth/Resources/ClientAuditResources.resx`
- `backend/src/GymCrm.Api/Auth/Resources/ClientAuditResources.ru.resx`
- `backend/tests/GymCrm.Tests/ClientsApiTests.cs` or a new focused membership-comment integration test file
- `backend/tests/GymCrm.Tests/BootstrapSmokeTests.cs`
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/mappers.ts`
- `frontend/src/lib/api/clients.ts`
- nearest existing mapper/API tests under `frontend/src/lib/api/`
- `frontend/src/lib/resources.ts`
- `frontend/src/features/clients/ClientManagement.tsx`
- `frontend/src/features/clients/ClientManagement.test.tsx`
- `frontend/e2e/stage12.spec.ts` or a new focused client-membership-comment spec

Exact test/resource filenames and whether a dedicated request/response file is preferable must be confirmed before editing. Repository policy requires updating the initial database state rather than adding a new migration.

## Constraints
- `ClientMembershipSale.Id`/`saleId` is the stable identity for the comment; `ClientMembership.Id` must remain version identity only.
- Backend remains the sole owner of permissions, normalization, timestamp, membership ownership validation and audit semantics.
- Comment mutation changes only sale comment metadata; it must not create/close a membership version.
- Do not modify sale, payment, refund, validity, professional privilege, transfer or attendance/write-off behavior.
- Do not expose comment author id/login in the new API/UI contract; `saleId` is an opaque request key and is never displayed.
- Use current `User.FullName`, not a persisted display-name snapshot.
- New writes keep comment/author/time consistent; clear sets only comment to `null` and records the clearing actor/time.
- Partial/unresolvable metadata is returned as a null pair and diagnosed without comment/client PII.
- Use backend UTC time from `TimeProvider`; frontend formats it in the user’s local timezone to minute precision.
- Comment read and mutation both require `ManageClients` and are available only to Administrator/HeadCoach; existing Coach visibility of other client-card data must not expose comment content or metadata.
- Audit payload and audit-failure logs must never include comment contents, request bodies or financial/client PII.
- Preserve compatibility of bot, dashboard, attention-list and financial-report consumers; do not add comment fields outside client details membership snapshots unless proven necessary.

## Out of scope
- Comment history, discussions, replies, attachments, mentions or notifications.
- Optimistic concurrency and conflict resolution for simultaneous edits; last-write-wins is accepted.
- Client-level notes from TASK-023/TASK-068.
- Professional membership reason/comment semantics; do not reuse `ProfessionalComment`.
- Editing financial/payment/refund/validity fields through the comment endpoint.
- Backfill of legacy attribution.
- RBAC redesign or a new permission.
- Transactional outbox/general audit infrastructure redesign.
- Physical user deletion and reassignment/anonymization of historical attribution.
- Showing comment in client lists, dashboard, bot or reports.

## Required test coverage

All new/updated unit and integration tests are written before functional code and must first fail for the expected missing behavior.

### Unit tests
- Backend normalization, max-length boundary, transition classification and no-op behavior.
- Stable `saleId` command semantics and deterministic `TimeProvider` timestamp.
- Frontend mapping of `saleId`, full/partial/absent metadata and comment.
- Frontend local date formatting and comment block state without fabricated attribution.

### Integration tests
- Persistence/FK/schema recreation for nullable sale comment metadata.
- Authorization matrix for read and mutation: Administrator, HeadCoach, Coach, unauthenticated.
- Ownership isolation using two clients and multiple sales.
- Version continuity across correction/payment/write-off/restore and isolation across renewal/new purchase.
- Exact no-side-effects assertions over money, payment, refund, validity, write-off, version count and current membership.
- Audit transition/cardinality/payload allowlist and no event on normalized no-op.
- Current full name lookup, legacy/partial/unresolvable metadata and safe diagnostics.
- API JSON allowlist proving absence of comment actor id/login and request echo.

### UI/e2e tests
- Edit and persistent display for the selected sale.
- Two sales remain independent; multiple versions of one sale show one consistent comment.
- Empty/legacy/cleared states, including actor/time retained after clear.
- 403/validation UX without optimistic corruption.
- Long comment/author and narrow viewport smoke coverage where existing responsive tests support it.

### Existing tests to update
- Client details membership fixtures in `ClientManagement.test.tsx` and affected Playwright specs.
- `mapClientMembership` contract tests/fixtures so real `saleId` is preserved.
- Existing membership history/audit assertions in `ClientsApiTests.cs` without weakening financial and versioning guarantees.
- Bootstrap/schema smoke assertions for nullable fields and FK delete behavior.

### Expected initial failure
- Backend tests fail because sale comment fields, command/endpoint, response metadata and audit action do not exist.
- Frontend tests fail because membership mapping discards `saleId` and UI/API do not support comment editing/attribution.
- Failures from unrelated baseline regressions, invalid fixtures, timezone leakage or auth setup do not satisfy the red phase.

### Manual-only validation
- Visual rhythm, textarea usability and wrapping for long comments/author names on desktop and narrow viewport.
- Human privacy review of audit descriptions and structured error logs.

## Test plan
- [ ] Backend unit/integration tests are written before production code and fail for the intended missing behavior.
- [ ] Frontend mapper/component/e2e tests are written before production code and fail for the intended missing behavior.
- [ ] `saleId` remains stable across technical versions and is used for every comment update.
- [ ] Two purchases/sales of one client retain independent comments.
- [ ] Correction, payment, refund, validity and write-off state are byte/field-equivalent before and after comment-only update.
- [ ] Administrator/HeadCoach can read and mutate; Coach cannot read comment/metadata, and Coach/anonymous and cross-client sale lookup cannot mutate data.
- [ ] Set/change/clear update exact metadata; clear retains the clearing actor/time; normalized no-op preserves metadata and emits no audit.
- [ ] Response shows current full name/time as a complete pair and no actor id/login.
- [ ] Audit contains only safe identifiers/transition and never comment/client/financial payload.
- [ ] Legacy and invalid partial metadata render without false attribution.
- [ ] Clean database setup and schema model verification pass.
- [ ] `dotnet test backend/GymCrm.slnx` passes.
- [ ] Frontend targeted tests, `npm run lint` and `npm run build` pass.
- [ ] Affected Playwright tests pass.

## Regression barrier
Primary barrier: backend integration tests against a real test database that update comment by `clientId + saleId`, then assert exact persistence/audit behavior and equality of every financial, payment, refund, validity, write-off and versioning field. The matrix must include two clients, two sales and multiple versions sharing one sale. It is paired with mapper/component tests and one Playwright flow. Completion is blocked if tests can pass while binding to `ClientMembership.Id`, inheriting a comment into a renewal, leaking actor id/login/comment text, changing membership version cardinality, or allowing Coach/cross-client mutation.

## Risks
- Binding comment to version `ClientMembership.Id` would lose stable attribution after correction/payment/write-off; schema and endpoint tests must enforce `saleId`.
- Existing history renders versions rather than purchases; naïve UI can duplicate edit controls/comments. Group presentation by `saleId` or expose one sale-level block while preserving version rows.
- Adding author navigation can create N+1 queries or an accidental required/cascade relationship; load once through sale projection and test `Restrict` plus nullable legacy rows.
- Audit currently serializes membership financial state for other actions. The new comment event must use a dedicated minimal state and never reuse full membership serialization.
- Best-effort audit failure after persistence creates a deliberate partial-success state matching TASK-068; keep the helper localized and log only safe identifiers.
- Frontend currently synthesizes fallback membership ids and drops `saleId`; any update built on that fallback can target the wrong record.
- Multiple technical versions referencing one sale can make current-name/time mapping inconsistent if projections are assembled independently; assert equality for every version with the same `saleId`.
- Ambient time/locale can make attribution tests flaky; use `TimeProvider` and fixed frontend timezone/locale.

## Stop conditions
Остановиться и не писать production-код, если:
- task-specific branch не создана от чистого актуального `main`;
- проверка кода опровергает стабильность `ClientMembershipSale.Id` для correction/payment/write-off versions;
- комментарий нельзя изолировать от финансовой sale aggregate без изменения sale/payment/refund semantics;
- comment read или mutation невозможно авторизовать существующим `ManageClients` без RBAC redesign;
- schema change требует необратимого production backfill или удаления legacy membership data;
- scope расширяется до comment history, concurrency control, notifications, bot/report consumers или общей переработки membership history UI;
- тесты не могут доказать отсутствие финансовых/временных/write-off side effects и изоляцию между sales.

Backend + frontend scope, nullable schema change, shared client card, membership roles и audit сами по себе не являются stop condition.

## Ready for Codex execution
no

Причина: задача остаётся high-risk (`Safe for Codex: no`) рядом с membership persistence, permissions, audit и финансовыми данными. План локализует comment на стабильной `ClientMembershipSale` identity и готов к review; активное исполнение допустимо только после явного перевода задачи в implementation, в указанной отдельной ветке и строго test-first.
