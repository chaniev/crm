# TASK-103: Выделить «Посещения» в самостоятельный раздел

## Status
risky

## Goal
Пользователь открывает отметку посещений через самостоятельный раздел
`Посещения`, видит одно стабильное название задачи во всех navigation и
recovery surfaces и не смешивает attendance workbench с расписанием.

## Context
UX-аудит 2026-08-02 подтвердил, что у Coach корневой экран состоит только из
attendance workbench, но активный navigation item называется `Главная`. У
менеджерских ролей тот же workbench находится во вкладке `Посещения` внутри
`Главная`, а рядом существует отдельный route `Расписание`. Текущая модель
появилась после завершённой TASK-059.

2026-08-19 продукт подтвердил самостоятельный top-level раздел `Посещения`,
отдельную management inbox `Главная`, role-specific landing routes и включение
SuperAdministrator в целевую модель.

## User role
Coach / Administrator / HeadCoach / SuperAdministrator.

## Product decisions
- `Посещения` — самостоятельный backend-authorized `AppSection`, navigation
  item и canonical route `/attendance`, а не вкладка внутри `Главная`.
- Название `Посещения` одинаково используется в desktop sidebar, mobile bottom
  navigation, overflow `Ещё`, доступном `h1`, named main landmark, document
  title, client-return action и permission recovery.
- `Главная` остаётся отдельным management inbox `Требуют внимания` для
  Administrator, HeadCoach и SuperAdministrator; attendance workbench и вкладка
  `Посещения` удаляются из `Главная`.
- Coach не видит `Главная`, потому что у этой роли нет отдельной management
  задачи на данном экране.
- Coach и Administrator после входа стартуют на `/attendance` с active nav
  `Посещения`.
- HeadCoach и SuperAdministrator после входа стартуют на `/` с active nav
  `Главная`; самостоятельный раздел `Посещения` остаётся доступен одним прямым
  navigation action.
- На mobile `Посещения` всегда входит в primary bottom navigation для
  авторизованного пользователя и не прячется в `Ещё`. Остальные доступные
  разделы используют существующую adaptive fourth-slot/overflow модель.
- `/` остаётся canonical route management inbox. Direct restricted `/` для
  Coach использует явный recovery contract TASK-088 с переходом в
  `Посещения`, а не silent redirect.
- `Расписание` остаётся самостоятельным `/schedule`: оно показывает
  запланированные занятия, но не служит входом в отметку факта посещения.

## Problem
Одна пользовательская задача называется по-разному в route, вкладке и навигации. Пользователь может искать отметку посещений в `Расписании`, а deep link, reload или permission redirect могут показывать неочевидный active state.

## Scope
- Добавить backend section `Attendance` и синхронно обновить session/access-scope
  contract (`AppSection`, `allowedSections`, `landingScreen`) по утверждённой
  role matrix без изменения attendance permission semantics.
- Добавить canonical route `/attendance` и самостоятельный navigation item
  `Посещения`; удалить attendance tab/workbench из `Главная`.
- Оставить на `Главная` management inbox `Требуют внимания` для управляющих
  ролей и исключить `Главная` из разрешённых sections Coach.
- Синхронизировать route label, active navigation, доступный `h1`, named main
  landmark, document title, client-return action и recovery-навигацию.
- Обновить attendance client-profile return context так, чтобы возврат вёл на
  `/attendance` и восстанавливал выбранные группу, дату, roster view и anchor.
- Описать поведение deep link, reload, back/forward, permission redirect и мобильного overflow `Ещё`.
- Зафиксировать implementation-ready responsive specification для desktop,
  `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420` и `956 x 440` на основе
  утверждённого UX/UI handoff.

## Out of scope
- Изменение backend-правил attendance, расписания, ролей, permission semantics
  или attendance scope; меняется только section/landing representation
  существующего разрешённого сценария.
- Перестройка содержимого attendance workbench; плотность workbench вынесена в TASK-104.
- Расширение management inbox новыми виджетами или операциями.
- Переименование или переработка содержимого `Расписание`.

## Constraints
- Backend остаётся source of truth для ролей, permissions и attendance scope.
- Backend session contract остаётся единственным source of truth для
  `allowedSections` и `landingScreen`; frontend не выводит доступность section
  из role strings.
- Одна пользовательская задача не должна иметь конкурирующие названия в разных точках навигации.
- Primary attendance entry должен оставаться доступным на `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420` и `956 x 440` с учётом safe area.
- Разрешённые role-specific navigation items нельзя вычислять из локально продублированных frontend-правил.
- Typed `allowed | restricted | not-found` и явный recovery feedback из
  TASK-088 сохраняются; direct denied route не превращается в silent redirect.
- Существующее содержимое и operational states attendance workbench из
  TASK-104 сохраняются без редизайна.

## Acceptance criteria
- [ ] Backend возвращает самостоятельный section `Attendance` и утверждённые
      `allowedSections`/`landingScreen` для всех четырёх ролей.
- [ ] Coach и Administrator после входа открывают `/attendance`; active nav,
      доступный `h1`, main landmark и document title называют раздел
      `Посещения`.
- [ ] HeadCoach и SuperAdministrator после входа открывают `/`, видят
      management inbox `Главная` и переходят в `Посещения` одним прямым
      navigation action.
- [ ] Coach не видит и не получает в `allowedSections` section `Home`.
- [ ] `Главная` управляющих ролей больше не содержит attendance tab/workbench и
      сохраняет management inbox `Требуют внимания`.
- [ ] Route label, desktop nav, mobile nav, overflow, document title,
      client-return action и recovery-навигация используют стабильное название
      `Посещения`.
- [ ] `/attendance` является canonical deep link и корректно сохраняет active
      state при reload и back/forward.
- [ ] Возврат из карточки клиента восстанавливает attendance context на
      `/attendance`, а не открывает `Главная`.
- [ ] Direct `/` для Coach показывает явное ограничение с recovery action в
      `Посещения`; permission/access change не создаёт silent redirect или loop.
- [ ] На mobile `Посещения` остаётся primary bottom-navigation item, а active
      overflow destination, `Ещё` и `aria-current` следуют adaptive navigation
      contract на всех целевых размерах.
- [ ] Deep link, reload, back/forward и permission redirect сохраняют корректный route и active state.
- [ ] `Расписание` остаётся семантически отличимо от отметки посещений.

## Test checklist
- [ ] Добавить backend contract tests для `allowedSections` и `landingScreen`
      Coach, Administrator, HeadCoach и SuperAdministrator.
- [ ] Добавить или обновить route/component tests для каждой затронутой роли,
      `/`, `/attendance`, `/schedule` и attendance client-return context.
- [ ] Добавить Playwright-сценарии deep link, reload, back/forward и permission redirect.
- [ ] Проверить авторизованный mobile overflow `Ещё` и `aria-current`.
- [ ] Проверить доступный `h1`, document title и named main landmark.
- [ ] Проверить primary attendance entry и restricted/recovery state на
      `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420` и `956 x 440`.
- [ ] Запустить backend tests, frontend lint, build, unit tests и affected
      Chromium/target-iPhone WebKit Playwright suites.

## AI safety
- Safe for Codex: no
- Risk level: medium
- Reason: требования определены, но задача меняет backend authorization/session
  section contract и role-specific recovery paths; реализация требует
  отдельного плана, cross-layer tests и human review.

## Clarification questions
Не требуется. Целевая navigation model, role matrix, mobile placement и
SuperAdministrator scope подтверждены пользователем 2026-08-19.

## Source notes
- Source file: `backlog/processed/2026-08-02.md`
- Original note: `UX-2026-08-02-01 — устранить неоднозначность Главная / Посещения / Расписание`.

## Processing notes
- Created at: 2026-08-02 14:44
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- Duplicate check: активного дубликата нет; завершённая TASK-059 создала текущую объединённую модель и является baseline, а TASK-088 задаёт permission redirect contract.
- Grouping: навигационная продуктовая развилка отделена от локальной компоновки attendance workbench в TASK-104.
- Clarified at: 2026-08-19.
- Clarification source: пользователь подтвердил все четыре рекомендованных
  решения после UX-researcher и UI-designer review.
- Classification: moved to `risky`, потому что самостоятельный backend-driven
  section меняет authorization/session access-scope contract, хотя attendance
  permission semantics остаётся прежней.
