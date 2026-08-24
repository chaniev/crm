# TASK-133: Сделать карточки расписания task-first на mobile и desktop

## Status
implementation

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-24 14:25
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-133-schedule-task-first-cards.plan.md
- implementation_branch: feature/TASK-133-schedule-task-first-cards

## Goal
Тренер, администратор или главный тренер быстро находит нужное занятие на выбранную дату и открывает посещаемость, не разбирая в каждой карточке одинаковый набор вторичных и опасных действий.

## Context
После интеграции полноценного календаря TASK-119 экран `/schedule` на реальных тестовых данных показывает 15 занятий за день. Visual review на `390 x 844` и `1440 x 1200` выявил перегруженные карточки, слабую сканируемость похожих занятий, обрезание даты и подписей mobile navigation, а также неэффективное использование ширины desktop.

Текущая карточка может одновременно показывать `Изменить`, `Перенести`, `Серия`, `Замена`, `Отменить` и `Посещаемость`. Это создаёт до 90 видимых action controls для 15 занятий. `Посещаемость` является основной операцией, но конкурирует с пятью редкими действиями; destructive `Отменить` постоянно находится в повторяющемся списке.

## User role
Тренер / администратор / главный тренер / суперадминистратор в пределах разрешённого backend schedule scope.

## Problem
- На mobile в первом viewport помещается около полутора карточек; нужное занятие приходится искать длинным скроллом.
- В каждой карточке видны до шести действий без достаточной task-first иерархии.
- `Отменить` доступно непосредственно в повторяющемся action grid, хотя является exceptional/destructive operation.
- Дата визуально обрезается на `390 x 844`, а подписи `Посещения` и `Расписание` в bottom navigation отображаются с ellipsis.
- Параллельные занятия с одинаковым временем повторяют время и полный action set, а различающие данные филиала, зала и тренера имеют меньший визуальный вес.
- На desktop ключевые данные находятся слева, а `Посещаемость` уезжает к дальнему правому краю широкой карточки.
- Отсутствие отметок не обозначено нейтральным статусом; пользователь видит badge только когда отметки уже существуют.

## Scope
- Выполнить обязательный UX contract и mobile-first UI specification до реализации существующего workflow расписания.
- Сгруппировать занятия дня по точному временному интервалу, сохранив хронологический порядок и доступность каждого occurrence.
- Перестроить карточку вокруг decision data: группа, филиал/зал, тренер, source kind, cancellation/substitution state и нейтральный attendance state из существующих backend полей.
- Оставить в карточке доминирующее действие `Посещаемость`, разрешённое backend; сохранить `Изменить` как secondary action только когда оно разрешено.
- Перенести `Перенести`, `Серия`, `Назначить/снять замену`, `Отменить/Восстановить` в доступное меню `Ещё` или detail surface.
- Сохранить существующий confirmation drawer и backend preview/execute contract для отмены/восстановления; destructive action не должно быть непосредственно видно в повторяющемся списке.
- Сделать открытие detail по body карточки визуально очевидным и доступным с клавиатуры.
- Исправить mobile toolbar так, чтобы дата оставалась полностью и однозначно читаемой, а previous/next, create и calendar tools не перекрывались и не создавали второй action-only row.
- Исправить подписи mobile bottom navigation, чтобы текущие русские названия полностью читались на поддерживаемых ширинах.
- Уплотнить desktop-представление: action cluster находится рядом с decision data и не растягивается по всей ширине карточки.
- Обновить component и Playwright regression coverage для action hierarchy, time grouping, URL/context preservation и responsive geometry.

## Out of scope
- Изменение backend schedule, attendance, permission, access-scope, cancellation, conflict или recurrence semantics.
- Новые conflict/overdue/attendance-required состояния, которых нет в backend contract.
- Изменение API, базы данных, миграций, календарной occurrence-модели или бизнес-правил TASK-119.
- Drag-and-drop, массовые операции, автоматическая отмена, перенос или назначение замены.
- Перестройка detail/create/edit/move route forms за пределами необходимого focus return и сохранения контекста списка.

## Constraints
- Backend остаётся source of truth для данных, разрешённых действий, причин недоступности, cancellation/substitution state и attendance scope.
- Frontend может показать только нейтральные `Отметки есть` / `Без отметок` из существующего `hasAttendanceMarks`; нельзя самостоятельно выводить `Просрочено`, `Требует отметки` или конфликт.
- Сохраняются текущие URL-backed `date`, `view`, filters, reload/back-forward и возврат из detail/attendance/mutation routes.
- Mantine, Onest, semantic tokens и существующие shared mobile primitives остаются design-system baseline.
- Нельзя скрывать разрешённую primary operation в overflow или выводить destructive action непосредственно в повторяющейся карточке.
- Все временные группы и карточки сохраняют доступные имена, видимый focus и предсказуемый focus return после Menu/Drawer.

## Acceptance criteria
- [ ] На `390 x 844` видимая карточка содержит максимум три action controls: доминирующее `Посещаемость`, разрешённое secondary `Изменить` и `Ещё`; редкие действия не образуют второй grid из кнопок.
- [ ] `Отменить/Восстановить` отсутствует среди постоянно видимых действий карточки, доступно через `Ещё` или detail и использует существующее подтверждение.
- [ ] Занятия сгруппированы по точному временному интервалу без потери occurrence; внутри группы различимы группа, филиал/зал и тренер, а общий chronological order сохраняется.
- [ ] Карточка показывает нейтральный attendance state `Отметки есть` или `Без отметок` из существующего backend поля без frontend-owned overdue semantics.
- [ ] На `360 x 780`, `390 x 844`, `420 x 912` и `440 x 956` дата полностью и однозначно читается, toolbar не перекрывается, не переносится в action-only row и не создаёт horizontal page scroll.
- [ ] `Посещения`, `Внимание`, `Расписание`, `Клиенты` и `Ещё` полностью читаются в mobile navigation на `360–440px`; активный route сохраняет корректный `aria-current`.
- [ ] На `1440 x 1200` primary action расположен рядом с данными занятия, secondary action cluster не растянут по ширине карточки, а в первом viewport помещается больше operational content, чем в исходном макете.
- [ ] Card body имеет видимый affordance открытия detail, доступное имя и visible focus; primary action виден только по backend capability, а причина недоступности остаётся доступной пользователю.
- [ ] Все независимые touch targets имеют минимум `44 x 44px` и интервал минимум `8px`; bottom navigation и последний элемент списка не перекрывают друг друга с учётом safe area.
- [ ] Меню `Ещё` закрывается по Escape на desktop и явным close/back на mobile, возвращая focus в trigger; Drawer также возвращает focus и не создаёт nested-scroll trap.
- [ ] После detail, посещаемости, изменения, переноса или замены восстанавливаются выбранные `date`, `view`, filters и позиция/временная группа списка.
- [ ] Loading, empty, stale/error/retry, disabled/restricted и cancelled states не теряют дату, временную группу и доступные backend actions.

## Test checklist
- [ ] Добавить component fixtures с 15 занятиями, несколькими occurrence в одном временном интервале, длинными названиями, отметками/без отметок, заменой, отменой и различными `allowedActions`.
- [ ] Зафиксировать role/capability matrix: trainer, administrator/head coach и permission-restricted response без frontend role inference.
- [ ] Добавить keyboard tests для card body, `Посещаемость`, `Изменить`, `Ещё`, Escape/close и focus return.
- [ ] Добавить Playwright primary flow `дата -> временная группа -> занятие -> Посещаемость -> возврат` с сохранением URL и позиции списка.
- [ ] Проверить destructive flow через overflow и существующий confirmation drawer, включая cancel/restore recovery.
- [ ] Проверить отсутствие horizontal overflow и полные date/navigation labels на `360 x 780`, `390 x 844`, `420 x 912`, `440 x 956`, `768 x 1024` и `1440 x 1200`.
- [ ] Выполнить compact-height smoke на `912 x 420` и `956 x 440`, а также target-iPhone WebKit projects с touch enabled.
- [ ] Запустить `cd frontend && npm run check`, affected Chromium `group-schedule` flows и `cd frontend && npm run test:e2e:iphone`.
- [ ] Отдельно зафиксировать непроверенные physical Safari chrome, software keyboard, safe-area и one-handed reach, если Simulator/physical device недоступны.

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: задача локализована во frontend presentation и regression coverage, использует существующие backend fields/actions и явно запрещает изменение schedule/attendance/domain semantics; основной responsive workflow требует UX/UI handoff и полного target-device validation.

## Clarification questions
Не требуется. Product boundary зафиксирован: `Посещаемость` — primary при backend-разрешении; вторичные mutation actions уходят в `Ещё`; destructive action остаётся в существующем confirmation flow; новые backend состояния не вводятся.

## Source notes
- Source file: direct conversation on 2026-08-24; no inbox file.
- Original note: по результатам visual review desktop/mobile расписания создать задачу на устранение перегрузки карточек, слабой сканируемости, обрезанной даты/navigation labels и неверной иерархии действий.
- Desktop evidence: `/backlog/mockups/TASK-133-schedule-task-first-cards/desktop-1440x1200.jpg`.
- Mobile evidence: `/backlog/mockups/TASK-133-schedule-task-first-cards/mobile-390x844.jpg`.
- Related completed tasks: `/backlog/done/TASK-106-parallel-schedule-readability.md`, `/backlog/done/TASK-119-full-lesson-calendar.md`.

## Processing notes
- Created at: 2026-08-24 14:12 MSK
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- Duplicate check: активного дубликата нет; TASK-106 закрывает старую проблему desktop parallel-event readability, TASK-119 владеет текущей occurrence-моделью, а TASK-131 ограничена regression coverage фильтра типа группы.
- Classification: `tasks-ready`, потому что UX outcome, responsive scope, existing backend contract и safety boundary определены; изменение schedule business rules не разрешено.
