# TASK-177: Довести цели выбора дней недели до 44×44

## Status
done

## Requirements
- REQ-NFR-001 — implements
- REQ-GRP-001 — constrains

## Requirement links
- [REQ-NFR-001](../../../docs/requirements/08-нефункциональные.md) — implements
- [REQ-GRP-001](../../../docs/requirements/02-группы.md) — constrains

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
- [x] Все дни имеют hit area ≥44×44 на mobile/coarse pointer.
- [x] Семь дней, длинные ошибки, selected/disabled и компактная высота не ломают форму.

## Test checklist
- [x] Rendered before/after, bounding boxes и выбор/снятие дней на target-iPhone и desktop.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: low
- Reason: Локальная геометрия существующего контрола без смены workflow.

## Evidence
- [frontend/src/features/groups/GroupForm.tsx](../../../frontend/src/features/groups/GroupForm.tsx)
- [docs/MOBILE_UI_CONTRACT.md](../../../docs/MOBILE_UI_CONTRACT.md)

## Source notes
- Source file: [2026-09-30.md](../../processed/2026-09-30.md)
- Source items: 8 (порядок самостоятельных пунктов, без строк-продолжений).
- Источник наблюдений: UI-аудиты 18.09 и 30.09.2026, стенд c2b6cdf; в этом triage новый runtime-аудит не проводился.

> увеличить тач-таргеты чипов дней недели в форме группы с ~29×20px до 44×44 (мобильная приёмка, единственное нарушение на профиле iPhone 17 Pro Max)

## Processing notes
- Created at: 2026-10-05 (MSK).
- Created by skill: codex-backlog-skill.
- Mode: triage; scope: два файла inbox, без глобальной сверки статусов.
- Duplicate check: TASK-084/161 завершены, но конкретная weekday-группа не подтверждается общей геометрией input recipes.
- Проверены активные карточки, unfinished plans и рекурсивный done; новые ID выделены после TASK-171.

## Status audit 2026-11-21
- tasks-ready: текущий CSS задаёт минимум 44×44 и расширенный label; фактическая touch-область требует runtime-проверки.
- Основание: локальная main, связанные планы и записи согласования; нового runtime-аудита не было.

### Повторная сверка 2026-11-21
- В текущем CSS есть минимум 44×44 и расширенный label; без новой проверки hit area нельзя ни подтверждать дефект, ни закрывать задачу. Сохраняется tasks-ready, готового плана нет.
- Основание: текущая локальная main и сохранённые доказательства; новый runtime-аудит не выполнялся.

### Браузерная проверка 21.11.2026

В production-сборке локальной `main` (`e05c693`) исходный размер около 29×20 CSS px больше не воспроизводится. На `/groups/new` семь дней имеют ширину 63,92–66,97 и высоту 46 CSS px. На WebKit с профилями iPhone Air и iPhone 17 Pro Max касания выбирают и снимают дни, в том числе у границы самого флажка.

Остаётся воспроизводимый пропуск касания в Chromium с сенсорным профилем Pixel 7 (412×839). Открыть создание группы, прокрутить «Пн» к центру экрана и коснуться точки (28, 32) CSS px от верхнего левого угла `.group-weekday-choice .mantine-Checkbox-body`. Событие click получает `.mantine-Checkbox-inner`, флажок остаётся снятым. При касании (42, 23) срабатывает связанная подпись и «Пн» выбирается. Щелчок мышью в Desktop Chromium дал те же результаты. Пропуски около границы флажка обнаружены у всех семи дней в сенсорном Chromium.

На трёх основных профилях прошли существующие браузерные сценарии для семи выбранных дней, малой высоты, длинной ошибки субботы и перехода из редактирования группы в редактор серии. При ожидании ответа на создание все семь флажков блокируются. В форме редактирования те же семь флажков больше не показываются. См. [приёмку TASK-188](../2026-10-23/TASK-188-evidence/validation.md) и [приёмку TASK-189](../2026-10-23/TASK-189-evidence/validation.md).

Статус `tasks-ready`. Оставшаяся работа касается попадания по флажку внутри уже увеличенной цели. При проверке исправления нужно коснуться подтверждённой проблемной точки и проверить состояние соответствующего дня.

## Implementation lifecycle
- moved_to_implementation_at: 2026-11-21 19:05
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/2026-11-21/TASK-177-group-weekday-touch-targets.plan.md
- implementation_branch: fix/TASK-177-group-weekday-hit-area
- execution_started: yes — выполнен [план реализации](TASK-177-group-weekday-touch-targets.plan.md).

## Completion

- completed_at: 2026-11-21
- completion_date_evidence: коммит `ace8c018` вошёл в локальную `main` 21.11.2026. Обе задачи проверены вместе на `db3f22e6`. [Браузерная приёмка и проверки](TASK-177-evidence/acceptance.md).
