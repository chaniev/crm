# TASK-221: Объединять причины по всем абонементам в одной строке клиента

## Status
done

## Requirements
- REQ-ATTN-001 — implements

## Goal
Объединять причины по всем абонементам в одной строке клиента.

## Context
Владелец подтвердил одну строку клиента. Сейчас ClientAttentionEndpoints возвращает строку на каждый проблемный абонемент, а AttentionPanel отображает их по отдельности.

## Acceptance criteria
- [x] При двух истекающих абонементах и серии пропусков клиент виден один раз со всеми причинами.
- [x] После отметки «Связались» остаются причины по абонементам, видимые данные и действия соблюдают права роли.
- [x] Клиент только с истёкшим абонементом расположен раньше клиента только с серией пропусков.

## Source notes
[Сверка main 3e729130 и решения владельца от 21.11.2026](../2026-11-21/TASK-216-requirements-audit.md).

## Решение владельца о контракте

21.11.2026 владелец проекта выбрал «Согласовать единый выпуск API и интерфейса». В существующем Staff API одна запись соответствует клиенту, а у каждой абонементной причины есть свой тариф, продажа, группы и срок. Backend и frontend переходят на этот контракт вместе. [ADR-0009](../../../docs/architecture/adr/0009-client-attention-response.md).

## Implementation lifecycle
- moved_to_implementation_at: 2026-11-21 23:53
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/2026-11-22/TASK-221-attention-one-row-per-client.plan.md
- implementation_branch: fix/TASK-221-attention-one-row-per-client

## Completion
- completed_at: 2026-11-22
- completion_date_evidence: версия `dbdbe1a8` прошла контракт TASK-221 и интегрирована в локальную main 22 ноября. [Браузерная приёмка](TASK-221-evidence/acceptance.md).
