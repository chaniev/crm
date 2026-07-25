# TASK-086: Добавить mobile-first поиск, фильтры и paging списка групп

## Status
ready

## Priority
P1

## Goal
Суперадминистратор, администратор или главный тренер находит и редактирует нужную группу без прокрутки всех групп клуба.

## User role
Суперадминистратор / администратор / главный тренер.

## Problem
На `390 x 844` экран отображает 30 длинных group cards без search, filters или pagination; высота документа около `9121px`. Повторяющаяся кнопка `Редактировать` имеет высоту `36px`. Desktop-модель `показать всё` была перенесена на mobile карточками, но не получила task-oriented locator.

## Scope
- Поиск по названию группы.
- Фильтры по active/inactive и `без тренера`; использовать branch/type/trainer/hall display data только если они уже присутствуют в разрешённом backend response.
- Pagination или предсказуемый `Показать ещё` с ограниченным batch size.
- Более плотная mobile card hierarchy без потери branch, hall, schedule, trainer и status.
- Edit action минимум `44 x 44`.
- Сохранить `GroupsSummaryBar`, create и refresh operations.
- Для SuperAdministrator использовать глобальный backend-permitted набор; branch и hall остаются видимыми в rows/cards, а filter options берутся только из backend response.

## Out of scope
- Переработка group create/edit form.
- Новые group или trainer assignment business rules.
- Frontend-фильтрация данных, которых пользователь не должен получать.
- Превращение summary metrics в действия без отдельной операции.

## Responsive behavior
- `360 x 780`: full-width search; filters/status следующей строкой; не более 10 групп в первом batch.
- `390 x 844`: в первом viewport видны summary, locator controls и начало первых 1–2 групп.
- `420 x 912`, `440 x 956`: можно показать больше card metadata, не добавляя unmapped controls.
- `768 x 1024`: допустим двухколоночный grid при сохранении task/focus order.
- `1440 x 1200`: предпочтительны compact rows или table-like list с видимым pagination summary.
- `912 x 420`, `956 x 440`: locator controls занимают одну или две короткие строки; primary list не скрыт недостижимым full-height drawer.

## Operational and interaction states
- Summary и list loading различимы и могут завершаться независимо.
- Empty first-run показывает create group как primary action.
- Empty filtered/search сообщает условие и предлагает reset.
- List error имеет retry; ошибка summary не блокирует работу списка.
- Focus order: search → filters → reset → create → refresh → list actions → pagination.
- Card не становится лишней focus stop, если единственная операция — отдельная edit action.
- Pagination объявляет current page и total.

## Acceptance criteria
- [ ] Пользователь сокращает список из 30+ групп search/filter без прокрутки всех карточек.
- [ ] Первый page/batch ограничен, интерфейс показывает текущий диапазон и total.
- [ ] Edit action минимум `44 x 44` на обязательных mobile-размерах.
- [ ] Backend access scope сохранён; frontend не создаёт собственные permission rules.
- [ ] Нет horizontal page scroll, badge/text overlap и скрытых primary actions.
- [ ] Search/filter state сохраняется после edit и возврата к списку.
- [ ] SuperAdministrator сокращает набор из 30+ групп минимум двух филиалов search/filter/paging без прокрутки всех cards.
- [ ] SuperAdministrator create/edit actions отражают backend permissions; frontend не создаёт branch scope локально.

## Test checklist
- [ ] Unit tests filtering/paging view model.
- [ ] E2E: search → active/inactive → без тренера → edit → return → reset.
- [ ] E2E SuperAdministrator: multi-branch search/filter/page → edit → return; branch/hall context остаётся читаемым.
- [ ] E2E с 30+ группами на `390 x 844`.
- [ ] Проверить все обязательные mobile/tablet/desktop/compact-height размеры.
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] Запустить affected Playwright и iPhone WebKit checks.

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: заметное изменение list workflow, но без изменения backend domain semantics.

## Related tasks
- `TASK-065`: завершённая компактная сводка групп.

## Source notes
- Source: usability audit of the fully rebuilt and seeded local stand.
- Evidence date: 2026-07-25.

## Visual comparison
- [Сейчас / после](../mockups/usability-2026-07-25/TASK-086-comparison.png)
- [Описание преимуществ и границ макета](../mockups/usability-2026-07-25/README.md#task-086-mobile-first-group-locator-and-paging)
