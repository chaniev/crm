# TASK-106: Сделать параллельные занятия читаемыми в desktop schedule

## Status
ready

## Goal
Пользователь определяет время, группу и зал/тренера каждого параллельного занятия без угадывания по обрезанным подписям.

## Context
На `1440 x 1200` у страницы нет horizontal overflow, но карточки нескольких одновременных занятий сжимаются настолько, что ключевые подписи превращаются в `08:…` и `Б…`. Текущий calendar-like view был введён TASK-043; новая задача является follow-up по реальному сценарию высокой плотности.

## User role
Coach / Administrator / HeadCoach.

## Problem
Формальное отсутствие page overflow маскирует потерю decision-data внутри карточек. Пользователь не может быстро различить конфликтующие или параллельные события.

## Scope
- Спроектировать представление параллельных занятий без бесконечного сжатия текста: stacking, grouped summary или очевидный drill-down.
- Сохранить видимыми либо доступными одним очевидным действием start/end, группу и зал/тренера каждого события.
- Добавить доступное имя, keyboard path и focus behavior для summary/drill-down, если он используется.
- Обработать длинные названия, максимальную ожидаемую параллельность и empty/loading/error states.
- Обновить desktop component и Playwright regression coverage.

## Out of scope
- Изменение schedule conflict logic, правил создания/редактирования занятий или backend API.
- Автоматическое разрешение конфликтов.
- Перестройка уже работающего mobile day timeline без подтверждённой необходимости.

## Constraints
- Backend остаётся source of truth для schedule data, permissions и conflict semantics.
- Представление не должно скрывать существование события или создавать ложное впечатление об отсутствии конфликта.
- Нельзя добавлять page-level horizontal scroll или nested-scroll trap.
- Полная информация и действие открытия должны быть доступны с клавиатуры и screen reader.

## Acceptance criteria
- [ ] На `1440 x 1200` для каждого видимого параллельного занятия можно определить start/end, группу и зал/тренера либо открыть эти данные одним очевидным действием.
- [ ] Ни одно событие не представлено только неразличимым обрезанным фрагментом.
- [ ] Summary/drill-down, если используется, имеет accessible name, visible focus, Escape/close и предсказуемый focus return.
- [ ] Длинные названия и максимальная тестовая параллельность не создают page-level horizontal scroll.
- [ ] Mobile day timeline сохраняет существующий task-first порядок и не получает горизонтальную desktop-таблицу.
- [ ] Loading, empty, error и stale/retry состояния сохраняют временной контекст.

## Test checklist
- [ ] Добавить component fixture с несколькими событиями в одном временном интервале.
- [ ] Добавить Playwright assertion на полные decision-data или очевидный disclosure при `1440 x 1200`.
- [ ] Проверить keyboard path, accessible names, Escape и focus return.
- [ ] Проверить длинные группу/тренера/зал и отсутствие horizontal page overflow.
- [ ] Выполнить mobile smoke, чтобы desktop correction не сломала day timeline.

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: задача меняет только представление уже разрешённых schedule records и явно исключает conflict/domain logic.

## Clarification questions
Не требуется: обязательные decision-data и измеримый результат заданы; конкретный паттерн stacking/summary/drill-down выбирается в UI-design handoff.

## Source notes
- Source file: `backlog/processed/2026-08-02.md`
- Original note: `UX-2026-08-02-05 — сделать desktop schedule читаемым при параллельных занятиях`.
- Evidence: `backlog/processed/assets/2026-08-02-usability-audit/desktop-schedule-1440x1200.png`.

## Processing notes
- Created at: 2026-08-02 14:44
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- Duplicate check: активного дубликата нет; завершённая TASK-043 является calendar-view baseline, но не закрывает high-density readability.
- Safety boundary: любые обнаруженные изменения schedule conflict semantics должны быть вынесены в отдельную risky задачу.
