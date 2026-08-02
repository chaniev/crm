# TASK-104: Поднять первое действие attendance workbench выше сгиба

## Status
ready

## Goal
Тренер видит первую строку клиента и может поставить статус посещения без предварительного скролла, при этом группа, дата и прогресс остаются понятными на portrait и compact landscape.

## Context
На `390 x 844` выбор группы и даты занимает около `227px`, затем context card повторяет уже выбранные название и дату, поэтому первая строка клиента и status action уходят под fixed bottom navigation. На `912 x 420` date input сжимается до пустого квадрата и скрывает обязательные decision-data.

## User role
Coach / Administrator / HeadCoach с backend-разрешённым attendance scope.

## Problem
Повтор контекста и неустойчивая responsive-сетка задерживают основное действие в portrait и делают выбранную дату нечитаемой в compact landscape.

## Scope
- Объединить group selector, date controls и progress/completion signal в компактный workbench header.
- Удалить визуальное повторение выбранных группы и даты, не удаляя их доступные имена.
- Сохранить только decision-changing warnings рядом с затронутым клиентом.
- Задать responsive grid с полезной минимальной шириной date input и приоритетом даты перед вторичными controls.
- Сохранить row-local pending, error и retry states для отметки посещения.
- Обновить component и Playwright regression coverage для portrait и compact landscape.

## Out of scope
- Изменение navigation model из TASK-103.
- Изменение attendance semantics, разрешённых статусов, membership validation или access scope.
- Изменение backend API и расписания занятий.

## Constraints
- Backend владеет attendance, memberships, permissions и validation semantics.
- Fixed bottom navigation, Safari chrome, software keyboard и safe area не должны закрывать первую доступную строку или feedback.
- Prev/today/next и status actions должны иметь hit area не меньше `44 x 44px`.
- Date control сохраняет persistent accessible name и полное значение независимо от видимого формата.
- На странице не должно появиться horizontal overflow или nested-scroll trap.

## Acceptance criteria
- [ ] На `390 x 844` первая строка клиента и хотя бы один status action видны над bottom navigation без скролла.
- [ ] Group/date остаются видимыми, понятными и доступными; progress сохраняет completion signal.
- [ ] На `912 x 420` и `956 x 440` дата `ДД.ММ.ГГГГ` полностью читается.
- [ ] Prev/today/next имеют зоны не меньше `44 x 44px`, не перекрываются и не вытесняют значение даты.
- [ ] Per-row pending/error/retry остаются внутри строки и не заменяются toast-only feedback.
- [ ] На `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420` и `956 x 440` нет horizontal overflow.
- [ ] Loading, empty, error, success и stale/retry состояния не скрывают выбранный контекст и primary action.

## Test checklist
- [ ] Добавить component tests для compact header, row-local error/retry и доступного date label.
- [ ] Добавить geometry/behavior assertions на `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420` и `956 x 440`.
- [ ] Проверить long group/client names и large progress values.
- [ ] Проверить keyboard/focus order и screen-reader name для даты и icon-only controls.
- [ ] Проверить dynamic viewport, software keyboard и safe-area clearance вручную на доступном устройстве или явно оставить residual device risk.

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: задача ограничена frontend-компоновкой существующего attendance flow; доменные статусы, permissions и backend contracts не меняются.

## Clarification questions
Не требуется: целевой порядок данных, размеры и responsive acceptance заданы; конкретный layout выбирается в обязательном UI-design handoff.

## Source notes
- Source file: `backlog/processed/2026-08-02.md`
- Original note: `UX-2026-08-02-02 — поднять первое действие attendance выше сгиба`; `UX-2026-08-02-03 — исправить date control в compact landscape`.
- Evidence: `backlog/processed/assets/2026-08-02-usability-audit/annotated-attendance-390x844.png`; `backlog/processed/assets/2026-08-02-usability-audit/annotated-attendance-landscape-912x420.png`.

## Processing notes
- Created at: 2026-08-02 14:44
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- Duplicate check: активного дубликата нет; завершённые TASK-064 и TASK-066 меняли attendance workflow, но не закрывают обнаруженную above-fold и compact-landscape регрессию.
- Grouping: portrait density и landscape date collapse объединены, потому что обе проблемы принадлежат одному responsive header и одному primary attendance path.
