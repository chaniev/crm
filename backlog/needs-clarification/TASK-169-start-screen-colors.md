# TASK-169: Уточнить цветовую схему стартового экрана

## Status
needs-clarification

## Requirements
- pending — нужно определить целевой экран, semantic color roles и границу с runtime customer branding TASK-155

## Goal
Зафиксировать, какой экран и какие цветовые роли должны быть приведены к
дизайн-системе, чтобы последующая реализация не конфликтовала с customer
branding и semantic functional colors.

## Context
Inbox требует унифицировать «цветовую гамму на стартовом экране» с дизайн-
системой. В продукте возможны как unauthenticated auth screen, так и разные
role-specific landing sections (`/attendance` и `/attention`). Активная TASK-155
уже владеет runtime customer branding и primary auth action, а завершённые
TASK-142/TASK-147 закрепили contrast/theme contracts.

## User role
Неизвестно; зависит от целевого экрана.

## Problem
Без идентификации экрана, проблемных элементов и ожидаемых semantic roles
Codex должен угадать визуальную цель либо создать дубликат TASK-155.

## Scope
- Уточнить точный route/surface и приложить current-state evidence.
- Уточнить проблемные цвета и ожидаемые semantic design-system roles.
- Решить, является ли изменение bundled theme cleanup или частью runtime
  customer branding TASK-155.
- После решений перевести задачу в `tasks-ready`, объединить source note с
  TASK-155 или закрыть как duplicate.

## Out of scope
- Реализация цветовых изменений до ответов.
- Изменение functional status meanings, permissions, typography или layout.
- Введение произвольного customer CSS или отдельной темы в обход TASK-155.

## Constraints
- Functional colors не переопределяются декоративной палитрой.
- Contrast и focus visibility сохраняют принятый TASK-142 contract.
- Если речь об auth customer colors, ownership не дублирует TASK-155.

## Acceptance criteria
- [ ] Точный экран и route однозначно определены.
- [ ] Перечислены элементы и semantic tokens, которые должны измениться.
- [ ] Зафиксирована граница bundled design system и runtime customer branding.
- [ ] Есть current/proposed visual evidence или проверяемое текстовое описание.
- [ ] После уточнения определены requirement links и безопасный implementation scope.

## Test checklist
- [ ] После уточнения определить contrast, component и visual regression matrix.
- [ ] Проверить light theme, supported customer profile и fallback только в утверждённом scope.

## AI safety
- Safe for autonomous implementation: no
- Risk level: medium
- Reason: неоднозначный экран и возможное пересечение с runtime branding могут привести к конфликтующим theme contracts.

## Clarification questions
- [ ] Под «стартовым экраном» имеется в виду экран авторизации, `/attendance`, `/attention` или другой route?
- [ ] Какие конкретно элементы сейчас выбиваются из дизайн-системы и чем?
- [ ] Нужна bundled палитра для всех клиентов или customer-specific colors из TASK-155?
- [ ] Есть ли скриншот/макет целевого состояния либо достаточно применить существующие semantic tokens без изменения layout?

## Source notes
- Source file: `backlog/processed/2026-08-30.md`
- Original note: `цветовую гамму на стартовом экране надо унифицировать с дизайн системой`

## Processing notes
- Created at: 2026-08-30 18:11 MSK
- Created by skill: codex-backlog-skill
- Duplicate check: possible overlap with active TASK-155 and completed TASK-142/TASK-147; exact target is unclear, so a separate clarification card is required by the skill instead of an assumed merge.
- Classification: needs-clarification because the target screen, affected roles and expected palette are not identifiable from the note.
