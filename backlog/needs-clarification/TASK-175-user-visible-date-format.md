# TASK-175: Согласовать единый формат пользовательских дат

## Status
needs-clarification

## Requirements
- pending — целевой формат, допустимые исключения и границы для исторических audit descriptions.

## Requirement context
- [REQ-NFR-007](../../docs/requirements/08-нефункциональные.md) — constrains
- [REQ-AUD-001](../../docs/requirements/06-аудит.md) — constrains

## Goal
Даты в пользовательских текстах читаются последовательно и не меняют доменную дату или API.

## Context
AttendanceScreen использует resource-шаблон «Дата …»; в других сценариях применяются цифровые и длинные русские даты. REQ-NFR-007 отдельно требует согласовывать изменения форматирования.

## Scope
- Согласовать формат дат/даты-времени для посещений, каталога, продажи и журнала.
- Разделить форматирование date-only значений, timestamps и сохранённых описаний; API ISO-контракт сохраняется.

## Constraints
- Backend сохраняет владение CRM-правилами; triage не разрешает реализацию.
- Перед реализацией нужен ready plan по docs/HARNESS.md; для визуальных изменений — применимый design gate.
- При завершении обновить состояние связанных требований и docs/requirements/CHANGELOG.md.

## Acceptance criteria
- [ ] Приняты основной формат и исключения; определено поведение старых описаний журнала.
- [ ] Реестр и CHANGELOG обновлены до реализации; дата не сдвигается из-за часового пояса.

## Test checklist
- [ ] После решения: границы месяца/года, date-only в разных timezone, новые и исторические audit entries.

## AI safety
- Safe for autonomous implementation: no
- Risk level: medium
- Reason: Глобальное форматирование может исказить даты и затронуть неизменяемую историю.

## Clarification questions
- [ ] Основной формат — ДД.ММ.ГГГГ или длинная русская дата; какие исключения нужны?
- [ ] Менять только новые сообщения журнала или также отображение старых, сохраняя append-only данные?

## Evidence
- [frontend/src/features/attendance/AttendanceScreen.tsx](../../frontend/src/features/attendance/AttendanceScreen.tsx)
- [frontend/src/resources/fe-4-attendance.ts](../../frontend/src/resources/fe-4-attendance.ts)
- [backend/src/GymCrm.Application/Attendance/AttendanceAuditContract.cs](../../backend/src/GymCrm.Application/Attendance/AttendanceAuditContract.cs)

## Source notes
- Source file: [2026-09-30.md](../processed/2026-09-30.md)
- Source items: 4 (порядок самостоятельных пунктов, без строк-продолжений).
- Источник наблюдений: UI-аудиты 18.09 и 30.09.2026, стенд c2b6cdf; в этом triage новый runtime-аудит не проводился.

> унифицировать формат дат в пользовательском тексте: сейчас вперемешку ISO «2026-09-18» (экран отметки посещаемости, карточка каталога, фразы журнала), «18.09.2026» (финансы, журнал) и «18 сент. 2026 г.» (модал продажи)
>   (экран отметки интерполирует ISO без форматирования: fe-4-attendance.ts, шаблон attendanceScreen_template_a4d8a706)

## Processing notes
- Created at: 2026-10-05 (MSK).
- Created by skill: codex-backlog-skill.
- Mode: triage; scope: два файла inbox, без глобальной сверки статусов.
- Duplicate check: TASK-165 переносила ресурсы без изменения формата. TASK-182 локально добавляет календарную дату рядом с днём недели.
- Проверены активные карточки, unfinished plans и рекурсивный done; новые ID выделены после TASK-171.
