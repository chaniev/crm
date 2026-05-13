# TASK-037: Реализовать backend API статистики и финансовых отчетов

## Status
risky

## Goal
Главный тренер получает backend-owned API финансовых и статистических отчетов первого релиза с корректными фильтрами, периодами и агрегатами.

## Context
Задача создана после закрытия уточнений в `TASK-026` и зависит от backend-семантики возвратов из `TASK-036`.

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
- Считать продажи по purchase date.
- Считать возвраты по refund date.
- Считать новых клиентов по дате первой покупки нового абонемента.
- Считать филиал через backend branch relation клиента.
- Считать тренера через группы, которые он ведет.
- Добавить permission/access behavior для финансовых отчетов: доступ имеет `HeadCoach`, остальные роли получают согласованный отказ.
- Добавить ProblemDetails для некорректных фильтров периода, филиала и тренера.
- Обновить OpenAPI/typed contracts, если в проекте есть contract generation или typed DTO conventions.

## Out of scope
- Frontend экран `Финансы`.
- Создание модели возвратов, если она еще не выполнена в `TASK-036`.
- Изменение бизнес-правил филиалов, групп или тренерского access scope.
- Учет отмен и заморозок.
- Расчет зарплаты тренеров.
- Внешние платежные провайдеры и бухгалтерская сверка.

## Constraints
- Backend является единственным источником financial report semantics.
- Frontend и bot не должны пересчитывать gross/refund/net totals.
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
- [ ] Продажи считаются по дате покупки.
- [ ] Возвраты считаются по дате возврата.
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
- [ ] Проверить new clients count по первой покупке.
- [ ] Проверить запрет доступа для `Administrator` и `Coach`, если доступ остается только у `HeadCoach`.
- [ ] Проверить ProblemDetails для некорректных фильтров.

## AI safety
- Safe for Codex: no
- Risk level: high
- Reason: задача реализует финансовые агрегаты, права доступа и backend contracts.

## Clarification questions
Не требуется перед планированием. Перед реализацией остановиться, если product decision потребует исторический snapshot филиала/группы/тренера на момент покупки вместо текущих backend-связей.

## Source notes
- Derived from: `backlog/done/TASK-026-statistics-and-financial-reports.md`
- Related to: `backlog/risky/TASK-025-trainer-membership-total-report.md`
- Depends on: `backlog/risky/TASK-036-membership-refunds-sale-semantics.md`
- Enables: `backlog/risky/TASK-038-finance-reports-frontend.md`

## Processing notes
- Created at: 2026-05-13 20:54
- Created by decomposing `TASK-026`.
- This task should absorb the trainer financial reporting need from `TASK-025` if the implementation covers trainer breakdowns.
