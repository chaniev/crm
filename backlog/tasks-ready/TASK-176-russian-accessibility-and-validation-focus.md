# TASK-176: Исправить язык, доступные имена и фокус ошибок форм

## Status
tasks-ready

## Requirements
- REQ-NFR-001 — implements
- REQ-NFR-007 — constrains

## Requirement links
- [REQ-NFR-001](../../docs/requirements/08-нефункциональные.md) — implements
- [REQ-NFR-007](../../docs/requirements/08-нефункциональные.md) — constrains

## Goal
Русский интерфейс корректно объявляет язык и действия; ошибка отправки переводит фокус на первое невалидное поле.

## Context
index.html содержит lang="en"; UserCreateScreen отправляет форму без явного invalid callback. PasswordInput/NumberInput recipes не задают локализованные имена соответствующих внутренних кнопок. У MobileBottomNavigation closeButtonProps уже есть русское aria-label: эту часть заметки нужно воспроизвести, а не считать установленным отсутствием.

## Scope
- Установить язык русского документа и resource-backed имена показа/скрытия пароля, закрытия уведомлений и степперов длительности.
- В формах создания/редактирования тренера обеспечить фокус/scroll к первому ошибочному полю после client/server validation.
- Проверить закрытие «Остальных разделов» на исходном сценарии; сохранить уже заданный label и focus return.

## Constraints
- Backend сохраняет владение CRM-правилами; triage не разрешает реализацию.
- Перед реализацией нужен ready plan по docs/HARNESS.md; для визуальных изменений — применимый design gate.
- При завершении обновить состояние связанных требований и docs/requirements/CHANGELOG.md.

## Acceptance criteria
- [ ] Контролы имеют осмысленные русские accessible names, различимые действия степперов и правильный lang.
- [ ] После неуспешной отправки первое ошибочное поле получает фокус и остаётся видимым; текст ошибки связан с полем.
- [ ] Расхождение по close sheet подтверждено воспроизведением либо закрыто документированным evidence.

## Test checklist
- [ ] DOM/accessibility tree для auth, trainer form, toast, group duration и overflow sheet.
- [ ] Client/server error, keyboard и target-iPhone; успешная отправка не крадёт фокус.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: low
- Reason: Исполняет существующий контракт доступности; validation semantics остаются backend-owned.

## Evidence
- [frontend/index.html](../../frontend/index.html)
- [frontend/src/features/users/UserCreateScreen.tsx](../../frontend/src/features/users/UserCreateScreen.tsx)
- [frontend/src/features/users/UserEditScreen.tsx](../../frontend/src/features/users/UserEditScreen.tsx)
- [frontend/src/theme/componentRecipes.ts](../../frontend/src/theme/componentRecipes.ts)
- [frontend/src/features/shared/MobileBottomNavigation.tsx](../../frontend/src/features/shared/MobileBottomNavigation.tsx)
- [docs/MOBILE_UI_CONTRACT.md](../../docs/MOBILE_UI_CONTRACT.md)

## Source notes
- Source file: [2026-09-30.md](../processed/2026-09-30.md)
- Source items: 5, 6, 7 (порядок самостоятельных пунктов, без строк-продолжений).
- Источник наблюдений: UI-аудиты 18.09 и 30.09.2026, стенд c2b6cdf; в этом triage новый runtime-аудит не проводился.

> исправить html lang="en" на "ru" при полностью русском интерфейсе (index.html), скринридеры читают русский текст английской фонетикой

> после провала валидации перемещать фокус на первое невалидное поле (форма тренера: ошибки показаны, фокус остаётся на body)

> локализовать/именовывать доступные имена контролов: «Toggle password visibility» у всех PasswordInput, безымянные кнопки закрытия toast-уведомлений и шита «Остальные разделы», безымянные степперы NumberInput «Длительность»

## Processing notes
- Created at: 2026-10-05 (MSK).
- Created by skill: codex-backlog-skill.
- Mode: triage; scope: два файла inbox, без глобальной сверки статусов.
- Duplicate check: TASK-165 владела resource extraction, TASK-161 — геометрией recipes; здесь конкретные a11y пробелы. Shared migration TASK-150 не должна повторять исправленные места.
- Проверены активные карточки, unfinished plans и рекурсивный done; новые ID выделены после TASK-171.
