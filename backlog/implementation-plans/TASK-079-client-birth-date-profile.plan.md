# Implementation Plan: TASK-079 Добавить дату рождения и возраст в профиль клиента

## Source task
/backlog/risky/TASK-079-client-birth-date-profile.md

Source status remains `risky`: задача имеет `Risk level: high` и `Safe for Codex: no`, поэтому этим planning-run она не перемещается в `/backlog/implementation`. План разрешает review и test-first подготовку, но production-код можно менять только после явного перевода задачи в implementation.

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
- Дату рождения следует добавить только в create/update/details contract. Списки клиентов, attendance, attention, reports, bot и фильтры не расширяются.
- Backend contract использует nullable `DateOnly`, а PostgreSQL — nullable колонку `date`. Невалидная JSON-дата отклоняется стандартным ASP.NET Core binding/ProblemDetails; отдельные минимальные, максимальные и future-date validators не добавляются.
- Обновление с `birthDate: null` очищает значение. На create отсутствие поля и явный `null` эквивалентны. Существующие строки после additive migration получают `NULL`; backfill и default value запрещены.
- API возвращает `birthDate` как `YYYY-MM-DD` без времени и offset. Поле `age` в API не добавляется и в БД не хранится: возраст является presentation-derived значением карточки.
- Frontend хранит дату формы как ISO date-only string, отправляет непустое значение либо явный `null`, а mapper сохраняет только `YYYY-MM-DD`. Запрещено разбирать bare ISO date через `new Date("YYYY-MM-DD")`.
- Возраст вычисляется чистой frontend-функцией от `birthDate` и явно переданной текущей локальной календарной даты. Для `birthDate <= today` разность годов уменьшается на один, если день рождения в текущем году ещё не наступил; для future date зеркально возвращается отрицательное число полных календарных лет от `today` до `birthDate`. Для 29 февраля в невисокосный год возраст увеличивается 1 марта. Результат не хранится и пересчитывается при новом render/reload.
- Future birth date должна приниматься и round-trip без изменения. Подписанная календарная формула применяется без скрытого clamp и без превращения отображения в backend validation.
- В карточке `Дата рождения` видна всем пользователям, которым backend вернул details. При `null` показывается существующий нейтральный empty value, а отдельная строка/ячейка `Возраст` не рендерится.
- Существующие `ClientCreated`/`ClientUpdated` audit snapshots уже содержат old/new state. Добавление `BirthDate` в `ClientAuditState` обеспечивает требуемую audit-семантику без нового action type; дата не должна попадать в audit description или технические error logs.

## Safe decomposition
1. **Persistence and API contract:** nullable `DateOnly`, additive migration, create/update/details round-trip и стандартная validation.
2. **Permissions and audit:** оба details mapper, прежняя role/scope матрица и old/new audit snapshots.
3. **Frontend contract and form:** typed nullable field, create/edit/clear payload и отсутствие timezone conversion.
4. **Derived presentation:** изолированные format/age helpers, пустое состояние, leap-day и calendar-boundary tests.
5. **Cross-layer regression:** API, component и Playwright create/edit/clear/reload scenarios на desktop и narrow viewport.

Каждый slice начинается с новых падающих тестов и завершается локальным green run до перехода к следующему.

## Execution steps
1. Создать `feature/TASK-079-client-birth-date-profile` от чистого актуального `main`; до этого не менять project code.
2. Зафиксировать additive contract:
   - request: `birthDate: DateOnly?`;
   - details response: `birthDate: DateOnly?`;
   - JSON: точное `YYYY-MM-DD` или `null`;
   - очистка: явный `null`;
   - `age` не является API/persistence field.
3. **До production-кода** добавить backend persistence/model tests:
   - `Client.BirthDate` существует, nullable и имеет PostgreSQL column type `date`;
   - migration script добавляет nullable колонку без default/backfill;
   - clean schema/migration chain содержит колонку и остаётся воспроизводимой.
4. **До production-кода** расширить `ClientsApiTests`:
   - create с датой и без неё, точный create/details/reload JSON и persisted `DateOnly?`;
   - update: установить, изменить и очистить ранее заданное значение;
   - omitted/`null` create оставляет значение пустым, legacy client после migration остаётся валидным;
   - malformed/impossible date возвращает стандартный `400 application/problem+json` и не изменяет persisted client;
   - future date принимается без product-range error;
   - date-only round-trip для `2000-02-29` и календарных границ не добавляет время/offset и не меняет день;
   - Administrator/HeadCoach сохраняют поле, assigned Coach видит его в details, Coach не может изменять, unassigned Coach не получает карточку;
   - `ClientCreated`/`ClientUpdated` audit old/new snapshots содержат точное nullable `birthDate`, включая change и clear, без отдельного audit action и без даты в description.
5. **До production-кода** добавить frontend API/form tests:
   - `getClient` mapper принимает exact date-only и `null`, не создавая `Date`;
   - `toClientFormValues` заполняет `YYYY-MM-DD` или пустую строку;
   - create/update payload всегда передаёт непустую дату либо `birthDate: null`, поэтому clear не превращается в случайное omission;
   - backend `birthDate` field error/ProblemDetails сохраняет draft и отображается рядом с полем либо в существующем form error, согласно фактической стандартной binding-семантике.
6. **До production-кода** добавить unit/component tests для отображения:
   - полные годы непосредственно до дня рождения, в день рождения и после него;
   - 29 февраля: до/после даты и переход возраста 1 марта в невисокосный год;
   - 31 декабря/1 января и fixed `today` независимо от timezone test process;
   - точное форматирование `YYYY-MM-DD` без UTC shift;
   - details card показывает дату и возраст для canManage=true и scoped Coach, а при `null` показывает только empty date field;
   - future value отображается без отклонения или silent normalization;
   - create/edit form использует optional date input без `min`/`max`.
7. **До production-кода** расширить существующие Playwright client flows в `stage12.spec.ts` либо создать focused `client-birth-date.spec.ts`:
   - create с датой отправляет точный payload и после перехода в details показывает дату/возраст;
   - edit предварительно заполняет дату, change сохраняется после reload;
   - clear отправляет `null`, после reload показывает empty date и не показывает age;
   - 390 px viewport не получает horizontal overflow, дата доступна по label и keyboard.
8. Запустить новые targeted backend/frontend/Playwright tests и подтвердить ожидаемое падение именно из-за отсутствующих schema/contract/form/helper/UI частей. Compile error после добавления нового contract property допустим только как первый короткий red step; перед production-кодом должны существовать behavioral failing assertions. Зафиксировать failing test names и причины в execution notes/PR.
9. Реализовать минимальный persistence slice:
   - добавить `DateOnly? BirthDate` в `Client`;
   - настроить property как nullable PostgreSQL `date`;
   - создать новую additive EF migration и обновить model snapshot;
   - не задавать default, check constraint, backfill, index или timezone conversion.
10. Реализовать backend contract/mutation:
    - добавить `BirthDate` в `UpsertClientRequest` и `NormalizedClientRequest` без дополнительной range validation;
    - присваивать поле при create/update, включая `null` для clear;
    - вернуть поле в `ClientDetailsResponse`, `MapDetails` и `MapCoachDetails`;
    - добавить поле в `ClientAuditState`/`SerializeAuditState`, сохранив текущие best-effort audit action/cardinality и permissions.
11. Реализовать frontend contract/form:
    - добавить nullable `birthDate` в details/payload types и mapper;
    - добавить `birthDate` в form values, initial/edit mapping и upsert payload;
    - использовать существующий Mantine `TextInput type="date"` либо эквивалентный нативный date-only control без новых timezone/date libraries и без range attributes;
    - сохранить draft и существующую обработку backend errors.
12. Вынести чистые helpers даты рождения/возраста из route component:
    - строго разобрать `YYYY-MM-DD` на числовые компоненты;
    - форматировать через локальный `Date(year, monthIndex, day)` или компонентное форматирование, но не через UTC parsing;
    - вычислять возраст от переданного calendar `today`, не от сохранённого state и не сохранять результат в API/БД;
    - отрендерить дату всем viewers и age только при непустой дате.
13. Запустить targeted tests после каждого slice, затем полный regression suite:
    - `dotnet test backend/GymCrm.slnx`;
    - `npm run test:unit`, `npm run lint`, `npm run build` в `frontend`;
    - affected Playwright client scenarios;
    - generated migration script/clean-database smoke.
14. Провести privacy/contract review и ручную проверку desktop/390 px: дата не появляется в list/bot/report responses, не сдвигается при смене timezone, очистка очевидна, отрицательное future-date значение не маскируется скрытой validation. Manual QA дополняет, но не заменяет automated barriers.

## Preferred implementation strategy
1. Additive contract-first change with nullable compatibility.
2. Backend-owned persistence, permissions, validation and audit semantics.
3. Frontend-only pure derivation for age, isolated from transport and form mutation.
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
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/<timestamp>_AddClientBirthDate.cs` (new)
- `backend/src/GymCrm.Infrastructure/Persistence/Migrations/<timestamp>_AddClientBirthDate.Designer.cs` (generated)
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

Exact generated migration filenames must be determined by the implementation timestamp. No project file may be edited before the corresponding red tests exist.

## Constraints
- Backend remains the sole owner of permissions, access scope, validation and audit.
- Preserve existing `ManageClients`/`ViewClients` policies and Coach group scope; do not add frontend-derived permission rules.
- Store only nullable `DateOnly`; never store age, timestamp, timezone or independently editable derived state.
- Serialize `birthDate` only as exact `YYYY-MM-DD`/`null`; do not round-trip through UTC.
- Do not add product range validation, HTML `min`/`max`, future-date rejection or implicit date correction.
- Clear must be explicit and durable: empty UI value sends `null`.
- Existing clients require no backfill and must remain valid after migration.
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
- Future-date deterministic calculation without clamp or validation.

Backend domain unit tests are not required if `BirthDate` remains a passive nullable value with no domain policy. Backend mapping, binding, persistence, permissions and audit behavior must instead be covered by API/persistence integration tests; manual QA is not a substitute.

### Integration tests
- EF model/migration column is nullable PostgreSQL `date`, with no default/backfill.
- Create/get/update/change/clear persistence and exact JSON round-trip.
- Existing/null clients remain valid.
- Invalid format/impossible date returns standard ProblemDetails and leaves state/audit unchanged.
- Future date is accepted.
- Administrator/HeadCoach write, assigned Coach read, Coach write denial and unassigned Coach denial.
- `ClientCreated`/`ClientUpdated` snapshots include exact nullable birth date for create/change/clear without extra audit event.
- Create/update response and a fresh GET/DbContext agree.

### UI/e2e tests
- Optional date input in create and edit.
- Exact request payload for set/change/clear.
- Details date and age survive navigation and reload.
- Empty date shows no age.
- Scoped Coach sees the value returned by backend.
- Keyboard/accessibility label and 390 px overflow smoke.

### Existing tests to update
- Client details fixtures in `ClientManagement.test.tsx`.
- `ClientState`/`toClientPayload` and create/edit payload assertions in `stage12.spec.ts`.
- Existing CRUD/audit assertions in `ClientsApiTests.cs` without weakening phone, note, contact, group, role or audit guarantees.

### Expected initial failure
- Backend tests fail because `Client`, migration, request/details and audit state lack `BirthDate`.
- Frontend tests fail because types, mapper, form payload and card do not consume/render the field and no age helper exists.
- Infrastructure startup failures, invalid fixtures, locale leakage or unrelated baseline regressions do not count as the required red behavior.

### Manual-only validation
- Visual density and wrapping of the two compact profile values on desktop and 390 px.
- Native date-input usability in supported browsers.
- Privacy review of actual client details/audit JSON and technical logs.

## Test plan
- [ ] Backend persistence/API/audit tests are written first and fail for the intended missing behavior.
- [ ] Frontend helper/mapper/component/e2e tests are written first and fail for the intended missing behavior.
- [ ] Create accepts exact date or `null`; update sets, changes and clears it.
- [ ] Invalid/impossible date returns standard `400` without mutation/audit side effects.
- [ ] Future date is accepted without range validation or silent correction.
- [ ] PostgreSQL stores nullable `date`; existing rows remain `NULL`.
- [ ] JSON always uses exact `YYYY-MM-DD`/`null` and does not shift across timezones.
- [ ] Administrator/HeadCoach write and scoped Coach read behavior remains protected by existing backend policies.
- [ ] General client audit old/new state contains birth date for create/change/clear with unchanged action cardinality.
- [ ] Full-year, year-boundary and 29-February cases pass against fixed calendar dates.
- [ ] Empty date renders no age; set date renders date and computed age for manager and Coach details.
- [ ] Create/edit/clear survive navigation and reload in Playwright.
- [ ] `dotnet test backend/GymCrm.slnx` passes.
- [ ] `npm run test:unit`, `npm run lint` and `npm run build` pass in `frontend`.
- [ ] Affected Playwright tests and clean migration/schema checks pass.

## Regression barrier
The primary barrier is a backend CRUD/permission/audit matrix in `ClientsApiTests` paired with an EF migration-model assertion that proves nullable PostgreSQL `date`, exact date-only serialization, set/change/clear semantics, standard invalid-date ProblemDetails and unchanged access/audit policies. Frontend pure-helper tests protect calendar and leap-day calculation, while mapper/component tests and a Playwright create/edit/clear/reload flow protect the consumer contract. Completion is blocked if tests can pass while shifting the date by timezone, storing age, omitting `null` clear, hiding the value from an authorized Coach, accepting a malformed date, adding an unrequested range restriction or losing the date from audit old/new state.

## Risks
- Bare ISO strings parsed as JavaScript UTC dates can display the previous/next day; component-based parsing and multi-timezone tests are mandatory.
- Leap-day behavior can differ by convention; this plan fixes the anniversary to 1 March in non-leap years and requires explicit tests.
- Allowing future dates can produce a negative derived value. The implementation must not silently clamp, reject or rewrite it; any alternative product behavior requires task clarification.
- Adding the field only to `MapDetails` would leak inconsistent visibility to Coach; both details paths need the same date contract.
- Omitting `birthDate` on update can accidentally clear or preserve it depending on serializer semantics; frontend must send explicit string/`null` and API tests must pin full-replacement behavior.
- Audit snapshots intentionally contain personal data. Reuse current access and retention semantics, avoid adding the date to descriptions/logs, and do not broaden audit exposure.
- A nullable migration is low-risk but generated migration/snapshot drift can break clean bootstrap; verify the generated script and full backend suite.
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
- acceptance criteria требуют иного поведения future date или 29 февраля, чем явно зафиксировано в этом плане.

Backend + frontend scope, shared client card, nullable schema change и персональное поле сами по себе не являются stop condition.

## Ready for Codex execution
no

Причина: source task остаётся high-risk (`Safe for Codex: no`) из-за персональных данных, schema/API, permissions и audit. План готов к review; после явного перевода задачи в implementation исполнение допустимо только в `feature/TASK-079-client-birth-date-profile` и строго через test-first этапы.
