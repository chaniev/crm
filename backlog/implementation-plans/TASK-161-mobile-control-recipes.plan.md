# Implementation Plan: TASK-161 Мобильные рецепты контролов: инпуты 44px, уведомления, bottom-sheet

## Metadata
- source_task: /backlog/implementation/TASK-161-mobile-control-recipes.md
- requirements: REQ-NFR-001 (constrains)
- branch: feature/TASK-161-mobile-control-recipes
- readiness: yes
- dependencies: none; переиспользует существующие `TemporarySurfaceFooter` и `--crm-layer-sticky-action-bar`
- risk: medium — меняет положение глобальных временных поверхностей (drawer, notifications) на мобильных; затрагивает несколько consumer-флоу при presentation-only контрактах

## Goal
На `390/420/440` поля ввода ≥ 44px высоты и ≥ 16px шрифта; уведомления не перекрывают мобильный хедер и не уходят под safe-area (desktop `top-right` сохранён); drawer на `≤ 48rem` открывается снизу как bottom-sheet с safe-area-совместимым футером, закрывается существующими способами и возвращает фокус.

## Decisions and contracts
- `inputStyles`: `minHeight: 44` для input/textarea/select на mobile (≤ 48rem), шрифт 16 CSS px сохраняется.
- `Notifications`: на `≤ 48rem` позиция выбирается rendered-сравнением `top-center` vs над bottom navigation — решение фиксируется в задаче; desktop `top-right` и autoClose/limit не меняются.
- `Drawer`-рецепт: на `≤ 48rem` default `position="bottom"`, full-width, радиус только сверху, футер через существующий `TemporarySurfaceFooter`; `> 48rem` — текущее поведение.
- Notifications API (tone/urgency/action), тексты, backend-семантика, `Modal` — без изменений.
- Focus-return, aria-атрибуты и существующие close-контракты сохраняются.

## Scope
### In
- Мобильные значения трёх рецептов, consumer-тесты затронутых флоу (фильтры реестров, мобильные меню), рецептовые и browser-проверки.

### Out
- Notifications API; `Modal`; формы и sticky CTA (TASK-162).

## Implementation slices
1. RED: рецептовые тесты — computed input height ≥ 44 на mobile, notifications позиция mobile/desktop, drawer position bottom на mobile (падают на текущих `size: 'sm'`/`top-right`/правой панели).
2. Реализовать `inputStyles` minHeight 44 на mobile.
3. Реализовать mobile-позицию notifications по итогам rendered-сравнения; обновить `notifications-auto-dismiss` и связанные тесты.
4. Реализовать bottom drawer-рецепт с `TemporarySurfaceFooter`; проверить consumer-флоу (фильтры, `Ещё`-меню расписания, прочие drawer) на focus return и close-контракты; touch-target inventory и compact-height прогоны.

## Likely files and layers
- `frontend/src/theme/componentRecipes.ts` — `inputStyles`, `Notifications`, `Drawer`.
- `frontend/src/theme/componentRecipes.test.tsx` — рецептовые контракты.
- `frontend/src/features/shared/TemporarySurfaceFooter.tsx` — переиспользование (без изменения контракта).
- `frontend/e2e/notifications-auto-dismiss.spec.ts`, `frontend/e2e/touch-target-inventory.spec.ts`, `frontend/e2e/responsive-main-screens.spec.ts` — consumer/browser покрытие; затронутые drawer/filter consumers — по факту использования рецепта.

## Regression specification
### Automated tests to add or update
- Рецептовые: computed высоты полей ≥ 44px и font-size 16px на 390/420/440; `< 48rem` drawer bottom/full-width/верхний радиус; `> 48rem` input/drawer/notifications без изменений.
- Consumer: фильтры реестров (ввод в поля ≥ 44px), открытие/закрытие drawer (Escape, overlay, кнопка), focus-return; notifications не перекрывают хедер на mobile.
- Geometry: 360/390/420/440 + compact-height `912 x 420`/`956 x 440`; touch-target inventory зелёный.
- Затронутые Playwright-флоу + `npm run test:e2e:iphone`.

### Expected red evidence
- Рецептовые computed-тесты падают на текущих ~36px инпутах, `top-right` уведомлениях и правом drawer — RED до правки рецептов.

### Required validation
- Root verification harness для frontend diff; affected Chromium flows; `npm run test:e2e:iphone`.

### Manual evidence
- Rendered-сравнение двух позиций notifications на `390/420` для фиксации решения; физическая safe-area/клавиатура — записать как непроверенное.

### Regression barrier
- Touch-target inventory + один notifications-сценарий и один drawer-сценарий на target-iPhone project (bottom-sheet открывается, закрывается, возвращает фокус).

## Risks and stop conditions
- Смена drawer-позиции глобально влияет на все drawer-потребители: если конкретный consumer требует ширины правой панели на mobile (width-dependent контент), остановиться и зафиксировать consumer; не вводить per-consumer fork рецепта без записи в задаче.
- Если bottom-sheet при открытой софт-клавиатуре перекрывает поля — использовать существующие safe-area механизмы; не менять layer-контракты.
