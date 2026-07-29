# TASK-084: Довести touch targets и compact-height shell до mobile acceptance

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-07-26 23:56
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/TASK-084-mobile-touch-targets-compact-height.plan.md
- implementation_branch: feature/TASK-084-mobile-touch-targets-compact-height
- implementation_state: completed
- implementation_commit: 3e203671f98b9198e0cf552934c4fa5ead4a124e
- delivered_on_main_at: 2026-07-29
- moved_to_done_at: 2026-07-30
- last_status_reviewed_at: 2026-07-30 00:42 MSK
- reviewed_main_commit: 3e203671f98b9198e0cf552934c4fa5ead4a124e

## Priority
P0

## Current status review

- Status is `done`: implementation commit `3e20367` is the current
  `origin/main`.
- Shared targets, locator clear, client pagination, schedule refresh, compact
  filters, temporary surfaces and compact-height shell now follow the released
  `44px`/`16px`/safe-area contract.
- A machine-readable Playwright inventory covers the required viewport matrix,
  role-aware navigation and the tracked TASK-089 desktop exception.
- The implementation landed directly on `main` instead of the declared task
  branch/worktree. This is a repository-workflow deviation, but does not change
  the delivery evidence used for backlog status.
- Automated code acceptance passed on 2026-07-30. Real Safari chrome,
  software-keyboard, home-indicator and physical-device behavior remain an
  explicit manual-evidence caveat; no device-level acceptance is claimed.

## Goal
Основные CRM-сценарии остаются управляемыми на touch-устройствах: интерактивные зоны не меньше `44 x 44 CSS px`, текст полей не меньше `16px` на iPhone, а landscape compact-height не переключает интерфейс в тесное desktop-поведение.

## Shared mobile UI contract

- Normative contract:
  [Единый контракт мобильного интерфейса CRM](../../docs/MOBILE_UI_CONTRACT.md).
- Foundation dependency: `TASK-090`.
- Эта задача применяет shared control/shell foundation ко всем affected call
  sites и выполняет acceptance sweep.
- Screen-specific размеры, цвета и альтернативные shell patterns не вводятся.
- Visual comparison определяет выявленную проблему и expected workflow, но не
  заменяет общую design system.

## User role
Суперадминистратор / администратор / главный тренер / тренер.

## Problem
Аудит 2026-07-25 зафиксировал системные нарушения mobile acceptance. После
TASK-090 общий shell и shared primitives существуют, поэтому исходные замеры
не считаются описанием всех текущих call sites. На `main` всё ещё видны
остаточные риски, которые должна закрыть эта acceptance/migration задача:

- mobile pagination клиентов использует controls `2.5rem`;
- refresh расписания запрашивает размер `42px`;
- `CompactFilterPanel` сохраняет поля и buttons высотой `36-40px` и текст
  `14px` в части режимов;
- внутренний clear control `EntityLocatorBar` и стандартные drawer close
  controls не имеют гарантированного target `44 x 44`;
- group edit rows, profile/menu, filters и другие screen call sites ещё не
  прошли единый measured sweep;
- Safari chrome, software keyboard, home indicator и physical-device safe
  areas не подтверждены автоматизированной геометрией.

## Scope
- Общие Mantine-паттерны `Button`, `ActionIcon`, refresh, pagination, tabs, inputs, selects, switches и close controls.
- Header actions, mobile bottom navigation и filter drawer.
- Responsive-режим для coarse pointer + compact height, независимый от одной только ширины.
- Доступность primary form actions и temporary surfaces при Safari chrome и software keyboard.
- Regression-проверка главной, расписания, клиентов, групп и доступных settings/audit экранов.
- Проверка полного видимого текста button/action labels при width pressure: увеличение touch target, icon и соседний контент не должны клиппировать подпись или оставлять её в виде неполного слова.
- Исправление shared primitive выполняется в самом primitive; screen-specific
  override допускается только для предметной geometry, не как альтернативный
  touch-size contract.
- SuperAdministrator shell с backend session contract: `branchId: null`, global operational scope, allowed sections `Home`, `Schedule`, `Clients`, `Groups`, `Users`, `Audit`, `Settings` и явное отсутствие `Finance`.
- Frontend не выводит доступность разделов или действий из названия роли, если backend уже передаёт permissions, allowed sections и allowed actions.

## Out of scope
- Перестройка информационной архитектуры отдельных экранов.
- Изменение backend-owned ролей, permissions, attendance, client или group rules.
- Переработка client detail/form, уже покрытая `TASK-018` и `TASK-021`.

## Responsive behavior
- `360 x 780`, `390 x 844`, `420 x 912`, `440 x 956`: все интерактивные зоны минимум `44 x 44`, между независимыми touch targets минимум `8px`, text inputs/selects/textareas минимум `16px`, нет горизонтального page scroll.
- `420 x 912` и `440 x 956`: fixed/sticky controls используют обычный spacing плюс `env(safe-area-inset-*)`.
- `768 x 1024`: допустима tablet-компоновка, но touch targets не уменьшаются ниже `44 x 44`.
- `1440 x 1200`: сохраняется desktop density, видимый focus и отсутствие clipping.
- `912 x 420` и `956 x 440`: при coarse pointer остаётся достижимый compact mobile shell; temporary surfaces используют dynamic viewport, scrollable body и sticky footer без nested scroll trap.

## Operational and interaction states
- Loading визуально отличается от empty.
- Error содержит доступный retry.
- Неочевидная причина disabled-контрола объясняется рядом с ним.
- Permission-restricted controls не отображаются как неработающие действия.
- Drawer/modal возвращает focus на trigger; Escape закрывает desktop temporary surfaces.
- При открытой клавиатуре focused field, validation/recovery feedback и primary action доступны одним намеренным scroll.

## Acceptance criteria
- [x] На проверенных mobile paths нет интерактивной зоны меньше `44 x 44 CSS px`.
- [x] Между независимыми соседними touch targets остаётся минимум `8px`.
- [x] Видимые button/action labels отображаются полностью; icon-only fallback используется только по утверждённому responsive contract и сохраняет точное accessible name.
- [x] Text inputs, selects и textareas имеют `font-size >= 16px` на iPhone profiles.
- [x] Нет unintended horizontal page scrolling на `360`, `390`, `420`, `440`.
- [x] `912 x 420` и `956 x 440` не показывают desktop-only shell или controls высотой `36px`.
- [x] Fixed/sticky controls учитывают safe-area inset вместе с обычным spacing.
- [x] Focus order соответствует визуальному и task order, focus остаётся видимым.
- [x] Для SuperAdministrator primary mobile navigation содержит `Home`, `Schedule`, `Clients`, `Groups`, а `Users`, `Audit`, `Settings` достижимы через overflow.
- [x] `Finance` не появляется для SuperAdministrator в primary navigation, overflow, disabled controls или route recovery destinations.

## Test checklist
- [x] `cd frontend && npm run lint`
- [x] `cd frontend && npm run build`
- [x] `cd frontend && npm run test:unit`
- [x] Запустить affected responsive Playwright specs.
- [x] `cd frontend && npm run test:e2e:iphone`
- [x] Проверить `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420`, `956 x 440`.
- [x] Проверить длинные и штатные русские action labels на clipping/ellipsis во всех inventoried routes.
- [x] Повторить responsive matrix с SuperAdministrator fixture: `branchId: null`, без Finance, `createRoleOptions: ['Administrator', 'Coach']`.
- [x] Отдельно зафиксировать Safari chrome, software keyboard, home indicator и physical-device проверки, если Simulator/device недоступны.

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: общая frontend/CSS задача затрагивает несколько экранов и breakpoints, но не меняет CRM business rules.

## Related tasks
- Завершённые shell-задачи: `TASK-047`, `TASK-048`, `TASK-051`.
- Client form/detail: `TASK-018`, `TASK-021`.

## Source notes
- Source: usability audit of the fully rebuilt and seeded local stand.
- Evidence date: 2026-07-25.
- Tested geometry: Chromium/WebKit at required responsive sizes; real Safari chrome/keyboard/safe-area remained unverified.
- Source file: `backlog/processed/2026-07-27-2.md`
- Original note: `текст на кнопке «Открыть» не отображается полностью. Необходимо проверить все экраны и убедиться, что такого нет и на других кнопках и экранах.`
- Screenshot: `/Users/muradchaniev/Desktop/Снимок экрана — 2026-07-27 в 00.36.17.png`

## Visual comparison
- [Сейчас / после](../mockups/usability-2026-07-25/TASK-084-comparison.png)
- [Описание преимуществ и границ макета](../mockups/usability-2026-07-25/README.md#task-084-touch-targets-and-compact-height-shell)

## Processing notes

- Reviewed at: 2026-07-26 after TASK-090 was merged to `main`.
- Foundation dependency is complete: shared targets, semantic controls,
  compact-height shell primitives and responsive test infrastructure exist.
- Requirements revalidated against commit `3253b23`: the original audit
  examples are now evidence baseline, while remaining `36-42px` call sites
  and unverified device behavior are named explicitly above.
- Status remains `ready`: the card owns the all-screen affected-call-site
  sweep, including shared primitive internals and Safari/device acceptance
  that TASK-090 explicitly left separate.
- Updated at: 2026-07-27 01:04
- Duplicate check: общий all-screen label-clipping sweep добавлен сюда; конкретная desktop client-row регрессия остаётся в TASK-089 и не создаёт отдельную задачу.

## Completion notes

- Delivered by `3e203671f98b9198e0cf552934c4fa5ead4a124e` on `main`.
- Validation on 2026-07-30: lint passed; build passed; unit tests `290/290`;
  Chromium touch-target inventory `12/12`; target iPhone WebKit `14/14`.
- Inventory covers `360 x 780`, `390 x 844`, `420 x 912`, `440 x 956`,
  `768 x 1024`, `1440 x 1200`, `912 x 420` and `956 x 440`, plus
  SuperAdministrator, Administrator, HeadCoach and Coach navigation fixtures.
- The only predeclared desktop exception remains owned by TASK-089.
- Simulator/physical-device Safari chrome, software keyboard, home indicator
  and safe-area evidence was not collected; automated completion is confirmed
  without claiming physical-device acceptance.
