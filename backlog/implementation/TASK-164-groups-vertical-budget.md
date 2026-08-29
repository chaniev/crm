# TASK-164: «Группы» — вертикальный бюджет реестра

## Status
implementation

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-30 00:30
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-164-groups-vertical-budget.plan.md
- implementation_branch: feature/TASK-164-groups-vertical-budget

## Requirements
- REQ-GRP-001 — constrains
- REQ-NFR-001 — constrains

## Goal
Реестр «Группы» на мобильных начинает список с первых ~150px экрана: максимум
две строки управления (локатор/фильтр + диапазон), карточки групп компактны,
первый экран вмещает минимум 5 групп.

## Context
Анализ 2026-08-30 (`artifacts/screenshots/all-screens/18-groups-top.png`):
до первой карточки ~250–300px — контентно-пустая строка подзаголовка, строка
сводок («Всего 100», «4 без тренера») и тулбар; карточки групп ~100px с
бейджами и чипами тренеров. При этом mobile-acceptance уже закрепляет
принцип: реестры не содержат агрегатных виджетов, которые нельзя показать
прямее в locator/filter/range/entity-строках; значит сводки должны войти в
разрешённые строки, а не занимать отдельный ряд.

## User role
Администратор/главный тренер, ищущий группу для просмотра или правки с
телефона.

## Problem
Треть первого экрана уходит на подписи и счётчики до тулбара; список групп
начинается ниже, чем на эталонных реестрах («Клиенты» ~108px, «Тренеры»
~150px).

## Scope
- Убрать строку подзаголовка; встроить счётчики («Всего», «без тренера») в
  строку диапазона/статуса списка или локатор без потери информации и
  доступных имён.
- Сохранить locator/filter/actions в одной строке (существующий
  `EntityLocatorBar`-паттерн) без action-only второй строки.
- Компактные карточки групп на list-row surface (TASK-160): имя группы как
  первый якорь, расписание/зал/филиал — выровненные decision-данные, тренеры
  компактно; состав данных REQ-GRP-001 сохраняется.
- Сверить с существующими acceptance-паттернами TASK-090/реестра (locator,
  filter, range/status) — не удалять разрешённые элементы, а уплотнить.

## Out of scope
- Изменение состава полей группы, backend-пагинации/фильтров.
- Desktop-представление реестра.
- Расписание группы и карточка группы в detail.

## Constraints
- `EntityLocatorBar` и существующие контракты фокуса/очистки сохраняются.
- Все цели ≥ 44×44px; без горизонтального скролла на 360–440px.
- Токены TASK-160 потребляются после его интеграции.

## Acceptance criteria
- [ ] На `420 x 912` первая карточка группы начинается не ниже ~180px; видно
      минимум 5 карточек; на `390` — минимум 4.
- [ ] Над списком максимум две строки управления; счётчики сохранены и
      доступны.
- [ ] Данные REQ-GRP-001 в карточке сохранены; длинные названия переносятся.
- [ ] Locator/filter/actions остаются в одной строке на 360–1440px.

## Test checklist
- [ ] Обновить groups-registry regression (Chromium + iphone projects).
- [ ] Geometry-проверки 360/390/420/440/768/1440.
- [ ] Root verification harness для frontend diff.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: low
- Reason: уплотнение одного реестра с сохранением контрактов данных и
  существующих паттернов тулбара.

## Clarification questions
Не требуется.

## Source notes
- Source: analysis conversation 2026-08-30 «анализ всех экранов»; evidence:
  `artifacts/screenshots/all-screens/18-groups-*.png`.
- Token dependency: [TASK-160](TASK-160-list-row-surfaces.md).
- Related accepted patterns: `.agents/skills/crm-mobile-first-ui/references/mobile-acceptance.md`
  (реестры без агрегатных виджетов).

## Processing notes
- Created at: 2026-08-30 (MSK)
- Duplicate check: завершённые tasks 090/142–153 не владеют вертикальным
  бюджетом реестра групп; активных аналогов нет.
- Classification: `tasks-ready`; оба REQ `принято`, `constrains`.
