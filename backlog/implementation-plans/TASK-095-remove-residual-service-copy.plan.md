# Implementation Plan: TASK-095 Убрать остаточные дублирующие заголовки и служебные подписи

## Source task
/backlog/implementation/TASK-095-remove-residual-service-copy.md

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
- Hidden route `h1`, hidden focus heading, named list/region и heading hierarchy
  сохраняются.
- Club name и profile trigger остаются; role остаётся внутри profile menu, но
  не под названием организации.
- Detail/create/edit/auth titles, validation, legal/security, prerequisite,
  stale, error, recovery and success copy сохраняются.
- На trainer edit сохраняются page title с identity, readonly login field,
  field labels/descriptions, validation и submit; удаляются только три
  конкретных service/decorative strings из source note.

## Dependencies and execution order
1. TASK-090 — done, `decision/usefulness test` является source of truth.
2. TASK-092 должна быть merged до final administrator copy inventory.
3. TASK-093 желательно выполнить раньше, чтобы удаление Attention header не
   проектировало новый placement refresh в этой branch.
4. TASK-095 удаляет только residual copy и empty wrappers.

## Execution steps
1. Создать isolated worktree и committed inventory
   `docs/ui-concept/TASK-095-copy-inventory.md` для всех authenticated routes и
   settings tabs: text, context owner, decision/usefulness verdict,
   `remove/retain`, reason and accessible replacement when needed.
2. До production-кода обновить `HomeDashboard/AttentionPanel` tests:
   - concrete title/description отсутствуют как visible text in populated,
     loading, empty and error states;
   - `Список клиентов` remains hidden/focusable;
   - result list keeps accessible name;
   - refresh, last check, empty/retry and action errors remain.
3. До production-кода обновить shared shell/component tests:
   - brand renders only club identity, no `brandMeta` DOM;
   - role/start section are absent under brand at compact/desktop widths;
   - profile menu still exposes current name and role.
4. До production-кода expand Playwright route inventory:
   - exact forbidden attention/shell strings absent;
   - duplicate top-level list titles/service descriptions absent;
   - visible detail/form/recovery headings and accessible hidden `h1` remain;
   - no empty wrapper/gap at required widths.
5. До production-кода обновить `UserEditScreen` component/Playwright tests:
   - три concrete service strings отсутствуют;
   - page title, readonly login, editable fields, validation, loading/error/
     read-only states и submit сохранены;
   - duplicate return actions не исправлять здесь: это TASK-097.
6. Запустить new tests и подтвердить expected failures on current
   `SectionHeader`, `brandMeta` and existing assertions that expect the copy.
7. Удалить `AttentionPanel` visible `SectionHeader` title/description and its
   now-unused wrapper/import; сохранить refresh in the first operational row
   established by TASK-093, hidden focus heading and named list.
8. Удалить `brandMeta`/`brandMetaCompact` use from `AuthenticatedShell`;
   если repository search подтверждает отсутствие других consumers, удалить
   props/render path and `.app-shell__brand-meta` CSS from shared `Header`.
9. Удалить trainer edit `SectionHeader`/hint-card и ставшие неиспользуемыми
   resources/imports, сохранив form semantics и operational states.
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
- Attention duplicate copy absent while hidden heading/list name and refresh stay.
- Shell meta absent while brand/profile/name/role-in-menu stay.
- Loading, empty, error, stale and populated operational copy preserved.
- Trainer edit service strings absent while title, readonly login, fields,
  validation, states and submit remain.

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
- [ ] Home and shell component tests red before implementation.
- [ ] Route-level Playwright absence/accessibility checks red before implementation.
- [ ] `cd frontend && npm run test:unit`
- [ ] `cd frontend && npm run test:e2e -- <affected-specs>`
- [ ] `cd frontend && npm run test:e2e:iphone`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`

## Regression barrier
The executable authenticated-route copy inventory must assert both sides:
forbidden duplicate/service strings and wrappers, including the three trainer
edit strings, are absent, while hidden route/list names, profile role context,
detail/form headings and operational/recovery copy remain. This prevents both
recurrence and over-aggressive deletion.

## Risks
- Broad negative text matching can delete valid recovery or form guidance.
- Removing `Header` meta API without full consumer search could break another shell.
- Old tests may encode the obsolete visible title as an accessibility proxy.
- TASK-093/TASK-092 overlap can cause merge conflicts if dependency order is ignored.

## Stop conditions
Остановиться, если:
- copy changes an actual user decision, constraint, security/legal consequence
  or recovery path;
- removing it leaves no accessible region/heading name;
- a screen needs workflow redesign rather than bounded copy cleanup;
- TASK-092/TASK-093 baseline at an overlapping call site is unclear;
- task worktree/branch is invalid.

## Ready for Codex execution
yes, after overlapping TASK-092 and TASK-093 changes are merged into origin/main
