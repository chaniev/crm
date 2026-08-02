# TASK-111: Расширить Playwright-регрессию по UX-аудиту 2026-08-02

## Status
ready

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
- Assertions на behavior после изменений синхронизируются с утверждёнными задачами TASK-103–TASK-110; нерешённую product decision из TASK-103 нельзя угадывать.
- Target iPhone WebKit checks запускаются с touch enabled; page-level overflow проверяется отдельно от внутренней читаемости карточек.

## Acceptance criteria
- [ ] Attendance suite проверяет above-fold first action, читаемую дату, `44 x 44px` controls и отсутствие overflow на всей заданной matrix.
- [ ] Settings suite проверяет размеры tab/select/actions и focus order.
- [ ] Audit suite проверяет pagination accessible names/sizes и focus return для трёх способов закрытия.
- [ ] Schedule desktop suite проверяет доступность start/end, группы и зала/тренера для parallel events при `1440 x 1200`.
- [ ] Inventory включает profile trigger и обнаруживает hit area меньше `44 x 44px`.
- [ ] Тесты различают page overflow и потерю decision-data внутри сжатого элемента.
- [ ] Остаточные device-only проверки перечислены явно и не выдаются за пройденные.

## Test checklist
- [ ] Запустить affected Playwright specs в Chromium.
- [ ] Запустить target iPhone WebKit suite с touch enabled.
- [ ] Повторно запустить `e2e/touch-target-inventory.spec.ts`.
- [ ] Проверить стабильность focus assertions без arbitrary timeout.
- [ ] Запустить frontend lint и build после изменения test helpers/config.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: задача добавляет regression coverage и не меняет product/domain behavior; нерешённые product expectations явно вынесены в зависимости.

## Clarification questions
Не требуется для перечисленной matrix. Assertions на navigation naming добавляются только после разрешения TASK-103.

## Source notes
- Source file: `backlog/processed/2026-08-02.md`
- Original note: `UX-2026-08-02-10 — расширить регрессию на обнаруженные пробелы`.

## Processing notes
- Created at: 2026-08-02 14:44
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- Duplicate check: активного дубликата нет; TASK-021 покрывает client detail regression, а завершённая TASK-084 создала неполный representative inventory. Новая задача ограничена gap matrix аудита 2026-08-02.
- Dependency note: тесты могут добавляться вместе с соответствующими TASK-104/TASK-106–TASK-110; navigation assertions ждут продуктового решения TASK-103.
