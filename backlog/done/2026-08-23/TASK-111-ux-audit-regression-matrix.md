# TASK-111: Расширить Playwright-регрессию по UX-аудиту 2026-08-02

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-16 17:34
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/2026-08-23/TASK-111-ux-audit-regression-matrix.plan.md
- implementation_branch: fix/TASK-111-ux-audit-regression-matrix
- implementation_state: completed
- implementation_commit: 5e16840
- delivered_on_main_at: 2026-08-23
- moved_to_done_at: 2026-08-23
- last_status_reviewed_at: 2026-08-23

## Goal
Автоматические suites обнаруживают подтверждённые mobile/desktop регрессии attendance, settings, audit, schedule и shared profile trigger вместо формального прохождения неполного inventory.

## Context
Перед аудитом `npm run test:e2e:iphone` прошёл `32/32`, а `e2e/touch-target-inventory.spec.ts` — `12/12`, хотя UI сохранял date collapse, below-fold attendance action, `32 x 32px` audit pagination, недоступный modal focus return, undersized settings/profile controls и нечитаемые parallel schedule cards. Текущие suites проверяют только representative controls и не покрывают полный task matrix.

## User role
Система / разработчик; проверяемые сценарии выполняются под Coach, Administrator и HeadCoach согласно backend-разрешённому scope.

## Problem
Зелёные E2E suites создают ложный сигнал качества, потому что не проверяют decision-data, focus recovery и geometry controls, обнаруженные живым аудитом.

## Scope
- Расширить существующие Playwright suites и touch inventory, переиспользуя текущие fixtures/helpers.
- Добавить attendance matrix: `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420`, `956 x 440`.
- Добавить settings tab/select touch targets и keyboard/task order.
- Добавить audit pagination names/sizes и focus return для Escape, overlay и explicit close.
- Добавить desktop schedule assertion на decision-data parallel events при `1440 x 1200`.
- Добавить shared profile trigger в inventory.
- Сохранить проверку отсутствия horizontal page overflow.

## Out of scope
- Реализация функциональных UI-исправлений из TASK-103–TASK-110.
- Дублирование component tests или backend domain tests.
- Заявление о физическом iPhone/Safari acceptance только на основании emulation.
- Хрупкие screenshot-only assertions без behavior/geometry contract.

## Constraints
- Tests должны проверять пользовательский результат и стабильные accessibility/geometry contracts, а не внутренние CSS class names.
- Role data и allowed routes берутся из существующих backend/test contracts, без локального дублирования permission matrix.
- Assertions на behavior после изменений синхронизируются с утверждёнными
  задачами TASK-103–TASK-110. Целевая navigation model TASK-103 утверждена, но
  assertions на неё добавляются только вместе с реализацией этого contract, а
  не против текущего merged-home baseline.
- Target iPhone WebKit checks запускаются с touch enabled; page-level overflow проверяется отдельно от внутренней читаемости карточек.

## Acceptance criteria
- [x] Attendance suite проверяет above-fold first action, читаемую дату, `44 x 44px` controls и отсутствие overflow на всей заданной matrix.
- [x] Settings suite проверяет размеры tab/select/actions и focus order.
- [x] Audit suite проверяет pagination accessible names/sizes и focus return для трёх способов закрытия.
- [x] Schedule desktop suite проверяет доступность start/end, группы и зала/тренера для parallel events при `1440 x 1200`.
- [x] Inventory включает profile trigger и обнаруживает hit area меньше `44 x 44px`.
- [x] Тесты различают page overflow и потерю decision-data внутри сжатого элемента.
- [x] Остаточные device-only проверки перечислены явно и не выдаются за пройденные.

## Test checklist
- [x] Запустить affected Playwright specs в Chromium.
- [x] Запустить target iPhone WebKit suite с touch enabled.
- [x] Повторно запустить `e2e/touch-target-inventory.spec.ts`.
- [x] Проверить стабильность focus assertions без arbitrary timeout.
- [x] Запустить frontend lint и build после изменения test helpers/config.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: задача добавляет regression coverage и не меняет product/domain behavior; dependency-gated product expectations явно вынесены из её scope.

## Clarification questions
Не требуется для перечисленной matrix. Navigation model TASK-103 разрешена
2026-08-19; assertions на неё добавляются вместе с реализацией TASK-103 и не
входят в текущий test-only scope TASK-111.

## Source notes
- Source file: `backlog/processed/2026-08-02.md`
- Original note: `UX-2026-08-02-10 — расширить регрессию на обнаруженные пробелы`.

## Processing notes
- Created at: 2026-08-02 14:44
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- Duplicate check: активного дубликата нет; TASK-021 покрывает client detail regression, а завершённая TASK-084 создала неполный representative inventory. Новая задача ограничена gap matrix аудита 2026-08-02.
- Dependency note: тесты могут добавляться вместе с соответствующими
  TASK-104/TASK-106–TASK-110; navigation assertions ждут реализации
  утверждённого contract TASK-103.
