# TASK-157: Уплотнить мобильное расписание по утверждённому макету

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-30 00:30
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/TASK-157-schedule-mobile-density.plan.md
- implementation_branch: feature/TASK-157-schedule-mobile-density
- verification_contract: /backlog/done/TASK-157-schedule-mobile-density-verification-contract.json
- integrated_to_main_at: 2026-08-30
- candidate_commit: 8b665350f8dc11d07f1d0508b9fb0750ecf78c3d

## Requirements
- REQ-GRP-007 — changes
- REQ-GRP-005 — constrains
- REQ-NFR-001 — constrains
- REQ-ATT-006 — constrains

## Goal
На мобильном экране расписания тренер или администратор видит больше занятий
без потери различающих данных и быстрее находит нужную группу, филиал, зал,
тренера и доступное действие посещаемости.

## Context
После интеграции TASK-133 текущий `/schedule` корректно группирует занятия по
времени, оставляет `Посещаемость`, `Изменить` и `Ещё`, сохраняет контекст и
проходит target-iPhone checks. Повторный rendered review на iPhone Air
`420 x 912` с 14 занятиями показал оставшиеся проблемы:

- в первом viewport полностью помещаются только две карточки и часть третьей;
- крупная кнопка `Посещаемость` повторяется в каждой карточке и конкурирует с
  create и active navigation;
- филиал, зал и тренер визуально слабее, чем вторичные badges;
- верхний date/summary/filter блок расходует избыточную высоту;
- шеврон вниз на body карточки выглядит как раскрытие на месте, хотя открывает
  отдельный экран.

Пользователь утвердил follow-up макет с компактными строками внутри временной
группы. Backlog-owned visual contract и ссылка на интерактивный источник:
[backlog/mockups/TASK-157-schedule-mobile-density/README.md](../mockups/TASK-157-schedule-mobile-density/README.md).

## User role
Тренер / администратор / главный тренер / суперадминистратор в пределах
разрешённого backend schedule scope; целевой контекст — частое использование
одной рукой на iPhone Air.

## Problem
Текущая mobile-композиция технически адаптивна, но плотность и визуальная
иерархия замедляют поиск занятия в длинном дневном списке. Повторяющиеся
surface, badges и заполненные action-кнопки занимают больше места, чем данные,
по которым пользователь различает занятия.

## Scope
- Реализовать утверждённый компактный mobile-вариант `/schedule` для
  `360–440px`, сохранив текущую dated occurrence model, time grouping и
  wide-screen behavior.
- Представить занятия внутри точного временного интервала как компактные
  task-oriented строки с тихими разделителями вместо набора высоких
  самостоятельных карточек.
- Сохранить видимыми в collapsed row: название группы, филиал, зал, тренера,
  один нейтральный attendance status, `Посещаемость` и `Ещё`.
- Убрать из collapsed mobile row badges типа группы и регулярности; эти данные
  остаются доступны в detail и не удаляются из API/модели.
- Перенести разрешённое `Изменить` в `Ещё` на mobile; desktop-вариант может
  сохранить существующую secondary action.
- Оставить `Посещаемость` видимой frequent action, но использовать secondary
  visual emphasis, чтобы повторяющиеся строки не создавали много конкурирующих
  primary surfaces. Доступность действия и disabled reason по-прежнему
  определяются backend contract.
- Заменить affordance открытия detail с шеврона вниз на направленный вправо
  переход; body строки остаётся отдельным keyboard/touch action.
- Собрать дату, weekday, count и filter trigger в более компактную иерархию:
  date navigation и create остаются в одной строке, filter имеет видимую
  подпись и показывает active state.
- Сохранить текущие URL-backed `date`, `view`, filters, refresh/back-forward и
  scroll/return context.
- Добавить component, responsive Chromium и target-iPhone WebKit regression
  coverage для новой плотности, action hierarchy и long-content behavior.

## Out of scope
- Изменение backend API, базы данных, occurrence, recurrence, conflict,
  cancellation, substitution, permission или attendance semantics.
- Новые frontend-owned состояния `Сейчас`, `Следующее`, `Просрочено`,
  `Требует отметки` или правила обязательности посещаемости.
- Изменение состава и порядка mobile bottom navigation.
- Материальный redesign desktop/week grid, detail/create/edit/move screens.
- Удаление group type, recurrence source или mutation actions из detail/menu.
- Реализация TASK-131 или изменение group-type filter contract.

## Constraints
- Backend остаётся source of truth для данных, разрешённых действий, причин
  недоступности и neutral attendance state.
- Новый визуальный контракт уточняет TASK-133, но не откатывает time grouping,
  deferred destructive actions, focus return или context restoration.
- Mantine, Onest, semantic tokens и shared CRM controls обязательны; production
  код не копирует HTML/CSS интерактивного концепта напрямую.
- Все независимые touch targets, включая `Ещё`, date navigation и create,
  имеют минимум `44 x 44px` и интервал минимум `8px`. Это требование имеет
  приоритет над уменьшенной геометрией отдельных кнопок в концепте.
- Длинные названия не должны вытеснять филиал, зал, тренера или действия;
  truncation допускается только с доступом к полному имени через accessible
  name/detail.
- Bottom navigation, последний row и временные поверхности учитывают safe area
  и dynamic viewport; page-level horizontal scroll запрещён.

## Acceptance criteria
- [ ] На populated fixture из 14 занятий при `420 x 912` видны минимум четыре полные строки занятий и заголовок следующего временного интервала без перекрытия bottom navigation.
- [ ] На `390 x 844` видны минимум три полные строки занятий; на `360 x 780` сохраняются decision data и все frequent actions без horizontal overflow.
- [ ] Каждая collapsed mobile row показывает группу, филиал, зал, тренера и только один нейтральный attendance status; badges типа группы и регулярности отсутствуют.
- [ ] `Посещаемость` остаётся видимой и достижимой одним нажатием, но не использует повторяющуюся filled-primary геометрию; `Изменить` и редкие действия доступны через `Ещё`.
- [ ] Body строки использует affordance перехода вправо, имеет доступное имя, видимый focus и открывает существующий detail route.
- [ ] Date toolbar, create и filter trigger не переносятся на action-only row; дата и weekday читаются полностью на `360`, `390`, `420` и `440px`.
- [ ] Filter trigger имеет видимую подпись, отражает active filters и открывает существующую filter surface с сохранением выбора, clear/reset и focus return.
- [ ] Филиал, зал и тренер имеют читаемый контраст и устойчивое выравнивание; длинные реальные значения не перекрывают status/actions при 200% zoom.
- [ ] Все независимые mobile touch targets не меньше `44 x 44px`, разделены минимум `8px` и не перекрываются browser chrome, safe area или bottom navigation.
- [ ] Loading, empty, filter-empty, stale/error/retry, restricted, cancelled и mixed attendance states сохраняют новую иерархию без ложного success или исчезновения recovery action.
- [ ] `date`, `view`, filters, scroll/time group и return path сохраняются после detail, attendance, mutation, refresh и browser back/forward.
- [ ] Desktop/tablet сохраняют текущие возможности и backend decisions; shared изменения не ухудшают TASK-133 wide-screen acceptance.

## Test checklist
- [ ] Обновить `GroupScheduleScreen` component fixtures с 14+ занятиями, длинными названиями, несколькими филиалами/залами/тренерами и mixed allowed actions.
- [ ] Добавить assertions для mobile field visibility, отсутствия secondary badges, action placement, right-chevron affordance и backend-driven restricted/disabled behavior.
- [ ] Проверить keyboard order, visible focus, `Ещё` open/close/Escape, focus return и detail/attendance return context.
- [ ] Добавить geometry assertions для количества полностью видимых rows, отсутствия overlap и horizontal overflow на `360 x 780`, `390 x 844`, `420 x 912` и `440 x 956`.
- [ ] Выполнить compact-height smoke на `912 x 420` и `956 x 440` без nested-scroll trap.
- [ ] Проверить long-content и 200% zoom; отдельным сценарием открыть/закрыть filter surface с active filter.
- [ ] Запустить root verification harness для frontend diff, affected Chromium schedule flows и `npm run test:e2e:iphone`.
- [ ] Выполнить rendered before/after review против visual contract; отдельно перечислить непроверенные physical Safari chrome, Dynamic Island, software keyboard и one-handed reach.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: medium
- Reason: изменение локализовано во frontend presentation и regression coverage, но затрагивает основной schedule workflow; backend/domain semantics запрещено менять, а утверждённый visual contract и target-device gates ограничивают импровизацию.

## Clarification questions
Не требуется. Пользователь утвердил направление макета и явно поручил завести
задачу на его реализацию. Implementation specification уточняет, что все
touch targets должны быть `44 x 44px`, даже если концепт визуально показывает
меньшую icon surface.

## Source notes
- Source file: direct conversation on 2026-08-29; no inbox file.
- Original note: `заведи задачу на реализацию макета`.
- Preceding request: `нарисуй макет в устраняющий найденные замечания`.
- Current runtime evidence: `artifacts/screenshots/schedule-iphone-air-420x912.png` and `artifacts/screenshots/schedule-iphone-air-420x912-scrolled.png`.
- External conversation visualization: `/Users/muradchaniev/.codex/visualizations/2026/08/29/01a04f29-2b70-78c3-92d5-cd3cf24e2f35/schedule-mobile-redesign.html`.
- Related completed task: [TASK-133](../done/TASK-133-schedule-task-first-cards.md).
- Coordinated active task: [TASK-131](../implementation/TASK-131-schedule-group-type-filter-regression.md) owns filter regression only and does not own this visual change.
- Cross-screen analysis evidence (2026-08-30): `artifacts/screenshots/all-screens/06-schedule-day-*.png`; бюджет до контента ~250–280px на 420x912 подтверждён на полном наборе экранов.

## Processing notes
- Created at: 2026-08-29 23:42 MSK
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- Duplicate check: TASK-133 implemented the current task-first baseline; TASK-157 is a user-approved follow-up with new density, field hierarchy and mobile action-placement acceptance, so the completed task was not reopened and no active duplicate was created.
- Classification: `tasks-ready`; accepted requirement and visual direction exist, behavior is bounded to frontend presentation, and no blocking product decision remains.
- Updated at: 2026-08-30 (analysis addendum): visual contract дополнен аддендумом all-screens анализа (базлайн бюджета, типографика строк по стандарту реестров, list-row токены TASK-160, мобильные переопределения типографики TASK-158); утверждённое направление не менялось.
- Updated at: 2026-08-30 (task-branch evidence): compact time-group surfaces и
  строки реализованы с shared TASK-160 list-row tokens; Chromium подтверждает
  ≥3 строки на `390 x 844`, ≥4 строки и следующий interval heading на
  `420 x 912`/`440 x 956`, отсутствие overflow на `360`/compact-height и при
  200% text scale. Schedule unit/Chromium/scoped WebKit зелёные; physical iOS
  conditions остаются manual. Статус остаётся `implementation` до интеграции
  ветки в `main`.
