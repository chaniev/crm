# TASK-200: Разделение компонента расписания

## Metadata
- source_task: /backlog/implementation/TASK-200-schedule-screen-decomposition.md
- branch: codex/TASK-200-schedule-screen-decomposition
- readiness: yes
- requirements: none — локальное извлечение компонентов и hooks без изменения наблюдаемого поведения
- product_decisions: none — пользовательские сценарии и визуальный контракт не меняются
- technical_decisions: none — локальные обратимые модули в существующей feature, без нового механизма
- architecture_decisions: none — границы слоёв, shared contracts и runtime не меняются; обязательный refactoring review перед readiness
- open_questions: none
- dependencies: TASK-199 — локальная main bc15d037c9412d11e4e16fb39e4e6886ff3a38ac, использовать её как verification base для этого последовательного шага; итоговый aggregate pass от origin/main после всех шагов
- risk: medium — lifetime guards и точное сохранение history/focus behavior

## Decisions and contracts
[Source task](/backlog/implementation/TASK-200-schedule-screen-decomposition.md) фиксирует авторизацию и сохранение поведения. Извлечь существующий код по владельцу состояния; общие presentation helpers только при фактическом совместном использовании. Сохранить route exports GroupScheduleScreen для текущих callers/mocks. Rollback — revert task commit.

## Decision evidence
[Source and authorization](/backlog/implementation/TASK-200-schedule-screen-decomposition.md): owner — project user; execute the proposed sequential refactoring. This slice preserves product and technical contracts through local reversible extraction; independent planning review below confirms no additional owner decision is required.

## Implementation slices
1. Подтвердить существующие component tests. Добавить только отсутствующий существенный regression barrier для игнорирования устаревшего calendar response, если review подтвердит пробел; он должен проходить на исходном коде. Искусственный red неприменим к сохранению поведения.
2. Извлечь ScheduleSeriesEditScreen и ScheduleTrainerSubstitutionDrawer вместе с их drafts, field mappings, preview panels и private helpers. Избегать обратных imports в основной screen.
3. Отделить URL state/date helpers и загрузку календаря с abort/first-load/stale semantics. Восстановление focus/scroll оставить рядом с DOM.
4. Независимый review, локальный candidate commit, полный task-aware frontend harness на чистом SHA; FF main только после успешных проверок.

## Regression specification
GroupScheduleScreen.test.tsx, App.test.tsx, groupScheduleReturnState tests защищают routing, dirty/stale previews, guards и restoration. Browser barrier: group-schedule.spec.ts на Chromium, group-schedule-workflow.spec.ts на Chromium и двух target-iPhone WebKit profiles, iphone-target-devices.spec.ts на обоих WebKit profiles. Новых UI contracts, device claims и perf claims нет.

## Risks and stop conditions
Новый UX, общий state/fetch framework, изменение backend allowances или contract возвращают affected plan к planning. Не объединять разные load effects лишь по сходству текста. Не менять порядок actions, dependencies и cleanup guards при извлечении.

## Planning review — 2026-11-17
Independent review found no blockers or new material decision. TASK-182 owns an unrelated day-summary label change; do not include it. Preserve the always-mounted substitution drawer and its null-render behavior, without new keys or conditional mounts. Add a passing pre-refactor characterization that delayed obsolete calendar responses cannot overwrite the newer URL selection. Existing abort and signal guards already enforce this contract.
