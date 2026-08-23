# TASK-103: Выделить «Посещения» в самостоятельный раздел

## Status
done

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
замену отдельной management inbox `Home`/`Главная` на `Attention`/`Внимание` с
canonical route `/attention`, role-specific landing routes, порядок основной
навигации и включение SuperAdministrator в целевую модель.

## User role
Coach / Administrator / HeadCoach / SuperAdministrator.

## Product decisions
- `Посещения` — самостоятельный backend-authorized `AppSection`, navigation
  item и canonical route `/attendance`, а не вкладка внутри `Главная`.
- Название `Посещения` одинаково используется в desktop sidebar, mobile bottom
  navigation, overflow `Ещё`, доступном `h1`, named main landmark, document
  title, client-return action и permission recovery.
- Бывшая `Главная` заменяется самостоятельным section `Attention` с label
  `Внимание` и canonical route `/attention` для Administrator, HeadCoach и
  SuperAdministrator; backend/frontend identifier `Home` и section route `/`
  удаляются, attendance workbench и вкладка `Посещения` также удаляются с этого
  экрана.
- Coach не видит `Внимание` и не получает section `Attention`, потому что
  у этой роли нет отдельной management-задачи на данном экране.
- Coach и Administrator после входа стартуют на `/attendance` с active nav
  `Посещения`.
- HeadCoach и SuperAdministrator после входа стартуют на `/attention` с active nav
  `Внимание`; самостоятельный раздел `Посещения` остаётся доступен одним прямым
  navigation action.
- Desktop и mobile navigation используют единый приоритет: `Посещения` первым,
  `Внимание` вторым для управляющих ролей, затем `Расписание` и `Клиенты`.
  Для Coach, у которого нет `Внимание`, стабильный порядок —
  `Посещения`, `Расписание`, `Клиенты`.
- На mobile `Посещения`, доступное `Внимание` и `Расписание` остаются
  стабильными primary items. `Клиенты` занимают четвёртую адаптивную позицию у
  управляющих ролей; активный overflow destination временно заменяет
  `Клиенты`, переносит их в `Ещё` и не вытесняет первые три позиции.
- `/attention` является единственным canonical route management inbox
  `Внимание`. Direct restricted `/attention` для Coach использует явный recovery
  contract TASK-088 с переходом в
  `Посещения`, а не silent redirect.
- `/` больше не является section route или alias `Внимание`; для
  аутентифицированного пользователя он разрешается как `not-found` с явным
  recovery в backend-authorized landing section.
- `Расписание` остаётся самостоятельным `/schedule`: оно показывает
  запланированные занятия, но не служит входом в отметку факта посещения.

## Problem
Одна пользовательская задача называется по-разному в route, вкладке и навигации. Пользователь может искать отметку посещений в `Расписании`, а deep link, reload или permission redirect могут показывать неочевидный active state.

## Scope
- Добавить backend section `Attendance` и синхронно обновить session/access-scope
  contract (`AppSection`, `allowedSections`, `landingScreen`) по утверждённой
  role matrix без изменения attendance permission semantics.
- Добавить canonical route `/attendance` и самостоятельный navigation item
  `Посещения`; удалить attendance tab/workbench из бывшей `Главная`.
- Заменить backend/frontend section `Home` на `Attention`, назначить ему label
  `Внимание` и canonical route `/attention`; исключить `Attention` из
  разрешённых sections Coach и удалить `/` из section route registry.
- Зафиксировать одинаковый desktop/mobile navigation order: `Посещения`,
  доступное `Внимание`, `Расписание`, `Клиенты`, затем остальные разрешённые
  sections.
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
- Frontend не преобразует legacy `Home` в `Attention`: session user с
  неизвестным, legacy или отсутствующим `landingScreen`, либо без единого
  известного allowed section, отклоняется mapper-ом fail closed.
- Одна пользовательская задача не должна иметь конкурирующие названия в разных точках навигации.
- Primary attendance entry должен оставаться доступным на `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420` и `956 x 440` с учётом safe area.
- Разрешённые role-specific navigation items нельзя вычислять из локально продублированных frontend-правил.
- Typed `allowed | restricted | not-found` и явный recovery feedback из
  TASK-088 сохраняются; direct denied route не превращается в silent redirect.
- Существующее содержимое и operational states attendance workbench из
  TASK-104 сохраняются без редизайна.

## Acceptance criteria
- [x] Backend возвращает самостоятельный section `Attendance` и утверждённые
      `allowedSections`/`landingScreen` с section `Attention` вместо `Home` для
      всех четырёх ролей; актуальный session contract больше не содержит
      `Home`.
- [x] Coach и Administrator после входа открывают `/attendance`; active nav,
      доступный `h1`, main landmark и document title называют раздел
      `Посещения`.
- [x] HeadCoach и SuperAdministrator после входа открывают `/attention`, видят
      management inbox `Внимание` и переходят в `Посещения` одним прямым
      navigation action.
- [x] Coach не видит `Внимание` и не получает в `allowedSections` section
      `Attention`.
- [x] `Внимание` управляющих ролей больше не содержит attendance tab/workbench,
      использует section identifier `Attention` и canonical route `/attention`.
- [x] На `Внимание` нет видимого route/operation heading `Требуют внимания`;
      сохраняются скрытый `h1` `Внимание`, named main landmark и доступное имя
      списка, а первым видимым контентом становится action toolbar или
      operational state.
- [x] Desktop и mobile navigation показывают `Посещения` первым, доступное
      `Внимание` вторым, затем `Расписание` и `Клиенты`; active overflow
      promotion заменяет `Клиенты`, не вытесняя первые три позиции.
- [x] Route label, desktop nav, mobile nav, overflow, document title,
      client-return action и recovery-навигация используют стабильное название
      `Посещения`.
- [x] `/attendance` является canonical deep link и корректно сохраняет active
      state при reload и back/forward.
- [x] Возврат из карточки клиента восстанавливает attendance context на
      `/attendance`, а не открывает `Внимание`.
- [x] Direct `/attention` для Coach показывает явное ограничение с recovery
      action в `Посещения`; permission/access change не создаёт silent redirect
      или loop.
- [x] Direct `/` для аутентифицированного пользователя показывает существующий
      `not-found` state с recovery в его backend-authorized landing section и не
      служит alias для `/attention`.
- [x] На mobile `Посещения` остаётся primary bottom-navigation item, а active
      overflow destination, `Ещё` и `aria-current` следуют adaptive navigation
      contract на всех целевых размерах.
- [x] Deep link, reload, back/forward и permission redirect сохраняют корректный route и active state.
- [x] `Расписание` остаётся семантически отличимо от отметки посещений.

## Test checklist
- [x] Добавить backend contract tests для `allowedSections` и `landingScreen`
      Coach, Administrator, HeadCoach и SuperAdministrator.
- [x] Добавить или обновить route/component tests для каждой затронутой роли,
      `/`, `/attention`, `/attendance`, `/schedule` и attendance client-return
      context.
- [x] Добавить Playwright-сценарии deep link, reload, back/forward и permission redirect.
- [x] Проверить авторизованный mobile overflow `Ещё` и `aria-current`.
- [x] Проверить доступный `h1`, document title и named main landmark.
- [x] Проверить primary attendance entry и restricted/recovery state на
      `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420` и `956 x 440`.
- [x] Запустить backend tests, frontend lint, build, unit tests и affected
      Chromium/target-iPhone WebKit Playwright suites.

## AI safety
- Safe for Codex: no
- Risk level: medium
- Reason: требования определены, но задача меняет backend authorization/session
  section contract и role-specific recovery paths; реализация требует
  отдельного плана, cross-layer tests и human review.

## Clarification questions
Не требуется. Целевая navigation model, role matrix, labels, navigation order,
mobile placement и SuperAdministrator scope подтверждены пользователем
2026-08-19.

## Source notes
- Source file: `backlog/processed/2026-08-02.md`
- Original note: `UX-2026-08-02-01 — устранить неоднозначность Главная / Посещения / Расписание`.

## Processing notes
- Created at: 2026-08-02 14:44
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- Duplicate check: активного дубликата нет; завершённая TASK-059 создала текущую объединённую модель и является baseline, а TASK-088 задаёт permission redirect contract.
- Grouping: навигационная продуктовая развилка отделена от локальной компоновки attendance workbench в TASK-104.
- Clarified at: 2026-08-19.
- Clarification source: пользователь подтвердил самостоятельный раздел
  `Посещения`, замену `Home`/`Главная` на `Attention`/`Внимание` с route
  `/attention`, отсутствие видимого `Требуют внимания` и порядок `Посещения`
  -> `Внимание` -> `Расписание` -> `Клиенты` после UX-researcher и UI-designer
  review.
- Classification: moved to `risky`, потому что самостоятельный backend-driven
  section меняет authorization/session access-scope contract, хотя attendance
  permission semantics остаётся прежней.

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-23
- moved_from: /backlog/risky
- implementation_plan: /backlog/done/TASK-103-attendance-navigation-model.plan.md
- implementation_branch: feature/TASK-103-attendance-navigation-model
- implementation_state: completed
- implementation_commits: 5d441ff, ba0b330
- delivered_on_main_at: 2026-08-23
- moved_to_done_at: 2026-08-23
- last_status_reviewed_at: 2026-08-23

## Completion record
- Completed on: 2026-08-23; exact functional candidate: `ba0b330`.
- Backend session source of truth now returns the approved Attendance/Attention
  landing and allowed-section matrix without changing permissions or attendance
  scope semantics.
- Frontend owns canonical `/attendance` and `/attention` screens, fail-closed
  legacy session mapping, stable desktop/mobile navigation, named main
  landmarks, explicit restricted/not-found recovery and version-2 client
  return context.
- Validation: backend format/build/audit and `431/431` tests; frontend full
  check/audit with `525/525` unit tests; affected Chromium `29/29`; target
  iPhone WebKit `42/42`; isolated real-stack session/route/API smoke passed.
- Physical Safari/iOS Simulator, actual safe-area/browser chrome and software
  keyboard behavior remain unverified. Standard backend Compose build remains
  blocked by the pre-existing Dockerfile omission of `Directory.Build.props`;
  runtime smoke used an uncommitted temporary recipe correction only.
