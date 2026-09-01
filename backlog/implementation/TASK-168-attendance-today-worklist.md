# TASK-168: Наполнить раздел «Посещения» занятиями на сегодня

## Status
implementation

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-30 18:43 MSK
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-168-attendance-today-worklist.plan.md
- implementation_branch: feature/TASK-168-attendance-today-worklist

## Requirements
- REQ-ATT-006 — changes
- REQ-ATT-001 — constrains
- REQ-ATT-003 — constrains
- REQ-GRP-005 — constrains
- REQ-NFR-001 — constrains

## Goal
В самостоятельном разделе `/attendance` пользователь сразу видит доступные ему
требующие действия занятия на сегодня, количество неотмеченных клиентов и одним действием открывает
отметку посещения выбранного занятия.

## Context
Выбран вариант 2 из обсуждения экрана 30.08.2026: сохранить отдельный navigation
section `Посещения`, но заменить текущую заглушку со ссылкой на расписание
рабочим списком сегодняшних занятий. Сейчас attendance data открывается только
из конкретной карточки `/schedule`.

## User role
Тренер / администратор / главный тренер / супер-администратор в рамках backend-authorized attendance scope.

## Problem
Landing `/attendance` не даёт выполнить основную задачу раздела: пользователь
вынужден уходить в расписание, искать занятие и только затем открывать отметку.

## Scope
- Показать на `/attendance` backend-authorized занятия текущего локального дня с
  `unmarkedClientCount > 0`, упорядоченные по времени начала.
- Не показывать `Cancelled`, `NotHeld`, недоступные для открытия и полностью отмеченные занятия.
- Для каждого занятия показать достаточные decision data и backend-derived
  количество клиентов со статусом `Не отмечено`.
- Добавить один быстрый переход в существующий attendance workbench конкретного
  lesson occurrence.
- Обработать loading, empty, error, retry и partial row state без потери раздела.
- После возврата из workbench актуализировать список с сохранением контекста; вне этого возврата
  обновлять только по запросу пользователя, без автообновления при смене CRM-дня.
- Сохранить текущий role-specific landing/navigation contract.

## Out of scope
- Изменение mark/unmark, write-off, permission, audit или date-window semantics.
- Возврат attendance workbench внутрь `Внимания` или удаление `/attendance`.
- Дублирование schedule/attendance domain filtering во frontend.
- Новый список будущих или исторических занятий.

## Constraints
- Backend определяет доступные занятия, allowed actions и значение счётчика;
  frontend не выводит permission или eligibility из роли самостоятельно.
- Успешно загруженная строка всегда имеет разрешённое действие; отдельный restricted-row state не вводится.
- Некорректная строка пропускается с неблокирующим partial-result сообщением; корректные строки сохраняются.
- `Сегодня` использует принятый локальный CRM day contract, а не browser-only
  эвристику, если backend уже предоставляет дату/диапазон.
- Переход использует stable `lessonOccurrenceId`; одинаковые группа и время не
  заменяют occurrence identity.
- Mobile first action остаётся выше сгиба и не создаёт page-level overflow.

## Acceptance criteria
- [ ] `/attendance` показывает в порядке начала только доступные для открытия занятия на сегодня с
  `unmarkedClientCount > 0` вместо заглушки.
- [ ] Каждая строка показывает группу, время и счётчик `Не отмечено` из backend-owned данных.
- [ ] Одно действие открывает существующий workbench точного занятия.
- [ ] Недоступные занятия и действия не появляются вне backend scope.
- [ ] Empty, loading, error и retry состояния понятны и не отправляют пользователя принудительно в `/schedule`.
- [ ] Повреждённая строка не скрывает корректные; empty state не различает пустой день и пустой scope.
- [ ] Возврат из workbench актуализирует счётчики/состав и сохраняет контекст; смена CRM-дня не вызывает автообновление.
- [ ] Coach и Administrator сохраняют landing на `/attendance`; HeadCoach и SuperAdministrator сохраняют доступ через навигацию.
- [ ] Mobile и desktop regression coverage фиксирует отсутствие горизонтального overflow и сохранение контекста при возврате.

## Test checklist
- [ ] Добавить backend contract coverage, если текущий schedule response не содержит надёжный unmarked count.
- [ ] Добавить API/client mapper tests для today lessons и counters.
- [ ] Добавить component tests для role scope, loading/empty/error/retry и exact occurrence navigation.
- [ ] Добавить mobile/wide Playwright flow: landing → занятие → отметка → возврат.
- [ ] Запустить canonical backend/frontend validation всех затронутых producer/consumer слоёв.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: medium
- Reason: read-only task-first landing bounded by existing backend attendance scope; production write semantics are explicitly excluded.

## Clarification questions
Не требуется: 01.09.2026 product owner подтвердил action-only состав,
исключенные состояния, порядок, partial-result и правила актуализации.

## Source notes
- Source file: `backlog/processed/2026-08-30.md`
- Original note: `вариант 2 (из обсуждения экрана «Посещение» 30.08.2026: оставить отдельную вкладку «Посещения» в навигации и наполнить её содержимым — список занятий на сегодня с быстрым входом в посещаемость занятия и счётчиком неотмеченных; сейчас раздел /attendance показывает только заглушку со ссылкой на расписание, данные открываются лишь из занятия; продуктовое решение, требует обновления REQ-ATT-006)`

## Processing notes
- Created at: 2026-08-30 18:11 MSK
- Created by skill: codex-backlog-skill
- Duplicate check: completed TASK-103 established the standalone route and TASK-104 improved the existing workbench, but neither owns a today-lessons landing; TASK-059 is superseded history with the opposite navigation model.
- Classification: tasks-ready because the accepted product variant is bounded to an authorized read list and navigation into the existing workbench.
