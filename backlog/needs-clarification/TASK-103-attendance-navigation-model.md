# TASK-103: Устранить неоднозначность навигации «Главная / Посещения / Расписание»

## Status
needs-clarification

## Goal
Пользователь всегда находит отметку посещений по одному стабильному названию и понимает отличие attendance workbench от расписания.

## Context
UX-аудит 2026-08-02 подтвердил, что у Coach корневой экран состоит только из attendance workbench, но активный navigation item называется `Главная`. У менеджерских ролей тот же workbench находится во вкладке `Посещения` внутри `Главная`, а рядом существует отдельный route `Расписание`. Текущая модель появилась после завершённой TASK-059 и требует отдельного продуктового решения, а не локального переименования.

## User role
Coach / Administrator / HeadCoach.

## Problem
Одна пользовательская задача называется по-разному в route, вкладке и навигации. Пользователь может искать отметку посещений в `Расписании`, а deep link, reload или permission redirect могут показывать неочевидный active state.

## Scope
- Выбрать и зафиксировать одну целевую информационную модель:
  - самостоятельный route/navigation item `Посещения`; или
  - последовательная модель `Главная` с явно определённым management inbox и отдельным входом в attendance.
- Определить стартовый route и доступные переходы для Coach, Administrator и HeadCoach.
- Синхронизировать целевые названия route, tab, active navigation, document title и recovery-навигации.
- Описать поведение deep link, reload, back/forward, permission redirect и мобильного overflow `Ещё`.
- После продуктового решения подготовить UX-контракт и implementation-ready UI specification.

## Out of scope
- Реализация до выбора целевой информационной модели.
- Изменение backend-правил attendance, расписания, ролей или access scope.
- Перестройка содержимого attendance workbench; плотность workbench вынесена в TASK-104.

## Constraints
- Backend остаётся source of truth для ролей, permissions и attendance scope.
- Одна пользовательская задача не должна иметь конкурирующие названия в разных точках навигации.
- Primary attendance entry должен оставаться доступным на `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420` и `956 x 440` с учётом safe area.
- Разрешённые role-specific navigation items нельзя вычислять из локально продублированных frontend-правил.

## Acceptance criteria
- [ ] Зафиксирована одна целевая navigation model и причины выбора.
- [ ] Для каждой затронутой роли определены стартовый route, active navigation item и путь к attendance workbench.
- [ ] Вкладка, active nav, document title и recovery-навигация используют одно стабильное название задачи.
- [ ] Coach попадает непосредственно в однозначно названный attendance workbench.
- [ ] Deep link, reload, back/forward и permission redirect сохраняют корректный route и active state.
- [ ] `Расписание` остаётся семантически отличимо от отметки посещений.

## Test checklist
- [ ] Добавить или обновить route/component tests для каждой затронутой роли.
- [ ] Добавить Playwright-сценарии deep link, reload, back/forward и permission redirect.
- [ ] Проверить авторизованный mobile overflow `Ещё` и `aria-current`.
- [ ] Проверить доступный `h1`, document title и named main landmark.

## AI safety
- Safe for Codex: no
- Risk level: medium
- Reason: продуктовая информационная модель и роль-зависимая навигация не выбраны; самостоятельная реализация заставит Codex придумать требования и может нарушить permission recovery.

## Clarification questions
- [ ] Какая целевая модель выбрана: самостоятельный route `Посещения` или `Главная` с management inbox и отдельным attendance entry?
- [ ] Какой стартовый экран должен открываться у Administrator и HeadCoach?
- [ ] Должна ли `Главная` оставаться видимой у Coach, если её единственное содержимое — attendance workbench?
- [ ] Какие названия должны использоваться в desktop sidebar, mobile bottom navigation и overflow `Ещё`?

## Source notes
- Source file: `backlog/processed/2026-08-02.md`
- Original note: `UX-2026-08-02-01 — устранить неоднозначность Главная / Посещения / Расписание`.

## Processing notes
- Created at: 2026-08-02 14:44
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- Duplicate check: активного дубликата нет; завершённая TASK-059 создала текущую объединённую модель и является baseline, а TASK-088 задаёт permission redirect contract.
- Grouping: навигационная продуктовая развилка отделена от локальной компоновки attendance workbench в TASK-104.
