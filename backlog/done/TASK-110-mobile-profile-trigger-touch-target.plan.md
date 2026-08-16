# Implementation Plan: TASK-110 Привести mobile profile trigger к touch contract

## Source task
/backlog/done/TASK-110-mobile-profile-trigger-touch-target.md

## Implementation branch
fix/TASK-110-mobile-profile-trigger-touch-target

Branch rules:
- до изменения project code применить `.agents/skills/task-worktree/SKILL.md`
  и создать либо безопасно возобновить отдельный worktree
  `../crm-worktrees/TASK-110-mobile-profile-trigger-touch-target`;
- создать branch непосредственно от актуального `origin/main`; primary
  repository оставить на `main`, а код менять только в task worktree;
- до первой правки подтвердить repo root, active branch, clean status,
  registered worktree и `git merge-base --is-ancestor origin/main HEAD`;
- не включать TASK-109, TASK-111, другие touch-target fixes, header redesign,
  auth/session changes или unrelated test refactoring;
- не основывать branch на незамерженной branch TASK-111 и не переносить из неё
  test-код: TASK-110 должен первым выпустить собственный focused regression
  contract, после чего TASK-111 расширяет общую audit matrix от `origin/main`.

Planning evidence на 2026-08-16: primary repository находился на clean `main`
`d0d65dc19411e8ed9c12c3ef0844910a09bea0ea`, совпадающем с локальным
`origin/main`; branch/worktree TASK-110 не найдены. Во время planning в primary
repository параллельно появились только backlog-изменения TASK-111/112; они не
являются execution base. Executor обязан выполнить `git fetch origin` и
повторить все проверки в отдельном worktree.

## Goal
Любой авторизованный пользователь одним tap/click либо с клавиатуры надёжно
открывает профильное меню: фактический border box shared trigger не меньше
`44 x 44 CSS px`, visible focus и popup semantics сохраняются, а mobile header
не становится визуально крупнее и не получает overlap или horizontal overflow.

## Current understanding
- Shared control создаётся в `AuthenticatedShell` в `frontend/src/App.tsx` как
  Mantine `Menu` → `Menu.Target` → `UnstyledButton` и передаётся trailing
  control в `Header`/`AppLayout`.
- `.app-shell__profile-trigger` задаёт vertical padding `0.7rem`, border и
  icon/text layout, но не minimum block size. На ширине до `75rem` имя скрыто,
  trigger центрируется и ограничивается `max-width: 3rem`; live measurement
  фиксирует фактический box около `48 x 42px`.
- Ширина уже проходит `44px`; дефект локализован в высоте. Global
  `box-sizing: border-box` уже установлен в `frontend/src/index.css`.
- `AppLayout` резервирует header высотой `72px` на mobile и `76px` от `48em`.
  Добавление двух недостающих CSS pixels в control не требует менять header
  height, brand size, icon size или placement.
- Stable accessible name уже задаётся как
  `Открыть профильное меню пользователя ${user.fullName}`. Mantine должен
  владеть `aria-haspopup`, `aria-expanded`, Enter/Space, Escape и focus return;
  это нужно сначала зафиксировать тестами, а не дублировать custom state.
- `frontend/src/App.test.tsx` открывает profile menu click-ом и проверяет его
  content, но не защищает closed/open ARIA contract, keyboard activation,
  Escape и focus return.
- `frontend/e2e/touch-target-inventory.spec.ts` уже выполняет matrix
  `360x780`, `390x844`, `420x912`, `440x956`, `768x1024`, `1440x1200`,
  `912x420`, `956x440`, но profile trigger отсутствует среди candidates.
- Target-iPhone WebKit projects уже существуют для `420 x 912` и `440 x 956`.
  Desktop Chromium viewport checks являются geometry coverage, а не physical
  iPhone/Safari acceptance.
- TASK-084 выпустил общий `44 x 44px` baseline. TASK-111 уже выбран как
  отдельная test-only audit matrix и зависит от TASK-110: product fix и focused
  profile regression принадлежат TASK-110, общая cross-surface consolidation —
  TASK-111 после merge TASK-110.
- Backend/API/database/roles/permissions не затрагиваются. Задача low risk,
  `Safe for Codex: yes`, critical clarification questions отсутствуют.

## UX and UI contract

### User task and states
- Пользователь: любой authenticated user; frontend не ветвит profile trigger
  по роли и не меняет backend-owned permissions.
- Primary path: trigger открывает существующее profile menu одним tap/click;
  menu показывает неизменные `Смена пароля` и `Выход` operations.
- Completion signal: menu видимо, trigger сообщает open state, первый menu
  operation keyboard-reachable.
- Trigger отсутствует до authenticated shell. Для него не создаются loading,
  empty, error или permission-restricted variants.
- Trigger остаётся enabled при `logoutPending`; disabled/pending semantics
  продолжают принадлежать только menu item `Выход`.

### Geometry and visual behavior
- Фактический border box самого `button`, а не icon, pseudo-element или
  прозрачный overlay, составляет минимум `44 x 44 CSS px`.
- На mobile/tablet сохраняются существующие `max-width: 3rem`, hidden profile
  name, размеры `IconUserCircle 18px` и chevron `16px`, padding, radius,
  border, shadow, colors и trailing placement.
- Ожидаемая mobile geometry после minimal fix — не меньше текущих `48px` по
  ширине и `44px` по высоте. Не увеличивать `AppLayout` header height и не
  масштабировать brand/avatar/icon для получения hit area.
- Не использовать negative margins, absolute hit slop, pseudo-elements,
  transparent overlays или `overflow: hidden` для маскировки geometry.
- Если рядом появляется самостоятельный interactive header control, между
  фактическими boxes требуется минимум `8px`; brand/non-interactive content не
  должен перекрываться trigger-ом.

### Interaction and accessibility
- Trigger остаётся native button с неизменным accessible name.
- Tap/click, Enter и Space открывают одно и то же Mantine menu.
- Closed state сообщает `aria-haspopup="menu"` и `aria-expanded="false"`;
  open state — синхронное `aria-expanded="true"`.
- Escape закрывает menu, возвращает `aria-expanded="false"` и focus на trigger.
  Outside click закрывает menu без искусственного перемещения normal document
  focus.
- Existing `:focus-visible` outline `2px` + `2px` offset сохраняется, если его
  полный rect не clipping-уется header ancestors. Не убирать visible focus.
- Mantine `Menu.Target` остаётся владельцем popup/keyboard state. Controlled
  React state допустим только если red test докажет реальное расхождение; его
  нельзя добавлять профилактически.

### Responsive acceptance
- `360 x 780`: icon-only header остаётся в одну строку; target `>=44 x 44px`,
  brand корректно truncate-ится, page не получает horizontal overflow.
- `390 x 844`: primary stress baseline с теми же geometry/interaction checks.
- `420 x 912` и `440 x 956`: target-iPhone portrait WebKit — touchscreen tap,
  popup semantics, menu fit, Escape/focus return и отсутствие overflow.
- `768 x 1024`: coarse tablet inventory сохраняет compressed `3rem` trigger и
  minimum target.
- `912 x 420` и `956 x 440`: compact-height coarse shell сохраняет reachable
  header trigger, unclipped focus/menu и не конфликтует с bottom navigation.
- `1440 x 1200`: имя видимо, existing maximum width сохраняется, keyboard focus
  и menu behavior не регрессируют.
- Safari dynamic chrome, safe-area/home indicator и physical touch требуют
  Simulator/physical-device evidence; WebKit emulation не выдаётся за него.

## Execution roles
1. UX/UI contract зафиксирован на planning stage через `ui-designer`; workflow
   и visual hierarchy не меняются.
2. `test-automator` до production-кода добавляет component и Playwright
   geometry/behavior regressions и фиксирует expected red measurement.
3. `react-specialist` после red evidence применяет минимальную React 19/Mantine
   совместимую CSS correction; `App.tsx` меняется только при доказанной ARIA
   проблеме.
4. Координирующий агент проверяет worktree, test-first order, dependency
   boundary с TASK-111 и итог против `crm-mobile-first-ui` acceptance.

## Execution steps

### Phase 0 — isolated workspace and baseline
1. Выполнить `git fetch origin`; перечитать root/frontend `AGENTS.md`, source
   TASK, этот plan, `task-worktree`, `crm-mobile-first-ui` и
   `react-best-practices`; создать/возобновить declared branch/worktree.
2. Вернуть evidence: absolute worktree path, active branch, HEAD/origin-main
   commits, clean status, worktree ownership и successful ancestor check.
3. Подтвердить текущих owners profile menu, CSS selectors, header height,
   test fixtures и отсутствие другого profile trigger implementation. Не
   расширять scope при нахождении unrelated undersized controls.
4. До новых assertions запустить focused baseline:
   - `cd frontend && npm run test:unit -- App.test.tsx`;
   - `npm run test:e2e -- e2e/touch-target-inventory.spec.ts`;
   - `npm run test:e2e:iphone -- e2e/iphone-target-devices.spec.ts`.
   Отделить pre-existing/browser-install/fixture failures от TASK-110 red.

### Phase 1 — tests before functional code
5. До изменения `App.css` расширить `frontend/src/App.test.tsx` component test:
   - exact role/name и stable accessible name с ФИО;
   - `aria-haspopup="menu"` и closed `aria-expanded="false"`;
   - click, Enter и Space открывают menu и синхронизируют expanded state;
   - Escape закрывает menu и возвращает focus trigger-у;
   - `Смена пароля` сохраняет existing handler, а trigger не становится
     disabled из-за `logoutPending`.
   Это characterization barrier; существующая Mantine semantics может быть
   green до CSS fix и не должна искусственно ломаться ради red state.
6. До production-кода добавить shared authenticated-shell candidate в
   `frontend/e2e/touch-target-inventory.spec.ts`:
   - locate по role/name, не по private Mantine class;
   - измерять один shared trigger один раз на viewport, например с synthetic
     route/state `__shell__/authenticated`, без дублирования на каждой route;
   - писать actual bounding box в machine-readable JSON;
   - при coarse pointer требовать width/height `>=44`, empty allowlist и
     отсутствие page overflow;
   - проверять overlap/gap только с реально независимыми visible header
     controls.
7. До production-кода расширить `frontend/e2e/iphone-target-devices.spec.ts`
   focused profile-menu scenario для обоих target WebKit projects:
   - touch-enabled iPhone environment и authenticated `/` fixture;
   - actual box `>=44 x 44px` и trigger внутри header/visual viewport;
   - touchscreen tap/click, popup/expanded state, keyboard open/close и exact
     focus return;
   - visible focus не clipped, menu остаётся reachable, document/body не
     получают horizontal overflow.
8. Запустить новые tests до functional code. Обязательный expected red:
   inventory и target-iPhone geometry сообщают текущую высоту около `42px`,
   то есть ниже `44px`, на mobile/coarse cases. Semantic characterization может быть green.
   Сохранить имя test, viewport и actual measurement. Если geometry tests сразу
   green на актуальном `origin/main`, остановиться: перепроверить live audit,
   computed styles и stale task вместо внесения бессодержательной CSS правки.

### Phase 2 — minimal functional change
9. Только после подтверждённого red добавить в existing
   `.app-shell__profile-trigger` реальный minimum size, предпочтительно
   `min-inline-size: 44px` и `min-block-size: 44px` либо согласованные в проекте
   `min-width/min-height: 44px`. Сохранить current mobile `max-width: 3rem`.
10. Не менять current padding, icons, name visibility, header height, menu
    content, auth/session handlers, routes или permissions. Не добавлять
    `!important`, pseudo hit area, absolute overlay либо новый shared
    abstraction для одного control.
11. `frontend/src/App.tsx` менять только если Phase 1 выявила реальную
    несинхронность Mantine ARIA/menu state. В этом случае сначала зафиксировать
    отдельный red behavior test, применить минимальный controlled-state fix и
    сохранить existing password/logout handlers; иначе оставить file без
    изменений.
12. Если minimum size вызывает brand wrapping, chevron overlap, header height
    change или focus clipping, не скрывать symptom CSS-ом. Вернуть conflict
    `ui-designer` и остановить расширение scope.

### Phase 3 — green and regression closure
13. Повторно запустить focused component, inventory и target-iPhone tests.
    Не ослаблять `44px`, ARIA, focus или overflow assertions и не добавлять
    allowlist exception для profile trigger.
14. Запустить обязательные frontend checks из task worktree:
    - `cd frontend && npm run test:unit`;
    - `npm run lint`;
    - `npm run build`;
    - `npm run test:e2e -- e2e/touch-target-inventory.spec.ts`;
    - `npm run test:e2e:iphone -- e2e/iphone-target-devices.spec.ts`.
15. Выполнить source/DOM review: ровно один shared trigger, actual button box
    `>=44 x 44px`, stable accessible name, нет duplicate DOM/custom permission
    logic, pseudo hit slop, clipping mask, allowlist entry или horizontal page
    scroll.
16. Manual keyboard smoke выполнить на `390 x 844`, `912 x 420` и desktop:
    Tab → Enter/Space → Escape → focus return. При наличии проверить Safari
    Responsive Design Mode/iOS Simulator/physical device с dynamic chrome,
    safe area и home indicator. Непроверенное зафиксировать как residual device
    risk; manual QA не заменяет automated regression barrier.

## Preferred implementation strategy
1. Component characterization и shared-shell inventory candidate до CSS.
2. Target-iPhone WebKit geometry/interaction red evidence.
3. Одна local minimum-size correction в existing CSS selector.
4. React state change только при доказанной semantic regression.
5. Focused green, затем full frontend and device-emulation barriers.

## Files likely to change
- `frontend/src/App.css`
- `frontend/src/App.test.tsx`
- `frontend/e2e/touch-target-inventory.spec.ts`
- `frontend/e2e/iphone-target-devices.spec.ts`

Conditional only:
- `frontend/src/App.tsx` — только если test докажет, что Mantine не
  синхронизирует `aria-expanded`/focus contract.

Files to inspect but not expected to change:
- `frontend/src/features/shared/Header.tsx`
- `frontend/src/features/shared/AppLayout.tsx`
- `frontend/src/index.css`
- `frontend/playwright.config.ts`
- `frontend/e2e/touch-target-inventory.allowlist.ts`

## Constraints
- Backend остаётся владельцем auth/session, roles, permissions и navigation
  availability; API/database/backend tests не меняются.
- Сохранить React 19, TypeScript, Vite, Mantine, Onest и existing theme tokens.
- Actual target измеряется по native button border box; icon size или
  pseudo-element не считаются hit area.
- Minimum interactive target `44 x 44 CSS px`; между independent targets
  минимум `8px`; visible focus, accessible name и popup/expanded semantics
  обязательны.
- Не менять menu content, password/logout flows, header height, brand/avatar
  geometry, side/bottom navigation или safe-area foundation.
- Не вводить custom Menu implementation, duplicate DOM by breakpoint, global
  state, positive tab index, raw colors, allowlist exception или screenshot-only
  regression.
- TASK-110 выпускает focused profile test и production fix. TASK-111 после его
  merge может переиспользовать этот spec/inventory entry, но не дублирует fix.

## Out of scope
- Редизайн header, avatar, profile menu или mobile navigation.
- Изменение пунктов `Смена пароля`/`Выход`, logout pending UX, auth/session
  semantics, route destinations или permission model.
- Исправление settings, audit, attendance, schedule и других touch targets.
- Общий refactor `touch-target-inventory.spec.ts` сверх минимального shared
  shell candidate.
- Изменение password form или software-keyboard flow, если TASK-110 не вызвал
  конкретную регрессию.
- Заявление о physical iPhone/Safari acceptance без device evidence.

## Required test coverage

### Unit/component tests — written before production code
- Обновить `frontend/src/App.test.tsx` до `App.css`/`App.tsx` изменений.
- Защитить stable accessible name, native button/menu role, popup + closed/open
  expanded states, click/Enter/Space, Escape/focus return и existing password/
  logout behavior.
- CSS geometry в jsdom не проверять: это не реальный layout engine. Component
  tests являются semantic characterization, а не geometry substitute.
- Отдельные pure unit tests не требуются: task не добавляет business logic,
  reducer, mapper, validation или API transformation.

### Integration/UI tests — written before production code
- Playwright inventory — обязательный integration boundary shared
  authenticated shell, CSS layout, Mantine control и browser geometry.
- Проверить actual target на `360x780`, `390x844`, `420x912`, `440x956`,
  `768x1024`, `912x420`, `956x440`; desktop `1440x1200` остаётся keyboard/
  clipping regression, даже если fine-pointer minimum policy не применяется.
- Target WebKit projects проверяют `420 x 912` и `440 x 956` с touch enabled,
  real tap, ARIA state, keyboard close/focus return и page overflow.
- Initial red обязан быть связан с `~48 x 42px`, а не с broken fixture,
  missing browser, port collision или unrelated route failure.
- Backend integration tests не применимы, потому что API/auth/permissions/
  database contracts не меняются. Playwright full-shell test — ближайший
  автоматизированный integration barrier.

### Manual/device-only verification
- Safari dynamic chrome, actual safe-area inset, home indicator и physical
  touch accuracy остаются Simulator/physical-device checks.
- Software keyboard для самого trigger не применим; existing `Смена пароля`
  form smoke нужен только для подтверждения отсутствия побочной регрессии.
- Непроверенные device-only пункты перечислить явно и не считать automated
  green доказательством physical acceptance.

## Test plan
- [x] Component tests добавлены до production-кода и сохраняют profile menu
  accessible name, popup/expanded state, Enter/Space, Escape и focus return.
- [x] Shared profile candidate добавлен в machine-readable touch inventory без
  allowlist и без route-by-route duplicate measurements.
- [x] До CSS fix записан expected red: actual mobile height `42.375px`.
- [x] После fix actual border box `>=44 x 44px` на `360`, `390`, `420`, `440`,
  `768`, `912x420` и `956x440`.
- [x] Target-iPhone WebKit `420 x 912` и `440 x 956` проходит touchscreen tap,
  popup/expanded, Escape/focus return и overflow checks.
- [x] Header остаётся одной строкой; brand, visible icons, chevron, focus ring и
  menu не overlap/clipping-уются в portrait/compact landscape.
- [x] `npm run test:unit`, lint, build, affected Chromium inventory и iPhone
  WebKit suites проходят из declared task worktree.
- [x] Simulator/physical Safari gaps записаны отдельно, если не проверены.

## Regression barrier
Главный барьер — non-allowlisted machine-readable inventory entry shared
profile trigger: при любом будущем computed width или height меньше `44px`
coarse-pointer suite обязан падать и печатать actual box/viewport. Его дополняют
App component semantics и target-iPhone WebKit interaction test, который
защищает accessible name, popup/expanded state, tap, keyboard close, focus
return, focus visibility и отсутствие page overflow. Manual QA не может
заменить ни один из этих automated barriers.

## Risks
- Mantine может менять способ инъекции `aria-haspopup`/`aria-expanded`; test
  должен проверять public observable semantics, а не private attributes/classes
  сверх ARIA contract.
- Увеличение высоты на `2px` может выявить существующее focus clipping или
  compressed icon/chevron geometry; это требует UI conflict review, а не
  скрытия overflow и не header redesign внутри TASK-110.
- Profile candidate в inventory можно случайно измерять на каждой route и
  раздуть suite/artifacts; synthetic shared-shell entry должен делать это один
  раз на viewport.
- Параллельная TASK-111 меняет тот же inventory. Без последовательного merge
  возникнут conflicts или duplicate assertions; TASK-110 merge должен
  предшествовать TASK-111 integration.
- Browser emulation не доказывает physical Safari chrome, safe area или touch
  accuracy; completion report обязан сохранить эту caveat.

## Stop conditions
Остановиться и не писать/не расширять production code, если:
- task branch/worktree не соответствует declared branch, dirty/ambiguous или
  не основан на актуальном `origin/main`;
- geometry test green до fix и live `48 x 42px` defect не воспроизводится;
- исправление требует менять header/navigation layout, menu content,
  auth/session/roles/permissions, backend/API или другой shared touch system;
- `44px` target нельзя получить без overlap, focus clipping или изменения
  утверждённого header rhythm;
- требуется брать код из незамерженной TASK-111 либо обе branches независимо
  меняют одну и ту же focused assertion без согласованной sequence;
- acceptance criteria требуют product decision, которой нет в source task.

Не останавливаться только потому, что control shared для всех ролей или потому,
что tests находятся в unit и Playwright layers: scope остаётся локальным.

## Completion evidence
- Completed on 2026-08-16 in commit `449ee76`, fast-forward integrated into local `main`.
- Expected red captured before production code: `48 x 42.375px` on all seven coarse-pointer inventory viewports and both target-iPhone WebKit projects.
- Production change stayed local to `.app-shell__profile-trigger`: `min-inline-size` and `min-block-size` are `44px`; `App.tsx`, header dimensions, icons, menu state and allowlist were not changed.
- Integrated validation passed: 449 unit tests, lint, production build, 12 Chromium touch-inventory tests and 36 target-iPhone WebKit tests.
- One-time WebKit keyboard smoke passed at `390 x 844`, `912 x 420` and `1440 x 1200`.
- No backend/API/database change, migration, Docker Compose task stack or branch-local runtime remained.
- Physical Safari/iOS Simulator, dynamic chrome, actual safe-area/home indicator and physical touch remain residual device-only checks.

## Ready for Codex execution
completed
