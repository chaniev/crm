# TASK-113: Добавить фильтр расписания по типу группы

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-16 20:24
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/TASK-113-schedule-group-type-organization.plan.md
- implementation_branch: feature/TASK-113-schedule-group-type-organization
- implementation_state: superseded-by-TASK-119
- implementation_commit: 5a5cabe

## Goal
Пользователь быстро находит занятия нужного типа, не теряя временной порядок расписания.

## Context
В расписании уже отображаются типы групп, цветовая легенда и количество занятий по типам. Фильтры поддерживают филиал, зал, тренера и группу, но не тип группы. Занятия сортируются прежде всего по времени.

Продуктовое решение от 2026-08-16: на экране `/schedule` нужен очищаемый фильтр `Тип группы` с выбором одного типа. После применения фильтра занятия сохраняют существующую сортировку по времени.

## User role
Тренер / администратор / главный тренер.

## Problem
Пользователь вынужден визуально просматривать всё расписание, чтобы найти занятия нужного типа. Существующая цветовая легенда помогает различать типы, но не сокращает набор видимых занятий.

## Scope
- Добавить на `/schedule` очищаемый single-select фильтр `Тип группы`.
- Строить варианты фильтра по `groupTypeId` и `groupTypeName` из уже загруженного, разрешённого backend scope расписания.
- Применять фильтр совместно с существующими фильтрами филиала, зала, тренера и группы.
- Сохранять существующий time-first порядок занятий внутри каждого дня после фильтрации.
- Добавить фильтр в существующую responsive filter surface на mobile, tablet и desktop без отдельной строки controls.
- Сбрасывать выбранный тип общей кнопкой `Сбросить`; отдельная очистка select также возвращает все доступные типы.
- Оставить легенду типов пассивной metadata и пересчитывать её по видимым после фильтрации занятиям.
- Сохранить выбранный тип при manual/auto refresh и смене viewport в рамках открытого экрана так же, как существующие schedule filters.

## Out of scope
- Группировка карточек по типам и переключаемый primary sort.
- Multi-select типов групп.
- Превращение legend chips в интерактивные controls.
- Сохранение фильтра типа в URL, deep link, browser refresh или back/forward.
- Server-side фильтрация `/schedule/groups` по типу.
- Изменение справочника типов групп.
- Frontend-only бизнес-приоритеты типов.
- Изменение backend schedule semantics и conflict logic.
- Изменения day/week URL semantics из TASK-112 и представления параллельных занятий из TASK-106.

## Constraints
- Backend остаётся источником permissions и access scope; frontend использует только типы из полученного schedule payload.
- Значением фильтра служит стабильный `groupTypeId`, пользовательской подписью — `groupTypeName`.
- Варианты типов сортируются по названию без frontend-only бизнес-приоритетов.
- Существующая легенда остаётся metadata и не дублирует операцию фильтрации.
- Активный filter state должен быть видимым, доступным и сбрасываемым.
- На mobile новый control не должен создавать вторую action-only строку или горизонтальный page scroll.
- Фильтр должен работать в недельном и дневном представлении после интеграции TASK-112 и не менять mode/weekday URL state.
- Реализация не должна смешиваться с TASK-106 или TASK-112 и должна адаптироваться только к их состоянию, уже интегрированному в актуальный `origin/main`.

## Acceptance criteria
- [ ] На `/schedule` доступен single-select фильтр `Тип группы` с отдельной очисткой и значением по умолчанию `Все типы`.
- [ ] Список вариантов содержит доступные пользователю типы из schedule payload и сортируется по названию.
- [ ] Выбранный тип фильтрует занятия совместно с фильтрами филиала, зала, тренера и группы.
- [ ] После фильтрации занятия внутри дня остаются отсортированными по времени.
- [ ] Общая кнопка `Сбросить` очищает фильтр типа вместе с остальными фильтрами.
- [ ] Manual/auto refresh и смена viewport не сбрасывают выбранный тип в рамках открытого экрана.
- [ ] При отсутствии занятий показывается существующий filter-empty state с понятным способом сброса.
- [ ] Легенда остаётся неинтерактивной и отражает только видимые после фильтрации занятия.
- [ ] Loading, error, stale/retry и role-scoped empty states сохраняют текущее поведение.
- [ ] Фильтр работает в mobile day view, а также в tablet/desktop week и day modes после TASK-112.
- [ ] На обязательных responsive размерах нет второй action-only строки, nested-scroll trap или page-level horizontal overflow.

## Test checklist
- [ ] Добавить unit tests для single-select фильтра, совместного применения фильтров, списка вариантов и time-first порядка результата.
- [ ] Добавить component tests для выбора, отдельной очистки, общей кнопки `Сбросить`, refresh и filter-empty state.
- [ ] Добавить Playwright-сценарий выбора типа, пустого результата и reset в mobile day view и wide schedule view.
- [ ] Проверить keyboard/focus semantics и touch targets не меньше `44 x 44px` в responsive filter surface.
- [ ] Проверить отсутствие horizontal overflow на `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420`, `956 x 440`, `768 x 1024` и `1440 x 1200`.
- [ ] Запустить `cd frontend && npm run lint`, `npm run build`, `npm run test:unit` и affected Playwright specs.

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: продуктовая операция и границы определены; задача локальна для frontend schedule filtering, но затрагивает основной responsive workflow и пересекающиеся schedule-компоненты активных TASK-106/TASK-112.

## Clarification questions
Не требуется. Решение закрыто 2026-08-16:

- экран — `/schedule`;
- операция — очищаемый single-select фильтр `Тип группы`;
- занятия после фильтрации сохраняют сортировку по времени.

## Source notes
- Source file: `backlog/inbox/2026-08-16.md`
- Original note: `Сортировка по типу групп`

## Processing notes
- Created at: 2026-08-16 16:45
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- Duplicate check: активного дубликата нет; завершённые TASK-043/TASK-045 добавили type metadata и legend, но не filter/grouping/sort operation.
- Possible overlap: соседство заметки с расписанием позволяет предположить `/schedule`, но этого недостаточно для безопасной реализации.
- Updated at: 2026-08-16 20:02 after the user confirmed `/schedule`, an очищаемый single-select filter `Тип группы` and preserved chronological ordering.
- Moved to tasks-ready at: 2026-08-16 20:02 after all blocking product questions were resolved.
- Coordination: TASK-106 and TASK-112 remain separate implementation tasks; TASK-113 must use their integrated baseline without copying unmerged branch code or changing their contracts.
- Status audit at: 2026-08-24 09:44 MSK — TASK-119 replaced the weekly-template screen with the integrated dated occurrence calendar and delivered the group-type filter through its approved URL-backed, backend-filtered contract. The original TASK-113 branch and plan were not executed independently.

## Completion record
- Completed by superseding implementation: TASK-119, candidate `5a5cabe`, integrated into `main` before baseline `2adfc72`.
- The user-visible goal is present in the current calendar: a clearable `Тип группы` select uses access-scoped response options, writes `groupTypeId` to schedule URL/API state, composes with the other filters and preserves chronological date/time ordering.
- The original frontend-local, payload-only filtering plan is intentionally obsolete: TASK-119 made schedule filters URL-backed and backend-owned, replaced `CompactFilterPanel` with `Параметры календаря`, and replaced weekday-template legend/count assumptions with a dated occurrence calendar.
- Direct regression coverage for selecting, clearing and resetting the group-type filter is tracked separately by `TASK-131-schedule-group-type-filter-regression.md`; it does not keep TASK-113 implementation open.
- moved_to_done_at: 2026-08-24 09:44 MSK
- last_status_reviewed_at: 2026-08-24 09:44 MSK
