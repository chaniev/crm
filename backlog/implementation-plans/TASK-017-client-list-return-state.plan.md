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
к тому же query, filters, page/page size, selected client и позиции списка без
повторного поиска; direct deep link и свежий вход в `/clients` продолжают
работать с безопасными defaults.

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
  6. продолжить работу с тем же result set и выбранной строкой.
- Completion signal: search input и filter controls содержат прежние значения,
  range/page соответствует прежнему result set, открытый клиент снова selected,
  а viewport возвращён к прежней list position без открытия software keyboard.
- Новые visible controls не добавляются; filter drawer, menus и dialogs при
  возврате остаются закрытыми.
- На `390 x 844`, `420 x 912`, `440 x 956`, `768 x 1024` и `1440 x 1200`
  семантика одинакова. На `912 x 420` и `956 x 440` восстановленная row и
  recovery action не должны оказаться недоступны за bottom navigation/safe
  area.
- Direct deep link `/clients/:id` без prior snapshot открывает detail как
  сейчас; CTA возвращает к default `/clients`.
- Detail load error не удаляет snapshot и не блокирует возврат к списку.

## State ownership and lifetime
- Использовать один versioned, namespaced `history.state` payload, привязанный
  к конкретной browser history entry и client workflow.
- Payload хранит только primitive list criteria: normalized filters,
  `searchDraft`, page, selected/anchor client id, finite non-negative scroll
  offset и focus target.
- Не хранить client objects, preview cache, ФИО, phone, backend responses,
  loading/error state или temporary-surface state.
- Query может содержать персональные данные, поэтому не переносить его в URL,
  `localStorage` или `sessionStorage`; same-tab `history.state` является
  ограниченной navigation-state границей.
- Reload той же valid history entry восстанавливает snapshot. Новый tab,
  copied/direct link, version mismatch, malformed/cleared state или fresh
  `/clients` используют defaults.
- При уходе из client workflow namespaced payload не должен автоматически
  копироваться в unrelated routes. Unrelated existing history-state keys нужно
  сохранять при controlled merge.
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
     scroll offset;
   - rejection/version fallback для malformed, unknown и unsafe values;
   - capability sanitization manager-only filter;
   - exact allowlist payload без client objects/names/phones/API data;
   - controlled carry внутри client workflow, stripping при unrelated
     navigation и сохранение чужих history-state keys.
3. До production-кода добавить frontend component/integration tests:
   - hook синхронно hydrates snapshot до первого `getClients`, поэтому нет
     default request/flicker;
   - restored query/filter/page формируют первый request и initial debounce не
     сбрасывает page на `1`;
   - search draft, applied query и page сохраняют корректную семантику, если
     navigation произошла внутри debounce window;
   - retry после list error использует те же restored params;
   - отсутствующий selected client удаляет stale selection и выбирает/focuses
     безопасный visible fallback;
   - invalid/direct-link state рендерит defaults.
4. До production-кода расширить Playwright regression:
   - использовать существующий `stage12.spec.ts` filter/page-2 scenario как
     основной integration path;
   - зафиксировать scroll и открываемого `client-filter-21`;
   - проверить отдельно browser Back и CTA `К списку клиентов`;
   - проверить request params, controls, range `21–21 из 21`, selection,
     focus/anchor и scroll tolerance после возврата;
   - покрыть direct deep link, detail load error и missing selected client;
   - добавить target-iPhone WebKit path в affected iPhone spec.
5. Запустить новые unit/component/Playwright tests до production-кода и
   зафиксировать ожидаемые failures: default hydration, page reset, missing
   history snapshot, scroll reset и отсутствующий focus/selection restore.
6. Реализовать локальный typed snapshot helper:
   - schema version и namespace;
   - strict parse/sanitize/serialize;
   - merge/carry/drop helpers для client workflow;
   - additive typed extension seam без неизвестного произвольного payload.
7. Изменить list state boundary минимально:
   - передать validated initial snapshot в `useClientsListState`;
   - инициализировать filters, draft, page и intended selected id лениво и
     атомарно до первого fetch;
   - не запускать redundant initial debounce, если normalized draft уже равен
     applied query;
   - не дублировать server data и не вводить global store.
8. Реализовать capture до navigation:
   - стабильно `replaceState` текущей list/preview entry при изменении
     criteria/page/selection;
   - непосредственно перед preview/detail navigation снять актуальный
     `window.scrollY` и override selected/anchor id идентификатором реально
     открываемого клиента;
   - передать snapshot в target client route через явный navigation option,
     а не через unconditional copy любого `window.history.state`.
9. Реализовать return routing:
   - browser Back естественно восстанавливает предыдущую list entry;
   - CTA `К списку клиентов` переносит valid snapshot в `/clients` и заменяет
     current detail entry, чтобы Back не открывал тот же detail loop;
   - client routes без snapshot возвращают default list;
   - общий top-scroll сохраняется для обычной navigation, а restore flow
     применяет сохранённую позицию после render.
10. После successful list load восстановить interaction state:
    - подтвердить наличие selected/anchor id среди загруженных rows;
    - выставить `aria-selected` только для существующей row;
    - после render frame восстановить finite scroll offset;
    - если anchor оказался вне usable viewport, использовать nearest/center
      `scrollIntoView`;
    - затем focus selected row с `preventScroll`;
    - при empty/stale/error focus направить на first row или существующий
      recovery action/results region, не на search input.
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
- Не помещать query или selected client в URL.
- Не использовать `localStorage`/`sessionStorage`.
- Не восстанавливать filter drawer, modal, menu или software keyboard.
- Сохранить direct client routes и current preview/detail operations.
- Сохранить Mantine, Onest и existing shared UI patterns.
- Не выполнять TASK-085 mobile card/search redesign или TASK-089 desktop
  split/preview redesign.

## Out of scope
- Backend search/filter changes.
- Новый client navigation architecture или полный router rewrite.
- Client detail redesign, tabs, quick actions и forms.
- Persistence между независимыми tabs/devices/browser sessions.
- Сохранение preview API cache или stale backend response.
- Out-of-range last-page clamping: при empty restored page сохранить criteria
  и использовать существующий empty/recovery state; отдельное изменение server
  pagination semantics требует новой задачи.

## Required test coverage

### Unit tests
- Versioned serialization, validation, defaults and capability sanitization.
- Exact payload allowlist and absence of client objects/personal display data.
- Client-workflow carry/drop rules and unrelated history-state preservation.
- Draft/applied-query hydration rule that does not reset restored page.

### Integration tests
- Frontend hook/component integration verifies initial restored API params,
  selection lifecycle, error retry and stale-selection fallback.
- App navigation integration verifies browser entry state, CTA replace
  behavior, direct-link defaults and stripping on unrelated navigation.
- Backend integration tests are not applicable because API/database/domain
  contracts do not change.
- Unit and frontend integration tests are written before functional code and
  run red for the expected missing behavior.

### UI/e2e tests
- Search + advanced filters + page 2 + scroll + open detail + browser Back.
- Тот же state через CTA `К списку клиентов`.
- Compact preview route plus return.
- Direct detail link without prior state.
- Detail/list error recovery and missing selected client.
- Admin and trainer capability-safe restoration.
- `390 x 844`, `420 x 912`, `440 x 956`, `768 x 1024`, `1440 x 1200`;
  compact-height smoke at `912 x 420` and `956 x 440`.
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
- the opened client is selected and focusable;
- scroll/anchor is restored within a documented tolerance;
- direct deep link without snapshot still returns to default `/clients`.

The same mechanism must have unit coverage for malformed/versioned state and
must not rely only on screenshots or manual QA.

## Risks
- Async list load, preview load and React render timing can restore scroll too
  early or more than once under StrictMode.
- Initial search debounce can silently reset restored page.
- Blind history-state copying can leak stale client context into other routes
  or overwrite unrelated state.
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
