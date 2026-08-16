# TASK-116: Открывать карточку клиента из посещений и группы

## Status
done

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-16 17:14
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/done/TASK-116-client-profile-context-navigation.plan.md
- implementation_branch: fix/TASK-116-client-profile-context-navigation
- implementation_state: completed
- implementation_commit: afc7f5c
- delivered_on_main_at: 2026-08-16
- moved_to_done_at: 2026-08-16
- last_status_reviewed_at: 2026-08-16

## Goal
Тренер или администратор открывает карточку видимого клиента из attendance roster или состава группы и возвращается в тот же рабочий контекст.

## Context
Карточки клиентов во вкладке `Требуют внимания` на главной уже содержат действие `Карточка клиента`. Однако client rows в attendance workspace на главной не передают navigation action, а read-only список клиентов внутри group edit показывает только ФИО, телефон и статус.

Существующий client details route и backend scope уже позволяют открывать доступную карточку; новый backend business contract не требуется.

## User role
Тренер / администратор / главный тренер с backend-разрешённым client scope.

## Problem
Из attendance и состава группы пользователь видит клиента, но вынужден покинуть контекст и повторно искать его в разделе `Клиенты`.

## Scope
- Добавить одно очевидное secondary/frequent действие открытия карточки в identity area attendance row.
- Добавить такое же действие в строку клиента group edit после status badge.
- Передать существующий `onOpenClient` route callback через affected components без дублирования route logic.
- Сохранить выбранные attendance group/date/view при возврате из client details.
- Возвращать пользователя в ту же group edit route после открытия карточки из состава группы.
- Использовать существующий forbidden/not-found route recovery.
- Добавить focused component и Playwright regression coverage.

## Out of scope
- Карточки `Требуют внимания`, где переход уже существует.
- Редактирование клиента из attendance/group row.
- Изменение backend client scope или permissions.
- Превращение всей attendance row в clickable surface.
- Общий redesign attendance или group edit.

## Constraints
- Attendance mark controls остаются primary и не конкурируют с profile action.
- На narrow mobile допустим icon-only control со стабильным accessible name `Открыть карточку клиента {ФИО}`.
- Действие имеет hit area не меньше `44 x 44px`, visible focus и не перекрывает имя, статус или attendance controls.
- Pending attendance save не должен молча теряться; если навигация блокируется, пользователь получает доступную причину.
- Back/forward и permission recovery используют существующую typed routing model.
- Fixed/sticky controls, safe area и compact height не должны закрывать row action.

## Acceptance criteria
- [x] У каждого клиента attendance roster есть ровно одно очевидное действие открытия его карточки.
- [x] У каждого клиента в составе group edit есть такое же действие.
- [x] Attendance status actions сохраняют визуальный и keyboard priority.
- [x] Действие открывает правильный `clientId` и имеет имя с ФИО клиента.
- [x] Back из карточки возвращает выбранные attendance group/date/view или исходную group edit route.
- [x] Forbidden/not-found обрабатываются существующим recovery UX, без dead click.
- [x] На `390 x 844`, `420 x 912`, `440 x 956`, `912 x 420`, `956 x 440`, `768px` и `1440px` нет horizontal overflow, overlap или недоступной зоны касания.

## Test checklist
- [x] Добавить component tests для `AttendanceClientRow` и group client row с правильным `clientId`.
- [x] Добавить Playwright: attendance -> client -> back с сохранением group/date/view.
- [x] Добавить Playwright: group edit -> client -> back в ту же группу.
- [x] Проверить allowed и permission-restricted paths, keyboard order и visible focus.
- [x] Запустить frontend lint, build, unit tests, affected Chromium и target-iPhone WebKit tests.

## AI safety
- Safe for Codex: yes
- Risk level: medium
- Reason: задача ограничена frontend-навигацией через существующий client details contract; backend permissions и membership/attendance rules не меняются.

## Clarification questions
Не требуется: затронутые строки и return-context contract подтверждены UX/UI-анализом; `Требуют внимания` исключены как уже реализованные.

## Source notes
- Source file: `backlog/processed/2026-08-16.md`
- Original note: `Нельзя открыть профиль спортсмена с главной страницы/из группы`

## Processing notes
- Created at: 2026-08-16 16:45
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- Duplicate check: активного дубликата нет; существующий переход из `Требуют внимания` покрывает только часть заметки, а TASK-017 относится к возврату из реестра клиентов.
- UX/UI handoff: целевые surfaces — attendance roster на главной и client rows внутри group edit; whole-row click исключён из-за конкуренции с attendance actions.

## Completion record
- Completed on: 2026-08-16.
- Implementation commit: `afc7f5c`; integrated into local `main` by fast-forward at `bae4d08`.
- Validation: frontend lint, production build, 446 unit tests, 65 affected Chromium Playwright tests and 34 target-iPhone WebKit tests passed.
- Data storage: backend, API and database structure were not changed; migration is not required.
- Runtime: no Docker Compose task stack was created because the plan required frontend component and mocked browser validation only.
- Residual device evidence: physical Safari chrome, software keyboard, safe-area, iOS Simulator and physical-device checks were not performed; target-iPhone WebKit portrait and compact-landscape profiles passed.
