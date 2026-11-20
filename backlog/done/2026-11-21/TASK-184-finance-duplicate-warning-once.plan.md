# Implementation Plan: TASK-184 Убрать повтор предупреждения о дублях в финансовом отчёте

## Metadata
- source_task: /backlog/done/2026-11-21/TASK-184-finance-duplicate-warning-once.md
- requirements: REQ-SUB-010 (changes); REQ-NFR-001 (constrains); REQ-NFR-007 (constrains)
- branch: codex/TASK-184-finance-duplicate-warning-once
- readiness: yes
- product_decisions: accepted
- technical_decisions: none — локальная доработка существующих компонентов; новый архитектурный механизм не вводится
- architecture_decisions: none — границы слоёв и API не меняются
- open_questions: none
- dependencies: none
- risk: low — регрессия существующего взаимодействия

## Goal
Смысл возможного дублирования в детализации объясняется один раз и относится к обеим разбивкам.

## Relevance evidence
FinanceReportsScreen передаёт duplicatedBreakdownHint дважды: duplicateHint для тренеров и для групп (строки 755 и 786 на момент проверки).
Проверены активные карточки и незавершённые планы; выбранные ID не имеют завершённых карточек-дублей. Статическое доказательство не заменяет runtime-приёмку.

## Decisions and contracts
Принятые границы и ожидаемое поведение заданы Requirements и Acceptance criteria исходной задачи.
Локальная правка не меняет сценарий и не требует нового UX-выбора; сравнение до/после входит в проверку.
Новые разрешения, расчёты и CRM-правила не вводятся.

## Decision evidence
- product: [Принятое требование](/docs/requirements/03-абонементы-и-оплаты.md) — owner: владелец продукта, решение зарегистрировано в REQ; decision: REQ-SUB-010, изменение 05.10.2026: один обязательный абзац о дублировании для обеих разбивок без изменения расчётов.

## Scope
### In
- Только цель и перечисленное покрытие исходной задачи.
### Out
- Изменения backend-правил, несвязанные улучшения и перечисленное в исходной задаче Out of scope.

## Implementation slices
1. Перенести полный существующий абзац в общий родительский контекст обеих детализаций, убрав две локальные копии.
2. Обеспечить доступность общего пояснения при раскрытии каждой разбивки, не меняя таблицы, данные, расчёты и обязательный текст.
3. Обновить требования/CHANGELOG; зафиксировать до/после на пустом и заполненном отчёте.

## Likely files and layers
- `frontend/src/features/finance/FinanceReportsScreen.tsx` — затронутый компонент/ресурс или его существующие тесты.
- `frontend/src/resources/fe-15-finance.ts` — затронутый компонент/ресурс или его существующие тесты.

## Regression specification
### Automated tests to add or update
- Полный текст встречается ровно один раз и доступен при работе с обеими разбивками; значения итогов, атрибуция и строки не меняются. Проверить empty/populated, mobile/desktop.
- Расширить существующий `frontend/e2e/finance-reports.spec.ts` по сценарию; вспомогательный сценарный модуль не регистрировать как отдельный spec.
### Expected red evidence
- toHaveCount(1) для полного duplicatedBreakdownHint падает на отчёте с двумя заполненными разбивками.
### Required validation
- В task verification contract включить затронутый исполнимый spec и target-iPhone проекты; для сценарного модуля выбрать вызывающий spec.
### Manual evidence
- Сравнение до/после локальной правки, клавиатура и отдельная проверка доступности затронутого сценария. Непроверенные физический iPhone/Safari явно указать в evidence.
### Regression barrier
- Описанные пользовательские assertions выполняются в затронутом Playwright-сценарии на desktop и target-iPhone.

## Risks and stop conditions
- При необходимости нового поведения или изменения контракта вернуть план в подготовку до зависимых изменений.
- При завершении актуализировать состояние связанных требований и `docs/requirements/CHANGELOG.md`, сохранив не относящиеся к задаче незавершённые части.
