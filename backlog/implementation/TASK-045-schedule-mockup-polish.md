# TASK-045: Привести окно расписания к новому макету

## Status
implementation

## Implementation lifecycle
- moved_to_implementation_at: 2026-05-15 14:39
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-045-schedule-mockup-polish.plan.md
- implementation_branch: feature/TASK-045-schedule-mockup-polish

## Goal
Окно `Расписание` должно визуально и функционально соответствовать новому макету и стать эталонным экраном для нового единого визуального стиля CRM: недельная сетка расписания без навигации по календарным датам, с фильтрами, подсветкой текущего дня недели, цветными занятиями, дневными счетчиками, легендой и агрегатами по загрузке залов.

## Context
В inbox есть заметка: `передаелать окно расписаний в соответствии с макетом`.

Макет: `/Users/muradchaniev/Downloads/ChatGPT Image 15 мая 2026 г., 14_07_44.png`.

Текущая завершенная основа расписания описана в `backlog/done/TASK-043-schedule-calendar-like-view.md`: read-only weekly calendar на базе backend schedule data. Новая заметка не дублирует `TASK-043`, а задает следующую визуальную итерацию по конкретному макету.

Связанная follow-up задача для остальных экранов CRM: `backlog/implementation/TASK-046-frontend-unified-visual-style.md`.

Рекомендуемый порядок реализации: сначала выполнить `TASK-045`, сформировав на расписании переиспользуемые правила spacing, typography, controls, cards, filters and compact summary blocks; затем выполнить `TASK-046`, применив эти правила к остальным окнам CRM.

## User role
главный тренер / администратор / тренер / все пользователи CRM

## Problem
Текущее расписание уже имеет календарную основу, но не доведено до целевого интерфейса из нового макета: пользователю сложнее быстро считать недельный шаблон, видеть текущий день недели, фильтры, типы занятий, количество занятий в день и загрузку залов.

Если реализовать новый стиль только локально внутри расписания, остальные окна CRM останутся визуально разрозненными. Поэтому эта задача должна заложить reusable frontend-основу для последующей унификации в `TASK-046`, не расширяя текущий implementation scope на все разделы.

## Scope
- Переработать экран `/schedule` в соответствии с приложенным макетом.
- Сохранить парадигму недельного шаблона: время по вертикали, дни недели по горизонтали, без выбора календарной даты или перехода между неделями.
- Добавить или привести к макету верхнюю панель: заголовок, индикатор автообновления и refresh, без диапазона календарных дат, кнопок предыдущей/следующей недели и кнопки `Сегодня`.
- Показать в заголовках колонок дни недели и счетчик занятий за день недели, без календарных дат.
- Подсветить текущий день недели как в исходном макете, опираясь на текущий weekday пользователя.
- Показывать текущую временную линию только внутри колонки текущего дня недели, если это не создает впечатление dated event calendar.
- Привести фильтры к макету: филиал, зал, тренер, группа и сброс фильтров.
- Привести карточки занятий к макету: цвет по типу группы, время, название группы, зал, заполненность/участники.
- Добавить легенду типов занятий.
- Добавить компактный блок статистики на сегодня, если данные можно получить из текущего schedule payload без новых domain rules.
- Добавить компактный блок загрузки залов, если данные можно вычислить из текущего schedule payload без backend contract changes.
- Сохранить responsive-поведение: desktop/tablet показывают календарную сетку, mobile остается списком выбранного дня или получает эквивалентный компактный вид без горизонтального page scroll.
- Зафиксировать и реализовать visual baseline для будущего CRM-wide стиля: page spacing, typography levels, control sizing, filter toolbar styling, cards, tables/list-adjacent surfaces, compact summary blocks, radii, borders, shadows and focus/hover states.
- Вынести явно общие visual patterns в существующие shared styles/components/helpers, если это можно сделать локально и без широкого design-system rewrite.
- Не оставлять новый визуальный стиль расписания полностью изолированным в одном screen-specific CSS/компоненте, если те же правила очевидно нужны в `TASK-046`.
- Сформировать краткие implementation notes для `TASK-046`: какие shared styles/components были добавлены или какие локальные паттерны расписания нужно распространить на остальные окна.

## Out of scope
- Drag-and-drop.
- Редактирование занятий из календаря.
- Переносы, отмены и замены тренера.
- Проверка конфликтов времени.
- Проверка занятости залов.
- Личные тренировки и dated event calendar.
- Навигация по календарным датам, выбор даты, переходы на предыдущую/следующую неделю и кнопка `Сегодня`.
- Отображение диапазона календарных дат как выбранного периода расписания.
- Изменение backend schedule validation rules.
- Изменение access scope, roles, permissions или attendance flows.
- Bot changes.
- Непосредственное приведение всех остальных окон CRM к единому стилю; это вынесено в `TASK-046`.
- Массовая переработка всех frontend routes в рамках этой задачи.
- Полный design-system rewrite или смена UI-библиотеки.

## Constraints
- Backend остается источником истины для CRM business logic, permissions, access scope and validation semantics.
- Frontend не должен добавлять frontend-only правила конфликтов, переносов, отмен или проверки занятости залов.
- Использовать существующий read-only schedule contract из `TASK-043`, если данных достаточно.
- Если для точного соответствия макету нужны новые backend-поля или новые бизнес-агрегаты, остановить реализацию и вынести отдельную backend/contract задачу.
- Расписание должно оставаться recurring weekly schedule: пользователь видит недельный шаблон `Пн...Вс`, а не календарь конкретных дат.
- В UI не должно быть возможности передвигаться по датам или неделям.
- Подсветка текущего дня недели допустима и обязательна, но она не должна превращать расписание в dated event calendar.
- `trainingStartTime` отображается как локальное `HH:mm` без `Date` parsing и timezone conversion.
- Значимое UX-изменение требует участия `ui-designer` перед реализацией.
- Не возвращать удаленную в `TASK-044` техническую intro-информацию в верхние области CRM-экранов.
- Новый стиль расписания должен быть совместим с последующей унификацией остальных окон в `TASK-046`.
- Shared visual styles must stay generic and domain-neutral: no schedule-specific names for reusable typography, spacing, controls or surface primitives.
- Извлекать общие styles/components только там, где это снижает будущую дубликацию; не выполнять крупный рефакторинг unrelated frontend screens в `TASK-045`.

## Acceptance criteria
- [ ] `/schedule` визуально соответствует приложенному макету в основных desktop-состояниях.
- [ ] Экран остается в парадигме недельного шаблона `Пн...Вс`, без выбора календарных дат.
- [ ] В верхней панели нет диапазона выбранной недели, перехода на предыдущую/следующую неделю и кнопки `Сегодня`.
- [ ] В верхней панели есть заголовок, индикатор автообновления и refresh.
- [ ] Заголовки дней показывают день недели и счетчик занятий, без календарной даты.
- [ ] Текущий день недели визуально выделен как в исходном макете.
- [ ] Текущая временная линия, если реализована, отображается только внутри колонки текущего дня недели и не добавляет date navigation semantics.
- [ ] Фильтры по филиалу, залу, тренеру и группе работают совместно.
- [ ] Сброс фильтров возвращает полное расписание.
- [ ] Карточки занятий показывают время, группу, зал и заполненность/участников на основе backend schedule data.
- [ ] Цвета карточек и легенда согласованы по типам занятий.
- [ ] Блок статистики на сегодня не дублирует backend domain rules и не показывает недостоверные числа, если данных недостаточно.
- [ ] Блок загрузки залов строится только из доступных schedule data или не реализуется без отдельной backend/contract задачи.
- [ ] Read-only поведение календаря сохранено для всех ролей.
- [ ] UI не предлагает переносы, отмены, замены, drag-and-drop или conflict resolution.
- [ ] Mobile/tablet/desktop layout не создает неуправляемый horizontal scroll и не допускает перекрытия текста.
- [ ] В реализации есть понятная reusable visual baseline для `TASK-046`: spacing, typography, controls, filters, cards/surfaces, compact summary blocks.
- [ ] Общие visual rules не спрятаны полностью в schedule-only styles, если они должны использоваться остальными окнами.
- [ ] Implementation notes явно говорят, какие стили/компоненты нужно распространить на остальные CRM-разделы в `TASK-046`.

## Test checklist
- [ ] Frontend/unit: проверить определение текущего дня недели без выбора календарной даты.
- [ ] Frontend/unit: проверить расчет счетчиков занятий по дням из schedule entries.
- [ ] Frontend/unit: проверить фильтрацию по филиалу, залу, тренеру и группе.
- [ ] Frontend/unit: проверить расчет цветов/легенды по типам занятий.
- [ ] Frontend/e2e: `/schedule` отображает новый макет на desktop.
- [ ] Frontend/e2e: на `/schedule` нет кнопок предыдущей/следующей недели, кнопки `Сегодня` и выбора календарной даты.
- [ ] Frontend/e2e: текущий день недели подсвечен.
- [ ] Frontend/e2e: фильтры применяются совместно и сбрасываются.
- [ ] Frontend/e2e: mobile viewport остается читаемым и без page-level horizontal scroll.
- [ ] Code review: проверить, что reusable visual styles/components названы нейтрально и пригодны для `TASK-046`.
- [ ] Visual review: сравнить schedule screen с текущими основными CRM-экранами и зафиксировать, какие паттерны должны стать общими.
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Запустить affected Playwright specs для schedule/responsive screens.

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: задача локализована во frontend schedule UI и опирается на существующий read-only contract, но меняет важный пользовательский экран и должна не превратиться в изменение schedule domain rules.

## Clarification questions
Заполнять только для needs-clarification.

Не требуется.

## Source notes
- Source file: `backlog/inbox/2026-05-15.md`
- Original note: `передаелать окно расписаний в соответствии с макетом`
- Mockup: `/Users/muradchaniev/Downloads/ChatGPT Image 15 мая 2026 г., 14_07_44.png`
- Related completed task: `backlog/done/TASK-043-schedule-calendar-like-view.md`

## Processing notes
- Created at: 2026-05-15 14:13
- Created by skill: codex-backlog-skill
- Duplicate check: активного дубликата в `tasks-ready`, `risky` или `needs-clarification` не найдено; `TASK-043` уже закрыт и является базовой calendar-like реализацией, а новая заметка задает follow-up polish по конкретному макету.
- Updated at: 2026-05-15 14:18 after user clarified that all other CRM windows also need unified spacing, typography and visual style; global cross-screen polish was split into `TASK-046`.
- Updated at: 2026-05-15 14:23 after user asked to update `TASK-045` requirements: `TASK-045` now explicitly starts the visual-style work by creating a reusable baseline for `TASK-046`, while keeping direct changes to other windows out of scope.
- Updated at: 2026-05-15 14:31 after user clarified schedule behavior: stay in weekly-template paradigm, remove date/week navigation, and keep current weekday highlighting from the mockup.
