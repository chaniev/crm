# TASK-178: Проверить устаревший title после выхода

## Status
tasks-ready

## Requirements
- REQ-NFR-001 — verifies

## Requirement links
- [REQ-NFR-001](../../docs/requirements/08-нефункциональные.md) — verifies

## Goal
После выхода заголовок вкладки соответствует экрану входа и названию клуба.

## Context
Аудит сообщает «Внимание • K-4PRO» на auth. Текущий useAppDocumentTitle зависит от session; getAppDocumentTitle уже возвращает auth title, есть unit-тесты auth stages. Причина на текущем main не подтверждена.

## Scope
- Воспроизвести полный logout из «Внимание» и другого раздела с customer club name; сопоставить build исходного аудита.
- Если дефект подтверждён — минимальная коррекция session/title lifecycle в рамках существующего контракта; иначе закрыть только с runtime evidence.

## Constraints
- Backend сохраняет владение CRM-правилами; triage не разрешает реализацию.
- Перед реализацией нужен ready plan по docs/HARNESS.md; для визуальных изменений — применимый design gate.
- При завершении обновить состояние связанных требований и docs/requirements/CHANGELOG.md.

## Acceptance criteria
- [ ] После успешного logout title отражает auth stage; после повторного входа — текущий маршрут.
- [ ] Зафиксированы build, шаги и результат; наличие unit-теста само по себе не считается опровержением runtime-наблюдения.

## Test checklist
- [ ] Интеграционный browser-сценарий logout/login и title; отдельно отказ logout не должен ложно переводить в auth.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: low
- Reason: Проверка существующего route-title контракта; auth-политика не меняется.

## Evidence
- [frontend/src/app/useAppRoute.ts](../../frontend/src/app/useAppRoute.ts)
- [frontend/src/app/useAppRoute.test.tsx](../../frontend/src/app/useAppRoute.test.tsx)
- [frontend/src/App.tsx](../../frontend/src/App.tsx)

## Source notes
- Source file: [2026-09-30.md](../processed/2026-09-30.md)
- Source items: 9 (порядок самостоятельных пунктов, без строк-продолжений).
- Источник наблюдений: UI-аудиты 18.09 и 30.09.2026, стенд c2b6cdf; в этом triage новый runtime-аудит не проводился.

> обновлять title страницы после выхода (на экране входа остаётся «Внимание • K-4PRO»)

## Processing notes
- Created at: 2026-10-05 (MSK).
- Created by skill: codex-backlog-skill.
- Mode: triage; scope: два файла inbox, без глобальной сверки статусов.
- Duplicate check: TASK-126 декомпозировала shell. Новый аудит — отдельный regression candidate, не основание переоткрывать весь рефакторинг.
- Проверены активные карточки, unfinished plans и рекурсивный done; новые ID выделены после TASK-171.
