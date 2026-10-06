# TASK-182: Показывать календарную дату рядом с днём недели

## Status
tasks-ready

## Requirements
- REQ-GRP-007 — changes
- REQ-NFR-001 — constrains
- REQ-NFR-007 — constrains

## Requirement links
- [REQ-GRP-007](../../docs/requirements/02-группы.md) — changes
- [REQ-NFR-001](../../docs/requirements/08-нефункциональные.md) — constrains
- [REQ-NFR-007](../../docs/requirements/08-нефункциональные.md) — constrains

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
- [ ] День недели и дата видны рядом и обновляются синхронно.
- [ ] Переходы месяца/года и возврат из занятия не создают неоднозначности или overflow.

## Test checklist
- [ ] Rendered before/after, смена дня и границ месяца/года, target-iPhone, day/week и возврат.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: low
- Reason: Уточнение уже отображаемого контекста без изменения календарных правил.

## Evidence
- [frontend/src/features/schedule/GroupScheduleScreen.tsx](../../frontend/src/features/schedule/GroupScheduleScreen.tsx)

## Source notes
- Source file: [2026-09-30.md](../processed/2026-09-30.md)
- Source items: 13 (порядок самостоятельных пунктов, без строк-продолжений).
- Источник наблюдений: UI-аудиты 18.09 и 30.09.2026, стенд c2b6cdf; в этом triage новый runtime-аудит не проводился.

> показывать дату рядом с днём недели в расписании («пятница» без числа теряется при переключении дней)

## Processing notes
- Created at: 2026-10-05 (MSK).
- Created by skill: codex-backlog-skill.
- Mode: triage; scope: два файла inbox, без глобальной сверки статусов.
- Duplicate check: TASK-157 снижала плотность, TASK-167 меняла подпись действия. TASK-175 владеет общей нормализацией дат, здесь независимое соседство даты и weekday.
- Проверены активные карточки, unfinished plans и рекурсивный done; новые ID выделены после TASK-171.
