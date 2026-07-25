# TASK-084: Довести touch targets и compact-height shell до mobile acceptance

## Status
ready

## Priority
P0

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
Usability-аудит финального локального стенда выявил системные нарушения mobile acceptance:
- профильное меню `48 x 42`;
- кнопки фильтров клиентов и расписания высотой `40px`;
- refresh расписания `42 x 42`;
- pagination и действия высотой `36-40px`;
- close в filter drawer `28 x 28`;
- поля и select высотой `36-40px` с текстом `14px`;
- при `912 x 420` и `956 x 440` включается desktop shell с компактными desktop-контролами.

## Scope
- Общие Mantine-паттерны `Button`, `ActionIcon`, refresh, pagination, tabs, inputs, selects, switches и close controls.
- Header actions, mobile bottom navigation и filter drawer.
- Responsive-режим для coarse pointer + compact height, независимый от одной только ширины.
- Доступность primary form actions и temporary surfaces при Safari chrome и software keyboard.
- Regression-проверка главной, расписания, клиентов, групп и доступных settings/audit экранов.
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
- [ ] На проверенных mobile paths нет интерактивной зоны меньше `44 x 44 CSS px`.
- [ ] Text inputs, selects и textareas имеют `font-size >= 16px` на iPhone profiles.
- [ ] Нет unintended horizontal page scrolling на `360`, `390`, `420`, `440`.
- [ ] `912 x 420` и `956 x 440` не показывают desktop-only shell или controls высотой `36px`.
- [ ] Fixed/sticky controls учитывают safe-area inset вместе с обычным spacing.
- [ ] Focus order соответствует визуальному и task order, focus остаётся видимым.
- [ ] Для SuperAdministrator primary mobile navigation содержит `Home`, `Schedule`, `Clients`, `Groups`, а `Users`, `Audit`, `Settings` достижимы через overflow.
- [ ] `Finance` не появляется для SuperAdministrator в primary navigation, overflow, disabled controls или route recovery destinations.

## Test checklist
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] Запустить affected responsive Playwright specs.
- [ ] `cd frontend && npm run test:e2e:iphone`
- [ ] Проверить `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420`, `956 x 440`.
- [ ] Повторить responsive matrix с SuperAdministrator fixture: `branchId: null`, без Finance, `createRoleOptions: ['Administrator', 'Coach']`.
- [ ] Отдельно зафиксировать Safari chrome, software keyboard, home indicator и physical-device проверки, если Simulator/device недоступны.

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

## Visual comparison
- [Сейчас / после](../mockups/usability-2026-07-25/TASK-084-comparison.png)
- [Описание преимуществ и границ макета](../mockups/usability-2026-07-25/README.md#task-084-touch-targets-and-compact-height-shell)
