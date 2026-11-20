# Implementation Plan: TASK-181 Сделать переходы между разделами настоящими ссылками

## Metadata
- source_task: /backlog/done/2026-11-21/TASK-181-native-navigation-links.md
- requirements: REQ-NFR-001 (implements)
- branch: codex/TASK-181-native-navigation-links
- readiness: yes
- product_decisions: accepted
- technical_decisions: none — локальная доработка существующих компонентов; новый архитектурный механизм не вводится
- architecture_decisions: none — границы слоёв и API не меняются
- open_questions: none
- dependencies: none
- risk: low — регрессия существующего взаимодействия

## Goal
У существующих маршрутов работают открытие в новой вкладке и копирование адреса.

## Relevance evidence
MobileBottomNavigation использует UnstyledButton type=button и onNavigate для существующих маршрутов; getRoutePath в appRoutes уже определяет URL.
Проверены активные карточки и незавершённые планы; выбранные ID не имеют завершённых карточек-дублей. Статическое доказательство не заменяет runtime-приёмку.

## Decisions and contracts
Принятые границы и ожидаемое поведение заданы Requirements и Acceptance criteria исходной задачи.
Локальная правка не меняет сценарий и не требует нового UX-выбора; сравнение до/после входит в проверку.
Новые разрешения, расчёты и CRM-правила не вводятся.

## Decision evidence
- product: [Принятое требование](/docs/requirements/08-нефункциональные.md) — owner: владелец продукта, решение зарегистрировано в REQ; decision: REQ-NFR-001: переходы по существующим URL через href с открытием в новой вкладке и копированием адреса.

## Scope
### In
- Только цель и перечисленное покрытие исходной задачи.
### Out
- Изменения backend-правил, несвязанные улучшения и перечисленное в исходной задаче Out of scope.

## Implementation slices
1. Перевести маршрутные элементы desktop/mobile/overflow на ссылки с href из существующего getRoutePath; «Ещё» оставить кнопкой.
2. Перехватывать только обычный левый клик без модификаторов; остальные клики сохраняют нативную семантику. Сохранить aria-current, закрытие overflow для обычного перехода и разрешённый состав разделов.
3. Добавить регрессию history/direct URL и обновить требования/CHANGELOG.

## Likely files and layers
- `frontend/src/features/shared/MobileBottomNavigation.tsx` — затронутый компонент/ресурс или его существующие тесты.
- `frontend/src/lib/appRoutes.ts` — затронутый компонент/ресурс или его существующие тесты.

## Regression specification
### Automated tests to add or update
- href совпадает с маршрутом; обычный клик работает без reload, Ctrl/Meta/Shift и middle click не preventDefault; popup получает нужный URL. Back/Forward, aria-current, restricted route, закрытие overflow и возврат фокуса сохранены.
- Расширить существующий `frontend/e2e/iphone-target-devices.spec.ts` по сценарию; вспомогательный сценарный модуль не регистрировать как отдельный spec.
### Expected red evidence
- getByRole(link) для пункта раздела падает на текущем button; тест modified click выявляет отсутствие href.
### Required validation
- В task verification contract включить затронутый исполнимый spec и target-iPhone проекты; для сценарного модуля выбрать вызывающий spec.
### Manual evidence
- Сравнение до/после локальной правки, клавиатура и отдельная проверка доступности затронутого сценария. Непроверенные физический iPhone/Safari явно указать в evidence.
### Regression barrier
- Описанные пользовательские assertions выполняются в затронутом Playwright-сценарии на desktop и target-iPhone.

## Risks and stop conditions
- При необходимости нового поведения или изменения контракта вернуть план в подготовку до зависимых изменений.
- При завершении актуализировать состояние связанных требований и `docs/requirements/CHANGELOG.md`, сохранив не относящиеся к задаче незавершённые части.
