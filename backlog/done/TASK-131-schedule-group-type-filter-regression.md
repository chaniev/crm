# TASK-131: Закрепить регрессии фильтра расписания по типу группы

## Status
done

## Requirements
- REQ-GRP-005 — verifies

## Goal
Фильтр `Тип группы` в актуальном календаре `/schedule` защищён прямыми backend, frontend component и Playwright regression-тестами, чтобы выбор, URL/API round-trip, очистка и совместная фильтрация не ломались незаметно.

## Context
TASK-119 заменила недельный шаблон полноценным календарём занятий и попутно реализовала пользовательскую цель TASK-113 через approved server-side schedule contract: `groupTypeId` хранится в URL, отправляется в `GET /schedule/lessons`, а access-scoped `groupTypes` возвращаются в response `filterOptions`.

Status audit TASK-113 от 2026-08-24 подтвердил, что production behavior существует, но текущие component/E2E сценарии выбирают преимущественно `Филиал`; `groupTypes` присутствуют в fixtures без отдельного end-to-end утверждения выбора, фильтрации, очистки и reset. В `ScheduleLessonsApiTests` нет focused запроса по `groupTypeId`.

## User role
Тренер / администратор / главный тренер и любой пользователь с разрешённым backend schedule scope.

## Problem
Ключевой путь фильтра типа группы реализован внутри большой TASK-119, но не имеет собственного минимального regression barrier. Ошибка сериализации URL/API, backend exact predicate, очистки или active-count может пройти общие calendar tests незамеченной.

## Scope
- Добавить backend integration coverage `GET /schedule/lessons` для exact `groupTypeId` predicate и AND-composition минимум с одним другим schedule filter.
- Подтвердить, что `filterOptions.groupTypes` строятся только из backend-authorized schedule scope и остаются доступны при filtered-empty результате по текущему TASK-119 contract.
- Добавить frontend API-client test сериализации `groupTypeId` вместе с `from`, `to` и соседним filter param.
- Добавить `GroupScheduleScreen` component tests: response option отображается, выбор пишет `groupTypeId` в URL и новый API request, active count обновляется, отдельная очистка и общий `Сбросить фильтры` удаляют значение без потери `date`/`view`.
- Добавить focused Playwright workflow на mobile и wide viewport: выбрать тип, увидеть только matching занятия в chronological order, очистить/reset и сохранить отсутствие page-level horizontal overflow.
- Подтвердить сохранение `groupTypeId` через manual refresh/retry и browser reload/back-forward в пределах текущего URL-backed contract.

## Out of scope
- Возврат к frontend-local `applyScheduleFilters` или расширение legacy `groupSchedule` helpers.
- Удаление фильтра из URL/API, новый client-side catalog request или перенос schedule semantics из backend.
- Contextual pruning/auto-clear filter options, интерактивная type legend, weekday-template counts или восстановление старого `CompactFilterPanel`.
- Изменение permissions, access scope, schedule conflict rules, database schema или календарной модели TASK-119.
- Исправление обнаруженного production defect без отдельного подтверждения scope; тест должен сначала зафиксировать RED и точную причину.

## Constraints
- Зафиксировать текущий approved TASK-119 contract: server-side exact filtering, URL-backed state и backend-provided access-scoped options.
- Backend остаётся владельцем access scope и schedule filtering semantics; frontend только сериализует выбор и отображает response.
- Тестовые данные должны содержать минимум два типа групп и различимые занятия, иначе predicate не проверяется.
- Assertions должны использовать public URL/API/UI contracts и accessible names, а не private Mantine classes или internal implementation details.
- Не ослаблять существующие calendar, permission, retry, responsive и target-iPhone barriers.

## Acceptance criteria
- [x] Backend test доказывает, что `groupTypeId` возвращает только занятия выбранного типа и корректно комбинируется с другим фильтром.
- [x] Backend test доказывает, что unauthorized group types не попадают в `filterOptions`, а authorized options не исчезают только из-за filtered-empty результата.
- [x] Frontend API test доказывает точную сериализацию `groupTypeId`.
- [x] Component test выбирает `Тип группы`, проверяет URL, API request, active count, clear и global reset с сохранением `date`/`view`.
- [x] Component test сохраняет selected `groupTypeId` при refresh/retry и URL round-trip.
- [x] Mobile и wide Playwright scenarios проверяют matching results, chronological order, clear/reset и отсутствие горизонтального overflow.
- [x] Existing full backend/frontend validation остаётся зелёной; production behavior не меняется, если тесты подтверждают текущий contract.

## Test checklist
- [x] Добавить focused xUnit cases в `backend/tests/GymCrm.Tests/ScheduleLessonsApiTests.cs`.
- [x] Добавить query serialization case в `frontend/src/lib/api/schedule.test.ts`.
- [x] Добавить focused component cases в `frontend/src/features/schedule/GroupScheduleScreen.test.tsx`.
- [x] Добавить mobile/wide workflow в `frontend/e2e/group-schedule.spec.ts` и при необходимости включить существующий target-iPhone suite без дублирования viewport inventory.
- [x] Запустить backend format, Release build, NuGet audit и focused/full backend tests.
- [x] Запустить `cd frontend && npm run check`, affected Chromium и `npm run test:e2e:iphone` для schedule flow.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: medium
- Reason: задача меняет только regression coverage существующего read contract, но затрагивает backend-owned access-scoped schedule endpoint и основной mobile calendar workflow; production change требует отдельного подтверждения после observed RED.

## Clarification questions
Не требуется. Текущий TASK-119 URL/API/filterOptions contract является baseline; TASK-113 закрыта как superseded, а эта задача не возвращает её устаревшую архитектуру.

## Source notes
- Source file: direct conversation on 2026-08-24; no inbox file.
- Original note: выполнить рекомендации status audit TASK-113 — закрыть её как superseded-by-TASK-119 и вынести недостающие group-type regression tests в отдельную компактную задачу.
- Related completed task: `/backlog/done/TASK-113-schedule-group-type-organization.md`.
- Superseding implementation: `/backlog/done/TASK-119-full-lesson-calendar.md`, candidate `5a5cabe`.

## Processing notes
- Created at: 2026-08-24 09:44 MSK
- Created by skill: codex-backlog-skill
- Duplicate check: TASK-113 owns the historical product request and is closed as superseded; TASK-119 owns the implemented calendar contract; no active task owns direct group-type filter regression coverage.
- Classification: `tasks-ready`, because the contract and test boundaries are explicit and no production behavior, permission, schema or scheduling rule change is authorized.

## Implementation lifecycle
- moved_to_implementation_at: 2026-08-29 21:32 MSK
- completed_at: 2026-09-02 07:33 MSK
- candidate_branch: feature/TASK-131-schedule-group-type-filter-regression
- completion_evidence: harness `verify_change --base origin/main --task-id TASK-131` passed 16/16 checks on the candidate tree — backend format/Release build/514 tests/NuGet audit, frontend install/audit/check, focused group-type unit runs (backend ScheduleLessonsApiTests 21/21, frontend 36/36), Chromium `group-schedule.spec.ts` 18/18 including the new query-sensitive mobile/wide workflow, and both target-iPhone WebKit schedule projects 72/72.
- outcome: regression coverage only; no production code changed and no production defect surfaced (all new tests were green against the TASK-119 contract baseline, as the plan expected).
- post_merge_evidence: local main advanced during implementation (TASK-167 action rename, TASK-168 attendance worklist), so the merge tree 677af63 was re-verified: canonical backend area green, `npm run check` green (659 unit tests, build), Chromium `group-schedule.spec.ts` 15/15 and both target-iPhone schedule projects 68/68. One unrelated full-suite timing flake (`stale occurrence change preserves draft`) failed once under harness load and passed on the immediate full re-run.
- moved_from: /backlog/tasks-ready
- implementation_plan: /backlog/implementation-plans/TASK-131-schedule-group-type-filter-regression.plan.md
- implementation_branch: feature/TASK-131-schedule-group-type-filter-regression
