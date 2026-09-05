# TASK-110: Привести mobile profile trigger к touch contract

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-16 17:39
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/2026-08-16/TASK-110-mobile-profile-trigger-touch-target.plan.md
- implementation_branch: fix/TASK-110-mobile-profile-trigger-touch-target
- implementation_state: completed
- implementation_commit: 449ee76
- delivered_on_main_at: 2026-08-16
- moved_to_done_at: 2026-08-16
- last_status_reviewed_at: 2026-08-16

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
- [x] Profile trigger имеет hit area не меньше `44 x 44px` при ширинах `360`, `390`, `420` и `440px`.
- [x] Видимый avatar/icon и header rhythm не получают необоснованного увеличения.
- [x] Trigger сохраняет стабильное accessible name, visible focus, popup и expanded semantics.
- [x] Hit area не перекрывает соседние controls и доступна в portrait/compact landscape.
- [x] Touch-target inventory падает при возврате высоты ниже `44px`.

## Test checklist
- [x] Добавить profile trigger в geometry inventory на `360/390/420/440px`.
- [x] Проверить click/tap, Enter/Space, Escape и focus return из menu.
- [x] Проверить `aria-haspopup`, `aria-expanded` и accessible name.
- [x] Проверить отсутствие overlap и focus clipping в portrait/compact landscape.

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

## Completion record
- Completed on: 2026-08-16.
- Implementation commit: `449ee76`; integrated into local `main` by fast-forward at the same commit.
- Test-first evidence: до CSS-правки Chromium inventory падал на семи coarse-pointer viewport с фактическим box `48 x 42.375px`; оба target-iPhone WebKit profile tests падали на той же высоте.
- Validation on integrated `main`: frontend lint, production build, 449 unit tests, 12 Chromium touch-inventory tests and 36 target-iPhone WebKit tests passed.
- Responsive keyboard smoke: `390 x 844`, `912 x 420` and `1440 x 1200` passed Enter/Space, Escape, exact focus return and overflow checks in a one-time WebKit smoke.
- Data storage: backend, API and database structure were not changed; migration is not required.
- Runtime: no Docker Compose task stack was created because the plan required frontend component and mocked browser validation only.
- Residual device evidence: physical Safari chrome, actual safe-area/home-indicator behavior, iOS Simulator and physical-device touch checks were not performed; target-iPhone WebKit emulation passed.
