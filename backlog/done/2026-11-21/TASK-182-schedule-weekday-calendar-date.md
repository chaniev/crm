# TASK-182: Показывать календарную дату рядом с днём недели

## Status
done

## Requirements
- REQ-GRP-007 — changes
- REQ-NFR-001 — constrains
- REQ-NFR-007 — constrains

## Requirement links
- [REQ-GRP-007](../../../docs/requirements/02-группы.md) — changes
- [REQ-NFR-001](../../../docs/requirements/08-нефункциональные.md) — constrains
- [REQ-NFR-007](../../../docs/requirements/08-нефункциональные.md) — constrains

## Goal
После переключения дня понятно, к какому числу относится список занятий.

## Context
daySummary в GroupScheduleScreen отображает formatLongWeekday(urlState.date) без числа; toolbar отдельно получает дату. Источник требует именно соседство даты и дня недели.

## Scope
- В дневном summary показывать день недели и календарную дату из одного urlState.date.
- Сохранить day/week navigation, фильтры, возврат и вертикальный бюджет; использовать текущий локальный date formatter до отдельного решения TASK-175.

## Constraints
- Backend сохраняет владение CRM-правилами; triage не разрешает реализацию.
- Перед реализацией нужен ready plan по docs/HARNESS.md; для визуальных изменений — применимый design gate.
- При завершении обновить состояние связанных требований и docs/requirements/CHANGELOG.md.

## Acceptance criteria
- [x] День недели и дата видны рядом и обновляются синхронно.
- [x] Переходы месяца/года и возврат из занятия не создают неоднозначности или overflow.

## Test checklist
- [x] Rendered before/after, смена дня и границ месяца/года, target-iPhone, day/week и возврат.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: low
- Reason: Уточнение уже отображаемого контекста без изменения календарных правил.

## Evidence
- [frontend/src/features/schedule/GroupScheduleScreen.tsx](../../../frontend/src/features/schedule/GroupScheduleScreen.tsx)

## Source notes
- Source file: [2026-09-30.md](../../processed/2026-09-30.md)
- Source items: 13 (порядок самостоятельных пунктов, без строк-продолжений).
- Источник наблюдений: UI-аудиты 18.09 и 30.09.2026, стенд c2b6cdf; в этом triage новый runtime-аудит не проводился.

> показывать дату рядом с днём недели в расписании («пятница» без числа теряется при переключении дней)

### Дополнение из аудита 20.11.2026

- Source file: [03-schedule](../../processed/2026-11-20-interface-audit/03-schedule/README.md)
- SCH-03: дата и день недели разнесены, календарный контекст требует отдельного чтения.

## Processing notes
- Created at: 2026-10-05 (MSK).
- Created by skill: codex-backlog-skill.
- Mode: triage; scope: два файла inbox, без глобальной сверки статусов.
- Duplicate check: TASK-157 снижала плотность, TASK-167 меняла подпись действия. TASK-175 владеет общей нормализацией дат, здесь независимое соседство даты и weekday.
- Проверены активные карточки, unfinished plans и рекурсивный done; новые ID выделены после TASK-171.

- Updated at: 2026-11-20 19:43 (Europe/Moscow); mode: triage, аудит интерфейса 20.11.2026.
- Новый источник добавлен без дублирующей карточки. Для расписания сохранён проверенный mobile-снимок; desktop-снимок из исходного аудита был исключён как некорректный.

## Planning review 2026-11-20
- Актуальность: GroupScheduleScreen daySummary выводит только formatLongWeekday(urlState.date), хотя выбранная дата доступна в том же состоянии.
- Проверка: статический анализ текущего main и сохранённого аудита; новая runtime-приёмка не выполнялась.
- readiness: yes

## Implementation lifecycle
- moved_to_implementation_at: 2026-11-20
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/2026-11-21/TASK-182-schedule-weekday-calendar-date.plan.md
- implementation_branch: codex/TASK-182-schedule-weekday-calendar-date

## Completion
- completed_at: 2026-11-21
- completion_date_evidence: интеграция проверенной версии `053c5a8` в локальную main 2026-11-21.
- [Приёмка и ограничения проверки](TASK-182-evidence/acceptance.md)
