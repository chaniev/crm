# TASK-192: Уточнить филиальный охват клиентов тренера

## Status
done

## Requirements
- REQ-CLI-009 — verifies
- REQ-BRN-001 — constrains
- REQ-USR-001 — constrains

## Requirement context
- [REQ-CLI-009](../../../docs/requirements/01-клиенты.md)
- [REQ-BRN-001](../../../docs/requirements/09-филиалы-и-настройки.md)
- [REQ-USR-001](../../../docs/requirements/05-пользователи-и-роли.md)

## Goal
Однозначно определить, каких клиентов видит тренер, не расширяя его доступ
на основании неоднозначного выражения «свой филиал».

## Context
REQ-CLI-009 допускает только клиентов назначенных групп и активных замещений,
а REQ-BRN-001 не предусматривает прямого филиала тренера: филиалы определяются
через группы. Это уже более узкое ограничение, чем «все клиенты филиала»;
назначения могут относиться к нескольким филиалам.

На main `8773321` Staff API, Bot API и photo service проверяют назначения
Coach. `ClientsApiTests`, `InternalBotApiTests` и
`GroupTrainerSubstitutionAccessMatrixTests` содержат соответствующие сценарии,
включая ограничения данных и замещения. В triage прочитан код тестов;
новый запуск и runtime-проверка не выполнялись.

## Scope
- Уточнение завершено явным решением пользователя 24.10.2026:
  «тренеру доступны только клиенты своих групп».
- Подтверждён существующий охват REQ-CLI-009: назначенные группы, включая
  активные замещения по принятому правилу. Филиал не даёт самостоятельного
  доступа к клиентам других групп; отдельная привязка тренера к филиалу не вводится.
- В REQ-CLI-009 и CHANGELOG записано подтверждение. Изменение кода и отдельный
  implementation plan для этого продуктового уточнения не требуются.

## Constraints
- Действуют принятые REQ-CLI-009 и REQ-BRN-001; доступ ко всем клиентам
  филиала не предоставляется.
- Скрытие телефонов, контактов и финансов тренеру сохраняется; чтение клиентов
  не предоставляет управление ими или посещениями чужих групп.
- [TASK-191](../../risky/TASK-191-administrator-client-branch-access.md) исправляет
  администратора независимо от этого продуктового вопроса.

## Acceptance criteria
- [x] Записано явное решение о группах/филиалах и его источник.
- [x] Подтверждён текущий охват; варианты нового филиального доступа отклонены
  выбором «только клиенты своих групп», поэтому вопросы новой модели сняты.
- [x] Карточка закрыта продуктовым уточнением; требования и актуальные ссылки обновлены.

## Test checklist
- Сценарии доступа по группам, среза данных и замещений уже присутствуют
  в ClientsApiTests, InternalBotApiTests и GroupTrainerSubstitutionAccessMatrixTests.
  В этом уточнении приложение не менялось, повторный запуск тестов не заявляется.
- Требуемая проверка текущих изменений — knowledge harness, ссылки, metadata
  и согласованность расположения карточки; результат записан в triage-log.

## AI safety
- Safe for autonomous implementation: no — задача закрыта уточнением без реализации.
- Risk level: low для фиксации принятого решения.
- Reason: разрешения не расширяются; изменение группового охвата в будущем
  потребует отдельного продуктового решения и authorization review.

## Clarification questions
- [x] Сохраняется доступ только к клиентам своих групп — прямое решение пользователя.
- [x] Вопросы нового филиального охвата сняты: расширение не выбрано;
  существующие правила назначений и активных замещений сохраняются.

## Evidence
- [Client queries](../../../backend/src/GymCrm.Api/Auth/ClientQueryEndpoints.cs)
- [Bot API service](../../../backend/src/GymCrm.Infrastructure/Bot/BotApiService.cs)
- [Client photos](../../../backend/src/GymCrm.Infrastructure/Clients/ClientPhotoService.cs)
- [Substitution access matrix tests](../../../backend/tests/GymCrm.Tests/GroupTrainerSubstitutionAccessMatrixTests.cs)

## Source notes
- Source file: [2026-10-24.md](../../processed/2026-10-24.md).
- Original note: «администратор и тренер должен иметь доступ только к клентам своего филиала».
- Часть про администратора обработана в TASK-191.
- Clarification source: прямой ответ пользователя 24.10.2026 в текущем обсуждении:
  «тренеру доступны только клиенты своих групп».

## Processing notes
- Created at: 2026-10-24 11:23 MSK.
- Created by skill: codex-backlog-skill.
- Duplicate check: active cards, unfinished plans и dated done проверены;
  TASK-031 и TASK-073 уже закрепляют группы и замещения. Новая карточка
  фиксирует неопределённость новой формулировки, а не повторяет эти реализации.
- При первоначальном triage вопрос о трактовке оставался открытым;
  24.10.2026 пользователь подтвердил существующий групповой охват.
- Новая продуктовая модель, implementation plan и код не создавались.

## Completion record
- completed_at: 2026-10-24
- completion_date_evidence: явный ответ пользователя 24.10.2026,
  приведённый в Source notes; задача завершена уточнением требований,
  а не новой реализацией ранее существующего доступа.
- moved_to_done_at: 2026-10-24
- completion_kind: clarification — existing group scope confirmed.
- implementation_plan: not applicable — implementation не требовалась.
