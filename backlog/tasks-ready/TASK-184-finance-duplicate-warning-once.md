# TASK-184: Убрать повтор предупреждения о дублях в финансовом отчёте

## Status
tasks-ready

## Requirements
- REQ-SUB-010 — changes
- REQ-NFR-001 — constrains
- REQ-NFR-007 — constrains

## Requirement links
- [REQ-SUB-010](../../docs/requirements/03-абонементы-и-оплаты.md) — changes
- [REQ-NFR-001](../../docs/requirements/08-нефункциональные.md) — constrains
- [REQ-NFR-007](../../docs/requirements/08-нефункциональные.md) — constrains

## Goal
Смысл возможного дублирования в детализации объясняется один раз и относится к обеим разбивкам.

## Context
FinanceReportsScreen передаёт один duplicatedBreakdownHint в два блока — по тренерам и группам. Само предупреждение обязательно по REQ-SUB-010.

## Scope
- Показать полный существующий текст один раз в общем контексте детализаций.
- Сохранить доступность предупреждения при текущем переключении/раскрытии разбивок и канонические backend итоги.

## Constraints
- Backend сохраняет владение CRM-правилами; triage не разрешает реализацию.
- Перед реализацией нужен ready plan по docs/HARNESS.md; для визуальных изменений — применимый design gate.
- При завершении обновить состояние связанных требований и docs/requirements/CHANGELOG.md.

## Acceptance criteria
- [ ] В одном отчёте нет двух копий полного абзаца; понятно, что он относится к обеим разбивкам.
- [ ] Не изменены финансовые расчёты, атрибуция и данные.

## Test checklist
- [ ] Обе разбивки, пустой и заполненный отчёт, mobile/desktop rendered before/after; предупреждение не теряется в доступном сценарии.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: low
- Reason: Устраняется повтор текста, а финансовая семантика и обязательное предупреждение сохраняются.

## Evidence
- [frontend/src/features/finance/FinanceReportsScreen.tsx](../../frontend/src/features/finance/FinanceReportsScreen.tsx)
- [frontend/src/resources/fe-15-finance.ts](../../frontend/src/resources/fe-15-finance.ts)

## Source notes
- Source file: [2026-09-30.md](../processed/2026-09-30.md)
- Source items: 15 (порядок самостоятельных пунктов, без строк-продолжений).
- Источник наблюдений: UI-аудиты 18.09 и 30.09.2026, стенд c2b6cdf; в этом triage новый runtime-аудит не проводился.

> убрать дублирование дисклеймера о дублях в финансовом отчёте — длинный абзац повторяется перед «По тренерам» и «По группам»

## Processing notes
- Created at: 2026-10-05 (MSK).
- Created by skill: codex-backlog-skill.
- Mode: triage; scope: два файла inbox, без глобальной сверки статусов.
- Duplicate check: TASK-108 меняла иерархию отчёта; TASK-165 переносила тексты. Этот локальный повтор остаётся в текущем коде.
- Проверены активные карточки, unfinished plans и рекурсивный done; новые ID выделены после TASK-171.
