# TASK-044: Убрать служебные intro-блоки со всех страниц CRM

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-05-14 22:33
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-044-hide-technical-information.plan.md
- implementation_branch: feature/TASK-044-hide-technical-information

## Goal
Убрать из CRM UI служебные верхние intro/hero-области на всех экранах, где они встречаются, чтобы рабочие экраны начинались с полезного содержимого без лишних технических пояснений и бейджей.

## Context
В inbox есть короткая заметка: "убрать со всех экранов техническую информацию".

Уточнение от 2026-05-14: под технической информацией имеются в виду области, похожие на приложенные скриншоты с красным крестиком. Это верхние intro/hero-блоки экранов с поясняющим текстом, служебными бейджами, счетчиками и role/access-подсказками, а не backend audit data, raw JSON, ID объектов или ProblemDetails contracts.

Скриншоты являются примерами, а не исчерпывающим списком. Нужно удалить такую служебную информацию со всех экранов CRM, где она есть.

Примеры экранов по скриншотам:
- Расписание.
- Посещения.
- Группы.
- Тренеры.
- Журнал.
- Финансы.
- Настройки.

## User role
все пользователи CRM

## Problem
Верхние intro/hero-блоки повторяют очевидный контекст экрана, занимают много места и показывают служебные подсказки вроде access/role labels, счетчиков или объяснений внутренней логики. Это создает визуальный шум и выглядит как техническая информация в рабочем интерфейсе.

## Scope
- Найти общий компонент или повторяющийся паттерн верхних intro/hero-блоков во frontend.
- Проверить все CRM routes/screens, а не только экраны из скриншотов.
- Убрать или свернуть все аналогичные верхние служебные области на найденных экранах.
- Убрать из этих областей служебные бейджи и пояснения: role/access labels, "показано N из N", "любая доступная группа", "главный тренер и администратор", "только для главного тренера" и похожие тексты.
- Сохранить полезные рабочие действия страницы: создать, обновить, фильтры, списки, таблицы и основные данные.
- Если после удаления intro-блока экран теряет понятный заголовок, оставить короткий обычный заголовок рядом с рабочим содержимым без hero-карточки и служебных бейджей.

## Out of scope
- Удаление audit data из backend.
- Изменение raw JSON, ID объектов, ProblemDetails contracts или backend validation semantics.
- Скрытие информации внутри таблиц/карточек, если она не относится к отмеченным верхним intro-областям.
- Широкий UI-редизайн unrelated screens.
- Изменение ролей, permissions или access scope.

## Constraints
- Backend остается source of truth для audit, validation and ProblemDetails contracts.
- Frontend не должен дублировать CRM domain rules при замене или удалении текста.
- Нельзя убрать кнопки и фильтры, которые нужны для основного рабочего сценария.
- Значительное смещение layout нужно проверить на desktop и mobile.

## Acceptance criteria
- [ ] Проведена инвентаризация всех frontend screens/routes на наличие похожих служебных intro/hero-блоков.
- [ ] На всех экранах CRM нет верхних hero/intro-областей, аналогичных отмеченным крестиком на скриншотах.
- [ ] Служебные бейджи и пояснения из этих областей не показываются пользователям ни на одном найденном экране.
- [ ] Основные действия страниц остались доступны и визуально понятны.
- [ ] Рабочее содержимое экранов не получило некорректные отступы, пустое место или overlapping после удаления блоков.
- [ ] Изменение не затрагивает backend audit/diagnostic data и ProblemDetails contracts.

## Test checklist
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Вручную пройти основные CRM navigation routes на desktop и проверить отсутствие таких служебных intro/hero-областей.
- [ ] Отдельно проверить примеры со скриншотов: Расписание, Посещения, Группы, Тренеры, Журнал, Финансы, Настройки.
- [ ] Вручную проверить mobile/tablet layout для затронутых экранов, если поддерживается текущим frontend.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: после уточнения это локальная frontend cleanup-задача по отмеченным intro/hero-блокам без изменения backend contracts, audit data, roles or permissions.

## Clarification questions
- [x] Какие конкретные примеры технической информации сейчас мешают? Верхние области, похожие на скриншоты с красным крестиком.
- [x] На каких экранах это критично в первую очередь? На всех экранах CRM, где есть аналогичные служебные intro/hero-блоки; скриншоты дают примеры: Расписание, Посещения, Группы, Тренеры, Журнал, Финансы, Настройки.
- [x] Нужно ли скрывать ID объектов в журнале событий? Не относится к этой задаче; raw audit/details data не трогаем.
- [x] Нужно ли скрывать raw JSON старых/новых значений в журнале или заменить его человекочитаемым diff? Не относится к этой задаче; raw audit/details data не трогаем.
- [x] Как показывать пользователю backend validation/ProblemDetails ошибки? Не относится к этой задаче; ProblemDetails contracts не меняем.
- [x] Должен ли быть режим "подробнее для поддержки" вместо полного удаления технических данных? Не требуется для этой задачи, потому что scope ограничен верхними intro/hero-областями.

## Source notes
- Source file: `backlog/inbox/2026-05-14.md`
- Original note: `убрать со всех экранов техническую информацию`
- User clarification 2026-05-14: техническая часть - это области на приложенных скриншотах, перечеркнутые крестиком.
- User clarification 2026-05-14: удалить аналогичную служебную информацию нужно со всех экранов, где она есть, а не только со скриншотов.

## Processing notes
- Created at: 2026-05-14 13:01
- Created by skill: codex-backlog-skill
- Duplicate check: возможное пересечение с `TASK-018-client-detail-visual-noise` и `TASK-020-client-empty-states-action-reasons`, но новая заметка шире и не ограничена карточкой клиента; создана needs-clarification задача вместо обновления активной задачи.
- Clarified and moved to tasks-ready at: 2026-05-14.
- Scope expanded at: 2026-05-14 to cover all CRM screens where similar service intro/hero information exists; screenshots are examples only.
- Completed at: 2026-05-15 status audit after merge of `feature/TASK-044-hide-technical-information`.
- Implementation evidence: commits `55bb90b` and `ec76db7` remove service intro/hero blocks across CRM frontend routes, preserve primary actions, clean related resources/styles and update Playwright route coverage.
- Validation: implementation branch contains frontend e2e/test updates; runtime validation was not re-run during this backlog status audit.
