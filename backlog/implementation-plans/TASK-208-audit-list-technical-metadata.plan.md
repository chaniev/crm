# Implementation Plan: TASK-208 Убрать технические метаданные из рабочих строк журнала

## Metadata
- source_task: /backlog/needs-clarification/TASK-208-audit-list-technical-metadata.md
- requirements: REQ-AUD-002 (changes); REQ-NFR-001 (constrains)
- branch: codex/TASK-208-audit-list-technical-metadata
- readiness: no — Требуется согласование проверенного прототипа строки журнала.
- product_decisions: accepted
- technical_decisions: none — локальная доработка существующих компонентов; новый архитектурный механизм не вводится
- architecture_decisions: none — границы слоёв и API не меняются
- open_questions: Требуется согласование проверенного прототипа строки журнала.
- dependencies: TASK-185 — неизвестные enum вне scope
- risk: medium — Требуется согласование проверенного прототипа строки журнала.

## Goal
Журнал сканируется по времени, человеческому описанию и автору; технические данные доступны в деталях.

## Relevance evidence
buildAuditEntryPresentation формирует contextParts из action/entity и добавляет entityId/source; это подтверждает встроенные метаданные AUD-01, несмотря на завершённое удаление отдельных колонок.
Проверены активные карточки и незавершённые планы; выбранные ID не имеют завершённых карточек-дублей. Статическое доказательство не заменяет runtime-приёмку.

## Decisions and contracts
Принятые границы и ожидаемое поведение заданы Requirements и Acceptance criteria исходной задачи.
Это черновик. Открытые решения в Metadata не считаются согласованными и блокируют исполнение всех зависимых этапов.
Новые разрешения, расчёты и CRM-правила не вводятся.

## Decision evidence
Решение владельца в текущем чате 20.11.2026: прототипов нет; TASK-019 пропустить для отдельного разбора. Это подтверждает блокеры, а не согласование UX.
- product: [Исходная задача](/backlog/needs-clarification/TASK-208-audit-list-technical-metadata.md) — owner: владелец продукта; decision: принятый объём ограничен Requirements и Acceptance criteria; открытые вопросы не утверждены.

- 21.11.2026 — владелец подтвердил показ источника `Web` только в деталях записи. [Решение в карточке](../needs-clarification/TASK-208-audit-list-technical-metadata.md#решение-владельца-2026-11-21).

## Scope
### In
- Только цель и перечисленное покрытие исходной задачи.
### Out
- Изменения backend-правил, несвязанные улучшения и перечисленное в исходной задаче Out of scope.

## Implementation slices
1. По согласованному прототипу убрать технические action/entity/UUID и метку источника `Web` из рабочей строки, сохранив полные значения в доступных деталях.
2. Сохранить время, описание, отдельного автора, фильтры, пагинацию и доступность открытия/закрытия деталей.
3. Добавить регрессию содержимого строки и неизменности деталей; обновить REQ/CHANGELOG.

## Likely files and layers
- `frontend/src/features/audit/AuditLogScreen.tsx` — затронутый компонент/ресурс или его существующие тесты.

## Regression specification
### Automated tests to add or update
- Рабочая строка не содержит UUID и технических action/entity, детали содержат исходные значения; длинные описания/авторы, различные источники, пустая выдача, пагинация, Escape и возврат фокуса.
- Для веб-события проверить на телефоне и компьютере, что метка источника `Web` скрыта в строке и видна в деталях.
- Расширить существующий `frontend/e2e/audit-access-scenarios.ts` по сценарию; вспомогательный сценарный модуль не регистрировать как отдельный spec.
### Expected red evidence
- Assertion отсутствия UUID в пределах строки падает на contextParts текущего buildAuditEntryPresentation; детали должны продолжать проходить проверки.
### Required validation
- В task verification contract включить затронутый исполнимый spec и target-iPhone проекты; для сценарного модуля выбрать вызывающий spec.
### Manual evidence
- После согласования — сравнение реализации с проверенным прототипом, клавиатура и отдельная проверка доступности затронутого сценария. Непроверенные физический iPhone/Safari явно указать в evidence.
### Regression barrier
- Описанные пользовательские assertions выполняются в затронутом Playwright-сценарии на desktop и target-iPhone.

## Risks and stop conditions
- Требуется согласование проверенного прототипа строки журнала. До снятия блокера код не менять.
- При завершении актуализировать состояние связанных требований и `docs/requirements/CHANGELOG.md`, сохранив не относящиеся к задаче незавершённые части.
