# TASK-142: Расширить матрицу контраста дизайн-системы

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-29 17:21
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/TASK-142-theme-contrast-matrix.plan.md
- implementation_branch: feature/TASK-142-theme-contrast-matrix
- integrated_to_main_at: 2026-08-29
- candidate_commit: 5a25ca50f76a3d1a27518ce7b44674cc9db60b55

## Requirements
- REQ-NFR-001 — verifies

## Goal
Каждый зарегистрированный theme profile проходит автоматическую WCAG-проверку
всех значимых foreground/background и interactive-state комбинаций до выпуска.

## Context
Текущий `frontend/src/theme/registry.test.ts` проверяет основной и вторичный
текст на page/card surfaces и focus ring, но не проверяет filled buttons,
badges, alerts, selected navigation и hover/active/disabled. Аудит по
designsystemchecklist.com обнаружил, что primary `#2f7df1` тестовой темы имеет
контраст около `3.94:1` с белым текстом и требует проверки фактического
resolved foreground Mantine-компонента.

## User role
Все пользователи CRM; команда, регистрирующая deployment themes.

## Problem
Профиль может пройти текущие тесты, но создать недоступную кнопку или статусный
компонент. Ошибка обнаружится только после визуального просмотра deployment.

## Scope
- Зафиксировать обязательные пары для buttons, badges, alerts, navigation,
  links, focus и configurable accents.
- Проверять default, hover, active, disabled и selected states.
- Проверять resolved foreground, а не предполагать белый или тёмный текст.
- Исправить только доказанные нарушения текущих profiles.

## Out of scope
- Dark mode.
- Изменение CRM workflow, typography, spacing или status meaning.
- Произвольные runtime colors из `/api/config`.

## Constraints
- Сохранить Mantine, Onest и versioned profile registry.
- Functional status meaning остаётся инвариантным между deployments.
- Тесты должны выдавать profile, component/state и фактический ratio.

## Acceptance criteria
- [ ] Все normal-text пары имеют контраст не ниже `4.5:1`.
- [ ] Large text, focus indicators и UI boundaries имеют контраст не ниже `3:1`.
- [ ] Filled primary/destructive buttons проверяются с фактическим foreground.
- [ ] Badge, Alert, selected navigation и accent pairs входят в matrix.
- [ ] Новый profile невозможно зарегистрировать без прохождения matrix.
- [ ] Обе текущие themes проходят тесты после минимально необходимых исправлений.

## Test checklist
- [ ] Добавить focused unit tests theme contrast matrix.
- [ ] Добавить component/render checks там, где foreground выбирает Mantine.
- [ ] Запустить root verification harness для frontend change.
- [ ] Визуально сравнить обе темы на mobile и desktop reference states.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: medium
- Reason: задача локализована в theme validation, но может потребовать видимого изменения palette при доказанном нарушении.

## Clarification questions
Не требуется. Пороговые значения уже закреплены текущим UI-контрактом.

## Source notes
- Source: direct conversation on 2026-08-29 after Design System Checklist audit.
- Original finding: contrast coverage does not include interactive/component states.
- Related completed foundation: `/backlog/done/TASK-090-shared-mobile-ui-system.md`.

## Processing notes
- Created at: 2026-08-29 16:45 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: TASK-090 introduced baseline contrast tests but does not own this missing component-state matrix follow-up.
