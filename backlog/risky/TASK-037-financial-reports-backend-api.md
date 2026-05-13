# TASK-037: Реализовать backend API статистики и финансовых отчетов

## Status
risky

## Goal
Главный тренер получает backend-owned API финансовых и статистических отчетов первого релиза с корректными фильтрами, периодами и агрегатами.

## Context
Задача создана после закрытия уточнений в `TASK-026` и зависит от backend-семантики возвратов из `TASK-036`.

`TASK-036` фиксирует, что:
- возвраты хранятся отдельными финансовыми событиями, а не уменьшают `ClientMembership.PaymentAmount`;
- финансовая продажа хранится в стабильной сущности/contract, например `ClientMembershipSale`;
- `ClientMembershipSale.GrossAmount` является источником валовой суммы продажи;
- несколько частичных возвратов по одной продаже разрешены, но суммарный возврат не должен превышать валовую сумму продажи;
- возврат можно отменить через cancel-state без удаления записи;
- отмененные возвраты не учитываются в финансовых суммах;
- дата возврата не может быть в будущем, раньше покупки или раньше создания продажи;
- `NewPurchase` и `Renewal` создают продажи;
- `Correction`, `PaymentUpdate`, `SingleVisitWriteOff` являются техническими версиями и не создают новые продажи;
- `Correction` обновляет `ClientMembershipSale.PurchaseDate` и/или `ClientMembershipSale.GrossAmount`, если исправляет дату покупки или сумму продажи, и такое изменение аудируется.

Первый релиз отчетов должен включать:
- количество проданных абонементов за период;
- валовую сумму продаж;
- сумму возвратов;
- чистую сумму;
- количество новых клиентов с выбранной даты;
- фильтр филиала: конкретный филиал или все филиалы;
- учет тренеров через группы, которые они ведут;
- быстрые периоды: месяц, квартал, год;
- произвольный период.

Филиалы и группы уже введены через `TASK-031`: клиент принадлежит одному филиалу, группа принадлежит одному филиалу, тренер связан с группами через `GroupTrainer`, прямой связи `тренер-филиал` нет.

## User role
главный тренер

## Problem
Frontend не должен считать финансовые формулы локально. Нужен backend API, который централизованно применяет правила периодов, фильтров, trainer attribution, branch attribution, возвратов и доступа к финансовым данным.

## Scope
- Добавить backend report query/API для финансовой вкладки.
- Добавить backend-owned contract для фильтров: быстрый период, произвольный диапазон, филиал, тренер.
- Вернуть агрегаты: sold membership count, new client count, gross sales, refund total, net total.
- Поддержать breakdown по филиалам и тренерам, если это требуется для UI первого релиза.
- Использовать `ClientMembershipSale` или эквивалентную stable sale entity из `TASK-036`; не строить отчет напрямую поверх всех строк `ClientMemberships`.
- Считать продажи по `ClientMembershipSale.PurchaseDate`.
- Исключить из gross sales и sold membership count технические версии `Correction`, `PaymentUpdate`, `SingleVisitWriteOff`.
- Считать возвраты по отдельным refund events из `TASK-036`, по `RefundDate`.
- Исключать отмененные refund events из refund total, net total и breakdowns.
- Включать в refund total все возвраты, дата возврата которых попадает в период, даже если purchase date исходной продажи вне периода.
- Считать gross sales как сумму `ClientMembershipSale.GrossAmount` без уменьшения на возвраты.
- Считать refund total как сумму неотмененных `ClientMembershipRefund.Amount`.
- Считать net total как `gross sales - refund total` для выбранного периода.
- Считать новых клиентов по дате первой покупки нового абонемента.
- Считать филиал через backend branch relation клиента.
- Считать тренера через группы, которые он ведет.
- Добавить permission/access behavior для финансовых отчетов: доступ имеет `HeadCoach`, остальные роли получают согласованный отказ.
- Добавить ProblemDetails для некорректных фильтров периода, филиала и тренера.
- Обновить OpenAPI/typed contracts, если в проекте есть contract generation или typed DTO conventions.

## Out of scope
- Frontend экран `Финансы`.
- Создание модели возвратов, `ClientMembershipSale` или membership refund summary, если они еще не выполнены в `TASK-036`.
- Регистрация или отмена возврата, если они еще не выполнены в `TASK-036`.
- Legacy/backfill поддержка частично заполненной базы.
- Изменение бизнес-правил филиалов, групп или тренерского access scope.
- Учет отмен и заморозок.
- Отмена доступа по полному возврату.
- Расчет зарплаты тренеров.
- Внешние платежные провайдеры и бухгалтерская сверка.

## Constraints
- Backend является единственным источником financial report semantics.
- Frontend и bot не должны пересчитывать gross/refund/net totals.
- Report API должен опираться на financial sale/refund semantics из `TASK-036`.
- Report API должен брать валовые продажи из `ClientMembershipSale` или эквивалентного stable sale contract.
- Не суммировать все строки membership history как продажи.
- Возвраты не уменьшают gross sales; они попадают только в refund total и net total.
- Отмененные возвраты не попадают в refund total, net total и breakdowns.
- Полный возврат не должен исключать исходную продажу из sold membership count или gross sales.
- Report API рассчитан на чистую схему из `TASK-036`; fallback для частично заполненных legacy-данных не требуется.
- Не добавлять прямую связь тренера с филиалом.
- Не расширять роли и permissions шире `HeadCoach` без отдельного решения.
- Не считать технические версии абонемента отдельными продажами.
- Contract changes требуют обновления frontend consumer task `TASK-038`.

## Dependencies
- `backlog/done/TASK-031-branches-backend-domain-contracts.md`
- `backlog/risky/TASK-036-membership-refunds-sale-semantics.md`

## Acceptance criteria
- [ ] В backend есть endpoint или report service для финансовых отчетов первого релиза.
- [ ] API принимает быстрые периоды месяц/квартал/год и произвольный диапазон.
- [ ] API поддерживает фильтр одного филиала и всех филиалов.
- [ ] API поддерживает trainer attribution через группы тренера.
- [ ] API возвращает sold membership count, new client count, gross sales, refund total и net total.
- [ ] Продажи считаются по `ClientMembershipSale.PurchaseDate` или эквивалентному stable sale contract из `TASK-036`.
- [ ] Gross sales считается по `ClientMembershipSale.GrossAmount`.
- [ ] `NewPurchase` и `Renewal` учитываются как продажи.
- [ ] `Correction`, `PaymentUpdate`, `SingleVisitWriteOff` не учитываются как отдельные продажи.
- [ ] Возвраты считаются по дате возврата из отдельных refund events.
- [ ] Отмененные возвраты не учитываются в refund total, net total и breakdowns.
- [ ] Возвраты по продажам вне периода попадают в refund total, если `RefundDate` внутри периода.
- [ ] Gross sales не уменьшается возвратами, включая полный возврат.
- [ ] Net total считается как gross sales минус refund total.
- [ ] Нулевые абонементы учитываются в количестве и дают `0` в gross sales.
- [ ] HeadCoach имеет доступ к финансовым данным.
- [ ] Неавторизованные роли не получают финансовые данные.
- [ ] Backend integration tests покрывают формулы, фильтры и доступ.

## Test checklist
- [ ] Запустить `dotnet test backend/GymCrm.slnx`.
- [ ] Проверить месяц/квартал/год и произвольный период.
- [ ] Проверить branch filter для одного филиала и всех филиалов.
- [ ] Проверить trainer filter на группах с одним и несколькими тренерами.
- [ ] Проверить gross/refund/net на продажах, возвратах и нулевых абонементах.
- [ ] Проверить, что продажа с полным возвратом остается в sold membership count и gross sales периода покупки.
- [ ] Проверить несколько частичных возвратов по одной продаже.
- [ ] Проверить, что отмененный возврат не влияет на refund total, net total и breakdowns.
- [ ] Проверить, что correction даты/суммы покупки меняет период/gross sales отчета через обновленную финансовую продажу.
- [ ] Проверить возврат в периоде, когда исходная продажа была вне выбранного периода.
- [ ] Проверить, что correction/payment update/single-visit write-off не завышают sold membership count и gross sales.
- [ ] Проверить new clients count по первой покупке.
- [ ] Проверить запрет доступа для `Administrator` и `Coach`, если доступ остается только у `HeadCoach`.
- [ ] Проверить ProblemDetails для некорректных фильтров.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача реализует финансовые агрегаты, права доступа и backend contracts.

## Clarification questions
Не требуется перед планированием. Перед реализацией остановиться, если `TASK-036` не предоставил `ClientMembershipSale` или эквивалентный stable sale contract, или если product decision потребует исторический snapshot филиала/группы/тренера на момент покупки вместо текущих backend-связей.

## Source notes
- Derived from: `backlog/done/TASK-026-statistics-and-financial-reports.md`
- Related to: `backlog/risky/TASK-025-trainer-membership-total-report.md`
- Depends on: `backlog/risky/TASK-036-membership-refunds-sale-semantics.md`
- Enables: `backlog/risky/TASK-038-finance-reports-frontend.md`

## Processing notes
- Created at: 2026-05-13 20:54
- Created by decomposing `TASK-026`.
- This task should absorb the trainer financial reporting need from `TASK-025` if the implementation covers trainer breakdowns.
- Updated at: 2026-05-13 to align with `TASK-036` sale identity and separate refund event semantics.
- Updated at: 2026-05-13 to align report formulas with explicit `ClientMembershipSale` and correction-updates-sale semantics.
- Updated at: 2026-05-13 to exclude canceled refunds from reports and assume clean-database rollout from `TASK-036`.
