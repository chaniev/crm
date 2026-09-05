# Implementation Plan: TASK-167 Переименовать действие расписания в «Посещение»

## Metadata
- source_task: /backlog/done/2026-09-01/TASK-167-schedule-attendance-label.md
- requirements: REQ-GRP-007 (changes)
- branch: feature/TASK-167-schedule-attendance-label
- readiness: yes
- dependencies: none — существующий `frontend/src/lib/resources.ts` позволяет выполнить локальную resource-backed правку независимо от TASK-165
- risk: low — меняются только видимая подпись и accessible name существующего schedule action; route, occurrence identity и disabled-reason copy остаются прежними

## Goal
Во всех responsive вариантах карточки расписания разрешённая кнопка точного занятия имеет видимую подпись и accessible name `Посещение`, использует один frontend resource и открывает прежний occurrence-based attendance route.

## Decisions and contracts
- Добавить один resource `resources.schedule.actions.attendance = 'Посещение'` и использовать его в responsive вариантах occurrence card; не создавать локальные дублирующие constants.
- Для occurrence card убрать отдельное `aria-label` с прежним текстом `Открыть посещаемость: …`: видимый resource становится exact accessible name `Посещение`, а тесты находят действие внутри конкретной карточки.
- Не менять строки причин недоступности с термином `Посещаемость`, названия раздела/рабочей области, route, callback arguments или backend contracts.

## Scope
### In
- Resource-backed label кнопки в mobile и desktop вариантах карточки расписания, component и affected Playwright assertions.

### Out
- Action на экране деталей занятия.
- Остальной inventory пользовательских строк (TASK-165), attendance terminology вне кнопки, backend и routing semantics.

## Implementation slices
1. Обновить component tests для occurrence card: exact accessible name `Посещение`, старый button label отсутствует, callback сохраняет `lessonOccurrenceId` и `lessonDate`; получить RED на текущей подписи.
2. Добавить schedule resource и подключить его к responsive вариантам occurrence card без изменения disabled reason/route behavior.
3. Обновить schedule Chromium и target-iPhone locators; подтвердить одинаковую подпись в mobile и desktop карточках и прежний переход к точному занятию.

## Likely files and layers
- `frontend/src/lib/resources.ts` — единый schedule action resource.
- `frontend/src/features/schedule/GroupScheduleScreen.tsx` — occurrence-card consumers.
- `frontend/src/features/schedule/GroupScheduleScreen.test.tsx` — exact label, отсутствие legacy button copy и callback identity.
- `frontend/e2e/group-schedule.spec.ts`, `frontend/e2e/iphone-target-devices.spec.ts` — responsive locator/navigation regression.

## Regression specification
### Automated tests to add or update
- Component (occurrence card): кнопка находится по exact name `Посещение`; `Посещаемость` отсутствует именно как button name; disabled reason остаётся неизменным.
- Component/navigation: click по новой подписи передаёт прежние `lessonOccurrenceId` и `lessonDate`.
- Playwright: mobile и desktop schedule card открывают прежний `/attendance/{lessonOccurrenceId}?lessonDate=…`; restricted action остаётся disabled и связан с прежней причиной.

### Expected red evidence
- Component и Playwright assertions падают на occurrence card, потому что production ещё показывает `Посещаемость` и переопределяет accessible name через `aria-label`.

### Required validation
- Affected `GroupScheduleScreen` unit tests, Chromium `group-schedule` flow и schedule slices target-iPhone projects.

### Manual evidence
- Rendered before/after одного разрешённого schedule row на mobile и desktop: геометрия и emphasis не изменились, изменилась только подпись.

### Regression barrier
- Один occurrence-navigation scenario на component + Playwright уровне: exact `Посещение` открывает тот же occurrence route на mobile и desktop.

## Risks and stop conditions
- Stop, если общий resource требует broad extraction или scanner/architecture change из TASK-165: TASK-167 должна ограничиться существующим resource module.
- Stop, если изменение accessible name ломает различимость действий вне семантического контекста карточки; решить scoped locator/association без возврата старой терминологии.
- Не заменять `Посещаемость` в disabled reasons или attendance workspace copy: это отдельные product-copy решения.

## Implementation result

- Completed at: 2026-09-01.
- Implementation commit: `36e1530`.
- Added the single `resources.schedule.actions.attendance` label, removed the
  occurrence-card-specific `aria-label`, and preserved occurrence/date routing
  plus existing disabled-reason copy.
- Validation: frontend baseline 647/647 unit tests; Chromium schedule 17/17;
  affected target-iPhone WebKit scenarios 4/4 across both profiles.
