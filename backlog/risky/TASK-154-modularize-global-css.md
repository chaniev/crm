# TASK-154: Разделить монолитный frontend App.css по ownership

## Status
risky

## Requirements
- none — behavior-preserving stylesheet decomposition only

## Goal
Global foundations, shell, shared components and feature styles have explicit
ownership without changing current computed styles or responsive behavior.

## Context
At the August 2026 baseline, `frontend/src/App.css` had approximately 5,673 lines and hundreds of
selectors. It mixes auth, shell, shared primitives, feature screens and
responsive overrides, increasing cascade and regression risk.

## User role
Frontend developers and all CRM users affected by global style changes.

## Problem
Local changes require reasoning about a large shared cascade and can alter
unrelated screens or theme states without an obvious ownership boundary.

## Scope
- Map selector ownership and cascade dependencies before moving rules.
- Separate foundations, shell/navigation, shared components and feature-owned styles.
- Remove only proven dead selectors after independent evidence.
- Keep explicit load order and cross-layer exceptions documented.
- Use TASK-153 visual baseline as a merge barrier.

## Out of scope
- Redesign, token value changes or component API changes.
- CSS Modules/Tailwind migration unless separately approved.
- Combining unrelated feature cleanup with file movement.

## Constraints
- Requires `refactoring-specialist` review and an isolated task worktree.
- No computed-style or DOM behavior change is authorized.
- Existing raw-color, responsive, accessibility and theme checks cannot be weakened.
- Stop if selector ownership or active-task overlap is ambiguous.

## Acceptance criteria
- [ ] Selector ownership and cascade dependency map exists before edits.
- [ ] Global file retains only truly global foundations and ordered imports.
- [ ] Shared and feature styles move to explicit maintained locations.
- [ ] Representative computed styles match the pre-change baseline.
- [ ] Both themes and required responsive states pass visual regression.
- [ ] No unrelated product or component refactor is included.

## Test checklist
- [ ] Add characterization evidence before moving the first selector group.
- [ ] Run raw-color/static checks after each migration slice.
- [ ] Run affected component/Playwright tests and TASK-153 visual gate.
- [ ] Run full root frontend harness validation after integration.

## AI safety
- Safe for autonomous implementation: no
- Risk level: high
- Reason: broad cascade-sensitive refactor can affect every frontend screen despite being behavior-preserving by intent.

## Clarification questions
Не требуется at product level; ambiguous cascade ownership is an implementation stop condition.

## Source notes
- Source: direct conversation on 2026-08-29 after Design System Checklist audit.
- Original finding: monolithic global stylesheet raises design-system maintenance cost.
- Dependency: TASK-153.

## Processing notes
- Created at: 2026-08-29 16:45 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: TASK-121 covers oversized cross-layer source files but does not include global CSS ownership; no active stylesheet-decomposition task exists.
- Classification: risky because cascade-wide changes require explicit refactoring and visual review gates.

## Сверка 21.11.2026

На `main` `22fdcd3d` в [App.css](../../frontend/src/App.css) 6 461 строка и 57 директив `@media` в начале строки. Для вкладок, редакторов и абонементов TASK-019/021 уже используют локальные таблицы стилей. В глобальном файле по-прежнему соседствуют стили рабочих экранов и адаптивные переопределения. Со времени прошлой сверки в нём скорректирован отступ панели при появлении экранной клавиатуры. [Стили вкладок](../../frontend/src/features/clients/ClientDetailTabs.css) · [Редакторы](../../frontend/src/features/clients/ClientEditors.css) · [Абонементы](../../frontend/src/features/clients/membership/ClientMembershipSection.css)

[Визуальные проверки TASK-153](../../frontend/e2e/catalog/design-system-visual.spec.ts) дают эталоны каталога. Для переноса существующих глобальных правил ещё нужны карта порядка правил и исходные вычисленные стили затронутого рабочего экрана.

Оставить `risky` как отдельную техническую задачу. Для определения приоритета нужен конкретный участок, где общий каскад мешает сопровождению. Перемещение одного блока может изменить, какое правило применяется на малой высоте или другой ширине. До переноса зафиксировать зависимости и результат в обеих темах, после сравнить вычисленные стили на тех же элементах и размерах. Расхождение требует остановить перенос блока. Продуктовый выбор для такого переноса не требуется. [Основание для приоритизации](../../docs/PRODUCT_OWNER_ANALYSIS_2026-09-05.md)
