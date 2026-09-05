# TASK-109: Сделать Settings touch-safe и связать actions со scope

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-16 17:43
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/2026-08-22/TASK-109-settings-scope-touch-order.plan.md
- implementation_branch: fix/TASK-109-settings-scope-touch-order
- implementation_state: completed
- implementation_commit: 3e82859
- delivered_on_main_at: 2026-08-22
- moved_to_done_at: 2026-08-22
- last_status_reviewed_at: 2026-08-22

## Goal
Пользователь до нажатия `Создать` понимает активный раздел и филиал, а все частые controls настроек остаются достижимыми на touch и compact landscape.

## Context
На `440 x 956` settings tabs имеют высоту около `40px`, branch selector — `36px`. Create/refresh показаны раньше выбранного филиала каталога, поэтому визуальный task order не объясняет, к какому scope относится действие.

## User role
SuperAdministrator / HeadCoach / Administrator с разрешённым доступом к соответствующему разделу настроек.

## Problem
Недостаточные hit areas повышают риск промаха, а порядок `actions → scope` создаёт неоднозначность цели create/edit operations.

## Scope
- Увеличить hit area tabs, branch selector, refresh, create и edit до минимум `44 x 44px`.
- Перестроить active-tab toolbar в порядок `scope → actions → content` либо визуально и семантически связать actions с текущим scope.
- Сохранить один dominant primary action и менее заметный refresh.
- Определить focus order, keyboard interaction и compact-landscape behavior.
- Сохранить validation/recovery рядом с затронутым scope/action.
- Обновить component и Playwright regression coverage.

## Out of scope
- Изменение catalog/branch business rules, backend permissions или payload semantics.
- Добавление новых settings tabs, сущностей или фильтров.
- Изменение того, какой branch/entity создаётся текущим backend contract.
- Общий редизайн всех settings forms вне active-tab toolbar и touch targets.

## Constraints
- Backend и текущие form/API contracts определяют фактический scope и allowed actions.
- UI не должен выводить permissions из названия tab или роли.
- Active tab и branch selector сохраняют persistent accessible names и selected state.
- Fixed/sticky controls учитывают safe area, Safari chrome и software keyboard.
- Toolbar не создаёт горизонтальный page scroll и не скрывает primary action в overflow.

## Acceptance criteria
- [x] Tab, branch select, refresh, create и edit имеют hit area не меньше `44 x 44px`.
- [x] Active tab и branch однозначно определяют, к какому scope относится create/edit action.
- [x] Focus order следует визуальному и task order.
- [x] Create остаётся primary, refresh — frequent secondary и не конкурирует с ним визуально.
- [x] На `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420` и `956 x 440` primary action и validation/recovery остаются достижимыми.
- [x] Loading, empty, error, disabled, success и permission-restricted states сохраняют выбранный tab/branch.
- [x] Нет horizontal overflow или скрытой action-only строки.

## Test checklist
- [x] Добавить geometry assertions для tabs/select/actions на обязательных mobile размерах.
- [x] Добавить keyboard/focus-order assertions для `scope → actions → content`.
- [x] Проверить создание/редактирование в двух филиалах без изменения backend semantics.
- [x] Проверить loading/error/retry и validation в portrait и compact landscape.
- [x] Проверить long branch/entity names и software-keyboard reachability.

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: задача ограничена layout, hit areas и явным отображением уже существующего scope; catalog rules и permissions не меняются.

## Clarification questions
Не требуется: допустимы два implementation patterns, если выбранный вариант доказывает однозначную связь scope и actions и проходит измеримые acceptance criteria.

## Source notes
- Source file: `backlog/processed/2026-08-02.md`
- Original note: `UX-2026-08-02-08 — сделать Settings touch-safe и связать actions со scope`.
- Evidence: `backlog/processed/assets/2026-08-02-usability-audit/annotated-settings-440x956.png`.

## Processing notes
- Created at: 2026-08-02 14:44
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- Duplicate check: активного дубликата нет; завершённые TASK-084, TASK-093, TASK-094 и TASK-102 задают touch/toolbar/filter/anti-duplication baseline, но inventory не покрывал settings tabs/select и текущий scope order.
- Safety boundary: если фактическая create target semantics не соответствует выбранному branch, это отдельный risky contract bug, а не скрытая часть этой UI-задачи.

## Completion record
- Completed on: 2026-08-22.
- Test-first commit: `764d968`; implementation commit: `3e82859`; both integrated into local `main` by fast-forward.
- Expected red captured before production code: Settings tabs were `40px`, branch select `36px`, actions preceded scope, and branch retry/no-branch/stale-response/long-name/hall-action barriers failed.
- Integrated validation: frontend lint, production build, 468 unit tests, raw-color scan with 0 disallowed findings, 96 affected Chromium Playwright tests and 38 target-iPhone WebKit tests passed.
- Exact create branch scope and unchanged edit payload are covered for two branches; stale item responses cannot replace the selected catalog.
- Backend/API/database contracts were not changed; migration is not required.
- No Docker Compose task stack was created because the plan required frontend component and mocked browser validation only.
- Residual device risk: physical Safari chrome, software keyboard, actual safe areas, iOS Simulator and physical-device touch were not verified; target-iPhone WebKit portrait and compact-landscape profiles passed.
