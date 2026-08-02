# TASK-110: Привести mobile profile trigger к touch contract

## Status
ready

## Goal
Пользователь надёжно открывает профильное меню одним касанием, не меняя визуальный ритм mobile header.

## Context
Live measurement на проверенных mobile-экранах показал размер profile trigger `48 x 42px`. Существующий touch inventory проходит, потому что не включает этот shared control. TASK-084 ввёл общий touch baseline, поэтому новая задача является точечным regression follow-up.

## User role
Любой авторизованный пользователь.

## Problem
Высота интерактивной зоны меньше проектного минимума `44px`, а automated inventory не защищает control от повторной регрессии.

## Scope
- Увеличить фактическую hit area shared profile trigger минимум до `44 x 44px`.
- Сохранить текущий видимый размер avatar/icon и header rhythm, если это не мешает hit area.
- Сохранить visible focus, accessible name, popup и expanded semantics.
- Добавить profile trigger в touch-target inventory и affected mobile tests.

## Out of scope
- Изменение содержимого profile menu, auth/session semantics или navigation destinations.
- Визуальный редизайн header/avatar.
- Изменение других touch controls, уже покрытых TASK-084, кроме необходимого shared regression test.

## Constraints
- Hit area не должна перекрывать соседние header controls или создавать accidental activation.
- Trigger остаётся доступным при safe area, Safari chrome и compact height.
- Visible focus не обрезается контейнером header.
- Popup relationship и `aria-expanded` синхронизируются с реальным состоянием menu.

## Acceptance criteria
- [ ] Profile trigger имеет hit area не меньше `44 x 44px` при ширинах `360`, `390`, `420` и `440px`.
- [ ] Видимый avatar/icon и header rhythm не получают необоснованного увеличения.
- [ ] Trigger сохраняет стабильное accessible name, visible focus, popup и expanded semantics.
- [ ] Hit area не перекрывает соседние controls и доступна в portrait/compact landscape.
- [ ] Touch-target inventory падает при возврате высоты ниже `44px`.

## Test checklist
- [ ] Добавить profile trigger в geometry inventory на `360/390/420/440px`.
- [ ] Проверить click/tap, Enter/Space, Escape и focus return из menu.
- [ ] Проверить `aria-haspopup`, `aria-expanded` и accessible name.
- [ ] Проверить отсутствие overlap и focus clipping в portrait/compact landscape.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: локальная geometry/accessibility correction shared frontend control без изменения auth или profile behavior.

## Clarification questions
Не требуется.

## Source notes
- Source file: `backlog/processed/2026-08-02.md`
- Original note: `UX-2026-08-02-09 — привести profile trigger к touch contract`.

## Processing notes
- Created at: 2026-08-02 14:44
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- Duplicate check: активного дубликата нет; завершённая TASK-084 задала общий touch contract, но её representative inventory не включает profile trigger.
- Scope is intentionally local: один shared control и его regression barrier.
