# Implementation Plan: TASK-176 Исправить язык, доступные имена и фокус ошибок форм

## Metadata
- source_task: /backlog/implementation/TASK-176-russian-accessibility-and-validation-focus.md
- requirements: REQ-NFR-001 (implements); REQ-NFR-007 (constrains)
- branch: codex/TASK-176-russian-accessibility-and-validation-focus
- readiness: yes
- product_decisions: accepted
- technical_decisions: none — локальная доработка существующих компонентов; новый архитектурный механизм не вводится
- architecture_decisions: none — границы слоёв и API не меняются
- open_questions: none
- dependencies: none
- risk: low — регрессия существующего взаимодействия

## Goal
Русский интерфейс корректно объявляет язык и действия; ошибка отправки переводит фокус на первое невалидное поле.

## Relevance evidence
frontend/index.html содержит lang="en"; обе формы UserCreateScreen/UserEditScreen используют form.onSubmit без invalid callback. Наличие русского close label в MobileBottomNavigation исключает его слепую повторную замену.
Проверены активные карточки и незавершённые планы; выбранные ID не имеют завершённых карточек-дублей. Статическое доказательство не заменяет runtime-приёмку.

## Decisions and contracts
Принятые границы и ожидаемое поведение заданы Requirements и Acceptance criteria исходной задачи.
Локальная правка не меняет сценарий и не требует нового UX-выбора; сравнение до/после входит в проверку.
Новые разрешения, расчёты и CRM-правила не вводятся.

## Decision evidence
- product: [Принятое требование](/docs/requirements/08-нефункциональные.md) — owner: владелец продукта, решение зарегистрировано в REQ; decision: REQ-NFR-001: русский язык документа, локализованные доступные имена и фокус первого невалидного поля.

## Scope
### In
- Только цель и перечисленное покрытие исходной задачи.
### Out
- Изменения backend-правил, несвязанные улучшения и перечисленное в исходной задаче Out of scope.

## Implementation slices
1. Задать ru в документе; локализовать внутренние действия PasswordInput, NumberInput и уведомлений через существующие ресурсы.
2. Подключить фокус и прокрутку первого ошибочного поля после client validation и после applyFieldErrors; сохранить backend validation semantics.
3. Проверить уже именованную кнопку закрытия overflow, focus return и успешную отправку; обновить состояние требований и CHANGELOG.

## Likely files and layers
- `frontend/src/features/users/UserCreateScreen.tsx` — затронутый компонент/ресурс или его существующие тесты.
- `frontend/src/features/users/UserEditScreen.tsx` — затронутый компонент/ресурс или его существующие тесты.
- `frontend/src/features/shared/MobileBottomNavigation.tsx` — затронутый компонент/ресурс или его существующие тесты.
- `frontend/src/features/shared/notifications.ts` — затронутый компонент/ресурс или его существующие тесты.
- `frontend/src/theme/componentRecipes.ts` — затронутый компонент/ресурс или его существующие тесты.
- `frontend/index.html` — язык документа.

## Regression specification
### Automated tests to add or update
- DOM lang=ru; русские различимые имена показа/скрытия пароля, увеличения/уменьшения длительности и закрытия уведомления. При client/server errors фокус на первом ошибочном поле, оно видно и связано с ошибкой; успешная отправка не крадёт фокус.
- Расширить существующий `frontend/e2e/users.spec.ts` по сценарию; вспомогательный сценарный модуль не регистрировать как отдельный spec.
### Expected red evidence
- Проверка documentElement.lang=ru падает на текущем en; отправка пустой trainer form должна показать отсутствие требуемого перевода фокуса.
### Required validation
- В task verification contract включить затронутый исполнимый spec и target-iPhone проекты; для сценарного модуля выбрать вызывающий spec.
### Manual evidence
- Сравнение до/после локальной правки, клавиатура и отдельная проверка доступности затронутого сценария. Непроверенные физический iPhone/Safari явно указать в evidence.
### Regression barrier
- Описанные пользовательские assertions выполняются в затронутом Playwright-сценарии на desktop и target-iPhone.

## Risks and stop conditions
- При необходимости нового поведения или изменения контракта вернуть план в подготовку до зависимых изменений.
- При завершении актуализировать состояние связанных требований и `docs/requirements/CHANGELOG.md`, сохранив не относящиеся к задаче незавершённые части.
