# TASK-106: Сделать параллельные занятия читаемыми в desktop schedule

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-02 15:57
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/2026-08-23/TASK-106-parallel-schedule-readability.plan.md
- implementation_branch: fix/TASK-106-parallel-schedule-readability
- implementation_state: completed
- implementation_commit: 4933696
- delivered_on_main_at: 2026-08-23
- moved_to_done_at: 2026-08-23
- last_status_reviewed_at: 2026-08-23

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
- [x] На `1440 x 1200` для каждого видимого параллельного занятия можно определить start/end, группу и зал/тренера либо открыть эти данные одним очевидным действием.
- [x] Ни одно событие не представлено только неразличимым обрезанным фрагментом.
- [x] Summary/drill-down, если используется, имеет accessible name, visible focus, Escape/close и предсказуемый focus return.
- [x] Длинные названия и максимальная тестовая параллельность не создают page-level horizontal scroll.
- [x] Mobile day timeline сохраняет существующий task-first порядок и не получает горизонтальную desktop-таблицу.
- [x] Loading, empty, error и stale/retry состояния сохраняют временной контекст.

## Test checklist
- [x] Добавить component fixture с несколькими событиями в одном временном интервале.
- [x] Добавить Playwright assertion на полные decision-data или очевидный disclosure при `1440 x 1200`.
- [x] Проверить keyboard path, accessible names, Escape и focus return.
- [x] Проверить длинные группу/тренера/зал и отсутствие horizontal page overflow.
- [x] Выполнить mobile smoke, чтобы desktop correction не сломала day timeline.

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

## Completion record
- Completed on: 2026-08-23.
- Implementation commit: `4933696`; fast-forward integrated into local `main`.
- Validation: frontend lint, typecheck, raw-color scan, production build and 478 unit tests passed; 69 affected Chromium Playwright tests and 40 target-iPhone touch/WebKit tests passed.
- Backend/API/database contracts were not changed; migration and runtime deployment were not required.
- No Docker Compose task stack was created because validation used component tests and mocked browser scenarios.
- Residual device risk: actual browser 200% zoom, physical Safari chrome, software keyboard, safe-area behavior, iOS Simulator and physical-device touch were not verified; the repeatable 720 CSS px equivalent and target-iPhone WebKit portrait/compact-landscape profiles passed.
