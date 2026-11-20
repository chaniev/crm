# TASK-185: Согласовать единые подписи, валюту и диапазоны времени

## Status
needs-clarification

## Requirements
- pending — утверждённые замены «ВЕРСИЙ: 0» и «ОТЧЁТНОСТЬ · ЮНИОРЫ», единицы и scope.

## Requirement context
- [REQ-NFR-007](../../docs/requirements/08-нефункциональные.md) — constrains
- [REQ-SUB-001](../../docs/requirements/03-абонементы-и-оплаты.md) — constrains
- [REQ-GRP-007](../../docs/requirements/02-группы.md) — constrains

## Goal
Подписи пользовательских данных понятны и единообразны.

## Context
Источник объединяет точечную унификацию тире и валюты с неопределённым запросом «человеческих формулировок». Значение слова «версии» нельзя менять без проверки доменной семантики.

## Scope
- Утвердить таблицу текущий текст → новый текст: диапазон времени, цена с валютой, версии и отчётность.
- Уточнить экраны и правила нулевых значений; менять layer-owned resources, сохраняя domain/API codes.

## Constraints
- Backend сохраняет владение CRM-правилами; triage не разрешает реализацию.
- Перед реализацией нужен ready plan по docs/HARNESS.md; для визуальных изменений — применимый design gate.
- При завершении обновить состояние связанных требований и docs/requirements/CHANGELOG.md.

## Acceptance criteria
- [ ] Каждое изменение copy имеет согласованный текст и точный пользовательский контекст.
- [ ] Смысл истории/версий и денежных значений сохранён; реестр/CHANGELOG обновлены до реализации.

## Test checklist
- [ ] После решения: ноль/одна/много версий, длинное название, стоимость 0, диапазон времени и локализация.

## AI safety
- Safe for autonomous implementation: no
- Risk level: low
- Reason: Отсутствует конечная формулировка; техническая унификация не должна подменить значение данных.

## Clarification questions
- [ ] Чем заменить «ВЕРСИЙ: 0» и «ОТЧЁТНОСТЬ · ЮНИОРЫ»; нужно ли скрывать нулевой счётчик?
- [ ] Закрепить диапазон через «–» и валюту «₽» у поля цены для всех соответствующих форм?

## Evidence
- [frontend/src/resources/fe-15-finance.ts](../../frontend/src/resources/fe-15-finance.ts)
- [docs/requirements/08-нефункциональные.md](../../docs/requirements/08-нефункциональные.md)

## Source notes
- Source file: [2026-09-30.md](../processed/2026-09-30.md)
- Source items: 16 (порядок самостоятельных пунктов, без строк-продолжений).
- Источник наблюдений: UI-аудиты 18.09 и 30.09.2026, стенд c2b6cdf; в этом triage новый runtime-аудит не проводился.

> мелкая унификация копирайтинга: тире во времени («18:00-19:00» в расписании против «18:00–19:00» в посещениях), валюта у поля «Цена» в форме абонемента, человеческие формулировки вместо «ВЕРСИЙ: 0» и «ОТЧЁТНОСТЬ · ЮНИОРЫ»

### Дополнение из аудита 20.11.2026

- Source file: [09-audit-log](../processed/2026-11-20-interface-audit/09-audit-log/README.md)
- Source file: [11-settings-catalog](../processed/2026-11-20-interface-audit/11-settings-catalog/README.md)
- Source file: [16-profile-password](../processed/2026-11-20-interface-audit/16-profile-password/README.md)
- Source file: [19-group-create](../processed/2026-11-20-interface-audit/19-group-create/README.md)
- Source file: [20-schedule-lesson-form](../processed/2026-11-20-interface-audit/20-schedule-lesson-form/README.md)
- Source file: [22-group-edit](../processed/2026-11-20-interface-audit/22-group-edit/README.md)
- Source file: [23-coach-edit](../processed/2026-11-20-interface-audit/23-coach-edit/README.md)
- AUD-02: видны ClientMessengerTelegramConversationViewed/ClientNoteChanged; GED-03: в клиентах группы сырой Active. PWD-01, GNEW-01, LES-02, CED-01 — кандидаты сокращения повторных инструкций, текста о будущих замещениях, «Получить предпросмотр» и «Для MVP доступен только Telegram». CAT-02: пояснение смысла периода каталога сопоставить с TASK-175.

## Processing notes
- Created at: 2026-10-05 (MSK).
- Created by skill: codex-backlog-skill.
- Mode: triage; scope: два файла inbox, без глобальной сверки статусов.
- Duplicate check: TASK-095 убирала служебные тексты, TASK-165 запрещала менять copy при extraction; отдельный запрос не считается выполненным этим переносом.
- Проверены активные карточки, unfinished plans и рекурсивный done; новые ID выделены после TASK-171.

- Updated at: 2026-11-20 19:43 (Europe/Moscow); mode: triage, аудит интерфейса 20.11.2026.
- Добавлены контексты для таблицы текущий текст → согласованный текст. Отсутствующие enum-переводы проверять по существующим локализованным значениям; backend/domain codes не переименовывать. Варианты новых формулировок не приняты. Удаление полей/переключателей или фаз сохранения не входит в copy-задачу.
