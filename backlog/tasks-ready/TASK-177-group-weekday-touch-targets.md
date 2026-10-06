# TASK-177: Довести цели выбора дней недели до 44×44

## Status
tasks-ready

## Requirements
- REQ-NFR-001 — implements
- REQ-GRP-001 — constrains

## Requirement links
- [REQ-NFR-001](../../docs/requirements/08-нефункциональные.md) — implements
- [REQ-GRP-001](../../docs/requirements/02-группы.md) — constrains

## Goal
Дни недели в форме группы удобно выбирать на touch-экране.

## Context
Аудит iPhone 17 Pro Max сообщает около 29×20px; это ниже существующего mobile-контракта. GroupForm передаёт выбранные weekdays отдельному контролу.

## Scope
- Проверить реальную активную область каждого дня в create/edit группы.
- Обеспечить минимум 44×44 CSS px с различимыми состояниями и без горизонтального overflow; бизнес-смысл weekdays не менять.

## Constraints
- Backend сохраняет владение CRM-правилами; triage не разрешает реализацию.
- Перед реализацией нужен ready plan по docs/HARNESS.md; для визуальных изменений — применимый design gate.
- При завершении обновить состояние связанных требований и docs/requirements/CHANGELOG.md.

## Acceptance criteria
- [ ] Все дни имеют hit area ≥44×44 на mobile/coarse pointer.
- [ ] Семь дней, длинные ошибки, selected/disabled и компактная высота не ломают форму.

## Test checklist
- [ ] Rendered before/after, bounding boxes и выбор/снятие дней на target-iPhone и desktop.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: low
- Reason: Локальная геометрия существующего контрола без смены workflow.

## Evidence
- [frontend/src/features/groups/GroupForm.tsx](../../frontend/src/features/groups/GroupForm.tsx)
- [docs/MOBILE_UI_CONTRACT.md](../../docs/MOBILE_UI_CONTRACT.md)

## Source notes
- Source file: [2026-09-30.md](../processed/2026-09-30.md)
- Source items: 8 (порядок самостоятельных пунктов, без строк-продолжений).
- Источник наблюдений: UI-аудиты 18.09 и 30.09.2026, стенд c2b6cdf; в этом triage новый runtime-аудит не проводился.

> увеличить тач-таргеты чипов дней недели в форме группы с ~29×20px до 44×44 (мобильная приёмка, единственное нарушение на профиле iPhone 17 Pro Max)

## Processing notes
- Created at: 2026-10-05 (MSK).
- Created by skill: codex-backlog-skill.
- Mode: triage; scope: два файла inbox, без глобальной сверки статусов.
- Duplicate check: TASK-084/161 завершены, но конкретная weekday-группа не подтверждается общей геометрией input recipes.
- Проверены активные карточки, unfinished plans и рекурсивный done; новые ID выделены после TASK-171.
