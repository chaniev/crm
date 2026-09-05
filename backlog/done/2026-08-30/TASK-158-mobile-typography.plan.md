# Implementation Plan: TASK-158 Мобильные переопределения типографской шкалы

## Metadata
- source_task: /backlog/done/2026-08-30/TASK-158-mobile-typography.md
- completion: implemented and locally integrated into main on 2026-08-30
- requirements: REQ-NFR-001 (constrains)
- branch: feature/TASK-158-mobile-typography
- readiness: yes
- dependencies: none; координировать с TASK-154 (risky, разбиение `App.css`) — переопределения держать одним именованным блоком
- risk: low — presentation-only переопределение CSS-переменных на `≤ 48rem`

## Goal
На `390/420/440px` экранные H1/H2 рендерятся ≤ 22/18px весом ≤ 700; `label`/`numeric` без веса 800; двухстрочные мета-строки имеют line-height ≥ 1.3; `> 48rem` геометрия типографики не изменилась.

## Decisions and contracts
- Мобильные значения: `heading1` ~22px/700, `heading2` ~18px/700, `heading3` 16px/700; вес `label` и `numeric` 800 → 700; `bodyCompact` line-height 1.25 → ~1.35; `display` не меняется (auth).
- Переобъявление `--crm-type-*` на `≤ 48rem` в одном месте — единый именованный блок рядом с текущей публикацией root-переменных (`App.css :root` уже публикует `--crm-type-display-*`; альтернатива — theme-механизм `createTypographyVariables`), без изменения самих ролей в `typography.ts`.
- Роли, доменные тексты, `formControl` 1rem и правило 16 CSS px против iOS-зума не меняются.

## Scope
### In
- Media-переопределения переменных, каталог мобильных состояний типографики, rendered-проверка реестров/«Внимания»/заголовков форм.

### Out
- Массовая правка экранов; изменение состава ролей; `> 48rem`.

## Implementation slices
1. RED: computed-style тесты заголовков на 360/390/420/440 (текущие ~28px/800 падают) и unchanged-проверки на 768/1440.
2. Добавить единый mobile-override блок `--crm-type-*`; получить green.
3. Обновить каталог `src/catalog` мобильными состояниями; contrast matrix прогон.

## Likely files and layers
- `frontend/src/App.css` — mobile-override блок переменных (или theme-механизм по месту публикации).
- `frontend/src/theme/typography.ts` — только если выбран механизм mobile-карты в theme; роли не менять.
- `frontend/src/theme/registry.test.ts` / новый focused-тест — drift покрытия переменных.
- `frontend/src/catalog/SharedComponentsCatalog.tsx` + `catalogInventory.ts` — мобильные состояния типографики.
- `frontend/e2e/responsive-main-screens.spec.ts` — затронутые сценарии (если применяются).

## Regression specification
### Automated tests to add or update
- Computed-style assertions на 360/390/420/440: H1 ≤ 22px/≤700, H2 ≤ 18px/≤700, `label`/`numeric` ≠ 800, `bodyCompact` line-height ≥ 1.3.
- Unchanged-проверки на 768/1440: вычисленная геометрия ролей идентична baseline.
- Contrast matrix по всем профилям — зелёная (цвета не меняются).
- Затронутые Playwright-флоу + `npm run test:e2e:iphone`.

### Expected red evidence
- Компьютид-тест на `420 x 912` падает на текущем H1 ~28px/800 — RED до добавления override-блока.

### Required validation
- Root verification harness для frontend diff; focused catalog visual matrix.

### Manual evidence
- Rendered-сверка реестров (Клиенты/Тренеры/Журнал — baseline), «Внимание», заголовков форм на 390/420 до/после.

### Regression barrier
- Computed-style тест мобильной типографики на `420 x 912` по репрезентативным ролям + unchanged-ассерт на `1440`.

## Risks and stop conditions
- Если какой-либо экран полагается на размер заголовка в layout (перенос/overflow) — остановиться и зафиксировать экран; не компенсировать локальными правками размеров.
- Конфликт с TASK-154: override держать одним блоком с комментарием-именем; если TASK-154 уже интегрирован — разместить блок в соответствующем модуле CSS.

## Task-branch evidence
- Boundary resolution: `max-width: 48rem` применяется включительно; `768px`
  относится к mobile boundary, а unchanged desktop assertions выполняются на
  `769px` и `1440px`.
- RED: computed-style matrix на `360/390/420/440px` получила H1 `28px/800`;
  desktop barriers `769/1440px` уже соответствовали исходной шкале.
- GREEN: computed-style matrix проходит на `360/390/420/440/768/769/1440px`;
  catalog rendered matrix включает registry/operational/form states на
  `390/420/440px`, а target-iPhone WebKit regression проходит на обоих
  профилях.
- Device-level Safari chrome, software keyboard, real safe-area, Dynamic
  Island, home indicator и one-handed reach остаются неподтверждёнными до
  Simulator или physical-device проверки.
