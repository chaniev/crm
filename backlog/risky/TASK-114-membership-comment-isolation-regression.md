# TASK-114: Исправить изоляцию комментариев абонементов

## Status
risky

## Goal
Комментарий сохраняется и отображается только у выбранной продажи абонемента, не подменяя комментарии других абонементов клиента.

## Context
Завершённая TASK-069 ввела комментарий на уровне стабильной `ClientMembershipSale`, автора и серверное время изменения. Текущий frontend отправляет `clientId` и `saleId`, а backend хранит comment attribution у продажи.

Новая заметка сообщает, что комментарий фактически выглядит общим для всех абонементов. Это повторная регрессия или ошибка read/write mapping, identity либо rendering, а не новая client-level note feature.

## User role
Администратор / главный тренер.

## Problem
При нескольких абонементах клиента пользователь не может надёжно понять, к какой продаже относится комментарий, и рискует изменить рабочий контекст другого абонемента.

## Scope
- Воспроизвести проблему на клиенте минимум с двумя разными `saleId` и разными комментариями.
- Проверить persistence, details response, frontend mapping, React keys и update request для каждого `saleId`.
- Исправить подтверждённый слой без изменения sale/payment/refund/validity semantics.
- Сохранить один комментарий на стабильную продажу; технические версии одной продажи не получают независимые комментарии.
- Сохранить backend permissions, audit event, автора и серверное время последнего изменения.
- Добавить regression coverage для update, reload и независимого отображения двух продаж.

## Out of scope
- Общая заметка клиента из TASK-023/TASK-068.
- `professionalComment` и правила professional membership.
- Комментарий отдельно для каждой технической версии одной продажи.
- Изменение финансовых данных или redesign карточки клиента.

## Constraints
- Backend владеет membership identity, permissions и audit semantics.
- Исправление не должно менять `ClientMembershipSale`, payment, refund, write-off или validity побочно.
- Ошибка update должна оставлять оба прежних комментария и показывать row-local recovery.
- Contract change требует обновить всех потребителей и затронутые tests.

## Acceptance criteria
- [ ] Два абонемента с разными `saleId` могут иметь разные комментарии одновременно.
- [ ] Изменение комментария первой продажи не меняет вторую до и после reload.
- [ ] Все технические версии одной продажи показывают один sale-level комментарий.
- [ ] Видны корректные автор и дата/время именно изменённой продажи.
- [ ] Forbidden и validation errors не оставляют частичных изменений и не подменяются общей ошибкой.
- [ ] Финансовые, временные и attendance-поля обеих продаж остаются неизменными.

## Test checklist
- [x] Добавить backend integration test с двумя продажами, update одной и reload из БД.
- [x] Проверить audit event, actor и permission denial.
- [x] Добавить frontend test на два `saleId`, независимые формы, success и row-local error.
- [x] Запустить backend tests, frontend lint, build, unit tests и affected Playwright scenario.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: регрессия затрагивает membership persistence, stable sale identity, permissions и audit рядом с финансовой сущностью.

## Clarification questions
Не требуется: целевой sale-level контракт зафиксирован завершённой TASK-069; точный root cause определяется диагностикой.

## Source notes
- Source file: `backlog/inbox/2026-08-16.md`
- Original note: `Комментарий к конкретному абонементу (сейчас он общий для абонементов в целом)`

## Processing notes
- Created at: 2026-08-16 16:45
- Created by skill: codex-backlog-skill
- Duplicate check: активного дубликата нет; завершённая TASK-069 является целевым baseline, а новая заметка фиксирует повторную регрессию её acceptance contract.

## Implementation investigation — 2026-08-23
- Exact PostgreSQL/API, mapper, component, desktop Chromium and target-iPhone
  WebKit scenarios are green on current `origin/main`.
- Regression coverage now proves two distinct sales, two technical versions of
  sale A, fresh GET/new `DbContext`, safe audit, immutable financial/refund/
  attendance state, row-local drafts/errors/retry and stable sale identity.
- No production code was changed: the implementation plan's green-on-main stop
  condition applies and there is no failing deployment/version evidence.
- TASK-114 remains `risky` and open until the reported environment supplies
  sanitized deployed frontend/backend identifiers plus GET/PUT sale identity
  evidence for version/deployment reconciliation.
