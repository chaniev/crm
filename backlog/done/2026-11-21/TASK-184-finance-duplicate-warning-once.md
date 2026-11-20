# TASK-184: Убрать повтор предупреждения о дублях в финансовом отчёте

## Status
done

## Requirements
- REQ-SUB-010 — changes
- REQ-NFR-001 — constrains
- REQ-NFR-007 — constrains

## Requirement links
- [REQ-SUB-010](../../../docs/requirements/03-абонементы-и-оплаты.md) — changes
- [REQ-NFR-001](../../../docs/requirements/08-нефункциональные.md) — constrains
- [REQ-NFR-007](../../../docs/requirements/08-нефункциональные.md) — constrains

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
- [x] В одном отчёте нет двух копий полного абзаца; понятно, что он относится к обеим разбивкам.
- [x] Не изменены финансовые расчёты, атрибуция и данные.

## Test checklist
- [x] Обе разбивки, пустой и заполненный отчёт, mobile/desktop rendered before/after; предупреждение не теряется в доступном сценарии.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: low
- Reason: Устраняется повтор текста, а финансовая семантика и обязательное предупреждение сохраняются.

## Evidence
- [frontend/src/features/finance/FinanceReportsScreen.tsx](../../../frontend/src/features/finance/FinanceReportsScreen.tsx)
- [frontend/src/resources/fe-15-finance.ts](../../../frontend/src/resources/fe-15-finance.ts)

## Source notes
- Source file: [2026-09-30.md](../../processed/2026-09-30.md)
- Source items: 15 (порядок самостоятельных пунктов, без строк-продолжений).
- Источник наблюдений: UI-аудиты 18.09 и 30.09.2026, стенд c2b6cdf; в этом triage новый runtime-аудит не проводился.

> убрать дублирование дисклеймера о дублях в финансовом отчёте — длинный абзац повторяется перед «По тренерам» и «По группам»

### Дополнение из аудита 20.11.2026

- Source file: [10-finance](../../processed/2026-11-20-interface-audit/10-finance/README.md)
- FIN-01: один и тот же длинный абзац о дублировании повторён перед детализациями по тренерам и группам.

## Processing notes
- Created at: 2026-10-05 (MSK).
- Created by skill: codex-backlog-skill.
- Mode: triage; scope: два файла inbox, без глобальной сверки статусов.
- Duplicate check: TASK-108 меняла иерархию отчёта; TASK-165 переносила тексты. Этот локальный повтор остаётся в текущем коде.
- Проверены активные карточки, unfinished plans и рекурсивный done; новые ID выделены после TASK-171.

- Updated at: 2026-11-20 19:43 (Europe/Moscow); mode: triage, аудит интерфейса 20.11.2026.
- Локальный повтор уже покрыт этой задачей и REQ-SUB-010. Объединение/сокрытие самих разбивок и новый переключатель периода не включены; они остаются отложенными гипотезами.

## Planning review 2026-11-20
- Актуальность: FinanceReportsScreen передаёт duplicatedBreakdownHint дважды: duplicateHint для тренеров и для групп (строки 755 и 786 на момент проверки).
- Проверка: статический анализ текущего main и сохранённого аудита; новая runtime-приёмка не выполнялась.
- readiness: yes

## Implementation lifecycle
- moved_to_implementation_at: 2026-11-20
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/2026-11-21/TASK-184-finance-duplicate-warning-once.plan.md
- implementation_branch: codex/TASK-184-finance-duplicate-warning-once

## Completion
- completed_at: 2026-11-21
- completion_date_evidence: интеграция проверенной версии `8121918` в локальную main 2026-11-21.
- [Приёмка и ограничения проверки](TASK-184-evidence/acceptance.md)
