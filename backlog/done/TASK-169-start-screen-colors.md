# TASK-169: Уточнить цветовую схему стартового экрана

## Status
done

## Requirements
- REQ-NFR-005 — clarifies; implementation remains owned by TASK-155

## Completion
- clarified_at: 2026-08-30
- resolution: merged into `/backlog/risky/TASK-155-runtime-customer-branding.md`
- implementation: not performed by this clarification task

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
Все неаутентифицированные пользователи экрана авторизации.

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
- [x] Целевая surface однозначно определена как экран авторизации.
- [x] Проблемный элемент — кнопка входа; весь экран должен
  использовать semantic color roles дизайн-системы.
- [x] Auth background и primary action определяются customer-specific
  branding; functional colors, layout и typography не меняются.
- [x] Проверяемое текстовое описание зафиксировано в REQ-NFR-005 и
  TASK-155; макет для решения о color-role ownership не требуется.
- [x] Requirement link и implementation scope определены; реализацией
  владеет risky TASK-155.

## Test checklist
- [ ] После уточнения определить contrast, component и visual regression matrix.
- [ ] Проверить light theme, supported customer profile и fallback только в утверждённом scope.

## AI safety
- Safe for autonomous implementation: no
- Risk level: medium
- Reason: неоднозначный экран и возможное пересечение с runtime branding могут привести к конфликтующим theme contracts.

## Clarification questions
Все блокирующие вопросы закрыты решениями product owner от
2026-08-30; детали implementation ведёт TASK-155.

## Source notes
- Source file: `backlog/processed/2026-08-30.md`
- Original note: `цветовую гамму на стартовом экране надо унифицировать с дизайн системой`

## Processing notes
- Created at: 2026-08-30 18:11 MSK
- Created by skill: codex-backlog-skill
- Duplicate check: possible overlap with active TASK-155 and completed TASK-142/TASK-147; exact target is unclear, so a separate clarification card is required by the skill instead of an assumed merge.
- Classification: needs-clarification because the target screen, affected roles and expected palette are not identifiable from the note.
- Resolved at: 2026-08-30 from direct product-owner answers: auth screen;
  login button is the observed problem; every screen color must follow the design
  system; auth background and primary action are customer-specific.
- Resolution: clarification goal completed and merged into TASK-155, which
  already owns the accepted REQ-NFR-005 runtime/customer-branding behavior.
