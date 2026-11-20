# Implementation Plan: TASK-018 Уменьшить визуальный шум в client detail/form сценариях

## Metadata
- source_task: /backlog/needs-clarification/TASK-018-client-detail-visual-noise.md
- requirements: REQ-CLI-001 (changes); REQ-CLI-004 (constrains); REQ-NFR-001 (constrains)
- branch: codex/TASK-018-client-detail-visual-noise
- readiness: no — Не выбран проверенный прототип уплотнения карточки и формы.
- product_decisions: accepted
- technical_decisions: none — локальная доработка существующих компонентов; новый архитектурный механизм не вводится
- architecture_decisions: none — границы слоёв и API не меняются
- open_questions: Не выбран проверенный прототип уплотнения карточки и формы.
- dependencies: TASK-019 — отдельный разбор структуры; не включать вкладки в этот план
- risk: medium — Не выбран проверенный прототип уплотнения карточки и формы.

## Goal
Detail и form сценарии клиента выглядят плотнее и понятнее, без пустых блоков и повторяющихся статусов.

## Relevance evidence
ClientDetailScreen последовательно рендерит обзор, абонементы, Telegram и связанные разделы; ClientForm всегда размещает photoSection в rail. Свежий аудит PRE-02, DET-01/02 и NEW-01/02 подтверждает повторы.
Проверены активные карточки и незавершённые планы; выбранные ID не имеют завершённых карточек-дублей. Статическое доказательство не заменяет runtime-приёмку.

## Decisions and contracts
Принятые границы и ожидаемое поведение заданы Requirements и Acceptance criteria исходной задачи.
Это черновик. Открытые решения в Metadata не считаются согласованными и блокируют исполнение всех зависимых этапов.
Новые разрешения, расчёты и CRM-правила не вводятся.

## Decision evidence
Решение владельца в текущем чате 20.11.2026: прототипов нет; TASK-019 пропустить для отдельного разбора. Это подтверждает блокеры, а не согласование UX.
- product: [Исходная задача](/backlog/needs-clarification/TASK-018-client-detail-visual-noise.md) — owner: владелец продукта; decision: принятый объём ограничен Requirements и Acceptance criteria; открытые вопросы не утверждены.

## Scope
### In
- Только цель и перечисленное покрытие исходной задачи.
### Out
- Изменения backend-правил, несвязанные улучшения и перечисленное в исходной задаче Out of scope.

## Implementation slices
1. По согласованному прототипу убрать только повторные факты и декоративные пустоты в detail/form/preview.
2. Сохранить фото, ошибки загрузки, восстановление и значимые предупреждения; обновить требования и историю изменения.

## Likely files and layers
- `frontend/src/features/clients/ClientDetailScreen.tsx` — затронутый компонент/ресурс или его существующие тесты.
- `frontend/src/features/clients/ClientForm.tsx` — затронутый компонент/ресурс или его существующие тесты.
- `frontend/src/features/clients/ClientOverviewSection.tsx` — затронутый компонент/ресурс или его существующие тесты.

## Regression specification
### Automated tests to add or update
- Клиент с фото/без фото, новая карточка до сохранения, ошибка загрузки фото, длинное ФИО; значимые предупреждения остаются видимыми.
- Расширить существующий `frontend/e2e/client-profile-context-navigation.spec.ts` по сценарию; вспомогательный сценарный модуль не регистрировать как отдельный spec.
### Expected red evidence
- После выбора прототипа assertion на отсутствие конкретных повторов должен падать на исходной карточке; до выбора визуальный эталон не определён.
### Required validation
- В task verification contract включить затронутый исполнимый spec и target-iPhone проекты; для сценарного модуля выбрать вызывающий spec.
### Manual evidence
- После согласования — сравнение реализации с проверенным прототипом, клавиатура и отдельная проверка доступности затронутого сценария. Непроверенные физический iPhone/Safari явно указать в evidence.
### Regression barrier
- Описанные пользовательские assertions выполняются в затронутом Playwright-сценарии на desktop и target-iPhone.

## Risks and stop conditions
- Не выбран проверенный прототип уплотнения карточки и формы. До снятия блокера код не менять.
- При завершении актуализировать состояние связанных требований и `docs/requirements/CHANGELOG.md`, сохранив не относящиеся к задаче незавершённые части.
