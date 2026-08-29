# Implementation Plan: TASK-157 Уплотнить мобильное расписание по утверждённому макету

## Metadata
- source_task: /backlog/done/TASK-157-schedule-mobile-density.md
- completion: implemented and locally integrated into main on 2026-08-30
- requirements: REQ-GRP-007 (changes), REQ-GRP-005 (constrains), REQ-NFR-001 (constrains), REQ-ATT-006 (constrains)
- branch: feature/TASK-157-schedule-mobile-density
- readiness: yes
- dependencies: TASK-160 — строки расписания обязаны потреблять его list-row surface-токены; TASK-158 рекомендуется выполнить до (мобильная типографика строк), но не блокирует
- risk: medium — перекомпоновка основного schedule-workflow при неизменных backend-контрактах; плотность конкурирует с 44px touch-target стандартом на 360px

## Goal
На `420 x 912` с fixture из 14 занятий видны минимум 4 полные строки занятий и заголовок следующего временного интервала без перекрытия bottom navigation; на `390 x 844` — минимум 3; на `360 x 780` решение-данные и частые действия сохраняются без horizontal overflow.

## UX contract
Authority: [backlog/mockups/TASK-157-schedule-mobile-density/README.md](../mockups/TASK-157-schedule-mobile-density/README.md) (+ all-screens addendum в задаче). Ключевые решения:

- Одна surface на точный временной интервал; внутри — компактные строки с тональными разделителями, не независимые высокие карточки.
- Collapsed row: название группы (первый якорь), филиал, зал, тренер как выровненные decision-данные; один нейтральный attendance status; видимый `Посещаемость` с secondary emphasis; `Ещё` для `Изменить` и редких действий; body строки — affordance перехода вправо, отдельный keyboard/touch action.
- Badges типа группы и регулярности отсутствуют в collapsed row (данные остаются в detail и API).
- Shell: одна строка date navigation + create; одна summary-строка count + видимо подписанный filter trigger с active state.
- Правило приоритета: все независимые touch targets ≥ `44 x 44px` с интервалом ≥ `8px` — перекрывает уменьшенную геометрию концепта.
- Доступность действий, disabled reasons и attendance state — только из backend contract.

## Scope
### In
- `GroupScheduleScreen` mobile-представление `360–440px`, shell-компоновка toolbar, мобильное действие `Изменить` в `Ещё`.
- Component, responsive Chromium и target-iPhone WebKit regression coverage.

### Out
- Backend API/occurrence/recurrence/permission/attendance semantics; новые frontend-owned состояния; bottom navigation; desktop/week grid и detail/create/edit/move screens; TASK-131 filter contract.

## Implementation slices
1. Component RED: расширить fixtures `GroupScheduleScreen` (14+ занятий, длинные названия, несколько филиалов/залов/тренеров, mixed allowed actions) и добавить assertions новой иерархии — упасть на текущих карточках.
2. Перекомпоновать mobile row + time-group surface: поля строки, тональные разделители, right affordance с accessible name, потребление list-row токенов TASK-160 (до их интеграции — локальные значения, совпадающие с будущими токенами).
3. Shell: date+create в одну строку, summary-строка с count и подписанным filter trigger с active state; перенести `Изменить` в мобильное `Ещё`.
4. Browser RED→green: geometry-сценарии (кол-во полных строк, отсутствие overlap/overflow) на `360 x 780`, `390 x 844`, `420 x 912`, `440 x 956` + compact-height smoke `912 x 420`/`956 x 440`; затем full affected Chromium schedule flows и `npm run test:e2e:iphone`.

## Likely files and layers
- `frontend/src/features/schedule/GroupScheduleScreen.tsx` — mobile rows, shell toolbar, action placement.
- `frontend/src/features/schedule/schedulePresentation.ts` — состав полей collapsed row, исключение secondary badges на mobile.
- `frontend/src/features/schedule/ScheduleMoreActionsSurface.tsx` — приём `Изменить` на mobile.
- `frontend/src/features/schedule/GroupScheduleScreen.test.tsx` — component coverage.
- `frontend/e2e/group-schedule.spec.ts`, `frontend/e2e/iphone-target-devices.spec.ts`, `frontend/e2e/touch-target-inventory.spec.ts` — geometry/flows.

## Regression specification
### Automated tests to add or update
- Component: mobile field visibility (группа, филиал, зал, тренер, один attendance status), отсутствие group-type/recurrence badges, `Посещаемость` достижимо одним нажатием без filled-primary, `Изменить` в `Ещё`, right-chevron affordance с accessible name и visible focus, keyboard order, backend-driven restricted/disabled behavior.
- Component states: loading, empty, filter-empty, stale/error/retry, restricted, cancelled, mixed attendance — новая иерархия без ложного success.
- Context: `date`, `view`, filters, scroll/time group и return path после detail, attendance, mutation, refresh и back/forward (существующие контракты TASK-133 остаются зелёными).
- Playwright geometry: количество полностью видимых rows, отсутствие overlap и horizontal overflow на четырёх viewport; compact-height без nested-scroll trap; long-content и 200% zoom; открытие/закрытие filter surface с active filter (selection, clear/reset, focus return).
- Target-iPhone WebKit: schedule specs через `npm run test:e2e:iphone`.

### Expected red evidence
- Новые component-assertions (отсутствие secondary badges, `Изменить` в `Ещё`, right affordance) и geometry-assertions (≥4 полных строк на `420 x 912`) падают на текущих высоких карточках — RED до перекомпоновки.

### Required validation
- Root verification harness для frontend diff с `--task-id TASK-157` после появления task-контракта; affected Chromium schedule flows; `npm run test:e2e:iphone`.

### Manual evidence
- Rendered before/after review против visual contract. Остаются непроверенными: physical Safari chrome, Dynamic Island, software keyboard, one-handed reach — перечислить явно.

### Regression barrier
- Один density-сценарий `group-schedule.spec.ts` на `420 x 912` (≥4 полных строки + заголовок следующего интервала, все decision-данные и действия) на Chromium и target-iPhone project.

## Risks and stop conditions
- Если на `360px` строка с полями + двумя действиями не помещается при целевых ≥44px и зазоре ≥8px — сокращать только вторичные визуальные элементы, не цели и не данные; при конфликте с decision-данными остановиться и зафиксировать.
- Stop, если плотность достигается откатом TASK-133 acceptance (wide-screen, deferred destructive actions, focus return, context restoration).
- Stop, если required density требует изменения backend contract или удаления данных из collapsed row.
- Не копировать HTML/CSS концепта напрямую: Mantine/Onest/semantic tokens/shared controls обязательны.

## Task-branch evidence
- RED: component contract падал на отсутствии `data-mobile-density`, раздельных
  decision-data hooks и forward affordance; Chromium geometry на `420 x 912`
  после первой перекомпоновки показывала только 3 полные строки вместо 4.
- GREEN: точные time groups используют интегрированные
  `crm-list-row-surface`/`--crm-surface-list-row-*` токены; mobile row оставляет
  группу, филиал/зал, тренера, один neutral attendance status, secondary
  `Посещаемость`, а разрешённое `Изменить` переносит первым пунктом в `Ещё`.
- Rendered gate: на `390 x 844` видны не менее 3 полных строк, на `420 x 912`
  и `440 x 956` — не менее 4 плюс следующий time-group heading; `360 x 780`,
  compact-height `912 x 420`/`956 x 440` и 200% text scale не создают
  horizontal overflow. `769/1440px` сохраняют desktop action surface.
- Automated evidence: schedule unit 30/30; Chromium group-schedule 17/17;
  scoped target-iPhone schedule 12/12 на двух WebKit-профилях. Полная iPhone
  матрица: 68/70, два unrelated login-control падения (`42px < 44px`) уже
  переданы координатору как интеграционный дефект TASK-161.
- Physical Safari chrome, software keyboard, real safe-area, Dynamic Island,
  home indicator и one-handed reach остаются неподтверждёнными до Simulator
  или physical-device проверки.
