# Implementation Plan: TASK-107 Уплотнить мобильный журнал и исправить pagination/focus

## Source task
/backlog/done/TASK-107-audit-log-mobile-density-focus.md

## Implementation branch
fix/TASK-107-audit-log-mobile-density-focus

Branch rules:
- до изменения project code прочитать и применить
  `.agents/skills/task-worktree/SKILL.md`;
- создать отдельный task worktree и эту branch напрямую от актуального
  `origin/main`;
- подтвердить repo root, clean status, active branch, worktree list и
  `git merge-base --is-ancestor origin/main HEAD`;
- не использовать primary repository directory для implementation;
- не включать в branch другие TASK, redesign фильтров, backend или unrelated
  audit refactoring;
- написать unit/component и integration/Playwright regressions, получить
  ожидаемый red state и только затем менять production code.

## Goal
Сделать мобильный журнал быстрее для сканирования: показать дату/время,
описание действия, actor и entity/context в компактной записи, обеспечить
безопасную пагинацию и детерминированный возврат focus после закрытия details,
не меняя audit payload, permissions и backend semantics.

## Planning eligibility and risk
- Пользователь явно выбрал только TASK-107.
- `AI safety: Safe for Codex: yes`, risk level `medium`.
- Critical clarification questions отсутствуют.
- Изменения локализованы во frontend presentation, responsive CSS и tests.
- Backend/API/DB/auth/roles/permissions не меняются.
- Реалистичный regression barrier существует: component tests, browser
  geometry/accessibility assertions и target-iPhone WebKit scenarios.
- Задача готова для отдельного test-first execution; medium risk не требует
  decomposition на независимые TASK.

## Current understanding
- `AuditLogScreen.tsx` рендерит четыре semantic columns: дата, описание,
  пользователь и детали. TASK-099 уже удалил отдельную колонку действия;
  возвращать её нельзя.
- При ширине ниже `74.99em` `App.css` включает повторяющиеся visible labels
  `Дата / Описание / Пользователь`; annotated evidence на `440 x 956`
  показывает row около `200px`.
- Mobile row сейчас не показывает entity type/id и action context без открытия
  details, хотя они уже присутствуют в `AuditLogEntry`.
- Current Mantine `Pagination` не имеет audit-local geometry, navigation
  label, stable previous/next names или item names; measured controls равны
  примерно `32 x 32px`.
- `AuditDetailsModal` явно задаёт `returnFocus={false}`, а screen хранит
  trigger ref и вызывает `window.setTimeout(...focus, 0)` после close.
- Component test проверяет только close-button path и принимает timer-based
  implementation. Target-iPhone test покрывает Escape, но не overlay и не
  отсутствие timer dependency.
- Existing responsive/e2e tests защищают four-column contract, details target
  и horizontal overflow, но не mobile row density, entity/context, pagination
  geometry/names/gaps или все три close paths.
- API mapper отображает backend `description` как строку и при её отсутствии
  строит технический fallback из raw `actionType/entityType/entityId`.
  Existing `resources.audit.*Labels` локализуют только известные tokens.
- `AuditLogListResponse.totalCount` может быть `null`; в этом случае frontend
  знает current page и `hasNextPage`, но не знает истинное количество страниц
  и не должен представлять вычисленный `page + 1` как окончательный total.
- Current state handling различает loading/empty/error, но initial error не
  даёт явный retry, global empty не отличается от filtered-empty, а failed
  refresh удаляет ранее успешный response вместо явного stale state.

## Resolved product decisions — 2026-08-16
- Для pagination с известным `totalCount` mobile summary показывает
  `Страница X из Y`; при `totalCount = null` показывает только `Страница X`.
  UI не придумывает и не озвучивает неизвестный `Y`.
- Non-empty backend description остаётся verbatim two-line preview. Для
  типичного короткого description весь текст виден в row; длинный description
  может быть визуально ограничен двумя строками, но полное значение остаётся в
  DOM, row-specific accessible name и details.
- Пользователь выбрал mobile row variant A: отдельная visual context area с
  grid areas
  `"time details" "description details" "context context" "actor actor"`.
- Visual context area не создаёт пятую semantic cell. Row сохраняет ровно
  четыре `role="cell"`: Date, Description, User, Details. Полный context
  семантически относится к Description cell; отдельный видимый context item
  исключается из accessibility tree, чтобы screen reader не озвучивал данные
  дважды.
- Variant B с отдельной `44px` top row и полноширинным Description block не
  используется: design comparison показал около `136px` для typical row против
  около `112px` у variant A и не сохранил hard density gate `<=128px`.

## UX contract
- Пользователи: `SuperAdministrator`, `HeadCoach`, `Administrator` с
  backend `canViewAuditLog`; permission-restricted user не запускает audit
  requests.
- Контекст: one-handed mobile scanning с baseline `390 x 844`, target
  iPhone sizes `420 x 912` и `440 x 956`; дополнительно `360 x 780`,
  compact-height `912 x 420`/`956 x 440`, tablet и desktop.
- Primary task: быстро сравнить записи и определить нужное событие. Primary
  operation — scan/selection, а не отдельная dominant CTA.
- Required decision data без details: дата/время, verbatim backend description
  preview, action type, actor name/login, entity type и optional entity
  id/context. Typical short descriptions видны полностью; full value длинного
  two-line preview остаётся доступным через row-specific accessible name и
  details без перевода или переписывания.
- Frequent actions: filters, refresh, pagination, open details. Reset filters
  и raw JSON diagnostics — secondary. Destructive actions отсутствуют.
- Primary path: открыть журнал → сканировать chronological rows → открыть
  details только при необходимости → закрыть → вернуться focus к exact row
  trigger и продолжить с теми же filters/page.
- Completion signal: типичная запись определяется без modal; для длинного
  two-line preview details раскрывает полный текст. Escape, overlay и close
  button возвращают focus к trigger, если он остаётся mounted.
- Filter workflow и `CompactFilterPanel` не redesign-ятся в TASK-107.

## Approved UI specification

### Mobile row hierarchy
- Baseline order at `390 x 844`:
  1. top metadata: `DD.MM.YYYY HH:mm` left, details trigger right;
  2. exact `entry.description` as primary text;
  3. action + entity + optional entity id/source/messenger context;
  4. actor `full name · login`.
- Mobile grid: `minmax(0, 1fr) 44px` with areas
  `"time details" "description details" "context context" "actor actor"`.
- This is approved variant A. Details spans the right column beside time and
  description; context then uses the full row width before actor.
- Row padding: `10px 12px`; column gap `10px`; list gap `8px`;
  internal gaps `4px` before description and `6px` after it.
- Description uses existing Onest/Mantine typography at `16px/20px`,
  weight `800`, and at most two visual lines. Do not rewrite, translate or
  ellipsize the stored value in JavaScript. The full value remains in DOM, the
  row-specific details-control accessible name and details; CSS supplies the
  visual two-line clamp.
- Context and actor use existing `13–14px/18px` theme-compatible text and
  wrap. Truncation is allowed only with an accessible full value.
- Typical one/two-line fixture row target is `96–124px`; hard automated
  acceptance is `<=128px`. Long stress content may make the row taller and
  must not be clipped only to satisfy the density assertion.
- Remove visible repeated mobile labels `Дата / Описание / Пользователь`.
  Preserve exactly four semantic cells through accessible headers and the
  Date, Description, User and Details cell roles. The direct visual context
  grid item is not a fifth cell, is `aria-hidden`, and its full explicitly
  labelled value is included once in the Description cell accessible name.
- Details remains visible as a frequent secondary operation, but becomes an
  icon-only low-emphasis `44 x 44px` control on mobile with
  `aria-haspopup="dialog"` and name
  `Показать подробности записи: {description}`.
- At `390 x 844`, at least three typical rows must fit in the available
  content region after the filter toolbar and before bottom navigation; at
  `440 x 956`, target at least four.

### Tablet and desktop
- Preserve the four-column desktop table contract at `1440 x 1200`: Date,
  Description, User, Details.
- Do not restore separate Action or Object columns.
- Put formatted action/entity/context metadata visually in the existing
  Description column below exact description. Keep the same four semantic
  cells and associate the metadata with Description accessibility semantics;
  do not add Action/Object/context columns.
- At `768 x 1024`, use the widened compact/table-like form that preserves all
  decision data without visible repeated labels or horizontal page scroll.
- Desktop details may retain text `Детали` if it stays low-emphasis and at
  least `44 x 44px`.

### Technical/English description fallback
- Never translate, infer or rewrite backend meaning.
- Render a non-empty `entry.description` exactly as received, including
  English or technical text; do not insert it into a guessed Russian sentence.
- If a component fixture or future mapping supplies an empty description,
  display neutral UI copy `Описание не передано` and retain raw
  action/entity/timestamp in the Description cell and details-trigger
  accessible names.
- Known action/entity values use existing `resources.audit.*Labels`.
- Unknown action/entity values remain raw backend tokens in muted/code-like
  metadata with explicit accessible labels such as
  `Тип действия из API: ClientMerged`; do not invent local translations.
- Keep raw description, action/entity tokens and diagnostic JSON in details;
  frontend presentation must not mutate the API object or persistence.

### Pagination
- Reuse Mantine 9 `Pagination`/Group behavior and existing group-registry
  a11y patterns; do not create a new pagination state model.
- Wrap pager in an audit-local navigation surface with
  `aria-label="Страницы журнала действий"`.
- Every interactive control is at least `44 x 44 CSS px`; independent
  controls have at least `8px` gap.
- Stable control names:
  - previous: `Предыдущая страница журнала`;
  - next: `Следующая страница журнала`;
  - first/last, if rendered: `Первая страница журнала` /
    `Последняя страница журнала`;
  - page item: `Страница N журнала`, with current-page semantics preserved.
- Previous/next are real disabled buttons at bounds and are not keyboard
  focusable while disabled.
- At `360/390/420/440px`, suppress direct page buttons and show previous/next
  plus one visible summary. When `totalCount` is known, the summary is
  `Страница X из Y`; when `totalCount = null`, it is `Страница X`. Enabled or
  disabled next communicates `hasNextPage`; never present `page + 1` as a
  known final total. Do not add horizontal pager scrolling.
- At `768/1440px`, direct pages may use `siblings={1}` and
  `boundaries={1}` only when the `44px + 8px` geometry fits.
- Page change preserves filters and requests the selected page; refresh and
  details close preserve both page and filters. Filter changes continue to
  reset page to one according to the existing contract.

### Details modal and focus
- Before opening from touch/click, focus the trigger with
  `preventScroll: true` when necessary so Mantine captures the correct
  return target.
- Use Mantine `returnFocus`; remove `returnFocus={false}`, the delayed
  `window.setTimeout` and stale manual ref focus path.
- Escape, overlay click and explicit close all call the same close handler.
- Close control name: `Закрыть подробности записи`.
- When the trigger still exists, all close paths return focus to it without
  timer dependency. When it unmounts, never focus a detached node.
- Initial modal focus is the close button or another intentional control;
  focus remains trapped inside the modal until close.
- Compact-height modal uses dynamic viewport bounds, one intentional body
  scroll and a reachable close control; do not introduce nested scroll traps.

### Operational states
- Filters and toolbar remain available in loading, empty, filtered-empty,
  initial error, retry and stale states.
- Initial loading is distinct from empty and preserves selected filters/page.
- Empty without active filters: `В журнале пока нет записей` plus
  `Обновить`.
- Filtered empty: retain `Под выбранные фильтры записей нет.` plus
  `Сбросить фильтры`.
- Initial error keeps filters/page and exposes `Повторить`.
- A failed refresh may keep the last successful response only for the same
  filter/page request and must show
  `Не удалось обновить, показаны предыдущие данные` plus retry. Do not show
  stale rows as a fresh success or reuse rows from a different page/filter.
- Permission-restricted state remains request-free and exposes no unusable
  audit controls.

## Execution roles
1. Planning-stage `ux-researcher` handoff completed: primary scanning task,
   decision data, action classification, recovery paths and measurable mobile
   outcomes are fixed above.
2. Planning-stage `ui-designer` handoff completed: row hierarchy/geometry,
   fallback, pagination, modal focus and responsive/state behavior are fixed
   above.
3. During execution, `test-automator` owns new red component/Playwright
   regressions before production code.
4. Only after expected red evidence, `react-specialist` implements minimal
   React/Mantine/CSS changes using
   `.agents/skills/react-best-practices/SKILL.md`.
5. Coordinating agent verifies worktree, test-first order and result against
   this UX/UI contract; backend specialists are not required.

## Dependencies and sequencing
- TASK-099 is done and its four-column/no-action-column contract remains a
  regression dependency.
- TASK-057 is done and its no-object-column contract remains preserved.
- No open task, backend contract, migration or runtime change blocks TASK-107.
- Implementation starts from current `origin/main`, not from another
  unmerged task branch.

## Execution steps

### Phase 0 — isolated workspace and baseline
1. Read root/frontend `AGENTS.md`, source TASK, this plan,
   `crm-mobile-first-ui`, `react-best-practices` and `task-worktree`.
   Create/resume the declared isolated worktree and report verified path,
   branch, `origin/main` base and clean status.
2. Inspect installed Mantine 9 Pagination/Modal APIs and existing
   `GroupManagement` pagination labels/geometry before selecting props.
   Reuse project tokens and shared controls; no new component library.
3. Run focused baseline before adding assertions:
   - `cd frontend && npm run test:unit -- src/features/audit/AuditLogScreen.test.tsx`;
   - `npm run test:e2e -- e2e/stage12.spec.ts e2e/responsive-main-screens.spec.ts`;
   - the audit scenario from `npm run test:e2e:iphone`.
   Record pre-existing failures separately from TASK-107 red evidence.

### Phase 1 — tests before functional code
4. Before production changes, extend unit/component coverage in
   `AuditLogScreen.test.tsx`:
   - required date/time, exact description, formatted action/entity/id and
     actor/login are exposed without opening details;
   - every row has exactly four semantic cells at every breakpoint; the visual
     context item is not a fifth cell, and Description exposes its full
     explicitly labelled context once to accessibility APIs;
   - repeated mobile labels are not part of the visible compact row contract;
   - known tokens use existing labels, unknown tokens remain raw with explicit
     accessible meaning, empty description uses `Описание не передано`;
   - long non-empty description is unchanged in DOM/accessibility/details even
     though mobile CSS limits it to two visual lines;
   - backend entry object and raw details values are not mutated;
   - desktop remains exactly four headers/cells with no Action/Object column.
5. Before production changes, add component integration tests with mocked API:
   - pagination nav, previous/next/page names, current/disabled semantics;
   - known `totalCount` renders `Страница X из Y`, while `totalCount = null`
     renders only `Страница X` and never exposes a guessed final page count;
   - page 2 selection sends existing filters plus `page: 2`;
   - refresh/details close preserve filters and current page; filter change
     still resets page to one;
   - empty versus filtered-empty actions, initial error retry and same-query
     stale refresh notice/retry preserve state;
   - response from a different failed page/filter is never presented as
     current data.
6. Before production changes, add modal interaction tests using user-level
   events:
   - open establishes intentional focus;
   - explicit close, Escape and overlay close each remove dialog and return
     focus to the exact initiating row trigger;
   - no fake-timer advance or application-owned delayed callback is required;
   - a removed trigger is not focused.
7. Before production changes, extend `stage12.spec.ts` and/or
   `responsive-main-screens.spec.ts`:
   - approved variant A grid areas, compact mobile order and exact decision
     data without a fifth semantic cell;
   - typical row height `<=128px`, details `44 x 44px`, no repeated visible
     labels and no horizontal overflow;
   - intentional two-line description clamp preserves the full accessible
     value; actor/context long-content stress wraps without clipping;
   - desktop four-column geometry and Description-associated context;
   - pagination controls `>=44 x 44px`, pairwise gap `>=8px`, stable names,
     current/disabled state and no pager overflow;
   - filters/page persist through page → details → close and retry paths.
8. Before production changes, expand
   `iphone-target-devices.spec.ts` for both WebKit target projects:
   - fixtures include multiple typical rows, long actor/entity/description,
     technical English description, unknown action/entity and multi-page
     response;
   - `420 x 912` and `440 x 956` meet density, geometry, focus and overflow
     contracts;
   - Escape, overlay and explicit close return focus;
   - mobile pager is previous/next + the known-total or unknown-total summary
     and never horizontally scrolls.
9. Add geometry smoke at `360 x 780`, baseline `390 x 844`, tablet
   `768 x 1024`, desktop `1440 x 1200`, and compact-height
   `912 x 420`/`956 x 440`. Target iPhone WebKit tests remain mandatory;
   Chromium viewport tests alone are not iPhone Safari acceptance.
10. Run all new focused tests against unchanged production code. Confirm
    expected failures specifically on repeated labels/current row height,
    absent context, default `32px` pagination/names, timer-owned focus and
    missing recovery/stale behavior. Broken mocks/selectors or unrelated
    baseline failures are not valid red evidence.

### Phase 2 — minimal functional implementation
11. Refactor only the audit row projection to derive a presentation-safe
    description/action/entity/context/actor model. Keep helpers local unless a
    small audit-local pure module materially improves testing; do not create a
    global abstraction or duplicate backend rules.
12. Update row JSX and audit-local CSS for approved variant A, typography,
    spacing and icon-only details control. Preserve exactly four semantic cells
    at every breakpoint. Render context as the dedicated visual `context` grid
    item, but associate its full labelled value with Description semantics and
    prevent duplicate screen-reader output; do not add a context/Action/Object
    cell or column.
13. Implement the explicit technical fallback rules: exact description,
    neutral empty copy, existing labels for known tokens and raw accessible
    tokens for unknown values. Do not language-detect or translate text.
14. Add audit-local responsive pagination using Mantine 9 props and the
    installed responsive mechanism: accessible navigation/control/item names,
    `44 x 44px` targets, `8px` gaps, narrow previous/summary/next mode and
    wider numbered mode. Known totals use `Страница X из Y`; unknown totals use
    `Страница X` without a synthesized final total. Preserve the existing
    page/filter request model.
15. Restore Mantine modal focus ownership, define close button label and remove
    the application timeout/manual stale-node focus path. Keep old/new JSON,
    source/platform, action/entity and entity id unchanged in details.
16. Add only local state distinctions needed for global empty, filtered-empty,
    retry and same-query stale refresh. Keep previous rows only when their
    page/filter key matches the failed refresh; label them stale.
17. Do not change `CompactFilterPanel`, API types/requests, routes, resources
    outside existing labels, backend audit endpoints, permissions or payload.

### Phase 3 — green and regression closure
18. Rerun focused unit/component and audit Playwright tests; make production
    changes pass without weakening height, hit-area, focus, names, raw-text or
    overflow assertions.
19. Run mandatory frontend validation from the task worktree:
    - `cd frontend && npm run test:unit`;
    - `npm run lint`;
    - `npm run build`;
    - `npm run check:raw-colors`;
    - `npm run test:e2e -- e2e/stage12.spec.ts e2e/responsive-main-screens.spec.ts`;
    - `npm run test:e2e:iphone`.
20. Verify primary path and one failure/recovery path at `390 x 844`,
    `420 x 912`, `440 x 956`; smoke `360 x 780`, `768 x 1024`,
    `1440 x 1200`, `912 x 420`, `956 x 440`.
21. Source/DOM review must confirm: no `window.setTimeout` focus workaround,
    no restored Action/Object columns, no guessed translations, no audit
    payload mutation, no horizontal page/pager overflow, no stale data shown
    as current, and no unrelated changed files.
22. If available, perform Safari Responsive Design Mode/iOS Simulator or
    physical-device smoke for browser chrome, safe area, home indicator and
    one-handed reach. Report unavailable device-level checks as residual
    evidence gaps; automation does not prove physical-device behavior.

## Preferred implementation strategy
1. Component presentation/fallback and pagination/focus/state tests in red.
2. Browser geometry, target-iPhone and close-path tests in red.
3. Minimal four-cell JSX/CSS projection with local presentation helpers.
4. Mantine-native responsive pagination and modal return focus.
5. Explicit recovery/stale state closure.
6. Full frontend and WebKit regression suite.

## Files likely to change
- `frontend/src/features/audit/AuditLogScreen.tsx`
- `frontend/src/features/audit/AuditLogScreen.test.tsx`
- `frontend/src/App.css`
- `frontend/e2e/stage12.spec.ts`
- `frontend/e2e/responsive-main-screens.spec.ts`
- `frontend/e2e/iphone-target-devices.spec.ts`

Optional only if a tested local presentation helper keeps the screen focused:
- `frontend/src/features/audit/auditPresentation.ts`
- `frontend/src/features/audit/auditPresentation.test.ts`

Files to inspect but not expected to change:
- `frontend/src/lib/api/audit.ts`
- `frontend/src/lib/api/mappers.ts`
- `frontend/src/lib/api/types.ts`
- `frontend/src/lib/resources.ts`
- `frontend/src/features/groups/GroupManagement.tsx`
- `frontend/src/features/groups/GroupManagement.test.tsx`
- `frontend/src/features/shared/ux.tsx`
- backend audit endpoints, domain and tests

## Constraints
- Backend remains source of truth for audit records, descriptions, action/entity
  semantics, access scope and permissions.
- No backend/API/persistence/DB/auth/role changes.
- Preserve current request/filter contract and page reset on filter change.
- Preserve exactly four desktop headers/cells and do not restore Action/Object.
- Exact backend description and raw unknown tokens remain recoverable; meaning
  is never carried by color alone.
- All visible controls map to an operation; details is visible but secondary.
- No mobile/tablet/desktop horizontal page scroll or pager scroll.
- Preserve React 19, TypeScript, Vite, Mantine 9, Onest and existing design
  tokens; no raw colors or new component library.
- Fixed/sticky audit controls are not introduced.
- Focus, accessible names, hit geometry and stale labeling are implementation
  contracts, not manual polish.

## Out of scope
- Audit persistence, event semantics, payload, API response, permissions,
  access scope and backend descriptions.
- Filter fields, filter drawer workflow or `CompactFilterPanel` redesign.
- New Action/Object columns or removal of diagnostics from details.
- Local translation of unknown action/entity types or arbitrary English
  backend descriptions.
- New audit operations, export, sorting, page-size selection or route changes.
- Shared pagination redesign outside the audit screen.
- Broad App.css, shared UX or API mapper refactoring.

## Required test coverage

### Unit/component tests
- Compact row presentation exposes date/time, exact description, action,
  entity/id and actor/login.
- Approved variant A retains exactly four semantic cells; the separate visual
  context region is not a fifth cell and is exposed once through Description
  accessibility semantics.
- No visible repeated mobile labels; accessible row/cell context remains.
- Known labels, raw unknown tokens and neutral empty-description fallback.
- Two-line visual clamp does not change the full description in DOM,
  accessibility output or details.
- Exactly four desktop headers/cells; no Action/Object columns.
- Global empty, filtered-empty, initial error/retry and same-query stale state.
- No application-owned delayed focus-return dependency.

### Integration tests
- Component integration with mocked API proves filter/page request preservation,
  filter reset-to-page-one, retry and stale response-key isolation.
- Pagination control/item names, current page and disabled semantics.
- Known total renders `Страница X из Y`; unknown total renders `Страница X`
  without a guessed `Y`.
- Modal open plus Escape/overlay/explicit-close focus return to exact trigger.
- Backend integration tests are not applicable because no API, permission,
  persistence or backend behavior changes.

### UI/e2e tests
- Primary scan → page → details → close path.
- Variant A grid areas match the approved hierarchy and typical row is
  `<=128px`; long actor/context wraps without clipping/overflow, while long
  description uses the intentional two-line visual clamp and retains its full
  accessible/details value.
- At least three typical rows in the `390 x 844` content region and target
  four at `440 x 956`.
- Every pager control `>=44 x 44px`, gap `>=8px`, stable names and correct
  disabled/current state.
- No horizontal overflow at `360/390/420/440/768/1440`.
- Both target-iPhone WebKit projects and compact-height smoke preserve details
  close reachability and pager/list usability.
- Loading, empty, filtered-empty, error/retry, stale and permission-restricted
  paths preserve the intended state and recovery.

## Expected initial failure verification
- Current mobile rows show three repeated labels and the typical annotated row
  exceeds the approved compact height.
- Current row has no action/entity context outside details.
- Current audit Pagination controls measure below `44 x 44px` and previous/
  next lack the approved names.
- Overlay and explicit timer-independent focus assertions fail against
  `returnFocus={false}` plus `window.setTimeout`.
- Initial error lacks explicit retry; global/filtered empty and stale refresh
  behavior do not satisfy the approved recovery contract.
- Existing four-column/no-Action/no-Object tests should remain green and act as
  preservation barriers.

## Test plan
- [x] Create/verify isolated worktree and branch from current `origin/main`.
- [x] Run focused baseline and record pre-existing failures.
- [x] Write/update unit/component presentation and state tests before code.
- [x] Write/update component integration pagination/focus/request tests before
      code.
- [x] Write/update Playwright geometry, close-path and responsive tests before
      code.
- [x] Run new tests on unchanged code and record expected red evidence.
- [x] Implement minimal audit-local React/Mantine/CSS changes.
- [x] Rerun focused tests to green.
- [x] Run full `test:unit`, `lint`, `build`, `check:raw-colors`.
- [x] Run affected Chromium Playwright suites.
- [x] Run `test:e2e:iphone` for both target WebKit projects.
- [x] Report Simulator/physical-device checks that remain unverified.

## Regression barrier
TASK-107 is protected by a three-layer automated barrier:

1. component tests lock exact/raw presentation, variant A four-cell semantics,
   known/unknown-total pagination copy and names/states, retry/stale isolation
   and timer-free focus paths;
2. responsive Chromium tests lock row/pager geometry, density, long-content
   wrapping and absence of horizontal overflow;
3. target-iPhone WebKit tests lock the real mobile branch, touch-size pager and
   Escape/overlay/explicit-close focus recovery at `420 x 912` and
   `440 x 956`.

No implementation is complete if any layer is absent or if manual QA is the
only evidence for focus, geometry or recovery.

## Risks
- Adding action/entity context can erase the density gain if every metadata
  token is rendered as a separate labeled line.
- A hard `max-height` could clip long description/actor/entity content;
  `<=128px` applies only to the defined typical fixture.
- Icon-only details can lose meaning without a stable row-specific name.
- Variant A adds a visual context item outside the four cells; incorrect ARIA
  ownership could create a fifth semantic table item or duplicate spoken
  context. Tests must lock four cells and one accessible context exposure.
- Mantine internal markup/props may differ from assumptions; inspect installed
  v9 APIs instead of relying on brittle selectors.
- Numbered `44px` page controls can overflow narrow content; mobile must use
  the reduced control set rather than horizontal scrolling.
- Removing the manual timeout without establishing active trigger focus can
  regress touch/Safari focus return.
- Keeping old data after a different filter/page request can mislabel records;
  stale preservation must be keyed to the same request.
- English/technical detection heuristics would distort meaning; no language
  detection is permitted.
- Broad App.css selectors could alter other registries; all new styles stay
  audit-local.

## Stop conditions
Stop and return for clarification before production code if:
- correct behavior requires backend/API/payload, audit semantics or permission
  changes;
- the four-column desktop contract cannot retain required decision data
  locally;
- target pagination cannot fit without a shared cross-screen redesign;
- focus return requires unsafe detached-node or timer behavior;
- implementation scope expands into filter workflow, global shared UX or
  unrelated audit refactoring;
- task branch/worktree is ambiguous, dirty or not based on current
  `origin/main`;
- acceptance requires irreversible destructive production data changes.

Do not stop merely because mobile, tablet and desktop variants or component
plus Playwright tests are all affected.

## Ready for Codex execution
completed

## Completion evidence
- Completed on 2026-08-22 in commit `e89802c`, fast-forward integrated into local `main`.
- Expected RED recorded before production code: repeated labels, `199.7px` typical mobile row, `32 x 32px` unnamed pager controls, timer-based focus recovery and missing retry/stale barriers.
- Integrated `main` validation passed: 468 unit tests, lint, production build, raw-color scan with 0 disallowed findings, 96 combined affected Chromium Playwright tests and 38 target-iPhone WebKit tests.
- Backend/API/database contracts, audit payload semantics and permissions did not change; no migration or Docker Compose task stack was required.
- Physical Safari/iOS Simulator, dynamic chrome, actual safe-area/home-indicator behavior and physical-device touch remain residual device-only checks.
