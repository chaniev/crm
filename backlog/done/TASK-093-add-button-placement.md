# TASK-093: Унифицировать расположение и оформление кнопок добавления и обновления

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-07-27 00:40
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/TASK-093-add-button-placement.plan.md
- implementation_branch: feature/TASK-093-add-button-placement
- implementation_state: completed
- implementation_commit: 1433180
- regression_commit: 342f5c5
- delivered_on_main_at: 2026-07-30
- moved_to_done_at: 2026-07-30
- last_status_reviewed_at: 2026-07-30
- reviewed_main_commit: 342f5c5

## Goal
На всех экранах CRM добавление и обновление находятся в предсказуемом task toolbar и используют единые размеры, визуальный приоритет и responsive-поведение.

## Context
В первой inbox-заметке отмечено, что controls добавления на разных экранах прижаты к левому краю или к фильтрам. Новая заметка уточняет расхождение: на `Группы` действия находятся справа, а на `Клиенты` — рядом с фильтрами; отличаются также размер и цвет кнопок добавления и обновления.

После завершения TASK-090 нормативный `docs/MOBILE_UI_CONTRACT.md` уже задаёт целевой паттерн: locator, filter trigger и retained primary/frequent actions находятся в одной строке; create/add является видимым primary action, refresh — frequent secondary action; размеры, приоритет сворачивания и mobile icon-only behavior определены. Поэтому открытых продуктовых вопросов для первого implementation sweep больше нет.

## User role
Администратор / главный тренер / суперадминистратор / другие роли с backend-разрешёнными create/refresh operations.

## Problem
Непоследовательные placement, размер и цвет одинаковых действий замедляют повторяющиеся операции и создают ложную разницу в их важности.

## Scope
- Составить inventory всех экранов с create/add и refresh actions.
- Для list screens размещать locator, filter trigger и retained actions в первом task toolbar по `docs/MOBILE_UI_CONTRACT.md`.
- Для экранов без поиска или фильтров использовать тот же shared action cluster и приоритеты без пустой второй toolbar-строки.
- Унифицировать размеры, icon/text behavior, semantic colors, variants, gaps и order create/add и refresh controls.
- Сохранить create/add как единственную visually dominant primary action, а refresh — как frequent secondary action.
- На 360–440 px использовать разрешённые icon-only controls с точными accessible names, когда текст не помещается без сжатия locator.
- Вынести повторяющуюся geometry/style в shared Mantine/Onest pattern и удалить feature-specific исключения.
- Добавить component и representative Playwright regression coverage.

## Out of scope
- Изменение доступности операций, permissions или backend contracts.
- Переработка состава, значений и бизнес-поведения фильтров.
- Унификация destructive или rare secondary actions, если они не влияют на основной toolbar.
- Изменение форм и создаваемых сущностей.

## Constraints
- На каждом состоянии экрана должна оставаться одна визуально доминирующая primary action.
- Разрешённую primary add action нельзя скрывать в overflow menu.
- На mobile действие должно оставаться достижимым с учётом safe area, Safari chrome и software keyboard.
- Нельзя размещать кнопку внутри filter panel только ради визуального выравнивания, если она не относится к фильтрации.
- Реализация должна использовать shared Mantine/Onest pattern, а не отдельные CSS-исключения для каждого экрана.
- Цвета и states используют semantic tokens; raw brand colors и локальные hex/rgba запрещены.
- Backend остаётся владельцем permissions и allowed actions.

## Acceptance criteria
- [x] В implementation inventory перечислены все экраны с create/add или refresh actions; каждый обновлён либо исключён с причиной.
- [x] На list screens locator/search, filters, create/add и refresh следуют единому shared toolbar contract.
- [x] Create/add использует один semantic primary treatment, refresh — один secondary/frequent treatment.
- [x] Размеры, gap, icon size и text/icon-only transitions одинаковы для эквивалентных действий.
- [x] На mobile create/add и refresh имеют touch target минимум 44 x 44 и точные accessible names.
- [x] На desktop/tablet действия не прыгают между правым краем, отдельной строкой и filter panel без обоснованного screen-specific исключения.
- [x] Permissions, loading/disabled states и фактические операции не изменены.
- [x] `Группы` и `Клиенты` соответствуют одному контракту с учётом различий их locator/filter composition.
- [x] Определены исключения для экранов, которым общий паттерн не подходит, с причиной.

## Test checklist
- [x] До реализации собрать screenshot/inventory затронутых экранов на desktop и 390 x 844.
- [x] Добавить component regression для shared action placement, variants и accessible names.
- [x] Добавить Playwright visual/geometry checks минимум для одного list screen с фильтрами и одного без фильтров.
- [x] Проверить `Группы` и `Клиенты` как указанные пользователем regression examples.
- [x] Проверить 390 x 844, 420 x 912, 440 x 956, 912 x 420, 956 x 440, 768 и 1440 px.
- [x] Запустить `cd frontend && npm run lint`.
- [x] Запустить `cd frontend && npm run build`.
- [x] Запустить `cd frontend && npm run test:unit`.
- [x] Запустить affected Playwright и mobile WebKit checks.

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: cross-screen frontend sweep требует аккуратной проверки, но целевой action contract уже утверждён и не меняет backend permissions или business semantics.

## Clarification questions
Не требуется: размещение, приоритет, размеры и responsive-поведение определены в `docs/MOBILE_UI_CONTRACT.md`; полный перечень экранов является implementation inventory, а не продуктовым решением.

## Source notes
- Source file: `backlog/processed/2026-07-26.md`
- Original note: `в разных окнах часть контролов добавления прижаты к левому краю часть прижаты к фильтрам, надо унифицировать расположение кнопок`
- Source file: `backlog/processed/2026-07-27.md`
- Original note: `Кнопки добавления и обновления оформлены и расположены на экранах непоследовательно: на одних экранах они прижаты к правому краю, например на экране «Группы», а на других — к области фильтров, например на экране «Клиенты». Размер и цвет кнопок также отличаются от экрана к экрану. Необходимо привести расположение и оформление этих кнопок к единому стилю.`

## Processing notes
- Created at: 2026-07-26 16:28
- Created by skill: codex-backlog-skill
- Duplicate check: завершённая TASK-056 унифицировала область фильтров, а TASK-090 создала shared mobile UI foundation; ни одна из них не фиксирует единое размещение primary add action. Из-за возможного пересечения с этими паттернами и отсутствия списка экранов задача направлена в needs-clarification.
- Updated at: 2026-07-27 00:25
- Update reason: новая заметка добавила concrete screens и visual inconsistencies; нормативный TASK-090 contract уже разрешает прежние вопросы placement/order/mobile behavior, поэтому задача расширена на create/refresh styling и переведена в `tasks-ready`.
- Duplicate check: новая заметка относится к тому же cross-screen action pattern; отдельный TASK не создан.

## Completion notes
- Добавлен shared action cluster для create/add и refresh, проведён inventory
  экранов и удалены дублирующие empty-state actions.
- Mobile, tablet и desktop geometry закреплены component и Playwright-тестами,
  включая permission-restricted и 768 px fallback.
- Изменений схемы хранения данных и миграции БД не потребовалось.
