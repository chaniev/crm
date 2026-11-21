# TASK-021: Проверить responsive и Playwright-покрытие карточки клиента

## Status
tasks-ready

## Requirements
- REQ-CLI-001 — verifies
- REQ-NFR-001 — verifies

## Goal
Карточка клиента и связанные form/detail сценарии стабильно работают на tablet и mobile после UI-изменений.

## Context
Нужно проверить detail/form сценарии на tablet и mobile после введения вкладок, убедиться, что действия карточки не переносятся хаотично и не перекрывают друг друга. Для заметных UX-изменений нужно добавить или обновить Playwright-тесты на поиск клиента, фильтры, открытие карточки, сохранение фильтров при возврате, quick actions и мобильный режим.

## User role
администратор / тренер

## Problem
После redesign карточки клиента возможны responsive-регрессии и поломки основных сценариев.

## Scope
- Проверить tablet/mobile layout client detail/form.
- Добавить или обновить Playwright coverage для перечисленных сценариев.
- Зафиксировать явные viewport sizes в тестах.
- Убедиться, что actions не перекрываются.

## Out of scope
- Реализация вкладок или quick actions в этой задаче.
- Изменение backend contracts.

## Constraints
- Тесты должны проверять пользовательские сценарии, а не внутреннюю структуру компонентов.
- Не делать flaky assertions на пиксельные детали без необходимости.

## Acceptance criteria
- [ ] Tablet и mobile viewports не имеют перекрытий действий.
- [ ] Playwright покрывает поиск, фильтры, открытие карточки и возврат с сохранением состояния.
- [ ] Playwright покрывает основные quick actions.
- [ ] Playwright покрывает мобильный режим карточки клиента.

## Test checklist
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Запустить frontend e2e checks по принятому проектному сценарию.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: low
- Reason: задача про verification и regression coverage frontend UI.

## Clarification questions
Продуктовых и архитектурных вопросов нет: TASK-018 и TASK-019 завершены. Сопоставление существующего покрытия с критериями TASK-021 — инженерная подготовка, а не согласование нового поведения.

## Source notes
- Source file: [2026-05-05.md](../processed/2026-05-05.md) (исторический путь: `backlog/inbox/2026-05-05.md`)
- Original note: `Responsive: проверить detail/form сценарии на tablet и mobile ... Для заметных UX-изменений добавить или обновить Playwright-тесты ...`

### Дополнение из аудита 20.11.2026

- Source file: [05-client-card](../processed/2026-11-20-interface-audit/05-client-card/README.md)
- Source file: [06-client-details](../processed/2026-11-20-interface-audit/06-client-details/README.md)
- Source file: [18-client-form](../processed/2026-11-20-interface-audit/18-client-form/README.md)
- Source file: [24-membership-renewal](../processed/2026-11-20-interface-audit/24-membership-renewal/README.md)
- Новые mobile/desktop снимки краткой, полной, новой карточки и оформления абонемента сохраняют исходное состояние для будущего сравнения.

## Processing notes
- Created at: 2026-05-07 11:26
- Created by skill: codex-backlog-skill
- Duplicate check: existing task folders were empty before processing; no duplicate found.

- Updated at: 2026-11-20 19:43 (Europe/Moscow); mode: triage, аудит интерфейса 20.11.2026.
- Это дополнительная база для регрессии после TASK-018/019, а не пройденная приёмка. Поиск CLI-01 выделен в TASK-204; его функциональное исправление не включать повторно.

## Planning review 2026-11-20
- Актуальность: Есть client-profile-context-navigation.spec.ts и iphone-target-devices.spec.ts, однако они не доказывают регрессионную защиту будущих вкладок TASK-019.
- Проверка: статический анализ текущего main и сохранённого аудита; новая runtime-приёмка не выполнялась.
- readiness: no — TASK-019 отложена владельцем; конечная структура карточки и её прототип не определены.
- implementation_plan: /backlog/implementation-plans/TASK-021-client-detail-responsive-regression.plan.md

## Status audit 2026-11-21
- needs-clarification: нужны реализация TASK-018 и согласование отложенной TASK-019; готовый план TASK-018 не означает завершение UI.
- Основание: локальная main, связанные планы и записи согласования; нового runtime-аудита не было.

### Повторная сверка 2026-11-21
- TASK-018 завершена и имеет регрессии четырёх экранов. Эта зависимость снята, остаётся TASK-019. Статус needs-clarification; закрытие всей задачи существующими тестами не доказано.
- Основание: текущая локальная main и сохранённые доказательства; новый runtime-аудит не выполнялся.

### Уточнение зависимости 21.11.2026

Владелец утвердил [макеты TASK-019](../mockups/TASK-019/README.md). Для сквозной приёмки остаётся зависимость от реализации вкладок.

21.11.2026 — зависимость от реализации TASK-019 снята. Остаётся определить дополнительное покрытие по [приёмке вкладок](../done/2026-11-21/TASK-019-evidence/acceptance.md).

### Итоговая сверка статуса 21.11.2026
- tasks-ready: блокер реализации вкладок TASK-019 снят; вкладки приняты на версии `654eec60`, проверены возврат к фильтрам/странице/строке, мобильная и планшетная геометрия, клавиатура и системная клавиатура Safari в Simulator.
- Остаток: сопоставить все критерии TASK-021 с тестами и результатами TASK-018/019/204, определить только недостающее покрытие. Проверки уже реализованных сценариев не дублировать.
- Полное выполнение TASK-021 пока не доказано; не закрыта и не переведена в реализацию. Её план остаётся черновиком до конкретизации остаточного покрытия.
