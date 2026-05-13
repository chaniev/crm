# TASK-038: Реализовать frontend вкладку Финансы и отчеты

## Status
risky

## Goal
В главном меню появляется вкладка `Финансы`, где главный тренер видит отчеты первого релиза по backend-контрактам без локального пересчета финансовых формул.

## Context
Задача создана после закрытия уточнений в `TASK-026` и должна выполняться после backend report API из `TASK-037`.

Первый релиз UI должен показать:
- количество проданных абонементов;
- количество новых клиентов;
- валовую сумму продаж;
- сумму возвратов;
- чистую сумму;
- фильтры по периоду, филиалу и тренеру;
- быстрые периоды месяц/квартал/год;
- произвольный диапазон.

## User role
главный тренер

## Problem
Пользователю нужен понятный рабочий экран отчетов, но frontend не должен владеть финансовыми формулами, trainer attribution, branch semantics или правилами доступа. UI должен только отправлять фильтры и отображать backend totals/breakdowns.

## Scope
- Добавить route/section `Финансы` в main navigation на основе backend access contract.
- Добавить frontend API types/client для backend report API из `TASK-037`.
- Добавить экран финансовых отчетов.
- Добавить controls для быстрых периодов: месяц, квартал, год.
- Добавить выбор произвольного диапазона дат.
- Добавить фильтр филиала: все филиалы или конкретный филиал.
- Добавить фильтр тренера, если backend contract поддерживает trainer filter/breakdown.
- Отобразить sold memberships count и new clients count.
- Отобразить gross sales, refund total и net total из backend response.
- Добавить empty/loading/error states.
- Показать backend ProblemDetails для некорректных фильтров.
- Обеспечить narrow-screen layout.
- Обновить e2e/route tests для видимости вкладки и базового сценария отчета.

## Out of scope
- Backend report formulas.
- Backend permissions.
- Возвраты и membership sale semantics.
- Локальный пересчет gross/refund/net totals.
- Bot consumer.
- Экспорт XLS/PDF, если отдельно не согласован.

## Constraints
- Frontend должен потреблять backend totals и breakdowns как source of truth.
- Нельзя дублировать финансовые формулы во frontend.
- Нельзя самостоятельно выводить право доступа к финансовым данным вне backend session/access contract.
- Preserve Mantine and Onest.
- Значимое UX-изменение секции отчетов должно быть согласовано с `ui-designer` на этапе реализации.
- Экран должен быть рабочим интерфейсом, не landing page.

## Dependencies
- `backlog/risky/TASK-037-financial-reports-backend-api.md`

## Acceptance criteria
- [ ] В главном меню есть вкладка `Финансы` для пользователя с доступом.
- [ ] Пользователь без доступа не видит вкладку или получает корректный redirect/forbidden flow согласно существующим frontend patterns.
- [ ] Экран позволяет выбрать месяц, квартал, год и произвольный диапазон.
- [ ] Экран позволяет выбрать все филиалы или конкретный филиал.
- [ ] Экран отображает данные по тренерам согласно backend response.
- [ ] Экран показывает количество проданных абонементов и новых клиентов.
- [ ] Экран показывает валовую сумму продаж, сумму возвратов и чистую сумму.
- [ ] Frontend не пересчитывает финансовые формулы, а отображает backend response.
- [ ] Empty/loading/error states выглядят корректно на desktop и mobile.
- [ ] Lint/build проходят.

## Test checklist
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Запустить affected Playwright/e2e тесты для navigation/report flow.
- [ ] Проверить видимость вкладки `Финансы` для `HeadCoach`.
- [ ] Проверить отсутствие доступа для ролей без financial permission.
- [ ] Проверить empty state на пустом отчете.
- [ ] Проверить отображение backend ProblemDetails для невалидных фильтров.
- [ ] Проверить mobile/narrow-screen layout.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача добавляет финансовый UI, depends on backend contracts и access behavior.

## Clarification questions
Не требуется перед планированием. Перед реализацией остановиться, если backend report API из `TASK-037` еще не стабилен или не содержит required totals.

## Source notes
- Derived from: `backlog/done/TASK-026-statistics-and-financial-reports.md`
- Depends on: `backlog/risky/TASK-037-financial-reports-backend-api.md`

## Processing notes
- Created at: 2026-05-13 20:54
- Created by decomposing `TASK-026`.
