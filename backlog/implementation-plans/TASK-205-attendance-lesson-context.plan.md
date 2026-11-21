# Implementation Plan: TASK-205 Сохранять группу и время в посещаемости занятия

## Metadata
- source_task: /backlog/needs-clarification/TASK-205-attendance-lesson-context.md
- requirements: REQ-ATT-001 (implements); REQ-ATT-002 (constrains); REQ-NFR-001 (constrains)
- branch: codex/TASK-205-attendance-lesson-context
- readiness: no — Ожидаются выбор владельца по проверенному прототипу и подтверждение read-контракта LessonOccurrence для прямого открытия.
- product_decisions: accepted
- technical_decisions: none — локальная доработка существующих компонентов; read-контракт контекста ещё не принят
- architecture_decisions: none — необходимость ADR оценить после определения read-контракта
- open_questions: Ожидаются выбор владельца по проверенному прототипу и подтверждение read-контракта LessonOccurrence для прямого открытия.
- dependencies: none
- risk: medium — Ожидаются выбор владельца по проверенному прототипу и подтверждение read-контракта LessonOccurrence для прямого открытия.

## Goal
Перед отметкой пользователь видит, какую группу и конкретное занятие он открыл, и может вернуться к выбору.

## Relevance evidence
AttendanceScreen получает lessonOccurrenceId/lessonDate, отключает общую шапку showHeader=false и открывает AttendanceWorkspace; текущий target не несёт названия и времени. Это согласуется с сохранённым аудитом исчезновения контекста.
Проверены активные карточки и незавершённые планы; выбранные ID не имеют завершённых карточек-дублей. Статическое доказательство не заменяет runtime-приёмку.

## Decisions and contracts
Принятые границы и ожидаемое поведение заданы Requirements и Acceptance criteria исходной задачи.
Это черновик. Открытые решения в Metadata не считаются согласованными и блокируют исполнение всех зависимых этапов.
Новые разрешения, расчёты и CRM-правила не вводятся.

## Decision evidence
Решение владельца в текущем чате 20.11.2026: прототипов нет; TASK-019 пропустить для отдельного разбора. Это подтверждает блокеры, а не согласование UX.
- product: [Исходная задача](/backlog/needs-clarification/TASK-205-attendance-lesson-context.md) — owner: владелец продукта; decision: принятый объём ограничен Requirements и Acceptance criteria; открытые вопросы не утверждены.

- design: [Прототип и проверка от 21.11.2026](../mockups/TASK-205-attendance-lesson-context/README.md). Вариант представлен владельцу для выбора.

## Scope
### In
- Только цель и перечисленное покрытие исходной задачи.
### Out
- Изменения backend-правил, несвязанные улучшения и перечисленное в исходной задаче Out of scope.

## Implementation slices
1. По согласованному read-контракту загрузить контекст именно указанного LessonOccurrence, отобразить согласованную шапку и явный возврат.
2. Поддержать прямой вход, загрузку и ошибку контекста; сохранить roster, отметки и восстановление списка.
3. Добавить регрессию различения занятий и обновить REQ/CHANGELOG.

## Likely files and layers
- `frontend/src/features/attendance/AttendanceScreen.tsx` — затронутый компонент/ресурс или его существующие тесты.
- `frontend/src/lib/api/attendance.ts` — затронутый компонент/ресурс или его существующие тесты.

## Regression specification
### Automated tests to add or update
- Два занятия одной группы за день, одинаковое время разных групп, перенесённое/разовое занятие, direct URL, ошибка загрузки, длинное название; snapshot сохранённых посещений и ограничения даты прежние.
- Расширить существующий `frontend/e2e/attendance.spec.ts` по сценарию; вспомогательный сценарный модуль не регистрировать как отдельный spec.
### Expected red evidence
- При прямом открытии assertion на название и время конкретного occurrence выявляет отсутствующий контекст; окончательный fixture зависит от принятого read-контракта.
### Required validation
- В task verification contract включить затронутый исполнимый spec и target-iPhone проекты; для сценарного модуля выбрать вызывающий spec.
### Manual evidence
- После согласования — сравнение реализации с проверенным прототипом, клавиатура и отдельная проверка доступности затронутого сценария. Непроверенные физический iPhone/Safari явно указать в evidence.
### Regression barrier
- Описанные пользовательские assertions выполняются в затронутом Playwright-сценарии на desktop и target-iPhone.

## Risks and stop conditions
- Ожидаются выбор владельца по проверенному прототипу и подтверждение read-контракта LessonOccurrence для прямого открытия. До снятия блокера код не менять.
- При завершении актуализировать состояние связанных требований и `docs/requirements/CHANGELOG.md`, сохранив не относящиеся к задаче незавершённые части.
