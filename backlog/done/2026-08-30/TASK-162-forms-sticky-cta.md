# TASK-162: Sticky primary CTA форм на мобильных

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-30 00:30
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/2026-08-30/TASK-162-forms-sticky-cta.plan.md
- implementation_branch: feature/TASK-162-forms-sticky-cta
- integrated_to_main_at: 2026-08-30
- candidate_commit: 780b0923097db790c0d30f7c325b62d1911abb2e

## Requirements
- REQ-NFR-001 — constrains

## Goal
Первичное действие форм создания/редактирования на мобильных (`≤ 48rem`)
находится в sticky-полосе внизу экрана над нижней навигацией — в зоне
большего пальца, с доминантной геометрией; desktop сохраняет текущий top-bar.

## Context
Анализ всех форм (2026-08-30, `artifacts/screenshots/all-screens/`:
09–12 schedule-формы, 14/17 клиент, 19/20 группа, 22/23 тренер) показал
единый паттерн: топ-бар ~56px с back-кнопкой 44px, заголовком ~20px и
текстовой кнопкой «Создать/Сохранить» ~14px справа. Текстовая кнопка в
правом верхнем углу — не thumb-zone и визуально слабее, чем положено
доминантному действию. В системе уже есть `TemporarySurfaceFooter`
(safe-area-aware) и `--crm-layer-sticky-action-bar`.

## User role
Тренер/администратор, создающий или редактирующий сущность одной рукой.

## Problem
Primary CTA формы требует дотягивания в верхний угол и проигрывает по
визуальному весу заголовку; при софт-клавиатуре кнопка может уходить из виду.

## Scope
- Ввести shared-паттерн sticky form action bar: primary action на всю ширину
  или доминантную часть, secondary (отмена) рядом, safe-area + bottom-nav
  offset, слой sticky action bar.
- Применить к мобильным формам: клиент (create/edit), группа (create/edit),
  тренер (create/edit), занятие (create/edit/move) и series edit — по единому
  контракту.
- Desktop (`> 48rem`) сохраняет действие в top-bar; поведение сабмита,
  валидации, duplicate-submit protection и ProblemDetails mapping не меняются.
- Проконтролировать поведение при открытой софт-клавиатуре: primary action
  остаётся видимым или достижимым одним скроллом (критерий приёмки).

## Out of scope
- Перекомпоновка полей форм (шаги/группировка) — отдельные продуктовые задачи.
- Изменение самих операций, permissions или валидации (backend-owned).
- Detail-экраны без форм.

## Constraints
- Один visually dominant primary на активное состояние формы.
- Кнопка ≥ 44px высоты; sticky-полоса не перекрывает safe-area и bottom nav.
- Mantine/shared-компоненты; без новой глобальной state-машины.

## Acceptance criteria
- [ ] На `390/420px` primary CTA виден в sticky-полосе без скролла, не
      перекрыт клавиатурой/nav; secondary action доступен.
- [ ] Формы клиента/группы/тренера/занятия используют единый shared-паттерн.
- [ ] Сабмит, ошибки валидации, duplicate-submit и focus-поведение
      сохранены; regression-флоу зелёные.
- [ ] Desktop-топбар с действием сохранён на `> 48rem`.

## Test checklist
- [ ] Затронутые form-флоу в Playwright + `npm run test:e2e:iphone`.
- [ ] Compact-height 912x420/956x440 smoke.
- [ ] Root verification harness для frontend diff.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: medium
- Reason: затрагивает несколько форм, но изменение presentation-раскладки
  действия при сохранении всех сабмит-контрактов и тестов.

## Clarification questions
Не требуется.

## Source notes
- Source: analysis conversation 2026-08-30 «анализ всех экранов» (9
  форм-экранов, 420x912).
- Completed baselines: [TASK-151](../2026-08-29/TASK-151-complete-shared-component-contracts.md)
  (TemporarySurfaceFooter), TASK-153 (visual gate).

## Processing notes
- Created at: 2026-08-30 (MSK)
- Duplicate check: активных задач по формам нет; TASK-016/018/019/021 касаются
  карточки клиента, не CTA-раскладки форм.
- Classification: `tasks-ready`; REQ-NFR-001 `принято`, `constrains`.

## Implementation evidence
- Добавлен единый `StickyFormActions`: на мобильных route-формах он фиксирован
  над нижней навигацией с safe-area и слоем sticky action bar, в drawer остаётся
  sticky внутри временной поверхности; primary занимает доминантную колонку и
  все действия имеют высоту не менее 44px.
- Shared-паттерн применён к create/edit клиента, группы и тренера, к
  create/edit/move занятия и series edit без изменения submit, preview/execute,
  ProblemDetails, duplicate-submit или focus-контрактов.
- RED→GREEN: component-тест сначала падал из-за отсутствующего export;
  после реализации весь frontend check зелёный — 72 test files / 646 tests,
  raw color/spacing scanners, lint, typecheck и production build.
- Chromium 390px: group-create primary/secondary видимы без скролла, bar не
  пересекает mobile navigation, preview/execute flow зелёный.
- WebKit target iPhone 420x912 и 440x956: one-off drawer и trainer edit sticky
  CTA видимы, touch-height ≥44px, submit/preview flows зелёные — 4/4.
- `npm audit --audit-level=high`: 0 vulnerabilities; requirements и agent
  instructions validators зелёные.
- Реальная iOS soft-keyboard/Dynamic Island остаются ручной стендовой
  проверкой; автоматизированы portrait и compact-landscape контракты.
