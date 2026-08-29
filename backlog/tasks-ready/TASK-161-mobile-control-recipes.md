# TASK-161: Мобильные рецепты контролов: инпуты 44px, уведомления, bottom-sheet

## Status
ready

## Requirements
- REQ-NFR-001 — constrains

## Goal
Глобальные Mantine-рецепты корректно ведут себя на мобильных: поля ввода не
меньше 44px высоты, уведомления не перекрывают мобильный хедер, drawer на
мобильных открывается снизу как bottom-sheet с safe-area футером.

## Context
Анализ всех экранов 2026-08-30 и ревью `src/theme/componentRecipes.ts`:

- инпуты используют `size: 'sm'` (~36px) без `minHeight`, тогда как кнопки
  рядом — 44px: поля фильтров/локатора выглядят и тапаются меньше кнопок;
- `Notifications` глобально позиционируются `top-right` и на мобильных
  перекрывают хедер и уведомляющую кнопку;
- рецепт `Drawer` не задаёт мобильную позицию — правая панель на телефоне
  далека от thumb-zone; в системе уже есть safe-area-aware
  `TemporarySurfaceFooter` и слой sticky action bar.

TASK-149 ввёл компонентные рецепты; эта задача их дополняет мобильными
значениями. TASK-151 завершил shared-контракты (notifications API).

## User role
Все роли на мобильных устройствах.

## Problem
Смешанная геометрия контролов (36px поля против 44px кнопок), уведомления
поверх хедера и правосторонние drawer ухудшают мобильную работу и нарушают
единый touch-target стандарт.

## Scope
- `inputStyles`: добавить `minHeight: 44` для input/textarea/select на
  mobile (или эквивалентный size-override `≤ 48rem`).
- `Notifications`: на `≤ 48rem` позиция `top-center` (или над нижней
  навигацией — фиксируется в задаче по rendered-проверке), desktop
  `top-right` сохраняется; поведение autoClose/limit не меняется.
- `Drawer` рецепт: на `≤ 48rem` default `position="bottom"`, full-width,
  радиус только сверху, safe-area-совместимый футер через существующий
  `TemporarySurfaceFooter`; `> 48rem` — текущее поведение.
- Проверить затронутые consumer-флоу (фильтры реестров, мобильные меню) и
  обновить их тесты.

## Out of scope
- Изменение notifications API (tone/urgency/action) и семантики сообщений.
- Модальные окна (`Modal`) и их ширина.
- Формы и sticky CTA — владелец TASK-162.

## Constraints
- Все независимые цели ≥ 44×44px, интервалы ≥ 8px.
- Фокус-return, aria-атрибуты и существующие close-контракты сохраняются.
- Backend-семантика и тексты не меняются.

## Acceptance criteria
- [ ] Поля ввода на `390/420/440` имеют высоту ≥ 44px и шрифт ≥ 16px (без
      iOS-зума).
- [ ] Уведомление на мобильных не перекрывает хедер и не уходит под
      safe-area; на desktop позиция прежняя.
- [ ] Drawer на мобильных открывается снизу, закрывается существующими
      способами, возвращает фокус, футер уважает safe-area.
- [ ] Затронутые Playwright-флоу (filters, notifications, drawer) зелёные,
      включая `npm run test:e2e:iphone`.

## Test checklist
- [ ] Рецептные тесты `componentRecipes` + consumer-тесты.
- [ ] Проверка на 360/390/420/440 и compact-height 912x420/956x440.
- [ ] Root verification harness для frontend diff.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: medium
- Reason: меняет положение временных поверхностей на мобильных — затрагивает
  несколько consumer-флоу, но ограничено presentation-слоем с контрактными
  тестами.

## Clarification questions
Не требуется: выбор позиции уведомлений (top-center vs над bottom nav)
решается rendered-сравнением внутри задачи без изменения product semantics.

## Source notes
- Source: analysis conversation 2026-08-30 «анализ всех экранов» + ревью
  `src/theme/componentRecipes.ts` (2026-08-29/30).
- Completed baselines: [TASK-149](../done/TASK-149-mantine-component-recipes.md),
  [TASK-151](../done/TASK-151-complete-shared-component-contracts.md).

## Processing notes
- Created at: 2026-08-30 (MSK)
- Duplicate check: TASK-149 задал базовые рецепты без мобильных позиций;
  активных аналогов нет.
- Classification: `tasks-ready`; REQ-NFR-001 `принято`, `constrains`.
