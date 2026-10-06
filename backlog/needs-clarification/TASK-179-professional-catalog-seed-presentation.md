# TASK-179: Уточнить представление системного Professional в каталоге

## Status
needs-clarification

## Requirements
- pending — скрытие/объяснение системного варианта или изменение seed и обработка сохранённых данных.

## Requirement context
- [REQ-SUB-001](../../docs/requirements/03-абонементы-и-оплаты.md) — constrains
- [REQ-SUB-007](../../docs/requirements/03-абонементы-и-оплаты.md) — constrains

## Goal
Системный профессиональный вариант понятен пользователю и сохраняет назначение действующих абонементов.

## Context
MembershipCatalogItemConfiguration действительно задаёт Professional, цену 0 и AvailableFrom 2020-01-01. Цена 0 — принятая семантика REQ-SUB-007, а не сломанный дефолт.

## Scope
- Определить, какую часть менять: видимость системной записи, подпись даты или seed.
- Если затронуты persisted данные, отдельно согласовать retained-data migration и rollback; старые миграции не переписывать.

## Constraints
- Backend сохраняет владение CRM-правилами; triage не разрешает реализацию.
- Перед реализацией нужен ready plan по docs/HARNESS.md; для визуальных изменений — применимый design gate.
- При завершении обновить состояние связанных требований и docs/requirements/CHANGELOG.md.

## Acceptance criteria
- [ ] Выбран вариант представления и роль, для которой он действует.
- [ ] Сохраняются цена 0, назначение Главным тренером и ссылки/история уже выданных Professional.

## Test checklist
- [ ] После решения: новый и сохранённый каталог, роли, действующие назначения; при schema/data change — clean/retained paths.

## AI safety
- Safe for autonomous implementation: no
- Risk level: high
- Reason: Удаление/изменение seed может нарушить существующие назначения и историю; нулевая цена является доменным правилом.

## Clarification questions
- [ ] Скрыть системный вариант в обычном каталоге или оставить с понятной подписью вместо технической даты?
- [ ] Нужны ли изменения существующих данных, или достаточно представления?

## Evidence
- [backend/src/GymCrm.Infrastructure/Persistence/Configurations/MembershipCatalogItemConfiguration.cs](../../backend/src/GymCrm.Infrastructure/Persistence/Configurations/MembershipCatalogItemConfiguration.cs)

## Source notes
- Source file: [2026-09-30.md](../processed/2026-09-30.md)
- Source items: 10 (порядок самостоятельных пунктов, без строк-продолжений).
- Источник наблюдений: UI-аудиты 18.09 и 30.09.2026, стенд c2b6cdf; в этом triage новый runtime-аудит не проводился.

> решить, что делать с засеянной записью каталога «Профессиональный • 0,00 ₽ • 2020-01-01 — бессрочно» — выглядит как сломанное значение по умолчанию
>   (продуктовое решение: скрыть пустой дефолт / засеивать осмысленные значения)

## Processing notes
- Created at: 2026-10-05 (MSK).
- Created by skill: codex-backlog-skill.
- Mode: triage; scope: два файла inbox, без глобальной сверки статусов.
- Duplicate check: TASK-070/115 задавали каталог и модель назначений; запрос меняет представление системной записи, не повторяет их реализацию.
- Проверены активные карточки, unfinished plans и рекурсивный done; новые ID выделены после TASK-171.
