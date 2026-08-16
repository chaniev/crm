# TASK-112: Добавить однодневный режим недельного расписания

## Status
ready

## Goal
Пользователь может сосредоточиться на расписании одного дня, не теряя недельный контекст и хронологический порядок занятий.

## Context
На mobile экран `/schedule` уже показывает временную сетку выбранного дня с переключателем дней недели, а на tablet/desktop — недельную сетку из семи колонок. Текущий backend и завершённые TASK-043/TASK-045 описывают повторяющийся недельный шаблон, а не календарь конкретных дат. Календарные даты, добавленные в TASK-055, остаются только presentation-only labels текущей недели и не меняют эту семантику.

Продуктовое решение от 2026-08-16: «1 день» означает один weekday повторяющегося недельного шаблона. На mobile сохраняется day-only представление. На tablet/desktop по умолчанию открывается недельная сетка и доступен переключатель `Неделя / День`. Режим и выбранный weekday хранятся в URL и восстанавливаются при refresh, back/forward и смене viewport.

## User role
Тренер / администратор / главный тренер.

## Problem
На tablet/desktop недельная сетка не позволяет сосредоточиться на занятиях одного weekday. Пользователю нужен явный day mode с теми же read-only данными и хронологией, без превращения недельного шаблона в dated calendar.

## Scope
- На tablet/desktop добавить переключатель `Неделя / День` для существующего read-only schedule flow.
- Сохранить `Неделя` как default mode на tablet/desktop; при отсутствии weekday в URL использовать текущий локальный weekday как выбранный день.
- В режиме `День` показывать временную сетку только выбранного weekday недельного шаблона и существующий переключатель `Пн...Вс`.
- На mobile сохранить day-only представление без переключателя режима; при отсутствии weekday в URL открывать текущий локальный weekday.
- Хранить режим и выбранный weekday в URL, не сбрасывать их при фильтрации, manual/auto refresh или обновлении schedule payload.
- При переходе tablet/desktop -> mobile принудительно показывать day-only UI, не перезаписывая сохранённый desktop/tablet mode; при возврате к широкому viewport восстанавливать mode из URL.
- Подготовить UX-контракт и UI specification: расположение переключателя после toolbar/filters и перед временной сеткой, primary path, responsive behavior, operational states и focus behavior.

## Out of scope
- Редактирование, перенос, отмена занятий или drag-and-drop.
- Изменение schedule conflict logic.
- Dated event calendar, выбор конкретной календарной даты и навигация по неделям.
- Недельный режим на mobile.
- Изменение backend schedule/API contract, permissions или access scope.
- Перенос существующих schedule filters в URL.

## Constraints
- Backend остаётся источником данных, permissions и schedule semantics.
- Day mode фильтрует только presentation weekday существующего payload и не вводит новую бизнес-семантику занятия.
- Presentation-only `dd.MM` labels текущей недели не являются выбираемыми датами и не влияют на запросы или данные.
- Внутри дня занятия сохраняют сортировку по времени начала.
- Текущие фильтры, refresh, loading, empty, stale/error и permission-restricted states должны сохраняться.
- URL должен безопасно обрабатывать отсутствующие и невалидные значения режима/weekday, возвращаясь к установленным default без runtime error.
- На `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420`, `956 x 440`, `768 x 1024` и `1440 x 1200` не должно быть page-level horizontal scroll или nested-scroll trap.
- Tabs, filters и actions должны иметь hit area не меньше `44 x 44px` и видимый focus.
- Нельзя смешивать эту задачу с активной TASK-106 про читаемость параллельных занятий.

## Acceptance criteria
- [ ] На tablet/desktop при URL без mode открывается недельная сетка и доступен явный переключатель `Неделя / День`.
- [ ] Tablet/desktop day mode показывает только выбранный weekday недельного шаблона; недельный режим остаётся доступным.
- [ ] На mobile отображается только day mode без переключателя режима, а выбранный weekday совпадает с URL или текущим weekday при отсутствии параметра.
- [ ] Режим и выбранный weekday представлены в URL и воспроизводятся после full refresh и browser back/forward.
- [ ] Filters, manual/auto refresh и обновление payload не сбрасывают режим или выбранный weekday.
- [ ] При сужении viewport до mobile показывается выбранный день без перезаписи сохранённого wide-screen mode; при расширении mode восстанавливается из URL.
- [ ] Отсутствующие или невалидные URL-значения дают безопасные default: `Неделя` на tablet/desktop, day-only на mobile и текущий weekday.
- [ ] Описан primary path `Расписание -> выбор режима/дня -> занятия дня -> смена дня`.
- [ ] Описаны loading, empty day, filter-empty, stale/error и retry states.
- [ ] Для `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420`, `956 x 440`, `768 x 1024` и `1440 x 1200` выполнены измеримые responsive acceptance criteria без page-level horizontal overflow.

## Test checklist
- [ ] Добавить component tests для default mode, выбора режима/дня, URL parsing/serialization и invalid-value fallback.
- [ ] Добавить Playwright-сценарии filters, manual refresh, browser refresh, route back/forward, responsive transition и пустого выбранного дня.
- [ ] Проверить keyboard path, `aria-selected`, visible focus и arrow/Home/End navigation.
- [ ] Проверить long group/type/hall/trainer names и отсутствие горизонтального overflow.

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: продуктовая семантика и persistence определены; изменение локализовано во frontend presentation/URL state, но затрагивает основной responsive workflow расписания и требует UX/UI handoff.

## Clarification questions
Не требуется. Решения закрыты 2026-08-16:

- «1 день» — weekday повторяющегося недельного шаблона;
- mobile — day-only;
- tablet/desktop — `Неделя` по умолчанию и переключатель `Неделя / День`;
- режим и выбранный weekday сохраняются в URL при refresh, back/forward и смене viewport.

## Source notes
- Source file: `backlog/inbox/2026-08-16.md`
- Original note: `Во вкладке расписание добавить возможность открывать расписание на 1 день`

## Processing notes
- Created at: 2026-08-16 16:45
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- Duplicate check: активного дубликата нет; завершённые TASK-043/TASK-045 являются weekly/mobile-day baseline, а TASK-106 решает отдельную проблему параллельных занятий.
- Updated at: 2026-08-16 17:24 after user clarified weekday semantics, device modes, defaults and URL persistence.
- Moved to tasks-ready at: 2026-08-16 17:24 after all blocking product questions were resolved.
- UX/UI handoff: перед реализацией требуется утвердить UX-контракт и mobile-first UI specification; текущий mobile selected-day flow является baseline.
