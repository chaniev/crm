# TASK-046: Привести остальные окна CRM к единому визуальному стилю

## Status
implementation

## Implementation lifecycle
- moved_to_implementation_at: 2026-05-15 14:39
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-046-frontend-unified-visual-style.plan.md
- implementation_branch: feature/TASK-046-frontend-unified-visual-style

## Goal
Все основные окна CRM должны выглядеть как единая система: одинаковые отступы, типографика, плотность интерфейса, размеры контролов, радиусы, тени, таблицы, фильтры, заголовки и пустые состояния.

## Context
После создания задачи `TASK-045` по переделке окна `Расписание` под новый макет пользователь уточнил, что единый стиль нужен не только в расписании, но и во всех остальных окнах: отступы, шрифты и прочие визуальные правила должны быть согласованы.

`TASK-045` остается задачей про окно `Расписание`. Эта задача фиксирует отдельный cross-screen frontend polish, чтобы после обновления расписания остальные разделы CRM не выглядели устаревшими или собранными из другого UI-kit.

## User role
главный тренер / администратор / тренер / все пользователи CRM

## Problem
Даже если расписание будет приведено к новому макету, остальные окна могут сохранить разные отступы, размеры шрифтов, плотность, карточки, фильтры и таблицы. Это создает ощущение несобранного продукта и усложняет дальнейшую разработку.

## Scope
- Провести frontend-аудит основных CRM-экранов и найти визуальные расхождения.
- Привести layout spacing к единой шкале: page padding, section gaps, toolbar gaps, form gaps, table/card padding.
- Привести типографику к единой системе: заголовки страниц, заголовки блоков, body text, labels, helper text, table text.
- Унифицировать высоту, padding и visual states для buttons, inputs, selects, filters, tabs, search fields и icon buttons.
- Унифицировать оформление tables, lists, cards, empty states, loading/error states и compact summary blocks.
- Согласовать radii, borders, shadows, background bands и hover/focus states с новым направлением из `TASK-045`.
- Проверить основные разделы CRM: Главная, Расписание, Посещения, Клиенты, Группы, Тренеры, Журнал, Финансы, Настройки.
- Вынести повторяющиеся visual rules в существующие frontend style helpers/components, если в проекте уже есть подходящее место.
- Сохранить читаемость и плотность интерфейса на desktop, tablet и mobile.

## Out of scope
- Изменение backend contracts.
- Изменение CRM domain rules, permissions, roles или access scope.
- Перестройка информационной архитектуры разделов.
- Добавление новых бизнес-функций.
- Изменение расписания сверх `TASK-045`.
- Полный design-system rewrite, если можно добиться единообразия локальными frontend-компонентами и styles.
- Маркетинговые landing-page элементы, декоративные hero-блоки и нерабочие промо-секции.

## Constraints
- Backend owns CRM business logic; frontend changes must stay visual/ergonomic only.
- Не возвращать техническую intro-информацию, удаленную в `TASK-044`.
- Не дублировать CRM business rules во frontend ради визуальных счетчиков или статусов.
- При расхождении между макетом расписания и существующими рабочими паттернами CRM выбирать спокойный рабочий SaaS-стиль, а не декоративную страницу.
- Значимое UX-изменение требует участия `ui-designer` перед реализацией.
- Не ломать responsive layout: text must not overlap, buttons/controls must not resize unpredictably, page-level horizontal scroll is not allowed.
- Использовать существующие frontend conventions and shared components where practical.

## Acceptance criteria
- [ ] Основные CRM-разделы имеют согласованные page padding и вертикальные отступы.
- [ ] Заголовки страниц и блоков используют единую типографическую шкалу.
- [ ] Buttons, inputs, selects, filters, tabs и search fields выглядят согласованно по высоте, padding, focus/hover states.
- [ ] Tables, lists и cards используют согласованные borders, radii, shadows/backgrounds and spacing.
- [ ] Empty/loading/error states выглядят как часть одной системы.
- [ ] Навигация и рабочие панели не конфликтуют визуально с новым расписанием из `TASK-045`.
- [ ] Desktop, tablet и mobile не имеют перекрытий текста или неуправляемого horizontal scroll.
- [ ] Изменения не добавляют frontend-only domain logic.
- [ ] Изменения не возвращают технические intro-бейджи и service labels, удаленные ранее.

## Test checklist
- [ ] Вручную проверить основные разделы: Главная, Расписание, Посещения, Клиенты, Группы, Тренеры, Журнал, Финансы, Настройки.
- [ ] Проверить desktop, tablet и mobile viewports.
- [ ] Проверить длинные русские названия, пустые состояния, loading и error states.
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Запустить affected Playwright specs для измененных экранов.
- [ ] При существенных visual changes сделать Playwright screenshots до финального ответа и проверить отсутствие перекрытий.

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: задача frontend-only и не меняет domain rules, но затрагивает много экранов и требует аккуратного визуального аудита без скрытой перестройки UX.

## Clarification questions
Заполнять только для needs-clarification.

Не требуется.

## Source notes
- Source file: direct user follow-up in current thread, 2026-05-15.
- Original note: `учтено ли в требованиях что надо во всех остальных окнах сделать единый стиль? отступы, шрифты и тд`
- Related task: `backlog/implementation/TASK-045-schedule-mockup-polish.md`
- Related completed task: `backlog/done/TASK-044-hide-technical-information.md`

## Processing notes
- Created at: 2026-05-15 14:18
- Created by skill: codex-backlog-skill follow-up handling
- Duplicate check: активного дубликата в `tasks-ready`, `risky` или `needs-clarification` не найдено; `TASK-018` ограничена визуальным шумом карточки клиента, `TASK-044` закрыла удаление технической информации, а эта задача фиксирует общий frontend visual consistency pass.
