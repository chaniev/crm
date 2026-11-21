# TASK-178: Проверить устаревший title после выхода

## Status
done

## Requirements
- REQ-NFR-001 — verifies

## Requirement links
- [REQ-NFR-001](../../../docs/requirements/08-нефункциональные.md) — verifies

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
- [x] После успешного logout title отражает auth stage; после повторного входа — текущий маршрут.
- [x] Зафиксированы build, шаги и результат; наличие unit-теста само по себе не считается опровержением runtime-наблюдения.

## Test checklist
- [x] Интеграционный browser-сценарий logout/login и title; отдельно отказ logout не должен ложно переводить в auth.

## AI safety
- Safe for autonomous implementation: yes
- Risk level: low
- Reason: Проверка существующего route-title контракта; auth-политика не меняется.

## Evidence
- [frontend/src/app/useAppRoute.ts](../../../frontend/src/app/useAppRoute.ts)
- [frontend/src/app/useAppRoute.test.tsx](../../../frontend/src/app/useAppRoute.test.tsx)
- [frontend/src/App.tsx](../../../frontend/src/App.tsx)

## Source notes
- Source file: [2026-09-30.md](../../processed/2026-09-30.md)
- Source items: 9 (порядок самостоятельных пунктов, без строк-продолжений).
- Источник наблюдений: UI-аудиты 18.09 и 30.09.2026, стенд c2b6cdf; в этом triage новый runtime-аудит не проводился.

> обновлять title страницы после выхода (на экране входа остаётся «Внимание • K-4PRO»)

## Processing notes
- Created at: 2026-10-05 (MSK).
- Created by skill: codex-backlog-skill.
- Mode: triage; scope: два файла inbox, без глобальной сверки статусов.
- Duplicate check: TASK-126 декомпозировала shell. Новый аудит — отдельный regression candidate, не основание переоткрывать весь рефакторинг.
- Проверены активные карточки, unfinished plans и рекурсивный done; новые ID выделены после TASK-171.

## Status audit 2026-11-21
- tasks-ready: title lifecycle уже учитывает session; закрытие требует browser logout/login и build evidence.
- Основание: локальная main, связанные планы и записи согласования; нового runtime-аудита не было.

### Повторная сверка 2026-11-21
- Session-aware title lifecycle уже присутствует; нужна проверка logout/login в браузере. Сохраняется tasks-ready, готового плана нет.
- Основание: текущая локальная main и сохранённые доказательства; новый runtime-аудит не выполнялся.

## Завершение

- completed_at: 2026-11-21
- completion_date_evidence: в этот день выполнена [браузерная проверка](#браузерная-проверка-21112026), прямо предусмотренная карточкой для закрытия без изменения кода.

### Браузерная проверка 21.11.2026

Проверены production-сборка локальной `main` (`e05c693`, JS `index-DRbl2l1X.js`) и backend из той же рабочей копии. Тестовый HTTP-сервер использовал отдельную PostgreSQL, штатную аутентификацию с cookie и CSRF и имя клуба `K-4PRO`. В исходном наблюдении указан стенд `c2b6cdf`. В обеих версиях ветка для завершённой сессии в `getAppDocumentTitle` формирует заголовок входа. Причину наблюдения на старом стенде установить по текущему запуску нельзя.

| Действие в интерфейсе | Проверенный результат |
|---|---|
| Войти главным тренером, открыть «Внимание» или «Группы» | Соответственно «Внимание • K-4PRO» или «Группы • K-4PRO» |
| Выбрать «Выход» в меню профиля | HTTP 200, `isAuthenticated: false` в ответе и при отдельном чтении сессии. Появилось поле логина, заголовок вкладки — «Войти в K-4PRO» |
| Повторно войти через форму | HTTP 200, открыт `/attention`, заголовок — «Внимание • K-4PRO» |
| Отдельно вернуть HTTP 500 на запрос выхода | Видна ошибка. Исходные URL и заголовок сохранены для обоих разделов, форма входа не появилась |

Успешные переходы проверены с действующим API. Для сценария отказа использованы ответы браузерной фикстуры. Оба маршрута пройдены в Desktop Chromium и двух профилях WebKit, iPhone Air и iPhone 17 Pro Max (Playwright 1.59.1). Регрессия на проверенной сборке не воспроизвелась.
