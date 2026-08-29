# TASK-159: Шкала отступов 4px и гигиена узких брейкпоинтов

## Status
implementation

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-30 00:30
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-159-spacing-scale-breakpoints.plan.md
- implementation_branch: feature/TASK-159-spacing-scale-breakpoints

## Requirements
- none — behavior-preserving консолидация отступов и брейкпоинтов в токены с сохранением вычисляемой геометрии

## Goal
Повторяющиеся отступы и узкие брейкпоинты выражаются именованными токенами из
единого источника (`src/theme/foundations.ts`), а новые raw-значения
блокируются сканером так же, как это сделано для цветов в TASK-150.

## Context
TASK-145 закрепил typed-источник для breakpoints/spacing/radii/elevation/layers,
но шкала отступов содержит только 5 page-level значений. В `App.css` живёт
~30 ad-hoc значений (`0.35rem`, `0.45rem`, `0.55rem`, `0.65rem`, `0.85rem`,
`0.9rem`, `8px`, `10px 12px`…), из-за чего мобильный ритм списков держится
вручную и дрейфует. Узкие пороги для guardrail 360px раскиданы по файлу:
`20em`, `21.99em`, `22.5em`, `24.375em`, `26.25em`, `27.5em`.

## User role
Все роли; техническая задача без изменения product behavior.

## Problem
Без шкалы каждое новое правило выбирает произвольный отступ; плотность
мобильных списков нельзя поддерживать системой, только ревью.

## Scope
- Добавить в `foundationSpacing` шаги 4px-сетки (`--crm-space-1..8` ≈
  4/8/12/16/20/24/32/48px) и опубликовать переменные.
- Задокументировать мобильный ритм списков: 8px внутри группы, 12px между
  строками, 16–24px между секциями.
- Добавить в `foundationBreakpoints` минимальный набор алиасов для guardrail
  360px (например, `narrowMax`) и перевести существующие ad-hoc узкие пороги
  на алиасы в рамках затрагиваемых файлов; полную миграцию не форсировать.
- Добавить сканер/правило, запрещающее новые raw spacing-значения вне
  разрешённого списка (по образцу color scanner TASK-150), с allowlist для
  существующих.
- Обновить каталог `src/catalog`.

## Out of scope
- Массовая миграция всех существующих значений `App.css` (отдельное решение
  после TASK-154 — разбиения `App.css`).
- Изменение computed-геометрии: значения, попадающие в шкалу, заменяются на
  эквивалентные.

## Constraints
- Behavior-preserving: перед/после — computed размеры, overflow и safe-area
  совпадают (проверка выборочных экранов на 390/420/1440).
- Единая мобильная граница `48rem` не дублируется (правило DESIGN.md).

## Acceptance criteria
- [ ] Шкала опубликована как `--crm-space-*` с drift-тестом в foundations.
- [ ] Сканер падает на новом raw spacing-значении вне allowlist.
- [ ] Узкие пороги в затронутых файлах ссылаются на алиас, а не на magic number.
- [ ] Выборочная before/after-проверка геометрии на 390/420/1440 без различий.

## Test checklist
- [ ] Unit-тесты foundations/сканера.
- [ ] Root verification harness для frontend diff.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: low
- Reason: техническая консолидация токенов и линтинга; геометрия сохраняется.

## Clarification questions
Не требуется.

## Source notes
- Source: analysis conversation 2026-08-30 «анализ всех экранов».
- Completed baseline: [TASK-145](../done/TASK-145-design-foundation-scales.md).
- Sequencing: координировать с активной [TASK-154](../risky/TASK-154-modularize-global-css.md);
  массовая миграция значений остаётся за TASK-154 или отдельной задачей.

## Processing notes
- Created at: 2026-08-30 (MSK)
- Duplicate check: TASK-145 не вводил шагов шкалы и сканера; активных
  spacing-задач нет.
- Classification: `tasks-ready`; `none` с behavior-preserving причиной.
