# Implementation Plan: TASK-095 Убрать остаточные дублирующие заголовки и служебные подписи

## Source task
/backlog/done/TASK-095-remove-residual-service-copy.md

## Implementation branch
fix/TASK-095-remove-residual-service-copy

Branch rules:
- перед кодом использовать `.agents/skills/task-worktree/SKILL.md` и отдельный
  worktree из актуального `origin/main`;
- подтвердить clean status и active branch;
- не включать action placement из TASK-093 или administrator widget removal из
  TASK-092;
- удалять только copy, не прошедшую `decision/usefulness test`.

## Goal
Убрать видимый повтор active route/tab context и shell service metadata, не
затронув доступные имена, form/detail headings, operational/recovery copy,
profile account context и CRM semantics.

## Current understanding
- `AttentionPanel` рендерит `SectionHeader` с
  `Клиенты, требующие внимания` и decorative description внутри одноимённой
  active tab; рядом уже есть visually hidden focus heading и named result list.
- `AuthenticatedShell` передаёт `brandMeta` с ролью и стартовым разделом и
  compact role copy в `Header`; роль отдельно полезно сохранена в profile menu.
- `UserEditScreen` рендерит decorative `SectionHeader` с
  `Редактирование доступа`, login-fixed description и отдельный hint-card
  `Что можно менять на этом экране`; page title, fields и validation уже
  предоставляют необходимый operation/constraint context.
- Responsive Playwright уже имеет частичный `expectNoServiceIntro`, но не
  проверяет shell meta и concrete residual copy.
- `Проверено: <time>` является operational freshness, loading/error/empty/
  restricted copy обеспечивает состояние и recovery и не удаляется.

## UX/UI contract
- Active persistent navigation/tab остаётся видимым route/section context.
- Attention content начинается с operational refresh/state/list без видимого
  duplicate title/description и без пустого spacer.
- Строка `Клиенты, требующие внимания` полностью удаляется из Attention DOM и
  accessibility tree. Layout-neutral visually hidden focus heading
  `Список клиентов` сохраняется и становится accessible name списка через
  `aria-labelledby`; heading hierarchy сохраняется.
- Club name и profile trigger остаются; role остаётся внутри profile menu, но
  не под названием организации.
- Detail/create/edit/auth titles, validation, legal/security, prerequisite,
  stale, error, recovery and success copy сохраняются.
- На trainer edit сохраняются page title с identity, readonly login field,
  field labels/descriptions, validation и submit. Три требования source note
  удаляют четыре rendered text values: `sectionTitle`, `sectionDescription`,
  `permissionsHintTitle` и `permissionsHintDescription`; важное последствие
  очистки Telegram ID остаётся в description соответствующего поля.

## Dependencies and execution order
1. TASK-090 — done, `decision/usefulness test` является source of truth.
2. TASK-092 — done and merged; final administrator copy inventory строится на
   этом baseline.
3. TASK-093 — обязательная dependency и должна быть merged до начала TASK-095,
   чтобы удаление Attention header использовало выпущенный placement refresh и
   не проектировало action geometry в этой branch.
4. TASK-095 удаляет только residual copy и empty wrappers.

## Authenticated-route coverage matrix
- Table-driven Playwright matrix является исполняемым regression barrier.
  Markdown inventory из шага 1 является audit/review artifact и сам по себе не
  считается исполняемым тестом.
- Top-level sections:
  `Главная`, `Расписание`, `Клиенты`, `Группы`, `Тренеры`, `Журнал`, `Финансы`,
  `Настройки`.
- Внутренние Home panels:
  `Посещения`, `Требуют внимания`.
- Authenticated nested routes:
  `/password`, `/clients/new`, `/clients/:id/preview`, `/clients/:id`,
  `/clients/:id/edit`, `/groups/new`, `/groups/:id/edit`, `/users/new`,
  `/users/:id/edit`.
- Settings tabs:
  `Абонементы`, `Типы групп`, `Филиалы и залы`, `Администраторы`.
- Полный allowed-route/tab sweep выполняется под `SuperAdministrator`.
  Дополнительно `Coach` покрывает доступные sections и один representative
  restricted deep-link/recovery scenario.
- Каждая matrix entry проверяется минимум на `390 x 844` и desktop `1440px`.
  Concrete changed surfaces — Home Attention, trainer edit и authenticated
  shell — дополнительно проверяются на `420 x 912`, `440 x 956`,
  `912 x 420`, `956 x 440` и tablet `768px`.

## Execution steps
1. Создать isolated worktree и committed inventory
   `docs/ui-concept/TASK-095-copy-inventory.md` для всех authenticated routes и
   settings tabs: text, context owner, decision/usefulness verdict,
   `remove/retain`, reason and accessible replacement when needed. Этот файл
   является audit/review artifact; автоматические гарантии принадлежат
   table-driven Playwright matrix.
2. До production-кода обновить `HomeDashboard/AttentionPanel` tests:
   - concrete title/description отсутствуют в DOM и accessibility tree in
     populated, loading, empty and error states;
   - `Список клиентов` remains layout-neutral visually hidden and focusable;
   - populated result list получает accessible name `Список клиентов` через
     `aria-labelledby`, без старого `aria-label`;
   - refresh, last check, empty/retry and action errors remain.
3. До production-кода обновить shared shell/component tests:
   - brand renders only club identity, no `brandMeta` DOM;
   - role/start section are absent under brand at compact/desktop widths;
   - profile menu still exposes current name and role.
4. До production-кода expand table-driven Playwright route matrix согласно
   разделу `Authenticated-route coverage matrix`:
   - exact forbidden attention string отсутствует в DOM/accessibility tree,
     shell strings отсутствуют под brand;
   - duplicate top-level list titles/service descriptions absent;
   - visible detail/form/recovery headings and accessible hidden `h1` remain;
   - removed wrappers отсутствуют, а bounding boxes первого operational row
     подтверждают отсутствие зарезервированного header spacer на required
     widths.
5. До production-кода обновить `UserEditScreen` component/Playwright tests:
   - `sectionTitle`, `sectionDescription`, `permissionsHintTitle` и
     `permissionsHintDescription` отсутствуют;
   - field-level Telegram ID description с consequence очистки сохранён;
   - page title, readonly login, editable fields, validation, loading/error/
     read-only states и submit сохранены;
   - duplicate return actions не исправлять здесь: это TASK-097.
6. Запустить new tests и подтвердить expected failures on current
   `SectionHeader`, `brandMeta` and existing assertions that expect the copy.
7. Удалить `AttentionPanel` visible `SectionHeader` title/description and its
   now-unused wrapper/import; сохранить refresh in the first operational row
   established by TASK-093. Перевести focus heading в layout-neutral
   `visually-hidden`, удалить старый list `aria-label` и связать list с
   `Список клиентов` через `aria-labelledby`.
8. Удалить `brandMeta`/`brandMetaCompact` use from `AuthenticatedShell`;
   если repository search подтверждает отсутствие других consumers, удалить
   props/render path and `.app-shell__brand-meta` CSS from shared `Header`.
9. Удалить trainer edit `SectionHeader`/hint-card, четыре ставших
   неиспользуемыми text resources и imports, сохранив form semantics,
   field-level Telegram ID consequence и operational states.
10. Провести inventory sweep по authenticated routes; удалять только
   navigation/title repeats and decorative intro. Каждое сохранённое
   non-obvious description имеет записанное decision/recovery reason.
11. Обновить old Home/Stage12/Responsive assertions from positive copy checks to
   absence + preserved operational/accessibility checks.
12. Запустить focused tests, full frontend unit/lint/build, affected Playwright
    and iPhone WebKit/compact-height suites.

## Preferred implementation strategy
1. Inventory and red absence/accessibility tests.
2. Concrete Attention copy removal.
3. Shell meta API cleanup.
4. Bounded authenticated-route sweep.
5. Responsive/accessibility regression closure.

## Files likely to change
- `docs/ui-concept/TASK-095-copy-inventory.md`
- `frontend/src/features/home/AttentionPanel.tsx`
- `frontend/src/features/home/HomeDashboard.test.tsx`
- `frontend/src/features/shared/Header.tsx`
- `frontend/src/features/shared/ux.test.tsx`
- `frontend/src/features/users/UserEditScreen.tsx`
- `frontend/src/features/users/UserManagement.test.tsx`
- `frontend/src/lib/resources.ts`
- `frontend/src/App.tsx`
- `frontend/src/App.css`
- `frontend/e2e/home-dashboard.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`
- `frontend/e2e/stage12.spec.ts`
- authenticated route components discovered by inventory, only with explicit
  remove verdict

## Constraints
- Keep one semantic `h1`, document title, main landmark and active-nav semantics.
- Keep meaningful independent section/form/detail headings.
- Keep validation, legal/security, scope, state, stale and recovery copy.
- Keep profile menu role/account context.
- Do not replace removed text with badges/tooltips or unrelated layout changes.
- Backend, navigation destinations, landing route, roles and permissions stay unchanged.

## Out of scope
- Toolbar/action geometry from TASK-093.
- Administrator metrics from TASK-092.
- Entity/form/tab/data labels and operational messages.
- Backend, bot and audit contracts.

## Required test coverage

### Unit/component tests
- Attention duplicate copy absent from DOM/accessibility tree while hidden
  `Список клиентов` heading/list name and refresh stay.
- Shell meta absent while brand/profile/name/role-in-menu stay.
- Loading, empty, error, stale and populated operational copy preserved.
- Four trainer edit service text values absent while title, readonly login,
  fields, field-level Telegram consequence, validation, states and submit
  remain.

### Integration tests
- Backend integration tests are not applicable because no API/business contract
  changes.
- App/shared/Home component tests cover shell ↔ profile and tab ↔ attention
  interactions before production removal.
- Initial tests must fail on currently visible residual copy.

### UI/e2e tests
- Home Attention, shell on all primary routes, representative list/detail/form/
  restricted/error states.
- No visible duplicates or empty containers at portrait, landscape compact,
  tablet and desktop sizes.
- Hidden headings/regions remain discoverable through role/name assertions.

## Test plan
- [x] Home and shell component tests red before implementation.
- [x] Route-level Playwright absence/accessibility checks red before implementation.
- [x] `cd frontend && npm run test:unit`
- [x] `cd frontend && npm run test:e2e -- <affected-specs>`
- [x] `cd frontend && npm run test:e2e:iphone`
- [x] `cd frontend && npm run lint`
- [x] `cd frontend && npm run build`

## Regression barrier
The table-driven Playwright authenticated-route matrix must assert both sides:
forbidden duplicate/service strings and wrappers, including all four trainer
edit text values, are absent, while hidden route/list names, profile role
context, detail/form headings, field-level Telegram consequence and
operational/recovery copy remain. The Markdown copy inventory records the
corresponding audit decisions but is not the executable barrier. This prevents
both recurrence and over-aggressive deletion.

## Risks
- Broad negative text matching can delete valid recovery or form guidance.
- Removing `Header` meta API without full consumer search could break another shell.
- Old tests may encode the obsolete visible title as an accessibility proxy.
- Starting before TASK-093 merge can cause action-placement conflicts.

## Stop conditions
Остановиться, если:
- copy changes an actual user decision, constraint, security/legal consequence
  or recovery path;
- removing it leaves no accessible region/heading name;
- a screen needs workflow redesign rather than bounded copy cleanup;
- TASK-093 is not merged into `origin/main` or its baseline at an overlapping
  call site is unclear;
- task worktree/branch is invalid.

## Ready for Codex execution
no — completed 2026-07-30 in commit `5f7ef2b`

## Completion record
- Source task moved to `/backlog/done/TASK-095-remove-residual-service-copy.md`.
- Integrated `main` validation passed: lint, build, raw-color check, 404 unit tests and 202 Playwright tests.
- No backend or database contract changed; no migration is required.
