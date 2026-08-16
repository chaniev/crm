# Implementation Plan: TASK-116 Открывать карточку клиента из посещений и группы

## Source task
/backlog/done/TASK-116-client-profile-context-navigation.md

## Implementation branch
fix/TASK-116-client-profile-context-navigation

Branch rules:
- до изменения project code прочитать `.agents/skills/task-worktree/SKILL.md`
  и создать либо безопасно возобновить отдельный worktree
  `../crm-worktrees/TASK-116-client-profile-context-navigation`;
- создать branch непосредственно от актуального `origin/main`; primary
  repository оставить на `main`, а код менять только в task worktree;
- до первой правки подтвердить registered worktree, active branch, отсутствие
  unexplained changes и `git merge-base --is-ancestor origin/main HEAD`;
- не включать TASK-017, TASK-104, другие backlog-задачи, backend/API changes
  или общий redesign Home, attendance, group edit либо client details;
- Docker Compose по умолчанию не запускать: задача покрывается frontend unit,
  component, route-integration, mocked Playwright и target-iPhone WebKit
  проверками.

Planning evidence на 2026-08-16: primary repository находится на clean `main`
`9cea2f2ffadc3a0057dfdafd51c8aa0bdb172f9c`, совпадающем с локальным
`origin/main`; локальной/remote branch TASK-116 и назначенного ей worktree не
найдено. Executor обязан повторить эту проверку после `git fetch origin` и не
считать planning snapshot актуальным execution base.

## Goal
Тренер или администратор открывает доступную backend карточку конкретного
клиента прямо из attendance roster либо состава редактируемой группы и одним
понятным возвратом попадает в исходный рабочий контекст. Для attendance
восстанавливаются group/date/view, для group edit — exact `groupId`; primary
attendance marks, pending-save safety, typed routing и существующее recovery
поведение не регрессируют.

## Current understanding
- `HomeDashboard` монтирует `AttendanceWorkspace` внутри вкладки `Посещения`,
  но передаёт `onOpenClient` только в `AttentionPanel`. Поэтому
  `AttendanceClientRow` сейчас не имеет navigation callback.
- `AttendanceWorkspace` хранит `selectedGroupId`, `trainingDate` и
  `rosterView` только локально. Переход на `/clients/:clientId` размонтирует
  workspace, поэтому обычный возврат не может восстановить этот контекст без
  сериализованного typed snapshot.
- `AttendanceClientRow` уже отделяет identity от primary
  `AttendanceStateControl` и row-local `AttendanceSaveStatus`. В строке есть
  request/version guards; их нельзя переносить в navigation layer или обходить
  при pending save.
- `GroupEditScreen` загружает read-only `groupClients` и рендерит строки inline
  в `GroupManagement.tsx`. Строка показывает ФИО, телефон и status badge, но
  не принимает `onOpenClient`.
- `App.tsx` централизует client navigation через typed `AppRoute`,
  `getRoutePath`, `navigateWithClientListReturnState` и
  `navigateWithGroupListReturnState`. Existing client-list и group-list
  snapshots используют versioned/sanitized `history.state`, сохраняют
  `returnDepth` и удаляются при выходе из своего workflow.
- Текущий `ClientDetailScreen` всегда подписывает back action
  `К списку клиентов`, а `returnToClients()` без client-list snapshot ведёт в
  `/clients`. Этот fallback должен сохраниться для direct links, карточек
  `Требуют внимания` и других origin без нового контекста.
- Client details API и backend client scope уже существуют. TASK не меняет
  `lib/api.ts`, request/response DTO, database, permissions или business rules;
  backend xUnit tests не требуются, пока implementation discovery не выявит
  контрактное изменение.
- Existing component coverage находится в `AttendanceScreen.test.tsx` и
  `GroupManagement.test.tsx`; route-level behavior — в `App.test.tsx`;
  attendance Playwright — в `attendance.spec.ts`, responsive/target-device
  checks — в `responsive-main-screens.spec.ts` и
  `iphone-target-devices.spec.ts`.
- Задача medium risk, `Safe for Codex: yes`, локализуема во frontend и имеет
  реалистичный automated regression barrier. Product decisions по dirty group
  form, browser history, stale attendance recovery и callback ownership
  подтверждены 2026-08-16 и зафиксированы ниже.

## Confirmed decisions — 2026-08-16
- Если group form не изменена, profile action сразу открывает карточку клиента.
- Если group form изменена, перед переходом открыть semantic Mantine dialog с
  точным заголовком `Сохранить изменения в группе?` и тремя действиями:
  - `Сохранить` — выполнить существующую validation/update pipeline и только
    после успешного сохранения открыть выбранную карточку клиента;
  - `Не сохранять` — явно отбросить текущий draft и открыть выбранную карточку;
  - `Отмена` — закрыть dialog, остаться в той же группе, сохранить draft и
    вернуть focus к profile action выбранного клиента.
- Validation/API failure после `Сохранить` не открывает карточку: dialog
  закрывается, введённые значения сохраняются, existing field/form error
  показывается в группе, focus идёт к первому invalid field либо form error.
  Повторная отправка во время pending запрещена.
- Explicit details back action `К посещениям`/`К группе` одним действием
  возвращает в TASK-116 origin. Native Browser Back сохраняет обычную историю:
  после `details -> edit -> details` он сначала проходит intermediate entries;
  TASK-116 context на них не теряется и при достижении origin восстанавливается.
- `returnDepth` считается доверенным только для созданного приложением,
  versioned/sanitized context на scoped client routes. Текущая route, allowed
  origin, `originEntryKey` и bounded depth проверяются до `history.go`; после
  SPA `popstate` landed route/state сверяются с ожидаемым origin, mismatch
  заменяется safe typed fallback. Malformed/incompatible context не вызывает
  history traversal и использует existing `/clients` fallback.
- Stale attendance fields восстанавливаются независимо: недоступный `groupId`
  заменяется первой разрешённой группой с сохранением валидной даты; дата вне
  backend-returned boundaries заменяется `today` с сохранением доступной
  группы; оба поля сбрасываются только когда невалидны оба. Recovery message
  явно называет изменённый group/date context.
- Leaf rows передают только exact `clientId`. `AttendanceWorkspace` формирует
  attendance origin, `GroupEditScreen` владеет dirty-form dialog и формирует
  group origin после выбранного исхода, а `App.tsx` сериализует context и
  выполняет centralized navigation. Valid TASK-116 context имеет приоритет для
  client-details back presentation; compatible outer list snapshot сохраняется
  отдельно. Открытие из `Требуют внимания` без origin удаляет TASK-116 context.

## UX contract
- Пользователь: Coach, Administrator или HeadCoach, которому backend уже
  разрешает видеть выбранного клиента. Frontend не вычисляет client scope по
  роли, group membership или attendance payload.
- Основной контекст: быстрая работа с attendance roster на мобильном экране;
  дополнительный контекст: read-only состав внутри group edit для ролей с
  доступом к этой route.
- Primary attendance operation: отметить `Не отмечено`, `Был` или `Не был` и
  получить row-local save feedback. Эти controls остаются визуально и в
  keyboard order раньше secondary profile action.
- Frequent/secondary operation: открыть карточку выбранного клиента. В каждой
  затронутой строке существует ровно одно такое действие; вся row, avatar, имя
  и status badge не становятся отдельными clickable surfaces.
- Completion signal: URL соответствует `/clients/{clientId}`, карточка либо
  существующий loading/error state видимы, а back action называет origin:
  `К посещениям` или `К группе`. Для origin без TASK-116 context сохраняется
  `К списку клиентов`.
- Attendance return: вернуть route `/`, активную вкладку `Посещения`, exact
  доступные `groupId`, `trainingDate`, `rosterView` и focus к action исходного
  клиента либо к определённому surviving fallback.
- Group return: вернуть exact typed route `{ kind: 'groupEdit', groupId }` и
  focus к action исходного клиента после загрузки состава; existing group-list
  return snapshot продолжает работать при последующем возврате к реестру.
- Profile action из pristine group form открывает карточку сразу. Dirty group
  form сначала показывает dialog `Сохранить изменения в группе?`; `Сохранить`
  сохраняет и переходит только после success, `Не сохранять` отбрасывает draft
  и переходит, `Отмена` сохраняет draft и остаётся в группе.
- Если сохранение attendance row находится в `pending`, переход блокируется:
  action имеет доступно связанную причину `Сначала дождитесь сохранения
  посещения`, а текущий `Сохраняем…` остаётся live feedback. Не делать silent
  navigation, optimistic cancellation или очередь перехода.
- Если сохранение завершилось `failed`, карточку можно открыть: attempted state
  и retry уже сохранены в UI, а серверное состояние не считается успешным.
- Backend `403`/`404` либо load error в client details показывает существующий
  recovery/error UX; back action остаётся доступным и ведёт в origin. Не
  добавлять dead redirect, frontend permission inference или отдельный error
  contract.
- Browser Back/Forward использует те же history entries и sanitized typed
  context. Explicit origin action сразу возвращает в attendance/group, а native
  Back после details/edit проходит реальные intermediate entries. Malformed,
  stale или incompatible state fail-closed в существующий `/clients` fallback
  и не позволяет произвольный return path.

## UI specification

### Attendance client row
- Сохранить avatar, full name, professional/membership indicators и current
  attendance state controls.
- Добавить одно действие с stable accessible name
  `Открыть карточку клиента {ФИО}`. Переиспользовать shared Mantine
  `Button`/`IconButton`, Onest и theme tokens; не создавать raw `<a>` с вручную
  собранным URL.
- На узкой ширине действие может быть icon-only, но его DOM, accessible name,
  focus semantics и callback остаются теми же. На широкой версии допустима
  короткая visible label `Карточка клиента`.
- Hit area — минимум `44 x 44 CSS px`; расстояние до независимого соседнего
  touch target — минимум `8px`. Visible focus использует существующий shared
  focus style.
- Static identity остаётся первым content block, но первый interactive stop
  строки принадлежит attendance radio group; profile action следует после
  primary group без positive `tabIndex`. Row retry остаётся после action.
- Pending profile action не исчезает и не меняет accessible name; blocked
  state связан через `aria-describedby` либо эквивалентный semantic mechanism
  с доступной причиной. Disabled/aria-disabled behavior должен быть покрыт
  keyboard test, а не только цветом.

### Group client row
- Выделить focused `GroupClientRow` из inline map, если это необходимо для
  изолированного component test и чтобы не увеличивать `GroupManagement.tsx`.
- Сохранить ФИО, optional телефон и status badge. После badge разместить одно
  такое же profile action; whole-row click, edit action и overflow menu не
  добавлять.
- Long ФИО/phone/status переносятся внутри `min-width: 0`; action не сжимается
  ниже `44 x 44px` и не перекрывается form/substitution content.
- Единственный interactive control строки получает normal focus order и
  возвращает exact `client.id` через callback, переданный из `App.tsx` через
  `RouteViewport` и `GroupEditScreen`.
- `GroupClientRow` не знает form dirty state и typed route context. Он передаёт
  только `client.id`; `GroupEditScreen` либо открывает карточку сразу для
  pristine form, либо запускает dirty-form dialog.
- Dialog использует semantic Mantine `Modal`/существующий shared wrapper,
  содержит точный title `Сохранить изменения в группе?` и buttons `Сохранить`,
  `Не сохранять`, `Отмена`. `Сохранить` — primary, `Не сохранять` — явно
  destructive/secondary, `Отмена` — safe cancel; Escape/close control равны
  `Отмена`, сохраняют draft и возвращают focus к исходному profile action.
- Во время save pending повторный submit запрещён, `Сохранить` показывает
  pending state, а dismiss/`Не сохранять` не могут создать competing transition.
  При validation/API error navigation не происходит и existing form recovery
  остаётся доступным с введёнными значениями.

### Typed return-context contract
- Добавить один versioned discriminated history-state contract, например
  `ClientProfileReturnContext`, а не строковый query param, global store или
  browser-referrer heuristic.
- Allowed origins ограничены union:
  - attendance: typed Home route + sanitized `groupId`, ISO `trainingDate`,
    `rosterView`, `anchorClientId`, `originEntryKey`, `returnDepth`;
  - group edit: typed `{ kind: 'groupEdit', groupId }`, `anchorClientId`,
    `originEntryKey`, `returnDepth`.
- Serializer/parser должны сохранять unrelated history-state fields, иметь
  version check, trim/length/date/view/depth guards и отвергать arbitrary path,
  unknown kind/version и malformed payload.
- Перед push в client details сохранить тот же context в текущем origin entry
  через `replaceState`, затем передать его в destination entry. Поэтому native
  Back восстанавливает origin snapshot, Forward возвращает карточку, а
  explicit back может использовать validated app-created `returnDepth`.
- Context сохраняется через scoped `clientDetails -> clientEdit ->
  clientDetails` navigation и корректно увеличивает bounded `returnDepth`,
  чтобы редактирование из карточки не ломало TASK-116 origin. Native Back в
  такой цепочке проходит intermediate entries, тогда как explicit origin action
  возвращает сразу на depth origin. На unrelated route context удаляется.
- Существующие `ClientListReturnSnapshot` и `GroupListReturnSnapshot` не
  вкладывать в новый payload и не дублировать. History composition сохраняет
  совместимый snapshot на его entry; current TASK-017/client-list и group-list
  tests остаются зелёными.
- Attendance snapshot применяется только после загрузки разрешённых групп и
  date boundaries: не отправлять roster request для невалидированного stale
  `groupId`/date. Invalid fields восстанавливать независимо: stale group ->
  first allowed group, stale date -> `today`; сохранить второе поле, если оно
  валидно. Показать доступное recovery message, которое называет изменённые
  поля, и не выводить forbidden option.

### Responsive and focus behavior
- `360 x 780` — narrow guardrail; `390 x 844` — stress baseline;
  `420 x 912` и `440 x 956` — target iPhone portrait;
  `912 x 420` и `956 x 440` — compact-height; `768 x 1024` и
  `1440 x 1200` — representative tablet/desktop.
- На всех размерах action имеет `44 x 44px`, не overlap с name/status/mark
  controls, не создаёт document-level horizontal overflow и остаётся reachable
  над fixed bottom navigation/safe-area reservation.
- На compact height не вводить sticky/fixed row action, nested scroll или
  second temporary surface. Normal page scroll и existing shell reservation
  должны сохранять достижимость.
- Dirty-form dialog на `360 x 780`, portrait targets и compact height сохраняет
  видимый title и три button не меньше `44 x 44px`; actions могут перейти в
  одноколоночный Stack, dialog имеет один intentional scroll без nested scroll
  trap и остаётся внутри safe area/dynamic viewport.
- После возврата focus идёт к исходному profile action, когда row всё ещё
  существует. Attendance fallback: `attendance-roster-view-control`, затем
  roster/results region; group fallback: heading `Клиенты группы`, затем group
  page heading/back action. Не фокусировать исчезнувший/hidden element.
- Native button activation поддерживает Enter/Space. Explicit back сразу ведёт
  в origin; Browser Back/Forward сохраняет обычный entry-by-entry порядок, при
  этом каждое scoped entry несёт тот же validated origin context. Positive tab
  indices и breakpoint-specific duplicate DOM запрещены.
- Safari chrome, Dynamic Island, home indicator и physical safe area нельзя
  считать подтверждёнными только Chromium/WebKit viewport emulation; остаток
  явно документируется.

## Execution roles
1. UX/UI handoff уже выполнен на triage/planning stage: source TASK фиксирует
   origin surfaces, action priority, return context, pending-save behavior и
   responsive matrix. Новый redesign не требуется.
2. `test-automator` до production-кода добавляет pure-state, component,
   route-integration и Playwright red regressions; после implementation
   закрывает responsive и target-iPhone matrix.
3. `react-specialist` только после подтверждённого red state реализует
   минимальный React/Mantine/history-state change, применяя
   `.agents/skills/react-best-practices/SKILL.md`.
4. Если technical constraint требует изменить approved action priority,
   pending behavior или return semantics, подключить `ui-designer` и
   остановить implementation до обновления contract.
5. Координирующий агент проверяет worktree, test-first evidence, compatibility
   с existing list-return flows и результат против acceptance criteria.

## Execution steps

### Phase 0 — isolated workspace and baseline
1. Выполнить `git fetch origin`; перечитать root/frontend `AGENTS.md`, source
   TASK, этот plan, `crm-mobile-first-ui`, `react-best-practices` и
   `task-worktree`; создать/возобновить declared branch/worktree и вернуть
   verified path, branch, base commit и clean status.
2. До новых assertions запустить focused baseline:
   - `cd frontend && npm run test:unit -- src/App.test.tsx src/features/attendance/AttendanceScreen.test.tsx src/features/groups/GroupManagement.test.tsx src/features/clients/list/clientListReturnState.test.tsx src/features/groups/groupListReturnState.test.ts`;
   - `npm run test:e2e -- attendance.spec.ts groups-registry.spec.ts`.
   Отделить pre-existing failures от ожидаемого TASK-116 red state.
3. Source-search подтвердить все consumers `onOpenClient`, history-state strip/
   merge helpers, client detail back label, attendance/group row classes и
   target-iPhone projects. Не менять backend/API и unrelated shared routing.

### Phase 1 — tests before functional code
4. До production-кода создать unit tests для versioned client-profile return
   context:
   - round-trip attendance и group-edit origins;
   - exact typed return route, `anchorClientId`, view/date и bounded depth;
   - merge сохраняет unrelated state и compatible existing list snapshot;
   - strip удаляет только TASK-116 key;
   - unknown version/kind, arbitrary path, blank/oversized ids, invalid date,
     view или depth fail closed;
   - scoped client details/edit routes сохраняют и увеличивают depth, unrelated
     route сбрасывает context;
   - explicit return использует history traversal только для valid app-created
     scoped context; malformed/mismatched landed origin fail closed в typed
     fallback без повторного traversal/loop.
5. До production-кода добавить `AttendanceClientRow` component tests:
   - ровно одно действие с exact ФИО и correct `clientId` callback;
   - row/avatar/name не clickable;
   - attendance radio group остаётся первым interactive owner, action — после
     него, retry — после action;
   - pending блокирует click/Enter без navigation и сообщает связанную
     доступную причину; saved/idle/failed допускают открытие;
   - professional/warning content и existing mark controls не регрессируют.
6. До production-кода расширить `AttendanceScreen.test.tsx` и
   `HomeDashboard.test.tsx`:
   - callback проходит Home -> AttendanceWorkspace -> exact row;
   - captured context содержит выбранные group/date/view/client;
   - restored snapshot загружает exact roster только после reconciliation с
     allowed groups и возвращает view;
   - stale group/date валидируются независимо: invalid group сохраняет valid
     date, invalid date сохраняет allowed group, оба invalid сбрасывают оба;
   - recovery message называет изменённые поля и ни один stale context не
     вызывает forbidden pre-validation request;
   - focus возвращается к row action или deterministic fallback;
   - tab `Посещения`, loading/error/empty/completed/scope-revoked states и
     `AttentionPanel` behavior сохраняются.
7. До production-кода создать `GroupClientRow` component tests и расширить
   `GroupManagement.test.tsx`:
   - ФИО, optional phone, status badge и ровно один action;
   - action следует после badge, имеет correct accessible name/hit-area class
     и передаёт exact `clientId`;
   - leaf row передаёт только `clientId`; `GroupEditScreen` формирует current
     `groupId`/origin callback;
   - pristine form открывает карточку без dialog;
   - dirty form открывает dialog `Сохранить изменения в группе?` с exact
     actions `Сохранить`, `Не сохранять`, `Отмена`;
   - `Сохранить` вызывает existing validation/update один раз и navigates only
     after success; validation/API error сохраняет draft, показывает existing
     recovery, фокусирует invalid/error target и не вызывает navigation;
   - `Не сохранять` не вызывает update и открывает exact client; `Отмена`,
     Escape и close control сохраняют draft, остаются в группе и возвращают
     focus к triggering row action;
   - save pending блокирует duplicate submit, dismiss и competing transition;
   - long content, empty clients и group load error не создают dead action;
   - focus restoration использует matching client или defined fallback.
8. До production-кода расширить `App.test.tsx` как route-integration barrier:
   - attendance origin push -> `/clients/client-1` -> explicit back/native
     popstate восстанавливает Home context;
   - group edit origin -> client -> back возвращает exact group route;
   - Forward снова открывает ту же карточку с валидным context;
   - client details -> edit -> details сохраняет origin: explicit origin action
     возвращает сразу, native Back проходит intermediate entries, Forward идёт
     по тем же entries с валидным context;
   - direct details и `Требуют внимания` сохраняют existing `/clients`
     fallback/label;
   - malformed state, top-level restricted/not-found recovery и session scope
     change не приводят к arbitrary path или loop.
9. До production-кода добавить focused
   `frontend/e2e/client-profile-context-navigation.spec.ts`:
   - attendance: выбрать non-default group/date/view `Все`, открыть exact client,
     проверить URL/card/back label, вернуться и проверить group/date/view;
   - pristine group edit: открыть client после status badge без dialog и
     вернуться на exact `/groups/{groupId}/edit`;
   - dirty group edit: проверить три исхода dialog — save-then-open,
     discard-then-open и cancel-with-preserved-draft/focus; failed save не
     меняет route и оставляет доступный form recovery;
   - delayed attendance save: profile action не уводит со страницы, причина
     доступна, после resolve action работает;
   - backend `403` или `404` для client details показывает existing recovery/
     error state и позволяет вернуться без dead click;
   - keyboard order, Enter/Space, visible focus и no whole-row activation.
10. До production-кода расширить responsive coverage:
    - Chromium geometry в focused spec либо `responsive-main-screens.spec.ts`
      для `360 x 780`, `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420`,
      `956 x 440`, `768 x 1024`, `1440 x 1200` на обеих surfaces;
    - action и все три dialog buttons >= `44 x 44px`, independent controls
      separated >= `8px`, long names/statuses wrap, no overlap, body/document
      no horizontal overflow;
    - dirty-form dialog имеет доступный title, safe focus trap/return и usable
      portrait/compact-height layout без nested scroll trap;
    - `iphone-target-devices.spec.ts` проверяет attendance round-trip и action
      geometry в обоих target WebKit projects portrait + compact landscape.
11. Запустить новые unit/component/route integration и Playwright tests на
    неизменённом production-коде. Сохранить expected red evidence: callback и
    row action отсутствуют; return context не сериализуется; back ведёт в
    `/clients`; group client row не интерактивна. Failure из-за broken mock,
    selector или unrelated baseline не считается корректным red state.

### Phase 2 — minimal functional implementation
12. Реализовать versioned client-profile return-state helper с sanitized union,
    merge/read/strip, scoped route retention, bounded depth и landed-origin
    validation для SPA popstate. Переиспользовать `AppRoute`/`getRoutePath`; не
    добавлять альтернативный path parser.
13. В `App.tsx` расширить один centralized `onOpenClient` contract origin
    metadata и history composition. Сохранить существующий adapter для
    `ClientListReturnSnapshot`, default attention flow и group-list snapshot;
    не собирать URL в child components.
14. Передать callback props через `RouteViewport`, `HomeDashboard`,
    `AttendanceWorkspace` и `GroupEditScreen`: leaf rows передают только
    `clientId`, screen/workspace добавляет typed origin. Сохранить snapshot в
    origin entry перед push; восстановить attendance values только после
    allowed-group/date reconciliation.
15. Обновить client-details back presentation/handler: dynamic label только для
    валидного attendance/group origin, exact history return и focus fallback;
    direct/malformed context использует existing `returnToClients`.
16. Добавить profile action в `AttendanceClientRow`; связать pending blocked
    state с row-local status/reason и сохранить mark request/version logic без
    изменений.
17. Выделить/добавить `GroupClientRow` и передать exact open callback из
    `GroupEditScreen`. Для dirty form реализовать local semantic Mantine dialog
    с тремя подтверждёнными исходами, переиспользовать existing validation/
    update pipeline и разделить save success continuation: normal submit
    сохраняет current behavior, dialog save открывает captured exact client.
    Сохранить read-only content, draft/error и existing empty/error behavior.
18. Добавить только локальные CSS rules для responsive action label, row grid,
    wrapping и focus. Переиспользовать `.shared-icon-button`/theme tokens; не
    добавлять raw colors, duplicate breakpoint DOM, row-wide link, sticky bar,
    horizontal или nested scroll.

### Phase 3 — green and regression closure
19. Повторно запустить focused unit/component/route-integration и Playwright
    suites. Исправлять production code по зафиксированному contract, не
    ослаблять id/history/focus/geometry assertions.
20. Запустить обязательные frontend checks из task worktree:
    - `cd frontend && npm run test:unit`;
    - `npm run lint`;
    - `npm run build`;
    - `npm run test:e2e -- client-profile-context-navigation.spec.ts attendance.spec.ts groups-registry.spec.ts responsive-main-screens.spec.ts`;
    - `npm run test:e2e:iphone -- iphone-target-devices.spec.ts`.
21. Выполнить source/DOM review: ровно одно action на row, нет ручных client
    URLs, frontend permission inference, stale history keys, duplicate DOM,
    positive tab indices, whole-row click, orphaned imports/classes или
    document-level overflow.
22. Провести manual keyboard check и, если доступны, Safari Responsive Design
    Mode/iOS Simulator/physical-device checks для browser Back/Forward, dynamic
    chrome, safe area, home indicator и compact landscape. Непроверенное явно
    зафиксировать как residual device risk; manual QA не заменяет automated
    regression barrier.

## Preferred implementation strategy
1. Versioned return-state unit tests и row component tests в red state.
2. Route-integration tests, доказывающие сохранение existing list snapshots.
3. Один centralized open/return contract в `App.tsx`.
4. Минимальное callback plumbing в attendance и group edit.
5. Local Mantine action + dirty-form dialog/CSS, затем focused Playwright и
   target-iPhone closure.

## Files likely to change
- `frontend/src/App.tsx`
- `frontend/src/App.test.tsx`
- `frontend/src/features/clients/clientProfileReturnState.ts` (new, preferred)
- `frontend/src/features/clients/clientProfileReturnState.test.ts` (new)
- `frontend/src/features/clients/ClientManagement.tsx`
- `frontend/src/features/home/HomeDashboard.tsx`
- `frontend/src/features/home/HomeDashboard.test.tsx`
- `frontend/src/features/attendance/AttendanceClientRow.tsx`
- `frontend/src/features/attendance/AttendanceClientRow.test.tsx` (new)
- `frontend/src/features/attendance/AttendanceScreen.tsx`
- `frontend/src/features/attendance/AttendanceScreen.test.tsx`
- `frontend/src/features/attendance/types.ts`
- `frontend/src/features/groups/GroupClientRow.tsx` (new, preferred)
- `frontend/src/features/groups/GroupClientRow.test.tsx` (new)
- `frontend/src/features/groups/GroupManagement.tsx`
- `frontend/src/features/groups/GroupManagement.test.tsx`
- `frontend/src/App.css`
- `frontend/e2e/client-profile-context-navigation.spec.ts` (new)
- `frontend/e2e/attendance.spec.ts` (only if shared fixture/flow coverage is
  more maintainable there)
- `frontend/e2e/responsive-main-screens.spec.ts`
- `frontend/e2e/iphone-target-devices.spec.ts`

Files to inspect but not expected to change:
- `frontend/src/lib/appRoutes.ts`
- `frontend/src/lib/appRoutes.test.ts`
- `frontend/src/features/clients/list/clientListReturnState.ts`
- `frontend/src/features/clients/list/clientListReturnState.test.tsx`
- `frontend/src/features/groups/groupListReturnState.ts`
- `frontend/src/features/groups/groupListReturnState.test.ts`
- `frontend/src/features/attendance/AttendanceSaveStatus.tsx`
- `frontend/src/features/attendance/AttendanceStateControl.tsx`
- `frontend/src/features/shared/IconButton.tsx`
- `frontend/src/lib/api/clients.ts`
- `backend/tests/GymCrm.Tests/ClientsApiTests.cs`

## Constraints
- Backend остаётся единственным владельцем client visibility, attendance,
  membership, permission, validation и ProblemDetails semantics.
- Не менять API request/response, database, auth/RBAC, allowed sections,
  attendance scope или group/client domain rules.
- Сохранить React 19, TypeScript, Vite, Mantine, Onest, theme tokens и current
  shared UX components; не вводить новую library или global state.
- Child rows передают только exact `clientId`; `AttendanceWorkspace` и
  `GroupEditScreen` добавляют typed origin, а URL/history/permission decisions
  не дублируются вне `App.tsx` routing boundary.
- Existing ClientList/GroupList return snapshots и direct client-details
  fallback остаются совместимыми.
- Attendance group/date/view snapshot не применяется до сверки с backend-
  returned allowed groups/date boundaries; invalid group/date восстанавливаются
  независимо с first-allowed-group/`today` fallback и точным recovery message.
- Dirty group form никогда не теряется молча: profile action открывает dialog
  `Сохранить изменения в группе?`; `Сохранить` navigates only after successful
  existing update pipeline, `Не сохранять` explicitly discards, `Отмена`/
  Escape/close сохраняют draft и возвращают focus к trigger.
- Во время dialog save pending запрещены duplicate submit, dismiss, discard и
  competing navigation. Validation/API failure сохраняет values, остаётся в
  группе и использует existing field/form error recovery.
- Pending attendance save не прерывается навигацией; blocked reason доступен.
  Failed/saved semantics не переопределяются.
- Attendance marks остаются primary; profile action не скрывается в overflow,
  не дублируется и не превращает row/avatar/name в click target.
- Hit area не меньше `44 x 44px`; stable name содержит full ФИО; visible focus
  и native keyboard activation обязательны.
- Fixed/sticky controls и shell safe-area rules не дублируются в row code.
- Не маскировать overflow через `overflow: hidden`, не добавлять horizontal
  scrolling, nested scroll, positive tab order или breakpoint-specific
  duplicate actions.

## Out of scope
- Карточки `Требуют внимания` и изменение их existing open behavior.
- Открытие client edit напрямую из attendance/group row.
- Перенос несохранённого group draft через client route и его восстановление
  после возврата. TASK включает локальный three-way unsaved-changes dialog, но
  после подтверждённого `Сохранить`/`Не сохранять` возвращает server-loaded
  group context.
- Application-wide navigation blocker для других действий/routes; dirty guard
  этой задачи ограничен profile action из group client row.
- Client-list filters/scroll redesign, group-list return-state redesign и
  объединение существующих snapshot contracts.
- Backend client scope, role/permission model, membership/attendance semantics,
  API/DB changes и new ProblemDetails codes.
- Whole-row links, client preview, modal client card, breadcrumbs, global
  navigation redesign или новый router package.
- Общий redesign attendance/group edit/client details.
- Physical-device certification, если Simulator/device недоступен; это
  документируемый residual risk.

## Required test coverage

### Unit tests
- Pure versioned history-state contract: attendance/group origins, exact typed
  routes, sanitize/round-trip/merge/strip, depth and fail-closed invalid input.
- Unit tests пишутся и запускаются до functional code; current absence helper
  должна дать ожидаемый red state.
- Отдельные backend/domain unit tests не применяются, потому что business/API
  behavior не меняется. Не создавать artificial domain helper ради теста.

### Component and route-integration tests
- `AttendanceClientRow`: exact action/name/id, one-action invariant, mark-first
  priority, pending reason, idle/saved/failed behavior.
- `AttendanceWorkspace`/`HomeDashboard`: callback plumbing, capture/restore
  group/date/view, allowed-scope reconciliation, stale fallback и focus.
- `GroupClientRow`/`GroupEditScreen`: content, status-then-action order, exact
  group/client origin, pristine direct-open, dirty three-way dialog, single
  save pipeline, validation/API failure, pending protection, cancel draft/focus,
  empty/error and focus fallback.
- `App`: push/back/forward, details-edit-details depth, direct fallback,
  malformed/restricted/not-found context and compatibility with existing
  client/group list snapshots.
- Эти tests являются frontend integration tests и пишутся до production code.
  Backend integration tests не добавляются, пока API contract неизменен.

### UI/e2e tests
- Attendance -> client -> back with exact group/date/view; pristine group edit
  -> client -> exact group route.
- Dirty group dialog covers save-then-open, discard-then-open,
  cancel-with-preserved-draft/focus and failed-save-without-navigation.
- Delayed save blocking with accessible reason, plus allowed and backend-
  restricted/not-found card paths.
- Correct client ID, exactly one row action, Enter/Space, focus order/return,
  visible focus and no whole-row activation.
- Geometry/no-overflow matrix: `360 x 780`, `390 x 844`, `420 x 912`,
  `440 x 956`, `912 x 420`, `956 x 440`, `768 x 1024`, `1440 x 1200`.
- Both target iPhone WebKit projects verify portrait and compact-landscape
  round-trip with iPhone UA, touch and `3x` scale. Emulator evidence does not
  replace real Safari/device disclosure.

## Expected initial failure verification
- `AttendanceClientRow` test fails because prop/action/accessibility contract
  отсутствуют.
- `GroupClientRow` test fails because component и action отсутствуют, а current
  inline row содержит только text/badge.
- Dirty group navigation tests fail because current form has no three-way
  confirmation and its submit success always follows existing `onUpdated`.
- History-state unit test fails because client-profile origin serializer/parser
  отсутствует.
- App integration fails because client detail back without list snapshot ведёт
  в `/clients` и label всегда `К списку клиентов`.
- Attendance restore test fails because `selectedGroupId`, `trainingDate` и
  `rosterView` инициализируются только локальными defaults.
- Pending test fails because navigation action ещё не существует и blocked
  reason не определена.
- Existing attendance save, list-return, group-return, direct client details и
  route recovery tests должны оставаться зелёными; их падение не является
  корректным TASK-116 red state.

## Test plan
- [x] Unit/component/route-integration/Playwright tests написаны до production
      code и падают только по ожидаемым TASK-116 причинам.
- [x] В каждой attendance/group client row ровно одно действие с correct
      `clientId` и accessible name с ФИО.
- [x] Attendance marks сохраняют visual/keyboard priority; whole row не
      clickable.
- [x] Pending save блокирует navigation с доступной причиной; failed/saved
      row behavior сохраняется.
- [x] Attendance -> client -> back восстанавливает group/date/view и focus.
- [x] Group edit -> client -> back возвращает exact `groupId` и не ломает
      subsequent group-list return.
- [x] Pristine group form открывает client без dialog; dirty form показывает
      exact three-way dialog. `Сохранить`, `Не сохранять`, `Отмена`, Escape,
      failed save, pending protection, preserved draft и focus return работают
      по confirmed contract.
- [x] Native Back/Forward и details-edit-details сохраняют typed origin;
      native Back проходит intermediate entries, explicit action сразу ведёт в
      origin, malformed/direct context использует safe fallback.
- [x] Existing forbidden/not-found/load recovery доступен без dead click.
- [x] Все actions >= `44 x 44px`; long content, portrait, compact height,
      tablet/desktop не создают overlap/overflow.
- [x] Full unit, lint, build, affected Chromium Playwright и target-iPhone
      WebKit commands проходят.
- [x] Safari/Simulator/physical-device evidence либо residual risk явно
      зафиксированы.

## Completion record
- Completed on: 2026-08-16.
- Implementation commit: `afc7f5c`; integrated into local `main` by fast-forward at `bae4d08`.
- Automated validation: frontend lint, production build, 446 unit tests, 65 affected Chromium Playwright tests and 34 target-iPhone WebKit tests passed.
- Expected red barrier was confirmed before functional code: return-state helper, row actions and origin-aware return behavior were absent.
- Backend/API/database structure did not change; migration is not required.
- No Docker Compose task stack was created.
- Residual device risk: physical Safari chrome, software keyboard, safe-area, iOS Simulator and physical-device behavior were not verified; target-iPhone WebKit portrait and compact-landscape profiles passed.

## Regression barrier
Primary barrier: versioned return-context unit suite + App route-integration
suite, которые защищают exact typed origin, Back/Forward/depth, direct fallback
и compatibility с existing client/group list snapshots. Component tests
защищают one-action/id/pending/priority contract; focused Playwright защищает
два round-trip workflow, backend recovery, keyboard/focus и `44 x 44px` /
no-overflow matrix, включая оба target-iPhone WebKit profile.

No implementation is complete if сохранение контекста проверено только вручную
либо screenshot заменяет behavioral/history assertions.

## Risks
- Неправильная composition history state может удалить TASK-017 client-list
  snapshot или group-list snapshot и создать скрытую cross-workflow регрессию.
- `history.go(-depth)` без strict version/origin guards может увести на внешний
  или stale entry; invalid context обязан использовать safe fallback.
- Инициализация attendance из snapshot до allowed-groups response может
  отправить запрос к больше недоступной группе и показать ложный forbidden.
- Переход details -> edit -> details может потерять или неверно увеличить depth
  без отдельного test.
- Disabled icon без связанной причины будет невидимо блокировать keyboard/
  screen-reader user; color/title-only недостаточны.
- Profile action, поставленный раньше radio group в interactive DOM order,
  нарушит mark-first workflow даже при слабом visual styling.
- Long ФИО/status и visible desktop label могут вытеснить mark controls или
  создать overflow; icon-only narrow mode должен сохранять один DOM/action.
- Dirty group dialog может случайно вызвать existing `onUpdated` и вернуть в
  group list вместо captured client; save pipeline должен принимать explicit
  success continuation и вызываться ровно один раз.
- Dismiss/discard во время pending save может создать race и двойной переход;
  все competing dialog actions должны быть заблокированы до завершения.
- Group draft не переносится через client route: после подтверждённого discard
  он потерян намеренно, а после save возврат загружает server state.
- Mocked Playwright не доказывает real backend permission semantics или Safari
  chrome/safe area; соответствующие ограничения нужно честно сообщить.

## Stop conditions
Остановиться и не писать project code, если:
- active workspace/branch не совпадает с declared TASK-116 worktree/branch,
  branch base неясен либо имеются unexplained changes;
- correct result требует изменить backend API, client/attendance/permission
  semantics, auth/RBAC или allowed-section model;
- typed return context нельзя локально совместить с существующими
  ClientList/GroupList snapshots без их redesign;
- требуется переносить unsaved group form draft через client route либо
  расширять local profile-action guard в application-wide blocker/global router;
- action priority/return behavior расходится с source UX contract и требует
  product/UI решения;
- acceptance возможно выполнить только через whole-row click, duplicate DOM,
  positive tab order, hit area меньше `44px`, horizontal/nested scroll или
  hidden/clipped control;
- expected red tests падают из-за API mock/selector setup или unrelated
  baseline, а не из-за отсутствующей TASK-116 функциональности;
- scope расширяется в общий redesign Home/attendance/groups/client details.

Не останавливаться только потому, что затрагиваются несколько frontend
components, shared route boundary или разные backend-разрешённые роли.

## Ready for Codex execution
yes — задача medium-risk и frontend-only, existing backend contract достаточен,
critical clarifications отсутствуют, UX/UI contract зафиксирован, отдельная
branch/worktree определена, а tests-before-production strategy покрывает pure
state, components, route integration, both user flows, recovery, responsive
geometry и target-iPhone regression barrier.
