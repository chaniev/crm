# Implementation Plan: TASK-182 Показывать календарную дату рядом с днём недели

## Metadata
- source_task: /backlog/done/2026-11-21/TASK-182-schedule-weekday-calendar-date.md
- requirements: REQ-GRP-007 (changes); REQ-NFR-001 (constrains); REQ-NFR-007 (constrains)
- branch: codex/TASK-182-schedule-weekday-calendar-date
- readiness: yes
- product_decisions: accepted
- technical_decisions: none — локальная доработка существующих компонентов; новый архитектурный механизм не вводится
- architecture_decisions: none — границы слоёв и API не меняются
- open_questions: none
- dependencies: TASK-175 не блокирует: использовать текущий formatter
- risk: low — регрессия существующего взаимодействия

## Goal
После переключения дня понятно, к какому числу относится список занятий.

## Relevance evidence
GroupScheduleScreen daySummary выводит только formatLongWeekday(urlState.date), хотя выбранная дата доступна в том же состоянии.
Проверены активные карточки и незавершённые планы; выбранные ID не имеют завершённых карточек-дублей. Статическое доказательство не заменяет runtime-приёмку.

## Decisions and contracts
Принятые границы и ожидаемое поведение заданы Requirements и Acceptance criteria исходной задачи.
Локальная правка не меняет сценарий и не требует нового UX-выбора; сравнение до/после входит в проверку.
Новые разрешения, расчёты и CRM-правила не вводятся.

## Decision evidence
- product: [Принятое требование](/docs/requirements/02-группы.md) — owner: владелец продукта, решение зарегистрировано в REQ; decision: REQ-GRP-007, изменение 05.10.2026: соседство календарной даты и дня недели из выбранной даты.

## Scope
### In
- Только цель и перечисленное покрытие исходной задачи.
### Out
- Изменения backend-правил, несвязанные улучшения и перечисленное в исходной задаче Out of scope.

## Implementation slices
1. В существующий дневной summary добавить соседнюю календарную дату через текущий локальный formatter из того же urlState.date.
2. Сохранить day/week, фильтры и контекст возврата; проверить перенос длинной строки и вертикальный бюджет без новой палитры или структуры.
3. Обновить связанные требования/CHANGELOG и сравнение до/после.

## Likely files and layers
- `frontend/src/features/schedule/GroupScheduleScreen.tsx` — затронутый компонент/ресурс или его существующие тесты.

## Regression specification
### Automated tests to add or update
- Соседние weekday/date синхронно меняются при переходах 31 декабря/1 января и границы месяца, возврате из занятия; нет overflow на mobile, week mode сохранён.
- Расширить существующий `frontend/e2e/group-schedule.spec.ts` по сценарию; вспомогательный сценарный модуль не регистрировать как отдельный spec.
### Expected red evidence
- Проверка daySummary на выбранную календарную дату падает: сейчас summary содержит только weekday.
### Required validation
- В task verification contract включить затронутый исполнимый spec и target-iPhone проекты; для сценарного модуля выбрать вызывающий spec.
### Manual evidence
- Сравнение до/после локальной правки, клавиатура и отдельная проверка доступности затронутого сценария. Непроверенные физический iPhone/Safari явно указать в evidence.
### Regression barrier
- Описанные пользовательские assertions выполняются в затронутом Playwright-сценарии на desktop и target-iPhone.

## Risks and stop conditions
- При необходимости нового поведения или изменения контракта вернуть план в подготовку до зависимых изменений.
- При завершении актуализировать состояние связанных требований и `docs/requirements/CHANGELOG.md`, сохранив не относящиеся к задаче незавершённые части.
