# Implementation Plan: TASK-060 Расширить блок абонементов на главной истекшими абонементами

## Source task
/backlog/done/TASK-060-expired-memberships-access.md

Source task remains in `/backlog/risky` until explicit implementation review/selection.

## Implementation branch
feature/TASK-060-expired-memberships-access

Branch rules:
- create this branch from `main` before writing code;
- before branch creation, run `git status`, switch to `main`, pull latest changes, and verify the worktree is clean;
- do not implement other unrelated TASKs in this branch;
- confirm the branch is active before making project code changes.

## Goal
Администратор и главный тренер видят на главной единую область внимания по абонементам: текущие абонементы клиентов, которые уже истекли, скоро истекут или не оплачены. Backend возвращает явное состояние `Expired` / `ExpiringSoon` / `Unpaid`; frontend только отображает это состояние и не вычисляет его по дате.

## Current understanding
- Сейчас backend endpoint `/clients/expiring-memberships` реализован в `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs`.
- Endpoint защищен `GymCrmAuthorizationPolicies.ManageClients`, который уже доступен `HeadCoach` и `Administrator` и недоступен обычному `Coach`.
- Текущая backend-выборка возвращает только активных клиентов с текущим абонементом, у которого `ExpirationDate >= today` и `ExpirationDate < today + ExpiringMembershipWindowDays`.
- Текущий response `ExpiringClientMembershipListItemResponse` содержит `clientId`, `fullName`, `membershipType`, `expirationDate`, `daysUntilExpiration`, `isPaid`, но не содержит явного состояния абонемента.
- Во frontend `HomeDashboard` вызывает `getExpiringClientMemberships`, сортирует по `daysUntilExpiration`, показывает блок `Истекающие абонементы` и форматирует дни до окончания без различения просрочки.
- В списке клиентов уже есть frontend/backend понятие membership state `Expired`, но TASK-060 требует состояние именно в home-сценарии, чтобы frontend не выводил `Expired` эвристикой.
- Telegram-bot endpoint для expiring memberships найден отдельно и остается out of scope, если реализация CRM home не меняет bot contract.

## Product decisions from review
- Неоплаченные текущие абонементы должны отображаться в этой же области внимания даже тогда, когда они не истекли и не попадают в окно скорого истечения.
- Профессиональные клиенты не отображаются в этой области внимания.
- Если абонемент одновременно истек и не оплачен, основной `state` должен быть `Expired`, а `isPaid: false` должен отобразиться отдельным badge `Не оплачен`.
- Сохраняется текущая верхняя форма ответа endpoint: меняются поля элемента, но endpoint не переводится на новый envelope вида `{ items: [...] }`.
- Истекшие абонементы показываются все, без нижней границы по давности.
- Внутри группы `Expired` первыми идут недавно истекшие абонементы.
- Frontend gating должен использовать `user.permissions.canManageClients`, а не прямую проверку роли.
- Human review считается достаточным для перевода плана в исполнение.

## Execution steps
1. Подготовить ветку `feature/TASK-060-expired-memberships-access` от актуального `main` после проверки чистого git status.
2. Перечитать `AGENTS.md`, `backend/AGENTS.md` и `frontend/AGENTS.md` перед изменениями, потому что задача затрагивает backend-owned membership/access semantics и frontend contract consumption.
3. Зафиксировать backend contract для home membership attention item:
   - сохранить существующий URL `/clients/expiring-memberships` для совместимости, если нет сильной причины вводить новый route;
   - сохранить текущую верхнюю форму ответа endpoint, без перехода на новый envelope;
   - расширить response явным полем состояния `state: "Expired" | "ExpiringSoon" | "Unpaid"`;
   - считать `Unpaid` состоянием для текущего неоплаченного абонемента, который не попал в `Expired` или `ExpiringSoon`;
   - для frontend view model добавить fallback `Unknown` для отсутствующего или неожиданного `state` из backend, но backend contract должен возвращать только `Expired`, `ExpiringSoon` или `Unpaid`;
   - сохранить отдельное поле `isPaid`, чтобы оплата не смешивалась с состоянием истечения;
   - сохранить `daysUntilExpiration`, где для expired ожидаемо отрицательное значение, но frontend не должен использовать знак как источник состояния;
   - если `Unpaid` item не имеет даты окончания, разрешить nullable `expirationDate` / `daysUntilExpiration` и отобразить это явно на frontend.
4. Обновить backend DTO:
   - переименовать `ExpiringClientMembershipListItemResponse` в более точное имя вроде `MembershipAttentionListItemResponse` либо оставить файл/тип с совместимым именем и добавить `State`, если переименование даст слишком много churn;
   - при переименовании проверить все references и serialization shape.
5. Обновить backend selection logic:
   - брать только активных непрофессиональных клиентов с текущим membership (`ValidTo == null`);
   - определять `Expired`, если `ExpirationDate < today`;
   - определять `ExpiringSoon`, если `ExpirationDate >= today` и `ExpirationDate < today.AddDays(ExpiringMembershipWindowDays)`;
   - определять `Unpaid`, если текущий абонемент `IsPaid == false` и он не попал в `Expired` / `ExpiringSoon`;
   - использовать precedence `Expired` -> `ExpiringSoon` -> `Unpaid`, чтобы истекший неоплаченный абонемент отображался как `Expired` + отдельный `isPaid: false`;
   - включать неоплаченные текущие абонементы без даты окончания как `Unpaid`;
   - исключать клиентов без текущего абонемента, профессиональных клиентов, inactive/archived клиентов, оплаченные абонементы без даты окончания и оплаченные будущие окончания вне окна внимания;
   - не менять правила покупки, продления, оплаты, списания посещений или общую membership semantics.
6. Обновить backend ordering:
   - возвращать `Expired` первыми;
   - внутри `Expired` сортировать по дате окончания от недавно истекших к более старым, затем по ФИО/id;
   - затем `ExpiringSoon` по ближайшей дате окончания и ФИО/id;
   - затем `Unpaid` items, которые не expired/expiring, детерминированно по дате окончания при наличии даты, затем по ФИО/id;
   - оставить backend источником порядка, чтобы frontend не классифицировал элементы по датам.
7. Обновить backend regression tests в `ClientsApiTests`:
   - `HeadCoach` получает одновременно `Expired`, `ExpiringSoon` и `Unpaid`;
   - `Administrator` получает одновременно `Expired`, `ExpiringSoon` и `Unpaid`;
   - `Coach` по-прежнему получает `403`;
   - endpoint не возвращает будущие оплаченные абонементы вне окна, оплаченные абонементы без даты окончания, профессиональных клиентов и неактивных/архивных клиентов;
   - endpoint возвращает неоплаченный абонемент вне окна как `Unpaid`, включая сценарий без даты окончания;
   - истекший неоплаченный абонемент возвращается как `Expired` с `isPaid: false`;
   - payload содержит `state`, корректный `daysUntilExpiration` и отдельный `isPaid`.
8. Обновить frontend API layer:
   - добавить type вроде `MembershipAttentionState = "Expired" | "ExpiringSoon" | "Unpaid" | "Unknown"`;
   - заменить или совместимо расширить `ExpiringClientMembership` на home attention item с `state`;
   - обновить mapper в `frontend/src/lib/api/clients.ts`, чтобы ожидаемые backend values `Expired`, `ExpiringSoon`, `Unpaid` мапились напрямую, а отсутствующий или неожиданный `state` становился frontend-only `Unknown`;
   - обновить exports в `frontend/src/lib/api.ts`;
   - если функция остается `getExpiringClientMemberships`, добавить технический комментарий или последующее переименование только при локальной необходимости; предпочтительно новое имя `getMembershipAttentionItems` с compatibility wrapper, если это снизит churn.
9. Обновить `HomeDashboard`:
   - переименовать блок в `Абонементы требуют внимания`;
   - сохранить существующую область главной вместо добавления нового экрана/секции только для expired;
   - использовать `user.permissions.canManageClients` для решения, нужно ли грузить и показывать область внимания;
   - отображать явный badge/label состояния `Истек` / `Скоро истечет` / `Требует оплаты` / `Неизвестно`;
   - показывать для `Expired` человекочитаемый текст вроде `Истек 3 дня назад`;
   - показывать для `ExpiringSoon` текущие тексты `Сегодня` / `Осталось 3 дня`;
   - показывать для `Unpaid` текст про ожидаемую оплату без попытки вывести состояние истечения по дате;
   - показывать для `Unknown` безопасный fallback `Неизвестно` без date-based классификации;
   - оставить статус оплаты отдельным badge;
   - сохранить действие перехода в карточку клиента, если `onOpenClient` доступен;
   - не вычислять `Expired` по `expirationDate` или отрицательному `daysUntilExpiration`.
10. Обновить frontend resources и тексты пустого/loading/error state так, чтобы они описывали область внимания, а не только истекающие абонементы.
11. Обновить frontend unit tests:
   - пустое состояние новой области;
   - отображение `Expired`, `ExpiringSoon` и `Unpaid` в одном списке;
   - текст просрочки для expired;
   - отдельное отображение неоплаченного статуса;
   - неожиданный backend `state` отображается как `Unknown` / `Неизвестно`;
   - обычный `Coach` без `user.permissions.canManageClients` не вызывает endpoint и не видит membership attention block.
12. Обновить Playwright/e2e mocks и проверки:
   - `frontend/e2e/home-dashboard.spec.ts` для новой области, состояний и текстов;
   - `frontend/e2e/auth.spec.ts`, `frontend/e2e/responsive-main-screens.spec.ts`, `frontend/e2e/stage12.spec.ts`, `frontend/e2e/users.spec.ts`, `frontend/e2e/finance-reports.spec.ts`, если они мокают `/api/clients/expiring-memberships`;
   - убедиться, что все fixtures включают `state`, если mapper сделан строгим.
13. Запустить required validation и исправить найденные регрессии.

## Preferred implementation strategy
1. Contract-first: сначала backend response shape, selection semantics, ordering и backend tests.
2. Compatibility-aware: сохранить существующий route, если можно, но привести имена frontend/domain-facing code к `membership attention`, чтобы UI не продолжал мыслить только expiring-сценарием.
3. Backend-owned semantics: `Expired`, `ExpiringSoon`, `Unpaid` and ordering come from backend; frontend renders provided fields and only maps unexpected values to `Unknown`.
4. Incremental frontend integration: обновить API types/mappers, затем `HomeDashboard`, затем tests/e2e fixtures.
5. Regression before polish: доступ и contract tests важнее визуальной детализации; UI refinement делать после прохождения contract checks.

## Files likely to change
- `backend/src/GymCrm.Api/Auth/ClientEndpoints.cs`
- `backend/src/GymCrm.Api/Auth/ExpiringClientMembershipListItemResponse.cs`
- `backend/src/GymCrm.Application/Clients/ClientMembershipQueryConstants.cs` only if a named attention-window constant becomes necessary
- `backend/tests/GymCrm.Tests/ClientsApiTests.cs`
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/api/clients.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/lib/resources.ts`
- `frontend/src/features/home/HomeDashboard.tsx`
- `frontend/src/features/home/HomeDashboard.test.tsx`
- `frontend/e2e/home-dashboard.spec.ts`
- `frontend/e2e/auth.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`
- `frontend/e2e/stage12.spec.ts`
- `frontend/e2e/users.spec.ts`
- `frontend/e2e/finance-reports.spec.ts`

If exact additional consumers are unclear, discover them before editing with `rg "expiring-memberships|getExpiringClientMemberships|ExpiringClientMembership|Истекающие абонементы" frontend backend`.

## Constraints
- Backend owns roles, permissions, membership state, access scope and validation semantics.
- Frontend must not infer `Expired`, `ExpiringSoon` or `Unpaid` from date math, payment fields or negative `daysUntilExpiration`.
- Do not expand backend visibility beyond existing `ManageClients` policy, currently `Administrator` and `HeadCoach`.
- Do not change membership purchase, renewal, payment, attendance write-off or client list quick filter semantics unless required by the home contract.
- Do not add a separate screen or separate home area only for expired memberships.
- Do not couple payment status with expiration state.
- Do not show professional clients in the membership attention area.
- Keep top-level response shape compatible; item fields may expand for the new attention contract.
- If backend contract changes, update all affected frontend consumers and mocks.
- Preserve Mantine/Onest and existing shared UX patterns.

## Out of scope
- Changing expiration calculation rules.
- Changing payment, renewal, purchase, refund or attendance semantics.
- Introducing a new global permission model.
- Telegram-bot expiring-membership scenarios, unless CRM contract changes accidentally break shared code.
- Reworking client list filters or quick filters.
- DB/schema migrations or data backfills.
- Broad redesign of the home screen outside the existing membership attention area.

## Required test coverage

### Unit tests
- Frontend unit/component tests for `HomeDashboard` rendering of `Expired`, `ExpiringSoon`, `Unpaid` and `Unknown`.
- Frontend API mapper tests only if this project already has mapper-level test patterns; otherwise cover mapping through component tests and e2e mocks.
- Backend pure unit tests are optional unless state mapping is extracted into a helper/service.

### Integration tests
- Backend API tests in `ClientsApiTests` for:
  - `HeadCoach` positive access;
  - `Administrator` positive access;
  - `Coach` negative access;
  - mixed response containing `Expired`, `ExpiringSoon` and `Unpaid`;
  - unpaid current membership outside the expiration window is included as `Unpaid`;
  - expired unpaid membership is included as `Expired` with `isPaid: false`;
  - exclusion of outside-window future paid memberships, paid no-expiration memberships, professional clients and inactive/archived clients;
  - all expired memberships are included, including old expired memberships;
  - expired ordering returns recently expired memberships before older expired memberships;
  - response fields `state`, `daysUntilExpiration`, `isPaid`.

### UI tests
- `HomeDashboard.test.tsx` for the new title, empty/loading/error copy, state badges, overdue text, unpaid-only text and unknown fallback.
- Playwright home dashboard test for expired, expiring and unpaid-only items in the same area.
- Responsive test or existing home e2e assertion to ensure the expanded fields do not overflow on mobile.

### Manual-only checks
- Visual scan of desktop and narrow mobile home screen after automated checks pass.
- Confirm with seeded/dev data that expired, soon-expiring and unpaid-only items are distinguishable and the client-card action still works.

## Test plan
- [ ] Run `dotnet test backend/GymCrm.slnx`.
- [ ] Run `cd frontend && npm run lint`.
- [ ] Run `cd frontend && npm run build`.
- [ ] Run focused frontend tests for `HomeDashboard`.
- [ ] Run affected Playwright tests for home dashboard/auth/responsive screens.
- [ ] Verify API payload manually or via test output contains `state: "Expired"`, `state: "ExpiringSoon"` and `state: "Unpaid"`.
- [ ] Verify unexpected frontend fixture state is rendered as `Unknown` / `Неизвестно`.
- [ ] Verify ordinary `Coach` cannot load the membership attention endpoint.

## Regression barrier
No implementation is complete without automated barriers proving:
- backend endpoint returns `Expired`, `ExpiringSoon` and `Unpaid` with explicit `state`;
- backend endpoint remains unavailable to roles without `ManageClients`;
- backend excludes future paid memberships outside the attention window and clients outside active/current-membership/non-professional scope;
- backend includes all expired memberships and unpaid-only memberships;
- frontend displays state from the API and does not classify expiration by date;
- frontend maps missing/unexpected `state` to `Unknown` instead of dropping the whole item;
- UI keeps payment status separate from expiration state;
- e2e mocks and home dashboard tests reflect the expanded contract.

## Risks
- Data exposure risk: changing access or filtering incorrectly may reveal expired memberships to ordinary coaches.
- Domain drift risk: frontend might reintroduce date-based classification if `state` is optional or fixtures omit it.
- Contract naming risk: keeping `/expiring-memberships` while returning expired and unpaid items can confuse future maintainers unless code/UI names are updated around the endpoint.
- Sorting risk: a frontend sort by `daysUntilExpiration` can accidentally override backend ordering or hide grouping intent.
- Time boundary risk: `DateOnly.FromDateTime(DateTime.UtcNow.Date)` must remain consistent with existing tests and product expectations.
- Test fixture risk: multiple e2e files intercept `/api/clients/expiring-memberships`; stale payloads can cause false failures after `state` becomes required.
- Nullable-date risk: unpaid-only items without expiration date require careful backend/frontend handling of `expirationDate` and `daysUntilExpiration`.
- UI duplication risk: `Unpaid` state and `isPaid: false` are related but must stay visually understandable instead of looking like accidental duplicate badges.

## Stop conditions
Остановиться и не писать код, если:
- реализация требует изменения глобальной auth/RBAC модели, а не локального использования существующего `ManageClients`;
- невозможно определить совместимый backend contract для home membership attention;
- найдено требование показывать expired memberships ролям вне `Administrator` / `HeadCoach`;
- найдено требование показывать professional clients в этой области внимания;
- задача начинает требовать изменения покупки, продления, оплаты, возвратов или attendance semantics;
- появляется необходимость production data migration/backfill;
- scope превращается в переработку client list filters или отдельного нового раздела.

Do not stop only because both backend and frontend must change.

## Ready for Codex execution
yes

Reason: human review on 2026-06-12 approved execution with clarified membership attention states, access gating, ordering, response compatibility and unknown-state fallback.
