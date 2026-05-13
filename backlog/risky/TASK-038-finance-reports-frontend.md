# TASK-038: Реализовать frontend вкладку Финансы и отчеты

## Status
risky

## Goal
В главном меню появляется вкладка `Финансы`, где главный тренер видит отчеты первого релиза по backend-контрактам без локального пересчета финансовых формул.

## Context
Задача создана после закрытия уточнений в `TASK-026` и должна выполняться после backend report API из `TASK-037`.

`TASK-036` и `TASK-037` фиксируют, что frontend не владеет sale/refund semantics:
- валовая сумма продажи хранится backend-ом в stable sale contract, например `ClientMembershipSale.GrossAmount`;
- `ClientMembership.PaymentAmount` не уменьшается возвратами, но frontend не использует его как источник финансовых агрегатов;
- возвраты приходят в report API как backend totals/breakdowns, рассчитанные по отдельным refund events;
- отмененные возвраты исключаются backend-ом из financial report totals;
- валовая сумма продаж, сумма возвратов и чистая сумма считаются backend-ом;
- технические версии абонемента не должны отражаться в UI как дополнительные продажи.
- филиал, группа и тренер для отчета определяются backend-ом по историческим периодам привязок на дату финансового события;
- если клиент или тренер привязаны к нескольким группам, backend может вернуть duplicated group/trainer breakdown rows, и их сумма может отличаться от canonical totals.

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
- Отображать backend breakdowns без пересчета строк и без повторного применения sale/refund formulas во frontend.
- Отображать duplicated group/trainer breakdown rows из backend response без дедупликации.
- Использовать backend labels/contract для refund-related totals; не выводить refund total из списка абонементов или локальной истории.
- Не фильтровать отмененные возвраты локально; UI отображает уже рассчитанные backend totals.
- Не трактовать полный возврат как удаление продажи из UI, если backend response оставляет продажу в gross sales/sold count.
- Добавить empty/loading/error states.
- Показать backend ProblemDetails для некорректных фильтров.
- Обеспечить narrow-screen layout.
- Обновить e2e/route tests для видимости вкладки и базового сценария отчета.

## Out of scope
- Backend report formulas.
- Backend permissions.
- Реализация возвратов, membership sale semantics и sale identity.
- UI для регистрации или отмены возврата, если это не входит в backend report contract первого релиза.
- Локальная сборка refund total из абонементов, refund details или membership history.
- Локальный пересчет gross/refund/net totals.
- Bot consumer.
- Экспорт XLS/PDF, если отдельно не согласован.

## Constraints
- Frontend должен потреблять backend totals и breakdowns как source of truth.
- Нельзя дублировать финансовые формулы во frontend.
- Нельзя читать `ClientMembershipSale.GrossAmount`, `ClientMembership.PaymentAmount`, membership history или refund details и самостоятельно строить финансовые агрегаты.
- Нельзя локально исключать/добавлять отмененные возвраты в финансовые суммы; это делает backend.
- Нельзя исключать полностью возвращенные продажи из количества/валовой суммы на стороне frontend; UI отображает backend response.
- Нельзя интерпретировать технические версии абонемента как отдельные продажи во frontend.
- Нельзя дедуплицировать group/trainer breakdown rows или требовать, чтобы сумма breakdown rows равнялась canonical totals.
- Нельзя локально определять филиал/тренера по текущему состоянию клиента, группы или тренера.
- Нельзя самостоятельно выводить право доступа к финансовым данным вне backend session/access contract.
- Preserve Mantine and Onest.
- Значимое UX-изменение секции отчетов должно быть согласовано с `ui-designer` на этапе реализации.
- Экран должен быть рабочим интерфейсом, не landing page.

## Dependencies
- `backlog/risky/TASK-036-membership-refunds-sale-semantics.md` через backend contracts из `TASK-037`
- `backlog/risky/TASK-037-financial-reports-backend-api.md`

## Acceptance criteria
- [ ] В главном меню есть вкладка `Финансы` для пользователя с доступом.
- [ ] Пользователь без доступа не видит вкладку или получает корректный redirect/forbidden flow согласно существующим frontend patterns.
- [ ] Экран позволяет выбрать месяц, квартал, год и произвольный диапазон.
- [ ] Экран позволяет выбрать все филиалы или конкретный филиал.
- [ ] Экран отображает данные по тренерам согласно backend response.
- [ ] Экран отображает duplicated group/trainer breakdown rows согласно backend response без frontend-дедупликации.
- [ ] Экран показывает количество проданных абонементов и новых клиентов.
- [ ] Экран показывает валовую сумму продаж, сумму возвратов и чистую сумму.
- [ ] Frontend не пересчитывает финансовые формулы, а отображает backend response.
- [ ] Frontend не строит финансовые агрегаты из sale contract, membership history, `PaymentAmount` или refund details.
- [ ] Отмененные возвраты отражаются только через backend totals; frontend не фильтрует их самостоятельно.
- [ ] Полностью или частично возвращенные продажи отображаются согласно backend totals без frontend-исключений.
- [ ] Empty/loading/error states выглядят корректно на desktop и mobile.
- [ ] Lint/build проходят.

## Test checklist
- [ ] Запустить `cd frontend && npm run lint`.
- [ ] Запустить `cd frontend && npm run build`.
- [ ] Запустить affected Playwright/e2e тесты для navigation/report flow.
- [ ] Проверить видимость вкладки `Финансы` для `HeadCoach`.
- [ ] Проверить отсутствие доступа для ролей без financial permission.
- [ ] Проверить empty state на пустом отчете.
- [ ] Проверить отображение duplicated group/trainer breakdown rows, когда backend/mock API возвращает несколько строк для одного финансового события.
- [ ] Проверить, что UI не пересчитывает canonical totals как сумму breakdown rows.
- [ ] Проверить отображение отчета с продажей, частичным возвратом и полным возвратом по данным backend/mock API.
- [ ] Проверить отображение отчета после отмены возврата по данным backend/mock API.
- [ ] Проверить, что frontend не пересчитывает `net total` при изменении mock payload, а отображает значение из response.
- [ ] Проверить отображение backend ProblemDetails для невалидных фильтров.
- [ ] Проверить mobile/narrow-screen layout.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача добавляет финансовый UI, depends on backend contracts и access behavior.

## Clarification questions
Не требуется перед планированием. Перед реализацией остановиться, если backend report API из `TASK-037` еще не стабилен, не содержит required totals или не отражает sale/refund semantics из `TASK-036`.

## Source notes
- Derived from: `backlog/done/TASK-026-statistics-and-financial-reports.md`
- Depends on: `backlog/risky/TASK-036-membership-refunds-sale-semantics.md` through `TASK-037` contracts
- Depends on: `backlog/risky/TASK-037-financial-reports-backend-api.md`

## Processing notes
- Created at: 2026-05-13 20:54
- Created by decomposing `TASK-026`.
- Updated at: 2026-05-13 to align frontend consumer requirements with `TASK-036`/`TASK-037` sale and refund semantics.
- Updated at: 2026-05-13 to treat refund cancellation as backend-owned report semantics.
- Updated at: 2026-05-13 to display backend historical attribution and duplicated multi-group breakdown rows without frontend deduplication.
