# TASK-094: Унифицировать фон областей фильтров

## Status
ready

## Goal
Области поиска и фильтров на всех экранах CRM выглядят как один shared-паттерн на desktop и mobile и не меняют фон от экрана к экрану.

## Context
В новой inbox-заметке отмечено, что часть областей фильтров использует основной фон страницы, а часть — белый фон. Завершённые TASK-056 и TASK-090 уже задали компактный shared-паттерн, semantic surface tokens и поддержку нескольких theme profiles, поэтому эта задача является regression/follow-up sweep по оставшимся call sites.

## User role
Все пользователи CRM.

## Problem
Разные фоны визуально меняют иерархию одной и той же операции фильтрации и создают ощущение, что экраны собраны из разных UI-систем.

## Scope
- Составить инвентаризацию всех route-level областей поиска и фильтров на desktop и mobile.
- Для каждого найденного экрана определить shared-компонент и semantic surface role из `docs/MOBILE_UI_CONTRACT.md`.
- Перевести оставшиеся локальные панели на `EntityLocatorBar`, `CompactFilterPanel`, `FilterToolbar` или другой уже утверждённый shared-паттерн по назначению.
- Убрать raw white, page-background и feature-specific переопределения фона, border и shadow, если они расходятся с shared filter surface.
- Сохранить различимость панели, контролов, active filters, focus и operational states во всех поддерживаемых theme profiles.
- Добавить regression coverage для representative list/filter screens.

## Out of scope
- Изменение состава, значений или бизнес-семантики фильтров.
- Изменение backend query contracts, ролей, permissions или access scope.
- Перестройка расположения create/refresh actions из TASK-093.
- Общий редизайн страниц, таблиц или карточек вне области фильтров.

## Constraints
- Использовать Mantine, Onest и существующие shared-компоненты.
- Цвета задаются semantic tokens, а не raw hex/rgba, `white` или локальными brand values.
- Theme switch не должен менять geometry, иерархию или смысл состояний.
- Не допускать горизонтальный page scroll и desktop-панель, перенесённую на mobile без адаптации.
- Реализация должна соответствовать TASK-056, TASK-090 и `docs/MOBILE_UI_CONTRACT.md`.

## Acceptance criteria
- [ ] В implementation inventory перечислены все экраны с поиском или фильтрами; каждый обновлён либо исключён с обоснованием.
- [ ] Одинаковые filter/locator surfaces используют один semantic background, border и shadow contract на desktop и mobile.
- [ ] В feature code нет локального `white`, raw color или page-background override для стандартной области фильтров.
- [ ] `default-green-v1` и `test-blue-coral-v1` сохраняют читаемость, границы и focus states панели.
- [ ] Loading, empty, error и populated states не меняют фон панели непредсказуемо.
- [ ] Фильтрация, сброс и active-filter controls работают как до visual cleanup.
- [ ] На 390 x 844, 420 x 912, 440 x 956, 912 x 420, 956 x 440, 768 и 1440 px нет overflow или сломанной иерархии.

## Test checklist
- [ ] Добавить component regression для shared filter surface и theme profiles.
- [ ] Добавить или обновить Playwright visual/geometry checks минимум для двух representative screens.
- [ ] Вручную проверить все найденные filter screens на desktop и mobile.
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Запустить `cd frontend && npm run test:unit`.
- [ ] Запустить affected Playwright и mobile WebKit checks.

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: изменение frontend-only и не затрагивает бизнес-правила, но требует аккуратного cross-screen sweep без локальных визуальных исключений.

## Clarification questions
Не требуется: эталон задают TASK-056, TASK-090 и `docs/MOBILE_UI_CONTRACT.md`.

## Source notes
- Source file: `backlog/processed/2026-07-27.md`
- Original note: `В десктопе и мобильной версии область с фильтрами на экранах не в едином стиле: где-то используется основной фон, где-то — белый цвет в качестве фона.`

## Processing notes
- Created at: 2026-07-27 00:25
- Created by skill: codex-backlog-skill
- Duplicate check: завершённые TASK-046, TASK-056 и TASK-090 задали общий визуальный и semantic-token baseline, но активной follow-up задачи на оставшиеся несовпадающие filter surfaces нет.
