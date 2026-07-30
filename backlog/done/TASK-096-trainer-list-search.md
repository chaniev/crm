# TASK-096: Добавить поиск в список тренеров

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-07-27 00:40
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/TASK-096-trainer-list-search.plan.md
- implementation_branch: feature/TASK-096-trainer-list-search
- implementation_state: completed
- implementation_commit: a9d3098
- delivered_on_main_at: 2026-07-30
- moved_to_done_at: 2026-07-30
- last_status_reviewed_at: 2026-07-30
- reviewed_main_commit: 5f5a7b3

## Goal
Пользователь быстро находит нужного тренера по ФИО или логину без просмотра всего списка.

## Context
В inbox отмечено отсутствие поиска на экранах `Группы` и `Тренеры`. Поиск групп
уже реализован завершённой TASK-086. Отдельный поиск тренеров остаётся scope
этой задачи.

Текущий `UsersListScreen` загружает backend-permitted список через `getUsers`, показывает ФИО и логин, но не содержит locator/search state.

## User role
Главный тренер / суперадминистратор / другие роли с backend-разрешённым доступом к списку тренеров.

## Problem
При росте числа тренеров пользователь вынужден просматривать все карточки, чтобы открыть нужную запись.

## Scope
- Добавить постоянно видимый поиск в первый task toolbar списка тренеров.
- Использовать shared `EntityLocatorBar` и действующий mobile-first locator contract.
- Выполнять trimmed case-insensitive поиск по ФИО и логину среди элементов, уже возвращённых backend.
- Сохранить create и refresh actions в той же строке по приоритетам `docs/MOBILE_UI_CONTRACT.md`.
- Добавить отдельные loading, empty-first-run, empty-search, error и populated states без потери query.
- Добавить явное действие очистки поиска.
- Сохранить search state после открытия/редактирования тренера и возврата, если текущая route/state architecture это поддерживает без нового global state.
- Добавить component и Playwright regression coverage.

## Out of scope
- Поиск групп: он принадлежит TASK-086.
- Новые backend search, paging или filter contracts.
- Изменение состава backend-permitted trainers, ролей, permissions или allowed actions.
- Изменение форм создания/редактирования тренера.
- Поиск по полям, которые не показаны пользователю и не входят в текущий list response.

## Constraints
- Frontend фильтрует только уже разрешённый backend response и не выводит скрытые записи.
- Create/edit visibility продолжает определяться backend permissions/allowed actions.
- Search input не скрывается в drawer и сохраняет минимум ширины из `docs/MOBILE_UI_CONTRACT.md`.
- Create остаётся primary action, refresh — frequent secondary action; touch targets не меньше 44 x 44.
- Software keyboard, safe area и compact-height не должны скрывать locator или primary action.

## Acceptance criteria
- [x] На экране `Тренеры` поиск виден без открытия дополнительной панели.
- [x] Поиск по полному или частичному ФИО и логину регистронезависим и игнорирует внешние пробелы.
- [x] Очистка query возвращает полный backend-permitted список.
- [x] При отсутствии совпадений показан scoped empty-search state с действием очистки, а не first-run empty.
- [x] Loading, error, retry и refresh не раскрывают данные вне backend response и не меняют permission semantics.
- [x] Search, create и refresh следуют shared locator/action contract без переноса в отдельную action-only строку.
- [x] На 390 x 844, 420 x 912, 440 x 956, 912 x 420, 956 x 440, 768 и 1440 px нет horizontal page scroll или недостижимых controls.

## Test checklist
- [x] Добавить component tests: partial/case-insensitive search, trim, clear и empty-search.
- [x] Добавить regression на loading/error/refresh при непустом query.
- [x] Добавить Playwright сценарий: найти тренера → открыть редактирование → вернуться.
- [x] Проверить keyboard/focus order и accessible names icon-only actions.
- [x] Запустить `cd frontend && npm run lint`.
- [x] Запустить `cd frontend && npm run build`.
- [x] Запустить `cd frontend && npm run test:unit`.
- [x] Запустить affected Playwright и mobile WebKit checks.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: локальная frontend-фильтрация уже разрешённого списка без изменения backend contracts, ролей или permissions.

## Clarification questions
Не требуется: минимальный поиск однозначно покрывает видимые identity fields — ФИО и логин; расширение полей или server-side contract остаётся вне scope.

## Source notes
- Source file: `backlog/processed/2026-07-27.md`
- Original note: `На экранах «Группы» и «Тренеры» отсутствует поиск. Необходимо добавить возможность поиска на обоих экранах.`
- Related existing task: `backlog/done/TASK-086-mobile-groups-search-filter-paging.md` покрывает часть заметки про группы.

## Processing notes
- Created at: 2026-07-27 00:25
- Created by skill: codex-backlog-skill
- Duplicate check: завершённая TASK-086 покрывает только поиск групп; другой
  задачи на locator/search списка тренеров не найдено.

## Completion record
- Completed on: 2026-07-30
- Implementation commit: `a9d3098`
- Integrated regression commit: `5f5a7b3`
- Validation: frontend lint, build, raw-color check, 404 unit tests and 202 Playwright tests passed on integrated `main`.
- Device acceptance: an actual iPhone Air Simulator test passed with Safari chrome/safe areas, the software keyboard open, typed query `АННА`, reachable refresh/create actions and compact-height landscape.
- Data storage: backend and database structure were not changed; migration is not required.
