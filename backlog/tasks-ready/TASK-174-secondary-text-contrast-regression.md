# TASK-174: Восстановить контраст вторичного текста в рабочих экранах

## Status
tasks-ready

## Requirements
- REQ-NFR-001 — implements

## Requirement links
- [REQ-NFR-001](../../docs/requirements/08-нефункциональные.md) — implements

## Goal
Вторичный обычный текст на фактическом фоне карточек имеет контраст не ниже 4.5:1.

## Context
В исходном аудите указаны 3.02:1 для «Проверено» и 3.15:1 для пустых состояний. В текущем AttentionPanel остаётся Text c="dimmed". Эти коэффициенты — evidence исходного стенда, повторный замер в triage не выполнялся.

## Scope
- Воспроизвести пары foreground/background для «Проверено» и описаний пустых состояний в поддерживаемых темах.
- Исправить подтверждённые потребители/рецепты и добавить проверку фактически разрешённых цветов, включая прозрачность.

## Constraints
- Backend сохраняет владение CRM-правилами; triage не разрешает реализацию.
- Перед реализацией нужен ready plan по docs/HARNESS.md; для визуальных изменений — применимый design gate.
- При завершении обновить состояние связанных требований и docs/requirements/CHANGELOG.md.

## Acceptance criteria
- [ ] Обе указанные поверхности проходят 4.5:1; изменение не вводит локальную палитру.
- [ ] Есть rendered before/after и проверка поддерживаемых тем на desktop/mobile.

## Test checklist
- [ ] Контраст rendered-пар; затронутые empty/populated состояния и target-iPhone.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: low
- Reason: Локальная коррекция существующего контракта контраста без изменения CRM-правил.

## Evidence
- [frontend/src/features/attention/AttentionPanel.tsx](../../frontend/src/features/attention/AttentionPanel.tsx)
- [frontend/src/theme/contrastMatrix.ts](../../frontend/src/theme/contrastMatrix.ts)
- [docs/MOBILE_UI_CONTRACT.md](../../docs/MOBILE_UI_CONTRACT.md)

## Source notes
- Source file: [2026-09-30.md](../processed/2026-09-30.md)
- Source items: 3 (порядок самостоятельных пунктов, без строк-продолжений).
- Источник наблюдений: UI-аудиты 18.09 и 30.09.2026, стенд c2b6cdf; в этом triage новый runtime-аудит не проводился.

> довести контраст вторичного текста до 4.5:1: «Проверено: …» на дашборде 3.02:1, подписи пустых состояний 3.15:1 (серый rgb(134,142,150) на фоне карточек)

## Processing notes
- Created at: 2026-10-05 (MSK).
- Created by skill: codex-backlog-skill.
- Mode: triage; scope: два файла inbox, без глобальной сверки статусов.
- Duplicate check: TASK-142 завершила матрицу theme tokens, но не доказывает соответствие всех c="dimmed" consumers. TASK-150 — широкая миграция primitives; здесь только подтверждённый дефект контраста.
- Проверены активные карточки, unfinished plans и рекурсивный done; новые ID выделены после TASK-171.
