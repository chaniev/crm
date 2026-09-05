# TASK-098: Убрать обычные статусные метки из списка тренеров

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-07-27 20:00
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/2026-07-30/TASK-098-trainer-list-default-badges-cleanup.plan.md
- implementation_branch: fix/TASK-098-trainer-list-default-badges-cleanup
- implementation_state: completed
- implementation_commit: f59ee8b
- delivered_on_main_at: 2026-07-30
- moved_to_done_at: 2026-07-30
- last_status_reviewed_at: 2026-07-30
- reviewed_main_commit: 79cce69

## Goal
Список тренеров показывает ФИО, идентификационные данные, исключительные состояния и доступное действие без повторения обычной роли и нормальных статусов.

## Context
В каждой обычной строке списка тренеров сейчас отображаются метки `Тренер`, `Активен` и `Пароль актуален`. Экран уже однозначно называется `Тренеры`, а положительные статусы не меняют текущее решение пользователя.

## User role
Суперадминистратор / главный тренер / другие роли с backend-разрешённым доступом к списку тренеров.

## Problem
Default-positive badges занимают место рядом с identity, ухудшают сканирование и конкурируют с исключительными состояниями, на которые действительно нужно обратить внимание.

## Scope
- Не показывать role badge `Тренер` для обычной coach-записи в trainer-only list.
- Не показывать `Активен`, когда `isActive = true`.
- Не показывать `Пароль актуален`, когда `mustChangePassword = false`.
- Сохранить decision-changing исключения: disabled/inactive, `Требуется смена пароля` и `Только просмотр`.
- Сохранить ФИО, логин, доступный Telegram ID и edit/read-only action.
- Удалить пустые badge wrappers и обновить component/Playwright tests.

## Out of scope
- Поиск тренеров: его покрывает TASK-096.
- Изменение backend users contract, списка возвращаемых ролей или allowed actions.
- Изменение create/edit forms.
- Скрытие non-Coach role marker, если backend-permitted список действительно содержит исключительную роль и она меняет решение пользователя.

## Constraints
- Frontend не выводит новые permission rules из роли или статусов.
- Исключительные состояния остаются видимыми текстом и не передаются только цветом.
- Primary identity и edit action не обрезаются при длинных ФИО/логинах.
- Выполнять после TASK-096 либо rebase-aware, потому что обе задачи меняют `UsersListScreen`.

## Acceptance criteria
- [x] У активного Coach с актуальным паролем отсутствуют видимые метки `Тренер`, `Активен` и `Пароль актуален`.
- [x] Для inactive/disabled записи остаётся явная текстовая метка исключения.
- [x] При `mustChangePassword = true` остаётся метка `Требуется смена пароля`.
- [x] При отсутствии mutation actions остаётся `Только просмотр`.
- [x] ФИО, логин, Telegram ID и разрешённое действие сохранены.
- [x] После удаления default badges нет пустой строки, лишнего отступа или пустого контейнера.
- [x] На 390 x 844, 420 x 912, 440 x 956, 912 x 420, 956 x 440, 768 x 1024 и 1440 x 1200 нет horizontal page scroll или clipping.

## Test checklist
- [x] Добавить component cases для normal, inactive, password-rotation и read-only rows.
- [x] Обновить users Playwright assertions на отсутствие default badges и сохранение exception statuses.
- [x] Проверить длинные ФИО и логины на обязательных responsive-размерах.
- [x] Запустить `cd frontend && npm run test:unit`.
- [x] Запустить `cd frontend && npm run lint`.
- [x] Запустить `cd frontend && npm run build`.
- [x] Запустить affected Playwright и mobile WebKit checks.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: локальная frontend hierarchy correction; backend status и permission semantics не меняются.

## Clarification questions
Не требуется: default-positive badges удаляются, decision-changing исключения сохраняются.

## Source notes
- Source file: `backlog/processed/2026-07-27-2.md`
- Original note: `В списке тренеров отображается текст "ТРЕНЕР" "АКТИВЕН" «ПАРОЛЬ АКТУАЛЕН». Этот текст необходимо удалить как лишний.`

## Processing notes
- Created at: 2026-07-27 01:04
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- Duplicate check: TASK-095 касается service/decorative copy, TASK-096 — поиска; активной задачи на default row badges не найдено.
- UX decision: normal/default statuses убрать, исключительные operational statuses сохранить.

## Completion record
- Completed on: 2026-07-30
- Implementation commit: `f59ee8b`
- Main merge commit: `79cce69`
- Integrated validation commit: `79cce69`
- Validation: frontend lint, build, raw-color check, 412 unit tests, 35 affected Chromium Playwright tests and 32 target-iPhone WebKit tests passed.
- Responsive coverage: long identity values and actions remain reachable at the required portrait, landscape, tablet and desktop sizes.
- Data storage: backend and database structure were not changed; migration is not required.
