# TASK-053: Полностью удалить системный идентификатор из типа группы

## Status
risky

## Goal
Тип группы хранится и редактируется без `SystemIdentifier`, потому что поле избыточно и не нужно в продуктовой модели.

## Context
В inbox есть заметка: "удалить системный идентификатор при создании типа группы". После дополнительного уточнения 2026-05-27 решение изменено: `SystemIdentifier` нужно удалить полностью из типа группы, а не только спрятать в форме создания. Сейчас типы групп появились как часть настроек CRM, и ранее для них был зафиксирован набор полей: название, описание и системный идентификатор.

## User role
главный тренер / администратор

## Problem
`SystemIdentifier` не несет необходимой продуктовой или доменной функции для типа группы, но уже попал в модель, API-контракт, БД-ограничения и frontend. Это создает лишнюю техническую сущность, которую пользователи не должны заполнять, видеть или поддерживать.

## Scope
- Удалить `SystemIdentifier` из backend domain model типа группы.
- Удалить `SystemIdentifier` из persistence mapping, database schema contract и уникальных индексов.
- Удалить `systemIdentifier` из create/update request, response DTO и audit state типов группы.
- Обновить backend validation/error handling: убрать required/length/uniqueness validation для `SystemIdentifier`.
- Обновить frontend API types, mapping и consumers под новый контракт без `systemIdentifier`.
- Убрать поле системного идентификатора из create/edit flow типа группы.
- Обновить validation/error handling так, чтобы frontend не дублировал backend validation semantics.
- Обновить участки frontend, которые сейчас используют `groupTypeSystemIdentifier` для отображения, сортировки, цветов или расписания, на backend-owned стабильный идентификатор типа группы (`groupTypeId`) или другое согласованное поле без восстановления `SystemIdentifier`.
- Сохранить корректное поведение редактирования существующих типов групп.

## Out of scope
- Перепроектирование всего раздела `Настройки`.
- Изменение справочников филиалов, залов или групп.
- Массовая миграция/переименование существующих названий типов групп без отдельного решения.
- Изменение расписания, посещаемости или membership logic.
- Добавление нового технического slug/code-поля вместо `SystemIdentifier`.

## Constraints
- Backend остается источником истины для group type validation semantics и ProblemDetails.
- Frontend не должен самостоятельно восстанавливать аналоги `SystemIdentifier` или придумывать доменные правила для нового технического кода.
- Изменение затрагивает backend contract/schema и должно быть реализовано и проверено как backend contract change с обновлением всех потребителей.
- Не ломать существующие группы, которые уже ссылаются на типы групп.

## Acceptance criteria
- [ ] В backend domain/persistence/API для типа группы больше нет `SystemIdentifier` / `systemIdentifier`.
- [ ] В БД-контракте типа группы нет колонки и уникального индекса `SystemIdentifier`.
- [ ] В формах создания и редактирования типа группы нет поля системного идентификатора.
- [ ] Создание и редактирование типа группы работают без `systemIdentifier` в request payload.
- [ ] API-ответы типов групп и групп не возвращают `systemIdentifier` / `groupTypeSystemIdentifier`.
- [ ] Frontend не содержит пользовательского или скрытого fallback-аналога `SystemIdentifier`.
- [ ] Validation errors по типам групп остаются backend-owned и отображаются во frontend без доменного дублирования.
- [ ] Существующие типы групп и группы с выбранным типом продолжают открываться и редактироваться корректно.

## Test checklist
- [ ] Backend tests: создать тип группы без системного идентификатора.
- [ ] Backend tests: обновить create/update/list/get contract assertions без `systemIdentifier`.
- [ ] Backend tests: проверить, что группы продолжают возвращать выбранный тип без `groupTypeSystemIdentifier`.
- [ ] Frontend lint + build.
- [ ] Frontend test или ручная проверка settings group type create/edit flow.
- [ ] Проверить, что создание/редактирование группы с выбранным типом не сломано.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача затрагивает backend domain model, database schema contract, API DTO, validation semantics, audit state и frontend consumers типов групп.

## Clarification questions
Уточнение закрыто 2026-05-27: `SystemIdentifier` нужно удалить полностью из-за избыточности и отсутствия необходимости.

## Source notes
- Source file: `backlog/inbox/2026-05-23.md`
- Original note: `удалить системный идентификатор при создании типа группы`
- Follow-up clarification, 2026-05-27: `надо удалить полностью SystemIdentifier из за его избыточности и отсутствия в нем необходимости`

## Processing notes
- Created at: 2026-05-23 19:09
- Created by skill: codex-backlog-skill
- Duplicate check: похожая активная задача не найдена; связано с завершенной `TASK-030-crm-settings-section`, но это новый follow-up к уже реализованному справочнику типов групп.
