# Implementation Plan: TASK-023 Добавить заметки в карточку клиента

## Source task
/backlog/implementation/TASK-023-client-card-notes.md

## Goal
В карточке клиента появляется сохраняемое поле рабочих заметок, которое переживает перезагрузку карточки и сохраняется через backend contract.

## Current understanding
В текущем коде у `Client` нет поля заметок: его нет в domain entity, EF configuration, `UpsertClientRequest`, `NormalizedClientRequest`, `ClientDetailsResponse`, frontend `ClientDetails`, `UpsertClientRequest` и `ClientFormValues`. Карточка клиента и форма редактирования собраны в `frontend/src/features/clients/ClientManagement.tsx`, а frontend mapping живет в `frontend/src/features/clients/ClientManagement.form.ts` и `frontend/src/lib/api/clients.ts`. Значит реализация будет локальным backend + frontend contract change с небольшой schema migration.

## Execution steps
1. Добавить backend contract-first поле `Notes`/`notes` как optional текст клиента: domain entity, EF max length, migration, DTO request/response и нормализация входящих данных.
2. Добавить backend validation для максимальной длины заметки и нормализацию пустой строки в `null` или пустое значение по единому выбранному правилу.
3. Обновить create/update flow: сохранять заметку при создании и редактировании клиента, возвращать ее в `ClientDetailsResponse`, не добавляя отдельную историю комментариев.
4. Сохранить текущие audit semantics для обновления клиента: не добавлять отдельный audit trail заметок, но явно проверить, попадает ли поле в существующий snapshot `ClientAuditState` и соответствует ли это принятой модели аудита.
5. Обновить frontend API types/mappers: `ClientDetails`, `UpsertClientRequest`, `ClientResponsePayload`, `mapClientDetails`, form values и `toUpsertClientPayload`.
6. Добавить поле заметки в форму создания/редактирования клиента и блок просмотра в карточке клиента. Использовать существующий error UX через `ApiError`, `applyFieldErrors` и `form.setErrors`.
7. Проверить, что пустое значение заметки сохраняется и не ломает загрузку старых клиентов без `notes` в payload.
8. Обновить тесты и e2e фикстуры, где client payload моделируется вручную.

## Preferred implementation strategy
1. Backend contract and schema first.
2. Backend integration tests for create/update/get behavior.
3. Frontend typed contract/mappers.
4. Incremental UI integration in the existing client form/card.
5. Focused frontend regression coverage and full required validation.

## Files likely to change
- backend/src/GymCrm.Domain/Clients/Client.cs
- backend/src/GymCrm.Infrastructure/Persistence/Configurations/ClientConfiguration.cs
- backend/src/GymCrm.Infrastructure/Persistence/Migrations/*
- backend/src/GymCrm.Api/Auth/UpsertClientRequest.cs
- backend/src/GymCrm.Api/Auth/NormalizedClientRequest.cs
- backend/src/GymCrm.Api/Auth/ClientDetailsResponse.cs
- backend/src/GymCrm.Api/Auth/ClientEndpoints.cs
- backend/src/GymCrm.Api/Auth/ClientAuditState.cs
- backend/src/GymCrm.Api/Auth/ClientResources.cs
- backend/src/GymCrm.Api/Auth/Resources/ClientResources.resx
- backend/tests/GymCrm.Tests/ClientsApiTests.cs
- frontend/src/lib/api/types.ts
- frontend/src/lib/api/clients.ts
- frontend/src/features/clients/ClientManagement.form.ts
- frontend/src/features/clients/ClientManagement.tsx
- frontend/e2e/stage12.spec.ts
- frontend/e2e/responsive-main-screens.spec.ts

## Constraints
- Backend owns validation semantics and persistence.
- Не хранить заметки только во frontend.
- Не менять roles/permissions ради этой задачи.
- Не добавлять threaded comments, уведомления или отдельный audit trail заметок.
- Не ломать существующие client create/update contracts для старых payload без `notes`.

## Out of scope
- История комментариев.
- Несколько заметок на одного клиента.
- Уведомления и mentions.
- Перенастройка access scope тренеров.

## Required test coverage

### Unit tests
Добавить или обновить frontend unit tests для form/mapping логики, если рядом есть подходящий Vitest harness: `toClientFormValues`, `toUpsertClientPayload`, пустая заметка и заметка с пробелами. Если mapper tests отсутствуют, покрыть это через e2e payload assertion и не вводить крупный новый test harness.

### Integration tests
Обновить `backend/tests/GymCrm.Tests/ClientsApiTests.cs`:
1. create client with notes -> GET details returns notes;
2. update notes -> GET details after reload returns new value;
3. update with empty notes -> backend stores normalized empty value;
4. too long notes -> ProblemDetails validation error on `notes`.

### UI tests
Обновить или добавить Playwright coverage в `frontend/e2e/stage12.spec.ts`: редактирование клиента отправляет `notes`, успешное сохранение возвращает карточку, заметка видна после повторной загрузки. При необходимости обновить shared fixtures в responsive specs, чтобы client payload включал `notes`.

## Test plan
- [ ] Запустить `dotnet test backend/GymCrm.slnx`.
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Запустить affected Playwright scenario для client create/edit/card flow.
- [ ] Вручную проверить создание, обновление, очистку и reload заметки в карточке клиента.

## Regression barrier
Главный regression barrier: backend integration tests должны доказать, что `notes` сохраняется в БД, возвращается через details API и валидируется backend-ом; frontend e2e должен доказать, что UI отправляет заметку, показывает ошибку существующим error UX и отображает сохраненное значение после reload.

## Risks
- Если заметка будет добавлена в общий `PUT /clients/{id}`, frontend должен всегда отправлять текущее значение, иначе редактирование базовых данных может случайно очистить заметку.
- У роли `Coach` сейчас нет `canManageClients`; если реализация потребует давать тренеру право редактировать заметки, это уже изменение permissions и отдельная задача.
- Существующий audit snapshot клиента может начать содержать заметки; нужно принять локальное решение без добавления отдельного audit trail.
- E2E fixtures вручную собирают client payload и могут начать падать, если поле будет обязательным вместо optional.

## Stop conditions
Остановиться и не писать код, если:
- выяснится, что заметки должны быть отдельной историей комментариев;
- требуется менять auth/roles/permissions или access scope;
- нужно скрывать заметки по сложным правилам видимости, которых нет в backend;
- schema change окажется production-critical destructive migration;
- scope расширится на уведомления, mentions или audit trail.

## Ready for Codex execution
yes
