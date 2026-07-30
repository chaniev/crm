# TASK-097: Оставить одно действие возврата на экранах редактирования

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-07-27 20:00
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/TASK-097-trainer-edit-single-return-action.plan.md
- implementation_branch: fix/TASK-097-trainer-edit-single-return-action
- implementation_state: completed
- implementation_commit: 0f22419
- delivered_on_main_at: 2026-07-30
- moved_to_done_at: 2026-07-30
- last_status_reviewed_at: 2026-07-30
- reviewed_main_commit: 79cce69

## Goal
Пользователь редактирует тренера и другие сущности без конкурирующих кнопок возврата: сохранение остаётся единственным primary action, а возврат к списку представлен один раз.

## Context
На экране редактирования тренера одновременно показаны верхняя кнопка `Назад к списку` и нижняя кнопка `К списку`. Обе ведут в один список, а нижняя кнопка визуально конкурирует с `Сохранить изменения`.

В inbox также зафиксировано требование проверить остальные edit screens на такие же дубликаты.

## User role
Суперадминистратор / главный тренер / администратор / другие роли с backend-разрешённым редактированием.

## Problem
Два одинаковых действия выхода увеличивают число решений на форме и повышают риск случайного ухода вместо сохранения.

## Scope
- На экране редактирования тренера сохранить route/header action `Назад к списку` и удалить нижнее дублирующее действие `К списку`.
- Оставить в form footer только primary action `Сохранить изменения`.
- Проверить остальные frontend edit routes и удалить одновременно видимые действия, если они ведут в один и тот же parent/list без разницы в результате.
- Сохранить ровно одно доступное действие возврата в loading, error, read-only и editable states.
- Обновить component и Playwright regression coverage.

## Out of scope
- Экран создания тренера и create-flow других сущностей.
- Добавление unsaved-changes confirmation, если его нет в текущем контракте.
- Изменение backend validation, ролей, permissions или allowed actions.
- Удаление `Отмена`, если она закрывает modal/drawer или имеет результат, отличный от route-level возврата.
- Service/decorative copy экрана тренера: её покрывает TASK-095.

## Constraints
- Primary save не скрывается в overflow и остаётся визуально доминирующим.
- Удаление дубликата не должно убрать единственный recovery path из error/read-only state.
- Visual и focus order должны соответствовать task order.
- Выполнять после TASK-095 либо с явно согласованным ownership `UserEditScreen`, чтобы не смешивать конфликтующие изменения.

## Acceptance criteria
- [x] На экране редактирования тренера одновременно отображается ровно одно действие возврата к списку.
- [x] Сохранена верхняя кнопка `Назад к списку`; нижняя кнопка `К списку` отсутствует.
- [x] В form footer единственным действием редактирования остаётся `Сохранить изменения`.
- [x] Проверены остальные edit routes; одинаковые возвраты к одному destination не дублируются.
- [x] Loading, error, read-only и editable states сохраняют доступный возврат.
- [x] На 390 x 844, 420 x 912, 440 x 956, 912 x 420, 956 x 440, 768 x 1024 и 1440 x 1200 нет clipping, horizontal page scroll или недостижимого primary action.
- [x] Keyboard focus order соответствует визуальному порядку, а доступное имя возврата однозначно сообщает destination.

## Test checklist
- [x] Обновить `UserEditScreen` component tests: один возврат, сохранённый submit и operational states.
- [x] Добавить inventory/regression проверку edit routes на два одинаковых return destinations.
- [x] Обновить affected users Playwright flow: открыть редактирование → вернуться; открыть повторно → сохранить.
- [x] Запустить `cd frontend && npm run test:unit`.
- [x] Запустить `cd frontend && npm run lint`.
- [x] Запустить `cd frontend && npm run build`.
- [x] Запустить affected Playwright и mobile WebKit checks.

## AI safety
- Safe for Codex: yes
- Risk level: low
- Reason: bounded frontend navigation cleanup без изменения данных, бизнес-правил или backend contracts.

## Clarification questions
Не требуется: UI-контракт оставляет route/header return и удаляет footer-дубликат.

## Source notes
- Source file: `backlog/processed/2026-07-27-2.md`
- Original note: `из двух кнопок возврата к списку тренеров оставить одну`
- Original note: `Необходимо проверить все экраны редактирования на наличие дублирующих кнопок.`

## Processing notes
- Created at: 2026-07-27 01:04
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- Duplicate check: TASK-095 покрывает decorative copy, но не дублирующие действия; TASK-093 задаёт placement primary actions, но не edit-screen return contract.
- UI decision: оставить route/header back, удалить footer-дубликат.

## Completion record
- Completed on: 2026-07-30
- Implementation commit: `0f22419`
- Main merge commit: `b7e8d5c`
- Integrated validation commit: `79cce69`
- Validation: frontend lint, build, raw-color check, 412 unit tests, 35 affected Chromium Playwright tests and 32 target-iPhone WebKit tests passed.
- Edit inventory: trainer, client and group edit routes keep one route-level return; create-flow cancellation remains available.
- Data storage: backend and database structure were not changed; migration is not required.
