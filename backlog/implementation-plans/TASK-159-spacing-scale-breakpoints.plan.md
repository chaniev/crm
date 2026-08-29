# Implementation Plan: TASK-159 Шкала отступов 4px и гигиена узких брейкпоинтов

## Metadata
- source_task: /backlog/implementation/TASK-159-spacing-scale-breakpoints.md
- requirements: none — behavior-preserving консолидация отступов и брейкпоинтов в токены с сохранением вычисляемой геометрии
- branch: feature/TASK-159-spacing-scale-breakpoints
- readiness: yes
- dependencies: none; массовая миграция значений `App.css` не выполняется (владелец — TASK-154); координировать порядок интеграции, если TASK-154 уже в работе
- risk: low — токены + линтинг без изменения computed-геометрии

## Goal
Шкала `--crm-space-1..8` (4/8/12/16/20/24/32/48px) опубликована из `foundationSpacing` с drift-тестом; сканер падает на новых raw spacing-значениях вне allowlist; узкие пороги затронутых файлов ссылаются на алиасы `foundationBreakpoints`.

## Decisions and contracts
- Шкала 4px-сетки публикуется как `--crm-space-1..8`; существующие page-level переменные не переименовываются.
- Мобильный ритм списков документируется в каталоге: 8px внутри группы, 12px между строками, 16–24px между секциями.
- `foundationBreakpoints` получает минимальные алиасы для guardrail 360px (например, `narrowMax`); миграция ad-hoc порогов (`20em`, `21.99em`, `22.5em`, `24.375em`, `26.25em`, `27.5em`) — только в затрагиваемых файлах.
- Сканер по образцу `scripts/check-raw-colors.mjs` / `raw-color-scanner.mjs`: свойство-скоуп (padding/margin/gap), allowlist для существующих значений; новые значения вне шкалы — ошибка.
- Единая мобильная граница `48rem` не дублируется.

## Scope
### In
- Токены шкалы и алиасы, сканер с allowlist, drift/unit-тесты, каталог, точечная миграция порогов в затрагиваемых файлах.

### Out
- Массовая миграция всех значений `App.css`; изменение computed-геометрии.

## Implementation slices
1. RED: drift-тест шкалы в foundations (падает до публикации переменных) и сканер-тест на фиксирующем fixture с `margin: 13px` вне allowlist.
2. Опубликовать `--crm-space-1..8` и breakpoint-алиасы; завести сканер и allowlist; подключить сканер в frontend checks рядом с raw-color сканером.
3. Перевести узкие пороги затрагиваемых файлов на алиасы; обновить каталог (`src/catalog`).
4. Before/after-проверка выборочных экранов на 390/420/1440 — computed-геометрия без различий.

## Likely files and layers
- `frontend/src/theme/foundations.ts` — шаги шкалы, алиасы брейкпоинтов, публикация переменных.
- `frontend/scripts/raw-spacing-scanner.mjs` + `frontend/scripts/raw-spacing-allowlist.json` + `frontend/scripts/check-raw-spacing.mjs` — сканер по образцу color-сканера TASK-150.
- `frontend/package.json` — wiring сканера.
- `frontend/src/theme/registry.test.ts` или focused foundations-тест — drift.
- `frontend/src/catalog/` — раздел ритма списков.

## Regression specification
### Automated tests to add or update
- Foundations drift: `--crm-space-1..8` равны 4/8/12/16/20/24/32/48px; алиасы брейкпоинтов существуют и не конфликтуют с `48rem`-правилом.
- Сканер: violating fixture (новое raw spacing-значение вне allowlist) — nonzero exit; allowlisted значения — pass.

### Expected red evidence
- Drift-тест падает до публикации шкалы; сканер-тест падает до реализации сканера (отсутствует exit-контракт).

### Required validation
- Root verification harness для frontend diff (сканер входит в baseline checks).

### Manual evidence
- Выборочная before/after rendered-сверка геометрии 390/420/1440 без различий (скриншоты или computed-замеры).

### Regression barrier
- Сканер, встроенный в frontend checks, падающий на out-of-scale raw spacing-значении.

## Risks and stop conditions
- False positives сканера (transform/position/времена анимаций) — скоуп свойств `padding/margin/gap`, при спорных случаях расширять allowlist с комментарием, не ослаблять скоуп молча.
- Если миграция порога в затрагиваемом файле меняет вычисленную ширину срабатывания — заменить только на точно эквивалентный алиас; иначе оставить значение и внести в allowlist.
- Не выполнять массовую миграцию значений — это территория TASK-154/отдельной задачи.
