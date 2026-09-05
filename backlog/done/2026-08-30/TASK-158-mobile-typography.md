# TASK-158: Мобильные переопределения типографской шкалы

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-30 00:30
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/2026-08-30/TASK-158-mobile-typography.plan.md
- implementation_branch: feature/TASK-158-mobile-typography
- verification_contract: /backlog/done/2026-08-30/TASK-158-mobile-typography-verification-contract.json
- integrated_to_main_at: 2026-08-30
- candidate_commit: 352494059c7e8d9fdcabd069170f889bf840d9a7

## Requirements
- REQ-NFR-001 — constrains

## Goal
На мобильной ширине (`≤ 48rem`) экранные заголовки, веса и межстрочный
интервал вторичного текста соответствуют плотности операционного инструмента:
иерархия строится весом и цветом, а не только размером, и первый экран не
расходуется на крупные заголовки.

## Context
Анализ всех экранов на `420 x 912` (2026-08-30, `artifacts/screenshots/all-screens/`)
показал: шкала `src/theme/typography.ts` наследует desktop-масштаб — на 420px
H1 рендерится ~28px, H2 ~23px, почти все роли весят 800. Заголовки экранов и
карточек «Внимания» визуально тяжелее контента. При этом реестровые экраны
(Клиенты, Тренеры, Журнал) уже показывают здоровую body-типографику: имена
15–16px, метаданные 12–13px — body-шкалу менять не нужно.

TASK-146 опубликовал роли как `--crm-type-*` переменные; TASK-152 добавил
design-system каталог. Эта задача добавляет мобильные переопределения без
изменения самих ролей.

## User role
Все роли на мобильных устройствах; изменение presentation-only.

## Problem
Desktop-выведенная шкала заголовков и поголовный вес 800 делают мобильные
экраны визуально тяжелыми и снижают плотность без пользы для сканируемости.

## Scope
- Media-переобъявление `--crm-type-*` переменных на `≤ 48rem` в едином месте
  (корневой CSS или эквивалентный theme-механизм): `heading1` → ~22px/700,
  `heading2` → ~18px/700, `heading3` → 16px/700; `display` остаётся для auth.
- Вес `label` и `numeric` 800 → 700 на мобильных; вес 800 остаётся только у
  `display`.
- `bodyCompact` line-height 1.25 → ~1.35 на мобильных (двухстрочные
  мета-строки карточек).
- Обновить каталог `src/catalog` мобильными состояниями типографики.
- Репрезентативные экраны для rendered-проверки: реестры (хороший baseline),
  «Внимание», заголовки форм.

## Out of scope
- Изменение `formControl` 1rem и правила 16 CSS px против iOS-зума.
- Переназначение ролей, доменных текстов или состава полей.
- Широкие экраны: `> 48rem` сохраняет текущие значения.

## Constraints
- Точные значения размеров фиксируются в задаче как acceptance, но не ниже
  читаемости: заголовки ≥ 18px, secondary-текст ≥ 12px с контрастом по
  контрастной матрице.
- Соблюдаются Mantine, Onest, существующие токены; без новой дизайн-системы.
- Behavior-preserving в остальном: состав данных, контракты и navigation
  не меняются.

## Acceptance criteria
- [ ] На `390/420/440px` экранные H1/H2 рендерятся ≤ 22/18px и весом ≤ 700.
- [ ] `label`/`numeric` на мобильных не используют вес 800.
- [ ] Двухстрочные мета-строки карточек имеют межстрочный интервал ≥ 1.3.
- [ ] Каталог отражает мобильные переопределения; contrast matrix проходит.
- [ ] `> 48rem` геометрия типографики не изменилась (перед/после на 768/1440).

## Test checklist
- [ ] Компонентные/визуальные проверки заголовков на 360/390/420/440 и 768/1440.
- [ ] Затронутые Playwright-флоу + `npm run test:e2e:iphone`.
- [ ] Root verification harness для frontend diff.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: low
- Reason: presentation-only изменение токенов и CSS с каталогом и
  регрессионным покрытием; без изменения данных и контрактов.

## Clarification questions
Не требуется: изменение визуальной плотности явно поручено анализом
дизайн-системы; точные значения зафиксированы в scope.

## Source notes
- Source: analysis conversation 2026-08-30 «анализ всех экранов» (26 экранов,
  420x912); evidence: `artifacts/screenshots/all-screens/`.
- Completed baseline: [TASK-146](../2026-08-29/TASK-146-typography-scale.md).
- Related: [TASK-154](../../risky/TASK-154-modularize-global-css.md) владеет
  разбиением `App.css`; переопределения не должны конфликтовать с его планом.

## Processing notes
- Created at: 2026-08-30 (MSK)
- Duplicate check: TASK-146 ввёл роли и переменные, но не вводил мобильных
  переопределений; активных задач на responsive-типографику нет.
- Classification: `tasks-ready`; REQ-NFR-001 `принято`, отношение `constrains`
  (редакция требования не меняется), блокирующих вопросов нет.
- Updated at: 2026-08-30 (implementation evidence): `48rem` трактуется
  включительно, поэтому `768px` проверяется как mobile boundary; unchanged
  desktop barrier начинается с `769px`. Это разрешает внутреннюю неточность
  plan без изменения продуктового scope.
