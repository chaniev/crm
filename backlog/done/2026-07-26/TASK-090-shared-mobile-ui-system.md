# TASK-090: Ввести единую mobile UI system и deployment theme profiles

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-07-26 12:13
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/2026-07-26/TASK-090-shared-mobile-ui-system.plan.md
- implementation_branch: feature/TASK-090-shared-mobile-ui-system
- moved_to_done_at: 2026-07-26

## Priority
P0

## Git branch
feature/TASK-090-shared-mobile-ui-system

## Goal
Все mobile CRM screens используют один task-first UX/UI contract, shared
components и semantic tokens. Разные deployment выбирают утверждённую palette
из одного или двух основных и трёх–четырёх дополнительных цветовых семейств,
а также зарегистрированное фоновое изображение стартовой страницы без
screen-specific CSS и без изменения смысла действий или состояний.

## User role
Суперадминистратор / администратор / главный тренер / тренер.

## Normative contract

[Единый контракт мобильного интерфейса CRM](../../../docs/MOBILE_UI_CONTRACT.md)

## Problem

`TASK-084`–`TASK-089` описывают полезные локальные улучшения, но без общей
foundation их реализация может создать несколько вариантов:

- page header и locator;
- card density и action hierarchy;
- filters и active states;
- loading/empty/error/restricted states;
- touch sizes и compact-height behavior;
- радиусов, теней и локальных цветов.

Текущий `theme.ts` задаёт часть palette, но `App.css` и feature code всё ещё
содержат hardcoded hex/rgba. `/api/config` передаёт deploy-time `clubName`, но
не theme profile или background profile. Текущее
`frontend/src/assets/auth/k4pro-login-bg.png` жёстко связано с CSS и пропало из
новых auth mockups вместо того, чтобы оставаться default deployment asset.

## UX contract

Общий primary path:

1. открыть разрешённый section;
2. использовать видимый primary locator;
3. сузить набор;
4. выбрать task-oriented result;
5. открыть preview/detail/edit;
6. вернуться с сохранёнными query, filters, page/batch, selection и scroll.

На одном state виден один dominant primary action. Secondary filters скрыты на
mobile, но active filters остаются видимыми и удаляемыми. Backend остаётся
владельцем permissions, scope, filter options и allowed actions.

## Scope

### Theme foundation

- Расширить backend `/config` и frontend `AppConfigResponse` полями `themeId`
  и `authBackgroundImageId`.
- Добавить deployment env `CRM_THEME_ID` / backend
  `Branding__ThemeId`.
- Добавить deployment env `CRM_AUTH_BACKGROUND_IMAGE_ID` / backend
  `Branding__AuthBackgroundImageId`.
- Добавить frontend registry versioned `ThemeProfile`.
- Добавить frontend registry versioned `AuthBackgroundProfile`.
- Добавить обязательные profiles:
  - `default-green-v1`;
  - `test-blue-coral-v1`.
- Backend заменяет missing/blank `ThemeId` на `default-green-v1`, trim-ит и
  возвращает non-empty identifier без копирования frontend registry.
- Backend заменяет missing/blank `AuthBackgroundImageId` на
  `k4pro-login-v1`, trim-ит и возвращает non-empty identifier без копирования
  frontend asset registry.
- Frontend единолично разрешает known/unknown identifier через
  `resolveThemeProfile(themeId)`; unknown даёт default + warning.
- Frontend единолично разрешает background identifier через
  `resolveAuthBackgroundProfile(authBackgroundImageId)`; unknown даёт
  `k4pro-login-v1` + warning.
- Реализовать `createGymCrmTheme(profile)`.
- Вынести config/theme bootstrap перед meaningful `App` render:
  `ConfigThemeBootstrap` владеет `/config`, разрешает theme/background profiles
  и монтирует `MantineProvider`; `App` не делает duplicate config request.
- Обновить `test/render.tsx`, чтобы tests могли передавать default/test theme
  и auth background profiles.
- Вынести neutral, text, border, action, selection, focus и status roles в
  semantic tokens/CSS variables с prefix `--crm-`.
- Обеспечить deterministic fallback на `default-green-v1`.
- Зарегистрировать `k4pro-login-v1` как default background, который использует
  текущее `frontend/src/assets/auth/k4pro-login-bg.png`.
- Обеспечить deterministic fallback background id:
  missing/blank -> `k4pro-login-v1`; unknown/broken -> default + warning,
  затем semantic solid background при недоступности default asset.
- Убрать theme-sensitive raw brand/accent/surface/border/focus/selection colors
  из всех shared и feature call sites.
- Перевести functional status/category colors на invariant status tokens или
  configurable accent families.
- Зафиксировать явный allowlist для оправданных asset-specific overlays.
- Добавить static check, запрещающий новые raw colors вне registry, semantic
  token source и allowlist.

### Shared mobile foundations

- Typography, spacing, radii и density из normative contract.
- Единая для mobile и desktop политика route-level copy: title + actions по
  умолчанию, без декоративных subtitle/eyebrow/badge/intro/helper.
- `decision/usefulness test` и placement допустимых validation, recovery,
  constraint, security/legal и operational-state пояснений.
- Единая mobile/desktop политика primary search: без видимых generic labels
  `Поиск`/`Найти...`, но со stable accessible name, не зависящим от
  placeholder.
- Единый route-title visibility test: top-level list не показывает visible
  header, если active persistent nav/tab уже однозначно называет route;
  semantic `h1` и document title сохраняются.
- Touch target minimum `44 x 44`, gap minimum `8px`.
- iPhone input text minimum `16px`.
- Coarse-pointer compact-height shell.
- Safe-area и dynamic viewport для bottom navigation, drawers и modals.
- Единые focus return, mobile back и Escape semantics.

### Shared component recipes

- `PageLayout` / `PageHeader` / `PageSection`;
- route-level `PageLayout` / `PageHeader` API без свободных
  description/eyebrow/badge slots; optional context принимает только
  operational decision data из нормативных исключений;
- `PageLayout` поддерживает visually-hidden route `h1` без пустого header
  wrapper; actions скрытого header переходят в locator/toolbar/summary row;
- `MobileBottomNavigation` поддерживает route-derived adaptive fourth slot:
  default primary destination либо label/icon текущего authorized overflow
  destination; пятый `Ещё` остаётся стабильным drawer trigger;
- `EntityLocatorBar` держит primary search, filter trigger и retained
  primary/frequent actions в одной non-wrapping строке на mobile, tablet и
  desktop; action-only второй level запрещён;
- mobile create/add может использовать accessible icon-only `44 x 44px`, а
  desktop возвращает icon + text только при сохранении одной строки;
- `SectionHeader` остаётся отдельным section-level contract и не используется
  как обход запрета route-level пояснений;
- active persistent tab не сопровождается section/title/summary widget,
  повторяющим label вкладки или очевидное имя коллекции; list/state начинается
  сразу, а semantic list name остаётся accessible-only;
- primary filter/control не предваряется generic task heading/instruction или
  decorative date/scope meta, когда active tab, control label и selected value
  уже задают контекст; desktop не возвращает удалённый intro;
- единственный однозначный workspace context selector может скрыть generic
  visible label при сохранении operation-specific accessible name; ordinary
  forms и ambiguous/multi-selector toolbars сохраняют visible labels;
- `EntityLocatorBar`;
- `EntityLocatorBar` разделяет required `accessibleLabel`, task-oriented
  `placeholder` и exceptional `visibleLabel`; последний запрещён для
  единственного очевидного route-level search.
- mobile-inline primary control mode для `CompactFilterPanel`;
- `ActiveFiltersBar`;
- `ListRangeStatus`;
- `TaskItem` variants;
- `RestrictedState`;
- единые loading, empty, error, stale и success states;
- shared notification placement;
- shared drawer/modal footer.

Minimum ownership и props берутся из normative contract. Components создаются
как focused files в `features/shared` и re-export через `shared/ux.tsx`;
screen-specific domain fields передаются slots/props, а не кодируются внутри
shared components.

### Migration boundary

Foundation task мигрирует shared primitives, shell и representative call sites,
а также все theme-sensitive colors, не реализуя screen-specific workflows
`TASK-085`–`TASK-089`.

## Out of scope

- Coach effective schedule scope из `TASK-087`.
- Client search-focused state и `96px` cards из `TASK-085`.
- Group search/paging data flow из `TASK-086`.
- Route-specific permission resolution из `TASK-088`.
- Client desktop split из `TASK-089`.
- Dark theme.
- Произвольные runtime hex/CSS из deployment config.
- Произвольные runtime URL, binary image data, upload и crop/overlay CSS из
  deployment config; custom image сначала регистрируется как versioned asset.
- Разные themes для ролей.
- Backend business rules.

## Deployment theme contract

Один profile содержит:

- один required primary family;
- один optional secondary family;
- три required и один optional supplementary families;
- общую invariant neutral/status foundation.

Deployment выбирает только registered frontend `themeId`. Новый profile проходит
contrast и affected-screen tests до добавления в registry. Unknown/missing
theme не ломает bootstrap: missing/blank backend config возвращает default без
warning, unknown frontend registry id использует default с reportable warning.

Deployment независимо выбирает registered `authBackgroundImageId`.
`k4pro-login-v1` использует текущее `k4pro-login-bg.png` и является default.
Background profile владеет bundled asset и focal point; auth overlay, crop и
CSS не передаются через `/api/config`.

Theme может менять brand/action/nav/accent presentation, но не:

- status meaning;
- permission/restricted meaning;
- layout и action hierarchy;
- typography, density, spacing, radii;
- touch targets;
- responsive и safe-area behavior.

## Responsive behavior

- `360 x 780`: one-column guardrail, no horizontal page scroll.
- `390 x 844`: primary mobile stress baseline.
- `420 x 912`: target iPhone Air acceptance.
- `440 x 956`: target iPhone 17 Pro Max acceptance.
- `768 x 1024`: tablet transformation без потери decision data.
- `1440 x 1200`: compact desktop без mobile density и без
  subtitle/intro/hero-copy, запрещённых на mobile.
- `912 x 420`, `956 x 440`: touch compact-height shell, dynamic viewport,
  reachable primary action, no nested scroll trap.

## Operational states

- Config loading использует bundled default theme до resolved bootstrap или
  не показывает meaningful UI в неверной palette; auth stage использует
  bundled `k4pro-login-v1` до resolved background profile.
- Missing/blank backend theme возвращает `default-green-v1`.
- Missing/blank auth background возвращает `k4pro-login-v1`.
- Unknown non-empty identifier возвращается backend как configured value, а
  frontend даёт соответствующий default theme/background и reportable warning.
- Unknown/broken background не блокирует login и не сдвигает auth card.
- Shared loading не выглядит empty.
- Empty, error, stale, restricted и success имеют разные contracts.
- Retry не очищает locator/context.
- Permission-restricted controls не показываются как dead disabled actions.

## Acceptance criteria

- [ ] Все affected mobile shared controls имеют target минимум `44 x 44`.
- [ ] Inputs/selects/textareas на iPhone имеют `font-size >= 16px`.
- [ ] Compact-height touch не получает desktop-only shell.
- [ ] Shared surfaces используют semantic tokens, а не raw brand colors.
- [ ] `/api/config` возвращает `themeId` и `authBackgroundImageId`;
      missing/blank backend config возвращает `default-green-v1` и
      `k4pro-login-v1`.
- [ ] Unknown non-empty id не валидируется дублирующим backend registry:
      frontend использует соответствующий default profile и reportable warning.
- [ ] `k4pro-login-v1` использует текущее
      `frontend/src/assets/auth/k4pro-login-bg.png` на `auth-login`, forced
      `auth-password-change`, auth loading и bootstrap error.
- [ ] Background сохраняет aspect ratio/focal point и не ухудшает доступность
      auth card на `360`, `390`, `420`, `440`, `768`, `1440`.
- [ ] Unknown/missing/broken background использует deterministic default/solid
      fallback и не блокирует login.
- [ ] `default-green-v1` и `test-blue-coral-v1` проходят одинаковый
      representative screen suite.
- [ ] Theme switch не меняет geometry, hierarchy, permissions и status meaning.
- [ ] Color не является единственным status/selected/validation signal.
- [ ] Normal text contrast не меньше `4.5:1`, large text/UI boundary не меньше
      `3:1`.
- [ ] `EntityLocatorBar`, active filters, range state и shared state panels
      имеют один documented API/recipe.
- [ ] На mobile, tablet и desktop отсутствуют постоянные route-level
      subtitle/eyebrow/badge/intro/helper, не прошедшие
      `decision/usefulness test`.
- [ ] В `client-details` под `Карточка клиента` нет текста `Управление и
      история`; во forced password change нет badge `Обязательное действие`.
- [ ] Допустимые validation, recovery, security/legal, prerequisite,
      backend-owned constraint и operational-state пояснения находятся у
      связанного поля, действия, toolbar/detail section или state panel, а не
      используются как декоративный текст под `h1`.
- [ ] На mobile, tablet и desktop над единственным primary search отсутствуют
      видимые generic labels `Поиск`, `Найти запись`, `Найти занятие` и
      аналоги.
- [ ] Каждый visually unlabeled primary search имеет stable accessible name,
      называющий операцию и объект; placeholder не является его единственным
      accessible name.
- [ ] Visible search label остаётся только при нескольких или неоднозначных
      fields; period/date/scope controls и обычные form fields не теряют
      обязательные persistent labels.
- [ ] `Клиенты`, `Группы` и `Расписание` list screens не показывают visible
      route header, когда одноимённый bottom/desktop nav item видим и активен.
- [ ] На route без visible header остаются semantic `h1`, document title,
      named main landmark и `aria-current` активной navigation.
- [ ] Header removal не оставляет spacer/action-only row: locator, summary или
      первый рабочий control поднимается на освободившееся место.
- [ ] Refresh/create actions перенесены в первый task toolbar без overflow;
      primary/frequent operations остаются видимыми и имеют accessible names.
- [ ] Search/locator, filter trigger и retained actions находятся в одной
      строке без action-only второго level на `360`, `390`, `420`, `440`,
      `768` и `1440`; action cluster не переносится.
- [ ] Search сохраняет min-width `156/176/200/216/320/420px` соответственно;
      при нехватке ширины secondary action сворачивается раньше search.
- [ ] Mobile icon-only create/filter/refresh имеют точные accessible names и
      targets не меньше `44 x 44px`; desktop text action не создаёт перенос.
- [ ] `Группы` не показывают summary/stat widgets (`Всего`, `Активные`,
      `Без тренера`, `Перегружены`) на mobile, tablet или desktop; первым
      рабочим блоком является locator/filter toolbar.
- [ ] Количество и проблемный статус групп передаются через range/status,
      фильтры и соответствующие строки, а ширины `768`/`1440` не возвращают
      удалённые widgets.
- [ ] Active tab не дублируется ниже section/title/summary widget на mobile,
      tablet или desktop; дополнительная ширина не возвращает удалённый блок.
- [ ] На `home-attention-ready` после active `Требуют внимания` сразу
      начинается attention list/state; visible `Клиенты, требующие внимания`
      и standalone range/status card отсутствуют.
- [ ] На `home-attendance-ready` после active `Посещения` control card
      начинается с group select; visible `Группа`, `Отметка посещений` и
      decorative `Среда, 29 июля` перед control отсутствуют на mobile/desktop.
- [ ] Group select имеет accessible name `Группа для отметки посещений`,
      не зависящий от placeholder/value; selected value, date navigation,
      progress, validation и recovery state сохраняются.
- [ ] На top-level `Тренеры`, `Журнал`, `Финансы`, `Настройки` четвёртый
      adaptive mobile nav slot заменяет последнюю primary вкладку на точный
      active label/icon; первые три slots и пятый `Ещё` остаются стабильными.
- [ ] Вытесненная четвёртая вкладка появляется в `Остальные разделы`; drawer
      содержит все authorized sections, не видимые в четырёх route slots,
      без дублирования текущего adaptive item.
- [ ] `Ещё` остаётся единственным drawer trigger, не получает
      `aria-current="page"` из-за active overflow route и сохраняет точный
      accessible name/popup state.
- [ ] Deep link, reload, browser back/forward и permission redirect вычисляют
      adaptive slot из resolved route/access contract без промежуточного
      generic или unauthorized состояния.
- [ ] При единственной hidden destination `Ещё` и drawer сохраняются; если она
      active, в drawer переходит вытесненная четвёртая destination.
- [ ] Top-level overflow workspace может скрыть duplicate route title после
      promotion в adaptive slot; detail/create/edit/auth сохраняют visible
      operation/entity title, даже когда parent destination виден в четвёртом
      slot. Recovery state с конкретным state heading не дублирует route title.
- [ ] Drawer/modal используют dynamic viewport, safe-area footer и focus return.
- [ ] Нет unintended horizontal page scroll на `360`, `390`, `420`, `440`.
- [ ] Theme-sensitive raw colors удалены из shared/feature code; static check
      допускает только registry, invariant token source и explicit allowlist.

## Test checklist

- [ ] Backend config/options/API tests для missing/blank default, configured и
      trimmed pass-through theme/background ids.
- [ ] Frontend unit tests theme/background registries, fallback, theme creation
      и semantic tokens.
- [ ] Bootstrap tests подтверждают один `/config` request и отсутствие
      meaningful `App` до profile resolution.
- [ ] `test/render.tsx` поддерживает default и alternate profile.
- [ ] Component tests shared locator, filters, known/unknown total range,
      TaskItem interaction semantics, states и temporary surfaces.
- [ ] Representative E2E: Home, Schedule, Clients, Groups.
- [ ] Representative screenshot review: auth, client detail, create/edit,
      list, restricted, empty и error на `390 x 844`, `420 x 912`,
      `440 x 956`, `768 x 1024` и `1440 x 1200` не возвращает декоративный
      route-level copy.
- [ ] `clients-browse`, `schedule-ready`, `groups-list`, `users-list` и
      `audit-list` не показывают строку label над primary search; role/name
      assertion на соответствующий `searchbox` проходит.
- [ ] На этих же list screens locator и actions геометрически находятся в
      одной строке на mobile и desktop; `clients-browse` и `audit-list` не
      содержат отдельной строки refresh/create под search.
- [ ] `clients-browse`, `groups-list`, `schedule-ready` имеют visually-hidden
      level-one heading и не имеют дублирующего visible route title;
      top-level `users-list`/`audit-list` применяют тот же visibility test после
      появления active `Тренеры`/`Журнал` в adaptive slot.
- [ ] На `/users`, `/audit`, `/finance`, `/settings` четвёртый slot показывает
      соответственно `Тренеры`, `Журнал`, `Финансы`, `Настройки`, имеет
      `aria-current="page"` и соответствующий route accessible name.
- [ ] Пятый `Ещё` открывает drawer, имеет title/close/focus trap/return и
      показывает только authorized sections, отсутствующие в четырёх route slots.
- [ ] `/users/new` и `/users/:id/edit` сохраняют active `Тренеры` в четвёртом slot,
      но показывают visible operation/entity `h1`.
- [ ] Browser back `Финансы -> Группы` возвращает `Группы` в четвёртый slot;
      back или navigation `Финансы -> Журнал` заменяет adaptive slot на
      `Журнал` без flash, а `Ещё` остаётся пятым.
- [ ] Русские labels adaptive slot полностью видимы на `360`, `390`, `420`,
      `440`; touch target не меньше `44px`, horizontal scroll отсутствует.
- [ ] `groups-list` не содержит summary/stat widget container на `390 x 844`,
      `420 x 912`, `440 x 956`, `768 x 1024` и `1440 x 1200`; locator и
      первые results поднимаются на освободившееся место.
- [ ] `home-attention-ready` на `360`, `390`, `420`, `440`, `768` и `1440`
      содержит selected tab `Требуют внимания`, но не содержит видимый heading
      `Клиенты, требующие внимания` или section/range widget перед списком.
- [ ] `home-attendance-ready` на тех же ширинах содержит active `Посещения`
      и выбранное значение group select без visible label `Группа`,
      `Отметка посещений` или date meta перед control; role/name assertion
      `Группа для отметки посещений` проходит.
- [ ] `system-error-state`, `system-empty-first-run` и
      `system-empty-filtered` не дублируют `Клиенты`, когда active client nav и
      конкретный state heading уже дают полный контекст.
- [ ] Component/E2E fixture проверяет presentation и focus общего
      `RestrictedState`; реальная route wiring остаётся в `TASK-088`.
- [ ] Повторить E2E с `default-green-v1` и `test-blue-coral-v1`.
- [ ] Проверить `360`, `390 x 844`, `420 x 912`, `440 x 956`, `768 x 1024`,
      `1440 x 1200`, `912 x 420`, `956 x 440`.
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `cd frontend && npm run test:unit`
- [ ] `cd frontend && npm run test:e2e:iphone`
- [ ] `dotnet test backend/tests/GymCrm.Tests/GymCrm.Tests.csproj`
- [ ] Отдельно зафиксировать Safari chrome, keyboard, home indicator и
      physical-device проверки, если они недоступны.

## Dependency and implementation order

1. `TASK-090`: theme contract, tokens, shared primitives и shell foundation.
2. `TASK-084`: all-screen touch/compact-height migration и acceptance sweep.
3. `TASK-085`: Clients mobile workflow.
4. `TASK-086`: Groups mobile workflow.
5. `TASK-088`: restricted route feedback.
6. `TASK-089`: desktop client split.
7. `TASK-087`: только после согласования backend effective scope.

Feature tasks могут планироваться параллельно, но их implementation не должен
создавать локальную alternative foundation до завершения `TASK-090`.

## Related tasks

- Completed foundation: `TASK-046`, `TASK-048`, `TASK-051`, `TASK-056`.
- Dependent improvements: `TASK-084`–`TASK-089`.

## AI safety

- Safe for Codex: yes
- Risk level: high
- Reason: cross-layer config и shared UI migration затрагивают все screens и
  deployment behavior, но не меняют CRM business rules.

## Source notes

- Source: user request to replace screen-by-screen redesign with one mobile CRM
  interface system.
- UX research and UI design pass: 2026-07-26.

## Processing notes

- Implemented in: `feature/TASK-090-shared-mobile-ui-system`, final
  implementation commit `3253b23`.
- Merged to `main`: PR #101, merge commit `aee6d93`, 2026-07-26.
- Completion evidence: backend `/api/config` and deployment branding contract;
  versioned theme/background registries and deterministic fallbacks; config
  bootstrap; semantic tokens and raw-color regression barrier; shared mobile
  primitives; adaptive navigation; unit, API and responsive Playwright
  coverage committed with the implementation.
- Residual device evidence: real Safari chrome, software keyboard, safe-area
  and physical-device behavior remain a manual acceptance gap and are retained
  in the completed plan; the screen-specific all-screen sweep remains
  `TASK-084`.
- Status actualized at: 2026-07-26 by backlog status audit.
