# Implementation Plan: TASK-160 Поверхности list-row и focus-card как нормы дизайн-системы

## Metadata
- source_task: /backlog/done/2026-08-30/TASK-160-list-row-surfaces.md
- completion: implemented and locally integrated into main on 2026-08-30
- requirements: REQ-NFR-001 (constrains)
- branch: feature/TASK-160-list-row-surfaces
- readiness: yes
- dependencies: none; consumers TASK-157/163/164 реализуются после интеграции этой задачи
- risk: low — token-level нормализация с репрезентативной миграцией двух списков; перекомпоновка экранов вынесена в TASK-163/164

## Goal
Foundations публикуют `--crm-surface-list-row` (фон `surfaceSubtle`/card + бордер `borderMuted`, радиус ≤ 16px, без тени) и mobile-переопределение радиусов на `≤ 48rem` (focus 24 → 16px, inner 20 → 12px); «Тренеры» и «Журнал» рендерятся на list-row токенах без изменения вычисляемой плотности; правило «тени только временным/плавающим поверхностям» задокументировано и исполняется.

## Decisions and contracts
- `--crm-radius-card` остаётся focus-поверхностью (auth/detail/временные поверхности); mobile-override радиусов — на `≤ 48rem`, десктоп без изменений.
- Правило элевации: `--crm-elevation-card` и другие тени — только drawer/modal/sticky bar/floating; списковые строки — тон/бордер. Исполнение: расширение сканера или задокументированное ревью-правило в каталоге (фиксируется реализацией по образцу TASK-159).
- Миграция «Тренеров»/«Журнала» — behavior-preserving: computed-геометрия тех же экранов сохраняется в пределах радиуса.
- Raw colors не вводятся; contrast matrix по всем профилям обязательна.

## Scope
### In
- Surface-токены + drift-тест, mobile radius overrides, миграция двух репрезентативных списков, каталог поверхностей, elevation-правило.

### Out
- Перекомпоновка «Внимания»/«Групп» (TASK-163/164); строки расписания (потребляет токены в TASK-157); auth и Mantine-модали.

## Implementation slices
1. RED: drift-тест surface-токенов и computed-тест радиусов на `≤ 48rem` (падают на текущих 24/20px).
2. Опубликовать токены и mobile-переопределения радиусов; каталог — раздел поверхностей с мобильными состояниями.
3. Мигрировать «Тренеры» (`UsersListScreen`) и «Журнал» (`AuditLogScreen`) на `--crm-surface-list-row` без изменения плотности; before/after-сверка 360–440 и 1440.
4. Зафиксировать elevation-правило (сканер или ревью-правило в каталоге); contrast matrix прогон.

## Likely files and layers
- `frontend/src/theme/foundations.ts` — surface-токены, радиусы.
- `frontend/src/theme/semanticVariables.ts` — публикация `--crm-surface-list-row`, mobile-переопределения.
- `frontend/src/theme/registry.test.ts` / focused drift-тест.
- `frontend/src/features/users/UsersListScreen.tsx`, `frontend/src/features/audit/AuditLogScreen.tsx` — миграция списков.
- `frontend/src/catalog/` — раздел поверхностей.

## Regression specification
### Automated tests to add or update
- Drift: `--crm-surface-list-row` существует, радиус ≤ 16px, без shadow; на `≤ 48rem` focus-радиусы 16/12px, `> 48rem` — 24/20px.
- Component/visual: «Тренеры» и «Журнал» на list-row токенах, вычисленная плотность (высоты строк/кол-во) не изменилась — before/after assertions на 360–440 и 1440.
- Contrast matrix по всем профилям.

### Expected red evidence
- Drift/computed-тест радиусов падает до публикации токенов и mobile-переопределений.

### Required validation
- Root verification harness для frontend diff; affected Playwright flows списков users/audit.

### Manual evidence
- Rendered before/after «Тренеры»/«Журнал» — плотность не изменилась.

### Regression barrier
- Foundations drift-тест поверхностей + computed-ассерт радиусов на `420 x 912` и `1440`.

## Risks and stop conditions
- Mobile radius override затрагивает все карточки, использующие `--crm-radius-card`/inner на `≤ 48rem` — это предусмотрено задачей; если у конкретного экрана визуальная деградация (например, наложение на тень) — остановиться и зафиксировать экран.
- Stop при падении contrast matrix на новых surface-комбинациях — не ослаблять контраст ради токена.
