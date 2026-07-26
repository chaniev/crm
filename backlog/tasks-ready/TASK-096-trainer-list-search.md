# TASK-096: Добавить поиск в список тренеров

## Status
ready

## Goal
Пользователь быстро находит нужного тренера по ФИО или логину без просмотра всего списка.

## Context
В inbox отмечено отсутствие поиска на экранах `Группы` и `Тренеры`. Поиск групп уже полностью входит в TASK-086, находящуюся в implementation. Активной задачи на поиск тренеров нет.

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
- [ ] На экране `Тренеры` поиск виден без открытия дополнительной панели.
- [ ] Поиск по полному или частичному ФИО и логину регистронезависим и игнорирует внешние пробелы.
- [ ] Очистка query возвращает полный backend-permitted список.
- [ ] При отсутствии совпадений показан scoped empty-search state с действием очистки, а не first-run empty.
- [ ] Loading, error, retry и refresh не раскрывают данные вне backend response и не меняют permission semantics.
- [ ] Search, create и refresh следуют shared locator/action contract без переноса в отдельную action-only строку.
- [ ] На 390 x 844, 420 x 912, 440 x 956, 912 x 420, 956 x 440, 768 и 1440 px нет horizontal page scroll или недостижимых controls.

## Test checklist
- [ ] Добавить component tests: partial/case-insensitive search, trim, clear и empty-search.
- [ ] Добавить regression на loading/error/refresh при непустом query.
- [ ] Добавить Playwright сценарий: найти тренера → открыть редактирование → вернуться.
- [ ] Проверить keyboard/focus order и accessible names icon-only actions.
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Запустить `cd frontend && npm run test:unit`.
- [ ] Запустить affected Playwright и mobile WebKit checks.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: локальная frontend-фильтрация уже разрешённого списка без изменения backend contracts, ролей или permissions.

## Clarification questions
Не требуется: минимальный поиск однозначно покрывает видимые identity fields — ФИО и логин; расширение полей или server-side contract остаётся вне scope.

## Source notes
- Source file: `backlog/processed/2026-07-27.md`
- Original note: `На экранах «Группы» и «Тренеры» отсутствует поиск. Необходимо добавить возможность поиска на обоих экранах.`
- Related existing task: `backlog/implementation/TASK-086-mobile-groups-search-filter-paging.md` покрывает часть заметки про группы.

## Processing notes
- Created at: 2026-07-27 00:25
- Created by skill: codex-backlog-skill
- Duplicate check: TASK-086 покрывает только поиск групп; активной или завершённой задачи на locator/search списка тренеров не найдено.
