# TASK-160: Поверхности list-row и focus-card как нормы дизайн-системы

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-30 00:30
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/TASK-160-list-row-surfaces.plan.md
- implementation_branch: feature/TASK-160-list-row-surfaces
- integrated_to_main_at: 2026-08-30
- candidate_commit: 092197dfc86ec7482e1e28872f8379e7c72ba507

## Requirements
- REQ-NFR-001 — constrains

## Goal
Дизайн-система фиксирует два режима поверхностей: плотная «строковая карточка»
для повторяющихся списков (без тени, радиус ≤ 16px, тон/бордер) и «фокусная
карточка» (радиус 24px, элевация) для auth/detail/временных поверхностей.
Новые экраны больше не выбирают между ними произвольно.

## Context
Анализ 26 экранов на `420 x 912` (2026-08-30) показал сосуществование двух
паттернов без системного разделения. «Тренеры» и «Журнал» уже рисуют строки
~64–80px без теней и вмещают 6–8 записей на экран; «Внимание», «Группы» и
«Расписание» используют тяжёлые карточки ~100–150px с радиусом ~24px и двойной
тенью (`--crm-elevation-card`), из-за чего на экран помещается 3–4 сущности.
DESIGN.md предписывает «tonal separation and borders», но исполняемые токены
этому не соответствуют: `--crm-radius-card: 24px` применяется почти ко всему.

## User role
Все роли на мобильных и десктопе; presentation-level нормализация.

## Problem
Тяжёлая карточка как default для списков снижает плотность рабочих экранов
(«Внимание» — 3 клиента на экран при роли «рабочего списка обзвона») и
создаёт визуальный шум тенями на 10+ строках.

## Scope
- Ввести в foundations семантические surface-токены: `--crm-surface-list-row`
  (фон `surfaceSubtle`/card + бордер `borderMuted`, радиус ≤ 16px, без тени) и
  закрепить `--crm-radius-card` как focus-поверхность.
- Мобильное переопределение радиусов на `≤ 48rem`: focus-card 24 → 16px,
  inner 20 → 12px; десктоп сохраняет текущие значения.
- Правило элевации: тени — только временные/плавающие поверхности
  (drawer/modal/sticky bar/floating); списковые строки — тон/бордер.
- Мигрировать на новые токены репрезентативные плоские списки («Тренеры»,
  «Журнал») без изменения их геометрии.
- Обновить каталог `src/catalog` разделом поверхностей с мобильными состояниями.

## Out of scope
- Перекомпоновка экранов «Внимание»/«Группы» (владельцы — TASK-163/TASK-164);
  эта задача только предоставляет токены.
- Мобильные строки расписания — утверждённый контракт TASK-157; его строки
  должны потреблять эти токены при реализации.
- Изменение auth-экрана и временных поверхностей Mantine.

## Constraints
- Миграция «Тренеров»/«Журнала» — behavior-preserving (computed-геометрия тех
  же экранов сохраняется в пределах радиуса).
- Все темы проходят contrast matrix; raw colors не вводятся.
- Соблюдается Mantine/Onest; без параллельной дизайн-системы.

## Acceptance criteria
- [ ] Токены опубликованы с drift-тестом; каталог документирует оба режима.
- [ ] «Тренеры» и «Журнал» рендерятся на list-row токенах без изменения
      вычисляемой плотности (before/after).
- [ ] На `≤ 48rem` focus-радиусы ≤ 16/12px; `> 48rem` без изменений.
- [ ] В списковых контекстах не применяется `--crm-elevation-card` (сканер или
      ревью-правило задокументированы).

## Test checklist
- [ ] Визуальные/component-проверки затронутых списков на 360–440 и 1440.
- [ ] Contrast matrix по всем профилям.
- [ ] Root verification harness; affected Playwright flows.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: low
- Reason: token-level нормализация с репрезентативной миграцией; экранная
  перекомпоновка вынесена в отдельные задачи.

## Clarification questions
Не требуется: направление зафиксировано анализом и согласуется с DESIGN.md.

## Source notes
- Source: analysis conversation 2026-08-30 «анализ всех экранов»; evidence:
  `artifacts/screenshots/all-screens/` (21-coaches, 24-audit, 03-attention,
  18-groups, 06-schedule-day).
- Completed baselines: [TASK-145](../done/TASK-145-design-foundation-scales.md),
  [TASK-152](../done/TASK-152-design-system-catalog.md).
- Consumers: [TASK-157](TASK-157-schedule-mobile-density.md),
  [TASK-163](TASK-163-attention-density.md),
  [TASK-164](TASK-164-groups-vertical-budget.md).

## Processing notes
- Created at: 2026-08-30 (MSK)
- Duplicate check: TASK-145 консолидировал существующие значения, но не вводил
  разделения list/focus поверхностей; активных аналогов нет.
- Classification: `tasks-ready`; REQ-NFR-001 `принято`, `constrains`.
