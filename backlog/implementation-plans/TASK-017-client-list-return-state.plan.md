# Implementation Plan: TASK-017 Сохранять состояние списка при возврате из карточки клиента

## Source task
/backlog/implementation/TASK-017-client-list-return-state.md

## Implementation branch
fix/TASK-017-client-list-return-state

Branch rules:
- использовать `.agents/skills/task-worktree/SKILL.md` и отдельный worktree,
  созданный directly from актуального `origin/main`;
- подтвердить repository root, clean status, active branch, worktree ownership
  и `origin/main` ancestry до изменения project code;
- не реализовывать в этой branch TASK-085 mobile search-focused UI или
  TASK-089 desktop preview collapse/overflow;
- TASK-017 должен быть merged до начала TASK-085 и TASK-089.

## Goal
Администратор или тренер после просмотра preview/full client card возвращается
к последнему намеренно введённому query, тем же filters/page size, ожидаемой
page и позиции списка без повторного поиска; direct deep link и свежий вход в
`/clients` продолжают работать с безопасными defaults. Если navigation началась
до завершения search debounce, новый draft становится applied query, а
восстановление начинается с page `1` и нового server request.

## Current understanding
- `useClientsListState` сейчас владеет search draft, applied filters, page,
  selection и preview cache локально; при переходе на detail route hook
  размонтируется и состояние теряется.
- `useAppRoute.navigate` копирует текущий `window.history.state` во все новые
  entries и всегда вызывает `window.scrollTo({ top: 0 })`, но typed client-list
  snapshot и restore contract отсутствуют.
- `ClientDetailScreen` вызывает `onReturnToClients`, который открывает чистый
  `/clients`; browser Back и CTA не имеют явной общей семантики возврата.
- Compact layout открывает `/clients/:id/preview`, desktop сохраняет selection
  только внутри mounted list, а full card открывается через `/clients/:id`.
- Существующий `stage12.spec.ts` проверяет сохранение client filters при
  pagination внутри списка, но не unmount/detail/back/scroll restoration.
- При синхронной hydration восстановленный `searchDraft` нельзя безусловно
  отправлять через initial debounce: текущий `updateFilters` сбросит
  восстановленную page на `1`.
- В debounce window поле поиска уже содержит новый `searchDraft`, но текущие
  rows ещё соответствуют прежнему applied query. Если пользователь в этот
  момент открывает клиента, новый normalized draft является следующим applied
  query; старые rows не сохраняются и при возврате не показываются.
- Backend API, search semantics, permissions и client data contracts не
  меняются.

## UX and interaction contract
- User: администратор или тренер с backend-granted доступом к `Clients`.
- Primary path:
  1. открыть `/clients`;
  2. задать search/filters и при необходимости перейти на следующую page;
  3. выбрать и открыть клиента;
  4. просмотреть preview/detail;
  5. вернуться через browser Back или `К списку клиентов`;
  6. продолжить работу с восстановленным search context и list position.
- Completion signal: search input и filter controls содержат актуальные
  значения, первый `/api/clients` request использует сразу ожидаемые criteria и
  page без промежуточного default/старого request, а viewport возвращён к
  сохранённой list position без открытия software keyboard.
- При navigation после уже применённого поиска восстанавливаются прежние
  query/page. При navigation внутри debounce window normalized `searchDraft`
  становится applied query, page сбрасывается на `1`, и после возврата
  отображаются результаты нового request; прежние client rows не кэшируются.
- Browser Back сохраняет native route order:
  - `/clients -> /clients/:id` возвращает сразу в исходный list entry;
  - `/clients -> /clients/:id/preview` возвращает в исходный list entry;
  - `/clients -> /clients/:id/preview -> /clients/:id` сначала возвращает в
    preview, а следующим Back — в исходный list entry.
- CTA `К списку клиентов` из full detail при valid return metadata переходит
  непосредственно к исходному list entry, пропуская промежуточный preview.
  Forward history остаётся browser-native; новый duplicate `/clients` entry не
  создаётся.
- Новые visible controls не добавляются; filter drawer, menus и dialogs при
  возврате остаются закрытыми.
- На `360 x 780`, `390 x 844`, `420 x 912`, `440 x 956`, `768 x 1024` и
  `1440 x 1200` семантика одинакова. На `912 x 420` и `956 x 440`
  восстановленная row и recovery action не должны оказаться недоступны за
  bottom navigation/safe area.
- Direct deep link `/clients/:id` без prior snapshot открывает detail как
  сейчас; CTA заменяет direct detail entry на default `/clients`.
- Detail load error не удаляет snapshot и не блокирует возврат к списку.

## State ownership and lifetime
- Использовать один versioned, namespaced `history.state` payload, привязанный
  к конкретной browser history entry и ограниченному return-state workflow:
  `/clients`, `/clients/:id/preview`, `/clients/:id`.
- Payload хранит только primitive list criteria: normalized filters,
  `searchDraft`, page, selected/anchor client id, finite non-negative scroll
  offset и focus target, а также non-PII origin-list entry key и positive
  return depth для адресного CTA-возврата.
- Не хранить client objects, preview cache, ФИО, phone, backend responses,
  loading/error state или temporary-surface state.
- Непосредственно перед preview/detail navigation сравнить normalized
  `searchDraft` с applied `filters.query`. Если значения различаются, snapshot
  получает новый query и page `1`; restored `searchDraft` согласован с новым
  applied query, поэтому initial debounce не создаёт второй request.
- Query может содержать персональные данные, поэтому не переносить его в URL,
  `localStorage` или `sessionStorage`; same-tab `history.state` является
  ограниченной navigation-state границей.
- Reload той же valid history entry восстанавливает snapshot. Новый tab,
  copied/direct link, version mismatch, malformed/cleared state или fresh
  `/clients` используют defaults.
- Snapshot переносится только между list/preview/detail. `/clients/new`,
  `/clients/:id/edit`, logout, auth/user boundary и unrelated routes не входят
  в TASK-017 workflow и получают history state без client-list namespace.
  Unrelated existing history-state keys нужно сохранять при controlled merge.
- Предусмотреть versioned typed extension point для downstream UI state, но
  TASK-017 не реализует `browse/search-focused` из TASK-085 или preview
  open/collapsed из TASK-089.
- Restored state санитизируется текущими capabilities: недоступный тренеру
  manager-only `withoutGroup` filter не применяется.

## Execution steps
1. Создать task worktree/branch, прочитать `frontend/AGENTS.md`,
   `crm-mobile-first-ui` и `react-best-practices`, затем подтвердить текущие
   route, list hook, filter и Playwright boundaries.
2. До production-кода добавить unit tests для versioned snapshot helpers:
   - round-trip всех filter primitives, draft, page, selected/anchor id и
     scroll offset, origin-list entry key и return depth;
   - rejection/version fallback для malformed, unknown и unsafe values;
   - capability sanitization manager-only filter;
   - exact allowlist payload без client objects/names/phones/API data;
   - controlled carry только для list/preview/detail, stripping для
     create/edit/logout/auth/unrelated navigation и сохранение чужих
     history-state keys;
   - pending draft canonicalization: новый normalized query, page `1` и
     отсутствие повторного initial debounce.
3. До production-кода добавить frontend component/integration tests:
   - hook синхронно hydrates snapshot до первого `getClients`, поэтому нет
     default request/flicker;
   - restored query/filter/page формируют первый request и initial debounce не
     сбрасывает page на `1`;
   - navigation внутри debounce window записывает новый draft как applied
     query с page `1`, а первый restored request сразу использует новые params
     без request со старым query/page;
   - retry после list error использует те же restored params;
   - отсутствующий selected client на вернувшемся `/clients` удаляет stale
     selection и focus направляется на first visible row без выбора другого
     клиента;
   - route client id остаётся authoritative на `/clients/:id/preview`, даже
     если этот client отсутствует в rows нового query;
   - empty/error return focus направляется на recovery action или results
     region, не на search input;
   - invalid/direct-link state рендерит defaults.
4. До production-кода расширить Playwright regression:
   - использовать существующий `stage12.spec.ts` filter/page-2 scenario как
     основной integration path;
   - зафиксировать scroll и открываемого `client-filter-21`;
   - проверить отдельно native browser Back для list/detail, list/preview и
     list/preview/detail, включая два Back в последней цепочке;
   - проверить, что CTA из detail возвращает прямо к origin list entry и не
     создаёт duplicate `/clients` entry;
   - проверить request params, controls, range `21–21 из 21`, selection,
     focus/anchor и scroll tolerance после возврата;
   - отдельным сценарием открыть client внутри debounce window и проверить, что
     первый return request использует новый query/page `1`, без старого request;
   - покрыть direct deep link, detail load error и missing selected client;
   - добавить `360 x 780` guardrail и target-iPhone WebKit path в affected
     iPhone spec.
5. Запустить новые unit/component/Playwright tests до production-кода и
   зафиксировать ожидаемые failures: default hydration, pending-draft first
   request, missing history snapshot/return metadata, preview/detail route
   order, scroll reset и отсутствующий focus/selection restore.
6. Реализовать локальный typed snapshot helper:
   - schema version и namespace;
   - strict parse/sanitize/serialize;
   - route allowlist и merge/carry/drop helpers только для
     list/preview/detail;
   - origin-list entry key/return depth helpers для CTA и direct-link fallback;
   - additive typed extension seam без неизвестного произвольного payload.
7. Изменить list state boundary минимально:
   - передать validated initial snapshot в `useClientsListState`;
   - инициализировать filters, draft, page и intended selected id лениво и
     атомарно до первого fetch;
   - pending draft canonicalize до snapshot capture; при hydration normalized
     draft уже равен applied query, поэтому redundant initial debounce не
     запускается;
   - не дублировать server data и не вводить global store.
8. Реализовать capture до navigation:
   - стабильно `replaceState` только текущей `/clients` entry при изменении
     criteria/page/selection;
   - непосредственно перед preview/detail navigation canonicalize pending
     draft, снять актуальный `window.scrollY`, выставить page `1` при новом
     query и override selected/anchor id идентификатором реально открываемого
     клиента;
   - обновить origin list entry этим snapshot до push target route;
   - preview/detail entries переносят origin list scroll и не перезаписывают
     его своим `window.scrollY`;
   - передать snapshot в target client route через явный navigation option,
     а не через unconditional copy любого `window.history.state`.
9. Реализовать return routing:
   - browser Back следует native route order: detail -> preview -> list, если
     full card открыт из compact preview, и detail -> list при прямом открытии
     из list;
   - CTA `К списку клиентов` с valid origin key/return depth возвращает прямо к
     origin list entry; не создавать duplicate `/clients` и не оставлять
     preview следующим Back target;
   - direct client detail без snapshot заменяется CTA на default `/clients`;
   - create/edit и unrelated routes не carry TASK-017 snapshot;
   - общий top-scroll сохраняется для обычной navigation, а restore flow
     применяет сохранённую позицию после render;
   - согласовать custom restore с `history.scrollRestoration`, чтобы browser
     auto restore и application restore не гонялись; не менять scroll behavior
     unrelated routes после выхода из workflow.
10. После successful list load восстановить interaction state:
    - на `/clients` подтвердить наличие selected/anchor id среди загруженных
      rows; preview route id не инвалидировать по hidden list rows;
    - существующая selected row получает visual selected state и поддерживаемое
      для button/card состояние `aria-current="true"` вместо
      `aria-selected`; stale fallback не получает selected/current semantics;
    - после render frame восстановить finite scroll offset, clamp к current
      document bounds;
    - приоритет восстановления: selected/anchor visibility, затем usable
      viewport, затем raw scroll offset;
    - raw offset считается восстановленным при отклонении не более `16 CSS px`,
      если anchor остаётся полностью доступен; иначе использовать
      `scrollIntoView({ block: "nearest" })`, и exact-offset assertion
      заменяется assertion видимости anchor;
    - usable mobile viewport заканчивается минимум за `8 CSS px` до верхней
      границы bottom navigation/safe-area clearance; safe-area spacing
      объединяет existing spacing token и `env(safe-area-inset-bottom)`;
    - затем focus valid selected row с `preventScroll`;
    - если selected/anchor отсутствует, очистить selection и focus first
      visible row без выбора другого клиента;
    - при empty/error focus направить на существующий recovery action или
      results region, не на search input.
11. Запустить focused tests после каждого slice, затем полный frontend
    regression suite и обязательные target-device checks. Реальные Safari
    chrome, keyboard и safe-area observations отметить как verified или
    residual manual check, не заявляя physical-device acceptance без evidence.

## Preferred implementation strategy
1. Snapshot schema and navigation red tests.
2. Synchronous hook hydration red/green.
3. Capture/carry/return routing.
4. Post-load selection, focus and scroll restoration.
5. Direct-link, stale-data and responsive regression closure.

Approved UI handoff уже зафиксирован в этом плане. Implementation использует
`react-specialist`, а regression coverage — `test-automator`; material
interaction conflict возвращается `ui-designer` до изменения UX contract.

## Files likely to change
- `frontend/src/App.tsx`
- `frontend/src/features/clients/list/useClientsListState.ts`
- `frontend/src/features/clients/list/ClientsListScreen.tsx`
- `frontend/src/features/clients/list/ClientsResults.tsx`
- new `frontend/src/features/clients/list/clientListReturnState.ts`
- new `frontend/src/features/clients/list/clientListReturnState.test.ts`
- new focused client list state/component test near
  `frontend/src/features/clients/list/`
- `frontend/e2e/stage12.spec.ts`
- affected target-iPhone spec in `frontend/e2e/`
- `frontend/src/App.css` only if measured safe-area/scroll-margin fallback
  cannot reuse existing tokens

## Constraints
- Не менять backend API, search/filter semantics, permission model или
  ProblemDetails contracts.
- Не добавлять global state/store и не сохранять client server data.
- Не сохранять старые client rows для debounce-window сценария: возвращённый
  list всегда строится новым backend request.
- Не помещать query или selected client в URL.
- Не использовать `localStorage`/`sessionStorage`.
- Не восстанавливать filter drawer, modal, menu или software keyboard.
- Сохранить direct client routes и current preview/detail operations.
- Ограничить snapshot carry маршрутами list/preview/detail; create/edit не
  включать в TASK-017 return contract.
- Сохранить Mantine, Onest и existing shared UI patterns.
- Не выполнять TASK-085 mobile card/search redesign или TASK-089 desktop
  split/preview redesign.

## Out of scope
- Backend search/filter changes.
- Новый client navigation architecture или полный router rewrite.
- Client detail redesign, tabs, quick actions и forms.
- Return-state для client create/edit routes.
- Persistence между независимыми tabs/devices/browser sessions.
- Сохранение preview API cache или stale backend response.
- Out-of-range last-page clamping: при empty restored page сохранить criteria
  и использовать существующий empty/recovery state; отдельное изменение server
  pagination semantics требует новой задачи.

## Required test coverage

### Unit tests
- Versioned serialization, validation, defaults and capability sanitization.
- Exact payload allowlist and absence of client objects/personal display data.
- Exact list/preview/detail carry matrix, origin-list key/return depth and
  stripping for create/edit/logout/auth/unrelated routes while preserving
  unrelated history-state keys.
- Applied-query hydration rule that preserves restored page when draft already
  applied.
- Pending-draft rule that intentionally applies the new query and resets page
  to `1` before snapshot capture.

### Integration tests
- Frontend hook/component integration verifies initial restored API params,
  selection lifecycle, error retry and stale-selection fallback.
- App navigation integration verifies native list/preview/detail order, direct
  CTA return to origin list entry, direct-link defaults and stripping outside
  the exact route allowlist.
- Backend integration tests are not applicable because API/database/domain
  contracts do not change.
- Unit and frontend integration tests are written before functional code and
  run red for the expected missing behavior.

### UI/e2e tests
- Search + advanced filters + page 2 + scroll + open detail + browser Back.
- Тот же applied state через CTA `К списку клиентов` без duplicate list entry.
- Compact preview route, full detail и native Back order.
- Pending draft -> новый query/page `1` первым return request без старых rows.
- Direct detail link without prior state.
- Detail/list error recovery and missing selected client.
- Admin and trainer capability-safe restoration.
- `360 x 780`, `390 x 844`, `420 x 912`, `440 x 956`, `768 x 1024`,
  `1440 x 1200`; compact-height smoke at `912 x 420` and `956 x 440`.
- Target iPhone checks use WebKit mobile emulation/touch; desktop Chromium
  viewport resize alone не считается Safari acceptance.

## Test plan
- [ ] Snapshot/navigation unit tests written and red before implementation.
- [ ] Hook/component integration tests written and red before implementation.
- [ ] Return-state Playwright tests written and red before implementation.
- [ ] Focused Vitest files green.
- [ ] Affected Chromium Playwright spec green.
- [ ] `cd frontend && npm run test:e2e:iphone`
- [ ] `cd frontend && npm run test:unit`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] Safari Responsive Design Mode/Simulator/physical-device residual checks
      reported explicitly.

## Regression barrier
Task completion requires an automated scenario that starts with search,
advanced filters, page 2 and non-zero list scroll, opens a concrete client,
then asserts after browser Back and after the explicit return CTA:

- identical `/api/clients` query params and page;
- restored search/filter controls and range;
- the opened client is current and focusable when it remains in returned rows;
- missing opened client clears current selection and focuses first visible row
  without marking another client current;
- raw scroll is restored within `16 CSS px` when the anchor remains usable, or
  the anchor is fully visible above bottom navigation/safe area when exact
  offset cannot be retained;
- CTA returns to the origin list entry without a duplicate `/clients` entry;
- direct deep link without snapshot still returns to default `/clients`.

An additional automated debounce-window scenario must type a new query and open
a still-visible client before `250 ms`, then assert that the first request after
return uses the new normalized query with page `1`, no request with the old
query is sent and no old rows are rendered after return, and stale-selection
fallback applies if the opened client is absent.

The same mechanism must have unit coverage for malformed/versioned state and
must not rely only on screenshots or manual QA.

## Risks
- Async list load, preview load and React render timing can restore scroll too
  early or more than once under StrictMode.
- Initial search debounce can silently reset restored page.
- Applying a pending draft can intentionally remove the opened client from the
  new result set; preview remains route-id driven, while returned list clears
  stale selection.
- Blind history-state copying can leak stale client context into other routes
  or overwrite unrelated state.
- Incorrect return depth can reopen preview after CTA or navigate past the
  origin list entry.
- List data can change while detail is open, invalidating page, selection or
  anchor.
- TASK-085/TASK-089 can create a second persistence mechanism unless they
  extend the single versioned contract.

## Stop conditions
Остановиться и не писать production-код, если:
- task branch/worktree не соответствует плану или base не является актуальным
  `origin/main`;
- exact restoration требует помещения query/phone/name в URL либо durable
  persistent storage;
- существующий history state имеет другого owner и безопасный namespaced merge
  невозможно определить;
- direct-link и return semantics нельзя локализовать без полного router rewrite;
- implementation требует backend contract, permission или domain-rule changes;
- scope расширяется до TASK-085/TASK-089 или materially меняет approved
  workflow.

## Ready for Codex execution
yes
