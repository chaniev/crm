# Implementation Plan: TASK-188 Разное время по дням при создании группы

## Metadata
- source_task: /backlog/done/2026-10-23/TASK-188-group-create-weekday-start-times.md
- requirements: REQ-GRP-003 (implements), REQ-GRP-004 (constrains), REQ-GRP-001 (constrains), REQ-NFR-001 (constrains)
- branch: codex/TASK-188-group-create-weekday-start-times
- readiness: yes
- product_decisions: accepted
- technical_decisions: none — используются существующие initialLessonSeries slots и preview/execute; меняются локальные state/mapping формы
- architecture_decisions: none — владение расписанием, API и схема данных сохраняются
- open_questions: none
- dependencies: none; TASK-189 независима, но последовательная интеграция TASK-188 → TASK-189 уменьшает пересечения общих frontend tests
- risk: medium — неверное сопоставление дня, времени или индекса ошибки меняет фактическое расписание создаваемой группы

## Goal
Создание Пн 18:00 / Ср 18:00 / Сб 10:00 проходит preview и execute;
после reload серия и календарь сохраняют все три времени.

## Decisions and contracts
- Нормативный источник — `initialLessonSeries.slots`; у выбранного дня одно
  локальное время `HH:mm`. Общие hall/duration и даты серии сохраняются.
  Несколько slots одного дня остаются возможны в существующем редакторе серии,
  но не добавляются в форму создания.
- Значения формы связываются со стабильным ISO weekday, а не позицией строки.
  Request содержит только выбранные дни в порядке Пн–Вс. Legacy top-level
  `trainingStartTime`/`weekdays` остаются совместимыми полями существующего DTO:
  время проецируется из первого отправленного slot, а не из независимого ввода.
  Backend `ValidateGroupCreateWithInitialSeriesAsync` уже использует первый slot
  для legacy projection.
- Preview и execute строятся одним mapper из одинакового snapshot. Любое
  изменение активного payload сразу снимает прежний preview/token и возвращает
  действие «Получить предпросмотр»; после нового preview требуется отдельное
  подтверждение. Ответ старого запроса не подтверждает изменённую форму.
- `applyFieldErrors` уже нормализует `slots[2].startTime` в `slots.2.startTime`.
  Статические aliases только для slot 0 заменить отображением индекса отправленного
  snapshot в weekday: time → поле этого дня, duration/hall → общие поля,
  isoWeekday/slots → группа выбора дней. Сохранить обработку top-level errors.
  Неизвестная или уже неприменимая ошибка остаётся видимой на форме.
- Новая обязательность per-day time действует только в create: shared
  `useGroupForm`/`toFormValues` не должны блокировать identity save или dirty-save
  редактора из-за скрытых пустых полей. Не гидратировать вымышленное расписание
  редактируемой группы из legacy time. Identity-only save не получает schedule-поля.
  Смена backend-валидации, формата ошибок и API не требуется.

## Decision evidence
- product: [Согласованный визуальный контракт](/backlog/mockups/TASK-188-189-group-schedule/brief.md) — owner: пользователь / владелец продукта; decision: 23.10.2026 ответом «выбираю вариант А А» выбран A для TASK-188: выбор дней и отдельные постоянно видимые строки их времени; ранее принято разное время по дням без нескольких занятий в день в форме создания.
- [REQ-GRP-003](/docs/requirements/02-группы.md) задаёт принятое независимое время дней.
- [GroupsApiTests](/backend/tests/GymCrm.Tests/GroupsApiTests.cs) подтверждают создание slots с разными временами и отсутствие частичного создания без token.
- [Исходная задача](/backlog/done/2026-10-23/TASK-188-group-create-weekday-start-times.md) сохраняет scope и исходное продуктовое решение.

## UX contract — выбранное направление A
- Пользователь создаёт группу на mobile/desktop. Primary — получить preview,
  затем создать; частые действия — выбрать день и ввести его время; отмена вторична.
- Новый выбранный день получает пустое обязательное поле времени; значения других
  дней не копируются и не меняются. Снятие дня убирает его из payload; повторное
  включение восстанавливает введённое время в пределах текущей формы.
- Выбор дней расположен над списком выбранных дней Пн–Вс. Каждая строка
  содержит полный день и отдельное поле времени; ошибка находится у этого поля.
  Общая сводка перечисляет пары «день + время», не заявляет одно время для недели.
- Loading справочников, recoverable API errors и restricted route сохраняют
  существующий смысл. Pending запрещает повторную отправку; stale preview требует
  повторного просмотра с сохранёнными значениями. Изменение ввода во время запроса
  не должно привязать устаревший error к другому дню.
- На mobile блок идёт одной колонкой, время остаётся рядом с днём; дни выбора
  переносятся целыми targets. На desktop слева выбор/времена, справа общие
  длительность и даты. Геометрия, focus и runtime acceptance зафиксированы в brief.

## Scope
### In
- Per-weekday form state, mapping, summary, preview invalidation и field recovery.
- Регрессии create, identity edit и воспроизводимый API round-trip.
- Обновление evidence REQ-GRP-003 и CHANGELOG при интеграции; статус полного
  REQ-NFR-001 не закрывать на основании этой одной формы.
### Out
- Новые endpoints, миграции, бизнес-правила, групповой ввод одного времени,
  дополнительные занятия одного дня и вход в редактор TASK-189.

## Implementation slices
1. Покрыть и реализовать controlled weekday→time state и canonical payload.
   Обновить форму и summary согласно выбранному направлению; identity edit
   продолжает работать с прежним narrow update.
2. Покрыть и реализовать привязку ошибок всех slots, актуальность preview и
   сохранение ввода при failed/stale запросах.
3. Выполнить сквозные регрессии и runtime comparison с выбранным концептом;
   обновить requirement evidence по результату интеграции.

## Likely files and layers
- `frontend/src/features/groups/groupFormMapping.ts` — state, validation, payload projection.
- `frontend/src/features/groups/GroupForm.tsx` — выбранный weekday/time UI и summary.
- `frontend/src/features/groups/GroupCreateScreen.tsx` — preview lifecycle и dynamic aliases.
- `frontend/src/resources/fe-13-groups-core.ts` — новые user-facing labels и recovery copy.
- `frontend/src/features/groups/groupFormMapping.test.ts`, `GroupManagement.test.tsx` — unit/component barriers.
- `frontend/e2e/group-schedule.spec.ts`, `frontend/e2e/iphone-target-devices.spec.ts` — browser flows.
- `backend/tests/GymCrm.Tests/GroupsApiTests.cs` — targeted round-trip regression при неизменном backend implementation.
- `frontend/src/App.css` — только необходимые локальные правила выбранной композиции.

## Regression specification
### Automated tests to add or update
- Mapping: Пн18/Ср18/Сб10; одинаковое время; неупорядоченный выбор дней;
  снятый день не отправляется, остальные значения неизменны; общие hall/duration
  и даты проходят без преобразования TZ. Legacy projection соответствует первому slot.
- Component: добавить день, ввести время, снять и вернуть день; менять одно поле
  независимо; пустое время активного дня блокирует preview; скрытый день не мешает.
- Обновить `create previews exact initial series payload, confirms with token and
  preserves field recovery`: assert всех slots, token только после актуального
  preview, редактирование и снятие дня после preview, ответ старого запроса,
  ошибка `InitialLessonSeries.Slots[2].StartTime`, shared hall/duration errors,
  recovery без потери текста и без create после failed preview.
- Сохранить `edit sends identity-only payload and maps backend errors to current fields`.
  Добавить edit/dirty-save case без per-day draft: identity успешно сохраняется
  narrow payload, скрытая schedule validation не запускается.
- Backend: новый `Group_create_initial_series_preserves_weekday_specific_times_after_read`
  выполняет preview → create → GET lesson-series → GET schedule для недели,
  содержит дни 1/3/6 и времена 18:00/18:00/10:00. Существующие тесты нескольких
  slots одного дня, token replay и отсутствия частичного создания сохранить.
- Playwright: создание → reload → календарь, изменение времени после preview,
  ошибка Сб с retry, backend session без canManageGroups; geometry всех семи дней,
  длинная ошибка, отсутствие overflow и доступность действия с клавиатуры.

### Expected red evidence
- Новые component tests не найдут независимых полей дня; mapper повторяет одно
  `trainingStartTime`; error slot 2 не связан с контролом. Это ожидаемые red.
- API round-trip может сразу быть green: backend уже поддерживает эти slots.
  Зафиксировать это как существующий contract evidence, не ломать API ради red.

### Required validation
- Task verification contract включает затронутые browser scenarios и оба target
  iPhone проекта. Их текущий `testMatch` не включает `group-schedule.spec.ts`:
  использовать общий scenario helper из `iphone-target-devices.spec.ts` либо
  явно включить новый task spec в проект; ненулевое число выполненных тестов обязательно.
- Дополнительно прогнать focused backend initial-series round-trip/token cases;
  они не заменяют baseline для изменённого backend test scope.

### Manual evidence
- Независимое сравнение runtime с выбранным концептом, длинной ошибкой и семью
  днями; device-only ограничения из mobile skill честно отметить непроверенными,
  если Simulator/physical-device evidence недоступно.

### Regression barrier
Component preview→execute с точными per-day slots + backend read/calendar
round-trip не позволяют незаметно вернуть копирование одного времени на неделю.

## Risks and stop conditions
- TASK-177 затрагивает тот же weekday control. Обеспечить mobile geometry нового
  контрола в этой задаче, согласовать пересечение файлов перед исполнением;
  отдельную карточку TASK-177 автоматически не закрывать.
- Если backend фактически не сохраняет slots либо выбранный UX требует новых
  доменных операций, вернуть план в planning; не расширять API в этой задаче молча.
- Если реализация требует отступления от согласованного A, вернуть затронутую
  часть в planning; не заменять постоянно видимые времена переключателем дня.

## Completion
- status: completed
- completed_at: 2026-10-23
- completion_date_evidence: локальная main содержит проверенный TASK-188 `d17baff` и TASK-189 `6aeefcb`; fast-forward 23.10.2026, tree `3b31d5259d4a6b575f9113d04bf6578a318c5d91` совпадает с проверенным TASK-189 candidate.
- verification: [validation](TASK-188-evidence/validation.md), [harness](TASK-188-evidence/harness.json), [batch log](../../logs/2026-10-23-TASK-188-189-implementation.md).
