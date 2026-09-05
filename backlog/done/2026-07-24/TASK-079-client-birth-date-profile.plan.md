# Implementation Plan: TASK-079 Добавить дату рождения и возраст в профиль клиента

## Source task
/backlog/done/2026-07-24/TASK-079-client-birth-date-profile.md

Source status is `done`: задача явно одобрена пользователем 2026-07-23, переведена из `/backlog/risky` перед началом production-изменений и завершена 2026-07-23 после прохождения всех обязательных проверок.

## Git branch
feature/TASK-079-client-birth-date-profile

Branch rules:
- перед реализацией убедиться, что план одобрен, а source task переведён из `/backlog/risky` в `/backlog/implementation`;
- проверить чистый worktree, перейти на `main`, выполнить `git pull` и создать `feature/TASK-079-client-birth-date-profile` от актуального `main`;
- подтвердить активную task branch до первого изменения project-кода;
- не включать поиск/фильтры по возрасту, поздравления, отчёты, переработку client permissions или несвязанный рефакторинг;
- остановить выполнение, если worktree dirty, текущая ветка неясна либо branch создана не от `main`.

## Goal
Пользователь с существующим доступом к карточке клиента может необязательно указать дату рождения при создании, изменить или очистить её при редактировании и увидеть в карточке точную календарную дату вместе с возрастом в полных годах. Значение хранится и передаётся как date-only, не зависит от часового пояса и не требует backfill существующих клиентов.

## Current understanding
- `Client` и `ClientConfiguration` пока не содержат дату рождения; PostgreSQL-модель использует EF Core migrations и model snapshot.
- Создание и обновление клиента используют один full-replacement contract `UpsertClientRequest` → `NormalizedClientRequest`; details response формируется двумя путями: `MapDetails` для Administrator/HeadCoach и `MapCoachDetails` для Coach.
- `POST /clients` и `PUT /clients/{id}` уже защищены `ManageClients`; `GET /clients/{id}` использует `ViewClients` и дополнительно ограничивает Coach назначенными ему группами. Новых permissions и frontend role rules не требуется.
- Дату рождения следует добавить только в create/update/details contract. Details response также возвращает `businessDate` из существующего `IBusinessDateProvider.Today`, чтобы frontend вычислял возраст по календарной дате клуба. Списки клиентов, attendance, attention, reports, bot и фильтры не расширяются.
- Backend contract использует nullable `DateOnly`, а PostgreSQL — nullable колонку `date`. Невалидная JSON-дата отклоняется стандартным ASP.NET Core binding/ProblemDetails; отдельные минимальные, максимальные и future-date validators не добавляются.
- Обновление с `birthDate: null` очищает значение. На create отсутствие поля и явный `null` эквивалентны. При чистом разворачивании начальная схема создаёт nullable-колонку; seed/fixture-клиенты без значения получают `NULL`, backfill и default value запрещены.
- API возвращает `birthDate` и `businessDate` как `YYYY-MM-DD` без времени и offset. `businessDate` берётся из существующего backend-owned `IBusinessDateProvider.Today`. Поле `age` в API не добавляется и в БД не хранится: возраст является presentation-derived значением карточки.
- Frontend хранит дату формы как ISO date-only string, отправляет непустое значение либо явный `null`, а mapper сохраняет `birthDate` и `businessDate` только как `YYYY-MM-DD`. Запрещено разбирать bare ISO date через `new Date("YYYY-MM-DD")`.
- Возраст вычисляется чистой frontend-функцией от `birthDate` и явно переданной backend business date. Для `birthDate <= businessDate` разность годов уменьшается на один, если день рождения в текущем году ещё не наступил. Для 29 февраля в невисокосный год возраст увеличивается 1 марта. Результат не хранится и пересчитывается при новом details response/render.
- Future birth date должна приниматься и round-trip без изменения. Для `birthDate > businessDate` helper не возвращает отрицательный возраст, а карточка показывает `Не вычисляется`; это presentation state, а не frontend/backend validation, clamp или исправление сохранённой даты.
- В карточке `Дата рождения` видна всем пользователям, которым backend вернул details, и отображается в русском календарном формате без timezone conversion. При `null` показывается существующий нейтральный empty value, а отдельная строка/ячейка `Возраст` не рендерится. При непустой future date строка/ячейка `Возраст` рендерится со значением `Не вычисляется`.
- Существующие `ClientCreated`/`ClientUpdated` audit snapshots уже содержат old/new state. Добавление `BirthDate` в `ClientAuditState` обеспечивает требуемую audit-семантику без нового action type; дата не должна попадать в audit description или технические error logs.

## Safe decomposition
1. **Persistence and API contract:** nullable `DateOnly`, обновлённая начальная схема, create/update/details round-trip и стандартная validation.
2. **Permissions and audit:** оба details mapper, прежняя role/scope матрица и old/new audit snapshots.
3. **Frontend contract and form:** typed nullable field, create/edit/clear payload и отсутствие timezone conversion.
4. **Derived presentation:** backend business date, изолированные format/age helpers, пустое/future состояние, русский формат, leap-day и calendar-boundary tests.
5. **Cross-layer regression:** API, component и Playwright create/edit/clear/reload scenarios на desktop и narrow viewport.

Каждый slice начинается с новых падающих тестов и завершается локальным green run до перехода к следующему.

## Execution steps
1. Создать `feature/TASK-079-client-birth-date-profile` от чистого актуального `main`; до этого не менять project code.
2. Зафиксировать additive contract:
   - request: `birthDate: DateOnly?`;
   - details response: `birthDate: DateOnly?`, `businessDate: DateOnly`;
   - JSON: точное `YYYY-MM-DD` или `null` для `birthDate`, точное `YYYY-MM-DD` для `businessDate`;
   - очистка: явный `null`;
   - `age` не является API/persistence field.
3. **До production-кода** добавить backend persistence/model tests:
   - `Client.BirthDate` существует, nullable и имеет PostgreSQL column type `date`;
   - начальная migration/schema создаёт nullable колонку без default/backfill;
   - clean schema chain содержит колонку и остаётся воспроизводимой.
4. **До production-кода** расширить `ClientsApiTests`:
   - create с датой и без неё, точный create/details/reload JSON, backend-provided `businessDate` и persisted `DateOnly?`;
   - update: установить, изменить и очистить ранее заданное значение;
   - omitted/`null` create оставляет значение пустым, seed/fixture client без даты остаётся валидным;
   - malformed/impossible date возвращает стандартный `400 application/problem+json` и не изменяет persisted client;
   - future date принимается без product-range error;
   - date-only round-trip для `2000-02-29` и календарных границ не добавляет время/offset и не меняет день;
   - `businessDate` совпадает с `IBusinessDateProvider.Today`, включая границы UTC-дня для настроенной timezone клуба;
   - Administrator/HeadCoach сохраняют поле, assigned Coach видит его в details, Coach не может изменять, unassigned Coach не получает карточку;
   - `ClientCreated`/`ClientUpdated` audit old/new snapshots содержат точное nullable `birthDate`, включая change и clear, без отдельного audit action и без даты в description.
5. **До production-кода** добавить frontend API/form tests:
   - `getClient` mapper принимает exact `birthDate`/`businessDate` и `null`, не создавая `Date`;
   - `toClientFormValues` заполняет `YYYY-MM-DD` или пустую строку;
   - create/update payload всегда передаёт непустую дату либо `birthDate: null`, поэтому clear не превращается в случайное omission;
   - backend `birthDate` field error/ProblemDetails сохраняет draft и отображается рядом с полем либо в существующем form error, согласно фактической стандартной binding-семантике.
6. **До production-кода** добавить unit/component tests для отображения:
   - полные годы непосредственно до дня рождения, в день рождения и после него;
   - 29 февраля: до/после даты и переход возраста 1 марта в невисокосный год;
   - 31 декабря/1 января и fixed `businessDate` независимо от timezone test process;
   - русский календарный формат даты рождения без UTC shift; wire/form value остаётся точным `YYYY-MM-DD`;
   - details card показывает дату и возраст для canManage=true и scoped Coach, а при `null` показывает только empty date field;
   - future value отображается без отклонения или silent normalization, а возраст имеет значение `Не вычисляется`;
   - create/edit form использует optional date input без `min`/`max`.
7. **До production-кода** расширить существующие Playwright client flows в `stage12.spec.ts` либо создать focused `client-birth-date.spec.ts`:
   - create с датой отправляет точный payload и после перехода в details показывает русскую дату/возраст, рассчитанный от server-returned `businessDate`;
   - edit предварительно заполняет дату, change сохраняется после reload;
   - clear отправляет `null`, после reload показывает empty date и не показывает age;
   - 390 px viewport не получает horizontal overflow, дата доступна по label и keyboard.
8. Запустить новые targeted backend/frontend/Playwright tests и подтвердить ожидаемое падение именно из-за отсутствующих schema/contract/form/helper/UI частей. Compile error после добавления нового contract property допустим только как первый короткий red step; перед production-кодом должны существовать behavioral failing assertions. Зафиксировать failing test names и причины в execution notes/PR.
9. Реализовать минимальный persistence slice:
   - добавить `DateOnly? BirthDate` в `Client`;
   - настроить property как nullable PostgreSQL `date`;
   - не создавать новую migration; обновить начальную EF migration и model snapshot;
   - не задавать default, check constraint, backfill, index или timezone conversion.
10. Реализовать backend contract/mutation:
    - добавить `BirthDate` в `UpsertClientRequest` и `NormalizedClientRequest` без дополнительной range validation;
    - присваивать поле при create/update, включая `null` для clear;
   - вернуть `BirthDate` и backend-owned `BusinessDate` в `ClientDetailsResponse`, `MapDetails` и `MapCoachDetails`; все details-producing endpoints используют `IBusinessDateProvider.Today`, а не `DateTime.UtcNow` или дату клиента;
    - добавить поле в `ClientAuditState`/`SerializeAuditState`, сохранив текущие best-effort audit action/cardinality и permissions.
11. Реализовать frontend contract/form:
    - добавить nullable `birthDate` и обязательный `businessDate` в details/payload types и mapper;
    - добавить `birthDate` в form values, initial/edit mapping и upsert payload;
    - использовать существующий Mantine `TextInput type="date"` либо эквивалентный нативный date-only control без новых timezone/date libraries и без range attributes;
    - сохранить draft и существующую обработку backend errors.
12. Вынести чистые helpers даты рождения/возраста из route component:
    - строго разобрать `YYYY-MM-DD` на числовые компоненты;
    - форматировать дату рождения в русском календарном формате через безопасное компонентное преобразование, корректное в том числе для годов `0001`–`0099`, но не через UTC parsing;
    - вычислять возраст от переданного `businessDate`, полученного от backend, не от часов/часового пояса браузера и не сохранять результат в API/БД;
    - отрендерить дату всем viewers и age только при непустой дате; для future date показать `Не вычисляется`.
13. Запустить targeted tests после каждого slice, затем полный regression suite:
    - `dotnet test backend/GymCrm.slnx`;
    - `npm run test:unit`, `npm run lint`, `npm run build` в `frontend`;
    - affected Playwright client scenarios;
    - initial migration script/clean-database smoke.
14. Провести privacy/contract review и ручную проверку desktop/390 px: дата не появляется в list/bot/report responses, русский формат не сдвигается при смене timezone браузера, возраст считается по backend business date, очистка очевидна, future date показывает `Не вычисляется` без скрытой validation. Manual QA дополняет, но не заменяет automated barriers.

## Preferred implementation strategy
1. Additive contract-first change with nullable compatibility.
2. Backend-owned persistence, permissions, validation and audit semantics.
3. Frontend-only pure derivation for age from backend-provided business date, isolated from transport and form mutation.
4. Small verifiable commits: red tests, persistence/API, frontend contract/form, presentation/e2e.
5. No feature flag is required: nullable request/response fields preserve existing clients and consumers.

## Files likely to change

### Backend tests first
- `backend/tests/GymCrm.Tests/ClientPersistenceModelTests.cs` (new) or the nearest focused persistence-model test
- `backend/tests/GymCrm.Tests/ClientsApiTests.cs`
- `backend/tests/GymCrm.Tests/BootstrapSmokeTests.cs` only if the existing migration smoke is the nearest clean-schema assertion

### Backend production after red phase
- `backend/src/GymCrm.Domain/Clients/Client.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Configurations/ClientConfiguration.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/20260513165936_InitialCreate.Designer.cs`
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/GymCrmDbContextModelSnapshot.cs`
- `backend/src/GymCrm.Api/Auth/UpsertClientRequest.cs`
- `backend/src/GymCrm.Api/Auth/NormalizedClientRequest.cs`
- `backend/src/GymCrm.Api/Auth/ClientDetailsResponse.cs`
- `backend/src/GymCrm.Api/Auth/ClientAuditState.cs`
- `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs`

### Frontend tests first
- `frontend/src/lib/api/clients.test.ts`
- `frontend/src/features/clients/clientBirthDate.test.ts` (new)
- `frontend/src/features/clients/ClientManagement.test.tsx`
- `frontend/e2e/stage12.spec.ts` or `frontend/e2e/client-birth-date.spec.ts` (new)

### Frontend production after red phase
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/clients.ts`
- `frontend/src/features/clients/ClientManagement.form.ts`
- `frontend/src/features/clients/clientBirthDate.ts` (new)
- `frontend/src/features/clients/ClientManagement.tsx`

Новая migration не создаётся: пользователь требует обновить начальную точку, поскольку комплекс будет развёрнут с нуля. No project file may be edited before the corresponding red tests exist.

## Constraints
- Backend remains the sole owner of permissions, access scope, validation and audit.
- Preserve existing `ManageClients`/`ViewClients` policies and Coach group scope; do not add frontend-derived permission rules.
- Store only nullable `DateOnly`; never store age, timestamp, timezone or independently editable derived state.
- Serialize `birthDate` as exact `YYYY-MM-DD`/`null` and `businessDate` as exact `YYYY-MM-DD`; do not round-trip either value through UTC.
- Calculate age only from backend-provided `businessDate`; browser local date/timezone must not affect it.
- Do not add product range validation, HTML `min`/`max`, future-date rejection or implicit date correction.
- Future date remains valid and visible, while its age presentation is `Не вычисляется`.
- Clear must be explicit and durable: empty UI value sends `null`.
- Seed/fixture clients without the field remain valid; no backfill or default is introduced.
- Reuse existing general client audit semantics; do not create a separate birthday audit event or change audit atomicity/cardinality.
- Make birth date visible in details to every backend-authorized viewer, including scoped Coach, but do not expand list, search, filter, report, attention, attendance or bot contracts.
- Preserve Mantine/Onest and the current compact client overview/form layout.

## Out of scope
- Age/date filters, sorting, list columns or search.
- Birthday reminders, congratulations, notifications, dashboards or reports.
- Age categories, group assignment rules or eligibility decisions.
- Additional personal data.
- RBAC/access-scope redesign or field-level permissions distinct from the client card.
- Backfill/data import for existing clients.
- Storing age or returning a separately versioned age field from backend.
- Global date/time utility refactor or replacement of unrelated membership date formatting.
- Audit service redesign, transactional outbox or historical audit repair.

## Required test coverage

All new or updated unit and integration tests MUST be written before functional code. The first focused run must fail for the expected missing behavior; implementation starts only after the red phase is recorded.

### Unit tests
- Frontend strict date-only parsing/formatting without UTC conversion.
- Full-year calculation before/on/after birthday and across year boundaries.
- Leap-day semantics: age changes on 1 March in a non-leap year.
- Nullable form/details mapping and explicit `null` clear payload.
- Russian calendar formatting with the wire/form value preserved as `YYYY-MM-DD`.
- Future-date deterministic `Не вычисляется` result without rejection, clamp or mutation.

Backend domain unit tests are not required if `BirthDate` remains a passive nullable value with no domain policy. Backend mapping, binding, persistence, permissions and audit behavior must instead be covered by API/persistence integration tests; manual QA is not a substitute.

### Integration tests
- EF model/initial migration column is nullable PostgreSQL `date`, with no default/backfill.
- Create/get/update/change/clear persistence and exact JSON round-trip.
- Existing/null clients remain valid.
- Invalid format/impossible date returns standard ProblemDetails and leaves state/audit unchanged.
- Future date is accepted.
- Details `businessDate` equals `IBusinessDateProvider.Today` at configured business-timezone boundaries.
- Administrator/HeadCoach write, assigned Coach read, Coach write denial and unassigned Coach denial.
- `ClientCreated`/`ClientUpdated` snapshots include exact nullable birth date for create/change/clear without extra audit event.
- Create/update response and a fresh GET/DbContext agree.

### UI/e2e tests
- Optional date input in create and edit.
- Exact request payload for set/change/clear.
- Details date and age survive navigation and reload.
- Empty date shows no age.
- Future date shows `Не вычисляется`; non-future age uses `businessDate` from the details payload.
- The card uses Russian date formatting while request/form values stay `YYYY-MM-DD`.
- Scoped Coach sees the value returned by backend.
- Keyboard/accessibility label and 390 px overflow smoke.

### Existing tests to update
- Client details fixtures in `ClientManagement.test.tsx`.
- `ClientState`/`toClientPayload` and create/edit payload assertions in `stage12.spec.ts`.
- Existing CRUD/audit assertions in `ClientsApiTests.cs` without weakening phone, note, contact, group, role or audit guarantees.

### Expected initial failure
- Backend tests fail because `Client`, initial schema, request/details and audit state lack `BirthDate`, and details do not expose `BusinessDate`.
- Frontend tests fail because types, mapper, form payload and card do not consume/render `birthDate`/`businessDate` and no age helper exists.
- Infrastructure startup failures, invalid fixtures, locale leakage or unrelated baseline regressions do not count as the required red behavior.

### Manual-only validation
- Visual density and wrapping of the two compact profile values on desktop and 390 px.
- Native date-input usability in supported browsers.
- Privacy review of actual client details/audit JSON and technical logs.

## Test plan
- [x] Backend persistence/API/audit tests are written first and fail for the intended missing behavior.
- [x] Frontend helper/mapper/component/e2e tests are written first and fail for the intended missing behavior.
- [x] Create accepts exact date or `null`; update sets, changes and clears it.
- [x] Invalid/impossible date returns standard `400` without mutation/audit side effects.
- [x] Future date is accepted without range validation or silent correction.
- [x] PostgreSQL stores nullable `date`; existing rows remain `NULL`.
- [x] JSON uses exact date-only `birthDate`/`businessDate` values and does not shift across timezones.
- [x] `businessDate` comes from the configured club business date provider; browser timezone does not change age.
- [x] Administrator/HeadCoach write and scoped Coach read behavior remains protected by existing backend policies.
- [x] General client audit old/new state contains birth date for create/change/clear with unchanged action cardinality.
- [x] Full-year, year-boundary and 29-February cases pass against fixed calendar dates.
- [x] Empty date renders no age; set non-future date renders Russian-formatted date and computed age for manager and Coach details.
- [x] Future date renders in Russian format and shows `Не вычисляется` instead of a negative age.
- [x] Create/edit/clear survive navigation and reload in Playwright.
- [x] `dotnet test backend/GymCrm.slnx` passes.
- [x] `npm run test:unit`, `npm run lint` and `npm run build` pass in `frontend`.
- [x] Affected Playwright tests and clean initial-schema checks pass.

## Execution notes
- Branch preparation: актуальный чистый `main` подтверждён, выполнен `git pull --ff-only`, создана ветка `feature/TASK-079-client-birth-date-profile`.
- Agents: backend slice реализован `dotnet-backend-specialist`, frontend slice — `react-specialist`; `ui-designer` подготовил implementation-ready UI guidance, `test-automator` выполнил независимое покрытие/контрактное ревью, `docker-expert` проверил clean-bootstrap сценарий.
- Backend red: persistence/API tests сначала падали из-за отсутствующих `Client.BirthDate`, nullable PostgreSQL `date`, details/business-date и audit projections. Дополнительный malformed-update тест выявил, что стандартный minimal-API binder не давал локально гарантировать требуемый ProblemDetails contract без глобального изменения остальных endpoint.
- Frontend red: mapper/form/component tests падали из-за отсутствующих `birthDate`/`businessDate`, explicit-null payload, чистого date-only helper и UI-полей; Playwright не находил поле и новые отображаемые значения.
- Backend green: `dotnet test backend/GymCrm.slnx` — 240/240; invalid/impossible create/update возвращают локальный `400 application/problem+json` без mutation/audit, а binding других endpoint не был глобально изменён.
- Frontend green: `npm run test:unit` — 27 файлов и 181 тест; `npm run lint` и `npm run build` прошли. Affected Playwright run — 3/3.
- Full `stage12.spec.ts` exploratory run: 17 сценариев прошли; два существующих home-dashboard сценария не дошли до предметных assertions из-за отсутствующего `/api/clients/attention` mock и не относятся к TASK-079. Затронутые create/edit/change/clear/reload/390 px сценарии прошли отдельно.
- Initial schema: новая migration не создана. `BirthDate date NULL` добавлена в `InitialCreate`, синхронизированы оба designer и model snapshot; `dotnet-ef migrations has-pending-model-changes` сообщает отсутствие drift.
- Clean bootstrap: локальные volumes точечно удалены после резервной копии `/tmp/crm-task079-pre-reset.U2QiE4/gym_crm.sql`; комплекс заново собран и поднят с нуля. В PostgreSQL подтверждены `date`, nullable, отсутствие default/index/check и только две исходные migration history записи. Backend, frontend, frontend proxy, bot и DB healthy.
- Manual QA: desktop create/edit/reopen показывает `29 февраля 2000 г.` и `26 лет`; future date показывает `Не вычисляется`; на ширине 390 px форма доступна по label и горизонтального overflow нет. Очистка и reload дополнительно закреплены Playwright-тестом.

## Regression barrier
The primary barrier is a backend CRUD/permission/audit matrix in `ClientsApiTests` paired with an EF initial-schema/model assertion that proves nullable PostgreSQL `date`, exact date-only serialization, backend-owned `businessDate`, set/change/clear semantics, standard invalid-date ProblemDetails and unchanged access/audit policies. Frontend pure-helper tests protect Russian formatting, business-date calendar calculation, the 1 March leap-day rule and the future-date `Не вычисляется` state, while mapper/component tests and a Playwright create/edit/clear/reload flow protect the consumer contract. Completion is blocked if tests can pass while shifting the date by timezone, deriving age from browser time, showing a negative future age, storing age, omitting `null` clear, hiding the value from an authorized Coach, accepting a malformed date, adding an unrequested range restriction or losing the date from audit old/new state.

## Risks
- Bare ISO strings parsed as JavaScript UTC dates can display the previous/next day; component-based parsing and multi-timezone tests are mandatory.
- Leap-day behavior can differ by convention; this plan fixes the anniversary to 1 March in non-leap years and requires explicit tests.
- Browser-local `today` can disagree with the configured club calendar near midnight; details must expose `IBusinessDateProvider.Today` and age helpers must consume that exact value.
- Allowing future dates can produce a negative derived value in a naive formula. The helper must instead return a non-computable state rendered as `Не вычисляется`, without rejecting or rewriting the date.
- Adding the field only to `MapDetails` would leak inconsistent visibility to Coach; both details paths need the same date contract.
- Omitting `birthDate` on update can accidentally clear or preserve it depending on serializer semantics; frontend must send explicit string/`null` and API tests must pin full-replacement behavior.
- Audit snapshots intentionally contain personal data. Reuse current access and retention semantics, avoid adding the date to descriptions/logs, and do not broaden audit exposure.
- Изменение initial migration/model snapshot может дать drift и сломать clean bootstrap; проверить initial script и полный backend suite.
- Shared `ClientDetails`/Playwright fixtures are strict and can hide contract regressions if defaults are fabricated; update fixtures explicitly and keep mapper assertions.

## Stop conditions
Остановиться и не писать production-код, если:
- source task не переведён из risky в implementation или task-specific branch не создана от чистого актуального `main`;
- фактический API использует PATCH/partial-update semantics, при которых безопасный set/clear невозможно определить без изменения контракта;
- `DateOnly` не может быть сохранён как PostgreSQL `date` без timestamp/timezone conversion;
- для показа даты Coach требуется расширить его client scope или обойти backend authorization;
- audit snapshot нельзя расширить без раскрытия birth date вне существующего защищённого audit access/retention boundary;
- schema change требует обязательного production backfill, irreversible transformation или downtime strategy вне исходной задачи;
- scope расширяется до фильтров, уведомлений, age-based rules, field-level RBAC или системного date utility refactor;
- backend business date невозможно передать details consumers без дублирования timezone rule во frontend;
- acceptance criteria требуют иного поведения future date, business date, русского формата или 29 февраля, чем явно зафиксировано в этом плане.

Backend + frontend scope, shared client card, nullable schema change и персональное поле сами по себе не являются stop condition.

## Ready for Codex execution
completed

Основание: пользователь явно одобрил реализацию; source task завершена. Исполнение выполнено только в `feature/TASK-079-client-birth-date-profile` через test-first этапы и обязательные regression/clean-bootstrap проверки.
