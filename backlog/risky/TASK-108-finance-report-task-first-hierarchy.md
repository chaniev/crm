# TASK-108: Вернуть финансовому отчёту task-first hierarchy

## Status
risky

## Goal
Пользователь сразу видит период и scope отчёта, отличает отсутствие операций от ошибки и быстро переходит от KPI к продажам, возвратам и breakdown.

## Context
На `440 x 956` период, филиал и тренер скрыты за generic trigger `Фильтры`. Пять крупных KPI-карточек с нулевыми значениями вытесняют операционные данные ниже первого экрана. UX-аудит предлагает compact scope summary, KPI strip, единый empty state и stale/retry behavior.

## User role
SuperAdministrator / HeadCoach и другие роли с backend-разрешённым доступом к финансовым отчётам.

## Problem
Mobile hierarchy скрывает контекст расчёта и делает нулевой период похожим на длинный набор бессодержательных метрик. При ошибке пользователь может неверно принять ранее загруженные данные за актуальные.

## Scope
- Показать compact summary текущего периода, филиала и тренера до открытия фильтров.
- Сохранить фильтры компактными в закрытом состоянии и явно показать active scope/reset.
- Заменить вертикальную колонку KPI на компактный strip/summary, не меняя значения и порядок расчёта.
- Показывать единый явный empty state, когда в выбранном scope нет операций.
- Поднять начало sales/refunds/breakdown в первый intentional scroll.
- При ошибке помечать сохранённые предыдущие данные как stale и размещать retry внутри report surface.
- Обновить component и Playwright regression coverage.

## Out of scope
- Изменение формул, attribution, округления, валюты, sales/refund semantics или backend report contracts.
- Локальный пересчёт финансовых значений во frontend.
- Изменение ролей, permissions или доступного branch/trainer scope.
- Добавление новых KPI или экспортов.

## Constraints
- Backend остаётся единственным source of truth для финансовых значений, фильтров, permissions и historical attribution.
- UI не должен показывать нули вместо loading/error или скрывать частично недоступные данные.
- Stale state должен отличаться текстом и semantics, а не только цветом.
- Изменение presentation не должно менять query parameters или interpretation отчёта.
- На `390 x 844`, `420 x 912`, `440 x 956` и compact landscape scope и recovery остаются достижимыми без horizontal overflow.

## Acceptance criteria
- [ ] Период и active branch/trainer scope видны до открытия фильтров.
- [ ] Active filters сбрасываются предсказуемо и не меняют backend semantics.
- [ ] При отсутствии операций показывается один явный empty state, а не серия нулевых KPI surfaces.
- [ ] При наличии операций KPI и начало sales/refunds/breakdown доступны в первом intentional scroll.
- [ ] Ошибка не подменяется нулевыми значениями; предыдущие данные явно помечены stale, retry находится внутри report surface.
- [ ] Loading, empty, partial/error, stale и success states однозначно различимы.
- [ ] На обязательных mobile размерах нет horizontal overflow, недостижимых filters или перекрытого recovery.

## Test checklist
- [ ] Добавить component cases для non-empty, zero/empty, loading, error без данных и stale-data error.
- [ ] Проверить, что UI отображает backend values без локального пересчёта.
- [ ] Добавить Playwright для периода/branch/trainer scope, reset и retry.
- [ ] Проверить long names, large/negative values, currency wrapping и responsive hierarchy.
- [ ] Проверить role/permission-restricted response без раскрытия скрытых финансовых данных.

## AI safety
- Safe for Codex: no
- Risk level: medium
- Reason: даже presentation-only изменение финансового отчёта влияет на доверие к данным и error/stale interpretation; нужны human review и regression guardrails.

## Clarification questions
Не требуется для bounded frontend-задачи: используются только текущие backend values и filters. Любая потребность изменить расчёт или контракт должна быть остановлена и вынесена отдельно.

## Source notes
- Source file: `backlog/processed/2026-08-02.md`
- Original note: `UX-2026-08-02-07 — вернуть Финансам task-first hierarchy`.
- Evidence: `backlog/processed/assets/2026-08-02-usability-audit/annotated-finance-440x956.png`.

## Processing notes
- Created at: 2026-08-02 14:44
- Created by skill: codex-backlog-skill + crm-mobile-first-ui
- Duplicate check: активного дубликата нет; завершённая TASK-038 реализовала frontend reports baseline, но не закрывает текущую mobile hierarchy и stale/error проблему.
- Classification: risky по правилу skill для financial reports, даже при явном presentation-only scope.
